// Service Worker - Main entry point for the application
// This worker handles caching, offline support, and Firebase messaging

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBYR57l9-Fkk8ECAIIfsgT7gaV6fChWvJs",
  authDomain: "otms-tidal.firebaseapp.com",
  projectId: "otms-tidal",
  storageBucket: "otms-tidal.firebasestorage.app",
  messagingSenderId: "394510332934",
  appId: "1:394510332934:web:f478a08f2e687e06fbff87",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'OT Management System';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: payload.notification?.badge || '/badge-72x72.png',
    tag: payload.data?.tag || 'notification',
    data: payload.data || {},
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Close',
      },
    ],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const targetUrl = event.notification.data?.targetUrl || '/';

  if (event.action === 'close') {
    return;
  }

  // Try to find an existing window with the target URL
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open with this app
      for (const client of clientList) {
        if (client.url === new URL(targetUrl, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }

      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event);
});

// Periodic sync for badge updates (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    // Could sync with backend to update badges, etc.
    console.log('[Service Worker] Syncing notifications...');
  }
});
