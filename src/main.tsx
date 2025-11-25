import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

/**
 * Attach beforeinstallprompt listener BEFORE rendering the app
 * This is critical - the event fires very early, and we must be listening
 * before React components mount, or we'll miss it
 */
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  console.log('[Main] beforeinstallprompt event captured at app startup');
  (window as any).__pwaPromptEvent = e;
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker using Vite PWA plugin
// This handles both dev and production modes correctly
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[PWA] New version available, refreshing...');
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
  onRegistered(registration) {
    console.log('[PWA] Service worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});

// Listen for navigation messages from service worker (fallback for browsers without client.navigate())
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NAVIGATE_TO') {
      const targetUrl = event.data.url;
      console.log('[App] Received navigation message from SW:', targetUrl);

      // Use React Router's navigation by updating window.location
      // This ensures proper routing in PWA context
      if (targetUrl && typeof targetUrl === 'string') {
        window.location.href = targetUrl;
      }
    }
  });
}
