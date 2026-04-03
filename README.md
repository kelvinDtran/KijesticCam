# KijesticCam

A production-grade local screen recording desktop application for Windows, built with Electron + TypeScript + React.

## Features

- **Multi-source recording** — record full displays, individual monitors, or specific application windows
- **Simultaneous multi-source** — record multiple screens/windows at once (separate files per source)
- **System audio + microphone** — independent toggles and gain sliders for each
- **4K support** — up to 3840×2160 capture
- **Hardware-accelerated encoding** — NVENC (NVIDIA), Quick Sync (Intel), AMF (AMD) with automatic detection
- **Smart codec selection** — H.264, H.265/HEVC, AV1 with CRF/CQ quality presets
- **Three quality presets** — Efficient (smallest files), Balanced (recommended), Quality (near-lossless)
- **Global hotkeys** — start/stop and pause/resume without focusing the window
- **System tray** — minimize to tray, quick controls
- **Recording history** — file name, duration, resolution, size, codec; open/delete from app
- **Countdown timer** — configurable delay before recording starts
- **Crash-safe** — files written to disk in real-time as chunks; emergency abort on quit

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Electron 35 | Cross-platform, stable, desktopCapturer API |
| Build tool | electron-vite 3 | Fast Vite-based build for main/preload/renderer |
| UI framework | React 18 + TypeScript 5 | Component model, type safety |
| Styling | Tailwind CSS 4 | Utility-first, zero runtime |
| State | Zustand 5 | Minimal, fast, no boilerplate |
| Encoding | FFmpeg via fluent-ffmpeg | Industry standard, hardware encoder support |
| Capture | Electron desktopCapturer + MediaRecorder | Reliable, works without drivers |
| Settings | electron-store | Atomic JSON persistence |
| Logging | Winston | Structured logs to `%APPDATA%/KijesticCam/logs/` |
| Packaging | electron-builder | NSIS installer for Windows |

## Architecture

```
src/
├── shared/
│   └── types.ts              # All shared types + IPC channel constants
├── main/                     # Electron main process
│   ├── index.ts              # App entry, window creation
│   ├── logger.ts             # Winston logger
│   ├── tray.ts               # System tray icon
│   ├── hotkeys.ts            # Global shortcut registration
│   ├── ipc/                  # IPC handler registration
│   │   ├── index.ts
│   │   ├── recording.ts      # Start/stop/pause/chunk/finalize handlers
│   │   ├── sources.ts        # Screen/window enumeration
│   │   ├── settings.ts       # Settings + hardware detection
│   │   └── files.ts          # History, open, delete
│   ├── capture/              # Platform capture abstraction (macOS adapter stub-ready)
│   ├── recording/
│   │   ├── RecordingSession.ts      # Manages one source: write chunks → finalize
│   │   └── RecordingCoordinator.ts  # Orchestrates N sessions simultaneously
│   ├── encoding/
│   │   ├── presets.ts        # Full encoder matrix (H.264/H.265/AV1 × SW/NVENC/QSV/AMF × 3 presets)
│   │   ├── HardwareDetector.ts  # Test-encodes to confirm hw encoder availability
│   │   ├── FFmpegPipeline.ts    # fluent-ffmpeg wrapper with progress + fallback
│   │   └── EncoderService.ts    # Singleton: FFmpeg path, hw detection, preset selection
│   ├── settings/
│   │   └── SettingsService.ts   # electron-store wrapper
│   └── storage/
│       ├── FileManager.ts    # Path building, slug/timestamp naming, dir creation
│       └── HistoryStore.ts   # Recording history persistence (max 500 entries)
├── preload/
│   └── index.ts              # contextBridge: whitelist of all IPC calls
└── renderer/                 # React application
    ├── index.html
    └── src/
        ├── App.tsx
        ├── index.css         # Tailwind + CSS custom properties
        ├── store/
        │   └── appStore.ts   # Zustand store: sources, sessions, settings, history
        ├── hooks/
        │   ├── useRecording.ts  # MediaRecorder capture pipeline + IPC bridge
        │   ├── useSources.ts    # Source/audio device enumeration
        │   └── useSettings.ts   # Settings load/save + hardware detection
        └── components/
            ├── layout/       # Titlebar, Sidebar
            ├── recording/    # SourcePicker, AudioControls, RecordingTimer, RecordingPanel
            ├── history/      # HistoryPage
            └── settings/     # SettingsPage
```

### Recording Data Flow

```
Renderer                          Main Process
─────────                         ────────────
User clicks "Start"
  → startRecording(config)   ──►  RecordingCoordinator.start()
                                    creates N RecordingSession(s)
                              ◄──  RECORDING_SESSION_READY × N

For each session:
  getUserMedia(sourceId)           (per-session IPC channel)
  + mix audio (Web Audio API)
  MediaRecorder.start(1000ms)

  ondataavailable →  sendChunk()  ──►  session.writeChunk()
                                         → writes to .webm temp file

User clicks "Stop"
  → stopRecording()          ──►  coordinator.stop()
  MediaRecorder.stop()
  onstop → finalizeSession() ──►  session.finalize()
                                    → FFmpeg: .webm → .mp4/.mkv
                                    → HistoryStore.add()
                              ◄──  RECORDING_COMPLETE
```

### Codec Preset Design

Quality presets use CRF (software) / CQ (hardware) mode — variable bitrate targeting a perceptual quality level:

| Preset | H.264 SW CRF | H.265 SW CRF | Goal |
|--------|-------------|-------------|------|
| Efficient | 28 | 28 | ~3 Mbps · imperceptible loss for screen content |
| Balanced | 23 | 24 | ~8 Mbps · default recommendation |
| Quality | 17 | 18 | ~20 Mbps · near-lossless archival |

Screen recordings compress extremely well because large areas are static between frames. H.265 saves ~40-50% over H.264 at the same CRF. AV1 saves a further 30% over H.265.

## Setup

### Prerequisites

- **Node.js 18+** (tested on Node 22)
- **Windows 10/11** (primary target)
- **Git**

### Development

```bash
git clone https://github.com/KelvinTran6/KijesticCamSoftware.git
cd KijesticCamSoftware
npm install
npm run dev
```

This opens the app in development mode with DevTools.

### Build for Production

```bash
npm run build
```

Outputs built files to `out/`.

### Package as Windows Installer

```bash
npm run package
```

Produces a Windows NSIS installer in `dist/`. The FFmpeg binary is bundled automatically.

> **Icon**: Replace `build/icon.ico` with your 256×256 icon before packaging.
> **Tray icon**: Replace `resources/tray-icon.png` with a 16×16 PNG.

### Run Tests

```bash
npm test
```

## Known Limitations

### System Audio on Windows
- System audio capture uses Electron's `desktopCapturer` with `audio: 'loopback'` via `setDisplayMediaRequestHandler`.
- This works for full-screen captures. For window-only captures, system audio may not include other apps' audio — this is an OS-level restriction.
- **Workaround**: Record "screen" source for system audio capture, or install a virtual audio device (e.g., VoiceMeeter, Virtual Audio Cable).

### Window Capture Audio
- Per-window audio isolation is not possible via the Web Audio / desktopCapturer API. Only system-wide audio loopback is available.

### AV1 Hardware Encoding
- `av1_nvenc` requires RTX 4000+ series GPU. `av1_amf` requires RX 7000+ series. Falls back to `libsvtav1` (software) if not available — significantly slower.

### Multi-Source Composite Mode
- "Composite" mode (multiple sources in one video) is marked "coming soon" in settings. Currently all multi-source recordings produce separate files. This is intentional: separate files per source is more reliable and avoids sync drift.

### macOS Support
- The architecture is designed for it (platform adapter abstraction in `src/main/capture/`), but not yet implemented. `setDisplayMediaRequestHandler` behavior differs on macOS — screen recording permission must be granted via System Preferences.

### Browser Tabs
- Individual browser tabs can only be captured as window captures (the browser process, not individual tabs), unless the browser exposes a tab via screen share internally.

## Roadmap / TODO

- [ ] Composite multi-source mode (side-by-side or PiP layout)
- [ ] macOS platform adapter (`AVFoundation`/`ScreenCaptureKit`)
- [ ] Live preview thumbnail during recording
- [ ] Webcam overlay (picture-in-picture)
- [ ] Region/area capture (crop to selection)
- [ ] Per-application audio capture (Windows WASAPI session API)
- [ ] Custom output filename templates
- [ ] Auto-split on file size threshold
- [ ] Scheduled recordings
- [ ] Export to GIF/WebP
- [ ] Disk usage estimation before recording
- [ ] Configurable chunk interval (currently 1s)
- [ ] Proper icon set (ICO + PNG at all sizes)

## Configuration

Settings are persisted to `%APPDATA%\kijjestic-cam\kijjestic-cam-settings.json`.
Recording history is in `%APPDATA%\kijjestic-cam\kijjestic-cam-history.json`.
Logs: `%APPDATA%\kijjestic-cam\logs\kijjestic-cam.log` (5 MB rotating, 3 files).

Default recording output: `%USERPROFILE%\Videos\KijesticCam\`
