import { Link, NavLink } from 'react-router'
import { Brand } from './Brand.tsx'
import { navItems } from './navItems.ts'

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link
          to="/dashboard"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700"
        >
          <Brand />
        </Link>
      </div>
      <nav aria-label="데스크톱 주요 메뉴" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
                      isActive
                        ? 'bg-court-50 font-semibold text-court-800'
                        : 'text-ink/75 hover:bg-court-50',
                    ].join(' ')
                  }
                >
                  <Icon />
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <p className="px-5 py-4 text-xs leading-5 text-ink/50">
        TNS는 Sepolia 테스트 토큰이며 상업적 가치가 없습니다.
      </p>
    </aside>
  )
}
