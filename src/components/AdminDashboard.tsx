import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  AlertTriangle,
  Flame,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  Calendar,
  Layers,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Siren,
  Trash2,
  Edit3,
  ClipboardList,
  Clock,
  ExternalLink,
  X,
  Camera,
  Maximize2,
  Image as ImageIcon,
} from 'lucide-react';
import { DitchMaster, InspectionRecord, DrainStatus, EmergencyAlert } from '../types';
import { exportDitchesAndInspectionsToExcel } from '../services/excelExport';
import { exportAllDataJson, importAllDataJson, resetToDefaultData } from '../services/storage';
import { fileToBase64Compressed } from '../services/imageOptimizer';
import { PrintReportModal } from './PrintReportModal';
import { ComprehensiveReportModal } from './ComprehensiveReportModal';
import { getDitchOverdueInfo } from '../utils/ditchOverdue';


export type SortField = 'code' | 'name' | 'section' | 'currentStatus' | 'lastInspectedAt';
export type SortDirection = 'asc' | 'desc';

interface AdminDashboardProps {
  ditches: DitchMaster[];
  inspections: InspectionRecord[];
  alerts?: EmergencyAlert[];
  onRefreshData: () => Promise<void>;
  onSelectDitchOnMap: (ditch: DitchMaster) => void;
  onSelectAlertOnMap?: (alert: EmergencyAlert) => void;
  onOpenHistory?: (ditch: DitchMaster) => void;
  onOpenEdit?: (ditch: DitchMaster) => void;
  onDeleteDitch?: (ditchId: string) => Promise<void>;
  onDeleteAlert?: (alertId: string) => Promise<void>;
  onUpdateAlert?: (alert: EmergencyAlert) => Promise<void> | void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  ditches,
  inspections,
  alerts = [],
  onRefreshData,
  onSelectDitchOnMap,
  onSelectAlertOnMap,
  onOpenHistory,
  onOpenEdit,
  onDeleteDitch,
  onDeleteAlert,
  onUpdateAlert,
}) => {
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DrainStatus>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [onlyEmergency, setOnlyEmergency] = useState<boolean>(false);
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);

  // 종합보고서 모달 상태
  const [isComprehensiveReportOpen, setIsComprehensiveReportOpen] = useState<boolean>(false);

  // 테이블 정렬 상태
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 인쇄 모달 상태
  const [activePrintTarget, setActivePrintTarget] = useState<{
    ditch: DitchMaster;
    inspection: InspectionRecord;
  } | null>(null);

  // 경광등 데이터 수정 모달 상태
  const [editingAlertTarget, setEditingAlertTarget] = useState<EmergencyAlert | null>(null);
  const [editAlertMessage, setEditAlertMessage] = useState<string>('');
  const [editAlertPhotoUrl, setEditAlertPhotoUrl] = useState<string>('');
  const [isSavingAlert, setIsSavingAlert] = useState<boolean>(false);
  const [enlargedAlertPhoto, setEnlargedAlertPhoto] = useState<string | null>(null);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState<boolean>(false);

  // 구역 목록 ('주차장' -> '도로' 변환 반영)
  const sections = Array.from(
    new Set(ditches.map((d) => (d.section === '주차장' ? '도로' : d.section || '도로')))
  );

  // FMS 표준 구역별 요약 지표 (도로, 본관, 별관, 식수)
  const sectionSummaryList = useMemo(() => {
    const list = ['도로', '본관', '별관', '식수'];
    return list.map((sec) => {
      const secDitches = ditches.filter((d) => (d.section === '주차장' ? '도로' : d.section || '도로') === sec);
      const total = secDitches.length;
      const goodCount = secDitches.filter((d) => d.currentStatus === 'GOOD').length;
      const issueCount = secDitches.filter((d) => d.currentStatus === 'WARNING' || d.currentStatus === 'DANGER').length;
      const overdueCount = secDitches.filter((d) => getDitchOverdueInfo(d, 14).isOverdue).length;
      return {
        section: sec,
        total,
        goodCount,
        issueCount,
        overdueCount,
      };
    });
  }, [ditches]);

  // 필터링된 배수로 목록
  const filteredDitches = ditches.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.address && d.address.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchStatus = statusFilter === 'ALL' || d.currentStatus === statusFilter;
    const currentSection = d.section === '주차장' ? '도로' : d.section;
    const matchSection = sectionFilter === 'ALL' || currentSection === sectionFilter;
    const matchEmergency = !onlyEmergency || d.currentStatus === 'DANGER';
    const matchOverdue = !onlyOverdue || getDitchOverdueInfo(d, 14).isOverdue;

    return matchSearch && matchStatus && matchSection && matchEmergency && matchOverdue;
  });

  // 정렬 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 동일 컬럼 클릭 시 오름차순/내림차순 토글
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // 새 컬럼 클릭 시: 상태(주의/긴급순)와 최근 점검일시(최신순)는 내림차순을 기본값으로 시작
      setSortField(field);
      if (field === 'currentStatus' || field === 'lastInspectedAt') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  // 정렬된 배수로 목록
  const sortedDitches = useMemo(() => {
    if (!sortField) return filteredDitches;

    return [...filteredDitches].sort((a, b) => {
      // 1. 관리번호
      if (sortField === 'code') {
        const comp = a.code.localeCompare(b.code, 'ko', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comp : -comp;
      }

      // 2. 현재 상태 (주의/긴급 우선 vs 정상 우선)
      if (sortField === 'currentStatus') {
        const statusScore: Record<DrainStatus, number> = {
          DANGER: 3,
          WARNING: 2,
          GOOD: 1,
        };
        const scoreA = statusScore[a.currentStatus] || 0;
        const scoreB = statusScore[b.currentStatus] || 0;
        if (scoreA !== scoreB) {
          // desc: DANGER(3) -> WARNING(2) -> GOOD(1) (주의/긴급 우선)
          // asc: GOOD(1) -> WARNING(2) -> DANGER(3) (정상 우선)
          return sortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        }
        return a.code.localeCompare(b.code, 'ko', { numeric: true });
      }

      // 3. 최근 점검일시 (최신순 vs 미점검순)
      if (sortField === 'lastInspectedAt') {
        const dateA = a.lastInspectedAt || '';
        const dateB = b.lastInspectedAt || '';

        if (sortDirection === 'desc') {
          // 최신순 (최신일자 먼저, 미점검은 맨 아래)
          if (dateA && !dateB) return -1;
          if (!dateA && dateB) return 1;
          if (!dateA && !dateB) return a.code.localeCompare(b.code, 'ko', { numeric: true });
          return dateB.localeCompare(dateA);
        } else {
          // 미점검순 (미점검이 맨 위, 그 다음 오래된 날짜 순)
          if (!dateA && dateB) return -1;
          if (dateA && !dateB) return 1;
          if (!dateA && !dateB) return a.code.localeCompare(b.code, 'ko', { numeric: true });
          return dateA.localeCompare(dateB);
        }
      }

      // 4. 배수로 명칭
      if (sortField === 'name') {
        const comp = a.name.localeCompare(b.name, 'ko');
        return sortDirection === 'asc' ? comp : -comp;
      }

      // 5. 공구/구역
      if (sortField === 'section') {
        const secA = a.section === '주차장' ? '도로' : a.section || '';
        const secB = b.section === '주차장' ? '도로' : b.section || '';
        const comp = secA.localeCompare(secB, 'ko');
        return sortDirection === 'asc' ? comp : -comp;
      }

      return 0;
    });
  }, [filteredDitches, sortField, sortDirection]);

  // 정렬 아이콘 렌더러
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-400 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-400 font-bold shrink-0" />
    );
  };

  // 상태별 통계
  const countGood = ditches.filter((d) => d.currentStatus === 'GOOD').length;
  const countWarning = ditches.filter((d) => d.currentStatus === 'WARNING').length;
  const countDanger = ditches.filter((d) => d.currentStatus === 'DANGER').length;
  const overdueDitches = ditches.filter((d) => getDitchOverdueInfo(d, 14).isOverdue);
  const countOverdue = overdueDitches.length;

  // 엑셀 내보내기
  const handleExportExcel = () => {
    exportDitchesAndInspectionsToExcel(ditches, inspections);
  };

  // JSON 백업 다운로드
  const handleExportBackup = async () => {
    const json = await exportAllDataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drainage_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON 복원 업로드
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const ok = await importAllDataJson(text);
      if (ok) {
        alert('백업 데이터가 성공적으로 복원되었습니다.');
        await onRefreshData();
      } else {
        alert('데이터 복원에 실패했습니다. 유효한 JSON 형식인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
  };

  // 사진대지 보기 열기
  const openPrintReport = (ditch: DitchMaster) => {
    const ditchInspections = inspections.filter((insp) => insp.ditchId === ditch.id);
    const latestInspection = ditchInspections[0];

    if (!latestInspection) {
      alert('해당 배수로의 점검 이력이 없어 사진대지를 생성할 수 없습니다.');
      return;
    }

    setActivePrintTarget({
      ditch,
      inspection: latestInspection,
    });
  };

  // 배수로 데이터 삭제 확인 핸들러
  const handleDeleteDitchConfirm = async (ditch: DitchMaster) => {
    const ditchName = ditch.name.replace(/주차장/g, '도로');
    const confirmed = window.confirm(
      `🚨 [배수로 시설물 영구 삭제]\n\n관리번호: ${ditch.code}\n배수로명: ${ditchName}\n\n정말로 이 배수로 등록데이터를 삭제하시겠습니까?\n\n※ 삭제 시 연관된 모든 점검 이력과 현장 사진도 함께 삭제되며, 클라우드에서도 즉시 제거됩니다.`
    );
    if (confirmed && onDeleteDitch) {
      try {
        await onDeleteDitch(ditch.id);
        alert(`"${ditchName}" 배수로가 성공적으로 삭제되었습니다.`);
      } catch (err) {
        console.error(err);
        alert('배수로 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 긴급상황 경광등 해제 확인 핸들러
  const handleDeleteAlertConfirm = async (targetAlert: EmergencyAlert) => {
    const confirmed = window.confirm(
      `🚨 [긴급상황 경광등 해제/삭제]\n\n등록일시: ${targetAlert.createdFormatted}\n내용: ${targetAlert.message || '긴급상황 발생'}\n\n이 긴급상황 경광등을 해제(삭제)하시겠습니까?\n\n※ 상황 종료 시 모든 사용자의 지도 및 화면에서 즉시 제거됩니다.`
    );

    if (confirmed && onDeleteAlert) {
      try {
        await onDeleteAlert(targetAlert.id);
      } catch (err) {
        console.error(err);
        window.alert('경광등 해제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto p-3 sm:p-5 space-y-4">
      {/* 1. ZONE 1: FMS 통합 요약 위젯 (KPI 지표 + 4개 구역 관리 진도 현황) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* 좌측: 5대 핵심 상태 지표 (원터치 즉시 필터링 탭) */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h2 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                  배수로 시설물 종합 관리 현황
                </h2>
              </div>
              {(statusFilter !== 'ALL' || onlyEmergency || onlyOverdue || sectionFilter !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSectionFilter('ALL');
                    setOnlyEmergency(false);
                    setOnlyOverdue(false);
                    setSearchTerm('');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  필터 초기화
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* 전체 배수로 */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setOnlyEmergency(false);
                  setOnlyOverdue(false);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  statusFilter === 'ALL' && !onlyEmergency && !onlyOverdue
                    ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500/30 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
                title="전체 배수로 보기"
              >
                <span className="text-[11px] text-slate-400 font-semibold block">총 관리 수량</span>
                <span className="text-lg sm:text-2xl font-black text-white">
                  {ditches.length}
                  <span className="text-xs font-normal text-slate-400 ml-1">개소</span>
                </span>
              </button>

              {/* 통수 정상 */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === 'GOOD' ? 'ALL' : 'GOOD');
                  setOnlyEmergency(false);
                  setOnlyOverdue(false);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  statusFilter === 'GOOD'
                    ? 'bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-500/30 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/50 text-slate-300'
                }`}
                title="정상 배수로 필터링"
              >
                <span className="text-[11px] text-emerald-400 font-semibold block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 통수 정상
                </span>
                <span className="text-lg sm:text-2xl font-black text-emerald-400">
                  {countGood}
                  <span className="text-xs font-normal text-emerald-500/70 ml-1">개소</span>
                </span>
              </button>

              {/* 주의 (준설요망) */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === 'WARNING' ? 'ALL' : 'WARNING');
                  setOnlyEmergency(false);
                  setOnlyOverdue(false);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  statusFilter === 'WARNING'
                    ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-500/30 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/50 text-slate-300'
                }`}
                title="주의(준설요망) 배수로 필터링"
              >
                <span className="text-[11px] text-amber-400 font-semibold block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 준설 요망
                </span>
                <span className="text-lg sm:text-2xl font-black text-amber-400">
                  {countWarning}
                  <span className="text-xs font-normal text-amber-500/70 ml-1">개소</span>
                </span>
              </button>

              {/* 긴급 조치 */}
              <button
                type="button"
                onClick={() => {
                  setOnlyEmergency((prev) => !prev);
                  setStatusFilter('ALL');
                  setOnlyOverdue(false);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  onlyEmergency
                    ? 'bg-rose-950/70 border-rose-400 ring-2 ring-rose-500/30 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-rose-500/50 text-slate-300'
                }`}
                title="긴급조치 대상 필터링"
              >
                <span className="text-[11px] text-rose-400 font-semibold block flex items-center gap-1">
                  <Flame className="w-3 h-3" /> 긴급 조치
                </span>
                <span className="text-lg sm:text-2xl font-black text-rose-400">
                  {countDanger}
                  <span className="text-xs font-normal text-rose-500/70 ml-1">개소</span>
                </span>
              </button>

              {/* 14일+ 장기 미점검 */}
              <button
                type="button"
                onClick={() => {
                  setOnlyOverdue((prev) => !prev);
                  setStatusFilter('ALL');
                  setOnlyEmergency(false);
                }}
                className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-95 col-span-2 sm:col-span-1 ${
                  onlyOverdue
                    ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/30 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/50 text-slate-300'
                }`}
                title="14일 이상 미점검 시설물 필터링"
              >
                <span className="text-[11px] text-amber-400 font-semibold block flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 14일+ 미점검
                </span>
                <span className="text-lg sm:text-2xl font-black text-amber-400">
                  {countOverdue}
                  <span className="text-xs font-normal text-amber-500/70 ml-1">개소</span>
                </span>
              </button>
            </div>
          </div>

          {/* 우측: 4대 구역별 현황 미니 프로그레스 바 (FMS 표준 구역 모니터링) */}
          <div className="lg:w-72 bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800/60">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> 구역별 관리 현황
              </span>
              <span className="text-[10px] text-slate-400">총 4개 구역</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {sectionSummaryList.map((sec) => (
                <button
                  key={sec.section}
                  type="button"
                  onClick={() => setSectionFilter(sectionFilter === sec.section ? 'ALL' : sec.section)}
                  className={`p-2 rounded-lg border text-left transition-all active:scale-95 ${
                    sectionFilter === sec.section
                      ? 'bg-slate-850 border-blue-400 text-white shadow-sm ring-1 ring-blue-400/50'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                  title={`${sec.section} 구역 필터링`}
                >
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span>{sec.section === '식수' ? '🌲 식수' : sec.section}</span>
                    <span className="font-mono text-slate-400">{sec.total}개소</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px]">
                    <span className="text-emerald-400">{sec.goodCount} 정상</span>
                    {sec.issueCount > 0 && <span className="text-amber-400 font-semibold">· {sec.issueCount} 주의</span>}
                    {sec.overdueCount > 0 && <span className="text-rose-400 font-semibold">· {sec.overdueCount} 지연</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 🚨 긴급상황 경광등 슬림 알림 바 (평상시 0건일 땐 숨김, 발생 시에만 1줄로 컴팩트 노출) */}
      {alerts.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border-2 border-rose-500/80 rounded-2xl p-3 sm:p-4 shadow-xl shadow-rose-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-950 animate-bounce">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                  🚨 긴급상황 경광등 {alerts.length}건 발생 중
                </span>
                <span className="text-[11px] text-rose-300 font-mono hidden sm:inline">
                  최근: {alerts[0]?.createdFormatted}
                </span>
              </div>
              <p className="text-sm font-black text-white mt-0.5 flex items-center gap-1.5">
                <span>{alerts[0]?.message || '현장 긴급상황 발생'}</span>
                {alerts.length > 1 && (
                  <span className="text-xs text-rose-300 font-normal">
                    (외 {alerts.length - 1}건)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsAlertsDrawerOpen(true)}
              className="px-4 h-9 bg-white hover:bg-slate-100 text-rose-950 font-black text-xs rounded-xl shadow active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>경광등 상세·조치 ({alerts.length})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. ZONE 2: 원-라인 통합 컨트롤 툴바 (검색 + 구역/상태 필터 + 보고서/엑셀/백업/복원) */}
      <div className="bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow">
        {/* 좌측: 검색 & 드롭다운 필터 */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* 검색창 */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="배수로 명칭, 번호, 주소 검색..."
              className="w-full h-10 pl-9 pr-8 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
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

          {/* 구역 드롭다운 */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">전체 구역 ({ditches.length})</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* 상태 드롭다운 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">전체 상태 등급</option>
            <option value="GOOD">정상 ({countGood})</option>
            <option value="WARNING">주의 (준설요망: {countWarning})</option>
            <option value="DANGER">긴급 (위험: {countDanger})</option>
          </select>

          {/* 표시 건수 및 정렬 초기화 */}
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-slate-400 font-mono">
              <strong className="text-white">{sortedDitches.length}</strong> / {ditches.length}개소
            </span>
            {sortField && (
              <button
                type="button"
                onClick={() => {
                  setSortField(null);
                  setSortDirection('asc');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 active:scale-95 transition-all ml-1"
                title="정렬 초기화"
              >
                <RefreshCw className="w-3 h-3" />
                정렬초기화
              </button>
            )}
          </div>
        </div>

        {/* 우측: 보고서 & 엑셀 & 백업 버튼 그룹 */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 lg:pb-0">
          {/* 주간/월간 종합보고서 (1-클릭) */}
          <button
            onClick={() => setIsComprehensiveReportOpen(true)}
            className="h-10 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-950/60 active:scale-95 transition-all shrink-0"
            title="주간 및 월간 유지관리 종합보고서 1-클릭 인쇄/PDF 생성"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>종합보고서 (1-클릭)</span>
          </button>

          {/* 엑셀 총괄표 다운로드 */}
          <button
            onClick={handleExportExcel}
            className="h-10 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/60 active:scale-95 transition-all shrink-0"
            title="전체 배수로 및 점검기록 엑셀(XLSX) 다운로드"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>엑셀(XLSX)</span>
          </button>

          {/* 백업 */}
          <button
            onClick={handleExportBackup}
            className="h-10 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1 border border-slate-700 active:scale-95 transition-all shrink-0"
            title="전체 데이터 JSON 백업 파일 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            <span>백업</span>
          </button>

          {/* 복원 */}
          <label
            className="h-10 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1 border border-slate-700 cursor-pointer active:scale-95 transition-all shrink-0"
            title="JSON 백업 파일로 복원"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>복원</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 4. 데이터 표 (Table) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider select-none">
              <tr>
                {/* 관리번호 정렬 */}
                <th
                  onClick={() => handleSort('code')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors group"
                  title="관리번호 오름차순/내림차순 정렬"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={sortField === 'code' ? 'text-emerald-400 font-black' : ''}>
                      관리번호
                    </span>
                    {renderSortIcon('code')}
                  </div>
                </th>

                {/* 배수로 명칭 정렬 */}
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors group"
                  title="배수로 명칭 정렬"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={sortField === 'name' ? 'text-emerald-400 font-black' : ''}>
                      배수로 명칭
                    </span>
                    {renderSortIcon('name')}
                  </div>
                </th>

                {/* 공구/구역 정렬 */}
                <th
                  onClick={() => handleSort('section')}
                  className="py-3 px-4 hidden md:table-cell cursor-pointer hover:text-white transition-colors group"
                  title="공구/구역 정렬"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={sortField === 'section' ? 'text-emerald-400 font-black' : ''}>
                      공구/구역
                    </span>
                    {renderSortIcon('section')}
                  </div>
                </th>

                <th className="py-3 px-4 hidden lg:table-cell">단면 규격</th>

                {/* 현재 상태 정렬 (주의/긴급 우선 vs 정상 우선) */}
                <th
                  onClick={() => handleSort('currentStatus')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors group"
                  title="현재 상태 정렬 (클릭 시 주의/긴급순 ↔ 정상순 변경)"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={sortField === 'currentStatus' ? 'text-emerald-400 font-black' : ''}>
                      현재 상태
                    </span>
                    {sortField === 'currentStatus' && (
                      <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                        {sortDirection === 'desc' ? '주의/긴급순' : '정상순'}
                      </span>
                    )}
                    {renderSortIcon('currentStatus')}
                  </div>
                </th>

                {/* 최근 점검일시 정렬 (최신순 vs 미점검순) */}
                <th
                  onClick={() => handleSort('lastInspectedAt')}
                  className="py-3 px-4 hidden sm:table-cell cursor-pointer hover:text-white transition-colors group"
                  title="최근 점검일시 정렬 (클릭 시 최신순 ↔ 미점검순 변경)"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={sortField === 'lastInspectedAt' ? 'text-emerald-400 font-black' : ''}>
                      최근 점검일시
                    </span>
                    {sortField === 'lastInspectedAt' && (
                      <span className="text-[10px] font-black text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                        {sortDirection === 'desc' ? '최신순' : '미점검순'}
                      </span>
                    )}
                    {renderSortIcon('lastInspectedAt')}
                  </div>
                </th>

                <th className="py-3 px-4 text-center">관리 및 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {sortedDitches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                    검색 조건에 일치하는 배수로가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedDitches.map((ditch) => {
                  const ditchInspections = inspections.filter((i) => i.ditchId === ditch.id);
                  const hasInspection = ditchInspections.length > 0;

                  return (
                    <tr
                      key={ditch.id}
                      className="hover:bg-slate-850 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        <button
                          type="button"
                          onClick={() => onOpenHistory?.(ditch)}
                          className="hover:text-emerald-400 hover:underline transition-colors text-left font-mono"
                          title="클릭하여 점검 이력 및 사진 조회"
                        >
                          {ditch.code.replace(/주차장/g, '도로')}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onOpenHistory?.(ditch)}
                          className="text-left group/name flex items-center gap-1.5 focus:outline-none"
                          title="클릭하여 점검 이력 및 현장 사진 열람"
                        >
                          <span className="font-bold text-white group-hover/name:text-emerald-400 group-hover:text-emerald-400 transition-colors">
                            {ditch.name.replace(/주차장/g, '도로')}
                          </span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium hidden sm:inline-block">
                            이력/사진
                          </span>
                        </button>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {ditch.address || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 hidden md:table-cell">
                        {ditch.section === '주차장' ? '도로' : ditch.section}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs hidden lg:table-cell">
                        {ditch.dimension}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                            ditch.currentStatus === 'GOOD'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : ditch.currentStatus === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                          }`}
                        >
                          {ditch.currentStatus === 'GOOD'
                            ? '정상'
                            : ditch.currentStatus === 'WARNING'
                            ? '주의'
                            : '긴급'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs hidden sm:table-cell">
                        {(() => {
                          const overdue = getDitchOverdueInfo(ditch, 14);
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-300 font-mono">
                                {ditch.lastInspectedAt || '미점검'}
                              </span>
                              {overdue.isOverdue && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded w-fit">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                  {overdue.daysElapsed === 999 ? '미점검 방치' : `${overdue.daysElapsed}일 경과`}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* 점검이력 및 사진 열람 버튼 */}
                          <button
                            type="button"
                            onClick={() => onOpenHistory?.(ditch)}
                            className="h-8 px-2.5 rounded-lg text-xs font-bold bg-emerald-950/70 hover:bg-emerald-600 hover:text-white text-emerald-300 border border-emerald-600/50 flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                            title="과거 점검 이력 및 현장 사진 조회 (타임라인)"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>이력/사진</span>
                          </button>

                          {/* 사진대지 인쇄 버튼 */}
                          <button
                            type="button"
                            onClick={() => openPrintReport(ditch)}
                            disabled={!hasInspection}
                            className={`h-8 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                              hasInspection
                                ? 'bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-300 border border-slate-700 active:scale-95 shadow-sm'
                                : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-transparent opacity-60'
                            }`}
                            title={hasInspection ? '사진대지 A4 인쇄' : '점검기록 없음'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">사진대지</span>
                          </button>

                          {/* 지도에서 보기 버튼 */}
                          <button
                            type="button"
                            onClick={() => onSelectDitchOnMap(ditch)}
                            className="h-8 px-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
                            title="지도에서 위치 확인"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden xl:inline">지도</span>
                          </button>

                          {/* 배수로 정보 수정 버튼 */}
                          {onOpenEdit && (
                            <button
                              type="button"
                              onClick={() => onOpenEdit(ditch)}
                              className="h-8 px-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
                              title="배수로 제원 및 위치 정보 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 배수로 등록데이터 영구 삭제 버튼 */}
                          {onDeleteDitch && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDitchConfirm(ditch)}
                              className="h-8 px-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 border border-slate-700 hover:border-rose-500 flex items-center gap-1 active:scale-95 transition-all"
                              title="배수로 등록데이터 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 사진대지 인쇄 팝업 모달 */}
      {activePrintTarget && (
        <PrintReportModal
          ditch={activePrintTarget.ditch}
          inspection={activePrintTarget.inspection}
          onClose={() => setActivePrintTarget(null)}
        />
      )}

      {/* 경광등 데이터 수정 모달 */}
      {editingAlertTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 text-white shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Siren className="w-5 h-5 text-rose-400" />
                <h3 className="font-black text-base">경광등 긴급상황 데이터 수정</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAlertTarget(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  🚨 긴급상황 내용 / 메시지
                </label>
                <input
                  type="text"
                  value={editAlertMessage}
                  onChange={(e) => setEditAlertMessage(e.target.value)}
                  placeholder="긴급상황 내용 입력 (예: 배수로 범람 위험)"
                  className="w-full h-11 px-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500"
                />
                <div className="flex flex-wrap gap-1.5 pt-1.5">
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
                      onClick={() => setEditAlertMessage(preset)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-[10px] border border-slate-700 active:scale-95 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 긴급상황 현장 사진 등록/수정 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-rose-400" />
                    현장 긴급 사진 등록/수정
                  </span>
                  {editAlertPhotoUrl && (
                    <span className="text-[10px] text-emerald-400 font-bold">사진 등록됨</span>
                  )}
                </label>

                {editAlertPhotoUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                    <img
                      src={editAlertPhotoUrl}
                      alt="현장 사진 미리보기"
                      className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setEnlargedAlertPhoto(editAlertPhotoUrl)}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setEnlargedAlertPhoto(editAlertPhotoUrl)}
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
                                setEditAlertPhotoUrl(compressed);
                              } catch (err) {
                                console.error(err);
                                alert('사진 변환에 실패했습니다.');
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditAlertPhotoUrl('')}
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
                      <span className="text-xs font-bold">카메라 촬영</span>
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
                            setEditAlertPhotoUrl(compressed);
                          } catch (err) {
                            console.error(err);
                            alert('카메라 사진 처리에 실패했습니다.');
                          }
                        }}
                      />
                    </label>
                    <label className="h-12 border border-dashed border-slate-700 hover:border-slate-500 bg-slate-950 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 text-slate-300">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold">갤러리/파일</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const compressed = await fileToBase64Compressed(file);
                            setEditAlertPhotoUrl(compressed);
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

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>등록 일시:</span>
                  <span className="text-slate-300">{editingAlertTarget.createdFormatted}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>발생 좌표:</span>
                  <span className="text-slate-300">
                    {editingAlertTarget.latitude.toFixed(6)}, {editingAlertTarget.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingAlertTarget(null)}
                disabled={isSavingAlert}
                className="flex-1 h-11 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isSavingAlert}
                onClick={async () => {
                  if (!editingAlertTarget) return;
                  setIsSavingAlert(true);
                  try {
                    const updated: EmergencyAlert = {
                      ...editingAlertTarget,
                      message: editAlertMessage.trim() || '🚨 현장 긴급상황 발생',
                      photoUrl: editAlertPhotoUrl || '',
                    };

                    if (onUpdateAlert) {
                      await onUpdateAlert(updated);
                    }
                    setEditingAlertTarget(null);
                  } catch (err) {
                    console.error('Failed to update alert:', err);
                    window.alert('경광등 수정 중 오류가 발생했습니다.');
                  } finally {
                    setIsSavingAlert(false);
                  }
                }}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                수정 완료 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 긴급상황 현장 사진 원본 확대보기 모달 */}
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

      {/* 🚨 긴급상황 경광등 현황 및 조치 전용 모달 (FMS 비상 대응 콘솔) */}
      {isAlertsDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
            {/* 상단 타이틀 바 */}
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center animate-bounce shadow">
                  <Siren className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base flex items-center gap-2">
                    실시간 긴급상황 경광등 관리 현황
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold">
                      {alerts.length}건 발생
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    현장에서 접수된 긴급상황 위치와 사진을 확인하고, 상황 종료 시 즉시 해제(삭제)합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAlertsDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 경광등 목록 바디 */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-slate-950/40">
              {alerts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <span>현재 접수된 긴급상황 경광등이 없습니다.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-slate-900 border border-rose-500/50 rounded-xl p-3.5 space-y-3 shadow-md flex flex-col justify-between hover:border-rose-400 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                            <Siren className="w-3 h-3" />
                            긴급 경광등
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {alert.createdFormatted}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-rose-300 mt-2.5 flex items-center gap-1.5">
                          {alert.message || '🚨 현장 긴급상황 발생'}
                        </h4>

                        {/* 현장 사진 썸네일 */}
                        {alert.photoUrl ? (
                          <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950 mt-2.5 group">
                            <img
                              src={alert.photoUrl}
                              alt="긴급상황 현장 사진"
                              className="w-full h-28 object-cover cursor-pointer hover:opacity-95 transition-all"
                              onClick={() => setEnlargedAlertPhoto(alert.photoUrl!)}
                            />
                            <button
                              type="button"
                              onClick={() => setEnlargedAlertPhoto(alert.photoUrl!)}
                              className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-slate-900/85 hover:bg-slate-900 text-white text-[10px] font-bold rounded backdrop-blur-sm border border-slate-700 flex items-center gap-1 shadow active:scale-95 transition-all"
                            >
                              <Maximize2 className="w-3 h-3 text-blue-400" />
                              사진 확대
                            </button>
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-rose-600/90 text-white text-[9px] font-bold rounded flex items-center gap-1 shadow">
                              <Camera className="w-2.5 h-2.5" />
                              현장 사진
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 py-1 px-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-[10px] text-slate-500 flex items-center gap-1.5">
                            <ImageIcon className="w-3 h-3 text-slate-600" />
                            <span>등록된 현장 사진 없음</span>
                          </div>
                        )}

                        <div className="text-xs text-slate-300 mt-2 space-y-1 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-400 font-sans">발생 좌표:</span>
                            <span className="text-slate-300">
                              {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAlertsDrawerOpen(false);
                            onSelectAlertOnMap?.(alert);
                          }}
                          className="flex-1 h-9 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          지도에서 보기
                        </button>
                        {onUpdateAlert && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAlertTarget(alert);
                              setEditAlertMessage(alert.message || '🚨 현장 긴급상황 발생');
                              setEditAlertPhotoUrl(alert.photoUrl || '');
                            }}
                            className="h-9 px-3 bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-300 border border-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all"
                            title="경광등 내용 및 사진 수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            수정
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAlertConfirm(alert)}
                          className="h-9 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow active:scale-95 transition-all"
                          title="상황 종료 후 경광등 해제(삭제)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          해제(삭제)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAlertsDrawerOpen(false)}
                className="px-5 h-10 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 주간/월간 유지관리 종합보고서 1-클릭 인쇄/PDF 모달 */}
      <ComprehensiveReportModal
        isOpen={isComprehensiveReportOpen}
        onClose={() => setIsComprehensiveReportOpen(false)}
        ditches={ditches}
        inspections={inspections}
        alerts={alerts}
      />
    </div>
  );
};

