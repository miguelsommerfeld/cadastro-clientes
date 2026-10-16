import type { ReactNode } from 'react'

export type AppIconName =
  | 'brand'
  | 'users'
  | 'trash'
  | 'plus'
  | 'search'
  | 'edit'
  | 'restore'
  | 'warning'
  | 'chevron-left'
  | 'chevron-right'

type AppIconProps = {
  name: AppIconName
  className?: string
}

const iconPaths: Record<AppIconName, ReactNode> = {
  brand: (
    <>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
      <path d="m8 12 2.5 2.5L16.5 8.5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2m3 0-.9 14H5.9L5 6m4 4v6m6-6v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  edit: <path d="m16 4 4 4L8 20l-5 1 1-5zM14 6l4 4" />,
  restore: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5m4-1v5l3 2" />
    </>
  ),
  warning: (
    <>
      <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 4h.01" />
    </>
  ),
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
}

export function AppIcon({ name, className = 'h-[18px] w-[18px]' }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {iconPaths[name]}
    </svg>
  )
}
