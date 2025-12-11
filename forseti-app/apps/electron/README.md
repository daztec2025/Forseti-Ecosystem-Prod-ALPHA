# Forseti Electron Desktop App

Desktop application wrapper for Forseti using Electron.

## Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Make sure the Next.js web app is running:**
   ```bash
   cd ../web
   npm run dev
   ```

3. **Start Electron app:**
   ```bash
   npm run dev
   ```

## Building

### Windows
```bash
npm run build:win
```

### macOS
```bash
npm run build:mac
```

### Linux
```bash
npm run build:linux
```

## Features

- **System Tray Integration**: App minimizes to tray instead of closing
- **Cross-platform**: Windows, macOS, Linux support
- **Auto-updates**: Built-in update mechanism (configure in main.js)
- **Native Notifications**: Desktop notifications for friend requests, comments, etc.
- **Loads Next.js App**: Points to localhost:3000 in dev, production URL in build

## Configuration

Edit `main.js` to configure:
- Window size and settings
- Production URL (line 26)
- Tray menu options
- Auto-update settings

## Assets Required

Place these files in the `assets/` directory:
- `tray-icon.png` - System tray icon (16x16 or 32x32)
- `icon.ico` - Windows icon
- `icon.icns` - macOS icon
- `icon.png` - Linux icon (512x512)
