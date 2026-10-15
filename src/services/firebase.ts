import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { DitchMaster, InspectionRecord } from '../types';
import { compressBase64Image } from './imageOptimizer';

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

// 2. 클라우드 Firestore에서 배수로 삭제
export async function deleteDitchFromCloud(ditchId: string): Promise<boolean> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return false;

    const ref = doc(dbInstance, 'ditches', ditchId);
    await deleteDoc(ref);
    console.log('✅ 배수로 클라우드 삭제 완료:', ditchId);
    return true;
  } catch (err) {
    console.warn('❌ 배수로 클라우드 삭제 실패:', err);
    return false;
  }
}

// 3. 클라우드 Firestore에 점검 기록 저장 (사진 압축 최적화 포함)
export async function syncInspectionToCloud(record: InspectionRecord): Promise<boolean> {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return false;

    // 금회 사진 최적화: Firestore 1MB 제한을 안전하게 통과하도록 압축 (80~120KB)
    let optimizedCurrent = record.photoCurrentUrl;
    if (optimizedCurrent && optimizedCurrent.startsWith('data:image')) {
      optimizedCurrent = await compressBase64Image(optimizedCurrent, 960, 0.65);
    }

    // 직전 사진은 용량 절약을 위해 640px 이하로 압축 (단일 문서 300KB 이내 보장)
    let optimizedPrevious = record.photoPreviousUrl;
    if (optimizedPrevious && optimizedPrevious.startsWith('data:image')) {
      optimizedPrevious = await compressBase64Image(optimizedPrevious, 640, 0.55);
    }

    const payload: InspectionRecord = {
      ...record,
      photoCurrentUrl: optimizedCurrent,
      photoPreviousUrl: optimizedPrevious,
    };

    const ref = doc(dbInstance, 'inspections', record.id);
    await setDoc(ref, payload, { merge: true });
    console.log('✅ 점검기록(사진 포함) 클라우드 동기화 완료:', record.id);
    return true;
  } catch (err) {
    console.warn('❌ 점검기록 클라우드 동기화 실패:', err);
    return false;
  }
}

// 4. 클라우드에서 배수로 전체 목록 가져오기 (1회성)
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

// 5. 클라우드에서 점검 기록 전체 목록 가져오기 (1회성)
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

// 6. ★실시간 양방향 구독 (누군가 등록/점검/수정하면 다른 사람 화면에 1초 만에 자동 반영)
export function subscribeToCloudUpdates(
  onDitchesUpdate: (ditches: DitchMaster[]) => void,
  onInspectionsUpdate: (inspections: InspectionRecord[]) => void,
  onConnectionStatus?: (connected: boolean) => void
) {
  try {
    if (!dbInstance) initFirebase();
    if (!dbInstance) return () => {};

    // 배수로 실시간 감지
    const unsubDitches = onSnapshot(
      collection(dbInstance, 'ditches'),
      (snapshot) => {
        if (onConnectionStatus) onConnectionStatus(true);
        const list: DitchMaster[] = [];
        snapshot.forEach((d) => list.push(d.data() as DitchMaster));
        if (list.length > 0) {
          onDitchesUpdate(list);
        }
      },
      (err) => {
        console.warn('배수로 실시간 리스너 에러:', err);
        if (onConnectionStatus) onConnectionStatus(false);
      }
    );

    // 점검기록 실시간 감지
    const unsubInspections = onSnapshot(
      collection(dbInstance, 'inspections'),
      (snapshot) => {
        const list: InspectionRecord[] = [];
        snapshot.forEach((d) => list.push(d.data() as InspectionRecord));
        if (list.length > 0) {
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
    if (onConnectionStatus) onConnectionStatus(false);
    return () => {};
  }
}
