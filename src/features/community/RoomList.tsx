import { Button } from '../../components/ui/Button.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { formatScheduledAt } from './format.ts'
import { isRoomFull, type RoomSummary } from './roomSummary.ts'

type RoomListProps = {
  rooms: RoomSummary[]
  selectedId: string | null
  userId: string
  pendingRoomId: string | null
  onSelect: (roomId: string) => void
  onJoin: (roomId: string) => void
  onLeave: (roomId: string) => void
}

export function RoomList({
  rooms,
  selectedId,
  userId,
  pendingRoomId,
  onSelect,
  onJoin,
  onLeave,
}: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <EmptyState
        title="모임이 없습니다"
        description="모임을 만들면 다른 사람이 참여할 수 있습니다."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {rooms.map((room) => {
        const full = isRoomFull(room)
        const pending = pendingRoomId === room.id
        const selected = room.id === selectedId

        return (
          <li key={room.id} className="rounded-xl border border-line p-3">
            <button
              type="button"
              aria-pressed={selected}
              className={[
                'w-full rounded-lg px-1 py-1 text-left',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
                selected ? 'text-court-800' : 'text-ink',
              ].join(' ')}
              onClick={() => onSelect(room.id)}
            >
              <span className="block text-base font-semibold">{room.title}</span>
              <span className="mt-1 block text-sm text-ink/70">{room.location}</span>
              <span className="mt-1 block text-sm text-ink/70">
                {formatScheduledAt(room.scheduled_at)}
              </span>
              <span className="mt-2 block text-sm font-medium text-court-800">
                {room.memberCount} / {room.max_participants}명
                {room.host_id === userId ? ' · 주최' : ''}
              </span>
            </button>
            <div className="mt-3">
              {room.joined ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={pending}
                  aria-label={`${room.title} 나가기`}
                  onClick={() => onLeave(room.id)}
                >
                  {pending ? '나가는 중' : '나가기'}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={pending || full}
                  aria-label={full ? `${room.title} 정원 마감` : `${room.title} 참여`}
                  onClick={() => onJoin(room.id)}
                >
                  {pending ? '참여하는 중' : full ? '정원 마감' : '참여'}
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
