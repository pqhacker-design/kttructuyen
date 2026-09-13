import { CognitiveLevel, QuestionType, ExamStatus } from './index';
export type { CognitiveLevel, QuestionType, ExamStatus };

export interface LegalRegulation {
  id: string;
  title: string;
  document_number: string;
  issued_date: string;
  effective_date: string;
  subject_scope: string[]; // ['all'] or ['math', 'literature', etc.]
  education_level: 'THCS' | 'THPT' | 'all';
  content: string;
  summary: string;
  version: string;
  status: 'active' | 'superseded';
  issuer: string;
  created_at?: string;
  updated_at?: string;
}

export type SubjectCode = 
  | 'toan'
  | 'ngu_van'
  | 'tieng_anh'
  | 'khtn'
  | 'vat_ly'
  | 'hoa_hoc'
  | 'sinh_hoc'
  | 'lich_su'
  | 'dia_ly'
  | 'gdcd_gdktpl'
  | 'tin_hoc'
  | 'cong_nghe'
  | 'other';

export interface EssayRubricItem {
  id: string;
  criterion: string;
  points: number;
  description?: string;
}

export interface EssaySubItemRubric {
  id?: string;
  criterion: string;
  points: number;
  description?: string;
}

export interface EssaySubItem {
  id?: string;
  item_number: string; // 'a' | 'b' | 'c' or '' for single item
  points: number;
  cognitive_level: CognitiveLevel;
  question_text: string;
  expected_answer?: string;
  scoring_rubric?: EssaySubItemRubric[];
}

export interface EssayQuestionConfig {
  id: string;
  questionOrder: number;
  title?: string;
  cognitiveLevel: CognitiveLevel;
  isAdvancedApplication?: boolean; // Đặc biệt cho câu Vận dụng cao
  points: number;
  requirementType?: string; // e.g. "Đọc hiểu", "Viết đoạn văn NLXH (200 chữ)", "Bài văn NLVH"
  rubricItems?: EssayRubricItem[];
  subItemCount?: number; // 1 | 2 | 3
  subItems?: EssaySubItem[];
}

export interface ExamPartConfig {
  part: 1 | 2 | 3 | 4;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  title: string;
  enabled: boolean;
  questionCount: number;
  pointsPerQuestion?: number;
  totalPoints: number;
  scoringMethod?: 'standard' | 'true_false_step' | 'rubric';
  statementsPerQuestion?: 2 | 4 | 6 | 8;
  pointsPerStatement?: number;
  essayQuestions?: EssayQuestionConfig[];
  allowedSubItemCounts?: (1 | 2 | 3)[]; // Cho phép cấu hình 1 ý, 2 ý, 3 ý
  essayAllocationMode?: 'auto' | 'manual'; // 'auto' (AI phân bổ tự động) | 'manual' (cấu hình từng câu)
  description?: string;
}

export interface CognitiveDistributionConfig {
  recognition: number; // Điểm hoặc %
  comprehension: number;
  application: number;
  advanced_application: number;
}

export type ExamFormatType = 'multiple_choice_only' | 'essay_only' | 'hybrid';
export type HybridRatioType = '70_30' | '50_50' | '60_40' | '80_20' | 'custom';

export interface ExamStructureConfig {
  totalScore: number; // Luôn là 10.0
  durationMinutes: number; // 45, 60, 90...
  parts: ExamPartConfig[];
  cognitiveDistribution: CognitiveDistributionConfig;
  allowAdvancedApplication: boolean;
  advancedApplicationCount: number;
  advancedApplicationPoints: number;
  examFormat?: ExamFormatType;
  hybridRatio?: HybridRatioType;
}

export interface SubjectProfile {
  id: string;
  subject_id: SubjectCode;
  name: string;
  code: string;
  education_levels: ('THCS' | 'THPT')[];
  default_duration: number;
  allowed_parts: (1 | 2 | 3 | 4)[];
  allowed_question_types: QuestionType[];
  special_requirements: string[];
  default_structure: ExamStructureConfig;
  matrix_rules: {
    format: string;
    has_subtopic: boolean;
    required_sections: string[];
  };
  specification_rules: {
    requires_learning_objectives: boolean;
    standard_reference: string;
  };
  ai_generation_rules: {
    prompt_instructions: string;
    prohibited_patterns: string[];
    special_fields?: string[];
  };
}

export interface MatrixCellSpecification {
  id: string;
  topic: string;
  content_unit: string;
  learning_requirement: string;
  // TNKQ Phần I
  mc_rec: number;
  mc_com: number;
  mc_app: number;
  // TNKQ Phần II Đúng/Sai
  tf_rec: number;
  tf_com: number;
  tf_app: number;
  // TNKQ Phần III Trả lời ngắn
  sa_rec: number;
  sa_com: number;
  sa_app: number;
  // Tự luận Phần IV
  essay_rec: number;
  essay_com: number;
  essay_app: number;
  essay_adv?: number;
  total_questions: number;
  total_points: number;
  percentage: number;
}

export interface AIQuestionStatement {
  id: string;
  statement: string;
  is_correct: boolean;
  cognitive_level?: CognitiveLevel;
  explanation?: string;
}

export interface AIQuestionOption {
  id: string;
  content: string;
  is_correct: boolean;
  option_order: number;
}

export interface GeneratedAIQuestion {
  id: string;
  exam_part: 1 | 2 | 3 | 4;
  question_order: number;
  question_type: QuestionType;
  topic: string;
  content_unit: string;
  learning_requirement: string;
  cognitive_level: CognitiveLevel;
  is_advanced_application?: boolean;
  points: number;
  matrix_cell_id?: string;
  specification_item_id?: string;
  content: string;
  reading_passage?: string; // Cho Ngữ văn hoặc Tiếng Anh reading
  audio_url?: string; // Cho Tiếng Anh listening
  options?: AIQuestionOption[]; // Cho Phần I
  statements?: AIQuestionStatement[]; // Cho Phần II (4 ý a, b, c, d)
  short_answer?: {
    normalized_answer: string;
    accepted_variants: string[];
  }; // Cho Phần III
  intro_text?: string; // Tình huống / bối cảnh chung cho câu hỏi tự luận
  sub_items?: EssaySubItem[]; // Cấu trúc 1-3 ý độc lập cho câu tự luận
  essay_rubric?: EssayRubricItem[]; // Cho Phần IV
  explanation?: string;
  ai_review_status: 'passed' | 'review_required';
  ai_review_notes?: string;
  teacher_accepted: boolean;
  created_by_ai: boolean;
  source: 'ai_generated' | 'question_bank';
}

export interface ExamValidationResult {
  isValid: boolean;
  totalQuestions: number;
  totalScore: number;
  isScoreExact10: boolean;
  errors: string[];
  warnings: string[];
  partsSummary: {
    part: 1 | 2 | 3 | 4;
    name: string;
    requiredPoints: number;
    actualPoints: number;
    questionCount: number;
    isValid: boolean;
  }[];
  cognitiveBreakdown: {
    level: CognitiveLevel | 'advanced_application';
    name: string;
    targetPoints: number;
    actualPoints: number;
    percentage: number;
  }[];
  matrixMatches: {
    cellId: string;
    topic: string;
    required: number;
    actual: number;
    matched: boolean;
  }[];
}

export interface AIExamGenerationResponse {
  exam: {
    title: string;
    subject: string;
    grade: number;
    term: string;
    duration_minutes: number;
    total_score: number;
    instructions: string;
  };
  structure: ExamStructureConfig;
  matrix: MatrixCellSpecification[];
  questions: GeneratedAIQuestion[];
  validation: ExamValidationResult;
  model: string;
  prompt_version: string;
  regulation_reference: string;
}

export interface TextbookImage {
  id: string;
  dataUrl: string; // Preview URL: data:image/png;base64,...
  mimeType: string;
  base64Data: string; // Raw base64 data
  fileName: string;
  fileSize: number;
}

export interface TextbookExtractionResult {
  detected_lesson_title: string;
  suggested_topics: string[];
  content_units: string[];
  learning_outcomes: {
    recognition: string;
    comprehension: string;
    application: string;
  };
  key_knowledge_summary: string;
  suggested_question_focus: string;
}
