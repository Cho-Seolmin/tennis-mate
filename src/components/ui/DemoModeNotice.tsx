type DemoModeNoticeProps = {
  service: string
  detail: string
}

export function DemoModeNotice({ service, detail }: DemoModeNoticeProps) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-court-200 bg-court-50 px-4 py-3"
    >
      <p className="text-sm font-semibold text-court-900">Demo Mode · {service}</p>
      <p className="mt-1 text-sm leading-6 text-court-900/80">{detail}</p>
    </div>
  )
}
