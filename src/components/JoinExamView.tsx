import React, { useState, useEffect, useCallback } from 'react';
import { 
  KeyRound, 
  User, 
  Hash, 
  ArrowRight, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  AlertOctagon, 
  Clock, 
  GraduationCap, 
  QrCode, 
  Search,
  Check,
  Copy,
  Info
} from 'lucide-react';
import QRCode from 'qrcode';
import { Profile, ExamSession, Student } from '../types';
import { joinExamWithAccessCode, JoinExamResponse } from '../services/takingService';
import { fetchSessionByCode } from '../services/sessionService';
import { lookupStudentByCode } from '../services/classService';

interface JoinExamViewProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  currentProfile: Profile | null;
  onExamReady: (data: JoinExamResponse) => void;
  onSwitchToLogin?: () => void;
}

export const JoinExamView: React.FC<JoinExamViewProps> = ({
  isOpen,
  onClose,
  initialCode = '',
  currentProfile,
  onExamReady,
  onSwitchToLogin,
}) => {
  const [accessCode, setAccessCode] = useState(initialCode);
  const [studentCode, setStudentCode] = useState(
    currentProfile?.student_code || (currentProfile?.role === 'student' ? 'HS-1001' : '')
  );
  const [studentName, setStudentName] = useState(currentProfile?.full_name || '');
  
  // Session lookup state
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionNotFound, setSessionNotFound] = useState(false);

  // Student verification state
  const [identifiedStudent, setIdentifiedStudent] = useState<Student | null>(null);
  const [checkingStudent, setCheckingStudent] = useState(false);
  const [studentNotFound, setStudentNotFound] = useState(false);
  const [isWrongClass, setIsWrongClass] = useState(false);

  // Form submission
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedAttempt, setCompletedAttempt] = useState<any | null>(null);

  // QR display toggle
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync with initialCode
  useEffect(() => {
    if (initialCode) {
      setAccessCode(initialCode.toUpperCase().trim());
    }
  }, [initialCode]);

  // Lookup session whenever accessCode changes
  const checkSession = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean || clean.length < 3) {
      setSession(null);
      setSessionNotFound(false);
      return;
    }

    setLoadingSession(true);
    setSessionNotFound(false);
    try {
      const found = await fetchSessionByCode(clean);
      setSession(found);
      setSessionNotFound(!found);
    } catch (err) {
      console.error('Error fetching session:', err);
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    if (accessCode.trim()) {
      const timer = setTimeout(() => {
        checkSession(accessCode);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setSession(null);
      setSessionNotFound(false);
    }
  }, [accessCode, checkSession]);

  // Lookup student whenever studentCode changes
  const checkStudent = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setIdentifiedStudent(null);
      setStudentNotFound(false);
      setIsWrongClass(false);
      return;
    }

    setCheckingStudent(true);
    try {
      const found = await lookupStudentByCode(clean);
      if (found) {
        setIdentifiedStudent(found);
        setStudentName(found.full_name);
        setStudentNotFound(false);
      } else {
        setIdentifiedStudent(null);
        setStudentNotFound(true);
      }
    } catch (err) {
      console.error('Error looking up student:', err);
      setIdentifiedStudent(null);
    } finally {
      setCheckingStudent(false);
    }
  }, []);

  useEffect(() => {
    if (studentCode.trim()) {
      const timer = setTimeout(() => {
        checkStudent(studentCode);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setIdentifiedStudent(null);
      setStudentNotFound(false);
      setIsWrongClass(false);
    }
  }, [studentCode, checkStudent]);

  // Check class permission when student or session updates
  useEffect(() => {
    if (session && identifiedStudent) {
      if (session.target_classes && session.target_classes.length > 0) {
        const studentClass = identifiedStudent.class_name?.trim().toUpperCase() || '';
        const isAllowed = session.target_classes.some(
          (tc) => tc.trim().toUpperCase() === 'ALL' || (studentClass && tc.trim().toUpperCase() === studentClass)
        );
        setIsWrongClass(!isAllowed);
      } else {
        setIsWrongClass(false);
      }
    } else {
      setIsWrongClass(false);
    }
  }, [session, identifiedStudent]);

  // Generate QR code for the session
  useEffect(() => {
    if (session && showQR) {
      const examUrl = `${window.location.origin}${window.location.pathname}?join=${session.access_code}`;
      QRCode.toDataURL(examUrl, {
        width: 220,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [session, showQR]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isWrongClass) {
      setErrorMsg('Bạn vào sai lớp làm bài và không được phép bắt đầu bài thi này.');
      return;
    }

    if (session?.target_classes && session.target_classes.length > 0 && !identifiedStudent) {
      setErrorMsg(`Kỳ thi này chỉ dành cho lớp: ${session.target_classes.join(', ')}. Vui lòng nhập đúng Mã HS/SBD được cấp để hệ thống xác nhận lớp.`);
      return;
    }

    setLoading(true);

    try {
      const res = await joinExamWithAccessCode(
        accessCode.trim().toUpperCase(),
        studentName.trim(),
        studentCode.trim().toUpperCase()
      );

      if (!res.success) {
        if (res.code === 'MAX_ATTEMPTS_REACHED' && res.lastAttempt) {
          setCompletedAttempt(res.lastAttempt);
          setErrorMsg(null);
        } else {
          setCompletedAttempt(null);
          setErrorMsg(res.message);
        }
        return;
      }

      onExamReady(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ khi vào phòng thi.');
    } finally {
      setLoading(false);
    }
  };

  const directUrl = session
    ? `${window.location.origin}${window.location.pathname}?join=${session.access_code}`
    : '';

  const handleCopyLink = () => {
    if (!directUrl) return;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const targetClassesText =
    session?.target_classes && session.target_classes.length > 0
      ? session.target_classes.join(', ')
      : 'Tất cả các lớp';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Vào Phòng Thi Trực Tuyến</h3>
              <p className="text-xs text-indigo-200">Nhập mã phòng hoặc quét QR để tham gia làm bài</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {completedAttempt && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Bài thi đã nộp & được lưu an toàn</h4>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      Học sinh <strong className="text-emerald-900">{studentName || 'Thí sinh'}</strong> (Mã: <span className="font-mono font-bold text-emerald-900">{studentCode}</span>) đã hoàn thành bài thi này. Kết quả đã được ghi nhận vào hệ thống thống kê của giáo viên.
                    </p>
                  </div>
                </div>
                {completedAttempt.score !== undefined && completedAttempt.score !== null && (
                  <div className="mt-2 pt-2.5 border-t border-emerald-200/80 flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800">Điểm số bài thi:</span>
                    <span className="font-bold text-sm text-emerald-800 bg-white px-3 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                      {completedAttempt.score} / {completedAttempt.max_score || 10} đ ({completedAttempt.percentage}%)
                    </span>
                  </div>
                )}
                {completedAttempt.submitted_at && (
                  <p className="text-[11px] text-emerald-600/90 text-right">
                    Thời gian nộp: {new Date(completedAttempt.submitted_at).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start space-x-2.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Input 1: Mã kỳ thi (Access Code) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  1. Mã phòng thi (Access Code)
                </label>
                {session && (
                  <button
                    type="button"
                    onClick={() => setShowQR(!showQR)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{showQR ? 'Ẩn mã QR' : 'Hiện mã QR & Link'}</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="VD: TOAN10, EXAM-8921..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm font-mono font-bold tracking-widest rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 uppercase bg-white"
                />
                {loadingSession && (
                  <div className="absolute right-3 top-3">
                    <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {sessionNotFound && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Không tìm thấy phòng thi với mã &quot;{accessCode}&quot;. Vui lòng kiểm tra lại.</span>
                </p>
              )}
            </div>

            {/* Session Detected Banner */}
            {session && (
              <div className="p-3.5 bg-slate-50 border border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                      Phòng thi hợp lệ:
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{session.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{session.exam_title}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 shrink-0 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>{session.duration_minutes} phút</span>
                  </span>
                </div>

                {/* Target Classes Notice */}
                <div className="flex items-center space-x-2 text-xs pt-1 border-t border-slate-200/80">
                  <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-slate-600">Đối tượng dự thi:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                    session.target_classes && session.target_classes.length > 0
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {targetClassesText}
                  </span>
                </div>
              </div>
            )}

            {/* Collapsible QR & Direct Link Box */}
            {session && showQR && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 text-center animate-in fade-in duration-200">
                <div className="text-xs font-bold text-indigo-900 flex items-center justify-center space-x-1.5">
                  <QrCode className="w-4 h-4 text-indigo-700" />
                  <span>Quét mã QR để cùng vào phòng thi</span>
                </div>

                {qrDataUrl && (
                  <div className="inline-block bg-white p-2.5 rounded-xl border border-indigo-200 shadow-xs">
                    <img src={qrDataUrl} alt="Mã QR" className="w-40 h-40 mx-auto" />
                  </div>
                )}

                <div className="flex items-center space-x-1.5 text-xs text-left">
                  <input
                    type="text"
                    readOnly
                    value={directUrl}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-indigo-200 rounded-lg text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Đã chép' : 'Sao chép link'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Input 2: Mã định danh học sinh (Mã HS hoặc SBD) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  2. Mã định danh học sinh (Mã HS hoặc SBD)
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Hệ thống tự động nhận diện
                </span>
              </div>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  placeholder="VD: HS1001, HS1002, HS1006..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 uppercase bg-white"
                />
                {checkingStudent && (
                  <div className="absolute right-3 top-3">
                    <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Student Recognition Card */}
            {identifiedStudent && (
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isWrongClass
                  ? 'bg-rose-50/70 border-rose-300'
                  : 'bg-emerald-50/60 border-emerald-300'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                    isWrongClass ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}>
                    {identifiedStudent.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                        isWrongClass ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        Đã nhận diện học sinh
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {identifiedStudent.student_code}
                      </span>
                    </div>
                    <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                      {identifiedStudent.full_name}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Lớp học: <strong className="text-slate-900">{identifiedStudent.class_name || 'Chưa xếp lớp'}</strong>
                    </div>
                  </div>
                </div>

                {/* Validation Status: Wrong Class or Allowed */}
                {isWrongClass ? (
                  <div className="mt-3 p-3 bg-rose-100/80 border border-rose-300 rounded-xl space-y-1 text-xs text-rose-950">
                    <div className="font-bold flex items-center space-x-1.5 text-rose-700">
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>CẢNH BÁO: VÀO SAI LỚP LÀM BÀI!</span>
                    </div>
                    <p className="leading-relaxed">
                      Em thuộc lớp <strong>{identifiedStudent.class_name}</strong>. Tuy nhiên kỳ thi này chỉ dành riêng cho lớp: <strong>{targetClassesText}</strong>.
                    </p>
                    <p className="text-[11px] font-semibold text-rose-700 pt-0.5">
                      ⛔ Hệ thống không cho phép vào làm bài thi này. Vui lòng kiểm tra lại mã phòng thi.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center space-x-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Học sinh và Lớp hợp lệ để tham gia bài thi.</span>
                  </div>
                )}
              </div>
            )}

            {studentNotFound && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="font-semibold flex items-center space-x-1 text-amber-900">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Chưa tìm thấy hồ sơ học sinh với mã này</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  {session?.target_classes && session.target_classes.length > 0
                    ? `Kỳ thi này giới hạn cho lớp: ${session.target_classes.join(', ')}. Vui lòng nhập chính xác Mã HS / SBD đã được cấp.`
                    : 'Em có thể tự nhập Họ và tên bên dưới để tiếp tục làm bài.'}
                </p>
              </div>
            )}

            {/* Input 3: Họ và tên thí sinh */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3. Họ và tên thí sinh
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white ${
                    identifiedStudent ? 'font-semibold text-slate-900' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer: Always visible, never cut off */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            {onSwitchToLogin && !currentProfile ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToLogin();
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
              >
                ← Giáo viên đăng nhập
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
            )}

            <button
              type="submit"
              disabled={loading || isWrongClass || (session?.target_classes && session.target_classes.length > 0 && !identifiedStudent)}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shadow-md ${
                isWrongClass
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : session?.target_classes && session.target_classes.length > 0 && !identifiedStudent
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
              }`}
            >
              {loading ? (
                <span>Đang kết nối phòng thi...</span>
              ) : isWrongClass ? (
                <span>Sai lớp (Không được phép thi)</span>
              ) : (
                <>
                  <span>Bắt đầu làm bài thi</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
