import React, { useState } from 'react';
import { ShieldCheck, HardHat, Check, AlertCircle } from 'lucide-react';
import { UserRole, UserSession } from '../types';

interface RoleSelectorProps {
  currentSession: UserSession | null;
  onSelectSession: (session: UserSession) => void;
  onCancel?: () => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  currentSession,
  onSelectSession,
  onCancel,
}) => {
  const [role, setRole] = useState<UserRole>(currentSession?.role || 'INSPECTOR');
  const [inspectorName, setInspectorName] = useState(
    currentSession?.role === 'INSPECTOR' ? currentSession.name : '김현장 주사'
  );
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleConfirm = () => {
    if (role === 'ADMIN') {
      // 관리자 기본 간이 PIN: 1234
      if (adminPin !== '1234' && !currentSession?.pinVerified) {
        setPinError(true);
        return;
      }
      onSelectSession({
        role: 'ADMIN',
        name: '시설관리자 (Admin)',
        pinVerified: true,
      });
    } else {
      if (!inspectorName.trim()) {
        alert('점검자 성명을 입력해주세요.');
        return;
      }
      onSelectSession({
        role: 'INSPECTOR',
        name: inspectorName.trim(),
        pinVerified: false,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full mb-2">
            주택전시관 배수시설 관리
          </span>
          <h2 className="text-2xl font-black tracking-tight text-white">현장 점검자 / 역할 선택</h2>
          <p className="text-sm text-slate-400 mt-1">
            원활한 현장 점검 및 이력 관리를 위해 역할을 선택하세요.
          </p>
        </div>

        {/* 역할 선택 탭 (56px 이상 대형 버튼) */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => {
              setRole('INSPECTOR');
              setPinError(false);
            }}
            className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 transition-all min-h-[96px] ${
              role === 'INSPECTOR'
                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/40'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
            }`}
          >
            <HardHat className="w-8 h-8 mb-1.5" />
            <span className="font-bold text-base">현장 주사님</span>
            <span className="text-[11px] opacity-75">점검·촬영 전용</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRole('ADMIN');
              setPinError(false);
            }}
            className={`flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 transition-all min-h-[96px] ${
              role === 'ADMIN'
                ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-lg shadow-blue-950/40'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
            }`}
          >
            <ShieldCheck className="w-8 h-8 mb-1.5" />
            <span className="font-bold text-base">시설 관리자</span>
            <span className="text-[11px] opacity-75">배수로 등록·엑셀/PDF</span>
          </button>
        </div>

        {/* 상세 입력 폼 */}
        {role === 'INSPECTOR' ? (
          <div className="space-y-3 mb-6">
            <label className="block text-xs font-semibold text-slate-300">
              점검자 성명 (사진 워터마크에 기록됨)
            </label>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="예: 김철수 주사"
              className="w-full h-14 px-4 bg-slate-800 border border-slate-600 rounded-xl text-white text-lg font-medium focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-slate-400">
              🔒 현장 주사님 모드에서는 시설물 위치가 보호(고정)되며 점검 폼만 작성됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <label className="block text-xs font-semibold text-slate-300">
              관리자 간이 PIN 번호 (기본: 1234)
            </label>
            <input
              type="password"
              maxLength={8}
              value={adminPin}
              onChange={(e) => {
                setAdminPin(e.target.value);
                setPinError(false);
              }}
              placeholder="PIN 번호 입력"
              className="w-full h-14 px-4 bg-slate-800 border border-slate-600 rounded-xl text-white text-xl tracking-widest text-center font-bold focus:outline-none focus:border-blue-500"
            />
            {pinError && (
              <p className="text-xs text-red-400 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-4 h-4" /> PIN 번호가 일치하지 않습니다. (초기값: 1234)
              </p>
            )}
            <p className="text-xs text-slate-400">
              🔑 관리자는 현장 배수로 핀 등록, 드래그 수정, 엑셀/PDF 출력 권한을 갖습니다.
            </p>
          </div>
        )}

        {/* 확인 / 취소 버튼 */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-14 rounded-xl border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 active:scale-95 transition-all"
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
              role === 'INSPECTOR'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Check className="w-5 h-5" />
            {role === 'INSPECTOR' ? '현장 점검 시작' : '관리자 모드 접속'}
          </button>
        </div>
      </div>
    </div>
  );
};
