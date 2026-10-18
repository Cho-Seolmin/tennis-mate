const scheduledFormat = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const messageTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatScheduledAt(iso: string) {
  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return scheduledFormat.format(date)
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return messageTimeFormat.format(date)
}
