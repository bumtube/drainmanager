import { get, set } from 'idb-keyval';
import { DitchMaster, InspectionRecord, UserSession, FirebaseConfigState } from '../types';
import { INITIAL_DITCHES, INITIAL_INSPECTIONS } from './seedData';

const DITCHES_KEY = 'dm_ditches_v1';
const INSPECTIONS_KEY = 'dm_inspections_v1';
const USER_SESSION_KEY = 'dm_user_session';
const FIREBASE_CONFIG_KEY = 'dm_firebase_config';

// 1. 배수로 목록 조회
export async function getDitches(): Promise<DitchMaster[]> {
  try {
    const data = await get<DitchMaster[]>(DITCHES_KEY);
    if (!data || data.length === 0) {
      // 초기 시드 데이터 주입
      await set(DITCHES_KEY, INITIAL_DITCHES);
      return INITIAL_DITCHES;
    }
    return data;
  } catch (error) {
    console.error('Failed to load ditches from IndexedDB:', error);
    return INITIAL_DITCHES;
  }
}

// 2. 배수로 단건/신규 저장 (생성 또는 업데이트)
export async function saveDitch(ditch: DitchMaster): Promise<void> {
  const current = await getDitches();
  const existingIdx = current.findIndex((d) => d.id === ditch.id);
  if (existingIdx >= 0) {
    current[existingIdx] = ditch;
  } else {
    current.unshift(ditch);
  }
  await set(DITCHES_KEY, current);
}

// 3. 배수로 삭제 (관리자 전용)
export async function deleteDitch(ditchId: string): Promise<void> {
  const current = await getDitches();
  const filtered = current.filter((d) => d.id !== ditchId);
  await set(DITCHES_KEY, filtered);

  // 연관된 점검 이력도 삭제
  const inspections = await getInspections();
  const remainingInspections = inspections.filter((insp) => insp.ditchId !== ditchId);
  await set(INSPECTIONS_KEY, remainingInspections);
}

// 4. 점검 기록 목록 조회 (ditchId 옵션 필터)
export async function getInspections(ditchId?: string): Promise<InspectionRecord[]> {
  try {
    let data = await get<InspectionRecord[]>(INSPECTIONS_KEY);
    if (!data || data.length === 0) {
      await set(INSPECTIONS_KEY, INITIAL_INSPECTIONS);
      data = INITIAL_INSPECTIONS;
    }
    if (ditchId) {
      return data.filter((insp) => insp.ditchId === ditchId);
    }
    return data;
  } catch (error) {
    console.error('Failed to load inspections from IndexedDB:', error);
    return INITIAL_INSPECTIONS;
  }
}

// 5. 신규 점검 기록 저장 및 배수로 마스터 상태 자동 업데이트
export async function saveInspection(record: InspectionRecord): Promise<void> {
  const inspections = await getInspections();
  inspections.unshift(record);
  await set(INSPECTIONS_KEY, inspections);

  // 배수로 마스터의 currentStatus 및 lastInspectedAt 업데이트
  const ditches = await getDitches();
  const ditch = ditches.find((d) => d.id === record.ditchId);
  if (ditch) {
    ditch.lastInspectedAt = record.inspectedAt;
    
    // 긴급도 및 손상도에 따른 자동 상태 판정
    if (record.urgencyLevel === '긴급조치' || record.sedimentStatus === '완전막힘' || record.structureStatus === '파손/붕괴') {
      ditch.currentStatus = 'DANGER';
    } else if (record.sedimentStatus === '준설필요(>30%)' || record.structureStatus === '균열/이탈') {
      ditch.currentStatus = 'WARNING';
    } else {
      ditch.currentStatus = 'GOOD';
    }
    await saveDitch(ditch);
  }
}

// 6. 사용자 세션 관리 (LocalStorage)
export function getUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUserSession(session: UserSession | null): void {
  if (!session) {
    localStorage.removeItem(USER_SESSION_KEY);
  } else {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
  }
}

// 7. 전체 데이터 백업 및 초기화
export async function resetToDefaultData(): Promise<void> {
  await set(DITCHES_KEY, INITIAL_DITCHES);
  await set(INSPECTIONS_KEY, INITIAL_INSPECTIONS);
}

export async function exportAllDataJson(): Promise<string> {
  const ditches = await getDitches();
  const inspections = await getInspections();
  return JSON.stringify({ ditches, inspections, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importAllDataJson(jsonStr: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.ditches) && Array.isArray(parsed.inspections)) {
      await set(DITCHES_KEY, parsed.ditches);
      await set(INSPECTIONS_KEY, parsed.inspections);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}

// 8. Firebase 설정 불러오기 및 저장
export function getFirebaseConfig(): FirebaseConfigState {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (!raw) return { enabled: false };
    return JSON.parse(raw);
  } catch {
    return { enabled: false };
  }
}

export function saveFirebaseConfig(cfg: FirebaseConfigState): void {
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(cfg));
}
