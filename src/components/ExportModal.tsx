import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  X,
  FileSpreadsheet,
  CheckCircle2,
  FileCheck2,
  Printer,
  Sparkles,
  Layers,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { GeneratedAIQuestion, ExamStructureConfig, MatrixCellSpecification } from '../types/aiExam';
import { Exam, Matrix, Question } from '../types';
import {
  exportExamToWord,
  exportAnswersToWord,
  exportMatrixToWord,
  exportFullExamDossierToWord
} from '../services/docxExportService';
import {
  exportExamToPdf,
  exportAnswersToPdf,
  exportMatrixToPdf,
  exportFullExamDossierToPdf
} from '../services/pdfExportService';
import { mockStore } from '../services/mockStore';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocType?: 'exam' | 'answers' | 'matrix' | 'full';
  examData?: {
    title?: string;
    subject?: string;
    grade?: number;
    durationMinutes?: number;
    questions?: any[];
    structure?: ExamStructureConfig;
    matrixCells?: MatrixCellSpecification[];
    matrix?: Matrix;
    cvData?: any;
  };
  data?: any;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  initialDocType,
  examData,
  data
}) => {
  const resolvedData = examData || data || {};
  const questionsList = resolvedData.questions || [];

  const [docType, setDocType] = useState<'exam' | 'answers' | 'matrix' | 'full'>(() => {
    if (initialDocType) return initialDocType;
    if (!questionsList || questionsList.length === 0) return 'matrix';
    return 'exam';
  });
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const currentTitle = resolvedData.title || 'Đề kiểm tra';
  const currentSubject = resolvedData.subject || 'Toán học';
  const currentGrade = resolvedData.grade || 10;
  const currentDuration = resolvedData.durationMinutes || 45;
  const currentStructure = resolvedData.structure;
  const currentCvData = resolvedData.cvData;

  const [resolvedMatrix, setResolvedMatrix] = useState<any>(resolvedData.matrix || null);

  useEffect(() => {
    if (resolvedData.matrix) {
      setResolvedMatrix(resolvedData.matrix);
      return;
    }
    try {
      const allMatrices = mockStore.getMatrices();
      if (allMatrices && allMatrices.length > 0) {
        let m = allMatrices.find(
          (item) =>
            (resolvedData.matrix_id && item.id === resolvedData.matrix_id) ||
            (resolvedData.id && item.exam_id === resolvedData.id)
        );
        if (!m && currentTitle) {
          const cleanTitle = currentTitle.replace(/^Đề thi (định kỳ )?/i, '').trim().toLowerCase();
          m = allMatrices.find((item) => {
            const cleanMName = item.name.replace(/^Ma trận & Bảng đặc tả - /i, '').trim().toLowerCase();
            return cleanTitle.includes(cleanMName) || cleanMName.includes(cleanTitle);
          });
        }
        if (m) {
          setResolvedMatrix(m);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [resolvedData, currentTitle]);

  const effectiveMatrix = resolvedData.matrix || resolvedMatrix;
  const effectiveMatrixCells =
    resolvedData.matrixCells ||
    (effectiveMatrix as any)?.items ||
    (effectiveMatrix as any)?.matrix_cells;

  const handleExport = async () => {
    if ((docType === 'exam' || docType === 'answers') && (!questionsList || questionsList.length === 0)) {
      alert('Ma trận này hiện chưa có danh sách câu hỏi đính kèm để xuất đề thi hoặc đáp án riêng biệt. Bạn hãy chọn mục "Ma trận & Bản đặc tả" để xuất bảng ma trận.');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      if (format === 'docx') {
        if (docType === 'exam') {
          await exportExamToWord({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            durationMinutes: currentDuration,
            questions: questionsList,
            structure: currentStructure,
          });
        } else if (docType === 'answers') {
          await exportAnswersToWord({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            questions: questionsList,
          });
        } else if (docType === 'matrix') {
          await exportMatrixToWord({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            matrixCells: effectiveMatrixCells,
            matrix: effectiveMatrix,
            questions: questionsList,
            structure: currentStructure,
            durationMinutes: currentDuration,
            cvData: currentCvData,
          });
        } else if (docType === 'full') {
          await exportFullExamDossierToWord({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            durationMinutes: currentDuration,
            questions: questionsList,
            structure: currentStructure,
            matrixCells: effectiveMatrixCells,
            matrix: effectiveMatrix,
            cvData: currentCvData,
          });
        }
      } else {
        // PDF format
        if (docType === 'exam') {
          exportExamToPdf({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            durationMinutes: currentDuration,
            questions: questionsList,
            structure: currentStructure,
          });
        } else if (docType === 'answers') {
          exportAnswersToPdf({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            questions: questionsList,
          });
        } else if (docType === 'matrix') {
          exportMatrixToPdf({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            matrixCells: effectiveMatrixCells,
            matrix: effectiveMatrix,
            questions: questionsList,
            structure: currentStructure,
            durationMinutes: currentDuration,
            cvData: currentCvData,
          });
        } else if (docType === 'full') {
          exportFullExamDossierToPdf({
            title: currentTitle,
            subject: currentSubject,
            grade: currentGrade,
            durationMinutes: currentDuration,
            questions: questionsList,
            structure: currentStructure,
            matrixCells: effectiveMatrixCells,
            matrix: effectiveMatrix,
            cvData: currentCvData,
          });
        }

        setTimeout(() => {
          onClose();
        }, 300);
      }

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Lỗi khi xuất file:', err);
      alert('Có lỗi xảy ra trong quá trình xuất tài liệu. Vui lòng thử lại!');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Xuất Đề thi & Hồ sơ Chuyên môn</h3>
              <p className="text-xs text-slate-400">Tương thích 100% Word Equation & Chuẩn PDF GDPT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Questions Context Status */}
          {questionsList && questionsList.length > 0 ? (
            <div className="flex items-center justify-between text-xs text-slate-600 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
              <span className="flex items-center space-x-1.5 font-medium text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Hồ sơ đầy đủ: <strong>{questionsList.length} câu hỏi</strong> & Ma trận đặc tả 19 cột</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">{currentSubject} - Khối {currentGrade}</span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Lưu ý về danh sách câu hỏi</div>
                <div className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Bản ghi ma trận này chưa liên kết câu hỏi. Để xuất ma trận và bảng đặc tả, hãy chọn <strong>Ma trận & Bản đặc tả</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Document Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Chọn Loại tài liệu cần xuất
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Exam */}
              <button
                type="button"
                onClick={() => setDocType('exam')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                  docType === 'exam'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg ${docType === 'exam' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Đề thi Chuẩn</div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Đề phát cho học sinh, khung mã đề, 4 phần theo mẫu Bộ GD&ĐT
                  </div>
                </div>
              </button>

              {/* Option 2: Answers & Rubrics */}
              <button
                type="button"
                onClick={() => setDocType('answers')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                  docType === 'answers'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg ${docType === 'answers' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Đáp án & Hướng dẫn chấm</div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Bảng đáp án tổng hợp, lời giải chi tiết và biểu điểm bài thi
                  </div>
                </div>
              </button>

              {/* Option 3: Matrix & Specification */}
              <button
                type="button"
                onClick={() => setDocType('matrix')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                  docType === 'matrix'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg ${docType === 'matrix' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Ma trận & Bản đặc tả</div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Chuẩn Công văn 7991/BGDĐT, ma trận 2 chiều và chỉ tiêu GDPT
                  </div>
                </div>
              </button>

              {/* Option 4: Full Dossier */}
              <button
                type="button"
                onClick={() => setDocType('full')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                  docType === 'full'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg ${docType === 'full' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs flex items-center space-x-1">
                    <span>Trọn bộ Hồ sơ Đề</span>
                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">Khuyên dùng</span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Gộp cả 3 mục: Đề thi, Đáp án và Ma trận đặc tả vào 1 file
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Chọn Định dạng tệp xuất
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('docx')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center space-x-3 ${
                  format === 'docx'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  W
                </div>
                <div>
                  <div className="text-xs font-bold">Microsoft Word (.docx)</div>
                  <div className="text-[10.5px] text-slate-500">
                    Chứa công thức Word Equation gốc
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center space-x-3 ${
                  format === 'pdf'
                    ? 'border-rose-600 bg-rose-50/60 ring-2 ring-rose-500/20 text-rose-950'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  PDF
                </div>
                <div>
                  <div className="text-xs font-bold">Tệp PDF / In ấn</div>
                  <div className="text-[10.5px] text-slate-500">
                    Bản in sắc nét, chuẩn khổ A4
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Math Equation Guarantee Box */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-bold text-emerald-800">Tương thích 100% công thức toán học Word Equation (OMML):</span>
              <p className="text-[11.5px] text-emerald-700">
                Toàn bộ căn thức, phân số, tích phân, ma trận và vector được mã hóa bằng chuẩn OMML mở trong Microsoft Word và hiển thị bằng font Cambria Math chuyên nghiệp, dễ dàng chỉnh sửa.
              </p>
            </div>
          </div>

          {exportSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-800 flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã xuất tệp thành công! Kiểm tra thư mục Tải xuống của bạn.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý xuất...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Tải xuống {format === 'docx' ? 'file Word' : 'file PDF'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
