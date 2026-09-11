import React, { useState } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, User, Shield, AlertCircle, CheckCircle2, Database, KeyRound, Sparkles } from 'lucide-react';
import { getSupabase, getCurrentProfile, isSupabaseConfigured, setActiveUserProfile } from '../lib/supabase';
import { Profile, UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: Profile) => void;
  onOpenConnectionModal?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onOpenConnectionModal,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const isDbConfigured = isSupabaseConfigured();

  const handleInstantDemoLogin = (type: 'admin' | 'toan' | 'van' | 'student') => {
    let demoProfile: Profile;
    if (type === 'admin') {
      demoProfile = {
        id: 'admin-001',
        user_id: 'admin-001',
        full_name: 'Quản trị viên Hệ thống (Admin)',
        email: 'admin@eduexam.com',
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else if (type === 'toan') {
      demoProfile = {
        id: 'demo-teacher-001',
        user_id: 'demo-teacher-001',
        full_name: 'Thầy Nguyễn Văn An (Toán)',
        email: 'giaovien.toan@eduexam.edu.vn',
        role: 'teacher',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else if (type === 'van') {
      demoProfile = {
        id: 'demo-teacher-002',
        user_id: 'demo-teacher-002',
        full_name: 'Cô Trần Thị Mai (Văn)',
        email: 'giaovien.van@eduexam.edu.vn',
        role: 'teacher',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      demoProfile = {
        id: 'demo-student-001',
        user_id: 'demo-student-001',
        full_name: 'Em Lê Văn Bình (Học sinh 12A1)',
        email: 'hocsinh.demo@eduexam.edu.vn',
        role: 'student',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    setActiveUserProfile(demoProfile);
    onAuthSuccess(demoProfile);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    const supabase = getSupabase();

    try {
      if (mode === 'login') {
        const cleanEmail = email.trim().toLowerCase();

        // 1. Check quick admin hardcoded credential in demo/fallback
        if (cleanEmail === 'admin@eduexam.com' && (password === '300506' || !isDbConfigured)) {
          const adminProfile: Profile = {
            id: 'admin-001',
            user_id: 'admin-001',
            full_name: 'Quản trị viên Hệ thống (Admin)',
            email: 'admin@eduexam.com',
            role: 'admin',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setActiveUserProfile(adminProfile);
          onAuthSuccess(adminProfile);
          onClose();
          return;
        }

        // 2. Check demo accounts fallback
        if (cleanEmail === 'giaovien.toan@eduexam.edu.vn' || cleanEmail === 'giaovien.van@eduexam.edu.vn' || cleanEmail === 'hocsinh.demo@eduexam.edu.vn') {
          const isToan = cleanEmail.includes('toan');
          const isVan = cleanEmail.includes('van');
          const demoProfile: Profile = {
            id: isToan ? 'demo-teacher-001' : isVan ? 'demo-teacher-002' : 'demo-student-001',
            user_id: isToan ? 'demo-teacher-001' : isVan ? 'demo-teacher-002' : 'demo-student-001',
            full_name: isToan ? 'Thầy Nguyễn Văn An (Toán)' : isVan ? 'Cô Trần Thị Mai (Văn)' : 'Em Lê Văn Bình (Học sinh)',
            email: cleanEmail,
            role: (isToan || isVan) ? 'teacher' : 'student',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setActiveUserProfile(demoProfile);
          onAuthSuccess(demoProfile);
          onClose();
          return;
        }

        // 3. Supabase Auth
        if (!isDbConfigured) {
          throw new Error('Chưa cấu hình Supabase Cloud. Hãy dùng các tài khoản mẫu bên dưới hoặc bấm nút "Cấu hình Supabase" để kết nối.');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email hoặc mật khẩu không chính xác.');
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư hoặc tắt Email Confirmation trong Supabase Auth Settings.');
          }
          throw new Error(error.message);
        }

        if (data.user) {
          const profile = await getCurrentProfile(data.user.id);
          if (profile) {
            if (profile.status === 'locked') {
              throw new Error('Tài khoản của bạn đã bị KHÓA bởi Quản trị viên hệ thống. Vui lòng liên hệ hỗ trợ.');
            }
            if (profile.status === 'inactive') {
              throw new Error('Tài khoản của bạn đang tạm ngừng hoạt động.');
            }
            setActiveUserProfile(profile);
            onAuthSuccess(profile);
            onClose();
          } else {
            // Fallback profile
            const fallback: Profile = {
              id: data.user.id,
              user_id: data.user.id,
              full_name: data.user.user_metadata?.full_name || email.split('@')[0],
              email: data.user.email || email,
              role: (data.user.user_metadata?.role as UserRole) || 'teacher',
              status: 'active',
              created_at: data.user.created_at,
              updated_at: data.user.created_at,
            };
            setActiveUserProfile(fallback);
            onAuthSuccess(fallback);
            onClose();
          }
        }
      } else if (mode === 'register') {
        if (!isDbConfigured) {
          throw new Error('Chưa kết nối Supabase Cloud để tạo tài khoản thật. Vui lòng cấu hình URL & Key trước.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              role,
            },
          },
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            throw new Error('Email này đã được đăng ký tài khoản. Vui lòng đăng nhập.');
          }
          if (error.message.includes('Password should be at least')) {
            throw new Error('Mật khẩu phải có độ dài ít nhất 6 ký tự.');
          }
          throw new Error(error.message);
        }

        if (data.user) {
          // If auto-confirmed
          if (data.session) {
            const profile: Profile = {
              id: data.user.id,
              user_id: data.user.id,
              full_name: fullName.trim() || email.split('@')[0],
              email: data.user.email || email,
              role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setActiveUserProfile(profile);
            onAuthSuccess(profile);
            onClose();
          } else {
            setInfoMsg('Đăng ký tài khoản thành công! Nếu dự án Supabase của bạn bật xác nhận email, vui lòng kiểm tra hộp thư đến.');
            setMode('login');
          }
        }
      } else if (mode === 'forgot') {
        if (!isDbConfigured) {
          throw new Error('Chưa kết nối Supabase Cloud.');
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {mode === 'login' ? 'Đăng nhập hệ thống' : mode === 'register' ? 'Đăng ký tài khoản mới' : 'Khôi phục mật khẩu'}
              </h3>
              <p className="text-xs text-slate-400">
                {isDbConfigured ? 'Supabase Authentication (Cloud)' : 'Chế độ Trải nghiệm (Demo & Supabase)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => { setMode('login'); setErrorMsg(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => { setMode('register'); setErrorMsg(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-colors ${
                mode === 'register'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng ký
            </button>
          </div>
        )}

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

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vai trò (Role)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      role === 'teacher'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Giáo viên / Quản lý
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      role === 'student'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Học sinh
                  </button>
                </div>
              </div>
            </>
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
                className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Mật khẩu
                </label>
                {mode === 'login' && isDbConfigured && (
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
                  className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Đang xử lý...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </>
            ) : mode === 'register' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Tạo tài khoản</span>
              </>
            ) : (
              <span>Gửi link đặt lại mật khẩu</span>
            )}
          </button>

          {/* Quick 1-Click Login Section */}
          {mode === 'login' && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Đăng nhập nhanh 1-Click (Demo):</span>
                </span>
                <span className="text-[10px] text-slate-400">Không cần gõ mật khẩu</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin('admin')}
                  className="p-2 text-left bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg border border-purple-200 transition-colors"
                >
                  <div className="font-bold text-xs flex items-center space-x-1">
                    <span>👑 Quản trị viên (Admin)</span>
                  </div>
                  <div className="text-[10px] text-purple-600 font-mono">admin@eduexam.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin('toan')}
                  className="p-2 text-left bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg border border-blue-200 transition-colors"
                >
                  <div className="font-bold text-xs flex items-center space-x-1">
                    <span>📐 Thầy An (Toán)</span>
                  </div>
                  <div className="text-[10px] text-blue-600 font-mono">giaovien.toan@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin('van')}
                  className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-200 transition-colors"
                >
                  <div className="font-bold text-xs flex items-center space-x-1">
                    <span>📖 Cô Mai (Văn)</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-mono">giaovien.van@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin('student')}
                  className="p-2 text-left bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors"
                >
                  <div className="font-bold text-xs flex items-center space-x-1">
                    <span>🎓 Em Bình (Học sinh)</span>
                  </div>
                  <div className="text-[10px] text-amber-600 font-mono">hocsinh.demo@...</div>
                </button>
              </div>
            </div>
          )}

          {/* Database Setup Helper Link */}
          {onOpenConnectionModal && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConnectionModal();
                }}
                className="inline-flex items-center space-x-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isDbConfigured ? 'Kiểm tra kết nối Supabase Cloud' : 'Nhập URL & Anon Key Supabase trực tiếp tại đây'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

