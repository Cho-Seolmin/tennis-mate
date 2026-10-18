import { z } from 'zod'

export const chatContentSchema = z
  .string()
  .trim()
  .min(1, { error: '메시지를 입력해 주세요.' })
  .max(500, { error: '메시지는 500자까지 입력할 수 있습니다.' })

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  room_id: z.string().min(1),
  sender_id: z.string().min(1),
  content: z.string(),
  created_at: z.string().min(1),
})

export const chatPageSchema = z.object({
  has_more: z.boolean(),
  messages: z.array(chatMessageSchema),
})
