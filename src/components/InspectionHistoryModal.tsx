import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  Eye,
  Image,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { DitchMaster, InspectionRecord } from '../types';

interface InspectionHistoryModalProps {
  ditch: DitchMaster;
  inspections: InspectionRecord[];
  onClose: () => void;
  onDeleteInspection?: (inspectionId: string) => Promise<void> | void;
  onDeletePhoto?: (inspectionId: string) => Promise<void> | void;
  onGoHome?: () => void;
}

export const InspectionHistoryModal: React.FC<InspectionHistoryModalProps> = ({
  ditch,
  inspections,
  onClose,
  onDeleteInspection,
  onDeletePhoto,
  onGoHome,
}) => {
  // 전체화면 사진 확대 상태 ({ url, id, roundNumber })
  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    id: string;
    roundNumber: number;
  } | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 즉각적인 화면 피드백을 위한 낙관적 로컬 상태
  const [localInspections, setLocalInspections] = useState<InspectionRecord[]>(inspections);

  useEffect(() => {
    setLocalInspections(inspections);
  }, [inspections]);

  // 1. 특정 회차의 [점검데이터(기록) 분리 삭제]
  const handleDeleteRecord = async (item: InspectionRecord, roundNumber: number) => {
    const confirmed = window.confirm(
      `⚠️ [#{roundNumber}차 점검데이터 영구 삭제]\n\n선택하신 #${roundNumber}차 점검데이터(체크리스트, 일시, 점검자, 메모, 사진 등) 1건을 완전히 삭제하시겠습니까?\n\n- 점검일시: ${item.inspectedAt}\n- 점검자: ${item.inspectorName}\n- 판정결과: ${item.urgencyLevel} (퇴적: ${item.sedimentStatus}, 구조: ${item.structureStatus})\n\n※ 이 회차의 기록만 삭제되며, 다른 회차의 점검 기록이나 배수로 시설물 정보는 안전하게 유지됩니다.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    // 즉각적인 로컬 낙관적 업데이트
    setLocalInspections((prev) => prev.filter((i) => i.id !== item.id));
    if (selectedPhoto && selectedPhoto.id === item.id) {
      setSelectedPhoto(null);
    }

    try {
      if (onDeleteInspection) {
        await onDeleteInspection(item.id);
      }
    } catch (err) {
      console.error('Failed to delete inspection record:', err);
      alert('점검 데이터 삭제 중 문제가 발생했습니다.');
      setLocalInspections(inspections); // 롤백
    } finally {
      setDeletingId(null);
    }
  };

  // 2. 특정 회차의 [사진만 분리 삭제] (점검데이터는 100% 보존)
  const handleDeletePhoto = async (item: InspectionRecord, roundNumber: number) => {
    const confirmed = window.confirm(
      `📷 [#{roundNumber}차 현장 사진만 분리 삭제]\n\n선택하신 #${roundNumber}차 점검의 [현장 사진]만 삭제하시겠습니까?\n\n※ 점검 일시(${item.inspectedAt}), 점검자(${item.inspectorName}), 상태 판정(${item.urgencyLevel}), 현장 메모 등 [점검데이터]는 그대로 안전하게 보존됩니다.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    // 즉각적인 로컬 낙관적 업데이트
    setLocalInspections((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, photoCurrentUrl: '' } : i))
    );
    if (selectedPhoto && selectedPhoto.id === item.id) {
      setSelectedPhoto(null);
    }

    try {
      if (onDeletePhoto) {
        await onDeletePhoto(item.id);
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
      alert('사진 삭제 중 문제가 발생했습니다.');
      setLocalInspections(inspections); // 롤백
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {onGoHome && (
                <>
                  <button
                    type="button"
                    onClick={onGoHome}
                    className="text-xs font-black text-emerald-400 hover:text-emerald-300 underline cursor-pointer active:scale-95 transition-all"
                    title="최초 접속페이지(지도)로 이동"
                  >
                    주택전시관
                  </button>
                  <span className="text-slate-600 text-xs font-bold">/</span>
                </>
              )}
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
                INSPECTION TIMELINE
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">
                총 {localInspections.length}회 점검됨
              </span>
            </div>
            <h3 className="font-black text-white text-base sm:text-lg truncate max-w-xs sm:max-w-md mt-0.5">
              {ditch.name.replace(/(주차장|도로)/g, '정자 앞')} 과거 점검 이력
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              회차별로 점검데이터나 현장 사진을 각각 분리하여 선택 삭제할 수 있습니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 이력 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {localInspections.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-2" />
              <p className="font-bold text-slate-300">등록된 점검 이력이 없습니다.</p>
              <p className="text-xs text-slate-500">
                지도에서 배수로를 선택한 뒤 [현장 점검]을 진행해보세요.
              </p>
            </div>
          ) : (
            localInspections.map((item, idx) => {
              const roundNumber = localInspections.length - idx;
              const hasPhoto = Boolean(item.photoCurrentUrl);

              return (
                <div
                  key={item.id}
                  className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3 hover:border-slate-600 transition-colors shadow-sm"
                >
                  {/* 상단 라인: 회차, 일시, 상태 뱃지, 사진 유무 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2.5 py-1 rounded bg-slate-700 text-emerald-300">
                        #{roundNumber}차 점검
                      </span>
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {item.inspectedAt}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* 상태 구분 뱃지 */}
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full ${
                          item.urgencyLevel === '긴급조치'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : item.urgencyLevel === '조치예정'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {item.urgencyLevel}
                      </span>

                      {/* 사진 보유 여부 뱃지 */}
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          hasPhoto
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        <Image className="w-3 h-3" />
                        {hasPhoto ? '사진 있음' : '사진 없음'}
                      </span>
                    </div>
                  </div>

                  {/* 1. 점검 데이터 (퇴적/구조 상태 판정) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block font-medium">퇴적 상태</span>
                      <span
                        className={`font-black ${
                          item.sedimentStatus === '정상(<30%)'
                            ? 'text-emerald-400'
                            : item.sedimentStatus === '준설필요(>30%)'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {item.sedimentStatus}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 text-[11px] block font-medium">구조 상태</span>
                      <span
                        className={`font-black ${
                          item.structureStatus === '정상'
                            ? 'text-emerald-400'
                            : item.structureStatus === '균열/이탈'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {item.structureStatus}
                      </span>
                    </div>
                  </div>

                  {/* 2. 점검자 및 메모 */}
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1 text-slate-400">
                      <User className="w-3.5 h-3.5" /> 점검자:{' '}
                      <span className="text-slate-200 font-bold">{item.inspectorName}</span>
                    </div>
                    {item.memo && (
                      <p className="bg-slate-900/60 p-2.5 rounded-lg text-slate-300 italic border border-slate-800 text-xs">
                        "{item.memo}"
                      </p>
                    )}
                  </div>

                  {/* 3. 현장 사진 썸네일 & 크게보기 */}
                  {hasPhoto ? (
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Image className="w-3.5 h-3.5 text-emerald-400" /> 현장 촬영 사진
                        </span>
                        {onDeletePhoto && (
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(item, roundNumber)}
                            disabled={deletingId === item.id}
                            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/40 flex items-center gap-1 transition-all active:scale-95"
                            title="이 점검의 사진만 삭제하고 기록은 유지"
                          >
                            <Trash2 className="w-3 h-3" /> 사진만 삭제
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPhoto({
                            url: item.photoCurrentUrl!,
                            id: item.id,
                            roundNumber,
                          })
                        }
                        className="group relative w-full h-36 rounded-xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center hover:border-emerald-500 transition-all shadow-inner"
                      >
                        <img
                          src={item.photoCurrentUrl}
                          alt={`#${roundNumber}차 현장 사진`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white font-bold text-xs transition-opacity">
                          <Eye className="w-4 h-4 text-emerald-400" /> 사진 터치 시 크게 보기
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="py-2 px-3 rounded-lg bg-slate-900/40 border border-dashed border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-slate-600" />
                      등록된 현장 사진이 없습니다. (점검데이터만 보존됨)
                    </div>
                  )}

                  {/* 4. ★회차별 분리 삭제 컨트롤 패널 (사진만 삭제 vs 점검데이터 삭제) */}
                  <div className="pt-3 border-t border-slate-700/60 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-900/60 -mx-4 -mb-4 p-3 rounded-b-xl">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>#{roundNumber}차 데이터 분리 삭제:</span>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                      {/* [A] 사진만 분리 삭제 */}
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(item, roundNumber)}
                        disabled={!hasPhoto || deletingId === item.id}
                        className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                          hasPhoto
                            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 hover:border-amber-300 shadow-sm'
                            : 'text-slate-600 bg-slate-900/50 border-slate-800 cursor-not-allowed opacity-50'
                        }`}
                        title={
                          hasPhoto
                            ? '현장 사진만 삭제 (점검 일시, 점검자, 판정결과 등 점검데이터는 보존)'
                            : '등록된 사진이 없습니다'
                        }
                      >
                        <Image className="w-3.5 h-3.5 shrink-0" />
                        {hasPhoto ? '사진만 삭제' : '사진 없음'}
                      </button>

                      {/* [B] 점검데이터(회차) 분리 삭제 */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(item, roundNumber)}
                        disabled={deletingId === item.id}
                        className="h-9 px-3 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 hover:border-rose-300 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                        title="해당 회차의 점검데이터 및 전체 기록을 영구 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        점검데이터 삭제
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 닫기 */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors active:scale-98"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 5. 사진 전체화면 확대 팝업 */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-3 sm:p-4 cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.url}
              alt={`#${selectedPhoto.roundNumber}차 확대 사진`}
              className="max-w-full max-h-[75vh] object-contain rounded-xl border border-slate-800 shadow-2xl"
            />

            <div className="w-full flex items-center justify-between mt-3 px-2">
              <span className="text-white text-xs font-bold">
                #{selectedPhoto.roundNumber}차 현장 점검 사진
              </span>

              <div className="flex items-center gap-2">
                {onDeletePhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = localInspections.find((i) => i.id === selectedPhoto.id);
                      if (target) {
                        handleDeletePhoto(target, selectedPhoto.roundNumber);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 이 사진 삭제
                  </button>
                )}
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> 닫기
                </button>
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-xs mt-3">바깥 영역을 터치하면 닫힙니다.</p>
        </div>
      )}
    </div>
  );
};
