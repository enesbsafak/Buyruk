interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export type IconName =
  | 'terminal'
  | 'plus'
  | 'folder'
  | 'folder-plus'
  | 'file'
  | 'file-plus'
  | 'close'
  | 'settings'
  | 'save'
  | 'trash'
  | 'edit'
  | 'refresh'
  | 'chevron'
  | 'bolt'
  | 'warning'
  | 'search'
  | 'restart'
  | 'expand'
  | 'collapse'
  | 'broadcast'
  | 'git-diff'
  | 'win-minimize'
  | 'win-maximize'
  | 'win-restore'

// One cohesive, consistently-weighted icon set (1.6px stroke, 24px grid).
// Replaces emoji so the UI reads as a real product, not a prototype.
const PATHS: Record<IconName, JSX.Element> = {
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m7 9 3 3-3 3" />
      <path d="M13 15h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  folder: <path d="M3 7.5A2 2 0 0 1 5 5.5h3.6a2 2 0 0 1 1.4.6l1 1h7.5a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" />,
  'folder-plus': (
    <>
      <path d="M3 7.5A2 2 0 0 1 5 5.5h3.6a2 2 0 0 1 1.4.6l1 1h7.5a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" />
      <path d="M12 11.5v5M9.5 14h5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  'file-plus': (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M12 12.5v4M10 14.5h4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  settings: (
    <>
      <path d="M12.2 2.8h-.4a1.8 1.8 0 0 0-1.8 1.8v.3a1.8 1.8 0 0 1-.9 1.5l-.4.2a1.8 1.8 0 0 1-1.8 0l-.3-.1A1.8 1.8 0 0 0 4.2 7l-.2.4a1.8 1.8 0 0 0 .7 2.4l.2.1a1.8 1.8 0 0 1 .9 1.6v.9a1.8 1.8 0 0 1-.9 1.6l-.2.1a1.8 1.8 0 0 0-.7 2.4l.2.4a1.8 1.8 0 0 0 2.4.7l.3-.1a1.8 1.8 0 0 1 1.8 0l.4.2a1.8 1.8 0 0 1 .9 1.5v.3a1.8 1.8 0 0 0 1.8 1.8h.4a1.8 1.8 0 0 0 1.8-1.8v-.3a1.8 1.8 0 0 1 .9-1.5l.4-.2a1.8 1.8 0 0 1 1.8 0l.3.1a1.8 1.8 0 0 0 2.4-.7l.2-.4a1.8 1.8 0 0 0-.7-2.4l-.2-.1a1.8 1.8 0 0 1-.9-1.6v-.9a1.8 1.8 0 0 1 .9-1.6l.2-.1a1.8 1.8 0 0 0 .7-2.4l-.2-.4a1.8 1.8 0 0 0-2.4-.7l-.3.1a1.8 1.8 0 0 1-1.8 0l-.4-.2a1.8 1.8 0 0 1-.9-1.5v-.3a1.8 1.8 0 0 0-1.8-1.8Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 4v5h7V4M8 21v-6h8v6" />
    </>
  ),
  trash: (
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 12.5a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9L18 7M10 11v6M14 11v6" />
  ),
  edit: (
    <>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z" />
      <path d="m14 8 2.8 2.8" />
    </>
  ),
  refresh: <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6M20.5 4v4h-4" />,
  chevron: <path d="m9.5 7 5 5-5 5" />,
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />,
  warning: (
    <>
      <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4.5M12 17.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  restart: (
    <>
      <path d="M20 11a8 8 0 1 0-1.5 5.4" />
      <path d="M20 5v5h-5" />
    </>
  ),
  expand: <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />,
  collapse: <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />,
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9M4.7 4.7a10 10 0 0 0 0 14.6M19.3 4.7a10 10 0 0 1 0 14.6" />
    </>
  ),
  'git-diff': (
    <>
      <path d="M8 6h8M8 18h8M12 8.5v7" />
      <path d="m9.5 13 2.5 2.5 2.5-2.5" />
      <path d="M4 6h1.5M18.5 6H20M4 18h1.5M18.5 18H20" />
    </>
  ),
  'win-minimize': <path d="M5 12h14" />,
  'win-maximize': <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  'win-restore': (
    <>
      <rect x="8" y="8" width="11" height="11" rx="1.5" />
      <path d="M5 16V6a1 1 0 0 1 1-1h10" />
    </>
  )
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
