# KijesticCam

A local screen recorder for Windows. Record a display, a window, or several sources at once, with system audio and microphone, and get an MP4 or MKV on your own disk. Nothing is uploaded anywhere.

Built with Electron, TypeScript and React. Encoding uses FFmpeg (bundled).

## What it does

- Records full displays or individual windows, one file per source or one composite file (side-by-side, stacked, grid, picture-in-picture)
- System audio and microphone, each with its own toggle and gain
- Up to 3840x2160 capture
- Picks a hardware encoder when one works (NVIDIA NVENC, Intel Quick Sync, AMD AMF), otherwise software
- H.264, H.265 and AV1, with three quality presets: Efficient, Balanced, Quality
- Global hotkeys: `Ctrl+Shift+R` start/stop, `Ctrl+Shift+P` pause/resume (configurable)
- Countdown before recording, system tray, recording history
- Output goes to `%USERPROFILE%\Videos\KijesticCam\` by default

## Install (Windows 10/11, 64-bit)

Download `KijesticCam-Setup-<version>.exe` from the [Releases](../../releases) page and run it. Check the file against `SHA256SUMS.txt` from the same release if you want to confirm the download.

### SmartScreen warning

The installer is **not code-signed**, so Windows SmartScreen will show "Windows protected your PC" with the publisher listed as unknown. That is expected for an unsigned open-source build. To continue, click **More info**, then **Run anyway**. If you would rather not run an unsigned installer, build it yourself from source (below) and compare.

## Build from source

Requires Node.js 18 or newer (the release workflow uses Node 22), Git, and Windows for packaging.

```bash
git clone https://github.com/kelvinDtran/KijesticCam.git
cd KijesticCam
npm ci
npm run dev        # run the app in development mode
```

```bash
npm run typecheck  # TypeScript check
npm test           # unit tests
npm run build      # build to out/
npm run package    # build + Windows NSIS installer in dist/
```

`npm run package` uses `electron-builder.yml`. On Windows, electron-builder needs permission to create symbolic links when it unpacks its signing tools: enable Developer Mode or run the terminal as administrator, otherwise packaging fails with "Cannot create symbolic link".

## Releases

Pushing a tag such as `v1.0.0` runs `.github/workflows/release.yml` on a Windows runner. It type-checks, runs the tests, checks the tag matches the `version` in `package.json`, builds the unsigned installer, and attaches it with a SHA-256 checksum file to a **draft** GitHub Release for review. Running the workflow by hand produces the installer as a downloadable workflow artifact only.

## Project layout

```
src/main/       Electron main process: recording, FFmpeg encoding, settings, tray, hotkeys
src/preload/    contextBridge whitelist of IPC calls
src/renderer/   React UI
src/shared/     Shared types and IPC channel names
resources/      Tray icon
```

Settings, history and logs are stored under `%APPDATA%\kijjestic-cam\`.

## Known limitations

- Windows only. A macOS adapter is not implemented.
- System audio is a system-wide loopback. Per-window audio isolation is not possible with the capture API, so window captures may not include other apps' audio. Record a display source, or use a virtual audio device.
- `av1_nvenc` needs an RTX 4000 series or newer GPU and `av1_amf` an RX 7000 series or newer. Otherwise AV1 falls back to software encoding, which is much slower.
- Browser tabs can only be captured as windows.
- No custom installer or app icon yet: the installer uses the default Electron icon.

## License

[MIT](LICENSE)
