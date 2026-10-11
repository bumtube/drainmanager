import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { FirebaseConfigState } from '../types';
import { getFirebaseConfig } from './storage';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function initFirebase(customConfig?: FirebaseConfigState) {
  const config = customConfig || getFirebaseConfig();

  // 환경변수 또는 사용자 로컬 스토리지에 저장된 config
  const apiKey = config.apiKey || import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = config.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = config.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = config.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = config.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = config.appId || import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !projectId) {
    return { initialized: false, error: 'Firebase 설정이 입력되지 않아 로컬 모드(IndexedDB)로 작동합니다.' };
  }

  try {
    if (getApps().length === 0) {
      appInstance = initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      });
    } else {
      appInstance = getApps()[0];
    }
    dbInstance = getFirestore(appInstance);
    storageInstance = getStorage(appInstance);
    return { initialized: true, app: appInstance, db: dbInstance, storage: storageInstance };
  } catch (err: any) {
    console.warn('Firebase init failed, fallback to local IndexedDB:', err);
    return { initialized: false, error: err.message };
  }
}

export function isFirebaseReady(): boolean {
  return !!appInstance && !!dbInstance;
}
