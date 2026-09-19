"use client";

import { authApi } from "@/lib/api";

/**
 * Web push for the customer website — order-update notifications show up as
 * a browser notification even when the tab isn't open (same setup as the
 * admin panel's src/lib/push.js; same Firebase project, project: onco-helth).
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDmEXxurPhlhYTUcbm9JF7xaNLpL4EvvT0",
  authDomain: "onco-helth.firebaseapp.com",
  projectId: "onco-helth",
  storageBucket: "onco-helth.firebasestorage.app",
  messagingSenderId: "193639261820",
  appId: "1:193639261820:web:fbc3d3c8d251e025e3cbf9",
};
const VAPID_KEY = "BGVfaU_FMb0F3NjMTfD63aljvNyqSTSnwK-upvXF0-oxaiwwNEoOwcPH8ButwMa9rjPRs46fK2eEb6-HDH3gJHY";

let currentToken: string | null = null;

/** Call once after login (and on page load if already logged in). Silently
 *  no-ops if the browser doesn't support push or the user denies permission
 *  — push is a nice-to-have, it must never block anything else on the site. */
export async function enablePush(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  try {
    const { initializeApp } = await import("firebase/app");
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const app = initializeApp(FIREBASE_CONFIG);
    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return null;

    currentToken = token;
    await authApi.registerDevice(token);

    // Foreground (tab open + focused) messages don't show a native banner by
    // default — show one ourselves so it behaves the same as when the tab is
    // in the background.
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (title && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.jpg" });
      }
    });

    return token;
  } catch (err) {
    console.error("[push] could not enable web push:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Call on logout so this browser stops getting notifications for whoever logs in next. */
export async function disablePush(): Promise<void> {
  if (!currentToken) return;
  try {
    await authApi.unregisterDevice(currentToken);
  } catch {
    /* best-effort */
  }
  currentToken = null;
}
