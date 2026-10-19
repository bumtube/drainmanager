import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  FileText,
  ShieldCheck,
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

// 네이티브 햅틱 진동 피드백 유틸리티
const triggerHaptic = (pattern: number | number[] = 15) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // 일부 브라우저 정책 시 무시
    }
  }
};

interface QuickInspectionFormProps {
  ditch: DitchMaster;
  inspectorName: string;
  capturedPhotoUrl?: string;
  previousPhotoUrl?: string;
  gpsAccuracy?: number;
  currentGps?: { latitude: number; longitude: number; accuracy?: number } | null;
  onSave: (record: InspectionRecord) => Promise<void>;
  onRetakePhoto?: () => void;
  onRemovePhoto?: () => void;
  onCancel: () => void;
}

export const QuickInspectionForm: React.FC<QuickInspectionFormProps> = ({
  ditch,
  inspectorName,
  capturedPhotoUrl = '',
  previousPhotoUrl,
  gpsAccuracy,
  currentGps,
  onSave,
  onRetakePhoto,
  onRemovePhoto,
  onCancel,
}) => {
  // 🎯 스마트 아코디언 상태 (기본값: false = 90% 이상없음 모드)
  const [isAbnormal, setIsAbnormal] = useState<boolean>(false);
  const [showMemoInput, setShowMemoInput] = useState<boolean>(false);

  // 폼 세부 상태
  const [sedimentStatus, setSedimentStatus] = useState<SedimentStatus>('정상');
  const [structureStatus, setStructureStatus] = useState<StructureStatus>('정상');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('조치완료');
  const [memo, setMemo] = useState<string>('');

  // 현장 사진 상태 및 파일 인풋 Ref (네이티브 카메라/앨범)
  const [photoUrl, setPhotoUrl] = useState<string>(capturedPhotoUrl || '');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (capturedPhotoUrl) {
      setPhotoUrl(capturedPhotoUrl);
    }
  }, [capturedPhotoUrl]);

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
        triggerHaptic(20);
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMemo((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
        triggerHaptic(15);
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

  // 현장 사진 파일 처리 및 표준 워터마크 자동 각인
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic(15);
    setIsProcessingPhoto(true);
    try {
      // 1. 이미지 로드
      const reader = new FileReader();
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = rawDataUrl;
      });

      // 2. 가로/세로 최적화 리사이징 (최대 960px, Firestore 1MB 제한 대비 80~120KB 압축)
      const MAX_DIM = 960;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // 3. 원본 이미지 리사이징 그리기
      ctx.drawImage(img, 0, 0, width, height);

      // 4. 워터마크 정보 구성 (일시, 점검자, GPS 좌표)
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const lat = currentGps?.latitude ? currentGps.latitude.toFixed(6) : ditch.latitude.toFixed(6);
      const lng = currentGps?.longitude ? currentGps.longitude.toFixed(6) : ditch.longitude.toFixed(6);
      const acc = currentGps?.accuracy ? ` (오차: ${currentGps.accuracy.toFixed(1)}m)` : '';

      const safeCode = ditch.code.replace(/(주차장|도로)/g, '정자 앞');
      const safeName = ditch.name.replace(/(주차장|도로)/g, '정자 앞');
      const line1 = `[배수로 현장점검] ${safeCode} | ${safeName}`;
      const line2 = `일시: ${formattedDate} | 점검자: ${inspectorName}`;
      const line3 = `위치: N ${lat}, E ${lng}${acc}`;

      // 5. 하단 워터마크 박스 (하단 배경 반투명 블랙 + 에메랄드 포인트 라인)
      const boxHeight = Math.max(75, Math.floor(height * 0.14));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
      ctx.fillRect(0, height - boxHeight, width, boxHeight);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, height - boxHeight, width, 4);

      // 6. 텍스트 각인
      const fontSize = Math.max(14, Math.floor(width * 0.024));
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px "Pretendard", -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';

      const paddingX = 16;
      const startY = height - boxHeight + 18;
      const lineHeight = (boxHeight - 28) / 2;

      ctx.fillText(line1, paddingX, startY);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${fontSize * 0.88}px "Pretendard", -apple-system, sans-serif`;
      ctx.fillText(line2, paddingX, startY + lineHeight);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(line3, paddingX, startY + lineHeight * 2);

      const watermarked = canvas.toDataURL('image/jpeg', 0.68);
      setPhotoUrl(watermarked);
      triggerHaptic([15, 30]);
    } catch (err) {
      console.error('Image processing error:', err);
      alert('사진을 처리하는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    triggerHaptic(10);
    setPhotoUrl('');
    if (onRemovePhoto) onRemovePhoto();
  };

  // 점검 저장 처리 (스마트 아코디언 반영)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    triggerHaptic(25);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;

    // 이상 없음 모드일 때와 이상 발견 모드일 때 데이터 자동 정제
    const finalSediment: SedimentStatus = !isAbnormal ? '정상' : sedimentStatus;
    const finalStructure: StructureStatus = !isAbnormal ? '정상' : structureStatus;
    const finalUrgency: UrgencyLevel = !isAbnormal ? '조치완료' : urgencyLevel;
    const finalMemo =
      memo.trim() ||
      (!isAbnormal
        ? '통수 원활 · 퇴적 없음 (이상 없음)'
        : `현장 조치 필요 (${finalSediment} · ${finalUrgency})`);

    const newRecord: InspectionRecord = {
      id: `insp-${Date.now()}`,
      ditchId: ditch.id,
      inspectedAt: formattedDate,
      inspectorName,
      sedimentStatus: finalSediment,
      structureStatus: finalStructure,
      urgencyLevel: finalUrgency,
      memo: finalMemo,
      photoCurrentUrl: photoUrl || previousPhotoUrl || '',
      photoPreviousUrl: previousPhotoUrl,
      gpsAccuracy: gpsAccuracy || 3.0,
      latitude: ditch.latitude,
      longitude: ditch.longitude,
    };

    try {
      await onSave(newRecord);
      triggerHaptic([30, 50, 30]);

      // 시각 피드백 (축하 폭죽)
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err) {
      console.error('Save failed:', err);
      alert('저장 중 문제가 발생했습니다.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-y-auto">
      {/* 숨겨진 네이티브 카메라/앨범 파일 인풋 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageFileSelect}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileSelect}
        className="hidden"
      />

      {/* 1. 상단 바 (Apple Frosted Glass) */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-slate-900/90 border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300">
                {ditch.code.replace(/(주차장|도로)/g, '정자 앞')}
              </span>
              <span className="text-[10px] font-medium text-emerald-400">
                현장 점검
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[220px] sm:max-w-md">
              {ditch.name.replace(/(주차장|도로)/g, '정자 앞')}
            </h2>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic(10);
            onCancel();
          }}
          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4 pb-28">
        {/* 2. 사진 썸네일 & 비포/애프터 비교 영역 */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" /> 촬영 사진 및 직전 비교
            </span>
            <div className="flex items-center gap-2">
              {photoUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      cameraInputRef.current?.click();
                    }}
                    className="text-xs text-slate-400 hover:text-emerald-400 underline font-medium"
                  >
                    재촬영
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      galleryInputRef.current?.click();
                    }}
                    className="text-xs text-slate-400 hover:text-blue-400 underline font-medium"
                  >
                    앨범변경
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-rose-400 hover:text-rose-300 underline font-medium"
                  >
                    삭제
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 직전 사진 */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-white/10 aspect-video flex items-center justify-center">
              {previousPhotoUrl ? (
                <>
                  <img
                    src={previousPhotoUrl}
                    alt="직전 점검 사진"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/75 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    직전 기록
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500 font-medium">직전 기록 없음</span>
              )}
            </div>

            {/* 금회 사진 */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border-2 border-emerald-500/80 aspect-video flex items-center justify-center shadow-inner">
              {isProcessingPhoto ? (
                <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                  <span className="text-[10px] font-bold text-emerald-300">워터마크 각인 중...</span>
                </div>
              ) : photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    alt="금회 점검 사진"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                    금회 촬영
                  </span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/75 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors active:scale-95 shadow"
                    title="촬영된 사진 삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full p-2 flex flex-col items-center justify-center gap-1.5 bg-slate-950">
                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        cameraInputRef.current?.click();
                      }}
                      className="flex-1 py-2 px-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow"
                    >
                      <Camera className="w-4 h-4 text-white" />
                      <span>카메라</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        galleryInputRef.current?.click();
                      }}
                      className="flex-1 py-2 px-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-white/10"
                    >
                      <ImageIcon className="w-4 h-4 text-slate-300" />
                      <span>앨범</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    현장 사진 등록
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 비포/애프터 비교 버튼 (직전 사진이 있을 때) */}
          {previousPhotoUrl && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setShowSliderModal(true);
              }}
              className="mt-2.5 w-full h-10 bg-white/5 hover:bg-white/10 text-emerald-300 border border-white/10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              비포 / 애프터 분할 비교 슬라이더 열기
            </button>
          )}
        </div>

        {/* 3. 🎯 Apple 세그먼트 컨트롤: [이상 없음] vs [이상 발견] */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-1.5 flex gap-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              setIsAbnormal(false);
              setSedimentStatus('정상');
              setStructureStatus('정상');
              setUrgencyLevel('조치완료');
            }}
            className={`flex-1 py-3 px-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
              !isAbnormal
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-950/50 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>🟢 이상 없음 (전부 정상)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setIsAbnormal(true);
              if (sedimentStatus === '정상') setSedimentStatus('준설필요');
              if (urgencyLevel === '조치완료') setUrgencyLevel('조치예정');
            }}
            className={`flex-1 py-3 px-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
              isAbnormal
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/50 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>⚠️ 이상 · 조치 필요</span>
          </button>
        </div>

        {/* 4-A. [접힘 상태] 🟢 이상 없음 (90% 일상 점검 뷰 - 스크롤 0회) */}
        {!isAbnormal && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-emerald-200">
                  통수 원활 · 시설 양호
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  퇴적물 없음 · 구조 정상 · 조치완료 상태로 즉시 기록됩니다.
                </p>
              </div>
            </div>

            {/* 원클릭 한 줄 메모 열기/닫기 토글 */}
            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setShowMemoInput(!showMemoInput);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 py-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showMemoInput ? '메모창 접기 ▲' : '+ 특이사항 메모 남기기 ▼'}</span>
              </button>
              {memo && !showMemoInput && (
                <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                  메모: {memo}
                </span>
              )}
            </div>

            {showMemoInput && (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-bold">간단 메모 (선택)</span>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                        isListening
                          ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                          : 'bg-white/5 text-emerald-400 border-white/10'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3 h-3" /> 듣는 중...
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3" /> 음성 입력
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                  placeholder="추가로 남기실 특이사항이 있다면 적어주세요 (선택사항)"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        )}

        {/* 4-B. [펼침 상태] ⚠️ 이상 발견 (아코디언 확장 뷰 - 10% 이상 점검) */}
        {isAbnormal && (
          <div className="space-y-3.5 transition-all">
            {/* 1. 퇴적 상태 선택 */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 space-y-2 shadow-lg">
              <label className="text-xs font-black text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    1
                  </span>
                  퇴적 상태 선택
                </span>
                <span className="text-[11px] font-bold text-amber-400">
                  선택: {sedimentStatus}
                </span>
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
                      onClick={() => {
                        triggerHaptic(10);
                        setSedimentStatus(item.value);
                      }}
                      className={`min-h-[54px] p-2 rounded-xl font-bold text-xs border-2 transition-all flex flex-col items-center justify-center active:scale-95 ${
                        selected
                          ? item.color === 'emerald'
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950'
                            : item.color === 'amber'
                            ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-950'
                            : 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-950'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="font-black">{item.label}</span>
                      <span className="text-[10px] opacity-80 mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. 조치 구분 선택 */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 space-y-2 shadow-lg">
              <label className="text-xs font-black text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    2
                  </span>
                  조치 구분
                </span>
                <span className="text-[11px] font-bold text-amber-400">
                  선택: {urgencyLevel}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setUrgencyLevel('조치예정');
                  }}
                  className={`min-h-[50px] py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    urgencyLevel === '조치예정'
                      ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-950'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-200" />
                  <span>조치예정 (정비요청)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setUrgencyLevel('조치완료');
                  }}
                  className={`min-h-[50px] py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    urgencyLevel === '조치완료'
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>현장 조치완료</span>
                </button>
              </div>
            </div>

            {/* 3. 특이사항 메모 (음성 입력) */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    3
                  </span>
                  특이사항 및 정비 메모
                </label>
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                      isListening
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                        : 'bg-white/5 text-emerald-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3 h-3" /> 듣는 중...
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" /> 음성으로 말하기
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                placeholder="준설이 필요한 구간이나 특이사항을 적어주세요 (마이크 음성 입력 지원)"
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. 하단 고정 점검 완료 버튼 (Apple Glass Bar) */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 p-3.5 z-30">
        <div className="max-w-lg mx-auto flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onCancel();
            }}
            className="h-12 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-sm rounded-2xl active:scale-95 transition-all"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className={`flex-1 h-12 font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ${
              !isAbnormal
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-950/50'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-950/50'
            }`}
          >
            {!isAbnormal ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
                <span>{isSaving ? '저장 중...' : '🟢 이상 없음 점검 완료'}</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5 text-slate-950" />
                <span>{isSaving ? '저장 중...' : '⚠️ 이상/조치사항 저장하기'}</span>
              </>
            )}
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
