# SlayCam

SlayCam is a Windows desktop app that triggers camera overlays from built-in gestures, recorded hand signs, body poses, and movement sequences. Recognition runs locally with MediaPipe.

## Current MVP

- Live camera preview and device selection.
- Built-in MediaPipe gestures with confidence, hold time, one-shot rearming, and optional while-held refresh.
- Live gesture lab with camera preview, hand and body skeleton overlays, countdown, and saved thumbnail.
- Custom hand signs and body poses from multiple landmark samples.
- Three-second body movement sequences with temporal matching and motion-energy filtering.
- PNG, JPG, JPEG, animated GIF, WebP, WebM, MP4, and MOV import with live previews in every media picker.
- Tracked face, head and hand anchors plus fixed center, edge and corner positions.
- Position, size, opacity, rotation, reflection, timing, animation, and layer controls with live animation samples.
- Guided effect composer with visual built-in/custom trigger previews, trigger/media summary, and duplicate-pair protection.
- Bundled starter pack of 14 animated GIF memes, removable like regular media.
- Autosaved media library, rules, gestures, and settings.
- Separate `SlayCam Output` window for OBS Window Capture.
- Russian assisted NSIS installer with SlayCam artwork, Start menu entry, and desktop shortcut.

## Development

```bash
npm install
npm run dev
```

Typecheck, tests, and renderer build:

```bash
npm run typecheck
npm test
npm run build
```

Build the Windows x64 installer from macOS or Windows:

```bash
npm run build:win
```

The installer is written to `release/SlayCam-Setup-0.1.0.exe`.

## Discord, Meet, and Zoom

1. Open the camera and click **Открыть вывод**.
2. In OBS, add **Window Capture** and select **SlayCam Output**.
3. Start **OBS Virtual Camera**.
4. Select **OBS Virtual Camera** in Discord, Google Meet, or Zoom.

The current MVP uses OBS as the signed system camera bridge. A standalone Windows virtual-camera driver is intentionally not bundled yet because it requires a separately signed native Media Foundation component.

## Privacy

Camera frames, hand landmarks, and body landmarks stay on the computer. Imported media and configuration are copied to Electron's per-user application-data directory. SlayCam does not include telemetry.
