import { ExamStructureConfig, ExamFormatType, HybridRatioType, SubjectCode, ExamPartConfig } from '../types/aiExam';
import { ExamValidator } from './examValidator';

export interface ExamFormatPreset {
  id: string;
  name: string;
  format: ExamFormatType;
  ratio?: HybridRatioType;
  description: string;
  badge: string;
  parts: ExamPartConfig[];
  cognitiveDistribution: {
    recognition: number;
    comprehension: number;
    application: number;
    advanced_application: number;
  };
}

/**
 * Detect current format based on enabled parts and points
 */
export function detectExamFormat(structure: ExamStructureConfig): ExamFormatType {
  if (structure.examFormat) return structure.examFormat;

  const essayPart = structure.parts.find((p) => p.part === 4 && p.enabled && p.totalPoints > 0 && p.questionCount > 0);
  const mcParts = structure.parts.filter((p) => p.part !== 4 && p.enabled && p.totalPoints > 0 && p.questionCount > 0);

  if (essayPart && mcParts.length === 0) {
    return 'essay_only';
  }
  if (!essayPart && mcParts.length > 0) {
    return 'multiple_choice_only';
  }
  return 'hybrid';
}

/**
 * Get detailed stats and labels for exam format
 */
export function getExamFormatInfo(structure: ExamStructureConfig) {
  const format = structure.examFormat || detectExamFormat(structure);

  const essayPart = structure.parts.find((p) => p.part === 4 && p.enabled);
  const essayPoints = essayPart ? ExamValidator.round2(essayPart.totalPoints) : 0;
  const mcParts = structure.parts.filter((p) => p.part !== 4 && p.enabled);
  const mcPoints = ExamValidator.round2(mcParts.reduce((sum, p) => sum + p.totalPoints, 0));

  const mcPercent = Math.round((mcPoints / 10.0) * 100);
  const essayPercent = Math.round((essayPoints / 10.0) * 100);

  let label = 'Trắc nghiệm + Tự luận';
  let shortDescription = 'Đề kết hợp Trắc nghiệm khách quan và Tự luận (Chuẩn CV 7991)';
  let badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';

  if (format === 'multiple_choice_only') {
    label = 'Trắc nghiệm 100%';
    shortDescription = 'Toàn bộ 10,0 điểm là câu trắc nghiệm (Phần I, II, III). Không có tự luận.';
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (format === 'essay_only') {
    label = 'Tự luận 100%';
    shortDescription = 'Toàn bộ 10,0 điểm là câu tự luận có rubric hướng dẫn chấm. Không có trắc nghiệm.';
    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
  } else {
    label = `Trắc nghiệm + Tự luận (${mcPercent}/${essayPercent})`;
    shortDescription = `Đề phối hợp ${mcPercent}% Trắc nghiệm (${mcPoints}đ) và ${essayPercent}% Tự luận (${essayPoints}đ)`;
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  return {
    format,
    label,
    mcPoints,
    essayPoints,
    mcPercent,
    essayPercent,
    shortDescription,
    badgeColor,
  };
}

/**
 * Build presets for a given format
 */
export function getFormatPresets(
  format: ExamFormatType,
  subjectId: SubjectCode = 'toan'
): ExamFormatPreset[] {
  if (format === 'multiple_choice_only') {
    return [
      {
        id: 'mc-cv7991-standard',
        name: 'Chuẩn Công văn 7991 mới (3 Phần TN)',
        format: 'multiple_choice_only',
        description: 'Phần I (12 câu - 3đ) + Phần II Đúng/Sai (4 câu - 4đ) + Phần III Trả lời ngắn (6 câu - 3đ)',
        badge: 'Phổ biến nhất',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
            description: 'Mỗi câu hỏi có 4 phương án, chỉ có 1 phương án đúng.',
            enabled: true,
            questionCount: 12,
            pointsPerQuestion: 0.25,
            totalPoints: 3.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
            description: 'Mỗi câu có 4 ý a, b, c, d. Đúng/Sai cho từng ý.',
            enabled: true,
            questionCount: 4,
            pointsPerQuestion: 1.0,
            statementsPerQuestion: 4,
            pointsPerStatement: 0.25,
            totalPoints: 4.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Câu hỏi trắc nghiệm dạng trả lời ngắn',
            description: 'Thí sinh tự tính toán và điền đáp số ngắn.',
            enabled: true,
            questionCount: 6,
            pointsPerQuestion: 0.5,
            totalPoints: 3.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Câu hỏi tự luận',
            description: 'Đã tắt cho đề 100% trắc nghiệm.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
        ],
        cognitiveDistribution: {
          recognition: 3.0,
          comprehension: 4.0,
          application: 2.0,
          advanced_application: 1.0,
        },
      },
      {
        id: 'mc-40-questions',
        name: 'Trắc nghiệm truyền thống 40 câu (100% Nhiều lựa chọn)',
        format: 'multiple_choice_only',
        description: '40 câu trắc nghiệm 4 lựa chọn A, B, C, D (0.25đ / câu = 10,0 điểm)',
        badge: 'Kỳ thi THPT QG',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (40 câu)',
            description: '40 câu hỏi trắc nghiệm 4 lựa chọn, mỗi câu 0.25 điểm.',
            enabled: true,
            questionCount: 40,
            pointsPerQuestion: 0.25,
            totalPoints: 10.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Câu hỏi trả lời ngắn',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Tự luận',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
        ],
        cognitiveDistribution: {
          recognition: 4.0,
          comprehension: 3.0,
          application: 2.0,
          advanced_application: 1.0,
        },
      },
      {
        id: 'mc-10-questions-15m',
        name: 'Trắc nghiệm 10 câu (Kiểm tra 15 phút)',
        format: 'multiple_choice_only',
        description: '10 câu trắc nghiệm nhiều lựa chọn (1.0đ / câu = 10,0 điểm), phù hợp kiểm tra nhanh 15 phút',
        badge: '15 phút',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (10 câu)',
            description: '10 câu hỏi trắc nghiệm 4 lựa chọn, mỗi câu 1.0 điểm.',
            enabled: true,
            questionCount: 10,
            pointsPerQuestion: 1.0,
            totalPoints: 10.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Câu hỏi trả lời ngắn',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Tự luận',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
        ],
        cognitiveDistribution: {
          recognition: 5.0,
          comprehension: 4.0,
          application: 1.0,
          advanced_application: 0.0,
        },
      },
      {
        id: 'mc-20-questions',
        name: 'Trắc nghiệm 20 câu (Kiểm tra 1 tiết / 45 phút)',
        format: 'multiple_choice_only',
        description: '20 câu trắc nghiệm nhiều lựa chọn (0.50đ / câu = 10,0 điểm)',
        badge: 'Gọn nhẹ',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn (20 câu)',
            description: '20 câu hỏi trắc nghiệm 4 lựa chọn, mỗi câu 0.50 điểm.',
            enabled: true,
            questionCount: 20,
            pointsPerQuestion: 0.5,
            totalPoints: 10.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Câu hỏi trả lời ngắn',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Tự luận',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
        ],
        cognitiveDistribution: {
          recognition: 4.0,
          comprehension: 4.0,
          application: 2.0,
          advanced_application: 0.0,
        },
      },
      {
        id: 'mc-thcs-balanced',
        name: 'Trắc nghiệm kết hợp THCS (Phần I + II + III)',
        format: 'multiple_choice_only',
        description: 'Phần I (16 câu - 4đ) + Phần II Đúng/Sai (3 câu - 3đ) + Phần III Trả lời ngắn (6 câu - 3đ)',
        badge: 'THCS',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
            description: '16 câu hỏi trắc nghiệm 4 lựa chọn (0.25đ / câu = 4.0đ).',
            enabled: true,
            questionCount: 16,
            pointsPerQuestion: 0.25,
            totalPoints: 4.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
            description: '3 câu hỏi Đúng/Sai (1.0đ / câu = 3.0đ).',
            enabled: true,
            questionCount: 3,
            pointsPerQuestion: 1.0,
            statementsPerQuestion: 4,
            pointsPerStatement: 0.25,
            totalPoints: 3.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Câu hỏi trắc nghiệm dạng trả lời ngắn',
            description: '6 câu hỏi trả lời ngắn (0.50đ / câu = 3.0đ).',
            enabled: true,
            questionCount: 6,
            pointsPerQuestion: 0.5,
            totalPoints: 3.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Tự luận',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
        ],
        cognitiveDistribution: {
          recognition: 4.0,
          comprehension: 3.0,
          application: 2.0,
          advanced_application: 1.0,
        },
      },
    ];
  }

  if (format === 'essay_only') {
    const isLit = subjectId === 'ngu_van';
    return [
      {
        id: 'essay-lit-standard',
        name: isLit ? 'Ngữ văn: Đọc hiểu (4đ) + Viết (6đ)' : 'Tự luận 2 câu (4đ + 6đ)',
        format: 'essay_only',
        description: isLit 
          ? 'Câu 1 Đọc hiểu văn bản ngoài SGK (4.0đ) + Câu 2 Viết đoạn văn/bài văn (6.0đ)'
          : 'Câu 1 Tự luận cơ bản/vận dụng (4.0đ) + Câu 2 Bài toán vận dụng cao/tổng hợp (6.0đ)',
        badge: isLit ? 'Chuẩn Ngữ văn' : '2 câu',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
            description: 'Đã tắt cho đề 100% tự luận.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Đúng - Sai',
            description: 'Đã tắt cho đề 100% tự luận.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Trả lời ngắn',
            description: 'Đã tắt cho đề 100% tự luận.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Câu hỏi tự luận',
            description: '2 câu hỏi tự luận với rubric chấm chi tiết (Tổng 10,0 điểm).',
            enabled: true,
            questionCount: 2,
            totalPoints: 10.0,
            allowedSubItemCounts: [1, 2, 3],
            essayQuestions: [
              {
                id: 'essay-1',
                questionOrder: 1,
                title: isLit ? 'Phần I: ĐỌC HIỂU (Ngữ liệu ngoài SGK)' : 'Câu 1: Vận dụng kiến thức cơ sở & giải bài toán',
                cognitiveLevel: 'comprehension',
                points: 4.0,
                subItemCount: 3,
              },
              {
                id: 'essay-2',
                questionOrder: 2,
                title: isLit ? 'Phần II: LÀM VĂN (Viết đoạn văn NLXH & NLVH)' : 'Câu 2: Bài toán thực tế / Vận dụng cao',
                cognitiveLevel: 'application',
                isAdvancedApplication: true,
                points: 6.0,
                subItemCount: 2,
              },
            ],
          },
        ],
        cognitiveDistribution: {
          recognition: 2.0,
          comprehension: 3.0,
          application: 3.0,
          advanced_application: 2.0,
        },
      },
      {
        id: 'essay-3-questions',
        name: 'Tự luận 3 câu (3đ + 3đ + 4đ)',
        format: 'essay_only',
        description: '3 câu tự luận phân bậc: Câu 1 (3đ) + Câu 2 (3đ) + Câu 3 Vận dụng cao (4đ)',
        badge: 'Phổ biến',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I: Trắc nghiệm',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II: Đúng - Sai',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III: Trả lời ngắn',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Câu hỏi tự luận',
            description: '3 câu tự luận trình bày chi tiết (Tổng 10,0 điểm).',
            enabled: true,
            questionCount: 3,
            totalPoints: 10.0,
            allowedSubItemCounts: [1, 2, 3],
            essayQuestions: [
              {
                id: 'essay-1',
                questionOrder: 1,
                title: 'Câu 1: Nhận biết & Thông hiểu (3.0 điểm)',
                cognitiveLevel: 'comprehension',
                points: 3.0,
              },
              {
                id: 'essay-2',
                questionOrder: 2,
                title: 'Câu 2: Vận dụng tình huống (3.0 điểm)',
                cognitiveLevel: 'application',
                points: 3.0,
              },
              {
                id: 'essay-3',
                questionOrder: 3,
                title: 'Câu 3: Vận dụng cao / Biện luận nâng cao (4.0 điểm)',
                cognitiveLevel: 'advanced_application',
                isAdvancedApplication: true,
                points: 4.0,
              },
            ],
          },
        ],
        cognitiveDistribution: {
          recognition: 2.0,
          comprehension: 3.0,
          application: 3.0,
          advanced_application: 2.0,
        },
      },
      {
        id: 'essay-4-questions',
        name: 'Tự luận 4 câu đều (2.5đ x 4 câu)',
        format: 'essay_only',
        description: '4 câu tự luận đồng đều điểm số (Mỗi câu 2.50 điểm = 10,0 điểm)',
        badge: 'Toán / KHTN',
        parts: [
          {
            part: 1,
            type: 'multiple_choice',
            title: 'Phần I',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 2,
            type: 'true_false',
            title: 'Phần II',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 3,
            type: 'short_answer',
            title: 'Phần III',
            description: 'Đã tắt.',
            enabled: false,
            questionCount: 0,
            totalPoints: 0.0,
          },
          {
            part: 4,
            type: 'essay',
            title: 'Phần IV: Câu hỏi tự luận',
            description: '4 câu hỏi tự luận theo ma trận kiến thức (Tổng 10,0 điểm).',
            enabled: true,
            questionCount: 4,
            totalPoints: 10.0,
            allowedSubItemCounts: [1, 2, 3],
          },
        ],
        cognitiveDistribution: {
          recognition: 2.5,
          comprehension: 3.0,
          application: 3.0,
          advanced_application: 1.5,
        },
      },
    ];
  }

  // format === 'hybrid' (Trắc nghiệm + Tự luận)
  return [
    {
      id: 'hybrid-70-30',
      name: 'Tỷ lệ 70% Trắc nghiệm + 30% Tự luận (Chuẩn CV 7991)',
      format: 'hybrid',
      ratio: '70_30',
      description: 'Trắc nghiệm 7.0đ (Phần I: 3đ, Phần II: 2đ, Phần III: 2đ) + Tự luận 3.0đ (2 câu)',
      badge: 'Chuẩn Bộ GD&ĐT',
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          description: 'Mỗi câu hỏi có 4 phương án, chỉ có 1 phương án đúng.',
          enabled: true,
          questionCount: 12,
          pointsPerQuestion: 0.25,
          totalPoints: 3.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          description: 'Mỗi câu có 4 ý a, b, c, d. Đúng/Sai cho từng ý.',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          statementsPerQuestion: 4,
          pointsPerStatement: 0.25,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi trắc nghiệm dạng trả lời ngắn',
          description: 'Thí sinh tự tính toán và ghi kết quả ngắn.',
          enabled: true,
          questionCount: 4,
          pointsPerQuestion: 0.5,
          totalPoints: 2.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Câu hỏi tự luận',
          description: '2 câu tự luận (Câu 1: 2.0đ, Câu 2 Vận dụng cao: 1.0đ).',
          enabled: true,
          questionCount: 2,
          totalPoints: 3.0,
          allowedSubItemCounts: [1, 2, 3],
          essayQuestions: [
            {
              id: 'essay-1',
              questionOrder: 1,
              title: 'Bài toán vận dụng thực tế',
              cognitiveLevel: 'application',
              points: 2.0,
            },
            {
              id: 'essay-2',
              questionOrder: 2,
              title: 'Bài toán tư duy nâng cao (Vận dụng cao)',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 1.0,
            },
          ],
        },
      ],
      cognitiveDistribution: {
        recognition: 3.0,
        comprehension: 3.0,
        application: 3.0,
        advanced_application: 1.0,
      },
    },
    {
      id: 'hybrid-50-50',
      name: 'Tỷ lệ 50% Trắc nghiệm + 50% Tự luận (Chuẩn THCS)',
      format: 'hybrid',
      ratio: '50_50',
      description: 'Trắc nghiệm 5.0đ (Phần I: 3đ, Phần II: 2đ) + Tự luận 5.0đ (2-3 câu)',
      badge: 'Chuẩn THCS',
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          description: '12 câu trắc nghiệm (0.25đ / câu = 3.0đ).',
          enabled: true,
          questionCount: 12,
          pointsPerQuestion: 0.25,
          totalPoints: 3.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          description: '2 câu trắc nghiệm Đúng/Sai (1.0đ / câu = 2.0đ).',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          statementsPerQuestion: 4,
          pointsPerStatement: 0.25,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi trả lời ngắn',
          description: 'Đã tắt cho tỉ lệ 50/50.',
          enabled: false,
          questionCount: 0,
          totalPoints: 0.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Câu hỏi tự luận',
          description: 'Tự luận 5.0 điểm (2 câu: Câu 1: 3.0đ, Câu 2: 2.0đ).',
          enabled: true,
          questionCount: 2,
          totalPoints: 5.0,
          allowedSubItemCounts: [1, 2, 3],
          essayQuestions: [
            {
              id: 'essay-1',
              questionOrder: 1,
              title: 'Bài toán tự luận 1 (Vận dụng)',
              cognitiveLevel: 'application',
              points: 3.0,
            },
            {
              id: 'essay-2',
              questionOrder: 2,
              title: 'Bài toán tự luận 2 (Vận dụng cao)',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 2.0,
            },
          ],
        },
      ],
      cognitiveDistribution: {
        recognition: 3.0,
        comprehension: 3.0,
        application: 3.0,
        advanced_application: 1.0,
      },
    },
    {
      id: 'hybrid-60-40',
      name: 'Tỷ lệ 60% Trắc nghiệm + 40% Tự luận',
      format: 'hybrid',
      ratio: '60_40',
      description: 'Trắc nghiệm 6.0đ (Phần I: 3đ, Phần II: 2đ, Phần III: 1đ) + Tự luận 4.0đ (2 câu)',
      badge: 'Cân đối',
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          description: '12 câu trắc nghiệm (0.25đ / câu = 3.0đ).',
          enabled: true,
          questionCount: 12,
          pointsPerQuestion: 0.25,
          totalPoints: 3.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          description: '2 câu Đúng/Sai (1.0đ / câu = 2.0đ).',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          statementsPerQuestion: 4,
          pointsPerStatement: 0.25,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi trắc nghiệm dạng trả lời ngắn',
          description: '2 câu trả lời ngắn (0.5đ / câu = 1.0đ).',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 0.5,
          totalPoints: 1.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Câu hỏi tự luận',
          description: 'Tự luận 4.0 điểm (2 câu: 2.5đ và 1.5đ).',
          enabled: true,
          questionCount: 2,
          totalPoints: 4.0,
          allowedSubItemCounts: [1, 2, 3],
          essayQuestions: [
            {
              id: 'essay-1',
              questionOrder: 1,
              title: 'Bài toán tự luận 1',
              cognitiveLevel: 'application',
              points: 2.5,
            },
            {
              id: 'essay-2',
              questionOrder: 2,
              title: 'Bài toán tự luận 2 (Nâng cao)',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 1.5,
            },
          ],
        },
      ],
      cognitiveDistribution: {
        recognition: 3.0,
        comprehension: 3.0,
        application: 3.0,
        advanced_application: 1.0,
      },
    },
    {
      id: 'hybrid-80-20',
      name: 'Tỷ lệ 80% Trắc nghiệm + 20% Tự luận',
      format: 'hybrid',
      ratio: '80_20',
      description: 'Trắc nghiệm 8.0đ (Phần I: 4đ, Phần II: 2đ, Phần III: 2đ) + Tự luận 2.0đ (1 câu thực tiễn)',
      badge: 'Nhanh gọn',
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          description: '16 câu trắc nghiệm (0.25đ / câu = 4.0đ).',
          enabled: true,
          questionCount: 16,
          pointsPerQuestion: 0.25,
          totalPoints: 4.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          description: '2 câu Đúng/Sai (1.0đ / câu = 2.0đ).',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          statementsPerQuestion: 4,
          pointsPerStatement: 0.25,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi trắc nghiệm dạng trả lời ngắn',
          description: '4 câu trả lời ngắn (0.5đ / câu = 2.0đ).',
          enabled: true,
          questionCount: 4,
          pointsPerQuestion: 0.5,
          totalPoints: 2.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Câu hỏi tự luận',
          description: '1 câu tự luận tổng hợp thực tế (2.0 điểm).',
          enabled: true,
          questionCount: 1,
          totalPoints: 2.0,
          allowedSubItemCounts: [1, 2, 3],
          essayQuestions: [
            {
              id: 'essay-1',
              questionOrder: 1,
              title: 'Bài toán tự luận thực tiễn',
              cognitiveLevel: 'application',
              points: 2.0,
            },
          ],
        },
      ],
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.0,
        advanced_application: 1.0,
      },
    },
  ];
}

/**
 * Apply exam format to an existing structure
 */
export function applyExamFormat(
  currentStructure: ExamStructureConfig,
  format: ExamFormatType,
  ratio: HybridRatioType = '70_30',
  subjectId: SubjectCode = 'toan'
): ExamStructureConfig {
  const presets = getFormatPresets(format, subjectId);

  // Pick the most appropriate preset
  let matchedPreset = presets[0];
  if (format === 'hybrid') {
    matchedPreset = presets.find((p) => p.ratio === ratio) || presets[0];
  }

  return {
    ...currentStructure,
    totalScore: 10.0,
    examFormat: format,
    hybridRatio: ratio,
    parts: JSON.parse(JSON.stringify(matchedPreset.parts)),
    cognitiveDistribution: JSON.parse(JSON.stringify(matchedPreset.cognitiveDistribution)),
    allowAdvancedApplication: true,
  };
}
