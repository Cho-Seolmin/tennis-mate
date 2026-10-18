import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { Textarea } from '../../components/ui/Textarea.tsx'
import type { ChatMessage } from '../../types/database.ts'
import {
  appendChatMessage,
  appendChatMessages,
  isNearBottom,
  preservedScrollTop,
  visibleMessages,
  type ChatCursor,
  type ChatPage,
} from './chatPages.ts'
import { formatMessageTime } from './format.ts'
import { isRoomFull, type RoomSummary } from './roomSummary.ts'
import {
  chatMessagesQueryKey,
  fetchChatPage,
  fetchNicknames,
  nicknameQueryKey,
  parseChatContent,
  sendChatMessage,
  subscribeToRoomMessages,
} from './messageApi.ts'

type ChatPanelProps = {
  room: RoomSummary | null
  userId: string
  joining: boolean
  onJoin: (roomId: string) => void
}

type ScrollAnchor = {
  oldestId: string
  height: number
  top: number
}

export function ChatPanel({ room, userId, joining, onJoin }: ChatPanelProps) {
  if (!room) {
    return (
      <EmptyState
        title="모임을 선택해 주세요"
        description="목록에서 모임을 고르면 대화가 열립니다."
      />
    )
  }

  if (!room.joined) {
    const full = isRoomFull(room)

    return (
      <div className="space-y-4">
        <EmptyState
          title="참여 후 대화할 수 있습니다"
          description="모임에 참여하면 메시지를 읽고 보낼 수 있습니다."
        />
        <Button
          className="w-full"
          disabled={joining || full}
          onClick={() => onJoin(room.id)}
        >
          {joining ? '참여하는 중' : full ? '정원 마감' : '참여'}
        </Button>
      </div>
    )
  }

  return <MemberChat key={room.id} room={room} userId={userId} />
}

function MemberChat({ room, userId }: { room: RoomSummary; userId: string }) {
  const queryClient = useQueryClient()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const pendingAnchorRef = useRef<ScrollAnchor | null>(null)
  const heldScrollRef = useRef<{ signature: string; scrollTop: number } | null>(null)
  const bufferedRef = useRef<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesQuery = useInfiniteQuery({
    queryKey: chatMessagesQueryKey(room.id),
    initialPageParam: null as ChatCursor | null,
    queryFn: ({ pageParam }) => fetchChatPage(room.id, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
  const messages = useMemo(
    () => visibleMessages(messagesQuery.data?.pages ?? []),
    [messagesQuery.data],
  )
  const senderIds = useMemo(
    () => [...new Set(messages.map((message) => message.sender_id))],
    [messages],
  )
  const namesQuery = useQuery({
    queryKey: nicknameQueryKey(senderIds),
    queryFn: () => fetchNicknames(senderIds),
    enabled: senderIds.length > 0,
    retry: false,
  })

  useEffect(() => {
    bufferedRef.current = []

    return subscribeToRoomMessages(room.id, (message) => {
      let applied = false

      queryClient.setQueryData<InfiniteData<ChatPage, ChatCursor | null>>(
        chatMessagesQueryKey(room.id),
        (current) => {
          if (!current) {
            return current
          }

          applied = true
          return {
            ...current,
            pages: appendChatMessage(current.pages, message),
          }
        },
      )

      if (!applied) {
        bufferedRef.current = appendBuffered(bufferedRef.current, message)
      }
    })
  }, [queryClient, room.id])

  useEffect(() => {
    if (!messagesQuery.data || bufferedRef.current.length === 0) {
      return
    }

    const pending = bufferedRef.current
    bufferedRef.current = []
    queryClient.setQueryData<InfiniteData<ChatPage, ChatCursor | null>>(
      chatMessagesQueryKey(room.id),
      (current) => {
        if (!current) {
          bufferedRef.current = pending
          return current
        }

        return {
          ...current,
          pages: appendChatMessages(current.pages, pending),
        }
      },
    )
  }, [messagesQuery.data, queryClient, room.id])

  useLayoutEffect(() => {
    const element = scrollerRef.current

    if (!element) {
      return
    }

    const signature = messageSignature(messages)
    const anchor = pendingAnchorRef.current
    const oldest = messages[0]

    if (anchor && oldest && oldest.id !== anchor.oldestId) {
      const scrollTop = preservedScrollTop(anchor.height, element.scrollHeight, anchor.top)
      element.scrollTop = scrollTop
      stickToBottomRef.current = false
      pendingAnchorRef.current = null
      heldScrollRef.current = { signature, scrollTop }
      return
    }

    if (anchor && oldest && oldest.id === anchor.oldestId) {
      pendingAnchorRef.current = null
    }

    if (heldScrollRef.current?.signature === signature) {
      element.scrollTop = heldScrollRef.current.scrollTop
      return
    }

    heldScrollRef.current = null

    if (stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [messages])

  async function submitMessage() {
    let content: string

    try {
      content = parseChatContent(draft)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '메시지를 확인해 주세요.')
      return
    }

    setSending(true)
    setSendError(null)

    try {
      const message = await sendChatMessage(room.id, userId, content)
      const updated = queryClient.setQueryData<InfiniteData<ChatPage, ChatCursor | null>>(
        chatMessagesQueryKey(room.id),
        (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            pages: appendChatMessage(current.pages, message),
          }
        },
      )

      if (!updated) {
        await queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(room.id) })
      }

      stickToBottomRef.current = true
      heldScrollRef.current = null
      setDraft('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '메시지를 보내지 못했습니다.')
    } finally {
      setSending(false)
    }
  }

  function loadOlder() {
    const element = scrollerRef.current

    const oldest = messages[0]

    if (element && oldest) {
      pendingAnchorRef.current = {
        oldestId: oldest.id,
        height: element.scrollHeight,
        top: element.scrollTop,
      }
    }

    void messagesQuery.fetchNextPage()
  }

  return (
    <div className="flex h-[min(36rem,70dvh)] min-h-80 flex-col">
      <p className="text-sm text-ink/70">{room.title}</p>
      <div
        ref={scrollerRef}
        className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
        onScroll={(event) => {
          const element = event.currentTarget
          stickToBottomRef.current = isNearBottom(
            element.scrollHeight,
            element.scrollTop,
            element.clientHeight,
          )
        }}
      >
        {messagesQuery.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              disabled={messagesQuery.isFetchingNextPage}
              onClick={loadOlder}
            >
              이전 메시지 불러오기
            </Button>
          </div>
        ) : null}
        {messagesQuery.isFetchingNextPage ? (
          <p role="status" className="text-center text-sm text-ink/65">
            이전 메시지를 불러오는 중
          </p>
        ) : null}
        {messagesQuery.isPending ? <Loading label="메시지를 불러오는 중" /> : null}
        {messagesQuery.isError ? (
          <ErrorMessage
            title="메시지를 불러오지 못했습니다"
            message={
              messagesQuery.error instanceof Error
                ? messagesQuery.error.message
                : '다시 시도해 주세요.'
            }
            onRetry={() => {
              void messagesQuery.refetch()
            }}
          />
        ) : null}
        {!messagesQuery.isPending && !messagesQuery.isError && messages.length === 0 ? (
          <EmptyState
            title="아직 메시지가 없습니다"
            description="첫 메시지를 보내 보세요."
          />
        ) : null}
        <ChatMessageList
          messages={messages}
          userId={userId}
          nicknames={namesQuery.data ?? {}}
        />
      </div>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submitMessage()
        }}
      >
        <Textarea
          label="메시지"
          rows={2}
          maxLength={500}
          value={draft}
          className="min-h-20"
          disabled={sending}
          error={sendError ?? undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            if (sendError) {
              setSendError(null)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={sending || messagesQuery.isPending || draft.trim().length === 0}
        >
          {sending ? '보내는 중' : '전송'}
        </Button>
      </form>
    </div>
  )
}

export function ChatMessageList({
  messages,
  userId,
  nicknames,
}: {
  messages: ChatMessage[]
  userId: string
  nicknames: Record<string, string>
}) {
  if (messages.length === 0) {
    return null
  }

  return (
    <ol className="space-y-3" aria-label="대화">
      {messages.map((message) => {
        const mine = message.sender_id === userId
        const name = mine ? '나' : (nicknames[message.sender_id] ?? '참여자')

        return (
          <li key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={[
                'max-w-[85%] rounded-2xl px-3 py-2',
                mine ? 'bg-court-700 text-white' : 'bg-court-50 text-ink',
              ].join(' ')}
            >
              <p className={mine ? 'text-xs text-court-100' : 'text-xs text-ink/60'}>{name}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
              <time
                dateTime={message.created_at}
                className={mine ? 'mt-1 block text-xs text-court-100' : 'mt-1 block text-xs text-ink/55'}
              >
                {formatMessageTime(message.created_at)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function messageSignature(messages: ChatMessage[]) {
  const oldest = messages[0]
  const newest = messages.at(-1)
  return `${oldest?.id ?? ''}:${messages.length}:${newest?.id ?? ''}`
}

function appendBuffered(messages: ChatMessage[], message: ChatMessage) {
  if (messages.some((item) => item.id === message.id)) {
    return messages
  }

  return [...messages, message]
}
