import React, { useState } from 'react';
import { 
  Database, 
  Copy, 
  Check, 
  Download, 
  ShieldCheck, 
  Layers, 
  ExternalLink, 
  Terminal, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import schemaSql from '../database/schema.sql?raw';
import { getActiveSupabaseCredentials, testSupabaseConnection } from '../lib/supabase';

export const SQLSchemaView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const creds = getActiveSupabaseCredentials();

  const handleCopy = () => {
    navigator.clipboard.writeText(schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([schemaSql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eduexam_schema_rls.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <span>PostgreSQL Database Schema & RLS Policies</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Supabase RLS Ready
                </span>
              </h1>
              <p className="text-sm text-slate-500">
                Toàn bộ cấu trúc cơ sở dữ liệu PostgreSQL, mã kích hoạt người dùng mới, và chính sách bảo vệ phân quyền Row-Level Security.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Đã sao chép SQL!' : 'Sao chép SQL'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Tải tệp .sql</span>
          </button>
        </div>
      </div>

      {/* Connection Status Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase">Trạng thái kết nối Supabase</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${creds.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{creds.isConfigured ? 'Đã kết nối Supabase Cloud' : 'Chế độ CSDL nội bộ / Demo'}</span>
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            {creds.url || 'http://0.0.0.0:3000 (Local RLS Sandbox)'}
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          {testing ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối'}
        </button>
      </div>

      {testResult && (
        <div className={`p-4 rounded-xl border flex items-center space-x-2 text-sm ${testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Schema Viewer */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950 text-slate-300 text-xs font-mono flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>src/database/schema.sql (PostgreSQL 15+ & Supabase RLS)</span>
          </div>
          <span>{schemaSql.split('\n').length} dòng mã SQL</span>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed select-all">
          {schemaSql}
        </pre>
      </div>
    </div>
  );
};
