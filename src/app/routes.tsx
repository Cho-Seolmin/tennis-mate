import { Navigate, type RouteObject } from 'react-router'
import { ResponsiveLayout } from '../components/layout/ResponsiveLayout.tsx'
import { LoginPage } from '../features/auth/LoginPage.tsx'
import { ProtectedRoute } from '../features/auth/ProtectedRoute.tsx'
import { CommunityPage } from '../features/community/CommunityPage.tsx'
import { CourtsPage } from '../features/courts/CourtsPage.tsx'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { MatchesPage } from '../features/matches/MatchesPage.tsx'
import { RankingPage } from '../features/ranking/RankingPage.tsx'
import { RewardsPage } from '../features/rewards/RewardsPage.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

export const appRoutes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ResponsiveLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'community', element: <CommunityPage /> },
          { path: 'rewards', element: <RewardsPage /> },
          { path: 'matches', element: <MatchesPage /> },
          { path: 'ranking', element: <RankingPage /> },
          { path: 'courts', element: <CourtsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
] satisfies RouteObject[]
