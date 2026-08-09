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
  | 'download'
  | 'win-minimize'
  | 'win-maximize'
  | 'win-restore'
  | 'grid'
  | 'tabs'
  | 'code'
  | 'braces'
  | 'file-text'
  | 'image'
  | 'archive'
  | 'lock'
  | 'folder-open'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'scissors'
  | 'clipboard'

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
  download: (
    <>
      <path d="M12 4v10M8 10.5l4 4 4-4" />
      <path d="M5 18.5h14" />
    </>
  ),
  'win-minimize': <path d="M5 12h14" />,
  'win-maximize': <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  'win-restore': (
    <>
      <rect x="8" y="8" width="11" height="11" rx="1.5" />
      <path d="M5 16V6a1 1 0 0 1 1-1h10" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  tabs: (
    <>
      <path d="M3 8.5h6.5V5a1 1 0 0 1 1-1H20a1 1 0 0 1 1 1v3.5" />
      <rect x="3" y="8.5" width="18" height="11" rx="1.6" />
    </>
  ),
  code: <path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.5 5l-3 14" />,
  braces: (
    <>
      <path d="M9 4H8a2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2 2 2 0 0 1 2 2V18a2 2 0 0 0 2 2h1" />
      <path d="M15 4h1a2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2 2 2 0 0 0-2 2V18a2 2 0 0 1-2 2h-1" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M8.5 12.5h7M8.5 16h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
      <path d="M10 12.5h4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  'folder-open': (
    <>
      <path d="M3 8V6.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6l1 1h7a2 2 0 0 1 2 2V10" />
      <path d="M3.4 10h17.9a1 1 0 0 1 .96 1.28l-2 7A1.5 1.5 0 0 1 18.8 19.5H5.3a1.5 1.5 0 0 1-1.45-1.1l-1.9-7A1 1 0 0 1 3.4 10Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M9.9 5.9A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.4 7.3A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8" />
      <path d="m4 4 16 16" />
      <path d="M10.2 10.4a2.6 2.6 0 0 0 3.5 3.6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="6.5" cy="6" r="2.5" />
      <path d="M8.6 7.4 19 18M19 6 8.6 16.6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M9 5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1Z" />
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
