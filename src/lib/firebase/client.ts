import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth as firebaseGetAuth } from "firebase/auth";
import { getAnalytics, logEvent as firebaseLogEvent, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID
};

let appInstance: ReturnType<typeof initializeApp> | null = null;
let dbInstance: ReturnType<typeof getFirestore> | null = null;

function ensureApp() {
  if (appInstance) return appInstance;

  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => typeof v !== 'string' || v.length === 0)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Firebase config incompleta. Faltan: ${missing.join(', ')}. Revisa tu archivo .env`
    );
  }

  appInstance = initializeApp(firebaseConfig);
  dbInstance = getFirestore(appInstance);
  
  if (typeof window !== "undefined") {
    // Enable offline persistence only on the client
    enableIndexedDbPersistence(dbInstance).catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code == 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence.');
      }
    });
  }
  
  return appInstance;
}

export function getDb() {
  if (dbInstance) return dbInstance;
  ensureApp();
  if (!dbInstance) {
    // Safety net: should never happen unless getFirestore fails.
    throw new Error('No se pudo inicializar Firestore.');
  }
  return dbInstance;
}

// Lazy-load auth only on the client to avoid initialization errors during build
let authInstance: ReturnType<typeof firebaseGetAuth> | null = null;

export const getAuth = () => {
  if (!authInstance && typeof window !== "undefined") {
    const app = ensureApp();
    authInstance = firebaseGetAuth(app);
  }
  return authInstance;
};

// For backwards compatibility: expose auth as a property that calls getAuth()
export const auth = new Proxy({}, {
  get: (target, prop) => {
    const authObj = getAuth();
    if (!authObj) {
      throw new Error("Firebase Auth is only available on the client side");
    }
    return (authObj as any)[prop];
  }
}) as any;

// Analytics - only runs on the client
export const analyticsPromise = typeof window !== "undefined" 
  ? isSupported().then(supported => {
      if (!supported) return null;
      try {
        const app = ensureApp();
        return getAnalytics(app);
      } catch (e) {
        console.error('Firebase analytics init failed:', e);
        return null;
      }
    })
  : Promise.resolve(null);

export const logEvent = async (eventName: string, eventParams?: any) => {
  if (typeof window !== "undefined") {
    try {
      const analytics = await analyticsPromise;
      if (analytics) {
        firebaseLogEvent(analytics, eventName, eventParams);
      }
    } catch (e) {
      console.error('Analytics logEvent failed:', e);
    }
  }
};
