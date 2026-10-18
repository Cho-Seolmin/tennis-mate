import type { ChatMessage } from '../../types/database.ts'

export const CHAT_PAGE_SIZE = 20
export const CHAT_BOTTOM_THRESHOLD = 64

export type ChatCursor = {
  createdAt: string
  id: string
}

export type ChatPage = {
  messages: ChatMessage[]
  nextCursor: ChatCursor | null
}

export function compareMessages(left: ChatMessage, right: ChatMessage) {
  if (left.created_at < right.created_at) {
    return -1
  }

  if (left.created_at > right.created_at) {
    return 1
  }

  if (left.id < right.id) {
    return -1
  }

  if (left.id > right.id) {
    return 1
  }

  return 0
}

export function dedupeMessages(messages: ChatMessage[]) {
  const seen = new Set<string>()

  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false
    }

    seen.add(message.id)
    return true
  })
}

export function toChatPage(input: { messages: ChatMessage[]; has_more: boolean }): ChatPage {
  const messages = dedupeMessages([...input.messages]).sort(compareMessages)
  const oldest = messages[0]

  return {
    messages,
    nextCursor: input.has_more && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  }
}

export function visibleMessages(pages: ChatPage[]) {
  return dedupeMessages([...pages].reverse().flatMap((page) => page.messages))
}

export function appendChatMessage(pages: ChatPage[], message: ChatMessage) {
  return appendOne(pages, message)
}

export function appendChatMessages(pages: ChatPage[], messages: ChatMessage[]) {
  return messages.reduce((current, item) => appendOne(current, item), pages)
}

function appendOne(pages: ChatPage[], message: ChatMessage) {
  if (pages.some((page) => page.messages.some((item) => item.id === message.id))) {
    return pages
  }

  if (pages.length === 0) {
    return [{ messages: [message], nextCursor: null }]
  }

  const [newest, ...older] = pages

  if (!newest) {
    return [{ messages: [message], nextCursor: null }]
  }

  return [{ ...newest, messages: [...newest.messages, message].sort(compareMessages) }, ...older]
}

export function isNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = CHAT_BOTTOM_THRESHOLD,
) {
  return scrollHeight - scrollTop - clientHeight <= threshold
}

export function preservedScrollTop(previousHeight: number, nextHeight: number, scrollTop: number) {
  return Math.max(0, scrollTop + (nextHeight - previousHeight))
}
