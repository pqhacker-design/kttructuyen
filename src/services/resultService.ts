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
  const localResults = mockStore.getResultsBySession(sessionId);
  const resultsMap = new Map<string, ExamResult>();

  // Helper to add/merge results
  const addResult = (res: any) => {
    if (!res) return;
    const key = res.attempt_id || res.id;
    if (!resultsMap.has(key)) {
      resultsMap.set(key, {
        id: res.id || 'res-' + (res.attempt_id || Math.random()),
        attempt_id: res.attempt_id || res.id,
        student_id: res.student_id || null,
        exam_session_id: res.exam_session_id || sessionId,
        student_name: res.student_name || 'Học sinh',
        student_code: res.student_code || '',
        score: Number(res.score ?? 0),
        max_score: Number(res.max_score ?? 10),
        percentage: Number(res.percentage ?? Math.round(((Number(res.score ?? 0)) / (Number(res.max_score || 10))) * 100)),
        correct_count: Number(res.correct_count ?? 0),
        wrong_count: Number(res.wrong_count ?? 0),
        unanswered_count: Number(res.unanswered_count ?? 0),
        submitted_at: res.submitted_at || res.created_at || new Date().toISOString(),
        created_at: res.created_at || new Date().toISOString(),
        review_questions: res.review_questions || undefined,
      });
    }
  };

  // 1. First, attempt to fetch from server-side admin API (bypasses RLS & reconciles exam_attempts)
  try {
    const res = await fetch(`/api/exam-sessions/${encodeURIComponent(sessionId)}/results`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.results) && data.results.length > 0) {
        data.results.forEach(addResult);
      }
    }
  } catch (apiErr) {
    // Server endpoint fallback to direct Supabase or local store
  }

  // 2. Query Supabase directly if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();

      // Query exam_results
      const { data: dbResults, error: rErr } = await supabase
        .from('exam_results')
        .select('*')
        .eq('exam_session_id', sessionId)
        .order('submitted_at', { ascending: false });

      if (!rErr && dbResults) {
        dbResults.forEach(addResult);
      }

      // Query exam_attempts with status graded/submitted to catch any submissions where exam_results was missed
      const { data: dbAttempts, error: aErr } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('exam_session_id', sessionId)
        .in('status', ['graded', 'submitted'])
        .order('submitted_at', { ascending: false });

      if (!aErr && dbAttempts) {
        for (const att of dbAttempts) {
          const key = att.id;
          if (!resultsMap.has(key)) {
            const numScore = Number(att.score ?? 0);
            const numMax = Number(att.max_score ?? 10);
            const numPct = Number(att.percentage ?? Math.round((numScore / numMax) * 100));
            const subTime = att.submitted_at || att.created_at || new Date().toISOString();

            const synResult: ExamResult = {
              id: 'res-' + att.id,
              attempt_id: att.id,
              student_id: att.student_id || null,
              exam_session_id: sessionId,
              student_name: att.student_name || 'Học sinh',
              student_code: att.student_code || '',
              score: numScore,
              max_score: numMax,
              percentage: numPct,
              correct_count: 0,
              wrong_count: 0,
              unanswered_count: 0,
              submitted_at: subTime,
              created_at: subTime,
            };

            addResult(synResult);

            // Auto backfill into exam_results table so it stays permanently synced
            Promise.resolve(
              supabase
                .from('exam_results')
                .upsert(
                  {
                    attempt_id: att.id,
                    student_id: att.student_id || null,
                    exam_session_id: sessionId,
                    student_name: att.student_name || 'Học sinh',
                    student_code: att.student_code || '',
                    score: numScore,
                    max_score: numMax,
                    percentage: numPct,
                    correct_count: 0,
                    wrong_count: 0,
                    unanswered_count: 0,
                    submitted_at: subTime,
                  },
                  { onConflict: 'attempt_id' }
                )
            ).catch(() => {});
          }
        }
      }
    } catch (dbErr: any) {
      console.warn('Direct Supabase query warning:', dbErr?.message);
    }
  }

  // 3. Merge any local results from mockStore
  localResults.forEach(addResult);

  // Convert map to array and sort by submitted_at descending
  const list = Array.from(resultsMap.values());
  list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  return list;
}

/**
 * Triggers server-side synchronization of exam_attempts to exam_results for a session
 */
export async function syncSessionAttempts(sessionId: string): Promise<{ success: boolean; syncedCount: number; results: ExamResult[] }> {
  let syncedCount = 0;
  try {
    const res = await fetch(`/api/exam-sessions/${encodeURIComponent(sessionId)}/sync-attempts`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      syncedCount = data.syncedCount || 0;
    }
  } catch (err) {
    console.warn('Sync attempts API error:', err);
  }

  const results = await fetchResultsBySession(sessionId);
  return { success: true, syncedCount, results };
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
  const cleanCode = studentCode.trim().toLowerCase();
  const localList = mockStore.getAllResults().filter(r => (r.student_code || '').toLowerCase() === cleanCode);

  if (!isSupabaseConfigured()) {
    return localList;
  }

  try {
    const supabase = getSupabase();
    const { data: resultsData } = await supabase
      .from('exam_results')
      .select(`
        *,
        session:exam_sessions(title, access_code)
      `)
      .ilike('student_code', cleanCode)
      .order('submitted_at', { ascending: false });

    // Also check exam_attempts in case exam_results was missed
    const { data: attemptsData } = await supabase
      .from('exam_attempts')
      .select(`
        *,
        session:exam_sessions(title, access_code)
      `)
      .ilike('student_code', cleanCode)
      .in('status', ['graded', 'submitted'])
      .order('submitted_at', { ascending: false });

    const map = new Map<string, ExamResult>();

    (resultsData || []).forEach((r: any) => {
      map.set(r.attempt_id || r.id, r);
    });

    (attemptsData || []).forEach((att: any) => {
      if (!map.has(att.id)) {
        const numScore = Number(att.score ?? 0);
        const numMax = Number(att.max_score ?? 10);
        const numPct = Number(att.percentage ?? Math.round((numScore / numMax) * 100));
        map.set(att.id, {
          id: 'res-' + att.id,
          attempt_id: att.id,
          student_id: att.student_id || null,
          exam_session_id: att.exam_session_id,
          student_name: att.student_name || 'Học sinh',
          student_code: att.student_code || studentCode,
          score: numScore,
          max_score: numMax,
          percentage: numPct,
          correct_count: 0,
          wrong_count: 0,
          unanswered_count: 0,
          submitted_at: att.submitted_at || att.created_at || new Date().toISOString(),
          created_at: att.created_at || new Date().toISOString(),
          session: att.session,
        } as any);
      }
    });

    localList.forEach((lr) => {
      if (!map.has(lr.attempt_id || lr.id)) {
        map.set(lr.attempt_id || lr.id, lr);
      }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    return combined;
  } catch (err) {
    return localList;
  }
}

