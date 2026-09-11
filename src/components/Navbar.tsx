import React from 'react';
import { 
  GraduationCap, 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  Database, 
  FileCode2, 
  KeyRound, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Menu
} from 'lucide-react';
import { Profile } from '../types';
import { getActiveSupabaseCredentials, signOut } from '../lib/supabase';

interface NavbarProps {
  currentProfile: Profile | null;
  onOpenAuth: () => void;
  onSignOut?: () => void;
  onOpenConnectionModal: () => void;
  onOpenMigrationModal?: () => void;
  onJoinExamClick?: () => void;
  onOpenStudentJoin?: () => void;
  onOpenMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  onOpenAuth,
  onSignOut,
  onOpenConnectionModal,
  onOpenMigrationModal,
  onJoinExamClick,
  onOpenStudentJoin,
  onOpenMobileSidebar,
}) => {
  const { isConfigured } = getActiveSupabaseCredentials();

  const handleJoinClick = () => {
    if (onJoinExamClick) onJoinExamClick();
    else if (onOpenStudentJoin) onOpenStudentJoin();
  };

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
      window.location.reload();
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 shadow-2xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Mobile Menu Button & Brand/Context */}
        <div className="flex items-center space-x-2.5">
          {/* Mobile Hamburger Drawer Trigger */}
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 -ml-1.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
            title="Mở menu chức năng"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-indigo-200 md:hidden">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">EduExam</span>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Supabase Cloud
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Khảo thí & Tạo đề chuẩn GDPT với AI</p>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Join Exam Button */}
          <button
            onClick={handleJoinClick}
            id="nav-btn-join-exam"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            <span>Vào thi bằng mã</span>
          </button>

          {/* User Auth Info */}
          {currentProfile ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {currentProfile.full_name}
                </p>
                <div className="flex items-center justify-end space-x-1 mt-0.5">
                  <span className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded text-indigo-700 bg-indigo-50 border border-indigo-100 capitalize">
                    {currentProfile.role === 'teacher' ? 'Giáo viên' : currentProfile.role === 'student' ? 'Học sinh' : 'Quản trị viên'}
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-sm shadow-2xs">
                {currentProfile.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {/* Switch account / Login button */}
              <button
                onClick={onOpenAuth}
                id="nav-btn-switch-user"
                title="Đổi tài khoản / Đăng nhập tài khoản khác"
                className="flex items-center space-x-1 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Đổi TK</span>
              </button>
              <button
                onClick={handleSignOut}
                id="nav-btn-logout"
                title="Đăng xuất"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              id="nav-btn-login"
              className="flex items-center space-x-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
