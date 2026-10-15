import React, { useState } from 'react';
import { X, Calendar, User, Eye, ShieldAlert, CheckCircle2, ChevronRight, Image, Trash2 } from 'lucide-react';
import { DitchMaster, InspectionRecord } from '../types';

interface InspectionHistoryModalProps {
  ditch: DitchMaster;
  inspections: InspectionRecord[];
  onClose: () => void;
  onDeleteInspection?: (inspectionId: string) => Promise<void> | void;
}

export const InspectionHistoryModal: React.FC<InspectionHistoryModalProps> = ({
  ditch,
  inspections,
  onClose,
  onDeleteInspection,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (inspectionId: string) => {
    if (!window.confirm('이 점검 기록과 사진을 정말 삭제하시겠습니까?\n(클라우드와 기기에서 모두 영구 삭제됩니다.)')) {
      return;
    }
    setDeletingId(inspectionId);
    try {
      if (onDeleteInspection) {
        await onDeleteInspection(inspectionId);
      }
    } catch (err) {
      console.error('Failed to delete inspection:', err);
      alert('점검 기록 삭제 중 문제가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              INSPECTION HISTORY
            </span>
            <h3 className="font-black text-white text-base sm:text-lg truncate max-w-xs sm:max-w-md">
              {ditch.name.replace(/주차장/g, '도로')} 이력
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {inspections.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-2" />
              <p className="font-bold">등록된 점검 이력이 없습니다.</p>
              <p className="text-xs text-slate-500 mt-1">현장에서 첫 점검을 수행해보세요.</p>
            </div>
          ) : (
            inspections.map((item, idx) => (
              <div
                key={item.id}
                className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3 hover:border-slate-600 transition-colors shadow-sm"
              >
                {/* 상단 라인: 일시, 점검자, 조치구분, 삭제버튼 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                      #{inspections.length - idx}차
                    </span>
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.inspectedAt}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        item.urgencyLevel === '긴급조치'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : item.urgencyLevel === '조치예정'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {item.urgencyLevel}
                    </span>
                    {onDeleteInspection && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors active:scale-95"
                        title="이 점검 기록 및 사진 영구 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 상태 뱃지 요약 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px] block">퇴적 상태</span>
                    <span
                      className={`font-bold ${
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
                  <div className="bg-slate-900/80 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px] block">구조 상태</span>
                    <span
                      className={`font-bold ${
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

                {/* 점검자 및 메모 */}
                <div className="text-xs text-slate-300">
                  <div className="flex items-center gap-1 text-slate-400 mb-1">
                    <User className="w-3.5 h-3.5" /> 점검자: <span className="text-slate-200 font-semibold">{item.inspectorName}</span>
                  </div>
                  {item.memo && (
                    <p className="bg-slate-900/50 p-2 rounded-lg text-slate-300 italic border border-slate-800">
                      "{item.memo}"
                    </p>
                  )}
                </div>

                {/* 현장 사진 썸네일 & 크게보기 */}
                {item.photoCurrentUrl && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(item.photoCurrentUrl)}
                      className="group relative w-full h-32 rounded-lg overflow-hidden border border-slate-700 bg-black flex items-center justify-center hover:border-emerald-500 transition-all"
                    >
                      <img
                        src={item.photoCurrentUrl}
                        alt="현장 사진"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white font-bold text-xs transition-opacity">
                        <Eye className="w-4 h-4 text-emerald-400" /> 사진 크게 보기
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 하단 닫기 */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 사진 전체화면 확대 팝업 */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full flex items-center justify-center">
            <img
              src={selectedPhoto}
              alt="확대 사진"
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 p-2 bg-black/70 text-white rounded-full hover:bg-black"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-slate-400 text-xs mt-3">화면을 터치하면 닫힙니다.</p>
        </div>
      )}
    </div>
  );
};
