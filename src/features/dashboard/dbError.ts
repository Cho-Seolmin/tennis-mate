import type { PostgrestError } from '@supabase/supabase-js'

const scheduleMessages: Record<string, string> = {
  schedules_title_length: '제목은 1자 이상 100자 이하여야 합니다.',
  schedules_time_order: '종료 시간은 시작 시간보다 늦어야 합니다.',
  schedules_location_length: '장소는 200자까지 입력할 수 있습니다.',
  schedules_memo_length: '메모는 500자까지 입력할 수 있습니다.',
}

const equipmentMessages: Record<string, string> = {
  equipment_category_value: '장비 종류를 다시 선택해 주세요.',
  equipment_brand_length: '브랜드는 1자 이상 50자 이하여야 합니다.',
  equipment_model_length: '모델은 1자 이상 50자 이하여야 합니다.',
}

export function messageFromRowError(
  error: PostgrestError,
  messages: Record<string, string>,
  fallback: string,
) {
  const detail = `${error.message} ${error.details ?? ''}`

  if (error.code === '22007' || error.code === '22008') {
    return '올바른 날짜와 시간을 입력해 주세요.'
  }

  if (detail.includes('not authenticated') || detail.includes('user_id cannot be changed') || error.code === '42501') {
    return '본인 데이터만 수정할 수 있습니다.'
  }

  for (const [constraint, message] of Object.entries(messages)) {
    if (detail.includes(constraint)) {
      return message
    }
  }

  if (error.code === '23514') {
    return '입력값이 서버 규칙에 맞지 않습니다.'
  }

  return fallback
}

export function scheduleRowError(error: PostgrestError, fallback: string) {
  return messageFromRowError(error, scheduleMessages, fallback)
}

export function equipmentRowError(error: PostgrestError, fallback: string) {
  return messageFromRowError(error, equipmentMessages, fallback)
}
