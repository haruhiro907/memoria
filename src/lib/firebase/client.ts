import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

/*
  Firebase クライアントの初期化

  環境変数は .env.local に置く（.env.example を参照）。
  NEXT_PUBLIC_USE_EMULATORS=1 の場合はローカルの Firebase エミュレータへ接続する。
  実プロジェクトの本番鍵をリポジトリに入れないこと。
*/

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo.memoria.local",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-memoria",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "demo-memoria.appspot.com",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000000:web:demo",
};

/* クライアント側でのみ初期化される（このモジュールは "use client" 配下からのみ import する） */
let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;
let storageInstance: FirebaseStorage;
let functionsInstance: Functions;
let emulatorConnected = false;

function ensureInit() {
  if (app) return;
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
  functionsInstance = getFunctions(app);

  if (useEmulators && !emulatorConnected && typeof window !== "undefined") {
    emulatorConnected = true;
    connectAuthEmulator(authInstance, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
    connectStorageEmulator(storageInstance, "127.0.0.1", 9199);
    connectFunctionsEmulator(functionsInstance, "127.0.0.1", 5001);
  }
}

export type MemoriaFirebase = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
};

export function getFirebase(): MemoriaFirebase {
  ensureInit();
  return { app, auth: authInstance, db: dbInstance, storage: storageInstance, functions: functionsInstance };
}
