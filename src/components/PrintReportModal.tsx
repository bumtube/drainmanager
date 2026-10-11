import React from 'react';
import { Printer, X, Download } from 'lucide-react';
import { DitchMaster, InspectionRecord } from '../types';

interface PrintReportModalProps {
  ditch: DitchMaster;
  inspection: InspectionRecord;
  onClose: () => void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  ditch,
  inspection,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* 인쇄 제어 툴바 (화면 표시용, 인쇄 시에는 no-print 클래스로 숨김) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 no-print bg-slate-900/90 p-2 rounded-xl border border-slate-700 shadow-xl">
        <button
          onClick={handlePrint}
          className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm flex items-center gap-1.5 shadow"
        >
          <Printer className="w-4 h-4" /> 인쇄 / PDF 저장
        </button>
        <button
          onClick={onClose}
          className="h-10 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-sm flex items-center gap-1"
        >
          <X className="w-4 h-4" /> 닫기
        </button>
      </div>

      {/* A4 표준 사진대지 규격 컨테이너 */}
      <div className="bg-white text-black w-full max-w-[210mm] min-h-[297mm] p-[12mm] shadow-2xl rounded-sm print:m-0 print:p-[10mm] print:w-full print:max-w-none print:shadow-none print:rounded-none">
        {/* 1. 상단 문서 제목 및 결재란 */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-xs text-gray-500 font-bold tracking-widest mb-1">
              [별지 제14호 서식]
            </div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              배수로 현장점검 사진대지
            </h1>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Drainage Facility Field Inspection Photo Report
            </p>
          </div>

          {/* 공공기관 표준 결재란 표 */}
          <div className="border border-black text-center text-xs">
            <div className="flex">
              <div className="w-8 py-2 bg-gray-100 border-r border-black font-bold flex items-center justify-center">
                결<br />재
              </div>
              <div>
                <div className="grid grid-cols-3 border-b border-black font-bold bg-gray-50 text-[11px]">
                  <div className="w-16 py-1 border-r border-black">담 당</div>
                  <div className="w-16 py-1 border-r border-black">팀 장</div>
                  <div className="w-16 py-1">과 장</div>
                </div>
                <div className="grid grid-cols-3 h-14">
                  <div className="border-r border-black flex items-center justify-center text-gray-400 font-serif">
                    (인)
                  </div>
                  <div className="border-r border-black flex items-center justify-center text-gray-400 font-serif">
                    (인)
                  </div>
                  <div className="flex items-center justify-center text-gray-400 font-serif">
                    (인)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 시설물 기본 제원 표 */}
        <table className="w-full border-collapse border border-black text-xs mb-5">
          <tbody>
            <tr className="border-b border-black">
              <th className="bg-gray-100 border-r border-black p-2 w-24 text-left font-bold">
                시 설 명
              </th>
              <td className="border-r border-black p-2 font-bold">{ditch.name}</td>
              <th className="bg-gray-100 border-r border-black p-2 w-24 text-left font-bold">
                관리번호
              </th>
              <td className="p-2 font-bold font-mono">{ditch.code}</td>
            </tr>
            <tr className="border-b border-black">
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                담당공구/구역
              </th>
              <td className="border-r border-black p-2">{ditch.section}</td>
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                단면 규격
              </th>
              <td className="p-2">{ditch.dimension}</td>
            </tr>
            <tr className="border-b border-black">
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                설치 위치
              </th>
              <td className="border-r border-black p-2">{ditch.address || '-'}</td>
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                GPS 좌표
              </th>
              <td className="p-2 font-mono text-[11px]">
                N {inspection.latitude?.toFixed(6) || ditch.latitude.toFixed(6)}, E{' '}
                {inspection.longitude?.toFixed(6) || ditch.longitude.toFixed(6)}
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                점검일시
              </th>
              <td className="border-r border-black p-2 font-medium">{inspection.inspectedAt}</td>
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                점 검 자
              </th>
              <td className="p-2 font-bold">{inspection.inspectorName}</td>
            </tr>
          </tbody>
        </table>

        {/* 3. 현장 비교 사진대지 (1:1 배치) */}
        <div className="border border-black p-2 mb-5">
          <div className="font-bold text-xs bg-gray-100 p-1.5 border-b border-black mb-2 text-center">
            [ 현 장 점 검 사 진 대 지 ]
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* 직전 점검 사진 */}
            <div className="border border-gray-400 p-2 text-center">
              <div className="h-[210px] bg-gray-100 flex items-center justify-center overflow-hidden mb-2 border border-gray-300">
                {inspection.photoPreviousUrl ? (
                  <img
                    src={inspection.photoPreviousUrl}
                    alt="직전 점검 사진"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">직전 점검 사진 기록 없음</span>
                )}
              </div>
              <div className="font-bold text-xs text-gray-800 bg-gray-100 py-1">
                직전 점검 사진 (Before)
              </div>
            </div>

            {/* 금회 점검 사진 */}
            <div className="border border-gray-400 p-2 text-center">
              <div className="h-[210px] bg-gray-100 flex items-center justify-center overflow-hidden mb-2 border border-gray-300">
                {inspection.photoCurrentUrl ? (
                  <img
                    src={inspection.photoCurrentUrl}
                    alt="금회 점검 사진"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">촬영 사진 없음</span>
                )}
              </div>
              <div className="font-bold text-xs text-emerald-800 bg-emerald-50 py-1 border border-emerald-300">
                금회 점검 사진 (After - 현장 워터마크 각인)
              </div>
            </div>
          </div>
        </div>

        {/* 4. 점검 판정 및 종합 의견 서술란 */}
        <table className="w-full border-collapse border border-black text-xs mb-4">
          <tbody>
            <tr className="border-b border-black">
              <th className="bg-gray-100 border-r border-black p-2 w-28 text-left font-bold">
                퇴적 상태 판정
              </th>
              <td className="border-r border-black p-2 font-bold">
                {inspection.sedimentStatus}
              </td>
              <th className="bg-gray-100 border-r border-black p-2 w-28 text-left font-bold">
                구조 상태 판정
              </th>
              <td className="p-2 font-bold">{inspection.structureStatus}</td>
            </tr>
            <tr className="border-b border-black">
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold">
                조치 구분
              </th>
              <td colSpan={3} className="p-2 font-black">
                <span
                  className={
                    inspection.urgencyLevel === '긴급조치'
                      ? 'text-red-600 bg-red-100 px-2 py-0.5 rounded'
                      : 'text-green-700'
                  }
                >
                  {inspection.urgencyLevel === '긴급조치'
                    ? '■ 긴급조치 요망 (준설/보수 필요)'
                    : '■ 정기점검 대상 (통수 이상무)'}
                </span>
              </td>
            </tr>
            <tr>
              <th className="bg-gray-100 border-r border-black p-2 text-left font-bold align-top">
                점검자 종합의견<br />및 조치계획
              </th>
              <td colSpan={3} className="p-3 leading-relaxed min-h-[70px]">
                {inspection.memo ? (
                  inspection.memo
                ) : (
                  <span className="text-gray-500">
                    특이사항 없음. 유수 소통 원활하며 통수단면 유지 상태 양호함.
                  </span>
                )}
                {inspection.gpsAccuracy && (
                  <div className="text-[10px] text-gray-500 mt-2">
                    * 현장 모바일 GPS 측정 오차: 약 {inspection.gpsAccuracy}m 이내
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 하단 작성일 및 공공기관 서명문 */}
        <div className="text-center mt-6 pt-4 border-t border-gray-300">
          <p className="text-xs text-gray-700 font-medium mb-1">
            위와 같이 배수로 시설물 현장 점검 결과를 보고합니다.
          </p>
          <p className="text-xs font-bold text-gray-900 font-mono">
            {inspection.inspectedAt.slice(0, 10)}
          </p>
          <div className="text-sm font-black text-gray-900 mt-3">
            점검자: {inspection.inspectorName} (인)
          </div>
        </div>
      </div>
    </div>
  );
};
