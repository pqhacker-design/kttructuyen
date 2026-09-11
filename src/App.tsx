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

import { Profile, Exam } from './types';
import { getCurrentProfile, onAuthStateChange, isSupabaseConfigured, signOut } from './lib/supabase';
import { JoinExamResponse, joinExamWithAccessCode } from './services/takingService';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isConnectionOpen, setIsConnectionOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

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
    checkAuth();

    // Listen to Supabase auth events
    const { data: authListener } = onAuthStateChange((event, session) => {
      if (session?.user) {
        checkAuth();
      } else {
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

  const checkAuth = async () => {
    setLoadingAuth(true);
    try {
      const profile = await getCurrentProfile();
      setCurrentProfile(profile);
      if (!profile) {
        setIsAuthOpen(true);
      }
    } catch (err) {
      console.error('Error fetching auth state:', err);
      setIsAuthOpen(true);
    } finally {
      setLoadingAuth(false);
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
  // MAIN WORKSPACE INTERFACE
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
    </div>
  );
}
