import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";

/** Must match firebase/functions/src/config.ts (Firestore: europe-west1). */
export const FIREBASE_FUNCTIONS_REGION =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? "europe-west1";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
    if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === "true") {
      connectEmulators(app);
    }
  }
  return app;
}

function connectEmulators(firebaseApp: FirebaseApp) {
  if (emulatorsConnected) return;
  const authHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  const firestoreHost =
    import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

  const auth = getAuth(firebaseApp);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });

  const db = getFirestore(firebaseApp);
  const [fsHost, fsPort] = firestoreHost.split(":");
  connectFirestoreEmulator(db, fsHost ?? "127.0.0.1", Number(fsPort ?? 8080));

  const functions = getFunctions(firebaseApp, FIREBASE_FUNCTIONS_REGION);
  connectFunctionsEmulator(functions, fsHost ?? "127.0.0.1", 5001);

  emulatorsConnected = true;
}

export function getDb() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export const googleProvider = new GoogleAuthProvider();

export function getProjectId(): string {
  return import.meta.env.VITE_FIREBASE_PROJECT_ID;
}

export function getFirebaseFunctions(): Functions {
  return getFunctions(getFirebaseApp(), FIREBASE_FUNCTIONS_REGION);
}
