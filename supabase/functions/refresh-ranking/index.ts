import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { createPublicClient, erc20Abi, http, isAddress } from 'npm:viem@2.57.7'
import { sepolia } from 'npm:viem@2.57.7/chains'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ status: 'error', playerCount: null, message: 'POST만 지원합니다.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const contractAddress = Deno.env.get('TOKEN_CONTRACT_ADDRESS')?.trim()
  const rpcUrl = Deno.env.get('SEPOLIA_RPC_URL')?.trim()

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ status: 'error', playerCount: null, message: '서버 인증 설정이 완료되지 않았습니다.' }, 500)
  }

  if (!contractAddress || !isAddress(contractAddress)) {
    return json({ status: 'error', playerCount: null, message: '서버에 토큰 계약 주소가 없어 랭킹을 계산하지 않습니다.' }, 500)
  }

  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]

  if (!accessToken) {
    return json({ status: 'error', playerCount: null, message: '로그인이 필요합니다.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    return json({ status: 'error', playerCount: null, message: '로그인이 필요합니다.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, nickname, wallet_address')
    .not('wallet_address', 'is', null)

  if (profileError || !profiles) {
    return json({ status: 'error', playerCount: null, message: '등록된 사용자를 불러오지 못했습니다.' }, 500)
  }

  const players = profiles.filter(
    (profile) =>
      typeof profile.id === 'string' &&
      typeof profile.nickname === 'string' &&
      profile.nickname.length > 0 &&
      typeof profile.wallet_address === 'string' &&
      isAddress(profile.wallet_address),
  )
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl || undefined) })
  const balances = new Map<string, bigint>()

  try {
    for (let index = 0; index < players.length; index += 50) {
      const chunk = players.slice(index, index + 50)
      const results = await publicClient.multicall({
        allowFailure: false,
        contracts: chunk.map((player) => ({
          address: contractAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf' as const,
          args: [player.wallet_address as `0x${string}`],
        })),
      })

      chunk.forEach((player, resultIndex) => {
        const balance = results[resultIndex]

        if (typeof balance !== 'bigint') {
          throw new Error('balance_missing')
        }

        balances.set(player.id, balance)
      })
    }
  } catch {
    return json({ status: 'error', playerCount: null, message: '온체인 TNS 잔액을 조회하지 못했습니다.' }, 500)
  }

  const rankedInput = players.flatMap((player) => {
    const balance = balances.get(player.id)
    return balance === undefined ? [] : [{ id: player.id, nickname: player.nickname, balance }]
  })

  if (rankedInput.length !== players.length) {
    return json({ status: 'error', playerCount: null, message: '온체인 TNS 잔액을 조회하지 못했습니다.' }, 500)
  }

  const ranked = rankPlayers(rankedInput)
  const { error: saveError } = await admin.rpc('replace_ranking_snapshot', {
    p_entries: ranked.map((player) => ({
      user_id: player.id,
      nickname: player.nickname,
      balance_wei: player.balance.toString(),
      rank: player.rank,
    })),
  })

  if (saveError) {
    return json({ status: 'error', playerCount: null, message: '랭킹 스냅샷을 저장하지 못했습니다.' }, 500)
  }

  return json({
    status: 'success',
    playerCount: ranked.length,
    message: '등록된 사용자의 TNS 잔액으로 랭킹을 갱신했습니다.',
  })
})

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

type RankedPlayer = {
  id: string
  nickname: string
  balance: bigint
}

function rankPlayers(players: RankedPlayer[]) {
  const unique = new Map<string, RankedPlayer>()

  for (const player of players) {
    if (!unique.has(player.id)) {
      unique.set(player.id, player)
    }
  }

  return [...unique.values()]
    .sort((left, right) => {
      if (left.balance !== right.balance) {
        return left.balance > right.balance ? -1 : 1
      }

      const nickname = left.nickname.localeCompare(right.nickname, 'ko')

      if (nickname !== 0) {
        return nickname
      }

      if (left.id === right.id) {
        return 0
      }

      return left.id < right.id ? -1 : 1
    })
    .map((player, index) => ({ ...player, rank: index + 1 }))
}
