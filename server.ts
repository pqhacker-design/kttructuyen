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

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

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
${customPrompt ? `- Yêu cầu bổ sung của giáo viên: ${customPrompt}` : ''}

CẤU TRÚC ĐỀ VÀ THANG ĐIỂM (BẮT BUỘC TỔNG ĐIỂM = 10,0 ĐIỂM):
${JSON.stringify(structure, null, 2)}

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

    // Clean any markdown code blocks if present
    let cleanedJson = responseText.trim();
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanedJson);

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

    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
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
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
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
