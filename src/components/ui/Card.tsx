import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <article
      className={`min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(16,44,28,0.04)] ${className}`}
    >
      {children}
    </article>
  )
}
