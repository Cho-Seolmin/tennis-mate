type EmptyStateProps = {
  title: string
  description: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-court-200 bg-court-50/70 px-4 py-8 text-center">
      <p className="font-medium text-court-900">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/70">
        {description}
      </p>
    </div>
  )
}
