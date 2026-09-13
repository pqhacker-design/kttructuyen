import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  UploadCloud,
  Clipboard,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  FileText,
  RefreshCw,
  X,
  Maximize2,
  Plus,
  Check,
  HelpCircle,
} from 'lucide-react';
import { TextbookImage, TextbookExtractionResult, SubjectCode } from '../types/aiExam';
import { aiExamService } from '../services/aiExamService';
import { hasUserApiKey } from '../services/apiKeyService';

interface TextbookScopeVisionUploaderProps {
  subject: string;
  subjectId: SubjectCode;
  grade: number;
  term: string;
  selectedTopics: string[];
  onTopicsUpdated: (newTopics: string[]) => void;
  onExtractionComplete: (result: TextbookExtractionResult, contextText: string) => void;
  onOpenApiKeyModal: () => void;
}

export const TextbookScopeVisionUploader: React.FC<TextbookScopeVisionUploaderProps> = ({
  subject,
  subjectId,
  grade,
  term,
  selectedTopics,
  onTopicsUpdated,
  onExtractionComplete,
  onOpenApiKeyModal,
}) => {
  const [images, setImages] = useState<TextbookImage[]>(() => {
    try {
      const saved = sessionStorage.getItem('eduexam_tb_images_draft');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<TextbookExtractionResult | null>(() => {
    try {
      const saved = sessionStorage.getItem('eduexam_tb_extracted_result');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(null);
  const [isAppliedToTopics, setIsAppliedToTopics] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Auto-persist images to sessionStorage to avoid losing uploads during tab switches or refresh
  useEffect(() => {
    try {
      if (images.length > 0) {
        sessionStorage.setItem('eduexam_tb_images_draft', JSON.stringify(images));
      } else {
        sessionStorage.removeItem('eduexam_tb_images_draft');
      }
    } catch (e) {
      console.warn('Could not cache images in sessionStorage:', e);
    }
  }, [images]);

  // Auto-persist extraction result to sessionStorage
  useEffect(() => {
    try {
      if (extractedResult) {
        sessionStorage.setItem('eduexam_tb_extracted_result', JSON.stringify(extractedResult));
      } else {
        sessionStorage.removeItem('eduexam_tb_extracted_result');
      }
    } catch (e) {
      console.warn('Could not cache extraction result in sessionStorage:', e);
    }
  }, [extractedResult]);

  // Helper to convert File to base64 TextbookImage
  const processFile = (file: File): Promise<TextbookImage> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Chỉ hỗ trợ file hình ảnh (.png, .jpg, .jpeg, .webp).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        let base64Data = dataUrl;
        if (dataUrl.includes(';base64,')) {
          base64Data = dataUrl.split(';base64,')[1];
        }
        resolve({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dataUrl,
          mimeType: file.type || 'image/jpeg',
          base64Data,
          fileName: file.name || `Anh-SGK-${Date.now()}.png`,
          fileSize: file.size,
        });
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh.'));
      reader.readAsDataURL(file);
    });
  };

  // Listen to Global / Component Paste Event (Ctrl + V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        try {
          const processed = await Promise.all(imageFiles.map(processFile));
          setImages((prev) => [...prev, ...processed]);
          setClipboardFeedback(`Đã dán thành công ${imageFiles.length} ảnh từ Clipboard!`);
          setTimeout(() => setClipboardFeedback(null), 4000);
        } catch (err: any) {
          setAnalysisError(err.message || 'Lỗi khi xử lý ảnh từ clipboard.');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = (Array.from(e.dataTransfer.files) as File[]).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    try {
      const processed = await Promise.all(files.map(processFile));
      setImages((prev) => [...prev, ...processed]);
    } catch (err: any) {
      setAnalysisError(err.message || 'Lỗi khi tải ảnh kéo thả.');
    }
  };

  // Handle File Input Change
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    try {
      const processed = await Promise.all(files.map(processFile));
      setImages((prev) => [...prev, ...processed]);
    } catch (err: any) {
      setAnalysisError(err.message || 'Lỗi khi chọn file ảnh.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleClearAllImages = () => {
    setImages([]);
    setExtractedResult(null);
    setAnalysisError(null);
    setIsAppliedToTopics(false);
    try {
      sessionStorage.removeItem('eduexam_tb_images_draft');
      sessionStorage.removeItem('eduexam_tb_extracted_result');
    } catch {}
  };

  // Analyze Images with Gemini Vision
  const handleAnalyzeImages = async () => {
    if (images.length === 0) {
      setAnalysisError('Vui lòng chụp ảnh màn hình hoặc tải ít nhất 1 trang SGK lên trước.');
      return;
    }

    if (!hasUserApiKey()) {
      onOpenApiKeyModal();
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await aiExamService.extractTextbookContent({
        images,
        subject,
        subjectId,
        grade,
        term,
      });

      setExtractedResult(result);

      // Build context text string to guide subsequent Matrix & Exam Generation
      const contextText = `
BÀI HỌC SGK ĐÃ NHẬN DIỆN: ${result.detected_lesson_title}
CÁC CHỦ ĐỀ / ĐƠN VỊ KIẾN THỨC: ${result.suggested_topics.join(', ')} - ${result.content_units.join('; ')}
YÊU CẦU CẦN ĐẠT (YCCĐ):
- Nhận biết: ${result.learning_outcomes?.recognition || 'Nắm vững khái niệm cơ bản'}
- Thông hiểu: ${result.learning_outcomes?.comprehension || 'Giải thích và phân tích dữ liệu'}
- Vận dụng: ${result.learning_outcomes?.application || 'Vận dụng giải quyết bài toán/tình huống thực tiễn'}
NỘI DUNG TRỌNG TÂM CẦN KIỂM TRA TRONG SGK:
${result.key_knowledge_summary}
GỢI Ý DẠNG BÀI BÁM SÁT SGK:
${result.suggested_question_focus}
      `.trim();

      onExtractionComplete(result, contextText);

      // Automatically offer to apply detected topics
      if (result.suggested_topics && result.suggested_topics.length > 0) {
        // Auto-merge with existing or prioritize
        const newSet = Array.from(new Set([...result.suggested_topics, ...selectedTopics]));
        onTopicsUpdated(newSet);
        setIsAppliedToTopics(true);
      }
    } catch (err: any) {
      console.error('Lỗi phân tích SGK:', err);
      setAnalysisError(err.message || 'Không thể phân tích ảnh SGK. Vui lòng kiểm tra lại ảnh hoặc API Key.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply or append suggested topics
  const handleApplyTopicsOnly = () => {
    if (!extractedResult || !extractedResult.suggested_topics) return;
    const newSet = Array.from(new Set([...extractedResult.suggested_topics, ...selectedTopics]));
    onTopicsUpdated(newSet);
    setIsAppliedToTopics(true);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white p-5 shadow-xs">
      {/* Header Info */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Camera className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              Đọc Ảnh Chụp Sách Giáo Khoa (SGK) Bằng AI Vision
            </h3>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
              <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
              Chuẩn GDPT 2018
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Thầy/Cô chỉ cần chụp màn hình trang SGK (nhấn{' '}
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
              Ctrl + V
            </kbd>{' '}
            để dán ảnh ngay) hoặc chọn file ảnh. AI sẽ tự động đọc chữ, định lý, công thức để đề thi bám sát tuyệt đối nội dung cần kiểm tra.
          </p>
        </div>

        {images.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllImages}
            className="flex items-center self-start text-xs font-medium text-slate-400 transition-colors hover:text-rose-600 sm:self-auto"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            <span>Xóa tất cả ({images.length})</span>
          </button>
        )}
      </div>

      {/* Clipboard Toast */}
      {clipboardFeedback && (
        <div className="flex items-center space-x-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{clipboardFeedback}</span>
        </div>
      )}

      {/* Drop / Paste Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/80 scale-[1.005]'
            : 'border-slate-300 bg-slate-50/60 hover:border-indigo-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-slate-200 group-hover:scale-110 group-hover:border-indigo-200 transition-all text-indigo-600">
          <UploadCloud className="h-6 w-6" />
        </div>

        <div className="mt-3">
          <span className="text-xs font-bold text-slate-800">
            Dán ảnh chụp màn hình SGK (nhấn{' '}
            <kbd className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] text-indigo-700">
              Ctrl + V
            </kbd>
            ) hoặc kéo thả vào đây
          </span>
          <p className="mt-1 text-[11px] text-slate-500">
            Hỗ trợ ảnh chụp từ Snipping Tool, phím PrintScreen, điện thoại (.png, .jpg, .webp). Có thể dán nhiều trang SGK cùng lúc.
          </p>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ImageIcon className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
            <span>Chọn file từ máy tính</span>
          </button>
        </div>
      </div>

      {/* Uploaded Images Gallery */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Danh sách hình ảnh SGK đã nạp ({images.length} ảnh):</span>
            <span className="text-[11px] font-normal text-slate-400">Nhấp vào ảnh để xem phóng to</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-indigo-300 hover:shadow-xs"
              >
                <div
                  onClick={() => setPreviewModalImage(img.dataUrl)}
                  className="relative aspect-4/3 w-full cursor-pointer overflow-hidden bg-slate-100"
                >
                  <img
                    src={img.dataUrl}
                    alt={img.fileName}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Maximize2 className="h-5 w-5 text-white" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 text-[11px]">
                  <div className="truncate pr-1">
                    <p className="font-semibold text-slate-800 truncate" title={img.fileName}>
                      Trang {idx + 1}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {Math.round(img.fileSize / 1024)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Xóa ảnh này"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Button to trigger AI Vision Analysis */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-indigo-100/70">
            <div className="text-xs text-slate-600">
              {extractedResult ? (
                <span className="flex items-center text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0" />
                  Đã hoàn tất phân tích SGK. Đề thi và Ma trận sẽ bám sát nội dung này.
                </span>
              ) : (
                <span className="text-slate-500">
                  Bấm nút bên cạnh để AI đọc toàn bộ nội dung trong {images.length} ảnh SGK.
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAnalyzeImages}
              disabled={isAnalyzing}
              className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
                isAnalyzing
                  ? 'bg-indigo-400 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                  <span>AI đang đọc & phân tích SGK...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-2 text-amber-300" />
                  <span>{extractedResult ? '⚡ Đọc lại nội dung SGK bằng AI' : '⚡ AI Đọc & Trích xuất Nội dung SGK'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {analysisError && (
        <div className="flex items-start space-x-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <span className="font-bold">Lỗi phân tích hình ảnh: </span>
            <span>{analysisError}</span>
          </div>
        </div>
      )}

      {/* Extracted Knowledge Preview Box */}
      {extractedResult && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
                  ✓
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Bài học nhận diện từ SGK:
                </span>
              </div>
              <h4 className="mt-0.5 text-sm font-black text-slate-900">
                {extractedResult.detected_lesson_title || 'Bài học trong Sách Giáo Khoa'}
              </h4>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleApplyTopicsOnly}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                  isAppliedToTopics
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                {isAppliedToTopics ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Đã áp dụng vào Chủ đề kiểm tra</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Áp dụng vào Chủ đề kiểm tra</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Column 1: Suggested Topics & Content Units */}
            <div className="space-y-2 bg-white p-3 rounded-lg border border-emerald-100">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chủ đề & Đơn vị kiến thức cốt lõi:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extractedResult.suggested_topics?.map((top, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200"
                  >
                    {top}
                  </span>
                ))}
              </div>

              {extractedResult.content_units && extractedResult.content_units.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500 block mb-1">
                    Chi tiết đơn vị kiến thức:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700">
                    {extractedResult.content_units.map((unit, idx) => (
                      <li key={idx} className="line-clamp-1">{unit}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Column 2: Learning Outcomes YCCĐ */}
            <div className="space-y-2 bg-white p-3 rounded-lg border border-emerald-100">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Yêu cầu cần đạt (YCCĐ) theo GDPT 2018:</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {extractedResult.learning_outcomes?.recognition && (
                  <div>
                    <span className="font-bold text-indigo-800">Nhận biết: </span>
                    <span className="text-slate-600">{extractedResult.learning_outcomes.recognition}</span>
                  </div>
                )}
                {extractedResult.learning_outcomes?.comprehension && (
                  <div>
                    <span className="font-bold text-sky-800">Thông hiểu: </span>
                    <span className="text-slate-600">{extractedResult.learning_outcomes.comprehension}</span>
                  </div>
                )}
                {extractedResult.learning_outcomes?.application && (
                  <div>
                    <span className="font-bold text-amber-800">Vận dụng: </span>
                    <span className="text-slate-600">{extractedResult.learning_outcomes.application}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Key knowledge summary */}
          {extractedResult.key_knowledge_summary && (
            <div className="bg-white p-3 rounded-lg border border-emerald-100 text-xs">
              <span className="font-bold text-slate-800 block mb-1">
                Tóm tắt nội dung trọng tâm ra đề kiểm tra:
              </span>
              <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                {extractedResult.key_knowledge_summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <span className="text-xs font-bold text-slate-700">Xem ảnh SGK chi tiết</span>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-2 bg-slate-900 flex items-center justify-center">
              <img
                src={previewModalImage}
                alt="Enlarged textbook page"
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
