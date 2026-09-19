import { api } from '@/lib/api';

/**
 * Web push for the admin panel — new-order / payment-failed alerts show up
 * as a browser notification even when this tab isn't focused.
 *
 * ⚠ FIREBASE_CONFIG below is a placeholder. Get the real values from
 * Firebase Console > Project Settings > General > "Your apps" > Web app
 * (create one if there isn't one yet), and the VAPID key from
 * Project Settings > Cloud Messaging > Web Push certificates.
 * Put the same FIREBASE_CONFIG values into public/firebase-messaging-sw.js.
 */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDmEXxurPhlhYTUcbm9JF7xaNLpL4EvvT0',
  authDomain: 'onco-helth.firebaseapp.com',
  projectId: 'onco-helth',
  storageBucket: 'onco-helth.firebasestorage.app',
  messagingSenderId: '193639261820',
  appId: '1:193639261820:web:fbc3d3c8d251e025e3cbf9',
};
const VAPID_KEY = 'BGVfaU_FMb0F3NjMTfD63aljvNyqSTSnwK-upvXF0-oxaiwwNEoOwcPH8ButwMa9rjPRs46fK2eEb6-HDH3gJHY';

let currentToken = null;

/** Call once after login. Silently no-ops if Firebase isn't configured yet
 *  (REPLACE_ME left in place) or the browser/user denies permission —
 *  push is a nice-to-have, it must never block the admin from logging in. */
export async function enablePush() {
  if (FIREBASE_CONFIG.apiKey === 'REPLACE_ME') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const app = initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return null;

    currentToken = token;
    await api.post('/admin/auth/device-token', { fcm_token: token, platform: 'web' });

    // Foreground (tab open + focused) messages don't show a native banner by
    // default — show one ourselves so it behaves the same as when the tab is
    // in the background.
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (title && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    });

    return token;
  } catch (err) {
    console.error('[push] could not enable web push:', err.message);
    return null;
  }
}

/** Call on logout so this browser stops getting notifications for whoever logs in next. */
export async function disablePush() {
  if (!currentToken) return;
  try {
    await api.del('/admin/auth/device-token', { fcm_token: currentToken });
  } catch {
    /* best-effort */
  }
  currentToken = null;
}
