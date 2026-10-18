import { Button } from './Button.tsx'

type ErrorMessageProps = {
  title: string
  message: string
  onRetry?: () => void
}

export function ErrorMessage({ title, message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="w-full max-w-md rounded-2xl border border-danger/20 bg-white px-5 py-6"
    >
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/75">{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  )
}
