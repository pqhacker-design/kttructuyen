import { 
  Subject, 
  SchoolClass, 
  Student, 
  QuestionBank, 
  Question, 
  QuestionOption, 
  Matrix, 
  MatrixItem, 
  Exam, 
  ExamQuestion, 
  ExamSession, 
  ExamAttempt, 
  AttemptAnswer, 
  ExamResult, 
  Profile,
  DEFAULT_ACADEMIC_YEAR
} from '../types';

const STORAGE_KEY = 'eduexam_production_store_v1';

export const DEMO_PROFILE: Profile | null = null;

const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 'subj-toan-10',
    name: 'Toán học',
    code: 'TOAN10',
    grade: 10,
    description: 'Chương trình Toán THPT chuẩn GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-van-10',
    name: 'Ngữ văn',
    code: 'VAN10',
    grade: 10,
    description: 'Chương trình Ngữ văn 10 GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-anh-10',
    name: 'Tiếng Anh',
    code: 'ANH10',
    grade: 10,
    description: 'Global Success Tiếng Anh 10',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-ly-10',
    name: 'Vật lí',
    code: 'VATLY10',
    grade: 10,
    description: 'Vật lí 10 Kết nối tri thức',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-hoa-10',
    name: 'Hóa học',
    code: 'HOAHOC10',
    grade: 10,
    description: 'Hóa học 10 GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-sinh-10',
    name: 'Sinh học',
    code: 'SINHHOC10',
    grade: 10,
    description: 'Sinh học 10 GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-su-10',
    name: 'Lịch sử',
    code: 'LICHSU10',
    grade: 10,
    description: 'Lịch sử 10 GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-dia-10',
    name: 'Địa lí',
    code: 'DIALI10',
    grade: 10,
    description: 'Địa lí 10 GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'subj-tin-10',
    name: 'Tin học',
    code: 'TINHOC10',
    grade: 10,
    description: 'Tin học 10 GDPT 2018',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_CLASSES: SchoolClass[] = [];
const INITIAL_STUDENTS: Student[] = [];
const INITIAL_BANKS: QuestionBank[] = [];
const INITIAL_QUESTIONS: Question[] = [];
const INITIAL_EXAMS: Exam[] = [];
const INITIAL_SESSIONS: ExamSession[] = [];
const INITIAL_RESULTS: ExamResult[] = [];
const INITIAL_MATRICES: Matrix[] = [];

interface MockDataState {
  subjects: Subject[];
  classes: SchoolClass[];
  students: Student[];
  banks: QuestionBank[];
  questions: Question[];
  exams: Exam[];
  sessions: ExamSession[];
  attempts: Record<string, ExamAttempt>;
  answers: Record<string, Record<string, { selected_option_id?: string; answer_text?: string }>>;
  results: ExamResult[];
  matrices: Matrix[];
}

function getInitialStore(): MockDataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: MockDataState = JSON.parse(raw);
      // Auto link any matrix to its corresponding exam if missing
      if (parsed.matrices && parsed.exams) {
        parsed.matrices.forEach((mat: any) => {
          if (!mat.exam_id) {
            const cleanMatName = (mat.name || '').replace(/^Ma trận & Bảng đặc tả - /i, '').trim().toLowerCase();
            const match = parsed.exams.find((e: any) =>
              (e.matrix_id && e.matrix_id === mat.id) ||
              (cleanMatName && e.title && (e.title.toLowerCase().includes(cleanMatName) || cleanMatName.includes(e.title.toLowerCase())))
            );
            if (match) {
              mat.exam_id = match.id;
            }
          }
        });
      }
      return parsed;
    }
  } catch (e) {
    // Ignore localStorage parse errors
  }
  return {
    subjects: INITIAL_SUBJECTS,
    classes: INITIAL_CLASSES,
    students: INITIAL_STUDENTS,
    banks: INITIAL_BANKS,
    questions: INITIAL_QUESTIONS,
    exams: INITIAL_EXAMS,
    sessions: INITIAL_SESSIONS,
    attempts: {},
    answers: {},
    results: INITIAL_RESULTS,
    matrices: INITIAL_MATRICES,
  };
}

let storeState: MockDataState = getInitialStore();

function persistStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storeState));
  } catch (e) {
    // Storage quota or error
  }
}

let idSequence = 0;
function uniqueId(prefix: string): string {
  idSequence++;
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${Date.now()}-${idSequence}-${rand}`;
}

// ----------------------------------------------------------------------------
// EXPORTED MOCK STORE API
// ----------------------------------------------------------------------------
export const mockStore = {
  // Subjects
  getSubjects: (): Subject[] => [...storeState.subjects],
  addSubject: (s: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Subject => {
    const newSubj: Subject = {
      ...s,
      id: uniqueId('subj'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.subjects.push(newSubj);
    persistStore();
    return newSubj;
  },

  // Classes & Students
  getClasses: (): SchoolClass[] => [...storeState.classes],
  addClass: (cls: { name: string; grade: number; school_year?: string }): SchoolClass => {
    const newClass: SchoolClass = {
      ...cls,
      school_year: cls.school_year || DEFAULT_ACADEMIC_YEAR,
      id: uniqueId('class'),
      student_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.classes.push(newClass);
    persistStore();
    return newClass;
  },
  addBulkClasses: (classList: { name: string; grade: number; school_year?: string }[]): SchoolClass[] => {
    const created: SchoolClass[] = [];
    for (const cls of classList) {
      const newClass: SchoolClass = {
        ...cls,
        school_year: cls.school_year || DEFAULT_ACADEMIC_YEAR,
        id: uniqueId('class'),
        student_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      storeState.classes.push(newClass);
      created.push(newClass);
    }
    persistStore();
    return created;
  },
  deleteClass: (id: string): boolean => {
    storeState.classes = storeState.classes.filter(c => c.id !== id);
    storeState.students = storeState.students.filter(s => s.class_id !== id);
    persistStore();
    return true;
  },
  getStudents: (classId?: string): Student[] => {
    if (classId) {
      return storeState.students.filter(s => s.class_id === classId);
    }
    return [...storeState.students];
  },
  findStudentByCode: (code: string): Student | null => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    return storeState.students.find(s => s.student_code.trim().toUpperCase() === clean) || null;
  },
  syncClasses: (remoteClasses: SchoolClass[]) => {
    for (const remote of remoteClasses) {
      const idx = storeState.classes.findIndex(c => c.id === remote.id);
      if (idx >= 0) {
        storeState.classes[idx] = { ...storeState.classes[idx], ...remote };
      } else {
        storeState.classes.push(remote);
      }
    }
    persistStore();
  },
  addStudent: (st: { student_code: string; full_name: string; class_id: string; email?: string }): Student => {
    const foundClass = storeState.classes.find(c => c.id === st.class_id);
    const cleanCode = st.student_code.trim().toUpperCase();
    const cleanName = st.full_name.trim();
    
    // Check if student with same code in class already exists
    const existingIdx = storeState.students.findIndex(
      s => s.class_id === st.class_id && s.student_code.trim().toUpperCase() === cleanCode
    );

    if (existingIdx >= 0) {
      const updated: Student = {
        ...storeState.students[existingIdx],
        full_name: cleanName,
        email: st.email || storeState.students[existingIdx].email,
        class_name: foundClass?.name || storeState.students[existingIdx].class_name || '',
        updated_at: new Date().toISOString(),
      };
      storeState.students[existingIdx] = updated;
      persistStore();
      return updated;
    }

    const newStudent: Student = {
      ...st,
      student_code: cleanCode,
      full_name: cleanName,
      id: uniqueId('student'),
      class_name: foundClass?.name || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.students.push(newStudent);
    if (foundClass) {
      foundClass.student_count = (foundClass.student_count || 0) + 1;
    }
    persistStore();
    return newStudent;
  },
  addBulkStudents: (studentsList: { student_code: string; full_name: string; class_id: string; email?: string }[]): Student[] => {
    const created: Student[] = [];
    for (const st of studentsList) {
      const foundClass = storeState.classes.find(c => c.id === st.class_id);
      const cleanCode = st.student_code.trim().toUpperCase();
      const cleanName = st.full_name.trim();

      const existingIdx = storeState.students.findIndex(
        s => s.class_id === st.class_id && s.student_code.trim().toUpperCase() === cleanCode
      );

      if (existingIdx >= 0) {
        const updated: Student = {
          ...storeState.students[existingIdx],
          full_name: cleanName,
          email: st.email || storeState.students[existingIdx].email,
          class_name: foundClass?.name || storeState.students[existingIdx].class_name || '',
          updated_at: new Date().toISOString(),
        };
        storeState.students[existingIdx] = updated;
        created.push(updated);
      } else {
        const newStudent: Student = {
          ...st,
          student_code: cleanCode,
          full_name: cleanName,
          id: uniqueId('student'),
          class_name: foundClass?.name || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        storeState.students.push(newStudent);
        if (foundClass) {
          foundClass.student_count = (foundClass.student_count || 0) + 1;
        }
        created.push(newStudent);
      }
    }
    persistStore();
    return created;
  },
  deleteStudent: (id: string): boolean => {
    const st = storeState.students.find(s => s.id === id);
    if (st && st.class_id) {
      const cls = storeState.classes.find(c => c.id === st.class_id);
      if (cls && cls.student_count) {
        cls.student_count = Math.max(0, cls.student_count - 1);
      }
    }
    storeState.students = storeState.students.filter(s => s.id !== id);
    persistStore();
    return true;
  },

  // Question Banks & Questions
  getBanks: (): QuestionBank[] => [...storeState.banks],
  addBank: (bank: { name: string; subject_id: string; description?: string; owner_id: string }): QuestionBank => {
    const subject = storeState.subjects.find(s => s.id === bank.subject_id);
    const newBank: QuestionBank = {
      ...bank,
      id: uniqueId('bank'),
      subject_name: subject?.name || 'Môn học',
      question_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.banks.unshift(newBank);
    persistStore();
    return newBank;
  },
  deleteBank: (id: string): boolean => {
    storeState.banks = storeState.banks.filter(b => b.id !== id);
    storeState.questions = storeState.questions.filter(q => q.question_bank_id !== id);
    persistStore();
    return true;
  },
  getQuestions: (bankId?: string): Question[] => {
    if (bankId) {
      return storeState.questions.filter(q => q.question_bank_id === bankId);
    }
    return [...storeState.questions];
  },
  addQuestion: (
    q: Omit<Question, 'id' | 'created_at' | 'updated_at' | 'options'>,
    options: Omit<QuestionOption, 'id' | 'question_id'>[]
  ): Question => {
    const qId = uniqueId('q');
    const optsWithId: QuestionOption[] = options.map((opt, idx) => ({
      ...opt,
      id: uniqueId(`opt-${idx + 1}`),
      question_id: qId,
      created_at: new Date().toISOString(),
    }));

    const newQ: Question = {
      ...q,
      id: qId,
      options: optsWithId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storeState.questions.unshift(newQ);
    const bank = storeState.banks.find(b => b.id === q.question_bank_id);
    if (bank) {
      bank.question_count = (bank.question_count || 0) + 1;
    }
    persistStore();
    return newQ;
  },
  deleteQuestion: (id: string): boolean => {
    const q = storeState.questions.find(item => item.id === id);
    if (q) {
      const bank = storeState.banks.find(b => b.id === q.question_bank_id);
      if (bank && bank.question_count) {
        bank.question_count = Math.max(0, bank.question_count - 1);
      }
    }
    storeState.questions = storeState.questions.filter(item => item.id !== id);
    persistStore();
    return true;
  },

  // Exams
  getExams: (): Exam[] => [...storeState.exams],
  getExamById: (id: string): Exam | null => {
    return storeState.exams.find(e => e.id === id) || null;
  },
  addExam: (examData: any): Exam => {
    const subject = storeState.subjects.find(s => s.id === examData.subject_id);
    const newExam: Exam = {
      ...examData,
      id: uniqueId('exam'),
      subject_name: subject?.name || 'Môn học',
      question_count: 0,
      questions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.exams.unshift(newExam);
    persistStore();
    return newExam;
  },
  addQuestionToExam: (examId: string, questionId: string, points: number): boolean => {
    const exam = storeState.exams.find(e => e.id === examId);
    const question = storeState.questions.find(q => q.id === questionId);
    if (!exam || !question) return false;

    if (!exam.questions) exam.questions = [];
    const newEq: ExamQuestion = {
      id: uniqueId('eq'),
      exam_id: examId,
      question_id: questionId,
      question_order: exam.questions.length + 1,
      points,
      question,
      created_at: new Date().toISOString(),
    };
    exam.questions.push(newEq);
    exam.question_count = exam.questions.length;
    exam.total_points = exam.questions.reduce((acc, cur) => acc + (cur.points || 0), 0);
    persistStore();
    return true;
  },
  removeQuestionFromExam: (examId: string, examQuestionId: string): boolean => {
    const exam = storeState.exams.find(e => e.id === examId);
    if (!exam || !exam.questions) return false;
    exam.questions = exam.questions.filter(eq => eq.id !== examQuestionId);
    exam.question_count = exam.questions.length;
    exam.total_points = exam.questions.reduce((acc, cur) => acc + (cur.points || 0), 0);
    persistStore();
    return true;
  },
  deleteExam: (id: string): boolean => {
    storeState.exams = storeState.exams.filter(e => e.id !== id);
    persistStore();
    return true;
  },

  // Sessions
  getSessions: (): ExamSession[] => [...storeState.sessions],
  getSessionById: (id: string): ExamSession | null => {
    return storeState.sessions.find(s => s.id === id) || null;
  },
  getSessionByCode: (code: string): ExamSession | null => {
    const clean = code.trim().toUpperCase();
    return storeState.sessions.find(s => s.access_code.toUpperCase() === clean) || null;
  },
  addSession: (sessionData: any): ExamSession => {
    const exam = storeState.exams.find(e => e.id === sessionData.exam_id);
    const newSession: ExamSession = {
      ...sessionData,
      id: uniqueId('session'),
      access_code: sessionData.access_code.toUpperCase().trim(),
      exam_title: exam?.title || 'Đề thi',
      exam,
      attempts_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.sessions.unshift(newSession);
    persistStore();
    return newSession;
  },
  updateSession: (id: string, updates: Partial<ExamSession>): ExamSession | null => {
    const session = storeState.sessions.find(s => s.id === id);
    if (session) {
      Object.assign(session, updates, { updated_at: new Date().toISOString() });
      persistStore();
      return session;
    }
    return null;
  },
  updateSessionStatus: (id: string, status: any): boolean => {
    const session = storeState.sessions.find(s => s.id === id);
    if (session) {
      session.status = status;
      session.updated_at = new Date().toISOString();
      persistStore();
      return true;
    }
    return false;
  },
  deleteSession: (id: string): boolean => {
    storeState.sessions = storeState.sessions.filter(s => s.id !== id);
    persistStore();
    return true;
  },

  // Attempts & Results
  createAttempt: (attempt: ExamAttempt) => {
    if (!storeState.attempts) storeState.attempts = {};
    storeState.attempts[attempt.id] = attempt;
    persistStore();
  },
  addAttempt: (attempt: ExamAttempt) => {
    if (!storeState.attempts) storeState.attempts = {};
    storeState.attempts[attempt.id] = attempt;
    persistStore();
  },
  getAttempt: (id: string): ExamAttempt | undefined => {
    return (storeState.attempts || {})[id];
  },
  getAttemptById: (id: string): ExamAttempt | undefined => {
    return (storeState.attempts || {})[id];
  },
  getAttemptsBySessionAndStudent: (sessionId: string, studentCode: string): ExamAttempt[] => {
    return Object.values(storeState.attempts || {}).filter(
      (a) => a.exam_session_id === sessionId && (a.student_code || '').toLowerCase() === studentCode.toLowerCase()
    );
  },
  saveAttemptAnswer: (attemptId: string, questionId: string, answer: { selected_option_id?: string; answer_text?: string; statement_answers?: Record<string, boolean> }) => {
    if (!storeState.answers[attemptId]) {
      storeState.answers[attemptId] = {};
    }
    storeState.answers[attemptId][questionId] = answer;
    persistStore();
  },
  getAttemptAnswers: (attemptId: string) => {
    return storeState.answers[attemptId] || {};
  },
  addResult: (res: ExamResult) => {
    // Avoid duplicate results for the same attempt
    const existingIdx = storeState.results.findIndex(r => r.attempt_id === res.attempt_id || r.id === res.id);
    if (existingIdx >= 0) {
      storeState.results[existingIdx] = res;
    } else {
      storeState.results.unshift(res);
      const session = storeState.sessions.find(s => s.id === res.exam_session_id);
      if (session) {
        session.attempts_count = (session.attempts_count || 0) + 1;
      }
    }
    persistStore();
  },
  getResultsBySession: (sessionId: string): ExamResult[] => {
    return storeState.results.filter(r => r.exam_session_id === sessionId);
  },
  getAllResults: (): ExamResult[] => [...storeState.results],
  deleteResult: (resultId: string, attemptId?: string): boolean => {
    const targetAttemptId = attemptId || storeState.results.find(r => r.id === resultId)?.attempt_id;
    storeState.results = storeState.results.filter(r => r.id !== resultId && (!targetAttemptId || r.attempt_id !== targetAttemptId));
    if (targetAttemptId && storeState.attempts) {
      const att = storeState.attempts[targetAttemptId];
      if (att) {
        const session = storeState.sessions.find(s => s.id === att.exam_session_id);
        if (session && (session.attempts_count || 0) > 0) {
          session.attempts_count = Math.max(0, (session.attempts_count || 1) - 1);
        }
      }
      delete storeState.attempts[targetAttemptId];
      if (storeState.answers) {
        delete storeState.answers[targetAttemptId];
      }
    }
    persistStore();
    return true;
  },
  resetStudentAttempt: (sessionId: string, studentCode: string, attemptId?: string): boolean => {
    const cleanCode = studentCode.trim().toLowerCase();
    // Remove attempts for this student in this session
    if (storeState.attempts) {
      Object.keys(storeState.attempts).forEach(id => {
        const a = storeState.attempts[id];
        if (a && a.exam_session_id === sessionId && (a.student_code || '').trim().toLowerCase() === cleanCode) {
          delete storeState.attempts[id];
          if (storeState.answers) {
            delete storeState.answers[id];
          }
        }
      });
    }
    // Remove from results
    storeState.results = storeState.results.filter(
      r => !(r.exam_session_id === sessionId && (r.student_code || '').trim().toLowerCase() === cleanCode)
    );
    persistStore();
    return true;
  },

  // Matrices
  getMatrices: (): Matrix[] => [...storeState.matrices],
  addMatrix: (matrixData: any, items: any[]): Matrix => {
    const subject = storeState.subjects.find(s => s.id === matrixData.subject_id);
    const matId = uniqueId('mat');
    const itemsWithId: MatrixItem[] = items.map((it, idx) => ({
      ...it,
      id: uniqueId(`mi-${idx + 1}`),
      matrix_id: matId,
      created_at: new Date().toISOString(),
    }));

    const totalQ = itemsWithId.reduce((acc, cur) => acc + (cur.question_count || 0), 0);
    const totalPts = itemsWithId.reduce((acc, cur) => acc + (cur.points || 0), 0);

    const newMatrix: Matrix = {
      ...matrixData,
      id: matId,
      subject_name: subject?.name || 'Môn học',
      items: itemsWithId,
      cells: matrixData.cells || undefined,
      exam_id: matrixData.exam_id || undefined,
      total_questions: totalQ,
      total_points: totalPts,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storeState.matrices.unshift(newMatrix);
    persistStore();
    return newMatrix;
  },
  updateMatrixExamId: (matrixId: string, examId: string) => {
    const mat = storeState.matrices.find(m => m.id === matrixId);
    if (mat) {
      mat.exam_id = examId;
      persistStore();
    }
  },
  deleteMatrix: (id: string): boolean => {
    storeState.matrices = storeState.matrices.filter(m => m.id !== id);
    persistStore();
    return true;
  },

  // Reset to initial demo data
  resetDemoData: () => {
    localStorage.removeItem(STORAGE_KEY);
    storeState = getInitialStore();
    persistStore();
  },
};
