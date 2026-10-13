import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Layers,
  Plus,
  Play,
  History,
  Edit,
  MapPin,
  Compass,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Camera,
  X,
  ExternalLink,
} from 'lucide-react';
import { DitchMaster, DrainStatus, UserRole } from '../types';

interface MapViewProps {
  ditches: DitchMaster[];
  userRole: UserRole;
  selectedDitch: DitchMaster | null;
  onSelectDitch: (ditch: DitchMaster | null) => void;
  onStartInspection: (ditch: DitchMaster) => void;
  onOpenInspectionForm?: (ditch: DitchMaster) => void;
  onViewHistory: (ditch: DitchMaster) => void;
  onAddNewDitch: () => void;
  onEditDitch: (ditch: DitchMaster) => void;
  onUpdateDitchCoordinates: (ditchId: string, lat: number, lng: number) => void;
  currentGps: { latitude: number; longitude: number; accuracy?: number } | null;
  gpsErrorMsg?: string | null;
  onRetryGps?: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  ditches,
  userRole,
  selectedDitch,
  onSelectDitch,
  onStartInspection,
  onOpenInspectionForm,
  onViewHistory,
  onAddNewDitch,
  onEditDitch,
  onUpdateDitchCoordinates,
  currentGps,
  gpsErrorMsg,
  onRetryGps,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);

  // 지도 타일 종류: 기본값을 'streets'(일반지도)로 설정
  const [mapType, setMapType] = useState<'satellite' | 'streets'>('streets');

  // 분당노인종합복지관(불정로 50) 기준 가상 울타리 (반경 300m 정밀 제한)
  const FACILITY_CENTER: [number, number] = [37.357515, 127.112388];
  const FACILITY_BOUNDS = L.latLngBounds(
    [37.3548, 127.1090], // 남서쪽 (SW: 반경 300m)
    [37.3602, 127.1158]  // 북동쪽 (NE: 반경 300m)
  );

  // 구역 선택 필터 상태 ('ALL' | '도로' | '본관' | '별관' | '식수')
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // 구역 명칭 정규화 유틸 ('주차장' -> '도로' 변환 및 '식수' 감지)
  const getNormalizedSection = (d: DitchMaster): string => {
    const s = d.section || '';
    const n = d.name || '';
    if (s === '식수' || n.includes('식수')) return '식수';
    if (s === '본관' || n.includes('본관')) return '본관';
    if (s === '별관' || n.includes('별관')) return '별관';
    if (s === '도로' || s === '주차장' || n.includes('도로') || n.includes('주차장')) return '도로';
    return s || '도로';
  };

  // SVG/HTML 마커 생성 유틸 (추천 3번: 미니 구역 꼬리표 라벨 + 원형 핀 마커 + 번호/식수 나무아이콘)
  const createCustomMarkerIcon = (ditch: DitchMaster, isSelected: boolean, isDraggable: boolean) => {
    let pinColor = '#16a34a'; // GOOD: 초록 (정상)
    let borderColor = '#14532d';

    if (ditch.currentStatus === 'WARNING') {
      pinColor = '#d97706'; // 주의: 주황
      borderColor = '#78350f';
    } else if (ditch.currentStatus === 'DANGER') {
      pinColor = '#dc2626'; // 긴급: 빨강
      borderColor = '#7f1d1d';
    }

    const scale = isSelected ? 'scale-125 z-50' : 'scale-100';

    // 구역 확인 및 식수(나무) 여부 판별
    const section = getNormalizedSection(ditch);
    const isTree = section === '식수';

    // 배수로 명칭에서 번호(숫자) 추출 (예: '도로-1' -> '1', '본관-2' -> '2', '식수-3' -> '3')
    const match = ditch.name?.match(/\d+/);
    const ditchNumber = match ? match[0] : (ditch.name || '1');

    // 추천 3번: 핀 머리 위 미니 구역 꼬리표 라벨 스타일
    const badgeStyle = isTree
      ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200'
      : 'bg-slate-950/95 border-slate-600 text-slate-100';

    // 핀 내부 콘텐츠 (식수일 경우 나무 아이콘 🌲, 일반 배수로는 큰 숫자)
    let innerContent = '';
    if (isTree) {
      innerContent = `
        <div class="flex items-center justify-center leading-none text-white select-none">
          <span class="text-base select-none">🌲</span>
          <span class="text-[11px] font-black ml-0.5">${ditchNumber}</span>
        </div>
      `;
    } else {
      const textSize =
        ditchNumber.length > 2 ? 'text-[11px]' : ditchNumber.length === 2 ? 'text-[13px]' : 'text-[15px]';
      innerContent = `<span class="${textSize} font-black leading-none">${ditchNumber}</span>`;
    }

    const html = `
      <div class="relative flex flex-col items-center justify-center transform transition-transform duration-200 ${scale}">
        <!-- 추천 3번: 핀 머리 위 미니 구역 꼬리표 라벨 -->
        <div style="box-shadow: 0 2px 6px rgba(0,0,0,0.6);" class="mb-0.5 px-1.5 py-0.5 rounded-full border ${badgeStyle} text-[10px] font-black shadow whitespace-nowrap leading-none flex items-center justify-center">
          ${isTree ? '🌲 ' : ''}${section}
        </div>

        <!-- 클래식 원형 핀 마커 본체 -->
        <div class="relative flex items-center justify-center">
          <div style="background-color: ${pinColor}; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.55);" class="w-9 h-9 rounded-full flex items-center justify-center text-white font-black ${isSelected ? 'ring-4 ring-yellow-300' : ''}">
            ${innerContent}
          </div>
          ${
            isDraggable
              ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow"></span>'
              : ''
          }
          <div style="border-top-color: ${pinColor};" class="absolute -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]"></div>
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-ditch-pin',
      iconSize: [48, 62],
      iconAnchor: [24, 62],
    });
  };

  // 현재 사용자 위치 아이콘
  const createUserLocationIcon = () => {
    const html = `
      <div class="relative flex items-center justify-center">
        <div class="w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-lg z-10"></div>
        <div class="absolute w-10 h-10 bg-blue-400 rounded-full animate-ping opacity-75"></div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'user-gps-pulse',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  // 1. 초기 맵 인스턴스 생성
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // 기본 좌표: 경기도 성남시 분당구 불정로 50
    const initialLat = ditches[0]?.latitude || 37.357515;
    const initialLng = ditches[0]?.longitude || 127.112388;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 18,
      minZoom: 17, // 최소 축소 제한 (복지관 부지 반경 300m)
      maxZoom: 19, // 최대 확대 제한 (정밀 배수로/수목 점검)
      maxBounds: FACILITY_BOUNDS, // 부지 밖 이동 차단 (투명 울타리)
      maxBoundsViscosity: 1.0, // 경계에 도달 시 단단하게 튕겨나옴
      zoomControl: false, // 커스텀 위치에 둘 예정
    });

    // 일반 지도 타일 기본 적용 (OpenStreetMap & crossOrigin 캐시 지원)
    const tileLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
        crossOrigin: true,
      }
    ).addTo(map);

    tileLayerRef.current = tileLayer;

    // 마커 레이어 그룹 생성
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // 맵 클릭 시 바텀시트 닫기
    map.on('click', () => {
      onSelectDitch(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. 타일 레이어 전환 (일반 vs 위성)
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    mapRef.current.removeLayer(tileLayerRef.current);

    let newUrl = '';
    let attr = '';

    if (mapType === 'satellite') {
      newUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri &mdash; Satellite';
    } else {
      newUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attr = '&copy; OpenStreetMap contributors';
    }

    const newLayer = L.tileLayer(newUrl, {
      maxZoom: 19,
      attribution: attr,
      crossOrigin: true,
    }).addTo(mapRef.current);

    tileLayerRef.current = newLayer;
  }, [mapType]);

  // 3. 배수로 마커 렌더링 및 드래그 이벤트 (관리자 모드 시 드래그 미세조정 가능)
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // 선택된 구역 필터링 적용 (전체 / 도로 / 본관 / 별관 / 식수)
    const filteredDitches = ditches.filter((ditch) => {
      if (selectedSection === 'ALL') return true;
      return getNormalizedSection(ditch) === selectedSection;
    });

    filteredDitches.forEach((ditch) => {
      const isSelected = selectedDitch?.id === ditch.id;
      const isDraggable = userRole === 'ADMIN'; // 관리자만 핀 위치 드래그 수정 허용

      const marker = L.marker([ditch.latitude, ditch.longitude], {
        icon: createCustomMarkerIcon(ditch, isSelected, isDraggable),
        draggable: isDraggable,
      });

      // 마커 클릭 이벤트
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectDitch(ditch);
      });

      // 마우스 오버 / 길게 누를 때 배수로 전체 명칭 툴팁 표시
      marker.bindTooltip(ditch.name || '배수로', {
        direction: 'top',
        offset: [0, -28],
      });

      // 관리자 핀 드래그 종료 이벤트 -> 좌표 자동 미세조정 저장
      if (isDraggable) {
        marker.on('dragend', (e) => {
          const latLng = (e.target as L.Marker).getLatLng();
          onUpdateDitchCoordinates(ditch.id, latLng.lat, latLng.lng);
        });
      }

      marker.addTo(markersLayerRef.current!);
    });
  }, [ditches, selectedDitch, userRole, selectedSection]);

  const hasCenteredOnUserRef = useRef<boolean>(false);
  const [showGpsHelpModal, setShowGpsHelpModal] = useState<boolean>(false);
  const isKakaoTalk = typeof navigator !== 'undefined' && /KAKAOTALK/i.test(navigator.userAgent);

  // 4. 실시간 사용자 위치 갱신
  useEffect(() => {
    if (!mapRef.current || !currentGps) return;

    const { latitude, longitude, accuracy } = currentGps;

    // 기존 사용자 마커 갱신 또는 생성
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([latitude, longitude]);
    } else {
      userMarkerRef.current = L.marker([latitude, longitude], {
        icon: createUserLocationIcon(),
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
    }

    // 정확도 원 반경 표시
    if (accuracy && accuracy < 100) {
      if (userCircleRef.current) {
        userCircleRef.current.setLatLng([latitude, longitude]);
        userCircleRef.current.setRadius(accuracy);
      } else {
        userCircleRef.current = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#38bdf8',
          fillColor: '#38bdf8',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(mapRef.current);
      }
    }

    // 최초 GPS 신호 수신 시 사용자의 실제 위치로 지도 중심 자동 이동
    if (!hasCenteredOnUserRef.current && !selectedDitch) {
      mapRef.current.setView([latitude, longitude], 17);
      hasCenteredOnUserRef.current = true;
    }
  }, [currentGps, selectedDitch]);

  // 선택된 배수로 카메라 포커싱
  useEffect(() => {
    if (selectedDitch && mapRef.current) {
      mapRef.current.flyTo([selectedDitch.latitude, selectedDitch.longitude], 17, {
        duration: 0.8,
      });
    }
  }, [selectedDitch]);

  // 내 위치로 지도 이동
  const handlePanToCurrentLocation = () => {
    if (onRetryGps) onRetryGps();
    if (!mapRef.current || !currentGps) {
      setShowGpsHelpModal(true);
      return;
    }
    mapRef.current.flyTo([currentGps.latitude, currentGps.longitude], 18, {
      duration: 1,
    });
  };

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none">
      {/* 1. Leaflet 지도 컨테이너 */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* 2. 상단 GPS 상태 정보 바 및 에러 경고 */}
      <div className="absolute top-3 inset-x-3 z-10 pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (onRetryGps) onRetryGps();
              if (!currentGps || gpsErrorMsg) setShowGpsHelpModal(true);
            }}
            className={`pointer-events-auto bg-slate-950/90 backdrop-blur-md border rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-2.5 transition-all active:scale-95 text-left ${
              gpsErrorMsg
                ? 'border-rose-500/80 bg-rose-950/40'
                : currentGps
                ? 'border-slate-700/80'
                : 'border-amber-500/80 bg-amber-950/30'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                gpsErrorMsg
                  ? 'bg-rose-500 animate-bounce'
                  : currentGps
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <div>
              <div className="text-[11px] font-black text-slate-200">
                {gpsErrorMsg ? (
                  <span className="text-rose-400 font-bold">GPS 권한 필요 (터치하여 안내보기)</span>
                ) : currentGps ? (
                  <>
                    GPS 오차: <span className="text-emerald-400">{currentGps.accuracy?.toFixed(1) || '3.2'}m</span> - 양호
                  </>
                ) : (
                  <span className="text-amber-400">GPS 신호 수신 중... (터치 시 재시도)</span>
                )}
              </div>
              <div className="text-[9px] text-slate-400">
                {userRole === 'ADMIN' ? '🔑 관리자 모드 (핀 이동 가능)' : '🔒 주사님 모드 (위치 고정)'}
              </div>
            </div>
          </button>

          {/* 일반/위성 지도 토글 버튼 */}
          <button
            onClick={() => setMapType((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
            className="pointer-events-auto bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md border border-slate-700 text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-all"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            {mapType === 'streets' ? '일반지도' : '위성지도'}
          </button>
        </div>

        {/* 5. 구역 선택 필터 메뉴 (전체 / 도로 / 본관 / 별관 / 식수) */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto py-0.5 px-0.5 no-scrollbar">
          {(['ALL', '도로', '본관', '별관', '식수'] as const).map((sec) => {
            const isCurrent = selectedSection === sec;
            const count =
              sec === 'ALL'
                ? ditches.length
                : ditches.filter((d) => getNormalizedSection(d) === sec).length;
            const label = sec === 'ALL' ? '전체' : sec === '식수' ? '🌲 식수' : sec;

            return (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 border transition-all active:scale-95 flex items-center gap-1.5 shadow-lg ${
                  isCurrent
                    ? 'bg-blue-600 text-white border-blue-400 shadow-blue-950/80 ring-2 ring-blue-400/40'
                    : 'bg-slate-950/85 hover:bg-slate-900 text-slate-300 border-slate-700/80 backdrop-blur-md'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    isCurrent ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 카카오톡 브라우저 감지 시 안내 배너 */}
        {isKakaoTalk && (
          <div className="pointer-events-auto bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg flex items-center justify-between animate-pulse">
            <span>⚠️ 카카오톡 내에서는 GPS가 차단됩니다!</span>
            <span className="text-[10px] bg-black/80 text-white px-2 py-0.5 rounded ml-2">
              오른쪽아래 [⋮] ➜ 다른 브라우저로 열기
            </span>
          </div>
        )}
      </div>

      {/* 3. 우측 컨트롤 버튼 (내 위치로 이동, 복지관 부지 원위치, 줌 등) */}
      <div className="absolute right-3 top-28 sm:top-24 z-10 flex flex-col gap-2.5">
        <button
          onClick={handlePanToCurrentLocation}
          className="w-12 h-12 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
          title="현재 내 위치로 이동"
        >
          <Navigation className="w-6 h-6 text-blue-400" />
        </button>

        <button
          onClick={() => {
            mapRef.current?.flyTo(FACILITY_CENTER, 18, { duration: 0.8 });
          }}
          className="w-12 h-12 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
          title="복지관 부지 원위치로 복귀"
        >
          <MapPin className="w-6 h-6 text-emerald-400" />
        </button>

        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-12 h-12 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-xl flex items-center justify-center border border-slate-700 font-bold text-xl active:scale-95"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-12 h-12 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-xl flex items-center justify-center border border-slate-700 font-bold text-xl active:scale-95"
        >
          -
        </button>
      </div>

      {/* 4. [관리자 전용] 현장 배수로 핀 등록 플로팅 버튼 (FAB) */}
      {userRole === 'ADMIN' && (
        <button
          onClick={onAddNewDitch}
          className="absolute right-4 bottom-24 sm:bottom-8 z-20 h-14 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-2xl flex items-center gap-2 font-black text-sm border-2 border-blue-400/50 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          현장 배수로 등록
        </button>
      )}

      {/* 5. 배수로 선택 바텀시트 (Bottom Sheet) */}
      {selectedDitch && (
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 sm:p-4 max-w-lg mx-auto">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl text-white space-y-3 animate-in slide-in-from-bottom duration-200">
            {/* 상단 닫기 & 상태 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  {selectedDitch.code.replace(/주차장/g, '도로')}
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    selectedDitch.currentStatus === 'GOOD'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : selectedDitch.currentStatus === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  }`}
                >
                  {selectedDitch.currentStatus === 'GOOD'
                    ? '정상 (양호)'
                    : selectedDitch.currentStatus === 'WARNING'
                    ? '주의 (준설요망)'
                    : '긴급조치 요망'}
                </span>
              </div>
              <button
                onClick={() => onSelectDitch(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 배수로 명칭 및 제원 정보 */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  {getNormalizedSection(selectedDitch) === '식수' ? '🌲 ' : ''}
                  {selectedDitch.name.replace(/주차장/g, '도로')}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {getNormalizedSection(selectedDitch)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {(selectedDitch.address || selectedDitch.section || '').replace(/주차장/g, '도로')}
              </p>
              <div className="flex gap-3 text-[11px] text-slate-300 mt-1 font-medium">
                <span>규격: {selectedDitch.dimension}</span>
                <span>•</span>
                <span>최근 점검: {selectedDitch.lastInspectedAt || '미점검'}</span>
              </div>
            </div>

            {/* 액션 버튼 그룹 */}
            {userRole === 'INSPECTOR' ? (
              // [주사님 모드]: 현장 점검 시작 (촬영은 점검 내부에서 수행)
              <div className="space-y-2 pt-1">
                <button
                  onClick={() =>
                    onOpenInspectionForm
                      ? onOpenInspectionForm(selectedDitch)
                      : onStartInspection(selectedDitch)
                  }
                  className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-xl flex items-center justify-center gap-2.5 shadow-xl shadow-blue-950/60 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-6 h-6 text-blue-200" />
                  현장 점검
                </button>
                <button
                  onClick={() => onViewHistory(selectedDitch)}
                  className="w-full h-11 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <History className="w-4 h-4 text-emerald-400" />
                  과거 점검 이력 타임라인 조회
                </button>
              </div>
            ) : (
              // [관리자 모드]: 점검과 수정 (촬영칸 제거)
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() =>
                      onOpenInspectionForm
                        ? onOpenInspectionForm(selectedDitch)
                        : onStartInspection(selectedDitch)
                    }
                    className="h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 active:scale-95 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-200" />
                    점검
                  </button>
                  <button
                    onClick={() => onEditDitch(selectedDitch)}
                    className="h-12 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 active:scale-95"
                  >
                    <Edit className="w-4 h-4" />
                    수정
                  </button>
                </div>
                <button
                  onClick={() => onViewHistory(selectedDitch)}
                  className="w-full h-10 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <History className="w-4 h-4 text-emerald-400" />
                  과거 점검 이력 타임라인 조회
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. GPS 문제 해결 안내 모달 */}
      {showGpsHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base">GPS 위치 수신 가이드</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGpsHelpModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>1.</span> 브라우저 위치 권한 허용 (★가장 중요)
                </div>
                <p className="text-slate-400">
                  스마트폰 주소창 왼쪽의 <b>자물쇠(🔒)</b> 아이콘을 누르고, <b>[권한] ➜ [위치]</b>를 <b>'허용'</b>으로 바꿔주세요.
                </p>
              </div>

              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>2.</span> 카카오톡으로 열었을 때
                </div>
                <p className="text-slate-400">
                  카카오톡 내부는 GPS가 차단됩니다. 화면 오른쪽 아래 <b>점 3개(⋮)</b>를 눌러 <b>[다른 브라우저로 열기]</b>(크롬/사파리)를 누르세요.
                </p>
              </div>

              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>3.</span> 스마트폰 자체 '위치' 켜기 & 실외 이동
                </div>
                <p className="text-slate-400">
                  스마트폰 상단바를 내려 <b>'위치'</b>가 켜져 있는지 확인하세요. 콘크리트 실내에서는 GPS 위성이 안 잡히므로 창가나 야외 현장으로 나가시면 바로 잡힙니다.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGpsHelpModal(false)}
                className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGpsHelpModal(false);
                  if (onRetryGps) onRetryGps();
                }}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg"
              >
                GPS 다시 시도하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
