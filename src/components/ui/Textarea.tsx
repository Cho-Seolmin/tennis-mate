import { useId, type TextareaHTMLAttributes } from 'react'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  hint?: string
}

export function Textarea({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}: TextareaProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const message = error ?? hint
  const messageId = message ? `${inputId}-message` : undefined

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={[
          'min-h-28 w-full rounded-xl border bg-white px-3 py-2 text-base text-ink',
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
          role={error ? 'alert' : undefined}
          className={error ? 'text-sm text-danger' : 'text-sm text-ink/65'}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
