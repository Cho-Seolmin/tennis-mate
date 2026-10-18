import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatMessageList } from '../src/features/community/ChatPanel.tsx'
import { CommunityPage } from '../src/features/community/CommunityPage.tsx'
import { RoomForm } from '../src/features/community/RoomForm.tsx'
import type { ChatMessage } from '../src/types/database.ts'
import type { RoomSummary } from '../src/features/community/roomSummary.ts'

vi.mock('../src/lib/env.ts', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/env.ts')>('../src/lib/env.ts')

  return {
    ...actual,
    isSupabaseConfigured: true,
  }
})

vi.mock('../src/lib/supabase.ts', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'player@example.com' })),
  supabase: null,
}))

vi.mock('../src/features/community/roomApi.ts', () => ({
  roomsQueryKey: ['rooms'],
  roomMembersQueryKey: (roomId: string) => ['room-members', roomId],
  fetchRoomSummaries: vi.fn(),
  fetchRoomMembers: vi.fn(async () => []),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  deleteRoom: vi.fn(),
  kickRoomMember: vi.fn(),
  subscribeToRoomMembers: vi.fn(() => () => {}),
}))

vi.mock('../src/features/community/messageApi.ts', () => ({
  chatMessagesQueryKey: (roomId: string) => ['chat-messages', roomId],
  nicknameQueryKey: (userIds: string[]) => ['profile-nicknames', [...userIds].sort()],
  fetchChatPage: vi.fn(),
  fetchNicknames: vi.fn(async () => ({ 'user-2': '민수' })),
  parseChatContent: (input: unknown) => {
    if (typeof input !== 'string' || input.trim() === '') {
      throw new Error('메시지를 입력해 주세요.')
    }

    if (input.trim().length > 500) {
      throw new Error('메시지는 500자까지 입력할 수 있습니다.')
    }

    return input.trim()
  },
  sendChatMessage: vi.fn(),
  subscribeToRoomMessages: vi.fn(() => () => {}),
}))

import { fetchChatPage, fetchNicknames, sendChatMessage } from '../src/features/community/messageApi.ts'
import { deleteRoom, fetchRoomMembers, fetchRoomSummaries, joinRoom, kickRoomMember } from '../src/features/community/roomApi.ts'

const openRoom: RoomSummary = {
  id: 'room-open',
  host_id: 'user-2',
  title: '토요일 복식',
  location: '한강 코트',
  scheduled_at: '2026-10-18T01:00:00.000Z',
  max_participants: 4,
  status: 'open',
  created_at: '2026-10-17T00:00:00.000Z',
  memberCount: 4,
  joined: false,
}

const joinedRoom: RoomSummary = {
  id: 'room-joined',
  host_id: 'user-1',
  title: '저녁 단식',
  location: '잠실 코트',
  scheduled_at: '2026-10-18T10:00:00.000Z',
  max_participants: 4,
  status: 'open',
  created_at: '2026-10-17T00:00:00.000Z',
  memberCount: 1,
  joined: true,
}

const older: ChatMessage = {
  id: 'm1',
  room_id: 'room-joined',
  sender_id: 'user-2',
  content: '코트 옆에서 봐요',
  created_at: '2026-10-18T01:00:00.000Z',
}

const newer: ChatMessage = {
  id: 'm2',
  room_id: 'room-joined',
  sender_id: 'user-1',
  content: '네, 갈게요',
  created_at: '2026-10-18T01:05:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>)
}

describe('community page', () => {
  it('shows capacity, blocks a full room, and pages chat without duplicating messages', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRoomSummaries).mockResolvedValue([openRoom, joinedRoom])
    vi.mocked(fetchChatPage).mockImplementation(async (_roomId, cursor) => {
      if (!cursor) {
        return {
          messages: [newer],
          nextCursor: { createdAt: newer.created_at, id: newer.id },
        }
      }

      return { messages: [older], nextCursor: null }
    })

    renderPage(<CommunityPage />)

    expect(await screen.findByRole('button', { name: '토요일 복식 정원 마감' })).toBeDisabled()
    expect(screen.getByText('4 / 4명')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /잠실 코트/ }))

    expect(await screen.findByText('네, 갈게요')).toBeInTheDocument()
    expect(screen.getByText('나')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이전 메시지 불러오기' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이전 메시지 불러오기' }))

    expect(await screen.findByText('코트 옆에서 봐요')).toBeInTheDocument()
    expect(screen.getByText('민수')).toBeInTheDocument()
    expect(screen.getAllByText('네, 갈게요')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '이전 메시지 불러오기' })).not.toBeInTheDocument()
    expect(
      screen.getByText('코트 옆에서 봐요').compareDocumentPosition(screen.getByText('네, 갈게요')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('joins an open room', async () => {
    const user = userEvent.setup()
    const available: RoomSummary = { ...openRoom, memberCount: 1 }
    vi.mocked(fetchRoomSummaries).mockResolvedValue([available])
    vi.mocked(joinRoom).mockResolvedValue(undefined)

    renderPage(<CommunityPage />)

    await user.click(await screen.findByRole('button', { name: '토요일 복식 참여' }))

    expect(joinRoom).toHaveBeenCalledWith('room-open')
  })

  it('keeps a failed message in the field', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRoomSummaries).mockResolvedValue([joinedRoom])
    vi.mocked(fetchChatPage).mockResolvedValue({ messages: [], nextCursor: null })
    vi.mocked(sendChatMessage).mockRejectedValue(new Error('메시지를 보내지 못했습니다.'))

    renderPage(<CommunityPage />)

    await user.click(await screen.findByRole('button', { name: /잠실 코트/ }))
    await user.type(await screen.findByLabelText('메시지'), '<script>alert(1)</script>')
    await user.click(screen.getByRole('button', { name: '전송' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('메시지를 보내지 못했습니다.')
    expect(screen.getByLabelText('메시지')).toHaveValue('<script>alert(1)</script>')
  })

  it('shows a create button when the room list is empty', async () => {
    vi.mocked(fetchRoomSummaries).mockResolvedValue([])

    renderPage(<CommunityPage />)

    expect(await screen.findByText('모임이 없습니다')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '모임 만들기' })).toHaveLength(2)
  })

  it('lets the host delete a room and kick a member, and keeps those actions away from other members', async () => {
    const user = userEvent.setup()
    const guestRoom: RoomSummary = { ...openRoom, memberCount: 2, joined: true }
    vi.mocked(fetchRoomSummaries).mockResolvedValue([joinedRoom, guestRoom])
    vi.mocked(fetchRoomMembers).mockResolvedValue([
      { user_id: 'user-1', joined_at: '2026-10-18T00:00:00.000Z' },
      { user_id: 'user-2', joined_at: '2026-10-18T00:01:00.000Z' },
    ])
    vi.mocked(fetchChatPage).mockResolvedValue({ messages: [], nextCursor: null })
    vi.mocked(fetchNicknames).mockResolvedValue({ 'user-2': '민수' })
    vi.mocked(deleteRoom).mockResolvedValue(undefined)
    vi.mocked(kickRoomMember).mockResolvedValue(undefined)

    renderPage(<CommunityPage />)

    expect(await screen.findByRole('button', { name: '저녁 단식 채팅방 삭제' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저녁 단식 나가기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '토요일 복식 나가기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '토요일 복식 채팅방 삭제' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '저녁 단식 채팅방 삭제' }))
    await user.click(await screen.findByRole('button', { name: '삭제' }))
    expect(deleteRoom).toHaveBeenCalledWith('room-joined')

    await user.click(screen.getByRole('button', { name: /잠실 코트/ }))
    await user.click(await screen.findByRole('button', { name: '민수 강퇴' }))
    expect(kickRoomMember).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '민수 강퇴' }))
    expect(kickRoomMember).toHaveBeenCalledWith('room-joined', 'user-2')
    expect(screen.queryByRole('button', { name: '나 강퇴' })).not.toBeInTheDocument()
  })

  it('shows an empty chat state', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRoomSummaries).mockResolvedValue([joinedRoom])
    vi.mocked(fetchChatPage).mockResolvedValue({ messages: [], nextCursor: null })

    renderPage(<CommunityPage />)
    await user.click(await screen.findByRole('button', { name: /잠실 코트/ }))

    expect(await screen.findByText('아직 메시지가 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이전 메시지 불러오기' })).not.toBeInTheDocument()
  })
})

describe('chat message list', () => {
  it('renders message text instead of HTML', () => {
    const { container } = render(
      <ChatMessageList
        userId="user-1"
        nicknames={{}}
        messages={[
          {
            id: 'm-html',
            room_id: 'room-1',
            sender_id: 'user-2',
            content: '<script>alert(1)</script>',
            created_at: '2026-10-18T01:00:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('room form', () => {
  it('does not submit a meetup without a title', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <RoomForm
        submitting={false}
        onSubmit={onSubmit}
        defaultValues={{
          title: '',
          location: '한강 코트',
          scheduled_at: '2026-10-18T19:00',
          max_participants: 4,
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: '모임 만들기' }))

    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
