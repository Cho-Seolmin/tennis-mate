type LoadingProps = {
  label?: string
}

export function Loading({ label = '불러오는 중' }: LoadingProps) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-court-800">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-court-200 border-t-court-700"
      />
      {label}
    </div>
  )
}
