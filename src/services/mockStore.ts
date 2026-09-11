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
  Profile 
} from '../types';

const STORAGE_KEY = 'eduexam_demo_store_v3';

export const DEMO_PROFILE: Profile = {
  id: 'demo-teacher-001',
  user_id: 'demo-teacher-001',
  full_name: 'Thầy Nguyễn Văn An',
  email: 'giaovien.toan@eduexam.edu.vn',
  role: 'teacher',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

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
];

const INITIAL_CLASSES: SchoolClass[] = [
  {
    id: 'class-10a1',
    name: '10A1',
    grade: 10,
    school_year: '2024-2025',
    student_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'class-10a2',
    name: '10A2',
    grade: 10,
    school_year: '2024-2025',
    student_count: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_STUDENTS: Student[] = [
  {
    id: 'student-001',
    student_code: 'HS1001',
    full_name: 'Nguyễn Hoàng Nam',
    class_id: 'class-10a1',
    class_name: '10A1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-002',
    student_code: 'HS1002',
    full_name: 'Trần Mai Anh',
    class_id: 'class-10a1',
    class_name: '10A1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-003',
    student_code: 'HS1003',
    full_name: 'Lê Quốc Bảo',
    class_id: 'class-10a1',
    class_name: '10A1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-004',
    student_code: 'HS1004',
    full_name: 'Phạm Thảo Vy',
    class_id: 'class-10a1',
    class_name: '10A1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-005',
    student_code: 'HS1005',
    full_name: 'Vũ Tuấn Kiệt',
    class_id: 'class-10a1',
    class_name: '10A1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-006',
    student_code: 'HS1006',
    full_name: 'Đỗ Minh Trí',
    class_id: 'class-10a2',
    class_name: '10A2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-007',
    student_code: 'HS1007',
    full_name: 'Lương Bảo Châu',
    class_id: 'class-10a2',
    class_name: '10A2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-008',
    student_code: 'HS1008',
    full_name: 'Nguyễn Thu Hà',
    class_id: 'class-10a2',
    class_name: '10A2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_BANKS: QuestionBank[] = [
  {
    id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    subject_name: 'Toán học',
    name: 'Ngân hàng câu hỏi Toán 10 - Giữa Kỳ I',
    description: 'Bộ câu hỏi chuẩn 4 mức độ: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao (GDPT 2018)',
    question_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q-toan-1',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Mệnh đề nào sau đây là một mệnh đề đúng?',
    question_type: 'single_choice',
    difficulty: 'easy',
    cognitive_level: 'recognition',
    points: 2.0,
    explanation: '17 là số nguyên tố vì nó lớn hơn 1 và chỉ có đúng hai ước là 1 và 17.',
    options: [
      { id: 'opt-1-1', question_id: 'q-toan-1', content: '17 là số nguyên tố', is_correct: true, option_order: 1 },
      { id: 'opt-1-2', question_id: 'q-toan-1', content: 'Tổng hai số lẻ luôn là số lẻ', is_correct: false, option_order: 2 },
      { id: 'opt-1-3', question_id: 'q-toan-1', content: 'Số 12 chia hết cho 5', is_correct: false, option_order: 3 },
      { id: 'opt-1-4', question_id: 'q-toan-1', content: 'Tam giác đều có 4 cạnh bằng nhau', is_correct: false, option_order: 4 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-2',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Cho tập hợp A = {x ∈ ℝ | 1 ≤ x < 5}. Viết tập hợp A dưới dạng nửa khoảng:',
    question_type: 'single_choice',
    difficulty: 'easy',
    cognitive_level: 'recognition',
    points: 2.0,
    explanation: 'Vì x lấy dấu bằng ở đầu mút 1 và dấu bé hơn ở 5 nên A = [1; 5).',
    options: [
      { id: 'opt-2-1', question_id: 'q-toan-2', content: '[1; 5)', is_correct: true, option_order: 1 },
      { id: 'opt-2-2', question_id: 'q-toan-2', content: '(1; 5]', is_correct: false, option_order: 2 },
      { id: 'opt-2-3', question_id: 'q-toan-2', content: '[1; 5]', is_correct: false, option_order: 3 },
      { id: 'opt-2-4', question_id: 'q-toan-2', content: '(1; 5)', is_correct: false, option_order: 4 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-3',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Cặp số nào sau đây là một nghiệm của bất phương trình bậc nhất hai ẩn 2x - 3y + 6 > 0?',
    question_type: 'single_choice',
    difficulty: 'medium',
    cognitive_level: 'comprehension',
    points: 2.0,
    explanation: 'Thay tọa độ (0; 1): 2(0) - 3(1) + 6 = 3 > 0 thỏa mãn bất phương trình.',
    options: [
      { id: 'opt-3-1', question_id: 'q-toan-3', content: '(0; 1)', is_correct: true, option_order: 1 },
      { id: 'opt-3-2', question_id: 'q-toan-3', content: '(0; 3)', is_correct: false, option_order: 2 },
      { id: 'opt-3-3', question_id: 'q-toan-3', content: '(-5; 0)', is_correct: false, option_order: 3 },
      { id: 'opt-3-4', question_id: 'q-toan-3', content: '(1; 4)', is_correct: false, option_order: 4 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-4',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Cho tam giác ABC có độ dài ba cạnh a = 8, b = 6, c = 10. Diện tích tam giác ABC là:',
    question_type: 'single_choice',
    difficulty: 'medium',
    cognitive_level: 'application',
    points: 2.0,
    explanation: 'Vì 6² + 8² = 36 + 64 = 100 = 10² nên tam giác ABC vuông tại C. Diện tích S = (1/2)*6*8 = 24.',
    options: [
      { id: 'opt-4-1', question_id: 'q-toan-4', content: '24', is_correct: true, option_order: 1 },
      { id: 'opt-4-2', question_id: 'q-toan-4', content: '48', is_correct: false, option_order: 2 },
      { id: 'opt-4-3', question_id: 'q-toan-4', content: '30', is_correct: false, option_order: 3 },
      { id: 'opt-4-4', question_id: 'q-toan-4', content: '12', is_correct: false, option_order: 4 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-5',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Hai tàu thủy xuất phát cùng lúc từ cảng A theo hai hướng hợp nhau góc 60°. Tàu thứ nhất chạy với vận tốc 30 km/h, tàu thứ hai chạy với vận tốc 40 km/h. Sau 2 giờ, khoảng cách giữa hai tàu là bao nhiêu?',
    question_type: 'single_choice',
    difficulty: 'hard',
    cognitive_level: 'advanced_application',
    points: 2.0,
    explanation: 'Sau 2h: AB = 60 km, AC = 80 km. Theo định lí cosin: BC² = 60² + 80² - 2*60*80*cos(60°) = 3600 + 6400 - 4800 = 5200 => BC = 20√13 ≈ 72.11 km.',
    options: [
      { id: 'opt-5-1', question_id: 'q-toan-5', content: '20√13 km (khoảng 72.1 km)', is_correct: true, option_order: 1 },
      { id: 'opt-5-2', question_id: 'q-toan-5', content: '70 km', is_correct: false, option_order: 2 },
      { id: 'opt-5-3', question_id: 'q-toan-5', content: '85 km', is_correct: false, option_order: 3 },
      { id: 'opt-5-4', question_id: 'q-toan-5', content: '100 km', is_correct: false, option_order: 4 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-tf-1',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Cho hàm số bậc hai y = f(x) = ax² + bx + c có đồ thị (P) với đỉnh I(1; -4) và đi qua điểm A(2; -3). Xét tính đúng/sai của các mệnh đề sau:',
    question_type: 'true_false',
    difficulty: 'medium',
    cognitive_level: 'comprehension',
    points: 2.0,
    exam_part: 2,
    explanation: 'Ta có trục đối xứng x = 1, đỉnh I(1; -4) ∈ (P) và A(2; -3) ∈ (P). Giải hệ ta được a = 1, b = -2, c = -3. Do đó parabol là y = x² - 2x - 3.',
    statements: [
      { id: 'st-1', statement: 'Trục đối xứng của đồ thị (P) là đường thẳng x = 1.', is_correct: true, explanation: 'Đỉnh I(1; -4) nên trục đối xứng là x = 1 (Đúng).' },
      { id: 'st-2', statement: 'Hàm số đồng biến trên khoảng (-∞; 1).', is_correct: false, explanation: 'Hệ số a = 1 > 0 nên bề lõm hướng lên, hàm số nghịch biến trên (-∞; 1) (Sai).' },
      { id: 'st-3', statement: 'Tọa độ giao điểm của parabol với trục tung là (0; -3).', is_correct: true, explanation: 'Tại x = 0 thì y = -3, tọa độ giao điểm là (0; -3) (Đúng).' },
      { id: 'st-4', statement: 'Phương trình f(x) = 0 vô nghiệm trên tập số thực.', is_correct: false, explanation: 'x² - 2x - 3 = 0 có hai nghiệm phân biệt x = -1 và x = 3 (Sai).' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-sa-1',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Cho tam giác ABC có AB = 6, AC = 8 và góc Â = 60°. Hãy tính diện tích S của tam giác ABC (nếu kết quả là biểu thức chứa căn, viết dưới dạng a√b, ví dụ 12√3).',
    question_type: 'short_answer',
    difficulty: 'medium',
    cognitive_level: 'application',
    points: 2.0,
    exam_part: 3,
    correct_answer: '12√3',
    normalized_answer: '12√3',
    explanation: 'Áp dụng công thức tính diện tích tam giác: S = 1/2 · AB · AC · sin(A) = 1/2 · 6 · 8 · sin(60°) = 24 · (√3 / 2) = 12√3 (≈ 20.78).',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'q-toan-essay-1',
    question_bank_id: 'bank-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    content: 'Một bác nông dân muốn rào chắn một khu đất hình chữ nhật giáp bờ sông thẳng để trồng hoa màu (không cần rào phía bờ sông). Bác có sẵn một đoạn lưới thép dài 100 mét. Hãy xác định kích thước hai cạnh của khu đất để diện tích rào chắn được là lớn nhất. (Học sinh tự trình bày chi tiết các bước: đặt ẩn, lập hàm diện tích và tìm giá trị lớn nhất).',
    question_type: 'essay',
    difficulty: 'hard',
    cognitive_level: 'advanced_application',
    points: 2.0,
    exam_part: 4,
    explanation: '• Bước 1: Gọi x (mét) là chiều rộng của khu đất (0 < x < 50).\n• Bước 2: Vì chỉ rào 3 cạnh gồm 2 cạnh chiều rộng và 1 cạnh chiều dài giáp sông, chiều dài của khu đất là 100 - 2x (m).\n• Bước 3: Diện tích khu đất rào được là hàm số: S(x) = x(100 - 2x) = -2x² + 100x.\n• Bước 4: Đây là tam thức bậc hai có a = -2 < 0 nên đạt giá trị lớn nhất tại đỉnh parabol x = -b / (2a) = -100 / (2 · (-2)) = 25 (m).\n• Bước 5: Khi đó chiều dài là 100 - 2(25) = 50 (m). Vậy kích thước tối ưu là chiều rộng 25 m, chiều dài 50 m. Diện tích lớn nhất đạt được là S_max = 1250 m².',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    subject_name: 'Toán học',
    title: 'Đề kiểm tra Giữa học kỳ I - Môn Toán 10 (Mã đề 101)',
    description: 'Đề thi chuẩn cấu trúc GDPT 2018 gồm đầy đủ các phần: Trắc nghiệm, Đúng/Sai, Trả lời ngắn và Tự luận',
    grade: 10,
    duration_minutes: 45,
    total_points: 10.0,
    status: 'published',
    question_count: 6,
    questions: [
      INITIAL_QUESTIONS[0], // q-toan-1 (1.5đ)
      INITIAL_QUESTIONS[1], // q-toan-2 (1.5đ)
      INITIAL_QUESTIONS[2], // q-toan-3 (1.0đ)
      INITIAL_QUESTIONS[5], // q-toan-tf-1 (2.0đ)
      INITIAL_QUESTIONS[6], // q-toan-sa-1 (2.0đ)
      INITIAL_QUESTIONS[7], // q-toan-essay-1 (2.0đ)
    ].map((q, idx) => ({
      id: `eq-${idx + 1}`,
      exam_id: 'exam-toan-10',
      question_id: q.id,
      question_order: idx + 1,
      points: q.points,
      question: q,
      created_at: new Date().toISOString(),
    })),
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_SESSIONS: ExamSession[] = [
  {
    id: 'session-toan-10',
    exam_id: 'exam-toan-10',
    owner_id: 'demo-teacher-001',
    access_code: 'TOAN10',
    title: 'Kiểm tra Giữa kỳ I - Lớp 10A1',
    duration_minutes: 45,
    max_attempts: 2,
    status: 'active',
    shuffle_questions: true,
    shuffle_options: true,
    show_result_after_submit: true,
    target_classes: ['10A1'],
    exam_title: 'Đề kiểm tra Giữa học kỳ I - Môn Toán 10 (Mã đề 101)',
    exam: INITIAL_EXAMS[0],
    attempts_count: 5,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'session-survey-10',
    exam_id: 'exam-toan-10',
    owner_id: 'demo-teacher-001',
    access_code: 'EXAM-8921',
    title: 'Khảo sát Năng lực Môn Toán Đầu năm',
    duration_minutes: 30,
    max_attempts: 1,
    status: 'active',
    shuffle_questions: false,
    shuffle_options: true,
    show_result_after_submit: true,
    exam_title: 'Đề kiểm tra Giữa học kỳ I - Môn Toán 10 (Mã đề 101)',
    exam: INITIAL_EXAMS[0],
    attempts_count: 2,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_RESULTS: ExamResult[] = [
  {
    id: 'res-001',
    attempt_id: 'att-res-001',
    exam_session_id: 'session-toan-10',
    student_name: 'Nguyễn Hoàng Nam',
    student_code: 'HS1001',
    score: 10.0,
    max_score: 10.0,
    percentage: 100,
    correct_count: 5,
    wrong_count: 0,
    unanswered_count: 0,
    submitted_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'res-002',
    attempt_id: 'att-res-002',
    exam_session_id: 'session-toan-10',
    student_name: 'Trần Mai Anh',
    student_code: 'HS1002',
    score: 8.0,
    max_score: 10.0,
    percentage: 80,
    correct_count: 4,
    wrong_count: 1,
    unanswered_count: 0,
    submitted_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'res-003',
    attempt_id: 'att-res-003',
    exam_session_id: 'session-toan-10',
    student_name: 'Lê Quốc Bảo',
    student_code: 'HS1003',
    score: 8.0,
    max_score: 10.0,
    percentage: 80,
    correct_count: 4,
    wrong_count: 1,
    unanswered_count: 0,
    submitted_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'res-004',
    attempt_id: 'att-res-004',
    exam_session_id: 'session-toan-10',
    student_name: 'Phạm Thảo Vy',
    student_code: 'HS1004',
    score: 6.0,
    max_score: 10.0,
    percentage: 60,
    correct_count: 3,
    wrong_count: 2,
    unanswered_count: 0,
    submitted_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'res-005',
    attempt_id: 'att-res-005',
    exam_session_id: 'session-toan-10',
    student_name: 'Vũ Tuấn Kiệt',
    student_code: 'HS1005',
    score: 8.0,
    max_score: 10.0,
    percentage: 80,
    correct_count: 4,
    wrong_count: 1,
    unanswered_count: 0,
    submitted_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

const INITIAL_MATRICES: Matrix[] = [
  {
    id: 'mat-toan-10',
    owner_id: 'demo-teacher-001',
    subject_id: 'subj-toan-10',
    subject_name: 'Toán học',
    name: 'Ma trận Đề kiểm tra Giữa học kỳ I - Toán 10',
    grade: 10,
    description: 'Tỉ lệ: 40% Nhận biết, 30% Thông hiểu, 20% Vận dụng, 10% Vận dụng cao',
    total_questions: 5,
    total_points: 10.0,
    items: [
      { id: 'mi-1', matrix_id: 'mat-toan-10', topic: 'Mệnh đề & Tập hợp', cognitive_level: 'recognition', question_type: 'single_choice', question_count: 2, points: 4.0 },
      { id: 'mi-2', matrix_id: 'mat-toan-10', topic: 'Bất phương trình bậc nhất hai ẩn', cognitive_level: 'comprehension', question_type: 'single_choice', question_count: 1, points: 2.0 },
      { id: 'mi-3', matrix_id: 'mat-toan-10', topic: 'Hệ thức lượng trong tam giác', cognitive_level: 'application', question_type: 'single_choice', question_count: 1, points: 2.0 },
      { id: 'mi-4', matrix_id: 'mat-toan-10', topic: 'Ứng dụng thực tế hệ thức lượng', cognitive_level: 'advanced_application', question_type: 'single_choice', question_count: 1, points: 2.0 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
      return JSON.parse(raw);
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
  addClass: (cls: { name: string; grade: number; school_year: string }): SchoolClass => {
    const newClass: SchoolClass = {
      ...cls,
      id: uniqueId('class'),
      student_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storeState.classes.push(newClass);
    persistStore();
    return newClass;
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
  addStudent: (st: { student_code: string; full_name: string; class_id: string }): Student => {
    const foundClass = storeState.classes.find(c => c.id === st.class_id);
    const newStudent: Student = {
      ...st,
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
    storeState.results.unshift(res);
    const session = storeState.sessions.find(s => s.id === res.exam_session_id);
    if (session) {
      session.attempts_count = (session.attempts_count || 0) + 1;
    }
    persistStore();
  },
  getResultsBySession: (sessionId: string): ExamResult[] => {
    return storeState.results.filter(r => r.exam_session_id === sessionId);
  },
  getAllResults: (): ExamResult[] => [...storeState.results],

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
      total_questions: totalQ,
      total_points: totalPts,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storeState.matrices.unshift(newMatrix);
    persistStore();
    return newMatrix;
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
