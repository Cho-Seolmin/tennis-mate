import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../components/layout/PageHeader.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { Modal } from '../../components/ui/Modal.tsx'
import { useToast } from '../../hooks/useToast.ts'
import { isSupabaseConfigured } from '../../lib/env.ts'
import { getCurrentUser } from '../../lib/supabase.ts'
import { authUserQueryKey } from '../auth/session.ts'
import { ChatPanel } from './ChatPanel.tsx'
import { chatMessagesQueryKey } from './messageApi.ts'
import { RoomForm } from './RoomForm.tsx'
import { RoomList } from './RoomList.tsx'
import { createRoom, deleteRoom, fetchRoomSummaries, joinRoom, kickRoomMember, leaveRoom, roomsQueryKey } from './roomApi.ts'
import { defaultRoomValues, type RoomFormValues } from './roomSchema.ts'

export function CommunityPage() {
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoomFormValues | null>(null)
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const userQuery = useQuery({
    queryKey: authUserQueryKey,
    queryFn: getCurrentUser,
    enabled: isSupabaseConfigured,
  })
  const userId = userQuery.data?.id
  const roomsQuery = useQuery({
    queryKey: roomsQueryKey,
    queryFn: () => {
      if (!userId) {
        throw new Error('로그인이 필요합니다.')
      }

      return fetchRoomSummaries(userId)
    },
    enabled: Boolean(userId),
  })
  const rooms = roomsQuery.data ?? []
  const selected = rooms.find((room) => room.id === selectedId) ?? null
  const createMutation = useMutation({
    mutationFn: (values: RoomFormValues) => createRoom(values),
    onSuccess: async (room) => {
      await queryClient.invalidateQueries({ queryKey: roomsQueryKey })
      setSelectedId(room.id)
      setDraft(null)
      push({ tone: 'success', message: '모임을 만들었습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '모임을 만들지 못했습니다.',
      })
    },
  })
  const joinMutation = useMutation({
    mutationFn: (roomId: string) => joinRoom(roomId),
    onMutate: (roomId) => {
      setPendingRoomId(roomId)
    },
    onSuccess: async (_result, roomId) => {
      await queryClient.invalidateQueries({ queryKey: roomsQueryKey })
      setSelectedId(roomId)
      push({ tone: 'success', message: '모임에 참여했습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '모임에 참여하지 못했습니다.',
      })
    },
    onSettled: () => {
      setPendingRoomId(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (roomId: string) => deleteRoom(roomId),
    onMutate: (roomId) => {
      setPendingRoomId(roomId)
    },
    onSuccess: async (_result, roomId) => {
      await queryClient.invalidateQueries({ queryKey: roomsQueryKey })
      queryClient.removeQueries({ queryKey: chatMessagesQueryKey(roomId) })
      setSelectedId((current) => (current === roomId ? null : current))
      setDeleteTarget(null)
      push({ tone: 'success', message: '채팅방을 삭제했습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '채팅방을 삭제하지 못했습니다.',
      })
    },
    onSettled: () => {
      setPendingRoomId(null)
    },
  })
  const kickMutation = useMutation({
    mutationFn: (member: { roomId: string; userId: string }) => kickRoomMember(member.roomId, member.userId),
    onSuccess: async (_result, member) => {
      await queryClient.invalidateQueries({ queryKey: roomsQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['room-members', member.roomId] })
      push({ tone: 'success', message: '참여자를 내보냈습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '참여자를 내보내지 못했습니다.',
      })
    },
  })
  const leaveMutation = useMutation({
    mutationFn: (roomId: string) => leaveRoom(roomId),
    onMutate: (roomId) => {
      setPendingRoomId(roomId)
    },
    onSuccess: async (_result, roomId) => {
      await queryClient.invalidateQueries({ queryKey: roomsQueryKey })
      queryClient.removeQueries({ queryKey: chatMessagesQueryKey(roomId) })
      push({ tone: 'success', message: '모임에서 나갔습니다.' })
    },
    onError: (error) => {
      push({
        tone: 'error',
        message: error instanceof Error ? error.message : '모임에서 나가지 못했습니다.',
      })
    },
    onSettled: () => {
      setPendingRoomId(null)
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <ErrorMessage
        title="모임을 불러올 수 없습니다"
        message="Supabase URL과 anon key가 설정되지 않았습니다."
      />
    )
  }

  if (userQuery.isPending || (userId && roomsQuery.isPending)) {
    return <Loading label="모임을 불러오는 중" />
  }

  if (!userId) {
    return (
      <ErrorMessage
        title="로그인이 필요합니다"
        message="다시 로그인한 뒤 모임을 확인해 주세요."
      />
    )
  }

  if (roomsQuery.isError) {
    return (
      <ErrorMessage
        title="모임 목록을 불러오지 못했습니다"
        message={roomsQuery.error instanceof Error ? roomsQuery.error.message : '다시 시도해 주세요.'}
        onRetry={() => {
          void roomsQuery.refetch()
        }}
      />
    )
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="모임"
        description="로그인한 사용자는 누구나 채팅방을 만들고 참여할 수 있습니다. 삭제는 방장만 할 수 있습니다."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-base font-semibold text-ink">모임 목록</h2>
            <Button
              className="w-full md:w-auto"
              onClick={() => {
                setDraft(defaultRoomValues())
              }}
            >
              모임 만들기
            </Button>
          </div>
          <div className="mt-4">
            <RoomList
              rooms={rooms}
              selectedId={selected?.id ?? null}
              userId={userId}
              pendingRoomId={pendingRoomId}
              onSelect={setSelectedId}
              onCreate={() => {
                setDraft(defaultRoomValues())
              }}
              onJoin={(roomId) => {
                joinMutation.mutate(roomId)
              }}
              onLeave={(roomId) => {
                leaveMutation.mutate(roomId)
              }}
              onDelete={setDeleteTarget}
            />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <h2 className="text-base font-semibold text-ink">대화</h2>
          <div className="mt-4">
            <ChatPanel
              room={selected}
              userId={userId}
              joining={joinMutation.isPending && pendingRoomId === selected?.id}
              kickingUserId={kickMutation.isPending ? kickMutation.variables?.userId ?? null : null}
              onJoin={(roomId) => {
                joinMutation.mutate(roomId)
              }}
              onKick={(memberId) => {
                if (!selected) {
                  return
                }

                kickMutation.mutate({ roomId: selected.id, userId: memberId })
              }}
            />
          </div>
        </Card>
      </div>
      <Modal
        open={deleteTarget !== null}
        title="채팅방 삭제"
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null)
          }
        }}
      >
        <p>방장만 자신이 만든 채팅방을 삭제할 수 있습니다. 메시지와 참여 기록도 함께 삭제됩니다.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            disabled={deleteMutation.isPending}
            onClick={() => {
              setDeleteTarget(null)
            }}
          >
            취소
          </Button>
          <Button
            disabled={deleteMutation.isPending || !deleteTarget}
            onClick={() => {
              if (deleteTarget) {
                deleteMutation.mutate(deleteTarget)
              }
            }}
          >
            {deleteMutation.isPending ? '삭제하는 중' : '삭제'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={draft !== null}
        title="모임 만들기"
        onClose={() => {
          if (!createMutation.isPending) {
            setDraft(null)
          }
        }}
      >
        {draft ? (
          <RoomForm
            defaultValues={draft}
            submitting={createMutation.isPending}
            onSubmit={(values) => {
              createMutation.mutate(values)
            }}
          />
        ) : null}
      </Modal>
    </section>
  )
}
