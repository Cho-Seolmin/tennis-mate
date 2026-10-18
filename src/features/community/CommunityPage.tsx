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
import { createRoom, fetchRoomSummaries, joinRoom, leaveRoom, roomsQueryKey } from './roomApi.ts'
import { defaultRoomValues, type RoomFormValues } from './roomSchema.ts'

export function CommunityPage() {
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoomFormValues | null>(null)
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null)
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
        description="테니스 모임을 만들고 참여한 뒤, 같은 모임의 채팅으로 대화합니다."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">모임 목록</h2>
            <Button
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
              onJoin={(roomId) => {
                joinMutation.mutate(roomId)
              }}
              onLeave={(roomId) => {
                leaveMutation.mutate(roomId)
              }}
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
              onJoin={(roomId) => {
                joinMutation.mutate(roomId)
              }}
            />
          </div>
        </Card>
      </div>
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
