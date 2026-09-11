import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Sparkles,
  Library, 
  Table2, 
  Files, 
  ClipboardCheck, 
  ChartNoAxesCombined, 
  School, 
  UserCog, 
  ShieldCheck, 
  Database,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  GraduationCap,
  X,
  User,
  LogOut,
  ChevronDown,
  CloudCog,
  KeyRound
} from 'lucide-react';
import { UserRole, Profile } from '../types';

export type NavTab = 
  | 'dashboard'
  | 'ai-generator'
  | 'questions'
  | 'matrices'
  | 'exams'
  | 'sessions'
  | 'results'
  | 'classes'
  | 'admin-users'
  | 'user-isolation-test'
  | 'sql';

export interface SidebarProps {
  currentTab?: NavTab;
  activeTab?: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole?: UserRole;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  currentProfile?: Profile | null;
  onOpenAuth?: () => void;
  onOpenConnectionModal?: () => void;
  onSignOut?: () => void;
}

interface MenuItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeType?: 'ai' | 'session' | 'admin' | 'test' | 'rls';
  roles?: UserRole[];
  highlight?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
  roles?: UserRole[];
  dividerBefore?: boolean;
  isSystem?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  userRole = 'teacher',
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  currentProfile,
  onOpenAuth,
  onOpenConnectionModal,
  onSignOut,
}) => {
  // Support both currentTab and activeTab prop names
  const selectedTab: NavTab = activeTab || currentTab || 'dashboard';
  const currentRole: UserRole = (userRole as UserRole) || 'teacher';

  // Internal collapse state fallback if not controlled
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  // User Profile popup state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuGroups: MenuGroup[] = [
    {
      title: 'Trang chủ',
      items: [
        { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Tạo đề & Ngân hàng',
      items: [
        { 
          id: 'ai-generator', 
          label: 'Tạo đề bằng AI', 
          icon: Sparkles, 
          badge: 'CV 7991', 
          badgeType: 'ai',
          highlight: true, 
          roles: ['teacher', 'admin'] 
        },
        { id: 'questions', label: 'Ngân hàng câu hỏi', icon: Library, roles: ['teacher', 'admin'] },
        { id: 'matrices', label: 'Ma trận & Đặc tả', icon: Table2, roles: ['teacher', 'admin'] },
        { id: 'exams', label: 'Quản lý Đề thi', icon: Files, roles: ['teacher', 'admin'] },
      ],
    },
    {
      title: 'Tổ chức thi',
      items: [
        { 
          id: 'sessions', 
          label: 'Kỳ thi & Mã tham gia', 
          icon: ClipboardCheck, 
          badge: 'Phòng thi', 
          badgeType: 'session',
          roles: ['teacher', 'admin'] 
        },
        { id: 'results', label: 'Kết quả & Thống kê', icon: ChartNoAxesCombined },
      ],
    },
    {
      title: 'Dữ liệu học sinh',
      items: [
        { id: 'classes', label: 'Lớp học & Học sinh', icon: School, roles: ['teacher', 'admin'] },
      ],
    },
    {
      title: 'Quản trị',
      roles: ['admin'],
      dividerBefore: true,
      items: [
        { 
          id: 'admin-users', 
          label: 'Quản lý Tài khoản', 
          icon: UserCog, 
          badge: 'Admin', 
          badgeType: 'admin',
          roles: ['admin'] 
        },
      ],
    },
  ];

  const renderBadge = (badge: string, type?: MenuItem['badgeType'], isActive?: boolean) => {
    if (isActive) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs whitespace-nowrap">
          {badge}
        </span>
      );
    }

    switch (type) {
      case 'ai':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200/70 whitespace-nowrap">
            {badge}
          </span>
        );
      case 'session':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/70 whitespace-nowrap">
            {badge}
          </span>
        );
      case 'admin':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/70 whitespace-nowrap">
            {badge}
          </span>
        );
      case 'test':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200/70 whitespace-nowrap">
            {badge}
          </span>
        );
      case 'rls':
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70 whitespace-nowrap">
            {badge}
          </span>
        );
    }
  };

  const handleItemClick = (id: NavTab) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const roleName = currentProfile?.role === 'admin' 
    ? 'Quản trị hệ thống' 
    : currentProfile?.role === 'teacher' 
    ? 'Giáo viên' 
    : currentProfile?.role === 'student'
    ? 'Học sinh'
    : 'Chưa đăng nhập';

  const userInitial = (currentProfile?.full_name?.trim().charAt(0) || 'U').toUpperCase();

  // Primary Sidebar content (shared between desktop and mobile drawer)
  const renderSidebarContent = (inDrawer: boolean = false) => {
    const collapsed = inDrawer ? false : isCollapsed;

    return (
      <div className="relative flex flex-col h-full bg-white select-none overflow-hidden">
        {/* Soft pastel background ambient depth blobs */}
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/[0.04] rounded-full blur-3xl -z-10" />
        <div className="pointer-events-none absolute bottom-24 -right-10 w-44 h-44 bg-purple-500/[0.04] rounded-full blur-3xl -z-10" />
        <div className="pointer-events-none absolute top-32 left-0 w-36 h-36 bg-emerald-500/[0.03] rounded-full blur-3xl -z-10" />

        {/* 1. BRAND HEADER */}
        <div className={`h-20 shrink-0 flex items-center border-b border-slate-100/90 transition-all ${
          collapsed ? 'px-3 justify-center' : 'px-5 justify-between'
        }`}>
          {collapsed ? (
            <button
              onClick={handleToggleCollapse}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200/70 hover:scale-105 transition-transform"
              title="Mở rộng Sidebar (EduExam)"
            >
              <GraduationCap className="w-6 h-6" />
            </button>
          ) : (
            <>
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200/70 shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center">
                    <span className="text-[21px] font-black text-slate-900 tracking-tight">Edu</span>
                    <span className="text-[21px] font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                      Exam
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-400 -mt-1 tracking-wide truncate">
                    AI Examination Platform
                  </p>
                </div>
              </div>

              {/* Collapse Button or Close Mobile Drawer */}
              {inDrawer ? (
                <button
                  onClick={onCloseMobile}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Đóng menu"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleToggleCollapse}
                  className="w-9 h-9 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all group"
                  title="Thu gọn Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
            </>
          )}
        </div>

        {/* 2. SCROLLABLE NAVIGATION AREA */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 overscroll-contain">
          {menuGroups.map((group, groupIdx) => {
            // Filter out groups that user role doesn't have permission for
            if (group.roles && !group.roles.includes(currentRole)) {
              return null;
            }

            // Filter items within group
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(currentRole)
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIdx} className="space-y-1">
                {/* Divider Before if specified */}
                {group.dividerBefore && (
                  <div className="pt-2 pb-1">
                    <div className="border-t border-slate-100" />
                  </div>
                )}

                {/* Group Title (Only if expanded) */}
                {!collapsed && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                    {group.title}
                  </div>
                )}

                {/* Group Items */}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = selectedTab === item.id;
                    const isHighlight = item.highlight && !isActive;

                    return (
                      <div key={item.id} className="relative group">
                        <button
                          id={`sidebar-tab-${item.id}`}
                          onClick={() => handleItemClick(item.id)}
                          className={`w-full relative flex items-center transition-all duration-150 rounded-xl ${
                            collapsed 
                              ? 'justify-center h-11 px-0' 
                              : 'justify-between h-11 px-3'
                          } ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-50 via-indigo-50/90 to-purple-50/50 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-indigo-600 before:rounded-r-full'
                              : isHighlight
                              ? 'bg-gradient-to-r from-purple-50/80 via-indigo-50/40 to-blue-50/40 text-purple-950 font-semibold border border-purple-200/60 hover:bg-purple-100/60 hover:border-purple-300/80'
                              : group.isSystem
                              ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <div className={`flex items-center ${collapsed ? '' : 'space-x-3'}`}>
                            <Icon 
                              className={`w-[20px] h-[20px] shrink-0 transition-colors ${
                                isActive 
                                  ? 'text-indigo-600' 
                                  : isHighlight
                                  ? 'text-purple-600'
                                  : group.isSystem
                                  ? 'text-slate-400 group-hover:text-slate-600'
                                  : 'text-slate-400 group-hover:text-indigo-600'
                              }`} 
                            />
                            {!collapsed && (
                              <span className="text-[13.5px] tracking-tight truncate">
                                {item.label}
                              </span>
                            )}
                          </div>

                          {!collapsed && item.badge && (
                            <div>
                              {renderBadge(item.badge, item.badgeType, isActive)}
                            </div>
                          )}
                        </button>

                        {/* Floating Tooltip when Collapsed */}
                        {collapsed && (
                          <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 flex items-center space-x-2">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20 text-white">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. FIXED BOTTOM AREA: USER PROFILE */}
        <div className="shrink-0 p-3 border-t border-slate-100 space-y-2 bg-white/95 backdrop-blur-xs">
          {/* User Profile Card */}
          <div className="relative" ref={profileMenuRef}>
            {collapsed ? (
              <div className="relative group flex justify-center py-1">
                <button
                  onClick={() => {
                    if (currentProfile) {
                      setIsProfileMenuOpen(!isProfileMenuOpen);
                    } else if (onOpenAuth) {
                      onOpenAuth();
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 text-indigo-800 font-bold text-sm flex items-center justify-center shadow-2xs hover:scale-105 transition-transform"
                >
                  {userInitial}
                </button>
                <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                  <div className="font-bold">{currentProfile?.full_name || 'Khách'}</div>
                  <div className="text-[10px] text-slate-300">{roleName}</div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (currentProfile) {
                    setIsProfileMenuOpen(!isProfileMenuOpen);
                  } else if (onOpenAuth) {
                    onOpenAuth();
                  }
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all group text-left"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 text-indigo-800 font-bold text-sm flex items-center justify-center shadow-2xs shrink-0">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {currentProfile?.full_name || 'Khách (Chưa đăng nhập)'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 truncate">
                      {roleName}
                    </p>
                  </div>
                </div>
                <div className="p-1 text-slate-400 group-hover:text-slate-600 rounded-md">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
            )}

            {/* Profile Popover Menu */}
            {isProfileMenuOpen && (
              <div className={`absolute bottom-full mb-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                collapsed ? 'left-full ml-2 w-52' : 'left-0 right-0'
              }`}>
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {currentProfile?.full_name || 'Tài khoản EduExam'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {currentProfile?.email || 'Nền tảng thi trực tuyến'}
                  </p>
                </div>

                <div className="p-1 space-y-0.5 text-xs">
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      if (onOpenAuth) onOpenAuth();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Thông tin tài khoản</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      if (onSignOut) onSignOut();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* DESKTOP SIDEBAR (Sticky/Fixed, Left 0, Top 0, Full Height 100vh) */}
      <aside 
        className={`hidden md:block fixed left-0 top-0 bottom-0 h-screen z-30 bg-white border-r border-slate-200/80 shadow-xs transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px] min-w-[72px] max-w-[72px]' : 'w-[270px] min-w-[270px] max-w-[270px]'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* MOBILE DRAWER OVERLAY & SLIDE-IN */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Drawer Body */}
          <div className="relative w-[285px] max-w-[85vw] h-full bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-250 ease-out">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
