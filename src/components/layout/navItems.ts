import type { ComponentType } from 'react'
import {
  CommunityIcon,
  CourtsIcon,
  HomeIcon,
  MatchesIcon,
  RankingIcon,
  RewardsIcon,
} from './icons.tsx'

export const navItems: readonly {
  to: string
  label: string
  icon: ComponentType
}[] = [
  { to: '/dashboard', label: '홈', icon: HomeIcon },
  { to: '/community', label: '모임', icon: CommunityIcon },
  { to: '/rewards', label: '보상', icon: RewardsIcon },
  { to: '/matches', label: '경기', icon: MatchesIcon },
  { to: '/ranking', label: '랭킹', icon: RankingIcon },
  { to: '/courts', label: '코트', icon: CourtsIcon },
]
