import { env, isTokenConfigured } from '../../lib/env.ts'

export type TokenBalance =
  | { status: 'disconnected' }
  | { status: 'error'; message: string }
  | { status: 'ready'; amount: string; symbol: string }

export type WalletBalances = {
  eth: string
  token: TokenBalance
}

export function formatDisplayAmount(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return value
  }

  const [whole = '0', fraction = ''] = value.split('.')
  const trimmed = fraction.replace(/0+$/, '')

  if ((whole === '0' || whole === '') && trimmed === '') {
    return '0'
  }

  if (whole === '0' && trimmed.length > 6) {
    return '< 0.000001'
  }

  const shown = trimmed.slice(0, 6)
  return shown ? `${whole}.${shown}` : whole
}

export async function readWalletBalances(address: string): Promise<WalletBalances> {
  const { erc20Abi, formatEther, formatUnits, isAddress } = await import('viem')
  const { publicClient } = await import('../../lib/viem.ts')

  if (!isAddress(address)) {
    throw new Error('지갑 주소 형식이 올바르지 않습니다.')
  }

  let eth: string

  try {
    const balance = await publicClient.getBalance({ address })
    eth = formatEther(balance)
  } catch {
    throw new Error('Sepolia ETH 잔액을 읽지 못했습니다.')
  }

  if (!isTokenConfigured) {
    return { eth, token: { status: 'disconnected' } }
  }

  const contract = env.tokenContractAddress

  if (!isAddress(contract)) {
    return {
      eth,
      token: { status: 'error', message: '토큰 계약 주소 형식이 올바르지 않습니다.' },
    }
  }

  try {
    const [raw, decimals, symbol] = await Promise.all([
      publicClient.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
      publicClient.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
    ])

    return {
      eth,
      token: {
        status: 'ready',
        amount: formatUnits(raw, decimals),
        symbol: symbol || 'TNS',
      },
    }
  } catch {
    return {
      eth,
      token: { status: 'error', message: 'TNS 잔액을 읽지 못했습니다.' },
    }
  }
}
