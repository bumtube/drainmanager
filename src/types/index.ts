export type DrainStatus = 'GOOD' | 'WARNING' | 'DANGER'; // 정상: 초록, 주의: 주황, 긴급: 빨강
export type SedimentStatus = '정상' | '준설필요' | '완전막힘' | '정상(<30%)' | '준설필요(>30%)';
export type StructureStatus = '정상' | '균열/이탈' | '파손/붕괴';
export type UrgencyLevel = '조치완료' | '조치예정' | '정기점검' | '긴급조치';
export type UserRole = 'ADMIN' | 'INSPECTOR';

export interface UserSession {
  role: UserRole;
  name: string;
  pinVerified?: boolean;
}

export interface DitchMaster {
  id: string; // 고유 ID
  code: string; // 예: 'DRAIN-001'
  name: string; // 예: '갈현리 204번지 농로 배수로'
  section: string; // 예: '1공구 농로'
  dimension: string; // 예: 'U형 0.8m'
  latitude: number; // 위도
  longitude: number; // 경도
  currentStatus: DrainStatus; // 상태
  lastInspectedAt: string; // 최근 점검일시 (YYYY-MM-DD HH:mm)
  address?: string; // 주소 또는 상세 위치
  memo?: string; // 시설 메모
  createdAt: string;
}

export interface InspectionRecord {
  id: string;
  ditchId: string;
  inspectedAt: string; // 점검 일시 (YYYY-MM-DD HH:mm)
  inspectorName: string; // 점검자 성명
  sedimentStatus: SedimentStatus; // 퇴적 상태
  structureStatus: StructureStatus; // 구조 상태
  urgencyLevel: UrgencyLevel; // 조치 구분
  memo: string; // 특이사항
  photoCurrentUrl: string; // 금회 촬영 사진 (Base64 or URL)
  photoPreviousUrl?: string; // 직전 점검 사진
  gpsAccuracy?: number; // 오차 m 단위
  latitude?: number;
  longitude?: number;
}

export interface FirebaseConfigState {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  enabled: boolean;
}

export interface EmergencyAlert {
  id: string; // 고유 ID (예: alert-1792076000000)
  latitude: number; // 발생 위도
  longitude: number; // 발생 경도
  createdAt: string; // ISO 타임스탬프
  createdFormatted: string; // 표시용 일시 (예: 2026-10-16 00:05)
  creatorName: string; // 등록자 이름 (예: 김철수 주사님)
  message: string; // 상황 설명 (예: 긴급 지원 필요)
  photoUrl?: string; // 긴급상황 현장 사진 (Base64 or URL)
}

