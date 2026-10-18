type PageHeaderProps = {
  title: string
  description: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="max-w-2xl space-y-2">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        {title}
      </h1>
      <p className="text-sm leading-6 text-ink/70 md:text-base">{description}</p>
    </header>
  )
}
