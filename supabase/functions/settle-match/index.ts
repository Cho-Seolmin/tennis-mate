import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  isAddress,
} from 'npm:viem@2.57.7'
import { privateKeyToAccount } from 'npm:viem@2.57.7/accounts'
import { sepolia } from 'npm:viem@2.57.7/chains'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type MatchAction = {
  action: 'transfer' | 'reconcile' | 'wait' | 'done'
  match_id: string
  attempt_id: string
  amount: string
  winner_wallet: string
  loser_wallet: string
  tx_hash: string | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ status: 'error', txHash: null, needsEth: false, message: 'POST만 지원합니다.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const contractAddress = Deno.env.get('TOKEN_CONTRACT_ADDRESS')?.trim()
  const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY')?.trim()
  const rpcUrl = Deno.env.get('SEPOLIA_RPC_URL')?.trim()

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !encryptionKey) {
    return json(errorBody('서버 지갑 설정이 완료되지 않았습니다.'), 500)
  }

  if (!contractAddress || !isAddress(contractAddress)) {
    return json(errorBody('서버에 토큰 계약 주소가 없어 전송하지 않습니다.'), 500)
  }

  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]

  if (!accessToken) {
    return json(errorBody('로그인이 필요합니다.'), 401)
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return json(errorBody('전송 요청 형식이 올바르지 않습니다.'), 400)
  }

  const transfer = parseTransferRequest(body)

  if (!transfer || tnsToWei(transfer.amount) === null) {
    return json(errorBody('승자, 패자, 수량을 다시 확인해 주세요. 수량은 0보다 크고 100 TNS 이하여야 합니다.'), 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    return json(errorBody('로그인이 필요합니다.'), 401)
  }

  if (userData.user.id !== transfer.loserId) {
    return json(errorBody('토큰은 패자 본인만 보낼 수 있습니다.'), 403)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: begun, error: beginError } = await admin.rpc('begin_match_transfer', {
    p_match_id: transfer.matchId,
    p_winner_id: transfer.winnerId,
    p_loser_id: transfer.loserId,
    p_amount: transfer.amount,
    p_played_at: transfer.playedAt,
  })

  if (beginError || !isMatchAction(begun)) {
    return json(errorBody(matchBeginMessage(beginError?.message)), 400)
  }

  const wei = tnsToWei(normalizeAmount(begun.amount))
  const token = contractAddress as `0x${string}`
  const winner = begun.winner_wallet
  const loser = begun.loser_wallet

  if (!wei || !isAddress(winner) || !isAddress(loser) || winner.toLowerCase() === loser.toLowerCase()) {
    return json(errorBody('서버에 저장된 경기 정보로 수신 주소를 정하지 못했습니다.'), 400)
  }

  if (begun.action === 'done' && begun.tx_hash) {
    return json({ status: 'success', txHash: begun.tx_hash, needsEth: false, message: '이미 전송이 완료된 경기입니다.' })
  }

  if (begun.action === 'wait') {
    return json({ status: 'pending', txHash: null, needsEth: false, message: '같은 경기의 전송을 이미 처리하고 있습니다.' })
  }

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl || undefined) })

  if (begun.action === 'reconcile' && begun.tx_hash) {
    return confirm(admin, publicClient, begun)
  }

  const { data: secret, error: secretError } = await admin
    .from('wallet_secrets')
    .select('encrypted_private_key, wallet_address')
    .eq('user_id', transfer.loserId)
    .maybeSingle()

  if (secretError || secret?.wallet_address?.toLowerCase() !== loser.toLowerCase()) {
    await fail(admin, begun)
    return json(errorBody('패자 지갑을 서버에서 확인하지 못했습니다.'), 400)
  }

  let privateKey: `0x${string}`

  try {
    privateKey = await decryptPrivateKey(secret.encrypted_private_key, encryptionKey)
  } catch {
    await fail(admin, begun)
    return json(errorBody('패자 지갑을 열지 못했습니다.'), 500)
  }

  const account = privateKeyToAccount(privateKey)

  if (account.address.toLowerCase() !== loser.toLowerCase()) {
    await fail(admin, begun)
    return json(errorBody('패자 지갑 주소가 저장된 주소와 다릅니다.'), 500)
  }

  const [tokenBalance, ethBalance] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ])

  if (tokenBalance < wei) {
    await fail(admin, begun)
    return json(errorBody('TNS 잔액이 부족합니다.'), 400)
  }

  if (ethBalance === 0n) {
    await fail(admin, begun)
    return json({
      status: 'error',
      txHash: null,
      needsEth: true,
      message: 'Sepolia ETH가 부족합니다. Faucet에서 테스트 ETH를 받은 뒤 다시 시도해 주세요.',
    }, 400)
  }

  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl || undefined) })
  let hash: `0x${string}`

  try {
    hash = await walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [winner as `0x${string}`, wei],
      account,
      chain: sepolia,
    })
  } catch (error) {
    await fail(admin, begun)
    return json(errorBody(safeMessage(error instanceof Error ? error.message : '전송에 실패했습니다.')), 400)
  }

  const { error: attachError } = await admin.rpc('attach_match_tx', {
    p_match_id: begun.match_id,
    p_attempt_id: begun.attempt_id,
    p_tx_hash: hash,
  })

  if (attachError) {
    return json({
      status: 'confirming',
      txHash: hash,
      needsEth: false,
      message: '트랜잭션은 전송됐지만 상태 저장을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.',
    })
  }

  return confirm(admin, publicClient, { ...begun, tx_hash: hash })
})

async function confirm(
  admin: ReturnType<typeof createClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  begun: MatchAction,
) {
  const hash = begun.tx_hash

  if (!hash) {
    return json(errorBody('확인할 트랜잭션이 없습니다.'), 400)
  }

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      timeout: 45_000,
    })

    if (receipt.status !== 'success') {
      await fail(admin, begun)
      return json(errorBody('토큰 전송 트랜잭션이 실패했습니다.'), 400)
    }

    await admin.rpc('finish_match_transfer', {
      p_match_id: begun.match_id,
      p_attempt_id: begun.attempt_id,
      p_status: 'completed',
    })

    return json({
      status: 'success',
      txHash: hash,
      needsEth: false,
      message: '토큰을 승자에게 보냈습니다.',
    })
  } catch {
    return json({
      status: 'confirming',
      txHash: hash,
      needsEth: false,
      message: '트랜잭션이 아직 확정되지 않았습니다. 같은 경기로 다시 확인하면 중복 전송되지 않습니다.',
    })
  }
}

async function fail(admin: ReturnType<typeof createClient>, begun: MatchAction) {
  await admin.rpc('finish_match_transfer', {
    p_match_id: begun.match_id,
    p_attempt_id: begun.attempt_id,
    p_status: 'failed',
  })
}

function isMatchAction(value: unknown): value is MatchAction {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    (row.action === 'transfer' || row.action === 'reconcile' || row.action === 'wait' || row.action === 'done') &&
    typeof row.match_id === 'string' &&
    typeof row.attempt_id === 'string' &&
    typeof row.amount === 'string' &&
    typeof row.winner_wallet === 'string' &&
    typeof row.loser_wallet === 'string'
  )
}

function normalizeAmount(amount: string) {
  const [whole, fraction = ''] = amount.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

function matchBeginMessage(message: string | undefined) {
  if (message?.includes('missing_wallet')) {
    return '승자와 패자 모두 등록된 지갑이 있어야 합니다.'
  }

  if (message?.includes('match_conflict')) {
    return '같은 경기 번호에 다른 결과가 이미 저장되어 있습니다.'
  }

  if (message?.includes('invalid_match')) {
    return '경기 참가자 또는 수량이 올바르지 않습니다.'
  }

  return '경기를 시작하지 못했습니다.'
}

function errorBody(message: string) {
  return { status: 'error' as const, txHash: null, needsEth: false, message }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function safeMessage(message: string) {
  if (/private|secret|mnemonic|0x[0-9a-fA-F]{64}/i.test(message)) {
    return '토큰 전송에 실패했습니다.'
  }

  return message.slice(0, 180)
}

const amountPattern = /^(?:0|[1-9]\d{0,2})(?:\.(\d{1,6}))?$/
const maxWei = 100n * 10n ** 18n
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function tnsToWei(amount: string) {
  const value = amount.trim()
  const match = amountPattern.exec(value)

  if (!match) {
    return null
  }

  const [whole, fraction = ''] = value.split('.')
  const wei = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))

  if (wei <= 0n || wei > maxWei) {
    return null
  }

  return wei
}

function parseTransferRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const body = value as Record<string, unknown>
  const matchId = typeof body.matchId === 'string' && uuidPattern.test(body.matchId) ? body.matchId : null
  const winnerId = typeof body.winnerId === 'string' && uuidPattern.test(body.winnerId) ? body.winnerId : null
  const loserId = typeof body.loserId === 'string' && uuidPattern.test(body.loserId) ? body.loserId : null
  const amount = typeof body.amount === 'string' ? body.amount.trim() : null
  const playedAt = typeof body.playedAt === 'string' ? body.playedAt : null

  if (!matchId || !winnerId || !loserId || !amount || !playedAt || winnerId === loserId) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(playedAt) || Number.isNaN(Date.parse(playedAt)) || tnsToWei(amount) === null) {
    return null
  }

  return { matchId, winnerId, loserId, amount, playedAt }
}

async function decryptPrivateKey(payload: string, secret: string) {
  const [version, ivText, cipherText, extra] = payload.split('.')

  if (version !== 'v1' || !ivText || !cipherText || extra) {
    throw new Error('invalid_wallet')
  }

  const bytes = decodeBase64(secret.trim())

  if (bytes.byteLength !== 32) {
    throw new Error('invalid_encryption_key')
  }

  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(ivText) },
    key,
    decodeBase64(cipherText),
  )
  const privateKey = new TextDecoder().decode(plain)

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('invalid_wallet')
  }

  return privateKey as `0x${string}`
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
