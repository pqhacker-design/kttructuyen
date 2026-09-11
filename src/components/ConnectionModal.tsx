import React, { useState } from 'react';
import { 
  X, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check,
  Download,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Server,
  FileCode,
  ChevronDown,
  ChevronUp,
  Terminal
} from 'lucide-react';
import { 
  getActiveSupabaseCredentials, 
  setCustomSupabaseCredentials, 
  testSupabaseConnection 
} from '../lib/supabase';
import schemaSql from '../database/schema.sql?raw';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
  onOpenMigration?: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onOpenMigration,
}) => {
  if (!isOpen) return null;

  const currentCreds = getActiveSupabaseCredentials();
  const [url, setUrl] = useState(currentCreds.url || '');
  const [key, setKey] = useState(currentCreds.key || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tablesFound?: boolean;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(url.trim() || undefined, key.trim() || undefined);
      setTestResult(res);
      // Auto open SQL viewer if tables are missing so user can copy right away
      if (res.tablesFound === false) {
        setShowSqlViewer(true);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Lỗi không xác định khi kết nối.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setCustomSupabaseCredentials(url.trim(), key.trim());
    setSavedSuccess(true);
    if (onConfigSaved) {
      onConfigSaved();
    }
    setTimeout(() => setSavedSuccess(false), 3000);
    handleTest();
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([schemaSql], { type: 'text/sql;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'edusam_supabase_schema.sql');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Cấu hình kết nối Supabase Cloud</h3>
              <p className="text-xs text-slate-400">PostgreSQL Database, Auth & Row Level Security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status banner */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
            currentCreds.isConfigured 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {currentCreds.isConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              <p className="font-semibold">
                {currentCreds.isConfigured
                  ? 'Ứng dụng đã được cấu hình với Supabase Cloud'
                  : 'Chưa cấu hình API Key của Supabase'}
              </p>
              <p className="text-xs mt-0.5 text-slate-600 leading-relaxed">
                Khi chưa có Supabase, hệ thống tự động chạy ở <strong>Chế độ Nội bộ / Demo (Offline)</strong> không bị gián đoạn. Để đồng bộ dữ liệu thực tế và phân quyền giáo viên, hãy nhập thông tin bên dưới.
              </p>
            </div>
          </div>

          {/* Form inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project URL (NEXT_PUBLIC_SUPABASE_URL)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project API Key / Anon Key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Chỉ sử dụng <strong>anon/public key</strong>. Tuyệt đối không nhập service_role key trên trình duyệt.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
              >
                Lưu cấu hình
              </button>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
              </button>

              {savedSuccess && (
                <span className="text-xs text-emerald-600 font-medium">✓ Đã lưu thành công!</span>
              )}
            </div>
          </div>

          {/* Test result display */}
          {testResult && (
            <div className={`p-4 rounded-xl text-sm border space-y-3 ${
              testResult.success
                ? testResult.tablesFound === false
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-start space-x-2.5">
                {testResult.success ? (
                  testResult.tablesFound === false ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-sm">{testResult.message}</p>
                </div>
              </div>

              {testResult.tablesFound === false && (
                <div className="bg-white/80 rounded-lg p-3.5 border border-amber-200 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-amber-700" />
                      Khởi tạo Database Schema (Chỉ 1 phút)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopySql}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
                      >
                        {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadSql}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                        title="Tải file .sql về máy"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Tải file .sql</span>
                      </button>
                    </div>
                  </div>

                  <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed bg-amber-50/50 p-2.5 rounded-md">
                    <li>
                      Mở <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline inline-flex items-center">Supabase SQL Editor <ExternalLink className="w-3 h-3 ml-0.5" /></a> trên trình duyệt.
                    </li>
                    <li>
                      Bấm nút <strong>New query</strong> (hoặc biểu tượng dấu cộng <code className="bg-slate-200 px-1 rounded text-slate-800">+</code>).
                    </li>
                    <li>
                      Dán (Paste) đoạn mã SQL vừa sao chép vào ô soạn thảo.
                    </li>
                    <li>
                      Bấm nút <strong>Run</strong> (màu xanh lá) để khởi tạo các bảng và các hàm chấm thi.
                    </li>
                    <li>
                      Quay lại đây và bấm nút <strong>Kiểm tra kết nối</strong> ở trên để hoàn tất!
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Quick SQL Schema Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60">
            <button
              type="button"
              onClick={() => setShowSqlViewer(!showSqlViewer)}
              className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Mã nguồn khởi tạo Database (Schema SQL Migration)
                </span>
                <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                  826 dòng
                </span>
              </div>
              <div className="flex items-center space-x-1 text-slate-500 text-xs">
                <span>{showSqlViewer ? 'Thu gọn' : 'Xem & Sao chép'}</span>
                {showSqlViewer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showSqlViewer && (
              <div className="p-4 border-t border-slate-200 bg-slate-900 text-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">
                    supabase/schema.sql (18 bảng, RLS, Indexes, Triggers & RPCs)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép toàn bộ'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSql}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải file</span>
                    </button>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 select-all">
                  <pre className="whitespace-pre">{schemaSql}</pre>
                </div>
              </div>
            )}
          </div>

          {/* 3 Steps Guide */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Hướng dẫn lấy thông tin từ Supabase Dashboard
            </h4>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Truy cập <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium inline-flex items-center">Supabase Dashboard <ExternalLink className="w-3 h-3 ml-0.5" /></a> và tạo hoặc mở một dự án.
              </li>
              <li>
                Vào <strong>Project Settings → API</strong> (hoặc biểu tượng bánh răng ⚙️ ➜ API) để lấy <strong>Project URL</strong> và <strong>anon public key</strong>, dán vào 2 ô ở trên.
              </li>
              <li>
                Vào <strong>SQL Editor</strong> trên Supabase, bấm <strong>New Query</strong>, dán mã SQL ở phần trên và nhấn <strong>Run</strong> để hoàn tất khởi tạo.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopySql}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1.5"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Đã sao chép mã SQL vào bộ nhớ đệm' : 'Sao chép mã SQL khởi tạo bảng'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

