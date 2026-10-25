import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Android push notifications (KOVA-071), via Firebase Cloud Messaging.
 *
 * Each signed-in device stores its FCM token at users/{uid}/devices/{token}; the server sends the
 * monthly-letter and daily-Grow pushes to those tokens (server.ts → sendPushToUser). Web and iOS are
 * no-ops for now. Needs android/app/google-services.json (KOVA-055) or getToken() fails.
 *
 * Rules: no amounts or merchant names in any notification (they show on the lock screen), at most
 * one push a day, every type can be turned off in Settings.
 */

export const PUSH_CHANNEL_ID = 'kova_updates'; // must match server.ts and the manifest meta-data
export type PushRoute = 'letter' | 'grow' | 'chat';

const PROMPTED_KEY = 'kova_push_prompted';
let currentToken: string | null = null;
let listenersAttached = false;

export function isPushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function saveToken(uid: string, token: string): Promise<void> {
  currentToken = token;
  await setDoc(
    doc(db, 'users', uid, 'devices', token),
    { token, platform: Capacitor.getPlatform(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Registers this device for push if the user allows it.
 * @param prompt show the Android permission dialog if not decided yet. Without it, only devices
 *   that already granted permission are registered (safe to call on every app start).
 * @returns true when the device is registered.
 */
export async function registerForPush(
  uid: string,
  { prompt = false, onOpen }: { prompt?: boolean; onOpen?: (route: PushRoute) => void } = {}
): Promise<boolean> {
  if (!isPushSupported() || !uid) return false;
  try {
    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== 'granted' && prompt) {
      try {
        localStorage.setItem(PROMPTED_KEY, '1');
      } catch {
        // storage can be unavailable; the OS remembers the decision anyway
      }
      ({ receive } = await FirebaseMessaging.requestPermissions());
    }
    if (receive !== 'granted') return false;

    await FirebaseMessaging.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'Kova updates',
      description: 'Your monthly letter and daily Grow lesson',
      importance: Importance.Default,
    });

    if (!listenersAttached) {
      listenersAttached = true;
      await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
        saveToken(uid, token).catch((err) => console.error('[push] Token refresh save failed:', err?.code || err));
      });
      await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
        const route = (notification?.data as { route?: string } | undefined)?.route;
        if (onOpen && (route === 'letter' || route === 'grow' || route === 'chat')) onOpen(route);
      });
    }

    const { token } = await FirebaseMessaging.getToken();
    if (!token) return false;
    await saveToken(uid, token);
    return true;
  } catch (err: any) {
    // Most likely cause: google-services.json missing from android/app (KOVA-055).
    console.error('[push] Registration failed:', err?.code || err?.message || err);
    return false;
  }
}

/** True if we haven't shown the permission dialog from this app install yet. */
export function shouldPromptForPush(): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY) !== '1';
  } catch {
    return false;
  }
}

/** On logout: stop sending this user's notifications to this device. */
export async function unregisterPush(uid: string): Promise<void> {
  if (!isPushSupported()) return;
  const token = currentToken;
  currentToken = null;
  try {
    if (uid && token) await deleteDoc(doc(db, 'users', uid, 'devices', token));
    await FirebaseMessaging.deleteToken();
  } catch (err: any) {
    console.error('[push] Unregister failed:', err?.code || err?.message || err);
  }
}
