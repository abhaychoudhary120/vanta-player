# VANTA

A premium local media player for Windows, built with Tauri and React. VANTA pairs native desktop
integration with a cinematic glass interface and a focused, local-first playback experience.

## Highlights

- Local video, audio, and image playback through the Windows WebView2 engine
- Drag files in from Explorer or use the native file picker
- Queue with pointer drag reordering and keyboard controls
- Embedded artwork, title, artist, and album metadata for audio
- Frameless native window controls, keyboard shortcuts, and true fullscreen
- Playback speed with pitch preservation, volume, mute, seeking, and automatic queue advance
- 10-band equalizer, audio visualizers, and a hardware-acceleration text mode
- Subtitle sidecars (`.vtt`/`.srt`), image viewer, and minutes-long image slideshows
- Media Session integration for supported operating-system controls
- Session persistence for the queue, volume, playback speed, repeat mode, and preferences
- Manual update checks with signature-verified installs from GitHub Releases
- No telemetry, accounts, or cloud services

## Supported files

| Media | Extensions |
| --- | --- |
| Video | `.mp4`, `.m4v`, `.webm`, `.mov`, `.mkv`, `.avi` |
| Audio | `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, `.ogg`, `.oga`, `.opus` |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg` |

Actual codec support depends on the installed WebView2/Chromium media stack. H.264/AAC MP4 and MP3
are the safest choices. MKV and AVI playback depends on the codecs available to WebView2, so some
files may not play even though the container is accepted. DRM-protected files and uncommon
codec/container combinations are not supported.

## Requirements

- Windows 10 (1809 or newer) or Windows 11, 64-bit
- Node.js `20.19+`, `22.12+`, or newer
- Stable Rust with the MSVC toolchain
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload, including the
  MSVC v143 toolset and a Windows 10/11 SDK
- WebView2 Runtime (included with Windows 11 and most current Windows 10 installations)
- Network access on the first Tauri bundle build if NSIS needs to be downloaded

The C++ workload supplies `link.exe` and the Windows SDK. Rust's MSVC target cannot link Tauri
without them.

## Quick start

Run PowerShell from the project root:

```powershell
npm run setup
npm run app:dev
```

`npm run setup` checks Node, Rust, MSVC, and WebView2, then installs JavaScript dependencies with
`npm ci`. It does not install system packages or modify Windows settings.

## Build the installer

```powershell
npm run app:build
```

The NSIS installer is written to:

```text
src-tauri\target\release\bundle\nsis\
```

The build also produces the updater signature next to the installer:

```text
VANTA_1.0.0_x64-setup.exe
VANTA_1.0.0_x64-setup.exe.sig
```

`scripts/build.ps1` signs the updater bundle with `%USERPROFILE%\.tauri\vanta.key` by default. Set
`TAURI_SIGNING_PRIVATE_KEY` (key contents) or `TAURI_SIGNING_PRIVATE_KEY_PATH` (key file path) to
use another key, and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has a password. Back up the
private key offline and never commit it. Losing or replacing the key prevents existing installations
from trusting future updates.

The installer is not Authenticode-signed, so Windows SmartScreen may warn on first launch. The
updater signature is a separate Tauri minisign signature, not a Windows code-signing certificate.

## Updates and releases

Open **Settings → Updates → Check for updates** to query the latest GitHub release. VANTA verifies
the updater signature before installing; update checks are manual and never run in the background.
The configured endpoint is:

```text
https://github.com/abhaychoudhary120/vanta-player/releases/latest/download/latest.json
```

The release workflow in `.github/workflows/release.yml` builds Windows artifacts and publishes
`latest.json`, the NSIS installer, and its `.sig` file. To publish a release:

1. Bump the version in both `package.json` and `src-tauri/tauri.conf.json`.
2. Add the signing key as a repository secret once:

   ```powershell
   Get-Content -Raw "$HOME\.tauri\vanta.key" | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo abhaychoudhary120/vanta-player
   ```

   Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` only if the key has a non-empty password.
3. Commit, tag, and push:

   ```powershell
   git tag v1.0.1
   git push origin v1.0.1
   ```

The GitHub release must not be a draft or prerelease, otherwise `releases/latest/download/latest.json`
will not resolve. Keep the private key backed up; the public key in `src-tauri/tauri.conf.json` must
stay paired with it.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run setup` | Check prerequisites and install JavaScript dependencies |
| `npm run app:dev` | Start the Tauri desktop app with Vite hot reload |
| `npm run app:build` | Build the production app and NSIS installer |
| `npm run dev` | Start only the Vite web frontend |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run build` | Type-check and create the production web bundle |
| `npm run tauri:dev` | Direct Tauri development command |
| `npm run tauri:build` | Direct Tauri production build command |

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `Left` / `Right` | Seek backward or forward 5 seconds |
| `Up` / `Down` | Raise or lower volume by 5% |
| `F` | Enter or leave fullscreen |
| `M` | Mute or unmute |
| `Escape` | Leave fullscreen or close the speed menu |
| `ArrowUp` / `ArrowDown` on a queue grip | Move that track up or down |

Shortcuts are ignored while typing in editable fields or while a range control has focus, so native
input behavior keeps working.

## How it works

VANTA is a Tauri 2 application. The React interface runs in WebView2, while a small Rust backend
provides three commands:

- `probe_media` reads container, duration, tags, and embedded cover art with `lofty`
- `read_artwork` returns embedded artwork as a bounded data URL
- `read_subtitle` loads a same-name `.vtt` or `.srt` sidecar up to 4 MiB

Playback itself uses a persistent HTML video element. Local files are exposed to the webview through
Tauri's asset protocol. Queue, volume, speed, repeat mode, EQ settings, and other preferences persist
under the `vanta-player-v1` local storage key; transient playback state is reset on startup.

The equalizer uses a lazily created Web Audio graph (10 peaking filters plus preamp) and stays off by
default so normal playback does not route through Web Audio. Hardware acceleration is a text-rendering
mode controlled by `data-hwaccel` on the app shell, not a change to video decoding.

The queue uses a custom pointer-based reorder interaction. Tauri's native drag/drop handler is
enabled so Explorer file drops work on Windows, which also disables HTML5 drag-and-drop inside
WebView2.

## Project layout

```text
src/
  components/       Player UI, titlebar, queue, settings, image viewer, overlays
  contexts/         Playback controls context
  hooks/            Media element, Media Session, keyboard, equalizer, subtitles, updater
  lib/              Formatting, file dialogs, media and equalizer helpers
  store/            Zustand player state and persistence
  styles/           Global visual system and layout
src-tauri/
  capabilities/     Tauri permissions
  icons/            App icon source and generated platform icons
  src/              Rust metadata commands and Tauri entry point
  tauri.conf.json   Window, security, and bundle configuration
scripts/
  setup.ps1         Prerequisite checks and dependency install
  dev.ps1           Desktop development launcher
  build.ps1         Signed production and installer build
```

## Troubleshooting

### `link.exe` was not found

Install Visual Studio 2022 Build Tools with the C++ workload, then restart the terminal. If the
toolchain was installed while a shell was open, close it and retry. A clean rebuild can help:

```powershell
cargo clean --manifest-path src-tauri/Cargo.toml
npm run app:build
```

An example elevated install command:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### The app builds but a file will not play

Confirm the extension is supported and try an H.264/AAC MP4 or MP3. Codec and container support come
from WebView2. Update the WebView2 Runtime if playback is inconsistent.

### No artwork appears

Artwork is shown only when the audio file carries supported embedded cover art. VANTA does not fetch
artwork from the internet.

### Fullscreen does not toggle

Use `F` or the titlebar button. `Escape` leaves fullscreen. If the window is managed by an external
window tool, that tool may intercept the shortcut.

### Installer SmartScreen warning

The build is not code-signed. SmartScreen warnings are expected for unsigned local builds. Sign the
installer with an Authenticode certificate before distributing it.

## Privacy

VANTA opens only files selected by the user. Metadata extraction and playback happen locally. The
application contains no analytics or telemetry and makes no background network requests. When you
choose **Check for updates**, VANTA requests the latest release metadata and installer from GitHub;
declining or ignoring the update makes no further request.
