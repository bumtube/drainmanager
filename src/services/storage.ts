import { get, set } from 'idb-keyval';
import { DitchMaster, InspectionRecord, UserSession, FirebaseConfigState, EmergencyAlert } from '../types';
import { INITIAL_DITCHES, INITIAL_INSPECTIONS } from './seedData';
import {
  syncDitchToCloud,
  syncInspectionToCloud,
  deleteDitchFromCloud,
  deleteInspectionFromCloud,
  syncAlertToCloud,
  deleteAlertFromCloud,
} from './firebase';
import { enqueueOfflineItem } from './offlineSync';


const DITCHES_KEY = 'dm_ditches_v2';
const INSPECTIONS_KEY = 'dm_inspections_v2';
const ALERTS_KEY = 'dm_alerts_v1';
const USER_SESSION_KEY = 'dm_user_session';
const FIREBASE_CONFIG_KEY = 'dm_firebase_config';

// 1. 배수로 목록 조회
export async function getDitches(): Promise<DitchMaster[]> {
  try {
    let data = await get<DitchMaster[]>(DITCHES_KEY);
    // 기존 데이터가 아예 없는 최초 실행 시에만 초기 데이터 설정
    if (!data || data.length === 0) {
      await set(DITCHES_KEY, INITIAL_DITCHES);
      await set(INSPECTIONS_KEY, INITIAL_INSPECTIONS);
      return INITIAL_DITCHES;
    }

    // '주차장' / '도로' -> '정자 앞' 자동 마이그레이션 적용
    let hasChanges = false;
    data = data.map((d) => {
      if (
        d.section === '주차장' ||
        d.section === '도로' ||
        d.name.includes('주차장') ||
        d.name.includes('도로') ||
        d.code.includes('주차장') ||
        d.code.includes('도로') ||
        (d.address && (d.address.includes('주차장') || d.address.includes('도로'))) ||
        (d.memo && (d.memo.includes('주차장') || d.memo.includes('도로')))
      ) {
        hasChanges = true;
        return {
          ...d,
          section: d.section === '주차장' || d.section === '도로' ? '정자 앞' : d.section,
          name: d.name.replace(/(주차장|도로)/g, '정자 앞'),
          code: d.code.replace(/(주차장|도로)/g, '정자 앞'),
          address: d.address ? d.address.replace(/(주차장|도로)/g, '정자 앞') : d.address,
          memo: d.memo ? d.memo.replace(/(주차장|도로)/g, '정자 앞') : d.memo,
        };
      }
      return d;
    });

    if (hasChanges) {
      await set(DITCHES_KEY, data);
    }

    return data;
  } catch (error) {
    console.error('Failed to load ditches from IndexedDB:', error);
    return INITIAL_DITCHES;
  }
}

// 1-1. 클라우드에서 받은 최신 데이터를 로컬 캐시(IndexedDB)에 저장 (동기화 보장)
export async function setDitchesCache(ditches: DitchMaster[]): Promise<void> {
  try {
    const normalized = ditches.map((d) => ({
      ...d,
      section: d.section === '주차장' || d.section === '도로' ? '정자 앞' : d.section,
      name: d.name.replace(/(주차장|도로)/g, '정자 앞'),
      code: d.code.replace(/(주차장|도로)/g, '정자 앞'),
      address: d.address ? d.address.replace(/(주차장|도로)/g, '정자 앞') : d.address,
      memo: d.memo ? d.memo.replace(/(주차장|도로)/g, '정자 앞') : d.memo,
    }));
    await set(DITCHES_KEY, normalized);
  } catch (err) {
    console.warn('Failed to update local ditches cache:', err);
  }
}

export async function setInspectionsCache(inspections: InspectionRecord[]): Promise<void> {
  try {
    await set(INSPECTIONS_KEY, inspections);
  } catch (err) {
    console.warn('Failed to update local inspections cache:', err);
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
  // 파이어베이스 클라우드에도 자동 동기화 (오프라인 시 큐 등록)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('ditch', ditch).catch(() => {});
  } else {
    syncDitchToCloud(ditch).then((ok) => {
      if (!ok) enqueueOfflineItem('ditch', ditch).catch(() => {});
    }).catch(() => {
      enqueueOfflineItem('ditch', ditch).catch(() => {});
    });
  }
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

  // 파이어베이스 클라우드에서도 영구 삭제
  deleteDitchFromCloud(ditchId).catch(() => {});
}

// 4. 점검 기록 목록 조회 (ditchId 옵션 필터)
export async function getInspections(ditchId?: string): Promise<InspectionRecord[]> {
  try {
    let data = await get<InspectionRecord[]>(INSPECTIONS_KEY);
    // 최초 실행 시에만 초기 데이터 확인 (이미 빈 배열[]로 초기화된 경우는 리셋하지 않음)
    if (data === undefined || data === null) {
      const ditches = await get<DitchMaster[]>(DITCHES_KEY);
      const isDefaultDitches = ditches && ditches.some((d) => d.id === 'ditch-001');
      data = isDefaultDitches ? INITIAL_INSPECTIONS : [];
      await set(INSPECTIONS_KEY, data);
    }
    if (ditchId) {
      return data.filter((insp) => insp.ditchId === ditchId);
    }
    return data;
  } catch (error) {
    console.error('Failed to load inspections from IndexedDB:', error);
    return [];
  }
}

// 5. 신규 점검 기록 저장 및 배수로 마스터 상태 자동 업데이트
export async function saveInspection(record: InspectionRecord): Promise<void> {
  const inspections = await getInspections();
  inspections.unshift(record);
  await set(INSPECTIONS_KEY, inspections);

  // 파이어베이스 클라우드 자동 동기화 (오프라인 시 큐 등록)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('inspection', record).catch(() => {});
  } else {
    syncInspectionToCloud(record).then((ok) => {
      if (!ok) enqueueOfflineItem('inspection', record).catch(() => {});
    }).catch(() => {
      enqueueOfflineItem('inspection', record).catch(() => {});
    });
  }

  // 배수로 마스터의 currentStatus 및 lastInspectedAt 업데이트
  const ditches = await getDitches();
  const ditch = ditches.find((d) => d.id === record.ditchId);
  if (ditch) {
    ditch.lastInspectedAt = record.inspectedAt;
    
    // 긴급도 및 손상도에 따른 자동 상태 판정
    if (
      record.urgencyLevel === '긴급조치' ||
      record.sedimentStatus === '완전막힘' ||
      record.structureStatus === '파손/붕괴'
    ) {
      ditch.currentStatus = 'DANGER';
    } else if (
      record.sedimentStatus === '준설필요' ||
      record.sedimentStatus === '준설필요(>30%)' ||
      record.urgencyLevel === '조치예정' ||
      record.structureStatus === '균열/이탈'
    ) {
      ditch.currentStatus = 'WARNING';
    } else {
      ditch.currentStatus = 'GOOD';
    }
    await saveDitch(ditch);
  }
}

// 5-1. 점검 기록 1건(사진 포함) 영구 삭제 및 배수로 상태 최신화
export async function deleteInspection(inspectionId: string): Promise<void> {
  const inspections = await getInspections();
  const target = inspections.find((i) => i.id === inspectionId);
  const remaining = inspections.filter((i) => i.id !== inspectionId);
  await set(INSPECTIONS_KEY, remaining);

  // 파이어베이스 클라우드에서도 영구 삭제
  try {
    await deleteInspectionFromCloud(inspectionId);
  } catch (err) {
    console.warn('Failed to delete inspection from cloud:', err);
  }

  // 배수로 마스터의 lastInspectedAt 및 currentStatus 상태 롤백/갱신
  if (target) {
    const ditches = await getDitches();
    const ditch = ditches.find((d) => d.id === target.ditchId);
    if (ditch) {
      const ditchInspections = remaining.filter((i) => i.ditchId === target.ditchId);
      const latest = ditchInspections[0]; // remaining 목록의 최신 항목
      if (latest) {
        ditch.lastInspectedAt = latest.inspectedAt;
        if (
          latest.urgencyLevel === '긴급조치' ||
          latest.sedimentStatus === '완전막힘' ||
          latest.structureStatus === '파손/붕괴'
        ) {
          ditch.currentStatus = 'DANGER';
        } else if (
          latest.sedimentStatus === '준설필요' ||
          latest.sedimentStatus === '준설필요(>30%)' ||
          latest.urgencyLevel === '조치예정' ||
          latest.structureStatus === '균열/이탈'
        ) {
          ditch.currentStatus = 'WARNING';
        } else {
          ditch.currentStatus = 'GOOD';
        }
      } else {
        ditch.lastInspectedAt = '';
        ditch.currentStatus = 'GOOD';
      }
      await saveDitch(ditch);
    }
  }
}

// 5-2. 점검 기록의 사진만 선택 삭제 (점검 내역 및 판정 상태는 안전하게 유지)
export async function deleteInspectionPhoto(inspectionId: string): Promise<void> {
  const inspections = await getInspections();
  const target = inspections.find((i) => i.id === inspectionId);
  if (!target) return;

  target.photoCurrentUrl = '';
  await set(INSPECTIONS_KEY, inspections);

  // 파이어베이스 클라우드에도 사진 제거 상태 즉시 동기화
  try {
    await syncInspectionToCloud(target);
  } catch (err) {
    console.warn('Failed to sync photo deletion to cloud:', err);
  }
}

// 5-3. 긴급상황 경광등 핀 목록 조회
export async function getAlerts(): Promise<EmergencyAlert[]> {
  try {
    const data = await get<EmergencyAlert[]>(ALERTS_KEY);
    return data || [];
  } catch (error) {
    console.error('Failed to load alerts from IndexedDB:', error);
    return [];
  }
}

// 5-4. 긴급상황 경광등 핀 저장 및 수정
export async function saveAlert(alert: EmergencyAlert): Promise<void> {
  const alerts = await getAlerts();
  const existingIndex = alerts.findIndex((a) => a.id === alert.id);
  if (existingIndex >= 0) {
    alerts[existingIndex] = alert;
  } else {
    alerts.unshift(alert);
  }
  await set(ALERTS_KEY, alerts);

  // 클라우드 Firestore 실시간 동기화 (오프라인 시 큐 등록)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('alert', alert).catch(() => {});
  } else {
    syncAlertToCloud(alert).then((ok) => {
      if (!ok) enqueueOfflineItem('alert', alert).catch(() => {});
    }).catch(() => {
      enqueueOfflineItem('alert', alert).catch(() => {});
    });
  }
}

// 5-5. 긴급상황 경광등 핀 해제 (삭제)
export async function deleteAlert(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const remaining = alerts.filter((a) => a.id !== alertId);
  await set(ALERTS_KEY, remaining);

  // 클라우드 Firestore에서도 영구 삭제 (오프라인 시 큐 등록)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem('delete_alert', { id: alertId }).catch(() => {});
  } else {
    deleteAlertFromCloud(alertId).then((ok) => {
      if (!ok) enqueueOfflineItem('delete_alert', { id: alertId }).catch(() => {});
    }).catch(() => {
      enqueueOfflineItem('delete_alert', { id: alertId }).catch(() => {});
    });
  }
}


// 5-6. 클라우드에서 받은 최신 긴급상황 목록 캐시 저장
export async function setAlertsCache(alerts: EmergencyAlert[]): Promise<void> {
  try {
    await set(ALERTS_KEY, alerts);
  } catch (err) {
    console.warn('Failed to update alerts cache:', err);
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
