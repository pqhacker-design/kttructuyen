import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Lock, 
  EyeOff, 
  Layers, 
  FileCheck, 
  ChevronDown, 
  ChevronUp, 
  Server,
  Zap
} from 'lucide-react';
import { runUserIsolationTests, UserIsolationReport } from '../services/userService';

export const UserIsolationTestView: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<UserIsolationReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});

  const handleRunTests = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      const data = await runUserIsolationTests();
      setReport(data);
      // Auto expand first failed or first 2 items
      const initialExpanded: Record<string, boolean> = {};
      data.results.forEach((r, idx) => {
        if (idx < 3 || r.status === 'failed') {
          initialExpanded[r.id] = true;
        }
      });
      setExpandedTests(initialExpanded);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi chạy bộ kiểm thử phân quyền.');
    } finally {
      setRunning(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTests((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <span>Kiểm thử Cô lập Dữ liệu (USER_ISOLATION_TEST)</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  RLS Security Suite
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kiểm thử tự động Row Level Security (RLS) để chứng minh User A không thể nhìn thấy, sửa, xóa dữ liệu của User B.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRunTests}
          disabled={running}
          className="inline-flex items-center space-x-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
        >
          {running ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{running ? 'Đang thực thi kiểm thử...' : 'Chạy Bộ Kiểm Thử RLS'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border bg-rose-50 text-rose-800 border-rose-200 flex items-center space-x-2 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary Stats Banner if report exists */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-400 uppercase">Trạng thái tổng thể</div>
            <div className="mt-1 flex items-center space-x-2">
              {report.overallStatus === 'PASSED' ? (
                <span className="inline-flex items-center space-x-1.5 text-emerald-700 font-bold text-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>HOÀN TOÀN ĐẠT (PASSED)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 text-rose-700 font-bold text-lg">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>CÓ LỖI (FAILED)</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Thời gian chạy: {report.durationMs}ms
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-400 uppercase">Kịch bản kiểm thử</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {report.passedCount} / {report.total}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">
              {report.passedCount === report.total ? '100% kịch bản thành công' : `${report.failedCount} kịch bản chưa đạt`}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-400 uppercase">Môi trường thực thi</div>
            <div className="mt-1 text-sm font-bold text-indigo-700 font-mono flex items-center space-x-1.5">
              <Server className="w-4 h-4" />
              <span>{report.environment}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Chính sách RLS cấp cơ sở dữ liệu
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-400 uppercase">Ngăn chặn chéo Tenant</div>
            <div className="mt-1 text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>Tuyệt đối an toàn</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Không rò rỉ id, câu hỏi, đề thi
            </div>
          </div>
        </div>
      )}

      {/* Test Matrix List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Các tiêu chí kiểm thử Phân quyền & Cô lập dữ liệu
            </h3>
          </div>
          {report && (
            <span className="text-xs font-mono text-slate-400">
              Cập nhật: {new Date(report.timestamp).toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>

        {!report && !running && (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Bộ kiểm thử USER_ISOLATION_TEST chưa chạy</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Nhấn nút "Chạy Bộ Kiểm Thử RLS" ở trên để hệ thống tự động kiểm tra cách ly dữ liệu giữa User A, User B và Admin.
            </p>
          </div>
        )}

        {running && (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="font-semibold text-slate-800">Đang chạy kịch bản kiểm thử phân quyền...</p>
            <p className="text-xs text-slate-400">Đang kiểm tra SELECT, INSERT, UPDATE, DELETE qua các user khác nhau.</p>
          </div>
        )}

        {report && (
          <div className="divide-y divide-slate-100">
            {report.results.map((test) => {
              const isExpanded = !!expandedTests[test.id];
              return (
                <div key={test.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div 
                    onClick={() => toggleExpand(test.id)}
                    className="flex items-start justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {test.status === 'passed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                            {test.id}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{test.name}</span>
                          <span className="text-xs text-slate-400 font-mono">({test.durationMs}ms)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{test.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 ml-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          test.status === 'passed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {test.status === 'passed' ? 'PASSED' : 'FAILED'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pl-8 pr-2 pt-2 text-xs space-y-2 border-t border-slate-100">
                      {test.details && (
                        <div className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-sans leading-relaxed">
                          <span className="font-semibold text-slate-900">Kết quả xác minh: </span>
                          {test.details}
                        </div>
                      )}

                      {test.evidence && (
                        <div>
                          <span className="font-semibold text-slate-600 block mb-1">
                            Bằng chứng thực thi (Execution Evidence):
                          </span>
                          <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                            {JSON.stringify(test.evidence, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RLS Technical Specification Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h4 className="font-bold text-sm text-white">
              Cơ chế Bảo vệ & Phân quyền RLS trong EduExam
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">PostgreSQL Row-Level Security</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1.5">
            <div className="font-bold text-indigo-300">1. Đơn lập Multi-Tenancy Logic</div>
            <p className="text-slate-400 leading-relaxed">
              Mọi bảng dữ liệu (classes, exams, questions, matrices) đều mang trường <code className="text-emerald-400">user_id</code> / <code className="text-emerald-400">owner_id</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1.5">
            <div className="font-bold text-indigo-300">2. RLS Chặn ở Database Engine</div>
            <p className="text-slate-400 leading-relaxed">
              Kể cả người dùng có sửa client hay gửi trực tiếp ID của người khác, PostgreSQL tự động trả về 0 hàng hoặc Access Denied.
            </p>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1.5">
            <div className="font-bold text-indigo-300">3. An toàn Phòng thi Liên thiết bị</div>
            <p className="text-slate-400 leading-relaxed">
              Mã phòng thi cho phép học sinh trên điện thoại/máy tính khác làm bài mà không thể nhìn thấy đáp án hay dữ liệu của giáo viên.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
