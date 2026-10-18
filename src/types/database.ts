export const equipmentCategories = ['racket', 'shoes', 'other'] as const

export type EquipmentCategory = (typeof equipmentCategories)[number]

export type Profile = {
  id: string
  nickname: string
  avatar_url: string | null
  wallet_address: string | null
  created_at: string
}

export type Schedule = {
  id: string
  user_id: string
  title: string
  start_at: string
  end_at: string
  location: string | null
  memo: string | null
  created_at: string
}

export type Equipment = {
  id: string
  user_id: string
  category: EquipmentCategory
  brand: string
  model: string
  created_at: string
}

export const roomStatuses = ['open', 'closed'] as const

export type RoomStatus = (typeof roomStatuses)[number]

export type Room = {
  id: string
  host_id: string
  title: string
  location: string
  scheduled_at: string
  max_participants: number
  status: RoomStatus
  created_at: string
}

export type RoomMember = {
  room_id: string
  user_id: string
  joined_at: string
}

export type ChatMessage = {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

export const attendanceStatuses = ['pending', 'confirming', 'completed', 'failed'] as const

export type AttendanceStatus = (typeof attendanceStatuses)[number]

export const matchStatuses = ['pending', 'confirming', 'completed', 'failed'] as const

export type MatchStatus = (typeof matchStatuses)[number]

export type Match = {
  id: string
  winner_id: string
  loser_id: string
  amount: string
  status: MatchStatus
  tx_hash: string | null
  played_at: string
  created_at: string
}

export type RankingEntry = {
  userId: string
  nickname: string
  balanceWei: string
  rank: number
}

export type RankingPage = {
  snapshotId: string | null
  createdAt: string | null
  myRank: number | null
  myBalanceWei: string | null
  hasMore: boolean
  entries: RankingEntry[]
}

export type Attendance = {
  id: string
  user_id: string
  reward_date: string
  amount: number | string
  tx_hash: string | null
  status: AttendanceStatus
  locked_until: string | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          nickname: string
          avatar_url?: string | null
          wallet_address?: string | null
          created_at?: string
        }
        Update: {
          nickname?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: Schedule
        Insert: {
          id?: string
          user_id: string
          title: string
          start_at: string
          end_at: string
          location?: string | null
          memo?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          start_at?: string
          end_at?: string
          location?: string | null
          memo?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: Equipment
        Insert: {
          id?: string
          user_id: string
          category: EquipmentCategory
          brand: string
          model: string
          created_at?: string
        }
        Update: {
          category?: EquipmentCategory
          brand?: string
          model?: string
        }
        Relationships: []
      }
      rooms: {
        Row: Room
        Insert: {
          id?: string
          host_id: string
          title: string
          location: string
          scheduled_at: string
          max_participants: number
          status?: RoomStatus
          created_at?: string
        }
        Update: {
          title?: string
          location?: string
          scheduled_at?: string
          max_participants?: number
          status?: RoomStatus
        }
        Relationships: []
      }
      room_members: {
        Row: RoomMember
        Insert: {
          room_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          joined_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: ChatMessage
        Insert: {
          id?: string
          room_id: string
          sender_id: string
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
        Relationships: []
      }
      attendance: {
        Row: Attendance
        Insert: {
          id?: string
          user_id: string
          reward_date: string
          amount: number | string
          tx_hash?: string | null
          status: AttendanceStatus
          attempt_id: string
          locked_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          tx_hash?: string | null
          status?: AttendanceStatus
        }
        Relationships: []
      }
      matches: {
        Row: Match
        Insert: {
          id: string
          winner_id: string
          loser_id: string
          amount: string
          status: MatchStatus
          tx_hash?: string | null
          played_at: string
          created_at?: string
        }
        Update: {
          status?: MatchStatus
          tx_hash?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_room: {
        Args: {
          p_title: string
          p_location: string
          p_scheduled_at: string
          p_max_participants: number
        }
        Returns: Room
      }
      join_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      leave_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      delete_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      kick_room_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      list_chat_messages: {
        Args: {
          p_room_id: string
          p_before_created_at: string | null
          p_before_id: string | null
          p_page_size: number
        }
        Returns: {
          messages: ChatMessage[]
          has_more: boolean
        }
      }
      profile_nicknames: {
        Args: { p_user_ids: string[] }
        Returns: { id: string; nickname: string }[]
      }
      list_match_opponents: {
        Args: Record<string, never>
        Returns: { id: string; nickname: string }[]
      }
      list_ranking_page: {
        Args: { p_after_rank: number; p_page_size: number }
        Returns: RankingPage
      }
    }
  }
}
