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
  Siren,
  Trash2,
  Maximize2,
  Image as ImageIcon,
  Zap,
  ListOrdered,
  Map as MapIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DitchMaster, DrainStatus, UserRole, EmergencyAlert } from '../types';
import { fileToBase64Compressed } from '../services/imageOptimizer';
import { getDitchOverdueInfo } from '../utils/ditchOverdue';
import {
  SECTION_COLOR_CONFIG,
  getSectionTheme,
  getNormalizedSection,
  ALL_SECTIONS,
} from '../utils/sectionTheme';
import { extractDitchNumber, extractDitchNumberStr } from '../utils/ditchNumber';
import { GpsHelpModal } from './GpsHelpModal';
import { DrainNumberListView } from './DrainNumberListView';


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
  alerts?: EmergencyAlert[];
  onCreateAlert?: (lat: number, lng: number, message?: string) => Promise<void> | void;
  onDeleteAlert?: (alertId: string) => Promise<void> | void;
  onUpdateAlert?: (alert: EmergencyAlert) => Promise<void> | void;
  selectedAlert?: EmergencyAlert | null;
  onSelectAlert?: (alert: EmergencyAlert | null) => void;
  onFastPassInspection?: (ditch: DitchMaster) => Promise<void> | void;
  resetKey?: number;
  onGoHome?: () => void;
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
  alerts = [],
  onCreateAlert,
  onDeleteAlert,
  onUpdateAlert,
  selectedAlert: externalSelectedAlert,
  onSelectAlert,
  onFastPassInspection,
  resetKey,
  onGoHome,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const alertsLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);

  // ⚡ 5초 패스트패스 진행 중 상태
  const [isFastPassing, setIsFastPassing] = useState<boolean>(false);

  // 긴급상황 경광등 핀 선택 및 생성 로딩 상태
  const [internalSelectedAlert, setInternalSelectedAlert] = useState<EmergencyAlert | null>(null);
  const selectedAlert = externalSelectedAlert !== undefined ? externalSelectedAlert : internalSelectedAlert;
  const setSelectedAlert = (alert: EmergencyAlert | null) => {
    if (onSelectAlert) onSelectAlert(alert);
    setInternalSelectedAlert(alert);
  };
  const [isCreatingAlert, setIsCreatingAlert] = useState<boolean>(false);

  // 긴급상황 경광등 실시간 편집 상태 (바텀시트에서 직접 수정)
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertPhotoUrl, setAlertPhotoUrl] = useState<string>('');
  const [isSavingAlert, setIsSavingAlert] = useState<boolean>(false);
  const [enlargedAlertPhoto, setEnlargedAlertPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAlert) {
      setAlertMessage(selectedAlert.message || '🚨 현장 긴급상황 발생');
      setAlertPhotoUrl(selectedAlert.photoUrl || '');
    }
  }, [selectedAlert?.id, selectedAlert?.message, selectedAlert?.photoUrl]);


  // 이미지 파일 압축 최적화 유틸
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 960;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 지도 타일 종류: 기본값을 'streets'(일반지도)로 설정
  const [mapType, setMapType] = useState<'satellite' | 'streets'>('streets');

  // 시설 기준 중심 좌표 (사용자 지정: 37.35836, 127.11149)
  const FACILITY_CENTER: [number, number] = [37.35836, 127.11149];
  const FACILITY_BOUNDS = L.latLngBounds(
    [37.3557, 127.1081], // 남서쪽 (SW: 남 300m, 서 300m)
    [37.3611, 127.1149]  // 북동쪽 (NE: 북 300m, 동 300m)
  );

  // 구역 전체 목록 및 초기 선택값 (기본값: 전체 필터 해제 상태 [])
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [isOverdueFilter, setIsOverdueFilter] = useState<boolean>(false);

  // 🗺️ 지도 뷰 vs 📋 번호 목록 뷰 모드 ('map' | 'list')
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => {
    try {
      return (localStorage.getItem('drainmanager_view_mode') as 'map' | 'list') || 'map';
    } catch {
      return 'map';
    }
  });

  // 🔄 외부(상단 헤더 '주택전시관' 클릭 등)에서 리셋 신호 수신 시 최초 접속 화면 상태로 전체 복귀
  const isInitialResetMount = useRef(true);
  useEffect(() => {
    if (isInitialResetMount.current) {
      isInitialResetMount.current = false;
      return;
    }
    // 1. 번호 목록 뷰에서 지도 뷰로 복귀
    setViewMode('map');
    try {
      localStorage.setItem('drainmanager_view_mode', 'map');
    } catch {}

    // 2. 구역 필터 및 미점검 필터 모두 초기화 (기본값: 전체 필터 해제 상태 [])
    setSelectedSections([]);
    setIsOverdueFilter(false);

    // 3. 선택된 배수로 및 긴급 알림 선택 해제
    onSelectDitch(null);
    if (onSelectAlert) onSelectAlert(null);
    setInternalSelectedAlert(null);
    setEnlargedAlertPhoto(null);

    // 4. 지도 중심 좌표 및 줌 복귀 (성남시 분당구 불정로 50)
    if (mapRef.current) {
      mapRef.current.setView(FACILITY_CENTER, 18);
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [resetKey]);

  // 지도 뷰에서 빠른 번호 이동(Quick Dial)용 배수로 목록 (구역 필터를 클릭했을 때만 활성화)
  const visibleDitchesForQuickDial = React.useMemo(() => {
    // 1. 필터가 선택되지 않은 상태(전체 해제 상태)에서는 번호 이동 바를 띄우지 않음
    if (selectedSections.length === 0) {
      return [];
    }

    const list = ditches.filter((d) => {
      const normSec = getNormalizedSection(d);
      return selectedSections.includes(normSec);
    });
    return list
      .map((d) => ({ num: extractDitchNumber(d.name, d.code), ditch: d }))
      .sort((a, b) => a.num - b.num);
  }, [ditches, selectedSections]);

  // SVG/HTML 마커 생성 유틸 (구역별 고유 색상 마킹 + 핀 머리 위 구역 뱃지 + 원형 핀 / 식수 나무 아이콘)
  const createCustomMarkerIcon = (ditch: DitchMaster, isSelected: boolean, isDraggable: boolean) => {
    // 1. 구역 확인 및 구역 고유 테마 조회
    const section = getNormalizedSection(ditch);
    const isTree = section === '식수';
    const secTheme = getSectionTheme(section);

    // 핀의 기본 색상은 구역의 고유 색상으로 지정 (정자 앞: 하늘색, 본관3층: 남색, 본관4층: 보라, 별관: 주황, 식수: 초록)
    const pinColor = secTheme.colorHex;

    // 2. 상태별 이상(주의/긴급) 인디케이터 배지 및 테두리 효과
    let statusBadge = '';
    let statusHaloClass = '';
    if (ditch.currentStatus === 'WARNING') {
      statusBadge = `<span class="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 border border-white text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center shadow z-10 animate-pulse" title="주의 (준설요망)">⚠️</span>`;
      statusHaloClass = 'ring-3 ring-amber-400 shadow-lg shadow-amber-500/60';
    } else if (ditch.currentStatus === 'DANGER') {
      statusBadge = `<span class="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 border border-white text-white font-black text-[9px] rounded-full flex items-center justify-center shadow z-10 animate-bounce" title="긴급 조치 필요">🚨</span>`;
      statusHaloClass = 'ring-4 ring-rose-500 shadow-lg shadow-rose-500/80';
    }

    const scale = isSelected ? 'scale-125 z-50' : 'scale-100';

    // 3. 장기 미점검 여부 판별 (14일 초과)
    const overdueInfo = getDitchOverdueInfo(ditch, 14);
    const overdueBadge = overdueInfo.isOverdue
      ? `<span class="absolute -top-1.5 -left-1.5 w-4 h-4 bg-amber-500 border border-white text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center shadow animate-pulse z-10" title="장기 미점검 (${overdueInfo.daysElapsed === 999 ? '미점검' : `${overdueInfo.daysElapsed}일 경과`})">⚠️</span>`
      : '';

    // 배수로 명칭 및 코드에서 시설 고유 일련번호 추출 ('4층', '3층' 등 층수 숫자 오인 방지)
    const ditchNumber = extractDitchNumberStr(ditch.name, ditch.code);

    // 4. 핀 머리 위 미니 구역 꼬리표 라벨 스타일
    const badgeStyle = secTheme.badgeStyle;

    // 5. 마커 본체: 식수 구역은 하얀 식수(나무 실루엣 외곽선) 안에 녹색면과 하얀 글씨 숫자만 표시, 일반 배수로는 구역 고유 색상 원형 핀
    let markerBody = '';
    if (isTree) {
      const fontSize = ditchNumber.length > 2 ? '10.5' : ditchNumber.length === 2 ? '13.5' : '15';
      const selectionFilter = isSelected
        ? 'filter: drop-shadow(0 0 6px #facc15) drop-shadow(0 4px 8px rgba(0,0,0,0.5));'
        : 'filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));';

      markerBody = `
        <div class="relative flex items-center justify-center">
          ${overdueBadge}
          ${statusBadge}
          <svg width="42" height="44" viewBox="0 0 42 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="${selectionFilter}">
            <!-- 하얀 식수 외곽 테두리 (white tree silhouette) + 녹색면 (green surface) -->
            <path d="M 21 2
                     L 29.5 11 L 26 11.5
                     L 34.5 20.5 L 30 21
                     L 39 31.5 L 24.5 31.5
                     L 24.5 44 L 17.5 44
                     L 17.5 31.5 L 3 31.5
                     L 12 21 L 7.5 20.5
                     L 16 11.5 L 12.5 11
                     Z"
                  fill="${pinColor}"
                  stroke="#ffffff"
                  stroke-width="2.8"
                  stroke-linejoin="round"
                  stroke-linecap="round" />
            <!-- 하얀 글씨로 숫자만 큼직하게 표시 -->
            <text x="21" y="22" fill="#ffffff" font-size="${fontSize}" font-weight="900" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" dominant-baseline="central" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">${ditchNumber}</text>
          </svg>
          ${
            isDraggable
              ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow"></span>'
              : ''
          }
        </div>
      `;
    } else {
      const textSize =
        ditchNumber.length > 2 ? 'text-[11px]' : ditchNumber.length === 2 ? 'text-[13px]' : 'text-[15px]';
      const innerContent = `<span class="${textSize} font-black leading-none">${ditchNumber}</span>`;

      markerBody = `
        <div class="relative flex items-center justify-center">
          ${overdueBadge}
          ${statusBadge}
          <div style="background-color: ${pinColor}; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.55);" class="w-9 h-9 rounded-full flex items-center justify-center text-white font-black ${isSelected ? 'ring-4 ring-yellow-300' : ''} ${statusHaloClass}">
            ${innerContent}
          </div>
          ${
            isDraggable
              ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow"></span>'
              : ''
          }
          <div style="border-top-color: ${pinColor};" class="absolute -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]"></div>
        </div>
      `;
    }

    const html = `
      <div class="relative flex flex-col items-center justify-center transform transition-transform duration-200 ${scale}">
        <!-- 핀 머리 위 미니 구역 꼬리표 라벨 (구역별 고유 색상 적용) -->
        <div style="box-shadow: 0 2px 6px rgba(0,0,0,0.6);" class="mb-0.5 px-1.5 py-0.5 rounded-full border ${badgeStyle} text-[10px] font-black shadow whitespace-nowrap leading-none flex items-center justify-center">
          ${section}
        </div>

        ${markerBody}
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

    // 기본 좌표: 시설 기준 중심 좌표
    const initialLat = ditches[0]?.latitude || FACILITY_CENTER[0];
    const initialLng = ditches[0]?.longitude || FACILITY_CENTER[1];

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 18,
      minZoom: 16, // 최소 축소 제한 (복지관 부지 반경 300m 조망)
      maxZoom: 20, // 최대 확대 제한 (20레벨까지 확대 지원)
      maxBounds: FACILITY_BOUNDS, // 부지 밖 이동 차단 (투명 울타리)
      maxBoundsViscosity: 1.0, // 경계에 도달 시 단단하게 튕겨나옴
      zoomControl: false, // 커스텀 위치에 둘 예정
    });

    // 일반 지도 타일 기본 적용 (OpenStreetMap & crossOrigin 캐시 지원)
    const tileLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxNativeZoom: 19,
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors',
        crossOrigin: true,
      }
    ).addTo(map);

    tileLayerRef.current = tileLayer;

    // 마커 레이어 그룹 생성
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // 긴급상황 경광등 핀 레이어 그룹 생성
    const alertsLayer = L.layerGroup().addTo(map);
    alertsLayerRef.current = alertsLayer;

    // 맵 클릭 시 바텀시트 닫기
    map.on('click', () => {
      onSelectDitch(null);
      setSelectedAlert(null);
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
      maxNativeZoom: 19,
      maxZoom: 20,
      attribution: attr,
      crossOrigin: true,
    }).addTo(mapRef.current);

    tileLayerRef.current = newLayer;
  }, [mapType]);

  // 3. 배수로 마커 렌더링 및 드래그 이벤트 (관리자 모드 시 드래그 미세조정 가능)
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // 선택된 구역 필터링 적용 (기본값: '정자 앞', '본관', '별관')
    const filteredDitches = ditches.filter((ditch) => {
      if (isOverdueFilter && !getDitchOverdueInfo(ditch, 14).isOverdue) {
        return false;
      }
      const sec = getNormalizedSection(ditch);
      return selectedSections.includes(sec);
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
  }, [ditches, selectedDitch, userRole, selectedSections, isOverdueFilter]);

  // 3-1. 긴급상황 경광등 마커 아이콘 생성 (붉은색 플래시 핑 + 입체 경광등 뱃지)
  const createEmergencyAlertMarkerIcon = (alert: EmergencyAlert, isSelected: boolean) => {
    const html = `
      <div class="relative flex items-center justify-center cursor-pointer">
        <!-- 붉은색 외곽 레이더 핑 애니메이션 (경광등 플래시 효과) -->
        <span class="absolute -inset-4 rounded-full bg-rose-500/50 animate-ping pointer-events-none"></span>
        <span class="absolute -inset-2 rounded-full bg-rose-600/70 animate-pulse pointer-events-none"></span>

        <!-- 경광등 본체 (빨간 원형 뱃지 + 흰색 테두리 + 그림자) -->
        <div class="relative w-11 h-11 bg-rose-600 border-2 border-white rounded-full shadow-2xl flex items-center justify-center text-white z-20 ${
          isSelected ? 'ring-4 ring-yellow-400 scale-110' : 'scale-100 hover:scale-105'
        } transition-all">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 12a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5v6H7v-6z"/>
            <path d="M5 20a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2H5v-2z"/>
            <path d="M21 12h1"/>
            <path d="M18.5 4.5 19 4"/>
            <path d="M2 12h1"/>
            <path d="M12 2v1"/>
            <path d="M4.5 4.5 5 4"/>
          </svg>
        </div>

        <!-- 상단 말풍선 라벨 -->
        <div class="absolute -top-7 px-2 py-0.5 bg-rose-950/95 border border-rose-500 text-rose-200 text-[10px] font-black rounded-md whitespace-nowrap shadow-lg flex items-center gap-1 z-30">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
          🚨 긴급상황
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'emergency-alert-pin',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  };

  // 3-2. 긴급상황 경광등 핀 렌더링
  useEffect(() => {
    if (!mapRef.current || !alertsLayerRef.current) return;

    alertsLayerRef.current.clearLayers();

    (alerts || []).forEach((alert) => {
      const isSelected = selectedAlert?.id === alert.id;
      const marker = L.marker([alert.latitude, alert.longitude], {
        icon: createEmergencyAlertMarkerIcon(alert, isSelected),
        zIndexOffset: 2000, // 배수로 핀보다 항상 위에 보이도록 최상단 z-index
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectDitch(null); // 배수로 선택 해제
        setSelectedAlert(alert);
      });

      marker.bindTooltip(
        `🚨 긴급상황: ${alert.message || '현장 긴급상황'} (${alert.createdFormatted})`,
        { direction: 'top', offset: [0, -22] }
      );

      marker.addTo(alertsLayerRef.current!);
    });
  }, [alerts, selectedAlert]);

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

  // 선택된 긴급상황 경광등 카메라 포커싱
  useEffect(() => {
    if (selectedAlert && mapRef.current) {
      mapRef.current.flyTo([selectedAlert.latitude, selectedAlert.longitude], 18, {
        duration: 0.8,
      });
    }
  }, [selectedAlert]);

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

  // 불정로 50(복지관 본관 중심) 화면 센터로 이동
  const handlePanToFacilityCenter = () => {
    onSelectDitch(null); // 열려있는 배수로 선택 시트 닫기
    setSelectedAlert(null);
    if (mapRef.current) {
      mapRef.current.flyTo(FACILITY_CENTER, 18, {
        duration: 0.8,
      });
    }
  };

  // 긴급상황 경광등 핀 생성 트리거 (5번째 우측 버튼 클릭 시)
  const handleTriggerEmergencyAlert = async () => {
    // 위치 파악: 1순위 스마트폰 실제 GPS 위치, 2순위 지도 현재 중심 좌표
    let targetLat = currentGps?.latitude;
    let targetLng = currentGps?.longitude;
    let locationMsg = '현재 스마트폰 GPS 위치';

    if (!targetLat || !targetLng) {
      const center = mapRef.current?.getCenter();
      if (!center) {
        alert('위치 정보를 확인할 수 없습니다. 스마트폰 GPS를 확인해주세요.');
        return;
      }
      targetLat = center.lat;
      targetLng = center.lng;
      locationMsg = '현재 지도 중심 위치';
    }

    const alertCount = (alerts || []).length;
    const alertPrompt =
      alertCount > 0
        ? `🚨 [긴급상황 위치 경광등 추가 등록]\n(현재 등록된 경광등: ${alertCount}건)\n\n${locationMsg}에 새로운 긴급상황 경광등 핀을 등록하시겠습니까?\n\n※ 등록 즉시 모든 사용자의 지도에 깜빡이는 빨간 경광등 핀이 실시간으로 표시됩니다.`
        : `🚨 [긴급상황 위치 경광등 등록]\n\n${locationMsg}에 긴급상황 경광등 핀을 등록하시겠습니까?\n\n※ 등록 즉시 모든 사용자의 지도에 깜빡이는 빨간 경광등 핀이 실시간으로 표시됩니다.`;

    const confirmed = window.confirm(alertPrompt);

    if (!confirmed) return;

    setIsCreatingAlert(true);
    try {
      if (onCreateAlert) {
        await onCreateAlert(targetLat, targetLng, '🚨 현장 긴급상황 발생');
      }
      // 지도 중심을 새로 생성된 경광등 핀으로 즉시 이동
      mapRef.current?.flyTo([targetLat, targetLng], 19, { duration: 0.8 });
    } catch (err) {
      console.error('Failed to create emergency alert:', err);
      alert('긴급상황 핀 등록 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingAlert(false);
    }
  };

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none">
      {/* 1. Leaflet 지도 컨테이너 */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* 2. 상단 조작 바 (지도 뷰 / 번호 목록 뷰 전환 & 일반/위성 지도 토글) */}
      <div className="absolute top-3 inset-x-3 z-10 pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Apple 스타일 [지도 뷰] ↔ [번호 목록 뷰] 토글 세그먼트 */}
          <div className="bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 flex gap-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setViewMode('map');
                try {
                  localStorage.setItem('drainmanager_view_mode', 'map');
                } catch {}
                setTimeout(() => {
                  mapRef.current?.invalidateSize();
                }, 50);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 ${
                viewMode === 'map'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>지도 뷰</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                try {
                  localStorage.setItem('drainmanager_view_mode', 'list');
                } catch {}
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 ${
                viewMode === 'list'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>번호 목록 뷰</span>
            </button>
          </div>

          {/* 일반/위성 지도 토글 버튼 (지도 뷰일 때만) */}
          {viewMode === 'map' && (
            <button
              onClick={() => setMapType((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
              className="bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md border border-slate-700 text-white px-3 py-1.5 rounded-2xl shadow-xl flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>{mapType === 'streets' ? '일반지도' : '위성지도'}</span>
            </button>
          )}
        </div>

        {/* 5. 구역 선택 필터 메뉴 (모바일 3열 2줄 그리드, PC 가로 1열 - 스크롤 잘림 완전 해결) */}
        <div className="pointer-events-auto grid grid-cols-3 sm:flex sm:items-center gap-1.5 py-0.5 px-0.5 max-w-xl">
          {/* 전체 버튼 (누르면 전체선택, 한번 더 누르면 모든선택 해제) */}
          {(() => {
            const allDitchesCount = ditches.length;
            const isAllSelected = selectedSections.length === ALL_SECTIONS.length;
            const allTheme = SECTION_COLOR_CONFIG['전체'];
            return (
              <button
                type="button"
                onClick={() => {
                  if (isAllSelected) {
                    // 전체 선택된 상태에서 클릭 시 모든 선택 해제 (0개)
                    setSelectedSections([]);
                    onSelectDitch(null);
                  } else {
                    // 전체 5개 구역 모두 선택
                    setSelectedSections(ALL_SECTIONS);
                  }
                }}
                className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md ${
                  isAllSelected
                    ? allTheme.btnActive
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10 backdrop-blur-md'
                }`}
                title={isAllSelected ? '모든 구역 선택 해제' : '전체 구역 모두 선택'}
              >
                <span>전체</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    isAllSelected ? allTheme.countActive : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {allDitchesCount}
                </span>
              </button>
            );
          })()}

          {/* 5개 개별 구역 버튼 (구역별 고유 색상 구분: 정자 앞, 본관3층, 본관4층, 별관, 식수) */}
          {(['정자 앞', '본관3층', '본관4층', '별관', '식수'] as const).map((sec) => {
            const isSelected = selectedSections.includes(sec);
            const count = ditches.filter((d) => getNormalizedSection(d) === sec).length;
            const secTheme = SECTION_COLOR_CONFIG[sec];
            const label = secTheme.label;

            return (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedSections((prev) => prev.filter((s) => s !== sec));
                  } else {
                    setSelectedSections((prev) => [...prev, sec]);
                  }
                }}
                className={`w-full sm:w-auto px-2 sm:px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md ${
                  isSelected
                    ? secTheme.btnActive
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10 backdrop-blur-md'
                }`}
                title={`${label} 구역 표시/숨김 토글`}
              >
                {!isSelected && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${secTheme.dotBg} shrink-0 opacity-80`}
                  />
                )}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    isSelected ? secTheme.countActive : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* ⚠️ 장기 미점검 시설물 전용 필터 칩 */}
          {(() => {
            const overdueCount = ditches.filter((d) => getDitchOverdueInfo(d, 14).isOverdue).length;
            if (overdueCount === 0) return null;
            return (
              <button
                type="button"
                onClick={() => setIsOverdueFilter((prev) => !prev)}
                className={`col-span-3 sm:col-span-1 w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center sm:justify-start gap-1.5 shadow-md ${
                  isOverdueFilter
                    ? 'bg-amber-600 text-white border-amber-400 shadow-amber-950/80 ring-2 ring-amber-400/40'
                    : 'bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border-amber-600/70 backdrop-blur-md'
                }`}
                title="14일 이상 미점검 시설물만 필터링"
              >
                <span>⚠️ 장기미점검 시설물</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    isOverdueFilter ? 'bg-amber-800 text-amber-100' : 'bg-amber-900 text-amber-200'
                  }`}
                >
                  {overdueCount}개소
                </span>
              </button>
            );
          })()}
        </div>

        {/* 🔢 지도 뷰에서도 사용 가능한 구역별 빠른 번호 이동 바 */}
        {viewMode === 'map' && visibleDitchesForQuickDial.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-xl">
            <span className="text-[10px] font-black text-slate-300 bg-black/70 px-2 py-1 rounded-lg backdrop-blur-md shrink-0 border border-white/10">
              번호 이동:
            </span>
            {visibleDitchesForQuickDial.map(({ num, ditch }) => {
              const isSelected = selectedDitch?.id === ditch.id;
              return (
                <button
                  key={ditch.id}
                  type="button"
                  onClick={() => {
                    onSelectDitch(ditch);
                    if (mapRef.current) {
                      mapRef.current.flyTo([ditch.latitude, ditch.longitude], 19, {
                        duration: 1.0,
                      });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-black border backdrop-blur-md active:scale-90 transition-all shrink-0 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/10'
                  }`}
                  title={`${ditch.name} 위치로 이동`}
                >
                  #{num}번
                </button>
              );
            })}
          </div>
        )}

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

      {/* 3. 우측 컨트롤 버튼 (Apple Frosted Glass 스타일: 내 위치, 복지관 센터, 긴급 경광등) */}
      <div className="absolute right-3 top-36 sm:top-24 z-10 flex flex-col gap-2">
        <button
          onClick={handlePanToCurrentLocation}
          className="w-11 h-11 bg-slate-900/80 hover:bg-slate-800 text-white rounded-2xl shadow-xl flex items-center justify-center border border-white/10 backdrop-blur-xl active:scale-95 transition-all"
          title="현재 내 위치로 이동"
        >
          <Navigation className="w-5 h-5 text-blue-400" />
        </button>

        <button
          onClick={handlePanToFacilityCenter}
          className="w-11 h-11 bg-slate-900/80 hover:bg-slate-800 text-white rounded-2xl shadow-xl flex items-center justify-center border border-white/10 backdrop-blur-xl active:scale-95 transition-all"
          title="불정로 50 화면 센터로 이동"
        >
          <MapPin className="w-5 h-5 text-emerald-400" />
        </button>

        {/* 🚨 긴급상황 경광등 핀 생성 버튼 */}
        <button
          type="button"
          onClick={handleTriggerEmergencyAlert}
          disabled={isCreatingAlert}
          className={`w-11 h-11 rounded-2xl shadow-xl flex items-center justify-center active:scale-95 transition-all relative border backdrop-blur-xl ${
            alerts.length > 0
              ? 'bg-rose-950/90 text-white border-rose-500 shadow-rose-950/80'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-white/10'
          }`}
          title={
            alerts.length > 0
              ? `긴급상황 경광등 ${alerts.length}건 발생 중 (클릭 시 현재 위치에 긴급상황 핀 등록)`
              : '현재 위치에 긴급상황 경광등 핀 등록'
          }
        >
          <Siren
            className={`w-5 h-5 transition-colors ${
              alerts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'
            }`}
          />

          {/* 발생 건수 뱃지 */}
          {alerts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-4.5 px-1 rounded-full bg-rose-600 border border-white text-white text-[10px] font-black flex items-center justify-center leading-none z-10 shadow">
              {alerts.length}
            </span>
          )}
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

      {/* 🚨 긴급상황 경광등 핀 상세 및 해제 시트 */}
      {selectedAlert && (
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 sm:p-4 max-w-lg mx-auto">
          <div className="bg-slate-900/95 backdrop-blur-md border-2 border-rose-500/80 rounded-2xl p-4 shadow-2xl text-white space-y-3 animate-in slide-in-from-bottom duration-200">
            {/* 상단 닫기 & 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  🚨 긴급상황 경광등 핀
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 🚨 긴급상황 내용 / 메모란 (붙임창에서 직접 편집) */}
            <div className="space-y-1.5 pt-0.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Siren className="w-3.5 h-3.5 text-rose-400" />
                  긴급상황 내용 / 메모
                </span>
                <span className="text-[10px] text-slate-400">클라우드 실시간 동기화</span>
              </label>
              <input
                type="text"
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="긴급상황 내용 입력 (예: 배수로 범람 위험)"
                className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500 shadow-inner"
              />
              {/* 빠른 추천 선택 칩 */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  '🚨 배수로 범람 위험',
                  '⚠️ 덮개(그레이팅) 파손',
                  '🍂 토사/낙엽으로 완전 막힘',
                  '🛑 보행자 안전사고 위험',
                  '🚧 배수관로 역류 발생',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAlertMessage(preset)}
                    className={`px-2 py-1 rounded-lg text-[10px] border active:scale-95 transition-all ${
                      alertMessage === preset
                        ? 'bg-rose-600 text-white border-rose-400 font-bold shadow'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 현장 긴급 사진 등록/확대 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-rose-400" />
                  현장 긴급 사진
                </span>
                {alertPhotoUrl ? (
                  <span className="text-[10px] text-emerald-400 font-bold">사진 등록됨</span>
                ) : (
                  <span className="text-[10px] text-slate-400">촬영 또는 사진 선택</span>
                )}
              </label>

              {alertPhotoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                  <img
                    src={alertPhotoUrl}
                    alt="긴급상황 현장 사진"
                    className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => setEnlargedAlertPhoto(alertPhotoUrl)}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEnlargedAlertPhoto(alertPhotoUrl)}
                      className="px-2 py-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
                    >
                      <Maximize2 className="w-3 h-3 text-blue-400" />
                      크게보기
                    </button>
                    <div className="flex items-center gap-1.5">
                      <label className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-sm">
                        <Camera className="w-3 h-3" />
                        사진 변경
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressed = await fileToBase64Compressed(file);
                              setAlertPhotoUrl(compressed);
                              if (onUpdateAlert && selectedAlert) {
                                await onUpdateAlert({
                                  ...selectedAlert,
                                  message: alertMessage.trim() || '🚨 현장 긴급상황 발생',
                                  photoUrl: compressed,
                                });
                              }
                            } catch (err) {
                              console.error(err);
                              alert('사진 변환에 실패했습니다.');
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          setAlertPhotoUrl('');
                          if (onUpdateAlert && selectedAlert) {
                            await onUpdateAlert({
                              ...selectedAlert,
                              message: alertMessage.trim() || '🚨 현장 긴급상황 발생',
                              photoUrl: '',
                            });
                          }
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="h-12 border border-dashed border-rose-500/50 hover:border-rose-400 bg-rose-950/20 hover:bg-rose-950/40 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 text-rose-300">
                    <Camera className="w-4 h-4 text-rose-400" />
                    <span className="text-[11px] font-bold">📷 카메라 촬영</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const compressed = await fileToBase64Compressed(file);
                          setAlertPhotoUrl(compressed);
                          if (onUpdateAlert && selectedAlert) {
                            await onUpdateAlert({
                              ...selectedAlert,
                              message: alertMessage.trim() || '🚨 현장 긴급상황 발생',
                              photoUrl: compressed,
                            });
                          }
                        } catch (err) {
                          console.error(err);
                          alert('카메라 사진 처리에 실패했습니다.');
                        }
                      }}
                    />
                  </label>
                  <label className="h-12 border border-dashed border-slate-700 hover:border-slate-500 bg-slate-950 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 text-slate-300">
                    <ImageIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] font-bold">🖼️ 갤러리/파일</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const compressed = await fileToBase64Compressed(file);
                          setAlertPhotoUrl(compressed);
                          if (onUpdateAlert && selectedAlert) {
                            await onUpdateAlert({
                              ...selectedAlert,
                              message: alertMessage.trim() || '🚨 현장 긴급상황 발생',
                              photoUrl: compressed,
                            });
                          }
                        } catch (err) {
                          console.error(err);
                          alert('사진 불러오기에 실패했습니다.');
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* 등록 일시 & 발생 좌표 정보 */}
            <div className="text-xs text-slate-300 space-y-1 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">등록 일시:</span>
                <span className="text-slate-200 font-semibold">{selectedAlert.createdFormatted}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-slate-400 font-sans">발생 좌표:</span>
                <span className="text-slate-300">
                  {selectedAlert.latitude.toFixed(6)}, {selectedAlert.longitude.toFixed(6)}
                </span>
              </div>
            </div>

            {/* 하단 버튼 (닫기, 내용 저장, 해제/삭제) */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="px-4 h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs active:scale-95 transition-all shrink-0"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isSavingAlert}
                onClick={async () => {
                  if (!selectedAlert) return;
                  setIsSavingAlert(true);
                  try {
                    const updated: EmergencyAlert = {
                      ...selectedAlert,
                      message: alertMessage.trim() || '🚨 현장 긴급상황 발생',
                      photoUrl: alertPhotoUrl || '',
                    };
                    if (onUpdateAlert) {
                      await onUpdateAlert(updated);
                    }
                    setSelectedAlert(updated);
                    alert('경광등 내용이 저장되었습니다.');
                  } catch (err) {
                    console.error('Failed to update alert:', err);
                    alert('저장 중 오류가 발생했습니다.');
                  } finally {
                    setIsSavingAlert(false);
                  }
                }}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/50 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSavingAlert ? '저장 중...' : '내용 저장'}
              </button>
              {onDeleteAlert && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      window.confirm(
                        '이 긴급상황 경광등 핀을 지도에서 해제(삭제)하시겠습니까?\n\n(상황 종료 시 모든 사용자의 화면에서 즉시 제거됩니다.)'
                      )
                    ) {
                      await onDeleteAlert(selectedAlert.id);
                      setSelectedAlert(null);
                    }
                  }}
                  className="px-4 h-12 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 active:scale-95 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  해제(삭제)
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 5. 배수로 선택 바텀시트 (Apple Maps 스타일) */}
      {selectedDitch && (
        <div className="absolute bottom-0 inset-x-0 z-30 p-2.5 sm:p-4 max-w-lg mx-auto">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl text-white space-y-3 animate-in slide-in-from-bottom duration-200">
            {/* Apple 상단 스와이프 핸들 바 */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-1 mb-1" />

            {/* 상단 닫기 & 상태 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black bg-white/10 px-2 py-0.5 rounded-lg text-slate-200">
                  {selectedDitch.code.replace(/(주차장|도로)/g, '정자 앞')}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    selectedDitch.currentStatus === 'GOOD'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : selectedDitch.currentStatus === 'WARNING'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {selectedDitch.currentStatus === 'GOOD'
                    ? '정상'
                    : selectedDitch.currentStatus === 'WARNING'
                    ? '주의'
                    : '긴급'}
                </span>
              </div>
              <button
                onClick={() => onSelectDitch(null)}
                className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 배수로 명칭 및 제원 정보 */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  {selectedDitch.name.replace(/(주차장|도로)/g, '정자 앞')}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getSectionTheme(getNormalizedSection(selectedDitch)).badgeBg} ${getSectionTheme(getNormalizedSection(selectedDitch)).badgeBorder} ${getSectionTheme(getNormalizedSection(selectedDitch)).badgeText}`}>
                  {getSectionTheme(getNormalizedSection(selectedDitch)).label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {(selectedDitch.address || selectedDitch.section || '').replace(/(주차장|도로)/g, '정자 앞')}
              </p>
              <div className="flex gap-3 text-[11px] text-slate-300 mt-1 font-medium">
                <span>규격: {selectedDitch.dimension}</span>
                <span>•</span>
                <span>최근 점검: {selectedDitch.lastInspectedAt || '미점검'}</span>
              </div>

              {/* ⚠️ 장기 미점검 경고 배너 */}
              {(() => {
                const overdue = getDitchOverdueInfo(selectedDitch, 14);
                if (!overdue.isOverdue) return null;
                return (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/80 flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex-1">
                      <div className="font-black text-amber-300 flex items-center justify-between">
                        <span>장기 미점검 방치 경고</span>
                        <span className="text-[10px] bg-amber-900 px-1.5 py-0.5 rounded text-amber-200 font-bold">
                          {overdue.daysElapsed === 999 ? '점검 이력 없음' : `${overdue.daysElapsed}일 경과`}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300/80 mt-0.5 leading-snug">
                        정기 안전점검 주기(14일)를 초과하였습니다. 원활한 배수와 침수 예방을 위해 즉시 점검을 실시해 주십시오.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 액션 버튼 그룹 */}
            {userRole === 'INSPECTOR' ? (
              // [주사님 모드]: 5초 패스트패스 & 상세점검
              <div className="space-y-2 pt-1">
                {onFastPassInspection && (
                  <button
                    type="button"
                    disabled={isFastPassing}
                    onClick={async () => {
                      setIsFastPassing(true);
                      try {
                        await onFastPassInspection(selectedDitch);
                        confetti({
                          particleCount: 65,
                          spread: 65,
                          origin: { y: 0.8 },
                        });
                      } catch (err) {
                        console.error('Fast pass error:', err);
                        alert('점검 저장 중 문제가 발생했습니다.');
                      } finally {
                        setIsFastPassing(false);
                      }
                    }}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-96 transition-all"
                  >
                    <Zap className="w-5 h-5 text-slate-950 fill-current" />
                    <span>{isFastPassing ? '저장 중...' : '⚡ 5초 패스트패스 (전부 정상 즉시 완료)'}</span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      onOpenInspectionForm
                        ? onOpenInspectionForm(selectedDitch)
                        : onStartInspection(selectedDitch)
                    }
                    className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow active:scale-96 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-200" />
                    상세 점검 (사진/체크)
                  </button>
                  <button
                    onClick={() => onViewHistory(selectedDitch)}
                    className="h-11 bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 border border-white/10 active:scale-96 transition-all"
                  >
                    <History className="w-4 h-4 text-emerald-400" />
                    과거 점검 이력
                  </button>
                </div>
              </div>
            ) : (
              // [관리자 모드]: 5초 패스트패스 & 점검/수정
              <div className="space-y-2 pt-1">
                {onFastPassInspection && (
                  <button
                    type="button"
                    disabled={isFastPassing}
                    onClick={async () => {
                      setIsFastPassing(true);
                      try {
                        await onFastPassInspection(selectedDitch);
                        confetti({
                          particleCount: 65,
                          spread: 65,
                          origin: { y: 0.8 },
                        });
                      } catch (err) {
                        console.error('Fast pass error:', err);
                        alert('점검 저장 중 문제가 발생했습니다.');
                      } finally {
                        setIsFastPassing(false);
                      }
                    }}
                    className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-96 transition-all"
                  >
                    <Zap className="w-4 h-4 text-slate-950 fill-current" />
                    <span>{isFastPassing ? '저장 중...' : '⚡ 5초 패스트패스 (전부 정상 즉시 완료)'}</span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      onOpenInspectionForm
                        ? onOpenInspectionForm(selectedDitch)
                        : onStartInspection(selectedDitch)
                    }
                    className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 active:scale-96 shadow transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-200" />
                    상세 점검
                  </button>
                  <button
                    onClick={() => onEditDitch(selectedDitch)}
                    className="h-11 bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 border border-white/10 active:scale-96 transition-all"
                  >
                    <Edit className="w-4 h-4" />
                    정보 수정
                  </button>
                </div>
                <button
                  onClick={() => onViewHistory(selectedDitch)}
                  className="w-full h-10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 border border-white/10 active:scale-96 transition-all"
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
      <GpsHelpModal
        isOpen={showGpsHelpModal}
        onClose={() => setShowGpsHelpModal(false)}
        onRetryGps={onRetryGps}
        gpsErrorMsg={gpsErrorMsg}
        currentGps={currentGps}
      />

      {/* 6. 긴급상황 현장 사진 원본 확대보기 모달 */}
      {enlargedAlertPhoto && (

        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setEnlargedAlertPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[92vh] flex flex-col items-center bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 헤더 바 */}
            <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-rose-600 text-white flex items-center justify-center">
                  <Siren className="w-4 h-4" />
                </span>
                <span className="font-black text-sm text-rose-300">🚨 긴급상황 현장 사진 확대보기</span>
              </div>
              <button
                type="button"
                onClick={() => setEnlargedAlertPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 원본 사진 영역 */}
            <div className="w-full flex-1 overflow-auto p-2 bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={enlargedAlertPhoto}
                alt="긴급상황 현장 사진 원본"
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-lg shadow-lg select-none"
              />
            </div>

            {/* 하단 닫기 바 */}
            <div className="w-full px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">터치 시 확대 사진이 닫힙니다.</span>
              <button
                type="button"
                onClick={() => setEnlargedAlertPhoto(null)}
                className="px-4 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 배수로 번호 순번 점검 리스트 뷰 (지도를 보지 않고 번호로 점검하는 전용 화면) */}
      {viewMode === 'list' && (
        <div className="absolute inset-0 z-30">
          <DrainNumberListView
            ditches={ditches}
            selectedSections={selectedSections}
            onSelectSection={(sec) => {
              setSelectedSections((prev) =>
                prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
              );
            }}
            onSelectAllSections={() => setSelectedSections(ALL_SECTIONS)}
            onClearSections={() => setSelectedSections([])}
            onOpenInspectionForm={(ditch) => {
              onSelectDitch(ditch);
              if (onOpenInspectionForm) onOpenInspectionForm(ditch);
              else onStartInspection(ditch);
            }}
            onFastPassInspection={onFastPassInspection}
            onViewHistory={(ditch) => {
              onSelectDitch(ditch);
              onViewHistory(ditch);
            }}
            onSwitchToMap={(targetDitch) => {
              setViewMode('map');
              try {
                localStorage.setItem('drainmanager_view_mode', 'map');
              } catch {}
              if (targetDitch) {
                onSelectDitch(targetDitch);
              }
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.invalidateSize();
                  if (targetDitch) {
                    mapRef.current.flyTo([targetDitch.latitude, targetDitch.longitude], 19, {
                      duration: 1.0,
                    });
                  }
                }
              }, 100);
            }}
            userRole={userRole}
            onGoHome={onGoHome}
          />
        </div>
      )}
    </div>
  );
};

