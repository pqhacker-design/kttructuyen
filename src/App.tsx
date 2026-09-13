/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { ConnectionModal } from './components/ConnectionModal';
import { AuthModal } from './components/AuthModal';
import { JoinExamView } from './components/JoinExamView';
import { ExamTakingView } from './components/ExamTakingView';

import { DashboardView } from './components/DashboardView';
import { QuestionBankView } from './components/QuestionBankView';
import { MatrixView } from './components/MatrixView';
import { ExamManagementView } from './components/ExamManagementView';
import { ExamSessionView } from './components/ExamSessionView';
import { ResultsAnalyticsView } from './components/ResultsAnalyticsView';
import { ClassManagementView } from './components/ClassManagementView';
import { AIExamGeneratorView } from './components/AIExamGeneratorView';
import { AdminUsersView } from './components/AdminUsersView';
import { UserIsolationTestView } from './components/UserIsolationTestView';
import { SQLSchemaView } from './components/SQLSchemaView';
import { ChangePasswordModal } from './components/ChangePasswordModal';

import { Profile, Exam } from './types';
import { getCurrentProfile, onAuthStateChange, isSupabaseConfigured, signOut } from './lib/supabase';
import { JoinExamResponse, joinExamWithAccessCode } from './services/takingService';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('eduexam_active_tab') as NavTab;
      if (saved) return saved;
    } catch {}
    return 'dashboard';
  });

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem('eduexam_active_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Only show blocking loading screen if no cached profile is present on first load
  const [loadingAuth, setLoadingAuth] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('eduexam_active_user');
      return !saved;
    } catch {}
    return true;
  });

  const isInitialAuthCheck = React.useRef(true);

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isConnectionOpen, setIsConnectionOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Persist active tab to prevent losing current location on browser reload or tab change
  useEffect(() => {
    try {
      localStorage.setItem('eduexam_active_tab', currentTab);
    } catch {}
  }, [currentTab]);

  // Sidebar collapse & mobile state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('eduexam_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('eduexam_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Contextual transitions
  const [activeExamData, setActiveExamData] = useState<JoinExamResponse | null>(null);
  const [selectedSessionForResults, setSelectedSessionForResults] = useState<string | null>(null);
  const [preselectedExamForSession, setPreselectedExamForSession] = useState<Exam | null>(null);

  useEffect(() => {
    // Initial profile fetch
    checkAuth(true);

    // Listen to Supabase auth events (e.g. token refresh when switching tabs or regaining focus)
    const { data: authListener } = onAuthStateChange((event, session) => {
      if (session?.user) {
        // Run background verification without showing blocking full-screen loader
        checkAuth(false);
      } else if (event === 'SIGNED_OUT') {
        setCurrentProfile(null);
        setIsAuthOpen(true);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('join') || params.get('code');
      if (code) {
        handleJoinExamWithCode(code.trim().toUpperCase());
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }, []);

  const checkAuth = async (isInitial = false) => {
    // Only show full-screen blocking loader on the very first mount if no cached profile exists
    if (isInitial && !currentProfile) {
      setLoadingAuth(true);
    }
    try {
      const profile = await getCurrentProfile();
      setCurrentProfile(profile);
      if (!profile && isInitial) {
        setIsAuthOpen(true);
      }
    } catch (err) {
      console.error('Error fetching auth state:', err);
      if (isInitial && !currentProfile) {
        setIsAuthOpen(true);
      }
    } finally {
      isInitialAuthCheck.current = false;
      if (isInitial) {
        setLoadingAuth(false);
      }
    }
  };

  const handleJoinExamWithCode = (code: string) => {
    setJoinCodeInput(code);
    setIsJoinModalOpen(true);
  };

  const handleCreateSessionFromExam = (exam: Exam) => {
    setPreselectedExamForSession(exam);
    setCurrentTab('sessions');
  };

  const handleViewResultsForSession = (sessionId: string) => {
    setSelectedSessionForResults(sessionId);
    setCurrentTab('results');
  };

  // ----------------------------------------------------------------------------
  // AUTH LOADING STATE: Prevent flashing dashboard before auth check completes
  // ----------------------------------------------------------------------------
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Đang tải dữ liệu phiên làm việc...</p>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // IF STUDENT IS ACTIVELY TAKING AN EXAM: RENDER DISTRACTION-FREE EXAM VIEW
  // ----------------------------------------------------------------------------
  if (activeExamData) {
    return (
      <ExamTakingView
        examData={activeExamData}
        onExit={() => {
          setActiveExamData(null);
          setCurrentTab('dashboard');
        }}
        onRetake={async () => {
          const code = activeExamData.session?.access_code;
          const studentName = activeExamData.attempt?.student_name || currentProfile?.full_name || 'Học sinh';
          const studentCode = activeExamData.attempt?.student_code || currentProfile?.student_code || 'HS-001';
          if (code) {
            const freshData = await joinExamWithAccessCode(code, studentName, studentCode);
            if (freshData.success) {
              setActiveExamData(freshData);
            } else {
              alert(freshData.message);
            }
          }
        }}
      />
    );
  }

  // ----------------------------------------------------------------------------
  // UNAUTHENTICATED PORTAL: RENDER ONLY LOGIN OR STUDENT JOIN (NO APP UI BEHIND)
  // ----------------------------------------------------------------------------
  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
        {/* Subtle decorative mesh background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.2),rgba(255,255,255,0))] pointer-events-none" />

        {/* Supabase Connection Setup Modal if database not configured */}
        <ConnectionModal
          isOpen={isConnectionOpen}
          onClose={() => setIsConnectionOpen(false)}
          onConfigSaved={() => {
            checkAuth();
          }}
        />

        {/* Only the active entry interface is rendered - completely isolating backend UI */}
        {isJoinModalOpen ? (
          <JoinExamView
            isOpen={true}
            onClose={() => {
              setIsJoinModalOpen(false);
              setIsAuthOpen(true);
            }}
            initialCode={joinCodeInput}
            currentProfile={null}
            onExamReady={(data) => {
              setActiveExamData(data);
              setIsJoinModalOpen(false);
            }}
            onSwitchToLogin={() => {
              setIsJoinModalOpen(false);
              setIsAuthOpen(true);
            }}
          />
        ) : (
          <AuthModal
            isOpen={true}
            onClose={() => {}}
            isRequired={true}
            onAuthSuccess={(profile) => {
              if (profile) setCurrentProfile(profile);
              setIsAuthOpen(false);
              checkAuth();
            }}
            onOpenConnectionModal={() => {
              setIsConnectionOpen(true);
            }}
            onStudentDirectExam={() => {
              setJoinCodeInput('');
              setIsJoinModalOpen(true);
            }}
          />
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // MAIN WORKSPACE INTERFACE (ONLY FOR AUTHENTICATED USERS)
  // ----------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* 1. FIXED FULL-HEIGHT SIDEBAR (Canva + Notion + Google Classroom) */}
      <Sidebar
        activeTab={currentTab}
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'sessions') setPreselectedExamForSession(null);
        }}
        userRole={currentProfile?.role}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        currentProfile={currentProfile}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenConnectionModal={() => setIsConnectionOpen(true)}
        onSignOut={async () => {
          await signOut();
          setCurrentProfile(null);
          setIsAuthOpen(true);
        }}
      />

      {/* 2. MAIN APPLICATION CONTENT WRAPPER */}
      {/* Automatically calculates margin-left = sidebar width when expanded / collapsed */}
      <div 
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-[margin] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[270px]'
        }`}
      >
        {/* Top Navigation */}
        <Navbar
          currentProfile={currentProfile}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onSignOut={async () => {
            await signOut();
            setCurrentProfile(null);
            setIsAuthOpen(true);
          }}
          onOpenConnectionModal={() => setIsConnectionOpen(true)}
          onOpenStudentJoin={() => {
            setJoinCodeInput('');
            setIsJoinModalOpen(true);
          }}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Workspace Body: Active View Pane */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentTab === 'dashboard' && (
            <DashboardView
              currentProfile={currentProfile}
              onNavigate={setCurrentTab}
              onJoinExamWithCode={handleJoinExamWithCode}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          )}

          {currentTab === 'ai-generator' && (
            <AIExamGeneratorView
              currentProfile={currentProfile}
              onNavigateToSessions={(examId) => {
                setCurrentTab('sessions');
              }}
              onOpenAuth={() => setIsAuthOpen(true)}
              onNavigateToTab={(tab) => setCurrentTab(tab as any)}
            />
          )}

          {currentTab === 'questions' && (
            <QuestionBankView
              currentProfile={currentProfile}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          )}

          {currentTab === 'matrices' && (
            <MatrixView
              currentProfile={currentProfile}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          )}

          {currentTab === 'exams' && (
            <ExamManagementView
              currentProfile={currentProfile}
              onOpenAuth={() => setIsAuthOpen(true)}
              onCreateSessionFromExam={handleCreateSessionFromExam}
              onNavigateToAI={() => setCurrentTab('ai-generator')}
            />
          )}

          {currentTab === 'sessions' && (
            <ExamSessionView
              currentProfile={currentProfile}
              onOpenAuth={() => setIsAuthOpen(true)}
              onViewResults={handleViewResultsForSession}
              onStudentJoinDirect={handleJoinExamWithCode}
              preselectedExam={preselectedExamForSession}
            />
          )}

          {currentTab === 'results' && (
            <ResultsAnalyticsView
              currentProfile={currentProfile}
              initialSessionId={selectedSessionForResults}
            />
          )}

          {currentTab === 'classes' && (
            <ClassManagementView
              currentProfile={currentProfile}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          )}

          {currentTab === 'admin-users' && (
            <AdminUsersView
              currentProfile={currentProfile}
              onOpenAuth={() => setIsAuthOpen(true)}
            />
          )}

          {currentTab === 'user-isolation-test' && (
            <UserIsolationTestView />
          )}

          {currentTab === 'sql' && (
            <SQLSchemaView />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <ConnectionModal
        isOpen={isConnectionOpen}
        onClose={() => setIsConnectionOpen(false)}
        onConfigSaved={() => {
          checkAuth();
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          if (currentProfile) {
            setIsAuthOpen(false);
          }
        }}
        isRequired={!currentProfile}
        onAuthSuccess={(profile) => {
          if (profile) setCurrentProfile(profile);
          setIsAuthOpen(false);
          checkAuth();
        }}
        onOpenConnectionModal={() => {
          setIsAuthOpen(false);
          setIsConnectionOpen(true);
        }}
        onStudentDirectExam={() => {
          setIsAuthOpen(false);
          setJoinCodeInput('');
          setIsJoinModalOpen(true);
        }}
      />

      <JoinExamView
        isOpen={isJoinModalOpen}
        onClose={() => {
          setIsJoinModalOpen(false);
          if (!currentProfile) {
            setIsAuthOpen(true);
          }
        }}
        initialCode={joinCodeInput}
        currentProfile={currentProfile}
        onExamReady={(data) => {
          setActiveExamData(data);
        }}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        currentProfile={currentProfile}
      />
    </div>
  );
}
