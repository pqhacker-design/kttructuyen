import React, { useEffect, useState, useMemo } from 'react';
import { 
  Grid3X3, 
  Plus, 
  Trash2, 
  FileCheck, 
  Sliders, 
  CheckCircle2, 
  X,
  PieChart,
  Percent,
  Eye,
  Printer,
  Download
} from 'lucide-react';
import { Matrix, MatrixItem, Specification, SpecificationItem, Subject, CognitiveLevel, Profile } from '../types';
import { fetchMatrices, createMatrix, deleteMatrix } from '../services/matrixService';
import { fetchSubjects } from '../services/questionService';
import { ConfirmDialog } from './ConfirmDialog';
import { ExportModal } from './ExportModal';
import { buildCV7991Data } from '../lib/cv7991MatrixHelper';
import { CV7991MatrixTableView } from './CV7991MatrixTableView';
import { exportMatrixToWord } from '../services/docxExportService';
import { exportMatrixToPdf } from '../services/pdfExportService';

interface MatrixViewProps {
  currentProfile: Profile | null;
  onOpenAuth: () => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  currentProfile,
  onOpenAuth,
}) => {
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Deletion & Preview States
  const [matrixToDelete, setMatrixToDelete] = useState<Matrix | null>(null);
  const [previewMatrix, setPreviewMatrix] = useState<Matrix | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Compute standard CV 7991 data for preview and export
  const previewCVData = useMemo(() => {
    if (!previewMatrix) return null;
    return buildCV7991Data({
      title: previewMatrix.name,
      subject: previewMatrix.subject_name || 'Toán học',
      grade: previewMatrix.grade || 10,
      durationMinutes: 45,
      matrix: previewMatrix,
    });
  }, [previewMatrix]);

  // New Matrix Form State
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade] = useState(10);
  const [description, setDescription] = useState('');

  // 4 standard curriculum topics
  const [topics, setTopics] = useState<string[]>([
    'Mệnh đề và tập hợp',
    'Bất phương trình bậc nhất hai ẩn',
    'Hệ thức lượng trong tam giác',
    'Vectơ và các phép toán',
  ]);
  const [newTopicInput, setNewTopicInput] = useState('');

  // Matrix item grid: topic -> level -> count
  const [counts, setCounts] = useState<Record<string, Record<CognitiveLevel, number>>>({
    'Mệnh đề và tập hợp': { recognition: 2, comprehension: 1, application: 1, advanced_application: 0 },
    'Bất phương trình bậc nhất hai ẩn': { recognition: 1, comprehension: 2, application: 1, advanced_application: 0 },
    'Hệ thức lượng trong tam giác': { recognition: 1, comprehension: 1, application: 1, advanced_application: 1 },
    'Vectơ và các phép toán': { recognition: 2, comprehension: 1, application: 0, advanced_application: 1 },
  });

  useEffect(() => {
    loadData();
  }, [currentProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mList, sList] = await Promise.all([
        fetchMatrices(currentProfile?.user_id),
        fetchSubjects(),
      ]);
      setMatrices(mList);
      setSubjects(sList);
      if (sList.length > 0) setSubjectId(sList[0].id);
    } catch (err) {
      console.error('Error loading matrices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = () => {
    if (!newTopicInput.trim()) return;
    const t = newTopicInput.trim();
    if (!topics.includes(t)) {
      setTopics([...topics, t]);
      setCounts({
        ...counts,
        [t]: { recognition: 1, comprehension: 1, application: 0, advanced_application: 0 },
      });
      setNewTopicInput('');
    }
  };

  const handleCountChange = (topic: string, level: CognitiveLevel, val: number) => {
    setCounts({
      ...counts,
      [topic]: {
        ...counts[topic],
        [level]: Math.max(0, val),
      },
    });
  };

  // Calculate totals
  let totalRec = 0;
  let totalCom = 0;
  let totalApp = 0;
  let totalAdv = 0;

  topics.forEach((t) => {
    const row = counts[t] || { recognition: 0, comprehension: 0, application: 0, advanced_application: 0 };
    totalRec += row.recognition || 0;
    totalCom += row.comprehension || 0;
    totalApp += row.application || 0;
    totalAdv += row.advanced_application || 0;
  });

  const grandTotalQuestions = totalRec + totalCom + totalApp + totalAdv;
  const pRec = grandTotalQuestions ? Math.round((totalRec / grandTotalQuestions) * 100) : 0;
  const pCom = grandTotalQuestions ? Math.round((totalCom / grandTotalQuestions) * 100) : 0;
  const pApp = grandTotalQuestions ? Math.round((totalApp / grandTotalQuestions) * 100) : 0;
  const pAdv = grandTotalQuestions ? Math.round((totalAdv / grandTotalQuestions) * 100) : 0;

  const handleSaveMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }

    if (grandTotalQuestions === 0) {
      alert('Ma trận phải có ít nhất 1 câu hỏi.');
      return;
    }

    try {
      // Build items array
      const items: any[] = [];
      const pointsPerQ = grandTotalQuestions > 0 ? 10.0 / grandTotalQuestions : 1.0;

      topics.forEach((t) => {
        const row = counts[t];
        if (row.recognition > 0) {
          items.push({
            topic: t,
            cognitive_level: 'recognition',
            question_type: 'single_choice',
            question_count: row.recognition,
            points: Number((row.recognition * pointsPerQ).toFixed(2)),
          });
        }
        if (row.comprehension > 0) {
          items.push({
            topic: t,
            cognitive_level: 'comprehension',
            question_type: 'single_choice',
            question_count: row.comprehension,
            points: Number((row.comprehension * pointsPerQ).toFixed(2)),
          });
        }
        if (row.application > 0) {
          items.push({
            topic: t,
            cognitive_level: 'application',
            question_type: 'single_choice',
            question_count: row.application,
            points: Number((row.application * pointsPerQ).toFixed(2)),
          });
        }
        if (row.advanced_application > 0) {
          items.push({
            topic: t,
            cognitive_level: 'advanced_application',
            question_type: 'single_choice',
            question_count: row.advanced_application,
            points: Number((row.advanced_application * pointsPerQ).toFixed(2)),
          });
        }
      });

      await createMatrix(
        {
          owner_id: currentProfile.user_id,
          subject_id: subjectId,
          name: name.trim(),
          grade,
          description: description.trim(),
        },
        items
      );

      setIsCreateOpen(false);
      setName('');
      setDescription('');
      await loadData();
    } catch (err: any) {
      alert('Lỗi lưu ma trận: ' + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!matrixToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMatrix(matrixToDelete.id);
      setMatrices(matrices.filter((m) => m.id !== matrixToDelete.id));
      if (previewMatrix?.id === matrixToDelete.id) {
        setPreviewMatrix(null);
      }
      setMatrixToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa ma trận: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Ma trận & Bảng đặc tả Đề thi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Thiết kế ma trận đề kiểm tra 2 chiều chuẩn 4 mức độ nhận thức theo định hướng Thông tư 22 & GDPT 2018
          </p>
        </div>

        <button
          onClick={() => {
            if (!currentProfile) {
              onOpenAuth();
              return;
            }
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo ma trận đề mới</span>
        </button>
      </div>

      {/* Existing Matrices List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400">Đang tải danh sách ma trận...</div>
        ) : matrices.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
            <Grid3X3 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-800 text-base">Chưa có ma trận đề nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Thiết lập ma trận chuẩn để bảo đảm tính khoa học, cân đối giữa các mức độ Nhận biết, Thông hiểu và Vận dụng.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              Tạo ma trận đầu tiên
            </button>
          </div>
        ) : (
          matrices.map((matrix) => (
            <div
              key={matrix.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {matrix.subject_name} • Khối {matrix.grade}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setPreviewMatrix(matrix)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Xem chi tiết ma trận & bảng đặc tả"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setMatrixToDelete(matrix)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Xóa ma trận"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base leading-snug">{matrix.name}</h3>
                {matrix.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{matrix.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <span>Số câu: <strong>{matrix.total_questions || 0} câu</strong></span>
                  <span>•</span>
                  <span>Thang điểm: <strong>{matrix.total_points || 10} đ</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewMatrix(matrix)}
                  className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg flex items-center space-x-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Chi tiết</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Interactive 2D Matrix Builder */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Grid3X3 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Thiết kế Ma trận Đề thi Chuẩn 4 Mức độ</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMatrix} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Basic Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên Ma trận đề kiểm tra
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Ma trận Đề kiểm tra Giữa học kỳ I - Toán 10"
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

              {/* Add Topic Input */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTopicInput}
                  onChange={(e) => setNewTopicInput(e.target.value)}
                  placeholder="Thêm chủ đề / chương bài kiểm tra..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopic();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Thêm chủ đề
                </button>
              </div>

              {/* 2D Matrix Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Chủ đề / Bài học</th>
                      <th className="p-3 text-center text-sky-700 bg-sky-50/50">Nhận biết</th>
                      <th className="p-3 text-center text-emerald-700 bg-emerald-50/50">Thông hiểu</th>
                      <th className="p-3 text-center text-amber-700 bg-amber-50/50">Vận dụng</th>
                      <th className="p-3 text-center text-rose-700 bg-rose-50/50">Vận dụng cao</th>
                      <th className="p-3 text-center">Tổng câu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topics.map((t) => {
                      const row = counts[t] || { recognition: 0, comprehension: 0, application: 0, advanced_application: 0 };
                      const rowTotal = row.recognition + row.comprehension + row.application + row.advanced_application;
                      return (
                        <tr key={t} className="hover:bg-slate-50/50">
                          <td className="p-3 font-medium text-slate-900">{t}</td>
                          <td className="p-2 text-center bg-sky-50/20">
                            <input
                              type="number"
                              min="0"
                              value={row.recognition}
                              onChange={(e) => handleCountChange(t, 'recognition', parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 text-center border border-slate-200 rounded text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 text-center bg-emerald-50/20">
                            <input
                              type="number"
                              min="0"
                              value={row.comprehension}
                              onChange={(e) => handleCountChange(t, 'comprehension', parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 text-center border border-slate-200 rounded text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 text-center bg-amber-50/20">
                            <input
                              type="number"
                              min="0"
                              value={row.application}
                              onChange={(e) => handleCountChange(t, 'application', parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 text-center border border-slate-200 rounded text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 text-center bg-rose-50/20">
                            <input
                              type="number"
                              min="0"
                              value={row.advanced_application}
                              onChange={(e) => handleCountChange(t, 'advanced_application', parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 text-center border border-slate-200 rounded text-xs font-bold"
                            />
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">
                            {rowTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold text-slate-800 border-t border-slate-200">
                    <tr>
                      <td className="p-3">Tổng số câu</td>
                      <td className="p-3 text-center text-sky-800">{totalRec} ({pRec}%)</td>
                      <td className="p-3 text-center text-emerald-800">{totalCom} ({pCom}%)</td>
                      <td className="p-3 text-center text-amber-800">{totalApp} ({pApp}%)</td>
                      <td className="p-3 text-center text-rose-800">{totalAdv} ({pAdv}%)</td>
                      <td className="p-3 text-center text-indigo-700 text-sm">{grandTotalQuestions} câu</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Ratio Preview Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">Tỉ lệ cơ cấu mức độ nhận thức:</span>
                  <span className="font-mono">{pRec}% : {pCom}% : {pApp}% : {pAdv}%</span>
                </div>
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div style={{ width: `${pRec}%` }} className="bg-sky-500" title={`Nhận biết: ${pRec}%`} />
                  <div style={{ width: `${pCom}%` }} className="bg-emerald-500" title={`Thông hiểu: ${pCom}%`} />
                  <div style={{ width: `${pApp}%` }} className="bg-amber-500" title={`Vận dụng: ${pApp}%`} />
                  <div style={{ width: `${pAdv}%` }} className="bg-rose-500" title={`Vận dụng cao: ${pAdv}%`} />
                </div>
              </div>

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
                  Lưu Ma trận đề
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Matrix & Specification Detail Preview */}
      {previewMatrix && previewCVData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Grid3X3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{previewMatrix.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    Khung ma trận 19 cột & bản đặc tả theo chuẩn Công văn 7991/BGDĐT-GDTrH
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  title="Xuất bảng Ma trận & Đặc tả ra file Word (.docx) hoặc PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Hộp thoại xuất file</span>
                </button>
                <button
                  onClick={() => setPreviewMatrix(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {previewMatrix.description && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-900">Mô tả định hướng: </span>
                  {previewMatrix.description}
                </div>
              )}

              {/* CV 7991 Matrix & Specification Tabs */}
              <CV7991MatrixTableView
                cvData={previewCVData}
                onExportWord={async () => {
                  await exportMatrixToWord({
                    title: previewMatrix.name,
                    subject: previewMatrix.subject_name || 'Toán học',
                    grade: previewMatrix.grade || 10,
                    matrix: previewMatrix,
                    cvData: previewCVData,
                  });
                }}
                onExportPdf={() => {
                  exportMatrixToPdf({
                    title: previewMatrix.name,
                    subject: previewMatrix.subject_name || 'Toán học',
                    grade: previewMatrix.grade || 10,
                    matrix: previewMatrix,
                    cvData: previewCVData,
                  });
                }}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const m = previewMatrix;
                  setPreviewMatrix(null);
                  setMatrixToDelete(m);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa ma trận này</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewMatrix(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {previewMatrix && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          initialDocType="matrix"
          examData={{
            title: previewMatrix.name,
            subject: previewMatrix.subject_name || 'Toán học',
            grade: previewMatrix.grade || 10,
            durationMinutes: 45,
            questions: [],
            matrix: previewMatrix,
            cvData: previewCVData,
          }}
        />
      )}

      {/* Confirmation Dialog for Deleting Matrix */}
      <ConfirmDialog
        isOpen={!!matrixToDelete}
        title="Xác nhận xóa Ma trận đề"
        message={`Bạn có chắc chắn muốn xóa ma trận đề "${matrixToDelete?.name}"? Các đề thi đã tạo vẫn sẽ được giữ nguyên.`}
        confirmLabel="Xóa ma trận"
        loading={isDeleting}
        onCancel={() => setMatrixToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
