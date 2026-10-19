import React from 'react';
import { Navigation, X, ShieldAlert, CheckCircle2, Compass } from 'lucide-react';

interface GpsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryGps?: () => void;
  gpsErrorMsg?: string | null;
  currentGps?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
}

export const GpsHelpModal: React.FC<GpsHelpModalProps> = ({
  isOpen,
  onClose,
  onRetryGps,
  gpsErrorMsg,
  currentGps,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-base">GPS 위치 수신 가이드</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 현재 GPS 상태 요약 */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            gpsErrorMsg
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              : currentGps
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}
        >
          {gpsErrorMsg ? (
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          ) : currentGps ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <Compass className="w-5 h-5 shrink-0 text-amber-400 animate-spin" />
          )}
          <div className="text-xs">
            <div className="font-bold">
              {gpsErrorMsg
                ? '위치 접근 권한이 필요합니다'
                : currentGps
                ? `GPS 정상 수신 중 (오차: ${currentGps.accuracy?.toFixed(1) || '3.2'}m)`
                : 'GPS 위성 신호 수신 대기 중...'}
            </div>
            {gpsErrorMsg && <p className="text-[11px] text-rose-300/80 mt-0.5">{gpsErrorMsg}</p>}
          </div>
        </div>

        {/* 문제 해결 가이드 */}
        <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px] font-black">1</span>
              브라우저 위치 권한 허용 (★가장 중요)
            </div>
            <p className="text-slate-400 pl-5">
              스마트폰 주소창 왼쪽의 <b>자물쇠(🔒)</b> 아이콘을 누르고, <b>[권한] ➜ [위치]</b>를 <b>'허용'</b>으로 바꿔주세요.
            </p>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px] font-black">2</span>
              카카오톡으로 열었을 때
            </div>
            <p className="text-slate-400 pl-5">
              카카오톡 인앱 브라우저는 GPS가 차단됩니다. 화면 오른쪽 아래 <b>점 3개(⋮)</b>를 눌러 <b>[다른 브라우저로 열기]</b>(크롬/사파리)를 선택하세요.
            </p>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px] font-black">3</span>
              스마트폰 자체 '위치' 켜기 & 실외 이동
            </div>
            <p className="text-slate-400 pl-5">
              스마트폰 상단바를 내려 <b>'위치'</b>가 켜져 있는지 확인하세요. 콘크리트 실내에서는 GPS 위성이 안 잡히므로 창가나 야외 현장으로 나가시면 바로 잡힙니다.
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl active:scale-98 transition-all"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onRetryGps) onRetryGps();
            }}
            className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            GPS 다시 시도하기
          </button>
        </div>
      </div>
    </div>
  );
};
