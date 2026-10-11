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
  onViewHistory: (ditch: DitchMaster) => void;
  onAddNewDitch: () => void;
  onEditDitch: (ditch: DitchMaster) => void;
  onUpdateDitchCoordinates: (ditchId: string, lat: number, lng: number) => void;
  currentGps: { latitude: number; longitude: number; accuracy?: number } | null;
}

export const MapView: React.FC<MapViewProps> = ({
  ditches,
  userRole,
  selectedDitch,
  onSelectDitch,
  onStartInspection,
  onViewHistory,
  onAddNewDitch,
  onEditDitch,
  onUpdateDitchCoordinates,
  currentGps,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);

  // 지도 타일 종류: 'satellite' | 'streets'
  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');

  // SVG 마커 생성 유틸
  const createCustomMarkerIcon = (status: DrainStatus, isSelected: boolean, isDraggable: boolean) => {
    let pinColor = '#22c55e'; // GOOD: 초록
    let borderColor = '#15803d';
    let label = '정상';

    if (status === 'WARNING') {
      pinColor = '#f59e0b'; // 주의: 주황
      borderColor = '#b45309';
      label = '주의';
    } else if (status === 'DANGER') {
      pinColor = '#ef4444'; // 긴급: 빨강
      borderColor = '#b91c1c';
      label = '긴급';
    }

    const scale = isSelected ? 'scale-125 ring-4 ring-white' : 'scale-100';

    const html = `
      <div class="relative flex items-center justify-center transform transition-transform duration-200 ${scale}">
        <div style="background-color: ${pinColor}; border: 2.5px solid ${borderColor};" class="w-9 h-9 rounded-full shadow-2xl flex items-center justify-center text-white text-[11px] font-black border-2 border-white">
          ${label}
        </div>
        ${
          isDraggable
            ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white"></span>'
            : ''
        }
        <div style="border-top-color: ${pinColor};" class="absolute -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]"></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-ditch-pin',
      iconSize: [36, 44],
      iconAnchor: [18, 44],
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

    // 기본 좌표 (첫 번째 배수로 위치 또는 서울/수도권)
    const initialLat = ditches[0]?.latitude || 37.7652;
    const initialLng = ditches[0]?.longitude || 126.7725;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false, // 커스텀 위치에 둘 예정
    });

    // 위성 지도 타일 기본 적용 (야외 현장 식별용 Esri World Imagery)
    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
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

  // 2. 타일 레이어 전환 (위성 vs 일반)
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
    }).addTo(mapRef.current);

    tileLayerRef.current = newLayer;
  }, [mapType]);

  // 3. 배수로 마커 렌더링 및 드래그 이벤트 (관리자 모드 시 드래그 미세조정 가능)
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    ditches.forEach((ditch) => {
      const isSelected = selectedDitch?.id === ditch.id;
      const isDraggable = userRole === 'ADMIN'; // 관리자만 핀 위치 드래그 수정 허용

      const marker = L.marker([ditch.latitude, ditch.longitude], {
        icon: createCustomMarkerIcon(ditch.currentStatus, isSelected, isDraggable),
        draggable: isDraggable,
      });

      // 마커 클릭 이벤트
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectDitch(ditch);
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
  }, [ditches, selectedDitch, userRole]);

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
  }, [currentGps]);

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
    if (!mapRef.current || !currentGps) {
      alert('GPS 신호를 수신 중이거나 위치 권한이 비활성화되어 있습니다.');
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

      {/* 2. 상단 GPS 상태 정보 바 */}
      <div className="absolute top-3 inset-x-3 z-10 pointer-events-none flex items-center justify-between">
        <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-2.5">
          <span
            className={`w-3 h-3 rounded-full ${
              currentGps ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <div className="text-left">
            <div className="text-[11px] font-black text-slate-200">
              {currentGps ? (
                <>
                  GPS 오차: <span className="text-emerald-400">{currentGps.accuracy?.toFixed(1) || '3.2'}m</span> - 양호
                </>
              ) : (
                <span className="text-amber-400">GPS 신호 수신 중...</span>
              )}
            </div>
            <div className="text-[9px] text-slate-400">
              {userRole === 'ADMIN' ? '🔑 관리자 모드 (핀 이동 가능)' : '🔒 주사님 모드 (위치 고정)'}
            </div>
          </div>
        </div>

        {/* 위성/일반 지도 토글 버튼 */}
        <button
          onClick={() => setMapType((prev) => (prev === 'satellite' ? 'streets' : 'satellite'))}
          className="pointer-events-auto bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md border border-slate-700 text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-all"
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          {mapType === 'satellite' ? '위성지도' : '일반지도'}
        </button>
      </div>

      {/* 3. 우측 컨트롤 버튼 (내 위치로 이동, 줌 등) */}
      <div className="absolute right-3 top-20 z-10 flex flex-col gap-2.5">
        <button
          onClick={handlePanToCurrentLocation}
          className="w-12 h-12 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
          title="현재 내 위치로 이동"
        >
          <Navigation className="w-6 h-6 text-blue-400" />
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
                  {selectedDitch.code}
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
              <h3 className="text-lg font-black text-white">{selectedDitch.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{selectedDitch.address || selectedDitch.section}</p>
              <div className="flex gap-3 text-[11px] text-slate-300 mt-1 font-medium">
                <span>규격: {selectedDitch.dimension}</span>
                <span>•</span>
                <span>최근 점검: {selectedDitch.lastInspectedAt || '미점검'}</span>
              </div>
            </div>

            {/* 액션 버튼 그룹 */}
            {userRole === 'INSPECTOR' ? (
              // [주사님 모드]: 대형 점검 시작 버튼 (최소 56px) + 이력 보기
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => onStartInspection(selectedDitch)}
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg rounded-xl flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60 active:scale-95 transition-all"
                >
                  <Play className="w-6 h-6 fill-current" />
                  현장 점검 및 촬영 시작
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
              // [관리자 모드]: 수정, 점검, 이력
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => onStartInspection(selectedDitch)}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    점검 수행
                  </button>
                  <button
                    onClick={() => onEditDitch(selectedDitch)}
                    className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Edit className="w-4 h-4" />
                    제원/좌표 수정
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
    </div>
  );
};
