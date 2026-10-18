export async function decryptPrivateKey(payload: string, secret: string) {
  const [version, ivText, cipherText, extra] = payload.split('.')

  if (version !== 'v1' || !ivText || !cipherText || extra) {
    throw new Error('invalid_wallet')
  }

  const key = await importAesKey(secret)
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

async function importAesKey(secret: string) {
  const bytes = decodeBase64(secret.trim())

  if (bytes.byteLength !== 32) {
    throw new Error('invalid_encryption_key')
  }

  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt'])
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
