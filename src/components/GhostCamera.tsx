import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Layers, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';
import { DitchMaster } from '../types';

interface GhostCameraProps {
  ditch: DitchMaster;
  previousPhotoUrl?: string;
  inspectorName: string;
  currentGps?: { latitude: number; longitude: number; accuracy?: number } | null;
  onPhotoCaptured: (photoBase64: string, gpsAccuracy?: number) => void;
  onCancel: () => void;
}

export const GhostCamera: React.FC<GhostCameraProps> = ({
  ditch,
  previousPhotoUrl,
  inspectorName,
  currentGps,
  onPhotoCaptured,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ghostOpacity, setGhostOpacity] = useState<number>(35); // 0 ~ 100%
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // 카메라 스트림 시작
  const startCamera = async (mode: 'environment' | 'user') => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 카메라 API를 지원하지 않습니다.');
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        '카메라를 실행할 수 없습니다. (권한 거부 또는 미지원). 대신 앨범에서 사진을 선택하거나 테스트 사진을 생성할 수 있습니다.'
      );
    }
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // 카메라 전환 (후면 <-> 전면)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // 워터마크 합성 유틸 함수 (클라우드 1MB 제한을 위한 고효율 리사이징)
  const applyWatermarkAndOutput = (
    source: HTMLVideoElement | HTMLImageElement,
    rawWidth: number,
    rawHeight: number
  ): string => {
    // 가로 최대 960px로 최적화 리사이징 (선명도는 유지하고 용량을 150KB로 압축)
    const MAX_WIDTH = 960;
    let width = rawWidth;
    let height = rawHeight;
    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width);
      width = MAX_WIDTH;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. 원본 이미지 리사이징 그리기
    ctx.drawImage(source, 0, 0, width, height);

    // 2. 워터마크 텍스트 준비
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;
    const lat = currentGps?.latitude ? currentGps.latitude.toFixed(6) : ditch.latitude.toFixed(6);
    const lng = currentGps?.longitude ? currentGps.longitude.toFixed(6) : ditch.longitude.toFixed(6);
    const acc = currentGps?.accuracy ? ` (오차: ${currentGps.accuracy.toFixed(1)}m)` : '';

    const line1 = `[배수로 현장점검] ${ditch.code} | ${ditch.name}`;
    const line2 = `일시: ${formattedDate} | 점검자: ${inspectorName}`;
    const line3 = `위치: N ${lat}, E ${lng}${acc}`;

    // 3. 고대비 워터마크 박스 (하단 배경 반투명 블랙)
    const boxHeight = Math.max(80, Math.floor(height * 0.14));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
    ctx.fillRect(0, height - boxHeight, width, boxHeight);

    // 상단 포인트 라인
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, height - boxHeight, width, 4);

    // 4. 텍스트 각인
    const fontSize = Math.max(15, Math.floor(width * 0.024));
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Pretendard", -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';

    const paddingX = 20;
    const startY = height - boxHeight + 20;
    const lineHeight = (boxHeight - 30) / 2;

    ctx.fillText(line1, paddingX, startY);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${fontSize * 0.88}px "Pretendard", -apple-system, sans-serif`;
    ctx.fillText(line2, paddingX, startY + lineHeight);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(line3, paddingX, startY + lineHeight * 2);

    // JPEG 0.72 압축: 화질은 선명하게 유지되며 파일 용량은 약 100~150KB로 최적화됨 (Firestore 1MB 한도 통과)
    return canvas.toDataURL('image/jpeg', 0.72);
  };

  // 셔터 캡처
  const handleCapture = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const watermarked = applyWatermarkAndOutput(video, width, height);
      setCapturedPreview(watermarked);
    } catch (err) {
      console.error('Capture error:', err);
      alert('사진 촬영 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  // 앨범 파일 선택 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const watermarked = applyWatermarkAndOutput(img, img.width, img.height);
        setCapturedPreview(watermarked);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 시뮬레이션 사진 생성 (테스트용)
  const handleCreateMockPhoto = () => {
    const dummySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
      </defs>
      <rect width="1280" height="960" fill="url(#sky)" />
      <polygon points="0,960 300,500 980,500 1280,960" fill="#475569" />
      <polygon points="350,960 480,500 800,500 930,960" fill="#1e293b" />
      <rect x="0" y="550" width="300" height="410" fill="#22c55e" opacity="0.4" />
      <rect x="980" y="550" width="300" height="410" fill="#22c55e" opacity="0.4" />
      <circle cx="640" cy="700" r="40" fill="#f59e0b" />
      <text x="640" y="780" text-anchor="middle" font-size="28" fill="#f8fafc" font-weight="bold">현장 배수로 유수부</text>
    </svg>`;
    const dummyImg = new Image();
    dummyImg.onload = () => {
      const watermarked = applyWatermarkAndOutput(dummyImg, 1280, 960);
      setCapturedPreview(watermarked);
    };
    dummyImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dummySvg)}`;
  };

  // 최종 채택 확인
  const handleConfirmPhoto = () => {
    if (!capturedPreview) return;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    onPhotoCaptured(capturedPreview, currentGps?.accuracy);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 1. 상단 제어 헤더 */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm text-white">
        <button
          onClick={() => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
            onCancel();
          }}
          className="p-2 text-slate-300 hover:text-white rounded-full bg-slate-800/80 active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
            GHOST CAMERA OVERLAY
          </div>
          <div className="text-sm font-black truncate max-w-[200px] sm:max-w-xs">{ditch.name}</div>
        </div>

        <button
          onClick={toggleFacingMode}
          className="p-2 text-slate-300 hover:text-white rounded-full bg-slate-800/80 active:scale-95"
          title="전/후면 카메라 전환"
        >
          <RefreshCw className="w-6 h-6" />
        </button>
      </div>

      {/* 2. 메인 뷰파인더 / 오버레이 화면 */}
      <div className="relative flex-1 bg-neutral-900 overflow-hidden flex items-center justify-center">
        {capturedPreview ? (
          // 촬영 결과 확인 뷰
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <img
              src={capturedPreview}
              alt="촬영된 점검 사진"
              className="max-w-full max-h-full object-contain"
            />
            <div className="absolute top-4 left-4 bg-emerald-600/90 text-white font-bold px-3 py-1.5 rounded-lg text-sm shadow">
              워터마크 자동 합성 완료
            </div>
          </div>
        ) : (
          // 실시간 카메라 + 고스트 오버레이
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* 고스트 오버레이 (직전 점검 사진) */}
            {previousPhotoUrl && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-150 flex items-center justify-center"
                style={{ opacity: ghostOpacity / 100 }}
              >
                <img
                  src={previousPhotoUrl}
                  alt="직전 점검 사진 고스트"
                  className="w-full h-full object-cover filter contrast-125 saturate-50"
                />
              </div>
            )}

            {/* 안내 뱃지 */}
            {previousPhotoUrl && (
              <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-md text-amber-300 text-xs px-3 py-1.5 rounded-full font-bold border border-amber-500/40 flex items-center gap-1.5 shadow-lg">
                <Layers className="w-3.5 h-3.5" />
                직전 사진 고스트 ({ghostOpacity}%)
              </div>
            )}

            {/* 카메라 오류 시 Fallback 안내 */}
            {cameraError && (
              <div className="absolute inset-4 bg-slate-900/95 border border-slate-700 rounded-2xl p-6 text-white flex flex-col items-center justify-center text-center z-10 space-y-4">
                <AlertCircle className="w-12 h-12 text-amber-400" />
                <h4 className="text-lg font-bold">카메라를 불러올 수 없습니다</h4>
                <p className="text-xs text-slate-300 max-w-sm">{cameraError}</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95"
                  >
                    <ImageIcon className="w-5 h-5" /> 갤러리/파일에서 선택
                  </button>
                  <button
                    onClick={handleCreateMockPhoto}
                    className="h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl active:scale-95 text-sm"
                  >
                    시뮬레이션 현장 사진 생성
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. 하단 컨트롤 패널 */}
      <div className="relative z-20 bg-slate-950/90 backdrop-blur-md text-white p-4 space-y-4 border-t border-slate-800">
        {capturedPreview ? (
          // 촬영 후: 다시 찍기 vs 사용하기
          <div className="flex gap-4 max-w-md mx-auto">
            <button
              onClick={() => setCapturedPreview(null)}
              className="flex-1 h-14 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold active:scale-95 transition-all"
            >
              다시 촬영
            </button>
            <button
              onClick={handleConfirmPhoto}
              className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-lg rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Check className="w-6 h-6" /> 이 사진 사용
            </button>
          </div>
        ) : (
          <>
            {/* 고스트 투명도 슬라이더 바 (직전 사진이 있을 때) */}
            {previousPhotoUrl && (
              <div className="max-w-md mx-auto flex items-center gap-3 bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                  고스트 투명도
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ghostOpacity}
                  onChange={(e) => setGhostOpacity(Number(e.target.value))}
                  className="w-full accent-amber-400 h-2 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-bold text-amber-400 w-10 text-right">
                  {ghostOpacity}%
                </span>
              </div>
            )}

            {/* 셔터 & 부가 버튼 (최소 64px 크기 셔터) */}
            <div className="flex items-center justify-around max-w-md mx-auto">
              {/* 파일 앨범 버튼 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-2 text-slate-400 hover:text-white active:scale-95"
              >
                <ImageIcon className="w-7 h-7" />
                <span className="text-[11px] mt-1 font-medium">앨범 선택</span>
              </button>

              {/* 메인 셔터 버튼 */}
              <button
                onClick={handleCapture}
                disabled={isCapturing || !!cameraError}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 active:scale-90 transition-all shadow-xl disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner">
                  <Camera className="w-8 h-8 text-slate-900" />
                </div>
              </button>

              {/* 테스트 샘플 버튼 */}
              <button
                onClick={handleCreateMockPhoto}
                className="flex flex-col items-center justify-center p-2 text-slate-400 hover:text-white active:scale-95"
              >
                <Layers className="w-7 h-7 text-emerald-400" />
                <span className="text-[11px] mt-1 font-medium text-emerald-400">샘플 캡처</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
