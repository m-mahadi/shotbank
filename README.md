# ShotBank

ShotBank is a local-first Windows desktop app for collecting cinematic reference frames while watching films.

Start a movie session, press a global shortcut, and ShotBank saves the screenshot directly into that movie folder. You can add short notes, recreate-later notes, tags, and a rating for each frame.

No cloud account. No database server. No upload.

## Download and Install

1. Go to the [Releases](https://github.com/m-mahadi/shotbank/releases) page.
2. Download the latest `ShotBank Setup x.y.z.exe`.
3. Double-click it and follow the installer. No admin rights and no extra
   software (no Node.js, no runtime) are required -- everything is bundled.

### "Windows protected your PC"?

If Windows shows a blue **"Windows protected your PC"** box, that is just
SmartScreen being cautious about a new, free, open-source app -- not a virus
warning. To continue:

1. Click **More info**.
2. Click **Run anyway**.

This only happens on the first install. Signed releases (which remove this
prompt entirely) are being set up via [SignPath Foundation](https://signpath.org/);
see [RELEASING.md](RELEASING.md).

## Features

- Local screenshot capture from a global shortcut
- Per-movie sessions with title, director, year, source, and focus notes
- Large selected-shot viewer for reviewing captured frames
- Notes, recreate notes, tags, and 1-5 star ratings
- Movie folders stored as normal files on disk
- Screenshots saved directly beside `metadata.json`
- Hidden delete action that moves folders to the Recycle Bin
- Electron desktop shell with a Next.js interface

## Storage Layout

By default, ShotBank stores your library in:

```text
Pictures/ShotBank/
```

Each movie gets its own folder:

```text
Pictures/ShotBank/<Movie Title>/
  metadata.json
  shot-20260617T041713Z.png
  shot-20260617T041932Z.png
```

You can change the library folder inside the app.

## Requirements

- Windows 10 or newer
- Node.js 20 or newer for development
- npm

ShotBank is currently built and packaged for Windows. The source is portable Electron/Next.js, but macOS and Linux packaging have not been polished yet.

## Development

Install dependencies:

```bash
npm install
```

Run the Next.js browser preview:

```bash
npm run dev
```

The browser preview is useful for UI work, but it cannot capture screenshots. Use Electron for the full desktop workflow:

```bash
npm run electron
```

## Build a Windows Installer

```bash
npm run electron:dist
```

The installer is written to:

```text
dist/ShotBank Setup 0.1.0.exe
```

## Validation

```bash
npm run lint
npm run build
```

## Privacy

ShotBank is local-first. Captured screenshots and notes stay in the library folder you choose. The app does not require Supabase, Firebase, a hosted database, or a cloud account.

## Contributing

Issues and pull requests are welcome. Good first improvements include:

- Better release automation
- macOS/Linux packaging
- Keyboard shortcut presets
- Import/export helpers
- UI polish for smaller screens

Please keep the app local-first and avoid adding cloud dependencies to the core capture flow.

## License

MIT
