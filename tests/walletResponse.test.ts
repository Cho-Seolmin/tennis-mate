import { describe, expect, it } from 'vitest'
import { readWalletAddress } from '../src/features/auth/walletResponse.ts'

const address = `0x${'ab'.repeat(20)}`

describe('wallet response', () => {
  it('reads a public address', () => {
    expect(readWalletAddress({ walletAddress: address })).toBe(address)
  })

  it('rejects payloads that include a private key', () => {
    expect(() =>
      readWalletAddress({
        walletAddress: address,
        privateKey: `0x${'cd'.repeat(32)}`,
      }),
    ).toThrow('허용되지 않은 값')

    expect(() =>
      readWalletAddress({
        walletAddress: address,
        encrypted_private_key: 'v1.secret',
      }),
    ).toThrow('허용되지 않은 값')
  })

  it('rejects a missing address', () => {
    expect(() => readWalletAddress({ walletAddress: '0x1234' })).toThrow('지갑 주소')
    expect(() => readWalletAddress(null)).toThrow('올바르지 않습니다')
  })
})
