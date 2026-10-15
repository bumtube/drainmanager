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
} from 'lucide-react';
import { DitchMaster, InspectionRecord, DrainStatus, EmergencyAlert } from '../types';
import { exportDitchesAndInspectionsToExcel } from '../services/excelExport';
import { exportAllDataJson, importAllDataJson, resetToDefaultData } from '../services/storage';
import { PrintReportModal } from './PrintReportModal';

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
}) => {
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DrainStatus>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [onlyEmergency, setOnlyEmergency] = useState<boolean>(false);

  // 테이블 정렬 상태
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 인쇄 모달 상태
  const [activePrintTarget, setActivePrintTarget] = useState<{
    ditch: DitchMaster;
    inspection: InspectionRecord;
  } | null>(null);

  // 구역 목록 ('주차장' -> '도로' 변환 반영)
  const sections = Array.from(
    new Set(ditches.map((d) => (d.section === '주차장' ? '도로' : d.section || '도로')))
  );

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

    return matchSearch && matchStatus && matchSection && matchEmergency;
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
      `🚨 [긴급상황 경광등 해제/삭제]\n\n신고자: ${targetAlert.creatorName}\n등록일시: ${targetAlert.createdFormatted}\n내용: ${targetAlert.message || '긴급상황 발생'}\n\n이 긴급상황 경광등을 해제(삭제)하시겠습니까?\n\n※ 상황 종료 시 모든 사용자의 지도 및 화면에서 즉시 제거됩니다.`
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
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* 1. 상단 통계 카드 (5열 반응형 그리드) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-xs text-slate-400 font-bold block">총 관리 배수로</span>
          <span className="text-2xl sm:text-3xl font-black text-white">{ditches.length}개소</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-xs text-emerald-400 font-bold block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 통수 정상
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400">{countGood}개소</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-xs text-amber-400 font-bold block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 관찰 / 준설필요
          </span>
          <span className="text-2xl sm:text-3xl font-black text-amber-400">{countWarning}개소</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <span className="text-xs text-rose-400 font-bold block flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> 긴급조치 요망
          </span>
          <span className="text-2xl sm:text-3xl font-black text-rose-400">{countDanger}개소</span>
        </div>
        <div
          className={`p-4 rounded-2xl shadow border transition-all ${
            alerts.length > 0
              ? 'bg-rose-950/40 border-rose-500/70 shadow-lg shadow-rose-950/50'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <span className="text-xs text-rose-400 font-bold block flex items-center gap-1">
            <Siren className={`w-3.5 h-3.5 ${alerts.length > 0 ? 'text-rose-400 animate-spin' : ''}`} />
            긴급상황 경광등
          </span>
          <span
            className={`text-2xl sm:text-3xl font-black flex items-center gap-1.5 ${
              alerts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'
            }`}
          >
            {alerts.length}건
            {alerts.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-bounce">
                발생
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 2. 실시간 긴급상황 경광등 관리 현황 섹션 */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          alerts.length > 0
            ? 'bg-rose-950/25 border-rose-500/60 shadow-xl shadow-rose-950/40'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                alerts.length > 0
                  ? 'bg-rose-600 text-white animate-bounce shadow-md shadow-rose-900'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  실시간 긴급상황 경광등 현황
                </h3>
                {alerts.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                    {alerts.length}건 대기 중
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    안전 유지 중
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                현장에서 사용자가 등록한 긴급상황 경광등 위치를 즉시 확인하고, 상황 종료 시 삭제(해제)할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2 bg-slate-950/40 rounded-xl border border-slate-850">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>현재 접수된 긴급상황 경광등이 없습니다. (현장 시설물 정상 운영 중)</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
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
                  <div className="text-xs text-slate-300 mt-2 space-y-1 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">신고자(등록자):</span>
                      <span className="text-white font-bold">{alert.creatorName || '현장 점검자'}</span>
                    </div>
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
                    onClick={() => onSelectAlertOnMap?.(alert)}
                    className="flex-1 h-9 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    지도에서 보기
                  </button>
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

      {/* 2. 관리자 툴바 & 리포트 추출 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-black text-white">배수로 점검 총괄표 & 리포트</h2>
          <p className="text-xs text-slate-400">
            총 {inspections.length}건의 현장 점검 이력이 누적되어 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* 엑셀 다운로드 */}
          <button
            onClick={handleExportExcel}
            className="h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            엑셀(XLSX) 총괄표 다운로드
          </button>

          {/* 백업/복원 드롭다운 */}
          <button
            onClick={handleExportBackup}
            className="h-11 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5"
            title="전체 데이터 JSON 백업"
          >
            <Download className="w-4 h-4" /> 백업
          </button>
          <label className="h-11 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4" /> 복원
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 3. 검색 및 필터 컨트롤 */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 검색창 */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="배수로 명칭, 관리번호, 주소 검색..."
              className="w-full h-11 pl-10 pr-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 구역 필터 */}
          <div className="flex gap-2">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-semibold"
            >
              <option value="ALL">전체 공구/구역</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-semibold"
            >
              <option value="ALL">전체 상태 등급</option>
              <option value="GOOD">정상</option>
              <option value="WARNING">주의 (준설요망)</option>
              <option value="DANGER">긴급 (위험)</option>
            </select>
          </div>
        </div>

        {/* 긴급조치 토글 필터 & 정렬 안내 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyEmergency((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                onlyEmergency
                  ? 'bg-rose-600 border-rose-400 text-white shadow'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-300" />
              긴급조치 대상 배수로만 보기
            </button>
            <span className="text-xs text-slate-500">
              총 {sortedDitches.length}개소 표시 중
            </span>
          </div>

          {sortField && (
            <button
              type="button"
              onClick={() => {
                setSortField(null);
                setSortDirection('asc');
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 active:scale-95 transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              정렬 초기화
            </button>
          )}
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
                      <td className="py-3 px-4 text-slate-400 text-xs hidden sm:table-cell">
                        {ditch.lastInspectedAt || '미점검'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* 점검이력 및 사진 열람 버튼 */}
                          <button
                            type="button"
                            onClick={() => onOpenHistory?.(ditch)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/60 hover:bg-emerald-600 hover:text-white text-emerald-300 border border-emerald-600/50 flex items-center gap-1 active:scale-95 transition-all"
                            title="과거 점검 이력 및 현장 사진 조회 (타임라인)"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">이력/사진</span>
                          </button>

                          {/* 배수로 정보 수정 버튼 */}
                          {onOpenEdit && (
                            <button
                              type="button"
                              onClick={() => onOpenEdit(ditch)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-300 border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
                              title="배수로 제원 및 위치 정보 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">수정</span>
                            </button>
                          )}

                          {/* 사진대지 인쇄 버튼 */}
                          <button
                            type="button"
                            onClick={() => openPrintReport(ditch)}
                            disabled={!hasInspection}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                              hasInspection
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95'
                                : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-transparent'
                            }`}
                            title={hasInspection ? '사진대지 A4 인쇄' : '점검기록 없음'}
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-400" />
                            <span className="hidden md:inline">사진대지</span>
                          </button>

                          {/* 지도에서 보기 버튼 */}
                          <button
                            type="button"
                            onClick={() => onSelectDitchOnMap(ditch)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
                            title="지도에서 위치 확인"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden md:inline">지도</span>
                          </button>

                          {/* 배수로 등록데이터 영구 삭제 버튼 */}
                          {onDeleteDitch && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDitchConfirm(ditch)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 border border-slate-700 hover:border-rose-500 flex items-center gap-1 active:scale-95 transition-all"
                              title="배수로 등록데이터 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">삭제</span>
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
    </div>
  );
};
