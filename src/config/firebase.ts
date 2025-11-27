import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

/**
 * Firebase configuration from environment variables
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Validate Firebase configuration
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId
  )
}

// Initialize Firebase only if configured
let app: ReturnType<typeof initializeApp> | null = null
let messaging: ReturnType<typeof getMessaging> | null = null

export const getFirebaseApp = () => {
  if (!isFirebaseConfigured()) {
    return null
  }

  if (!app) {
    app = initializeApp(firebaseConfig)
  }

  return app
}

export const getFirebaseMessaging = () => {
  if (!isFirebaseConfigured()) {
    return null
  }

  if (!messaging) {
    const firebaseApp = getFirebaseApp()
    if (!firebaseApp) return null
    messaging = getMessaging(firebaseApp)
  }

  return messaging
}

export default firebaseConfig
