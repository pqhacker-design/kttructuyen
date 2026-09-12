import React, { useEffect, useState, useRef } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Flag, 
  Award,
  ArrowLeft,
  RefreshCw,
  RotateCcw,
  XCircle,
  HelpCircle,
  Check,
  X,
  EyeOff,
  PenLine,
  FileText,
  Sparkles,
  Type
} from 'lucide-react';
import { JoinExamResponse, autoSaveAnswer, submitExamAttempt } from '../services/takingService';
import { ExamResult } from '../types';
import { MathRenderer } from './MathRenderer';

const MATH_SYMBOLS = ['+', '−', '×', '÷', '=', '≠', '≈', '≤', '≥', '±', '√', 'π', 'α', 'β', 'Δ', '→', '²', '³', '∞', '∈', '⊂'];

export function parseEssaySubAnswers(rawText?: string, subItems?: any[]): Record<string, string> {
  if (!rawText) return {};
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    if (subItems && subItems.length > 0) {
      const firstKey = subItems[0].item_number || 'a';
      return { [firstKey]: rawText };
    }
  }
  return {};
}

interface ExamTakingViewProps {
  examData: JoinExamResponse;
  onExit: () => void;
  onRetake?: () => Promise<void> | void;
}

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  examData,
  onExit,
  onRetake,
}) => {
  const session = examData?.session;
  const attempt = examData?.attempt;
  const questions = examData?.questions || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; answer_text?: string; statement_answers?: Record<string, boolean> }>>(
    examData.existingAnswers || {}
  );
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isRetakeConfirmOpen, setIsRetakeConfirmOpen] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [activeEssaySubIndex, setActiveEssaySubIndex] = useState(0);

  // Server-authoritative timer: calculate remaining time from min(attempt.started_at + duration, session.end_at)
  const computeRemainingSeconds = (attStartedAt?: string) => {
    const startedAt = attStartedAt ? new Date(attStartedAt).getTime() : Date.now();
    const durationMs = (session?.duration_minutes || 45) * 60 * 1000;
    let expiresAt = startedAt + durationMs;
    if (session?.end_at) {
      const endAtMs = new Date(session.end_at).getTime();
      if (!isNaN(endAtMs) && endAtMs < expiresAt) {
        expiresAt = endAtMs;
      }
    }
    const diff = Math.floor((expiresAt - Date.now()) / 1000);
    return Math.max(0, diff);
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    return computeRemainingSeconds(attempt?.started_at);
  });

  // Re-sync when attempt/examData updates (e.g., when a fresh retake attempt is loaded)
  useEffect(() => {
    setAnswers(examData.existingAnswers || {});
    setFlagged({});
    setCurrentIndex(0);
    setActiveEssaySubIndex(0);
    setExamResult(null);
    setIsSubmitModalOpen(false);
    setSubmitting(false);
    setRemainingSeconds(computeRemainingSeconds(examData.attempt?.started_at));
  }, [examData.attempt?.id]);

  const saveTimeoutRef = useRef<any>(null);
  const essayTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setActiveEssaySubIndex(0);
  }, [currentIndex]);

  // Timer countdown
  useEffect(() => {
    if (examResult) return; // Stop timer if already submitted

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitDueToTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examResult]);

  const handleAutoSubmitDueToTimeout = async () => {
    alert('Hết giờ làm bài! Hệ thống đang tự động nộp bài của bạn.');
    await doFinalSubmit();
  };

  const handleRetakeExam = async () => {
    // Check if end_at is already passed
    if (session?.end_at && new Date() > new Date(session.end_at)) {
      alert(`Kỳ thi đã kết thúc vào lúc ${new Date(session.end_at).toLocaleString('vi-VN')}. Không thể làm lại bài thi.`);
      setIsRetakeConfirmOpen(false);
      return;
    }

    setIsRetaking(true);
    try {
      if (onRetake) {
        await onRetake();
      } else {
        // Fallback internal reset
        setAnswers({});
        setFlagged({});
        setCurrentIndex(0);
        setActiveEssaySubIndex(0);
        setExamResult(null);
        setIsSubmitModalOpen(false);
        setSubmitting(false);

        const durationMs = (session?.duration_minutes || 45) * 60 * 1000;
        let expiresAt = Date.now() + durationMs;
        if (session?.end_at) {
          const endAtMs = new Date(session.end_at).getTime();
          if (!isNaN(endAtMs) && endAtMs < expiresAt) {
            expiresAt = endAtMs;
          }
        }
        setRemainingSeconds(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
      }
    } catch (err: any) {
      alert('Không thể khởi tạo lượt làm lại: ' + (err?.message || 'Vui lòng thử lại sau'));
    } finally {
      setIsRetaking(false);
      setIsRetakeConfirmOpen(false);
    }
  };

  // Handle single choice option selection
  const handleSelectOption = (questionId: string, optionId: string) => {
    if (examResult) return;

    const newAnswers = {
      ...answers,
      [questionId]: {
        ...answers[questionId],
        selected_option_id: optionId,
      },
    };
    setAnswers(newAnswers);
    setSaveStatus('saving');

    // Debounce save to Supabase / LocalStore
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!attempt?.id) return;
      const res = await autoSaveAnswer(attempt.id, questionId, optionId);
      if (res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    }, 400);
  };

  // Handle True / False statement answer
  const handleSelectStatementChoice = (questionId: string, statementId: string, value: boolean) => {
    if (examResult) return;

    const currentStatements = answers[questionId]?.statement_answers || {};
    const updatedStatements = {
      ...currentStatements,
      [statementId]: value,
    };

    const newAnswers = {
      ...answers,
      [questionId]: {
        ...answers[questionId],
        statement_answers: updatedStatements,
      },
    };
    setAnswers(newAnswers);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!attempt?.id) return;
      const res = await autoSaveAnswer(attempt.id, questionId, undefined, undefined, updatedStatements);
      if (res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    }, 400);
  };

  // Handle text answer for Essay / Short Answer (HS tự nhập đáp án, không hiện đáp án sẵn)
  const handleTextAnswerChange = (questionId: string, value: string) => {
    if (examResult) return;

    const newAnswers = {
      ...answers,
      [questionId]: {
        ...answers[questionId],
        answer_text: value,
      },
    };
    setAnswers(newAnswers);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!attempt?.id) return;
      const res = await autoSaveAnswer(attempt.id, questionId, undefined, value);
      if (res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    }, 450);
  };

  const handleSubAnswerChange = (questionId: string, itemNumber: string, text: string) => {
    if (examResult) return;
    const currentSubMap = parseEssaySubAnswers(answers[questionId]?.answer_text, currentQ?.sub_items);
    const updatedSubMap = { ...currentSubMap, [itemNumber]: text };
    handleTextAnswerChange(questionId, JSON.stringify(updatedSubMap));
  };

  const handleInsertSymbol = (questionId: string, sym: string) => {
    if (examResult) return;
    const isMultiSub = currentQ?.question_type === 'essay' && currentQ?.sub_items && currentQ.sub_items.length > 1;
    if (isMultiSub) {
      const subItem = currentQ.sub_items[activeEssaySubIndex] || currentQ.sub_items[0];
      const subKey = subItem.item_number;
      const subMap = parseEssaySubAnswers(answers[questionId]?.answer_text, currentQ.sub_items);
      const currentText = subMap[subKey] || '';
      const textarea = essayTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextText = currentText.substring(0, start) + sym + currentText.substring(end);
        handleSubAnswerChange(questionId, subKey, nextText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + sym.length, start + sym.length);
        }, 10);
      } else {
        handleSubAnswerChange(questionId, subKey, currentText + sym);
      }
    } else {
      const currentText = answers[questionId]?.answer_text || '';
      const textarea = essayTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextText = currentText.substring(0, start) + sym + currentText.substring(end);
        handleTextAnswerChange(questionId, nextText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + sym.length, start + sym.length);
        }, 10);
      } else {
        handleTextAnswerChange(questionId, currentText + sym);
      }
    }
  };

  const handleToggleFlag = (questionId: string) => {
    setFlagged({
      ...flagged,
      [questionId]: !flagged[questionId],
    });
  };

  const doFinalSubmit = async () => {
    if (!attempt?.id) return;
    setSubmitting(true);
    try {
      const res = await submitExamAttempt(attempt.id, answers);
      if (res.success && res.result) {
        setExamResult(res.result);
        setIsSubmitModalOpen(false);
      } else {
        alert(res.message || 'Lỗi khi nộp bài. Vui lòng thử lại.');
      }
    } catch (err: any) {
      alert('Lỗi nộp bài: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Format timer MM:SS
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = remainingSeconds <= 300; // Under 5 minutes

  const currentQ = questions[currentIndex];

  const checkIsQuestionAnswered = (q: any) => {
    const qAns = answers[q.id];
    if (q.question_type === 'true_false' || (q.statements && q.statements.length > 0)) {
      return Boolean(qAns?.statement_answers && Object.keys(qAns.statement_answers).length > 0);
    }
    if (q.question_type === 'essay') {
      if (q.sub_items && q.sub_items.length > 1) {
        const subMap = parseEssaySubAnswers(qAns?.answer_text, q.sub_items);
        return Object.values(subMap).some((txt) => typeof txt === 'string' && txt.trim().length > 0);
      }
      return Boolean(qAns?.answer_text && qAns.answer_text.trim().length > 0);
    }
    if (q.question_type === 'short_answer') {
      return Boolean(qAns?.answer_text && qAns.answer_text.trim().length > 0);
    }
    return Boolean(qAns?.selected_option_id);
  };

  const totalAnswered = questions.filter(checkIsQuestionAnswered).length;
  const unansweredCount = questions.length - totalAnswered;

  const statementLetterLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // ----------------------------------------------------------------------------
  // SUBMITTED RESULT VIEW WITH QUESTION-BY-QUESTION REVIEW
  // ----------------------------------------------------------------------------
  if (examResult) {
    const reviewList = examResult.review_questions || [];

    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {/* Result Summary Card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Đã nộp bài & Đã chấm điểm
            </span>
            <h2 className="text-2xl font-bold text-slate-900 pt-2">{session?.title}</h2>
            <p className="text-xs text-slate-500">
              Thí sinh: <strong>{attempt?.student_name}</strong> (Mã HS: {attempt?.student_code})
            </p>
          </div>

          {session?.show_result_after_submit ? (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Điểm số đạt được</span>
                <div className="text-5xl font-black text-indigo-600 tracking-tight mt-1">
                  {examResult.score} <span className="text-2xl text-slate-400 font-normal">/ {examResult.max_score}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Tỷ lệ chính xác: {examResult.percentage}%</p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200/80 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800">
                  <span className="font-bold text-base block">{examResult.correct_count}</span>
                  <span>Câu đúng trọn vẹn</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800">
                  <span className="font-bold text-base block">{examResult.wrong_count}</span>
                  <span>Câu có lỗi sai</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                  <span className="font-bold text-base block">{examResult.unanswered_count}</span>
                  <span>Câu chưa làm</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border text-xs text-slate-600">
              Bài thi của bạn đã được ghi nhận an toàn trên hệ thống. Giáo viên sẽ công bố kết quả sau khi kết thúc kỳ thi.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsRetakeConfirmOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Làm lại bài thi</span>
            </button>

            <button
              onClick={onExit}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay về trang chủ</span>
            </button>
          </div>
        </div>

        {/* Question Review Section (Detailed Answers) */}
        {session?.show_result_after_submit && reviewList.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chi tiết bài làm & Đáp án</h3>
                <p className="text-xs text-slate-500">
                  Theo quy định: Câu bạn đã làm sẽ hiển thị đáp án và lời giải chi tiết. Câu không làm sẽ không hiển thị đáp án.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                {reviewList.length} câu hỏi
              </span>
            </div>

            <div className="space-y-4">
              {reviewList.map((rq, idx) => {
                const isTF = rq.question_type === 'true_false' || Boolean(rq.statements && rq.statements.length > 0);
                const isShortAnswer = rq.question_type === 'short_answer';
                const isEssay = rq.question_type === 'essay';
                const isSingleChoice = !isTF && !isShortAnswer && !isEssay;

                let typeLabel = 'Trắc nghiệm';
                if (isTF) typeLabel = 'Đúng / Sai';
                else if (isShortAnswer) typeLabel = 'Trả lời ngắn';
                else if (isEssay) typeLabel = 'Tự luận';

                return (
                  <div 
                    key={rq.id || idx}
                    className={`bg-white rounded-2xl border p-6 space-y-4 shadow-xs transition-all ${
                      rq.is_answered
                        ? (rq.earned_points && rq.earned_points > 0 ? 'border-emerald-200/90' : 'border-rose-200/90')
                        : 'border-slate-200/90 bg-slate-50/50'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-sm font-bold text-slate-900">
                          Câu {rq.order || idx + 1}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {typeLabel}
                        </span>
                        {rq.is_answered ? (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 ${
                            rq.earned_points && rq.earned_points > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {rq.earned_points && rq.earned_points > 0 ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            <span>Đạt {rq.earned_points || 0} / {rq.points} điểm</span>
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-200 text-slate-700 flex items-center space-x-1">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Không làm bài (0 / {rq.points} điểm)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="text-sm text-slate-800 font-medium leading-relaxed">
                      <MathRenderer text={rq.content} />
                    </div>

                    {/* Content when UNANSWERED: User rule: "câu nào HS không làm thì không hiện đáp án" */}
                    {!rq.is_answered && (
                      <div className="p-4 rounded-xl bg-slate-100/90 border border-slate-200 text-xs text-slate-600 flex items-center space-x-2.5">
                        <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>
                          Bạn đã bỏ trống câu hỏi này. Theo quy chế làm bài, <strong>đáp án và lời giải không hiển thị</strong> cho câu hỏi không thực hiện.
                        </span>
                      </div>
                    )}

                    {/* Content when ANSWERED: */}
                    {rq.is_answered && (
                      <div className="space-y-4">
                        {/* CASE A: TRUE / FALSE WITH STATEMENT-LEVEL SCORING & REVIEW */}
                        {isTF && rq.statements && (
                          <div className="space-y-2.5">
                            <div className="text-xs font-semibold text-slate-700">
                              Chi tiết từng mệnh đề (tính điểm theo ý):
                            </div>
                            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                              {rq.statements.map((st: any, sIdx: number) => {
                                const stLabel = statementLetterLabels[sIdx] || `${sIdx + 1}`;
                                const isStAnswered = st.user_choice !== undefined;
                                const isCorrectChoice = st.is_statement_correct;

                                return (
                                  <div key={st.id || sIdx} className="p-3.5 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-start space-x-2 flex-1 text-xs text-slate-800">
                                        <span className="font-bold text-slate-700 shrink-0">
                                          {stLabel})
                                        </span>
                                        <div className="flex-1">
                                          <MathRenderer text={st.statement} />
                                        </div>
                                      </div>

                                      {/* Student Choice vs Correct Answer */}
                                      <div className="flex items-center space-x-2 shrink-0 text-xs">
                                        {isStAnswered ? (
                                          <>
                                            <span className="text-slate-500">Bạn chọn:</span>
                                            <span className={`px-2 py-0.5 rounded font-bold ${
                                              st.user_choice
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                                            }`}>
                                              {st.user_choice ? 'ĐÚNG' : 'SAI'}
                                            </span>

                                            <span className="text-slate-400">|</span>

                                            <span className="text-slate-500">Đáp án:</span>
                                            <span className={`px-2 py-0.5 rounded font-bold ${
                                              st.is_correct
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-rose-600 text-white'
                                            }`}>
                                              {st.is_correct ? 'ĐÚNG' : 'SAI'}
                                            </span>

                                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                              isCorrectChoice
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                              {isCorrectChoice ? `+${st.earned_points || 0}đ` : '0đ'}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-slate-400 italic">Chưa chọn ý này (Ẩn đáp án)</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Explanation for statement if answered */}
                                    {isStAnswered && st.explanation && (
                                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                                        <strong className="text-slate-700">Giải thích: </strong>
                                        <MathRenderer text={st.explanation} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* CASE B: SHORT ANSWER REVIEW */}
                        {isShortAnswer && (
                          <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-slate-600">Đáp án bạn nhập:</span>
                                <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-300">
                                  {rq.user_answer_text || '(Bỏ trống)'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-slate-600">Đáp án chính xác:</span>
                                <span className="font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-300">
                                  {rq.correct_answer || 'Xem lời giải'}
                                </span>
                              </div>
                            </div>
                            {rq.explanation && (
                              <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                                <strong className="text-slate-900">Lời giải chi tiết: </strong>
                                <MathRenderer text={rq.explanation} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* CASE C: ESSAY REVIEW */}
                        {isEssay && (
                          <div className="space-y-3.5">
                            {rq.sub_items && rq.sub_items.length > 1 ? (
                              /* Multi-Sub-Item Essay Review (1-3 ý) */
                              <div className="space-y-4">
                                <div className="text-xs font-semibold text-slate-700 pb-1 border-b border-slate-100">
                                  Bài làm tự luận & hướng dẫn chấm chi tiết theo từng ý:
                                </div>
                                {(() => {
                                  const studentSubMap = parseEssaySubAnswers(rq.user_answer_text, rq.sub_items);
                                  return rq.sub_items.map((sub: any) => {
                                    const studentAns = studentSubMap[sub.item_number] || '';
                                    return (
                                      <div key={sub.item_number} className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-900 pb-2 border-b border-slate-200/60">
                                          <span>Ý {sub.item_number}: {sub.points} điểm</span>
                                          {sub.cognitive_level && (
                                            <span className="text-[10px] font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                                              {sub.cognitive_level === 'recognition' ? 'Nhận biết' :
                                               sub.cognitive_level === 'comprehension' ? 'Thông hiểu' :
                                               sub.cognitive_level === 'application' ? 'Vận dụng' : 'Vận dụng cao'}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-800">
                                          <MathRenderer text={sub.question_text} />
                                        </div>
                                        {/* Student Answer */}
                                        <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs">
                                          <div className="font-semibold text-slate-600 mb-1 flex items-center space-x-1">
                                            <PenLine className="w-3 h-3 text-indigo-600" />
                                            <span>Bài làm của thí sinh:</span>
                                          </div>
                                          <div className="text-slate-900 whitespace-pre-wrap">
                                            {studentAns ? studentAns : <span className="italic text-slate-400">(Chưa nhập nội dung bài làm cho ý này)</span>}
                                          </div>
                                        </div>
                                        {/* Expected Answer */}
                                        {sub.expected_answer && (
                                          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                                            <div className="font-bold text-emerald-900">→ Đáp án mong đợi:</div>
                                            <div className="text-emerald-800">
                                              <MathRenderer text={sub.expected_answer} />
                                            </div>
                                          </div>
                                        )}
                                        {/* Rubric */}
                                        {sub.scoring_rubric && sub.scoring_rubric.length > 0 && (
                                          <div className="space-y-1 text-xs">
                                            <div className="font-semibold text-slate-700">Biểu điểm chấm:</div>
                                            <table className="w-full text-[11px] border border-slate-200 rounded-lg overflow-hidden bg-white">
                                              <thead className="bg-slate-100 text-slate-700">
                                                <tr>
                                                  <th className="p-1.5 text-left border-b border-slate-200">Tiêu chí</th>
                                                  <th className="p-1.5 text-center w-16 border-b border-slate-200">Điểm</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {sub.scoring_rubric.map((r: any, rIdx: number) => (
                                                  <tr key={rIdx} className="border-b border-slate-100 last:border-b-0">
                                                    <td className="p-1.5 text-slate-700">{r.criterion}</td>
                                                    <td className="p-1.5 text-center font-bold text-indigo-600">+{r.points}đ</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            ) : (
                              /* Standard Single Essay Review */
                              <div className="space-y-3.5">
                                {/* Student submitted essay */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                    <span className="flex items-center space-x-1.5">
                                      <PenLine className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Bài làm tự luận của thí sinh:</span>
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-normal">
                                      {rq.user_answer_text ? `${rq.user_answer_text.trim().split(/\s+/).filter(Boolean).length} từ (${rq.user_answer_text.length} ký tự)` : '0 từ'}
                                    </span>
                                  </div>
                                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 whitespace-pre-wrap font-sans leading-relaxed min-h-[80px]">
                                    {rq.user_answer_text || '(Chưa nhập nội dung bài làm)'}
                                  </div>
                                </div>

                                {/* Teacher Marking Scheme / Rubric / Solution */}
                                {rq.explanation && (
                                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs space-y-2">
                                    <div className="font-bold text-indigo-950 flex items-center space-x-1.5">
                                      <FileText className="w-4 h-4 text-indigo-700" />
                                      <span>Hướng dẫn chấm thi & Lời giải tham khảo:</span>
                                    </div>
                                    <div className="text-slate-800 leading-relaxed bg-white p-3.5 rounded-lg border border-indigo-100">
                                      <MathRenderer text={rq.explanation} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* CASE D: SINGLE CHOICE REVIEW */}
                        {isSingleChoice && rq.options && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {rq.options.map((opt: any, oIdx: number) => {
                                const isUserSelected = rq.user_selected_option_id === opt.id;
                                const isCorrectOpt = Boolean(opt.is_correct) || rq.correct_option_id === opt.id;

                                let optBorder = 'border-slate-200 bg-slate-50 text-slate-700';
                                if (isCorrectOpt) {
                                  optBorder = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500';
                                } else if (isUserSelected && !isCorrectOpt) {
                                  optBorder = 'border-rose-400 bg-rose-50 text-rose-950 line-through';
                                }

                                return (
                                  <div
                                    key={opt.id}
                                    className={`p-3 rounded-xl border flex items-center space-x-2.5 ${optBorder}`}
                                  >
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] bg-white border border-slate-300 text-slate-700 shrink-0">
                                      {String.fromCharCode(65 + oIdx)}
                                    </span>
                                    <div className="flex-1">
                                      <MathRenderer text={opt.content} />
                                    </div>
                                    {isCorrectOpt && (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold shrink-0">
                                        Đáp án đúng
                                      </span>
                                    )}
                                    {isUserSelected && !isCorrectOpt && (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold shrink-0">
                                        Bạn chọn
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* General explanation if single choice */}
                        {isSingleChoice && rq.explanation && (
                          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 space-y-1">
                            <div className="font-bold flex items-center space-x-1.5 text-indigo-800">
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Lời giải chi tiết:</span>
                            </div>
                            <div className="leading-relaxed text-slate-800 pl-5">
                              <MathRenderer text={rq.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // ACTIVE EXAM TAKING INTERFACE
  // ----------------------------------------------------------------------------
  const isCurrentTF = currentQ?.question_type === 'true_false' || Boolean(currentQ?.statements && currentQ.statements.length > 0);
  const isCurrentShortAnswer = currentQ?.question_type === 'short_answer';
  const isCurrentEssay = currentQ?.question_type === 'essay';
  const currentStatements = currentQ?.statements || [];

  let currentPartTitle = 'Phần I: Câu trắc nghiệm nhiều phương án';
  if (isCurrentTF) currentPartTitle = 'Phần II: Câu hỏi Đúng / Sai';
  else if (isCurrentShortAnswer) currentPartTitle = 'Phần III: Câu hỏi trả lời ngắn';
  else if (isCurrentEssay) currentPartTitle = 'Phần Tự luận: Thí sinh tự trình bày bài làm';

  return (
    <div className="min-h-screen bg-slate-100/70 pb-12">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 text-xs font-bold bg-indigo-600 text-white rounded-lg">
              {session?.access_code}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 line-clamp-1">{session?.title}</h2>
              <p className="text-[11px] text-slate-500">
                Thí sinh: {attempt?.student_name} ({attempt?.student_code})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Auto-save status */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs">
              {saveStatus === 'saved' && (
                <span className="text-emerald-700 flex items-center space-x-1 font-medium bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã lưu</span>
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="text-amber-700 flex items-center space-x-1 font-medium bg-amber-50 px-2 py-1 rounded-md border border-amber-200 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </span>
              )}
            </div>

            {/* Countdown Timer & End Deadline */}
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border ${
              isTimeCritical
                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}>
              <Clock className="w-4 h-4 shrink-0" />
              <span>{timeFormatted}</span>
              {session?.end_at && (
                <span className="hidden sm:inline-block text-[11px] font-sans font-normal text-slate-500 border-l border-slate-300 pl-2">
                  Đóng đề: {new Date(session.end_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(session.end_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Examination Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question Card (Left / Center) */}
          <div className="lg:col-span-8 space-y-4">
            {currentQ ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-6">
                {/* Question Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900">
                      Câu hỏi {currentIndex + 1} / {questions.length}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {currentPartTitle}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({currentQ.points} điểm)
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleFlag(currentQ.id)}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      flagged[currentQ.id]
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${flagged[currentQ.id] ? 'fill-amber-600 text-amber-600' : ''}`} />
                    <span>{flagged[currentQ.id] ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}</span>
                  </button>
                </div>

                {/* Question Prompt Content */}
                <div className="text-base text-slate-900 font-medium leading-relaxed min-h-[50px]">
                  <MathRenderer text={currentQ.content} />
                </div>

                {/* --- RENDER QUESTION BODY: TRUE/FALSE vs SHORT ANSWER vs ESSAY vs SINGLE CHOICE --- */}
                {isCurrentTF ? (
                  /* =========================================================================
                     PHẦN II: CÂU HỎI ĐÚNG / SAI (HS CHỌN ĐÚNG HOẶC SAI, KHÔNG HIỆN ĐÁP ÁN)
                     ========================================================================= */
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium pb-1 border-b border-slate-100">
                      <span>Trong mỗi ý a), b), c), d) ở câu này, thí sinh chọn Đúng hoặc Sai:</span>
                      <span className="text-indigo-600 font-semibold">
                        Đã chọn: {Object.keys(answers[currentQ.id]?.statement_answers || {}).length} / {currentStatements.length} ý
                      </span>
                    </div>

                    <div className="border border-slate-200/90 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-2xs">
                      {currentStatements.map((st, sIdx) => {
                        const stId = st.id || `st-${sIdx + 1}`;
                        const label = statementLetterLabels[sIdx] || `${sIdx + 1}`;
                        const userChoice = answers[currentQ.id]?.statement_answers?.[stId];

                        return (
                          <div 
                            key={stId}
                            className="p-4 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            {/* Statement text */}
                            <div className="flex items-start space-x-3 flex-1">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                                {label}
                              </span>
                              <div className="text-sm text-slate-800 leading-normal pt-0.5">
                                <MathRenderer text={st.statement} />
                              </div>
                            </div>

                            {/* True / False Interactive Choice Buttons (NO ANSWER REVEALED) */}
                            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                              {/* Option ĐÚNG */}
                              <button
                                type="button"
                                onClick={() => handleSelectStatementChoice(currentQ.id, stId, true)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                                  userChoice === true
                                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs ring-2 ring-emerald-500 ring-offset-1'
                                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                                }`}
                              >
                                <Check className={`w-3.5 h-3.5 ${userChoice === true ? 'stroke-[3]' : ''}`} />
                                <span>Đúng</span>
                              </button>

                              {/* Option SAI */}
                              <button
                                type="button"
                                onClick={() => handleSelectStatementChoice(currentQ.id, stId, false)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                                  userChoice === false
                                    ? 'bg-rose-600 border-rose-700 text-white shadow-xs ring-2 ring-rose-500 ring-offset-1'
                                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                                }`}
                              >
                                <X className={`w-3.5 h-3.5 ${userChoice === false ? 'stroke-[3]' : ''}`} />
                                <span>Sai</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : isCurrentShortAnswer ? (
                  /* =========================================================================
                     PHẦN III: TRẢ LỜI NGẮN (HS TỰ NHẬP KẾT QUẢ, KHÔNG HIỆN ĐÁP ÁN SẴN)
                     ========================================================================= */
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 pb-1 border-b border-slate-100">
                      <span className="font-medium">Nhập câu trả lời hoặc giá trị số theo yêu cầu bài toán:</span>
                      <span className="text-[11px] text-indigo-600 font-semibold">Tự động lưu bài làm</span>
                    </div>

                    {/* Math symbol quick insert toolbar */}
                    <div className="flex items-center flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <span className="text-[11px] text-slate-500 font-semibold mr-1 flex items-center gap-1 shrink-0">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        Ký hiệu nhanh:
                      </span>
                      {MATH_SYMBOLS.slice(0, 14).map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => handleInsertSymbol(currentQ.id, sym)}
                          className="px-2 py-0.5 text-xs font-mono font-bold bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 rounded text-slate-700 transition-all cursor-pointer shadow-2xs"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={answers[currentQ.id]?.answer_text || ''}
                        onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                        placeholder="Nhập kết quả (ví dụ: 12.5 hoặc 20√3)..."
                        className="w-full px-4 py-3 text-sm font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>* Thí sinh tự tính toán và nhập kết quả. Không có đáp án gợi ý sẵn.</span>
                      <span className={`font-semibold px-2 py-0.5 rounded ${
                        answers[currentQ.id]?.answer_text?.trim()
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {answers[currentQ.id]?.answer_text?.trim() ? 'Đã nhập câu trả lời' : 'Chưa nhập kết quả'}
                      </span>
                    </div>
                  </div>
                ) : isCurrentEssay ? (
                  /* =========================================================================
                     PHẦN TỰ LUẬN: THÍ SINH TỰ NHẬP BÀI LÀM (KHÔNG HIỆN ĐÁP ÁN SẴN)
                     Hỗ trợ linh hoạt cấu trúc 1–3 ý hoặc tự luận đơn
                     ========================================================================= */
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 pb-1 border-b border-slate-100">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-700">
                        <PenLine className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Trình bày bài giải / lập luận tự luận chi tiết:</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                        Tự động lưu khi gõ
                      </span>
                    </div>

                    {currentQ.sub_items && currentQ.sub_items.length > 1 ? (
                      /* Multi-sub-item Essay (1-3 ý) */
                      <div className="space-y-3">
                        {/* Sub-item Selector Tabs */}
                        <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
                          {currentQ.sub_items.map((sub: any, sIdx: number) => {
                            const subMap = parseEssaySubAnswers(answers[currentQ.id]?.answer_text, currentQ.sub_items);
                            const hasText = Boolean(subMap[sub.item_number]?.trim());
                            const isActive = activeEssaySubIndex === sIdx;
                            return (
                              <button
                                key={sub.item_number || sIdx}
                                type="button"
                                onClick={() => setActiveEssaySubIndex(sIdx)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                                  isActive
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : hasText
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                <span>Ý {sub.item_number} ({sub.points}đ)</span>
                                {hasText && <Check className="w-3 h-3 text-emerald-600" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Active Sub-item prompt context */}
                        {currentQ.sub_items[activeEssaySubIndex] && (
                          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-indigo-950 flex items-center justify-between">
                              <span>Yêu cầu ý {currentQ.sub_items[activeEssaySubIndex].item_number} ({currentQ.sub_items[activeEssaySubIndex].points} điểm):</span>
                              {currentQ.sub_items[activeEssaySubIndex].cognitive_level && (
                                <span className="text-[10px] font-normal text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                                  {currentQ.sub_items[activeEssaySubIndex].cognitive_level === 'recognition' ? 'Nhận biết' :
                                   currentQ.sub_items[activeEssaySubIndex].cognitive_level === 'comprehension' ? 'Thông hiểu' :
                                   currentQ.sub_items[activeEssaySubIndex].cognitive_level === 'application' ? 'Vận dụng' : 'Vận dụng cao'}
                                </span>
                              )}
                            </div>
                            <div className="text-slate-800">
                              <MathRenderer text={currentQ.sub_items[activeEssaySubIndex].question_text} />
                            </div>
                          </div>
                        )}

                        {/* Math & Scientific Symbol Inserter */}
                        <div className="flex items-center flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[11px] text-slate-500 font-semibold mr-1 flex items-center gap-1 shrink-0">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            Chèn ký hiệu toán học:
                          </span>
                          {MATH_SYMBOLS.map((sym) => (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => handleInsertSymbol(currentQ.id, sym)}
                              className="px-2 py-1 text-xs font-mono font-bold bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-lg text-slate-700 transition-all cursor-pointer shadow-2xs"
                              title={`Chèn ${sym}`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>

                        {/* Textarea for active sub-item */}
                        {(() => {
                          const activeSub = currentQ.sub_items[activeEssaySubIndex] || currentQ.sub_items[0];
                          const subKey = activeSub.item_number;
                          const subMap = parseEssaySubAnswers(answers[currentQ.id]?.answer_text, currentQ.sub_items);
                          const activeText = subMap[subKey] || '';
                          const wordCount = activeText.trim().split(/\s+/).filter(Boolean).length;
                          return (
                            <div className="space-y-2">
                              <textarea
                                ref={essayTextareaRef}
                                rows={8}
                                value={activeText}
                                onChange={(e) => handleSubAnswerChange(currentQ.id, subKey, e.target.value)}
                                placeholder={`Nhập bài làm cho Ý ${subKey} tại đây... (Thí sinh tự trình bày lập luận, không hiển thị đáp án trước khi nộp bài)`}
                                className="w-full p-4 text-sm font-sans leading-relaxed rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs resize-y"
                              />
                              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                                <span className="text-[11px] italic text-slate-400">
                                  * Bài làm tự luận hoàn toàn do thí sinh tự nhập, đáp án mẫu và biểu điểm chỉ hiển thị sau khi nộp bài.
                                </span>
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                                  Ý {subKey}: {wordCount} từ | {activeText.length} ký tự
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Single Essay Question (1 ý hoặc chuẩn) */
                      <div className="space-y-4">
                        {/* Math & Scientific Symbol Inserter */}
                        <div className="flex items-center flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[11px] text-slate-500 font-semibold mr-1 flex items-center gap-1 shrink-0">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            Chèn ký hiệu toán học:
                          </span>
                          {MATH_SYMBOLS.map((sym) => (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => handleInsertSymbol(currentQ.id, sym)}
                              className="px-2 py-1 text-xs font-mono font-bold bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-lg text-slate-700 transition-all cursor-pointer shadow-2xs"
                              title={`Chèn ${sym}`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>

                        {/* Main Writing Area: Student Types Answer Freely */}
                        <div className="relative">
                          <textarea
                            ref={essayTextareaRef}
                            rows={11}
                            value={answers[currentQ.id]?.answer_text || ''}
                            onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                            placeholder="Nhập lời giải / bài làm tự luận chi tiết của bạn tại đây... (Thí sinh tự trình bày các bước giải, đặt ẩn số, lập luận công thức và kết luận)"
                            className="w-full p-4 text-sm font-sans leading-relaxed rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs resize-y"
                          />
                        </div>

                        {/* Word & Character Counter */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <span className="text-[11px] italic text-slate-400">
                            * Bài làm tự luận hoàn toàn do thí sinh tự nhập, đáp án mẫu và biểu điểm chỉ hiển thị sau khi nộp bài.
                          </span>
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                            Đã viết: {answers[currentQ.id]?.answer_text ? answers[currentQ.id]!.answer_text!.trim().split(/\s+/).filter(Boolean).length : 0} từ | {answers[currentQ.id]?.answer_text?.length || 0} ký tự
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* =========================================================================
                     PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN (CHỌN 1 TRONG 4, KHÔNG HIỆN ĐÁP ÁN)
                     ========================================================================= */
                  <div className="space-y-3 pt-2">
                    {currentQ.options?.map((opt, oIdx) => {
                      const isSelected = answers[currentQ.id]?.selected_option_id === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(currentQ.id, opt.id)}
                          className={`p-4 rounded-xl border text-sm flex items-center space-x-3.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600'
                              : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/70 text-slate-800'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </div>
                          <div className="flex-1 leading-normal">
                            <MathRenderer text={opt.content} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Previous / Next Nav buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Câu trước</span>
                  </button>

                  <button
                    disabled={currentIndex === questions.length - 1}
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Câu tiếp theo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Sidebar: Palette of Question Numbers */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Danh sách câu hỏi</h3>

              {/* Status legend */}
              <div className="flex items-center space-x-4 text-[11px] text-slate-500 pb-2 border-b border-slate-100">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-md bg-emerald-600" />
                  <span>Đã làm ({totalAnswered})</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-md bg-amber-400" />
                  <span>Xem lại</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300" />
                  <span>Chưa làm ({unansweredCount})</span>
                </span>
              </div>

              {/* Number Grid */}
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = checkIsQuestionAnswered(q);
                  const isFlagged = Boolean(flagged[q.id]);
                  const isCurrent = currentIndex === idx;

                  let colorClass = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
                  if (isAnswered) {
                    colorClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                  }
                  if (isFlagged) {
                    colorClass = 'bg-amber-400 text-slate-950 border-amber-500 font-bold';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-xl text-xs flex items-center justify-center border transition-all cursor-pointer ${colorClass} ${
                        isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Submission Box */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => setIsSubmitModalOpen(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Hoàn thành & Nộp bài</span>
                </button>
                <p className="text-[11px] text-center text-slate-400">
                  Hệ thống tự động lưu trữ từng thao tác làm bài.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác nhận nộp bài thi</h3>
                <p className="text-xs text-slate-500">Bạn sẽ không thể chỉnh sửa sau khi nộp</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Tổng số câu:</span>
                <span className="font-bold text-slate-900">{questions.length} câu</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Đã trả lời:</span>
                <span className="font-bold text-emerald-600">{totalAnswered} câu</span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Còn lại chưa trả lời:</span>
                  <span>{unansweredCount} câu</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={doFinalSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center space-x-1 cursor-pointer"
              >
                {submitting ? <span>Đang chấm bài...</span> : <span>Xác nhận Nộp bài</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retake Confirmation Modal */}
      {isRetakeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác nhận làm lại bài thi</h3>
                <p className="text-xs text-slate-500">Khởi tạo lượt thi mới để rèn luyện lại</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-600 leading-relaxed">
              <p>
                Bạn chuẩn bị bắt đầu <strong>lượt thi mới</strong> cho đề thi <strong>{session?.title}</strong>.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Thời gian làm bài sẽ được tính lại từ đầu: <strong>{session?.duration_minutes} phút</strong>.</li>
                <li>Toàn bộ lựa chọn đáp án sẽ được xóa sạch để làm lại.</li>
                <li>Kết quả lần thi trước đã được ghi nhận an toàn trên hệ thống.</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isRetaking}
                onClick={() => setIsRetakeConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isRetaking}
                onClick={handleRetakeExam}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                {isRetaking ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang khởi tạo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Bắt đầu làm lại</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

