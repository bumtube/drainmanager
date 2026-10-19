import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Siren,
  History,
  Edit,
  CheckCircle2,
  Flame,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { DitchMaster, InspectionRecord, DrainStatus, EmergencyAlert } from '../types';
import { exportDitchesAndInspectionsToExcel } from '../services/excelExport';
import { getDitchOverdueInfo } from '../utils/ditchOverdue';
import { SECTION_COLOR_CONFIG, getSectionTheme } from '../utils/sectionTheme';

interface AdminSplitSidebarProps {
  ditches: DitchMaster[];
  inspections: InspectionRecord[];
  selectedDitch: DitchMaster | null;
  onSelectDitch: (ditch: DitchMaster | null) => void;
  alerts?: EmergencyAlert[];
  onOpenEdit?: (ditch: DitchMaster) => void;
  onOpenHistory?: (ditch: DitchMaster) => void;
  onAddNewDitch?: () => void;
  onOpenComprehensiveReport?: () => void;
}

export const AdminSplitSidebar: React.FC<AdminSplitSidebarProps> = ({
  ditches,
  inspections,
  selectedDitch,
  onSelectDitch,
  alerts = [],
  onOpenEdit,
  onOpenHistory,
  onAddNewDitch,
  onOpenComprehensiveReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DrainStatus | 'OVERDUE'>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  // 구역명 정규화
  const getNormalizedDitchSection = (d: DitchMaster): string => {
    const s = d.section || '';
    const n = d.name || '';
    if (s === '식수' || n.includes('식수')) return '식수';
    if (s === '별관' || n.includes('별관')) return '별관';
    if (s.includes('본관4층') || n.includes('본관4층') || n.includes('4층')) return '본관4층';
    if (s.includes('본관3층') || n.includes('본관3층') || n.includes('3층')) return '본관3층';
    return '정자 앞';
  };

  // KPI 통계 산출
  const stats = useMemo(() => {
    let good = 0;
    let warning = 0;
    let danger = 0;
    let overdue = 0;

    ditches.forEach((d) => {
      if (d.currentStatus === 'GOOD') good++;
      else if (d.currentStatus === 'WARNING') warning++;
      else if (d.currentStatus === 'DANGER') danger++;

      if (getDitchOverdueInfo(d, 14).isOverdue) overdue++;
    });

    return { total: ditches.length, good, warning, danger, overdue };
  }, [ditches]);

  // 필터링된 배수로 목록
  const filteredDitches = useMemo(() => {
    return ditches.filter((d) => {
      const sec = getNormalizedDitchSection(d);
      const matchSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.address && d.address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchSection = sectionFilter === 'ALL' || sec === sectionFilter;

      let matchStatus = true;
      if (statusFilter === 'OVERDUE') {
        matchStatus = getDitchOverdueInfo(d, 14).isOverdue;
      } else if (statusFilter !== 'ALL') {
        matchStatus = d.currentStatus === statusFilter;
      }

      return matchSearch && matchSection && matchStatus;
    });
  }, [ditches, searchTerm, sectionFilter, statusFilter]);

  return (
    <aside className="hidden lg:flex flex-col w-[390px] xl:w-[440px] h-full bg-slate-900/90 backdrop-blur-2xl border-r border-white/10 z-10 shrink-0 text-white select-none transition-all">
      {/* 1. 상단 타이틀 & 퀵 액션 툴바 */}
      <div className="p-4 border-b border-white/10 space-y-3 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-400 animate-pulse" />
            <h2 className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
              실시간 시설 관제
              <span className="text-xs font-mono text-slate-400 font-normal">
                ({filteredDitches.length}/{ditches.length}개소)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenComprehensiveReport && (
              <button
                type="button"
                onClick={onOpenComprehensiveReport}
                className="h-8 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                title="종합 점검 보고서 생성"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden xl:inline">종합보고서</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => exportDitchesAndInspectionsToExcel(ditches, inspections)}
              className="h-8 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
              title="현재 데이터 엑셀(XLSX) 다운로드"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>엑셀</span>
            </button>

            {onAddNewDitch && (
              <button
                type="button"
                onClick={onAddNewDitch}
                className="h-8 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-blue-900/40 active:scale-95 transition-all"
                title="새 배수로 시설물 등록"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>등록</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. KPI 요약 카드 (클릭 시 상태 필터 토글) */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'GOOD' ? 'ALL' : 'GOOD'))}
            className={`p-2 rounded-xl border text-left transition-all active:scale-95 ${
              statusFilter === 'GOOD'
                ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-slate-900/70 border-white/5 hover:border-emerald-500/40'
            }`}
          >
            <div className="text-[10px] text-slate-400 font-medium">정상</div>
            <div className="text-sm font-black text-emerald-400 font-mono">{stats.good}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'WARNING' ? 'ALL' : 'WARNING'))}
            className={`p-2 rounded-xl border text-left transition-all active:scale-95 ${
              statusFilter === 'WARNING'
                ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-900/70 border-white/5 hover:border-amber-500/40'
            }`}
          >
            <div className="text-[10px] text-slate-400 font-medium">주의</div>
            <div className="text-sm font-black text-amber-400 font-mono">{stats.warning}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'DANGER' ? 'ALL' : 'DANGER'))}
            className={`p-2 rounded-xl border text-left transition-all active:scale-95 ${
              statusFilter === 'DANGER'
                ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30'
                : 'bg-slate-900/70 border-white/5 hover:border-rose-500/40'
            }`}
          >
            <div className="text-[10px] text-slate-400 font-medium">긴급</div>
            <div className="text-sm font-black text-rose-400 font-mono">{stats.danger}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'OVERDUE' ? 'ALL' : 'OVERDUE'))}
            className={`p-2 rounded-xl border text-left transition-all active:scale-95 ${
              statusFilter === 'OVERDUE'
                ? 'bg-amber-600/25 border-amber-400 ring-2 ring-amber-400/30'
                : 'bg-slate-900/70 border-white/5 hover:border-amber-500/40'
            }`}
          >
            <div className="text-[10px] text-slate-400 font-medium">미점검</div>
            <div className="text-sm font-black text-amber-300 font-mono">{stats.overdue}</div>
          </button>
        </div>
      </div>

      {/* 3. 검색창 및 구역 필터 */}
      <div className="p-3 border-b border-white/10 space-y-2.5 bg-slate-950/20">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="코드, 명칭, 위치 검색..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 구역 칩 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {(['ALL', '정자 앞', '본관3층', '본관4층', '별관', '식수'] as const).map((sec) => {
            const isSelected = sectionFilter === sec;
            const theme = sec === 'ALL' ? null : SECTION_COLOR_CONFIG[sec];
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setSectionFilter(sec)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 border transition-all active:scale-95 flex items-center gap-1 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-white/5'
                }`}
              >
                {theme && <span className={`w-1.5 h-1.5 rounded-full ${theme.dotBg}`} />}
                <span>{sec === 'ALL' ? '전체' : sec}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. 긴급상황 발생 시 알림 스트립 */}
      {alerts.length > 0 && (
        <div className="p-3 bg-rose-950/40 border-b border-rose-500/40 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <Siren className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
            <span className="font-bold">현장 긴급상황 경광등 {alerts.length}건 발생</span>
          </div>
          <span className="text-[10px] bg-rose-900/80 px-2 py-0.5 rounded text-rose-200">
            지도 확인 요망
          </span>
        </div>
      )}

      {/* 5. 배수로 스크롤 리스트 (Apple HIG 카드 스타일) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y-0">
        {filteredDitches.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            조건에 맞는 배수로가 없습니다.
          </div>
        ) : (
          filteredDitches.map((ditch) => {
            const isSelected = selectedDitch?.id === ditch.id;
            const sec = getNormalizedDitchSection(ditch);
            const secTheme = getSectionTheme(sec);
            const overdue = getDitchOverdueInfo(ditch, 14);

            return (
              <div
                key={ditch.id}
                onClick={() => onSelectDitch(ditch)}
                className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/70 ring-1 ring-blue-500/40 shadow-lg'
                    : 'bg-slate-950/50 hover:bg-slate-800/60 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${secTheme.dotBg} mt-1 shrink-0`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-black text-white">
                        {ditch.code.replace(/(주차장|도로)/g, '정자 앞')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                          ditch.currentStatus === 'GOOD'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : ditch.currentStatus === 'WARNING'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {ditch.currentStatus === 'GOOD'
                          ? '정상'
                          : ditch.currentStatus === 'WARNING'
                          ? '주의'
                          : '긴급'}
                      </span>
                      {overdue.isOverdue && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1 rounded flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          {overdue.daysElapsed === 999 ? '미점검' : `${overdue.daysElapsed}일`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 font-medium truncate mt-0.5">
                      {ditch.name.replace(/(주차장|도로)/g, '정자 앞')}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {ditch.dimension || '규격미정'} · {ditch.lastInspectedAt || '미점검'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {onOpenEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEdit(ditch);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="정보 수정"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onOpenHistory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenHistory(ditch);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="이력 조회"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? 'text-blue-400 translate-x-0.5' : 'text-slate-600'
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
