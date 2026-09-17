import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ShieldCheck, 
  RotateCcw, 
  Printer, 
  Calendar, 
  User, 
  FileText, 
  Check, 
  Award,
  AlertCircle
} from 'lucide-react';
import { ExamAuditLog, ExamResultQuestionReview } from '../types';

interface ExamAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: ExamAuditLog | null;
  loading: boolean;
  onAllowRetake?: (studentCode: string, attemptId: string) => void;
}

export const ExamAuditLogModal: React.FC<ExamAuditLogModalProps> = ({
  isOpen,
  onClose,
  auditLog,
  loading,
  onAllowRetake,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'timeline'>('review');
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'wrong' | 'unanswered'>('all');

  if (!isOpen) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '---';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} giây`;
    return `${m} phút ${s > 0 ? `${s} giây` : ''}`;
  };

  const getRankBadge = (score: number, maxScore: number) => {
    const pct = maxScore > 0 ? (score / maxScore) * 10 : score;
    if (pct >= 8.5) return { label: 'Xuất sắc / Giỏi', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    if (pct >= 6.5) return { label: 'Khá', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (pct >= 5.0) return { label: 'Đạt yêu cầu', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Chưa đạt', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const questions = auditLog?.questions || [];
  const filteredQuestions = questions.filter((q) => {
    if (filterType === 'all') return true;
    if (filterType === 'unanswered') return !q.is_answered;
    const isFullCorrect = (q.earned_points || 0) >= (q.points || 1);
    if (filterType === 'correct') return q.is_answered && isFullCorrect;
    if (filterType === 'wrong') return q.is_answered && !isFullCorrect;
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  const rank = auditLog ? getRankBadge(auditLog.score, auditLog.maxScore) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  Nhật ký thi & Bài làm: {auditLog?.studentName || 'Đang tải...'}
                </h2>
                {rank && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${rank.color}`}>
                    {rank.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                <span>Mã HS: <strong className="font-mono text-slate-700">{auditLog?.studentCode || '---'}</strong></span>
                <span>•</span>
                <span className="truncate">Kỳ thi: {auditLog?.sessionTitle || '---'}</span>
                {auditLog?.sessionAccessCode && (
                  <>
                    <span>•</span>
                    <span className="font-mono bg-slate-200/80 px-1.5 py-0.2 rounded text-[11px] font-semibold text-slate-700">
                      {auditLog.sessionAccessCode}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {loading || !auditLog ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Đang tải nhật ký và dữ liệu bài thi...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Điểm đạt được</span>
                  <Award className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-xl font-extrabold text-slate-900">
                    {auditLog.score}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    / {auditLog.maxScore} đ
                  </span>
                  <span className="text-xs font-bold text-indigo-600 ml-auto">
                    ({auditLog.percentage}%)
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Thời gian làm bài</span>
                  <Clock className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {formatDuration(auditLog.timeSpentSeconds)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Quy định: {auditLog.durationMinutes || 45} phút
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Đúng / Sai</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold">
                  <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    {auditLog.correctCount} đúng
                  </span>
                  <span className="text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                    {auditLog.wrongCount} sai
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">Thời điểm nộp</span>
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {auditLog.submittedAt ? new Date(auditLog.submittedAt).toLocaleTimeString('vi-VN') : '---'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {auditLog.submittedAt ? new Date(auditLog.submittedAt).toLocaleDateString('vi-VN') : '---'}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 flex items-center justify-between">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className={`pb-2.5 text-xs font-bold transition-colors relative cursor-pointer ${
                    activeTab === 'review'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Chi tiết từng câu hỏi ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className={`pb-2.5 text-xs font-bold transition-colors relative cursor-pointer ${
                    activeTab === 'timeline'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Nhật ký tiến trình & Toàn vẹn ({auditLog.timelineEvents.length})
                </button>
              </div>

              {activeTab === 'review' && questions.length > 0 && (
                <div className="flex items-center space-x-1 pb-2">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      filterType === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('correct')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      filterType === 'correct'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    Đúng ({auditLog.correctCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('wrong')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      filterType === 'wrong'
                        ? 'bg-rose-600 text-white'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    Sai ({auditLog.wrongCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('unanswered')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      filterType === 'unanswered'
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Chưa làm ({auditLog.unansweredCount})
                  </button>
                </div>
              )}
            </div>

            {/* Tab 1: Detailed Question Review */}
            {activeTab === 'review' && (
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                    Không có câu hỏi nào theo bộ lọc đã chọn.
                  </div>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const isFullCorrect = (q.earned_points || 0) >= (q.points || 1);
                    const isPartial = (q.earned_points || 0) > 0 && !isFullCorrect;

                    return (
                      <div
                        key={q.id || idx}
                        className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                              {q.order || idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              {q.question_type === 'true_false' 
                                ? 'Đúng / Sai 4 ý' 
                                : q.question_type === 'short_answer'
                                ? 'Trả lời ngắn'
                                : q.question_type === 'essay'
                                ? 'Tự luận'
                                : 'Trắc nghiệm 4 lựa chọn'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            {!q.is_answered ? (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                Chưa trả lời
                              </span>
                            ) : isFullCorrect ? (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Chính xác (+{q.earned_points}đ)</span>
                              </span>
                            ) : isPartial ? (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Đúng 1 phần (+{q.earned_points}đ)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Chưa đúng (0đ)</span>
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-400">
                              / {q.points}đ
                            </span>
                          </div>
                        </div>

                        {/* Question Content */}
                        <div className="text-xs font-medium text-slate-900 leading-relaxed pl-8">
                          {q.content}
                        </div>

                        {/* Options / Statements breakdown */}
                        <div className="pl-8 space-y-2">
                          {/* Case 1: Multiple choice options */}
                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {q.options.map((opt, optIdx) => {
                                const optLabel = String.fromCharCode(65 + optIdx);
                                const isUserSelected = q.user_selected_option_id === opt.id;
                                const isCorrect = opt.is_correct || q.correct_option_id === opt.id;

                                let borderBgClass = 'bg-slate-50 border-slate-200 text-slate-700';
                                if (isCorrect && isUserSelected) {
                                  borderBgClass = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold ring-1 ring-emerald-500';
                                } else if (isCorrect) {
                                  borderBgClass = 'bg-emerald-50/50 border-emerald-200 text-emerald-800';
                                } else if (isUserSelected) {
                                  borderBgClass = 'bg-rose-50 border-rose-300 text-rose-900 font-semibold ring-1 ring-rose-400';
                                }

                                return (
                                  <div
                                    key={opt.id || optIdx}
                                    className={`p-2.5 rounded-lg border flex items-start space-x-2 text-xs transition-colors ${borderBgClass}`}
                                  >
                                    <span className="font-bold shrink-0">{optLabel}.</span>
                                    <span className="flex-1">{opt.content}</span>
                                    {isUserSelected && (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/80 shrink-0">
                                        HS chọn
                                      </span>
                                    )}
                                    {isCorrect && (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Case 2: True/False statements */}
                          {q.statements && q.statements.length > 0 && (
                            <div className="space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs">
                              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Kết quả từng ý Đúng / Sai:
                              </div>
                              {q.statements.map((st, sIdx) => {
                                const stLetter = String.fromCharCode(97 + sIdx);
                                const userChoice = q.user_statement_answers?.[st.id] ?? st.user_choice;
                                const isStatementCorrect = st.is_correct;
                                const isAnswerCorrect = userChoice === isStatementCorrect;

                                return (
                                  <div
                                    key={st.id || sIdx}
                                    className="flex items-center justify-between p-2 rounded bg-white border border-slate-200/80 gap-2"
                                  >
                                    <span className="font-medium text-slate-800 flex-1">
                                      <strong>{stLetter})</strong> {st.statement}
                                    </span>
                                    <div className="flex items-center space-x-3 shrink-0 text-xs">
                                      <span>
                                        HS: <strong className={userChoice ? 'text-indigo-600' : 'text-slate-600'}>
                                          {userChoice === true ? 'ĐÚNG' : userChoice === false ? 'SAI' : 'Chưa chọn'}
                                        </strong>
                                      </span>
                                      <span>
                                        Chuẩn: <strong className="text-emerald-700">
                                          {isStatementCorrect ? 'ĐÚNG' : 'SAI'}
                                        </strong>
                                      </span>
                                      {userChoice !== undefined && (
                                        isAnswerCorrect ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-rose-600" />
                                        )
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Case 3: Short answer */}
                          {q.question_type === 'short_answer' && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Câu trả lời của học sinh:</span>
                                <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200">
                                  {q.user_answer_text || '(Chưa điền đáp số)'}
                                </span>
                              </div>
                              {q.correct_answer && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-medium">Đáp án chuẩn:</span>
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                                    {q.correct_answer}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Case 4: Essay */}
                          {q.question_type === 'essay' && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                              <span className="text-slate-500 font-medium block">Bài làm tự luận của học sinh:</span>
                              <div className="p-2.5 bg-white border border-slate-200 rounded text-slate-800 whitespace-pre-wrap">
                                {q.user_answer_text || '(Chưa nộp bài làm tự luận)'}
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          {q.explanation && (
                            <div className="mt-2 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-900 space-y-0.5">
                              <span className="font-bold text-indigo-700 block">Lời giải / Giải thích:</span>
                              <p className="leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Timeline & Audit Events */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-bold text-slate-900">Báo cáo Giám sát Toàn vẹn Kỳ thi</h4>
                    <p className="text-slate-500 mt-0.5">
                      Hệ thống tự động lưu trữ định kỳ, theo dõi kết nối mạng và tính hợp lệ của bài nộp.
                    </p>
                  </div>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {auditLog.timelineEvents.map((evt, eIdx) => {
                    let icon = <Clock className="w-3.5 h-3.5" />;
                    let iconBg = 'bg-slate-100 text-slate-600 border-slate-300';

                    if (evt.type === 'start') {
                      icon = <User className="w-3.5 h-3.5" />;
                      iconBg = 'bg-indigo-100 text-indigo-700 border-indigo-300';
                    } else if (evt.type === 'save') {
                      icon = <FileText className="w-3.5 h-3.5" />;
                      iconBg = 'bg-sky-100 text-sky-700 border-sky-300';
                    } else if (evt.type === 'integrity') {
                      icon = <ShieldCheck className="w-3.5 h-3.5" />;
                      iconBg = 'bg-emerald-100 text-emerald-700 border-emerald-300';
                    } else if (evt.type === 'submit') {
                      icon = <CheckCircle2 className="w-3.5 h-3.5" />;
                      iconBg = 'bg-emerald-100 text-emerald-700 border-emerald-300';
                    }

                    return (
                      <div key={eIdx} className="relative flex items-start space-x-3 text-xs">
                        <div className={`absolute -left-6 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 bg-white ${iconBg}`}>
                          {icon}
                        </div>
                        <div className="flex-1 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{evt.title}</span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {new Date(evt.time).toLocaleTimeString('vi-VN')} ({new Date(evt.time).toLocaleDateString('vi-VN')})
                            </span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">{evt.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            {onAllowRetake && auditLog && (
              <button
                type="button"
                onClick={() => onAllowRetake(auditLog.studentCode, auditLog.attemptId)}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cho học sinh làm lại bài</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>In nhật ký</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
