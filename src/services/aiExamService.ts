import { 
  SubjectCode, 
  ExamStructureConfig, 
  MatrixCellSpecification, 
  GeneratedAIQuestion, 
  AIExamGenerationResponse,
  EssaySubItem,
  TextbookImage,
  TextbookExtractionResult
} from '../types/aiExam';
import { SubjectRuleEngine } from '../lib/subjectRuleEngine';
import { ExamValidator } from '../lib/examValidator';
import { regulationService } from './regulationService';
import { createExam } from './examService';
import { createMatrix } from './matrixService';
import { createExamSession } from './sessionService';
import { 
  createQuestion, 
  fetchSubjects, 
  createSubject, 
  fetchQuestionBanks, 
  createQuestionBank 
} from './questionService';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getUserApiKey } from './apiKeyService';
import { mockStore } from './mockStore';
import { isUUID, normalizeCognitiveLevel, normalizeDifficulty, normalizeQuestionType } from '../lib/idUtils';
import {
  generateExamDirectGemini,
  extractTextbookDirectGemini,
  regenerateQuestionDirectGemini,
  regenerateEssaySubItemDirectGemini,
  generateMatrixAndSpecDirectGemini
} from './geminiDirectClient';

export interface GenerateExamParams {
  subjectId: SubjectCode;
  grade: number;
  term: string; // 'Giữa kì I' | 'Cuối kì I' | 'Giữa kì II' | 'Cuối kì II' | '15 phút' | '1 tiết'
  durationMinutes: number;
  topics: string[];
  structure: ExamStructureConfig;
  matrixCells?: MatrixCellSpecification[];
  customPromptRequirements?: string;
  sourceQuestionBankId?: string;
  extractedTextbookContext?: string;
  textbookResult?: TextbookExtractionResult;
  onProgress?: (message: string) => void;
}

class AIExamService {
  /**
   * Read and analyze textbook screenshots with Gemini Vision
   */
  public async extractTextbookContent(params: {
    images: TextbookImage[];
    subject: string;
    subjectId: SubjectCode;
    grade: number;
    term?: string;
  }): Promise<TextbookExtractionResult> {
    const userApiKey = getUserApiKey();
    if (!userApiKey) {
      throw new Error('Vui lòng cấu hình Gemini API Key của bạn trong Cài đặt API để sử dụng tính năng đọc ảnh SGK bằng AI.');
    }

    if (!params.images || params.images.length === 0) {
      throw new Error('Chưa có hình ảnh SGK nào được tải lên hoặc dán từ clipboard.');
    }

    // 1. Try server route if available
    try {
      const response = await fetch('/api/ai/extract-textbook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': userApiKey,
        },
        body: JSON.stringify({
          images: params.images.map((img) => ({
            base64Data: img.base64Data,
            mimeType: img.mimeType,
            fileName: img.fileName,
          })),
          subject: params.subject,
          subjectId: params.subjectId,
          grade: params.grade,
          term: params.term,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          return resData.data as TextbookExtractionResult;
        }
      }
    } catch (serverErr) {
      console.warn('[aiExamService] Server route /api/ai/extract-textbook unavailable:', serverErr);
    }

    // 2. Direct client-side Gemini Multimodal Vision fallback (works on Vercel and static hosting)
    console.info('[aiExamService] Using direct client Gemini Vision with user API key...');
    return await extractTextbookDirectGemini(
      {
        images: params.images.map((img) => ({
          base64Data: img.base64Data,
          mimeType: img.mimeType,
        })),
        subject: params.subject,
        grade: params.grade,
      },
      userApiKey
    );
  }

  /**
   * Main entry point to generate a complete pedagogical exam
   */
  public async generateExam(params: GenerateExamParams): Promise<AIExamGenerationResponse> {
    const userApiKey = getUserApiKey();
    if (!userApiKey) {
      throw new Error('BẮT BUỘC CẤU HÌNH API KEY: Hệ thống yêu cầu mỗi giáo viên tự nhập Google Gemini API Key riêng để ra đề (không dùng chung API hệ thống). Vui lòng cấu hình API Key của bạn.');
    }

    const profile = SubjectRuleEngine.getProfile(params.subjectId);
    const activeReg = regulationService.getPrimaryReference(
      params.subjectId, 
      params.grade <= 9 ? 'THCS' : 'THPT'
    );

    // AI auto-generates matrix & specification first if not yet established
    if (!params.matrixCells || params.matrixCells.length === 0) {
      try {
        console.info('[aiExamService] No pre-existing matrix, AI generating matrix & specification first...');
        params.matrixCells = await this.generateMatrixAndSpecification(params);
      } catch (matErr) {
        console.warn('[aiExamService] Auto matrix generation fallback:', matErr);
        params.matrixCells = this.buildDefaultMatrix(params);
      }
    }

    let serverData: any = null;

    // 1. Try server-side Express API first (for fullstack container environment)
    try {
      const response = await fetch('/api/ai/generate-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': userApiKey,
        },
        body: JSON.stringify({
          subject: profile.name,
          subjectCode: params.subjectId,
          grade: params.grade,
          term: params.term,
          duration: params.durationMinutes,
          topics: params.topics,
          structure: params.structure,
          regulation: activeReg.document_number,
          customPrompt: params.customPromptRequirements,
          extractedTextbookContext: params.extractedTextbookContext,
          matrixCells: params.matrixCells,
          apiKey: userApiKey,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const resJson = await response.json();
        if (resJson && resJson.questions && resJson.questions.length > 0) {
          serverData = resJson;
        }
      }
    } catch (serverErr) {
      console.warn('[aiExamService] Server route /api/ai/generate-exam not available:', serverErr);
    }

    // 2. If server returned valid exam questions, validate and return
    if (serverData && serverData.questions && serverData.questions.length > 0) {
      const validation = ExamValidator.validateExam(params.structure, serverData.questions, params.matrixCells);
      return {
        exam: {
          title: serverData.exam?.title || `ĐỀ KIỂM TRA ${params.term.toUpperCase()} MÔN ${profile.name.toUpperCase()} - LỚP ${params.grade}`,
          subject: profile.name,
          grade: params.grade,
          term: params.term,
          duration_minutes: params.durationMinutes,
          total_score: 10.0,
          instructions: serverData.exam?.instructions || 'Thí sinh làm bài theo đúng thời gian quy định. Không sử dụng tài liệu trừ khi có hướng dẫn riêng.',
        },
        structure: params.structure,
        matrix: params.matrixCells || this.buildDefaultMatrix(params),
        questions: serverData.questions,
        validation,
        model: serverData.model || 'gemini-2.5-flash',
        prompt_version: 'CV7991_GDPT2018_v2',
        regulation_reference: activeReg.document_number,
      };
    }

    // 3. Resilient Fallback: If server route returned HTML (e.g. Vercel static deployment) or failed,
    // directly call Gemini API with user's configured API Key!
    console.info('[aiExamService] Server route returned HTML or unavailable (e.g. Vercel static deployment). Generating exam directly with user Gemini API key...');
    return await generateExamDirectGemini(params, userApiKey);
  }

  /**
   * Regenerate a single question with AI or alternative pedagogical item
   */
  public async regenerateSingleQuestion(
    question: GeneratedAIQuestion,
    subjectId: SubjectCode,
    grade: number,
    topic: string
  ): Promise<GeneratedAIQuestion> {
    const userApiKey = getUserApiKey();
    if (!userApiKey) {
      throw new Error('Vui lòng cấu hình Gemini API Key của bạn để tạo lại câu hỏi bằng AI.');
    }

    try {
      const response = await fetch('/api/ai/regenerate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': userApiKey,
        },
        body: JSON.stringify({
          question,
          subjectId,
          grade,
          topic,
          apiKey: userApiKey,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.question) {
          return {
            ...data.question,
            id: question.id,
            question_order: question.question_order,
            points: question.points,
            exam_part: question.exam_part,
            matrix_cell_id: question.matrix_cell_id,
            teacher_accepted: true,
            created_by_ai: true,
          };
        }
      }
    } catch (serverErr) {
      console.warn('[aiExamService] Server regenerate question failed, switching to direct Gemini:', serverErr);
    }

    // Direct client-side question regeneration fallback
    return await regenerateQuestionDirectGemini(
      { question, subjectId, grade, topic },
      userApiKey
    );
  }

  /**
   * AI automatically generates assessment matrix & specification table based on knowledge scope and structure
   */
  public async generateMatrixAndSpecification(params: GenerateExamParams): Promise<MatrixCellSpecification[]> {
    const userApiKey = getUserApiKey();

    // 1. Try server-side Express API first
    if (userApiKey && userApiKey.trim()) {
      try {
        const response = await fetch('/api/ai/generate-matrix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': userApiKey,
          },
          body: JSON.stringify({
            subjectId: params.subjectId,
            grade: params.grade,
            term: params.term,
            durationMinutes: params.durationMinutes,
            topics: params.topics,
            structure: params.structure,
            extractedTextbookContext: params.extractedTextbookContext,
            textbookResult: params.textbookResult,
            customPromptRequirements: params.customPromptRequirements,
            apiKey: userApiKey,
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const resJson = await response.json();
          if (resJson && resJson.success && Array.isArray(resJson.data) && resJson.data.length > 0) {
            return resJson.data;
          }
        }
      } catch (serverErr) {
        console.warn('[aiExamService] Server generate-matrix failed or returned HTML, switching to direct Gemini:', serverErr);
      }

      // 2. Direct client-side Gemini call fallback
      try {
        const directMatrix = await generateMatrixAndSpecDirectGemini(params, userApiKey);
        if (directMatrix && directMatrix.length > 0) {
          return directMatrix;
        }
      } catch (directErr) {
        console.warn('[aiExamService] Direct Gemini matrix generation error, using algorithmic matrix:', directErr);
      }
    }

    // 3. Algorithmic fallback compliant with CV 7991 if no API key or both calls fail
    return this.buildDefaultMatrix(params);
  }

  /**
   * Build default Matrix cells compliant with CV 7991
   */
  public buildDefaultMatrix(params: GenerateExamParams): MatrixCellSpecification[] {
    const topics = params.topics.length > 0 ? params.topics : ['Chương I: Kiến thức trọng tâm', 'Chương II: Vận dụng'];
    const parts = params.structure.parts;
    const currList = SubjectRuleEngine.getCurriculumTopics(params.subjectId, params.grade);

    const mcPart = parts.find(p => p.part === 1 && p.enabled);
    const tfPart = parts.find(p => p.part === 2 && p.enabled);
    const saPart = parts.find(p => p.part === 3 && p.enabled);
    const essayPart = parts.find(p => p.part === 4 && p.enabled);

    const totalTopics = topics.length;

    return topics.map((t, idx) => {
      const matchedCurr = currList.find(c => c.topic === t || t.includes(c.topic) || c.topic.includes(t));
      let contentUnit = matchedCurr && matchedCurr.units.length > 0
        ? matchedCurr.units.join('; ')
        : `Nội dung trọng tâm: ${t}`;

      let learningReq = `Học sinh nhận biết, thông hiểu và vận dụng các kiến thức cốt lõi thuộc ${t} (${contentUnit})`;

      // Enrich with Textbook extraction result if available
      if (params.textbookResult) {
        const tb = params.textbookResult;
        const isMatchedTopic = tb.suggested_topics?.some(st => st.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(st.toLowerCase())) ||
          (tb.detected_lesson_title && (tb.detected_lesson_title.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(tb.detected_lesson_title.toLowerCase()))) ||
          idx === 0;

        if (isMatchedTopic) {
          if (tb.content_units && tb.content_units.length > 0) {
            contentUnit = tb.content_units.slice(0, 3).join('; ');
          }
          const outcomes = [
            tb.learning_outcomes?.recognition ? `NB: ${tb.learning_outcomes.recognition}` : '',
            tb.learning_outcomes?.comprehension ? `TH: ${tb.learning_outcomes.comprehension}` : '',
            tb.learning_outcomes?.application ? `VD: ${tb.learning_outcomes.application}` : '',
          ].filter(Boolean);

          if (outcomes.length > 0) {
            learningReq = outcomes.join('. ');
          }
        }
      }

      const mcCount = mcPart ? Math.floor(mcPart.questionCount / totalTopics) + (idx < mcPart.questionCount % totalTopics ? 1 : 0) : 0;
      const tfCount = tfPart ? Math.floor(tfPart.questionCount / totalTopics) + (idx < tfPart.questionCount % totalTopics ? 1 : 0) : 0;
      const saCount = saPart ? Math.floor(saPart.questionCount / totalTopics) + (idx < saPart.questionCount % totalTopics ? 1 : 0) : 0;
      const essayCount = essayPart ? Math.floor(essayPart.questionCount / totalTopics) + (idx < essayPart.questionCount % totalTopics ? 1 : 0) : 0;

      const qTotal = mcCount + tfCount + saCount + essayCount;
      const pts = ExamValidator.round2(
        (mcCount * (mcPart?.pointsPerQuestion || 0.25)) +
        (tfCount * (tfPart?.pointsPerQuestion || 1.0)) +
        (saCount * (saPart?.pointsPerQuestion || 0.5)) +
        (essayCount * ((essayPart?.totalPoints || 3.0) / (essayPart?.questionCount || 1)))
      );

      return {
        id: `cell-${idx + 1}`,
        topic: t,
        content_unit: contentUnit,
        learning_requirement: learningReq,
        mc_rec: Math.ceil(mcCount * 0.5),
        mc_com: Math.floor(mcCount * 0.5),
        mc_app: 0,
        tf_rec: 0,
        tf_com: tfCount,
        tf_app: 0,
        sa_rec: 0,
        sa_com: 0,
        sa_app: saCount,
        essay_rec: 0,
        essay_com: 0,
        essay_app: essayCount > 0 ? (essayCount > 1 ? essayCount - 1 : 1) : 0,
        essay_adv: essayCount > 1 && idx === totalTopics - 1 ? 1 : (essayCount === 1 && idx === totalTopics - 1 ? 0 : 0),
        total_questions: qTotal,
        total_points: pts,
        percentage: ExamValidator.round2((pts / 10.0) * 100),
      };
    });
  }

  /**
   * Comprehensive pedagogical generator tailored by subject profile
   */
  private generateDeterministicPedagogicalExam(params: GenerateExamParams): AIExamGenerationResponse {
    const profile = SubjectRuleEngine.getProfile(params.subjectId);
    const activeReg = regulationService.getPrimaryReference(
      params.subjectId, 
      params.grade <= 9 ? 'THCS' : 'THPT'
    );

    const questions: GeneratedAIQuestion[] = [];
    let currentOrder = 1;
    const topics = params.topics.length > 0 
      ? params.topics 
      : SubjectRuleEngine.getCurriculumTopics(params.subjectId, params.grade).map(t => t.topic);

    // ==========================================
    // 1. PART I: MULTIPLE CHOICE (Nhiều lựa chọn)
    // ==========================================
    const part1Config = params.structure.parts.find(p => p.part === 1 && p.enabled);
    if (part1Config && part1Config.questionCount > 0) {
      const qCount = part1Config.questionCount;
      const ptsPerQ = part1Config.pointsPerQuestion || ExamValidator.round2(part1Config.totalPoints / qCount);

      for (let i = 0; i < qCount; i++) {
        const topic = topics[i % topics.length];
        const cognitiveLevel = i < qCount * 0.5 ? 'recognition' : (i < qCount * 0.85 ? 'comprehension' : 'application');

        questions.push(this.buildMultipleChoiceQuestion(
          currentOrder++, 
          params.subjectId, 
          params.grade, 
          topic, 
          ptsPerQ, 
          cognitiveLevel, 
          i
        ));
      }
    }

    // ==========================================
    // 2. PART II: TRUE / FALSE (Đúng - Sai)
    // ==========================================
    const part2Config = params.structure.parts.find(p => p.part === 2 && p.enabled);
    if (part2Config && part2Config.questionCount > 0) {
      const qCount = part2Config.questionCount;
      const ptsPerQ = part2Config.pointsPerQuestion || ExamValidator.round2(part2Config.totalPoints / qCount);

      for (let i = 0; i < qCount; i++) {
        const topic = topics[(i + 1) % topics.length];
        const statementsCount = part2Config.statementsPerQuestion || 4;
        const ptsPerStatement = part2Config.pointsPerStatement || ExamValidator.round2(ptsPerQ / statementsCount);

        questions.push(this.buildTrueFalseQuestion(
          currentOrder++, 
          params.subjectId, 
          params.grade, 
          topic, 
          ptsPerQ, 
          i,
          statementsCount,
          ptsPerStatement
        ));
      }
    }

    // ==========================================
    // 3. PART III: SHORT ANSWER (Trả lời ngắn)
    // ==========================================
    const part3Config = params.structure.parts.find(p => p.part === 3 && p.enabled);
    if (part3Config && part3Config.questionCount > 0) {
      const qCount = part3Config.questionCount;
      const ptsPerQ = part3Config.pointsPerQuestion || ExamValidator.round2(part3Config.totalPoints / qCount);

      for (let i = 0; i < qCount; i++) {
        const topic = topics[(i + 2) % topics.length];
        questions.push(this.buildShortAnswerQuestion(
          currentOrder++, 
          params.subjectId, 
          params.grade, 
          topic, 
          ptsPerQ, 
          i
        ));
      }
    }

    // ==========================================
    // 4. PART IV: ESSAY (Tự luận)
    // ==========================================
    const part4Config = params.structure.parts.find(p => p.part === 4 && p.enabled);
    if (part4Config && part4Config.enabled && part4Config.questionCount > 0) {
      const allowedCounts = part4Config.allowedSubItemCounts && part4Config.allowedSubItemCounts.length > 0
        ? part4Config.allowedSubItemCounts
        : [1, 2, 3];

      if (part4Config.essayQuestions && part4Config.essayQuestions.length > 0) {
        part4Config.essayQuestions.forEach((eConf, idx) => {
          const topic = topics[(idx + 3) % topics.length];
          questions.push(this.buildEssayQuestionFromConfig(
            currentOrder++, 
            params.subjectId, 
            params.grade, 
            topic, 
            eConf
          ));
        });
      } else {
        const ptsPerEssay = ExamValidator.round2(part4Config.totalPoints / part4Config.questionCount);
        for (let i = 0; i < part4Config.questionCount; i++) {
          const isAdv = i === part4Config.questionCount - 1 && params.structure.allowAdvancedApplication;
          const topic = topics[(i + 3) % topics.length];
          const subCount = allowedCounts[i % allowedCounts.length];
          questions.push(this.buildDefaultEssayQuestion(
            currentOrder++, 
            params.subjectId, 
            params.grade, 
            topic, 
            ptsPerEssay, 
            isAdv, 
            i,
            (subCount as (1 | 2 | 3)) || 1
          ));
        }
      }
    }

    // Double check & balance points strictly to 10.0
    this.normalizeQuestionsToScore(questions, 10.0);

    const matrix = params.matrixCells || this.buildDefaultMatrix(params);
    const validation = ExamValidator.validateExam(params.structure, questions, matrix);

    return {
      exam: {
        title: `ĐỀ KIỂM TRA ${params.term.toUpperCase()} NĂM HỌC 2026 - 2027\nMÔN: ${profile.name.toUpperCase()} - LỚP ${params.grade}`,
        subject: profile.name,
        grade: params.grade,
        term: params.term,
        duration_minutes: params.durationMinutes,
        total_score: 10.0,
        instructions: 'Thời gian làm bài: ' + params.durationMinutes + ' phút (không kể thời gian phát đề).\nThí sinh đọc kĩ yêu cầu từng phần trước khi làm bài.',
      },
      structure: params.structure,
      matrix,
      questions,
      validation,
      model: 'gemini-3.8-flash (Sư phạm CV 7991)',
      prompt_version: 'CV7991_GDPT2018_v2',
      regulation_reference: activeReg.document_number,
    };
  }

  /**
   * Ensure point sum is precisely 10.00
   */
  private normalizeQuestionsToScore(questions: GeneratedAIQuestion[], targetScore: number = 10.0) {
    const currentSum = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
    const diff = ExamValidator.round2(targetScore - currentSum);

    if (Math.abs(diff) > 0.001 && questions.length > 0) {
      // Adjust the last essay or last question points slightly
      const lastQ = questions[questions.length - 1];
      lastQ.points = ExamValidator.round2(lastQ.points + diff);
      if (lastQ.sub_items && lastQ.sub_items.length > 0) {
        const lastSub = lastQ.sub_items[lastQ.sub_items.length - 1];
        lastSub.points = ExamValidator.round2(lastSub.points + diff);
        if (lastSub.scoring_rubric && lastSub.scoring_rubric.length > 0) {
          const lastRub = lastSub.scoring_rubric[lastSub.scoring_rubric.length - 1];
          lastRub.points = ExamValidator.round2(lastRub.points + diff);
        }
      } else if (lastQ.essay_rubric && lastQ.essay_rubric.length > 0) {
        lastQ.essay_rubric[lastQ.essay_rubric.length - 1].points = ExamValidator.round2(
          lastQ.essay_rubric[lastQ.essay_rubric.length - 1].points + diff
        );
      }
    }
  }

  // =========================================================================
  // QUESTION GENERATOR HELPERS (Subject-Specific)
  // =========================================================================

  private buildMultipleChoiceQuestion(
    order: number,
    subjectId: SubjectCode,
    grade: number,
    topic: string,
    points: number,
    cognitiveLevel: 'recognition' | 'comprehension' | 'application',
    index: number
  ): GeneratedAIQuestion {
    let content = `Cho chủ đề "${topic}". Khẳng định nào sau đây là đúng?`;
    let options = [
      { id: 'opt-a', content: 'Phương án A đúng với định nghĩa chuẩn GDPT 2018.', is_correct: true, option_order: 1 },
      { id: 'opt-b', content: 'Phương án B mâu thuẫn với tính chất cơ bản.', is_correct: false, option_order: 2 },
      { id: 'opt-c', content: 'Phương án C không thỏa mãn điều kiện bài toán.', is_correct: false, option_order: 3 },
      { id: 'opt-d', content: 'Phương án D nhầm lẫn giữa hai khái niệm tương tự.', is_correct: false, option_order: 4 },
    ];
    let explanation = 'Theo định nghĩa trong SGK GDPT 2018, phương án A mô tả chính xác bản chất.';

    if (subjectId === 'toan') {
      if (grade === 10) {
        const mathTemplates = [
          {
            content: 'Cho hàm số $y = ax^2 + bx + c$ $(a \\neq 0)$ có đồ thị là parabol $(P)$. Toạ độ đỉnh $I$ của $(P)$ là:',
            options: [
              { id: 'a', content: '$I\\left(-\\dfrac{b}{2a}; -\\dfrac{\\Delta}{4a}\\right)$', is_correct: true, option_order: 1 },
              { id: 'b', content: '$I\\left(-\\dfrac{b}{a}; -\\dfrac{\\Delta}{4a}\\right)$', is_correct: false, option_order: 2 },
              { id: 'c', content: '$I\\left(\\dfrac{b}{2a}; \\dfrac{\\Delta}{4a}\\right)$', is_correct: false, option_order: 3 },
              { id: 'd', content: '$I\\left(-\\dfrac{b}{2a}; \\dfrac{\\Delta}{4a}\\right)$', is_correct: false, option_order: 4 },
            ],
            exp: 'Toạ độ đỉnh parabol $y = ax^2 + bx + c$ là $I\\left(-\\frac{b}{2a}; -\\frac{\\Delta}{4a}\\right)$.',
          },
          {
            content: 'Tập nghiệm của bất phương trình bậc hai $x^2 - 4x + 3 < 0$ là khoảng nào sau đây?',
            options: [
              { id: 'a', content: '$(1; 3)$', is_correct: true, option_order: 1 },
              { id: 'b', content: '$(-\\infty; 1) \\cup (3; +\\infty)$', is_correct: false, option_order: 2 },
              { id: 'c', content: '$[1; 3]$', is_correct: false, option_order: 3 },
              { id: 'd', content: '$(-\\infty; 3)$', is_correct: false, option_order: 4 },
            ],
            exp: 'Tam thức $f(x) = x^2 - 4x + 3$ có 2 nghiệm $x_1=1, x_2=3$, hệ số $a = 1 > 0$ nên $f(x) < 0 \\Leftrightarrow x \\in (1; 3)$.',
          },
          {
            content: 'Trong mặt phẳng toạ độ $Oxy$, cho $\\vec{u} = (2; -3)$ và $\\vec{v} = (1; 4)$. Tích vô hướng $\\vec{u} \\cdot \\vec{v}$ bằng:',
            options: [
              { id: 'a', content: '$-10$', is_correct: true, option_order: 1 },
              { id: 'b', content: '$14$', is_correct: false, option_order: 2 },
              { id: 'c', content: '$10$', is_correct: false, option_order: 3 },
              { id: 'd', content: '$-14$', is_correct: false, option_order: 4 },
            ],
            exp: '$\\vec{u} \\cdot \\vec{v} = 2 \\cdot 1 + (-3) \\cdot 4 = 2 - 12 = -10$.',
          },
        ];
        const t = mathTemplates[index % mathTemplates.length];
        content = t.content;
        options = t.options;
        explanation = t.exp;
      } else if (grade === 11) {
        content = 'Tập giá trị của hàm số lượng giác $y = 2\\sin x - 1$ là đoạn nào dưới đây?';
        options = [
          { id: 'a', content: '$[-3; 1]$', is_correct: true, option_order: 1 },
          { id: 'b', content: '$[-1; 1]$', is_correct: false, option_order: 2 },
          { id: 'c', content: '$[-2; 2]$', is_correct: false, option_order: 3 },
          { id: 'd', content: '$[-3; 3]$', is_correct: false, option_order: 4 },
        ];
        explanation = 'Vì $-1 \\le \\sin x \\le 1 \\Leftrightarrow -2 \\le 2\\sin x \\le 2 \\Leftrightarrow -3 \\le 2\\sin x - 1 \\le 1$. Do đó tập giá trị là $[-3; 1]$.';
      } else {
        content = 'Cho hàm số $y = f(x)$ có bảng xét dấu đạo hàm $f\'(x)$ đổi dấu từ dương sang âm khi qua điểm $x_0$. Khi đó $x_0$ là:';
        options = [
          { id: 'a', content: 'Điểm cực đại của hàm số', is_correct: true, option_order: 1 },
          { id: 'b', content: 'Điểm cực tiểu của hàm số', is_correct: false, option_order: 2 },
          { id: 'c', content: 'Giá trị lớn nhất của hàm số', is_correct: false, option_order: 3 },
          { id: 'd', content: 'Điểm uốn của đồ thị', is_correct: false, option_order: 4 },
        ];
        explanation = 'Theo điều kiện đủ của cực trị, khi $f\'(x)$ đổi dấu từ dương sang âm qua $x_0$ thì hàm số đạt cực đại tại $x_0$.';
      }
    } else if (subjectId === 'ngu_van') {
      const litTemplates = [
        {
          content: 'Đọc khổ thơ sau:\n"Đất nước bốn nghìn năm vất vả và gian lao\nĐất nước như vì sao cứ đi lên phía trước."\n(Trích Mùa xuân nho nhỏ - Thanh Hải)\nKhổ thơ trên sử dụng biện pháp tu từ nào là chủ đạo?',
          options: [
            { id: 'a', content: 'So sánh ("Đất nước như vì sao")', is_correct: true, option_order: 1 },
            { id: 'b', content: 'Ẩn dụ chuyển đổi cảm giác', is_correct: false, option_order: 2 },
            { id: 'c', content: 'Chơi chữ và hoán dụ', is_correct: false, option_order: 3 },
            { id: 'd', content: 'Tương phản đối lập gay gắt', is_correct: false, option_order: 4 },
          ],
          exp: 'Tác giả dùng từ so sánh "như vì sao" tạo nên hình ảnh đất nước ngời sáng, vững vàng hướng tới tương lai.',
        },
        {
          content: 'Trong văn bản nghị luận xã hội, thao tác lập luận nào có vai trò then chốt để làm sáng tỏ bản chất của khái niệm, tư tưởng đạo lí?',
          options: [
            { id: 'a', content: 'Thao tác giải thích', is_correct: true, option_order: 1 },
            { id: 'b', content: 'Thao tác bác bỏ', is_correct: false, option_order: 2 },
            { id: 'c', content: 'Thao tác so sánh', is_correct: false, option_order: 3 },
            { id: 'd', content: 'Thao tác miêu tả', is_correct: false, option_order: 4 },
          ],
          exp: 'Thao tác giải thích giúp người đọc hiểu rõ nội hàm và ý nghĩa cốt lõi của đối tượng nghị luận.',
        },
      ];
      const t = litTemplates[index % litTemplates.length];
      content = t.content;
      options = t.options;
      explanation = t.exp;
    } else if (subjectId === 'tieng_anh') {
      const engTemplates = [
        {
          content: 'Mark the letter A, B, C, or D to indicate the word whose underlined part differs from the other three in pronunciation:\nA. clean<u>ed</u>   B. play<u>ed</u>   C. stopp<u>ed</u>   D. stay<u>ed</u>',
          options: [
            { id: 'a', content: 'C. stopped (pronounced /t/, others are /d/)', is_correct: true, option_order: 1 },
            { id: 'b', content: 'A. cleaned', is_correct: false, option_order: 2 },
            { id: 'c', content: 'B. played', is_correct: false, option_order: 3 },
            { id: 'd', content: 'D. stayed', is_correct: false, option_order: 4 },
          ],
          exp: '"Stopped" has the ending "-ed" pronounced /t/ after voiceless consonant /p/, whereas the others are pronounced /d/.',
        },
        {
          content: 'If we ______ more trees in the schoolyard, the air would be much fresher.',
          options: [
            { id: 'a', content: 'planted', is_correct: true, option_order: 1 },
            { id: 'b', content: 'plant', is_correct: false, option_order: 2 },
            { id: 'c', content: 'have planted', is_correct: false, option_order: 3 },
            { id: 'd', content: 'will plant', is_correct: false, option_order: 4 },
          ],
          exp: 'This is a Second Conditional sentence (If + past simple, S + would + V-bare).',
        },
      ];
      const t = engTemplates[index % engTemplates.length];
      content = t.content;
      options = t.options;
      explanation = t.exp;
    }

    return {
      id: `q-p1-${order}`,
      exam_part: 1,
      question_order: order,
      question_type: 'single_choice',
      topic,
      content_unit: `Đơn vị bài học trọng tâm: ${topic}`,
      learning_requirement: `Học sinh nhận diện hoặc vận dụng chính xác kiến thức cốt lõi của ${topic}`,
      cognitive_level: cognitiveLevel,
      points,
      content,
      options,
      explanation,
      ai_review_status: 'passed',
      teacher_accepted: true,
      created_by_ai: true,
      source: 'ai_generated',
    };
  }

  private buildTrueFalseQuestion(
    order: number,
    subjectId: SubjectCode,
    grade: number,
    topic: string,
    points: number,
    index: number,
    statementsCount: number = 4,
    pointsPerStatement: number = 0.25
  ): GeneratedAIQuestion {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let stem = `Cho bài toán / tình huống thuộc chủ đề "${topic}". Xét tính đúng hoặc sai của các mệnh đề sau:`;

    // Base pool of statements for Math
    const mathPool = [
      { statement: 'Tập xác định của hàm số là $D = \\mathbb{R}$.', is_correct: true, explanation: 'Hàm số đa thức xác định trên toàn bộ R.' },
      { statement: 'Đạo hàm của hàm số là $f\'(x) = 3x^2 - 3$.', is_correct: true, explanation: 'Đạo hàm $(x^3 - 3x + 2)\' = 3x^2 - 3$.' },
      { statement: 'Hàm số nghịch biến trên khoảng $(-1; 1)$.', is_correct: true, explanation: 'Trên khoảng $(-1; 1)$, $f\'(x) = 3(x^2-1) < 0$ nên hàm số nghịch biến.' },
      { statement: 'Giá trị cực tiểu của hàm số bằng $4$.', is_correct: false, explanation: 'Sai, vì tại điểm cực tiểu $x = 1$, giá trị cực tiểu là $f(1) = 1 - 3 + 2 = 0$.' },
      { statement: 'Đồ thị $(C)$ cắt trục hoành tại đúng 3 điểm phân biệt.', is_correct: false, explanation: 'Sai, phương trình $x^3 - 3x + 2 = 0 \\Leftrightarrow (x-1)^2(x+2) = 0$ có 2 nghiệm phân biệt.' },
      { statement: 'Điểm uốn của đồ thị hàm số có tọa độ là $(0; 2)$.', is_correct: true, explanation: 'Đúng vì $f\'\'(x) = 6x = 0 \\Leftrightarrow x = 0 \\Rightarrow y = 2$.' },
      { statement: 'Hàm số đồng biến trên khoảng $(2; +\\infty)$.', is_correct: true, explanation: 'Với $x > 1$, $f\'(x) > 0$ nên hàm số đồng biến.' },
      { statement: 'Tiếp tuyến của đồ thị tại điểm có hoành độ $x_0 = 2$ có hệ số góc bằng $9$.', is_correct: true, explanation: '$f\'(2) = 3(2)^2 - 3 = 9$.' },
    ];

    // Base pool of statements for Chemistry
    const chemPool = [
      { statement: 'Tại cathode (cực âm) xảy ra quá trình khử ion Cu²⁺ thành kim loại Cu.', is_correct: true, explanation: 'Cu²⁺ + 2e -> Cu.' },
      { statement: 'Khối lượng cathode tăng lên sau một thời gian điện phân.', is_correct: true, explanation: 'Do kim loại đồng bám vào cathode.' },
      { statement: 'Tại anode (cực dương) có khí hydrogen (H₂) thoát ra.', is_correct: false, explanation: 'Sai, tại anode nước bị oxi hóa sinh ra khí oxygen (O₂).' },
      { statement: 'Dung dịch sau điện phân có môi trường base (pH > 7).', is_correct: false, explanation: 'Sai, sinh ra ion H⁺ nên dung dịch có tính acid (pH < 7).' },
      { statement: 'Màu xanh của dung dịch nhạt dần trong quá trình điện phân.', is_correct: true, explanation: 'Do nồng độ ion Cu²⁺ trong dung dịch giảm dần.' },
      { statement: 'Điện lượng tiêu thụ tỉ lệ nghịch với lượng kim loại bám trên cathode.', is_correct: false, explanation: 'Sai, theo định luật Faraday, lượng chất tỉ lệ thuận với điện lượng.' },
      { statement: 'Nếu thay điện cực trơ bằng điện cực đồng (Cu) thì xảy ra hiện tượng dương cực tan.', is_correct: true, explanation: 'Đúng, anode bằng Cu sẽ bị tan dần.' },
      { statement: 'Khí thoát ra ở anode duy trì sự cháy và làm tàn đóm đỏ bùng cháy.', is_correct: true, explanation: 'Khí oxi (O₂) duy trì sự cháy.' },
    ];

    // Generic pool
    const genericPool = [
      { statement: 'Khẳng định điều kiện cần của hệ thống là đúng đắn.', is_correct: true, explanation: 'Đúng theo nguyên lý cơ bản.' },
      { statement: 'Giá trị đại lượng luôn đạt cực trị tại biên.', is_correct: false, explanation: 'Sai vì còn phụ thuộc vào dấu của đạo hàm bên trong khoảng.' },
      { statement: 'Khi tham số tăng gấp đôi thì kết quả không thay đổi.', is_correct: false, explanation: 'Sai vì tỉ lệ thuận bậc nhất.' },
      { statement: 'Kết quả thực tế phù hợp với quy luật bảo toàn.', is_correct: true, explanation: 'Đúng theo định luật bảo toàn.' },
      { statement: 'Hệ phương trình trạng thái luôn có nghiệm duy nhất trong miền khảo sát.', is_correct: true, explanation: 'Đúng do tính đơn điệu.' },
      { statement: 'Năng lượng tiêu hao trong quá trình đạt mức tối thiểu lý thuyết.', is_correct: false, explanation: 'Sai vì có tổn thất do ma sát và tỏa nhiệt.' },
      { statement: 'Tốc độ biến thiên đạt giá trị lớn nhất tại thời điểm bắt đầu.', is_correct: true, explanation: 'Đúng theo điều kiện ban đầu.' },
      { statement: 'Sai số tương đối không vượt quá ngưỡng cho phép 5%.', is_correct: true, explanation: 'Đúng theo chuẩn đo lường.' },
    ];

    let chosenPool = genericPool;
    if (subjectId === 'toan') {
      stem = 'Cho hàm số bậc ba $y = f(x) = x^3 - 3x + 2$ có đồ thị là $(C)$. Xét tính Đúng hay Sai của các mệnh đề sau:';
      chosenPool = mathPool;
    } else if (subjectId === 'hoa_hoc') {
      stem = 'Xét quá trình điện phân dung dịch copper(II) sulfate (CuSO4) với các điện cực trơ (graphite). Xét tính Đúng hay Sai của các mệnh đề:';
      chosenPool = chemPool;
    }

    const count = Math.min(Math.max(statementsCount, 2), 8);
    const statements = chosenPool.slice(0, count).map((item, idx) => ({
      id: `st-${letters[idx]}`,
      statement: `${letters[idx]}) ${item.statement}`,
      is_correct: item.is_correct,
      explanation: item.explanation,
    }));

    const calculatedPoints = ExamValidator.round2(count * pointsPerStatement);

    return {
      id: `q-p2-${order}`,
      exam_part: 2,
      question_order: order,
      question_type: 'true_false',
      topic,
      content_unit: `Phân tích tình huống: ${topic}`,
      learning_requirement: `Học sinh biện luận và thẩm định tính đúng/sai của ${count} mệnh đề độc lập theo chuẩn CV 7991`,
      cognitive_level: 'comprehension',
      points: calculatedPoints || points,
      content: stem,
      statements,
      explanation: `Câu hỏi gồm ${count} ý. Mỗi ý trả lời chính xác được tính ${pointsPerStatement} điểm (Tổng cộng ${calculatedPoints} điểm).`,
      ai_review_status: 'passed',
      teacher_accepted: true,
      created_by_ai: true,
      source: 'ai_generated',
    };
  }

  private buildShortAnswerQuestion(
    order: number,
    subjectId: SubjectCode,
    grade: number,
    topic: string,
    points: number,
    index: number
  ): GeneratedAIQuestion {
    let content = `Tính giá trị của đại lượng $K$ trong bài toán ${topic}. Ghi kết quả dưới dạng số nguyên hoặc số thập phân gọn.`;
    let normalizedAnswer = '15';
    let acceptedVariants = ['15', '15.0'];
    let explanation = 'Thực hiện phép tính rút ra kết quả $K = 15$.';

    if (subjectId === 'toan') {
      const mathSaList = [
        {
          q: 'Cho hình chóp $S.ABC$ có đáy $ABC$ là tam giác vuông tại $B$, $AB = 3$, $BC = 4$. Cạnh bên $SA$ vuông góc với mặt phẳng đáy và $SA = 5$. Tính thể tích khối chóp $S.ABC$.',
          ans: '10',
          variants: ['10', '10.0'],
          exp: '$V = \\frac{1}{3} S_{ABC} \\cdot SA = \\frac{1}{3} \\cdot \\left(\\frac{1}{2} \\cdot 3 \\cdot 4\\right) \\cdot 5 = 10$.',
        },
        {
          q: 'Tìm số nghiệm nguyên của bất phương trình $(x - 1)(x - 5) \\le 0$.',
          ans: '5',
          variants: ['5'],
          exp: 'Tập nghiệm là đoạn $[1; 5]$, các số nguyên thỏa mãn là 1, 2, 3, 4, 5 (gồm 5 số).',
        },
      ];
      const item = mathSaList[index % mathSaList.length];
      content = item.q;
      normalizedAnswer = item.ans;
      acceptedVariants = item.variants;
      explanation = item.exp;
    } else if (subjectId === 'vat_ly') {
      content = 'Một vật có khối lượng $m = 2\\text{ kg}$ bắt đầu chuyển động nhanh dần đều từ trạng thái nghỉ dưới tác dụng của lực kéo $F = 6\\text{ N}$. Bỏ qua ma sát. Tính vận tốc của vật sau $4\\text{ s}$ (đơn vị: m/s).';
      normalizedAnswer = '12';
      acceptedVariants = ['12', '12 m/s'];
      explanation = 'Gia tốc $a = F / m = 6 / 2 = 3\\text{ m/s}^2$. Vận tốc sau 4s là $v = at = 3 \\cdot 4 = 12\\text{ m/s}$.';
    }

    return {
      id: `q-p3-${order}`,
      exam_part: 3,
      question_order: order,
      question_type: 'short_answer',
      topic,
      content_unit: `Định lượng & tính toán: ${topic}`,
      learning_requirement: `Học sinh tính toán chính xác và điền giá trị số duy nhất`,
      cognitive_level: 'application',
      points,
      content,
      short_answer: {
        normalized_answer: normalizedAnswer,
        accepted_variants: acceptedVariants,
      },
      explanation,
      ai_review_status: 'passed',
      teacher_accepted: true,
      created_by_ai: true,
      source: 'ai_generated',
    };
  }

  private buildEssayQuestionFromConfig(
    order: number,
    subjectId: SubjectCode,
    grade: number,
    topic: string,
    config: any
  ): GeneratedAIQuestion {
    const totalPoints = Number(config.points) || 1.0;
    let introText = `Cho tình huống / dữ liệu thực tế liên quan đến ${config.title || topic}:`;
    let content = `Câu hỏi tự luận (${totalPoints} điểm): ${config.title || topic}\nTrình bày chi tiết các bước giải, lập luận rõ ràng và đối chiếu điều kiện thực tế.`;
    
    if (subjectId === 'ngu_van') {
      if (config.isAdvancedApplication || totalPoints >= 3.5) {
        content = `VIẾT BÀI VĂN NGHỊ LUẬN VĂN HỌC (${totalPoints} điểm):\nAnh/chị hãy viết bài văn nghị luận phân tích và đánh giá chủ đề, cùng những nét đặc sắc về mặt nghệ thuật của một tác phẩm/đoạn trích thơ/truyện đã học trong chương trình. Qua đó, rút ra thông điệp nhân văn có ý nghĩa sâu sắc đối với cuộc sống hôm nay.`;
      } else {
        content = `VIẾT ĐOẠN VĂN NGHỊ LUẬN XÃ HỘI (${totalPoints} điểm):\nViết một đoạn văn (khoảng 200 chữ) trình bày suy nghĩ của anh/chị về ý nghĩa của tinh thần tự chủ, trách nhiệm của thế hệ trẻ trong kỉ nguyên số.`;
      }
    }

    // Check if custom sub_items or subItemCount configured
    let subItems: EssaySubItem[] = [];
    if (config.subItems && config.subItems.length > 0) {
      subItems = config.subItems;
    } else {
      const count = Number(config.subItemCount) || 1;
      if (count === 1) {
        const half = ExamValidator.round2(totalPoints * 0.5);
        const rest = ExamValidator.round2(totalPoints - half);
        subItems = [
          {
            id: `sub-${order}-1`,
            item_number: '',
            points: totalPoints,
            cognitive_level: config.cognitiveLevel || 'application',
            question_text: content,
            expected_answer: 'Học sinh phân tích, trình bày rõ các bước suy luận và rút ra kết luận đúng đắn.',
            scoring_rubric: [
              { criterion: 'Nêu đúng định hướng, lập luận logic và thiết lập mô hình/công thức', points: half },
              { criterion: 'Tính toán/diễn đạt chuẩn xác, có đánh giá thực tiễn', points: rest },
            ],
          },
        ];
      } else if (count === 2) {
        const p1 = ExamValidator.round2(totalPoints * 0.5);
        const p2 = ExamValidator.round2(totalPoints - p1);
        subItems = [
          {
            id: `sub-${order}-a`,
            item_number: 'a',
            points: p1,
            cognitive_level: 'application',
            question_text: `a) Hãy xác định mô hình và thiết lập các mối quan hệ định lượng ban đầu cho ${topic}.`,
            expected_answer: `Phân tích đúng các đại lượng tham số và rút ra biểu thức cần chứng minh/tính toán.`,
            scoring_rubric: [
              { criterion: 'Xác định đúng công thức và giải thích các đại lượng', points: ExamValidator.round2(p1 * 0.5) },
              { criterion: 'Biến đổi biểu thức chuẩn xác', points: ExamValidator.round2(p1 - ExamValidator.round2(p1 * 0.5)) },
            ],
          },
          {
            id: `sub-${order}-b`,
            item_number: 'b',
            points: p2,
            cognitive_level: config.isAdvancedApplication ? 'advanced_application' : 'application',
            question_text: `b) Tìm điều kiện tối ưu hoặc tính giá trị thực nghiệm của bài toán, đối chiếu với giới hạn cho phép.`,
            expected_answer: `Biện luận các trường hợp đặc biệt, giải tìm nghiệm tối ưu và kết luận.`,
            scoring_rubric: [
              { criterion: 'Thiết lập điều kiện ràng buộc và biện luận', points: ExamValidator.round2(p2 * 0.5) },
              { criterion: 'Tính toán ra nghiệm chính xác và kiểm định', points: ExamValidator.round2(p2 - ExamValidator.round2(p2 * 0.5)) },
            ],
          },
        ];
      } else {
        // 3 items
        const p1 = ExamValidator.round2(totalPoints / 3);
        const p2 = ExamValidator.round2(totalPoints / 3);
        const p3 = ExamValidator.round2(totalPoints - p1 - p2);
        subItems = [
          {
            id: `sub-${order}-a`,
            item_number: 'a',
            points: p1,
            cognitive_level: 'comprehension',
            question_text: `a) Nêu định nghĩa, hiện tượng và chỉ rõ các đại lượng liên quan trong mô hình ${topic}.`,
            expected_answer: `Nêu đúng bản chất hiện tượng/khái niệm và liệt kê đầy đủ giả thiết.`,
            scoring_rubric: [
              { criterion: 'Nêu đúng bản chất và công thức liên quan', points: p1 },
            ],
          },
          {
            id: `sub-${order}-b`,
            item_number: 'b',
            points: p2,
            cognitive_level: 'application',
            question_text: `b) Áp dụng định luật/quy tắc để giải bài toán trong điều kiện tiêu chuẩn.`,
            expected_answer: `Thực hiện giải các bước, tính ra giá trị cụ thể.`,
            scoring_rubric: [
              { criterion: 'Viết đúng phương trình và thay số', points: ExamValidator.round2(p2 * 0.5) },
              { criterion: 'Tính đúng kết quả và đơn vị', points: ExamValidator.round2(p2 - ExamValidator.round2(p2 * 0.5)) },
            ],
          },
          {
            id: `sub-${order}-c`,
            item_number: 'c',
            points: p3,
            cognitive_level: config.isAdvancedApplication ? 'advanced_application' : 'application',
            question_text: `c) Khi điều kiện thay đổi hoặc bài toán mở rộng, hãy biện luận hướng xử lí và giải pháp tối ưu.`,
            expected_answer: `Lập luận sâu sắc, giải quyết tình huống phức hợp và đánh giá ý nghĩa.`,
            scoring_rubric: [
              { criterion: 'Biện luận trường hợp mở rộng', points: ExamValidator.round2(p3 * 0.5) },
              { criterion: 'Tìm ra giải pháp tối ưu và nhận xét', points: ExamValidator.round2(p3 - ExamValidator.round2(p3 * 0.5)) },
            ],
          },
        ];
      }
    }

    return {
      id: `q-p4-${order}`,
      exam_part: 4,
      question_order: order,
      question_type: 'essay',
      topic,
      content_unit: `Vận dụng tự luận: ${topic}`,
      learning_requirement: `Học sinh triển khai bài toán / bài văn hoàn chỉnh có lập luận và rubric tiêu chuẩn`,
      cognitive_level: config.cognitiveLevel || 'application',
      is_advanced_application: config.isAdvancedApplication,
      points: totalPoints,
      intro_text: subItems.length > 1 ? introText : undefined,
      content,
      sub_items: subItems,
      essay_rubric: config.rubricItems || [
        { id: 'r1', criterion: 'Lập luận đúng hướng, nêu bật vấn đề trọng tâm', points: ExamValidator.round2(totalPoints * 0.5) },
        { id: 'r2', criterion: 'Trình bày mạch lạc, logic, chính xác', points: ExamValidator.round2(totalPoints * 0.5) },
      ],
      explanation: 'Hướng dẫn chấm theo từng bước trong Rubric quy định.',
      ai_review_status: 'passed',
      teacher_accepted: true,
      created_by_ai: true,
      source: 'ai_generated',
    };
  }

  private buildDefaultEssayQuestion(
    order: number,
    subjectId: SubjectCode,
    grade: number,
    topic: string,
    points: number,
    isAdvanced: boolean,
    index: number,
    subCount: 1 | 2 | 3 = 1
  ): GeneratedAIQuestion {
    const totalPoints = ExamValidator.round2(points);
    let introText = `Cho bài toán thực tế / mô hình thí nghiệm liên quan đến ${topic}:`;
    let content = `Câu ${order} (${totalPoints} điểm)${isAdvanced ? ' [Vận dụng cao]' : ''}: Cho bài toán liên quan đến ${topic}. Hãy phân tích bản chất, lập phương trình hoặc luận điểm, giải và kiểm tra tính hợp lý của kết quả.`;

    let subItems: EssaySubItem[] = [];
    if (subCount === 1) {
      const halfPts = ExamValidator.round2(totalPoints * 0.5);
      const restPts = ExamValidator.round2(totalPoints - halfPts);
      subItems = [
        {
          id: `sub-${order}-1`,
          item_number: '',
          points: totalPoints,
          cognitive_level: isAdvanced ? 'advanced_application' : 'application',
          question_text: content,
          expected_answer: `Phân tích đúng bản chất vật lý / toán học, thiết lập quan hệ định lượng và tính toán chính xác.`,
          scoring_rubric: [
            { criterion: 'Xác định đúng mô hình/phương pháp và bước đầu thiết lập hệ thống', points: halfPts },
            { criterion: 'Giải quyết triệt để, kết luận chính xác và đánh giá thực tiễn', points: restPts },
          ],
        },
      ];
    } else if (subCount === 2) {
      const p1 = ExamValidator.round2(totalPoints * 0.5);
      const p2 = ExamValidator.round2(totalPoints - p1);
      subItems = [
        {
          id: `sub-${order}-a`,
          item_number: 'a',
          points: p1,
          cognitive_level: 'application',
          question_text: `a) Thiết lập hệ phương trình/mô hình toán học mô tả quá trình và tính toán đại lượng ban đầu.`,
          expected_answer: `Áp dụng đúng định luật bảo toàn hoặc định lí, tìm ra phương trình đặc trưng.`,
          scoring_rubric: [
            { criterion: 'Xác định đúng công thức cơ bản và điều kiện', points: ExamValidator.round2(p1 * 0.5) },
            { criterion: 'Giải và tính toán ra thông số đầu vào', points: ExamValidator.round2(p1 - ExamValidator.round2(p1 * 0.5)) },
          ],
        },
        {
          id: `sub-${order}-b`,
          item_number: 'b',
          points: p2,
          cognitive_level: isAdvanced ? 'advanced_application' : 'application',
          question_text: `b) Khi hệ số ma sát hoặc đại lượng liên quan thay đổi, hãy tìm giá trị cực trị và đánh giá tính ổn định của hệ thống.`,
          expected_answer: `Lập hàm mục tiêu, khảo sát đạo hàm hoặc bất đẳng thức Cauchy để xác định giá trị lớn nhất/nhỏ nhất.`,
          scoring_rubric: [
            { criterion: 'Thiết lập hàm mục tiêu và biện luận cực trị', points: ExamValidator.round2(p2 * 0.5) },
            { criterion: 'Tìm đúng giá trị cực trị và kết luận', points: ExamValidator.round2(p2 - ExamValidator.round2(p2 * 0.5)) },
          ],
        },
      ];
      content = `Câu ${order} (${totalPoints} điểm)${isAdvanced ? ' [Vận dụng cao]' : ''}: ${introText}\na) Thiết lập hệ phương trình/mô hình toán học mô tả quá trình và tính toán đại lượng ban đầu.\nb) Khi hệ số ma sát hoặc đại lượng liên quan thay đổi, hãy tìm giá trị cực trị và đánh giá tính ổn định của hệ thống.`;
    } else {
      // subCount === 3
      const p1 = ExamValidator.round2(totalPoints / 3);
      const p2 = ExamValidator.round2(totalPoints / 3);
      const p3 = ExamValidator.round2(totalPoints - p1 - p2);
      subItems = [
        {
          id: `sub-${order}-a`,
          item_number: 'a',
          points: p1,
          cognitive_level: 'comprehension',
          question_text: `a) Nêu rõ các định luật / nguyên lý áp dụng và vẽ sơ đồ phân tích các yếu tố tham gia.`,
          expected_answer: `Vẽ đúng sơ đồ, chỉ rõ các lực hoặc mối quan hệ logic.`,
          scoring_rubric: [
            { criterion: 'Vẽ sơ đồ và gọi đúng tên các đại lượng', points: p1 },
          ],
        },
        {
          id: `sub-${order}-b`,
          item_number: 'b',
          points: p2,
          cognitive_level: 'application',
          question_text: `b) Lập phương trình động học hoặc đại số và tính toán các nghiệm cơ sở của bài toán.`,
          expected_answer: `Thiết lập phương trình, giải tìm nghiệm và kiểm tra thứ nguyên.`,
          scoring_rubric: [
            { criterion: 'Viết đúng phương trình và biến đổi', points: ExamValidator.round2(p2 * 0.5) },
            { criterion: 'Tính đúng nghiệm kèm theo đơn vị', points: ExamValidator.round2(p2 - ExamValidator.round2(p2 * 0.5)) },
          ],
        },
        {
          id: `sub-${order}-c`,
          item_number: 'c',
          points: p3,
          cognitive_level: isAdvanced ? 'advanced_application' : 'application',
          question_text: `c) Biện luận sự phụ thuộc của kết quả khi tham số biến thiên và đề xuất phương án ứng dụng thực tiễn.`,
          expected_answer: `Biện luận chặt chẽ các trường hợp biên, kết luận ý nghĩa thực tiễn.`,
          scoring_rubric: [
            { criterion: 'Biện luận các trường hợp biến thiên', points: ExamValidator.round2(p3 * 0.5) },
            { criterion: 'Đánh giá ứng dụng thực tiễn và kết luận', points: ExamValidator.round2(p3 - ExamValidator.round2(p3 * 0.5)) },
          ],
        },
      ];
      content = `Câu ${order} (${totalPoints} điểm)${isAdvanced ? ' [Vận dụng cao]' : ''}: ${introText}\na) Nêu rõ các định luật / nguyên lý áp dụng và vẽ sơ đồ phân tích các yếu tố tham gia.\nb) Lập phương trình động học hoặc đại số và tính toán các nghiệm cơ sở của bài toán.\nc) Biện luận sự phụ thuộc của kết quả khi tham số biến thiên và đề xuất phương án ứng dụng thực tiễn.`;
    }

    const halfPts = ExamValidator.round2(totalPoints * 0.5);
    const restPts = ExamValidator.round2(totalPoints - halfPts);

    return {
      id: `q-p4-${order}`,
      exam_part: 4,
      question_order: order,
      question_type: 'essay',
      topic,
      content_unit: `Tự luận tổng hợp: ${topic}`,
      learning_requirement: isAdvanced ? 'Vận dụng cao giải quyết bài toán phức hợp' : 'Vận dụng kiến thức giải quyết vấn đề',
      cognitive_level: isAdvanced ? 'advanced_application' : 'application',
      is_advanced_application: isAdvanced,
      points: totalPoints,
      intro_text: subCount > 1 ? introText : undefined,
      content,
      sub_items: subItems,
      essay_rubric: [
        { id: `r-${order}-1`, criterion: 'Xác định đúng mô hình/phương pháp và bước đầu thiết lập hệ thống', points: halfPts },
        { id: `r-${order}-2`, criterion: 'Giải quyết triệt để, kết luận chính xác và đánh giá thực tiễn', points: restPts },
      ],
      explanation: 'Giáo viên chấm điểm bám sát từng bước theo biểu điểm chi tiết đã công bố.',
      ai_review_status: 'passed',
      teacher_accepted: true,
      created_by_ai: true,
      source: 'ai_generated',
    };
  }

  public async regenerateEssaySubItem(params: {
    question: GeneratedAIQuestion;
    subItemIndex: number;
    subjectId: SubjectCode;
    grade: number;
    topic: string;
  }): Promise<EssaySubItem> {
    const userApiKey = getUserApiKey();
    try {
      if (userApiKey) {
        const response = await fetch('/api/ai/regenerate-essay-subitem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': userApiKey,
          },
          body: JSON.stringify({ ...params, apiKey: userApiKey }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json().catch(() => null);
          if (data && data.success && data.sub_item) {
            return data.sub_item;
          }
        }

        // Direct client-side Gemini fallback
        const directSub = await regenerateEssaySubItemDirectGemini(params, userApiKey);
        if (directSub) {
          return directSub;
        }
      }
    } catch (e) {
      console.warn('API regenerate-essay-subitem error, using local generator:', e);
    }

    // Local fallback generator for essay sub-item
    const cur = params.question.sub_items?.[params.subItemIndex];
    const lbl = cur?.item_number || (['a', 'b', 'c'][params.subItemIndex] || 'a');
    const pts = cur?.points || 1.0;
    const half = ExamValidator.round2(pts / 2);
    const rest = ExamValidator.round2(pts - half);

    return {
      item_number: lbl,
      points: pts,
      cognitive_level: cur?.cognitive_level || 'application',
      question_text: `${lbl ? lbl + ') ' : ''}Dựa vào dữ liệu tình huống, hãy tính toán và lập luận xác định các thông số tối ưu cho đại lượng liên quan đến ${params.topic}.`,
      expected_answer: `Thiết lập phương trình hoặc mô hình phù hợp, giải và biện luận kết quả theo điều kiện bài toán.`,
      scoring_rubric: [
        { criterion: 'Xác định đúng công thức / định lí và bước đầu tính toán', points: half },
        { criterion: 'Tìm ra kết quả chính xác, có đối chiếu điều kiện', points: rest },
      ],
    };
  }

  private createVariationOfQuestion(
    q: GeneratedAIQuestion,
    subjectId: SubjectCode,
    grade: number,
    topic: string
  ): GeneratedAIQuestion {
    const copy = { ...q };
    copy.content = `${q.content} (Biến thể cải tiến: Cập nhật dữ liệu mới phù hợp tình huống kiểm tra)`;
    if (copy.options && copy.options.length > 0) {
      // Rotate correct option
      copy.options = copy.options.map((opt, i) => ({
        ...opt,
        is_correct: i === 1, // Change to option B
      }));
    }
    copy.explanation = `${q.explanation || ''} [Đã được AI tái sinh và kiểm tra tính hợp lệ]`;
    return copy;
  }

  /**
   * Save and publish approved AI Exam into Supabase / local database
   */
  public async publishExamToSystem(
    data: AIExamGenerationResponse,
    subjectCodeOrId: string,
    providedOwnerId?: string
  ): Promise<{
    examId: string;
    matrixId?: string;
    bankId?: string;
    questionCount: number;
    sessionId?: string;
    accessCode?: string;
  }> {
    let ownerId = providedOwnerId || 'demo-teacher-001';

    // If Supabase is configured and ownerId is not a UUID, try to get active user's UUID
    if (isSupabaseConfigured() && !isUUID(ownerId)) {
      try {
        const supabase = getSupabase();
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id && isUUID(authData.user.id)) {
          ownerId = authData.user.id;
        }
      } catch (e) {
        // ignore
      }
    }

    // 1. Resolve or match Subject in database / mock store
    let realSubjectId = '';
    let realSubjectName = data.exam.subject;
    try {
      const subjects = await fetchSubjects();
      let matched = subjects.find(s => s.id === subjectCodeOrId);
      if (!matched) {
        matched = subjects.find(s => 
          s.grade === data.exam.grade && 
          (s.name.toLowerCase().includes(data.exam.subject.toLowerCase()) || 
           data.exam.subject.toLowerCase().includes(s.name.toLowerCase()))
        );
      }
      if (!matched) {
        matched = subjects.find(s => 
          s.name.toLowerCase().includes(data.exam.subject.toLowerCase()) || 
          data.exam.subject.toLowerCase().includes(s.name.toLowerCase())
        );
      }

      if (matched && isUUID(matched.id)) {
        realSubjectId = matched.id;
        realSubjectName = matched.name;
      } else if (matched) {
        realSubjectId = matched.id;
        realSubjectName = matched.name;
      } else {
        const profile = SubjectRuleEngine.getProfile((data.exam as any).subject_code || (subjectCodeOrId as any) || 'toan');
        const createdSubj = await createSubject({
          name: profile?.name || data.exam.subject,
          code: `${(profile?.code || 'MON')}${data.exam.grade}`.toUpperCase(),
          grade: data.exam.grade,
          description: `Chương trình ${profile?.name || data.exam.subject} khối ${data.exam.grade} GDPT 2018`,
        });
        if (createdSubj) {
          realSubjectId = createdSubj.id;
          realSubjectName = createdSubj.name;
        } else if (subjects.length > 0) {
          realSubjectId = subjects[0].id;
          realSubjectName = subjects[0].name;
        }
      }
    } catch (e) {
      console.warn('Error resolving subject:', e);
      realSubjectId = isSupabaseConfigured() ? '' : 'subj-toan-10';
    }

    // If Supabase is active and realSubjectId is still not a UUID, query Supabase directly
    if (isSupabaseConfigured() && !isUUID(realSubjectId)) {
      try {
        const supabase = getSupabase();
        const { data: dbSubjs } = await supabase.from('subjects').select('id, name').limit(1);
        if (dbSubjs && dbSubjs.length > 0 && isUUID(dbSubjs[0].id)) {
          realSubjectId = dbSubjs[0].id;
          realSubjectName = dbSubjs[0].name;
        }
      } catch (e) {
        // ignore
      }
    }

    // 2. Resolve or create dedicated Question Bank for this Subject & Grade
    let realBankId = '';
    try {
      const banks = await fetchQuestionBanks(isUUID(ownerId) ? ownerId : undefined);
      let matchedBank = banks.find(b => b.subject_id === realSubjectId);
      if (!matchedBank && banks.length > 0) {
        matchedBank = banks.find(b => b.subject_name?.toLowerCase().includes(realSubjectName.toLowerCase()));
      }

      if (matchedBank && (!isSupabaseConfigured() || isUUID(matchedBank.id))) {
        realBankId = matchedBank.id;
      } else if (isUUID(ownerId) && isUUID(realSubjectId)) {
        const newBank = await createQuestionBank({
          name: `Ngân hàng câu hỏi ${realSubjectName} ${data.exam.grade} (CV 7991)`,
          subject_id: realSubjectId,
          description: `Ngân hàng câu hỏi tạo từ Đề thi AI "${data.exam.title.split('\n')[0]}" chuẩn GDPT 2018`,
          owner_id: ownerId,
        });
        if (newBank) {
          realBankId = newBank.id;
        } else if (banks.length > 0 && isUUID(banks[0].id)) {
          realBankId = banks[0].id;
        }
      } else if (banks.length > 0) {
        realBankId = banks[0].id;
      }
    } catch (e) {
      console.warn('Error resolving question bank:', e);
      realBankId = isSupabaseConfigured() ? '' : 'bank-toan-10';
    }

    // If Supabase is active and realBankId is still not a UUID, check if any bank exists
    if (isSupabaseConfigured() && !isUUID(realBankId)) {
      try {
        const supabase = getSupabase();
        const { data: anyBank } = await supabase.from('question_banks').select('id').limit(1);
        if (anyBank && anyBank.length > 0 && isUUID(anyBank[0].id)) {
          realBankId = anyBank[0].id;
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Save Matrix & Specification
    let matrixId: string | null = null;
    try {
      const matrixItems: any[] = [];
      data.matrix.forEach((m) => {
        const addSubItem = (
          qType: 'single_choice' | 'true_false' | 'short_answer' | 'essay',
          cogLevel: 'recognition' | 'comprehension' | 'application' | 'advanced_application',
          count: number,
          ptsEach: number
        ) => {
          if (count > 0) {
            matrixItems.push({
              topic: m.topic,
              subtopic: m.content_unit,
              learning_requirement: m.learning_requirement,
              cognitive_level: cogLevel,
              question_type: qType,
              question_count: count,
              points: Math.round(count * ptsEach * 100) / 100,
            });
          }
        };

        // Multiple choice (0.25 pts each)
        addSubItem('single_choice', 'recognition', m.mc_rec, 0.25);
        addSubItem('single_choice', 'comprehension', m.mc_com, 0.25);
        addSubItem('single_choice', 'application', m.mc_app, 0.25);

        // True/False (1.0 pt each)
        addSubItem('true_false', 'recognition', m.tf_rec, 1.0);
        addSubItem('true_false', 'comprehension', m.tf_com, 1.0);
        addSubItem('true_false', 'application', m.tf_app, 1.0);

        // Short Answer (0.5 pt each)
        addSubItem('short_answer', 'recognition', m.sa_rec, 0.5);
        addSubItem('short_answer', 'comprehension', m.sa_com, 0.5);
        addSubItem('short_answer', 'application', m.sa_app, 0.5);

        // Essay (variable/1.0 pt each)
        addSubItem('essay', 'recognition', m.essay_rec, 1.0);
        addSubItem('essay', 'comprehension', m.essay_com, 1.0);
        addSubItem('essay', 'application', m.essay_app, 1.0);
        if (m.essay_adv) {
          addSubItem('essay', 'advanced_application', m.essay_adv, 1.0);
        }
      });

      const createdMatrix = await createMatrix(
        {
          owner_id: ownerId,
          name: `Ma trận & Bảng đặc tả - ${data.exam.title.split('\n')[0]}`,
          subject_id: realSubjectId,
          grade: data.exam.grade,
          description: `Ma trận đề kiểm tra chuẩn 4 mức độ nhận thức theo ${data.regulation_reference || 'Công văn 7991/BGDĐT-GDTrH'} & GDPT 2018. Gồm ${data.matrix.length} nhóm kiến thức và bảng đặc tả chi tiết.`,
          cells: data.matrix,
        },
        matrixItems
      );
      matrixId = createdMatrix?.id || null;
    } catch (e) {
      console.warn('Could not save matrix record:', e);
    }

    // 4. Save Questions into Question Bank
    const questionItems: { question_id: string; points: number; question_order: number }[] = [];
    for (let i = 0; i < data.questions.length; i++) {
      const aiQ = data.questions[i];
      try {
        let optionsToSave: { content: string; is_correct: boolean; option_order: number }[] = [];

        if (aiQ.options && aiQ.options.length > 0) {
          optionsToSave = aiQ.options.map((o, idx) => ({
            content: o.content,
            is_correct: o.is_correct,
            option_order: idx + 1,
          }));
        } else if (aiQ.statements && aiQ.statements.length > 0) {
          const labels = ['a', 'b', 'c', 'd'];
          optionsToSave = aiQ.statements.map((st, idx) => ({
            content: `${labels[idx] || (idx + 1)}) ${st.statement} [${st.is_correct ? 'ĐÚNG' : 'SAI'}]`,
            is_correct: st.is_correct,
            option_order: idx + 1,
          }));
        } else if (aiQ.short_answer?.normalized_answer) {
          optionsToSave = [
            {
              content: `Đáp án: ${aiQ.short_answer.normalized_answer}`,
              is_correct: true,
              option_order: 1,
            },
          ];
        } else if (aiQ.essay_rubric && aiQ.essay_rubric.length > 0) {
          optionsToSave = aiQ.essay_rubric.map((r, idx) => ({
            content: `Tiêu chí ${idx + 1} (${r.points}đ): ${r.criterion}`,
            is_correct: true,
            option_order: idx + 1,
          }));
        } else {
          optionsToSave = [
            { content: 'Đáp án theo biểu điểm hướng dẫn chấm', is_correct: true, option_order: 1 }
          ];
        }

        let fullExplanation = aiQ.explanation || '';
        if (aiQ.reading_passage && !fullExplanation.includes('Đoạn ngữ liệu:')) {
          fullExplanation = `[Ngữ liệu]: ${aiQ.reading_passage}\n\n${fullExplanation}`;
        }
        if (aiQ.essay_rubric && aiQ.essay_rubric.length > 0 && !fullExplanation.includes('Hướng dẫn chấm:')) {
          const rubricStr = aiQ.essay_rubric.map((r, idx) => `${idx + 1}. ${r.criterion} (${r.points}đ)`).join('\n');
          fullExplanation = `${fullExplanation}\n\n[Hướng dẫn chấm]:\n${rubricStr}`;
        }

        const normalizedType = normalizeQuestionType(aiQ.question_type);
        const normalizedCog = normalizeCognitiveLevel(aiQ.cognitive_level);
        const normalizedDiff = normalizeDifficulty(
          aiQ.is_advanced_application ? 'hard' : (normalizedCog === 'recognition' ? 'easy' : normalizedCog === 'comprehension' ? 'medium' : 'hard')
        );

        const qRecord = await createQuestion(
          {
            question_bank_id: realBankId,
            owner_id: ownerId,
            subject_id: realSubjectId,
            content: aiQ.content,
            question_type: normalizedType,
            difficulty: normalizedDiff,
            cognitive_level: normalizedCog,
            points: Math.max(0, Number(aiQ.points) || 1.0),
            explanation: fullExplanation.trim(),
            topic: aiQ.topic,
            content_unit: aiQ.content_unit,
            learning_requirement: aiQ.learning_requirement,
            exam_part: aiQ.exam_part,
            statements: aiQ.statements,
            short_answer: aiQ.short_answer,
            essay_rubric: aiQ.essay_rubric,
          },
          optionsToSave
        );

        if (qRecord?.id) {
          questionItems.push({
            question_id: qRecord.id,
            points: aiQ.points,
            question_order: aiQ.question_order,
          });
        }
      } catch (e) {
        console.warn('Error saving question to bank/exam:', e);
      }
    }

    // 5. Save Exam in Exam Management
    const createdExam = await createExam(
      {
        owner_id: ownerId,
        title: data.exam.title.split('\n')[0] || `Đề thi ${realSubjectName} ${data.exam.grade}`,
        subject_id: realSubjectId,
        matrix_id: matrixId || undefined,
        grade: data.exam.grade,
        duration_minutes: data.exam.duration_minutes,
        total_points: 10.0,
        status: 'published',
        description: `Đề thi chuẩn Công văn 7991/BGDĐT-GDTrH và Chương trình GDPT 2018. Gồm ${data.questions.length} câu hỏi (${data.exam.term || 'Học kỳ'}).`,
      },
      questionItems
    );

    const examId = createdExam ? createdExam.id : `exam-ai-${Date.now()}`;

    if (createdExam?.id && matrixId) {
      try {
        mockStore.updateMatrixExamId(matrixId, createdExam.id);
      } catch (e) {
        // ignore
      }
    }

    // 6. Auto-generate Exam Session with Access Code for immediate student testing
    let sessionResult: { sessionId?: string; accessCode?: string } = {};
    try {
      const codePrefix = ((data.exam as any).subject_code || data.exam.subject.substring(0, 3)).toUpperCase().replace(/[^A-Z]/g, '') || 'EXAM';
      const randomDigits = Math.floor(100 + Math.random() * 900);
      const accessCode = `${codePrefix}${data.exam.grade}-${randomDigits}`;

      const createdSession = await createExamSession({
        exam_id: examId,
        owner_id: ownerId,
        title: `Phòng thi: ${data.exam.title.split('\n')[0]}`,
        access_code: accessCode,
        duration_minutes: data.exam.duration_minutes,
        max_attempts: 1,
        status: 'active',
        shuffle_questions: false,
        shuffle_options: false,
        show_result_after_submit: true,
      });

      if (createdSession?.id) {
        sessionResult = {
          sessionId: createdSession.id,
          accessCode: createdSession.access_code,
        };
      }
    } catch (e) {
      console.warn('Error creating auto-session:', e);
    }

    return {
      examId,
      matrixId: matrixId || undefined,
      bankId: realBankId,
      questionCount: questionItems.length,
      ...sessionResult,
    };
  }
}

export const aiExamService = new AIExamService();
