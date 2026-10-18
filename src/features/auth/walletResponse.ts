const forbiddenFields = [
  'privateKey',
  'private_key',
  'encryptedPrivateKey',
  'encrypted_private_key',
  'seed',
  'mnemonic',
] as const

const walletAddressPattern = /^0x[0-9a-fA-F]{40}$/

export function readWalletAddress(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error('지갑 응답이 올바르지 않습니다.')
  }

  for (const field of forbiddenFields) {
    if (field in payload) {
      throw new Error('지갑 응답에 허용되지 않은 값이 있습니다.')
    }
  }

  const address = payload.walletAddress

  if (typeof address !== 'string' || !walletAddressPattern.test(address)) {
    throw new Error('지갑 주소를 받지 못했습니다.')
  }

  return address
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
