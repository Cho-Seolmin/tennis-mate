type ProfileAvatarProps = {
  name: string
  avatarUrl: string | null
}

export function ProfileAvatar({ name, avatarUrl }: ProfileAvatarProps) {
  const safeUrl = avatarUrl?.startsWith('https://') ? avatarUrl : null

  if (safeUrl) {
    return <img src={safeUrl} alt="" className="size-14 rounded-full object-cover" />
  }

  const initial = name.trim().slice(0, 1).toUpperCase() || 'T'

  return (
    <span
      aria-hidden="true"
      className="grid size-14 place-items-center rounded-full bg-court-700 text-lg font-semibold text-white"
    >
      {initial}
    </span>
  )
}
