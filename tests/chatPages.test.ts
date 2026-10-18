import { describe, expect, it } from 'vitest'
import migrationSql from '../supabase/migrations/20261018022000_rooms_and_chat.sql?raw'
import {
  appendChatMessage,
  CHAT_PAGE_SIZE,
  isNearBottom,
  preservedScrollTop,
  toChatPage,
  visibleMessages,
  type ChatPage,
} from '../src/features/community/chatPages.ts'
import type { ChatMessage } from '../src/types/database.ts'

function message(id: string, createdAt: string): ChatMessage {
  return {
    id,
    room_id: 'room-1',
    sender_id: 'user-1',
    content: id,
    created_at: createdAt,
  }
}

describe('chat pages', () => {
  it('loads messages in pages of 20', () => {
    expect(CHAT_PAGE_SIZE).toBe(20)
    expect(migrationSql).toContain('page_limit integer := 20')
    expect(migrationSql).toContain('p_page_size is distinct from 20')
  })

  it('keeps a cursor only when the server says more messages exist', () => {
    const first = message('m2', '2026-10-18T01:05:00.000Z')
    const page = toChatPage({ messages: [first], has_more: true })

    expect(page.messages).toEqual([first])
    expect(page.nextCursor).toEqual({ createdAt: first.created_at, id: 'm2' })
    expect(toChatPage({ messages: [first], has_more: false }).nextCursor).toBeNull()
  })

  it('shows older pages first and drops a realtime duplicate', () => {
    const older = message('m1', '2026-10-18T01:00:00.000Z')
    const newer = message('m2', '2026-10-18T01:05:00.000Z')
    const live = message('m3', '2026-10-18T01:06:00.000Z')
    const pages: ChatPage[] = [
      { messages: [newer], nextCursor: { createdAt: newer.created_at, id: newer.id } },
      { messages: [older], nextCursor: null },
    ]

    expect(visibleMessages(pages).map((item) => item.id)).toEqual(['m1', 'm2'])

    const withLive = appendChatMessage(pages, live)
    const duplicated = appendChatMessage(withLive, newer)

    expect(visibleMessages(withLive).map((item) => item.id)).toEqual(['m1', 'm2', 'm3'])
    expect(visibleMessages(duplicated).map((item) => item.id)).toEqual(['m1', 'm2', 'm3'])
    expect(duplicated).toBe(withLive)
  })

  it('follows the bottom only while the reader is already there', () => {
    expect(isNearBottom(400, 300, 100)).toBe(true)
    expect(isNearBottom(800, 100, 100)).toBe(false)
    expect(preservedScrollTop(200, 360, 40)).toBe(200)
  })
})
