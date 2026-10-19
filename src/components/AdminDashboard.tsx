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
  Sparkles,
  BarChart2,
  Activity,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Check,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { DitchMaster, InspectionRecord, DrainStatus, EmergencyAlert } from '../types';
import { exportDitchesAndInspectionsToExcel } from '../services/excelExport';
import { exportAllDataJson, importAllDataJson } from '../services/storage';
import { fileToBase64Compressed } from '../services/imageOptimizer';
import { PrintReportModal } from './PrintReportModal';
import { ComprehensiveReportModal } from './ComprehensiveReportModal';
import { DailyInspectionLogView } from './DailyInspectionLogView';
import { getDitchOverdueInfo } from '../utils/ditchOverdue';
import {
  SECTION_COLOR_CONFIG,
  getSectionTheme,
  getNormalizedSection,
} from '../utils/sectionTheme';

export type SortField = 'code' | 'name' | 'section' | 'currentStatus' | 'lastInspectedAt';
export type SortDirection = 'asc' | 'desc';
export type SmartPreset = 'ALL' | 'DANGER' | 'WARNING' | 'OVERDUE' | 'NO_PHOTO' | 'GOOD';

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
  onDeleteInspection?: (inspectionId: string) => Promise<void> | void;
  onSaveDitch?: (ditch: DitchMaster) => Promise<void> | void;
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
  onDeleteInspection,
  onSaveDitch,
}) => {
  // 3-Way 메인 워크스페이스 탭: 시설물 대장 | 일자별 점검 일지 | 통계 및 분석
  const [dashboardView, setDashboardView] = useState<'DITCHES' | 'DAILY_LOG' | 'ANALYTICS'>('DITCHES');

  // 슬라이드오버 인스펙터 패널에서 선택된 배수로
  const [selectedInspectorDitch, setSelectedInspectorDitch] = useState<DitchMaster | null>(null);

  // 스마트 프리셋 필터 상태
  const [smartPreset, setSmartPreset] = useState<SmartPreset>('ALL');

  // 검색 및 구역 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  // 종합보고서 모달 상태
  const [isComprehensiveReportOpen, setIsComprehensiveReportOpen] = useState<boolean>(false);

  // 테이블 정렬 상태
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 사진대지 인쇄 모달 상태
  const [activePrintTarget, setActivePrintTarget] = useState<{
    ditch: DitchMaster;
    inspection: InspectionRecord;
  } | null>(null);

  // 사진 확대 팝업 모달 상태
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  // 경광등 데이터 수정 모달 상태
  const [editingAlertTarget, setEditingAlertTarget] = useState<EmergencyAlert | null>(null);
  const [editAlertMessage, setEditAlertMessage] = useState<string>('');
  const [editAlertPhotoUrl, setEditAlertPhotoUrl] = useState<string>('');
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState<boolean>(false);

  // 구역 명칭 정규화 유틸
  const getNormalizedDitchSection = getNormalizedSection;
  const sections = ['정자 앞', '본관3층', '본관4층', '별관', '식수'];

  // 배수로별 최신 점검 기록 매핑 (빠른 참조용)
  const latestInspectionMap = useMemo(() => {
    const map = new Map<string, InspectionRecord>();
    inspections.forEach((insp) => {
      const prev = map.get(insp.ditchId);
      if (!prev || (insp.inspectedAt && insp.inspectedAt > (prev.inspectedAt || ''))) {
        map.set(insp.ditchId, insp);
      }
    });
    return map;
  }, [inspections]);

  // 오늘 날짜 및 오늘 점검 집계
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayInspectedDitches = useMemo(() => {
    return ditches.filter((d) => d.lastInspectedAt && d.lastInspectedAt.startsWith(todayStr));
  }, [ditches, todayStr]);

  const todayInspectors = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach((insp) => {
      if (insp.inspectedAt && insp.inspectedAt.startsWith(todayStr) && insp.inspectorName) {
        set.add(insp.inspectorName);
      }
    });
    return Array.from(set);
  }, [inspections, todayStr]);

  // 상태별 통계
  const countGood = ditches.filter((d) => d.currentStatus === 'GOOD').length;
  const countWarning = ditches.filter((d) => d.currentStatus === 'WARNING').length;
  const countDanger = ditches.filter((d) => d.currentStatus === 'DANGER').length;
  const countOverdue = ditches.filter((d) => getDitchOverdueInfo(d, 14).isOverdue).length;

  // 사진 미등록 배수로 수량
  const countNoPhoto = useMemo(() => {
    return ditches.filter((d) => {
      const latest = latestInspectionMap.get(d.id);
      return !latest || !latest.photoCurrentUrl;
    }).length;
  }, [ditches, latestInspectionMap]);

  // 1. [Bento Card A] 시설 건전성 종합 지수 (Facility Health Score: 100점 만점)
  const healthScore = useMemo(() => {
    if (ditches.length === 0) return 100;
    const raw = 100 - countWarning * 3 - countDanger * 8 - countOverdue * 3;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [ditches.length, countWarning, countDanger, countOverdue]);

  const healthGrade = useMemo(() => {
    if (healthScore >= 90) {
      return {
        label: '매우 우수 (정상 가동)',
        color: 'text-emerald-400',
        stroke: '#10b981',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
      };
    }
    if (healthScore >= 75) {
      return {
        label: '보통 (예방 준설 권장)',
        color: 'text-amber-400',
        stroke: '#f59e0b',
        bg: 'bg-amber-500/10 border-amber-500/30',
      };
    }
    return {
      label: '주의 (즉시 정비 조치 필요)',
      color: 'text-rose-400',
      stroke: '#f43f5e',
      bg: 'bg-rose-500/10 border-rose-500/30',
    };
  }, [healthScore]);

  // 2. [Bento Card D] 즉시 조치 시급 큐 (Action Required Queue)
  const actionRequiredList = useMemo(() => {
    const list: {
      ditch: DitchMaster;
      type: 'DANGER' | 'WARNING' | 'OVERDUE';
      label: string;
      icon: string;
      badgeClass: string;
    }[] = [];

    // 긴급 조치
    ditches
      .filter((d) => d.currentStatus === 'DANGER')
      .forEach((d) => {
        list.push({
          ditch: d,
          type: 'DANGER',
          label: '긴급 조치 시급',
          icon: '🚨',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30',
        });
      });

    // 준설 요망
    ditches
      .filter((d) => d.currentStatus === 'WARNING')
      .forEach((d) => {
        list.push({
          ditch: d,
          type: 'WARNING',
          label: '준설 요망',
          icon: '🟡',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
        });
      });

    // 14일+ 장기 미점검 (정상 상태이나 방치된 시설)
    ditches
      .filter(
        (d) =>
          d.currentStatus !== 'DANGER' &&
          d.currentStatus !== 'WARNING' &&
          getDitchOverdueInfo(d, 14).isOverdue
      )
      .forEach((d) => {
        const overdue = getDitchOverdueInfo(d, 14);
        list.push({
          ditch: d,
          type: 'OVERDUE',
          label: `${overdue.daysElapsed === 999 ? '미점검' : `${overdue.daysElapsed}일 지연`}`,
          icon: '⏰',
          badgeClass: 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-750',
        });
      });

    return list;
  }, [ditches]);

  // 3. 구역별 요약 지표 리스트
  const sectionSummaryList = useMemo(() => {
    return sections.map((sec) => {
      const secDitches = ditches.filter((d) => getNormalizedDitchSection(d) === sec);
      const total = secDitches.length;
      const good = secDitches.filter((d) => d.currentStatus === 'GOOD').length;
      const warning = secDitches.filter((d) => d.currentStatus === 'WARNING').length;
      const danger = secDitches.filter((d) => d.currentStatus === 'DANGER').length;
      const overdue = secDitches.filter((d) => getDitchOverdueInfo(d, 14).isOverdue).length;
      const complianceRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;
      return {
        section: sec,
        total,
        good,
        warning,
        danger,
        overdue,
        complianceRate,
      };
    });
  }, [ditches]);

  // 구역별 탭 카운터
  const sectionTabs = useMemo(() => {
    const counts: Record<string, { total: number; issueCount: number }> = {
      ALL: {
        total: ditches.length,
        issueCount: ditches.filter((d) => d.currentStatus === 'WARNING' || d.currentStatus === 'DANGER').length,
      },
      '정자 앞': { total: 0, issueCount: 0 },
      '본관3층': { total: 0, issueCount: 0 },
      '본관4층': { total: 0, issueCount: 0 },
      '별관': { total: 0, issueCount: 0 },
      '식수': { total: 0, issueCount: 0 },
    };

    ditches.forEach((d) => {
      const sec = getNormalizedDitchSection(d);
      if (counts[sec]) {
        counts[sec].total += 1;
        if (d.currentStatus === 'WARNING' || d.currentStatus === 'DANGER') {
          counts[sec].issueCount += 1;
        }
      }
    });

    return [
      { key: 'ALL', label: '전체 배수로', count: counts['ALL'].total, issueCount: counts['ALL'].issueCount },
      { key: '정자 앞', label: '정자 앞', count: counts['정자 앞'].total, issueCount: counts['정자 앞'].issueCount },
      { key: '본관3층', label: '본관3층', count: counts['본관3층'].total, issueCount: counts['본관3층'].issueCount },
      { key: '본관4층', label: '본관4층', count: counts['본관4층'].total, issueCount: counts['본관4층'].issueCount },
      { key: '별관', label: '별관', count: counts['별관'].total, issueCount: counts['별관'].issueCount },
      { key: '식수', label: '식수', count: counts['식수'].total, issueCount: counts['식수'].issueCount },
    ];
  }, [ditches]);

  // 필터링된 배수로 목록
  const filteredDitches = useMemo(() => {
    return ditches.filter((d) => {
      // 1. 검색어
      const matchSearch =
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.address && d.address.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      // 2. 구역 필터
      const currentSection = getNormalizedDitchSection(d);
      if (sectionFilter !== 'ALL' && currentSection !== sectionFilter) return false;

      // 3. 스마트 프리셋 필터
      if (smartPreset === 'DANGER' && d.currentStatus !== 'DANGER') return false;
      if (smartPreset === 'WARNING' && d.currentStatus !== 'WARNING') return false;
      if (smartPreset === 'GOOD' && d.currentStatus !== 'GOOD') return false;
      if (smartPreset === 'OVERDUE' && !getDitchOverdueInfo(d, 14).isOverdue) return false;
      if (smartPreset === 'NO_PHOTO') {
        const latest = latestInspectionMap.get(d.id);
        if (latest && latest.photoCurrentUrl) return false;
      }

      return true;
    });
  }, [ditches, searchTerm, sectionFilter, smartPreset, latestInspectionMap]);

  // 정렬된 배수로 목록
  const sortedDitches = useMemo(() => {
    if (!sortField) return filteredDitches;

    return [...filteredDitches].sort((a, b) => {
      if (sortField === 'code') {
        const comp = a.code.localeCompare(b.code, 'ko', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? comp : -comp;
      }
      if (sortField === 'currentStatus') {
        const statusScore: Record<DrainStatus, number> = { DANGER: 3, WARNING: 2, GOOD: 1 };
        const scoreA = statusScore[a.currentStatus] || 0;
        const scoreB = statusScore[b.currentStatus] || 0;
        if (scoreA !== scoreB) {
          return sortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        }
        return a.code.localeCompare(b.code, 'ko', { numeric: true });
      }
      if (sortField === 'lastInspectedAt') {
        const dateA = a.lastInspectedAt || '';
        const dateB = b.lastInspectedAt || '';
        if (sortDirection === 'desc') {
          if (dateA && !dateB) return -1;
          if (!dateA && dateB) return 1;
          if (!dateA && !dateB) return a.code.localeCompare(b.code, 'ko', { numeric: true });
          return dateB.localeCompare(dateA);
        } else {
          if (!dateA && dateB) return -1;
          if (dateA && !dateB) return 1;
          if (!dateA && !dateB) return a.code.localeCompare(b.code, 'ko', { numeric: true });
          return dateA.localeCompare(dateB);
        }
      }
      if (sortField === 'name') {
        const comp = a.name.localeCompare(b.name, 'ko');
        return sortDirection === 'asc' ? comp : -comp;
      }
      if (sortField === 'section') {
        const secA = getNormalizedDitchSection(a);
        const secB = getNormalizedDitchSection(b);
        const comp = secA.localeCompare(secB, 'ko');
        return sortDirection === 'asc' ? comp : -comp;
      }
      return 0;
    });
  }, [filteredDitches, sortField, sortDirection]);

  // [통계 탭 전용] 상습 이상/준설 필요 배수로 TOP 5
  const frequentIssueDitches = useMemo(() => {
    const countMap = new Map<string, { count: number; lastDate: string; reasons: Set<string> }>();
    inspections.forEach((insp) => {
      const isIssue =
        insp.sedimentStatus.includes('준설') ||
        insp.sedimentStatus === '완전막힘' ||
        insp.structureStatus !== '정상' ||
        insp.urgencyLevel === '긴급조치' ||
        insp.urgencyLevel === '조치예정';

      if (isIssue) {
        const prev = countMap.get(insp.ditchId) || {
          count: 0,
          lastDate: '',
          reasons: new Set<string>(),
        };
        prev.count += 1;
        if (!prev.lastDate || insp.inspectedAt > prev.lastDate) {
          prev.lastDate = insp.inspectedAt;
        }
        if (insp.sedimentStatus.includes('준설')) prev.reasons.add('퇴적준설');
        if (insp.sedimentStatus === '완전막힘') prev.reasons.add('완전막힘');
        if (insp.structureStatus !== '정상') prev.reasons.add('구조파손');
        if (insp.urgencyLevel === '긴급조치') prev.reasons.add('긴급조치');
        countMap.set(insp.ditchId, prev);
      }
    });

    return Array.from(countMap.entries())
      .map(([ditchId, data]) => {
        const ditch = ditches.find((d) => d.id === ditchId);
        return {
          ditch,
          count: data.count,
          lastDate: data.lastDate,
          reasons: Array.from(data.reasons),
        };
      })
      .filter((item): item is typeof item & { ditch: DitchMaster } => item.ditch !== undefined)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [ditches, inspections]);

  // 정렬 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'currentStatus' || field === 'lastInspectedAt' ? 'desc' : 'asc');
    }
  };

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
    const latest = latestInspectionMap.get(ditch.id);
    if (!latest) {
      alert('해당 배수로의 점검 이력이 없어 사진대지를 생성할 수 없습니다.');
      return;
    }
    setActivePrintTarget({ ditch, inspection: latest });
  };

  // 배수로 데이터 삭제 확인
  const handleDeleteDitchConfirm = async (ditch: DitchMaster) => {
    const confirmed = window.confirm(
      `🚨 [배수로 시설물 영구 삭제]\n\n관리번호: ${ditch.code}\n배수로명: ${ditch.name}\n\n정말로 이 배수로 등록데이터를 삭제하시겠습니까?\n\n※ 삭제 시 연관된 모든 점검 이력과 사진도 함께 삭제됩니다.`
    );
    if (confirmed && onDeleteDitch) {
      try {
        await onDeleteDitch(ditch.id);
        if (selectedInspectorDitch?.id === ditch.id) {
          setSelectedInspectorDitch(null);
        }
      } catch (err) {
        console.error(err);
        alert('배수로 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 인스펙터 패널에서 원클릭 상태 전환
  const handleQuickStatusChange = async (targetStatus: DrainStatus) => {
    if (!selectedInspectorDitch || !onSaveDitch) return;
    const updated = { ...selectedInspectorDitch, currentStatus: targetStatus };
    setSelectedInspectorDitch(updated);
    try {
      await onSaveDitch(updated);
    } catch (err) {
      console.error(err);
      alert('상태 저장 중 문제가 발생했습니다.');
    }
  };

  // 이전/다음 배수로 탐색
  const handleNavigateInspector = (step: number) => {
    if (!selectedInspectorDitch) return;
    const idx = sortedDitches.findIndex((d) => d.id === selectedInspectorDitch.id);
    if (idx === -1) return;
    const newIdx = idx + step;
    if (newIdx >= 0 && newIdx < sortedDitches.length) {
      setSelectedInspectorDitch(sortedDitches[newIdx]);
    }
  };

  // 긴급상황 경광등 해제
  const handleDeleteAlertConfirm = async (targetAlert: EmergencyAlert) => {
    const confirmed = window.confirm(
      `🚨 [긴급상황 경광등 해제/삭제]\n\n등록일시: ${targetAlert.createdFormatted}\n내용: ${targetAlert.message || '긴급상황 발생'}\n\n이 긴급상황 경광등을 해제하시겠습니까?`
    );
    if (confirmed && onDeleteAlert) {
      try {
        await onDeleteAlert(targetAlert.id);
      } catch (err) {
        console.error(err);
        alert('경광등 해제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto p-3 sm:p-5 space-y-4">
      {/* 1. 🍱 ZONE 1: Executive Bento Grid (경영진 & 관리자용 4대 핵심 벤토 모듈) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5">
        {/* [카드 A] 시설 건전성 종합 지수 (Facility Health Score) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              시설 건전성 종합 지수
            </span>
            <span className="text-[10px] font-bold text-slate-500 font-mono">100점 만점</span>
          </div>

          <div className="flex items-center gap-4 my-3">
            {/* 원형 SVG 링 게이지 */}
            <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="7" className="text-slate-800" fill="transparent" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke={healthGrade.stroke}
                  strokeWidth="7"
                  strokeDasharray={201}
                  strokeDashoffset={201 - (201 * healthScore) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="absolute font-mono font-black text-2xl text-white">
                {healthScore}
              </span>
            </div>

            <div className="space-y-1">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border ${healthGrade.bg} ${healthGrade.color}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span>{healthGrade.label}</span>
              </div>
              <p className="text-xs text-slate-400">
                총 {ditches.length}개소 중 정상 {countGood}개소
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px]">
            <div>
              <span className="text-slate-500 block">정상 통수</span>
              <span className="font-mono font-bold text-emerald-400">{countGood}개소</span>
            </div>
            <div>
              <span className="text-slate-500 block">준설 요망</span>
              <span className={`font-mono font-bold ${countWarning > 0 ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
                {countWarning}개소
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">긴급 조치</span>
              <span className={`font-mono font-bold ${countDanger > 0 ? 'text-rose-400 font-black' : 'text-slate-400'}`}>
                {countDanger}개소
              </span>
            </div>
          </div>
        </div>

        {/* [카드 B] 오늘 현장 가동 현황 (Today's Operations) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-400" />
              오늘 현장 점검 현황
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {todayStr}
            </span>
          </div>

          <div className="my-2 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono">
                {todayInspectedDitches.length}
                <span className="text-xs text-slate-400 font-normal ml-1">/ {ditches.length}개소</span>
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {ditches.length > 0 ? Math.round((todayInspectedDitches.length / ditches.length) * 100) : 0}%
              </span>
            </div>

            {/* 실시간 프로그레스 바 */}
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700 shadow-sm"
                style={{
                  width: `${ditches.length > 0 ? (todayInspectedDitches.length / ditches.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[200px]">
              <span className="text-slate-500">참여:</span>
              <span className="font-bold text-slate-200">
                {todayInspectors.length > 0 ? todayInspectors.join(', ') : '점검 대기 중'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDashboardView('DAILY_LOG')}
              className="text-blue-400 hover:text-blue-300 font-bold text-xs flex items-center gap-1 shrink-0"
            >
              <span>일지 열기</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* [카드 C] 5대 구역별 리스크 매트릭스 (Spatial Health Heatmap) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              5대 구역별 리스크 매트릭스
            </span>
            <span className="text-[10px] text-slate-500 font-mono">총 5개 구역</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {sectionSummaryList.map((sec) => {
              const hasIssues = sec.warning > 0 || sec.danger > 0 || sec.overdue > 0;
              const secTheme = getSectionTheme(sec.section);
              const isSelected = sectionFilter === sec.section;
              return (
                <button
                  key={sec.section}
                  type="button"
                  onClick={() => {
                    setSectionFilter(sectionFilter === sec.section ? 'ALL' : sec.section);
                    setDashboardView('DITCHES');
                  }}
                  className={`p-2 rounded-xl border text-left transition-all active:scale-95 relative ${
                    isSelected
                      ? 'bg-slate-800 border-white text-white ring-2 ring-white/30'
                      : hasIssues
                      ? 'bg-slate-950 border-amber-500/40 text-slate-200 hover:border-amber-400'
                      : 'bg-slate-950/60 border-white/5 text-slate-300 hover:border-white/20'
                  }`}
                  title={`${sec.section} 구역 필터링`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1 truncate">
                      <span className={`w-2 h-2 rounded-full ${secTheme.dotBg} shrink-0`} />
                      <span className="truncate">{sec.section}</span>
                    </span>
                    <span className="font-mono text-slate-400 text-[10px]">{sec.total}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] font-mono">
                    <span className="text-emerald-400">{sec.good}정상</span>
                    {sec.warning > 0 && <span className="text-amber-400 font-bold">·{sec.warning}주의</span>}
                    {sec.danger > 0 && <span className="text-rose-400 font-bold">·{sec.danger}긴급</span>}
                  </div>
                  {hasIssues && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* [카드 D] 🚨 즉시 조치 시급 큐 (Action Required Queue: 긴급/준설/14일+ 방치 배수로) */}
        <div className="lg:col-span-12 bg-slate-900/90 border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>즉시 조치 시급 큐 (Action Required Queue)</span>
                <span className="text-rose-400 font-mono">({actionRequiredList.length}개소)</span>
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              클릭 시 해당 시설물 인스펙터 패널로 즉시 포커스 이동
            </span>
          </div>

          {actionRequiredList.length === 0 ? (
            <div className="py-3 px-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>현재 긴급 조치 또는 준설 시급 시설물이 없습니다. 모든 배수로가 정상 관리 중입니다.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {actionRequiredList.map((item) => {
                const sec = getNormalizedDitchSection(item.ditch);
                const secTheme = getSectionTheme(sec);
                return (
                  <button
                    key={item.ditch.id}
                    type="button"
                    onClick={() => {
                      setDashboardView('DITCHES');
                      setSelectedInspectorDitch(item.ditch);
                    }}
                    className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 active:scale-95 transition-all shadow-sm ${item.badgeClass}`}
                  >
                    <span>{item.icon}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${secTheme.badgeStyle}`}>
                      {sec}
                    </span>
                    <span className="font-mono text-white font-black">{item.ditch.code}</span>
                    <span className="text-[11px] opacity-90">{item.ditch.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono font-bold">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. 🚨 긴급상황 경광등 슬림 알림 바 (발생 시에만 1줄 노출) */}
      {alerts.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border-2 border-rose-500/80 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg animate-bounce">
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

      {/* 3. 🧭 ZONE 2: 3-Way Apple Segmented Workspace Tabs */}
      <div className="flex bg-slate-900 border border-white/10 p-1.5 rounded-2xl shadow-sm">
        <button
          type="button"
          onClick={() => setDashboardView('DITCHES')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-98 ${
            dashboardView === 'DITCHES'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>배수로 종합 대장 ({ditches.length}개소)</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('DAILY_LOG')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-98 relative ${
            dashboardView === 'DAILY_LOG'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>일자별 점검 일지 ({inspections.length}건)</span>
          {todayInspectedDitches.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('ANALYTICS')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-98 ${
            dashboardView === 'ANALYTICS'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>통계 & 추세 분석</span>
        </button>
      </div>

      {/* 4. WORKSPACE CONTENT BRANCHING */}
      {dashboardView === 'DAILY_LOG' ? (
        /* 뷰 2: 일자별 점검 일지 */
        <DailyInspectionLogView
          ditches={ditches}
          inspections={inspections}
          onSelectDitchOnMap={onSelectDitchOnMap}
          onOpenHistory={onOpenHistory}
          onPrintInspection={(ditch, inspection) => setActivePrintTarget({ ditch, inspection })}
          onDeleteInspection={onDeleteInspection}
        />
      ) : dashboardView === 'ANALYTICS' ? (
        /* 뷰 3: 통계 & 추세 분석 뷰 (Analytics Deck) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 상습 이상/준설 필요 배수로 TOP 5 */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  상습 이상 & 준설 필요 배수로 TOP 5
                </span>
                <span className="text-[11px] text-slate-500 font-mono">과거 점검 이력 분석</span>
              </div>

              {frequentIssueDitches.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  이상 이력이 보고된 배수로가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {frequentIssueDitches.map((item, idx) => {
                    const sec = getNormalizedDitchSection(item.ditch);
                    const secTheme = getSectionTheme(sec);
                    return (
                      <div
                        key={item.ditch.id}
                        className="bg-slate-950/80 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs font-mono ${
                            idx === 0
                              ? 'bg-rose-500 text-white'
                              : idx === 1
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${secTheme.badgeStyle}`}>
                                {sec}
                              </span>
                              <span className="text-white font-bold text-xs">
                                {item.ditch.name}
                              </span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                {item.ditch.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                              <span className="text-rose-400 font-bold font-mono">이상 {item.count}회 보고</span>
                              <span>·</span>
                              <span>사유: {item.reasons.join(', ')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSelectDitchOnMap(item.ditch)}
                            className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] font-bold rounded-lg border border-white/10 flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>지도</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenHistory?.(item.ditch)}
                            className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg border border-white/10 flex items-center gap-1"
                          >
                            <span>이력</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5대 구역별 종합 건전성 & 준수율 비교 */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  5대 구역별 건전성 & 점검 주기 준수율
                </span>
                <span className="text-[11px] text-slate-500 font-mono">14일 주기 기준</span>
              </div>

              <div className="space-y-3">
                {sectionSummaryList.map((sec) => {
                  const secTheme = getSectionTheme(sec.section);
                  const goodRate = sec.total > 0 ? Math.round((sec.good / sec.total) * 100) : 100;
                  return (
                    <div key={sec.section} className="bg-slate-950/80 border border-white/5 rounded-2xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${secTheme.dotBg}`} />
                          <span className="text-white">{sec.section}</span>
                          <span className="text-slate-500 font-mono text-[11px]">({sec.total}개소)</span>
                        </span>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-emerald-400">정상 {sec.good}</span>
                          {sec.warning > 0 && <span className="text-amber-400">주의 {sec.warning}</span>}
                          {sec.danger > 0 && <span className="text-rose-400 font-black">긴급 {sec.danger}</span>}
                          {sec.overdue > 0 && <span className="text-slate-400">지연 {sec.overdue}</span>}
                        </div>
                      </div>

                      {/* 건전성 바 */}
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                        <div style={{ width: `${goodRate}%` }} className="bg-emerald-500 h-full" />
                        <div
                          style={{ width: `${sec.total > 0 ? (sec.warning / sec.total) * 100 : 0}%` }}
                          className="bg-amber-400 h-full"
                        />
                        <div
                          style={{ width: `${sec.total > 0 ? (sec.danger / sec.total) * 100 : 0}%` }}
                          className="bg-rose-500 h-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 뷰 1: 배수로 시설물 종합 대장 (스마트 칩 + 고밀도 테이블 + 인스펙터 시트) */
        <div className="space-y-3">
          {/* 3. 스마트 프리셋 필터 칩 & 거버넌스 툴바 */}
          <div className="bg-slate-900 border border-white/10 p-3 sm:p-4 rounded-3xl space-y-3 shadow-xl">
            {/* 스마트 필터 프리셋 칩 (애플 스타일 원터치 필터) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-400" />
                빠른 필터:
              </span>

              {/* 전체 */}
              <button
                type="button"
                onClick={() => setSmartPreset('ALL')}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
                  smartPreset === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-white/5'
                }`}
              >
                <span>전체 배수로</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30">
                  {ditches.length}
                </span>
              </button>

              {/* 긴급 조치 */}
              <button
                type="button"
                onClick={() => setSmartPreset(smartPreset === 'DANGER' ? 'ALL' : 'DANGER')}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
                  smartPreset === 'DANGER'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/30'
                    : 'bg-slate-950 hover:bg-slate-800 text-rose-300 border-rose-500/20'
                }`}
              >
                <Flame className="w-3 h-3 text-rose-400" />
                <span>긴급 조치</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-black">
                  {countDanger}
                </span>
              </button>

              {/* 준설 요망 */}
              <button
                type="button"
                onClick={() => setSmartPreset(smartPreset === 'WARNING' ? 'ALL' : 'WARNING')}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
                  smartPreset === 'WARNING'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-amber-500/20'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>준설 요망</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-black">
                  {countWarning}
                </span>
              </button>

              {/* 14일+ 미점검 */}
              <button
                type="button"
                onClick={() => setSmartPreset(smartPreset === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
                  smartPreset === 'OVERDUE'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-white/5'
                }`}
              >
                <Clock className="w-3 h-3 text-amber-400" />
                <span>14일+ 미점검</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30">
                  {countOverdue}
                </span>
              </button>

              {/* 사진 미등록 */}
              <button
                type="button"
                onClick={() => setSmartPreset(smartPreset === 'NO_PHOTO' ? 'ALL' : 'NO_PHOTO')}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
                  smartPreset === 'NO_PHOTO'
                    ? 'bg-slate-200 text-slate-950 border-white font-black shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-white/5'
                }`}
              >
                <Camera className="w-3 h-3" />
                <span>사진 미등록</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30">
                  {countNoPhoto}
                </span>
              </button>

              {/* 통수 정상 */}
              <button
                type="button"
                onClick={() => setSmartPreset(smartPreset === 'GOOD' ? 'ALL' : 'GOOD')}
                className={`h-8 px-3 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1.5 border ${
                  smartPreset === 'GOOD'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-emerald-400 border-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>통수 정상</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30">
                  {countGood}
                </span>
              </button>
            </div>

            {/* 원-라인 검색 & 데이터 거버넌스 툴바 */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-white/5">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="배수로 명칭, 번호, 주소 검색..."
                    className="w-full h-9 pl-9 pr-8 bg-slate-950 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
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

                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="h-9 px-3 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">전체 구역 ({ditches.length})</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono ml-1">
                  <span>
                    조회: <strong className="text-white">{sortedDitches.length}</strong> / {ditches.length}개소
                  </span>
                  {(smartPreset !== 'ALL' || sectionFilter !== 'ALL' || searchTerm) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmartPreset('ALL');
                        setSectionFilter('ALL');
                        setSearchTerm('');
                      }}
                      className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 active:scale-95 transition-all text-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      필터 초기화
                    </button>
                  )}
                </div>
              </div>

              {/* 우측 데이터 거버넌스 버튼 그룹 */}
              <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 lg:pb-0">
                <button
                  type="button"
                  onClick={() => setIsComprehensiveReportOpen(true)}
                  className="h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-900/40 active:scale-95 transition-all shrink-0"
                  title="주간 및 월간 종합 점검 리포트 1-클릭 인쇄"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>종합보고서</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-900/40 active:scale-95 transition-all shrink-0"
                  title="전체 배수로 및 점검기록 엑셀 다운로드"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>엑셀(XLSX)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1 border border-white/10 active:scale-95 transition-all shrink-0"
                  title="전체 데이터 JSON 백업 다운로드"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>백업</span>
                </button>

                <label
                  className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1 border border-white/10 cursor-pointer active:scale-95 transition-all shrink-0"
                  title="JSON 백업 파일 복원"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>복원</span>
                  <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* 4. 고밀도 데이터 표 (High-Density Table) */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* 구역 탭 바 */}
            <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5">
                {sectionTabs.map((tab) => {
                  const isSelected = sectionFilter === tab.key;
                  const secTheme = tab.key === 'ALL' ? SECTION_COLOR_CONFIG['전체'] : getSectionTheme(tab.key);
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSectionFilter(tab.key)}
                      className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 border ${
                        isSelected
                          ? secTheme.btnActive
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-white/5'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-bold">
                        {tab.count}
                      </span>
                      {tab.issueCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-slate-500 font-mono hidden md:inline shrink-0">
                행을 클릭하면 우측에 인스펙터 패널이 열립니다
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-950 text-slate-400 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider select-none">
                  <tr>
                    <th onClick={() => handleSort('code')} className="py-2.5 px-3.5 cursor-pointer hover:text-white transition-colors">
                      <div className="flex items-center gap-1">
                        <span>관리번호</span>
                        {sortField === 'code' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('name')} className="py-2.5 px-3.5 cursor-pointer hover:text-white transition-colors">
                      <div className="flex items-center gap-1">
                        <span>배수로 명칭</span>
                        {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />)}
                      </div>
                    </th>
                    <th className="py-2.5 px-3.5">구역</th>
                    <th className="py-2.5 px-3.5">제원</th>
                    <th onClick={() => handleSort('currentStatus')} className="py-2.5 px-3.5 cursor-pointer hover:text-white transition-colors">
                      <div className="flex items-center gap-1">
                        <span>상태</span>
                        {sortField === 'currentStatus' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('lastInspectedAt')} className="py-2.5 px-3.5 cursor-pointer hover:text-white transition-colors">
                      <div className="flex items-center gap-1">
                        <span>최근 점검일</span>
                        {sortField === 'lastInspectedAt' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />)}
                      </div>
                    </th>
                    <th className="py-2.5 px-3.5 text-center">사진</th>
                    <th className="py-2.5 px-3.5 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedDitches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        선택된 조건에 해당하는 배수로가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sortedDitches.map((ditch) => {
                      const section = getNormalizedDitchSection(ditch);
                      const secTheme = getSectionTheme(section);
                      const isSelected = selectedInspectorDitch?.id === ditch.id;
                      const latest = latestInspectionMap.get(ditch.id);
                      const overdue = getDitchOverdueInfo(ditch, 14);

                      return (
                        <tr
                          key={ditch.id}
                          onClick={() => setSelectedInspectorDitch(ditch)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600/15 border-l-4 border-l-blue-500'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <td className="py-2.5 px-3.5 font-mono font-bold text-white whitespace-nowrap">
                            {ditch.code}
                          </td>
                          <td className="py-2.5 px-3.5 font-bold text-slate-200">
                            {ditch.name}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${secTheme.badgeStyle}`}>
                              {section}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                            {ditch.dimension || '-'}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            {ditch.currentStatus === 'GOOD' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" /> 정상
                              </span>
                            ) : ditch.currentStatus === 'WARNING' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center gap-1 w-fit shadow-sm">
                                <AlertTriangle className="w-3 h-3" /> 준설요망
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center gap-1 w-fit shadow-sm animate-pulse">
                                <Flame className="w-3 h-3" /> 긴급조치
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs font-mono text-slate-300 whitespace-nowrap">
                            <div>
                              <span>{ditch.lastInspectedAt ? ditch.lastInspectedAt.slice(0, 10) : '미점검'}</span>
                              {overdue.isOverdue && (
                                <span className="ml-1 text-[10px] text-amber-400 font-bold">
                                  ({overdue.daysElapsed === 999 ? '미점검' : `${overdue.daysElapsed}일 경과`})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            {latest?.photoCurrentUrl ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEnlargedPhoto(latest.photoCurrentUrl);
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-white/10 inline-flex items-center justify-center transition-all"
                                title="점검 사진 보기"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-600 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onSelectDitchOnMap(ditch)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-blue-400 hover:text-blue-300 border border-white/10 transition-all"
                                title="지도에서 위치 보기"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenHistory?.(ditch)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-white/10 transition-all"
                                title="전체 점검 이력"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openPrintReport(ditch)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-white/10 transition-all"
                                title="사진대지 인쇄"
                              >
                                <Printer className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* 5. 🗃️ 우측 슬라이드오버 인스펙터 패널 (macOS Inspector Drawer) */}
      {selectedInspectorDitch && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] lg:w-[460px] bg-slate-900/95 backdrop-blur-2xl border-l border-white/15 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
          {/* 인스펙터 상단 헤더 */}
          <div className="p-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              {(() => {
                const sec = getNormalizedDitchSection(selectedInspectorDitch);
                const secTheme = getSectionTheme(sec);
                return (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${secTheme.badgeStyle}`}>
                    {sec}
                  </span>
                );
              })()}
              <h3 className="font-black text-sm text-white truncate">
                {selectedInspectorDitch.name}
              </h3>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* 이전/다음 배수로 단축 이동 버튼 */}
              <button
                type="button"
                onClick={() => handleNavigateInspector(-1)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 flex items-center justify-center border border-white/10 active:scale-95"
                title="이전 배수로 (위)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateInspector(1)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 flex items-center justify-center border border-white/10 active:scale-95"
                title="다음 배수로 (아래)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedInspectorDitch(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 active:scale-95 ml-1"
                title="패널 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 인스펙터 스크롤 바디 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 대표 사진 뷰어 */}
            {(() => {
              const latest = latestInspectionMap.get(selectedInspectorDitch.id);
              return latest?.photoCurrentUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950 group shadow-inner">
                  <img
                    src={latest.photoCurrentUrl}
                    alt="최신 점검 사진"
                    className="w-full h-44 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                    onClick={() => setEnlargedPhoto(latest.photoCurrentUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => setEnlargedPhoto(latest.photoCurrentUrl)}
                    className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm border border-white/20 active:scale-95"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>크게보기</span>
                  </button>
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-emerald-400 rounded-md text-[10px] font-bold">
                    최신 점검 사진 ({latest.inspectedAt?.slice(0, 10)})
                  </span>
                </div>
              ) : (
                <div className="h-32 rounded-2xl border border-dashed border-white/10 bg-slate-950/60 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                  <Camera className="w-6 h-6 text-slate-600" />
                  <span>등록된 현장 점검 사진 없음</span>
                </div>
              );
            })()}

            {/* 원클릭 빠른 상태 변경 액션 바 (관리자 즉시 승인/변경) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 flex items-center justify-between">
                <span>원클릭 시설물 상태 변경:</span>
                <span className="font-mono text-white text-[11px]">
                  현재: {selectedInspectorDitch.currentStatus}
                </span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('GOOD')}
                  className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                    selectedInspectorDitch.currentStatus === 'GOOD'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>정상 복구</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('WARNING')}
                  className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                    selectedInspectorDitch.currentStatus === 'WARNING'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>준설 요망</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('DANGER')}
                  className={`h-9 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                    selectedInspectorDitch.currentStatus === 'DANGER'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/40'
                      : 'bg-slate-950 hover:bg-slate-800 text-rose-400 border-rose-500/30'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>긴급 조치</span>
                </button>
              </div>
            </div>

            {/* 시설물 기준정보 (Master Data) */}
            <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-3.5 space-y-2 text-xs">
              <span className="font-black text-slate-300 text-[11px] uppercase tracking-wider block border-b border-white/5 pb-1">
                시설물 기준 정보 (Master Data)
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">관리번호</span>
                  <span className="font-mono text-white font-bold">{selectedInspectorDitch.code}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">제원 (규격)</span>
                  <span className="font-mono text-white font-bold">{selectedInspectorDitch.dimension || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">위도 (Lat)</span>
                  <span className="font-mono text-slate-300">{selectedInspectorDitch.latitude?.toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">경도 (Lng)</span>
                  <span className="font-mono text-slate-300">{selectedInspectorDitch.longitude?.toFixed(6)}</span>
                </div>
              </div>
              {selectedInspectorDitch.address && (
                <div className="pt-1 text-[11px]">
                  <span className="text-slate-500 block">상세 주소 / 메모</span>
                  <span className="text-slate-300">{selectedInspectorDitch.address}</span>
                </div>
              )}
            </div>

            {/* 최근 점검 트랜잭션 정보 (Latest Inspection Record) */}
            {(() => {
              const latest = latestInspectionMap.get(selectedInspectorDitch.id);
              if (!latest) {
                return (
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 text-slate-500 text-xs text-center">
                    등록된 최근 점검 기록이 없습니다.
                  </div>
                );
              }
              return (
                <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="font-black text-slate-300 text-[11px] uppercase tracking-wider">
                      최근 점검 결과 요약
                    </span>
                    <span className="font-mono text-slate-500 text-[10px]">{latest.inspectedAt}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    <div className="bg-slate-900 p-2 rounded-xl border border-white/5">
                      <span className="text-slate-500 block text-[10px]">퇴적 상태</span>
                      <span className="font-bold text-white">{latest.sedimentStatus}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-xl border border-white/5">
                      <span className="text-slate-500 block text-[10px]">구조 상태</span>
                      <span className="font-bold text-white">{latest.structureStatus}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-xl border border-white/5">
                      <span className="text-slate-500 block text-[10px]">조치 구분</span>
                      <span className="font-bold text-white">{latest.urgencyLevel}</span>
                    </div>
                  </div>

                  {latest.memo && (
                    <div className="bg-slate-900 p-2 rounded-xl border border-white/5 text-[11px] text-slate-300">
                      <span className="text-slate-500 font-bold mr-1">현장메모:</span>
                      <span>{latest.memo}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>점검자: <strong className="text-white">{latest.inspectorName}</strong></span>
                    {latest.gpsAccuracy && <span>GPS 오차: ±{latest.gpsAccuracy.toFixed(1)}m</span>}
                  </div>
                </div>
              );
            })()}

            {/* 하단 업무 연계 액션 버튼 그룹 */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDitchOnMap(selectedInspectorDitch)}
                  className="h-10 bg-slate-800 hover:bg-slate-750 text-blue-400 font-bold text-xs rounded-xl border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>지도에서 보기</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenHistory?.(selectedInspectorDitch)}
                  className="h-10 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>전체 이력 보기</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openPrintReport(selectedInspectorDitch)}
                  className="h-10 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-blue-900/30"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>사진대지 인쇄</span>
                </button>

                {onOpenEdit && (
                  <button
                    type="button"
                    onClick={() => onOpenEdit(selectedInspectorDitch)}
                    className="h-10 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    <span>제원 정보 수정</span>
                  </button>
                )}
              </div>

              {onDeleteDitch && (
                <button
                  type="button"
                  onClick={() => handleDeleteDitchConfirm(selectedInspectorDitch)}
                  className="w-full h-9 bg-slate-950 hover:bg-rose-950/60 text-slate-500 hover:text-rose-300 font-bold text-xs rounded-xl border border-white/5 hover:border-rose-500/30 flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>배수로 영구 삭제</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 사진대지 인쇄 팝업 모달 */}
      {activePrintTarget && (
        <PrintReportModal
          ditch={activePrintTarget.ditch}
          inspection={activePrintTarget.inspection}
          onClose={() => setActivePrintTarget(null)}
        />
      )}

      {/* 사진 전체화면 확대 모달 */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="relative max-w-3xl w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setEnlargedPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={enlargedPhoto} alt="확대 사진" className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* 종합보고서 모달 */}
      {isComprehensiveReportOpen && (
        <ComprehensiveReportModal
          isOpen={isComprehensiveReportOpen}
          onClose={() => setIsComprehensiveReportOpen(false)}
          ditches={ditches}
          inspections={inspections}
          alerts={alerts}
        />
      )}
    </div>
  );
};
