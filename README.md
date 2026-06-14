# Buyruk

Windows için 3 panelli bir geliştirici masaüstü uygulaması: çoklu terminal (CMD / PowerShell / Claude / Codex) + dosya yöneticisi + Monaco kod editörü. Her terminal kendi klasörüne bağlıdır; aktif terminale tıklayınca sağ taraf otomatik o klasöre geçer.

## Teknoloji

Electron + React + TypeScript + Vite · [xterm.js](https://xtermjs.org/) · [node-pty](https://github.com/microsoft/node-pty) · [Monaco Editor](https://microsoft.github.io/monaco-editor/)

Güvenlik: `contextIsolation: true`, `nodeIntegration: false`. Tüm Node/dosya/terminal işlemleri main process'te yapılır, `preload.ts` üzerinden `window.api` ile güvenli expose edilir.

## Özellikler

**Pencere & oturum**
- Özel (frameless) başlık çubuğu + kendi pencere butonları (küçült/büyüt/kapat); sürüklenebilir toolbar.
- Pencere boyutu/konumu/maximize durumu kalıcı.
- Açık terminaller (tip + klasör) kapanışta kaydedilir, açılışta geri yüklenir.
- Son klasörler menüsü (toolbar'daki "Son") ile tek tıkla yeni oturum.

**Terminal**
- Çoklu terminal **otomatik ızgara döşeme** (1 → tam, 2 → yan yana, 4 → 2×2 …).
- Her terminalde: arama (Ctrl+F), temizle, **yeniden başlat** (kapanınca yerinde diril), **zoom**.
- **Broadcast** modu: giriş tüm terminallere gider.
- Alttaki **prompt kutusu** ile aktif terminale (Claude/Codex) hızlı metin gönderme.
- Nerd Font desteği (varsayılan `JetBrainsMono NF`) — CLI glyph'leri görünür.

**Dosya yöneticisi**
- Lazy-load ağaç, otomatik yenileme (`fs.watch`), git durumu rozetleri (M/A/U/D) + dal adı.
- Sağ tık menüsü: burada terminal aç, Explorer'da göster, yol kopyala, yeni/yeniden adlandır/sil.
- `Ctrl+P` ile fuzzy hızlı dosya açma.

**Editör**
- Monaco; uzantıya göre dil, Bul/Değiştir (Ctrl+F/H), biçimlendir, **diff** (kayıtlı sürümle karşılaştır), resim önizleme.
- Sekmeli; `Ctrl+S` veya buton ile kaydet; kaydedilmemiş değişiklik noktayla gösterilir.

**Genel**
- Komut paleti (`Ctrl+Shift+P`), tema (koyu/açık), iş bitince (bell) bildirimi.
- GitHub Releases üzerinden otomatik güncelleme; paketli sürüm açılışta kontrol eder, durum status bar'da görünür.

### Klavye kısayolları

| Kısayol | İşlev |
| --- | --- |
| `Ctrl+Shift+P` | Komut paleti |
| `Ctrl+P` | Hızlı dosya aç |
| `Ctrl+S` | Kaydet |
| `Ctrl+F` | Terminalde / editörde ara |
| `Ctrl+1…9` | N. terminale geç |
| `Ctrl+,` | Ayarlar |

## Kurulum

> **Önkoşul:** Node.js 18+ ve `node-pty` native derlemesi için **Visual Studio C++ Build Tools (2022 veya 2026) + Python 3** ("Desktop development with C++" iş yükü).

```powershell
cd multi-cli-workspace
npm install
```

`postinstall`, `scripts/rebuild-native.mjs` ile `node-pty`'yi derler. Bu betik bu ortama özgü üç sorunu otomatik çözer: **node-gyp 13** (VS 2026 desteği), `NoDefaultCurrentDirectoryInExePath` temizliği (winpty), `SpectreMitigation=false`. Derleme başarısız olsa bile uygulama açılır; sadece terminal açınca uyarı verir — `npm run rebuild` ile tekrar denenebilir.

## Çalıştırma / Build

```powershell
npm run dev        # Vite + Electron (geliştirme)
npm run build      # production build (dist/, dist-electron/)
npm run start      # build edilmiş uygulamayı çalıştır
npm run dist       # Windows installer (electron-builder)
npm run release:win # Windows installer + GitHub Release publish
```

## Release ve otomatik güncelleme

Buyruk, Windows için `electron-builder` + `electron-updater` kullanır. Release workflow'u `v*.*.*` tag push edildiğinde çalışır, installer dosyasını ve auto-update metadata dosyalarını (`latest.yml` dahil) GitHub Release asset'lerine yükler.

İlk kurulum:

1. GitHub'da public repo oluştur: varsayılan config `enesbsafak/Buyruk` için hazırdır.
2. Repo farklıysa `package.json` içindeki `homepage`, `repository`, `bugs` ve `build.publish.owner/repo` alanlarını değiştir.
3. Değişiklikleri push et.
4. Sürümü artır:

```powershell
npm version patch
git push --follow-tags
```

Tag push sonrası `.github/workflows/release.yml` Windows installer'ı yayınlar. Paketli uygulama yeni sürümü GitHub Releases üzerinden otomatik bulur; indirme tamamlanınca status bar'daki **Yeniden başlat** düğmesi kurulumu başlatır.

Notlar:

- Public GitHub Releases için `GH_TOKEN` workflow içinde otomatik sağlanır.
- Windows kod imzalama henüz zorunlu değil, fakat public dağıtımda SmartScreen uyarılarını azaltmak için sonraki adım olarak sertifika eklenmelidir.
- Auto-update geliştirme modunda çalışmaz; sadece paketlenmiş/kurulmuş sürümde kontrol eder.

## Ayarlar

CMD / PowerShell / Claude / Codex komutları, terminal fontu (Nerd Font önerilir), tema ve gizlenecek klasörler değiştirilebilir. Claude/Codex komutu tam yol da olabilir; bunlar `cmd.exe /k <komut>` içinde başlatılır. Ayarlar `localStorage` içinde saklanır.

## Proje yapısı

```
multi-cli-workspace/
  .github/   release workflow
  electron/   main, preload, terminalManager, fileSystem, claudeUsage, windowState, ipcChannels
  scripts/    rebuild-native.mjs
  src/
    components/  Toolbar, TerminalArea, TerminalPane, FileExplorer, CodeEditor, SettingsModal,
                 StatusBar, SplitLayout, DialogProvider, Icon, ContextMenu, QuickOpen, CommandPalette
    hooks/       useSessions, useFileTree, useSettings
    utils/       language, pathUtils, persistence
    App.tsx, main.tsx, types.ts, terminalBus.ts, monaco.ts, styles.css
```

## Bilinen sınırlamalar

- **Klasör Aç** aktif oturumun gösterilen workspace kökünü değiştirir; çalışan terminalin gerçek dizini değişmez.
- Çok sayıda terminalde her döşeme küçülür; terminaller her temada koyu kalır.
- 5 MB üstü veya NUL bayt içeren dosyalar metin olarak açılamaz.
- Yalnızca Windows hedeflenmiştir.
