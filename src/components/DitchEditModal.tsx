import React, { useState, useEffect } from 'react';
import { X, MapPin, Save, Trash2, Navigation } from 'lucide-react';
import { DitchMaster, DrainStatus } from '../types';

interface DitchEditModalProps {
  ditch: DitchMaster | null; // null이면 신규 등록
  currentGps?: { latitude: number; longitude: number; accuracy?: number } | null;
  onSave: (ditch: DitchMaster) => Promise<void>;
  onDelete?: (ditchId: string) => Promise<void>;
  onClose: () => void;
}

export const DitchEditModal: React.FC<DitchEditModalProps> = ({
  ditch,
  currentGps,
  onSave,
  onDelete,
  onClose,
}) => {
  const isNew = !ditch;

  const [code, setCode] = useState(ditch?.code || '');
  const [name, setName] = useState(ditch?.name || '');
  const [section, setSection] = useState(ditch?.section || '1공구 농경지구간');
  const [dimension, setDimension] = useState(ditch?.dimension || 'U형 0.8m');
  const [latitude, setLatitude] = useState<number>(
    ditch ? ditch.latitude : currentGps ? currentGps.latitude : 37.7652
  );
  const [longitude, setLongitude] = useState<number>(
    ditch ? ditch.longitude : currentGps ? currentGps.longitude : 126.7725
  );
  const [currentStatus, setCurrentStatus] = useState<DrainStatus>(ditch?.currentStatus || 'GOOD');
  const [address, setAddress] = useState(ditch?.address || '');
  const [memo, setMemo] = useState(ditch?.memo || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isNew && !code) {
      const randomNum = String(Math.floor(Math.random() * 900) + 100);
      setCode(`DRAIN-${randomNum}`);
    }
  }, [isNew, code]);

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
    if (!name.trim()) {
      alert('배수로 명칭을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    const item: DitchMaster = {
      id: ditch?.id || `ditch-${Date.now()}`,
      code: code.trim() || 'DRAIN-NEW',
      name: name.trim(),
      section: section.trim(),
      dimension: dimension.trim(),
      latitude,
      longitude,
      currentStatus,
      lastInspectedAt: ditch?.lastInspectedAt || '',
      address: address.trim(),
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
    if (confirm(`'${ditch.name}' 배수로를 정말 삭제하시겠습니까? 관련된 점검 이력도 함께 삭제됩니다.`)) {
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="font-black text-white text-lg">
              {isNew ? '신규 현장 배수로 핀 등록' : '배수로 제원 및 위치 수정'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">관리 코드</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DRAIN-001"
                className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">담당 구역 / 공구</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="1공구 농경지구간"
                className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">배수로 명칭</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 갈현리 204번지 농로 배수로"
              className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">단면 규격 (종류/크기)</label>
            <input
              type="text"
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
              placeholder="예: U형 0.8m, 벤치플륨관 1.0m"
              className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
            />
          </div>

          {/* GPS 좌표 입력 및 현재 위치 버튼 */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-blue-400" /> GPS 좌표 설정
              </span>
              <button
                type="button"
                onClick={handleUseCurrentGps}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
              >
                내 현재 위치로 좌표 변경
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">위도 (Latitude)</span>
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono"
                  required
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">경도 (Longitude)</span>
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono"
                  required
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 지도 화면에서 핀을 손가락으로 드래그하여 실제 배수로 테두리에 미세조정할 수도 있습니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">상세 위치 / 지번 주소</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 경기도 파주시 탄현면 갈현리 204"
              className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">현재 상태 등급</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'GOOD', label: '정상 (초록)', color: 'emerald' },
                  { value: 'WARNING', label: '주의 (주황)', color: 'amber' },
                  { value: 'DANGER', label: '긴급 (빨강)', color: 'rose' },
                ] as const
              ).map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setCurrentStatus(st.value)}
                  className={`h-11 rounded-xl text-xs font-bold border transition-all ${
                    currentStatus === st.value
                      ? st.color === 'emerald'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : st.color === 'amber'
                        ? 'bg-amber-600 border-amber-400 text-white'
                        : 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">시설 특이사항 메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="배수로 유입 형태, 인근 사면 상태 등 참고사항"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm"
            />
          </div>

          {/* 하단 버튼 */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="h-12 px-4 rounded-xl border border-rose-600/50 text-rose-400 hover:bg-rose-950 font-bold text-sm flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-4 h-4" /> 삭제
              </button>
            )}

            <div className="flex-1 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-12 px-5 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-lg active:scale-95"
              >
                <Save className="w-4 h-4" /> {isNew ? '신규 핀 등록' : '수정 완료'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
