import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  zeroAddress,
} from 'npm:viem@2.57.7'
import { privateKeyToAccount } from 'npm:viem@2.57.7/accounts'
import { sepolia } from 'npm:viem@2.57.7/chains'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const rewardWei = 10n * 10n ** 18n

const tokenAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

type ClaimAction = {
  action: 'mint' | 'reconcile' | 'wait' | 'done'
  reason: string
  id: string
  attempt_id: string
  tx_hash: string | null
  status: string
  reward_date: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ status: 'error', txHash: null, message: 'POST만 지원합니다.', rewardDate: null }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const contractAddress = Deno.env.get('TOKEN_CONTRACT_ADDRESS')?.trim()
  const minterKey = readPrivateKey(Deno.env.get('MINTER_PRIVATE_KEY'))
  const rpcUrl = Deno.env.get('SEPOLIA_RPC_URL')?.trim()

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(errorBody('서버 인증 설정이 완료되지 않았습니다.'), 500)
  }

  if (!contractAddress || !isAddress(contractAddress) || !minterKey) {
    return json(errorBody('서버에 토큰 발행 설정이 없어 보상을 지급하지 않습니다.'), 500)
  }

  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1]

  if (!accessToken) {
    return json(errorBody('로그인이 필요합니다.'), 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    return json(errorBody('로그인이 필요합니다.'), 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('wallet_address')
    .eq('id', userData.user.id)
    .maybeSingle()

  const walletAddress = profile?.wallet_address

  if (profileError || !walletAddress || !isAddress(walletAddress)) {
    return json(errorBody('보상을 받을 지갑이 아직 없습니다.'), 400)
  }

  const recipient = walletAddress
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl || undefined),
  })
  const account = privateKeyToAccount(minterKey)
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl || undefined),
  })

  try {
    const code = await publicClient.getBytecode({ address: contractAddress })

    if (!code) {
      return json(errorBody('토큰 계약이 이 주소에 배포되어 있지 않습니다.'), 500)
    }

    const owner = await publicClient.readContract({
      address: contractAddress,
      abi: tokenAbi,
      functionName: 'owner',
    })

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      return json(errorBody('발행 지갑이 토큰 소유자가 아닙니다.'), 500)
    }

    const { data, error } = await admin.rpc('begin_attendance_claim', {
      p_user_id: userData.user.id,
    })

    if (error) {
      console.error('attendance_begin_failed', error.code)
      return json(errorBody('출석 보상을 시작하지 못했습니다.'), 500)
    }

    const claim = readClaim(data)

    if (!claim) {
      return json(errorBody('출석 보상 응답을 확인하지 못했습니다.'), 500)
    }

    if (claim.action === 'done') {
      return json(successBody(claim.reward_date, claim.tx_hash, '오늘은 이미 출석 보상을 받았습니다.'))
    }

    if (claim.action === 'wait') {
      return json({
        status: 'pending',
        txHash: claim.tx_hash,
        rewardDate: claim.reward_date,
        message: '출석 보상을 처리하고 있습니다.',
      })
    }

    if (claim.action === 'reconcile') {
      return json(await reconcile(admin, publicClient, claim))
    }

    let sentHash: `0x${string}` | null = null

    if (claim.reason === 'retry') {
      const recovered = await findTodayMint(publicClient, contractAddress, recipient, claim.reward_date)

      if (recovered) {
        sentHash = recovered
        await attach(admin, claim, recovered)
        return json(await reconcile(admin, publicClient, { ...claim, tx_hash: recovered }))
      }
    }

    const gasBalance = await publicClient.getBalance({ address: account.address })

    if (gasBalance === 0n) {
      await fail(admin, claim)
      return json(errorBody('관리자 지갑의 Sepolia ETH가 없어 보상을 발행하지 못했습니다.', claim.reward_date))
    }

    sentHash = await walletClient.writeContract({
      address: contractAddress,
      abi: tokenAbi,
      functionName: 'mint',
      args: [recipient, rewardWei],
    })

    await attach(admin, claim, sentHash)

    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: sentHash, timeout: 45_000 })

      if (receipt.status !== 'success') {
        await fail(admin, claim)
        return json({
          status: 'error',
          txHash: sentHash,
          rewardDate: claim.reward_date,
          message: '토큰 발행 트랜잭션이 실패했습니다.',
        })
      }

      await complete(admin, claim)
      return json(successBody(claim.reward_date, sentHash, '오늘 10 TNS 출석 보상을 받았습니다.'))
    } catch {
      console.error('attendance_receipt_pending')
      return json({
        status: 'confirming',
        txHash: sentHash,
        rewardDate: claim.reward_date,
        message: 'Sepolia 트랜잭션을 확인하고 있습니다.',
      })
    }
  } catch (error) {
    console.error('attendance_claim_failed')
    return json(errorBody(safeMessage(error)), 500)
  }
})

async function reconcile(
  admin: ReturnType<typeof createClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  claim: ClaimAction,
) {
  if (!claim.tx_hash) {
    return errorBody('확인할 트랜잭션이 없습니다.', claim.reward_date)
  }

  const receipt = await publicClient
    .getTransactionReceipt({ hash: claim.tx_hash as `0x${string}` })
    .catch(() => null)

  if (!receipt) {
    return {
      status: 'confirming' as const,
      txHash: claim.tx_hash,
      rewardDate: claim.reward_date,
      message: 'Sepolia 트랜잭션을 확인하고 있습니다.',
    }
  }

  if (receipt.status === 'success') {
    await complete(admin, claim)
    return successBody(claim.reward_date, claim.tx_hash, '오늘 10 TNS 출석 보상을 받았습니다.')
  }

  await fail(admin, claim)
  return {
    status: 'error' as const,
    txHash: claim.tx_hash,
    rewardDate: claim.reward_date,
    message: '토큰 발행 트랜잭션이 실패했습니다.',
  }
}

async function findTodayMint(
  publicClient: ReturnType<typeof createPublicClient>,
  contractAddress: `0x${string}`,
  recipient: `0x${string}`,
  rewardDate: string,
) {
  const latest = await publicClient.getBlockNumber()
  const fromBlock = latest > 3000n ? latest - 3000n : 0n
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: tokenAbi[2],
    args: { from: zeroAddress, to: recipient },
    fromBlock,
    toBlock: latest,
  })

  for (const log of logs.reverse()) {
    if (log.args.value !== rewardWei || !log.transactionHash) {
      continue
    }

    const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
    const mintedOn = seoulDate(new Date(Number(block.timestamp) * 1000))

    if (mintedOn === rewardDate) {
      return log.transactionHash
    }
  }

  return null
}

async function attach(
  admin: ReturnType<typeof createClient>,
  claim: ClaimAction,
  hash: `0x${string}`,
) {
  const { error } = await admin.rpc('attach_attendance_tx', {
    p_id: claim.id,
    p_attempt: claim.attempt_id,
    p_tx_hash: hash,
  })

  if (error) {
    throw new Error('attendance_conflict')
  }
}

async function complete(admin: ReturnType<typeof createClient>, claim: ClaimAction) {
  const { error } = await admin.rpc('finish_attendance', {
    p_id: claim.id,
    p_attempt: claim.attempt_id,
    p_status: 'completed',
  })

  if (error) {
    throw new Error('attendance_conflict')
  }
}

async function fail(admin: ReturnType<typeof createClient>, claim: ClaimAction) {
  const { error } = await admin.rpc('finish_attendance', {
    p_id: claim.id,
    p_attempt: claim.attempt_id,
    p_status: 'failed',
  })

  if (error) {
    throw new Error('attendance_conflict')
  }
}

function seoulDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function readPrivateKey(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  return /^0x[0-9a-fA-F]{64}$/.test(withPrefix) ? (withPrefix as `0x${string}`) : null
}

function readClaim(value: unknown): ClaimAction | null {
  if (!isRecord(value)) {
    return null
  }

  const action = value.action
  const id = value.id
  const attemptId = value.attempt_id
  const status = value.status
  const rewardDate = value.reward_date
  const reason = value.reason
  const txHash = value.tx_hash

  if (
    action !== 'mint' &&
    action !== 'reconcile' &&
    action !== 'wait' &&
    action !== 'done'
  ) {
    return null
  }

  if (
    typeof id !== 'string' ||
    typeof attemptId !== 'string' ||
    typeof status !== 'string' ||
    typeof rewardDate !== 'string' ||
    typeof reason !== 'string' ||
    (txHash !== null && typeof txHash !== 'string')
  ) {
    return null
  }

  return {
    action,
    reason,
    id,
    attempt_id: attemptId,
    tx_hash: txHash,
    status,
    reward_date: rewardDate,
  }
}

function successBody(rewardDate: string, txHash: string | null, message: string) {
  return {
    status: 'success' as const,
    txHash,
    rewardDate,
    message,
  }
}

function errorBody(message: string, rewardDate: string | null = null) {
  return {
    status: 'error' as const,
    txHash: null,
    rewardDate,
    message,
  }
}

function json(
  body: {
    status: 'pending' | 'confirming' | 'success' | 'error'
    txHash: string | null
    rewardDate: string | null
    message: string
  },
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  if (
    message.length === 0 ||
    message.length > 180 ||
    /private|secret|mnemonic|0x[0-9a-fA-F]{64}/i.test(message)
  ) {
    return '보상을 지급하지 못했습니다.'
  }

  return message
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
