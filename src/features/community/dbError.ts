const messages: Record<string, string> = {
  room_full: '정원이 가득 찼습니다.',
  already_joined: '이미 참여 중인 모임입니다.',
  not_a_member: '참여 중인 모임에서만 할 수 있습니다.',
  room_not_found: '모임을 찾지 못했습니다.',
  room_closed: '모집이 끝난 모임입니다.',
  invalid_title: '제목은 1자 이상 100자 이하여야 합니다.',
  invalid_location: '장소는 1자 이상 200자 이하여야 합니다.',
  invalid_schedule: '올바른 날짜와 시간을 입력해 주세요.',
  invalid_capacity: '정원은 2명 이상 30명 이하여야 합니다.',
  invalid_cursor: '이전 메시지를 불러오지 못했습니다.',
  invalid_page_size: '메시지는 20개씩만 불러옵니다.',
  chat_messages_content_length: '메시지는 1자 이상 500자 이하여야 합니다.',
  rooms_title_length: '제목은 1자 이상 100자 이하여야 합니다.',
  rooms_location_length: '장소는 1자 이상 200자 이하여야 합니다.',
  rooms_capacity: '정원은 2명 이상 30명 이하여야 합니다.',
}

type CommunityDbError = {
  message: string
  details?: string | null
  hint?: string | null
  code?: string
}

export function communityError(error: CommunityDbError, fallback: string) {
  const detail = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`

  if (detail.includes('not authenticated')) {
    return '다시 로그인해 주세요.'
  }

  if (error.code === '22007' || error.code === '22008') {
    return '올바른 날짜와 시간을 입력해 주세요.'
  }

  for (const [code, message] of Object.entries(messages)) {
    if (detail.includes(code)) {
      return message
    }
  }

  if (error.code === '42501') {
    return '참여 중인 모임에서만 할 수 있습니다.'
  }

  if (error.code === '23514') {
    return '입력값이 서버 규칙에 맞지 않습니다.'
  }

  return fallback
}
