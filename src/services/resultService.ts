import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { ExamResult } from '../types';
import { mockStore } from './mockStore';

export interface SessionStats {
  totalAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number; // >= 5.0
  goodRate: number; // >= 8.0
  scoreDistribution: { range: string; count: number }[];
  questionStats?: {
    questionId: string;
    questionOrder: number;
    content: string;
    correctCount: number;
    totalAttempts: number;
    accuracyRate: number;
  }[];
}

export async function fetchResultsBySession(sessionId: string): Promise<ExamResult[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getResultsBySession(sessionId);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exam_results')
      .select('*')
      .eq('exam_session_id', sessionId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.warn('Supabase query failed, using local store for results:', error.message);
      return mockStore.getResultsBySession(sessionId);
    }
    return data || [];
  } catch (err: any) {
    console.warn('Network error fetching results, using local store:', err?.message);
    return mockStore.getResultsBySession(sessionId);
  }
}

export function calculateStatsFromResults(results: ExamResult[]): SessionStats {
  if (results.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0,
      goodRate: 0,
      scoreDistribution: [
        { range: '0 - 4.9', count: 0 },
        { range: '5.0 - 6.4', count: 0 },
        { range: '6.5 - 7.9', count: 0 },
        { range: '8.0 - 10', count: 0 },
      ],
    };
  }

  const scores = results.map((r) => Number(r.score));
  const total = scores.reduce((sum, s) => sum + s, 0);
  const avg = Math.round((total / scores.length) * 10) / 10;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const pass = scores.filter((s) => s >= 5.0).length;
  const good = scores.filter((s) => s >= 8.0).length;

  // Score distribution bins
  let b1 = 0; // 0 - 4.9
  let b2 = 0; // 5.0 - 6.4
  let b3 = 0; // 6.5 - 7.9
  let b4 = 0; // 8.0 - 10

  scores.forEach((s) => {
    if (s < 5.0) b1++;
    else if (s < 6.5) b2++;
    else if (s < 8.0) b3++;
    else b4++;
  });

  return {
    totalAttempts: results.length,
    averageScore: avg,
    highestScore: max,
    lowestScore: min,
    passRate: Math.round((pass / results.length) * 100),
    goodRate: Math.round((good / results.length) * 100),
    scoreDistribution: [
      { range: '0 - 4.9 (Chưa đạt)', count: b1 },
      { range: '5.0 - 6.4 (Trung bình)', count: b2 },
      { range: '6.5 - 7.9 (Khá)', count: b3 },
      { range: '8.0 - 10 (Giỏi)', count: b4 },
    ],
  };
}

export const calculateSessionAnalytics = calculateStatsFromResults;

export async function calculateSessionStats(sessionId: string): Promise<SessionStats> {
  const results = await fetchResultsBySession(sessionId);
  return calculateStatsFromResults(results);
}

export async function fetchStudentHistory(studentCode?: string): Promise<ExamResult[]> {
  if (!studentCode) return [];
  if (!isSupabaseConfigured()) {
    return mockStore.getAllResults().filter(r => r.student_code.toLowerCase() === studentCode.toLowerCase());
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exam_results')
      .select(`
        *,
        session:exam_sessions(title, access_code)
      `)
      .ilike('student_code', studentCode)
      .order('submitted_at', { ascending: false });

    if (error) {
      return mockStore.getAllResults().filter(r => r.student_code.toLowerCase() === studentCode.toLowerCase());
    }
    return data || [];
  } catch (err) {
    return mockStore.getAllResults().filter(r => r.student_code.toLowerCase() === studentCode.toLowerCase());
  }
}

