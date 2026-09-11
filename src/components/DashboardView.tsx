import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  HelpCircle, 
  Radio, 
  Users, 
  Plus, 
  KeyRound, 
  Copy, 
  Check, 
  ArrowRight, 
  Sparkles,
  Calendar,
  Clock,
  Award,
  BarChart3
} from 'lucide-react';
import { Exam, ExamSession, ExamResult, Profile } from '../types';
import { fetchExams } from '../services/examService';
import { fetchExamSessions } from '../services/sessionService';
import { fetchQuestionBanks, seedDefaultEducationalData } from '../services/questionService';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  currentProfile: Profile | null;
  onNavigate: (tab: NavTab) => void;
  onJoinExamWithCode: (code: string) => void;
  onOpenAuth: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentProfile,
  onNavigate,
  onJoinExamWithCode,
  onOpenAuth,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [bankCount, setBankCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [quickCode, setQuickCode] = useState('');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [currentProfile]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [exList, sesList, bList] = await Promise.all([
        fetchExams(currentProfile?.user_id),
        fetchExamSessions(currentProfile?.user_id),
        fetchQuestionBanks(currentProfile?.user_id),
      ]);
      setExams(exList);
      setSessions(sesList);
      setBankCount(bList.length);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSeedData = async () => {
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    setSeeding(true);
    try {
      await seedDefaultEducationalData(currentProfile.user_id);
      await loadDashboardData();
    } catch (err: any) {
      alert('Lỗi nạp dữ liệu mẫu: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <div className="space-y-6">
      {/* Top Banner / Student Fast-Join */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Hệ thống khảo thí chuẩn Bộ GD&ĐT</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Khảo thí Trực tuyến, Ma trận đề & Chấm điểm Tự động
          </h1>
          <p className="text-sm sm:text-base text-indigo-100/90 mt-2 leading-relaxed">
            Học sinh có thể làm bài từ bất kỳ thiết bị nào qua mã kỳ thi. Mọi kết quả, câu hỏi và đáp án được lưu trữ persistent và bảo mật trên Supabase PostgreSQL.
          </p>

          {/* Quick Access Code Box */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã kỳ thi (VD: TOAN10A, HK1)..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-indigo-200/60 font-mono text-base tracking-wider focus:outline-hidden focus:ring-2 focus:ring-white/40 uppercase"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickCode.trim()) {
                    onJoinExamWithCode(quickCode.trim());
                  }
                }}
              />
            </div>
            <button
              onClick={() => {
                if (quickCode.trim()) onJoinExamWithCode(quickCode.trim());
              }}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center space-x-2 shrink-0"
            >
              <span>Vào phòng thi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đề thi</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{exams.length}</p>
          <div className="flex items-center space-x-1 mt-1 text-xs text-slate-500">
            <span>Đã tạo trong hệ thống</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngân hàng câu hỏi</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{bankCount}</p>
          <div className="flex items-center space-x-1 mt-1 text-xs text-slate-500">
            <span>Bộ câu hỏi theo môn</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kỳ thi đang mở</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-3">{activeSessions.length}</p>
          <div className="flex items-center space-x-1 mt-1 text-xs text-slate-500">
            <span>Sẵn sàng cho học sinh vào thi</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số kỳ thi</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{sessions.length}</p>
          <div className="flex items-center space-x-1 mt-1 text-xs text-slate-500">
            <span>Bao gồm cả các đợt đã đóng</span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">Thao tác nhanh dành cho Giáo viên:</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('ai-generator')}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Tạo đề bằng AI (CV 7991)</span>
          </button>

          <button
            onClick={() => onNavigate('exams')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Soạn đề thủ công</span>
          </button>

          <button
            onClick={() => onNavigate('sessions')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Tạo kỳ thi / Mã phòng</span>
          </button>

          <button
            onClick={() => onNavigate('matrices')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <span>Thiết lập ma trận</span>
          </button>

          {bankCount === 0 && (
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{seeding ? 'Đang nạp dữ liệu...' : 'Nạp câu hỏi mẫu chuẩn GDPT'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Exam Sessions List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <h3 className="font-bold text-slate-900 text-base">Kỳ thi đang mở (Mã phòng thi trực tuyến)</h3>
          </div>
          <button
            onClick={() => onNavigate('sessions')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Quản lý kỳ thi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-3">
            <Radio className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm">Hiện chưa có kỳ thi nào đang mở.</p>
            <button
              onClick={() => onNavigate('sessions')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Tạo kỳ thi và mã tham gia ngay
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-base">{session.title}</span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Đang nhận bài
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span className="flex items-center space-x-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{session.exam_title || 'Đề thi chuẩn'}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{session.duration_minutes} phút</span>
                    </span>
                  </div>
                </div>

                {/* Access code & action buttons */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 font-mono">
                    <span className="text-xs text-slate-500">Mã:</span>
                    <span className="text-sm font-bold text-slate-900 tracking-wider">
                      {session.access_code}
                    </span>
                    <button
                      onClick={() => handleCopyCode(session.access_code)}
                      className="p-1 text-slate-400 hover:text-slate-800 rounded transition-colors"
                      title="Sao chép mã phòng"
                    >
                      {copiedCode === session.access_code ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => onJoinExamWithCode(session.access_code)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center space-x-1"
                  >
                    <span>Làm bài</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
