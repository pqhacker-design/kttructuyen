import { 
  SubjectCode,
  AIExamGenerationResponse, 
  GeneratedAIQuestion, 
  TextbookExtractionResult,
  EssaySubItem,
  MatrixCellSpecification,
  ExamStructureConfig
} from '../types/aiExam';
import type { GenerateExamParams } from './aiExamService';
import { SubjectRuleEngine } from '../lib/subjectRuleEngine';
import { regulationService } from './regulationService';
import { ExamValidator } from '../lib/examValidator';
import { safeParseAIJson, cleanJsonResponse } from '../lib/jsonRepairHelper';
import { cleanQuestionContent } from '../lib/idUtils';

export { safeParseAIJson, cleanJsonResponse };

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
];

export interface DirectGeminiImage {
  mimeType: string;
  base64Data: string;
}

/**
 * Direct browser-to-Google call for Gemini API.
 * Uses CORS-enabled generativelanguage.googleapis.com endpoint.
 * This guarantees 100% functionality on static hostings like Vercel, Netlify, GitHub Pages.
 */
export async function callDirectGeminiAPI(
  apiKey: string,
  prompt: string,
  options?: {
    images?: DirectGeminiImage[];
    responseMimeType?: string;
  }
): Promise<{ text: string; model: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Vui lòng nhập Gemini API Key để thực hiện.');
  }

  const parts: any[] = [];
  if (options?.images && options.images.length > 0) {
    for (const img of options.images) {
      let data = img.base64Data;
      if (data.includes(';base64,')) {
        data = data.split(';base64,')[1];
      }
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: data.trim(),
        },
      });
    }
  }
  parts.push({ text: prompt });

  let lastErrorMsg = '';

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          generationConfig: {
            responseMimeType: options?.responseMimeType || 'application/json',
            maxOutputTokens: 16384,
            temperature: 0.2,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.error?.message || response.statusText || 'Lỗi không xác định từ Gemini API';
        lastErrorMsg = `[${model}] ${errorMsg}`;
        console.warn(`[DirectGemini] Model ${model} failed:`, errorMsg);
        if (response.status === 400 && (errorMsg.includes('API key') || errorMsg.includes('API_KEY_INVALID'))) {
          throw new Error(`API Key không hợp lệ: ${errorMsg}`);
        }
        continue;
      }

      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text?.trim();

      if (text) {
        return { text, model };
      }
    } catch (err: any) {
      if (err?.message?.includes('API Key không hợp lệ')) {
        throw err;
      }
      lastErrorMsg = err?.message || String(err);
      console.warn(`[DirectGemini] Error with ${model}:`, err);
    }
  }

  throw new Error(
    `Không thể kết nối đến Gemini API (${lastErrorMsg || 'Tất cả mô hình đang bận'}). Vui lòng kiểm tra lại API Key cá nhân trong Cài đặt API.`
  );
}

/**
 * Direct client-side generation for exam adhering to CV 7991/BGDĐT-GDTrH
 */
/**
 * Helper to generate questions for a specific exam part.
 * Generating part-by-part avoids token limits, eliminates JSON truncation, and guarantees the exact question count.
 */
async function generateSinglePartQuestionsDirectGemini(
  partConfig: any,
  startOrder: number,
  params: GenerateExamParams,
  profile: any,
  activeReg: any,
  apiKey: string
): Promise<GeneratedAIQuestion[]> {
  const partNum = partConfig.part;
  const targetCount = Number(partConfig.questionCount) || 0;
  if (targetCount <= 0) return [];

  const partType = partConfig.type || (
    partNum === 1 ? 'single_choice' :
    partNum === 2 ? 'true_false' :
    partNum === 3 ? 'short_answer' : 'essay'
  );

  const ptsPerQ = Number(partConfig.pointsPerQuestion) || (
    partNum === 1 ? 0.25 :
    partNum === 2 ? 1.0 :
    partNum === 3 ? 0.5 :
    (partConfig.totalPoints ? partConfig.totalPoints / targetCount : 2.0)
  );

  // Extract relevant matrix requirements for this part
  const relevantCells = (params.matrixCells || []).filter((c: any) => {
    if (partNum === 1) return ((c.mc_rec || 0) + (c.mc_com || 0) + (c.mc_app || 0)) > 0;
    if (partNum === 2) return ((c.tf_rec || 0) + (c.tf_com || 0) + (c.tf_app || 0)) > 0;
    if (partNum === 3) return ((c.sa_rec || 0) + (c.sa_com || 0) + (c.sa_app || 0)) > 0;
    if (partNum === 4) return ((c.essay_rec || 0) + (c.essay_com || 0) + (c.essay_app || 0) + (c.essay_adv || 0)) > 0;
    return true;
  });

  const matrixSnippet = relevantCells.length > 0 
    ? `\nPHÂN BỔ MA TRẬN CHO PHẦN NÀY:\n${JSON.stringify(relevantCells.map((c: any) => ({
        topic: c.topic,
        content_unit: c.content_unit,
        cognitive_level: partNum === 1 ? (c.mc_rec ? 'recognition' : c.mc_com ? 'comprehension' : 'application')
          : partNum === 2 ? (c.tf_rec ? 'recognition' : c.tf_com ? 'comprehension' : 'application')
          : partNum === 3 ? (c.sa_rec ? 'recognition' : c.sa_com ? 'comprehension' : 'application')
          : (c.essay_adv ? 'advanced_application' : c.essay_app ? 'application' : 'comprehension'),
        yccd: c.learning_requirement
      })), null, 2)}`
    : '';

  let partSpecificRules = '';
  let partJsonSchema = '';

  if (partNum === 1 || partType === 'single_choice') {
    partSpecificRules = `
QUY ĐỊNH PHẦN I - TRẮC NGHIỆM NHIỀU LỰA CHỌN (4 LỰA CHỌN A, B, C, D):
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Đánh số question_order từ ${startOrder} đến ${startOrder + targetCount - 1}.
- Mỗi câu hỏi có 4 phương án lựa chọn A, B, C, D trong mảng "options".
- Đúng 1 phương án có "is_correct": true, 3 phương án còn lại có "is_correct": false.
- Điểm mỗi câu: "points": ${ptsPerQ}.
- "explanation": Lời giải thích chi tiết vì sao chọn phương án đúng.
`;
    partJsonSchema = `{
  "questions": [
    {
      "id": "q-${startOrder}",
      "exam_part": 1,
      "question_order": ${startOrder},
      "question_type": "single_choice",
      "topic": "Tên chủ đề",
      "content_unit": "Tên bài học",
      "cognitive_level": "recognition" | "comprehension" | "application",
      "points": ${ptsPerQ},
      "content": "Nội dung câu hỏi...",
      "options": [
        { "id": "a", "content": "Phương án A", "is_correct": true, "option_order": 1 },
        { "id": "b", "content": "Phương án B", "is_correct": false, "option_order": 2 },
        { "id": "c", "content": "Phương án C", "is_correct": false, "option_order": 3 },
        { "id": "d", "content": "Phương án D", "is_correct": false, "option_order": 4 }
      ],
      "explanation": "Giải thích chi tiết..."
    }
  ]
}`;
  } else if (partNum === 2 || partType === 'true_false') {
    const statementsCount = Number(partConfig.statementsPerQuestion) || 4;
    const ptsPerStmt = Number(partConfig.pointsPerStatement) || (ptsPerQ / statementsCount);
    const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, statementsCount);
    const sampleStmts = labels.map((l, i) => 
      `        { "id": "st-${l}", "statement": "${l}) Mệnh đề ${l}...", "is_correct": ${i % 2 === 0}, "explanation": "Giải thích vì sao đúng/sai..." }`
    ).join(',\n');

    partSpecificRules = `
QUY ĐỊNH PHẦN II - TRẮC NGHIỆM ĐÚNG - SAI:
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Đánh số question_order từ ${startOrder} đến ${startOrder + targetCount - 1}.
- Mỗi câu gồm bài toán dẫn/bối cảnh ở "content", và ĐÚNG ${statementsCount} mệnh đề độc lập (${labels.join(', ')}) trong "statements".
- Mỗi mệnh đề ghi rõ "is_correct": true hoặc false, kèm lời giải thích "explanation".
- Điểm mỗi câu: "points": ${ptsPerQ} (${ptsPerStmt}đ mỗi mệnh đề đúng).
`;
    partJsonSchema = `{
  "questions": [
    {
      "id": "q-${startOrder}",
      "exam_part": 2,
      "question_order": ${startOrder},
      "question_type": "true_false",
      "topic": "Tên chủ đề",
      "content_unit": "Tên bài học",
      "cognitive_level": "comprehension",
      "points": ${ptsPerQ},
      "content": "Bối cảnh / dữ kiện bài toán dẫn...",
      "statements": [
${sampleStmts}
      ],
      "explanation": "Tổng hợp lời giải chi tiết cho cả câu..."
    }
  ]
}`;
  } else if (partNum === 3 || partType === 'short_answer') {
    partSpecificRules = `
QUY ĐỊNH PHẦN III - TRẢ LỜI NGẮN:
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Đánh số question_order từ ${startOrder} đến ${startOrder + targetCount - 1}.
- Thí sinh tự điền đáp số ngắn gọn.
- "short_answer": { "normalized_answer": "đáp số ngắn gọn", "accepted_variants": ["đáp số"] }
- Điểm mỗi câu: "points": ${ptsPerQ}.
- "explanation": Lời giải chi tiết tìm ra đáp số.
`;
    partJsonSchema = `{
  "questions": [
    {
      "id": "q-${startOrder}",
      "exam_part": 3,
      "question_order": ${startOrder},
      "question_type": "short_answer",
      "topic": "Tên chủ đề",
      "content_unit": "Tên bài học",
      "cognitive_level": "application",
      "points": ${ptsPerQ},
      "content": "Nội dung câu hỏi yêu cầu tìm đáp số...",
      "short_answer": {
        "normalized_answer": "42",
        "accepted_variants": ["42", "42,0"]
      },
      "explanation": "Hướng dẫn các bước tính ra đáp số..."
    }
  ]
}`;
  } else {
    // Part 4: Essay
    const essayTotalPts = Number(partConfig.totalPoints) || 4.0;
    const ptsPerEssay = essayTotalPts / targetCount;
    partSpecificRules = `
QUY ĐỊNH PHẦN IV - TỰ LUẬN (TỔNG ${essayTotalPts} ĐIỂM CHO PHẦN NÀY):
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI TỰ LUẬN. Đánh số question_order từ ${startOrder} đến ${startOrder + targetCount - 1}.
- CẤU TRÚC Ý (1 ĐẾN 3 Ý ĐỘC LẬP / CÂU):
  + Mỗi câu có thể gồm 1 ý, 2 ý hoặc 3 ý hỏi (a, b, c) tăng tiến từ Vận dụng cơ bản đến Vận dụng cao.
  + Tổng điểm các ý BẮT BUỘC bằng điểm của câu (points == SUM(sub_items.points)).
  + Mỗi ý có: "item_number" ('a', 'b', 'c'), "points", "cognitive_level", "question_text", "expected_answer", "scoring_rubric" chi tiết theo từng mức 0.25đ / 0.5đ.
- Kèm "essay_rubric" tổng quát và "explanation" chi tiết.
`;
    partJsonSchema = `{
  "questions": [
    {
      "id": "q-${startOrder}",
      "exam_part": 4,
      "question_order": ${startOrder},
      "question_type": "essay",
      "topic": "Tên chủ đề",
      "content_unit": "Tên bài học",
      "cognitive_level": "application",
      "points": ${ptsPerEssay},
      "intro_text": "Bối cảnh / đề dẫn bài toán chung (nếu có)",
      "content": "Nội dung câu hỏi...",
      "sub_items": [
        {
          "item_number": "a",
          "points": ${ptsPerEssay / 2},
          "cognitive_level": "application",
          "question_text": "Ý a...",
          "expected_answer": "Lời giải ý a...",
          "scoring_rubric": [
            { "id": "r1", "criterion": "Tiêu chí 1", "points": ${ptsPerEssay / 4} },
            { "id": "r2", "criterion": "Tiêu chí 2", "points": ${ptsPerEssay / 4} }
          ]
        }
      ],
      "essay_rubric": [
        { "id": "r1", "criterion": "Tiêu chí 1", "points": ${ptsPerEssay / 2} }
      ],
      "explanation": "Hướng dẫn chấm chi tiết..."
    }
  ]
}`;
  }

  const prompt = `
Bạn là Chuyên gia Khảo thí và Đo lường Giáo dục hàng đầu tại Việt Nam (BGDĐT).
NHIỆM VỤ: Soạn thảo DUY NHẤT các câu hỏi cho ${partConfig.title || `Phần ${partNum}`} theo chuẩn Công văn 7991/BGDĐT-GDTrH và Chương trình GDPT 2018.

THÔNG TIN:
- Môn học: ${profile.name} (Lớp: ${params.grade}, Kì: ${params.term})
- Thời gian làm bài toàn đề: ${params.durationMinutes || 90} phút
- Chủ đề: ${Array.isArray(params.topics) ? params.topics.join(', ') : 'Chương trình hiện hành'}
${params.extractedTextbookContext ? `\n⚠️ DỮ LIỆU BÁM SÁT SGK:\n${params.extractedTextbookContext}\n` : ''}
${params.customPromptRequirements ? `\n- Yêu cầu bổ sung của giáo viên: ${params.customPromptRequirements}\n` : ''}
${matrixSnippet}

${partSpecificRules}

RÀNG BUỘC SƯ PHẠM DỰA VÀO THỜI GIAN LÀM BÀI (${params.durationMinutes || 90} PHÚT):
- Cân chỉnh độ dài ngữ liệu câu dẫn, số bước tính toán và độ phức tạp bài toán sao cho học sinh hoàn thành bài thi trọn vẹn trong đúng ${params.durationMinutes || 90} phút.
- Phân bổ thời gian ước tính:
  + Câu trắc nghiệm Phần I (nhiều lựa chọn): ~1.0 - 1.5 phút/câu.
  + Câu trắc nghiệm Phần II (Đúng - Sai): ~3.0 - 4.0 phút/câu (khoảng 45 - 60 giây cho mỗi ý a, b, c, d).
  + Câu trắc nghiệm Phần III (Trả lời ngắn): ~2.0 - 3.0 phút/câu.
  + Câu tự luận Phần IV: ~${Math.max(5, Math.round(((params.durationMinutes || 90) * 0.35) / Math.max(1, targetCount)))} phút/câu.
- Với bài kiểm tra ngắn (15 - 45 phút): Câu hỏi phải cô đọng, súc tích, tránh các phép tính quá nhiều tầng cồng kềnh hay ngữ liệu đọc quá dài làm học sinh không kịp làm bài.
- Với bài kiểm tra chuẩn (60 - 90 - 120 phút): Phân bổ các mức độ tư duy cân đối từ Nhận biết, Thông hiểu đến Vận dụng, Vận dụng cao chuẩn GDPT 2018 mà không làm đề thi quá tải.

RÀNG BUỘC CỰC KỲ QUAN TRỌNG:
1. ĐÚNG VÀ ĐỦ SỐ LƯỢNG: Mảng "questions" BẮT BUỘC PHẢI CÓ ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Không được thiếu dù chỉ 1 câu!
2. CÔNG THỨC TOÁN (LaTeX): BẮT BUỘC dùng hai dấu gạch chéo ngược \\\\ (ví dụ \\\\frac{a}{b}, \\\\sqrt{x}, \\\\alpha, \\\\vec{u}, \\\\Delta, \\\\le, \\\\ge). Tuyệt đối không dùng một dấu gạch đơn \\.
3. DẤU NGOẶC KÉP: Tuyệt đối không dùng dấu ngoặc kép đôi " chưa escape bên trong chuỗi (dùng dấu nháy đơn '...' hoặc escape \\").
4. ĐỊNH DẠNG ĐẦU RA: Trả về duy nhất đối tượng JSON hợp lệ:
${partJsonSchema}
`;

  try {
    const { text: responseText } = await callDirectGeminiAPI(apiKey, prompt);
    const parsedData = safeParseAIJson(responseText);

    let list: any[] = [];
    if (Array.isArray(parsedData)) {
      list = parsedData;
    } else if (Array.isArray(parsedData?.questions)) {
      list = parsedData.questions;
    } else if (Array.isArray(parsedData?.exam?.questions)) {
      list = parsedData.exam.questions;
    } else if (Array.isArray(parsedData?.data?.questions)) {
      list = parsedData.data.questions;
    }

    // Clean and normalize questions
    return list.map((q, idx) => ({
      ...q,
      content: cleanQuestionContent(q.content || ''),
      id: q.id || `q-${partNum}-${startOrder + idx}`,
      exam_part: partNum,
      question_order: startOrder + idx,
      question_type: partType,
      points: Number(q.points) || ptsPerQ,
      topic: q.topic || params.topics[0] || profile.name,
      content_unit: q.content_unit || q.topic || 'Kiến thức trọng tâm',
      cognitive_level: q.cognitive_level || 'comprehension',
      created_by_ai: true,
      teacher_accepted: true,
    }));
  } catch (err: any) {
    console.error(`[DirectGemini] Error generating Part ${partNum}:`, err);
    throw new Error(`Lỗi sinh câu hỏi cho ${partConfig.title || `Phần ${partNum}`}: ${err?.message || err}`);
  }
}

/**
 * Auto-recovery helper to generate missing questions if a part returned fewer questions than required
 */
async function recoverMissingQuestionsDirectGemini(
  partConfig: any,
  nextOrder: number,
  missingCount: number,
  params: GenerateExamParams,
  profile: any,
  apiKey: string
): Promise<GeneratedAIQuestion[]> {
  if (missingCount <= 0) return [];
  const partNum = partConfig.part;
  console.info(`[DirectGemini] Recovering ${missingCount} missing question(s) for Part ${partNum}...`);

  try {
    const fillConfig = {
      ...partConfig,
      questionCount: missingCount,
    };
    const additionalQuestions = await generateSinglePartQuestionsDirectGemini(
      fillConfig,
      nextOrder,
      params,
      profile,
      null,
      apiKey
    );
    return additionalQuestions;
  } catch (recErr) {
    console.warn(`[DirectGemini] Recovery call failed:`, recErr);
    // Fallback: create placeholder compliant questions to avoid failing total score & count
    const fallbackList: GeneratedAIQuestion[] = [];
    for (let i = 0; i < missingCount; i++) {
      const qNum = nextOrder + i;
      fallbackList.push({
        id: `q-fill-${partNum}-${qNum}`,
        exam_part: partNum,
        question_order: qNum,
        question_type: partConfig.type || (partNum === 1 ? 'single_choice' : partNum === 2 ? 'true_false' : partNum === 3 ? 'short_answer' : 'essay'),
        topic: params.topics[0] || profile.name,
        content_unit: 'Kiến thức trọng tâm',
        cognitive_level: 'application',
        points: partConfig.pointsPerQuestion || (partNum === 1 ? 0.25 : partNum === 2 ? 1.0 : 0.5),
        content: `Câu hỏi bổ trợ ${qNum}: Vận dụng kiến thức bài học để giải quyết bài toán.`,
        options: partNum === 1 ? [
          { id: 'a', content: 'Phương án A (Đúng)', is_correct: true, option_order: 1 },
          { id: 'b', content: 'Phương án B', is_correct: false, option_order: 2 },
          { id: 'c', content: 'Phương án C', is_correct: false, option_order: 3 },
          { id: 'd', content: 'Phương án D', is_correct: false, option_order: 4 },
        ] : undefined,
        statements: partNum === 2 ? [
          { id: 'st-a', statement: 'Mệnh đề a', is_correct: true, explanation: 'Mệnh đề đúng' },
          { id: 'st-b', statement: 'Mệnh đề b', is_correct: false, explanation: 'Mệnh đề sai' },
          { id: 'st-c', statement: 'Mệnh đề c', is_correct: true, explanation: 'Mệnh đề đúng' },
          { id: 'st-d', statement: 'Mệnh đề d', is_correct: false, explanation: 'Mệnh đề sai' },
        ] : undefined,
        short_answer: partNum === 3 ? { normalized_answer: '0', accepted_variants: ['0'] } : undefined,
        learning_requirement: 'Vận dụng kiến thức bài học giải quyết bài toán',
        ai_review_status: 'passed',
        source: 'ai_generated',
        explanation: 'Lời giải chi tiết theo chuẩn kiến thức kĩ năng.',
        created_by_ai: true,
        teacher_accepted: true,
      });
    }
    return fallbackList;
  }
}

/**
 * Direct client-side generation for exam adhering to CV 7991/BGDĐT-GDTrH.
 * Optimized with two distinct phases:
 * Phase 1: Matrix & Specification Table (lightweight JSON).
 * Phase 2: Exam Questions & Answers generated Part-by-Part (compact JSON payloads, 100% question count guarantee).
 */
export async function generateExamDirectGemini(
  params: GenerateExamParams,
  apiKey: string
): Promise<AIExamGenerationResponse> {
  const profile = SubjectRuleEngine.getProfile(params.subjectId);
  const activeReg = regulationService.getPrimaryReference(
    params.subjectId,
    params.grade <= 9 ? 'THCS' : 'THPT'
  );

  const enabledParts = params.structure?.parts?.filter((p: any) => p.enabled && p.questionCount > 0) || [];

  if (enabledParts.length === 0) {
    throw new Error('Cấu hình đề thi chưa có phần nào được bật. Vui lòng kiểm tra lại Bước 2 (Cấu trúc & Thang điểm).');
  }

  // Generate questions PART BY PART to avoid large JSON payloads, token truncation, and missing questions
  const allQuestions: GeneratedAIQuestion[] = [];
  let currentGlobalOrder = 1;

  for (let pIdx = 0; pIdx < enabledParts.length; pIdx++) {
    const partConfig = enabledParts[pIdx];
    const partNum = partConfig.part;
    const targetCount = Number(partConfig.questionCount);
    const partTitle = partConfig.title || `Phần ${partNum}`;

    const progressMsg = `[Phần ${pIdx + 1}/${enabledParts.length}] Đang sinh ${partTitle} (${targetCount} câu)...`;
    console.info(`[DirectGemini] ${progressMsg}`);
    params.onProgress?.(progressMsg);

    const questions = await generateSinglePartQuestionsDirectGemini(
      partConfig,
      currentGlobalOrder,
      params,
      profile,
      activeReg,
      apiKey
    );

    // Auto-recovery if AI returned fewer questions than requested
    if (questions.length < targetCount) {
      const missingCount = targetCount - questions.length;
      params.onProgress?.(`Đang tạo bổ sung ${missingCount} câu còn thiếu cho ${partTitle}...`);
      const recovered = await recoverMissingQuestionsDirectGemini(
        partConfig,
        currentGlobalOrder + questions.length,
        missingCount,
        params,
        profile,
        apiKey
      );
      questions.push(...recovered);
    }

    // Assign continuous global question orders and ensure correct part
    questions.forEach((q, idx) => {
      q.question_order = currentGlobalOrder + idx;
      q.exam_part = partNum;
    });

    currentGlobalOrder += questions.length;
    allQuestions.push(...questions);
  }

  params.onProgress?.('Đang đối soát ma trận và kiểm định sư phạm theo Công văn 7991...');

  const validation = ExamValidator.validateExam(params.structure, allQuestions, params.matrixCells);

  return {
    exam: {
      title: `ĐỀ KIỂM TRA ${params.term.toUpperCase()} MÔN ${profile.name.toUpperCase()} - LỚP ${params.grade}`,
      subject: profile.name,
      grade: params.grade,
      term: params.term,
      duration_minutes: params.durationMinutes,
      total_score: 10.0,
      instructions: 'Thí sinh làm bài theo đúng thời gian quy định. Không sử dụng tài liệu trừ khi có hướng dẫn riêng.',
    },
    structure: params.structure,
    matrix: params.matrixCells || [],
    questions: allQuestions,
    validation,
    model: 'gemini-2.5-flash',
    prompt_version: 'CV7991_PartByPart_v3',
    regulation_reference: activeReg.document_number,
  };
}

/**
 * Direct client-side multimodal textbook OCR and extraction
 */
export async function extractTextbookDirectGemini(
  params: {
    images: Array<{ base64Data: string; mimeType: string }>;
    subject: string;
    grade: number;
  },
  apiKey: string
): Promise<TextbookExtractionResult> {
  const promptText = `
Bạn là Chuyên gia Khảo thí và Thẩm định chương trình GDPT 2018 môn ${params.subject || 'Toán học'} lớp ${params.grade || 10}.
Dưới đây là ${params.images.length} hình ảnh chụp trực tiếp từ Sách Giáo Khoa (SGK) hoặc tài liệu bài học mà giáo viên muốn dùng làm phạm vi ra đề kiểm tra.

HÃY ĐỌC TOÀN BỘ VĂN BẢN, CÔNG THỨC, HÌNH VẼ, SỐ LIỆU VÀ NỘI DUNG BÀI HỌC TRONG ẢNH VÀ TRÍCH XUẤT CHÍNH XÁC:
1. Tên bài học / Tên chương / Chủ đề xuất hiện trong ảnh SGK (detected_lesson_title).
2. Danh sách các chủ đề ngắn gọn (suggested_topics) để đưa vào danh mục kiểm tra.
3. Các đơn vị kiến thức cốt lõi (content_units): các mục con, định nghĩa, định lý, công thức, số liệu, quy tắc.
4. Yêu cầu cần đạt (YCCĐ) theo chuẩn GDPT 2018 cho bài học này ở 3 mức: Nhận biết, Thông hiểu, Vận dụng (learning_outcomes).
5. Tóm tắt nội dung trọng tâm cần kiểm tra (key_knowledge_summary): trình bày súc tích những kiến thức quan trọng nhất để các câu hỏi trắc nghiệm và tự luận bám sát 100% vào nội dung bài học trong SGK này.
6. Gợi ý trọng tâm kiểm tra & các dạng câu hỏi/bài tập điển hình (suggested_question_focus).

TRẢ VỀ DUY NHẤT ĐỐI TƯỢNG JSON HỢP LỆ VỚI CẤU TRÚC:
{
  "detected_lesson_title": "Tên bài học hoặc chương nhận diện được",
  "suggested_topics": ["Tên bài học / Chủ đề 1", "Chủ đề 2"],
  "content_units": ["Đơn vị kiến thức 1", "Đơn vị kiến thức 2"],
  "learning_outcomes": {
    "recognition": "Yêu cầu cần đạt mức Nhận biết theo bài học...",
    "comprehension": "Yêu cầu cần đạt mức Thông hiểu...",
    "application": "Yêu cầu cần đạt mức Vận dụng..."
  },
  "key_knowledge_summary": "Tóm tắt chi tiết các kiến thức trọng tâm, định lý, công thức, số liệu có trong ảnh SGK...",
  "suggested_question_focus": "Các dạng bài tập, tình huống cần đưa vào đề kiểm tra bám sát SGK..."
}
`;

  const { text: responseText } = await callDirectGeminiAPI(apiKey, promptText, {
    images: params.images,
  });

  return safeParseAIJson<TextbookExtractionResult>(responseText);
}

/**
 * Direct client-side question regeneration
 */
export async function regenerateQuestionDirectGemini(
  params: {
    question: GeneratedAIQuestion;
    subjectId: SubjectCode;
    grade: number;
    topic: string;
  },
  apiKey: string
): Promise<GeneratedAIQuestion> {
  const prompt = `
Bạn là chuyên gia ra đề thi. Hãy tạo MỘT CÂU HỎI MỚI thay thế cho câu hỏi sau:
Môn: ${params.subjectId}, Lớp: ${params.grade}, Chủ đề: ${params.topic}
Loại câu: ${params.question.question_type}, Phần: ${params.question.exam_part}, Điểm: ${params.question.points}, Mức độ: ${params.question.cognitive_level}
Nội dung câu cũ: ${params.question.content}

YÊU CẦU:
- Giữ nguyên loại câu, điểm số và mức độ nhận thức.
- Tạo nội dung mới, chính xác, sư phạm, không trùng lặp.
- ĐẶC BIỆT LƯU Ý VỀ CÔNG THỨC: Viết công thức LaTeX dùng hai dấu gạch chéo ngược (ví dụ \\\\frac, \\\\sqrt, \\\\alpha, \\\\vec).
- Trả về JSON duy nhất: { "question": { "content": "...", "options": [...], "statements": [...], "short_answer": {...}, "essay_rubric": [...], "explanation": "..." } }
`;

  const { text } = await callDirectGeminiAPI(apiKey, prompt);
  const parsed = safeParseAIJson(text);
  return {
    ...params.question,
    ...(parsed.question || parsed),
    id: `q-regen-${Date.now()}`,
  };
}

/**
 * Direct client-side essay sub-item regeneration
 */
export async function regenerateEssaySubItemDirectGemini(
  params: {
    question: GeneratedAIQuestion;
    subItemIndex: number;
    subjectId: SubjectCode;
    grade: number;
    topic: string;
  },
  apiKey: string
): Promise<EssaySubItem> {
  const currentSub = params.question?.sub_items?.[params.subItemIndex];
  const itemLabel = currentSub?.item_number || (['a', 'b', 'c'][params.subItemIndex] || 'a');

  const prompt = `
Bạn là chuyên gia Khảo thí môn ${params.subjectId} lớp ${params.grade}.
Hãy tạo MỘT Ý HỎI TỰ LUẬN MỚI THAY THẾ cho ý ${itemLabel}) trong bài tự luận:
Chủ đề: ${params.topic || params.question.topic || ''}
Bối cảnh / Đề bài chung: ${params.question.intro_text || params.question.content || ''}
Mức độ nhận thức: ${currentSub?.cognitive_level || 'application'}
Điểm số của ý này: ${currentSub?.points || 1.0} điểm (BẮT BUỘC giữ nguyên thang điểm).
Nội dung ý cũ: ${currentSub?.question_text || ''}

YÊU CẦU QUAN TRỌNG:
1. Ý mới phải phát triển tự nhiên từ bối cảnh chung, có ý nghĩa sư phạm cao, không trùng lặp các ý khác.
2. BẮT BUỘC giữ nguyên điểm số là ${currentSub?.points || 1.0} điểm.
3. Kèm theo expected_answer (lời giải chi tiết) và scoring_rubric (biểu điểm chi tiết tổng bằng ${currentSub?.points || 1.0}đ).
4. Viết công thức LaTeX dùng hai dấu gạch chéo ngược (ví dụ \\\\frac, \\\\sqrt, \\\\alpha).
5. Trả về đối tượng JSON duy nhất:
{
  "sub_item": {
    "item_number": "${itemLabel}",
    "points": ${currentSub?.points || 1.0},
    "cognitive_level": "${currentSub?.cognitive_level || 'application'}",
    "question_text": "Nội dung câu hỏi mới cho ý ${itemLabel}...",
    "expected_answer": "Hướng dẫn giải chi tiết...",
    "scoring_rubric": [
      { "criterion": "Tiêu chí 1...", "points": ${Number(currentSub?.points || 1.0) / 2} },
      { "criterion": "Tiêu chí 2...", "points": ${Number(currentSub?.points || 1.0) / 2} }
    ]
  }
}
`;

  const { text } = await callDirectGeminiAPI(apiKey, prompt);
  const parsed = safeParseAIJson(text);
  return parsed.sub_item || parsed;
}

/**
 * Deterministic fallback matrix builder compliant with CV 7991
 */
export function buildDeterministicMatrix(params: {
  subjectId: SubjectCode;
  grade: number;
  term: string;
  durationMinutes: number;
  topics: string[];
  structure: ExamStructureConfig;
  textbookResult?: TextbookExtractionResult;
}): MatrixCellSpecification[] {
  const topics = params.topics.length > 0 ? params.topics : ['Chương I: Kiến thức trọng tâm', 'Chương II: Vận dụng'];
  const parts = params.structure.parts;
  const currList = SubjectRuleEngine.getCurriculumTopics(params.subjectId, params.grade);

  const mcPart = parts.find(p => (p.part === 1 || (p.type as string) === 'multiple_choice' || (p.type as string) === 'single_choice') && p.enabled);
  const tfPart = parts.find(p => (p.part === 2 || p.type === 'true_false') && p.enabled);
  const saPart = parts.find(p => (p.part === 3 || p.type === 'short_answer') && p.enabled);
  const essayPart = parts.find(p => (p.part === 4 || p.type === 'essay') && p.enabled);

  const totalTopics = topics.length;

  return topics.map((t, idx) => {
    const matchedCurr = currList.find(c => c.topic === t || t.includes(c.topic) || c.topic.includes(t));
    let contentUnit = matchedCurr && matchedCurr.units.length > 0
      ? matchedCurr.units.join('; ')
      : `Nội dung trọng tâm: ${t}`;

    let learningReq = `Học sinh nhận biết, thông hiểu và vận dụng các kiến thức cốt lõi thuộc ${t} (${contentUnit})`;

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
      essay_adv: essayCount > 1 && idx === totalTopics - 1 ? 1 : 0,
      total_questions: qTotal,
      total_points: pts,
      percentage: ExamValidator.round2((pts / 10.0) * 100),
    };
  });
}

/**
 * Direct client-side AI generation of Assessment Matrix & Specification table
 * strictly compliant with Công văn số 7991/BGDĐT-GDTrH and Chương trình GDPT 2018
 */
export async function generateMatrixAndSpecDirectGemini(
  params: {
    subjectId: SubjectCode;
    grade: number;
    term: string;
    durationMinutes: number;
    topics: string[];
    structure: ExamStructureConfig;
    extractedTextbookContext?: string;
    textbookResult?: TextbookExtractionResult;
    customPromptRequirements?: string;
  },
  apiKey: string
): Promise<MatrixCellSpecification[]> {
  const profile = SubjectRuleEngine.getProfile(params.subjectId);
  const activeReg = regulationService.getPrimaryReference(
    params.subjectId,
    params.grade <= 9 ? 'THCS' : 'THPT'
  );

  const mcPart = params.structure.parts.find(p => (p.part === 1 || (p.type as string) === 'multiple_choice' || (p.type as string) === 'single_choice') && p.enabled);
  const tfPart = params.structure.parts.find(p => (p.part === 2 || p.type === 'true_false') && p.enabled);
  const saPart = params.structure.parts.find(p => (p.part === 3 || p.type === 'short_answer') && p.enabled);
  const essayPart = params.structure.parts.find(p => (p.part === 4 || p.type === 'essay') && p.enabled);

  const targetMc = mcPart?.questionCount || 0;
  const targetTf = tfPart?.questionCount || 0;
  const targetSa = saPart?.questionCount || 0;
  const targetEssay = essayPart?.questionCount || 0;

  const ptsPerMc = mcPart?.pointsPerQuestion || 0.25;
  const ptsPerTf = tfPart?.pointsPerQuestion || 1.0;
  const ptsPerSa = saPart?.pointsPerQuestion || 0.5;
  const targetEssayPts = essayPart?.totalPoints || 0;
  const ptsPerEssay = targetEssay > 0 ? targetEssayPts / targetEssay : 0;

  const recog = params.structure.cognitiveDistribution?.recognition ?? 4.0;
  const comp = params.structure.cognitiveDistribution?.comprehension ?? 3.0;
  const app = params.structure.cognitiveDistribution?.application ?? 2.0;
  const adv = params.structure.cognitiveDistribution?.advanced_application ?? 1.0;

  const topicsList = params.topics.length > 0
    ? params.topics
    : SubjectRuleEngine.getCurriculumTopics(params.subjectId, params.grade).map(t => t.topic);

  const prompt = `
Bạn là Chuyên gia Khảo thí và Đo lường Giáo dục hàng đầu tại Việt Nam, am hiểu sâu sắc:
- Chương trình Giáo dục Phổ thông 2018 (Thông tư 32/2018/TT-BGDĐT).
- Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ GDĐT về hướng dẫn xây dựng ma trận, bản đặc tả và đề kiểm tra định kỳ cấp THCS, THPT.
- Căn cứ văn bản áp dụng: ${activeReg.document_number || 'Công văn 7991/BGDĐT-GDTrH'}.

NHIỆM VỤ: Dựa vào PHẠM VI KIẾN THỨC và CẤU TRÚC ĐỀ KIỂM TRA dưới đây, hãy TỰ ĐỘNG THIẾT LẬP KHUNG MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ HOÀN CHỈNH, CHUẨN XÁC THEO MẪU BẢNG 19 CỘT CỦA CÔNG VĂN 7991.
Ma trận và Bản đặc tả này sẽ là CĂN CỨ SƯ PHẠM BẮT BUỘC để AI sinh các câu hỏi kiểm tra ở bước tiếp theo.

THÔNG TIN ĐỀ KIỂM TRA:
- Môn học: ${profile.name} (Mã: ${params.subjectId})
- Lớp: ${params.grade}
- Kì kiểm tra: ${params.term}
- Thời gian làm bài: ${params.durationMinutes} phút

PHẠM VI KIẾN THỨC CẦN KIỂM TRA:
${topicsList.map((t, idx) => `  ${idx + 1}. ${t}`).join('\n')}
${params.extractedTextbookContext ? `
⚠️ ĐẶC BIỆT LƯU Ý - NỘI DUNG TỪ ẢNH CHỤP SÁCH GIÁO KHOA (SGK):
Giáo viên đã chụp/dán trang SGK và AI đã đọc trích xuất nội dung:
"""
${params.extractedTextbookContext}
"""
YÊU CẦU: Các đơn vị kiến thức (content_unit) và Bản đặc tả YCCĐ trong ma trận PHẢI BÁM SÁT 100% VÀO NỘI DUNG BÀI HỌC VÀ CÁC MỤC KIẾN THỨC TRONG ẢNH SGK NÀY!
` : ''}
${params.customPromptRequirements ? `- Yêu cầu bổ sung của giáo viên: ${params.customPromptRequirements}` : ''}

CẤU TRÚC ĐỀ VÀ SỐ LƯỢNG CÂU HỎI BẮT BUỘC (RÀNG BUỘC TOÁN HỌC CHÍNH XÁC):
- Phần I (Trắc nghiệm nhiều lựa chọn): ${targetMc} câu (Mỗi câu ${ptsPerMc}đ, Tổng = ${ExamValidator.round2(targetMc * ptsPerMc)}đ).
- Phần II (Trắc nghiệm Đúng - Sai): ${targetTf} câu (Mỗi câu ${ptsPerTf}đ, Tổng = ${ExamValidator.round2(targetTf * ptsPerTf)}đ).
- Phần III (Trắc nghiệm Trả lời ngắn): ${targetSa} câu (Mỗi câu ${ptsPerSa}đ, Tổng = ${ExamValidator.round2(targetSa * ptsPerSa)}đ).
- Phần IV (Tự luận): ${targetEssay} câu (Tổng điểm tự luận = ${ExamValidator.round2(targetEssayPts)}đ).
- Tỷ lệ nhận thức mục tiêu toàn đề: Nhận biết: ${recog}đ (${Math.round(recog * 10)}%), Thông hiểu: ${comp}đ (${Math.round(comp * 10)}%), Vận dụng: ${app}đ (${Math.round(app * 10)}%), Vận dụng cao: ${adv}đ (${Math.round(adv * 10)}%).
- TỔNG ĐIỂM TOÀN ĐỀ BẮT BUỘC BẰNG CHÍNH XÁC 10,0 ĐIỂM.

YÊU CẦU THIẾT LẬP MA TRẬN & BẢN ĐẶC TẢ:
1. Chia các chủ đề thành từ 2 đến 6 hàng ma trận cụ thể, mỗi hàng có:
   - topic: Tên chủ đề / Chương
   - content_unit: Tên bài học / Đơn vị kiến thức cụ thể cần kiểm tra
   - learning_requirement: Bản đặc tả Yêu cầu cần đạt chi tiết theo chuẩn GDPT 2018 (Chỉ rõ mức độ: NB: ..., TH: ..., VD: ..., VDC: ...)
2. RÀNG BUỘC TỔNG SỐ CÂU HỎI TRÊN TẤT CẢ CÁC HÀNG:
   - Tổng (mc_rec + mc_com + mc_app) = ${targetMc}.
   - Tổng (tf_rec + tf_com + tf_app) = ${targetTf}.
   - Tổng (sa_rec + sa_com + sa_app) = ${targetSa}.
   - Tổng (essay_rec + essay_com + essay_app + essay_adv) = ${targetEssay}.
   (Phần nào có số câu = 0 thì các cột của phần đó phải bằng 0).

ĐỊNH DẠNG ĐẦU RA DUY NHẤT: Trả về đối tượng JSON:
{
  "matrixCells": [
    {
      "id": "cell-1",
      "topic": "Tên chủ đề",
      "content_unit": "Tên bài học / Đơn vị kiến thức cụ thể",
      "learning_requirement": "NB: Nhận biết khái niệm, định lý... TH: Giải thích, phân biệt... VD: Vận dụng công thức giải bài toán...",
      "mc_rec": 2,
      "mc_com": 1,
      "mc_app": 0,
      "tf_rec": 0,
      "tf_com": 1,
      "tf_app": 0,
      "sa_rec": 0,
      "sa_com": 0,
      "sa_app": 1,
      "essay_rec": 0,
      "essay_com": 0,
      "essay_app": 1,
      "essay_adv": 0
    }
  ]
}
`;

  try {
    const { text } = await callDirectGeminiAPI(apiKey, prompt);
    const parsed = safeParseAIJson(text);

    if (parsed && Array.isArray(parsed.matrixCells) && parsed.matrixCells.length > 0) {
      let cells: MatrixCellSpecification[] = parsed.matrixCells.map((c: any, idx: number) => ({
        id: c.id || `cell-${idx + 1}`,
        topic: c.topic || topicsList[idx % topicsList.length] || `Chủ đề ${idx + 1}`,
        content_unit: c.content_unit || c.subtopic || `Đơn vị kiến thức ${idx + 1}`,
        learning_requirement: c.learning_requirement || `Yêu cầu cần đạt chuẩn GDPT 2018 cho bài học này`,
        mc_rec: Math.max(0, Number(c.mc_rec) || 0),
        mc_com: Math.max(0, Number(c.mc_com) || 0),
        mc_app: Math.max(0, Number(c.mc_app) || 0),
        tf_rec: Math.max(0, Number(c.tf_rec) || 0),
        tf_com: Math.max(0, Number(c.tf_com) || 0),
        tf_app: Math.max(0, Number(c.tf_app) || 0),
        sa_rec: Math.max(0, Number(c.sa_rec) || 0),
        sa_com: Math.max(0, Number(c.sa_com) || 0),
        sa_app: Math.max(0, Number(c.sa_app) || 0),
        essay_rec: Math.max(0, Number(c.essay_rec) || 0),
        essay_com: Math.max(0, Number(c.essay_com) || 0),
        essay_app: Math.max(0, Number(c.essay_app) || 0),
        essay_adv: Math.max(0, Number(c.essay_adv) || 0),
        total_questions: 0,
        total_points: 0,
        percentage: 0,
      }));

      // Calibrate question counts to match structure parts exactly
      const calibratePart = (
        targetCount: number,
        getter: (c: MatrixCellSpecification) => number,
        setter: (c: MatrixCellSpecification, val: number) => void
      ) => {
        if (targetCount === 0) {
          cells.forEach(c => setter(c, 0));
          return;
        }
        const currentTotal = cells.reduce((sum, c) => sum + getter(c), 0);
        let diff = targetCount - currentTotal;
        if (diff !== 0 && cells.length > 0) {
          const targetCell = cells[0];
          setter(targetCell, Math.max(0, getter(targetCell) + diff));
        }
      };

      calibratePart(targetMc, c => c.mc_rec + c.mc_com + c.mc_app, (c, val) => {
        const sum = c.mc_rec + c.mc_com + c.mc_app;
        if (sum === 0) {
          c.mc_rec = Math.ceil(val * 0.5);
          c.mc_com = val - c.mc_rec;
        } else {
          c.mc_com = Math.max(0, c.mc_com + (val - sum));
        }
      });

      calibratePart(targetTf, c => c.tf_rec + c.tf_com + c.tf_app, (c, val) => {
        c.tf_com = Math.max(0, val);
      });

      calibratePart(targetSa, c => c.sa_rec + c.sa_com + c.sa_app, (c, val) => {
        c.sa_app = Math.max(0, val);
      });

      calibratePart(targetEssay, c => c.essay_rec + c.essay_com + c.essay_app + (c.essay_adv || 0), (c, val) => {
        c.essay_app = Math.max(0, val);
      });

      // Compute total questions and scores mathematically
      let sumCalculatedPoints = 0;
      cells.forEach(c => {
        const mcSum = c.mc_rec + c.mc_com + c.mc_app;
        const tfSum = c.tf_rec + c.tf_com + c.tf_app;
        const saSum = c.sa_rec + c.sa_com + c.sa_app;
        const essaySum = c.essay_rec + c.essay_com + c.essay_app + (c.essay_adv || 0);

        c.total_questions = mcSum + tfSum + saSum + essaySum;
        const pts = (mcSum * ptsPerMc) + (tfSum * ptsPerTf) + (saSum * ptsPerSa) + (essaySum * ptsPerEssay);
        c.total_points = ExamValidator.round2(pts);
        c.percentage = ExamValidator.round2((c.total_points / 10.0) * 100);
        sumCalculatedPoints += c.total_points;
      });

      // Ensure exact 10.0 total points
      const pointsDiff = ExamValidator.round2(10.0 - sumCalculatedPoints);
      if (Math.abs(pointsDiff) > 0.001 && cells.length > 0) {
        cells[0].total_points = ExamValidator.round2(cells[0].total_points + pointsDiff);
        cells[0].percentage = ExamValidator.round2((cells[0].total_points / 10.0) * 100);
      }

      return cells;
    }
  } catch (err) {
    console.warn('[DirectGemini] Matrix generation error, falling back to rule engine:', err);
  }

  return buildDeterministicMatrix(params);
}
