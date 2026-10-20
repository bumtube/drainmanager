import React, { useState, useEffect } from 'react';
import { X, Sliders, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

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
  beforeDate = '조치 전 (Before)',
  afterDate = '조치 후 (After)',
  onClose,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50); // 0 ~ 100%

  // 키보드 좌우 방향키로 슬라이더 미세 조작 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setSliderPosition((prev) => Math.max(0, prev - 5));
      } else if (e.key === 'ArrowRight') {
        setSliderPosition((prev) => Math.min(100, prev + 5));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/15 rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl max-h-[95vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base truncate max-w-[280px] sm:max-w-md">
                {title} - 준설 조치 전/후 검증
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                화면을 좌우로 드래그하여 전/후 차이를 비교하세요
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 비교 뷰어 영역 (Pixel-Perfect Clip-Path 기반) */}
        <div className="relative flex-1 bg-black overflow-hidden select-none min-h-[340px] sm:min-h-[460px] flex items-center justify-center">
          {/* After (조치 후/금회 촬영) - 베이스 이미지 */}
          <img
            src={afterImgUrl}
            alt="After"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />

          {/* Before (조치 전/직전 촬영) - 클리핑 오버레이 이미지 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <img
              src={beforeImgUrl}
              alt="Before"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* 분할선 및 중앙 드래그 핸들 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] pointer-events-none z-20"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white text-slate-900 shadow-2xl flex items-center justify-center font-black text-xs border-2 border-emerald-500">
              <span className="text-emerald-700 tracking-tighter text-[11px]">◀▶</span>
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

          {/* 좌우 라벨 배지 */}
          <div className="absolute top-3 left-3 z-10 bg-slate-950/85 backdrop-blur-md text-amber-300 text-xs px-3 py-1.5 rounded-xl font-bold border border-amber-500/40 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>조치 전 (Before): {beforeDate}</span>
          </div>
          <div className="absolute top-3 right-3 z-10 bg-slate-950/85 backdrop-blur-md text-emerald-300 text-xs px-3 py-1.5 rounded-xl font-bold border border-emerald-500/40 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>조치 후 (After): {afterDate}</span>
          </div>
        </div>

        {/* 슬라이더 컨트롤러 바 & 퀵 프리셋 버튼 */}
        <div className="p-4 bg-slate-950 border-t border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-400 font-bold">◀ 조치 전 100%</span>
            <div className="flex items-center gap-1 font-mono font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-white/10">
              <span>비교 위치: {sliderPosition}%</span>
            </div>
            <span className="text-emerald-400 font-bold">조치 후 100% ▶</span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
            className="w-full accent-emerald-500 h-2.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          {/* 퀵 비율 프리셋 칩 */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSliderPosition(0)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold rounded-lg border border-white/5 active:scale-95"
            >
              조치 후만 (0%)
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(25)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold rounded-lg border border-white/5 active:scale-95"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(50)}
              className="px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-sm active:scale-95"
            >
              반반 분할 (50%)
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(75)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold rounded-lg border border-white/5 active:scale-95"
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(100)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold rounded-lg border border-white/5 active:scale-95"
            >
              조치 전만 (100%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
