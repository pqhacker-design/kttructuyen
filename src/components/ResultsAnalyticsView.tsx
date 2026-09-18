import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Users, 
  Award, 
  TrendingUp, 
  Download, 
  Search, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  FileText,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { ExamSession, ExamResult, Profile, ExamAuditLog } from '../types';
import { fetchExamSessions } from '../services/sessionService';
import { 
  fetchResultsBySession, 
  calculateSessionAnalytics, 
  syncSessionAttempts,
  deleteExamResult,
  allowStudentRetake,
  fetchAttemptAuditLog
} from '../services/resultService';
import { mockStore } from '../services/mockStore';
import { ExamAuditLogModal } from './ExamAuditLogModal';

interface ResultsAnalyticsViewProps {
  currentProfile: Profile | null;
  initialSessionId?: string | null;
}

export const ResultsAnalyticsView: React.FC<ResultsAnalyticsViewProps> = ({
  currentProfile,
  initialSessionId,
}) => {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [results, setResults] = useState<ExamResult[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Audit log modal state
  const [selectedAuditLog, setSelectedAuditLog] = useState<ExamAuditLog | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [loadingAuditLog, setLoadingAuditLog] = useState(false);

  // Retake confirmation modal state
  const [retakeTarget, setRetakeTarget] = useState<ExamResult | null>(null);
  const [isRetakeModalOpen, setIsRetakeModalOpen] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<ExamResult | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast feedback
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSessions();
  }, [currentProfile]);

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionResults(selectedSessionId);
    }
  }, [selectedSessionId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      let sList = await fetchExamSessions(currentProfile?.user_id);
      if ((!sList || sList.length === 0) && currentProfile?.user_id) {
        sList = await fetchExamSessions();
      }
      setSessions(sList);
      if (initialSessionId) {
        setSelectedSessionId(initialSessionId);
      } else if (sList.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sList[0].id);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionResults = async (sessionId: string) => {
    setLoading(true);
    try {
      const rList = await fetchResultsBySession(sessionId);
      setResults(rList);
      const stat = calculateSessionAnalytics(rList);
      setAnalytics(stat);
    } catch (err) {
      console.error('Error loading results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncResults = async () => {
    if (!selectedSessionId) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const syn = await syncSessionAttempts(selectedSessionId);
      setResults(syn.results);
      setAnalytics(calculateSessionAnalytics(syn.results));
      if (syn.syncedCount > 0) {
        setSyncMessage(`Đã cập nhật ${syn.syncedCount} bài thi mới nộp vào danh sách điểm.`);
      } else {
        setSyncMessage(`Dữ liệu bảng điểm đã đồng bộ mới nhất (${syn.results.length} bài nộp).`);
      }
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      console.error('Error syncing:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }

    const headers = ['Hạng', 'Mã học sinh', 'Họ và tên', 'Điểm số', 'Điểm tối đa', 'Tỷ lệ %', 'Số câu đúng', 'Số câu sai', 'Thời gian nộp'];
    const rows = results.map((r, i) => [
      i + 1,
      r.student_code || '',
      `"${r.student_name}"`,
      r.score,
      r.max_score,
      r.percentage,
      r.correct_count,
      r.wrong_count,
      r.submitted_at ? new Date(r.submitted_at).toLocaleString('vi-VN') : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ket_qua_thi_${selectedSessionId.slice(0, 6)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xem nhật ký thi
  const handleOpenAuditModal = async (res: ExamResult) => {
    setIsAuditModalOpen(true);
    setLoadingAuditLog(true);
    try {
      const log = await fetchAttemptAuditLog(selectedSessionId, res.attempt_id, res);
      setSelectedAuditLog(log);
    } catch (err: any) {
      console.error('Error fetching audit log:', err);
    } finally {
      setLoadingAuditLog(false);
    }
  };

  // Mở modal xác nhận cho làm lại
  const handleOpenRetakeModal = (res: ExamResult) => {
    setRetakeTarget(res);
    setIsRetakeModalOpen(true);
  };

  // Thực hiện cho làm lại
  const handleConfirmRetake = async () => {
    if (!retakeTarget || !selectedSessionId) return;
    setIsRetaking(true);
    try {
      const studentCode = retakeTarget.student_code || '';
      const attemptId = retakeTarget.attempt_id;
      await allowStudentRetake(selectedSessionId, studentCode, attemptId);

      // Local mockStore reset (in case student logs in on same browser/device)
      mockStore.resetStudentAttempt(selectedSessionId, studentCode, attemptId);

      const updated = results.filter(
        (r) => r.id !== retakeTarget.id && r.attempt_id !== retakeTarget.attempt_id
      );
      setResults(updated);
      setAnalytics(calculateSessionAnalytics(updated));

      setIsRetakeModalOpen(false);
      setRetakeTarget(null);
      if (isAuditModalOpen) {
        setIsAuditModalOpen(false);
      }

      setActionToast({
        type: 'success',
        message: `Đã cấp quyền cho học sinh ${retakeTarget.student_name} làm lại bài thi thành công. Học sinh có thể dùng mã phòng để vào làm bài lại.`,
      });
      setTimeout(() => setActionToast(null), 5000);
    } catch (err: any) {
      setActionToast({
        type: 'error',
        message: `Lỗi khi cấp quyền làm lại: ${err.message || 'Không thể xử lý yêu cầu'}`,
      });
      setTimeout(() => setActionToast(null), 5000);
    } finally {
      setIsRetaking(false);
    }
  };

  // Mở modal xác nhận xóa kết quả
  const handleOpenDeleteModal = (res: ExamResult) => {
    setDeleteTarget(res);
    setIsDeleteModalOpen(true);
  };

  // Thực hiện xóa kết quả
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !selectedSessionId) return;
    setIsDeleting(true);
    try {
      await deleteExamResult(selectedSessionId, deleteTarget.id, deleteTarget.attempt_id, deleteTarget.student_code);

      // Also reset student attempt eligibility so student can retake if needed
      if (deleteTarget.student_code) {
        mockStore.resetStudentAttempt(selectedSessionId, deleteTarget.student_code, deleteTarget.attempt_id);
      }

      const updated = results.filter(
        (r) => r.id !== deleteTarget.id && r.attempt_id !== deleteTarget.attempt_id
      );
      setResults(updated);
      setAnalytics(calculateSessionAnalytics(updated));

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);

      setActionToast({
        type: 'success',
        message: `Đã xóa vĩnh viễn kết quả thi của học sinh ${deleteTarget.student_name}.`,
      });
      setTimeout(() => setActionToast(null), 5000);
    } catch (err: any) {
      setActionToast({
        type: 'error',
        message: `Lỗi khi xóa kết quả: ${err.message || 'Không thể xóa'}`,
      });
      setTimeout(() => setActionToast(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredResults = results.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.student_name && r.student_name.toLowerCase().includes(q)) ||
      (r.student_code && r.student_code.toLowerCase().includes(q))
    );
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Báo cáo & Phổ điểm Khảo thí</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Phân tích phổ điểm thi, tỷ lệ đạt yêu cầu và chi tiết kết quả từng học sinh
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Select Session Dropdown */}
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 shadow-2xs"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.access_code})
              </option>
            ))}
          </select>

          <button
            onClick={handleSyncResults}
            disabled={isSyncing}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white shadow-xs transition-colors flex items-center space-x-1.5"
            title="Quét và đồng bộ tất cả bài thi vừa nộp từ học sinh vào bảng điểm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ kết quả'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-medium flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {actionToast && (
        <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2.5 animate-fadeIn border shadow-xs ${
          actionToast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {actionToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{actionToast.message}</span>
        </div>
      )}

      {/* Analytics KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số lượt thi</span>
            <p className="text-2xl font-bold text-slate-900 mt-2">{analytics.totalAttempts}</p>
            <span className="text-xs text-slate-500">Đã nộp bài chấm điểm</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Điểm trung bình</span>
            <p className="text-2xl font-bold text-indigo-600 mt-2">{analytics.averageScore} / 10</p>
            <span className="text-xs text-slate-500">Toàn bộ phòng thi</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cao nhất / Thấp nhất</span>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              <span className="text-emerald-600">{analytics.highestScore}</span>
              <span className="text-slate-300 mx-1.5">/</span>
              <span className="text-rose-600">{analytics.lowestScore}</span>
            </p>
            <span className="text-xs text-slate-500">Biên độ dao động điểm</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỷ lệ Đạt (≥ 5.0 đ)</span>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{analytics.passRate}%</p>
            <span className="text-xs text-slate-500">Đạt chuẩn yêu cầu</span>
          </div>
        </div>
      )}

      {/* Score Distribution Chart */}
      {analytics && analytics.scoreDistribution && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Biểu đồ Phổ điểm Kỳ thi</h3>
              <p className="text-xs text-slate-500">Phân bố số lượng học sinh theo các dải thang điểm 10</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Chuẩn GDPT 2018</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.scoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="range" tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(val: any) => [`${val} thí sinh`, 'Số lượng']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Student Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-sm">Danh sách Điểm Thí sinh ({results.length})</h3>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc mã HS..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Đang tải bảng điểm...</div>
        ) : filteredResults.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            Chưa có thí sinh nào nộp bài trong kỳ thi này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center">Hạng</th>
                  <th className="p-3">Mã HS / SBD</th>
                  <th className="p-3">Họ và tên thí sinh</th>
                  <th className="p-3 text-center min-w-[130px] w-36 whitespace-nowrap">Điểm số</th>
                  <th className="p-3 text-center">Tỷ lệ</th>
                  <th className="p-3 text-center">Đúng / Sai</th>
                  <th className="p-3 text-right">Thời gian nộp</th>
                  <th className="p-3 text-center min-w-[110px] w-28 whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r, idx) => {
                  const isPassed = r.score >= (r.max_score / 2);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="p-3 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-700">
                        {r.student_code || '---'}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {r.student_name}
                      </td>
                      <td className="p-3 text-center min-w-[130px] w-36 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap shadow-2xs ${
                          isPassed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {r.score} / {r.max_score}
                        </span>
                      </td>
                      <td className="p-3 text-center font-medium text-slate-600">
                        {r.percentage}%
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        <span className="text-emerald-600 font-semibold">{r.correct_count}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-rose-600 font-semibold">{r.wrong_count}</span>
                      </td>
                      <td className="p-3 text-right text-slate-500">
                        {r.submitted_at ? new Date(r.submitted_at).toLocaleString('vi-VN') : '---'}
                      </td>
                      <td className="p-3 text-center min-w-[110px] w-28 whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Cho làm lại */}
                          <button
                            type="button"
                            onClick={() => handleOpenRetakeModal(r)}
                            title="Cho học sinh làm lại bài thi"
                            aria-label="Cho làm lại"
                            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>

                          {/* Xem nhật ký thi */}
                          <button
                            type="button"
                            onClick={() => handleOpenAuditModal(r)}
                            title="Xem nhật ký bài làm & chi tiết bài thi"
                            aria-label="Xem nhật ký"
                            className="p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:text-sky-900 border border-sky-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Xóa kết quả */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(r)}
                            title="Xóa kết quả thi của thí sinh"
                            aria-label="Xóa kết quả"
                            className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-900 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Xem nhật ký thi & Chi tiết bài làm */}
      <ExamAuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          setSelectedAuditLog(null);
        }}
        auditLog={selectedAuditLog}
        loading={loadingAuditLog}
        onAllowRetake={(code, attemptId) => {
          const target = results.find(
            (r) => r.attempt_id === attemptId || r.student_code === code
          );
          if (target) {
            handleOpenRetakeModal(target);
          }
        }}
      />

      {/* Modal Xác nhận Cho làm lại */}
      {isRetakeModalOpen && retakeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Cho làm lại bài thi</h3>
                <p className="text-xs text-slate-500">Cấp quyền để thí sinh bắt đầu lượt thi mới</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-600 leading-relaxed">
              <div className="flex justify-between py-1 border-b border-slate-200/60 font-medium">
                <span className="text-slate-500">Thí sinh:</span>
                <span className="font-bold text-slate-900">{retakeTarget.student_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 font-medium">
                <span className="text-slate-500">Mã HS / SBD:</span>
                <span className="font-mono font-bold text-slate-900">{retakeTarget.student_code || '---'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 font-medium">
                <span className="text-slate-500">Điểm hiện tại:</span>
                <span className="font-bold text-indigo-600">
                  {retakeTarget.score} / {retakeTarget.max_score} đ ({retakeTarget.percentage}%)
                </span>
              </div>

              <p className="pt-2 text-slate-600">
                Khi xác nhận, học sinh sẽ được <strong>mở khóa lượt thi</strong> để nhập lại mã phòng thi 
                <strong className="font-mono text-indigo-700 ml-1 px-1 bg-indigo-50 rounded border border-indigo-200">
                  {selectedSession?.access_code || '---'}
                </strong> và làm bài thi lại từ đầu.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isRetaking}
                onClick={() => {
                  setIsRetakeModalOpen(false);
                  setRetakeTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isRetaking}
                onClick={handleConfirmRetake}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:bg-indigo-400"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRetaking ? 'animate-spin' : ''}`} />
                <span>{isRetaking ? 'Đang xử lý...' : 'Xác nhận Cho làm lại'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa kết quả */}
      {isDeleteModalOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác nhận xóa kết quả thi</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 text-xs space-y-2 text-slate-700 leading-relaxed">
              <p>
                Bạn có chắc chắn muốn xóa vĩnh viễn kết quả thi của thí sinh:
              </p>
              <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-1">
                <div className="font-bold text-slate-900">{deleteTarget.student_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">Mã HS / SBD: {deleteTarget.student_code || '---'}</div>
                <div className="text-[11px] font-semibold text-rose-700">
                  Điểm số: {deleteTarget.score} / {deleteTarget.max_score} đ ({deleteTarget.percentage}%)
                </div>
              </div>
              <p className="text-rose-700 font-medium">
                Dữ liệu bài làm và điểm số sẽ bị xóa hoàn toàn khỏi bảng điểm và thống kê của kỳ thi.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:bg-rose-400"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
                <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận Xóa vĩnh viễn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
