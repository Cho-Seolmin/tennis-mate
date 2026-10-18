function readEnv(value: string | undefined) {
  return value?.trim() ?? ''
}

const isVitest = import.meta.env.MODE === 'test'

export const env = {
  supabaseUrl: isVitest ? '' : readEnv(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: isVitest ? '' : readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY),
  tokenContractAddress: isVitest ? '' : readEnv(import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS),
  sepoliaRpcUrl: readEnv(import.meta.env.VITE_SEPOLIA_RPC_URL),
  googleMapsApiKey: readEnv(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
}

export const isSupabaseConfigured =
  env.supabaseUrl !== '' && env.supabaseAnonKey !== ''

export const isTokenConfigured = env.tokenContractAddress !== ''

export const isMapsConfigured = env.googleMapsApiKey !== ''

export type DemoNotice = {
  service: string
  detail: string
}

export function getDemoNotices(): DemoNotice[] {
  const notices: DemoNotice[] = []

  if (!isSupabaseConfigured) {
    notices.push({
      service: 'Supabase',
      detail: 'URL과 anon key가 없으면 로그인할 수 없습니다.',
    })
  }

  if (!isTokenConfigured) {
    notices.push({
      service: 'Sepolia',
      detail: '토큰 계약 주소가 없어 TNS 잔액과 전송을 표시하지 않습니다.',
    })
  }

  if (!isMapsConfigured) {
    notices.push({
      service: 'Google Maps',
      detail: '지도 API 키가 없어 주변 코트를 표시하지 않습니다.',
    })
  }

  return notices
}
