import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Download, ExternalLink, X, Users, Clock, KeyRound } from 'lucide-react';
import { ExamSession } from '../types';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ExamSession | null;
  onStudentJoinDirect?: (code: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  session,
  onStudentJoinDirect,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generating, setGenerating] = useState(false);

  const examUrl = session
    ? `${window.location.origin}${window.location.pathname}?join=${session.access_code}`
    : '';

  useEffect(() => {
    if (!isOpen || !session) {
      setQrDataUrl('');
      return;
    }

    setGenerating(true);
    QRCode.toDataURL(examUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      })
      .finally(() => {
        setGenerating(false);
      });
  }, [isOpen, session, examUrl]);

  if (!isOpen || !session) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(examUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.access_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const targetClassesLabel =
    session.target_classes && session.target_classes.length > 0
      ? `Lớp: ${session.target_classes.join(', ')}`
      : 'Tất cả các lớp';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Mã QR & Link Thi Trực Tuyến</h3>
              <p className="text-xs text-indigo-200">Học sinh quét mã bằng camera để vào thi ngay</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain text-center">
          {/* Session Overview */}
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 text-base leading-snug">{session.title}</h4>
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {targetClassesLabel}
              </span>
              <span className="px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{session.duration_minutes} phút</span>
              </span>
            </div>
          </div>

          {/* QR Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-inner">
            {generating ? (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                Đang tạo mã QR...
              </div>
            ) : qrDataUrl ? (
              <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200">
                <img
                  src={qrDataUrl}
                  alt={`Mã QR phòng thi ${session.access_code}`}
                  className="w-52 h-52 object-contain mx-auto"
                />
              </div>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-rose-500 text-xs">
                Không thể tạo mã QR
              </div>
            )}

            {/* Access Code Highlight */}
            <div className="mt-3 flex items-center justify-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Mã phòng:</span>
              <span className="font-mono font-extrabold text-indigo-700 text-lg tracking-widest">
                {session.access_code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Sao chép mã phòng"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Direct Link Box */}
          <div className="text-left space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Link trực tiếp làm bài thi:
            </label>
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                readOnly
                value={examUrl}
                className="flex-1 px-3 py-2 text-xs font-mono text-slate-700 bg-slate-100 border border-slate-300 rounded-xl select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 shadow-xs transition-colors shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Thầy cô gửi link này vào Zalo/Teams/Facebook để học sinh nhấp vào làm bài ngay mà không cần nhập lại mã phòng.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download={`QR_Thi_${session.access_code}.png`}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải ảnh QR (PNG)</span>
            </a>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            {onStudentJoinDirect && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStudentJoinDirect(session.access_code);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <span>Vào thi ngay</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
