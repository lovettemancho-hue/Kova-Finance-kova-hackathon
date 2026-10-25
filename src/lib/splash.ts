import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

// Android launch screen (KOVA-096). The native splash (Kova's K on black) stays up while the web app
// starts, and is hidden as soon as the first real screen is ready. capacitor.config.ts also auto-hides
// it after 3 s, so a slow start or an error can never leave the user stuck on the splash.

let hidden = false;

export async function hideSplash(): Promise<void> {
  if (hidden || !Capacitor.isNativePlatform()) return;
  hidden = true;
  try {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    // Already hidden by the auto-hide timer.
  }
}
