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

    const part2Config = structure?.parts?.find((p: any) => p.part === 2 || p.type === 'true_false');
    const statementsCount = Number(part2Config?.statementsPerQuestion) || 4;
    const pointsPerStatement = Number(part2Config?.pointsPerStatement) || (part2Config?.pointsPerQuestion ? part2Config.pointsPerQuestion / statementsCount : 0.25);

    const part4Config = structure?.parts?.find((p: any) => p.part === 4 || p.type === 'essay');
    const allowedSubCounts = part4Config?.allowedSubItemCounts || [1, 2, 3];
    const essayMode = part4Config?.essayAllocationMode || 'auto';

    const examFormat = structure?.examFormat || (
      part4Config && part4Config.enabled && part4Config.totalPoints > 0 && structure?.parts?.some((p: any) => p.part !== 4 && p.enabled && p.totalPoints > 0)
        ? 'hybrid'
        : (part4Config && part4Config.enabled && part4Config.totalPoints > 0 ? 'essay_only' : 'multiple_choice_only')
    );

    let formatRequirementText = '';
    if (examFormat === 'multiple_choice_only') {
      formatRequirementText = `
⚠️ ĐẶC BIỆT CHÚ Ý - ĐỊNH DẠNG ĐỀ: 100% TRẮC NGHIỆM KHÁCH QUAN (TỔNG 10,0 ĐIỂM).
- TUYỆT ĐỐI KHÔNG TẠO BẤT KỲ CÂU HỎI TỰ LUẬN NÀO (Phần IV: 0 câu, 0 điểm).
- Chỉ tạo các câu hỏi thuộc Phần I, Phần II, Phần III theo đúng số lượng và điểm số trong cấu hình parts (Tổng điểm trắc nghiệm = 10,0 điểm).
`;
    } else if (examFormat === 'essay_only') {
      formatRequirementText = `
⚠️ ĐẶC BIỆT CHÚ Ý - ĐỊNH DẠNG ĐỀ: 100% TỰ LUẬN (TỔNG 10,0 ĐIỂM).
- TUYỆT ĐỐI KHÔNG TẠO BẤT KỲ CÂU HỎI TRẮC NGHIỆM NÀO (Phần I, II, III: 0 câu, 0 điểm).
- Toàn bộ các câu hỏi trong đề là câu tự luận thuộc Phần IV với thang điểm phân bố chuẩn tổng 10,0 điểm, có cấu trúc ý rõ ràng và rubric hướng dẫn chấm chi tiết.
`;
    } else {
      formatRequirementText = `
⚠️ ĐẶC BIỆT CHÚ Ý - ĐỊNH DẠNG ĐỀ: KẾT HỢP TRẮC NGHIỆM VÀ TỰ LUẬN (TỔNG 10,0 ĐIỂM).
- Tạo đồng thời cả câu hỏi trắc nghiệm (Phần I, II, III) và câu hỏi tự luận (Phần IV) đúng theo số lượng và thang điểm quy định trong cấu hình parts.
`;
    }

    const statementLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, statementsCount);
    const sampleStatementsJson = statementLabels.map((lbl, idx) => 
      `        { "id": "st-${lbl}", "statement": "${lbl}) Mệnh đề ${lbl}", "is_correct": ${idx % 2 === 0}, "explanation": "Giải thích chi tiết cho ý ${lbl}..." }`
    ).join(',\n');

    const prompt = `
Bạn là Chuyên gia Khảo thí và Đo lường Giáo dục hàng đầu tại Việt Nam, am hiểu sâu sắc:
- Chương trình Giáo dục Phổ thông 2018 (Thông tư 32/2018/TT-BGDĐT).
- Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 về hướng dẫn xây dựng ma trận, bản đặc tả và đề kiểm tra định kỳ cấp THCS, THPT.
- Quy chuẩn đánh giá theo Thông tư 22/2021/TT-BGDĐT.

NHIỆM VỤ: Hãy xây dựng ĐỀ KIỂM TRA ĐỊNH KỲ HOÀN CHỈNH, CHUẨN XÁC VÀ ĐÚNG QUY TRÌNH SƯ PHẠM.

THÔNG TIN ĐỀ KIỂM TRA:
- Môn học: ${subject} (Mã: ${subjectCode})
- Lớp: ${grade}
- Kì kiểm tra: ${term}
- Thời gian làm bài: ${duration} phút
- Căn cứ văn bản pháp lý: ${regulation || 'Công văn 7991/BGDĐT-GDTrH'}
- Chủ đề / Chương kiểm tra: ${Array.isArray(topics) ? topics.join(', ') : 'Toàn bộ nội dung học kì'}
${extractedTextbookContext ? `
⚠️ ĐẶC BIỆT LƯU Ý - NỘI DUNG BÁM SÁT SÁCH GIÁO KHOA (SGK):
Giáo viên đã chụp/dán hình ảnh SGK và AI đã đọc trích xuất nội dung bài học như sau:
"""
${extractedTextbookContext}
"""
YÊU CẦU BẮT BUỘC: Tất cả câu hỏi (Phần I, II, III, IV) PHẢI BÁM SÁT 100% VÀO CÁC KHÁI NIỆM, ĐỊNH LÝ, CÔNG THỨC, BÀI ĐỌC, SỐ LIỆU VÀ DẠNG BÀI CÓ TRONG NỘI DUNG SGK NÊU TRÊN. Tuyệt đối không ra đề ngoài kiến thức bài học đã được cung cấp!
` : ''}
${matrixCells && Array.isArray(matrixCells) && matrixCells.length > 0 ? `
KHUNG MA TRẬN & BẢN ĐẶC TẢ ĐÃ ĐƯỢC TỰ ĐỘNG THIẾT LẬP TRƯỚC:
Các câu hỏi sinh ra PHẢI KHỚP HOÀN TOÀN với bảng phân bổ câu hỏi và mức độ nhận thức theo từng chủ đề sau:
${JSON.stringify(matrixCells.map((c: any) => ({
  topic: c.topic,
  content_unit: c.content_unit,
  mc_rec: c.mc_rec || 0,
  mc_com: c.mc_com || 0,
  mc_app: c.mc_app || 0,
  tf_rec: c.tf_rec || 0,
  tf_com: c.tf_com || 0,
  tf_app: c.tf_app || 0,
  sa_rec: c.sa_rec || 0,
  sa_com: c.sa_com || 0,
  sa_app: c.sa_app || 0,
  essay_rec: c.essay_rec || 0,
  essay_com: c.essay_com || 0,
  essay_app: (c.essay_app || 0) + (c.essay_adv || 0),
  yccd: c.learning_requirement
})), null, 2)}
` : ''}
${customPrompt ? `- Yêu cầu bổ sung của giáo viên: ${customPrompt}` : ''}
${formatRequirementText}

CẤU TRÚC ĐỀ VÀ THANG ĐIỂM (BẮT BUỘC TỔNG ĐIỂM = 10,0 ĐIỂM):
${JSON.stringify(structure, null, 2)}

QUY ĐỊNH BẮT BUỘC VỀ CÁC PHẦN ĐƯỢC BẬT (ENABLED):
- CHỈ sinh câu hỏi cho những Phần có enabled = true và questionCount > 0.
- Nếu Phần nào có enabled = false hoặc questionCount = 0 thì TUYỆT ĐỐI KHÔNG sinh câu hỏi cho phần đó!

QUY ĐỊNH BẮT BUỘC VỀ DẠNG CÂU HỎI:
1. Phần I: Trắc nghiệm nhiều lựa chọn (chỉ 1 phương án đúng trong 4 lựa chọn A, B, C, D).
2. Phần II: Câu trắc nghiệm Đúng - Sai:
   - BẮT BUỘC mỗi câu hỏi phải có ĐÚNG ${statementsCount} ý (mệnh đề) độc lập: ${statementLabels.join(', ')}.
   - Mỗi ý đánh dấu rõ "is_correct" là true hoặc false.
   - Thang điểm: Mỗi ý đúng được ${pointsPerStatement} điểm (Tổng ${statementsCount} ý = ${pointsPerStatement * statementsCount} điểm/câu).
3. Phần III: Trả lời ngắn (Thí sinh tự điền đáp số ngắn gọn).
4. Phần IV: TỰ LUẬN - CẤU TRÚC 1 ĐẾN 3 Ý HỎI ĐỘC LẬP:
   - Hệ thống KHÔNG mặc định mỗi câu tự luận chỉ có một ý hỏi.
   - Các cấu trúc ý được phép trong đề: ${allowedSubCounts.join(', ')} ý. Có thể trộn các câu 1 ý, 2 ý và 3 ý trong cùng một đề (Ví dụ: Câu 1 có 1 ý, Câu 2 có 2 ý a, b, Câu 3 có 3 ý a, b, c).
   - RÀNG BUỘC TUYỆT ĐỐI VỀ ĐIỂM SỐ: Tổng điểm của câu phải luôn bằng tổng điểm các ý (question.points == SUM(sub_items.points)).
   - Mỗi ý phải có metadata riêng: cognitive_level, points, question_text, expected_answer, scoring_rubric.
   - CÁC Ý TRONG CÂU PHÁT TRIỂN TỪ TÌNH HUỐNG/DỮ KIỆN CHUNG, có sự tăng tiến về mức độ nhận thức (ý a thường là vận dụng/tính toán cơ bản, ý b hoặc c là vận dụng cao/biện luận). Tuyệt đối không chia ý hình thức hay lặp lại cùng thao tác tính toán.

QUY ĐỊNH BẮT BUỘC THEO ĐẶC THÙ MÔN HỌC:
1. ĐỐI VỚI MÔN TOÁN:
   - Các công thức toán BẮT BUỘC định dạng LaTeX $...$ hoặc $$...$$
   - Phần I: Trắc nghiệm 4 lựa chọn (chỉ 1 phương án đúng).
   - Phần II: Đúng/Sai (Mỗi câu gồm 1 tình huống và đúng ${statementsCount} ý độc lập, ghi rõ Đúng hay Sai).
   - Phần III: Trả lời ngắn (Chỉ điền số hoặc phân số tối giản).
   - Phần IV: Tự luận (Cấu trúc 1-3 ý độc lập, có rubric chi tiết 0.25đ / 0.5đ).

2. ĐỐI VỚI MÔN NGỮ VĂN:
   - Phần I: ĐỌC HIỂU (4,0 - 5,0 điểm). BẮT BUỘC lấy ngữ liệu mới NGOÀI sách giáo khoa (ghi rõ nguồn dẫn tác giả, tác phẩm).
   - Phần II: VIẾT (5,0 - 6,0 điểm). Gồm các câu tự luận (Ví dụ câu viết đoạn văn NLXH, câu viết bài văn NLVH) với cấu trúc 1-2 ý hoặc theo yêu cầu, KÈM RUBRIC CHẤM 0.25đ - 0.5đ.

3. ĐỐI VỚI TIẾNG ANH:
   - Authentic English, không dùng tiếng Anh dịch thô.
   - Kiểm tra phát âm (gạch chân phần phát âm), từ vựng theo ngữ cảnh, đọc hiểu, viết câu.

YÊU CẦU ĐẦU RA (ĐỊNH DẠNG JSON DUY NHẤT):
Trả về đối tượng JSON với cấu trúc:
{
  "exam": {
    "title": "Tiêu đề đề thi",
    "subject": "${subject}",
    "grade": ${grade},
    "duration_minutes": ${duration},
    "total_score": 10.0,
    "instructions": "Hướng dẫn làm bài..."
  },
  "questions": [
    {
      "id": "q-1",
      "exam_part": 1,
      "question_order": 1,
      "question_type": "single_choice" | "true_false" | "short_answer" | "essay",
      "topic": "Chủ đề",
      "content_unit": "Đơn vị bài học",
      "cognitive_level": "recognition" | "comprehension" | "application" | "advanced_application",
      "is_advanced_application": false,
      "points": 0.25,
      "content": "Nội dung câu hỏi...",
      "options": [
        { "id": "a", "content": "Phương án A", "is_correct": true, "option_order": 1 },
        { "id": "b", "content": "Phương án B", "is_correct": false, "option_order": 2 },
        { "id": "c", "content": "Phương án C", "is_correct": false, "option_order": 3 },
        { "id": "d", "content": "Phương án D", "is_correct": false, "option_order": 4 }
      ],
      "statements": [
${sampleStatementsJson}
      ],
      "short_answer": {
        "normalized_answer": "Đáp số ngắn",
        "accepted_variants": ["đáp số"]
      },
      "intro_text": "Tình huống/bối cảnh chung cho câu tự luận (nếu có)",
      "sub_items": [
        {
          "item_number": "a",
          "points": 1.0,
          "cognitive_level": "application",
          "question_text": "Nội dung câu hỏi cho ý a...",
          "expected_answer": "Hướng dẫn giải chi tiết cho ý a...",
          "scoring_rubric": [
            { "id": "r1", "criterion": "Tiêu chí 1", "points": 0.5 },
            { "id": "r2", "criterion": "Tiêu chí 2", "points": 0.5 }
          ]
        }
      ],
      "essay_rubric": [
        { "id": "r1", "criterion": "Tiêu chí 1", "points": 0.5 },
        { "id": "r2", "criterion": "Tiêu chí 2", "points": 1.0 }
      ],
      "explanation": "Lời giải / hướng dẫn chấm chi tiết"
    }
  ]
}
`;

    const { text: responseText, model: usedModel } = await callGeminiWithFallback(ai, prompt);

    const parsedData = safeParseAIJson(responseText);

    return res.json({
      success: true,
      ...parsedData,
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
