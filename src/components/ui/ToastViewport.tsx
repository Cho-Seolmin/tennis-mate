import { useToastStore } from '../../hooks/useToast.ts'
import type { ToastTone } from '../../types/index.ts'

const toneClass: Record<ToastTone, string> = {
  info: 'bg-court-900',
  success: 'bg-court-700',
  error: 'bg-danger',
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex w-full max-w-md items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-lg ${toneClass[toast.tone]}`}
        >
          <p className="pt-2 leading-6">{toast.message}</p>
          <button
            type="button"
            className="min-h-11 shrink-0 font-semibold text-ball"
            onClick={() => {
              dismiss(toast.id)
            }}
          >
            닫기
          </button>
        </div>
      ))}
    </div>
  )
}
