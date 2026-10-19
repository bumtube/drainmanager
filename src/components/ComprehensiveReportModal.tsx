import React, { useState, useMemo } from 'react';
import { Printer, X, Calendar, FileText, CheckCircle2, AlertTriangle, Flame, Siren, Download } from 'lucide-react';
import { DitchMaster, InspectionRecord, EmergencyAlert } from '../types';
import { getDitchOverdueInfo } from '../utils/ditchOverdue';

interface ComprehensiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  ditches: DitchMaster[];
  inspections: InspectionRecord[];
  alerts?: EmergencyAlert[];
}

export const ComprehensiveReportModal: React.FC<ComprehensiveReportModalProps> = ({
  isOpen,
  onClose,
  ditches,
  inspections,
  alerts = [],
}) => {
  // 보고서 유형: 'weekly' (최근 7일) vs 'monthly' (최근 30일)
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly');

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // 기간 계산
  const endDateStr = formatYmd(today);
  const startDate = new Date();
  if (reportType === 'weekly') {
    startDate.setDate(today.getDate() - 6);
  } else {
    startDate.setDate(today.getDate() - 29);
  }
  const startDateStr = formatYmd(startDate);

  // 해당 기간 내의 점검 기록 필터링
  const periodInspections = useMemo(() => {
    return inspections.filter((insp) => {
      const datePart = (insp.inspectedAt || '').slice(0, 10);
      return datePart >= startDateStr && datePart <= endDateStr;
    });
  }, [inspections, startDateStr, endDateStr]);

  // 점검된 고유 배수로 개수
  const inspectedDitchIds = new Set(periodInspections.map((i) => i.ditchId));
  const inspectedDitchesCount = inspectedDitchIds.size;
  const complianceRate = ditches.length > 0 ? Math.round((inspectedDitchesCount / ditches.length) * 100) : 0;

  // 상태별 점검 건수 집계
  const countGood = periodInspections.filter((i) => i.urgencyLevel === '정기점검' || (i.sedimentStatus === '정상' && i.structureStatus === '정상')).length;
  const countWarning = periodInspections.filter((i) => i.urgencyLevel === '조치예정' || i.sedimentStatus === '준설필요' || i.structureStatus === '균열/이탈').length;
  const countDanger = periodInspections.filter((i) => i.urgencyLevel === '긴급조치' || i.sedimentStatus === '완전막힘' || i.structureStatus === '파손/붕괴').length;

  // 구역 목록
  const sections = ['정자 앞', '본관3층', '본관4층', '별관', '식수'];
  const getSection = (d: DitchMaster) => {
    if (!d) return '정자 앞';
    const s = d.section || '';
    const n = d.name || '';
    const code = d.code || '';
    const memo = d.memo || '';
    const addr = d.address || '';
    const combined = `${s} ${n} ${code} ${memo} ${addr}`;

    if (s === '식수' || n.includes('식수')) return '식수';
    if (s === '별관' || n.includes('별관')) return '별관';
    if (s === '본관4층' || combined.includes('본관4층') || combined.includes('4층') || combined.includes('4F')) return '본관4층';
    if (s === '본관3층' || combined.includes('본관3층') || combined.includes('3층') || combined.includes('3F') || s === '본관' || n.includes('본관')) return '본관3층';
    if (
      s === '정자 앞' ||
      s === '도로' ||
      s === '주차장' ||
      n.includes('정자 앞') ||
      n.includes('도로') ||
      n.includes('주차장')
    ) {
      return '정자 앞';
    }
    return s || '정자 앞';
  };

  // 구역별 통계
  const sectionStats = useMemo(() => {
    return sections.map((sec) => {
      const secDitches = ditches.filter((d) => getSection(d) === sec);
      const secInsp = periodInspections.filter((insp) => {
        const targetDitch = ditches.find((d) => d.id === insp.ditchId);
        return targetDitch && getSection(targetDitch) === sec;
      });
      const secInspectedDitchIds = new Set(secInsp.map((i) => i.ditchId));
      const secGood = secInsp.filter((i) => i.urgencyLevel === '정기점검' || (i.sedimentStatus === '정상' && i.structureStatus === '정상')).length;
      const secWarning = secInsp.filter((i) => i.urgencyLevel === '조치예정' || i.sedimentStatus === '준설필요' || i.structureStatus === '균열/이탈').length;
      const secDanger = secInsp.filter((i) => i.urgencyLevel === '긴급조치' || i.sedimentStatus === '완전막힘' || i.structureStatus === '파손/붕괴').length;

      return {
        section: sec,
        totalCount: secDitches.length,
        inspCount: secInsp.length,
        inspectedUniqueCount: secInspectedDitchIds.size,
        rate: secDitches.length > 0 ? Math.round((secInspectedDitchIds.size / secDitches.length) * 100) : 0,
        good: secGood,
        warning: secWarning,
        danger: secDanger,
      };
    });
  }, [ditches, periodInspections]);

  // 주요 이상 시설물 목록 (주의/위험)
  const abnormalInspections = useMemo(() => {
    return periodInspections.filter(
      (i) => i.urgencyLevel === '긴급조치' || i.urgencyLevel === '조치예정' || i.sedimentStatus === '완전막힘' || i.sedimentStatus === '준설필요' || i.structureStatus === '파손/붕괴' || i.structureStatus === '균열/이탈'
    );
  }, [periodInspections]);

  // 장기 미점검 시설물 (14일 이상)
  const overdueDitches = useMemo(() => {
    return ditches.filter((d) => getDitchOverdueInfo(d, 14).isOverdue);
  }, [ditches]);

  // 대표 사진 목록 (기간 내 촬영된 사진 중 최대 4장 선별)
  const samplePhotos = useMemo(() => {
    const withPhoto = periodInspections.filter((i) => i.photoCurrentUrl && i.photoCurrentUrl.length > 50);
    // 위험/주의 사진 우선, 그 다음 최신 사진
    withPhoto.sort((a, b) => {
      const aDanger = a.urgencyLevel === '긴급조치' || a.sedimentStatus === '완전막힘' ? 2 : a.sedimentStatus === '준설필요' ? 1 : 0;
      const bDanger = b.urgencyLevel === '긴급조치' || b.sedimentStatus === '완전막힘' ? 2 : b.sedimentStatus === '준설필요' ? 1 : 0;
      if (aDanger !== bDanger) return bDanger - aDanger;
      return (b.inspectedAt || '').localeCompare(a.inspectedAt || '');
    });
    return withPhoto.slice(0, 4);
  }, [periodInspections]);

  const handlePrint = () => {
    window.print();
  };

  // 모달이 닫혀 있으면 렌더링하지 않음 (모든 Hook 호출 이후에 위치)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-5">
      {/* 1. 상단 인쇄/전환 제어 툴바 (화면 표시 전용, 인쇄 시 자동 숨김) */}
      <div className="sticky top-2 z-50 mb-3 flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 border border-slate-700 p-2 sm:p-2.5 rounded-2xl shadow-2xl max-w-[210mm] w-full text-white no-print">
        {/* 주간 / 월간 전환 토글 */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setReportType('weekly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              reportType === 'weekly'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            주간 종합보고서 (7일)
          </button>
          <button
            type="button"
            onClick={() => setReportType('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              reportType === 'monthly'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            월간 종합보고서 (30일)
          </button>
        </div>

        {/* 인쇄 및 닫기 버튼 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            인쇄 / PDF 저장
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            닫기
          </button>
        </div>
      </div>

      {/* 2. A4 공공 양식 표준 리포트 컨테이너 (인쇄 최적화) */}
      <div className="bg-white text-black w-full max-w-[210mm] min-h-[297mm] p-[12mm] shadow-2xl rounded-sm print:m-0 print:p-[8mm] print:w-full print:max-w-none print:shadow-none print:rounded-none font-sans text-xs leading-normal">
        {/* 상단 서식 번호 및 결재란 */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">
              {reportType === 'weekly' ? '[별지 제1호 서식]' : '[별지 제2호 서식]'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">
              배수시설 유지관리 {reportType === 'weekly' ? '주간' : '월간'} 종합보고서
            </h1>
            <p className="text-[11px] text-gray-600 mt-1 font-medium">
              성남시 분당구 불정로 50 (분당노인종합복지관) 배수시설 종합 안전점검
            </p>
            <div className="text-[11px] font-bold text-blue-900 mt-1">
              점검 대상 기간: {startDateStr} ~ {endDateStr} ({reportType === 'weekly' ? '7일간' : '30일간'})
            </div>
          </div>

          {/* 공공기관 표준 결재란 */}
          <div className="border border-black text-center text-[10px]">
            <div className="flex">
              <div className="w-6 py-2 bg-gray-100 border-r border-black font-bold flex items-center justify-center">
                결<br />재
              </div>
              <div>
                <div className="grid grid-cols-4 border-b border-black font-bold bg-gray-50 text-[10px]">
                  <div className="w-14 py-1 border-r border-black">담 당</div>
                  <div className="w-14 py-1 border-r border-black">팀 장</div>
                  <div className="w-14 py-1 border-r border-black">부 장</div>
                  <div className="w-14 py-1">관 장</div>
                </div>
                <div className="grid grid-cols-4 h-12">
                  <div className="border-r border-black flex items-center justify-center text-gray-400 font-serif text-[10px]">(인)</div>
                  <div className="border-r border-black flex items-center justify-center text-gray-400 font-serif text-[10px]">(인)</div>
                  <div className="border-r border-black flex items-center justify-center text-gray-400 font-serif text-[10px]">(인)</div>
                  <div className="flex items-center justify-center text-gray-400 font-serif text-[10px]">(인)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1. 총괄 점검 실적 요약 테이블 */}
        <div className="mb-4">
          <h2 className="text-sm font-black text-gray-900 mb-1.5 flex items-center gap-1.5">
            <span>1.</span> 총괄 점검 및 시설물 운영 현황
          </h2>
          <table className="w-full border-collapse border border-black text-center text-[11px]">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-bold">
                <th className="border-r border-black py-1.5">총 관리 시설물</th>
                <th className="border-r border-black py-1.5">기간 내 점검 횟수</th>
                <th className="border-r border-black py-1.5">점검 이행 시설</th>
                <th className="border-r border-black py-1.5">점검 이행률</th>
                <th className="border-r border-black py-1.5">통수 정상</th>
                <th className="border-r border-black py-1.5">준설/관찰 필요</th>
                <th className="border-r border-black py-1.5">긴급조치 요망</th>
                <th className="py-1.5">긴급 경광등</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <td className="border-r border-black py-2 font-bold">{ditches.length}개소</td>
                <td className="border-r border-black py-2 font-bold text-blue-700">{periodInspections.length}건</td>
                <td className="border-r border-black py-2 font-bold">{inspectedDitchesCount}개소</td>
                <td className="border-r border-black py-2 font-bold text-purple-700">{complianceRate}%</td>
                <td className="border-r border-black py-2 text-emerald-700 font-bold">{countGood}건</td>
                <td className="border-r border-black py-2 text-amber-700 font-bold">{countWarning}건</td>
                <td className="border-r border-black py-2 text-rose-700 font-bold">{countDanger}건</td>
                <td className="py-2 text-rose-600 font-black">{alerts.length}건 발생</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. 구역별 점검 실적 및 상태 요약 */}
        <div className="mb-4">
          <h2 className="text-sm font-black text-gray-900 mb-1.5 flex items-center gap-1.5">
            <span>2.</span> 구역별 세부 점검 실적
          </h2>
          <table className="w-full border-collapse border border-black text-center text-[11px]">
            <thead>
              <tr className="bg-gray-100 border-b border-black font-bold">
                <th className="border-r border-black py-1.5">구역 구분</th>
                <th className="border-r border-black py-1.5">관리 개소수</th>
                <th className="border-r border-black py-1.5">점검 건수</th>
                <th className="border-r border-black py-1.5">점검 완료 배수로</th>
                <th className="border-r border-black py-1.5">이행률</th>
                <th className="border-r border-black py-1.5">정상</th>
                <th className="border-r border-black py-1.5">주의</th>
                <th className="py-1.5">긴급</th>
              </tr>
            </thead>
            <tbody>
              {sectionStats.map((stat) => (
                <tr key={stat.section} className="border-b border-black">
                  <td className="border-r border-black py-1.5 font-bold bg-gray-50">{stat.section}</td>
                  <td className="border-r border-black py-1.5">{stat.totalCount}개소</td>
                  <td className="border-r border-black py-1.5 font-semibold">{stat.inspCount}건</td>
                  <td className="border-r border-black py-1.5">{stat.inspectedUniqueCount}개소</td>
                  <td className="border-r border-black py-1.5 font-bold text-blue-800">{stat.rate}%</td>
                  <td className="border-r border-black py-1.5 text-emerald-700 font-semibold">{stat.good}</td>
                  <td className="border-r border-black py-1.5 text-amber-700 font-semibold">{stat.warning}</td>
                  <td className="py-1.5 text-rose-700 font-black">{stat.danger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. 주요 이상 발견 시설물 및 긴급조치 내역 */}
        <div className="mb-4">
          <h2 className="text-sm font-black text-gray-900 mb-1.5 flex items-center gap-1.5">
            <span>3.</span> 주요 이상 발견 시설물 및 조치 권고사항
          </h2>
          {abnormalInspections.length === 0 ? (
            <div className="border border-black p-2 text-center text-gray-500 bg-gray-50 text-[11px]">
              해당 기간 내 특이 결함이나 긴급 준설이 필요한 위험 배수로가 발견되지 않았습니다. (전체 양호 상태 유지)
            </div>
          ) : (
            <table className="w-full border-collapse border border-black text-left text-[10px]">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-bold text-center">
                  <th className="border-r border-black py-1 w-20">관리번호</th>
                  <th className="border-r border-black py-1 w-28">시설물명</th>
                  <th className="border-r border-black py-1 w-16">점검일시</th>
                  <th className="border-r border-black py-1 w-16">퇴적상태</th>
                  <th className="border-r border-black py-1 w-16">구조상태</th>
                  <th className="border-r border-black py-1 w-14">판정</th>
                  <th className="py-1">특이사항 및 권고 조치</th>
                </tr>
              </thead>
              <tbody>
                {abnormalInspections.map((insp) => {
                  const targetDitch = ditches.find((d) => d.id === insp.ditchId);
                  const isDanger = insp.urgencyLevel === '긴급조치' || insp.sedimentStatus === '완전막힘' || insp.structureStatus === '파손/붕괴';
                  return (
                    <tr key={insp.id} className="border-b border-black">
                      <td className="border-r border-black p-1 font-mono font-bold text-center">
                        {(targetDitch?.code || '').replace(/(주차장|도로)/g, '정자 앞')}
                      </td>
                      <td className="border-r border-black p-1 font-semibold">
                        {(targetDitch?.name || '').replace(/(주차장|도로)/g, '정자 앞')}
                      </td>
                      <td className="border-r border-black p-1 text-center font-mono">
                        {(insp.inspectedAt || '').slice(5, 16)}
                      </td>
                      <td className={`border-r border-black p-1 text-center font-bold ${insp.sedimentStatus === '완전막힘' ? 'text-rose-700' : 'text-amber-700'}`}>
                        {insp.sedimentStatus}
                      </td>
                      <td className="border-r border-black p-1 text-center">
                        {insp.structureStatus}
                      </td>
                      <td className={`border-r border-black p-1 text-center font-black ${isDanger ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50'}`}>
                        {isDanger ? '긴급조치' : '주의'}
                      </td>
                      <td className="p-1">
                        {insp.memo || '정기 준설 및 이물질 제거 권고'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. 장기 미점검 시설물 현황 (순찰 누락 방지) */}
        <div className="mb-4">
          <h2 className="text-sm font-black text-gray-900 mb-1.5 flex items-center justify-between">
            <span>4. 장기 미점검 시설물 현황 (14일 이상 미점검)</span>
            <span className="text-xs text-rose-600 font-bold">{overdueDitches.length}개소 방치 주의</span>
          </h2>
          {overdueDitches.length === 0 ? (
            <div className="border border-black p-2 text-center text-gray-500 bg-gray-50 text-[11px]">
              모든 배수로 시설물이 14일 이내에 정상 점검되었습니다. (방치 시설물 없음)
            </div>
          ) : (
            <div className="border border-black p-2 bg-gray-50 text-[10px]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {overdueDitches.slice(0, 9).map((d) => {
                  const overdue = getDitchOverdueInfo(d, 14);
                  return (
                    <div key={d.id} className="p-1.5 bg-white border border-gray-300 rounded flex justify-between items-center">
                      <span className="font-bold truncate">{(d.name || '').replace(/(주차장|도로)/g, '정자 앞')}</span>
                      <span className="font-bold text-rose-700 shrink-0 ml-1 font-mono">[{overdue.label}]</span>
                    </div>
                  );
                })}
              </div>
              {overdueDitches.length > 9 && (
                <div className="text-center text-[10px] text-gray-500 mt-1">
                  외 {overdueDitches.length - 9}개소 추가 방치 (즉시 순찰 요망)
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. 현장 사진대지 (대표 현장 사진 4선) */}
        {samplePhotos.length > 0 && (
          <div>
            <h2 className="text-sm font-black text-gray-900 mb-1.5 flex items-center gap-1.5">
              <span>5.</span> 주요 현장 점검 사진대지
            </h2>
            <div className="grid grid-cols-2 gap-2 border border-black p-2 bg-gray-50">
              {samplePhotos.map((insp, idx) => {
                const targetDitch = ditches.find((d) => d.id === insp.ditchId);
                return (
                  <div key={insp.id} className="bg-white border border-black p-1.5 flex flex-col justify-between">
                    <div className="w-full h-32 sm:h-36 overflow-hidden bg-black flex items-center justify-center border border-gray-300 mb-1">
                      <img
                        src={insp.photoCurrentUrl}
                        alt="현장 사진"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[9.5px] space-y-0.5 leading-tight font-medium">
                      <div className="font-bold text-gray-900 flex justify-between">
                        <span>[사진 {idx + 1}] {(targetDitch?.name || '').replace(/(주차장|도로)/g, '정자 앞')}</span>
                        <span className="font-mono text-gray-500">{(targetDitch?.code || '').replace(/(주차장|도로)/g, '정자 앞')}</span>
                      </div>
                      <div className="text-gray-600 flex justify-between font-mono">
                        <span>점검일시: {insp.inspectedAt}</span>
                        <span className="font-bold text-rose-700">[{insp.sedimentStatus}]</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 하단 기관 날인 및 확인 */}
        <div className="mt-6 pt-3 border-t border-black flex justify-between items-center text-[11px] text-gray-700">
          <span>보고서 생성일시: {new Date().toLocaleString('ko-KR')}</span>
          <span className="font-bold">분당노인종합복지관 시설안전관리팀 (직인생략)</span>
        </div>
      </div>
    </div>
  );
};
