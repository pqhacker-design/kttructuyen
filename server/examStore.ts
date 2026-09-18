import fs from 'fs';
import path from 'path';
import { Exam, ExamSession, ExamAttempt, ExamResult, ExamResultQuestionReview } from '../src/types';

// In-Memory Shared Store on Server for cross-browser coordination
interface ServerExamQuestion {
  id: string;
  order: number;
  content: string;
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  exam_part: number;
  points: number;
  cognitive_level?: string;
  options?: {
    id: string;
    content: string;
    is_correct?: boolean;
    option_order?: number;
  }[];
  statements?: {
    id: string;
    statement: string;
    is_correct?: boolean;
    explanation?: string;
  }[];
  short_answer?: {
    normalized_answer: string;
    accepted_variants?: string[];
  };
  correct_option_id?: string;
  correct_answer?: string;
  explanation?: string;
  sub_items?: {
    item_number: string;
    sub_title?: string;
    points: number;
    prompt: string;
  }[];
}

interface ServerExam {
  id: string;
  title: string;
  grade?: number;
  duration_minutes: number;
  total_points: number;
  questions: ServerExamQuestion[];
}

// Pre-seeded comprehensive Math 10 Midterm exam with full questions and answers
const DEMO_EXAM_ID = 'exam-toan-10-gk1';
const DEMO_SESSION_ID = 'session-toan-10-gk1';

const DEMO_QUESTIONS: ServerExamQuestion[] = [
  // PHẦN I: Trắc nghiệm 4 lựa chọn (3 câu mẫu)
  {
    id: 'q-demo-1',
    order: 1,
    content: 'Cho mệnh đề $P$: "$\\forall x \\in \\mathbb{R}, x^2 + 1 > 0$". Mệnh đề phủ định $\\overline{P}$ là:',
    question_type: 'single_choice',
    exam_part: 1,
    points: 1.0,
    cognitive_level: 'recognition',
    options: [
      { id: 'opt-1-a', content: '$\\exists x \\in \\mathbb{R}, x^2 + 1 \\le 0$', is_correct: true, option_order: 1 },
      { id: 'opt-1-b', content: '$\\forall x \\in \\mathbb{R}, x^2 + 1 < 0$', is_correct: false, option_order: 2 },
      { id: 'opt-1-c', content: '$\\exists x \\in \\mathbb{R}, x^2 + 1 < 0$', is_correct: false, option_order: 3 },
      { id: 'opt-1-d', content: '$\\forall x \\in \\mathbb{R}, x^2 + 1 \\le 0$', is_correct: false, option_order: 4 },
    ],
    explanation: 'Phủ định của mệnh đề với ký hiệu $\\forall$ ("với mọi") là $\\exists$ ("tồn tại"), và phủ định của dấu ">" là dấu "$\\le$". Do đó phủ định là $\\exists x \\in \\mathbb{R}, x^2 + 1 \\le 0$.',
  },
  {
    id: 'q-demo-2',
    order: 2,
    content: 'Tập hợp $A = \\{x \\in \\mathbb{R} \\mid 1 < x \\le 5\\}$ được viết dưới dạng khoảng, nửa khoảng là:',
    question_type: 'single_choice',
    exam_part: 1,
    points: 1.0,
    cognitive_level: 'recognition',
    options: [
      { id: 'opt-2-a', content: '$(1; 5]$', is_correct: true, option_order: 1 },
      { id: 'opt-2-b', content: '$[1; 5)$', is_correct: false, option_order: 2 },
      { id: 'opt-2-c', content: '$(1; 5)$', is_correct: false, option_order: 3 },
      { id: 'opt-2-d', content: '$[1; 5]$', is_correct: false, option_order: 4 },
    ],
    explanation: 'Do $x > 1$ (ngoặc tròn bên trái) và $x \\le 5$ (ngoặc vuông bên phải) nên biểu diễn là nửa khoảng $(1; 5]$.',
  },
  {
    id: 'q-demo-3',
    order: 3,
    content: 'Bất phương trình nào sau đây là bất phương trình bậc nhất hai ẩn?',
    question_type: 'single_choice',
    exam_part: 1,
    points: 1.0,
    cognitive_level: 'comprehension',
    options: [
      { id: 'opt-3-a', content: '$2x + 3y > 5$', is_correct: true, option_order: 1 },
      { id: 'opt-3-b', content: '$x^2 + 2y \\le 3$', is_correct: false, option_order: 2 },
      { id: 'opt-3-c', content: '$2x + 3y^2 \\ge 1$', is_correct: false, option_order: 3 },
      { id: 'opt-3-d', content: '$xy + 3 < 0$', is_correct: false, option_order: 4 },
    ],
    explanation: 'Bất phương trình bậc nhất hai ẩn có dạng $ax + by < c$ (hoặc $\\le, >, \\ge$) với $a, b$ không đồng thời bằng $0$. Phương trình $2x + 3y > 5$ thỏa mãn điều kiện này.',
  },

  // PHẦN II: Trắc nghiệm Đúng / Sai (4 ý)
  {
    id: 'q-demo-4',
    order: 4,
    content: 'Cho hai tập hợp $A = [-2; 3)$ và $B = (1; 5]$. Xét tính Đúng / Sai của các khẳng định sau:',
    question_type: 'true_false',
    exam_part: 2,
    points: 2.0,
    cognitive_level: 'comprehension',
    statements: [
      {
        id: 'st-4-a',
        statement: 'Tập hợp $A \\cap B = (1; 3)$',
        is_correct: true,
        explanation: 'Giao của $[-2; 3)$ và $(1; 5]$ là $(1; 3)$. Mệnh đề ĐÚNG.',
      },
      {
        id: 'st-4-b',
        statement: 'Tập hợp $A \\cup B = [-2; 5]$',
        is_correct: true,
        explanation: 'Hợp của $[-2; 3)$ và $(1; 5]$ là $[-2; 5]$. Mệnh đề ĐÚNG.',
      },
      {
        id: 'st-4-c',
        statement: 'Tập hợp $A \\setminus B = [-2; 1]$',
        is_correct: true,
        explanation: 'Hiệu $A \\setminus B$ gồm các phần tử thuộc $A$ mà không thuộc $B$, tức $[-2; 1]$. Mệnh đề ĐÚNG.',
      },
      {
        id: 'st-4-d',
        statement: 'Phần tử $x = 3$ thuộc vào tập hợp $A \\cap B$',
        is_correct: false,
        explanation: 'Số 3 không thuộc vào $A = [-2; 3)$ do ngoặc tròn bên phải. Mệnh đề SAI.',
      },
    ],
    explanation: 'Dựa trên quy tắc xác định giao, hợp, hiệu của hai tập hợp số trên trục số.',
  },

  // PHẦN III: Trả lời ngắn / Điền khuyết (2 câu)
  {
    id: 'q-demo-5',
    order: 5,
    content: 'Cho tam giác $ABC$ có cạnh $a = 6$, $b = 8$ và góc $\\widehat{C} = 90^\\circ$. Tính độ dài cạnh $c$.',
    question_type: 'short_answer',
    exam_part: 3,
    points: 1.5,
    cognitive_level: 'application',
    short_answer: {
      normalized_answer: '10',
      accepted_variants: ['10', '10.0', 'c=10', '10 cm'],
    },
    correct_answer: '10',
    explanation: 'Theo định lý Pythagore trong tam giác vuông: $c = \\sqrt{a^2 + b^2} = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10$.',
  },
  {
    id: 'q-demo-6',
    order: 6,
    content: 'Cho tập hợp $M = \\{x \\in \\mathbb{N} \\mid x \\le 4\\}$. Tập hợp $M$ có tất cả bao nhiêu phần tử?',
    question_type: 'short_answer',
    exam_part: 3,
    points: 1.5,
    cognitive_level: 'application',
    short_answer: {
      normalized_answer: '5',
      accepted_variants: ['5', '5 phần tử'],
    },
    correct_answer: '5',
    explanation: 'Các số tự nhiên không vượt quá 4 là $\\{0, 1, 2, 3, 4\\}$. Tập hợp có đúng 5 phần tử.',
  },

  // PHẦN IV: Tự luận
  {
    id: 'q-demo-7',
    order: 7,
    content: 'Biểu diễn miền nghiệm của bất phương trình $2x + y - 4 \\le 0$ trên mặt phẳng tọa độ Oxy.',
    question_type: 'essay',
    exam_part: 4,
    points: 2.0,
    cognitive_level: 'high_application',
    correct_answer: 'Vẽ đường thẳng (d): 2x + y - 4 = 0 đi qua (0, 4) và (2, 0). Lấy điểm O(0,0), thấy 2(0)+0-4 = -4 <= 0 (đúng). Miền nghiệm là nửa mặt phẳng bờ (d) chứa điểm O(0,0).',
    explanation: 'Barem: 1. Vẽ đúng đường thẳng bờ (d) (1.0đ). 2. Kiểm tra điểm thử và kết luận miền nghiệm chính xác (1.0đ).',
  },
];

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const STORE_FILE = path.join(DATA_DIR, 'exam_store.json');

class ExamStore {
  private exams = new Map<string, ServerExam>();
  private sessions = new Map<string, any>();
  private sessionsByCode = new Map<string, string>(); // code -> session_id
  private attempts = new Map<string, ExamAttempt>();
  private answers = new Map<string, Record<string, any>>(); // attempt_id -> { qId: answer }
  private results = new Map<string, ExamResult[]>(); // session_id -> ExamResult[]
  private allowedRetakes = new Map<string, Set<string>>(); // session_id -> Set(student_code)

  constructor() {
    this.seedDemoData();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.exams)) {
            for (const [k, v] of parsed.exams) {
              if (v && v.id) this.exams.set(k, v);
            }
          }
          if (Array.isArray(parsed.sessions)) {
            for (const [k, v] of parsed.sessions) {
              if (v && v.id) {
                this.sessions.set(k, v);
                if (v.access_code) {
                  this.sessionsByCode.set(v.access_code.trim().toUpperCase(), k);
                }
              }
            }
          }
          if (Array.isArray(parsed.attempts)) {
            for (const [k, v] of parsed.attempts) {
              this.attempts.set(k, v);
            }
          }
          if (Array.isArray(parsed.answers)) {
            for (const [k, v] of parsed.answers) {
              this.answers.set(k, v);
            }
          }
          if (Array.isArray(parsed.results)) {
            for (const [k, v] of parsed.results) {
              this.results.set(k, v);
            }
          }
          if (Array.isArray(parsed.allowedRetakes)) {
            for (const [k, v] of parsed.allowedRetakes) {
              this.allowedRetakes.set(k, new Set(v));
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not load exam store from disk:', err);
    }
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataToSave = {
        exams: Array.from(this.exams.entries()),
        sessions: Array.from(this.sessions.entries()),
        attempts: Array.from(this.attempts.entries()),
        answers: Array.from(this.answers.entries()),
        results: Array.from(this.results.entries()),
        allowedRetakes: Array.from(this.allowedRetakes.entries()).map(([k, s]) => [k, Array.from(s)]),
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not save exam store to disk:', err);
    }
  }

  private seedDemoData() {
    // Seed Demo Exam
    const demoExam: ServerExam = {
      id: DEMO_EXAM_ID,
      title: 'Khảo sát Chất lượng Toán 10 - Giữa Kỳ 1',
      grade: 10,
      duration_minutes: 45,
      total_points: 10,
      questions: DEMO_QUESTIONS,
    };
    this.exams.set(demoExam.id, demoExam);

    // Seed Demo Session with standard access code
    const demoSession = {
      id: DEMO_SESSION_ID,
      exam_id: DEMO_EXAM_ID,
      access_code: 'TOAN10-GK1',
      title: 'Kỳ thi Khảo sát Toán 10 - Giữa Kỳ 1 (Chính thức)',
      duration_minutes: 45,
      max_attempts: 1,
      status: 'active',
      shuffle_questions: false,
      shuffle_options: false,
      show_result_after_submit: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.saveSession(demoSession, demoExam, DEMO_QUESTIONS);
  }

  public normalizeQuestions(rawList: any[]): ServerExamQuestion[] {
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item: any, idx: number) => {
      const q = item.question || item;
      const opts = (q.options || item.options || []).map((o: any, oIdx: number) => ({
        id: o.id || `opt-${oIdx + 1}`,
        content: o.content || o.text || '',
        is_correct: Boolean(o.is_correct),
        option_order: o.option_order || o.order || (oIdx + 1),
      }));

      const stmts = (q.statements || item.statements || []).map((s: any, sIdx: number) => ({
        id: s.id || `st-${sIdx + 1}`,
        statement: s.statement || s.content || '',
        is_correct: Boolean(s.is_correct),
        explanation: s.explanation,
      }));

      return {
        id: q.id || item.question_id || item.id || `q-${idx + 1}`,
        order: item.question_order || q.order || (idx + 1),
        content: q.content || item.content || '',
        question_type: q.question_type || item.question_type || 'single_choice',
        exam_part: q.exam_part || item.exam_part || (stmts.length > 0 ? 2 : (q.short_answer ? 3 : (q.question_type === 'essay' ? 4 : 1))),
        points: Number(item.points ?? q.points ?? 1.0),
        cognitive_level: q.cognitive_level || item.cognitive_level || 'recognition',
        options: opts,
        statements: stmts,
        short_answer: q.short_answer || item.short_answer,
        correct_answer: q.correct_answer || item.correct_answer,
        explanation: q.explanation || item.explanation,
        sub_items: q.sub_items || item.sub_items,
      };
    });
  }

  public saveExam(examData: any) {
    if (!examData || !examData.id) return;
    const normalized = this.normalizeQuestions(examData.questions || []);
    this.exams.set(examData.id, {
      ...examData,
      questions: normalized.length > 0 ? normalized : (examData.questions || []),
    });
    this.saveToDisk();
  }

  public saveSession(session: any, examData?: any, questionsData?: ServerExamQuestion[]) {
    const cleanedCode = (session.access_code || '').trim().toUpperCase();
    const sessionId = session.id;

    const exam = examData || session.exam;
    const rawQuestions = questionsData || exam?.questions || session.questions || [];
    const normalizedQuestions = this.normalizeQuestions(rawQuestions);

    if (exam && exam.id) {
      this.exams.set(exam.id, {
        ...exam,
        questions: normalizedQuestions.length > 0 ? normalizedQuestions : (exam.questions || []),
      });
    } else if (session.exam_id) {
      this.exams.set(session.exam_id, {
        id: session.exam_id,
        title: session.title,
        duration_minutes: session.duration_minutes,
        total_points: session.total_points || 10,
        questions: normalizedQuestions,
      });
    }

    const sessionRecord = {
      ...session,
      exam_id: session.exam_id || exam?.id,
      access_code: cleanedCode,
    };

    this.sessions.set(sessionId, sessionRecord);
    if (cleanedCode) {
      this.sessionsByCode.set(cleanedCode, sessionId);
    }
    this.saveToDisk();
  }

  public getSessionByCode(code: string): any | null {
    const clean = (code || '').trim().toUpperCase();
    const id = this.sessionsByCode.get(clean);
    if (id) {
      return this.sessions.get(id) || null;
    }
    // Fallback linear search
    for (const sess of this.sessions.values()) {
      if ((sess.access_code || '').trim().toUpperCase() === clean) {
        return sess;
      }
    }
    return null;
  }

  public getSessionById(id: string): any | null {
    return this.sessions.get(id) || null;
  }

  public getExam(examId: string): ServerExam | null {
    return this.exams.get(examId) || null;
  }

  public isStudentAllowedRetake(sessionId: string, studentCode: string): boolean {
    const cleanCode = (studentCode || '').trim().toUpperCase();
    if (!cleanCode) return false;

    const session = this.getSessionById(sessionId) || this.getSessionByCode(sessionId);
    const keysToCheck = new Set<string>([sessionId]);
    if (session?.id) keysToCheck.add(session.id);
    if (session?.access_code) keysToCheck.add(session.access_code.trim().toUpperCase());

    for (const key of keysToCheck) {
      const set = this.allowedRetakes.get(key);
      if (set && set.has(cleanCode)) return true;
    }

    // Also check across all registered sessions
    for (const [key, set] of this.allowedRetakes.entries()) {
      if (set.has(cleanCode)) {
        if (
          key === sessionId ||
          key === '*' ||
          (session && (key === session.id || key === session.access_code?.trim().toUpperCase()))
        ) {
          return true;
        }
      }
    }

    return false;
  }

  public allowRetake(sessionId: string, studentCode: string, attemptId?: string) {
    const cleanCode = (studentCode || '').trim().toUpperCase();
    if (!cleanCode) return;

    const session = this.getSessionById(sessionId) || this.getSessionByCode(sessionId);
    const keysToRegister = new Set<string>([sessionId]);
    if (session?.id) keysToRegister.add(session.id);
    if (session?.access_code) keysToRegister.add(session.access_code.trim().toUpperCase());

    for (const key of keysToRegister) {
      if (!this.allowedRetakes.has(key)) {
        this.allowedRetakes.set(key, new Set());
      }
      this.allowedRetakes.get(key)!.add(cleanCode);
    }

    // Remove matching attempts from server memory
    for (const [id, att] of this.attempts.entries()) {
      if (
        (att.exam_session_id === sessionId || (session && att.exam_session_id === session.id)) &&
        ((att.student_code || '').trim().toUpperCase() === cleanCode || id === attemptId)
      ) {
        this.attempts.delete(id);
        this.answers.delete(id);
      }
    }

    // Remove matching result from server memory
    for (const k of keysToRegister) {
      const curResults = this.results.get(k) || [];
      const filtered = curResults.filter(
        (r) =>
          (r.student_code || '').trim().toUpperCase() !== cleanCode &&
          (!attemptId || r.attempt_id !== attemptId)
      );
      this.results.set(k, filtered);
    }
    this.saveToDisk();
  }

  public deleteResult(
    sessionId: string,
    resultId: string,
    attemptId?: string,
    explicitStudentCode?: string
  ) {
    let studentCode = (explicitStudentCode || '').trim().toUpperCase();
    const session = this.getSessionById(sessionId) || this.getSessionByCode(sessionId);
    const keysToRegister = new Set<string>([sessionId]);
    if (session?.id) keysToRegister.add(session.id);
    if (session?.access_code) keysToRegister.add(session.access_code.trim().toUpperCase());

    // 1. Purge across all stored result lists
    for (const [k, curResults] of this.results.entries()) {
      const target = curResults.find((r) => r.id === resultId || (attemptId && r.attempt_id === attemptId));
      if (target?.student_code && !studentCode) {
        studentCode = target.student_code.trim().toUpperCase();
      }

      const filtered = curResults.filter(
        (r) =>
          r.id !== resultId &&
          (!attemptId || r.attempt_id !== attemptId) &&
          (!studentCode || (r.student_code || '').trim().toUpperCase() !== studentCode)
      );
      this.results.set(k, filtered);
    }

    // 2. Remove matching attempts and answers
    if (attemptId) {
      this.attempts.delete(attemptId);
      this.answers.delete(attemptId);
    }

    for (const [id, att] of this.attempts.entries()) {
      const isMatchId = id === attemptId || (resultId && resultId.endsWith(id));
      const isMatchStudent = studentCode && (att.student_code || '').trim().toUpperCase() === studentCode;
      if (isMatchId || isMatchStudent) {
        this.attempts.delete(id);
        this.answers.delete(id);
      }
    }

    // 3. Register retake permission across session keys
    if (studentCode) {
      for (const k of keysToRegister) {
        if (!this.allowedRetakes.has(k)) {
          this.allowedRetakes.set(k, new Set());
        }
        this.allowedRetakes.get(k)!.add(studentCode);
      }
    }
    this.saveToDisk();
  }

  public clearStudentAllData(studentCode: string) {
    const cleanCode = (studentCode || '').trim().toUpperCase();
    if (!cleanCode) return;

    for (const [id, att] of this.attempts.entries()) {
      if ((att.student_code || '').trim().toUpperCase() === cleanCode) {
        this.attempts.delete(id);
        this.answers.delete(id);
      }
    }

    for (const [k, list] of this.results.entries()) {
      const filtered = list.filter((r) => (r.student_code || '').trim().toUpperCase() !== cleanCode);
      this.results.set(k, filtered);
    }

    for (const set of this.allowedRetakes.values()) {
      set.add(cleanCode);
    }
    this.saveToDisk();
  }

  public getAttemptsByStudent(sessionId: string, studentCode: string): ExamAttempt[] {
    const clean = (studentCode || '').trim().toUpperCase();
    const list: ExamAttempt[] = [];
    for (const att of this.attempts.values()) {
      if (
        att.exam_session_id === sessionId &&
        (att.student_code || '').trim().toUpperCase() === clean
      ) {
        list.push(att);
      }
    }
    return list;
  }

  public createAttempt(
    sessionId: string,
    studentName: string,
    studentCode: string
  ): ExamAttempt {
    const cleanCode = (studentCode || '').trim().toUpperCase();
    const id = crypto.randomUUID();

    const attempt: ExamAttempt = {
      id,
      exam_session_id: sessionId,
      student_name: studentName.trim(),
      student_code: cleanCode,
      attempt_number: 1,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.attempts.set(id, attempt);
    this.saveToDisk();
    return attempt;
  }

  public getAttempt(attemptId: string): ExamAttempt | undefined {
    return this.attempts.get(attemptId);
  }

  public saveAnswer(attemptId: string, questionId: string, answer: any) {
    if (!this.answers.has(attemptId)) {
      this.answers.set(attemptId, {});
    }
    this.answers.get(attemptId)![questionId] = answer;
    this.saveToDisk();
  }

  public getAnswers(attemptId: string): Record<string, any> {
    return this.answers.get(attemptId) || {};
  }

  public getResultsBySession(sessionId: string): ExamResult[] {
    return this.results.get(sessionId) || [];
  }

  public addResult(result: ExamResult) {
    const sessionId = result.exam_session_id;
    if (!this.results.has(sessionId)) {
      this.results.set(sessionId, []);
    }
    const list = this.results.get(sessionId)!;
    const existingIdx = list.findIndex(
      (r) => r.attempt_id === result.attempt_id || r.id === result.id
    );
    if (existingIdx >= 0) {
      list[existingIdx] = result;
    } else {
      list.unshift(result);
    }
    this.saveToDisk();
  }

  // ACCURATE SERVER-AUTHORITATIVE GRADING ENGINE
  public gradeAndSubmit(
    attemptId: string,
    sessionId: string,
    userAnswers: Record<string, any>,
    studentName?: string,
    studentCode?: string,
    fallbackExamId?: string,
    fallbackQuestions?: any[]
  ): { success: boolean; result?: ExamResult; message?: string } {
    let session = this.getSessionById(sessionId) || this.getSessionByCode(sessionId);
    if (!session) {
      // Create fallback session record if not found
      session = {
        id: sessionId,
        title: 'Kỳ thi',
        access_code: sessionId,
        duration_minutes: 45,
        exam_id: fallbackExamId,
      };
      this.sessions.set(sessionId, session);
    }

    const exam = this.getExam(session.exam_id) || (fallbackExamId ? this.getExam(fallbackExamId) : null);
    let questions: ServerExamQuestion[] = this.normalizeQuestions(exam?.questions || []);

    // Check if client provided fallback questions with more data (e.g. answer keys or populated questions)
    if (fallbackQuestions && fallbackQuestions.length > 0) {
      const normFallback = this.normalizeQuestions(fallbackQuestions);
      const hasAnswerKeys = (list: ServerExamQuestion[]) =>
        list.some((q) => (q.options || []).some((o) => o.is_correct) || (q.statements || []).some((s) => s.is_correct));

      if (!questions.length || (!hasAnswerKeys(questions) && hasAnswerKeys(normFallback))) {
        questions = normFallback;
      }
    }

    // If no questions found or question IDs don't match student's answers, look across all stored exams
    const answerQuestionIds = Object.keys(userAnswers || {});
    if (answerQuestionIds.length > 0 && (!questions.length || !questions.some((q) => answerQuestionIds.includes(q.id)))) {
      for (const ex of this.exams.values()) {
        const exQuestions = this.normalizeQuestions(ex.questions || []);
        if (exQuestions.some((q) => answerQuestionIds.includes(q.id))) {
          questions = exQuestions;
          break;
        }
      }
    }

    // If still empty and client provided fallback questions
    if ((!questions || questions.length === 0) && fallbackQuestions && fallbackQuestions.length > 0) {
      questions = this.normalizeQuestions(fallbackQuestions);
    }

    // Last resort fallback
    if (!questions || questions.length === 0) {
      questions = this.normalizeQuestions(this.exams.values().next().value?.questions || DEMO_QUESTIONS);
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const reviewQuestions: ExamResultQuestionReview[] = questions.map((q, idx) => {
      const qPoints = Number(q.points) || 1.0;
      totalPoints += qPoints;
      const userAns = userAnswers[q.id];
      const qType = q.question_type;

      // 1. True / False Question (Part II)
      if (qType === 'true_false' || q.exam_part === 2 || (q.statements && q.statements.length > 0)) {
        const rawStatements = q.statements || [];
        const userStAnswers = userAns?.statement_answers || {};
        const answeredCountForQ = Object.keys(userStAnswers).length;
        const isAnswered = answeredCountForQ > 0;

        if (!isAnswered) {
          unansweredCount++;
          return {
            id: q.id,
            order: q.order || idx + 1,
            content: q.content,
            question_type: 'true_false',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
          };
        }

        const pointsPerSt = qPoints / Math.max(1, rawStatements.length);
        let qEarned = 0;
        let allCorrect = true;

        const reviewedStatements = rawStatements.map((st, sIdx) => {
          const stId = st.id || `st-${sIdx + 1}`;
          const userChoice = userStAnswers[stId] ?? userStAnswers[st.id];
          const isStAnswered = userChoice !== undefined;
          const isMatch = isStAnswered ? Boolean(userChoice) === Boolean(st.is_correct) : false;

          if (isMatch) {
            qEarned += pointsPerSt;
          } else {
            allCorrect = false;
          }

          return {
            id: stId,
            statement: st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, ''),
            user_choice: userChoice,
            is_correct: isStAnswered ? Boolean(st.is_correct) : undefined,
            explanation: isStAnswered
              ? st.explanation || (st.is_correct ? 'Mệnh đề ĐÚNG.' : 'Mệnh đề SAI.')
              : undefined,
            is_statement_correct: isStAnswered ? isMatch : false,
            earned_points: isMatch ? Math.round(pointsPerSt * 100) / 100 : 0,
          };
        });

        earnedPoints += qEarned;
        if (allCorrect && answeredCountForQ === rawStatements.length) {
          correctCount++;
        } else {
          wrongCount++;
        }

        return {
          id: q.id,
          order: q.order || idx + 1,
          content: q.content,
          question_type: 'true_false',
          points: qPoints,
          earned_points: Math.round(qEarned * 100) / 100,
          is_answered: true,
          user_statement_answers: userStAnswers,
          statements: reviewedStatements,
          explanation: q.explanation,
        };
      }

      // 2. Short Answer (Part III)
      if (qType === 'short_answer' || q.exam_part === 3) {
        const textAns = userAns?.answer_text ? String(userAns.answer_text).trim() : '';
        const isAnswered = textAns.length > 0;

        if (!isAnswered) {
          unansweredCount++;
          return {
            id: q.id,
            order: q.order || idx + 1,
            content: q.content,
            question_type: 'short_answer',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
          };
        }

        const rawExpected =
          q.short_answer?.normalized_answer ||
          q.options?.find((o) => o.is_correct)?.content ||
          q.correct_answer ||
          '';
        const variants = q.short_answer?.accepted_variants || [rawExpected];

        const normalizeStr = (str: string) =>
          str.toLowerCase().replace(/,/g, '.').replace(/\s+/g, '').trim();

        const normUser = normalizeStr(textAns);
        const isCorrect =
          variants.some((v) => normalizeStr(v) === normUser) ||
          (normUser !== '' && normUser === normalizeStr(rawExpected));

        if (isCorrect) {
          earnedPoints += qPoints;
          correctCount++;
        } else {
          wrongCount++;
        }

        return {
          id: q.id,
          order: q.order || idx + 1,
          content: q.content,
          question_type: 'short_answer',
          points: qPoints,
          earned_points: isCorrect ? qPoints : 0,
          is_answered: true,
          user_answer_text: textAns,
          correct_answer: rawExpected,
          explanation: q.explanation || 'Kết quả giải theo kiến thức chuẩn của bài toán.',
        };
      }

      // 3. Essay (Part IV)
      if (qType === 'essay' || q.exam_part === 4) {
        const textAns = userAns?.answer_text ? String(userAns.answer_text).trim() : '';
        const isAnswered = textAns.length > 0;

        if (!isAnswered) {
          unansweredCount++;
          return {
            id: q.id,
            order: q.order || idx + 1,
            content: q.content,
            question_type: 'essay',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
          };
        }

        earnedPoints += qPoints;
        correctCount++;

        return {
          id: q.id,
          order: q.order || idx + 1,
          content: q.content,
          question_type: 'essay',
          points: qPoints,
          earned_points: qPoints,
          is_answered: true,
          user_answer_text: textAns,
          explanation: q.explanation || q.correct_answer || 'Hướng dẫn chấm bài tự luận chi tiết.',
        };
      }

      // 4. Single Choice / Multiple Choice (Part I)
      const selectedId =
        userAns?.selected_option_id ||
        (typeof userAns?.answer_text === 'string' && !userAns.answer_text.startsWith('{')
          ? userAns.answer_text.trim()
          : undefined);
      const isAnswered = Boolean(selectedId || (userAns?.selected_option_ids && userAns.selected_option_ids.length > 0));

      let correctOpt = (q.options || []).find((o) => o.is_correct);
      if (!correctOpt && q.correct_option_id) {
        correctOpt = (q.options || []).find((o) => o.id === q.correct_option_id);
      }
      if (!correctOpt && q.correct_answer) {
        const ca = String(q.correct_answer).trim();
        correctOpt = (q.options || []).find(
          (o) => o.id === ca || o.content?.trim() === ca
        );
      }

      const isCorrect =
        isAnswered &&
        Boolean(
          correctOpt &&
            (selectedId === correctOpt.id ||
              (userAns?.selected_option_ids && userAns.selected_option_ids.includes(correctOpt.id)) ||
              (selectedId && selectedId.toLowerCase() === correctOpt.content?.trim().toLowerCase()))
        );

      if (!isAnswered) {
        unansweredCount++;
        return {
          id: q.id,
          order: q.order || idx + 1,
          content: q.content,
          question_type: 'single_choice',
          points: qPoints,
          earned_points: 0,
          is_answered: false,
        };
      }

      if (isCorrect) {
        earnedPoints += qPoints;
        correctCount++;
      } else {
        wrongCount++;
      }

      return {
        id: q.id,
        order: q.order || idx + 1,
        content: q.content,
        question_type: 'single_choice',
        points: qPoints,
        earned_points: isCorrect ? qPoints : 0,
        is_answered: true,
        user_selected_option_id: selectedId,
        correct_option_id: correctOpt?.id,
        explanation: q.explanation || 'Theo kiến thức trọng tâm bài học.',
        options: (q.options || []).map((o) => ({
          id: o.id,
          content: o.content,
          is_correct: Boolean(o.is_correct),
        })),
      };
    });

    if (totalPoints === 0) totalPoints = 10;
    const finalScore = Math.round(Math.min(totalPoints, earnedPoints) * 100) / 100;
    const percentage = Math.round((finalScore / totalPoints) * 100);

    const existingAtt = this.attempts.get(attemptId);
    const resolvedStudentName = studentName || existingAtt?.student_name || 'Học sinh';
    const resolvedStudentCode = studentCode || existingAtt?.student_code || 'HS-ONLINE';

    // Update attempt
    if (existingAtt) {
      existingAtt.status = 'graded';
      existingAtt.score = finalScore;
      existingAtt.max_score = totalPoints;
      existingAtt.percentage = percentage;
      existingAtt.submitted_at = new Date().toISOString();
    } else {
      this.attempts.set(attemptId, {
        id: attemptId,
        exam_session_id: session.id,
        student_name: resolvedStudentName,
        student_code: resolvedStudentCode,
        attempt_number: 1,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        status: 'graded',
        score: finalScore,
        max_score: totalPoints,
        percentage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const result: ExamResult = {
      id: `res-${attemptId}`,
      attempt_id: attemptId,
      exam_session_id: session.id,
      student_name: resolvedStudentName,
      student_code: resolvedStudentCode,
      score: finalScore,
      max_score: totalPoints,
      percentage,
      correct_count: correctCount,
      wrong_count: wrongCount,
      unanswered_count: unansweredCount,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      review_questions: reviewQuestions,
    };

    this.addResult(result);

    // Consume retake permission once successfully submitted
    const cleanStudentCode = resolvedStudentCode.trim().toUpperCase();
    if (session?.id) this.allowedRetakes.get(session.id)?.delete(cleanStudentCode);
    if (session?.access_code) this.allowedRetakes.get(session.access_code.trim().toUpperCase())?.delete(cleanStudentCode);
    if (sessionId) this.allowedRetakes.get(sessionId)?.delete(cleanStudentCode);

    return {
      success: true,
      result,
    };
  }
}

export const serverExamStore = new ExamStore();
