Capacitor quick start for ChessApp

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
