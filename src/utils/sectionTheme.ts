export interface SectionColorMeta {
  name: string;
  label: string;
  colorHex: string; // 핀 마커 및 채움 고유 색상
  borderColor: string;
  badgeBg: string; // 지도 핀 상단 미니 뱃지 배경
  badgeBorder: string; // 뱃지 테두리
  badgeText: string; // 뱃지 글자색
  badgeStyle: string; // 뱃지 종합 스타일
  btnActive: string; // 상단 버튼 활성화 CSS
  countActive: string; // 활성화 카운트 뱃지 CSS
  dotBg: string; // 비활성화 상태 인디케이터 점
  cardBorder: string; // 대시보드 FMS 카드 테두리
  cardBadge: string; // 대시보드 뱃지
}

export const SECTION_COLOR_CONFIG: Record<string, SectionColorMeta> = {
  '전체': {
    name: '전체',
    label: '전체',
    colorHex: '#475569',
    borderColor: '#64748b',
    badgeBg: 'bg-slate-950/95',
    badgeBorder: 'border-slate-600',
    badgeText: 'text-slate-200',
    badgeStyle: 'bg-slate-950/95 border-slate-600 text-slate-200',
    btnActive: 'bg-slate-700 text-white border-slate-400 shadow-slate-950/80 ring-2 ring-slate-400/50',
    countActive: 'bg-slate-900 text-slate-100',
    dotBg: 'bg-slate-400',
    cardBorder: 'border-slate-700',
    cardBadge: 'bg-slate-800 text-slate-200',
  },
  '정자 앞': {
    name: '정자 앞',
    label: '정자 앞',
    colorHex: '#0284c7', // Sky Blue (시원한 하늘/청색)
    borderColor: '#0369a1',
    badgeBg: 'bg-sky-950/95',
    badgeBorder: 'border-sky-500/80',
    badgeText: 'text-sky-200',
    badgeStyle: 'bg-sky-950/95 border-sky-500/80 text-sky-200',
    btnActive: 'bg-sky-600 text-white border-sky-400 shadow-sky-950/80 ring-2 ring-sky-400/50',
    countActive: 'bg-sky-900 text-sky-100',
    dotBg: 'bg-sky-400',
    cardBorder: 'border-sky-500/50',
    cardBadge: 'bg-sky-900/60 text-sky-200',
  },
  '본관3층': {
    name: '본관3층',
    label: '본관3층',
    colorHex: '#4f46e5', // Indigo (안정적인 인디고/남색)
    borderColor: '#3730a3',
    badgeBg: 'bg-indigo-950/95',
    badgeBorder: 'border-indigo-500/80',
    badgeText: 'text-indigo-200',
    badgeStyle: 'bg-indigo-950/95 border-indigo-500/80 text-indigo-200',
    btnActive: 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-950/80 ring-2 ring-indigo-400/50',
    countActive: 'bg-indigo-900 text-indigo-100',
    dotBg: 'bg-indigo-400',
    cardBorder: 'border-indigo-500/50',
    cardBadge: 'bg-indigo-900/60 text-indigo-200',
  },
  '본관4층': {
    name: '본관4층',
    label: '본관4층',
    colorHex: '#9333ea', // Purple (선명하고 구분되는 보라색)
    borderColor: '#6b21a8',
    badgeBg: 'bg-purple-950/95',
    badgeBorder: 'border-purple-500/80',
    badgeText: 'text-purple-200',
    badgeStyle: 'bg-purple-950/95 border-purple-500/80 text-purple-200',
    btnActive: 'bg-purple-600 text-white border-purple-400 shadow-purple-950/80 ring-2 ring-purple-400/50',
    countActive: 'bg-purple-900 text-purple-100',
    dotBg: 'bg-purple-400',
    cardBorder: 'border-purple-500/50',
    cardBadge: 'bg-purple-900/60 text-purple-200',
  },
  '별관': {
    name: '별관',
    label: '별관',
    colorHex: '#ea580c', // Orange (밝고 따뜻한 주황색)
    borderColor: '#9a3412',
    badgeBg: 'bg-orange-950/95',
    badgeBorder: 'border-orange-500/80',
    badgeText: 'text-orange-200',
    badgeStyle: 'bg-orange-950/95 border-orange-500/80 text-orange-200',
    btnActive: 'bg-orange-600 text-white border-orange-400 shadow-orange-950/80 ring-2 ring-orange-400/50',
    countActive: 'bg-orange-900 text-orange-100',
    dotBg: 'bg-orange-400',
    cardBorder: 'border-orange-500/50',
    cardBadge: 'bg-orange-900/60 text-orange-200',
  },
  '식수': {
    name: '식수',
    label: '식수',
    colorHex: '#16a34a', // Emerald Green (자연의 초록색)
    borderColor: '#14532d',
    badgeBg: 'bg-emerald-950/95',
    badgeBorder: 'border-emerald-500/80',
    badgeText: 'text-emerald-200',
    badgeStyle: 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200',
    btnActive: 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-950/80 ring-2 ring-emerald-400/50',
    countActive: 'bg-emerald-900 text-emerald-100',
    dotBg: 'bg-emerald-400',
    cardBorder: 'border-emerald-500/50',
    cardBadge: 'bg-emerald-900/60 text-emerald-200',
  },
};

export const ALL_SECTIONS: string[] = ['정자 앞', '본관3층', '본관4층', '별관', '식수'];
export type SectionName = string;

export const getSectionTheme = (sec: string): SectionColorMeta => {
  return SECTION_COLOR_CONFIG[sec] || SECTION_COLOR_CONFIG['정자 앞'];
};

/**
 * 전역 배수로 구역명 표준 정규화 유틸리티 (단일 진실 원천)
 * 시설 명칭, 섹션, 코드, 주소, 메모를 종합 분석하여
 * ['정자 앞', '본관3층', '본관4층', '별관', '식수'] 5대 구역으로 오차 없이 분류합니다.
 */
export function getNormalizedSection(d: {
  section?: string;
  name?: string;
  code?: string;
  address?: string;
  memo?: string;
} | null | undefined): string {
  if (!d) return '정자 앞';
  const s = (d.section || '').trim();
  const n = (d.name || '').trim();
  const c = (d.code || '').trim();
  const a = (d.address || '').trim();
  const m = (d.memo || '').trim();
  const fullText = `${s} ${n} ${c} ${a} ${m}`;

  // 1. 식수 (조경수)
  if (s === '식수' || n.includes('식수') || c.includes('식수') || fullText.includes('식수')) {
    return '식수';
  }

  // 2. 별관
  if (s === '별관' || n.includes('별관') || c.includes('별관') || fullText.includes('별관')) {
    return '별관';
  }

  // 3. 본관4층 (4층 우선 판별)
  if (
    s.includes('본관4층') ||
    n.includes('본관4층') ||
    c.includes('본관4층') ||
    fullText.includes('본관4층') ||
    fullText.includes('본관 4층') ||
    fullText.includes('4층') ||
    fullText.includes('4F') ||
    fullText.includes('4f')
  ) {
    return '본관4층';
  }

  // 4. 본관3층 (또는 3층, 또는 층수 없이 '본관'만 명시된 경우 본관3층으로 분류)
  if (
    s.includes('본관3층') ||
    n.includes('본관3층') ||
    c.includes('본관3층') ||
    fullText.includes('본관3층') ||
    fullText.includes('본관 3층') ||
    s.includes('본관') ||
    n.includes('본관') ||
    c.includes('본관') ||
    fullText.includes('본관') ||
    fullText.includes('3층') ||
    fullText.includes('3F') ||
    fullText.includes('3f')
  ) {
    return '본관3층';
  }

  // 5. 정자 앞 (정자, 도로, 주차장)
  if (
    s.includes('정자') ||
    n.includes('정자') ||
    c.includes('정자') ||
    s.includes('도로') ||
    n.includes('도로') ||
    c.includes('도로') ||
    s.includes('주차장') ||
    n.includes('주차장') ||
    c.includes('주차장') ||
    fullText.includes('정자') ||
    fullText.includes('도로') ||
    fullText.includes('주차장')
  ) {
    return '정자 앞';
  }

  return s || '정자 앞';
}
