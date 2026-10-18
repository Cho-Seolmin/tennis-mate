export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-court-700 text-white hover:bg-court-800',
  secondary: 'border border-line bg-white text-court-900 hover:bg-court-50',
  ghost: 'text-court-800 hover:bg-court-50',
}

export function buttonClass(variant: ButtonVariant = 'primary', className = '') {
  return [
    'inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variantClass[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')
}
