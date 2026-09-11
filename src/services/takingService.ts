import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { ExamAttempt, AttemptAnswer, ExamResult, Question } from '../types';
import { mockStore } from './mockStore';
import { getQuestionStatements } from './docxExportService';

export interface TakingQuestionStatement {
  id: string;
  statement: string;
}

export interface TakingQuestionItem {
  id: string;
  order: number;
  points: number;
  content: string;
  question_type: string;
  cognitive_level: string;
  exam_part?: number;
  options: {
    id: string;
    content: string;
    option_order: number;
  }[];
  statements?: TakingQuestionStatement[];
}

export interface JoinExamResponse {
  success: boolean;
  code?: 'NOT_FOUND' | 'NOT_ACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'MAX_ATTEMPTS_REACHED' | 'WRONG_CLASS' | 'ERROR';
  message: string;
  session?: {
    id: string;
    title: string;
    access_code: string;
    duration_minutes: number;
    start_at?: string | null;
    end_at?: string | null;
    max_attempts?: number;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_result_after_submit: boolean;
  };
  attempt?: {
    id: string;
    attempt_number: number;
    started_at: string;
    status: string;
    student_name: string;
    student_code: string;
  };
  questions?: TakingQuestionItem[];
  existingAnswers?: Record<string, { selected_option_id?: string; answer_text?: string; statement_answers?: Record<string, boolean> }>;
}

export async function joinExamWithAccessCode(
  accessCode: string,
  studentName: string,
  studentCode: string
): Promise<JoinExamResponse> {
  const cleanedCode = accessCode.trim().toUpperCase();

  if (!isSupabaseConfigured()) {
    const session = mockStore.getSessionByCode(cleanedCode);
    if (!session) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: `Mã kỳ thi "${cleanedCode}" không tồn tại trên hệ thống. Vui lòng kiểm tra lại.`,
      };
    }

    if (session.status !== 'active') {
      return {
        success: false,
        code: 'NOT_ACTIVE',
        message: `Kỳ thi "${session.title}" hiện không hoạt động hoặc chưa được giáo viên mở.`,
      };
    }

    const now = new Date();
    if (session.start_at && now < new Date(session.start_at)) {
      return {
        success: false,
        code: 'NOT_STARTED',
        message: `Kỳ thi chưa bắt đầu. Thời gian mở đề: ${new Date(session.start_at).toLocaleString('vi-VN')}`,
      };
    }

    if (session.end_at && now > new Date(session.end_at)) {
      return {
        success: false,
        code: 'EXPIRED',
        message: `Kỳ thi đã kết thúc vào lúc: ${new Date(session.end_at).toLocaleString('vi-VN')}`,
      };
    }

    // Check target classes restriction
    if (session.target_classes && session.target_classes.length > 0) {
      const student = mockStore.findStudentByCode(studentCode.trim());
      const studentClass = student?.class_name?.trim() || '';
      const isAllowed = session.target_classes.some(
        (tc: string) => tc.trim().toUpperCase() === 'ALL' || (studentClass && tc.trim().toUpperCase() === studentClass.toUpperCase())
      );
      if (!isAllowed) {
        return {
          success: false,
          code: 'WRONG_CLASS',
          message: `Thí sinh thuộc lớp "${studentClass || 'Chưa phân lớp'}", nhưng kỳ thi này chỉ dành cho lớp: ${session.target_classes.join(', ')}. Bạn không được phép vào làm bài thi này.`,
        };
      }
    }

    const exam = session.exam || mockStore.getExamById(session.exam_id);
    const examQuestions = exam?.questions || [];
    let sanitizedQuestions: TakingQuestionItem[] = examQuestions.map((eq: any, idx: number) => {
      const q = eq.question || eq;
      let opts = (q?.options || []).map((o: any) => ({
        id: o.id,
        content: o.content,
        option_order: o.option_order,
      }));

      if (session.shuffle_options && q?.question_type !== 'true_false') {
        opts = [...opts].sort(() => Math.random() - 0.5);
      }

      // Extract statements for true_false questions WITHOUT correct answers or explanations
      const rawStatements = getQuestionStatements(q);
      const sanitizedStatements: TakingQuestionStatement[] = rawStatements.map((st, sIdx) => ({
        id: st.id || `st-${sIdx + 1}`,
        statement: st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, ''),
      }));

      const calculatedPart = q?.exam_part || (rawStatements.length > 0 ? 2 : (q?.question_type === 'essay' ? 4 : (q?.question_type === 'short_answer' ? 3 : 1)));
      const calculatedType = q?.question_type || (rawStatements.length > 0 ? 'true_false' : 'single_choice');

      return {
        id: q?.id || eq.question_id,
        order: eq.question_order || idx + 1,
        points: eq.points || 2.0,
        content: q?.content || '',
        question_type: calculatedType,
        cognitive_level: q?.cognitive_level || 'recognition',
        exam_part: calculatedPart,
        options: opts,
        statements: sanitizedStatements.length > 0 ? sanitizedStatements : undefined,
      };
    });

    if (session.shuffle_questions) {
      sanitizedQuestions = [...sanitizedQuestions].sort(() => Math.random() - 0.5);
    }

    const attemptId = `att-${cleanedCode}-${studentCode.trim()}-${Date.now()}`;

    return {
      success: true,
      message: 'Tham gia kỳ thi thành công (Chế độ Thực hành & Trực tuyến)',
      session: {
        id: session.id,
        title: session.title,
        access_code: session.access_code,
        duration_minutes: session.duration_minutes,
        start_at: session.start_at || null,
        end_at: session.end_at || null,
        max_attempts: session.max_attempts || 1,
        shuffle_questions: session.shuffle_questions,
        shuffle_options: session.shuffle_options,
        show_result_after_submit: session.show_result_after_submit,
      },
      attempt: {
        id: attemptId,
        attempt_number: 1,
        started_at: new Date().toISOString(),
        status: 'in_progress',
        student_name: studentName.trim(),
        student_code: studentCode.trim(),
      },
      questions: sanitizedQuestions,
      existingAnswers: mockStore.getAttemptAnswers(attemptId),
    };
  }

  const supabase = getSupabase();

  // Try calling the secure RPC first if installed
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('join_exam_session', {
      p_access_code: cleanedCode,
      p_student_name: studentName.trim(),
      p_student_code: studentCode.trim(),
    });

    if (!rpcError && rpcData) {
      if (rpcData.success && rpcData.attempt?.id) {
        // Fetch any existing answers previously saved for this attempt (for reload restore)
        const { data: savedAnswers } = await supabase
          .from('attempt_answers')
          .select('question_id, selected_option_id, answer_text')
          .eq('attempt_id', rpcData.attempt.id);

        const existingAnswers: Record<string, { selected_option_id?: string; answer_text?: string }> = {};
        (savedAnswers || []).forEach((ans: any) => {
          existingAnswers[ans.question_id] = {
            selected_option_id: ans.selected_option_id,
            answer_text: ans.answer_text,
          };
        });

        return {
          ...rpcData,
          existingAnswers,
        };
      }
      return rpcData as JoinExamResponse;
    }
  } catch (err) {
    console.warn('RPC join_exam_session not available or failed, using robust client-side workflow:', err);
  }

  // ----------------------------------------------------------------------------
  // ROBUST FALLBACK (Direct table queries respecting RLS and data protection)
  // ----------------------------------------------------------------------------
  // 1. Query exam_session by access_code
  const { data: session, error: sErr } = await supabase
    .from('exam_sessions')
    .select(`
      id,
      exam_id,
      access_code,
      title,
      start_at,
      end_at,
      duration_minutes,
      max_attempts,
      status,
      shuffle_questions,
      shuffle_options,
      show_result_after_submit
    `)
    .eq('access_code', cleanedCode)
    .maybeSingle();

  if (sErr) {
    console.error('Error finding session by code:', sErr);
    return {
      success: false,
      code: 'ERROR',
      message: `Không thể kiểm tra mã kỳ thi: ${sErr.message}`,
    };
  }

  if (!session) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: `Mã kỳ thi "${cleanedCode}" không tồn tại trên hệ thống. Vui lòng kiểm tra lại.`,
    };
  }

  if (session.status !== 'active') {
    return {
      success: false,
      code: 'NOT_ACTIVE',
      message: `Kỳ thi "${session.title}" hiện không hoạt động hoặc chưa được giáo viên mở.`,
    };
  }

  const now = new Date();
  if (session.start_at && now < new Date(session.start_at)) {
    return {
      success: false,
      code: 'NOT_STARTED',
      message: `Kỳ thi chưa bắt đầu. Thời gian mở: ${new Date(session.start_at).toLocaleString('vi-VN')}`,
    };
  }

  if (session.end_at && now > new Date(session.end_at)) {
    return {
      success: false,
      code: 'EXPIRED',
      message: `Kỳ thi đã kết thúc lúc: ${new Date(session.end_at).toLocaleString('vi-VN')}`,
    };
  }

  // 2. Check previous attempts
  const { data: prevAttempts } = await supabase
    .from('exam_attempts')
    .select('id, status, attempt_number')
    .eq('exam_session_id', session.id)
    .ilike('student_code', studentCode.trim());

  const submittedCount = (prevAttempts || []).filter(
    (a) => a.status === 'submitted' || a.status === 'graded'
  ).length;

  if (submittedCount >= session.max_attempts) {
    return {
      success: false,
      code: 'MAX_ATTEMPTS_REACHED',
      message: `Bạn đã tham gia đủ số lần cho phép (${session.max_attempts} lần).`,
    };
  }

  // Check if there is an in-progress attempt to resume
  let activeAttempt = (prevAttempts || []).find((a) => a.status === 'in_progress');

  if (!activeAttempt) {
    // Create new attempt
    const { data: newAttempt, error: aErr } = await supabase
      .from('exam_attempts')
      .insert([
        {
          exam_session_id: session.id,
          student_name: studentName.trim(),
          student_code: studentCode.trim(),
          attempt_number: (prevAttempts?.length || 0) + 1,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (aErr || !newAttempt) {
      return {
        success: false,
        code: 'ERROR',
        message: `Lỗi khởi tạo bài thi: ${aErr?.message || 'Không thể tạo attempt'}`,
      };
    }
    activeAttempt = newAttempt;
  }

  // 3. Load exam questions WITHOUT is_correct or explanation to prevent cheating!
  const { data: examQuestions, error: eqErr } = await supabase
    .from('exam_questions')
    .select(`
      question_id,
      question_order,
      points,
      question:questions(
        id,
        content,
        question_type,
        cognitive_level,
        options:question_options(
          id,
          content,
          option_order
        )
      )
    `)
    .eq('exam_id', session.exam_id)
    .order('question_order', { ascending: true });

  if (eqErr || !examQuestions) {
    return {
      success: false,
      code: 'ERROR',
      message: `Lỗi tải danh sách câu hỏi: ${eqErr?.message}`,
    };
  }

  // Format sanitized questions
  let sanitizedQuestions: TakingQuestionItem[] = examQuestions.map((eq: any) => {
    const q = eq.question;
    let opts = (q.options || []).map((o: any) => ({
      id: o.id,
      content: o.content,
      option_order: o.option_order,
    }));

    if (session.shuffle_options && q.question_type !== 'true_false') {
      opts = opts.sort(() => Math.random() - 0.5);
    }

    // Extract statements for true_false questions WITHOUT correct answers or explanations
    const rawStatements = getQuestionStatements(q);
    const sanitizedStatements: TakingQuestionStatement[] = rawStatements.map((st, sIdx) => ({
      id: st.id || `st-${sIdx + 1}`,
      statement: st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, ''),
    }));

    const calculatedPart = q.exam_part || (rawStatements.length > 0 ? 2 : (q.question_type === 'essay' ? 4 : (q.question_type === 'short_answer' ? 3 : 1)));
    const calculatedType = q.question_type || (rawStatements.length > 0 ? 'true_false' : 'single_choice');

    return {
      id: q.id,
      order: eq.question_order,
      points: eq.points,
      content: q.content,
      question_type: calculatedType,
      cognitive_level: q.cognitive_level,
      exam_part: calculatedPart,
      options: opts,
      statements: sanitizedStatements.length > 0 ? sanitizedStatements : undefined,
    };
  });

  if (session.shuffle_questions) {
    sanitizedQuestions = sanitizedQuestions.sort(() => Math.random() - 0.5);
  }

  // 4. Fetch existing answers if this is a restored attempt
  const { data: existingAnswersData } = await supabase
    .from('attempt_answers')
    .select('*')
    .eq('attempt_id', activeAttempt.id);

  const existingAnswers: Record<string, { selected_option_id?: string; answer_text?: string; statement_answers?: Record<string, boolean> }> = {};
  (existingAnswersData || []).forEach((ans: any) => {
    existingAnswers[ans.question_id] = {
      selected_option_id: ans.selected_option_id,
      answer_text: ans.answer_text,
      statement_answers: ans.statement_answers || (ans.answer_text && ans.answer_text.startsWith('{') ? JSON.parse(ans.answer_text) : undefined),
    };
  });

  return {
    success: true,
    message: 'Tham gia kỳ thi thành công',
    session: {
      id: session.id,
      title: session.title,
      access_code: session.access_code,
      duration_minutes: session.duration_minutes,
      shuffle_questions: session.shuffle_questions,
      shuffle_options: session.shuffle_options,
      show_result_after_submit: session.show_result_after_submit,
    },
    attempt: {
      id: activeAttempt.id,
      attempt_number: activeAttempt.attempt_number,
      started_at: (activeAttempt as any).started_at || new Date().toISOString(),
      status: activeAttempt.status,
      student_name: studentName.trim(),
      student_code: studentCode.trim(),
    },
    questions: sanitizedQuestions,
    existingAnswers,
  };
}

// Auto-save student's answer per question into Supabase persistent table
export async function autoSaveAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionId?: string,
  answerText?: string,
  statementAnswers?: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> {
  const jsonAnswerText = statementAnswers ? JSON.stringify(statementAnswers) : answerText;

  if (!isSupabaseConfigured()) {
    mockStore.saveAttemptAnswer(attemptId, questionId, {
      selected_option_id: selectedOptionId,
      answer_text: jsonAnswerText,
      statement_answers: statementAnswers,
    });
    return { success: true };
  }

  const supabase = getSupabase();

  try {
    const { error } = await supabase
      .from('attempt_answers')
      .upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_option_id: selectedOptionId || null,
          answer_text: jsonAnswerText || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'attempt_id,question_id' }
      );

    if (error) {
      // Fallback to local store
      mockStore.saveAttemptAnswer(attemptId, questionId, {
        selected_option_id: selectedOptionId,
        answer_text: jsonAnswerText,
        statement_answers: statementAnswers,
      });
      return { success: true };
    }
    return { success: true };
  } catch (err: any) {
    mockStore.saveAttemptAnswer(attemptId, questionId, {
      selected_option_id: selectedOptionId,
      answer_text: jsonAnswerText,
      statement_answers: statementAnswers,
    });
    return { success: true };
  }
}

// Final submission and grading
export async function submitExamAttempt(
  attemptId: string,
  answers: Record<string, { selected_option_id?: string; answer_text?: string; statement_answers?: Record<string, boolean> }>
): Promise<{ success: boolean; result?: ExamResult; message?: string }> {
  if (!isSupabaseConfigured()) {
    // 1. Fetch questions from active exam in mock store
    const session = mockStore.getSessions()[0];
    const exam = session?.exam || mockStore.getExams()[0];
    const examQuestions = exam?.questions || [];

    let earnedPoints = 0;
    let totalPoints = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const reviewQuestions = examQuestions.map((eq: any, idx: number) => {
      const q = eq.question || eq;
      const qPoints = Number(eq.points || q?.points || 2.0);
      totalPoints += qPoints;
      const userAns = answers[q.id];
      const qType = q.question_type || 'single_choice';

      // --- Case 1: True / False Question ---
      if (qType === 'true_false' || q.exam_part === 2) {
        const rawStatements = getQuestionStatements(q);
        const userStAnswers = userAns?.statement_answers || 
          (userAns?.answer_text && userAns.answer_text.startsWith('{') ? JSON.parse(userAns.answer_text) : {});
        
        const answeredCountForQ = Object.keys(userStAnswers).length;
        const isAnswered = answeredCountForQ > 0;

        if (!isAnswered) {
          unansweredCount++;
          // Rule: Câu nào HS không làm thì KHÔNG hiện đáp án & lời giải!
          return {
            id: q.id,
            order: eq.question_order || idx + 1,
            content: q.content,
            question_type: 'true_false',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
            statements: rawStatements.map((st, sIdx) => ({
              id: st.id || `st-${sIdx + 1}`,
              statement: st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, ''),
            })),
          };
        }

        // Rule: Câu đúng sai tính điểm theo ý!
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
            // Nếu ý này HS có chọn: hiện đáp án và lời giải ý đó. Nếu HS chưa chọn ý này: ẩn đáp án!
            is_correct: isStAnswered ? Boolean(st.is_correct) : undefined,
            explanation: isStAnswered ? (st.explanation || (st.is_correct ? 'Mệnh đề ĐÚNG.' : 'Mệnh đề SAI.')) : undefined,
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
          order: eq.question_order || idx + 1,
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

      // --- Case 2: Short Answer (Phần III: Trả lời ngắn / Điền khuyết) ---
      if (qType === 'short_answer' || q.exam_part === 3) {
        const textAns = userAns?.answer_text ? userAns.answer_text.trim() : '';
        const isAnswered = textAns.length > 0;

        if (!isAnswered) {
          unansweredCount++;
          // Rule: Thí sinh không làm thì KHÔNG hiện đáp án & lời giải!
          return {
            id: q.id,
            order: eq.question_order || idx + 1,
            content: q.content,
            question_type: 'short_answer',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
          };
        }

        const rawExpected = q.short_answer?.normalized_answer ||
          (q.options && q.options.find((o: any) => o.is_correct)?.content) ||
          q.correct_answer || '';
        const variants = q.short_answer?.accepted_variants || [rawExpected];

        const normalizeStr = (str: string) =>
          str.toLowerCase().replace(/,/g, '.').replace(/\s+/g, '').trim();

        const normUser = normalizeStr(textAns);
        const isCorrect = variants.some((v: string) => normalizeStr(v) === normUser) ||
          (normUser !== '' && normUser === normalizeStr(rawExpected));

        if (isCorrect) {
          earnedPoints += qPoints;
          correctCount++;
        } else {
          wrongCount++;
        }

        return {
          id: q.id,
          order: eq.question_order || idx + 1,
          content: q.content,
          question_type: 'short_answer',
          points: qPoints,
          earned_points: isCorrect ? qPoints : 0,
          is_answered: true,
          user_answer_text: textAns,
          correct_answer: rawExpected,
          explanation: q.explanation || 'Kết quả giải theo chuẩn kiến thức bài toán.',
        };
      }

      // --- Case 3: Essay (Phần Tự luận: Học sinh tự nhập bài làm) ---
      if (qType === 'essay' || q.exam_part === 4) {
        const textAns = userAns?.answer_text ? userAns.answer_text.trim() : '';
        const isAnswered = textAns.length > 0;

        if (!isAnswered) {
          unansweredCount++;
          // Rule: Thí sinh không làm thì KHÔNG hiện đáp án & lời giải!
          return {
            id: q.id,
            order: eq.question_order || idx + 1,
            content: q.content,
            question_type: 'essay',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
          };
        }

        // Tự luận có làm bài: Ghi nhận bài nộp tự luận, tạm tính hoàn thành điểm tự luận
        earnedPoints += qPoints;
        correctCount++;

        return {
          id: q.id,
          order: eq.question_order || idx + 1,
          content: q.content,
          question_type: 'essay',
          points: qPoints,
          earned_points: qPoints,
          is_answered: true,
          user_answer_text: textAns,
          explanation: q.explanation || 'Hướng dẫn chấm bài và barem điểm chi tiết của câu hỏi tự luận.',
        };
      }

      // --- Case 4: Part I Single Choice / Multiple Choice ---
      const isAnswered = Boolean(userAns?.selected_option_id);
      const correctOpt = (q.options || []).find((o: any) => o.is_correct);
      const isCorrect = isAnswered && correctOpt && userAns?.selected_option_id === correctOpt.id;

      if (!isAnswered) {
        unansweredCount++;
        // Rule: Câu nào HS không làm thì KHÔNG hiện đáp án & lời giải!
        return {
          id: q.id,
          order: eq.question_order || idx + 1,
          content: q.content,
          question_type: qType,
          points: qPoints,
          earned_points: 0,
          is_answered: false,
          options: (q.options || []).map((o: any) => ({
            id: o.id,
            content: o.content,
          })),
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
        order: eq.question_order || idx + 1,
        content: q.content,
        question_type: qType,
        points: qPoints,
        earned_points: isCorrect ? qPoints : 0,
        is_answered: true,
        user_selected_option_id: userAns?.selected_option_id,
        correct_option_id: correctOpt?.id,
        explanation: q.explanation || 'Theo kiến thức trọng tâm bài học.',
        options: (q.options || []).map((o: any) => ({
          id: o.id,
          content: o.content,
          is_correct: Boolean(o.is_correct),
        })),
      };
    });

    if (totalPoints === 0) totalPoints = 10;
    const finalScore = Math.round(Math.min(totalPoints, earnedPoints) * 100) / 100;
    const percentage = Math.round((finalScore / totalPoints) * 100);

    const result: ExamResult = {
      id: `res-${Date.now()}`,
      attempt_id: attemptId,
      exam_session_id: session?.id || 'session-toan-10',
      student_name: 'Học sinh',
      student_code: 'HS-ONLINE',
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

    mockStore.addResult(result);
    return {
      success: true,
      result,
    };
  }

  const supabase = getSupabase();

  // ----------------------------------------------------------------------------
  // SECURE GRADING ON SUPABASE
  // ----------------------------------------------------------------------------
  try {
    // 1. Fetch attempt and exam
    const { data: attempt } = await supabase
      .from('exam_attempts')
      .select('*, session:exam_sessions(*, exam:exams(*))')
      .eq('id', attemptId)
      .single();

    if (!attempt) {
      return { success: false, message: 'Lần làm bài không tồn tại.' };
    }

    const session = attempt.session;

    // 2. Fetch exam questions and options
    const { data: examQuestions } = await supabase
      .from('exam_questions')
      .select('question_id, points, question:questions(id, content, explanation, question_type, options:question_options(id, content, is_correct))')
      .eq('exam_id', session.exam_id);

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const reviewQuestions = (examQuestions || []).map((eq: any, idx: number) => {
      const q = eq.question;
      const qPoints = Number(eq.points) || 1;
      totalPoints += qPoints;
      const userAns = answers[eq.question_id];
      const qType = q.question_type || 'single_choice';

      if (qType === 'true_false' || q.exam_part === 2) {
        const rawStatements = getQuestionStatements(q);
        const userStAnswers = userAns?.statement_answers || 
          (userAns?.answer_text && userAns.answer_text.startsWith('{') ? JSON.parse(userAns.answer_text) : {});
        
        const answeredCountForQ = Object.keys(userStAnswers).length;
        const isAnswered = answeredCountForQ > 0;

        if (!isAnswered) {
          unansweredCount++;
          return {
            id: q.id,
            order: idx + 1,
            content: q.content,
            question_type: 'true_false',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
            statements: rawStatements.map((st, sIdx) => ({
              id: st.id || `st-${sIdx + 1}`,
              statement: st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, ''),
            })),
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
            explanation: isStAnswered ? (st.explanation || (st.is_correct ? 'Mệnh đề ĐÚNG.' : 'Mệnh đề SAI.')) : undefined,
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
          order: idx + 1,
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

      // Short Answer
      if (qType === 'short_answer' || q.exam_part === 3) {
        const textAns = userAns?.answer_text ? userAns.answer_text.trim() : '';
        const isAnswered = textAns.length > 0;

        if (!isAnswered) {
          unansweredCount++;
          return {
            id: q.id,
            order: idx + 1,
            content: q.content,
            question_type: 'short_answer',
            points: qPoints,
            earned_points: 0,
            is_answered: false,
          };
        }

        const rawExpected = q.short_answer?.normalized_answer ||
          (((q?.options || []) as any[]).find((o: any) => o.is_correct)?.content) ||
          q.correct_answer || '';
        const variants = q.short_answer?.accepted_variants || [rawExpected];

        const normalizeStr = (str: string) =>
          str.toLowerCase().replace(/,/g, '.').replace(/\s+/g, '').trim();

        const normUser = normalizeStr(textAns);
        const isCorrect = variants.some((v: string) => normalizeStr(v) === normUser) ||
          (normUser !== '' && normUser === normalizeStr(rawExpected));

        if (isCorrect) {
          earnedPoints += qPoints;
          correctCount++;
        } else {
          wrongCount++;
        }

        return {
          id: q.id,
          order: idx + 1,
          content: q.content,
          question_type: 'short_answer',
          points: qPoints,
          earned_points: isCorrect ? qPoints : 0,
          is_answered: true,
          user_answer_text: textAns,
          correct_answer: rawExpected,
          explanation: q.explanation,
        };
      }

      // Essay
      if (qType === 'essay' || q.exam_part === 4) {
        const textAns = userAns?.answer_text ? userAns.answer_text.trim() : '';
        const isAnswered = textAns.length > 0;

        if (!isAnswered) {
          unansweredCount++;
          return {
            id: q.id,
            order: idx + 1,
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
          order: idx + 1,
          content: q.content,
          question_type: 'essay',
          points: qPoints,
          earned_points: qPoints,
          is_answered: true,
          user_answer_text: textAns,
          explanation: q.explanation || 'Hướng dẫn chấm bài tự luận chi tiết.',
        };
      }

      // Single Choice
      const isAnswered = Boolean(userAns?.selected_option_id);
      const correctOpt = ((q?.options || []) as any[]).find((o: any) => o.is_correct);
      const isCorrect = isAnswered && correctOpt && userAns?.selected_option_id === correctOpt.id;

      if (!isAnswered) {
        unansweredCount++;
        return {
          id: q.id,
          order: idx + 1,
          content: q.content,
          question_type: qType,
          points: qPoints,
          earned_points: 0,
          is_answered: false,
          options: (q.options || []).map((o: any) => ({
            id: o.id,
            content: o.content,
          })),
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
        order: idx + 1,
        content: q.content,
        question_type: qType,
        points: qPoints,
        earned_points: isCorrect ? qPoints : 0,
        is_answered: true,
        user_selected_option_id: userAns?.selected_option_id,
        correct_option_id: correctOpt?.id,
        explanation: q.explanation,
        options: (q.options || []).map((o: any) => ({
          id: o.id,
          content: o.content,
          is_correct: Boolean(o.is_correct),
        })),
      };
    });

    if (totalPoints === 0) totalPoints = 10;
    const finalScore = Math.round(earnedPoints * 100) / 100;
    const percentage = Math.round((earnedPoints / totalPoints) * 1000) / 10;

    // 3. Update attempt status
    await supabase
      .from('exam_attempts')
      .update({
        status: 'graded',
        submitted_at: new Date().toISOString(),
        score: finalScore,
        max_score: totalPoints,
        percentage,
      })
      .eq('id', attemptId);

    // 4. Save exam result
    const newResult: ExamResult = {
      id: 'res-' + attemptId,
      attempt_id: attemptId,
      student_id: attempt.student_id,
      exam_session_id: session.id,
      student_name: attempt.student_name,
      student_code: attempt.student_code,
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

    return {
      success: true,
      result: newResult,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
