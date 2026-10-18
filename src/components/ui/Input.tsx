import { useId, type InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function Input({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const message = error ?? hint
  const messageId = message ? `${inputId}-message` : undefined

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={[
          'min-h-11 w-full rounded-xl border bg-white px-3 text-base text-ink',
          'placeholder:text-ink/40',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
          error ? 'border-danger' : 'border-line',
          className,
        ].join(' ')}
        {...props}
      />
      {message ? (
        <p
          id={messageId}
          className={error ? 'text-sm text-danger' : 'text-sm text-ink/65'}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
