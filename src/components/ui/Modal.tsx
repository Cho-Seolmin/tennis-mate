import { useId, type ReactNode } from 'react'
import { Button } from './Button.tsx'

type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  const titleId = useId()

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end p-4 md:place-items-center">
      <button
        type="button"
        aria-label="대화상자 닫기"
        className="absolute inset-0 bg-ink/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose()
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <Button variant="ghost" autoFocus onClick={onClose}>
            닫기
          </Button>
        </div>
        <div className="mt-3 text-sm leading-6 text-ink">{children}</div>
      </div>
    </div>
  )
}
