import React, { useState } from 'react';
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
} from 'lucide-react';
import { DitchMaster, InspectionRecord, DrainStatus } from '../types';
import { exportDitchesAndInspectionsToExcel } from '../services/excelExport';
import { exportAllDataJson, importAllDataJson, resetToDefaultData } from '../services/storage';
import { PrintReportModal } from './PrintReportModal';

interface AdminDashboardProps {
  ditches: DitchMaster[];
  inspections: InspectionRecord[];
  onRefreshData: () => Promise<void>;
  onSelectDitchOnMap: (ditch: DitchMaster) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  ditches,
  inspections,
  onRefreshData,
  onSelectDitchOnMap,
}) => {
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DrainStatus>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [onlyEmergency, setOnlyEmergency] = useState<boolean>(false);

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

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* 1. 상단 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

        {/* 긴급조치 토글 필터 */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOnlyEmergency((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
              onlyEmergency
                ? 'bg-rose-600 border-rose-400 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-300" />
            긴급조치 대상 배수로만 보기
          </button>
          <span className="text-xs text-slate-500">
            총 {filteredDitches.length}개소 표시 중
          </span>
        </div>
      </div>

      {/* 4. 데이터 표 (Table) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">관리번호</th>
                <th className="py-3 px-4">배수로 명칭</th>
                <th className="py-3 px-4 hidden md:table-cell">공구/구역</th>
                <th className="py-3 px-4 hidden lg:table-cell">단면 규격</th>
                <th className="py-3 px-4">현재 상태</th>
                <th className="py-3 px-4 hidden sm:table-cell">최근 점검일시</th>
                <th className="py-3 px-4 text-center">리포트 및 이동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filteredDitches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                    검색 조건에 일치하는 배수로가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDitches.map((ditch) => {
                  const ditchInspections = inspections.filter((i) => i.ditchId === ditch.id);
                  const hasInspection = ditchInspections.length > 0;

                  return (
                    <tr
                      key={ditch.id}
                      className="hover:bg-slate-850 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        {ditch.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {ditch.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {ditch.address || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 hidden md:table-cell">
                        {ditch.section}
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
                        <div className="flex items-center justify-center gap-2">
                          {/* 사진대지 인쇄 버튼 */}
                          <button
                            onClick={() => openPrintReport(ditch)}
                            disabled={!hasInspection}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                              hasInspection
                                ? 'bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 active:scale-95'
                                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                            }`}
                            title={hasInspection ? '사진대지 A4 인쇄' : '점검기록 없음'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">사진대지</span>
                          </button>

                          {/* 지도에서 보기 버튼 */}
                          <button
                            onClick={() => onSelectDitchOnMap(ditch)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
                            title="지도에서 위치 확인"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">지도이동</span>
                          </button>
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
