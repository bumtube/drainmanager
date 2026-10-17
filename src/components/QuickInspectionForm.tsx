import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Camera,
  Layers,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  DitchMaster,
  InspectionRecord,
  SedimentStatus,
  StructureStatus,
  UrgencyLevel,
} from '../types';
import { BeforeAfterSliderModal } from './BeforeAfterSliderModal';

interface QuickInspectionFormProps {
  ditch: DitchMaster;
  inspectorName: string;
  capturedPhotoUrl: string;
  previousPhotoUrl?: string;
  gpsAccuracy?: number;
  onSave: (record: InspectionRecord) => Promise<void>;
  onRetakePhoto: () => void;
  onRemovePhoto?: () => void;
  onCancel: () => void;
}

export const QuickInspectionForm: React.FC<QuickInspectionFormProps> = ({
  ditch,
  inspectorName,
  capturedPhotoUrl,
  previousPhotoUrl,
  gpsAccuracy,
  onSave,
  onRetakePhoto,
  onRemovePhoto,
  onCancel,
}) => {
  // 폼 상태
  const [sedimentStatus, setSedimentStatus] = useState<SedimentStatus>('정상');
  const [structureStatus, setStructureStatus] = useState<StructureStatus>('정상');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('조치완료');
  const [memo, setMemo] = useState<string>('');

  // 비포/애프터 비교 모달
  const [showSliderModal, setShowSliderModal] = useState<boolean>(false);

  // 음성 인식 (Web Speech API)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    // Web Speech API 지원 여부 확인
    const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setSpeechSupported(hasSpeech);
  }, []);

  // 음성 인식 토글
  const toggleSpeechRecognition = () => {
    if (!speechSupported) {
      alert('현재 브라우저에서는 음성 인식을 지원하지 않습니다. 키보드로 입력해주세요.');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMemo((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // 저장 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;

    const newRecord: InspectionRecord = {
      id: `insp-${Date.now()}`,
      ditchId: ditch.id,
      inspectedAt: formattedDate,
      inspectorName,
      sedimentStatus,
      structureStatus,
      urgencyLevel,
      memo: memo.trim(),
      photoCurrentUrl: capturedPhotoUrl || previousPhotoUrl || '',
      photoPreviousUrl: previousPhotoUrl,
      gpsAccuracy: gpsAccuracy || 3.0,
      latitude: ditch.latitude,
      longitude: ditch.longitude,
    };

    try {
      await onSave(newRecord);

      // 시각 피드백 (축하 폭죽)
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err) {
      console.error('Save failed:', err);
      alert('저장 중 문제가 발생했습니다.');
      setIsSaving(false);
    }
  };

  // ⚡ 5초 패스트패스: 전부 정상 원클릭 저장
  const handleFastPassAllGood = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;

    const fastRecord: InspectionRecord = {
      id: `insp-${Date.now()}`,
      ditchId: ditch.id,
      inspectedAt: formattedDate,
      inspectorName,
      sedimentStatus: '정상',
      structureStatus: '정상',
      urgencyLevel: '조치완료',
      memo: memo.trim() || '현장 점검 완료: 통수 원활 및 구조물 상태 양호 (패스트패스)',
      photoCurrentUrl: capturedPhotoUrl || previousPhotoUrl || '',
      photoPreviousUrl: previousPhotoUrl,
      gpsAccuracy: gpsAccuracy || 3.0,
      latitude: ditch.latitude,
      longitude: ditch.longitude,
    };

    try {
      await onSave(fastRecord);
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch (err) {
      console.error('Fast pass save failed:', err);
      alert('저장 중 문제가 발생했습니다.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-y-auto">
      {/* 1. 상단 바 */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> QUICK INSPECTION
          </span>
          <h2 className="text-lg font-black text-white truncate max-w-[240px] sm:max-w-md">
            {ditch.name.replace(/(주차장|도로)/g, '정자 앞')}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-5 pb-28">
        {/* ⚡ 5초컷 원클릭 전부정상 패스트패스 버튼 */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-950 border-2 border-emerald-400/80 rounded-2xl p-3.5 shadow-xl shadow-emerald-950/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
              현장 5초 패스트패스 (FAST-PASS)
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
              원터치 완료
            </span>
          </div>
          <button
            type="button"
            onClick={handleFastPassAllGood}
            disabled={isSaving}
            className="w-full h-12 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            <span>{isSaving ? '저장 중...' : '⚡ 이상 없음 · 전부 정상 즉시 저장'}</span>
          </button>
          <p className="text-[11px] text-emerald-300/80 text-center leading-tight">
            퇴적/구조 정상 · 통수 양호 상태로 단 한 번의 터치로 점검을 완료합니다.
          </p>
        </div>

        {/* 2. 사진 썸네일 & 비포/애프터 비교 영역 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" /> 촬영 사진 및 직전 비교
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRetakePhoto}
                className="text-xs text-slate-400 hover:text-emerald-400 underline font-medium"
              >
                다시 촬영
              </button>
              {capturedPhotoUrl && onRemovePhoto && (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="text-xs text-rose-400 hover:text-rose-300 underline font-medium"
                >
                  사진 삭제
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 직전 사진 */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
              {previousPhotoUrl ? (
                <>
                  <img
                    src={previousPhotoUrl}
                    alt="직전 점검 사진"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-yellow-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    직전 사진
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500 font-medium">직전 기록 없음</span>
              )}
            </div>

            {/* 금회 사진 */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border-2 border-emerald-500 aspect-video flex items-center justify-center">
              {capturedPhotoUrl ? (
                <>
                  <img
                    src={capturedPhotoUrl}
                    alt="금회 점검 사진"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    금회 촬영 (NEW)
                  </span>
                  {onRemovePhoto && (
                    <button
                      type="button"
                      onClick={onRemovePhoto}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/75 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors active:scale-95 shadow"
                      title="촬영된 사진 삭제"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={onRetakePhoto}
                  className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-all active:scale-95 p-2 text-center"
                >
                  <Camera className="w-6 h-6 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-300">현장 사진 촬영하기</span>
                  <span className="text-[10px] text-slate-500">(터치 시 카메라 실행)</span>
                </button>
              )}
            </div>
          </div>

          {/* 비포/애프터 비교 버튼 (직전 사진이 있을 때) */}
          {previousPhotoUrl && (
            <button
              type="button"
              onClick={() => setShowSliderModal(true)}
              className="mt-3 w-full h-11 bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              비포 / 애프터 분할 비교 슬라이더 열기
            </button>
          )}
        </div>

        {/* 1. 퇴적 상태 선택 */}
        <div>
          <label className="block text-sm font-black text-white mb-2 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
              1
            </span>
            퇴적 상태 선택
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: '정상', label: '정상', color: 'emerald', desc: '통수 원활' },
                { value: '준설필요', label: '준설필요', color: 'amber', desc: '통수 저해' },
                { value: '완전막힘', label: '완전막힘', color: 'rose', desc: '범람 위험' },
              ] as const
            ).map((item) => {
              const selected = sedimentStatus === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSedimentStatus(item.value)}
                  className={`min-h-[58px] p-2 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex flex-col items-center justify-center active:scale-95 ${
                    selected
                      ? item.color === 'emerald'
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950'
                        : item.color === 'amber'
                        ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-950'
                        : 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-950'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <span className="font-black text-sm">{item.label}</span>
                  <span className="text-[10px] font-normal opacity-80 mt-0.5">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 조치 구분 선택 */}
        <div>
          <label className="block text-sm font-black text-white mb-2 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
              2
            </span>
            조치 구분 선택
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setUrgencyLevel('조치완료')}
              className={`min-h-[58px] py-3 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 ${
                urgencyLevel === '조치완료'
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              조치완료
            </button>
            <button
              type="button"
              onClick={() => setUrgencyLevel('조치예정')}
              className={`min-h-[58px] py-3 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 ${
                urgencyLevel === '조치예정'
                  ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-950'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <AlertTriangle className="w-5 h-5 text-amber-200" />
              조치예정
            </button>
          </div>
        </div>

        {/* 3. 특이사항 메모 (음성인식 지원) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-black text-white flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                3
              </span>
              특이사항 메모 (음성 입력 지원)
            </label>
            {speechSupported && (
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                    : 'bg-slate-800 text-emerald-400 border-emerald-500/50 hover:bg-slate-750'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" /> 듣고 있습니다...
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" /> 음성으로 말하기
                  </>
                )}
              </button>
            )}
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="특이사항이나 준설 필요 구간을 입력하거나 상단 마이크 버튼을 눌러 음성으로 말씀하세요."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-base placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 7. 하단 고정 점검 완료 버튼 (높이 60px 대형 버튼) */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-4 z-30">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-14 px-5 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save className="w-6 h-6" />
            {isSaving ? '저장 중...' : '점검 완료 및 저장'}
          </button>
        </div>
      </div>

      {/* 분할 비교 슬라이더 모달 */}
      {showSliderModal && previousPhotoUrl && (
        <BeforeAfterSliderModal
          beforeImgUrl={previousPhotoUrl}
          afterImgUrl={capturedPhotoUrl}
          title={ditch.name}
          beforeDate="직전 점검 사진"
          afterDate="금회 점검 사진"
          onClose={() => setShowSliderModal(false)}
        />
      )}
    </div>
  );
};
