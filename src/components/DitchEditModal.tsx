import React, { useState } from 'react';
import { X, MapPin, Save, Trash2, Navigation, Check } from 'lucide-react';
import { DitchMaster, DrainStatus } from '../types';

interface DitchEditModalProps {
  ditch: DitchMaster | null; // null이면 신규 등록
  currentGps?: { latitude: number; longitude: number; accuracy?: number } | null;
  onSave: (ditch: DitchMaster) => Promise<void>;
  onDelete?: (ditchId: string) => Promise<void>;
  onClose: () => void;
}

// 현장 맞춤형 3개 구역
const SECTIONS = ['주차장', '본관', '별관'] as const;
type SectionType = (typeof SECTIONS)[number];

export const DitchEditModal: React.FC<DitchEditModalProps> = ({
  ditch,
  currentGps,
  onSave,
  onDelete,
  onClose,
}) => {
  const isNew = !ditch;

  // 1. 구역 선택 (주차장, 본관, 별관)
  const [section, setSection] = useState<string>(
    ditch?.section && SECTIONS.includes(ditch.section as any) ? ditch.section : '주차장'
  );

  // 2. 현재 상태 (정상, 주의, 긴급)
  const [currentStatus, setCurrentStatus] = useState<DrainStatus>(ditch?.currentStatus || 'GOOD');

  // 3. 특이사항
  const [memo, setMemo] = useState(ditch?.memo || '');

  // 4. GPS 좌표 (분당구 불정로 50 기본값)
  const defaultLat = currentGps ? currentGps.latitude : 37.357515;
  const defaultLng = currentGps ? currentGps.longitude : 127.112388;

  const [latitude, setLatitude] = useState<number>(ditch ? ditch.latitude : defaultLat);
  const [longitude, setLongitude] = useState<number>(ditch ? ditch.longitude : defaultLng);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 내 현재 위치로 좌표 갱신
  const handleUseCurrentGps = () => {
    if (currentGps) {
      setLatitude(currentGps.latitude);
      setLongitude(currentGps.longitude);
    } else {
      alert('현재 위치 정보를 가져오는 중이거나 권한이 허용되지 않았습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 관리코드 및 명칭 자동 생성
    const randomCode = ditch?.code || `DRAIN-${String(Math.floor(Math.random() * 900) + 100)}`;
    const autoName = `${section} 배수로`;

    const item: DitchMaster = {
      id: ditch?.id || `ditch-${Date.now()}`,
      code: randomCode,
      name: ditch?.name || autoName,
      section: section,
      dimension: ditch?.dimension || '표준 U형 배수로',
      latitude,
      longitude,
      currentStatus,
      lastInspectedAt: ditch?.lastInspectedAt || '',
      address: ditch?.address || '경기도 성남시 분당구 불정로 50',
      memo: memo.trim(),
      createdAt: ditch?.createdAt || new Date().toISOString(),
    };

    try {
      await onSave(item);
      onClose();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ditch || !onDelete) return;
    if (confirm(`'${ditch.name}' 배수로를 삭제하시겠습니까? 관련된 점검 이력도 함께 삭제됩니다.`)) {
      try {
        await onDelete(ditch.id);
        onClose();
      } catch (err) {
        console.error(err);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="font-black text-white text-base sm:text-lg">
              {isNew ? '현장 배수로 간편 등록' : '배수로 정보 수정'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 간소화된 원터치 폼 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* 1. 구역 원터치 선택 (주차장, 본관, 별관) */}
          <div>
            <label className="block text-xs font-black text-white mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                1
              </span>
              구역 선택 (원터치 터치)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SECTIONS.map((sec) => {
                const selected = section === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSection(sec)}
                    className={`min-h-[54px] rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-1 active:scale-95 ${
                      selected
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-950'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {selected && <Check className="w-4 h-4" />}
                    {sec}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 현재 상태 원터치 선택 */}
          <div>
            <label className="block text-xs font-black text-white mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                2
              </span>
              현재 상태
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'GOOD', label: '정상', color: 'emerald' },
                  { value: 'WARNING', label: '주의', color: 'amber' },
                  { value: 'DANGER', label: '긴급', color: 'rose' },
                ] as const
              ).map((st) => {
                const selected = currentStatus === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setCurrentStatus(st.value)}
                    className={`min-h-[50px] rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center justify-center active:scale-95 ${
                      selected
                        ? st.color === 'emerald'
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                          : st.color === 'amber'
                          ? 'bg-amber-600 border-amber-400 text-white shadow-lg'
                          : 'bg-rose-600 border-rose-400 text-white shadow-lg'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 특이사항 메모 */}
          <div>
            <label className="block text-xs font-black text-white mb-1.5 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                3
              </span>
              특이사항
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="특이사항이나 위치 메모 (선택사항)"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 4. GPS 위치 정보 */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">설정 좌표</span>
              <span className="text-slate-200 font-mono font-bold">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentGps}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 rounded-lg font-bold text-xs flex items-center gap-1 active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" /> 내 위치로 갱신
            </button>
          </div>

          {/* 5. 하단 버튼 */}
          <div className="pt-2 flex items-center justify-between gap-2">
            {!isNew && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="h-12 px-4 rounded-xl border border-rose-600/50 text-rose-400 hover:bg-rose-950 font-bold text-xs flex items-center gap-1 active:scale-95"
              >
                <Trash2 className="w-4 h-4" /> 삭제
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-12 px-5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800"
              >
                취소
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" /> {isNew ? '배수로 핀 등록' : '수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
