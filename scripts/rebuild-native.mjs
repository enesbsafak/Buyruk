// Rebuilds node-pty's native addon in a way that works on this Windows setup:
//   1. node-gyp 13         -> recognises Visual Studio 2026 (v18)
//   2. clears the env var  -> winpty's GetCommitHash.bat works on hardened images
//   3. SpectreMitigation=false -> no Spectre-mitigated libs component required
// node-pty is an N-API addon, so the resulting binary works under both Node and
// Electron without targeting a specific ABI.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

function main() {
  if (process.platform !== 'win32') {
    console.log('[rebuild-native] win32 değil, atlanıyor')
    return
  }

  // This env var (common on hardened Windows IoT images) stops cmd.exe from
  // finding GetCommitHash.bat in the current directory during winpty's build.
  delete process.env.NoDefaultCurrentDirectoryInExePath

  const ptyDir = path.join(process.cwd(), 'node_modules', 'node-pty')
  if (!existsSync(ptyDir)) {
    console.log('[rebuild-native] node-pty bulunamadı, atlanıyor')
    return
  }

  const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js')

  const run = (cmd, args, cwd) => {
    console.log('[rebuild-native] >', path.basename(cmd), args.join(' '))
    execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
  }

  // 1) Generate the VS solution with node-gyp 13.
  run(process.execPath, [nodeGyp, 'configure'], ptyDir)

  // 2) Locate MSBuild via vswhere.
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const vswhere = path.join(
    pf86,
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  )
  let msbuild
  try {
    msbuild = execFileSync(
      vswhere,
      [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.Component.MSBuild',
        '-find',
        'MSBuild\\**\\Bin\\MSBuild.exe'
      ],
      { encoding: 'utf8' }
    )
      .split(/\r?\n/)
      .find(Boolean)
  } catch {
    msbuild = undefined
  }
  if (!msbuild || !existsSync(msbuild)) {
    throw new Error('MSBuild bulunamadı (Visual Studio C++ Build Tools gerekli).')
  }

  // 3) Clean build (Rebuild target) so stale objects from a prior configure can't
  //    cause LNK1103. Spectre mitigation disabled (libs component not installed).
  run(
    msbuild,
    [
      path.join('build', 'binding.sln'),
      '/t:Rebuild',
      '/p:Configuration=Release',
      '/p:Platform=x64',
      '/p:SpectreMitigation=false',
      '/clp:Verbosity=minimal',
      '/nologo'
    ],
    ptyDir
  )

  console.log('[rebuild-native] node-pty derlendi ✓')
}

try {
  main()
} catch (err) {
  console.error('\n[rebuild-native] UYARI: native (node-pty) derlemesi başarısız oldu.')
  console.error('  ' + (err && err.message ? err.message : err))
  console.error('  Uygulama yine de açılır; sadece terminal açmaya çalışınca hata verir.')
  console.error('  Sorunu giderince `npm run rebuild` ile tekrar deneyin.\n')
  // Don't fail the whole `npm install`; the app still launches (node-pty is lazy).
  process.exit(0)
}
