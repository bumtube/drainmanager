import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  HardHat,
  Map as MapIcon,
  LayoutDashboard,
  Cloud,
  Layers,
  Sparkles,
  Info,
  Smartphone,
  Download,
  X,
  Navigation,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { precacheFacilityMapTiles } from './services/mapTilePrecache';
import { DitchMaster, InspectionRecord, UserSession, EmergencyAlert } from './types';
import {
  getDitches,
  getInspections,
  saveDitch,
  deleteDitch,
  saveInspection,
  deleteInspection,
  deleteInspectionPhoto,
  getUserSession,
  saveUserSession,
  setDitchesCache,
  setInspectionsCache,
  getAlerts,
  saveAlert,
  deleteAlert,
  setAlertsCache,
} from './services/storage';
import {
  initFirebase,
  subscribeToCloudUpdates,
  syncDitchToCloud,
  syncInspectionToCloud,
  deleteInspectionFromCloud,
  fetchInspectionsFromCloud,
} from './services/firebase';
import { MapView } from './components/MapView';
import { QuickInspectionForm } from './components/QuickInspectionForm';
import { InspectionHistoryModal } from './components/InspectionHistoryModal';
import { DitchEditModal } from './components/DitchEditModal';
import { AdminDashboard } from './components/AdminDashboard';
import { DailyInspectionLogView } from './components/DailyInspectionLogView';
import { PrintReportModal } from './components/PrintReportModal';
import { RoleSelector } from './components/RoleSelector';
import { FirebaseModal } from './components/FirebaseModal';
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { GpsHelpModal } from './components/GpsHelpModal';
import { AdminSplitSidebar } from './components/AdminSplitSidebar';
import { ComprehensiveReportModal } from './components/ComprehensiveReportModal';
import {
  subscribeToSyncStatus,
  getCurrentSyncStatus,
  processOfflineSyncQueue,
  SyncStatus,
} from './services/offlineSync';

export const App: React.FC = () => {
  // 1. 사용자 세션 및 권한 상태
  const [session, setSession] = useState<UserSession | null>(() => getUserSession());
  const [isRoleSelectorOpen, setIsRoleSelectorOpen] = useState<boolean>(!session);

  // 2. 데이터 상태
  const [ditches, setDitches] = useState<DitchMaster[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);

  // 3. 네비게이션 뷰: 'map' | 'dashboard' | 'daily_log'
  const [currentView, setCurrentView] = useState<'map' | 'dashboard' | 'daily_log'>('map');
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState<boolean>(false);
  const [activePrintTarget, setActivePrintTarget] = useState<{
    ditch: DitchMaster;
    inspection: InspectionRecord;
  } | null>(null);

  // 4. 지도 선택 배수로 및 긴급상황 경광등
  const [selectedDitch, setSelectedDitch] = useState<DitchMaster | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null);

  // 5. 모달 및 플로우 상태
  const [isQuickFormOpen, setIsQuickFormOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isDitchEditOpen, setIsDitchEditOpen] = useState<boolean>(false);
  const [editingDitch, setEditingDitch] = useState<DitchMaster | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isGpsHelpModalOpen, setIsGpsHelpModalOpen] = useState<boolean>(false);
  const [isComprehensiveReportOpen, setIsComprehensiveReportOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getCurrentSyncStatus());
  const [resetMapKey, setResetMapKey] = useState<number>(0);

  // 점검 진행 중 임시 사진 및 GPS
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('');
  const [capturedGpsAccuracy, setCapturedGpsAccuracy] = useState<number | undefined>(undefined);

  // 6. 실시간 HTML5 GPS 위치 추적
  const [currentGps, setCurrentGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);

  // 7. PWA 홈 화면 설치 프롬프트 상태
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(true);

  // 데이터 로드 함수
  const loadData = async () => {
    try {
      const ditchList = await getDitches();
      const inspectionList = await getInspections();
      const alertList = await getAlerts();
      setDitches(ditchList);
      setInspections(inspectionList);
      setAlerts(alertList);
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    initFirebase();

    // 1. 기기 로컬에만 있고 클라우드에 아직 안 올라간 점검 기록(사진 포함)이 있으면 자동 업로드
    (async () => {
      try {
        const localInspections = await getInspections();
        if (localInspections.length > 0) {
          const cloudInspections = await fetchInspectionsFromCloud();
          const cloudIds = new Set(cloudInspections.map((i) => i.id));
          for (const insp of localInspections) {
            // 데모용 샘플(insp-001 등)이 아닌 실제 현장 점검 기록이고 클라우드에 없는 경우 자동 업로드
            if (!cloudIds.has(insp.id)) {
              console.log('🔄 미동기화된 현장 점검기록 클라우드 자동 업로드 중:', insp.id);
              await syncInspectionToCloud(insp);
            }
          }
        }
      } catch (e) {
        console.warn('Pending inspection auto-sync error:', e);
      }
    })();

    // 2. 실시간 클라우드 동기화: 다른 사람이 점검/등록하면 내 화면에도 실시간 자동 반영
    const unsubscribe = subscribeToCloudUpdates(
      (cloudDitches) => {
        setDitches(cloudDitches);
        // 클라우드 데이터를 로컬 캐시(IndexedDB)에도 즉시 저장하여 다음 접속 시 깜빡임/불일치 방지
        setDitchesCache(cloudDitches).catch(() => {});
      },
      (cloudInspections) => {
        setInspections(cloudInspections);
        setInspectionsCache(cloudInspections).catch(() => {});
      },
      (connected) => {
        setIsCloudConnected(connected);
      },
      (cloudAlerts) => {
        setAlerts(cloudAlerts);
        setAlertsCache(cloudAlerts).catch(() => {});
      }
    );

    // 3. 오프라인 큐 및 네트워크 연결 상태 실시간 감지
    const unsubSync = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });

    // 4. PWA 설치 가능 여부 및 설치 완료 감지
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. 현장 지도 타일 백그라운드 자동 프리캐싱 (성남시 분당구 불정로 50 부지 52개 타일)
    if (navigator.onLine) {
      precacheFacilityMapTiles().then((res) => {
        if (res.success) {
          console.log(`🗺️ 현장 지도 오프라인 타일 프리캐싱 완료 (${res.downloaded}/${res.total})`);
        }
      }).catch((e) => console.warn('Tile auto-cache error:', e));
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubSync) unsubSync();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // GPS 에러 메시지 및 권한 상태
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // 위치 요청 함수 (수동 재시도 가능)
  const refreshGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsErrorMsg('이 브라우저는 위치 추적(GPS)을 지원하지 않습니다.');
      return;
    }

    setGpsErrorMsg(null);

    // 1단계: 빠른 초기 위치 획득 (Wi-Fi/네트워크 기반 포함, 빠른 응답)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn('Initial quick GPS error:', err.code, err.message);
        if (err.code === 1) { // PERMISSION_DENIED
          setGpsErrorMsg('위치 권한이 차단되었습니다. 브라우저 주소창 옆 자물쇠(🔒)를 눌러 위치를 "허용"해주세요.');
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setGpsErrorMsg('GPS 신호를 수신할 수 없습니다. 스마트폰의 "위치" 기능이 켜져 있는지 확인해주세요.');
        } else if (err.code === 3) { // TIMEOUT
          setGpsErrorMsg('GPS 신호 수신 시간이 초과되었습니다. 실외에서 다시 시도해주세요.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    // 2단계: 실시간 고정밀 GPS 연속 추적 (watchPosition)
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsErrorMsg(null);
        setCurrentGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn('High-accuracy GPS watch error:', err.code, err.message);
        if (err.code === 1) {
          setGpsErrorMsg('위치 권한이 거부되었습니다. 브라우저 설정에서 위치를 허용해주세요.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // 충분한 위성 탐색 시간 제공
        maximumAge: 3000,
      }
    );

    return watchId;
  };

  // HTML5 Geolocation 위치 추적
  useEffect(() => {
    const watchId = refreshGpsLocation();

    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // 세션 변경 처리
  const handleSelectSession = (newSession: UserSession) => {
    setSession(newSession);
    saveUserSession(newSession);
    setIsRoleSelectorOpen(false);
  };

  // 배수로 좌표 갱신 (관리자 핀 드래그)
  const handleUpdateDitchCoordinates = async (ditchId: string, lat: number, lng: number) => {
    const target = ditches.find((d) => d.id === ditchId);
    if (!target) return;
    const updated = { ...target, latitude: lat, longitude: lng };
    await saveDitch(updated);
    await loadData();
  };

  // 배수로 신규 등록/수정 완료
  const handleSaveDitch = async (ditch: DitchMaster) => {
    await saveDitch(ditch);
    await syncDitchToCloud(ditch);
    await loadData();
    setSelectedDitch(ditch);
  };

  // 배수로 삭제
  const handleDeleteDitch = async (ditchId: string) => {
    await deleteDitch(ditchId);
    await loadData();
    if (selectedDitch?.id === ditchId) {
      setSelectedDitch(null);
    }
  };

  // 현장 점검 시작 버튼 클릭 -> 원터치 점검 폼 바로 열기
  const handleStartInspection = (ditch: DitchMaster) => {
    setSelectedDitch(ditch);
    setCapturedPhotoUrl('');
    setIsQuickFormOpen(true);
  };

  // 현장 점검 폼 바로 열기 (체크리스트 작성)
  const handleOpenInspectionForm = (ditch: DitchMaster) => {
    setSelectedDitch(ditch);
    setCapturedPhotoUrl('');
    setIsQuickFormOpen(true);
  };

  // 원터치 점검 폼 저장 완료
  const handleSaveInspection = async (record: InspectionRecord) => {
    await saveInspection(record);
    // 클라우드 Firestore에 즉시 동기화
    await syncInspectionToCloud(record);
    
    // 배수로 마스터의 최신 상태도 클라우드에 즉시 동기화
    const updatedDitches = await getDitches();
    const updatedTarget = updatedDitches.find((d) => d.id === record.ditchId);
    if (updatedTarget) {
      await syncDitchToCloud(updatedTarget);
      setSelectedDitch(updatedTarget);
    }

    await loadData();
    setIsQuickFormOpen(false);
    setCapturedPhotoUrl('');
  };

  // 점검 기록 1건(사진 포함) 영구 삭제 완료
  const handleDeleteInspection = async (inspectionId: string) => {
    await deleteInspection(inspectionId);
    await deleteInspectionFromCloud(inspectionId);
    await loadData();
    if (selectedDitch) {
      const updatedDitches = await getDitches();
      const updatedTarget = updatedDitches.find((d) => d.id === selectedDitch.id);
      if (updatedTarget) {
        setSelectedDitch(updatedTarget);
      }
    }
  };

  // 점검 기록의 사진만 선택 삭제 (기록은 유지)
  const handleDeleteInspectionPhoto = async (inspectionId: string) => {
    await deleteInspectionPhoto(inspectionId);
    await loadData();
    if (selectedDitch) {
      const updatedDitches = await getDitches();
      const updatedTarget = updatedDitches.find((d) => d.id === selectedDitch.id);
      if (updatedTarget) {
        setSelectedDitch(updatedTarget);
      }
    }
  };

  // 긴급상황 경광등 핀 생성
  const handleCreateAlert = async (lat: number, lng: number, message?: string, photoUrl?: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const newAlert: EmergencyAlert = {
      id: 'alert-' + Date.now(),
      latitude: lat,
      longitude: lng,
      createdAt: now.toISOString(),
      createdFormatted: formatted,
      creatorName: session?.name || '현장 점검자',
      message: message || '🚨 현장 긴급상황 발생',
      photoUrl: photoUrl || '',
    };
    await saveAlert(newAlert);
    await loadData();
  };

  // 긴급상황 경광등 핀 해제 (삭제)
  const handleDeleteAlert = async (alertId: string) => {
    await deleteAlert(alertId);
    await loadData();
    if (selectedAlert?.id === alertId) {
      setSelectedAlert(null);
    }
  };

  // 긴급상황 경광등 핀 정보 수정
  const handleUpdateAlert = async (updatedAlert: EmergencyAlert) => {
    await saveAlert(updatedAlert);
    await loadData();
    if (selectedAlert?.id === updatedAlert.id) {
      setSelectedAlert(updatedAlert);
    }
  };

  // 대시보드에서 배수로 지도 이동
  const handleSelectDitchOnMap = (ditch: DitchMaster) => {
    setSelectedAlert(null);
    setSelectedDitch(ditch);
    setCurrentView('map');
  };

  // 대시보드에서 긴급상황 경광등 지도 이동
  const handleSelectAlertOnMap = (alert: EmergencyAlert) => {
    setSelectedDitch(null);
    setSelectedAlert(alert);
    setCurrentView('map');
  };

  // 현재 배수로의 직전 사진 찾기
  const getPreviousPhoto = (ditchId?: string): string | undefined => {
    if (!ditchId) return undefined;
    const ditchInspections = inspections.filter((insp) => insp.ditchId === ditchId);
    return ditchInspections[0]?.photoCurrentUrl;
  };

  // ⚡ 5초 패스트패스: 맵 바텀시트에서 즉시 전부 정상 점검 등록
  const handleFastPassInspection = async (ditch: DitchMaster) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const prevPhoto = getPreviousPhoto(ditch.id);

    const fastRecord: InspectionRecord = {
      id: `insp-${Date.now()}`,
      ditchId: ditch.id,
      inspectedAt: formattedDate,
      inspectorName: session?.name || '현장 점검자',
      sedimentStatus: '정상',
      structureStatus: '정상',
      urgencyLevel: '조치완료',
      memo: '현장 순찰 점검: 통수 원활 및 구조물 상태 양호 (5초 패스트패스)',
      photoCurrentUrl: prevPhoto || '',
      photoPreviousUrl: prevPhoto,
      gpsAccuracy: currentGps?.accuracy || 3.0,
      latitude: ditch.latitude,
      longitude: ditch.longitude,
    };

    await handleSaveInspection(fastRecord);
  };

  // PWA 홈 화면 앱 설치 트리거 (브라우저 주소창 없는 전체화면 앱화)
  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert(
        '이미 홈 화면에 앱으로 설치되어 있거나, 브라우저 메뉴(⋮)에서 [홈 화면에 추가] 또는 [앱 설치]를 선택해 주세요.'
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    }
  };

  // 🏠 최초 접속페이지(현장 지도 뷰 + 기본 상태)로 전체 리셋
  const handleGoHome = () => {
    // 1. 모든 모달 닫기 및 선택 해제
    setSelectedDitch(null);
    setSelectedAlert(null);
    setEditingDitch(null);
    setCapturedPhotoUrl('');
    setIsQuickFormOpen(false);
    setIsHistoryOpen(false);
    setIsDitchEditOpen(false);
    setIsComprehensiveReportOpen(false);
    setIsFirebaseModalOpen(false);
    setIsOfflineModalOpen(false);
    setIsGpsHelpModalOpen(false);
    if (session) {
      setIsRoleSelectorOpen(false);
    }

    // 2. 메인 뷰를 현장 지도로 변경
    setCurrentView('map');

    // 3. 번호 목록 뷰 대신 지도 뷰로 복귀하도록 저장값 초기화
    try {
      localStorage.setItem('drainmanager_view_mode', 'map');
    } catch {}

    // 4. MapView 컴포넌트 내부 리셋 트리거 (구역 필터 해제, 센터 좌표 복귀)
    setResetMapKey((prev) => prev + 1);
  };

  const userRole = session?.role || 'INSPECTOR';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. 최상단 네비게이션 헤더 (Apple Frosted Glass) */}
      <header className="h-14 bg-slate-900/85 backdrop-blur-xl border-b border-white/10 px-3 sm:px-4 flex items-center justify-between z-20 shadow-md">
        {/* 좌측 로고 및 앱 타이틀 (클릭 시 메인 첫 화면인 현장 지도로 이동) */}
        <button
          type="button"
          onClick={handleGoHome}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 active:scale-95 transition-all text-left focus:outline-none"
          title="메인 첫 화면(현장 지도)으로 이동"
        >
          <div className="leading-tight">
            <h1 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
              주택전시관
            </h1>
          </div>
        </button>

        {/* 중앙 탭 (관리자 모드일 때 지도 vs 대시보드 vs 일자별 점검일지 전환 - Apple Segmented Control) */}
        {userRole === 'ADMIN' && (
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-white/10 shadow-inner">
            <button
              onClick={() => setCurrentView('map')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                currentView === 'map'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">실시간 관제</span>지도
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 relative ${
                currentView === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> 총괄 대시보드
              {alerts.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
              )}
            </button>
            <button
              onClick={() => setCurrentView('daily_log')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                currentView === 'daily_log'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> <span className="hidden sm:inline">일자별</span>점검일지
            </button>
          </div>
        )}

        {/* 우측 사용자 권한 뱃지 & 설정 버튼 (주사님 모드 vs 관리자 모드 분기) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {userRole === 'INSPECTOR' ? (
            /* 🍎 Apple Dynamic Status Capsule (주사님 모드: 극강의 심플 3-캡슐 UI) */
            <>
              {/* 1. 오늘 점검 진행률 캡슐 (클릭 시 일자별 점검 일지 팝업) */}
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const total = ditches.length;
                const doneToday = ditches.filter(
                  (d) => d.lastInspectedAt && d.lastInspectedAt.startsWith(todayStr)
                ).length;
                const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;
                return (
                  <button
                    type="button"
                    onClick={() => setIsDailyLogModalOpen(true)}
                    className="h-9 px-2.5 sm:px-3 rounded-full text-xs font-black flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 shadow-sm backdrop-blur-xl active:scale-95 transition-all cursor-pointer"
                    title={`오늘 총 ${total}개소 중 ${doneToday}개소 점검 완료 (${pct}%) - 클릭 시 일자별 점검 내용 조회`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                    <span className="hidden sm:inline">오늘 완료</span>
                    <span className="font-mono text-white bg-emerald-600/70 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px]">
                      {doneToday}/{total}
                    </span>
                    <span className="text-[10px] text-emerald-400/90 font-bold hidden xs:inline">({pct}%)</span>
                  </button>
                );
              })()}

              {/* 2. 통합 상태 다이내믹 캡슐 (GPS & 동기화 상태 원터치 뷰) */}
              <button
                type="button"
                onClick={() => {
                  if (gpsErrorMsg) {
                    setIsGpsHelpModalOpen(true);
                  } else {
                    setIsOfflineModalOpen(true);
                  }
                }}
                className={`h-9 px-3 rounded-full text-xs font-black flex items-center gap-2 border transition-all active:scale-95 shadow-sm backdrop-blur-xl ${
                  gpsErrorMsg || !syncStatus.isOnline
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                    : syncStatus.pendingCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                }`}
                title="현장 GPS 및 동기화 상태 (클릭 시 상세 안내 및 동기화)"
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      gpsErrorMsg || !syncStatus.isOnline
                        ? 'bg-rose-400'
                        : syncStatus.pendingCount > 0
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      gpsErrorMsg || !syncStatus.isOnline
                        ? 'bg-rose-500'
                        : syncStatus.pendingCount > 0
                        ? 'bg-amber-500'
                        : 'bg-emerald-400'
                    }`}
                  />
                </span>
                <span className="font-bold text-xs">
                  {gpsErrorMsg
                    ? 'GPS 권한 필요'
                    : !syncStatus.isOnline
                    ? '오프라인 보장'
                    : syncStatus.pendingCount > 0
                    ? `대기 ${syncStatus.pendingCount}건`
                    : '점검 준비완료'}
                </span>
              </button>

              {/* 2. 주사님 프로필 캡슐 (원터치 역할 전환) */}
              <button
                type="button"
                onClick={() => setIsRoleSelectorOpen(true)}
                className="h-9 px-3 rounded-full text-xs font-black flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 active:scale-95 transition-all shadow"
                title="점검자 프로필 및 전환"
              >
                <HardHat className="w-4 h-4 text-emerald-400" />
                <span className="max-w-[75px] truncate">{session?.name || '현장점검'}</span>
              </button>
            </>
          ) : (
            /* 관리자 모드(ADMIN): 상세 관제 뱃지 및 설정 노출 */
            <>
              {/* 관리자 모드 전용: 오프라인 보장 & 대기 큐 동기화 상태 뱃지 버튼 */}
              <button
                onClick={() => setIsOfflineModalOpen(true)}
                className={`h-9 px-2.5 sm:px-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                  !syncStatus.isOnline
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                    : syncStatus.pendingCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                }`}
                title="오프라인 작동 및 동기화 상태 (클릭 시 상세 모달 및 즉시 동기화)"
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      !syncStatus.isOnline
                        ? 'bg-rose-400'
                        : syncStatus.pendingCount > 0
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      !syncStatus.isOnline
                        ? 'bg-rose-500'
                        : syncStatus.pendingCount > 0
                        ? 'bg-amber-500'
                        : 'bg-emerald-400'
                    }`}
                  />
                </span>
                <span className="font-bold text-xs">
                  {!syncStatus.isOnline
                    ? '오프라인'
                    : syncStatus.isSyncing
                    ? '동기화중...'
                    : syncStatus.pendingCount > 0
                    ? `대기 ${syncStatus.pendingCount}건`
                    : '로컬보장'}
                </span>
              </button>

              {/* GPS 상태 뱃지 버튼 */}
              <button
                type="button"
                onClick={() => {
                  refreshGpsLocation();
                  setIsGpsHelpModalOpen(true);
                }}
                className={`h-9 px-2.5 sm:px-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                  gpsErrorMsg
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                    : currentGps
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                }`}
                title={
                  gpsErrorMsg
                    ? 'GPS 권한 필요 (클릭 시 가이드 및 재시도)'
                    : currentGps
                    ? `GPS 정상 수신 (오차 ${currentGps.accuracy ? currentGps.accuracy.toFixed(1) + 'm' : '양호'}, 클릭 시 가이드)`
                    : 'GPS 신호 수신 중... (클릭 시 가이드 및 재시도)'
                }
              >
                <Navigation
                  className={`w-4 h-4 shrink-0 ${
                    gpsErrorMsg
                      ? 'text-rose-400'
                      : currentGps
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                />
                <span className="hidden sm:inline font-bold">
                  {gpsErrorMsg ? 'GPS 권한 필요' : currentGps ? 'GPS 정상' : 'GPS 수신중'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    gpsErrorMsg
                      ? 'bg-rose-400 animate-pulse'
                      : currentGps
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
              </button>

              {/* 클라우드 실시간 동기화 상태 뱃지 & 버튼 */}
              <button
                onClick={() => setIsFirebaseModalOpen(true)}
                className={`h-9 px-2.5 sm:px-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                  !syncStatus.isOnline
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                    : syncStatus.pendingCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                    : isCloudConnected
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
                title="클라우드 실시간 동기화 상태 (클릭 시 Firebase & GitHub 배포 설정)"
              >
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline font-bold">
                  {!syncStatus.isOnline
                    ? '오프라인'
                    : syncStatus.pendingCount > 0
                    ? `대기 ${syncStatus.pendingCount}건`
                    : isCloudConnected
                    ? '실시간 공유중'
                    : '클라우드'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    !syncStatus.isOnline
                      ? 'bg-rose-400'
                      : syncStatus.pendingCount > 0
                      ? 'bg-amber-400'
                      : isCloudConnected
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                      : 'bg-slate-500'
                  }`}
                />
              </button>

              {/* PWA 앱 설치 버튼 (홈 화면 추가) */}
              {!isAppInstalled && (
                <button
                  onClick={handleInstallApp}
                  className="h-9 px-2 sm:px-2.5 rounded-2xl text-xs font-black flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md active:scale-95 transition-all"
                  title="홈 화면에 전체화면 앱으로 설치"
                >
                  <Smartphone className="w-3.5 h-3.5 text-blue-200" />
                  <span className="hidden sm:inline">앱 설치</span>
                </button>
              )}

              {/* 역할 전환 버튼 (관리자) */}
              <button
                onClick={() => setIsRoleSelectorOpen(true)}
                className="h-9 px-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30"
              >
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">관리자</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-sm">현장 배수로 지도를 불러오는 중입니다...</p>
          </div>
        ) : currentView === 'map' ? (
          <div className="flex-1 flex w-full h-full overflow-hidden relative">
            {/* PC 관리자 전용: 좌측 macOS 스타일 실시간 시설 관제 사이드바 */}
            {userRole === 'ADMIN' && (
              <AdminSplitSidebar
                ditches={ditches}
                inspections={inspections}
                selectedDitch={selectedDitch}
                onSelectDitch={(ditch) => {
                  setSelectedDitch(ditch);
                  if (ditch) setSelectedAlert(null);
                }}
                alerts={alerts}
                onOpenEdit={(ditch) => {
                  setEditingDitch(ditch);
                  setIsDitchEditOpen(true);
                }}
                onOpenHistory={(ditch) => {
                  setSelectedDitch(ditch);
                  setIsHistoryOpen(true);
                }}
                onAddNewDitch={() => {
                  setEditingDitch(null);
                  setIsDitchEditOpen(true);
                }}
                onOpenComprehensiveReport={() => setIsComprehensiveReportOpen(true)}
              />
            )}

            <div className="flex-1 h-full relative overflow-hidden">
              <MapView
                ditches={ditches}
                userRole={userRole}
                selectedDitch={selectedDitch}
                onSelectDitch={(ditch) => {
                  setSelectedDitch(ditch);
                  if (ditch) setSelectedAlert(null);
                }}
                onStartInspection={handleStartInspection}
                onOpenInspectionForm={handleOpenInspectionForm}
                onFastPassInspection={handleFastPassInspection}
                onViewHistory={(ditch) => {
                  setSelectedDitch(ditch);
                  setIsHistoryOpen(true);
                }}
                onAddNewDitch={() => {
                  setEditingDitch(null);
                  setIsDitchEditOpen(true);
                }}
                onEditDitch={(ditch) => {
                  setEditingDitch(ditch);
                  setIsDitchEditOpen(true);
                }}
                onUpdateDitchCoordinates={handleUpdateDitchCoordinates}
                currentGps={currentGps}
                gpsErrorMsg={gpsErrorMsg}
                onRetryGps={refreshGpsLocation}
                alerts={alerts}
                onCreateAlert={handleCreateAlert}
                onDeleteAlert={handleDeleteAlert}
                onUpdateAlert={handleUpdateAlert}
                selectedAlert={selectedAlert}
                onSelectAlert={(alert) => {
                  setSelectedAlert(alert);
                  if (alert) setSelectedDitch(null);
                }}
                resetKey={resetMapKey}
                onGoHome={handleGoHome}
              />
            </div>
          </div>
        ) : currentView === 'dashboard' ? (
          <AdminDashboard
            ditches={ditches}
            inspections={inspections}
            alerts={alerts}
            onRefreshData={loadData}
            onSelectDitchOnMap={handleSelectDitchOnMap}
            onSelectAlertOnMap={handleSelectAlertOnMap}
            onOpenHistory={(ditch) => {
              setSelectedDitch(ditch);
              setIsHistoryOpen(true);
            }}
            onOpenEdit={(ditch) => {
              setEditingDitch(ditch);
              setIsDitchEditOpen(true);
            }}
            onDeleteDitch={handleDeleteDitch}
            onDeleteAlert={handleDeleteAlert}
            onUpdateAlert={handleUpdateAlert}
            onDeleteInspection={handleDeleteInspection}
            onSaveDitch={handleSaveDitch}
          />
        ) : (
          <DailyInspectionLogView
            ditches={ditches}
            inspections={inspections}
            onSelectDitchOnMap={handleSelectDitchOnMap}
            onOpenHistory={(ditch) => {
              setSelectedDitch(ditch);
              setIsHistoryOpen(true);
            }}
            onPrintInspection={(ditch, inspection) => setActivePrintTarget({ ditch, inspection })}
            onDeleteInspection={handleDeleteInspection}
          />
        )}
      </main>

      {/* 3. 모달 컴포넌트 렌더링 */}

      {/* 원터치 현장 점검 폼 화면 */}
      {isQuickFormOpen && selectedDitch && (
        <QuickInspectionForm
          ditch={selectedDitch}
          inspectorName={session?.name || '현장 점검자'}
          capturedPhotoUrl={capturedPhotoUrl}
          previousPhotoUrl={getPreviousPhoto(selectedDitch.id)}
          gpsAccuracy={capturedGpsAccuracy || currentGps?.accuracy}
          currentGps={currentGps}
          onSave={handleSaveInspection}
          onRemovePhoto={() => setCapturedPhotoUrl('')}
          onCancel={() => {
            setIsQuickFormOpen(false);
            setCapturedPhotoUrl('');
          }}
          onGoHome={handleGoHome}
        />
      )}

      {/* C. 과거 점검 이력 타임라인 */}
      {isHistoryOpen && selectedDitch && (
        <InspectionHistoryModal
          ditch={selectedDitch}
          inspections={inspections.filter((insp) => insp.ditchId === selectedDitch.id)}
          onClose={() => setIsHistoryOpen(false)}
          onDeleteInspection={handleDeleteInspection}
          onDeletePhoto={handleDeleteInspectionPhoto}
          onGoHome={handleGoHome}
        />
      )}

      {/* D. 관리자 배수로 등록/수정 모달 */}
      {isDitchEditOpen && (
        <DitchEditModal
          ditch={editingDitch}
          existingDitches={ditches}
          currentGps={currentGps}
          onSave={handleSaveDitch}
          onDelete={handleDeleteDitch}
          onClose={() => {
            setIsDitchEditOpen(false);
            setEditingDitch(null);
          }}
          onGoHome={handleGoHome}
        />
      )}

      {/* E. 간이 로그인 및 역할 선택 모달 */}
      {isRoleSelectorOpen && (
        <RoleSelector
          currentSession={session}
          onSelectSession={handleSelectSession}
          onCancel={session ? () => setIsRoleSelectorOpen(false) : undefined}
          onGoHome={session ? handleGoHome : undefined}
        />
      )}

      {/* F. Firebase & GitHub 배포 설정 모달 (시설 관리자 전용) */}
      {isFirebaseModalOpen && userRole === 'ADMIN' && (
        <FirebaseModal
          onClose={() => setIsFirebaseModalOpen(false)}
          onConfigUpdated={loadData}
        />
      )}

      {/* G. 오프라인 작동 보장 및 동기화 상태 모달 */}
      <OfflineSyncModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        syncStatus={syncStatus}
        onTriggerSync={async () => {
          const res = await processOfflineSyncQueue();
          await loadData();
          return res;
        }}
      />

      {/* H. GPS 문제 해결 안내 모달 */}
      <GpsHelpModal
        isOpen={isGpsHelpModalOpen}
        onClose={() => setIsGpsHelpModalOpen(false)}
        onRetryGps={refreshGpsLocation}
        gpsErrorMsg={gpsErrorMsg}
        currentGps={currentGps}
      />

      {/* I. 종합보고서 모달 (관리자 전용) */}
      <ComprehensiveReportModal
        isOpen={isComprehensiveReportOpen}
        onClose={() => setIsComprehensiveReportOpen(false)}
        ditches={ditches}
        inspections={inspections}
        onGoHome={handleGoHome}
      />

      {/* J. 일자별 점검 일지 팝업 모달 */}
      {isDailyLogModalOpen && (
        <DailyInspectionLogView
          ditches={ditches}
          inspections={inspections}
          isModal
          onClose={() => setIsDailyLogModalOpen(false)}
          onSelectDitchOnMap={(ditch) => {
            setIsDailyLogModalOpen(false);
            handleSelectDitchOnMap(ditch);
          }}
          onOpenHistory={(ditch) => {
            setIsDailyLogModalOpen(false);
            setSelectedDitch(ditch);
            setIsHistoryOpen(true);
          }}
          onPrintInspection={(ditch, inspection) => setActivePrintTarget({ ditch, inspection })}
          onDeleteInspection={handleDeleteInspection}
        />
      )}

      {/* K. 사진대지 인쇄 팝업 모달 */}
      {activePrintTarget && (
        <PrintReportModal
          ditch={activePrintTarget.ditch}
          inspection={activePrintTarget.inspection}
          onClose={() => setActivePrintTarget(null)}
        />
      )}
    </div>
  );
};

export default App;
