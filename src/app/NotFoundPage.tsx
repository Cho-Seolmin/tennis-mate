import { Link } from 'react-router'
import { buttonClass } from '../components/ui/buttonStyles.ts'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold text-court-700">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/70 md:text-base">
          주소가 없거나 바뀐 화면입니다.
        </p>
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-center">
          <Link to="/dashboard" className={buttonClass('primary')}>
            대시보드로
          </Link>
          <Link to="/login" className={buttonClass('secondary')}>
            로그인으로
          </Link>
        </div>
      </div>
    </div>
  )
}
