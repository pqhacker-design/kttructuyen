import React, { useEffect, useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Clock, 
  Award, 
  CheckCircle2, 
  Radio, 
  ArrowRight, 
  X, 
  Layers,
  HelpCircle,
  Eye,
  Printer,
  Sparkles,
  BookOpen,
  Calendar,
  Download,
  CheckSquare,
  PenTool,
  Filter
} from 'lucide-react';
import { Exam, Question, Subject, Matrix, ExamStatus, Profile } from '../types';
import { fetchExams, createExam, deleteExam, updateExamStatus, getExamById } from '../services/examService';
import { fetchQuestions, fetchSubjects } from '../services/questionService';
import { fetchMatrices } from '../services/matrixService';
import { ConfirmDialog } from './ConfirmDialog';
import { MathRenderer } from './MathRenderer';
import { ExportModal } from './ExportModal';

interface ExamManagementViewProps {
  currentProfile: Profile | null;
  onOpenAuth: () => void;
  onCreateSessionFromExam: (exam: Exam) => void;
  onNavigateToAI?: () => void;
}

export const ExamManagementView: React.FC<ExamManagementViewProps> = ({
  currentProfile,
  onOpenAuth,
  onCreateSessionFromExam,
  onNavigateToAI,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [detailedExam, setDetailedExam] = useState<Exam | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Find linked matrix for previewExam
  const matchedMatrix = useMemo(() => {
    if (!previewExam) return null;
    let m = matrices.find(
      (item) =>
        (previewExam.matrix_id && item.id === previewExam.matrix_id) ||
        (item.exam_id && item.exam_id === previewExam.id)
    );
    if (!m && previewExam.title) {
      const cleanExamTitle = previewExam.title
        .replace(/^Đề thi (định kỳ )?/i, '')
        .trim()
        .toLowerCase();
      m = matrices.find((item) => {
        const cleanMName = item.name
          .replace(/^Ma trận & Bảng đặc tả - /i, '')
          .trim()
          .toLowerCase();
        return (
          cleanExamTitle.includes(cleanMName) ||
          cleanMName.includes(cleanExamTitle)
        );
      });
    }
    return m || null;
  }, [previewExam, matrices]);

  // Helper to normalize questions for ExportModal
  const getExportQuestions = (): any[] => {
    if (!detailedExam?.questions) return [];
    return detailedExam.questions.map((item: any, idx: number) => {
      const q = item.question || item;
      const rawType = String(q.question_type || '').toLowerCase();
      const isMC = rawType === 'single_choice' || rawType === 'multiple_choice' || rawType.includes('choice');
      const isTF = rawType === 'true_false' || rawType.includes('dung_sai') || rawType.includes('đúng sai');
      const isSA = rawType === 'short_answer' || rawType.includes('ngan') || rawType.includes('ngắn');
      const isEssay = rawType === 'essay' || rawType.includes('tu_luan') || rawType.includes('tự luận');

      let calculatedPart = q.exam_part;
      if (!calculatedPart) {
        if (isMC) calculatedPart = 1;
        else if (isTF) calculatedPart = 2;
        else if (isSA) calculatedPart = 3;
        else if (isEssay) calculatedPart = 4;
        else calculatedPart = 1;
      }

      return {
        id: q.id || `q-${idx + 1}`,
        question_order: item.question_order || q.question_order || idx + 1,
        exam_part: calculatedPart,
        part_title: q.part_title,
        question_type: q.question_type || (isMC ? 'single_choice' : isTF ? 'true_false' : isSA ? 'short_answer' : 'essay'),
        cognitive_level: q.cognitive_level || 'recognition',
        topic: q.topic || (matchedMatrix ? matchedMatrix.name : ''),
        content_unit: q.content_unit || q.subtopic || '',
        learning_requirement: q.learning_requirement || '',
        content: q.content || '',
        points: item.points !== undefined ? item.points : (q.points || (calculatedPart === 1 ? 0.25 : calculatedPart === 2 ? 1.0 : calculatedPart === 3 ? 0.5 : 1.5)),
        options: q.options || [],
        statements: (q.statements && q.statements.length > 0)
          ? q.statements
          : ((isTF || calculatedPart === 2) && q.options)
            ? q.options.map((opt: any, sIdx: number) => ({
                id: opt.id || `st-${sIdx}`,
                statement: opt.content || opt.statement || opt.text || '',
                is_correct: Boolean(opt.is_correct || opt.correct),
                explanation: opt.explanation || '',
              }))
            : undefined,
        short_answer: q.short_answer,
        essay_rubric: q.essay_rubric,
        explanation: q.explanation || '',
      };
    });
  };

  // Create Form State
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [matrixId, setMatrixId] = useState<string>('');
  const [grade, setGrade] = useState(10);
  const [duration, setDuration] = useState(45);
  const [totalPoints, setTotalPoints] = useState(10.0);
  const [description, setDescription] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [createFormat, setCreateFormat] = useState<'hybrid' | 'multiple_choice_only' | 'essay_only'>('hybrid');

  // List filter state
  const [examFormatFilter, setExamFormatFilter] = useState<'all' | 'hybrid' | 'multiple_choice_only' | 'essay_only'>('all');

  const getExamFormat = (exam: Exam): 'hybrid' | 'multiple_choice_only' | 'essay_only' => {
    const desc = (exam.description || '').toLowerCase();
    const t = (exam.title || '').toLowerCase();
    if (desc.includes('100% trắc nghiệm') || t.includes('100% trắc nghiệm') || (desc.includes('trắc nghiệm') && !desc.includes('tự luận'))) {
      return 'multiple_choice_only';
    }
    if (desc.includes('100% tự luận') || t.includes('100% tự luận') || (desc.includes('tự luận') && !desc.includes('trắc nghiệm'))) {
      return 'essay_only';
    }
    return 'hybrid';
  };

  useEffect(() => {
    loadData();
  }, [currentProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exList, qList, sList, mList] = await Promise.all([
        fetchExams(currentProfile?.user_id),
        fetchQuestions(undefined, currentProfile?.user_id),
        fetchSubjects(),
        fetchMatrices(currentProfile?.user_id),
      ]);
      setExams(exList);
      setQuestions(qList);
      setSubjects(sList);
      setMatrices(mList);
      if (sList.length > 0) setSubjectId(sList[0].id);
    } catch (err) {
      console.error('Error loading exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (exam: Exam) => {
    setPreviewExam(exam);
    setDetailedExam(exam);
    setLoadingDetail(true);
    try {
      const full = await getExamById(exam.id);
      if (full) {
        setDetailedExam(full);
      }
    } catch (e) {
      console.warn('Error fetching exam detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggleQuestion = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    if (selectedQuestionIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 câu hỏi cho đề thi.');
      return;
    }

    try {
      const pointsPerQuestion = Number((totalPoints / selectedQuestionIds.length).toFixed(2));
      const questionItems = selectedQuestionIds.map((qId, idx) => ({
        question_id: qId,
        question_order: idx + 1,
        points: pointsPerQuestion,
      }));

      const formatPrefix = createFormat === 'multiple_choice_only'
        ? '[100% Trắc nghiệm]'
        : createFormat === 'essay_only'
        ? '[100% Tự luận]'
        : '[Trắc nghiệm + Tự luận]';
      const formattedDescription = description.trim()
        ? `${formatPrefix} ${description.trim()}`
        : `${formatPrefix} Đề thi biên soạn theo định dạng chuẩn GDPT 2018.`;

      await createExam(
        {
          owner_id: currentProfile.user_id,
          subject_id: subjectId,
          matrix_id: matrixId || null,
          title: title.trim(),
          description: formattedDescription,
          grade,
          duration_minutes: duration,
          total_points: totalPoints,
          status: 'published',
        },
        questionItems
      );

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      setSelectedQuestionIds([]);
      setCreateFormat('hybrid');
      await loadData();
    } catch (err: any) {
      alert('Lỗi tạo đề thi: ' + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExam(examToDelete.id);
      setExams(exams.filter((e) => e.id !== examToDelete.id));
      if (previewExam?.id === examToDelete.id) {
        setPreviewExam(null);
        setDetailedExam(null);
      }
      setExamToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa đề thi: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quản lý Đề thi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Soạn đề từ ngân hàng câu hỏi, thiết lập thời gian làm bài và điểm số
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {onNavigateToAI && (
            <button
              onClick={onNavigateToAI}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-xs transition-all flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Tạo đề bằng AI (CV 7991)</span>
            </button>
          )}

          <button
            onClick={() => {
              if (!currentProfile) {
                onOpenAuth();
                return;
              }
              if (questions.length === 0) {
                alert('Ngân hàng chưa có câu hỏi nào. Vui lòng thêm câu hỏi trước hoặc sử dụng Tạo đề bằng AI.');
                return;
              }
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Soạn đề thủ công</span>
          </button>
        </div>
      </div>

      {/* Format Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 mr-1">
          <Filter className="w-3.5 h-3.5 text-indigo-500" />
          <span>Lọc dạng đề:</span>
        </div>
        {[
          { id: 'all', label: `Tất cả (${exams.length})` },
          { id: 'hybrid', label: 'Trắc nghiệm + Tự luận' },
          { id: 'multiple_choice_only', label: '100% Trắc nghiệm' },
          { id: 'essay_only', label: '100% Tự luận' },
        ].map((f) => {
          const isActive = examFormatFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setExamFormatFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Exam List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400">Đang tải danh sách đề thi...</div>
        ) : exams.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-800 text-base">Chưa có đề thi nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tạo đề thi từ ngân hàng câu hỏi để mở kỳ thi trực tuyến cho học sinh làm bài.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              Soạn đề thi đầu tiên
            </button>
          </div>
        ) : (
          exams
            .filter((exam) => examFormatFilter === 'all' || getExamFormat(exam) === examFormatFilter)
            .map((exam) => {
              const format = getExamFormat(exam);
              return (
                <div
                  key={exam.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {exam.subject_name} • Khối {exam.grade}
                        </span>
                        {format === 'multiple_choice_only' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                            <CheckSquare className="w-3 h-3" />
                            <span>100% TN</span>
                          </span>
                        )}
                        {format === 'essay_only' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center space-x-1">
                            <PenTool className="w-3 h-3" />
                            <span>100% TL</span>
                          </span>
                        )}
                        {format === 'hybrid' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                            <Layers className="w-3 h-3" />
                            <span>TN + TL</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          {exam.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                        </span>
                        <button
                          onClick={() => setExamToDelete(exam)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Xóa đề"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-snug">{exam.title}</h3>
                    {exam.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{exam.description}</p>
                    )}

                    <div className="flex items-center space-x-3 text-xs text-slate-600 pt-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.duration_minutes} phút</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.question_count || 0} câu</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Award className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.total_points} điểm</span>
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => onCreateSessionFromExam(exam)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center space-x-1"
                    >
                      <Radio className="w-3 h-3" />
                      <span>Mở phòng thi</span>
                    </button>

                    <button
                      onClick={() => handleOpenDetail(exam)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center space-x-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem chi tiết</span>
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Modal: Create Exam */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">Soạn Đề thi Mới từ Ngân hàng</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiêu đề Đề thi
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Kiểm tra Giữa học kỳ I - Môn Toán 10"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Môn học
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (Khối {s.grade})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thời lượng (phút)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    required
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 45)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thang điểm tổng
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="100"
                    required
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(parseFloat(e.target.value) || 10.0)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ma trận liên kết (tùy chọn)
                  </label>
                  <select
                    value={matrixId}
                    onChange={(e) => setMatrixId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">-- Không liên kết --</option>
                    {matrices.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dạng đề kiểm tra */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dạng đề kiểm tra *</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {createFormat === 'hybrid' ? 'Hỗn hợp TN + Tự luận' : createFormat === 'multiple_choice_only' ? 'Chỉ Trắc nghiệm 100%' : 'Chỉ Tự luận 100%'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateFormat('hybrid');
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      createFormat === 'hybrid'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold ring-1 ring-indigo-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-bold">Trắc nghiệm + Tự luận</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Chuẩn CV 7991 (Phần I, II, III & IV)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreateFormat('multiple_choice_only');
                      setSelectedQuestionIds((prev) => 
                        prev.filter((id) => {
                          const q = questions.find((item) => item.id === id);
                          return q && q.question_type !== 'essay';
                        })
                      );
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      createFormat === 'multiple_choice_only'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-bold">100% Trắc nghiệm</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Gồm Phần I, II, III (Không tự luận)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreateFormat('essay_only');
                      setSelectedQuestionIds((prev) => 
                        prev.filter((id) => {
                          const q = questions.find((item) => item.id === id);
                          return q && q.question_type === 'essay';
                        })
                      );
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      createFormat === 'essay_only'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold ring-1 ring-purple-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <PenTool className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-xs font-bold">100% Tự luận</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Chỉ gồm các câu tự luận có rubric</p>
                  </button>
                </div>
              </div>

              {/* Question Selection List */}
              {(() => {
                const availableQuestions = questions.filter((q) => {
                  if (createFormat === 'multiple_choice_only') return q.question_type !== 'essay';
                  if (createFormat === 'essay_only') return q.question_type === 'essay';
                  return true;
                });

                return (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        Chọn câu hỏi từ Ngân hàng (Đã chọn: <strong>{selectedQuestionIds.length}</strong> / {availableQuestions.length} câu)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedQuestionIds.length === availableQuestions.length) {
                            setSelectedQuestionIds([]);
                          } else {
                            setSelectedQuestionIds(availableQuestions.map((q) => q.id));
                          }
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        {selectedQuestionIds.length === availableQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả câu phù hợp'}
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {availableQuestions.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          Chưa có câu hỏi nào phù hợp với định dạng đã chọn trong ngân hàng.
                        </div>
                      ) : (
                        availableQuestions.map((q) => {
                          const isSelected = selectedQuestionIds.includes(q.id);
                          return (
                            <div
                              key={q.id}
                              onClick={() => handleToggleQuestion(q.id)}
                              className={`p-3 flex items-start space-x-3 cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex-1 text-xs space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    q.question_type === 'essay' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {q.question_type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}
                                  </span>
                                  <span className="font-semibold text-slate-800 capitalize">
                                    {q.cognitive_level}
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500">
                                    {q.points} điểm
                                  </span>
                                </div>
                                <p className="text-slate-700 line-clamp-2">{q.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Xuất bản đề thi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Exam Detail */}
      {previewExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      {previewExam.subject_name || 'Môn học'} • Khối {previewExam.grade}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {previewExam.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1 leading-snug">
                    {previewExam.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
                  title="Xuất đề thi ra file Word (.docx) chuẩn Word Equation hoặc file PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Word / PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs font-semibold flex items-center space-x-1"
                  title="In đề thi"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">In đề</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewExam(null);
                    setDetailedExam(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Meta Bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center space-x-1.5 font-medium">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Thời lượng: <strong>{previewExam.duration_minutes} phút</strong></span>
                </span>
                <span className="flex items-center space-x-1.5 font-medium">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>Tổng điểm: <strong>{previewExam.total_points} điểm</strong></span>
                </span>
                <span className="flex items-center space-x-1.5 font-medium">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <span>Số câu: <strong>{detailedExam?.questions?.length || previewExam.question_count || 0} câu</strong></span>
                </span>
                {previewExam.created_at && (
                  <span className="flex items-center space-x-1.5 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Ngày tạo: {new Date(previewExam.created_at).toLocaleDateString('vi-VN')}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Question Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {previewExam.description && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                  <span className="font-bold">Mô tả đề thi: </span>
                  {previewExam.description}
                </div>
              )}

              {loadingDetail ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Đang tải nội dung chi tiết các câu hỏi...</p>
                </div>
              ) : !detailedExam?.questions || detailedExam.questions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold">Đề thi chưa liên kết câu hỏi chi tiết</p>
                  <p className="text-xs text-slate-400">
                    Bạn có thể mở phòng thi trực tiếp hoặc liên kết câu hỏi từ Ngân hàng câu hỏi.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Danh sách câu hỏi trong đề ({detailedExam.questions.length} câu)
                  </h4>
                  {detailedExam.questions.map((item, idx) => {
                    const q: any = item.question || item;
                    const cognitiveLabels: Record<string, { label: string; cls: string }> = {
                      recognition: { label: 'Nhận biết', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                      comprehension: { label: 'Thông hiểu', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      application: { label: 'Vận dụng', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                      advanced_application: { label: 'Vận dụng cao', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
                    };
                    const cog = cognitiveLabels[q.cognitive_level] || { label: q.cognitive_level || 'Chung', cls: 'bg-slate-50 text-slate-700 border-slate-200' };

                    return (
                      <div
                        key={item.id || idx}
                        className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-xs text-indigo-700">Câu {idx + 1}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${cog.cls}`}>
                              {cog.label}
                            </span>
                            {q.question_type && (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white border border-slate-200 text-slate-600">
                                {q.question_type === 'single_choice' ? 'Trắc nghiệm đơn' :
                                 q.question_type === 'multiple_choice' ? 'Nhiều lựa chọn' :
                                 q.question_type === 'true_false' ? 'Đúng / Sai' :
                                 q.question_type === 'short_answer' ? 'Điền ngắn' :
                                 q.question_type === 'essay' ? 'Tự luận' : q.question_type}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {item.points || q.points || 1} điểm
                          </span>
                        </div>

                        <div className="text-xs sm:text-sm font-medium text-slate-900 leading-relaxed">
                          <MathRenderer text={q.content} />
                        </div>

                        {/* Options */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt: any, oIdx: number) => (
                              <div
                                key={opt.id || oIdx}
                                className={`p-2.5 rounded-lg text-xs border flex items-center justify-between ${
                                  opt.is_correct
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold w-5 h-5 rounded-full flex items-center justify-center bg-slate-100 border border-slate-300 text-[10px] shrink-0">
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <div className="text-slate-800">
                                    <MathRenderer text={opt.content} />
                                  </div>
                                </div>
                                {opt.is_correct && (
                                  <span className="flex items-center space-x-1 text-[10px] text-emerald-700 font-bold shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Đúng</span>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                            <span className="font-bold text-amber-800">Hướng dẫn giải / Đáp án: </span>
                            <MathRenderer text={q.explanation} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => {
                  const ex = previewExam;
                  setPreviewExam(null);
                  setDetailedExam(null);
                  setExamToDelete(ex);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa đề thi</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition-colors flex items-center space-x-1.5 shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Word / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewExam(null);
                    setDetailedExam(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ex = previewExam;
                    setPreviewExam(null);
                    setDetailedExam(null);
                    onCreateSessionFromExam(ex);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <Radio className="w-4 h-4" />
                  <span>Mở phòng thi ngay</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {previewExam && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          examData={{
            title: previewExam.title,
            subject: previewExam.subject_name || 'Toán học',
            grade: previewExam.grade || 10,
            durationMinutes: previewExam.duration_minutes || 45,
            questions: getExportQuestions(),
            matrix: matchedMatrix || undefined,
            matrixCells: (matchedMatrix as any)?.items || (matchedMatrix as any)?.matrix_cells || undefined,
          }}
        />
      )}

      {/* Confirmation Dialog for Deleting Exam */}
      <ConfirmDialog
        isOpen={!!examToDelete}
        title="Xác nhận xóa Đề thi"
        message={`Bạn có chắc chắn muốn xóa đề thi "${examToDelete?.title}"? Dữ liệu phòng thi liên kết có thể bị ảnh hưởng.`}
        confirmLabel="Xóa đề thi"
        loading={isDeleting}
        onCancel={() => setExamToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
