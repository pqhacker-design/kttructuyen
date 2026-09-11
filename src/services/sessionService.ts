import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { ExamSession, SessionStatus } from '../types';
import { mockStore } from './mockStore';

// Helper to generate a clean, readable access code (e.g., EXAM892, MATH451)
export function generateAccessCode(prefix = 'EXAM'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars (O, 0, 1, I)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix.toUpperCase().slice(0, 4)}-${code}`;
}

export async function fetchExamSessions(ownerId?: string): Promise<ExamSession[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getSessions();
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('exam_sessions')
      .select(`
        *,
        exam:exams(title, grade, duration_minutes, total_points),
        attempts:exam_attempts(count)
      `)
      .order('created_at', { ascending: false });

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for sessions:', error.message);
      return mockStore.getSessions();
    }

    return (data || []).map((s: any) => ({
      ...s,
      exam_title: s.exam?.title || 'Đề thi',
      attempts_count: s.attempts?.[0]?.count || 0,
    }));
  } catch (err: any) {
    console.warn('Network error fetching exam sessions, using local store:', err?.message);
    return mockStore.getSessions();
  }
}

export async function createExamSession(session: {
  exam_id: string;
  owner_id: string;
  access_code: string;
  title: string;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes: number;
  max_attempts: number;
  status: SessionStatus;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_result_after_submit: boolean;
  target_classes?: string[];
}): Promise<ExamSession | null> {
  const cleanedCode = session.access_code.toUpperCase().trim();

  if (!isSupabaseConfigured()) {
    const existing = mockStore.getSessionByCode(cleanedCode);
    if (existing) {
      throw new Error(`Mã tham gia "${cleanedCode}" đã tồn tại. Vui lòng chọn mã khác.`);
    }
    return mockStore.addSession({ ...session, access_code: cleanedCode });
  }

  try {
    const supabase = getSupabase();

    // Check uniqueness on Supabase
    const { data: existing } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('access_code', cleanedCode)
      .maybeSingle();

    if (existing) {
      throw new Error(`Mã tham gia "${cleanedCode}" đã tồn tại. Vui lòng chọn mã khác.`);
    }

    const { data, error } = await supabase
      .from('exam_sessions')
      .insert([{ ...session, access_code: cleanedCode }])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    if (err.message.includes('đã tồn tại')) throw err;
    // Fallback to local store
    return mockStore.addSession({ ...session, access_code: cleanedCode });
  }
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.updateSessionStatus(sessionId, status);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('exam_sessions').update({ status }).eq('id', sessionId);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    return mockStore.updateSessionStatus(sessionId, status);
  }
}

export async function updateExamSession(sessionId: string, updates: Partial<ExamSession>): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return Boolean(mockStore.updateSession(sessionId, updates));
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('exam_sessions').update(updates).eq('id', sessionId);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    return Boolean(mockStore.updateSession(sessionId, updates));
  }
}

export async function deleteExamSession(sessionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteSession(sessionId);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('exam_sessions').delete().eq('id', sessionId);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    return mockStore.deleteSession(sessionId);
  }
}

export async function fetchSessionByCode(code: string): Promise<ExamSession | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;

  if (!isSupabaseConfigured()) {
    return mockStore.getSessionByCode(clean);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exam_sessions')
      .select(`
        *,
        exam:exams(title, grade, duration_minutes, total_points)
      `)
      .eq('access_code', clean)
      .maybeSingle();

    if (error || !data) {
      return mockStore.getSessionByCode(clean);
    }
    return data;
  } catch (err) {
    return mockStore.getSessionByCode(clean);
  }
}

