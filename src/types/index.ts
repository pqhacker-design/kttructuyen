// Comprehensive TypeScript types for Online Examination System

export type UserRole = 'admin' | 'user' | 'teacher' | 'student';
export type UserStatus = 'active' | 'inactive' | 'locked';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  phone?: string;
  role: UserRole;
  status?: UserStatus;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  target_user_id?: string | null;
  target_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AccessCode {
  id: string;
  code: string;
  exam_session_id: string;
  status: 'active' | 'inactive' | 'expired';
  expires_at?: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  organization_id?: string;
  name: string;
  code: string;
  grade: number;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SchoolClass {
  id: string;
  organization_id?: string;
  name: string;
  grade: number;
  school_year: string;
  teacher_id?: string;
  student_count?: number;
  created_at: string;
  updated_at: string;
}

export type ClassGroup = SchoolClass;

export interface Student {
  id: string;
  organization_id?: string;
  user_id?: string | null;
  student_code: string;
  full_name: string;
  date_of_birth?: string;
  class_id?: string;
  class_name?: string;
  created_at: string;
  updated_at: string;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';

export type CognitiveLevel = 'recognition' | 'comprehension' | 'application' | 'advanced_application';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBank {
  id: string;
  organization_id?: string;
  owner_id: string;
  name: string;
  subject_id: string;
  subject_name?: string;
  description?: string;
  question_count?: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  content: string;
  is_correct?: boolean; // Hidden during test-taking!
  option_order: number;
  created_at?: string;
}

export interface Question {
  id: string;
  question_bank_id: string;
  owner_id: string;
  subject_id: string;
  content: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  cognitive_level: CognitiveLevel;
  explanation?: string;
  points: number;
  options?: QuestionOption[];
  statements?: {
    id: string;
    statement: string;
    is_correct?: boolean;
    explanation?: string;
  }[];
  correct_answer?: string;
  normalized_answer?: string;
  exam_part?: number;
  intro_text?: string;
  sub_items?: any[];
  attachments?: QuestionAttachment[];
  created_at: string;
  updated_at: string;
}

export interface QuestionAttachment {
  id: string;
  question_id: string;
  file_url: string;
  file_type: string;
  storage_path?: string;
  created_at: string;
}

export interface MatrixItem {
  id: string;
  matrix_id: string;
  topic: string;
  subtopic?: string;
  learning_requirement?: string;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  question_count: number;
  points: number;
  created_at?: string;
}

export interface Matrix {
  id: string;
  organization_id?: string;
  owner_id: string;
  subject_id: string;
  subject_name?: string;
  name: string;
  grade: number;
  description?: string;
  items?: MatrixItem[];
  total_questions?: number;
  total_points?: number;
  created_at: string;
  updated_at: string;
}

export interface SpecificationItem {
  id: string;
  specification_id: string;
  topic: string;
  content_standard: string;
  learning_objective: string;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  question_count: number;
  points: number;
  created_at?: string;
}

export interface Specification {
  id: string;
  organization_id?: string;
  owner_id: string;
  matrix_id: string;
  name: string;
  description?: string;
  items?: SpecificationItem[];
  created_at: string;
  updated_at: string;
}

export type ExamStatus = 'draft' | 'published' | 'archived';

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_id: string;
  question_order: number;
  points: number;
  question?: Question;
  created_at?: string;
}

export interface Exam {
  id: string;
  organization_id?: string;
  owner_id: string;
  subject_id: string;
  subject_name?: string;
  matrix_id?: string | null;
  specification_id?: string | null;
  title: string;
  description?: string;
  grade: number;
  duration_minutes: number;
  total_points: number;
  status: ExamStatus;
  question_count?: number;
  questions?: ExamQuestion[];
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';

export interface ExamSession {
  id: string;
  exam_id: string;
  organization_id?: string;
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
  exam_title?: string;
  exam?: Exam;
  attempts_count?: number;
  created_at: string;
  updated_at: string;
}

export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'expired';

export interface ExamAttempt {
  id: string;
  exam_session_id: string;
  student_id?: string | null;
  user_id?: string | null;
  student_name?: string;
  student_code?: string;
  attempt_number: number;
  started_at: string;
  submitted_at?: string | null;
  status: AttemptStatus;
  score?: number | null;
  max_score?: number | null;
  percentage?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AttemptAnswer {
  id?: string;
  attempt_id: string;
  question_id: string;
  selected_option_id?: string | null;
  selected_option_ids?: string[] | null; // For multiple choice
  answer_text?: string | null;
  statement_answers?: Record<string, boolean> | null; // For True/False questions (e.g. { "st-1": true, "st-2": false })
  is_correct?: boolean | null;
  points_earned?: number | null;
  answered_at?: string;
  updated_at?: string;
}

export interface ExamResultQuestionReview {
  id: string;
  order: number;
  content: string;
  question_type: string;
  points: number;
  earned_points: number;
  is_answered: boolean;
  user_selected_option_id?: string;
  user_answer_text?: string;
  user_statement_answers?: Record<string, boolean>;
  options?: {
    id: string;
    content: string;
    is_correct?: boolean;
  }[];
  statements?: {
    id: string;
    statement: string;
    is_correct?: boolean;
    explanation?: string;
    user_choice?: boolean;
    is_statement_correct?: boolean;
    earned_points?: number;
  }[];
  correct_option_id?: string;
  correct_answer?: string;
  explanation?: string;
}

export interface ExamResult {
  id: string;
  attempt_id: string;
  student_id?: string | null;
  exam_session_id: string;
  student_name?: string;
  student_code?: string;
  score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  submitted_at: string;
  created_at: string;
  review_questions?: ExamResultQuestionReview[];
}

// Cognitive level display mapping (Chuẩn GDPT 2018 Việt Nam)
export const COGNITIVE_LEVEL_LABELS: Record<CognitiveLevel, { label: string; color: string; badgeClass: string }> = {
  recognition: {
    label: 'Nhận biết',
    color: '#0284c7', // Sky-600
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  comprehension: {
    label: 'Thông hiểu',
    color: '#059669', // Emerald-600
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  application: {
    label: 'Vận dụng',
    color: '#d97706', // Amber-600
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  advanced_application: {
    label: 'Vận dụng cao',
    color: '#dc2626', // Red-600
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Trắc nghiệm đơn',
  multiple_choice: 'Nhiều lựa chọn',
  true_false: 'Đúng / Sai',
  short_answer: 'Điền ngắn',
  essay: 'Tự luận',
};

export const DIFFICULTY_LABELS: Record<Difficulty, { label: string; badgeClass: string }> = {
  easy: { label: 'Dễ', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200' },
  medium: { label: 'Trung bình', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  hard: { label: 'Khó', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
};
