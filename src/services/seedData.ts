import { DitchMaster, InspectionRecord } from '../types';

// 기본 데모용 배수로 마스터 데이터 (수도권 인근 농경지/도로 배수로 좌표 예시)
export const INITIAL_DITCHES: DitchMaster[] = [
  {
    id: 'ditch-001',
    code: 'DRAIN-001',
    name: '갈현리 204번지 농로 U자형 배수로',
    section: '1공구 농경지구간',
    dimension: 'U형 B=0.8m, H=0.8m',
    latitude: 37.7652,
    longitude: 126.7725,
    currentStatus: 'GOOD',
    lastInspectedAt: '2026-10-08 14:30',
    address: '경기도 파주시 탄현면 갈현리 204',
    memo: '상류부 농업용 수로 연결지점. 통수 단면 양호.',
    createdAt: '2026-03-01 09:00',
  },
  {
    id: 'ditch-002',
    code: 'DRAIN-002',
    name: '금승리 외곽도로 암거 배수로 유입구',
    section: '2공구 도로변구간',
    dimension: '벤치플륨관 1.0m',
    latitude: 37.7812,
    longitude: 126.7891,
    currentStatus: 'WARNING',
    lastInspectedAt: '2026-10-09 11:15',
    address: '경기도 파주시 탄현면 금승리 산 15',
    memo: '토사 유입으로 단면 40% 퇴적됨. 우기 전 준설 검토 필요.',
    createdAt: '2026-03-01 09:00',
  },
  {
    id: 'ditch-003',
    code: 'DRAIN-003',
    name: '축현리 158번지 농로 합류 박스배수로',
    section: '1공구 농경지구간',
    dimension: 'PC암거 1.2m x 1.2m',
    latitude: 37.7538,
    longitude: 126.7954,
    currentStatus: 'DANGER',
    lastInspectedAt: '2026-10-10 16:40',
    address: '경기도 파주시 탄현면 축현리 158',
    memo: '측벽 콘크리트 균열 및 사면 토사 붕괴로 수로 완전 차단 위험.',
    createdAt: '2026-03-02 10:00',
  },
  {
    id: 'ditch-004',
    code: 'DRAIN-004',
    name: '오금리 52번지 논둑 사면 배수구',
    section: '3공구 취약구간',
    dimension: 'U형 플륨관 0.6m',
    latitude: 37.7421,
    longitude: 126.7648,
    currentStatus: 'GOOD',
    lastInspectedAt: '2026-10-05 10:20',
    address: '경기도 파주시 탄현면 오금리 52',
    memo: '농번기 통수 원활, 제초 작업 완료됨.',
    createdAt: '2026-03-05 13:00',
  },
  {
    id: 'ditch-005',
    code: 'DRAIN-005',
    name: '성동리 통일동산 후면 산마루측구',
    section: '2공구 도로변구간',
    dimension: 'V형 산마루측구 1.0m',
    latitude: 37.7945,
    longitude: 126.7012,
    currentStatus: 'WARNING',
    lastInspectedAt: '2026-10-07 15:50',
    address: '경기도 파주시 탄현면 성동리 산 2-1',
    memo: '가을철 낙엽 및 잔가지 집중 퇴적. 강우 시 범람 우려.',
    createdAt: '2026-03-10 11:00',
  },
];

// 샘플 현장 사진 SVG (Canvas/Image 대응 Data URL)
function createSampleDrainSvg(title: string, color: string, statusText: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="#334155" />
    <polygon points="120,480 200,200 440,200 520,480" fill="#64748b" />
    <polygon points="200,200 240,120 400,120 440,200" fill="#475569" />
    <!-- 배수로 흐름/콘크리트 라인 -->
    <path d="M 160 480 L 220 200 M 480 480 L 420 200" stroke="#94a3b8" stroke-width="4" stroke-dasharray="8 8" />
    <path d="M 230 480 L 270 200 M 410 480 L 370 200" stroke="${color}" stroke-width="6" />
    <!-- 주변 잔디/흙 -->
    <rect x="0" y="0" width="200" height="480" fill="#4ade80" opacity="0.25" />
    <rect x="440" y="0" width="200" height="480" fill="#4ade80" opacity="0.25" />
    <!-- 상단 라벨 배너 -->
    <rect x="20" y="20" width="600" height="80" rx="8" fill="#0f172a" opacity="0.85" />
    <text x="40" y="55" font-family="sans-serif" font-size="20" font-weight="bold" fill="#f8fafc">${title}</text>
    <text x="40" y="85" font-family="sans-serif" font-size="14" fill="#cbd5e1">현장 상태 판정: ${statusText}</text>
    <circle cx="580" cy="60" r="14" fill="${color}" />
    <!-- 하단 워터마크 -->
    <rect x="20" y="420" width="600" height="40" rx="4" fill="#000000" opacity="0.75" />
    <text x="35" y="445" font-family="sans-serif" font-size="13" fill="#ffffff">[점검기록 샘플 사진 | 공공 배수로 현장점검단]</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const INITIAL_INSPECTIONS: InspectionRecord[] = [
  {
    id: 'insp-001-1',
    ditchId: 'ditch-001',
    inspectedAt: '2026-10-08 14:30',
    inspectorName: '김철수 주사',
    sedimentStatus: '정상(<30%)',
    structureStatus: '정상',
    urgencyLevel: '정기점검',
    memo: '수로 내부 퇴적물 거의 없음. 콘크리트 상태 건전.',
    photoCurrentUrl: createSampleDrainSvg('갈현리 204번지 농로', '#22c55e', '정상'),
    gpsAccuracy: 3.2,
    latitude: 37.7652,
    longitude: 126.7725,
  },
  {
    id: 'insp-002-1',
    ditchId: 'ditch-002',
    inspectedAt: '2026-10-09 11:15',
    inspectorName: '이영희 주사',
    sedimentStatus: '준설필요(>30%)',
    structureStatus: '정상',
    urgencyLevel: '정기점검',
    memo: '인근 사면 토사 흘러내림으로 유입구에 모래 및 낙엽 다량 퇴적. 11월 전 준설 권고.',
    photoCurrentUrl: createSampleDrainSvg('금승리 외곽도로 암거 배수로', '#f59e0b', '주의 (준설요망)'),
    gpsAccuracy: 4.1,
    latitude: 37.7812,
    longitude: 126.7891,
  },
  {
    id: 'insp-003-1',
    ditchId: 'ditch-003',
    inspectedAt: '2026-10-10 16:40',
    inspectorName: '박민우 주사',
    sedimentStatus: '완전막힘',
    structureStatus: '균열/이탈',
    urgencyLevel: '긴급조치',
    memo: '강우 시 역류 발생 확인. 콘크리트 측벽 이탈로 토사 유입 심각. 신속한 중장비 준설 및 보수 요청.',
    photoCurrentUrl: createSampleDrainSvg('축현리 158번지 농로 합류 박스배수로', '#ef4444', '긴급조치 필요'),
    gpsAccuracy: 2.8,
    latitude: 37.7538,
    longitude: 126.7954,
  },
];
