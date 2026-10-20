import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  Layers,
  Check,
} from 'lucide-react';

interface MonthCalendarPickerModalProps {
  isOpen: boolean;
  selectedDate: string; // 'YYYY-MM-DD' or 'ALL'
  inspectionCountByDate: Map<string, number>;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

export const MonthCalendarPickerModal: React.FC<MonthCalendarPickerModalProps> = ({
  isOpen,
  selectedDate,
  inspectionCountByDate,
  onSelectDate,
  onClose,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 초기 연/월 설정 (selectedDate가 유효하면 해당 연/월, 아니면 오늘 기준)
  const initialYear = useMemo(() => {
    if (selectedDate && selectedDate !== 'ALL' && selectedDate.includes('-')) {
      const y = parseInt(selectedDate.split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }, [selectedDate]);

  const initialMonth = useMemo(() => {
    if (selectedDate && selectedDate !== 'ALL' && selectedDate.includes('-')) {
      const m = parseInt(selectedDate.split('-')[1], 10) - 1;
      if (!isNaN(m) && m >= 0 && m <= 11) return m;
    }
    return new Date().getMonth();
  }, [selectedDate]);

  const [currentYear, setCurrentYear] = useState<number>(initialYear);
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth);

  useEffect(() => {
    if (isOpen) {
      setCurrentYear(initialYear);
      setCurrentMonth(initialMonth);
    }
  }, [isOpen, initialYear, initialMonth]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 이전/다음 달 이동
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((prev) => prev - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((prev) => prev + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    onSelectDate(todayStr);
  };

  // 해당 월 1일의 요일 (0: 일요일 ~ 6: 토요일)
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  // 해당 월의 총 일수
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // 이전 달의 총 일수
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // 달력 격자 셀 데이터 생성
  const calendarDays = (() => {
    const days: Array<{
      year: number;
      month: number;
      day: number;
      isCurrentMonth: boolean;
      dateStr: string;
      count: number;
    }> = [];

    // 1. 이전 달 날짜 채우기
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = currentMonth === 0 ? 11 : currentMonth - 1;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        year: y,
        month: m,
        day: d,
        isCurrentMonth: false,
        dateStr,
        count: inspectionCountByDate.get(dateStr) || 0,
      });
    }

    // 2. 현재 달 날짜 채우기
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        year: currentYear,
        month: currentMonth,
        day: d,
        isCurrentMonth: true,
        dateStr,
        count: inspectionCountByDate.get(dateStr) || 0,
      });
    }

    // 3. 다음 달 날짜 채우기 (35 또는 42칸 채우기)
    const totalCells = days.length > 35 ? 42 : 35;
    const remainingDays = totalCells - days.length;
    for (let d = 1; d <= remainingDays; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        year: y,
        month: m,
        day: d,
        isCurrentMonth: false,
        dateStr,
        count: inspectionCountByDate.get(dateStr) || 0,
      });
    }

    return days;
  })();

  const weekHeaders = [
    { label: '일', color: 'text-rose-400' },
    { label: '월', color: 'text-slate-400' },
    { label: '화', color: 'text-slate-400' },
    { label: '수', color: 'text-slate-400' },
    { label: '목', color: 'text-slate-400' },
    { label: '금', color: 'text-slate-400' },
    { label: '토', color: 'text-blue-400' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/15 rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base">
                점검 일자 선택 달력
              </h3>
              <p className="text-[11px] text-slate-400">
                점검 기록이 있는 날짜를 클릭하여 조회하세요
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-all"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 월간 내비게이터 바 */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between bg-slate-950 rounded-2xl p-1.5 border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="이전 달"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-white text-base tracking-wide">
                {currentYear}년 {currentMonth + 1}월
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="다음 달"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 text-center font-bold text-xs py-1">
            {weekHeaders.map((w) => (
              <span key={w.label} className={w.color}>
                {w.label}
              </span>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              const isSelected = selectedDate === cell.dateStr;
              const isToday = todayStr === cell.dateStr;
              const hasInspection = cell.count > 0;
              const isSunday = idx % 7 === 0;
              const isSaturday = idx % 7 === 6;

              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  type="button"
                  onClick={() => onSelectDate(cell.dateStr)}
                  className={`relative h-12 rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 group ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-105 border-2 border-emerald-300 z-10'
                      : isToday
                      ? 'border border-emerald-400 bg-emerald-500/10 text-emerald-300 font-black hover:bg-emerald-500/20'
                      : cell.isCurrentMonth
                      ? hasInspection
                        ? 'bg-slate-800/80 hover:bg-slate-800 text-white font-bold border border-emerald-500/30 shadow-sm'
                        : 'hover:bg-slate-800/60 text-slate-300'
                      : 'opacity-30 hover:opacity-70 text-slate-600'
                  }`}
                  title={`${cell.dateStr}${hasInspection ? ` (점검 ${cell.count}건)` : ''}`}
                >
                  <span
                    className={`text-xs ${
                      isSelected
                        ? 'text-slate-950 font-black'
                        : isSunday
                        ? 'text-rose-400'
                        : isSaturday
                        ? 'text-blue-400'
                        : ''
                    }`}
                  >
                    {cell.day}
                  </span>

                  {/* 점검 이력 표시 칩 또는 뱃지 */}
                  <div className="h-3 flex items-center justify-center">
                    {hasInspection ? (
                      isSelected ? (
                        <span className="text-[9px] font-mono font-black text-slate-950 leading-none">
                          {cell.count}건
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-black text-emerald-400 leading-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{cell.count}건</span>
                        </span>
                      )
                    ) : (
                      <span className="w-1.5 h-1.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 퀵 액션 하단 바 */}
        <div className="p-4 bg-slate-950 border-t border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>점검 기록 있음</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm border border-emerald-400" />
                <span>오늘</span>
              </span>
            </div>
            {selectedDate !== 'ALL' && (
              <span className="font-mono text-emerald-400 font-bold">
                선택: {selectedDate}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleGoToday}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>오늘로 이동 ({todayStr.slice(5)})</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDate('ALL')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all active:scale-95 shadow-sm ${
                selectedDate === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                  : 'bg-slate-800 hover:bg-slate-750 text-blue-300 hover:text-white border-white/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>전체 기간 보기 (ALL)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
