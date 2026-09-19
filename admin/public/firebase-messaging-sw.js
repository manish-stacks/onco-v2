/* eslint-disable no-undef */
// Background push for the admin panel (tab closed / not focused).
// ⚠ Keep this FIREBASE_CONFIG in sync with src/lib/push.js — same project,
// same values from Firebase Console > Project Settings > General.
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDmEXxurPhlhYTUcbm9JF7xaNLpL4EvvT0',
  authDomain: 'onco-helth.firebaseapp.com',
  projectId: 'onco-helth',
  storageBucket: 'onco-helth.firebasestorage.app',
  messagingSenderId: '193639261820',
  appId: '1:193639261820:web:fbc3d3c8d251e025e3cbf9',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'OncoHealthMart Admin', {
    body: body || '',
    icon: '/favicon.ico',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
