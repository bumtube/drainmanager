import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { DitchMaster, InspectionRecord } from '../types';

// 사용자의 실제 Firebase 프로젝트 설정
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC3ZKNYAbbecwxs4dbWRWq0O1JoHWxCniE",
  authDomain: "drainmanager-af9b0.firebaseapp.com",
  projectId: "drainmanager-af9b0",
  storageBucket: "drainmanager-af9b0.firebasestorage.app",
  messagingSenderId: "959877789556",
  appId: "1:959877789556:web:d7ba60ca9c638323b75e21",
  measurementId: "G-5NFJY0B9HE"
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function initFirebase(customConfig?: any) {
  try {
    const configToUse = customConfig || DEFAULT_FIREBASE_CONFIG;
    if (getApps().length === 0) {
      appInstance = initializeApp(configToUse);
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

// 클라우드 Firestore에 점검 기록 저장
export async function syncInspectionToCloud(record: InspectionRecord): Promise<boolean> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return false;

    const ref = doc(dbInstance, 'inspections', record.id);
    await setDoc(ref, record);
    return true;
  } catch (err) {
    console.warn('Cloud sync inspection failed (offline):', err);
    return false;
  }
}

// 클라우드 Firestore에 배수로 정보 저장
export async function syncDitchToCloud(ditch: DitchMaster): Promise<boolean> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return false;

    const ref = doc(dbInstance, 'ditches', ditch.id);
    await setDoc(ref, ditch);
    return true;
  } catch (err) {
    console.warn('Cloud sync ditch failed (offline):', err);
    return false;
  }
}
