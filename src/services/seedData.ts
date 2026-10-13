import { DitchMaster, InspectionRecord } from '../types';

// 기본 초기 데모 배수로 데이터 (성남시 분당구 불정로 50 부지: 주차장, 본관, 별관)
export const INITIAL_DITCHES: DitchMaster[] = [
  {
    id: 'ditch-001',
    code: 'DRAIN-주차장-1',
    name: '주차장-1',
    section: '주차장',
    dimension: 'U형 0.6m',
    latitude: 37.35742,
    longitude: 127.11225,
    currentStatus: 'GOOD',
    lastInspectedAt: '2026-10-10 14:30',
    address: '경기도 성남시 분당구 불정로 50 (주차장 진입로)',
    memo: '주차장 빗물받이 연결 수로. 통수 상태 양호.',
    createdAt: '2026-03-01 09:00',
  },
  {
    id: 'ditch-002',
    code: 'DRAIN-본관-1',
    name: '본관-1',
    section: '본관',
    dimension: '벤치플륨관 0.8m',
    latitude: 37.35760,
    longitude: 127.11248,
    currentStatus: 'WARNING',
    lastInspectedAt: '2026-10-11 11:15',
    address: '경기도 성남시 분당구 불정로 50 (본관 측면 화단)',
    memo: '낙엽 및 토사 유입으로 수로 일부 퇴적. 준설 권고.',
    createdAt: '2026-03-01 09:00',
  },
  {
    id: 'ditch-003',
    code: 'DRAIN-별관-1',
    name: '별관-1',
    section: '별관',
    dimension: 'U형 0.8m',
    latitude: 37.35771,
    longitude: 127.11232,
    currentStatus: 'DANGER',
    lastInspectedAt: '2026-10-12 09:40',
    address: '경기도 성남시 분당구 불정로 50 (별관 뒤편 사면)',
    memo: '사면 토사 유입으로 수로 통수 단면 차단 위험. 긴급 조치 필요.',
    createdAt: '2026-03-02 10:00',
  },
];

// 샘플 현장 사진 SVG (Canvas/Image 대응 Data URL)
function createSampleDrainSvg(title: string, color: string, statusText: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="#334155" />
    <polygon points="120,480 200,200 440,200 520,480" fill="#64748b" />
    <polygon points="200,200 240,120 400,120 440,200" fill="#475569" />
    <path d="M 160 480 L 220 200 M 480 480 L 420 200" stroke="#94a3b8" stroke-width="4" stroke-dasharray="8 8" />
    <path d="M 230 480 L 270 200 M 410 480 L 370 200" stroke="${color}" stroke-width="6" />
    <rect x="0" y="0" width="200" height="480" fill="#4ade80" opacity="0.25" />
    <rect x="440" y="0" width="200" height="480" fill="#4ade80" opacity="0.25" />
    <rect x="20" y="20" width="600" height="80" rx="8" fill="#0f172a" opacity="0.85" />
    <text x="40" y="55" font-family="sans-serif" font-size="20" font-weight="bold" fill="#f8fafc">${title}</text>
    <text x="40" y="85" font-family="sans-serif" font-size="14" fill="#cbd5e1">현장 상태 판정: ${statusText}</text>
    <circle cx="580" cy="60" r="14" fill="${color}" />
    <rect x="20" y="420" width="600" height="40" rx="4" fill="#000000" opacity="0.75" />
    <text x="35" y="445" font-family="sans-serif" font-size="13" fill="#ffffff">[성남시 분당구 불정로 50 현장점검단]</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const INITIAL_INSPECTIONS: InspectionRecord[] = [
  {
    id: 'insp-001-1',
    ditchId: 'ditch-001',
    inspectedAt: '2026-10-10 14:30',
    inspectorName: '김철수 주사',
    sedimentStatus: '정상(<30%)',
    structureStatus: '정상',
    urgencyLevel: '정기점검',
    memo: '주차장 진입로 배수로 통수 이상 없음.',
    photoCurrentUrl: createSampleDrainSvg('주차장 배수로 1호', '#22c55e', '정상'),
    gpsAccuracy: 2.5,
    latitude: 37.35742,
    longitude: 127.11225,
  },
  {
    id: 'insp-002-1',
    ditchId: 'ditch-002',
    inspectedAt: '2026-10-11 11:15',
    inspectorName: '이영희 주사',
    sedimentStatus: '준설필요(>30%)',
    structureStatus: '정상',
    urgencyLevel: '정기점검',
    memo: '화단 흙 유입으로 준설 필요.',
    photoCurrentUrl: createSampleDrainSvg('본관 정면 배수로', '#f59e0b', '주의 (준설요망)'),
    gpsAccuracy: 3.1,
    latitude: 37.35760,
    longitude: 127.11248,
  },
  {
    id: 'insp-003-1',
    ditchId: 'ditch-003',
    inspectedAt: '2026-10-12 09:40',
    inspectorName: '박민우 주사',
    sedimentStatus: '완전막힘',
    structureStatus: '균열/이탈',
    urgencyLevel: '긴급조치',
    memo: '별관 뒤편 배수로 토사 붕괴로 수로 막힘. 긴급 정비 요청.',
    photoCurrentUrl: createSampleDrainSvg('별관 뒤편 배수로', '#ef4444', '긴급조치 필요'),
    gpsAccuracy: 2.1,
    latitude: 37.35771,
    longitude: 127.11232,
  },
];
