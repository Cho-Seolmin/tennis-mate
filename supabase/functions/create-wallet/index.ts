import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { generatePrivateKey, privateKeyToAccount } from 'npm:viem@2.57.7/accounts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type WalletResponse = {
  walletAddress: string
}

type ErrorResponse = {
  error: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ error: 'POST만 지원합니다.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY')?.trim()

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: '서버 인증 설정이 완료되지 않았습니다.' }, 500)
  }

  if (!encryptionKey) {
    return json({ error: '서버에 WALLET_ENCRYPTION_KEY가 설정되지 않았습니다.' }, 500)
  }

  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1]

  if (!accessToken) {
    return json({ error: '로그인이 필요합니다.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)

  if (userError || !userData.user) {
    return json({ error: '로그인이 필요합니다.' }, 401)
  }

  const userId = userData.user.id
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('wallet_address')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('profile_read_failed', profileError.code)
    return json({ error: '프로필을 확인하지 못했습니다.' }, 500)
  }

  if (typeof profile?.wallet_address === 'string') {
    return json({ walletAddress: profile.wallet_address })
  }

  try {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const encryptedPrivateKey = await encryptPrivateKey(privateKey, encryptionKey)
    const decrypted = await decryptPrivateKey(encryptedPrivateKey, encryptionKey)

    if (decrypted !== privateKey) {
      return json({ error: '지갑 키를 암호화하지 못했습니다.' }, 500)
    }

    const { data, error } = await admin.rpc('store_custodial_wallet', {
      target_user: userId,
      address: account.address,
      encrypted_key: encryptedPrivateKey,
    })

    if (error || typeof data !== 'string' || !isWalletAddress(data)) {
      console.error('wallet_store_failed', error?.code ?? 'invalid_result')
      return json({ error: '지갑을 저장하지 못했습니다. 다시 시도해 주세요.' }, 500)
    }

    return json({ walletAddress: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'invalid_encryption_key') {
      return json({ error: 'WALLET_ENCRYPTION_KEY 형식이 올바르지 않습니다.' }, 500)
    }

    console.error('wallet_create_failed')
    return json({ error: '지갑을 만들지 못했습니다. 다시 시도해 주세요.' }, 500)
  }
})

function json(body: WalletResponse | ErrorResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function isWalletAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

async function encryptPrivateKey(privateKey: string, secret: string) {
  const key = await importAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(privateKey),
  )

  return `v1.${encodeBase64(iv)}.${encodeBase64(new Uint8Array(cipher))}`
}

async function decryptPrivateKey(payload: string, secret: string) {
  const [version, ivText, cipherText] = payload.split('.')

  if (version !== 'v1' || !ivText || !cipherText) {
    throw new Error('invalid_payload')
  }

  const key = await importAesKey(secret)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(ivText) },
    key,
    decodeBase64(cipherText),
  )

  return new TextDecoder().decode(plain)
}

async function importAesKey(secret: string) {
  let bytes: Uint8Array

  try {
    bytes = decodeBase64(secret)
  } catch {
    throw new Error('invalid_encryption_key')
  }

  if (bytes.byteLength !== 32) {
    throw new Error('invalid_encryption_key')
  }

  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function encodeBase64(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
