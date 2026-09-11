import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Question, QuestionBank, QuestionOption, Subject, CognitiveLevel, QuestionType, Difficulty } from '../types';
import { mockStore } from './mockStore';

export async function fetchSubjects(): Promise<Subject[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getSubjects();
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('grade', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase query failed, using local store for subjects:', error.message);
      return mockStore.getSubjects();
    }
    return data || [];
  } catch (err: any) {
    console.warn('Network error fetching subjects, using local store:', err?.message);
    return mockStore.getSubjects();
  }
}

export async function createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject | null> {
  if (!isSupabaseConfigured()) {
    return mockStore.addSubject(subject);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('subjects')
      .insert([subject])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  } catch (err) {
    return mockStore.addSubject(subject);
  }
}

export async function fetchQuestionBanks(ownerId?: string): Promise<QuestionBank[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getBanks();
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('question_banks')
      .select(`
        *,
        subject:subjects(name)
      `)
      .order('created_at', { ascending: false });

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for question banks:', error.message);
      return mockStore.getBanks();
    }

    return (data || []).map((item: any) => ({
      ...item,
      subject_name: item.subject?.name || 'Chung',
    }));
  } catch (err: any) {
    console.warn('Network error fetching question banks, using local store:', err?.message);
    return mockStore.getBanks();
  }
}

export async function createQuestionBank(bank: {
  name: string;
  subject_id: string;
  description?: string;
  owner_id: string;
}): Promise<QuestionBank | null> {
  if (!isSupabaseConfigured()) {
    return mockStore.addBank(bank);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('question_banks')
      .insert([bank])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  } catch (err) {
    return mockStore.addBank(bank);
  }
}

export async function deleteQuestionBank(bankId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteBank(bankId);
  }
  try {
    const supabase = getSupabase();
    await supabase.from('questions').delete().eq('question_bank_id', bankId);
    const { error } = await supabase.from('question_banks').delete().eq('id', bankId);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  } catch (err) {
    return mockStore.deleteBank(bankId);
  }
}

export async function fetchQuestions(bankId?: string, ownerId?: string): Promise<Question[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getQuestions(bankId);
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('questions')
      .select(`
        *,
        options:question_options(*)
      `)
      .order('created_at', { ascending: false });

    if (bankId) {
      query = query.eq('question_bank_id', bankId);
    }
    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for questions:', error.message);
      return mockStore.getQuestions(bankId);
    }

    return (data || []).map((q: any) => ({
      ...q,
      options: (q.options || []).sort((a: any, b: any) => a.option_order - b.option_order),
    }));
  } catch (err: any) {
    console.warn('Network error fetching questions, using local store:', err?.message);
    return mockStore.getQuestions(bankId);
  }
}

export async function createQuestion(
  question: {
    question_bank_id: string;
    owner_id: string;
    subject_id: string;
    content: string;
    question_type: QuestionType;
    difficulty: Difficulty;
    cognitive_level: CognitiveLevel;
    explanation?: string;
    points: number;
  },
  options: { content: string; is_correct: boolean; option_order: number }[]
): Promise<Question | null> {
  if (!isSupabaseConfigured()) {
    return mockStore.addQuestion(question, options);
  }

  try {
    const supabase = getSupabase();

    // 1. Insert question
    const { data: newQ, error: qErr } = await supabase
      .from('questions')
      .insert([question])
      .select()
      .single();

    if (qErr) {
      throw new Error(qErr.message);
    }

    // 2. Insert options if single or multiple choice
    if (options && options.length > 0) {
      const optsWithQId = options.map((opt) => ({
        question_id: newQ.id,
        content: opt.content,
        is_correct: opt.is_correct,
        option_order: opt.option_order,
      }));

      const { error: optErr } = await supabase.from('question_options').insert(optsWithQId);
      if (optErr) {
        console.error('Error creating options:', optErr);
      }
    }

    // Refetch full question with options
    const { data: fullQ } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('id', newQ.id)
      .single();

    return fullQ;
  } catch (err) {
    return mockStore.addQuestion(question, options);
  }
}

export async function deleteQuestion(questionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteQuestion(questionId);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  } catch (err) {
    return mockStore.deleteQuestion(questionId);
  }
}

// Seed default educational subjects and sample questions if database is newly initialized
export async function seedDefaultEducationalData(userId: string) {
  if (!isSupabaseConfigured()) {
    mockStore.resetDemoData();
    return;
  }

  const supabase = getSupabase();

  try {
    // 1. Check if subjects exist
    const { data: existingSubjects } = await supabase.from('subjects').select('id, name').limit(1);
    let mathSubjectId = '';

    if (!existingSubjects || existingSubjects.length === 0) {
      const defaultSubjects = [
        { name: 'Toán học', code: 'MATH10', grade: 10, description: 'Chương trình GDPT 2018 - Toán 10' },
        { name: 'Vật lý', code: 'PHYS10', grade: 10, description: 'Chương trình GDPT 2018 - Vật lý 10' },
        { name: 'Hóa học', code: 'CHEM10', grade: 10, description: 'Chương trình GDPT 2018 - Hóa học 10' },
        { name: 'Tiếng Anh', code: 'ENG10', grade: 10, description: 'Tiếng Anh 10 Global Success' },
      ];
      const { data: createdSubs } = await supabase.from('subjects').insert(defaultSubjects).select();
      if (createdSubs && createdSubs.length > 0) {
        mathSubjectId = createdSubs[0].id;
      }
    } else {
      mathSubjectId = existingSubjects[0].id;
    }

    // 2. Check if question bank exists for this teacher
    const { data: existingBanks } = await supabase.from('question_banks').select('id').eq('owner_id', userId).limit(1);
    if (existingBanks && existingBanks.length > 0) {
      return; // Already initialized
    }

    // Create sample question bank
    const { data: bank } = await supabase
      .from('question_banks')
      .insert([
        {
          owner_id: userId,
          subject_id: mathSubjectId,
          name: 'Ngân hàng câu hỏi Toán 10 - Giữa Kỳ I',
          description: 'Bộ câu hỏi chuẩn 4 mức độ: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao',
        },
      ])
      .select()
      .single();

    if (!bank) return;

    // Insert 5 standard curriculum sample questions
    const sampleQuestions = [
      {
        q: {
          question_bank_id: bank.id,
          owner_id: userId,
          subject_id: mathSubjectId,
          content: 'Mệnh đề nào sau đây là một mệnh đề đúng?',
          question_type: 'single_choice' as QuestionType,
          difficulty: 'easy' as Difficulty,
          cognitive_level: 'recognition' as CognitiveLevel,
          explanation: '17 là số nguyên tố vì nó chỉ chia hết cho 1 và chính nó.',
          points: 1.0,
        },
        opts: [
          { content: '17 là số nguyên tố', is_correct: true, option_order: 1 },
          { content: 'Tổng hai số lẻ luôn là số lẻ', is_correct: false, option_order: 2 },
          { content: 'Số 12 chia hết cho 5', is_correct: false, option_order: 3 },
          { content: 'Tam giác đều có 4 cạnh bằng nhau', is_correct: false, option_order: 4 },
        ],
      },
      {
        q: {
          question_bank_id: bank.id,
          owner_id: userId,
          subject_id: mathSubjectId,
          content: 'Cho tập hợp A = {x ∈ ℝ | 1 ≤ x < 5}. Viết tập hợp A dưới dạng nửa khoảng:',
          question_type: 'single_choice' as QuestionType,
          difficulty: 'easy' as Difficulty,
          cognitive_level: 'recognition' as CognitiveLevel,
          explanation: 'Vì x lấy dấu "=" ở 1 và dấu "<" ở 5 nên A = [1; 5).',
          points: 1.0,
        },
        opts: [
          { content: '[1; 5)', is_correct: true, option_order: 1 },
          { content: '(1; 5]', is_correct: false, option_order: 2 },
          { content: '[1; 5]', is_correct: false, option_order: 3 },
          { content: '(1; 5)', is_correct: false, option_order: 4 },
        ],
      },
      {
        q: {
          question_bank_id: bank.id,
          owner_id: userId,
          subject_id: mathSubjectId,
          content: 'Cặp số nào sau đây là một nghiệm của bất phương trình bậc nhất hai ẩn 2x - 3y + 6 > 0?',
          question_type: 'single_choice' as QuestionType,
          difficulty: 'medium' as Difficulty,
          cognitive_level: 'comprehension' as CognitiveLevel,
          explanation: 'Thay (0, 1): 2(0) - 3(1) + 6 = 3 > 0 (thỏa mãn).',
          points: 1.0,
        },
        opts: [
          { content: '(0; 1)', is_correct: true, option_order: 1 },
          { content: '(0; 3)', is_correct: false, option_order: 2 },
          { content: '(-5; 0)', is_correct: false, option_order: 3 },
          { content: '(1; 4)', is_correct: false, option_order: 4 },
        ],
      },
      {
        q: {
          question_bank_id: bank.id,
          owner_id: userId,
          subject_id: mathSubjectId,
          content: 'Cho tam giác ABC có a = 8, b = 6, c = 10. Diện tích tam giác ABC là:',
          question_type: 'single_choice' as QuestionType,
          difficulty: 'medium' as Difficulty,
          cognitive_level: 'application' as CognitiveLevel,
          explanation: 'Vì 6² + 8² = 36 + 64 = 100 = 10², tam giác vuông tại C. S = (1/2)*6*8 = 24.',
          points: 1.0,
        },
        opts: [
          { content: '24', is_correct: true, option_order: 1 },
          { content: '48', is_correct: false, option_order: 2 },
          { content: '30', is_correct: false, option_order: 3 },
          { content: '12', is_correct: false, option_order: 4 },
        ],
      },
      {
        q: {
          question_bank_id: bank.id,
          owner_id: userId,
          subject_id: mathSubjectId,
          content: 'Hai tàu thủy xuất phát cùng một lúc từ một cảng A theo hai hướng hợp với nhau một góc 60°. Tàu thứ nhất chạy với vận tốc 30 km/h, tàu thứ hai chạy với vận tốc 40 km/h. Sau 2 giờ, khoảng cách giữa hai tàu là bao nhiêu?',
          question_type: 'single_choice' as QuestionType,
          difficulty: 'hard' as Difficulty,
          cognitive_level: 'advanced_application' as CognitiveLevel,
          explanation: 'Sau 2h: AB = 60 km, AC = 80 km. Theo định lý cosin: BC² = 60² + 80² - 2*60*80*cos(60°) = 3600 + 6400 - 4800 = 5200. BC = 20√13 ≈ 72.11 km.',
          points: 1.0,
        },
        opts: [
          { content: '20√13 km (khoảng 72.1 km)', is_correct: true, option_order: 1 },
          { content: '70 km', is_correct: false, option_order: 2 },
          { content: '85 km', is_correct: false, option_order: 3 },
          { content: '100 km', is_correct: false, option_order: 4 },
        ],
      },
    ];

    for (const sq of sampleQuestions) {
      await createQuestion(sq.q, sq.opts);
    }
  } catch (err) {
    mockStore.resetDemoData();
  }
}

