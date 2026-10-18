import { Outlet } from 'react-router'
import { getDemoNotices } from '../../lib/env.ts'
import { DesktopSidebar } from './DesktopSidebar.tsx'
import { Header } from './Header.tsx'
import { MobileNavigation } from './MobileNavigation.tsx'
import { PageContainer } from './PageContainer.tsx'

export function ResponsiveLayout() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-surface text-ink">
      <a href="#main" className="skip-link rounded-xl bg-court-700 px-4 py-2 text-sm font-semibold text-white">
        본문으로 건너뛰기
      </a>
      <DesktopSidebar />
      <div className="min-w-0 lg:pl-64">
        <Header />
        <DemoBanner />
        <main
          id="main"
          className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-10"
        >
          <PageContainer className="py-5 md:py-6 lg:py-8">
            <Outlet />
          </PageContainer>
        </main>
      </div>
      <MobileNavigation />
    </div>
  )
}

function DemoBanner() {
  const notices = getDemoNotices()

  if (notices.length === 0) {
    return null
  }

  return (
    <div className="border-b border-court-200 bg-court-50" role="status">
      <PageContainer className="py-3">
        <p className="text-sm font-semibold text-court-900">Demo Mode</p>
        <ul className="mt-1 space-y-1 text-sm leading-6 text-court-900/80">
          {notices.map((notice) => (
            <li key={notice.service}>
              {notice.service}: {notice.detail}
            </li>
          ))}
        </ul>
      </PageContainer>
    </div>
  )
}
