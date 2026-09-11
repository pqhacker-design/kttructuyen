import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Exam, ExamQuestion, ExamStatus } from '../types';
import { mockStore } from './mockStore';

export async function fetchExams(ownerId?: string): Promise<Exam[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getExams();
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('exams')
      .select(`
        *,
        subject:subjects(name),
        questions:exam_questions(
          id,
          question_order,
          points,
          question:questions(
            id,
            content,
            cognitive_level,
            question_type,
            difficulty
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for exams:', error.message);
      return mockStore.getExams();
    }

    return (data || []).map((ex: any) => ({
      ...ex,
      subject_name: ex.subject?.name || 'Môn học',
      question_count: (ex.questions || []).length,
    }));
  } catch (err: any) {
    console.warn('Network error fetching exams, using local store:', err?.message);
    return mockStore.getExams();
  }
}

export async function fetchExamById(examId: string): Promise<Exam | null> {
  if (!isSupabaseConfigured()) {
    return mockStore.getExamById(examId);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('exams')
      .select(`
        *,
        subject:subjects(name),
        questions:exam_questions(
          id,
          question_id,
          question_order,
          points,
          question:questions(
            id,
            content,
            cognitive_level,
            question_type,
            difficulty,
            explanation,
            options:question_options(*)
          )
        )
      `)
      .eq('id', examId)
      .single();

    if (error) {
      return mockStore.getExamById(examId);
    }

    const sortedQuestions = (data.questions || []).sort(
      (a: any, b: any) => a.question_order - b.question_order
    );

    return {
      ...data,
      subject_name: data.subject?.name || 'Môn học',
      question_count: sortedQuestions.length,
      questions: sortedQuestions,
    };
  } catch (err) {
    return mockStore.getExamById(examId);
  }
}

export const getExamById = fetchExamById;

export async function createExam(
  exam: {
    owner_id: string;
    subject_id: string;
    matrix_id?: string | null;
    specification_id?: string | null;
    title: string;
    description?: string;
    grade: number;
    duration_minutes: number;
    total_points: number;
    status: ExamStatus;
  },
  questionItems: { question_id: string; points: number; question_order: number }[]
): Promise<Exam | null> {
  if (!isSupabaseConfigured()) {
    const newExam = mockStore.addExam(exam);
    if (questionItems && questionItems.length > 0) {
      for (const item of questionItems) {
        mockStore.addQuestionToExam(newExam.id, item.question_id, item.points);
      }
    }
    return mockStore.getExamById(newExam.id);
  }

  try {
    const supabase = getSupabase();

    // 1. Insert Exam
    const { data: newExam, error: examErr } = await supabase
      .from('exams')
      .insert([exam])
      .select()
      .single();

    if (examErr) {
      throw new Error(examErr.message);
    }

    // 2. Insert Exam Questions
    if (questionItems && questionItems.length > 0) {
      const examQuestionsData = questionItems.map((item, idx) => ({
        exam_id: newExam.id,
        question_id: item.question_id,
        question_order: item.question_order || idx + 1,
        points: item.points,
      }));

      const { error: eqErr } = await supabase.from('exam_questions').insert(examQuestionsData);
      if (eqErr) {
        console.error('Error inserting exam questions:', eqErr);
      }
    }

    return newExam;
  } catch (err: any) {
    // Fallback to local store
    const newExam = mockStore.addExam(exam);
    if (questionItems && questionItems.length > 0) {
      for (const item of questionItems) {
        mockStore.addQuestionToExam(newExam.id, item.question_id, item.points);
      }
    }
    return mockStore.getExamById(newExam.id);
  }
}

export async function updateExamStatus(examId: string, status: ExamStatus): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const ex = mockStore.getExamById(examId);
    if (ex) ex.status = status;
    return true;
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('exams').update({ status }).eq('id', examId);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    const ex = mockStore.getExamById(examId);
    if (ex) ex.status = status;
    return true;
  }
}

export async function deleteExam(examId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteExam(examId);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('exams').delete().eq('id', examId);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    return mockStore.deleteExam(examId);
  }
}

