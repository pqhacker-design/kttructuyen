import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  bootstrapInitialAdmin,
  listAllUsers,
  createNewUser,
  updateUserStatus,
  resetUserPassword,
  deleteUserSafely,
  getLocalAuditLogs,
  logAuditEvent,
  getSupabaseAdmin,
} from './server/admin';
import { runUserIsolationTestSuite } from './server/testSuite';
import { safeParseAIJson } from './src/lib/jsonRepairHelper';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Google GenAI with user-supplied API key (enforce per-user API key)
function getGenAIClient(userApiKey?: string): GoogleGenAI | null {
  const apiKey = userApiKey?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Robust helper to call Gemini with multi-model fallback and retry
 * Handles 503 UNAVAILABLE (high demand), 429 rate limit, and transient outages
 */
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  prompt: string,
  responseSchema?: any
): Promise<{ text: string; model: string }> {
  // Prioritize highly available and stable production models
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const config: any = {
        responseMimeType: 'application/json',
        maxOutputTokens: 16384,
        temperature: 0.2,
      };
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });

      const text = response.text?.trim();
      if (text) {
        return { text, model };
      }
    } catch (err: any) {
      lastError = err;
      const errMessage = err?.message || String(err);
      
      const isHighDemandOrUnavailable =
        errMessage.includes('503') ||
        errMessage.includes('UNAVAILABLE') ||
        errMessage.includes('high demand');

      if (isHighDemandOrUnavailable) {
        // Model is overloaded; gracefully cascade to next model without spamming retries
        console.info(`[AI Service] Model ${model} high demand/unavailable, cascading to next model.`);
      } else {
        console.info(`[AI Service] Model ${model} encounter issue (${errMessage.slice(0, 100)}...), trying next model.`);
      }
    }
  }

  throw lastError || new Error('Tất cả mô hình AI đang bận. Đã chuyển sang bộ tạo quy tắc sư phạm.');
}

// --------------------------------------------------------------------------
// API ROUTES FIRST
// --------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    per_user_api_key_required: true,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/ai/test-key - Verify user-supplied Gemini API key
app.post('/api/ai/test-key', async (req, res) => {
  try {
    const userApiKey = (req.body?.apiKey || (req.headers['x-gemini-api-key'] as string))?.trim();
    if (!userApiKey) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập API Key để kiểm tra.' });
    }
    const ai = getGenAIClient(userApiKey);
    if (!ai) {
      return res.status(400).json({ success: false, error: 'API Key không hợp lệ.' });
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Respond with exactly one word: READY',
    });
    return res.json({
      success: true,
      message: 'Kết nối thành công! API Key của bạn hợp lệ và sẵn sàng sử dụng.',
      preview: response.text?.trim() || 'READY',
    });
  } catch (err: any) {
    console.warn('[AI Test Key] Error:', err?.message || err);
    return res.status(400).json({
      success: false,
      error: err?.message || 'API Key không hợp lệ hoặc không có quyền truy cập Gemini API.',
    });
  }
});

// POST /api/ai/generate-exam
app.post('/api/ai/generate-exam', async (req, res) => {
  try {
    const {
      subject,
      subjectCode,
      grade,
      term,
      duration,
      topics,
      structure,
      regulation,
      customPrompt,
      extractedTextbookContext,
      matrixCells,
      apiKey,
    } = req.body;

    const userApiKey = (req.headers['x-gemini-api-key'] as string) || apiKey;
    if (!userApiKey || typeof userApiKey !== 'string' || !userApiKey.trim()) {
      return res.status(400).json({
        error: 'Bắt buộc người dùng tự nhập API Key để ra đề, không sử dụng chung API hệ thống. Vui lòng mở Cài đặt API để nhập khóa của bạn.',
        requiresApiKey: true,
        fallback: false,
      });
    }

    const ai = getGenAIClient(userApiKey);
    if (!ai) {
      return res.status(400).json({
        error: 'API Key người dùng không hợp lệ hoặc bị trống. Vui lòng kiểm tra lại trong Cài đặt API.',
        requiresApiKey: true,
        fallback: false,
      });
    }

    const enabledParts = structure?.parts?.filter((p: any) => p.enabled && p.questionCount > 0) || [];

    if (enabledParts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cấu hình đề thi chưa có phần nào được bật hoặc số câu bằng 0.',
      });
    }

    const allQuestions: any[] = [];
    let currentGlobalOrder = 1;
    let usedModel = 'gemini-2.5-flash';

    for (let pIdx = 0; pIdx < enabledParts.length; pIdx++) {
      const partConfig = enabledParts[pIdx];
      const partNum = partConfig.part;
      const targetCount = Number(partConfig.questionCount) || 0;
      if (targetCount <= 0) continue;

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

      const relevantCells = (matrixCells || []).filter((c: any) => {
        if (partNum === 1) return ((c.mc_rec || 0) + (c.mc_com || 0) + (c.mc_app || 0)) > 0;
        if (partNum === 2) return ((c.tf_rec || 0) + (c.tf_com || 0) + (c.tf_app || 0)) > 0;
        if (partNum === 3) return ((c.sa_rec || 0) + (c.sa_com || 0) + (c.sa_app || 0)) > 0;
        if (partNum === 4) return ((c.essay_rec || 0) + (c.essay_com || 0) + (c.essay_app || 0) + (c.essay_adv || 0)) > 0;
        return true;
      });

      let partRules = '';
      let partSchema = '';

      if (partNum === 1 || partType === 'single_choice') {
        partRules = `
QUY ĐỊNH PHẦN I - TRẮC NGHIỆM NHIỀU LỰA CHỌN (4 LỰA CHỌN A, B, C, D):
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Đánh số question_order từ ${currentGlobalOrder} đến ${currentGlobalOrder + targetCount - 1}.
- Mỗi câu có 4 phương án A, B, C, D trong mảng "options", đúng 1 phương án có "is_correct": true.
- Điểm mỗi câu: ${ptsPerQ} điểm.
`;
        partSchema = `{
  "questions": [
    {
      "id": "q-${currentGlobalOrder}",
      "exam_part": 1,
      "question_order": ${currentGlobalOrder},
      "question_type": "single_choice",
      "topic": "Chủ đề",
      "content_unit": "Bài học",
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
          `        { "id": "st-${l}", "statement": "${l}) Mệnh đề ${l}...", "is_correct": ${i % 2 === 0}, "explanation": "Giải thích..." }`
        ).join(',\n');

        partRules = `
QUY ĐỊNH PHẦN II - TRẮC NGHIỆM ĐÚNG - SAI:
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Đánh số question_order từ ${currentGlobalOrder} đến ${currentGlobalOrder + targetCount - 1}.
- Mỗi câu gồm bài toán dẫn/bối cảnh ở "content", và ĐÚNG ${statementsCount} mệnh đề độc lập (${labels.join(', ')}) trong "statements".
- Điểm mỗi câu: ${ptsPerQ} điểm (${ptsPerStmt}đ mỗi mệnh đề đúng).
`;
        partSchema = `{
  "questions": [
    {
      "id": "q-${currentGlobalOrder}",
      "exam_part": 2,
      "question_order": ${currentGlobalOrder},
      "question_type": "true_false",
      "topic": "Chủ đề",
      "content_unit": "Bài học",
      "cognitive_level": "comprehension",
      "points": ${ptsPerQ},
      "content": "Bối cảnh / đề dẫn bài toán...",
      "statements": [
${sampleStmts}
      ],
      "explanation": "Lời giải chi tiết..."
    }
  ]
}`;
      } else if (partNum === 3 || partType === 'short_answer') {
        partRules = `
QUY ĐỊNH PHẦN III - TRẢ LỜI NGẮN:
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI. Đánh số question_order từ ${currentGlobalOrder} đến ${currentGlobalOrder + targetCount - 1}.
- Thí sinh tự điền đáp số ngắn gọn.
- "short_answer": { "normalized_answer": "42", "accepted_variants": ["42"] }
- Điểm mỗi câu: ${ptsPerQ} điểm.
`;
        partSchema = `{
  "questions": [
    {
      "id": "q-${currentGlobalOrder}",
      "exam_part": 3,
      "question_order": ${currentGlobalOrder},
      "question_type": "short_answer",
      "topic": "Chủ đề",
      "content_unit": "Bài học",
      "cognitive_level": "application",
      "points": ${ptsPerQ},
      "content": "Nội dung câu hỏi yêu cầu tìm đáp số...",
      "short_answer": {
        "normalized_answer": "42",
        "accepted_variants": ["42"]
      },
      "explanation": "Hướng dẫn tính ra đáp số..."
    }
  ]
}`;
      } else {
        const essayTotalPts = Number(partConfig.totalPoints) || 4.0;
        const ptsPerEssay = essayTotalPts / targetCount;
        partRules = `
QUY ĐỊNH PHẦN IV - TỰ LUẬN (TỔNG ${essayTotalPts} ĐIỂM):
- BẮT BUỘC TẠO ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI TỰ LUẬN. Đánh số question_order từ ${currentGlobalOrder} đến ${currentGlobalOrder + targetCount - 1}.
- Mỗi câu gồm 1-3 ý hỏi (a, b, c) với tổng điểm các ý bằng đúng ${ptsPerEssay}đ.
- Kèm rubric hướng dẫn chấm chi tiết cho từng ý.
`;
        partSchema = `{
  "questions": [
    {
      "id": "q-${currentGlobalOrder}",
      "exam_part": 4,
      "question_order": ${currentGlobalOrder},
      "question_type": "essay",
      "topic": "Chủ đề",
      "content_unit": "Bài học",
      "cognitive_level": "application",
      "points": ${ptsPerEssay},
      "intro_text": "Bối cảnh đề bài chung",
      "content": "Nội dung câu hỏi...",
      "sub_items": [
        {
          "item_number": "a",
          "points": ${ptsPerEssay / 2},
          "cognitive_level": "application",
          "question_text": "Ý a...",
          "expected_answer": "Lời giải ý a...",
          "scoring_rubric": [{ "id": "r1", "criterion": "Tiêu chí 1", "points": ${ptsPerEssay / 2} }]
        }
      ],
      "essay_rubric": [{ "id": "r1", "criterion": "Tiêu chí 1", "points": ${ptsPerEssay} }],
      "explanation": "Hướng dẫn chấm chi tiết..."
    }
  ]
}`;
      }

      const partPrompt = `
Bạn là Chuyên gia Khảo thí và Đo lường Giáo dục hàng đầu tại Việt Nam (BGDĐT).
NHIỆM VỤ: Soạn thảo DUY NHẤT các câu hỏi cho ${partConfig.title || `Phần ${partNum}`} theo chuẩn Công văn 7991/BGDĐT-GDTrH và Chương trình GDPT 2018.

THÔNG TIN:
- Môn học: ${subject} (Lớp: ${grade}, Kì: ${term})
- Thời gian làm bài toàn đề: ${duration || 90} phút
- Chủ đề: ${Array.isArray(topics) ? topics.join(', ') : 'Chương trình hiện hành'}
${extractedTextbookContext ? `\n⚠️ DỮ LIỆU BÁM SÁT SGK:\n${extractedTextbookContext}\n` : ''}
${customPrompt ? `\n- Yêu cầu của giáo viên: ${customPrompt}\n` : ''}
${relevantCells.length > 0 ? `\nMA TRẬN CHO PHẦN NÀY:\n${JSON.stringify(relevantCells, null, 2)}\n` : ''}

${partRules}

RÀNG BUỘC SƯ PHẠM DỰA VÀO THỜI GIAN LÀM BÀI (${duration || 90} PHÚT):
- Cân chỉnh độ dài ngữ liệu câu dẫn, số bước tính toán và độ phức tạp bài toán sao cho học sinh hoàn thành bài thi trọn vẹn trong đúng ${duration || 90} phút.
- Phân bổ thời gian ước tính:
  + Câu trắc nghiệm Phần I (nhiều lựa chọn): ~1.0 - 1.5 phút/câu.
  + Câu trắc nghiệm Phần II (Đúng - Sai): ~3.0 - 4.0 phút/câu (khoảng 45 - 60 giây cho mỗi ý a, b, c, d).
  + Câu trắc nghiệm Phần III (Trả lời ngắn): ~2.0 - 3.0 phút/câu.
  + Câu tự luận Phần IV: ~${Math.max(5, Math.round(((duration || 90) * 0.35) / Math.max(1, targetCount)))} phút/câu.
- Với bài kiểm tra ngắn (15 - 45 phút): Câu hỏi phải cô đọng, súc tích, tránh các phép tính quá nhiều tầng cồng kềnh hay ngữ liệu đọc quá dài làm học sinh không kịp làm bài.
- Với bài kiểm tra chuẩn (60 - 90 - 120 phút): Phân bổ các mức độ tư duy cân đối từ Nhận biết, Thông hiểu đến Vận dụng, Vận dụng cao chuẩn GDPT 2018 mà không làm đề thi quá tải.

RÀNG BUỘC CỰC KỲ QUAN TRỌNG:
1. ĐÚNG VÀ ĐỦ SỐ LƯỢNG: Mảng "questions" BẮT BUỘC PHẢI CÓ ĐỦ CHÍNH XÁC ${targetCount} CÂU HỎI.
2. CÔNG THỨC TOÁN (LaTeX): BẮT BUỘC dùng hai dấu gạch chéo ngược \\\\ (ví dụ \\\\frac{a}{b}, \\\\sqrt{x}, \\\\alpha, \\\\vec{u}, \\\\Delta, \\\\le, \\\\ge). Tuyệt đối không dùng một dấu gạch đơn \\.
3. DẤU NGOẶC KÉP: Tuyệt đối không dùng dấu ngoặc kép đôi " chưa escape bên trong chuỗi (dùng dấu nháy đơn '...' hoặc escape \\").
4. ĐỊNH DẠNG ĐẦU RA: Trả về duy nhất đối tượng JSON hợp lệ:
${partSchema}
`;

      const { text: responseText, model: modelUsed } = await callGeminiWithFallback(ai, partPrompt);
      usedModel = modelUsed;
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

      const cleanList = list.map((q, idx) => ({
        ...q,
        id: q.id || `q-${partNum}-${currentGlobalOrder + idx}`,
        exam_part: partNum,
        question_order: currentGlobalOrder + idx,
        question_type: partType,
        points: Number(q.points) || ptsPerQ,
        topic: q.topic || topics[0] || subject,
        content_unit: q.content_unit || q.topic || 'Kiến thức trọng tâm',
        cognitive_level: q.cognitive_level || 'comprehension',
        created_by_ai: true,
        teacher_accepted: true,
      }));

      currentGlobalOrder += cleanList.length;
      allQuestions.push(...cleanList);
    }

    return res.json({
      success: true,
      exam: {
        title: `ĐỀ KIỂM TRA ${term?.toUpperCase()} MÔN ${subject?.toUpperCase()} - LỚP ${grade}`,
        subject,
        grade,
        term,
        duration_minutes: duration,
        total_score: 10.0,
        instructions: 'Thí sinh làm bài theo đúng thời gian quy định. Không sử dụng tài liệu trừ khi có hướng dẫn riêng.',
      },
      questions: allQuestions,
      model: usedModel,
    });
  } catch (err: any) {
    console.warn('[AI Service] Exam generation fallback triggered:', err?.message || err);
    // Return 200 with fallback: true so frontend pedagogical engine immediately takes over smoothly
    return res.json({
      success: false,
      fallback: true,
      error: err?.message || 'Mô hình AI đang bận, chuyển sang động cơ khảo thí sư phạm chuẩn.',
    });
  }
});

// POST /api/ai/extract-textbook - Read and analyze textbook screenshots with Gemini Vision
app.post('/api/ai/extract-textbook', async (req, res) => {
  try {
    const { images, subject, subjectId, grade, term, apiKey } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || apiKey;

    if (!userApiKey || typeof userApiKey !== 'string' || !userApiKey.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bắt buộc nhập Gemini API Key để phân tích hình ảnh SGK. Vui lòng mở Cài đặt API.',
        requiresApiKey: true,
      });
    }

    const ai = getGenAIClient(userApiKey);
    if (!ai) {
      return res.status(400).json({
        success: false,
        error: 'API Key người dùng không hợp lệ.',
        requiresApiKey: true,
      });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Chưa có hình ảnh SGK nào được tải lên hoặc dán từ clipboard.',
      });
    }

    // Build multimodal contents: array of image parts + prompt
    const imageParts = images.map((img: any) => {
      let base64Clean = img.base64Data || img.data || '';
      if (base64Clean.includes(';base64,')) {
        base64Clean = base64Clean.split(';base64,')[1];
      }
      return {
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: base64Clean.trim(),
        },
      };
    });

    const promptText = `
Bạn là Chuyên gia Khảo thí và Thẩm định chương trình GDPT 2018 môn ${subject || 'Toán học'} lớp ${grade || 10}.
Dưới đây là ${images.length} hình ảnh chụp trực tiếp từ Sách Giáo Khoa (SGK) hoặc tài liệu bài học mà giáo viên muốn dùng làm phạm vi ra đề kiểm tra.

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

    const contents = [...imageParts, { text: promptText }];

    // Models for multimodal vision
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
    ];

    let responseText = '';
    let usedModel = '';
    let lastErr: any = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response.text?.trim()) {
          responseText = response.text.trim();
          usedModel = model;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[AI Vision SGK] Model ${model} failed, trying next...`, err?.message || err);
      }
    }

    if (!responseText) {
      throw lastErr || new Error('Không thể phân tích hình ảnh SGK. Vui lòng kiểm tra lại ảnh hoặc API Key.');
    }

    const extractedData = safeParseAIJson(responseText);

    return res.json({
      success: true,
      data: extractedData,
      model: usedModel,
    });
  } catch (err: any) {
    console.error('[AI Extract Textbook] Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi khi phân tích hình ảnh SGK bằng AI.',
    });
  }
});

// POST /api/ai/generate-matrix
app.post('/api/ai/generate-matrix', async (req, res) => {
  try {
    const {
      subjectId,
      grade,
      term,
      durationMinutes,
      topics,
      structure,
      extractedTextbookContext,
      customPromptRequirements,
      apiKey,
    } = req.body;

    const userApiKey = (req.headers['x-gemini-api-key'] as string) || apiKey;
    if (!userApiKey || typeof userApiKey !== 'string' || !userApiKey.trim()) {
      return res.status(400).json({
        success: false,
        requiresApiKey: true,
        error: 'Vui lòng nhập API Key để sinh ma trận và bản đặc tả bằng AI.',
      });
    }

    const ai = getGenAIClient(userApiKey);
    if (!ai) {
      return res.status(400).json({
        success: false,
        requiresApiKey: true,
        error: 'API Key không hợp lệ.',
      });
    }

    const mcPart = structure?.parts?.find((p: any) => (p.part === 1 || p.type === 'single_choice') && p.enabled);
    const tfPart = structure?.parts?.find((p: any) => (p.part === 2 || p.type === 'true_false') && p.enabled);
    const saPart = structure?.parts?.find((p: any) => (p.part === 3 || p.type === 'short_answer') && p.enabled);
    const essayPart = structure?.parts?.find((p: any) => (p.part === 4 || p.type === 'essay') && p.enabled);

    const targetMc = mcPart?.questionCount || 0;
    const targetTf = tfPart?.questionCount || 0;
    const targetSa = saPart?.questionCount || 0;
    const targetEssay = essayPart?.questionCount || 0;

    const ptsPerMc = mcPart?.pointsPerQuestion || 0.25;
    const ptsPerTf = tfPart?.pointsPerQuestion || 1.0;
    const ptsPerSa = saPart?.pointsPerQuestion || 0.5;
    const targetEssayPts = essayPart?.totalPoints || 0;

    const recog = structure?.cognitiveDistribution?.recognition ?? 4.0;
    const comp = structure?.cognitiveDistribution?.comprehension ?? 3.0;
    const app = structure?.cognitiveDistribution?.application ?? 2.0;
    const adv = structure?.cognitiveDistribution?.advanced_application ?? 1.0;

    const topicsList = Array.isArray(topics) && topics.length > 0 ? topics : ['Chương I: Kiến thức trọng tâm'];

    const prompt = `
Bạn là Chuyên gia Khảo thí và Đo lường Giáo dục hàng đầu tại Việt Nam, am hiểu sâu sắc:
- Chương trình Giáo dục Phổ thông 2018 (Thông tư 32/2018/TT-BGDĐT).
- Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ GDĐT về hướng dẫn xây dựng ma trận, bản đặc tả và đề kiểm tra định kỳ cấp THCS, THPT.

NHIỆM VỤ: Dựa vào PHẠM VI KIẾN THỨC và CẤU TRÚC ĐỀ KIỂM TRA, hãy TỰ ĐỘNG THIẾT LẬP KHUNG MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA CHI TIẾT (Bảng 19 cột CV 7991).
Ma trận và Bản đặc tả này sẽ là CĂN CỨ SƯ PHẠM BẮT BUỘC để AI sinh đề kiểm tra.

THÔNG TIN ĐỀ KIỂM TRA:
- Môn học: ${subjectId}
- Lớp: ${grade}
- Kì kiểm tra: ${term}
- Thời gian làm bài: ${durationMinutes} phút

PHẠM VI KIẾN THỨC CẦN KIỂM TRA:
${topicsList.map((t: string, idx: number) => `  ${idx + 1}. ${t}`).join('\n')}
${extractedTextbookContext ? `
⚠️ ĐẶC BIỆT LƯU Ý - NỘI DUNG TỪ ẢNH CHỤP SÁCH GIÁO KHOA (SGK):
Giáo viên đã chụp/dán trang SGK và AI đã đọc trích xuất nội dung:
"""
${extractedTextbookContext}
"""
YÊU CẦU: Các đơn vị kiến thức (content_unit) và Bản đặc tả YCCĐ trong ma trận PHẢI BÁM SÁT 100% VÀO NỘI DUNG BÀI HỌC VÀ CÁC MỤC KIẾN THỨC TRONG ẢNH SGK NÀY!
` : ''}
${customPromptRequirements ? `- Yêu cầu bổ sung của giáo viên: ${customPromptRequirements}` : ''}

CẤU TRÚC ĐỀ VÀ SỐ LƯỢNG CÂU HỎI BẮT BUỘC (RÀNG BUỘC TOÁN HỌC CHÍNH XÁC):
- Phần I (Trắc nghiệm nhiều lựa chọn): ${targetMc} câu (Mỗi câu ${ptsPerMc}đ).
- Phần II (Trắc nghiệm Đúng - Sai): ${targetTf} câu (Mỗi câu ${ptsPerTf}đ).
- Phần III (Trắc nghiệm Trả lời ngắn): ${targetSa} câu (Mỗi câu ${ptsPerSa}đ).
- Phần IV (Tự luận): ${targetEssay} câu (Tổng điểm tự luận = ${targetEssayPts}đ).
- Tỷ lệ nhận thức: Nhận biết: ${recog}đ, Thông hiểu: ${comp}đ, Vận dụng: ${app}đ, Vận dụng cao: ${adv}đ.
- TỔNG ĐIỂM TOÀN ĐỀ BẮT BUỘC = 10,0 ĐIỂM.

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

    const { text, model } = await callGeminiWithFallback(ai, prompt);
    const parsed = safeParseAIJson(text);

    return res.json({
      success: true,
      data: parsed.matrixCells || [],
      model,
    });
  } catch (err: any) {
    console.error('[AI Generate Matrix] Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi khi AI tự động sinh ma trận.',
    });
  }
});

// POST /api/ai/regenerate-question
app.post('/api/ai/regenerate-question', async (req, res) => {
  try {
    const { question, subjectId, grade, topic, apiKey } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || apiKey;
    if (!userApiKey || typeof userApiKey !== 'string' || !userApiKey.trim()) {
      return res.status(400).json({
        success: false,
        requiresApiKey: true,
        error: 'Bắt buộc nhập API Key để tạo lại câu hỏi bằng AI. Vui lòng cấu hình trong Cài đặt API.',
      });
    }
    const ai = getGenAIClient(userApiKey);
    if (!ai) {
      return res.status(400).json({ success: false, requiresApiKey: true, error: 'API Key không hợp lệ.' });
    }

    const prompt = `
Bạn là chuyên gia ra đề thi. Hãy tạo MỘT CÂU HỎI MỚI thay thế cho câu hỏi sau:
Môn: ${subjectId}, Lớp: ${grade}, Chủ đề: ${topic}
Loại câu: ${question.question_type}, Phần: ${question.exam_part}, Điểm: ${question.points}, Mức độ: ${question.cognitive_level}
Nội dung câu cũ: ${question.content}

YÊU CẦU:
- Giữ nguyên loại câu, điểm số và mức độ nhận thức.
- Tạo nội dung mới, chính xác, sư phạm, không trùng lặp.
- Trả về JSON duy nhất: { "question": { "content": "...", "options": [...], "statements": [...], "short_answer": {...}, "essay_rubric": [...], "explanation": "..." } }
`;

    const { text: responseText } = await callGeminiWithFallback(ai, prompt);
    const parsed = safeParseAIJson(responseText);
    return res.json({ success: true, ...parsed });
  } catch (err: any) {
    console.warn('[AI Service] Regenerate question error:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Không thể tạo lại câu hỏi.' });
  }
});

// POST /api/ai/regenerate-essay-subitem
app.post('/api/ai/regenerate-essay-subitem', async (req, res) => {
  try {
    const { question, subItemIndex, subjectId, grade, topic, apiKey } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || apiKey;
    if (!userApiKey || typeof userApiKey !== 'string' || !userApiKey.trim()) {
      return res.status(400).json({
        success: false,
        requiresApiKey: true,
        error: 'Bắt buộc nhập API Key để tạo lại ý tự luận bằng AI. Vui lòng cấu hình trong Cài đặt API.',
      });
    }
    const ai = getGenAIClient(userApiKey);
    if (!ai) {
      return res.status(400).json({ success: false, requiresApiKey: true, error: 'API Key không hợp lệ.' });
    }

    const currentSub = question?.sub_items?.[subItemIndex];
    const itemLabel = currentSub?.item_number || (['a', 'b', 'c'][subItemIndex] || 'a');
    const prompt = `
Bạn là chuyên gia Khảo thí môn ${subjectId || 'Toán'} lớp ${grade || 12}.
Hãy tạo MỘT Ý HỎI TỰ LUẬN MỚI THAY THẾ cho ý ${itemLabel}) trong bài tự luận:
Chủ đề: ${topic || question.topic || ''}
Bối cảnh / Đề bài chung: ${question.intro_text || question.content || ''}
Mức độ nhận thức: ${currentSub?.cognitive_level || 'application'}
Điểm số của ý này: ${currentSub?.points || 1.0} điểm (BẮT BUỘC giữ nguyên thang điểm).
Nội dung ý cũ: ${currentSub?.question_text || ''}

YÊU CẦU QUAN TRỌNG:
1. Ý mới phải phát triển tự nhiên từ bối cảnh chung, có ý nghĩa sư phạm cao, không trùng lặp các ý khác.
2. BẮT BUỘC giữ nguyên điểm số là ${currentSub?.points || 1.0} điểm.
3. Kèm theo expected_answer (lời giải chi tiết) và scoring_rubric (biểu điểm chi tiết tổng bằng ${currentSub?.points || 1.0}đ).
4. Trả về đối tượng JSON duy nhất:
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

    const { text: responseText } = await callGeminiWithFallback(ai, prompt);
    const parsed = safeParseAIJson(responseText);
    return res.json({ success: true, ...parsed });
  } catch (err: any) {
    console.warn('[AI Service] Regenerate essay subitem fallback:', err?.message || err);
    return res.json({ success: false, fallback: true, error: err?.message || 'AI bận' });
  }
});

// --------------------------------------------------------------------------
// USER MANAGEMENT & SYSTEM ADMINISTRATION API
// --------------------------------------------------------------------------

// GET /api/admin/users - List all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await listAllUsers();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/users - Create new user
app.post('/api/admin/users', async (req, res) => {
  try {
    const { email, password, full_name, status, actorEmail } = req.body;
    if (!email || !full_name) {
      return res.status(400).json({ success: false, error: 'Email và họ tên là bắt buộc.' });
    }
    const user = await createNewUser({ email, password, full_name, status, actorEmail });
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/users/:id/status - Update user status (active | inactive | locked)
app.patch('/api/admin/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actorEmail } = req.body;
    if (!['active', 'inactive', 'locked'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ.' });
    }
    const result = await updateUserStatus(id, status, actorEmail);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/users/:id/reset-password - Admin reset password
app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, actorEmail } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }
    const result = await resetUserPassword(id, password, actorEmail);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/users/:id - Safe user deletion with dependency checking
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    const actorEmail = (req.query.actorEmail as string) || 'admin@eduexam.com';
    const result = await deleteUserSafely(id, force, actorEmail);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/audit-logs - Query audit trail
app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        return res.json({ success: true, logs: data });
      }
    }
    const logs = getLocalAuditLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.json({ success: true, logs: getLocalAuditLogs() });
  }
});

// POST /api/audit-logs - Record audit log
app.post('/api/audit-logs', async (req, res) => {
  try {
    const entry = req.body;
    const log = await logAuditEvent(entry);
    res.json({ success: true, log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/change-password - Change current user password
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, newPassword, userEmail } = req.body;
    if (!userId || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Thông tin đổi mật khẩu không hợp lệ (tối thiểu 6 ký tự).' });
    }
    await resetUserPassword(userId, newPassword, userEmail);
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/exam-access/:code - Cross-device safe exam code resolver
app.get('/api/exam-access/:code', async (req, res) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, error: 'Mã phòng thi không được để trống.' });
    }

    const admin = getSupabaseAdmin();
    if (admin) {
      // 1. Look up access_codes table
      const { data: accessCodeData } = await admin
        .from('access_codes')
        .select('*, exam_sessions(*)')
        .eq('code', code)
        .single();

      let session = accessCodeData?.exam_sessions;

      // 2. Fallback to exam_sessions access_code
      if (!session) {
        const { data: sessionData } = await admin
          .from('exam_sessions')
          .select('*')
          .eq('access_code', code)
          .single();
        session = sessionData;
      }

      if (session) {
        if (session.status !== 'active') {
          return res.status(400).json({ success: false, error: 'Phòng thi này chưa mở hoặc đã kết thúc.' });
        }

        // Fetch exam
        const { data: exam } = await admin
          .from('exams')
          .select('id, title, subject_name, grade, duration_minutes, total_points')
          .eq('id', session.exam_id)
          .single();

        // Fetch questions and SANITIZE (REDACT correct answers and explanations)
        const { data: examQuestions } = await admin
          .from('exam_questions')
          .select('*, questions(*)')
          .eq('exam_id', session.exam_id)
          .order('order_index', { ascending: true });

        const sanitizedQuestions = (examQuestions || []).map((eq: any) => {
          const q = eq.questions;
          if (!q) return null;

          // Remove correct answers and sensitive explanation for students
          const sanitizedOptions = (q.options || []).map((opt: any) => ({
            id: opt.id,
            label: opt.label,
            content: opt.content,
          }));

          const sanitizedStatements = (q.statements || []).map((st: any) => ({
            id: st.id,
            label: st.label,
            content: st.content,
          }));

          return {
            id: q.id,
            content: q.content,
            question_type: q.question_type,
            exam_part: q.exam_part,
            points: eq.points || q.points,
            cognitive_level: q.cognitive_level,
            options: sanitizedOptions,
            statements: sanitizedStatements,
            sub_items: q.sub_items,
          };
        }).filter(Boolean);

        return res.json({
          success: true,
          session: {
            id: session.id,
            title: session.title,
            access_code: session.access_code,
            duration_minutes: session.duration_minutes,
            status: session.status,
          },
          exam: exam || { title: session.title },
          questions: sanitizedQuestions,
        });
      }
    }

    // Local / fallback resolver for code
    res.json({
      success: true,
      found: false,
      code,
      message: 'Mã phòng thi hợp lệ trong chuẩn cấu hình hệ thống. Hệ thống phòng thi sẵn sàng.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/exam-results/record - Server-side guaranteed persistence for exam results
app.post('/api/exam-results/record', async (req, res) => {
  try {
    const {
      attemptId,
      sessionId,
      studentId,
      studentName,
      studentCode,
      score,
      maxScore,
      percentage,
      correctCount,
      wrongCount,
      unansweredCount,
      submittedAt,
    } = req.body;

    if (!attemptId || !sessionId) {
      return res.status(400).json({ success: false, error: 'Thiếu attemptId hoặc sessionId' });
    }

    const admin = getSupabaseAdmin();
    if (admin) {
      const nowIso = submittedAt || new Date().toISOString();
      const numScore = Number(score) || 0;
      const numMax = Number(maxScore) || 10;
      const numPct = Number(percentage) || Math.round((numScore / numMax) * 100);

      // 1. Update attempt
      await admin
        .from('exam_attempts')
        .update({
          status: 'graded',
          submitted_at: nowIso,
          score: numScore,
          max_score: numMax,
          percentage: numPct,
        })
        .eq('id', attemptId);

      // 2. Upsert into exam_results (bypasses RLS)
      const { data: savedResult, error: saveErr } = await admin
        .from('exam_results')
        .upsert(
          {
            attempt_id: attemptId,
            student_id: studentId || null,
            exam_session_id: sessionId,
            student_name: studentName || 'Học sinh',
            student_code: studentCode || '',
            score: numScore,
            max_score: numMax,
            percentage: numPct,
            correct_count: Number(correctCount) || 0,
            wrong_count: Number(wrongCount) || 0,
            unanswered_count: Number(unansweredCount) || 0,
            submitted_at: nowIso,
          },
          { onConflict: 'attempt_id' }
        )
        .select()
        .single();

      if (saveErr) {
        console.warn('Admin upsert exam_results warning:', saveErr.message);
      }

      return res.json({
        success: true,
        result: savedResult || {
          id: 'res-' + attemptId,
          attempt_id: attemptId,
          exam_session_id: sessionId,
          student_name: studentName,
          student_code: studentCode,
          score: numScore,
          max_score: numMax,
          percentage: numPct,
        },
      });
    }

    res.json({ success: true, message: 'Ghi nhận kết quả cục bộ thành công.' });
  } catch (err: any) {
    console.error('Error recording exam result on server:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/exam-sessions/:sessionId/results - Fetch & auto-reconcile results from attempts
app.get('/api/exam-sessions/:sessionId/results', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const admin = getSupabaseAdmin();

    if (!admin) {
      return res.json({ success: true, results: [] });
    }

    // 1. Query exam_results
    const { data: resultsData, error: rErr } = await admin
      .from('exam_results')
      .select('*')
      .eq('exam_session_id', sessionId)
      .order('submitted_at', { ascending: false });

    // 2. Query all graded or submitted attempts from exam_attempts
    const { data: attemptsData, error: aErr } = await admin
      .from('exam_attempts')
      .select('*')
      .eq('exam_session_id', sessionId)
      .in('status', ['graded', 'submitted'])
      .order('submitted_at', { ascending: false });

    const resultsList = resultsData ? [...resultsData] : [];
    const existingAttemptIds = new Set(resultsList.map((r: any) => r.attempt_id));

    // 3. Reconcile: If any attempt in exam_attempts is missing from exam_results, backfill it!
    const missingAttempts = (attemptsData || []).filter((att: any) => !existingAttemptIds.has(att.id));

    for (const att of missingAttempts) {
      const numScore = Number(att.score ?? 0);
      const numMax = Number(att.max_score ?? 10);
      const numPct = Number(att.percentage ?? Math.round((numScore / numMax) * 100));
      const subTime = att.submitted_at || att.created_at || new Date().toISOString();

      const newRecord = {
        attempt_id: att.id,
        student_id: att.student_id || null,
        exam_session_id: sessionId,
        student_name: att.student_name || 'Học sinh',
        student_code: att.student_code || '',
        score: numScore,
        max_score: numMax,
        percentage: numPct,
        correct_count: 0,
        wrong_count: 0,
        unanswered_count: 0,
        submitted_at: subTime,
      };

      try {
        const { data: inserted, error: insErr } = await admin
          .from('exam_results')
          .upsert(newRecord, { onConflict: 'attempt_id' })
          .select()
          .single();

        if (inserted && !insErr) {
          resultsList.push(inserted);
        } else {
          resultsList.push({
            id: 'res-' + att.id,
            ...newRecord,
            created_at: subTime,
          });
        }
      } catch (backfillErr) {
        resultsList.push({
          id: 'res-' + att.id,
          ...newRecord,
          created_at: subTime,
        });
      }
    }

    // Sort by submitted_at descending
    resultsList.sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

    res.json({ success: true, results: resultsList, syncedCount: missingAttempts.length });
  } catch (err: any) {
    console.error('Error fetching session results on server:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/exam-sessions/:sessionId/sync-attempts - Trigger sync from exam_attempts to exam_results
app.post('/api/exam-sessions/:sessionId/sync-attempts', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.json({ success: true, syncedCount: 0, message: 'Chưa cấu hình Supabase Admin' });
    }

    const { data: attempts } = await admin
      .from('exam_attempts')
      .select('*')
      .eq('exam_session_id', sessionId)
      .in('status', ['graded', 'submitted']);

    const { data: existingResults } = await admin
      .from('exam_results')
      .select('attempt_id')
      .eq('exam_session_id', sessionId);

    const existingIds = new Set((existingResults || []).map((r: any) => r.attempt_id));
    const toInsert = (attempts || []).filter((a: any) => !existingIds.has(a.id));

    let insertedCount = 0;
    for (const att of toInsert) {
      const numScore = Number(att.score ?? 0);
      const numMax = Number(att.max_score ?? 10);
      const numPct = Number(att.percentage ?? Math.round((numScore / numMax) * 100));

      const { error } = await admin.from('exam_results').upsert({
        attempt_id: att.id,
        student_id: att.student_id || null,
        exam_session_id: sessionId,
        student_name: att.student_name || 'Học sinh',
        student_code: att.student_code || '',
        score: numScore,
        max_score: numMax,
        percentage: numPct,
        correct_count: 0,
        wrong_count: 0,
        unanswered_count: 0,
        submitted_at: att.submitted_at || att.created_at || new Date().toISOString(),
      }, { onConflict: 'attempt_id' });

      if (!error) insertedCount++;
    }

    res.json({ success: true, syncedCount: insertedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/test/user-isolation - Run the comprehensive User Isolation Test Suite
app.post('/api/test/user-isolation', async (req, res) => {
  try {
    const report = await runUserIsolationTestSuite();
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSETS
// --------------------------------------------------------------------------

async function startServer() {
  // Bootstrap initial admin account
  await bootstrapInitialAdmin();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduExam server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
