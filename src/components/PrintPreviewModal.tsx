import React, { useEffect, useRef } from 'react';
import { Printer, Download, X, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { downloadBlob } from '../services/docxExportService';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  title: string;
  isLandscape?: boolean;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  htmlContent,
  title,
  isLandscape = false,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const pageCss = isLandscape
    ? `@page { size: A4 landscape; margin: 12mm 10mm 12mm 10mm; }`
    : `@page { size: A4 portrait; margin: 16mm 14mm 16mm 14mm; }`;

  const fullStandaloneHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title || 'EduExam_Export'}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    ${pageCss}
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 16px;
    }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .header-table td { vertical-align: top; padding: 2px 4px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .exam-title { font-size: 15pt; font-weight: bold; text-align: center; margin: 10px 0 6px 0; }
    .student-info-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px 0; border: 1px solid #000; }
    .student-info-table td { padding: 6px 10px; border: 1px solid #000; font-size: 12pt; }
    .exam-code-box { width: 130px; text-align: center; background-color: #f8fafc; font-weight: bold; }
    .exam-code-num { font-size: 18pt; font-weight: bold; }
    .part-header { margin-top: 16px; margin-bottom: 4px; page-break-after: avoid; }
    .part-title { font-size: 13.5pt; font-weight: bold; text-transform: uppercase; }
    .part-instructions { font-size: 12pt; font-style: italic; margin-bottom: 8px; }
    .question-block { margin-bottom: 14px; page-break-inside: avoid; }
    .question-content { font-size: 13pt; margin-bottom: 6px; text-align: justify; }
    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-left: 12px; margin-bottom: 8px; }
    .option-item { font-size: 12.5pt; }
    .true-false-table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; page-break-inside: avoid; }
    .true-false-table th, .true-false-table td { border: 1px solid #333; padding: 6px 10px; font-size: 12.5pt; vertical-align: middle; }
    .true-false-table th { background-color: #f3f4f6; font-weight: bold; }
    .matrix-table { width: 100%; border-collapse: collapse; margin: 12px 0; page-break-inside: avoid; }
    .matrix-table th, .matrix-table td { border: 1px solid #000; padding: 6px 8px; font-size: 11.5pt; }
    .matrix-table th { background-color: #f2f2f2; font-weight: bold; }
    .page-break { page-break-before: always; break-before: page; margin-top: 24px; }
    .footer-end { text-align: center; font-weight: bold; margin: 28px 0 12px 0; font-size: 12pt; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  const handlePrint = () => {
    // 1. Primary method: Isolated printable iframe (100% immune to CSS leakage & never shows white screen)
    try {
      const existing = document.getElementById('eduexam-isolated-print-frame');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'eduexam-isolated-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(fullStandaloneHtml);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.warn('Iframe print failed, falling back to window.print():', err);
            window.print();
          } finally {
            setTimeout(() => {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            }, 6000);
          }
        }, 600);
        return;
      }
    } catch (e) {
      console.warn('Isolated print setup error:', e);
    }

    // 2. Fallback: window.print()
    let styleEl = document.getElementById('eduexam-print-stylesheet') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'eduexam-print-stylesheet';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      @media print {
        ${pageCss}
        body {
          background: #fff !important;
          color: #000 !important;
        }
        .no-print {
          display: none !important;
        }
        #eduexam-print-preview-paper {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
      }
    `;

    window.print();
  };

  const handleDownloadHtml = () => {
    const cleanFilename = `${title.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}.html`;
    const blob = new Blob([fullStandaloneHtml], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, cleanFilename);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div id="eduexam-print-preview-modal" className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs">
      {/* Top Action Bar */}
      <div className="no-print bg-slate-900 text-white px-6 py-3.5 border-b border-slate-700/80 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Printer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{title || 'Xem trước in ấn & Xuất PDF'}</h3>
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Chuẩn A4 {isLandscape ? 'Khổ ngang' : 'Khổ dọc'} (GDPT 2018)
              </span>
              <span className="hidden sm:inline">• Nhấn phím Ctrl + P để in nhanh</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={handleDownloadHtml}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            title="Tải file HTML hoàn chỉnh về máy tính để mở offline"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Đã tải xong' : 'Tải file HTML'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            title="Mở hộp thoại in của trình duyệt để Lưu thành file PDF hoặc In ra giấy"
          >
            <Printer className="w-4 h-4" />
            <span>Lưu file PDF / In ngay</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
            title="Đóng bản xem trước"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Workspace */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-800/60">
        <div
          id="eduexam-print-preview-paper"
          ref={contentRef}
          className={`bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-200 p-8 sm:p-12 ${
            isLandscape ? 'w-full max-w-[1120px] min-h-[792px]' : 'w-full max-w-[850px] min-h-[1100px]'
          }`}
          style={{
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '13pt',
            lineHeight: '1.4',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Bottom info bar */}
      <div className="no-print bg-slate-950/80 text-slate-400 px-6 py-2 border-t border-slate-800 text-xs flex items-center justify-between shrink-0">
        <span>Mẹo: Trong cửa sổ In của trình duyệt, tại mục <strong>Máy in đích (Destination)</strong> hãy chọn <strong>Lưu dưới dạng PDF (Save as PDF)</strong> để xuất file PDF.</span>
        <button
          onClick={onClose}
          className="text-slate-300 hover:text-white text-xs underline font-medium"
        >
          Quay lại ứng dụng
        </button>
      </div>
    </div>
  );
};
