/* eslint-disable no-undef */
// Background push for the customer website (tab closed / not focused).
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
  self.registration.showNotification(title || 'Onco Health Mart', {
    body: body || '',
    icon: '/favicon.jpg',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.order_id ? `/account/orders` : '/';
  event.waitUntil(clients.openWindow(url));
});
