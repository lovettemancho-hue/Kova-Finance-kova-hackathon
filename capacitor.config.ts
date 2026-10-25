import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kovafinance.app',
  appName: 'Kova',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Android system bars (KOVA-095). Without viewport-fit=cover in index.html, Capacitor keeps the
    // WebView between the status bar and the navigation bar, so no screen draws under them.
    // DARK = light status-bar icons, for Kova's black background.
    SystemBars: {
      insetsHandling: 'native',
      style: 'DARK',
    },
    // Launch screen (KOVA-096): Kova's K on black while the app starts. The app hides it as soon as
    // the first screen is ready (src/lib/splash.ts); the 3 s auto-hide is only a safety net.
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
