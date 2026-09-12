import React, { useEffect, useState } from 'react';
import { 
  Radio, 
  Plus, 
  KeyRound, 
  Copy, 
  Check, 
  Clock, 
  Calendar, 
  Users, 
  BarChart3, 
  Trash2, 
  ExternalLink,
  Power,
  X,
  Shuffle,
  Edit3,
  QrCode,
  Link2,
  GraduationCap
} from 'lucide-react';
import { ExamSession, Exam, SessionStatus, Profile, SchoolClass } from '../types';
import { 
  fetchExamSessions, 
  createExamSession, 
  updateExamSession,
  updateSessionStatus, 
  deleteExamSession, 
  generateAccessCode 
} from '../services/sessionService';
import { fetchExams } from '../services/examService';
import { fetchClasses } from '../services/classService';
import { ConfirmDialog } from './ConfirmDialog';
import { QRCodeModal } from './QRCodeModal';

interface ExamSessionViewProps {
  currentProfile: Profile | null;
  onOpenAuth: () => void;
  onViewResults: (sessionId: string) => void;
  onStudentJoinDirect: (code: string) => void;
  preselectedExam?: Exam | null;
}

export const ExamSessionView: React.FC<ExamSessionViewProps> = ({
  currentProfile,
  onOpenAuth,
  onViewResults,
  onStudentJoinDirect,
  preselectedExam,
}) => {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLinkSessionId, setCopiedLinkSessionId] = useState<string | null>(null);

  // QR Modal
  const [qrModalSession, setQrModalSession] = useState<ExamSession | null>(null);

  // Modal Create / Edit
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ExamSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [examId, setExamId] = useState(preselectedExam?.id || '');
  const [title, setTitle] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [duration, setDuration] = useState(45);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [showResult, setShowResult] = useState(true);

  // Target Classes State
  const [classSelectionMode, setClassSelectionMode] = useState<'all' | 'specific'>('all');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [customClassInput, setCustomClassInput] = useState('');

  useEffect(() => {
    loadData();
  }, [currentProfile]);

  useEffect(() => {
    if (preselectedExam) {
      setExamId(preselectedExam.id);
      setTitle(`Kỳ thi: ${preselectedExam.title}`);
      setDuration(preselectedExam.duration_minutes || 45);
      setAccessCode(generateAccessCode('EXAM'));
      setClassSelectionMode('all');
      setSelectedClasses([]);
      setIsCreateOpen(true);
    }
  }, [preselectedExam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, eList, cList] = await Promise.all([
        fetchExamSessions(currentProfile?.user_id),
        fetchExams(currentProfile?.user_id),
        fetchClasses(),
      ]);
      setSessions(sList);
      setExams(eList);
      setClasses(cList);
      if (eList.length > 0 && !examId) {
        setExamId(eList[0].id);
        setDuration(eList[0].duration_minutes || 45);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    if (exams.length === 0) {
      alert('Vui lòng tạo ít nhất 1 đề thi trước khi mở kỳ thi.');
      return;
    }
    setEditingSession(null);
    setAccessCode(generateAccessCode('EXAM'));
    const defaultExam = exams[0];
    setExamId(defaultExam.id);
    setTitle(`Kỳ thi: ${defaultExam.title}`);
    setDuration(defaultExam.duration_minutes || 45);
    setStartAt('');
    setEndAt('');
    setMaxAttempts(1);
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setShowResult(true);
    setClassSelectionMode('all');
    setSelectedClasses([]);
    setCustomClassInput('');
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (session: ExamSession) => {
    setEditingSession(session);
    setExamId(session.exam_id);
    setTitle(session.title);
    setAccessCode(session.access_code);
    setDuration(session.duration_minutes);
    setMaxAttempts(session.max_attempts || 1);
    setShuffleQuestions(session.shuffle_questions);
    setShuffleOptions(session.shuffle_options);
    setShowResult(session.show_result_after_submit);
    setStartAt(session.start_at ? session.start_at.substring(0, 16) : '');
    setEndAt(session.end_at ? session.end_at.substring(0, 16) : '');
    if (session.target_classes && session.target_classes.length > 0) {
      setClassSelectionMode('specific');
      setSelectedClasses(session.target_classes);
    } else {
      setClassSelectionMode('all');
      setSelectedClasses([]);
    }
    setCustomClassInput('');
    setIsCreateOpen(true);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyDirectLink = (session: ExamSession) => {
    const url = `${window.location.origin}${window.location.pathname}?join=${session.access_code}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkSessionId(session.id);
    setTimeout(() => setCopiedLinkSessionId(null), 2000);
  };

  const handleToggleStatus = async (sessionId: string, currentStatus: SessionStatus) => {
    const nextStatus: SessionStatus = currentStatus === 'active' ? 'closed' : 'active';
    try {
      await updateSessionStatus(sessionId, nextStatus);
      setSessions(sessions.map((s) => s.id === sessionId ? { ...s, status: nextStatus } : s));
    } catch (err: any) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExamSession(sessionToDelete.id);
      setSessions(sessions.filter((s) => s.id !== sessionToDelete.id));
      setSessionToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa kỳ thi: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleClass = (className: string) => {
    if (selectedClasses.includes(className)) {
      setSelectedClasses(selectedClasses.filter((c) => c !== className));
    } else {
      setSelectedClasses([...selectedClasses, className]);
    }
  };

  const handleAddCustomClass = () => {
    const clean = customClassInput.trim().toUpperCase();
    if (clean && !selectedClasses.includes(clean)) {
      setSelectedClasses([...selectedClasses, clean]);
      setCustomClassInput('');
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }

    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      alert('Thời gian kết thúc phải sau thời gian bắt đầu mở đề.');
      return;
    }

    if (classSelectionMode === 'specific' && selectedClasses.length === 0) {
      alert('Vui lòng chọn ít nhất một lớp làm bài hoặc chọn "Tất cả các lớp".');
      return;
    }

    const targetClassesPayload = classSelectionMode === 'specific' && selectedClasses.length > 0
      ? selectedClasses
      : undefined;

    try {
      if (editingSession) {
        await updateExamSession(editingSession.id, {
          title: title.trim(),
          duration_minutes: duration,
          start_at: startAt ? new Date(startAt).toISOString() : null,
          end_at: endAt ? new Date(endAt).toISOString() : null,
          max_attempts: maxAttempts,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
          show_result_after_submit: showResult,
          target_classes: targetClassesPayload,
        });
        setSessions(sessions.map((s) => s.id === editingSession.id ? {
          ...s,
          title: title.trim(),
          duration_minutes: duration,
          start_at: startAt ? new Date(startAt).toISOString() : null,
          end_at: endAt ? new Date(endAt).toISOString() : null,
          max_attempts: maxAttempts,
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
          show_result_after_submit: showResult,
          target_classes: targetClassesPayload,
        } : s));
      } else {
        await createExamSession({
          exam_id: examId,
          owner_id: currentProfile.user_id,
          access_code: accessCode.trim().toUpperCase(),
          title: title.trim(),
          duration_minutes: duration,
          start_at: startAt ? new Date(startAt).toISOString() : null,
          end_at: endAt ? new Date(endAt).toISOString() : null,
          max_attempts: maxAttempts,
          status: 'active',
          shuffle_questions: shuffleQuestions,
          shuffle_options: shuffleOptions,
          show_result_after_submit: showResult,
          target_classes: targetClassesPayload,
        });
        await loadData();
      }

      setIsCreateOpen(false);
      setEditingSession(null);
    } catch (err: any) {
      alert('Lỗi lưu kỳ thi: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Kỳ thi Trực tuyến & Cấp Mã Phòng</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cung cấp mã phòng, mã QR hoặc link trực tiếp cho học sinh quét mã hoặc nhấp link làm bài từ mọi thiết bị
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Kỳ thi & Mã phòng mới</span>
        </button>
      </div>

      {/* Session Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">Đang tải danh sách kỳ thi...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3">
            <Radio className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-base">Chưa có kỳ thi trực tuyến nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tạo phòng thi trực tuyến để nhận Mã tham gia, Link trực tiếp và Mã QR cho học sinh làm bài.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors"
            >
              Tạo phòng thi đầu tiên
            </button>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.status === 'active';
            const now = new Date();
            const isExpired = session.end_at ? now > new Date(session.end_at) : false;
            const isUpcoming = session.start_at ? now < new Date(session.start_at) : false;

            const hasTargetClasses = session.target_classes && session.target_classes.length > 0;

            return (
              <div
                key={session.id}
                className={`bg-white p-5 rounded-3xl border shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between ${
                  isExpired 
                    ? 'border-rose-200 bg-rose-50/15' 
                    : isUpcoming
                    ? 'border-amber-200 bg-amber-50/15'
                    : isActive 
                    ? 'border-emerald-200 hover:shadow-md' 
                    : 'border-slate-200 opacity-90'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Status + Action Icons */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full flex items-center space-x-1.5 border ${
                      isExpired
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : isUpcoming
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : isActive 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isExpired
                          ? 'bg-rose-500'
                          : isUpcoming
                          ? 'bg-amber-500'
                          : isActive 
                          ? 'bg-emerald-600 animate-ping' 
                          : 'bg-slate-400'
                      }`} />
                      <span>
                        {isExpired
                          ? 'Đã hết hạn nộp'
                          : isUpcoming
                          ? 'Chưa đến giờ mở'
                          : isActive
                          ? 'Đang mở phòng thi'
                          : 'Đã đóng phòng'}
                      </span>
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setQrModalSession(session)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Xem Mã QR & Link phòng thi"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(session)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="Chỉnh sửa cài đặt & thời gian"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(session.id, session.status)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isActive 
                            ? 'text-amber-600 hover:bg-amber-50' 
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={isActive ? 'Đóng phòng thi' : 'Mở lại phòng thi'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSessionToDelete(session)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Xóa kỳ thi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Target Class Badge */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">{session.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đề: <strong>{session.exam_title || 'Đề kiểm tra'}</strong>
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {hasTargetClasses ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Lớp: {session.target_classes!.join(', ')}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Mở tự do cho mọi lớp
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Access Code Highlight Box with Copy & QR trigger */}
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-3.5 rounded-2xl text-white flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] text-indigo-300 uppercase tracking-wider block font-semibold">
                        Mã tham gia (Access Code)
                      </span>
                      <span className="text-xl font-mono font-black tracking-widest text-amber-300">
                        {session.access_code}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleCopyCode(session.access_code)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Sao chép mã phòng"
                      >
                        {copiedCode === session.access_code ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setQrModalSession(session)}
                        className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors"
                        title="Mở mã QR phòng thi"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Meta details */}
                  <div className="space-y-2 text-xs text-slate-600 pt-0.5">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="flex items-center space-x-1 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Thời lượng: <strong>{session.duration_minutes} phút</strong></span>
                      </span>
                      <span className="flex items-center space-x-1 text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{session.attempts_count || 0} lượt thi</span>
                      </span>
                    </div>

                    {/* Schedule dates */}
                    {(session.start_at || session.end_at) && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-[11px]">
                        {session.start_at && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="flex items-center space-x-1 text-slate-500">
                              <Calendar className="w-3 h-3 text-indigo-500" />
                              <span>Mở lúc:</span>
                            </span>
                            <span className="font-semibold text-slate-800">
                              {new Date(session.start_at).toLocaleString('vi-VN', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        )}
                        {session.end_at && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="flex items-center space-x-1 text-slate-500">
                              <Clock className="w-3 h-3 text-rose-500" />
                              <span>Đóng lúc:</span>
                            </span>
                            <span className={`font-semibold ${isExpired ? 'text-rose-600' : 'text-slate-800'}`}>
                              {new Date(session.end_at).toLocaleString('vi-VN', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions: Link Copy, QR & Direct Test */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleCopyDirectLink(session)}
                      className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center justify-center space-x-1"
                      title="Sao chép link làm bài gửi học sinh"
                    >
                      {copiedLinkSessionId === session.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Đã chép link</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Sao chép Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setQrModalSession(session)}
                      className="py-1.5 px-3 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center space-x-1"
                      title="Hiện mã QR để học sinh quét camera"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Mã QR</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onViewResults(session.id)}
                      className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center justify-center space-x-1"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Xem kết quả</span>
                    </button>

                    <button
                      onClick={() => onStudentJoinDirect(session.access_code)}
                      className="py-1.5 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center space-x-1 shadow-2xs"
                    >
                      <span>Vào thi</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Redesigned Modal: Create or Edit Session (GUARANTEED NO OVERFLOW, STICKY ACTION BUTTONS) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full h-[88vh] max-h-[780px] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Sticky Header */}
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <h3 className="font-bold text-sm sm:text-base flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <span className="text-white block font-bold leading-tight">
                    {editingSession ? 'Cài đặt Phòng thi & Thời gian' : 'Tạo Kỳ thi & Cấp Mã Phòng thi'}
                  </span>
                  <span className="text-[11px] text-indigo-200 font-normal hidden sm:block">
                    Thiết lập mã tham gia, phân công lớp và thời hạn làm bài
                  </span>
                </div>
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingSession(null);
                }} 
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body with explicit min-h-0 and sticky footer */}
            <form onSubmit={handleSaveSession} className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-4.5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                {/* 1 & 2. Đề thi & Tiêu đề kỳ thi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. Chọn Đề thi {editingSession && <span className="text-slate-400 font-normal">(Đã liên kết)</span>}
                    </label>
                    <select
                      value={examId}
                      disabled={!!editingSession}
                      onChange={(e) => {
                        setExamId(e.target.value);
                        const sel = exams.find((x) => x.id === e.target.value);
                        if (sel) {
                          setTitle(`Kỳ thi: ${sel.title}`);
                          setDuration(sel.duration_minutes || 45);
                        }
                      }}
                      className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white ${
                        editingSession ? 'opacity-70 bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>{ex.title} ({ex.duration_minutes} phút - {ex.total_points} điểm)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. Tiêu đề Phòng thi
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="VD: Kiểm tra Giữa kỳ I - Lớp 10A1"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                {/* 3. Mã tham gia, Thời lượng & Số lần thi (3 cols) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        3. Mã phòng thi
                      </label>
                      {!editingSession && (
                        <button
                          type="button"
                          onClick={() => setAccessCode(generateAccessCode('EXAM'))}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          Đổi mã
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={!!editingSession}
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      className={`w-full px-3 py-2 text-xs font-mono font-bold tracking-wider rounded-xl border border-slate-300 uppercase ${
                        editingSession ? 'bg-slate-100 opacity-75' : 'bg-white'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Thời lượng (phút)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      required
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 45)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số lần làm bài
                    </label>
                    <select
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                    >
                      <option value={1}>1 lần duy nhất</option>
                      <option value={2}>2 lần</option>
                      <option value={3}>3 lần</option>
                      <option value={5}>5 lần</option>
                      <option value={999}>Không giới hạn</option>
                    </select>
                  </div>
                </div>

                {/* 4. CÀI ĐẶT CHỌN LỚP LÀM BÀI */}
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <label className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        4. Cài đặt Lớp được phép làm bài
                      </label>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      {classSelectionMode === 'all' 
                        ? 'Tất cả các lớp' 
                        : `Đã chọn: ${selectedClasses.length} lớp`}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-normal">
                    Hệ thống sẽ tự động xác minh thông tin họ tên & lớp của học sinh theo SBD/Mã HS. Nếu vào sai lớp, hệ thống sẽ cảnh báo và chặn không cho vào thi.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className={`p-2.5 rounded-xl border flex items-start space-x-2 cursor-pointer transition-all ${
                      classSelectionMode === 'all' 
                        ? 'bg-white border-indigo-400 shadow-2xs font-semibold text-indigo-950' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="classMode"
                        checked={classSelectionMode === 'all'}
                        onChange={() => setClassSelectionMode('all')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold">Mở tự do (Tất cả lớp)</div>
                        <div className="text-[10px] font-normal text-slate-500">Mọi học sinh có mã đều vào được</div>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-start space-x-2 cursor-pointer transition-all ${
                      classSelectionMode === 'specific' 
                        ? 'bg-white border-indigo-400 shadow-2xs font-semibold text-indigo-950' 
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="classMode"
                        checked={classSelectionMode === 'specific'}
                        onChange={() => setClassSelectionMode('specific')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold">Chỉ định Lớp cụ thể</div>
                        <div className="text-[10px] font-normal text-slate-500">Chỉ HS đúng lớp mới được vào thi</div>
                      </div>
                    </label>
                  </div>

                  {classSelectionMode === 'specific' && (
                    <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-2">
                      <div className="text-[11px] font-bold text-slate-700">Chọn lớp được phép thi:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {classes.map((cls) => {
                          const isSelected = selectedClasses.includes(cls.name);
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => handleToggleClass(cls.name)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center space-x-1 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{cls.name}</span>
                              {isSelected ? <Check className="w-3 h-3" /> : null}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom class input */}
                      <div className="flex items-center space-x-2 pt-1.5 border-t border-slate-100">
                        <input
                          type="text"
                          value={customClassInput}
                          onChange={(e) => setCustomClassInput(e.target.value)}
                          placeholder="Nhập thêm lớp (VD: 10A3, 11B1)..."
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomClass();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomClass}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"
                        >
                          + Thêm
                        </button>
                      </div>

                      {selectedClasses.length === 0 && (
                        <p className="text-[10px] text-amber-600 font-semibold">
                          ⚠ Vui lòng bấm chọn ít nhất 1 lớp để áp dụng phân quyền.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Lịch mở đề & Thời hạn kết thúc */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>5. Lịch mở & Hạn chót nộp bài</span>
                    </span>
                    {(startAt || endAt) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartAt('');
                          setEndAt('');
                        }}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        Xóa lịch (mở tự do)
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Thời gian mở phòng thi:
                      </label>
                      <input
                        type="datetime-local"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Hạn chót thu bài (Đóng phòng):
                      </label>
                      <input
                        type="datetime-local"
                        value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Chống gian lận & hiển thị */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700">
                    6. Cấu hình bảo mật phòng thi
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px]">Xáo trộn câu hỏi</span>
                    </label>

                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shuffleOptions}
                        onChange={(e) => setShuffleOptions(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px]">Xáo trộn đáp án</span>
                    </label>

                    <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showResult}
                        onChange={(e) => setShowResult(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px]">Hiện kết quả sau nộp</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* STICKY FOOTER: ALWAYS VISIBLE AND NEVER CUT OFF */}
              <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 z-10 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingSession(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingSession ? 'Lưu cập nhật phòng thi' : 'Kích hoạt & Cấp mã phòng'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code & Direct Link Modal */}
      <QRCodeModal
        isOpen={!!qrModalSession}
        session={qrModalSession}
        onClose={() => setQrModalSession(null)}
        onStudentJoinDirect={onStudentJoinDirect}
      />

      {/* Confirmation Dialog for Deleting Exam Session */}
      <ConfirmDialog
        isOpen={!!sessionToDelete}
        title="Xác nhận xóa Phòng thi"
        message={`Bạn có chắc chắn muốn xóa kỳ thi "${sessionToDelete?.title}"? Toàn bộ lịch sử nộp bài của học sinh trong phòng thi này sẽ bị xóa.`}
        confirmLabel="Xóa phòng thi"
        loading={isDeleting}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
