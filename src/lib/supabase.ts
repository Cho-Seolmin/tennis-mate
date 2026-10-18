import { AuthError, FunctionsHttpError, createClient } from '@supabase/supabase-js'
import type { Database, Profile } from '../types/database.ts'
import { env, isSupabaseConfigured } from './env.ts'
import { readWalletAddress } from '../features/auth/walletResponse.ts'

export const supabase = isSupabaseConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function getCurrentUser() {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getUser()

  if (error) {
    if (error instanceof AuthError && (error.status === undefined || error.status < 500)) {
      return null
    }

    throw error
  }

  return data.user
}

export async function sendEmailCode(email: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })

  if (error) {
    throw error
  }
}

export async function verifyEmailCode(email: string, code: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  })

  if (error) {
    throw error
  }
}

export async function signOut() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function fetchProfile(userId: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, wallet_address, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function updateNickname(userId: string, nickname: string) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', userId)
    .select('id, nickname, avatar_url, wallet_address, created_at')
    .single()

  if (error) {
    if (error.code === '23514') {
      throw new Error('닉네임은 1자 이상 20자 이하여야 합니다.')
    }

    throw error
  }

  return data
}

export async function ensureWallet() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const { data, error } = await supabase.functions.invoke('create-wallet', {
    body: {},
  })

  if (error) {
    throw new Error(await messageFromFunctionError(error))
  }

  return readWalletAddress(data)
}

export async function loadAccount(userId: string): Promise<Profile> {
  const existing = await fetchProfile(userId)

  if (existing?.wallet_address) {
    return existing
  }

  const walletAddress = await ensureWallet()
  const refreshed = await fetchProfile(userId)

  if (!refreshed) {
    throw new Error('프로필을 만들지 못했습니다. 마이그레이션과 회원가입 트리거를 확인해 주세요.')
  }

  return {
    ...refreshed,
    wallet_address: refreshed.wallet_address ?? walletAddress,
  }
}

async function messageFromFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json()

      if (isRecord(body) && typeof body.error === 'string') {
        return safeServerMessage(body.error)
      }
    } catch {
      return '지갑을 만들지 못했습니다.'
    }
  }

  if (error instanceof Error && error.message) {
    return safeServerMessage(error.message)
  }

  return '지갑을 만들지 못했습니다.'
}

function safeServerMessage(message: string) {
  if (message.length > 180 || /private|secret|mnemonic|0x[0-9a-fA-F]{64}/i.test(message)) {
    return '지갑을 만들지 못했습니다.'
  }

  return message
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
