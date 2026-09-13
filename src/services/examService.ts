import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Exam, ExamQuestion, ExamStatus } from '../types';
import { mockStore } from './mockStore';
import { isUUID } from '../lib/idUtils';

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
  // If Supabase is not configured or foreign keys are not UUIDs, use local mock store
  if (!isSupabaseConfigured() || !isUUID(exam.owner_id) || !isUUID(exam.subject_id)) {
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

    // Prepare payload, ensuring matrix_id and specification_id are only provided if valid UUID
    const examPayload: any = { ...exam };
    if (examPayload.matrix_id && !isUUID(examPayload.matrix_id)) {
      delete examPayload.matrix_id;
    }
    if (examPayload.specification_id && !isUUID(examPayload.specification_id)) {
      delete examPayload.specification_id;
    }

    // 1. Insert Exam
    const { data: newExam, error: examErr } = await supabase
      .from('exams')
      .insert([examPayload])
      .select()
      .single();

    if (examErr) {
      throw new Error(examErr.message);
    }

    // 2. Insert Exam Questions (Strictly filter out non-UUID question_id to prevent 22P02 error)
    if (questionItems && questionItems.length > 0) {
      const validQuestions = questionItems.filter((item) => isUUID(item.question_id));
      if (validQuestions.length > 0) {
        const examQuestionsData = validQuestions.map((item, idx) => ({
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
    }

    // Mirror to mockStore so local store remains synchronized
    const localExam = mockStore.addExam(exam);
    if (questionItems && questionItems.length > 0) {
      for (const item of questionItems) {
        mockStore.addQuestionToExam(localExam.id, item.question_id, item.points);
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

