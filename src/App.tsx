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
} from 'lucide-react';
import { DitchMaster, InspectionRecord, UserSession } from './types';
import {
  getDitches,
  getInspections,
  saveDitch,
  deleteDitch,
  saveInspection,
  getUserSession,
  saveUserSession,
  setDitchesCache,
  setInspectionsCache,
} from './services/storage';
import {
  initFirebase,
  subscribeToCloudUpdates,
  syncDitchToCloud,
  syncInspectionToCloud,
} from './services/firebase';
import { MapView } from './components/MapView';
import { GhostCamera } from './components/GhostCamera';
import { QuickInspectionForm } from './components/QuickInspectionForm';
import { InspectionHistoryModal } from './components/InspectionHistoryModal';
import { DitchEditModal } from './components/DitchEditModal';
import { AdminDashboard } from './components/AdminDashboard';
import { RoleSelector } from './components/RoleSelector';
import { FirebaseModal } from './components/FirebaseModal';

export const App: React.FC = () => {
  // 1. 사용자 세션 및 권한 상태
  const [session, setSession] = useState<UserSession | null>(() => getUserSession());
  const [isRoleSelectorOpen, setIsRoleSelectorOpen] = useState<boolean>(!session);

  // 2. 데이터 상태
  const [ditches, setDitches] = useState<DitchMaster[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);

  // 3. 네비게이션 뷰: 'map' | 'dashboard'
  const [currentView, setCurrentView] = useState<'map' | 'dashboard'>('map');

  // 4. 지도 선택 배수로
  const [selectedDitch, setSelectedDitch] = useState<DitchMaster | null>(null);

  // 5. 모달 및 플로우 상태
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isQuickFormOpen, setIsQuickFormOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isDitchEditOpen, setIsDitchEditOpen] = useState<boolean>(false);
  const [editingDitch, setEditingDitch] = useState<DitchMaster | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState<boolean>(false);

  // 점검 진행 중 임시 사진 및 GPS
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('');
  const [capturedGpsAccuracy, setCapturedGpsAccuracy] = useState<number | undefined>(undefined);

  // 6. 실시간 HTML5 GPS 위치 추적
  const [currentGps, setCurrentGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);

  // 데이터 로드 함수
  const loadData = async () => {
    try {
      const ditchList = await getDitches();
      const inspectionList = await getInspections();
      setDitches(ditchList);
      setInspections(inspectionList);
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    initFirebase();

    // 실시간 클라우드 동기화: 다른 사람이 점검/등록하면 내 화면에도 실시간 자동 반영
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
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
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
    setSelectedDitch(null);
  };

  // 촬영 시작 버튼 클릭 -> 고스트 카메라 열기
  const handleStartInspection = (ditch: DitchMaster) => {
    setSelectedDitch(ditch);
    setIsCameraOpen(true);
  };

  // 현장 점검 폼 바로 열기 (체크리스트 작성)
  const handleOpenInspectionForm = (ditch: DitchMaster) => {
    setSelectedDitch(ditch);
    setCapturedPhotoUrl('');
    setIsQuickFormOpen(true);
  };

  // 고스트 카메라 촬영 완료 -> 원터치 점검 폼으로 전달
  const handlePhotoCaptured = (photoBase64: string, gpsAccuracy?: number) => {
    setCapturedPhotoUrl(photoBase64);
    setCapturedGpsAccuracy(gpsAccuracy);
    setIsCameraOpen(false);
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

  // 대시보드에서 배수로 지도 이동
  const handleSelectDitchOnMap = (ditch: DitchMaster) => {
    setSelectedDitch(ditch);
    setCurrentView('map');
  };

  // 현재 배수로의 직전 사진 찾기
  const getPreviousPhoto = (ditchId?: string): string | undefined => {
    if (!ditchId) return undefined;
    const ditchInspections = inspections.filter((insp) => insp.ditchId === ditchId);
    return ditchInspections[0]?.photoCurrentUrl;
  };

  const userRole = session?.role || 'INSPECTOR';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. 최상단 네비게이션 헤더 */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between z-20 shadow-md">
        {/* 좌측 로고 및 앱 타이틀 (클릭 시 메인 첫 화면인 현장 지도로 이동) */}
        <button
          type="button"
          onClick={() => {
            setCurrentView('map');
            setSelectedDitch(null);
            setIsQuickFormOpen(false);
            setIsHistoryOpen(false);
            setIsCameraOpen(false);
            setIsDitchEditOpen(false);
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 active:scale-95 transition-all text-left focus:outline-none"
          title="메인 첫 화면(현장 지도)으로 이동"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black text-sm shadow">
            DM
          </div>
          <div className="leading-tight">
            <h1 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
              배수로 지킴이
              <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline">
                Drainage Master
              </span>
            </h1>
          </div>
        </button>

        {/* 중앙 탭 (관리자 모드일 때 지도 vs 대시보드 전환) */}
        {userRole === 'ADMIN' && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setCurrentView('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentView === 'map'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> 현장 지도
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentView === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> 총괄 대시보드
            </button>
          </div>
        )}

        {/* 우측 사용자 권한 뱃지 & 설정 버튼 */}
        <div className="flex items-center gap-2">
          {/* Firebase 클라우드 실시간 동기화 상태 뱃지 & 설정 버튼 */}
          <button
            onClick={() => setIsFirebaseModalOpen(true)}
            className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
              isCloudConnected
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
            title="클라우드 실시간 동기화 상태 (클릭 시 상세 설정)"
          >
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline font-bold">
              {isCloudConnected ? '실시간 공유중' : '클라우드'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isCloudConnected ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-slate-500'
              }`}
            />
          </button>

          {/* 역할 전환 버튼 */}
          <button
            onClick={() => setIsRoleSelectorOpen(true)}
            className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
              userRole === 'ADMIN'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {userRole === 'ADMIN' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">관리자</span>
              </>
            ) : (
              <>
                <HardHat className="w-4 h-4 text-emerald-400" />
                <span className="max-w-[70px] truncate">{session?.name || '현장 점검'}</span>
              </>
            )}
          </button>
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
          <MapView
            ditches={ditches}
            userRole={userRole}
            selectedDitch={selectedDitch}
            onSelectDitch={setSelectedDitch}
            onStartInspection={handleStartInspection}
            onOpenInspectionForm={handleOpenInspectionForm}
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
          />
        ) : (
          <AdminDashboard
            ditches={ditches}
            inspections={inspections}
            onRefreshData={loadData}
            onSelectDitchOnMap={handleSelectDitchOnMap}
          />
        )}
      </main>

      {/* 3. 모달 컴포넌트 렌더링 */}

      {/* A. 고스트 카메라 화면 */}
      {isCameraOpen && selectedDitch && (
        <GhostCamera
          ditch={selectedDitch}
          previousPhotoUrl={getPreviousPhoto(selectedDitch.id)}
          inspectorName={session?.name || '현장 점검자'}
          currentGps={currentGps}
          onPhotoCaptured={handlePhotoCaptured}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}

      {/* B. 원터치 점검 폼 화면 */}
      {isQuickFormOpen && selectedDitch && (
        <QuickInspectionForm
          ditch={selectedDitch}
          inspectorName={session?.name || '현장 점검자'}
          capturedPhotoUrl={capturedPhotoUrl}
          previousPhotoUrl={getPreviousPhoto(selectedDitch.id)}
          gpsAccuracy={capturedGpsAccuracy}
          onSave={handleSaveInspection}
          onRetakePhoto={() => {
            setIsQuickFormOpen(false);
            setIsCameraOpen(true);
          }}
          onCancel={() => {
            setIsQuickFormOpen(false);
            setCapturedPhotoUrl('');
          }}
        />
      )}

      {/* C. 과거 점검 이력 타임라인 */}
      {isHistoryOpen && selectedDitch && (
        <InspectionHistoryModal
          ditch={selectedDitch}
          inspections={inspections.filter((insp) => insp.ditchId === selectedDitch.id)}
          onClose={() => setIsHistoryOpen(false)}
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
        />
      )}

      {/* E. 간이 로그인 및 역할 선택 모달 */}
      {isRoleSelectorOpen && (
        <RoleSelector
          currentSession={session}
          onSelectSession={handleSelectSession}
          onCancel={session ? () => setIsRoleSelectorOpen(false) : undefined}
        />
      )}

      {/* F. Firebase & GitHub 배포 설정 모달 */}
      {isFirebaseModalOpen && (
        <FirebaseModal
          onClose={() => setIsFirebaseModalOpen(false)}
          onConfigUpdated={loadData}
        />
      )}
    </div>
  );
};

export default App;
