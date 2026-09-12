import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ShieldCheck, X } from 'lucide-react';
import { Profile } from '../types';
import { changeUserSelfPassword } from '../services/userService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: Profile | null;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const getPasswordStrength = (pass: string): { label: string; color: string; width: string } => {
    if (!pass) return { label: 'Chưa nhập', color: 'bg-slate-200', width: '0%' };
    if (pass.length < 6) return { label: 'Quá ngắn (ít nhất 6 ký tự)', color: 'bg-rose-500', width: '25%' };
    
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { label: 'Yếu', color: 'bg-amber-500', width: '40%' };
    if (score === 2) return { label: 'Trung bình', color: 'bg-indigo-500', width: '70%' };
    return { label: 'Mạnh', color: 'bg-emerald-500', width: '100%' };
  };

  const strength = getPasswordStrength(newPassword);
  const isMatch = newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    if (!currentProfile) {
      setErrorMsg('Vui lòng đăng nhập để đổi mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const userId = currentProfile.user_id || currentProfile.id;
      await changeUserSelfPassword(userId, currentProfile.email, newPassword);
      setSuccessMsg('Đổi mật khẩu thành công! Bạn có thể dùng mật khẩu mới này ở các lần đăng nhập tiếp theo.');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">Đổi mật khẩu tài khoản</h3>
              <p className="text-xs text-indigo-200">Cập nhật mật khẩu đăng nhập an toàn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User context summary */}
        {currentProfile && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">
                {currentProfile.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{currentProfile.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate">{currentProfile.email}</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize shrink-0">
              {currentProfile.role === 'admin' ? 'Quản trị viên' : currentProfile.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* New password input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNewPass ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập tối thiểu 6 ký tự..."
                className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength meter */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Độ an toàn:</span>
                  <span className="font-semibold">{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm new password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPass ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className={`w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 bg-white ${
                  confirmPassword
                    ? isMatch
                      ? 'border-emerald-500 focus:ring-emerald-500'
                      : 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {confirmPassword && (
              <div className="mt-1 flex items-center space-x-1 text-[11px]">
                {isMatch ? (
                  <span className="text-emerald-600 flex items-center space-x-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mật khẩu trùng khớp</span>
                  </span>
                ) : (
                  <span className="text-rose-500 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Mật khẩu xác nhận chưa khớp</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start space-x-2 text-[11px] text-indigo-900">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              Mật khẩu mới sẽ được cập nhật đồng bộ lên hệ thống xác thực. Bạn nên sử dụng mật khẩu có kết hợp chữ và số để tăng độ an toàn.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword || newPassword.length < 6 || !isMatch}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{loading ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
