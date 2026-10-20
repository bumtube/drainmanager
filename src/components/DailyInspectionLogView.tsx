import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  User,
  Camera,
  Maximize2,
  MapPin,
  History,
  Printer,
  FileSpreadsheet,
  Trash2,
  ArrowLeft,
  ArrowRight,
  X,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { DitchMaster, InspectionRecord } from '../types';
import { getNormalizedSection, getSectionTheme } from '../utils/sectionTheme';
import { exportDitchesAndInspectionsToExcel } from '../services/excelExport';
import { MonthCalendarPickerModal } from './MonthCalendarPickerModal';

interface DailyInspectionLogViewProps {
  ditches: DitchMaster[];
  inspections: InspectionRecord[];
  isModal?: boolean;
  onClose?: () => void;
  onSelectDitchOnMap?: (ditch: DitchMaster) => void;
  onOpenHistory?: (ditch: DitchMaster) => void;
  onPrintInspection?: (ditch: DitchMaster, inspection: InspectionRecord) => void;
  onDeleteInspection?: (inspectionId: string) => Promise<void> | void;
}

export const DailyInspectionLogView: React.FC<DailyInspectionLogViewProps> = ({
  ditches,
  inspections,
  isModal = false,
  onClose,
  onSelectDitchOnMap,
  onOpenHistory,
  onPrintInspection,
  onDeleteInspection,
}) => {
  // 오늘 날짜 문자열 (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 날짜 추출 헬퍼 (YYYY-MM-DD)
  const extractDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    if (dateStr.includes(' ')) return dateStr.split(' ')[0];
    return dateStr.slice(0, 10);
  };

  // 실제 점검 기록이 존재하는 고유 일자 목록 (내림차순) 및 건수
  const availableDates = useMemo(() => {
    const map = new Map<string, number>();
    inspections.forEach((insp) => {
      const d = extractDate(insp.inspectedAt);
      if (d) {
        map.set(d, (map.get(d) || 0) + 1);
      }
    });

    const list = Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return list;
  }, [inspections]);

  // 일자별 점검 건수 Map (달력 배지 표시용)
  const inspectionCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    inspections.forEach((insp) => {
      const d = extractDate(insp.inspectedAt);
      if (d) {
        map.set(d, (map.get(d) || 0) + 1);
      }
    });
    return map;
  }, [inspections]);

  // 대화형 월간 달력 모달 열림 상태
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  // 선택된 날짜 상태 ('ALL' 또는 'YYYY-MM-DD', 기본값: 오늘 또는 가장 최근 점검일)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // 오늘 기록이 있으면 오늘, 없으면 가장 최신 점검일, 그것도 없으면 오늘
    return todayStr;
  });

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GOOD' | 'WARNING' | 'DANGER'>('ALL');
  const [onlyWithPhoto, setOnlyWithPhoto] = useState<boolean>(false);

  // 사진 확대 모달 상태
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    url: string;
    ditchName: string;
    inspectedAt: string;
    inspector: string;
  } | null>(null);

  // 배수로 맵 매핑 (빠른 조회를 위한 Map)
  const ditchMap = useMemo(() => {
    const map = new Map<string, DitchMaster>();
    ditches.forEach((d) => map.set(d.id, d));
    return map;
  }, [ditches]);

  // 필터링된 점검 목록
  const filteredInspections = useMemo(() => {
    return inspections.filter((insp) => {
      // 1. 날짜 필터
      if (selectedDate !== 'ALL') {
        const d = extractDate(insp.inspectedAt);
        if (d !== selectedDate) return false;
      }

      const ditch = ditchMap.get(insp.ditchId);
      const ditchName = ditch?.name || '';
      const ditchCode = ditch?.code || '';
      const ditchSection = ditch ? getNormalizedSection(ditch) : '';

      // 2. 검색어 (시설명, 관리번호, 점검자명, 메모)
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = ditchName.toLowerCase().includes(q);
        const matchCode = ditchCode.toLowerCase().includes(q);
        const matchInspector = (insp.inspectorName || '').toLowerCase().includes(q);
        const matchMemo = (insp.memo || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchInspector && !matchMemo) {
          return false;
        }
      }

      // 3. 구역 필터
      if (sectionFilter !== 'ALL' && ditchSection !== sectionFilter) {
        return false;
      }

      // 4. 상태 필터 (퇴적/구조/조치 기준)
      if (statusFilter === 'GOOD') {
        const isGood =
          insp.urgencyLevel === '조치완료' ||
          (insp.sedimentStatus.includes('정상') && insp.structureStatus === '정상');
        if (!isGood) return false;
      } else if (statusFilter === 'WARNING') {
        const isWarning =
          insp.sedimentStatus.includes('준설필요') ||
          insp.structureStatus === '균열/이탈' ||
          insp.urgencyLevel === '조치예정';
        if (!isWarning) return false;
      } else if (statusFilter === 'DANGER') {
        const isDanger =
          insp.sedimentStatus === '완전막힘' ||
          insp.structureStatus === '파손/붕괴' ||
          insp.urgencyLevel === '긴급조치';
        if (!isDanger) return false;
      }

      // 5. 사진 유무 필터
      if (onlyWithPhoto && !insp.photoCurrentUrl) {
        return false;
      }

      return true;
    });
  }, [inspections, selectedDate, searchTerm, sectionFilter, statusFilter, onlyWithPhoto, ditchMap]);

  // 선택된 날짜에 대한 통계 지표 (선택 날짜가 ALL일 땐 전체 통계)
  const dateStats = useMemo(() => {
    let good = 0;
    let warning = 0;
    let danger = 0;
    const inspectors = new Set<string>();

    filteredInspections.forEach((insp) => {
      if (insp.inspectorName) inspectors.add(insp.inspectorName);

      if (
        insp.sedimentStatus === '완전막힘' ||
        insp.structureStatus === '파손/붕괴' ||
        insp.urgencyLevel === '긴급조치'
      ) {
        danger += 1;
      } else if (
        insp.sedimentStatus.includes('준설필요') ||
        insp.structureStatus === '균열/이탈' ||
        insp.urgencyLevel === '조치예정'
      ) {
        warning += 1;
      } else {
        good += 1;
      }
    });

    return {
      total: filteredInspections.length,
      good,
      warning,
      danger,
      inspectors: Array.from(inspectors),
    };
  }, [filteredInspections]);

  // 한국어 날짜 라벨 포맷
  const formatKoreanDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'ALL') return '전체 기간 점검 내역';
    try {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
      return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일 (${dayOfWeek}요일)`;
    } catch {
      return dateStr;
    }
  };

  // 날짜 이동 (이전일 / 다음일)
  const shiftDate = (days: number) => {
    if (selectedDate === 'ALL') {
      setSelectedDate(todayStr);
      return;
    }
    try {
      const cur = new Date(selectedDate);
      cur.setDate(cur.getDate() + days);
      setSelectedDate(cur.toISOString().slice(0, 10));
    } catch {}
  };

  const content = (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* 1. 상단 일자 선택 & 타임라인 헤더 */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-3 sm:p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 타이틀 및 일자 이동 내비게이션 */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                  일자별 점검 일지 & 기록
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(true)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold border border-blue-500/30 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  title="클릭하여 달력 열기"
                >
                  <Calendar className="w-3 h-3 text-blue-400" />
                  <span>{selectedDate === 'ALL' ? '전체' : selectedDate}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {formatKoreanDate(selectedDate)}
              </p>
            </div>
          </div>

          {/* 우측 퀵 컨트롤: 날짜 이동 화살표 + 엑셀 내보내기 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 이전일 / 다음일 스텝 버튼 & 📅 대화형 달력 열기 */}
            <div className="flex items-center bg-slate-950 rounded-2xl border border-white/15 p-1 shadow-lg gap-0.5">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                title="하루 전 날짜로 이동 (이전일)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* 📅 대화형 달력 열기 버튼 (클릭 시 달력 팝업 노출) */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="h-8 px-3 rounded-xl flex items-center gap-2 bg-slate-900 hover:bg-emerald-500/20 text-white hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 text-xs font-black font-mono transition-all active:scale-95 shadow-inner cursor-pointer group"
                title="📅 클릭하여 달력에서 날짜 선택"
              >
                <Calendar className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>{selectedDate === 'ALL' ? '전체 일자' : selectedDate}</span>
                <span className="text-[10px] text-emerald-400 font-bold ml-0.5">▼</span>
              </button>

              <button
                type="button"
                onClick={() => shiftDate(1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                title="다음 날짜로 이동 (다음일)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 엑셀 다운로드 */}
            <button
              type="button"
              onClick={() => exportDitchesAndInspectionsToExcel(ditches, filteredInspections)}
              className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950 active:scale-95 transition-all"
              title="조회된 점검 내역 엑셀 다운로드"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">엑셀</span>
            </button>

            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 퀵 날짜 선택 칩 (오늘, 어제, 전체 + 실제 점검 이력이 있는 날짜들) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`h-8 px-3 rounded-xl text-xs font-black shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
              selectedDate === todayStr
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>오늘</span>
            <span className="text-[10px] font-mono opacity-80">
              ({availableDates.find((d) => d.date === todayStr)?.count || 0}건)
            </span>
          </button>

          {/* 📅 달력으로 날짜 찾기 칩 */}
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className={`h-8 px-3 rounded-xl text-xs font-black shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border cursor-pointer ${
              selectedDate !== todayStr && selectedDate !== 'ALL'
                ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                : 'bg-white/5 hover:bg-white/10 text-blue-300 hover:text-white border-white/10 hover:border-blue-400/40'
            }`}
            title="월간 달력에서 원하는 날짜 직접 선택"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {selectedDate !== todayStr && selectedDate !== 'ALL'
                ? `${selectedDate} (선택)`
                : '달력으로 찾기'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate('ALL')}
            className={`h-8 px-3 rounded-xl text-xs font-black shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
              selectedDate === 'ALL'
                ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            <span>전체 일자</span>
            <span className="text-[10px] font-mono opacity-80">({inspections.length}건)</span>
          </button>

          {/* 최근 점검 이력이 존재하는 날짜 칩들 */}
          {availableDates.slice(0, 10).map(({ date, count }) => {
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`h-8 px-2.5 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1 border ${
                  isSelected
                    ? 'bg-slate-200 text-slate-950 border-white font-black shadow-md'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border-white/5'
                }`}
              >
                <span>{date.slice(5)}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-black/20 text-slate-900 font-bold' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4">
        {/* 2. 해당 일자 총괄 지표 배너 (Daily KPI Deck) */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {selectedDate === 'ALL' ? '전체 기간 점검 현황' : `${selectedDate} 현장 점검 요약`}
                </h3>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 flex items-baseline gap-2">
                <span>총 {dateStats.total}건 점검 완료</span>
                {dateStats.inspectors.length > 0 && (
                  <span className="text-xs font-normal text-slate-400">
                    (점검자: {dateStats.inspectors.join(', ')})
                  </span>
                )}
              </div>
            </div>

            {/* 상태별 카운터 3단 카드 */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              {/* 정상 */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-xl text-left">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 정상
                </span>
                <span className="text-lg font-black text-emerald-300 font-mono">
                  {dateStats.good}
                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">건</span>
                </span>
              </div>

              {/* 주의(준설) */}
              <div className="bg-amber-950/40 border border-amber-500/30 px-3 py-2 rounded-xl text-left">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 준설요망
                </span>
                <span className="text-lg font-black text-amber-300 font-mono">
                  {dateStats.warning}
                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">건</span>
                </span>
              </div>

              {/* 긴급 */}
              <div className="bg-rose-950/40 border border-rose-500/30 px-3 py-2 rounded-xl text-left">
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> 긴급
                </span>
                <span className="text-lg font-black text-rose-300 font-mono">
                  {dateStats.danger}
                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">건</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 검색 및 필터 툴바 */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center gap-2 shadow">
          {/* 검색창 */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="시설명, 관리번호, 점검자, 특이사항 검색..."
              className="w-full h-9 pl-9 pr-8 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 구역 필터 */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="h-9 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">전체 구역</option>
            {['정자 앞', '본관3층', '본관4층', '별관', '식수'].map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">전체 상태</option>
            <option value="GOOD">정상</option>
            <option value="WARNING">주의 (준설요망)</option>
            <option value="DANGER">긴급 (위험)</option>
          </select>

          {/* 사진 있는 건만 보기 */}
          <button
            type="button"
            onClick={() => setOnlyWithPhoto((prev) => !prev)}
            className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 ${
              onlyWithPhoto
                ? 'bg-blue-600 text-white border-blue-400 shadow'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>사진 등록건만</span>
          </button>
        </div>

        {/* 4. 점검 내역 목록 (카드 타임라인 뷰) */}
        {filteredInspections.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-500 mx-auto">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">등록된 점검 기록이 없습니다</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                선택하신 조건 ({selectedDate === 'ALL' ? '전체' : selectedDate})에 해당하는 현장 점검
                내역이 없습니다. 다른 날짜를 선택해보세요.
              </p>
            </div>
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md inline-flex items-center gap-1.5"
              >
                <span>오늘 날짜 ({todayStr}) 보기</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInspections.map((insp, index) => {
              const ditch = ditchMap.get(insp.ditchId);
              const section = ditch ? getNormalizedSection(ditch) : '기타';
              const secTheme = getSectionTheme(section);

              const isDanger =
                insp.sedimentStatus === '완전막힘' ||
                insp.structureStatus === '파손/붕괴' ||
                insp.urgencyLevel === '긴급조치';
              const isWarning =
                insp.sedimentStatus.includes('준설필요') ||
                insp.structureStatus === '균열/이탈' ||
                insp.urgencyLevel === '조치예정';

              return (
                <div
                  key={insp.id || index}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all hover:border-slate-700 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDanger
                      ? 'border-rose-500/50 bg-rose-950/10'
                      : isWarning
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : 'border-slate-800'
                  }`}
                >
                  {/* 좌측: 시설물 정보 & 점검 일시/점검자 & 체크리스트 상태 */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 구역 태그 */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${secTheme.badgeStyle}`}
                      >
                        {section}
                      </span>

                      {/* 시설물 코드 / 명칭 */}
                      <span className="text-white font-black text-sm sm:text-base">
                        {ditch?.name || '배수로 시설'}
                      </span>
                      {ditch?.code && (
                        <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                          {ditch.code}
                        </span>
                      )}

                      {/* 상태 인디케이터 배지 */}
                      {isDanger ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center gap-1 shadow-sm animate-pulse">
                          <Flame className="w-3 h-3" /> 긴급조치
                        </span>
                      ) : isWarning ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-sm">
                          <AlertTriangle className="w-3 h-3" /> 준설요망
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 통수 정상
                        </span>
                      )}
                    </div>

                    {/* 세부 점검 결과 (퇴적 / 구조 / 조치구분) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                      <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[11px]">퇴적 상태:</span>
                        <span
                          className={`font-black ${
                            insp.sedimentStatus.includes('준설') || insp.sedimentStatus === '완전막힘'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {insp.sedimentStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[11px]">구조 상태:</span>
                        <span
                          className={`font-black ${
                            insp.structureStatus !== '정상' ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {insp.structureStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-white/5">
                        <span className="text-slate-400 text-[11px]">조치 구분:</span>
                        <span className="font-bold text-slate-200">{insp.urgencyLevel}</span>
                      </div>
                    </div>

                    {/* 특이사항 메모 */}
                    {insp.memo && (
                      <div className="text-xs bg-slate-950/80 p-2 rounded-xl border border-white/5 text-slate-300">
                        <span className="text-slate-500 font-bold mr-1.5">특이사항:</span>
                        <span>{insp.memo}</span>
                      </div>
                    )}

                    {/* 점검 일시 & 점검자 성명 & GPS 오차 */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono text-slate-300">{insp.inspectedAt}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-200 font-bold">
                          {insp.inspectorName || '현장 점검자'}
                        </span>
                      </span>
                      {insp.gpsAccuracy && (
                        <span className="text-slate-500 font-mono">
                          (GPS 오차 ±{insp.gpsAccuracy.toFixed(1)}m)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 우측: 현장 사진 썸네일 & 조치 액션 버튼 */}
                  <div className="flex sm:flex-col md:flex-row items-center gap-3 shrink-0 self-end md:self-center">
                    {/* 현장 사진 썸네일 */}
                    {insp.photoCurrentUrl ? (
                      <div
                        onClick={() =>
                          setEnlargedPhoto({
                            url: insp.photoCurrentUrl,
                            ditchName: ditch?.name || '배수로 시설',
                            inspectedAt: insp.inspectedAt,
                            inspector: insp.inspectorName || '현장 점검자',
                          })
                        }
                        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/10 bg-slate-950 cursor-pointer group shadow-inner shrink-0"
                        title="현장 사진 크게 보기"
                      >
                        <img
                          src={insp.photoCurrentUrl}
                          alt="점검 사진"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-5 h-5 drop-shadow" />
                        </div>
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.2 bg-black/70 text-[9px] font-bold text-white rounded">
                          사진
                        </span>
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-white/5 bg-slate-950/60 flex flex-col items-center justify-center text-slate-600 text-[10px] gap-1 shrink-0">
                        <Camera className="w-5 h-5 text-slate-700" />
                        <span>사진 없음</span>
                      </div>
                    )}

                    {/* 액션 버튼 그룹 */}
                    <div className="flex flex-col gap-1.5 w-28 shrink-0">
                      {ditch && onSelectDitchOnMap && (
                        <button
                          type="button"
                          onClick={() => onSelectDitchOnMap(ditch)}
                          className="h-8 px-2 bg-slate-800 hover:bg-slate-750 text-blue-400 hover:text-blue-300 font-bold text-xs rounded-xl border border-white/10 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
                          title="지도에서 해당 배수로 위치 확인"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>지도 위치</span>
                        </button>
                      )}

                      {ditch && onOpenHistory && (
                        <button
                          type="button"
                          onClick={() => onOpenHistory(ditch)}
                          className="h-8 px-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-white/10 flex items-center justify-center gap-1 active:scale-95 transition-all"
                          title="이 배수로의 모든 과거 점검 이력 보기"
                        >
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          <span>전체 이력</span>
                        </button>
                      )}

                      {ditch && onPrintInspection && (
                        <button
                          type="button"
                          onClick={() => onPrintInspection(ditch, insp)}
                          className="h-8 px-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
                          title="해당 점검 사진대지 및 리포트 인쇄"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>대지 인쇄</span>
                        </button>
                      )}

                      {onDeleteInspection && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              window.confirm(
                                `⚠️ [점검 기록 삭제]\n\n선택하신 점검 기록(일시: ${insp.inspectedAt}, 시설: ${ditch?.name || '배수로'}) 1건을 삭제하시겠습니까?`
                              )
                            ) {
                              await onDeleteInspection(insp.id);
                            }
                          }}
                          className="h-7 px-2 bg-slate-850 hover:bg-rose-900/60 text-slate-500 hover:text-rose-300 font-medium text-[11px] rounded-lg border border-transparent hover:border-rose-500/30 flex items-center justify-center gap-1 active:scale-95 transition-all"
                          title="점검 기록 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>기록 삭제</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 사진 전체화면 확대 팝업 모달 */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm text-white">{enlargedPhoto.ditchName}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  점검일시: {enlargedPhoto.inspectedAt} | 점검자: {enlargedPhoto.inspector}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={enlargedPhoto.url}
                alt="확대 사진"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
            <div className="p-3 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📅 대화형 월간 달력 모달 (점검 건수 배지 & 빠른 날짜 선택) */}
      <MonthCalendarPickerModal
        isOpen={isCalendarOpen}
        selectedDate={selectedDate}
        inspectionCountByDate={inspectionCountByDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setIsCalendarOpen(false);
        }}
        onClose={() => setIsCalendarOpen(false)}
      />
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5">
        <div className="w-full max-w-5xl h-[92vh] bg-slate-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
