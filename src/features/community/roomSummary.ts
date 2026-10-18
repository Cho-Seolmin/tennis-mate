import type { Room } from '../../types/database.ts'

export type RoomSummary = Room & {
  memberCount: number
  joined: boolean
}

export function summarizeRooms(
  rooms: Room[],
  members: { room_id: string; user_id: string }[],
  userId: string,
): RoomSummary[] {
  const counts = new Map<string, number>()
  const joined = new Set<string>()

  for (const member of members) {
    counts.set(member.room_id, (counts.get(member.room_id) ?? 0) + 1)

    if (member.user_id === userId) {
      joined.add(member.room_id)
    }
  }

  return rooms.map((room) => ({
    ...room,
    memberCount: counts.get(room.id) ?? 0,
    joined: joined.has(room.id),
  }))
}

export function isRoomFull(room: RoomSummary) {
  return room.memberCount >= room.max_participants
}
