/* global importScripts, firebase, self, caches */
// Service worker: FCM background messages + offline app-shell cache.
// NOTE: fill in the same Firebase config as your .env (these values are public).
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'FILL_ME',
  authDomain: 'FILL_ME',
  projectId: 'FILL_ME',
  storageBucket: 'FILL_ME',
  messagingSenderId: 'FILL_ME',
  appId: 'FILL_ME',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(({ notification }) => {
  if (!notification) return;
  self.registration.showNotification(notification.title || '24asia', {
    body: notification.body || '',
    icon: '/icons/24asia_logo.png',
  });
});

// --- minimal offline shell ---
const CACHE = '24asia-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/24asia_logo.png', '/icons/24asia_logo.png', '/24asia_logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for navigation, cache-first for static assets.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }))
  );
});
