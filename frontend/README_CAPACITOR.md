# Capacitor quick start for ChessApp

1. Install dependencies (in frontend):

```bash
cd frontend
npm ci
npm install @capacitor/core @capacitor/cli --save-dev
```

1. Initialize Capacitor (only once):

```bash
npx cap init "ChessApp" "com.thu.chess" --web-dir=dist
```

1. Build web assets and copy to native projects:

```bash
npm run cap:build
# or
npm run build
npx cap copy
```

1. Add platforms and open IDE:

```bash
npx cap add android
Capacitor quick start for ChessApp
```

1. Install dependencies (in frontend):

```bash
cd frontend
npm ci
npm install @capacitor/core @capacitor/cli --save-dev
```

1. Initialize Capacitor (only once):

```bash
npx cap init "ChessApp" "com.thu.chess" --web-dir=dist
```

1. Build web assets and copy to native projects:

```bash
npm run cap:build
# or
npm run build
npx cap copy
```

1. Add platforms and open IDE:

```bash
npx cap add android
npx cap open android
# macOS only
npx cap add ios
npx cap open ios
```

1. When you change web code:

```bash
npm run cap:sync
# then open platform in IDE and run
npx cap open android
```

Notes:

- Use `cordova-res` or similar to generate high-quality icons/splash images.
- Ensure API endpoints are reachable from device (use public domain or tunneling).
- For CI, run build + npx cap copy and then build native artifacts.

Generation recommendations
------------------------

- We do NOT commit the generated `frontend/android/` native directory to git. Instead run the generator script to produce the native project locally or in CI.
- From repo root you can run (Windows PowerShell):

```powershell
..\scripts\generate-android.ps1
```

Or on macOS / WSL / Linux:

```bash
./scripts/generate-android.sh
```

These scripts run `npm ci`, build the web assets, `npx cap add android` (only if missing), and sync/copy web assets into the native project.

Add `frontend/android/` to `.gitignore` to avoid committing platform files. For CI builds, add an action step that runs the shell script and then builds the AAB using Gradle.
