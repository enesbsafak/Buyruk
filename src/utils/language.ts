// Map a file name to a Monaco language id and a simple display icon.

const LANGUAGE_BY_EXT: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  markdown: 'markdown',
  diff: 'diff',
  patch: 'diff',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  h: 'cpp',
  c: 'c',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  bat: 'bat',
  ps1: 'powershell',
  sql: 'sql',
  php: 'php',
  rb: 'ruby'
}

function extOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase()
}

export function getLanguage(fileName: string): string {
  return LANGUAGE_BY_EXT[extOf(fileName)] ?? 'plaintext'
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif'])

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXT.has(extOf(fileName))
}
