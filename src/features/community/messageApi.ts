import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChatMessage } from '../../types/database.ts'
import { supabase } from '../../lib/supabase.ts'
import { CHAT_PAGE_SIZE, toChatPage, type ChatCursor, type ChatPage } from './chatPages.ts'
import { communityError } from './dbError.ts'
import { chatContentSchema, chatMessageSchema, chatPageSchema } from './messageSchema.ts'

export function chatMessagesQueryKey(roomId: string) {
  return ['chat-messages', roomId] as const
}

export function nicknameQueryKey(userIds: string[]) {
  return ['profile-nicknames', [...new Set(userIds)].sort()] as const
}

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  return supabase
}

export function parseChatContent(input: unknown) {
  const parsed = chatContentSchema.safeParse(input)

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? '메시지를 확인해 주세요.')
  }

  return parsed.data
}

export async function fetchChatPage(roomId: string, cursor: ChatCursor | null): Promise<ChatPage> {
  const client = requireClient()
  const { data, error } = await client.rpc('list_chat_messages', {
    p_room_id: roomId,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_page_size: CHAT_PAGE_SIZE,
  })

  if (error) {
    throw new Error(communityError(error, '메시지를 불러오지 못했습니다.'))
  }

  const parsed = chatPageSchema.safeParse(data)

  if (!parsed.success) {
    throw new Error('메시지를 불러오지 못했습니다.')
  }

  return toChatPage({ messages: parsed.data.messages, has_more: parsed.data.has_more })
}

export async function sendChatMessage(roomId: string, userId: string, content: unknown) {
  const client = requireClient()
  const text = parseChatContent(content)
  const { data, error } = await client
    .from('chat_messages')
    .insert({ room_id: roomId, sender_id: userId, content: text })
    .select('id, room_id, sender_id, content, created_at')
    .single()

  if (error) {
    throw new Error(communityError(error, '메시지를 보내지 못했습니다.'))
  }

  const parsed = chatMessageSchema.safeParse(data)

  if (!parsed.success) {
    throw new Error('메시지를 보내지 못했습니다.')
  }

  return parsed.data
}

export async function fetchNicknames(userIds: string[]) {
  const ids = [...new Set(userIds)].slice(0, 200)

  if (ids.length === 0) {
    return {}
  }

  const client = requireClient()
  const { data, error } = await client.rpc('profile_nicknames', { p_user_ids: ids })

  if (error) {
    throw new Error(communityError(error, '참여자 이름을 불러오지 못했습니다.'))
  }

  return Object.fromEntries((data ?? []).map((row) => [row.id, row.nickname]))
}

export function subscribeToRoomMessages(
  roomId: string,
  onMessage: (message: ChatMessage) => void,
) {
  if (!supabase) {
    return () => {}
  }

  const client = supabase
  const channel: RealtimeChannel = client
    .channel(`chat-messages:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const parsed = chatMessageSchema.safeParse(payload.new)

        if (!parsed.success || parsed.data.room_id !== roomId) {
          return
        }

        onMessage(parsed.data)
      },
    )
    .subscribe()

  return () => {
    if (channel) {
      void client.removeChannel(channel)
    }
  }
}
