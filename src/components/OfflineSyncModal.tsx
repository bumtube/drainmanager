import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  X,
  HardDrive,
  AlertTriangle,
  MapPin,
  Layers,
  Download,
} from 'lucide-react';
import { SyncStatus } from '../services/offlineSync';
import {
  getMapTileCacheCount,
  precacheFacilityMapTiles,
  getFacilityTileCoords,
} from '../services/mapTilePrecache';

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onTriggerSync: () => Promise<{ success: number; failed: number }>;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onTriggerSync,
}) => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // 지도 타일 프리캐싱 상태
  const [tileCacheCount, setTileCacheCount] = useState<number>(0);
  const [isTileCaching, setIsTileCaching] = useState<boolean>(false);
  const [tileProgress, setTileProgress] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: 0,
  });

  const totalFacilityTiles = getFacilityTileCoords().length; // 52개

  useEffect(() => {
    if (isOpen) {
      getMapTileCacheCount().then((count) => setTileCacheCount(count));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setIsManualSyncing(true);
    setSyncFeedback(null);
    try {
      const result = await onTriggerSync();
      if (result.success > 0) {
        setSyncFeedback(`✅ ${result.success}건의 현장 데이터가 클라우드에 성공적으로 동기화되었습니다.`);
      } else if (result.failed > 0) {
        setSyncFeedback(`⚠️ ${result.failed}건의 데이터 전송에 실패했습니다. 통신 상태를 확인해주세요.`);
      } else {
        setSyncFeedback('✅ 모든 데이터가 이미 최신 상태로 동기화되어 있습니다.');
      }
    } catch {
      setSyncFeedback('❌ 동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsManualSyncing(false);
    }
  };

  // 지도 타일 즉시 다운로드(프리캐싱)
  const handlePrecacheTiles = async () => {
    setIsTileCaching(true);
    setTileProgress({ loaded: 0, total: totalFacilityTiles });
    try {
      await precacheFacilityMapTiles((loaded, total) => {
        setTileProgress({ loaded, total });
      });
      const count = await getMapTileCacheCount();
      setTileCacheCount(count);
    } catch (err) {
      console.warn('Map tile caching error:', err);
    } finally {
      setIsTileCaching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto">
        {/* 상단 타이틀 & 닫기 */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${syncStatus.isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {syncStatus.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5 animate-pulse" />}
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                오프라인 & 타일 캐시 관리
              </h3>
              <p className="text-[11px] text-slate-400">
                통신 음영지역 100% 현장 작동 보장 시스템
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. 현재 통신 상태 카드 */}
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
          syncStatus.isOnline
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-rose-950/30 border-rose-500/40 animate-pulse'
        }`}>
          <div className="mt-0.5">
            {syncStatus.isOnline ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div className="flex-1 text-xs space-y-1">
            <div className="font-bold text-sm flex items-center justify-between">
              <span className={syncStatus.isOnline ? 'text-emerald-300' : 'text-rose-300'}>
                {syncStatus.isOnline ? '인터넷 연결 정상 (온라인)' : '인터넷 끊김 (오프라인 모드)'}
              </span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {syncStatus.isOnline ? '실시간 클라우드 전송' : '기기 로컬 안전 저장'}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {syncStatus.isOnline
                ? '현장의 모든 점검 데이터와 사진이 실시간으로 클라우드에 자동 동기화되고 있습니다.'
                : '통신이 끊겨도 점검 기록과 사진이 스마트폰 기기(IndexedDB)에 영구 안전 보관됩니다.'}
            </p>
          </div>
        </div>

        {/* 2. 대기 중인 오프라인 큐 현황 */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-blue-400" />
              클라우드 전송 대기 큐
            </span>
            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
              syncStatus.pendingCount > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {syncStatus.pendingCount}건 대기 중
            </span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-850">
            <span>마지막 성공 동기화:</span>
            <span className="text-slate-200 font-mono font-bold">
              {syncStatus.lastSyncedAt || '최근 동기화 기록 없음'}
            </span>
          </div>

          {syncFeedback && (
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-center">
              {syncFeedback}
            </div>
          )}
        </div>

        {/* 3. 🗺️ 지도 오프라인 타일 프리캐싱 영역 */}
        <div className="bg-slate-950/90 p-3.5 rounded-xl border border-teal-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-400" />
              현장 지도 오프라인 타일 캐시
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
              불정로 50 (줌 16-18)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="text-[11px] text-slate-400">캐시 보관 타일:</span>
            <span className="font-mono font-bold text-teal-300">
              {tileCacheCount > 0 ? `${tileCacheCount}개 파일 보관됨` : '타일 확인 중...'}
            </span>
          </div>

          {isTileCaching ? (
            <div className="space-y-1.5 pt-1">
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-400 h-2 rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.round((tileProgress.loaded / (tileProgress.total || 1)) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-teal-300 font-mono">
                <span>타일 다운로드 중...</span>
                <span>{tileProgress.loaded} / {tileProgress.total}</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePrecacheTiles}
              className="w-full h-10 bg-teal-950/80 hover:bg-teal-900/90 text-teal-300 border border-teal-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span>지도 타일 전체 다운로드 / 최신화</span>
            </button>
          )}

          <p className="text-[10px] text-slate-400 leading-tight">
            💡 현장 부지 전체(52개 고해상도 타일)가 스마트폰 영구 저장소에 캐싱되어 통신 두절 시에도 지도가 하얗게 깨지지 않고 정상 표시됩니다.
          </p>
        </div>

        {/* 4. 오프라인 보장 핵심 안내 */}
        <div className="bg-blue-950/20 border border-blue-500/30 p-3 rounded-xl space-y-1.5 text-xs">
          <div className="font-bold text-blue-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            현장 작업자를 위한 100% 무손실 보장 원칙
          </div>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li>통신이 두절되어도 <b>점검 폼, 사진 촬영, 경광등 등록</b>이 1초의 끊김 없이 즉시 저장됩니다.</li>
            <li>LTE / Wi-Fi가 복구되면 <b>자동 백그라운드 동기화</b>가 작동합니다.</li>
          </ul>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isManualSyncing || !syncStatus.isOnline}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/50 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isManualSyncing || syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            {isManualSyncing || syncStatus.isSyncing ? '동기화 진행 중...' : '지금 동기화 시도'}
          </button>
        </div>
      </div>
    </div>
  );
};
