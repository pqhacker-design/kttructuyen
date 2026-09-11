import React, { useEffect, useState } from 'react';
import { 
  HelpCircle, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Trash2, 
  BookOpen, 
  Sparkles, 
  X,
  Layers,
  Award,
  Eye,
  FolderPlus,
  Settings2,
  Check
} from 'lucide-react';
import { 
  Question, 
  QuestionBank, 
  Subject, 
  CognitiveLevel, 
  QuestionType, 
  Difficulty,
  COGNITIVE_LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  Profile
} from '../types';
import { 
  fetchQuestions, 
  fetchQuestionBanks, 
  fetchSubjects, 
  createQuestion, 
  createQuestionBank, 
  deleteQuestion,
  deleteQuestionBank,
  seedDefaultEducationalData
} from '../services/questionService';
import { ConfirmDialog } from './ConfirmDialog';
import { MathRenderer } from './MathRenderer';
import { ExamValidator } from '../lib/examValidator';

interface QuestionBankViewProps {
  currentProfile: Profile | null;
  onOpenAuth: () => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  currentProfile,
  onOpenAuth,
}) => {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Deleting and Preview states
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [bankToDelete, setBankToDelete] = useState<QuestionBank | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Bank Form State
  const [newBankName, setNewBankName] = useState('');
  const [newBankSubjectId, setNewBankSubjectId] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');

  // New Question Form State
  const [qContent, setQContent] = useState('');
  const [qBankId, setQBankId] = useState('');
  const [qSubjectId, setQSubjectId] = useState('');
  const [qType, setQType] = useState<QuestionType>('single_choice');
  const [qCognitive, setQCognitive] = useState<CognitiveLevel>('recognition');
  const [qDifficulty, setQDifficulty] = useState<Difficulty>('medium');
  const [qPoints, setQPoints] = useState<number>(1.0);
  const [qExplanation, setQExplanation] = useState('');
  const [qOptions, setQOptions] = useState<Array<{ content: string; is_correct: boolean; option_order: number }>>([
    { content: '', is_correct: true, option_order: 1 },
    { content: '', is_correct: false, option_order: 2 },
    { content: '', is_correct: false, option_order: 3 },
    { content: '', is_correct: false, option_order: 4 },
  ]);

  // Specific state for True / False questions: 2, 4, 6, or 8 statements and points per statement
  const [tfStatementCount, setTfStatementCount] = useState<2 | 4 | 6 | 8>(4);
  const [tfPointsPerStatement, setTfPointsPerStatement] = useState<number>(0.25);
  const [tfStatements, setTfStatements] = useState<Array<{ statement: string; is_correct: boolean; explanation?: string }>>([
    { statement: '', is_correct: true, explanation: '' },
    { statement: '', is_correct: false, explanation: '' },
    { statement: '', is_correct: true, explanation: '' },
    { statement: '', is_correct: false, explanation: '' },
  ]);

  const handleStatementCountChange = (count: 2 | 4 | 6 | 8) => {
    setTfStatementCount(count);
    const updated = [...tfStatements];
    while (updated.length < count) {
      updated.push({ statement: '', is_correct: true, explanation: '' });
    }
    const truncated = updated.slice(0, count);
    setTfStatements(truncated);
    setQPoints(ExamValidator.round2(count * tfPointsPerStatement));
  };

  const handlePointsPerStatementChange = (pts: number) => {
    setTfPointsPerStatement(pts);
    setQPoints(ExamValidator.round2(tfStatementCount * pts));
  };

  useEffect(() => {
    loadInitialData();
  }, [currentProfile]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [bData, sData] = await Promise.all([
        fetchQuestionBanks(currentProfile?.user_id),
        fetchSubjects(),
      ]);
      setBanks(bData);
      setSubjects(sData);

      if (sData.length > 0) {
        setNewBankSubjectId(sData[0].id);
        setQSubjectId(sData[0].id);
      }
      if (bData.length > 0) {
        setQBankId(bData[0].id);
      }

      const qData = await fetchQuestions(undefined, currentProfile?.user_id);
      setQuestions(qData);
    } catch (err) {
      console.error('Error loading question bank data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    setSeeding(true);
    try {
      await seedDefaultEducationalData(currentProfile.user_id);
      await loadInitialData();
    } catch (err: any) {
      alert('Lỗi nạp dữ liệu: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    try {
      await createQuestionBank({
        name: newBankName.trim(),
        subject_id: newBankSubjectId,
        description: newBankDesc.trim(),
        owner_id: currentProfile.user_id,
      });
      setIsAddBankOpen(false);
      setNewBankName('');
      setNewBankDesc('');
      await loadInitialData();
    } catch (err: any) {
      alert('Lỗi tạo ngân hàng câu hỏi: ' + err.message);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    if (!qBankId) {
      alert('Vui lòng chọn ngân hàng câu hỏi.');
      return;
    }

    const statementLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    if (qType === 'true_false') {
      if (tfStatements.some((s) => !s.statement.trim())) {
        alert('Vui lòng nhập đầy đủ nội dung cho tất cả các ý trong câu hỏi Đúng / Sai.');
        return;
      }

      const tfOptionsToSave = tfStatements.map((st, idx) => ({
        content: `${statementLetters[idx]}) ${st.statement.trim()}`,
        is_correct: st.is_correct,
        option_order: idx + 1,
      }));

      const finalPoints = ExamValidator.round2(tfStatementCount * tfPointsPerStatement);

      try {
        await createQuestion(
          {
            question_bank_id: qBankId,
            owner_id: currentProfile.user_id,
            subject_id: qSubjectId || subjects[0]?.id || '',
            content: qContent.trim(),
            question_type: 'true_false',
            difficulty: qDifficulty,
            cognitive_level: qCognitive,
            explanation: qExplanation.trim() || undefined,
            points: finalPoints || 1.0,
          },
          tfOptionsToSave
        );

        setIsAddQuestionOpen(false);
        setQContent('');
        setQExplanation('');
        await loadInitialData();
      } catch (err: any) {
        alert('Lỗi tạo câu hỏi: ' + err.message);
      }
      return;
    }

    // Default: Multiple choice / single choice
    if (qOptions.some((o) => !o.content.trim())) {
      alert('Vui lòng nhập đầy đủ nội dung cho tất cả các phương án lựa chọn.');
      return;
    }
    if (!qOptions.some((o) => o.is_correct)) {
      alert('Vui lòng chọn ít nhất 1 đáp án đúng.');
      return;
    }

    try {
      await createQuestion(
        {
          question_bank_id: qBankId,
          owner_id: currentProfile.user_id,
          subject_id: qSubjectId || subjects[0]?.id || '',
          content: qContent.trim(),
          question_type: qType,
          difficulty: qDifficulty,
          cognitive_level: qCognitive,
          explanation: qExplanation.trim() || undefined,
          points: Number(qPoints) || 1.0,
        },
        qOptions
      );

      setIsAddQuestionOpen(false);
      // Reset form
      setQContent('');
      setQExplanation('');
      setQOptions([
        { content: '', is_correct: true, option_order: 1 },
        { content: '', is_correct: false, option_order: 2 },
        { content: '', is_correct: false, option_order: 3 },
        { content: '', is_correct: false, option_order: 4 },
      ]);
      await loadInitialData();
    } catch (err: any) {
      alert('Lỗi tạo câu hỏi: ' + err.message);
    }
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteQuestion(questionToDelete.id);
      setQuestions(questions.filter((q) => q.id !== questionToDelete.id));
      if (previewQuestion?.id === questionToDelete.id) {
        setPreviewQuestion(null);
      }
      setQuestionToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa câu hỏi: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteBank = async () => {
    if (!bankToDelete) return;
    setIsDeleting(true);
    try {
      await deleteQuestionBank(bankToDelete.id);
      setBanks(banks.filter((b) => b.id !== bankToDelete.id));
      setQuestions(questions.filter((q) => q.question_bank_id !== bankToDelete.id));
      if (selectedBankId === bankToDelete.id) {
        setSelectedBankId('all');
      }
      setBankToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa ngân hàng câu hỏi: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (selectedBankId !== 'all' && q.question_bank_id !== selectedBankId) return false;
    if (selectedLevel !== 'all' && q.cognitive_level !== selectedLevel) return false;
    if (selectedType !== 'all' && q.question_type !== selectedType) return false;
    if (searchQuery.trim() && !q.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Ngân hàng Câu hỏi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý câu hỏi phân theo 4 mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {questions.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{seeding ? 'Đang nạp...' : 'Tải 5 câu mẫu GDPT'}</span>
            </button>
          )}

          <button
            onClick={() => setIsAddBankOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center space-x-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tạo ngân hàng</span>
          </button>

          <button
            onClick={() => {
              if (!currentProfile) {
                onOpenAuth();
                return;
              }
              if (banks.length === 0) {
                alert('Vui lòng tạo ít nhất 1 ngân hàng câu hỏi trước khi thêm câu hỏi.');
                setIsAddBankOpen(true);
                return;
              }
              setIsAddQuestionOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Soạn câu hỏi</span>
          </button>
        </div>
      </div>

      {/* Question Banks Quick Grid */}
      {banks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            <span>Danh sách Ngân hàng ({banks.length})</span>
            <button
              onClick={() => setSelectedBankId('all')}
              className={`text-[11px] font-medium transition-colors ${
                selectedBankId === 'all' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {selectedBankId === 'all' ? 'Đang xem tất cả' : 'Xem tất cả ngân hàng'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {banks.map((b) => {
              const isSelected = selectedBankId === b.id;
              const count = questions.filter((q) => q.question_bank_id === b.id).length;
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBankId(isSelected ? 'all' : b.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                        {b.subject_name || 'Môn học'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBankToDelete(b);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Xóa ngân hàng này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">{b.name}</h4>
                    {b.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{b.description}</p>
                    )}
                  </div>
                  <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{count} câu hỏi</span>
                    <span className={`text-[11px] font-semibold ${isSelected ? 'text-indigo-700 font-bold' : 'text-slate-400'}`}>
                      {isSelected ? 'Đang chọn' : 'Lọc theo ngân hàng'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nội dung câu hỏi..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Bank filter */}
        <select
          value={selectedBankId}
          onChange={(e) => setSelectedBankId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Tất cả ngân hàng ({banks.length})</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Cognitive level filter */}
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Tất cả mức độ</option>
          <option value="recognition">Nhận biết</option>
          <option value="comprehension">Thông hiểu</option>
          <option value="application">Vận dụng</option>
          <option value="advanced_application">Vận dụng cao</option>
        </select>

        {/* Question type filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Tất cả loại câu</option>
          <option value="single_choice">Trắc nghiệm đơn</option>
          <option value="multiple_choice">Nhiều lựa chọn</option>
          <option value="true_false">Đúng / Sai</option>
          <option value="short_answer">Điền ngắn</option>
          <option value="essay">Tự luận</option>
        </select>
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Đang tải ngân hàng câu hỏi từ Supabase...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-800 text-base">Chưa có câu hỏi nào</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Bắt đầu bằng việc soạn câu hỏi mới hoặc nhấn nút tải bộ 5 câu hỏi chuẩn Bộ GD&ĐT để trải nghiệm ngay.
            </p>
            <div className="flex justify-center space-x-3 pt-2">
              <button
                onClick={handleSeed}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                Tải câu hỏi mẫu GDPT
              </button>
              <button
                onClick={() => setIsAddQuestionOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Soạn câu hỏi mới
              </button>
            </div>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const levelInfo = COGNITIVE_LEVEL_LABELS[q.cognitive_level];
            const diffInfo = DIFFICULTY_LABELS[q.difficulty];

            return (
              <div
                key={q.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition-all"
              >
                {/* Meta header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-500">Câu {idx + 1}.</span>
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${levelInfo.badgeClass}`}>
                      {levelInfo.label}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-700">
                      {QUESTION_TYPE_LABELS[q.question_type]}
                    </span>
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${diffInfo.badgeClass}`}>
                      {diffInfo.label}
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      {q.points} điểm
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setPreviewQuestion(q)}
                      className="px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1 text-xs"
                      title="Xem chi tiết câu hỏi"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px] font-medium">Chi tiết</span>
                    </button>
                    <button
                      onClick={() => setQuestionToDelete(q)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="text-sm font-medium text-slate-900 leading-relaxed">
                  <MathRenderer text={q.content} />
                </div>

                {/* Options */}
                {q.options && q.options.length > 0 && (
                  q.question_type === 'true_false' ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-bold text-indigo-800 tracking-wider">
                        Các mệnh đề cần thẩm định ({q.options.length} ý):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                              opt.is_correct
                                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                                : 'bg-rose-50/80 border-rose-300 text-rose-950'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-bold w-5 h-5 rounded-full flex items-center justify-center bg-white border border-slate-300 text-[10px] shrink-0">
                                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][optIdx] || optIdx + 1}
                              </span>
                              <div className="text-slate-800 text-xs">
                                <MathRenderer text={opt.content} />
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              opt.is_correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}>
                              {opt.is_correct ? 'ĐÚNG' : 'SAI'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-xl text-xs border flex items-center justify-between ${
                            opt.is_correct
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-bold w-5 h-5 rounded-full flex items-center justify-center bg-white border border-slate-300 text-[10px] shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <div className="text-slate-800">
                              <MathRenderer text={opt.content} />
                            </div>
                          </div>
                          {opt.is_correct && (
                            <span className="flex items-center space-x-1 text-[11px] text-emerald-700 font-bold shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đúng</span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold text-amber-800">Lời giải chi tiết: </span>
                    <MathRenderer text={q.explanation} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Question Bank */}
      {isAddBankOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Tạo Ngân hàng Câu hỏi mới</h3>
              <button onClick={() => setIsAddBankOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBank} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Môn học
                </label>
                <select
                  value={newBankSubjectId}
                  onChange={(e) => setNewBankSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (Khối {s.grade})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên ngân hàng câu hỏi
                </label>
                <input
                  type="text"
                  required
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="VD: Ngân hàng Toán 10 - Học kỳ I"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Mô tả phạm vi kiến thức, chương bài..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBankOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu ngân hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Question */}
      {isAddQuestionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">Soạn Câu hỏi Mới</h3>
              <button onClick={() => setIsAddQuestionOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngân hàng câu hỏi
                  </label>
                  <select
                    value={qBankId}
                    onChange={(e) => setQBankId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mức độ nhận thức (Chuẩn GDPT)
                  </label>
                  <select
                    value={qCognitive}
                    onChange={(e) => setQCognitive(e.target.value as CognitiveLevel)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="recognition">Nhận biết</option>
                    <option value="comprehension">Thông hiểu</option>
                    <option value="application">Vận dụng</option>
                    <option value="advanced_application">Vận dụng cao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại câu hỏi
                  </label>
                  <select
                    value={qType}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      setQType(newType);
                      if (newType === 'true_false') {
                        setQPoints(ExamValidator.round2(tfStatementCount * tfPointsPerStatement));
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="single_choice">Trắc nghiệm 1 lựa chọn</option>
                    <option value="multiple_choice">Trắc nghiệm nhiều lựa chọn</option>
                    <option value="true_false">Đúng / Sai (Phần II CV 7991)</option>
                    <option value="short_answer">Điền ngắn</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {qType === 'true_false' ? 'Tổng điểm câu hỏi (Tự tính)' : 'Điểm số mặc định'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="10"
                    readOnly={qType === 'true_false'}
                    value={qPoints}
                    onChange={(e) => setQPoints(parseFloat(e.target.value))}
                    className={`w-full px-3 py-2 text-xs rounded-lg border ${
                      qType === 'true_false' 
                        ? 'bg-slate-100 font-bold text-indigo-700 border-indigo-200 cursor-not-allowed' 
                        : 'border-slate-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung câu hỏi / Tình huống dẫn
                </label>
                <textarea
                  required
                  value={qContent}
                  onChange={(e) => setQContent(e.target.value)}
                  placeholder="Nhập câu hỏi, bài toán hoặc tình huống dẫn..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* RENDER DEDICATED TRUE/FALSE FORM OR STANDARD MULTIPLE CHOICE */}
              {qType === 'true_false' ? (
                /* =========================================================================
                   CẤU HÌNH & NHẬP Ý CÂU HỎI ĐÚNG / SAI: 2, 4, 6, HOẶC 8 Ý + ĐIỂM MỖI Ý
                   ========================================================================= */
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/90 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-200/80">
                    <div className="flex items-center space-x-2">
                      <Settings2 className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-900">
                        Cấu hình mệnh đề Đúng / Sai
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-indigo-700 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs">
                      {tfStatementCount} ý × {tfPointsPerStatement}đ = <strong>{ExamValidator.round2(tfStatementCount * tfPointsPerStatement)} điểm</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Chọn số ý: 2, 4, 6 hoặc 8 ý */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Số lượng ý (mệnh đề):
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {([2, 4, 6, 8] as const).map((cnt) => {
                          const isSelected = tfStatementCount === cnt;
                          return (
                            <button
                              type="button"
                              key={cnt}
                              onClick={() => handleStatementCountChange(cnt)}
                              className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
                              }`}
                            >
                              {cnt} ý
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chọn điểm cho mỗi ý */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Điểm cho mỗi ý đúng:
                      </label>
                      <div className="flex items-center space-x-2">
                        <div className="grid grid-cols-4 gap-1 flex-1">
                          {[0.1, 0.25, 0.5, 1.0].map((pts) => {
                            const isSelected = Math.abs(tfPointsPerStatement - pts) < 0.001;
                            return (
                              <button
                                type="button"
                                key={pts}
                                onClick={() => handlePointsPerStatementChange(pts)}
                                className={`py-1 px-1.5 text-xs font-semibold rounded-lg border text-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 border-emerald-700 text-white font-bold shadow-2xs'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {pts}đ
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          max="5"
                          value={tfPointsPerStatement}
                          onChange={(e) => handlePointsPerStatementChange(parseFloat(e.target.value) || 0.25)}
                          className="w-16 px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-center"
                          title="Hoặc tự nhập số điểm mỗi ý"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Danh sách các ý a, b, c, d... */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-semibold text-slate-800">
                      Nội dung từng ý và đáp án (Click để chuyển Đúng/Sai):
                    </label>

                    {tfStatements.map((st, sIdx) => {
                      const letter = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][sIdx] || `${sIdx + 1}`;
                      return (
                        <div key={sIdx} className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {letter}
                            </span>
                            <input
                              type="text"
                              required
                              value={st.statement}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTfStatements(tfStatements.map((item, i) => i === sIdx ? { ...item, statement: val } : item));
                              }}
                              placeholder={`Nhập nội dung mệnh đề ${letter})`}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                            />

                            {/* True / False Toggle buttons */}
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setTfStatements(tfStatements.map((item, i) => i === sIdx ? { ...item, is_correct: true } : item));
                                }}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  st.is_correct
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                                }`}
                              >
                                Đúng
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTfStatements(tfStatements.map((item, i) => i === sIdx ? { ...item, is_correct: false } : item));
                                }}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  !st.is_correct
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                                }`}
                              >
                                Sai
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={st.explanation || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTfStatements(tfStatements.map((item, i) => i === sIdx ? { ...item, explanation: val } : item));
                            }}
                            placeholder={`Giải thích cho ý ${letter}) (Tùy chọn)`}
                            className="w-full px-3 py-1 text-[11px] rounded-md border border-slate-200 bg-slate-50 text-slate-700"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* =========================================================================
                   OPTIONS FOR MULTIPLE CHOICE / SINGLE CHOICE
                   ========================================================================= */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Các phương án lựa chọn (Click chọn đáp án đúng)
                    </label>
                  </div>

                  <div className="space-y-2">
                    {qOptions.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (qType === 'single_choice') {
                              setQOptions(qOptions.map((o, i) => ({ ...o, is_correct: i === oIdx })));
                            } else {
                              setQOptions(qOptions.map((o, i) => i === oIdx ? { ...o, is_correct: !o.is_correct } : o));
                            }
                          }}
                          className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                            opt.is_correct
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                          }`}
                          title="Đánh dấu đây là đáp án đúng"
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </button>
                        <input
                          type="text"
                          required
                          value={opt.content}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQOptions(qOptions.map((o, i) => i === oIdx ? { ...o, content: val } : o));
                          }}
                          placeholder={`Nội dung phương án ${String.fromCharCode(65 + oIdx)}`}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lời giải chi tiết (Hiển thị sau khi thi xong)
                </label>
                <textarea
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Giải thích các bước giải hoặc lý do chọn đáp án..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddQuestionOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu vào Ngân hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Question Detail Preview */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Chi tiết câu hỏi</h3>
                  <p className="text-[11px] text-slate-400">Xem đầy đủ thông tin phân loại và đáp án</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${COGNITIVE_LEVEL_LABELS[previewQuestion.cognitive_level]?.badgeClass}`}>
                  {COGNITIVE_LEVEL_LABELS[previewQuestion.cognitive_level]?.label}
                </span>
                <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700">
                  {QUESTION_TYPE_LABELS[previewQuestion.question_type]}
                </span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${DIFFICULTY_LABELS[previewQuestion.difficulty]?.badgeClass}`}>
                  {DIFFICULTY_LABELS[previewQuestion.difficulty]?.label}
                </span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                  {previewQuestion.points} điểm
                </span>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nội dung câu hỏi</label>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 text-sm leading-relaxed font-medium">
                  <MathRenderer text={previewQuestion.content} />
                </div>
              </div>

              {/* Options */}
              {previewQuestion.options && previewQuestion.options.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Các phương án trả lời</label>
                  <div className="space-y-2">
                    {previewQuestion.options.map((opt, oIdx) => (
                      <div
                        key={opt.id || oIdx}
                        className={`p-3 rounded-xl text-xs border flex items-center justify-between ${
                          opt.is_correct
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="font-bold w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 border border-slate-300 text-xs shrink-0">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <div className="text-slate-800">
                            <MathRenderer text={opt.content} />
                          </div>
                        </div>
                        {opt.is_correct && (
                          <span className="flex items-center space-x-1 text-xs text-emerald-700 font-bold shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đáp án đúng</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {previewQuestion.explanation && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-700">Lời giải chi tiết / Hướng dẫn chấm</label>
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                    <MathRenderer text={previewQuestion.explanation} />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const q = previewQuestion;
                  setPreviewQuestion(null);
                  setQuestionToDelete(q);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa câu hỏi này</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting Question */}
      <ConfirmDialog
        isOpen={!!questionToDelete}
        title="Xác nhận xóa Câu hỏi"
        message="Bạn có chắc chắn muốn xóa câu hỏi này khỏi Ngân hàng? Hành động này không thể hoàn tác."
        confirmLabel="Xóa câu hỏi"
        loading={isDeleting}
        onCancel={() => setQuestionToDelete(null)}
        onConfirm={handleConfirmDeleteQuestion}
      />

      {/* Confirmation Dialog for Deleting Question Bank */}
      <ConfirmDialog
        isOpen={!!bankToDelete}
        title="Xác nhận xóa Ngân hàng câu hỏi"
        message={`Bạn có chắc chắn muốn xóa ngân hàng "${bankToDelete?.name}"? Tất cả câu hỏi thuộc ngân hàng này cũng sẽ bị xóa.`}
        confirmLabel="Xóa ngân hàng"
        loading={isDeleting}
        onCancel={() => setBankToDelete(null)}
        onConfirm={handleConfirmDeleteBank}
      />
    </div>
  );
};
