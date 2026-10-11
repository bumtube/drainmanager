import * as XLSX from 'xlsx';
import { DitchMaster, InspectionRecord } from '../types';

export function exportDitchesAndInspectionsToExcel(
  ditches: DitchMaster[],
  inspections: InspectionRecord[]
): void {
  // 1. 배수로 총괄 현황 시트 데이터 구성
  const ditchSheetData = ditches.map((d, index) => {
    const statusKorean =
      d.currentStatus === 'GOOD'
        ? '정상 (양호)'
        : d.currentStatus === 'WARNING'
        ? '주의 (준설/관찰)'
        : '긴급 (즉시조치)';

    return {
      '연번': index + 1,
      '관리번호': d.code,
      '배수로 명칭': d.name,
      '담당구역': d.section,
      '단면 규격': d.dimension,
      '위도 (Lat)': d.latitude.toFixed(6),
      '경도 (Lng)': d.longitude.toFixed(6),
      '상세 위치': d.address || '-',
      '현재 상태': statusKorean,
      '최근 점검일시': d.lastInspectedAt || '미점검',
      '비고 및 메모': d.memo || '',
    };
  });

  // 2. 점검 이력 상세 시트 데이터 구성
  const ditchMap = new Map<string, DitchMaster>();
  ditches.forEach((d) => ditchMap.set(d.id, d));

  const inspectionSheetData = inspections.map((insp, index) => {
    const parentDitch = ditchMap.get(insp.ditchId);
    return {
      '연번': index + 1,
      '관리번호': parentDitch?.code || '-',
      '배수로 명칭': parentDitch?.name || '삭제된 배수로',
      '점검일시': insp.inspectedAt,
      '점검자': insp.inspectorName,
      '퇴적 상태': insp.sedimentStatus,
      '구조 상태': insp.structureStatus,
      '조치 구분': insp.urgencyLevel,
      '측정 위도': (insp.latitude ?? parentDitch?.latitude ?? 0).toFixed(6),
      '측정 경도': (insp.longitude ?? parentDitch?.longitude ?? 0).toFixed(6),
      'GPS 오차(m)': insp.gpsAccuracy ? `${insp.gpsAccuracy}m` : '기록없음',
      '현장 특이사항': insp.memo || '',
    };
  });

  // 3. 워크북 생성
  const wb = XLSX.utils.book_new();

  // 배수로 총괄표 시트
  const wsDitches = XLSX.utils.json_to_sheet(ditchSheetData);
  // 열 너비 설정
  wsDitches['!cols'] = [
    { wch: 6 },  // 연번
    { wch: 14 }, // 관리번호
    { wch: 30 }, // 배수로 명칭
    { wch: 18 }, // 담당구역
    { wch: 20 }, // 단면 규격
    { wch: 14 }, // 위도
    { wch: 14 }, // 경도
    { wch: 32 }, // 상세 위치
    { wch: 16 }, // 현재 상태
    { wch: 18 }, // 최근 점검일시
    { wch: 36 }, // 비고
  ];
  XLSX.utils.book_append_sheet(wb, wsDitches, '배수로 총괄 현황');

  // 점검 기록 상세표 시트
  const wsInspections = XLSX.utils.json_to_sheet(inspectionSheetData);
  wsInspections['!cols'] = [
    { wch: 6 },  // 연번
    { wch: 14 }, // 관리번호
    { wch: 30 }, // 배수로 명칭
    { wch: 18 }, // 점검일시
    { wch: 14 }, // 점검자
    { wch: 16 }, // 퇴적 상태
    { wch: 16 }, // 구조 상태
    { wch: 14 }, // 조치 구분
    { wch: 14 }, // 위도
    { wch: 14 }, // 경도
    { wch: 12 }, // GPS 오차
    { wch: 40 }, // 특이사항
  ];
  XLSX.utils.book_append_sheet(wb, wsInspections, '현장점검 이력 상세');

  // 4. 다운로드 실행
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `배수로_점검총괄표_${todayStr}.xlsx`);
}
