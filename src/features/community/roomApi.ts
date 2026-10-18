import type { Room } from '../../types/database.ts'
import { supabase } from '../../lib/supabase.ts'
import { communityError } from './dbError.ts'
import { roomWriteSchema, type RoomWriteDto } from './roomSchema.ts'
import { summarizeRooms } from './roomSummary.ts'

const roomColumns =
  'id, host_id, title, location, scheduled_at, max_participants, status, created_at' as const

export const roomsQueryKey = ['rooms'] as const

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  return supabase
}

export function parseRoomWrite(input: unknown): RoomWriteDto {
  const parsed = roomWriteSchema.safeParse(input)

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '모임 값을 확인해 주세요.')
  }

  return parsed.data
}

export async function fetchRoomSummaries(userId: string) {
  const client = requireClient()
  const [roomsResult, membersResult] = await Promise.all([
    client.from('rooms').select(roomColumns).eq('status', 'open').order('scheduled_at', { ascending: true }),
    client.from('room_members').select('room_id, user_id'),
  ])

  if (roomsResult.error) {
    throw new Error(communityError(roomsResult.error, '모임 목록을 불러오지 못했습니다.'))
  }

  if (membersResult.error) {
    throw new Error(communityError(membersResult.error, '참여 인원을 불러오지 못했습니다.'))
  }

  return summarizeRooms(roomsResult.data ?? [], membersResult.data ?? [], userId)
}

export async function createRoom(input: unknown) {
  const client = requireClient()
  const dto = parseRoomWrite(input)
  const { data, error } = await client.rpc('create_room', {
    p_title: dto.title,
    p_location: dto.location,
    p_scheduled_at: dto.scheduled_at,
    p_max_participants: dto.max_participants,
  })

  if (error) {
    throw new Error(communityError(error, '모임을 만들지 못했습니다.'))
  }

  return readRoom(data)
}

export async function joinRoom(roomId: string) {
  const client = requireClient()
  const { error } = await client.rpc('join_room', { p_room_id: roomId })

  if (error) {
    throw new Error(communityError(error, '모임에 참여하지 못했습니다.'))
  }
}

export async function leaveRoom(roomId: string) {
  const client = requireClient()
  const { error } = await client.rpc('leave_room', { p_room_id: roomId })

  if (error) {
    throw new Error(communityError(error, '모임에서 나가지 못했습니다.'))
  }
}

function readRoom(data: Room | null) {
  if (!data || typeof data !== 'object') {
    throw new Error('모임을 만들지 못했습니다.')
  }

  return data
}
