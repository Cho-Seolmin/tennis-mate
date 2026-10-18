import { describe, expect, it } from 'vitest'
import { chatContentSchema } from '../src/features/community/messageSchema.ts'
import { defaultRoomValues, roomFormSchema } from '../src/features/community/roomSchema.ts'
import { isRoomFull, summarizeRooms } from '../src/features/community/roomSummary.ts'
import { communityError } from '../src/features/community/dbError.ts'
import migrationSql from '../supabase/migrations/20261018022000_rooms_and_chat.sql?raw'
import hostControlsSql from '../supabase/migrations/20261018120000_room_host_controls.sql?raw'
import type { Room } from '../src/types/database.ts'

const room: Room = {
  id: 'room-1',
  host_id: 'host',
  title: '토요일 복식',
  location: '한강 코트',
  scheduled_at: '2026-10-18T01:00:00.000Z',
  max_participants: 4,
  status: 'open',
  created_at: '2026-10-17T00:00:00.000Z',
}

describe('room form', () => {
  it('accepts a trimmed meetup and rejects an empty title, a bad time, and a short guest list', () => {
    expect(
      roomFormSchema.parse({
        title: ' 저녁 단식 ',
        location: ' 잠실 ',
        scheduled_at: '2026-10-18T19:00',
        max_participants: 4,
      }),
    ).toEqual({
      title: '저녁 단식',
      location: '잠실',
      scheduled_at: '2026-10-18T19:00',
      max_participants: 4,
    })

    expect(roomFormSchema.safeParse({ ...room, title: ' ', scheduled_at: '2026-10-18T19:00', max_participants: 4, location: '잠실' }).success).toBe(false)
    expect(
      roomFormSchema.safeParse({
        title: '저녁 단식',
        location: '잠실',
        scheduled_at: '2026-13-40T19:00',
        max_participants: 4,
      }).success,
    ).toBe(false)
    expect(
      roomFormSchema.safeParse({
        title: '저녁 단식',
        location: '잠실',
        scheduled_at: '2026-10-18T19:00',
        max_participants: 1,
      }).success,
    ).toBe(false)
    expect(
      roomFormSchema.safeParse({
        title: '저녁 단식',
        location: '잠실',
        scheduled_at: '2026-10-18T19:00',
        max_participants: 11,
      }).success,
    ).toBe(false)
  })

  it('starts the default time one hour ahead', () => {
    expect(defaultRoomValues(new Date(2026, 9, 18, 9, 20)).scheduled_at).toBe('2026-10-18T10:00')
  })
})

describe('chat content', () => {
  it('trims a message and rejects an empty or oversized message', () => {
    expect(chatContentSchema.parse('  안녕하세요  ')).toBe('안녕하세요')
    expect(chatContentSchema.safeParse('   ').success).toBe(false)
    expect(chatContentSchema.safeParse('가'.repeat(501)).success).toBe(false)
  })
})

describe('room summary', () => {
  it('counts members, marks the current user, and treats a full room as closed to new people', () => {
    const [summary] = summarizeRooms(
      [room],
      [
        { room_id: 'room-1', user_id: 'host' },
        { room_id: 'room-1', user_id: 'user-2' },
      ],
      'user-2',
    )

    expect(summary).toMatchObject({ memberCount: 2, joined: true })
    expect(isRoomFull({ ...summary, memberCount: 4, joined: false })).toBe(true)
    expect(isRoomFull(summary)).toBe(false)
  })
})

describe('community errors', () => {
  it('maps a full room to a Korean message', () => {
    expect(
      communityError(
        { message: 'room_full', details: '', hint: '', code: 'P0001' },
        '실패',
      ),
    ).toBe('정원이 가득 찼습니다.')
  })
})

describe('rooms and chat migration', () => {
  it('locks a room before joining and only lets members read chat', () => {
    expect(migrationSql).toContain('primary key (room_id, user_id)')
    expect(migrationSql).toContain('constraint chat_messages_content_length check (char_length(content) between 1 and 500)')
    expect(migrationSql).toContain('constraint rooms_capacity check (max_participants between 2 and 30)')
    expect(migrationSql).toContain('for update')
    expect(migrationSql).toContain("raise exception 'room_full'")
    expect(migrationSql).toContain("raise exception 'already_joined'")
    expect(migrationSql).toContain('chat_messages_select_member')
    expect(migrationSql).toContain('chat_messages_insert_member')
    expect(migrationSql).toContain('new.sender_id := auth.uid()')
    expect(migrationSql).toContain('limit page_limit + 1')
    expect(migrationSql).toContain('supabase_realtime')
    expect(migrationSql).not.toContain('wallet_address')
    expect(hostControlsSql).toContain('max_participants between 2 and 10')
    expect(hostControlsSql).toContain("raise exception 'not_host'")
    expect(hostControlsSql).toContain("raise exception 'cannot_kick_host'")
    expect(hostControlsSql).toContain("raise exception 'host_must_delete'")
    expect(hostControlsSql).toContain('host_id = auth.uid()')
  })
})
