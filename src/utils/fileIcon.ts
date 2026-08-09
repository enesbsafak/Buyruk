import type { IconName } from '../components/Icon'

export interface FileIconSpec {
  icon: IconName
  /** Maps to a `.tone-*` colour class so file types are scannable at a glance. */
  tone: string
}

const BY_EXTENSION: Record<string, FileIconSpec> = {
  ts: { icon: 'code', tone: 'ts' },
  tsx: { icon: 'code', tone: 'ts' },
  mts: { icon: 'code', tone: 'ts' },
  cts: { icon: 'code', tone: 'ts' },
  js: { icon: 'code', tone: 'js' },
  jsx: { icon: 'code', tone: 'js' },
  mjs: { icon: 'code', tone: 'js' },
  cjs: { icon: 'code', tone: 'js' },
  py: { icon: 'code', tone: 'py' },
  rs: { icon: 'code', tone: 'rust' },
  go: { icon: 'code', tone: 'go' },
  java: { icon: 'code', tone: 'java' },
  cs: { icon: 'code', tone: 'cs' },
  php: { icon: 'code', tone: 'php' },
  rb: { icon: 'code', tone: 'ruby' },
  sh: { icon: 'terminal', tone: 'shell' },
  ps1: { icon: 'terminal', tone: 'shell' },
  bat: { icon: 'terminal', tone: 'shell' },
  cmd: { icon: 'terminal', tone: 'shell' },

  html: { icon: 'code', tone: 'html' },
  htm: { icon: 'code', tone: 'html' },
  vue: { icon: 'code', tone: 'vue' },
  svelte: { icon: 'code', tone: 'svelte' },
  css: { icon: 'code', tone: 'css' },
  scss: { icon: 'code', tone: 'css' },
  sass: { icon: 'code', tone: 'css' },
  less: { icon: 'code', tone: 'css' },

  json: { icon: 'braces', tone: 'data' },
  jsonc: { icon: 'braces', tone: 'data' },
  yaml: { icon: 'braces', tone: 'data' },
  yml: { icon: 'braces', tone: 'data' },
  toml: { icon: 'braces', tone: 'data' },
  xml: { icon: 'braces', tone: 'data' },
  csv: { icon: 'braces', tone: 'data' },
  sql: { icon: 'braces', tone: 'data' },

  md: { icon: 'file-text', tone: 'doc' },
  mdx: { icon: 'file-text', tone: 'doc' },
  txt: { icon: 'file-text', tone: 'doc' },
  pdf: { icon: 'file-text', tone: 'doc' },
  log: { icon: 'file-text', tone: 'muted' },

  png: { icon: 'image', tone: 'media' },
  jpg: { icon: 'image', tone: 'media' },
  jpeg: { icon: 'image', tone: 'media' },
  gif: { icon: 'image', tone: 'media' },
  webp: { icon: 'image', tone: 'media' },
  avif: { icon: 'image', tone: 'media' },
  bmp: { icon: 'image', tone: 'media' },
  ico: { icon: 'image', tone: 'media' },
  svg: { icon: 'image', tone: 'media' },

  zip: { icon: 'archive', tone: 'archive' },
  rar: { icon: 'archive', tone: 'archive' },
  '7z': { icon: 'archive', tone: 'archive' },
  gz: { icon: 'archive', tone: 'archive' },
  tar: { icon: 'archive', tone: 'archive' },

  exe: { icon: 'settings', tone: 'muted' },
  dll: { icon: 'settings', tone: 'muted' },
  lock: { icon: 'lock', tone: 'muted' },
  diff: { icon: 'git-diff', tone: 'git' },
  patch: { icon: 'git-diff', tone: 'git' }
}

// Whole-name matches win over the extension table (dotfiles have no extension).
const BY_NAME: Record<string, FileIconSpec> = {
  'package.json': { icon: 'braces', tone: 'npm' },
  'package-lock.json': { icon: 'lock', tone: 'muted' },
  'tsconfig.json': { icon: 'braces', tone: 'ts' },
  dockerfile: { icon: 'settings', tone: 'docker' },
  'docker-compose.yml': { icon: 'settings', tone: 'docker' },
  '.gitignore': { icon: 'git-diff', tone: 'git' },
  '.gitattributes': { icon: 'git-diff', tone: 'git' },
  '.env': { icon: 'lock', tone: 'env' },
  'readme.md': { icon: 'file-text', tone: 'doc' },
  'license': { icon: 'file-text', tone: 'muted' }
}

const DEFAULT_SPEC: FileIconSpec = { icon: 'file', tone: 'muted' }

export function fileIcon(name: string): FileIconSpec {
  const lower = name.toLowerCase()
  const byName = BY_NAME[lower]
  if (byName) return byName

  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return lower.startsWith('.') ? { icon: 'settings', tone: 'muted' } : DEFAULT_SPEC

  return BY_EXTENSION[lower.slice(dot + 1)] ?? DEFAULT_SPEC
}
