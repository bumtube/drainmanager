import React, { useState, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  History,
  Zap,
  MapPin,
  Map,
  Sparkles,
  Layers,
  ArrowUp,
  X,
  ListOrdered,
  Camera,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DitchMaster } from '../types';
import {
  SECTION_COLOR_CONFIG,
  getSectionTheme,
  getNormalizedSection,
  ALL_SECTIONS,
} from '../utils/sectionTheme';
import { extractDitchNumber } from '../utils/ditchNumber';

// 햅틱 진동 피드백
const triggerHaptic = (pattern: number | number[] = 15) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // 무시
    }
  }
};

// 14일 경과 미점검 계산
function getOverdueStatus(ditch: DitchMaster, thresholdDays = 14) {
  if (!ditch.lastInspectedAt) {
    return { isOverdue: true, days: 999, label: '점검 이력 없음' };
  }
  const lastDate = new Date(ditch.lastInspectedAt.replace(' ', 'T'));
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return {
    isOverdue: diffDays >= thresholdDays,
    days: diffDays,
    label: `${diffDays}일 전 점검`,
  };
}

interface DrainNumberListViewProps {
  ditches: DitchMaster[];
  selectedSections: string[];
  onSelectSection: (section: string) => void;
  onSelectAllSections: () => void;
  onClearSections: () => void;
  onOpenInspectionForm: (ditch: DitchMaster) => void;
  onFastPassInspection?: (ditch: DitchMaster) => Promise<void> | void;
  onViewHistory: (ditch: DitchMaster) => void;
  onSwitchToMap: (targetDitch?: DitchMaster, mapType?: 'streets' | 'satellite') => void;
  userRole?: string;
  onGoHome?: () => void;
}

export const DrainNumberListView: React.FC<DrainNumberListViewProps> = ({
  ditches,
  selectedSections,
  onSelectSection,
  onSelectAllSections,
  onClearSections,
  onOpenInspectionForm,
  onFastPassInspection,
  onViewHistory,
  onSwitchToMap,
  onGoHome,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [fastPassingId, setFastPassingId] = useState<string | null>(null);
  const [successModalDitch, setSuccessModalDitch] = useState<DitchMaster | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // 필터링 및 번호순 정렬된 배수로 목록
  const filteredAndSortedDitches = useMemo(() => {
    let result = ditches.filter((ditch) => {
      // 1. 구역 필터
      const normSec = getNormalizedSection(ditch);
      if (selectedSections.length > 0 && !selectedSections.includes(normSec)) {
        return false;
      }
      // 2. 미점검 전용 필터
      if (onlyOverdue) {
        const { isOverdue } = getOverdueStatus(ditch, 14);
        if (!isOverdue) return false;
      }
      // 3. 검색어 필터 (배수로 번호, 명칭, 위치)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const numStr = String(extractDitchNumber(ditch.name, ditch.code));
        const nameMatch = ditch.name.toLowerCase().includes(q);
        const codeMatch = ditch.code.toLowerCase().includes(q);
        const addrMatch = (ditch.address || '').toLowerCase().includes(q);
        const numMatch = numStr === q || `${numStr}번` === q;
        if (!nameMatch && !codeMatch && !addrMatch && !numMatch) {
          return false;
        }
      }
      return true;
    });

    // 구역 우선 정렬 후 번호(1번, 2번...) 오름차순 정렬
    const sectionOrder: Record<string, number> = {
      '정자 앞': 1,
      '본관3층': 2,
      '본관4층': 3,
      '별관': 4,
      '식수': 5,
    };

    result.sort((a, b) => {
      const secA = sectionOrder[getNormalizedSection(a)] || 99;
      const secB = sectionOrder[getNormalizedSection(b)] || 99;
      if (secA !== secB) return secA - secB;
      const numA = extractDitchNumber(a.name, a.code);
      const numB = extractDitchNumber(b.name, b.code);
      return numA - numB;
    });

    return result;
  }, [ditches, selectedSections, onlyOverdue, searchQuery]);

  // 현재 필터된 목록에 존재하는 고유 번호 목록 (퀵 다이얼 버튼용)
  const availableNumbers = useMemo(() => {
    const nums = new Set<number>();
    filteredAndSortedDitches.forEach((d) => {
      nums.add(extractDitchNumber(d.name, d.code));
    });
    return Array.from(nums).sort((a, b) => a - b);
  }, [filteredAndSortedDitches]);

  // 특정 배수로 카드로 부드럽게 스크롤 점프
  const scrollToDitch = (ditchId: string) => {
    triggerHaptic(15);
    setHighlightedId(ditchId);
    const element = document.getElementById(`ditch-card-${ditchId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedId(null);
    }, 2000);
  };

  // 상단으로 스크롤 이동
  const scrollToTop = () => {
    triggerHaptic(10);
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      ref={listContainerRef}
      className="w-full h-full bg-slate-950 flex flex-col overflow-y-auto select-none pb-24"
    >
      {/* 1. 상단 컨트롤 바 (고정 헤더) */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-slate-900/90 border-b border-white/10 p-3 space-y-2.5 shadow-lg">
        {/* 상단 컨트롤 바: 구역 필터 & 우측 3-way [일반지도 | 위성지도 | 목록 뷰] 세그먼트 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* 구역 선택 필터 (3열 2행 모바일 그리드 / PC 1열) */}
          <div className="order-2 sm:order-1 grid grid-cols-3 sm:flex sm:items-center gap-1.5 py-0.5">
            {/* 전체 버튼 */}
            {(() => {
              const isAllSelected = selectedSections.length === ALL_SECTIONS.length;
              const allTheme = SECTION_COLOR_CONFIG['전체'];
              return (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    if (isAllSelected) {
                      onClearSections();
                    } else {
                      onSelectAllSections();
                    }
                  }}
                  className={`w-full sm:w-auto px-2 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center gap-1 ${
                    isAllSelected
                      ? allTheme.btnActive
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  <span>전체</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-black/40">
                    {ditches.length}
                  </span>
                </button>
              );
            })()}

            {/* 개별 5개 구역 */}
            {ALL_SECTIONS.map((sec) => {
              const isSelected = selectedSections.includes(sec);
              const count = ditches.filter((d) => getNormalizedSection(d) === sec).length;
              const theme = SECTION_COLOR_CONFIG[sec];
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    onSelectSection(sec);
                  }}
                  className={`w-full sm:w-auto px-2 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center gap-1 ${
                    isSelected
                      ? theme.btnActive
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  <span>{sec}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-black/40">
                    {count}
                  </span>
                </button>
              );
            })}

            {/* ⚠️ 14일 경과 시설물 전용 필터 칩 */}
            {(() => {
              const overdueCount = ditches.filter((d) => getOverdueStatus(d, 14).isOverdue).length;
              if (overdueCount === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setOnlyOverdue((prev) => !prev);
                  }}
                  className={`w-full sm:w-auto px-2 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 flex items-center justify-center gap-1 ${
                    onlyOverdue
                      ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/80 ring-2 ring-amber-400/40'
                      : 'bg-amber-950/30 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
                  }`}
                  title="14일 이상 점검하지 않은 장기미점검 시설물만 보기"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>14일 경과</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-950 text-amber-200">
                    {overdueCount}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* 우측 상단: Apple 스타일 3-way 세그먼트 컨트롤 [일반지도 | 위성지도 | 목록 뷰] */}
          <div className="order-1 sm:order-2 self-end sm:self-auto bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 flex items-center gap-1 shadow-xl shrink-0">
            {/* 1. 일반지도 */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onSwitchToMap(undefined, 'streets');
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 text-slate-400 hover:text-white"
              title="일반 도로/지적 지도 보기"
            >
              <Map className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">일반지도</span>
              <span className="sm:hidden">일반</span>
            </button>

            {/* 2. 위성지도 */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onSwitchToMap(undefined, 'satellite');
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 text-slate-400 hover:text-white"
              title="고해상도 항공 위성 사진 보기"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">위성지도</span>
              <span className="sm:hidden">위성</span>
            </button>

            {/* 3. 목록 뷰 (현재 선택됨) */}
            <button
              type="button"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all bg-emerald-500 text-slate-950 shadow-md font-black"
              title="배수로 번호 순번 점검 목록 (현재 화면)"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">목록 뷰</span>
              <span className="sm:hidden">목록</span>
            </button>
          </div>
        </div>

        {/* 4. 🔢 퀵 번호 다이얼 바 (1번, 2번, 3번... 원터치 점프) */}
        {availableNumbers.length > 0 && (
          <div className="pt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[10px] font-black text-slate-400 shrink-0 flex items-center gap-1">
              <span>빠른 번호:</span>
            </span>
            {availableNumbers.map((num) => {
              // 해당 번호의 첫 번째 배수로 찾기
              const targetDitch = filteredAndSortedDitches.find(
                (d) => extractDitchNumber(d.name, d.code) === num
              );
              if (!targetDitch) return null;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => scrollToDitch(targetDitch.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-black bg-white/5 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border border-white/10 active:scale-90 transition-all shrink-0"
                  title={`${num}번 배수로로 이동`}
                >
                  #{num}번
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. 메인 배수로 카드 리스트 */}
      <div className="p-3 sm:p-4 max-w-2xl mx-auto w-full space-y-3">
        {filteredAndSortedDitches.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-slate-900/50 border border-white/5 rounded-2xl p-6">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">
              선택한 조건의 배수로가 없습니다.
            </h3>
            <p className="text-xs text-slate-500">
              구역 필터를 변경하거나 14일 경과 필터를 해제해보세요.
            </p>
            <button
              type="button"
              onClick={() => {
                onSelectAllSections();
                setSearchQuery('');
                setOnlyOverdue(false);
              }}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
            >
              전체 구역 다시 보기
            </button>
          </div>
        ) : (
          filteredAndSortedDitches.map((ditch) => {
            const num = extractDitchNumber(ditch.name, ditch.code);
            const sec = getNormalizedSection(ditch);
            const theme = getSectionTheme(sec);
            const overdue = getOverdueStatus(ditch, 14);
            const isHighlighted = highlightedId === ditch.id;
            const todayStr = new Date().toISOString().slice(0, 10);
            const isDoneToday = Boolean(ditch.lastInspectedAt && ditch.lastInspectedAt.startsWith(todayStr));

            return (
              <div
                key={ditch.id}
                id={`ditch-card-${ditch.id}`}
                className={`border rounded-2xl p-3.5 sm:p-4 shadow-lg transition-all ${
                  isHighlighted
                    ? 'border-emerald-400 ring-4 ring-emerald-500/40 scale-[1.02] bg-slate-850'
                    : isDoneToday
                    ? 'bg-slate-900/50 border-white/5 opacity-80 hover:opacity-100'
                    : 'bg-slate-900/90 border-white/10 hover:border-white/20'
                }`}
              >
                {/* 상단: 번호 뱃지 & 구역명 & 상태 */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    {/* 큼직한 번호 뱃지 */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-black shadow-md border ${
                        theme.badgeStyle || 'bg-slate-800 border-white/20 text-white'
                      }`}
                    >
                      <span className="text-[10px] leading-none opacity-80">No.</span>
                      <span className="text-base sm:text-lg leading-tight font-black">
                        {num}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}
                        >
                          {sec}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {ditch.code.replace(/(주차장|도로)/g, '정자 앞')}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                        {ditch.name.replace(/(주차장|도로)/g, '정자 앞')}
                      </h3>
                    </div>
                  </div>

                  {/* 점검 상태 뱃지 (체크오프 시각화) */}
                  <div>
                    {isDoneToday ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                        <span>✓ 오늘 점검 완료</span>
                      </span>
                    ) : overdue.isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>14일 경과</span>
                      </span>
                    ) : ditch.currentStatus === 'GOOD' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 text-slate-300 border border-white/10">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>통수 양호</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>조치 필요</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 위치 & 직전 점검 정보 */}
                <div className="bg-slate-950/60 rounded-xl p-2.5 text-xs space-y-1 mb-3 border border-white/5">
                  <div className="text-slate-300 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {ditch.address || `${sec} 일원`} ({ditch.dimension || 'U형 배수로'})
                    </span>
                  </div>
                  <div className="text-slate-400 flex items-center justify-between text-[11px] pt-0.5 border-t border-white/5">
                    <span>
                      최근 점검: {ditch.lastInspectedAt || '기록 없음'}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {overdue.label}
                    </span>
                  </div>
                </div>

                {/* 대형 원터치 점검 버튼 및 액션 버튼들 (직관적 명칭 분리) */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* 1. 🟢 정상 즉시 완료 (원터치 패스트패스 - 70% 메인) */}
                    {onFastPassInspection && (
                      <button
                        type="button"
                        disabled={fastPassingId === ditch.id}
                        onClick={async () => {
                          triggerHaptic([30, 80, 40]);
                          setFastPassingId(ditch.id);
                          try {
                            await onFastPassInspection(ditch);
                            confetti({
                              particleCount: 65,
                              spread: 65,
                              origin: { y: 0.8 },
                            });
                            setSuccessModalDitch(ditch);
                            setTimeout(() => {
                              setSuccessModalDitch(null);
                            }, 1200);
                          } catch (err) {
                            console.error('Fast pass error:', err);
                            alert('점검 저장 중 문제가 발생했습니다.');
                          } finally {
                            setFastPassingId(null);
                          }
                        }}
                        className={`sm:col-span-2 h-12 rounded-xl flex items-center justify-center gap-2 font-black text-sm sm:text-base active:scale-95 transition-all shadow-md ${
                          isDoneToday
                            ? 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 shadow-emerald-950/40'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                        <span>
                          {fastPassingId === ditch.id
                            ? '저장 중...'
                            : isDoneToday
                            ? '✓ 오늘 점검 완료됨 (재점검)'
                            : '🟢 정상 즉시 완료'}
                        </span>
                      </button>
                    )}

                    {/* 2. 📷 사진/이상 등록 (상세 폼 열기 - 30% 서브) */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(15);
                        onOpenInspectionForm(ditch);
                      }}
                      className={`h-12 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                        !onFastPassInspection ? 'col-span-full' : ''
                      }`}
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>📷 사진/이상 등록</span>
                    </button>
                  </div>

                  {/* 보조 버튼: 과거 이력 & 지도에서 위치 확인 */}
                  <div className="flex items-center justify-between pt-1 text-xs px-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        onViewHistory(ditch);
                      }}
                      className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-medium"
                    >
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>과거 점검 이력</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        onSwitchToMap(ditch);
                      }}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold underline underline-offset-4"
                    >
                      <span>지도에서 위치 보기</span>
                      <span>➔</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 맨 위로 가기 플로팅 버튼 */}
      <button
        type="button"
        onClick={scrollToTop}
        className="fixed bottom-6 right-5 w-11 h-11 rounded-2xl bg-slate-900/90 border border-white/15 text-slate-300 hover:text-white flex items-center justify-center shadow-2xl backdrop-blur-xl active:scale-90 transition-all z-20"
        title="목록 맨 위로 스크롤"
      >
        <ArrowUp className="w-5 h-5 text-emerald-400" />
      </button>

      {/* Apple Pay 스타일 완료 알림 모달 오버레이 */}
      {successModalDitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none animate-in fade-in duration-200">
          <div className="bg-slate-900/95 border border-emerald-500/40 backdrop-blur-2xl px-7 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3 text-center transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-white font-black text-lg">
                {getNormalizedSection(successModalDitch)} #{extractDitchNumber(successModalDitch.name, successModalDitch.code)}번
              </div>
              <div className="text-emerald-400 font-bold text-sm mt-0.5">
                정상 점검 완료!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
