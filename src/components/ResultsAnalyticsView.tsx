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
  FileSpreadsheet
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
import { ExamSession, ExamResult, Profile } from '../types';
import { fetchExamSessions } from '../services/sessionService';
import { fetchResultsBySession, calculateSessionAnalytics } from '../services/resultService';

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
  const [searchQuery, setSearchQuery] = useState('');

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
      const sList = await fetchExamSessions(currentProfile?.user_id);
      setSessions(sList);
      if (sList.length > 0 && !selectedSessionId) {
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

        <div className="flex items-center space-x-2">
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
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

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
                  <th className="p-3 text-center">Điểm số</th>
                  <th className="p-3 text-center">Tỷ lệ</th>
                  <th className="p-3 text-center">Đúng / Sai</th>
                  <th className="p-3 text-right">Thời gian nộp</th>
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
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
