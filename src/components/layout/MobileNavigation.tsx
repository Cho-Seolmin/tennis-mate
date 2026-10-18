import { NavLink } from 'react-router'
import { navItems } from './navItems.ts'

const linkClass =
  'flex h-full min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-court-700'

export function MobileNavigation() {
  return (
    <nav
      aria-label="모바일 주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid h-[4.5rem] grid-cols-6">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <li key={item.to} className="min-w-0">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `${linkClass} ${isActive ? 'text-court-800' : 'text-ink/55'}`
                }
              >
                <Icon />
                <span className="max-w-full truncate">{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
