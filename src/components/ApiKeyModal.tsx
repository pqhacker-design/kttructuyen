import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, Sparkles, ExternalLink, Trash2, ShieldAlert, Cpu } from 'lucide-react';
import { getUserApiKey, setUserApiKey, clearUserApiKey, testGeminiApiKey, getMaskedApiKey } from '../services/apiKeyService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(getUserApiKey());
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentKey = getUserApiKey();
  const isConfigured = !!currentKey;

  const handleTest = async () => {
    if (!apiKeyInput.trim()) {
      setTestResult({ success: false, message: 'Vui lòng nhập API Key trước khi kiểm tra.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKey(apiKeyInput.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Lỗi khi kiểm tra kết nối API.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!apiKeyInput.trim()) {
      setTestResult({ success: false, message: 'Vui lòng nhập API Key trước khi lưu.' });
      return;
    }
    setUserApiKey(apiKeyInput.trim());
    setSaveSuccess(true);
    setTestResult(null);
    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
      setSaveSuccess(false);
    }, 1200);
  };

  const handleRemove = () => {
    clearUserApiKey();
    setApiKeyInput('');
    setTestResult(null);
    setSaveSuccess(false);
    if (onSaved) onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">Cấu hình Gemini API Key Cá Nhân</h3>
              <p className="text-xs text-indigo-200">Bắt buộc tự nhập khóa API riêng để ra đề bằng AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Policy banner */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start space-x-2.5 text-xs text-amber-900 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">Quy định sử dụng API:</p>
              <p className="mt-0.5">
                Hệ thống <strong>không sử dụng chung API</strong> để bảo đảm hạn mức riêng biệt và tính độc lập của từng giáo viên/người dùng. Bạn cần tự nhập Google Gemini API Key của mình để thực hiện sinh đề thi và tạo câu hỏi tự động.
              </p>
            </div>
          </div>

          {/* Current Key Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600 font-medium">Trạng thái cấu hình hiện tại:</span>
            {isConfigured ? (
              <span className="inline-flex items-center space-x-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã lưu ({getMaskedApiKey(currentKey)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Chưa cấu hình API Key</span>
              </span>
            )}
          </div>

          {/* Input field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Google Gemini API Key <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setTestResult(null);
                  setSaveSuccess(false);
                }}
                placeholder="Dán mã API Key của bạn (bắt đầu bằng AIzaSy...)"
                className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Khóa được mã hóa lưu cục bộ trên trình duyệt của bạn.</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <span>Lấy API Key miễn phí</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* Test results banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start space-x-2 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">Đã lưu API Key thành công! Đang đóng cửa sổ...</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
            {isConfigured ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={testing}
                className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-center space-x-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa API Key này</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !apiKeyInput.trim()}
                className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-xl border border-indigo-200 flex items-center space-x-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={testing || !apiKeyInput.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <span>Lưu cấu hình</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
