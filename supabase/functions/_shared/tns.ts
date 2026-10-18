const amountPattern = /^(?:0|[1-9]\d{0,2})(?:\.(\d{1,6}))?$/
const maxWei = 100n * 10n ** 18n

export function tnsToWei(amount: string) {
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

export function formatTnsFromWei(wei: bigint) {
  const whole = wei / 10n ** 18n
  const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '')
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString()
}
