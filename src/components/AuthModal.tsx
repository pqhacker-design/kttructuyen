import React, { useState, useEffect } from 'react';
import { LogIn, Mail, Lock, Shield, AlertCircle, CheckCircle2, GraduationCap, ArrowRight } from 'lucide-react';
import { getSupabase, getCurrentProfile, isSupabaseConfigured, setActiveUserProfile, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD } from '../lib/supabase';
import { Profile, UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: Profile) => void;
  isRequired?: boolean;
  onStudentDirectExam?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  isRequired = false,
  onStudentDirectExam,
}) => {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const isDbConfigured = isSupabaseConfigured();

  // If initial admin is configured in env, pre-fill email if empty for convenience
  useEffect(() => {
    if (INITIAL_ADMIN_EMAIL && !email) {
      setEmail(INITIAL_ADMIN_EMAIL);
    }
    if (INITIAL_ADMIN_PASSWORD && !password) {
      setPassword(INITIAL_ADMIN_PASSWORD);
    }
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    const supabase = getSupabase();

    try {
      if (!isDbConfigured) {
        throw new Error('Chưa cấu hình Supabase Cloud. Vui lòng thêm biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào Vercel (hoặc .env) để đăng nhập.');
      }

      const cleanEmail = email.trim().toLowerCase();

      if (mode === 'login') {
        // Step 1: Attempt standard Supabase login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        // Step 2: Handle login failure
        if (error) {
          const isInvalidCredentials = error.message.includes('Invalid login credentials');
          const isAdminAttempt = cleanEmail === INITIAL_ADMIN_EMAIL.toLowerCase();

          // If it is the initial admin account or the account doesn't exist yet on a fresh Supabase instance,
          // automatically attempt first-time bootstrap registration via Supabase Auth
          if (isInvalidCredentials && isAdminAttempt) {
            console.info('[Auth] Admin credentials not found in Supabase Auth. Attempting auto-bootstrap registration...');
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: {
                  full_name: 'Quản trị viên Hệ thống',
                  role: 'admin',
                },
              },
            });

            if (!signUpError && signUpData.user) {
              if (signUpData.session) {
                // User was registered and auto-confirmed!
                const adminProfile: Profile = {
                  id: signUpData.user.id,
                  user_id: signUpData.user.id,
                  full_name: 'Quản trị viên Hệ thống',
                  email: cleanEmail,
                  role: 'admin',
                  status: 'active',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                // Upsert to profiles table
                try {
                  await supabase.from('profiles').upsert([adminProfile]);
                } catch (pe) {
                  console.warn('[Auth] Upsert admin profile notice:', pe);
                }

                setActiveUserProfile(adminProfile);
                onAuthSuccess(adminProfile);
                onClose();
                return;
              } else {
                // Email confirmation is required by Supabase project settings
                setInfoMsg('Tài khoản Quản trị viên đã được tạo trên Supabase! Do dự án đang bật "Confirm email", vui lòng kiểm tra email để bấm link kích hoạt, hoặc vào Supabase Dashboard > Authentication > Providers > Email để tắt "Confirm email" rồi đăng nhập lại.');
                return;
              }
            }
          }

          if (isInvalidCredentials) {
            throw new Error('Email hoặc mật khẩu không chính xác. Nếu là tài khoản mới, bạn có thể bấm tab "Đăng ký" bên trên.');
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư hoặc vào Supabase Dashboard > Authentication > Providers > Email để tắt "Confirm email".');
          }
          throw new Error(error.message);
        }

        // Step 3: Login succeeded
        if (data.user) {
          let profile = await getCurrentProfile(data.user.id);
          
          if (!profile) {
            // Fallback profile row
            const isAdmin = cleanEmail === INITIAL_ADMIN_EMAIL.toLowerCase() || data.user.user_metadata?.role === 'admin';
            profile = {
              id: data.user.id,
              user_id: data.user.id,
              full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              email: data.user.email || cleanEmail,
              role: isAdmin ? 'admin' : ((data.user.user_metadata?.role as UserRole) || 'teacher'),
              status: 'active',
              created_at: data.user.created_at,
              updated_at: data.user.created_at,
            };

            try {
              await supabase.from('profiles').upsert([profile]);
            } catch (err) {
              // Ignore profile insert errors
            }
          }

          if (profile.status === 'locked') {
            throw new Error('Tài khoản của bạn đã bị KHÓA bởi Quản trị viên hệ thống. Vui lòng liên hệ hỗ trợ.');
          }
          if (profile.status === 'inactive') {
            throw new Error('Tài khoản của bạn đang tạm ngừng hoạt động.');
          }

          setActiveUserProfile(profile);
          onAuthSuccess(profile);
          onClose();
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (error) throw new Error(error.message);
        setInfoMsg('Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư.');
        setMode('login');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight">
                {mode === 'login' ? 'Đăng nhập EduExam' : 'Khôi phục Mật khẩu'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Nền tảng Quản lý & Thi Trực tuyến GDPT 2018
              </p>
            </div>
          </div>
          {!isRequired && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Notice for centralized account administration */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-medium">Tài khoản quản trị tập trung bởi Admin</span>
          </div>
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
            >
              ← Quay lại Đăng nhập
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@eduexam.com hoặc email giáo viên"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Mật khẩu
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setErrorMsg(null); }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center justify-center space-x-2 mt-2"
          >
            {loading ? (
              <span>Đang kết nối Supabase...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </>
            ) : (
              <span>Gửi link đặt lại mật khẩu</span>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Người dùng chỉ được tạo bởi tài khoản quản trị viên (Admin). Nếu chưa có tài khoản, vui lòng liên hệ Admin nhà trường.
          </p>

          {/* Student direct entry shortcut */}
          {onStudentDirectExam && (
            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  if (!isRequired) onClose();
                  onStudentDirectExam();
                }}
                className="inline-flex items-center space-x-1.5 text-xs text-slate-600 hover:text-indigo-600 font-medium py-1 transition-colors"
              >
                <span>Bạn là Học sinh? Vào thi trực tiếp bằng Mã phòng thi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
