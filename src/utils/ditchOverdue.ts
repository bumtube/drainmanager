import { DitchMaster } from '../types';

export interface OverdueInfo {
  isOverdue: boolean;
  daysElapsed: number;
  label: string;
  level: 'normal' | 'warning' | 'critical'; // <14일 정상, 14~29일 경고, >=30일 심각방치
}

/**
 * 배수로의 장기 미점검 및 방치 여부를 판별하는 유틸리티
 * @param ditch 대상 배수로
 * @param thresholdDays 장기 미점검 기준 일수 (기본값: 14일)
 */
export function getDitchOverdueInfo(ditch: DitchMaster, thresholdDays: number = 14): OverdueInfo {
  if (!ditch.lastInspectedAt || ditch.lastInspectedAt.trim() === '') {
    return {
      isOverdue: true,
      daysElapsed: 999,
      label: '미점검 시설물',
      level: 'critical',
    };
  }

  // YYYY-MM-DD HH:mm 또는 YYYY-MM-DD 파싱
  const normalized = ditch.lastInspectedAt.includes('T')
    ? ditch.lastInspectedAt
    : ditch.lastInspectedAt.replace(' ', 'T');
  const parsedDate = new Date(normalized).getTime();

  if (isNaN(parsedDate)) {
    return {
      isOverdue: true,
      daysElapsed: 999,
      label: '미점검 시설물',
      level: 'critical',
    };
  }

  const diffMs = Date.now() - parsedDate;
  const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (daysElapsed >= 30) {
    return {
      isOverdue: true,
      daysElapsed,
      label: `${daysElapsed}일 방치`,
      level: 'critical',
    };
  } else if (daysElapsed >= thresholdDays) {
    return {
      isOverdue: true,
      daysElapsed,
      label: `${daysElapsed}일 미점검`,
      level: 'warning',
    };
  }

  return {
    isOverdue: false,
    daysElapsed,
    label: daysElapsed === 0 ? '오늘 점검' : `${daysElapsed}일 전`,
    level: 'normal',
  };
}
