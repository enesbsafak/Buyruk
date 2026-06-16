import {
  dialog,
  shell,
  clipboard,
  type BrowserWindow,
  type IpcMain,
  type OpenDialogOptions
} from 'electron'
import fs from 'node:fs/promises'
import { watch as fsWatch, type FSWatcher } from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import { IPC } from './ipcChannels'
import type { GitChange, GitCommit, GitOverview, GitRemoteActivity } from '../src/types'

function execGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err ? '' : stdout)
    )
  })
}

// Like execGit but rejects with git's stderr so write actions (commit/push/…)
// can surface a real error message to the user instead of failing silently.
function execGitStrict(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const message = String(stderr || stdout || err.message).trim()
          reject(new Error(message || 'git komutu başarısız oldu'))
        } else {
          resolve(stdout.toString())
        }
      }
    )
  })
}

async function repoRootOf(root: string): Promise<string | null> {
  const top = (await execGit(['rev-parse', '--show-toplevel'], root)).trim()
  return top ? path.normalize(top) : null
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

export interface GitCloneOptions {
  url: string
  parentDir: string
  folderName?: string
}

// Accept full URLs (https/ssh/git) as-is and expand "owner/repo" shorthand to a
// GitHub HTTPS URL, mirroring how VS Code's "Clone Repository" handles input.
function normalizeRepoUrl(input: string): string {
  const url = input.trim()
  if (!url) return ''
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(url) || url.includes('@')) return url
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}.git`
  return url
}

// Derive a clean target folder name from a repo URL (strip trailing slash + .git).
function deriveRepoName(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/i, '')
  const last = cleaned.split(/[\\/:]/).filter(Boolean).pop() ?? 'repo'
  return last.replace(/[^A-Za-z0-9._-]/g, '') || 'repo'
}

const MAX_TEXT_SIZE = 5 * 1024 * 1024 // 5 MB
const BINARY_SNIFF_BYTES = 8000
const GIT_RENAME_ARROW = /^.* -> (.*)$/
const FIELD_SEP = '\x1f'

function toGitPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

function relativeGitPath(repoRoot: string, filePath: string): string | null {
  const relativePath = path.relative(repoRoot, filePath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }
  return toGitPath(relativePath)
}

function emptyGitOverview(root: string): GitOverview {
  return {
    isRepo: false,
    root,
    branch: '',
    upstream: '',
    ahead: 0,
    behind: 0,
    stashCount: 0,
    changes: [],
    recentCommits: [],
    remoteActivity: [],
    lastUpdated: Date.now()
  }
}

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const [aheadRaw, behindRaw] = value.trim().split(/\s+/)
  return {
    ahead: parseInt(aheadRaw, 10) || 0,
    behind: parseInt(behindRaw, 10) || 0
  }
}

function parsePorcelain(root: string, porcelain: string): GitChange[] {
  const changes: GitChange[] = []
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue

    const x = line[0]
    const y = line[1]
    const status = line.slice(0, 2)
    let file = line.slice(3)
    file = GIT_RENAME_ARROW.exec(file)?.[1] ?? file
    file = file.replace(/^"|"$/g, '')

    changes.push({
      path: toGitPath(file),
      absolutePath: path.join(root, file),
      status: status.trim() || status,
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ' || status === '??',
      untracked: status === '??'
    })
  }
  return changes
}

function parseCommitLog(log: string): GitCommit[] {
  return log
    .split('\n')
    .flatMap((line) => {
      if (!line.trim()) return []
      const [hash = '', author = '', relativeDate = '', subject = '', refs = ''] = line.split(FIELD_SEP)
      return [{ hash, author, relativeDate, subject, refs }]
    })
}

function parseRemoteActivity(log: string): GitRemoteActivity[] {
  return log
    .split('\n')
    .flatMap((line) => {
      if (!line.trim()) return []
      const [name = '', hash = '', relativeDate = '', author = '', subject = ''] = line.split(FIELD_SEP)
      return [{ name, hash, relativeDate, author, subject }]
    })
}

async function getGitOverview(root: string): Promise<GitOverview> {
  const repoRoot = (await execGit(['rev-parse', '--show-toplevel'], root)).trim()
  if (!repoRoot) return emptyGitOverview(root)

  const normalizedRoot = path.normalize(repoRoot)
  const [branchRaw, upstreamRaw, porcelain, recentRaw, remoteRaw, stashRaw] =
    await Promise.all([
      execGit(['rev-parse', '--abbrev-ref', 'HEAD'], normalizedRoot),
      execGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], normalizedRoot),
      execGit(['status', '--porcelain=v1', '--untracked-files=all'], normalizedRoot),
      execGit(
        ['log', '-n', '10', '--date=relative', `--pretty=format:%h${FIELD_SEP}%an${FIELD_SEP}%ar${FIELD_SEP}%s${FIELD_SEP}%D`],
        normalizedRoot
      ),
      execGit(
        [
          'for-each-ref',
          '--sort=-committerdate',
          '--count=10',
          `--format=%(refname:short)${FIELD_SEP}%(objectname:short)${FIELD_SEP}%(committerdate:relative)${FIELD_SEP}%(authorname)${FIELD_SEP}%(subject)`,
          'refs/remotes'
        ],
        normalizedRoot
      ),
      execGit(['stash', 'list', '--format=%gd'], normalizedRoot)
    ])

  const upstream = upstreamRaw.trim()
  const aheadBehind = upstream
    ? parseAheadBehind(await execGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`], normalizedRoot))
    : { ahead: 0, behind: 0 }

  return {
    isRepo: true,
    root: normalizedRoot,
    branch: branchRaw.trim(),
    upstream,
    ...aheadBehind,
    stashCount: stashRaw.split('\n').filter(Boolean).length,
    changes: parsePorcelain(normalizedRoot, porcelain),
    recentCommits: parseCommitLog(recentRaw),
    remoteActivity: parseRemoteActivity(remoteRaw),
    lastUpdated: Date.now()
  }
}

// A NUL byte in the first chunk is a reliable, cheap "this is binary" heuristic.
function looksBinary(buffer: Buffer): boolean {
  const len = Math.min(buffer.length, BINARY_SNIFF_BYTES)
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

async function createUntrackedFileDiff(repoRoot: string, filePath: string): Promise<string> {
  const relativePath = relativeGitPath(repoRoot, filePath)
  if (!relativePath) return ''

  const buffer = await fs.readFile(filePath)
  if (buffer.length > MAX_TEXT_SIZE || looksBinary(buffer)) {
    return [
      `diff --git a/${relativePath} b/${relativePath}`,
      'new file mode 100644',
      'index 0000000..0000000',
      '--- /dev/null',
      `+++ b/${relativePath}`,
      'Binary file not shown.'
    ].join('\n')
  }

  const content = buffer.toString('utf8')
  const hasTrailingNewline = /\r?\n$/.test(content)
  const lines = content.length
    ? content.replace(/\r\n/g, '\n').split('\n').slice(0, hasTrailingNewline ? -1 : undefined)
    : []

  const header = [
    `diff --git a/${relativePath} b/${relativePath}`,
    'new file mode 100644',
    'index 0000000..0000000',
    '--- /dev/null',
    `+++ b/${relativePath}`
  ]

  if (lines.length === 0) return `${header.join('\n')}\n`

  const body = lines.map((line) => `+${line}`)
  if (!hasTrailingNewline) body.push('\\ No newline at end of file')

  return `${[...header, `@@ -0,0 +1,${lines.length} @@`, ...body].join('\n')}\n`
}

// Full patch for a single commit (`git show`): metadata header + per-file diff.
// The hash is validated as hex since it flows into a git argument.
async function getGitCommitDiff(root: string, hash: string): Promise<string> {
  const safeHash = hash.trim()
  if (!/^[0-9a-f]{4,40}$/i.test(safeHash)) return ''
  const repoRoot = (await execGit(['rev-parse', '--show-toplevel'], root)).trim()
  if (!repoRoot) return ''
  const out = await execGit(
    ['show', '--no-ext-diff', '--format=fuller', safeHash],
    path.normalize(repoRoot)
  )
  return out.trimEnd()
}

// Stage the given files (-A handles deletions/renames) and commit them. Empty
// selection or message is rejected so the UI can show a clear reason.
async function gitCommit(root: string, message: string, paths: string[]): Promise<GitOverview> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) throw new Error('Git deposu bulunamadı')
  const msg = message.trim()
  if (!msg) throw new Error('Commit mesajı boş olamaz')
  const rels = paths
    .map((p) => relativeGitPath(repoRoot, path.normalize(p)))
    .filter((p): p is string => !!p)
  if (rels.length === 0) throw new Error('Commit için en az bir dosya seç')
  await execGitStrict(['add', '-A', '--', ...rels], repoRoot)
  await execGitStrict(['commit', '-m', msg], repoRoot)
  return getGitOverview(repoRoot)
}

async function gitPush(root: string): Promise<GitOverview> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) throw new Error('Git deposu bulunamadı')
  await execGitStrict(['push'], repoRoot)
  return getGitOverview(repoRoot)
}

async function gitPull(root: string): Promise<GitOverview> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) throw new Error('Git deposu bulunamadı')
  await execGitStrict(['pull'], repoRoot)
  return getGitOverview(repoRoot)
}

async function gitBranches(root: string): Promise<{ current: string; branches: string[] }> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) return { current: '', branches: [] }
  const out = await execGit(['branch', '--format=%(refname:short)'], repoRoot)
  const branches = out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const current = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot)).trim()
  return { current, branches }
}

async function gitCheckout(root: string, name: string): Promise<GitOverview> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) throw new Error('Git deposu bulunamadı')
  await execGitStrict(['checkout', name], repoRoot)
  return getGitOverview(repoRoot)
}

async function gitCreateBranch(root: string, name: string): Promise<GitOverview> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) throw new Error('Git deposu bulunamadı')
  const branch = name.trim()
  if (!branch) throw new Error('Branch adı boş olamaz')
  await execGitStrict(['checkout', '-b', branch], repoRoot)
  return getGitOverview(repoRoot)
}

// Two sides for a side-by-side diff: original = HEAD version, modified = the file
// on disk (working tree). New files have no original; deleted files have no modified.
async function gitFileSides(
  root: string,
  filePath: string
): Promise<{ original: string; modified: string; binary: boolean }> {
  const repoRoot = await repoRootOf(root)
  if (!repoRoot) return { original: '', modified: '', binary: false }
  const rel = relativeGitPath(repoRoot, path.normalize(filePath))
  if (!rel) return { original: '', modified: '', binary: false }

  const original = await execGit(['show', `HEAD:${rel}`], repoRoot)
  let modified = ''
  let binary = false
  try {
    const buffer = await fs.readFile(filePath)
    if (buffer.length > MAX_TEXT_SIZE || looksBinary(buffer)) binary = true
    else modified = buffer.toString('utf8')
  } catch {
    // file deleted in the working tree → no modified side
  }
  return { original, modified, binary }
}

async function getGitDiff(root: string, filePath: string): Promise<string> {
  const repoRoot = (await execGit(['rev-parse', '--show-toplevel'], root)).trim()
  if (!repoRoot) return ''

  const normalizedRepoRoot = path.normalize(repoRoot)
  const relativePath = relativeGitPath(normalizedRepoRoot, path.normalize(filePath))
  if (!relativePath) return ''

  const [staged, unstaged] = await Promise.all([
    execGit(['diff', '--cached', '--no-ext-diff', '--', relativePath], normalizedRepoRoot),
    execGit(['diff', '--no-ext-diff', '--', relativePath], normalizedRepoRoot)
  ])

  if (staged && unstaged) {
    return [`# Staged changes`, staged.trimEnd(), `# Working tree changes`, unstaged.trimEnd()].join(
      '\n\n'
    )
  }
  if (staged || unstaged) return staged || unstaged

  const tracked = (await execGit(['ls-files', '--error-unmatch', '--', relativePath], normalizedRepoRoot)).trim()
  if (tracked) return ''

  try {
    return await createUntrackedFileDiff(normalizedRepoRoot, filePath)
  } catch {
    return ''
  }
}

export function registerFileSystemHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(IPC.SELECT_FOLDER, async (_e, defaultPath?: string) => {
    const win = getWindow()
    const opts: OpenDialogOptions = {
      title: 'Klasör seç',
      properties: ['openDirectory', 'createDirectory']
    }
    if (defaultPath) opts.defaultPath = defaultPath
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Pick a parent directory; the renderer then asks for a name and calls createFolder.
  ipcMain.handle(IPC.CREATE_FOLDER_DIALOG, async (_e, defaultPath?: string) => {
    const win = getWindow()
    const opts: OpenDialogOptions = {
      title: 'Yeni klasör için konum seç',
      properties: ['openDirectory', 'createDirectory']
    }
    if (defaultPath) opts.defaultPath = defaultPath
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.READ_DIR, async (_e, dirPath: string): Promise<FileNode[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
  })

  ipcMain.handle(
    IPC.READ_FILE,
    async (_e, filePath: string): Promise<{ content: string; isBinary: boolean }> => {
      const buffer = await fs.readFile(filePath)
      if (buffer.length > MAX_TEXT_SIZE || looksBinary(buffer)) {
        return { content: '', isBinary: true }
      }
      return { content: buffer.toString('utf8'), isBinary: false }
    }
  )

  ipcMain.handle(IPC.READ_FILE_BASE64, async (_e, filePath: string): Promise<string> => {
    const mimeByExt: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.avif': 'image/avif'
    }
    const mime = mimeByExt[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    const buffer = await fs.readFile(filePath)
    return `data:${mime};base64,${buffer.toString('base64')}`
  })

  ipcMain.handle(IPC.WRITE_FILE, async (_e, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf8')
  })

  ipcMain.handle(IPC.CREATE_FILE, async (_e, filePath: string) => {
    // 'wx' fails if the file already exists, so we never clobber existing data.
    await fs.writeFile(filePath, '', { flag: 'wx' })
  })

  ipcMain.handle(IPC.CREATE_FOLDER, async (_e, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true })
  })

  ipcMain.handle(IPC.DELETE_PATH, async (_e, targetPath: string) => {
    await fs.rm(targetPath, { recursive: true, force: true })
  })

  ipcMain.handle(IPC.RENAME_PATH, async (_e, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
  })

  // ---- Watch the active workspace and notify the renderer on changes ----
  let watcher: FSWatcher | null = null
  let watchTimer: NodeJS.Timeout | null = null
  ipcMain.handle(IPC.WATCH_DIR, (_e, dirPath: string | null) => {
    if (watcher) {
      try {
        watcher.close()
      } catch {
        // ignore
      }
      watcher = null
    }
    if (!dirPath) return
    try {
      watcher = fsWatch(dirPath, { recursive: true }, (_event, filename) => {
        const name = String(filename ?? '')
        // Ignore churn from heavy/irrelevant folders.
        if (/(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(name)) return
        if (watchTimer) clearTimeout(watchTimer)
        watchTimer = setTimeout(() => {
          const win = getWindow()
          if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send(IPC.FS_CHANGED)
          }
        }, 300)
      })
    } catch {
      // directory may not exist / be watchable
    }
  })

  ipcMain.handle(IPC.REVEAL_PATH, (_e, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })

  ipcMain.handle(IPC.COPY_TEXT, (_e, text: string) => {
    clipboard.writeText(text)
  })

  // Flat recursive file list for quick-open (skips hidden folders, capped).
  ipcMain.handle(
    IPC.LIST_FILES,
    async (_e, root: string, hidden: string[]): Promise<string[]> => {
      const hiddenSet = new Set(hidden.map((h) => h.toLowerCase()))
      const out: string[] = []
      const MAX = 8000
      const walk = async (dir: string): Promise<void> => {
        if (out.length >= MAX) return
        let entries
        try {
          entries = await fs.readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        const childDirs: string[] = []
        for (const entry of entries) {
          if (out.length >= MAX) return
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (hiddenSet.has(entry.name.toLowerCase())) continue
            childDirs.push(full)
          } else {
            out.push(full)
          }
        }
        await Promise.all(childDirs.map((childDir) => walk(childDir)))
      }
      await walk(root)
      return out
    }
  )

  // Git status for the workspace: branch + per-file status codes (abs path keys).
  ipcMain.handle(
    IPC.GIT_STATUS,
    async (
      _e,
      root: string
    ): Promise<{ isRepo: boolean; branch: string; files: Record<string, string> }> => {
      const branch = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], root)).trim()
      if (!branch) return { isRepo: false, branch: '', files: {} }
      const porcelain = await execGit(['status', '--porcelain'], root)
      const files: Record<string, string> = {}
      for (const line of porcelain.split('\n')) {
        if (!line.trim()) continue
        const code = line.slice(0, 2).trim()
        let file = line.slice(3)
        file = GIT_RENAME_ARROW.exec(file)?.[1] ?? file
        file = file.replace(/^"|"$/g, '')
        files[path.join(root, file).toLowerCase()] = code
      }
      return { isRepo: true, branch, files }
    }
  )

  ipcMain.handle(IPC.GIT_DIFF, async (_e, root: string, filePath: string): Promise<string> => {
    return getGitDiff(root, filePath)
  })

  ipcMain.handle(IPC.GIT_COMMIT_DIFF, async (_e, root: string, hash: string): Promise<string> => {
    return getGitCommitDiff(root, hash)
  })

  ipcMain.handle(
    IPC.GIT_FILE_SIDES,
    async (_e, root: string, filePath: string) => gitFileSides(root, filePath)
  )

  ipcMain.handle(
    IPC.GIT_COMMIT,
    async (_e, root: string, message: string, paths: string[]): Promise<GitOverview> =>
      gitCommit(root, message, paths)
  )

  ipcMain.handle(IPC.GIT_PUSH, async (_e, root: string): Promise<GitOverview> => gitPush(root))

  ipcMain.handle(IPC.GIT_PULL, async (_e, root: string): Promise<GitOverview> => gitPull(root))

  ipcMain.handle(
    IPC.GIT_BRANCHES,
    async (_e, root: string): Promise<{ current: string; branches: string[] }> =>
      gitBranches(root)
  )

  ipcMain.handle(
    IPC.GIT_CHECKOUT,
    async (_e, root: string, name: string): Promise<GitOverview> => gitCheckout(root, name)
  )

  ipcMain.handle(
    IPC.GIT_CREATE_BRANCH,
    async (_e, root: string, name: string): Promise<GitOverview> => gitCreateBranch(root, name)
  )

  ipcMain.handle(IPC.GIT_OVERVIEW, async (_e, root: string): Promise<GitOverview> => {
    return getGitOverview(root)
  })

  ipcMain.handle(IPC.GIT_FETCH, async (_e, root: string): Promise<GitOverview> => {
    const repoRoot = (await execGit(['rev-parse', '--show-toplevel'], root)).trim()
    if (!repoRoot) return emptyGitOverview(root)
    await execGit(['fetch', '--all', '--prune'], path.normalize(repoRoot))
    return getGitOverview(repoRoot)
  })

  // Clone a repository into parentDir. git emits progress on stderr (often with
  // carriage returns), which we stream to the renderer for a live status line.
  ipcMain.handle(
    IPC.GIT_CLONE,
    async (_e, options: GitCloneOptions): Promise<{ path: string }> => {
      const url = normalizeRepoUrl(options.url)
      if (!url) throw new Error('Geçersiz depo adresi')
      if (!options.parentDir) throw new Error('Hedef konum seçilmedi')

      const name = options.folderName?.trim() || deriveRepoName(url)
      const target = path.join(options.parentDir, name)

      // Refuse to clone into an existing, non-empty directory.
      let existing: string[] | null = null
      try {
        existing = await fs.readdir(target)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
      if (existing && existing.length > 0) {
        throw new Error(`Hedef klasör zaten dolu: ${target}`)
      }

      const win = getWindow()
      const sendProgress = (message: string): void => {
        if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send(IPC.GIT_CLONE_PROGRESS, message)
        }
      }

      return new Promise<{ path: string }>((resolve, reject) => {
        const child = spawn('git', ['clone', '--progress', url, target], {
          windowsHide: true
        })
        let stderr = ''
        child.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString()
          stderr += text
          const last = text
            .split(/[\r\n]/)
            .map((line) => line.trim())
            .filter(Boolean)
            .pop()
          if (last) sendProgress(last)
        })
        child.on('error', (err) =>
          reject(new Error(`git başlatılamadı: ${err.message}`))
        )
        child.on('close', (code) => {
          if (code === 0) resolve({ path: target })
          else reject(new Error(stderr.trim() || `git clone ${code} koduyla başarısız oldu`))
        })
      })
    }
  )
}
