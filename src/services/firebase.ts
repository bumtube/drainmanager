import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
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
    console.warn('Firebase init failed:', err);
    return { initialized: false, error: err.message };
  }
}

export function isFirebaseReady(): boolean {
  return !!appInstance && !!dbInstance;
}

// 1. 클라우드 Firestore에 배수로 정보 저장
export async function syncDitchToCloud(ditch: DitchMaster): Promise<boolean> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return false;

    const ref = doc(dbInstance, 'ditches', ditch.id);
    await setDoc(ref, ditch, { merge: true });
    console.log('✅ 배수로 클라우드 동기화 완료:', ditch.name);
    return true;
  } catch (err) {
    console.warn('❌ 배수로 클라우드 동기화 실패:', err);
    return false;
  }
}

// 2. 클라우드 Firestore에 점검 기록 저장
export async function syncInspectionToCloud(record: InspectionRecord): Promise<boolean> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return false;

    const ref = doc(dbInstance, 'inspections', record.id);
    await setDoc(ref, record, { merge: true });
    console.log('✅ 점검기록 클라우드 동기화 완료:', record.id);
    return true;
  } catch (err) {
    console.warn('❌ 점검기록 클라우드 동기화 실패 (용량 초과 또는 권한 문제):', err);
    return false;
  }
}

// 3. 클라우드에서 배수로 전체 목록 가져오기 (1회성)
export async function fetchDitchesFromCloud(): Promise<DitchMaster[]> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return [];

    const snapshot = await getDocs(collection(dbInstance, 'ditches'));
    const list: DitchMaster[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as DitchMaster);
    });
    return list;
  } catch (err) {
    console.warn('클라우드 배수로 불러오기 실패:', err);
    return [];
  }
}

// 4. 클라우드에서 점검 기록 전체 목록 가져오기 (1회성)
export async function fetchInspectionsFromCloud(): Promise<InspectionRecord[]> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return [];

    const snapshot = await getDocs(collection(dbInstance, 'inspections'));
    const list: InspectionRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as InspectionRecord);
    });
    return list;
  } catch (err) {
    console.warn('클라우드 점검기록 불러오기 실패:', err);
    return [];
  }
}

// 5. ★실시간 양방향 구독 (누군가 등록/점검하면 다른 사람 화면에 1초 만에 자동 반영)
export function subscribeToCloudUpdates(
  onDitchesUpdate: (ditches: DitchMaster[]) => void,
  onInspectionsUpdate: (inspections: InspectionRecord[]) => void
) {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return () => {};

    // 배수로 실시간 감지
    const unsubDitches = onSnapshot(
      collection(dbInstance, 'ditches'),
      (snapshot) => {
        const list: DitchMaster[] = [];
        snapshot.forEach((d) => list.push(d.data() as DitchMaster));
        if (list.length > 0) {
          onDitchesUpdate(list);
        }
      },
      (err) => console.warn('배수로 실시간 리스너 에러:', err)
    );

    // 점검기록 실시간 감지
    const unsubInspections = onSnapshot(
      collection(dbInstance, 'inspections'),
      (snapshot) => {
        const list: InspectionRecord[] = [];
        snapshot.forEach((d) => list.push(d.data() as InspectionRecord));
        if (list.length > 0) {
          // 최신순 정렬
          list.sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt));
          onInspectionsUpdate(list);
        }
      },
      (err) => console.warn('점검기록 실시간 리스너 에러:', err)
    );

    return () => {
      unsubDitches();
      unsubInspections();
    };
  } catch (err) {
    console.warn('실시간 구독 등록 실패:', err);
    return () => {};
  }
}
