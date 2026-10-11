import React, { useState } from 'react';
import { X, Sliders } from 'lucide-react';

interface BeforeAfterSliderModalProps {
  beforeImgUrl: string;
  afterImgUrl: string;
  title: string;
  beforeDate?: string;
  afterDate?: string;
  onClose: () => void;
}

export const BeforeAfterSliderModal: React.FC<BeforeAfterSliderModalProps> = ({
  beforeImgUrl,
  afterImgUrl,
  title,
  beforeDate = '직전 점검 사진',
  afterDate = '금회 점검 사진',
  onClose,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50); // 0 ~ 100%

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl max-h-[95vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base sm:text-lg truncate max-w-[280px] sm:max-w-md">
              {title} - 비포/애프터 비교
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 비교 뷰어 영역 */}
        <div className="relative flex-1 bg-black overflow-hidden select-none min-h-[300px] sm:min-h-[420px] flex items-center justify-center">
          {/* After (금회 촬영) - 베이스 이미지 */}
          <img
            src={afterImgUrl}
            alt="After"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />

          {/* Before (직전 촬영) - 클리핑 오버레이 이미지 */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ width: `${sliderPosition}%` }}
          >
            <img
              src={beforeImgUrl}
              alt="Before"
              className="absolute inset-0 w-full h-full object-contain max-w-none"
              style={{
                width: '100%',
                // 부모의 실제 너비에 맞게 꽉 채움
              }}
            />
          </div>

          {/* 분할선 및 핸들 */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-xl cursor-ew-resize pointer-events-none z-20"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center font-black text-xs border-2 border-emerald-500">
              ⇄
            </div>
          </div>

          {/* 터치 및 마우스 드래그 조작 투명 오버레이 */}
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
          />

          {/* 라벨 배지 */}
          <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-sm text-yellow-300 text-xs px-2.5 py-1 rounded font-bold border border-yellow-500/40">
            ◀ 이전: {beforeDate}
          </div>
          <div className="absolute top-3 right-3 z-10 bg-black/70 backdrop-blur-sm text-emerald-300 text-xs px-2.5 py-1 rounded font-bold border border-emerald-500/40">
            현재: {afterDate} ▶
          </div>
        </div>

        {/* 슬라이더 컨트롤러 바 */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>직전 사진 (Before)</span>
            <span>중앙 ({sliderPosition}%)</span>
            <span>금회 사진 (After)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="w-full accent-emerald-500 h-3 bg-slate-800 rounded-lg cursor-pointer"
          />
          <p className="text-center text-xs text-slate-500 mt-1">
            화면을 좌우로 터치하여 드래그하거나 슬라이더를 밀어 전/후 차이를 비교하세요.
          </p>
        </div>
      </div>
    </div>
  );
};
