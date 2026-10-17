import { get, set } from 'idb-keyval';
import {
  syncDitchToCloud,
  syncInspectionToCloud,
  deleteDitchFromCloud,
  deleteInspectionFromCloud,
  syncAlertToCloud,
  deleteAlertFromCloud,
  isFirebaseReady,
  initFirebase,
} from './firebase';
import { InspectionRecord, EmergencyAlert, DitchMaster } from '../types';

export interface OfflineQueueItem {
  id: string;
  type: 'inspection' | 'alert' | 'ditch' | 'delete_alert' | 'delete_inspection';
  payload: any;
  createdAt: string;
  retryCount?: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
}

const OFFLINE_QUEUE_KEY = 'dm_offline_queue_v1';
const LAST_SYNCED_KEY = 'dm_last_synced_at';

type StatusListener = (status: SyncStatus) => void;
const listeners = new Set<StatusListener>();

let currentStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SYNCED_KEY) : null,
};

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...currentStatus });
    } catch (e) {
      console.warn('Sync listener error:', e);
    }
  });
}

/**
 * 오프라인 큐 전체 목록 조회
 */
export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const queue = await get<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY);
    return queue || [];
  } catch (err) {
    console.error('Failed to get offline queue:', err);
    return [];
  }
}

/**
 * 오프라인 큐에 작업 등록
 */
export async function enqueueOfflineItem(
  type: OfflineQueueItem['type'],
  payload: any
): Promise<void> {
  const queue = await getOfflineQueue();
  const newItem: OfflineQueueItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  queue.push(newItem);
  await set(OFFLINE_QUEUE_KEY, queue);

  currentStatus.pendingCount = queue.length;
  notifyListeners();
  console.log(`📦 [오프라인 큐 추가] 타입: ${type}, 대기 건수: ${queue.length}`);
}

/**
 * 오프라인 대기 큐 처리 (백그라운드 동기화)
 */
export async function processOfflineSyncQueue(): Promise<{ success: number; failed: number }> {
  if (currentStatus.isSyncing) {
    return { success: 0, failed: 0 };
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    console.log('📶 현재 오프라인 상태이므로 동기화를 대기합니다.');
    return { success: 0, failed: 0 };
  }

  currentStatus.isSyncing = true;
  notifyListeners();

  try {
    if (!isFirebaseReady()) {
      initFirebase();
    }

    const queue = await getOfflineQueue();
    if (queue.length === 0) {
      currentStatus.isSyncing = false;
      currentStatus.pendingCount = 0;
      notifyListeners();
      return { success: 0, failed: 0 };
    }

    console.log(`🚀 [오프라인 큐 동기화 시작] 총 ${queue.length}건 처리 중...`);
    const remainingQueue: OfflineQueueItem[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        let ok = false;
        if (item.type === 'inspection') {
          ok = await syncInspectionToCloud(item.payload as InspectionRecord);
        } else if (item.type === 'alert') {
          ok = await syncAlertToCloud(item.payload as EmergencyAlert);
        } else if (item.type === 'ditch') {
          ok = await syncDitchToCloud(item.payload as DitchMaster);
        } else if (item.type === 'delete_alert') {
          ok = await deleteAlertFromCloud(item.payload.id || item.payload);
        } else if (item.type === 'delete_inspection') {
          ok = await deleteInspectionFromCloud(item.payload.id || item.payload);
        }

        if (ok) {
          successCount++;
        } else {
          item.retryCount = (item.retryCount || 0) + 1;
          remainingQueue.push(item);
          failedCount++;
        }
      } catch (itemErr) {
        console.warn(`Queue item ${item.id} sync failed:`, itemErr);
        item.retryCount = (item.retryCount || 0) + 1;
        remainingQueue.push(item);
        failedCount++;
      }
    }

    await set(OFFLINE_QUEUE_KEY, remainingQueue);

    const nowStr = new Date().toLocaleString('ko-KR');
    currentStatus.pendingCount = remainingQueue.length;
    currentStatus.lastSyncedAt = nowStr;
    try {
      localStorage.setItem(LAST_SYNCED_KEY, nowStr);
    } catch {}

    console.log(`✅ [오프라인 큐 동기화 완료] 성공: ${successCount}건, 실패/재대기: ${failedCount}건`);
    return { success: successCount, failed: failedCount };
  } catch (err) {
    console.error('Process offline queue error:', err);
    return { success: 0, failed: 0 };
  } finally {
    currentStatus.isSyncing = false;
    notifyListeners();
  }
}

/**
 * 상태 리스너 등록
 */
export function subscribeToSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  // 초기 상태 즉시 1회 전달
  getOfflineQueue().then((q) => {
    currentStatus.pendingCount = q.length;
    listener({ ...currentStatus });
  });

  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

// 브라우저 온라인/오프라인 전역 이벤트 바인딩
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('📶 네트워크 연결됨 (Online)');
    currentStatus.isOnline = true;
    notifyListeners();
    // 온라인 복구 시 즉시 큐 비우기 실행
    processOfflineSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('📶 네트워크 끊김 (Offline)');
    currentStatus.isOnline = false;
    notifyListeners();
  });

  // 초기 큐 카운트 로드
  getOfflineQueue().then((q) => {
    currentStatus.pendingCount = q.length;
    notifyListeners();
  });
}
