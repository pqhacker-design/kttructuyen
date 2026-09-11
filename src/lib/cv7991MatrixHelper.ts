/**
 * Helper module for generating Official Assessment Matrix & Specification Table
 * compliant strictly with Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ GDĐT
 */

import { GeneratedAIQuestion, MatrixCellSpecification, ExamStructureConfig, SubjectCode } from '../types/aiExam';
import { escapeXml, createWordParagraph, parseTextToWordRuns, createWordTable, createWordTableRow, createWordTableCell } from '../services/docxExportService';
import { SubjectRuleEngine } from './subjectRuleEngine';

export function resolveSubjectProfile(rawSubject?: string): { code: SubjectCode; name: string } {
  if (!rawSubject) return { code: 'toan', name: 'Toán học' };
  const s = rawSubject.toLowerCase().trim();
  if (s === 'toan' || s.includes('toán')) return { code: 'toan', name: 'Toán học' };
  if (s === 'ngu_van' || s === 'van' || s.includes('văn')) return { code: 'ngu_van', name: 'Ngữ văn' };
  if (s === 'tieng_anh' || s === 'anh' || s.includes('anh')) return { code: 'tieng_anh', name: 'Tiếng Anh' };
  if (s === 'vat_ly' || s === 'ly' || s.includes('lý') || s.includes('vật lí') || s.includes('vật lý')) return { code: 'vat_ly', name: 'Vật lí' };
  if (s === 'hoa_hoc' || s === 'hoa' || s.includes('hóa')) return { code: 'hoa_hoc', name: 'Hóa học' };
  if (s === 'sinh_hoc' || s === 'sinh' || s.includes('sinh')) return { code: 'sinh_hoc', name: 'Sinh học' };
  if (s === 'lich_su' || s === 'su' || s.includes('sử')) return { code: 'lich_su', name: 'Lịch sử' };
  if (s === 'dia_ly' || s === 'dia' || s.includes('địa')) return { code: 'dia_ly', name: 'Địa lí' };
  if (s === 'gdcd' || s.includes('công dân') || s.includes('kinh tế và pháp luật') || s.includes('ktpl') || s === 'gdcd_gdktpl') return { code: 'gdcd_gdktpl', name: 'Giáo dục công dân' };
  if (s === 'tin_hoc' || s === 'tin' || s.includes('tin')) return { code: 'tin_hoc', name: 'Tin học' };
  if (s === 'cong_nghe' || s.includes('công nghệ')) return { code: 'cong_nghe', name: 'Công nghệ' };
  return { code: 'toan', name: rawSubject };
}

export interface CV7991MatrixRow {
  tt: number;
  topic: string;
  contentUnit: string;
  // TNKQ Nhiều lựa chọn
  mc_rec: number;
  mc_com: number;
  mc_app: number;
  // TNKQ Đúng - Sai
  tf_rec: number;
  tf_com: number;
  tf_app: number;
  // TNKQ Trả lời ngắn
  sa_rec: number;
  sa_com: number;
  sa_app: number;
  // Tự luận
  essay_rec: number;
  essay_com: number;
  essay_app: number;
  // Tổng theo hàng
  total_rec: number;
  total_com: number;
  total_app: number;
  total_points: number;
  percentage: number;
  // References
  questions_rec: string[];
  questions_com: string[];
  questions_app: string[];
}

export interface CV7991SpecLevelItem {
  requirement: string;
  // Counts and question indicators
  mc_count: number;
  mc_questions: string;
  tf_count: number;
  tf_questions: string;
  sa_count: number;
  sa_questions: string;
  essay_count: number;
  essay_questions: string;
}

export interface CV7991SpecRow {
  tt: number;
  topic: string;
  contentUnit: string;
  recognition: CV7991SpecLevelItem;
  comprehension: CV7991SpecLevelItem;
  application: CV7991SpecLevelItem;
}

export interface CV7991Summary {
  counts: {
    mc_rec: number;
    mc_com: number;
    mc_app: number;
    mc_total: number;
    tf_rec: number;
    tf_com: number;
    tf_app: number;
    tf_total: number;
    sa_rec: number;
    sa_com: number;
    sa_app: number;
    sa_total: number;
    essay_rec: number;
    essay_com: number;
    essay_app: number;
    essay_total: number;
    total_rec: number;
    total_com: number;
    total_app: number;
    grand_total_questions: number;
  };
  points: {
    mc_total: number;
    tf_total: number;
    sa_total: number;
    essay_total: number;
    total_rec: number;
    total_com: number;
    total_app: number;
    grand_total_points: number;
  };
  percentages: {
    mc_total: number;
    tf_total: number;
    sa_total: number;
    essay_total: number;
    total_rec: number;
    total_com: number;
    total_app: number;
    grand_total_percentage: number;
  };
}

export interface CV7991Data {
  title: string;
  subject: string;
  grade: number;
  term?: string;
  durationMinutes: number;
  rows: CV7991MatrixRow[];
  specRows: CV7991SpecRow[];
  summary: CV7991Summary;
}

export type CV7991ExportData = CV7991Data;

/**
 * Standard pedagogical learning objectives based on subject and topic
 */
function getStandardRequirement(level: 'recognition' | 'comprehension' | 'application', topic: string, contentUnit: string): string {
  if (level === 'recognition') {
    return `- Nhận biết, phát biểu, liệt kê được các định nghĩa, khái niệm, tính chất hoặc quy tắc cơ bản liên quan đến ${contentUnit || topic}.\n- Nhận dạng và đọc đúng các kí hiệu, dữ liệu hoặc công thức nền tảng trong nội dung bài học.`;
  }
  if (level === 'comprehension') {
    return `- Giải thích, phân biệt, làm rõ bản chất và mối liên hệ giữa các khái niệm, đại lượng trong ${contentUnit || topic}.\n- Trình bày được các bước suy luận trực tiếp, phân tích hiện tượng và tính toán cơ sở theo quy chuẩn.`;
  }
  return `- Vận dụng kiến thức, kĩ năng đã học để giải quyết bài toán, hiện tượng, mô hình tình huống thực tế hoặc bài tập phân hóa thuộc ${contentUnit || topic}.\n- Đánh giá, tổng hợp và biện luận kết quả xử lý.`;
}

/**
 * Process inputs to build fully standardized CV 7991 data
 */
export function buildCV7991Data(params: {
  title?: string;
  subject?: string;
  grade?: number;
  term?: string;
  durationMinutes?: number;
  questions?: GeneratedAIQuestion[] | any[];
  matrixCells?: MatrixCellSpecification[];
  structure?: ExamStructureConfig;
  topics?: string[];
  matrix?: any;
}): CV7991Data {
  const {
    title = 'Đề kiểm tra định kì',
    subject = 'Toán học',
    grade = 10,
    term = 'Giữa kì',
    durationMinutes = 90,
    questions = [],
    matrixCells = [],
    structure,
    topics = [],
    matrix,
  } = params;

  // Resolve subject name and code
  const { code: subjCode, name: resolvedSubjectName } = resolveSubjectProfile(subject);
  const normalizedSubject = (subject && subject !== 'toan' && subject !== 'ngu_van' && subject !== 'tieng_anh' && subject !== 'vat_ly' && subject !== 'hoa_hoc' && subject !== 'sinh_hoc' && subject !== 'lich_su' && subject !== 'dia_ly' && subject !== 'gdcd' && subject !== 'tin_hoc' && subject !== 'cong_nghe')
    ? subject
    : resolvedSubjectName;

  const curriculumList = SubjectRuleEngine.getCurriculumTopics(subjCode, grade) || [];

  const isGenericTopic = (t?: string): boolean => {
    if (!t) return true;
    const s = t.trim().toLowerCase();
    return (
      s === '' ||
      s === 'tổng hợp' ||
      s === 'chủ đề trọng tâm' ||
      /^chủ đề\s*\d+$/i.test(s) ||
      /^topic\s*\d+$/i.test(s) ||
      /^chương\s*\d+$/i.test(s) ||
      /^bài\s*\d+$/i.test(s)
    );
  };

  const isGenericUnit = (u?: string): boolean => {
    if (!u) return true;
    const s = u.trim().toLowerCase();
    return (
      s === '' ||
      /^đơn vị kiến thức\s*\d+$/i.test(s) ||
      s.startsWith('đơn vị kiến thức trọng tâm') ||
      /^nội dung\s*\d+$/i.test(s)
    );
  };

  // Helper to determine question type from item or question
  const detectQuestionType = (item: any): 'mc' | 'tf' | 'sa' | 'essay' => {
    if (item.exam_part === 1) return 'mc';
    if (item.exam_part === 2) return 'tf';
    if (item.exam_part === 3) return 'sa';
    if (item.exam_part === 4) return 'essay';
    const t = String(item.question_type || item.type || '').toLowerCase();
    if (t.includes('true_false') || t.includes('dung_sai') || t.includes('đúng sai')) return 'tf';
    if (t.includes('short_answer') || t.includes('ngan') || t.includes('ngắn')) return 'sa';
    if (t.includes('essay') || t.includes('tu_luan') || t.includes('tự luận')) return 'essay';
    return 'mc';
  };

  // Helper to determine cognitive tier from item or question
  const detectCognitiveTier = (item: any): 'rec' | 'com' | 'app' => {
    const raw = String(item.cognitive_level || item.difficulty || '').trim().toLowerCase();
    if (raw.includes('rec') || raw.includes('nhan') || raw.includes('nhận') || raw.includes('biet') || raw.includes('biết') || raw === 'easy') {
      return 'rec';
    }
    if (raw.includes('com') || raw.includes('thong') || raw.includes('thông') || raw.includes('hieu') || raw.includes('hiểu') || raw === 'medium') {
      return 'com';
    }
    if (raw.includes('app') || raw.includes('dung') || raw.includes('dụng') || raw.includes('cao') || raw === 'hard') {
      return 'app';
    }
    return 'rec';
  };

  // Find effective matrix cells if passed in params.matrix or params.matrixCells
  let rawCells: any[] = [];
  if (Array.isArray(matrixCells) && matrixCells.length > 0) {
    rawCells = matrixCells;
  } else if (Array.isArray(matrix) && matrix.length > 0) {
    rawCells = matrix as any[];
  } else if ((matrix as any)?.cells && Array.isArray((matrix as any).cells) && (matrix as any).cells.length > 0) {
    rawCells = (matrix as any).cells;
  } else if ((matrix as any)?.items && Array.isArray((matrix as any).items) && (matrix as any).items.length > 0) {
    rawCells = (matrix as any).items;
  }

  // Unified topic cell storage
  interface UnifiedTopicCell {
    topic: string;
    contentUnit: string;
    requirement?: string;
    cellId?: string;
    mc_rec: number;
    mc_com: number;
    mc_app: number;
    tf_rec: number;
    tf_com: number;
    tf_app: number;
    sa_rec: number;
    sa_com: number;
    sa_app: number;
    essay_rec: number;
    essay_com: number;
    essay_app: number;
    hasExplicitCounts: boolean;
  }

  const topicCellMap = new Map<string, UnifiedTopicCell>();

  if (rawCells && rawCells.length > 0) {
    rawCells.forEach((c: any, cIdx: number) => {
      let t = (c.topic || '').trim();
      if (isGenericTopic(t)) {
        if (curriculumList.length > 0) {
          t = curriculumList[cIdx % curriculumList.length].topic;
        } else {
          t = `Chương ${cIdx + 1}: Nội dung trọng tâm môn ${normalizedSubject}`;
        }
      }

      let cu = (c.content_unit || c.subtopic || '').trim();
      if (isGenericUnit(cu) || cu === t) {
        const matchedCurr = curriculumList.find((cur) => cur.topic === t || t.includes(cur.topic) || cur.topic.includes(t));
        if (matchedCurr && matchedCurr.units.length > 0) {
          cu = matchedCurr.units.join('; ');
        } else {
          cu = `Nội dung cốt lõi: ${t}`;
        }
      }

      let cellRecord = topicCellMap.get(t);
      if (!cellRecord) {
        cellRecord = {
          topic: t,
          contentUnit: cu,
          requirement: c.learning_requirement,
          cellId: c.id,
          mc_rec: 0,
          mc_com: 0,
          mc_app: 0,
          tf_rec: 0,
          tf_com: 0,
          tf_app: 0,
          sa_rec: 0,
          sa_com: 0,
          sa_app: 0,
          essay_rec: 0,
          essay_com: 0,
          essay_app: 0,
          hasExplicitCounts: false,
        };
        topicCellMap.set(t, cellRecord);
      } else {
        if (!cellRecord.contentUnit && cu) cellRecord.contentUnit = cu;
        if (!cellRecord.requirement && c.learning_requirement) cellRecord.requirement = c.learning_requirement;
      }

      // Check if c is a MatrixCellSpecification
      const isSpecCell =
        c.mc_rec !== undefined ||
        c.mc_com !== undefined ||
        c.mc_app !== undefined ||
        c.tf_rec !== undefined ||
        c.tf_com !== undefined ||
        c.tf_app !== undefined ||
        c.sa_rec !== undefined ||
        c.sa_com !== undefined ||
        c.sa_app !== undefined ||
        c.essay_rec !== undefined ||
        c.essay_com !== undefined ||
        c.essay_app !== undefined;

      if (isSpecCell) {
        const rowSum =
          Number(c.mc_rec || 0) +
          Number(c.mc_com || 0) +
          Number(c.mc_app || 0) +
          Number(c.tf_rec || 0) +
          Number(c.tf_com || 0) +
          Number(c.tf_app || 0) +
          Number(c.sa_rec || 0) +
          Number(c.sa_com || 0) +
          Number(c.sa_app || 0) +
          Number(c.essay_rec || 0) +
          Number(c.essay_com || 0) +
          Number((c.essay_app || 0) + (c.essay_adv || 0));

        if (rowSum > 0) {
          cellRecord.hasExplicitCounts = true;
          cellRecord.mc_rec += Number(c.mc_rec || 0);
          cellRecord.mc_com += Number(c.mc_com || 0);
          cellRecord.mc_app += Number(c.mc_app || 0);
          cellRecord.tf_rec += Number(c.tf_rec || 0);
          cellRecord.tf_com += Number(c.tf_com || 0);
          cellRecord.tf_app += Number(c.tf_app || 0);
          cellRecord.sa_rec += Number(c.sa_rec || 0);
          cellRecord.sa_com += Number(c.sa_com || 0);
          cellRecord.sa_app += Number(c.sa_app || 0);
          cellRecord.essay_rec += Number(c.essay_rec || 0);
          cellRecord.essay_com += Number(c.essay_com || 0);
          cellRecord.essay_app += Number((c.essay_app || 0) + (c.essay_adv || 0));
        }
      } else if (c.cognitive_level || c.question_type || c.question_count) {
        // It's a MatrixItem
        const count = Number(c.question_count || 1);
        if (count > 0) {
          cellRecord.hasExplicitCounts = true;
          const qType = detectQuestionType(c);
          const qTier = detectCognitiveTier(c);

          if (qType === 'mc') {
            if (qTier === 'rec') cellRecord.mc_rec += count;
            else if (qTier === 'com') cellRecord.mc_com += count;
            else cellRecord.mc_app += count;
          } else if (qType === 'tf') {
            if (qTier === 'rec') cellRecord.tf_rec += count;
            else if (qTier === 'com') cellRecord.tf_com += count;
            else cellRecord.tf_app += count;
          } else if (qType === 'sa') {
            if (qTier === 'rec') cellRecord.sa_rec += count;
            else if (qTier === 'com') cellRecord.sa_com += count;
            else cellRecord.sa_app += count;
          } else if (qType === 'essay') {
            if (qTier === 'rec') cellRecord.essay_rec += count;
            else if (qTier === 'com') cellRecord.essay_com += count;
            else cellRecord.essay_app += count;
          }
        }
      }
    });
  }

  // 1. Determine topics list
  let topicList: { topic: string; contentUnit: string; requirement?: string; cellId?: string }[] = [];

  if (topicCellMap.size > 0) {
    topicList = Array.from(topicCellMap.values()).map((tc) => ({
      topic: tc.topic,
      contentUnit: tc.contentUnit,
      requirement: tc.requirement,
      cellId: tc.cellId,
    }));
  } else if (questions && questions.length > 0) {
    const pairMap = new Map<string, { topic: string; contentUnit: string; requirement?: string }>();
    (questions as any[]).forEach((q, qIdx) => {
      let t = q.topic?.trim();
      if (isGenericTopic(t)) {
        if (curriculumList.length > 0) {
          t = curriculumList[qIdx % curriculumList.length].topic;
        } else {
          t = `Chủ đề trọng tâm môn ${normalizedSubject}`;
        }
      }
      let cu = q.content_unit?.trim() || (q as any).subtopic?.trim();
      if (isGenericUnit(cu) || cu === t) {
        const matchedCurr = curriculumList.find((cur) => cur.topic === t || t.includes(cur.topic) || cur.topic.includes(t));
        if (matchedCurr && matchedCurr.units.length > 0) {
          cu = matchedCurr.units.join('; ');
        } else {
          cu = `Nội dung cốt lõi: ${t}`;
        }
      }
      const key = `${t}:::${cu}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          topic: t,
          contentUnit: cu,
          requirement: q.learning_requirement,
        });
      }
    });
    if (pairMap.size > 0) {
      topicList = Array.from(pairMap.values());
    }
  } else if (topics && topics.length > 0) {
    topicList = topics.map((t, idx) => {
      const qMatch = (questions as any[])?.find((q) => q.topic === t && q.content_unit && !isGenericUnit(q.content_unit));
      const matchedCurr = curriculumList.find((cur) => cur.topic === t || t.includes(cur.topic) || cur.topic.includes(t));
      return {
        topic: t,
        contentUnit: qMatch?.content_unit || (matchedCurr && matchedCurr.units.length > 0 ? matchedCurr.units.join('; ') : `Nội dung trọng tâm: ${t}`),
      };
    });
  }

  // Guaranteed fallback: Load actual official curriculum topics for this subject & grade
  if (topicList.length === 0) {
    if (curriculumList.length > 0) {
      topicList = curriculumList.slice(0, 4).map((cur) => ({
        topic: cur.topic,
        contentUnit: cur.units && cur.units.length > 0 ? cur.units.join('; ') : `Nội dung cốt lõi: ${cur.topic}`,
        requirement: `Học sinh nhận biết, thông hiểu và vận dụng các kiến thức cốt lõi thuộc ${cur.topic}`,
      }));
    } else {
      topicList = [
        {
          topic: `Kiến thức cốt lõi môn ${normalizedSubject}`,
          contentUnit: 'Lý thuyết trọng tâm và các dạng bài tập thực hành',
          requirement: `Học sinh nắm vững các kiến thức, kĩ năng trọng tâm môn ${normalizedSubject}`,
        },
      ];
    }
  }

  // 2. Map questions to each topic if available
  const rows: CV7991MatrixRow[] = [];
  const specRows: CV7991SpecRow[] = [];

  // Group questions by topic
  const questionsByTopic: Record<string, any[]> = {};
  topicList.forEach((t) => {
    questionsByTopic[t.topic] = [];
  });

  if (questions && questions.length > 0) {
    questions.forEach((q, qIdx) => {
      const qTopic = (q.topic || '').trim().toLowerCase();
      // Find matching topic
      const matched = topicList.find((t) => {
        const tTopic = t.topic.trim().toLowerCase();
        return (
          tTopic === qTopic ||
          (qTopic && tTopic.includes(qTopic)) ||
          (qTopic && qTopic.includes(tTopic))
        );
      });
      if (matched) {
        questionsByTopic[matched.topic].push(q);
      } else {
        // Distribute evenly across topicList
        if (topicList.length > 0) {
          const targetTopic = topicList[qIdx % topicList.length].topic;
          questionsByTopic[targetTopic].push(q);
        }
      }
    });
  }

  // Check if any explicit questions or cell counts exist
  const hasAnyQuestions = questions && questions.length > 0;
  const hasAnyCellCounts = Array.from(topicCellMap.values()).some((c) => c.hasExplicitCounts);

  // Question numbering tracking for specification table
  let curMcNum = 1;
  let curTfNum = 1;
  let curSaNum = 1;
  let curEssayNum = 1;

  topicList.forEach((item, idx) => {
    const tt = idx + 1;
    const topicQuestions = questionsByTopic[item.topic] || [];
    const cellRecord = topicCellMap.get(item.topic);

    let mc_rec = 0;
    let mc_com = 0;
    let mc_app = 0;
    let tf_rec = 0;
    let tf_com = 0;
    let tf_app = 0;
    let sa_rec = 0;
    let sa_com = 0;
    let sa_app = 0;
    let essay_rec = 0;
    let essay_com = 0;
    let essay_app = 0;

    let mcQs: any[] = [];
    let tfQs: any[] = [];
    let saQs: any[] = [];
    let essayQs: any[] = [];

    if (hasAnyQuestions && topicQuestions.length > 0) {
      mcQs = topicQuestions.filter((q) => detectQuestionType(q) === 'mc');
      tfQs = topicQuestions.filter((q) => detectQuestionType(q) === 'tf');
      saQs = topicQuestions.filter((q) => detectQuestionType(q) === 'sa');
      essayQs = topicQuestions.filter((q) => detectQuestionType(q) === 'essay');

      mc_rec = mcQs.filter((q) => detectCognitiveTier(q) === 'rec').length;
      mc_com = mcQs.filter((q) => detectCognitiveTier(q) === 'com').length;
      mc_app = mcQs.filter((q) => detectCognitiveTier(q) === 'app').length;

      tf_rec = tfQs.filter((q) => detectCognitiveTier(q) === 'rec').length;
      tf_com = tfQs.filter((q) => detectCognitiveTier(q) === 'com').length;
      tf_app = tfQs.filter((q) => detectCognitiveTier(q) === 'app').length;

      sa_rec = saQs.filter((q) => detectCognitiveTier(q) === 'rec').length;
      sa_com = saQs.filter((q) => detectCognitiveTier(q) === 'com').length;
      sa_app = saQs.filter((q) => detectCognitiveTier(q) === 'app').length;

      essay_rec = essayQs.filter((q) => detectCognitiveTier(q) === 'rec').length;
      essay_com = essayQs.filter((q) => detectCognitiveTier(q) === 'com').length;
      essay_app = essayQs.filter((q) => detectCognitiveTier(q) === 'app').length;
    }

    const currentTopicSum =
      mc_rec + mc_com + mc_app + tf_rec + tf_com + tf_app + sa_rec + sa_com + sa_app + essay_rec + essay_com + essay_app;

    // If no questions in topic, check topicCellMap
    if (currentTopicSum === 0 && cellRecord && cellRecord.hasExplicitCounts) {
      mc_rec = cellRecord.mc_rec;
      mc_com = cellRecord.mc_com;
      mc_app = cellRecord.mc_app;
      tf_rec = cellRecord.tf_rec;
      tf_com = cellRecord.tf_com;
      tf_app = cellRecord.tf_app;
      sa_rec = cellRecord.sa_rec;
      sa_com = cellRecord.sa_com;
      sa_app = cellRecord.sa_app;
      essay_rec = cellRecord.essay_rec;
      essay_com = cellRecord.essay_com;
      essay_app = cellRecord.essay_app;
    } else if (currentTopicSum === 0 && !hasAnyQuestions && !hasAnyCellCounts) {
      // Pedagogically balanced fallback distribution compliant with CV 7991 (40% Biết, 30% Hiểu, 30% Vận dụng)
      const isFirst = idx === 0;
      const isSecond = idx === 1;
      const isLast = idx === topicList.length - 1;

      if (isFirst) {
        mc_rec = 3;
        mc_com = 2;
        tf_rec = 1;
        tf_com = 1;
      } else if (isSecond) {
        mc_rec = 2;
        mc_com = 1;
        tf_com = 1;
        sa_rec = 1;
      } else if (isLast) {
        mc_rec = 1;
        mc_com = 1;
        mc_app = 1;
        tf_app = 1;
        essay_app = 1;
      } else {
        mc_rec = 2;
        mc_com = 1;
        mc_app = 1;
        sa_app = 1;
      }
    }

    const total_rec = mc_rec + tf_rec + sa_rec + essay_rec;
    const total_com = mc_com + tf_com + sa_com + essay_com;
    const total_app = mc_app + tf_app + sa_app + essay_app;

    // Points calculation
    const part1Config = structure?.parts?.find((p) => p.part === 1);
    const part2Config = structure?.parts?.find((p) => p.part === 2);
    const part3Config = structure?.parts?.find((p) => p.part === 3);
    const part4Config = structure?.parts?.find((p) => p.part === 4);

    const mcPts = (mc_rec + mc_com + mc_app) * (part1Config?.pointsPerQuestion || 0.25);
    const tfPts = (tf_rec + tf_com + tf_app) * (part2Config?.pointsPerQuestion || 1.0);
    const saPts = (sa_rec + sa_com + sa_app) * (part3Config?.pointsPerQuestion || 0.5);
    const essayPts = (essay_rec + essay_com + essay_app) * ((part4Config?.totalPoints || 3.0) / Math.max(1, part4Config?.questionCount || 2));
    const total_points = Math.round((mcPts + tfPts + saPts + essayPts) * 100) / 100;
    const percentage = Math.round((total_points / 10.0) * 100);

    // Specification question label generator
    const formatSpecRefWithSeq = (count: number, qArr: any[], partType: 'mc' | 'tf' | 'sa' | 'essay') => {
      if (count <= 0) return '';
      if (qArr && qArr.length > 0) {
        const labels = qArr
          .map((q) => (q.question_order ? `C${q.question_order}` : q.id ? `C${q.id}` : ''))
          .filter(Boolean)
          .join(', ');
        return labels ? `${count} (${labels})` : `${count}`;
      }
      // Sequential question numbering
      const allocated: string[] = [];
      for (let i = 0; i < count; i++) {
        if (partType === 'mc') allocated.push(`C${curMcNum++}`);
        else if (partType === 'tf') allocated.push(`C${curTfNum++}`);
        else if (partType === 'sa') allocated.push(`C${curSaNum++}`);
        else allocated.push(`C${curEssayNum++}`);
      }
      return `${count} (${allocated.join(', ')})`;
    };

    const row: CV7991MatrixRow = {
      tt,
      topic: item.topic,
      contentUnit: item.contentUnit,
      mc_rec,
      mc_com,
      mc_app,
      tf_rec,
      tf_com,
      tf_app,
      sa_rec,
      sa_com,
      sa_app,
      essay_rec,
      essay_com,
      essay_app,
      total_rec,
      total_com,
      total_app,
      total_points,
      percentage,
      questions_rec: mcQs.filter((q) => detectCognitiveTier(q) === 'rec').map((q) => `C${q.question_order}`),
      questions_com: mcQs.filter((q) => detectCognitiveTier(q) === 'com').map((q) => `C${q.question_order}`),
      questions_app: mcQs.filter((q) => detectCognitiveTier(q) === 'app').map((q) => `C${q.question_order}`),
    };
    rows.push(row);

    specRows.push({
      tt,
      topic: item.topic,
      contentUnit: item.contentUnit,
      recognition: {
        requirement: item.requirement || getStandardRequirement('recognition', item.topic, item.contentUnit),
        mc_count: mc_rec,
        mc_questions: formatSpecRefWithSeq(mc_rec, mcQs.filter((q) => detectCognitiveTier(q) === 'rec'), 'mc'),
        tf_count: tf_rec,
        tf_questions: formatSpecRefWithSeq(tf_rec, tfQs.filter((q) => detectCognitiveTier(q) === 'rec'), 'tf'),
        sa_count: sa_rec,
        sa_questions: formatSpecRefWithSeq(sa_rec, saQs.filter((q) => detectCognitiveTier(q) === 'rec'), 'sa'),
        essay_count: essay_rec,
        essay_questions: formatSpecRefWithSeq(essay_rec, essayQs.filter((q) => detectCognitiveTier(q) === 'rec'), 'essay'),
      },
      comprehension: {
        requirement: getStandardRequirement('comprehension', item.topic, item.contentUnit),
        mc_count: mc_com,
        mc_questions: formatSpecRefWithSeq(mc_com, mcQs.filter((q) => detectCognitiveTier(q) === 'com'), 'mc'),
        tf_count: tf_com,
        tf_questions: formatSpecRefWithSeq(tf_com, tfQs.filter((q) => detectCognitiveTier(q) === 'com'), 'tf'),
        sa_count: sa_com,
        sa_questions: formatSpecRefWithSeq(sa_com, saQs.filter((q) => detectCognitiveTier(q) === 'com'), 'sa'),
        essay_count: essay_com,
        essay_questions: formatSpecRefWithSeq(essay_com, essayQs.filter((q) => detectCognitiveTier(q) === 'com'), 'essay'),
      },
      application: {
        requirement: getStandardRequirement('application', item.topic, item.contentUnit),
        mc_count: mc_app,
        mc_questions: formatSpecRefWithSeq(mc_app, mcQs.filter((q) => detectCognitiveTier(q) === 'app'), 'mc'),
        tf_count: tf_app,
        tf_questions: formatSpecRefWithSeq(tf_app, tfQs.filter((q) => detectCognitiveTier(q) === 'app'), 'tf'),
        sa_count: sa_app,
        sa_questions: formatSpecRefWithSeq(sa_app, saQs.filter((q) => detectCognitiveTier(q) === 'app'), 'sa'),
        essay_count: essay_app,
        essay_questions: formatSpecRefWithSeq(essay_app, essayQs.filter((q) => detectCognitiveTier(q) === 'app'), 'essay'),
      },
    });
  });

  // 3. Summaries (Total row 1: Tổng số câu/lệnh hỏi; Total row 2: Tổng số điểm; Total row 3: Tỷ lệ %)
  const counts = rows.reduce(
    (acc, r) => ({
      mc_rec: acc.mc_rec + r.mc_rec,
      mc_com: acc.mc_com + r.mc_com,
      mc_app: acc.mc_app + r.mc_app,
      mc_total: acc.mc_total + r.mc_rec + r.mc_com + r.mc_app,
      tf_rec: acc.tf_rec + r.tf_rec,
      tf_com: acc.tf_com + r.tf_com,
      tf_app: acc.tf_app + r.tf_app,
      tf_total: acc.tf_total + r.tf_rec + r.tf_com + r.tf_app,
      sa_rec: acc.sa_rec + r.sa_rec,
      sa_com: acc.sa_com + r.sa_com,
      sa_app: acc.sa_app + r.sa_app,
      sa_total: acc.sa_total + r.sa_rec + r.sa_com + r.sa_app,
      essay_rec: acc.essay_rec + r.essay_rec,
      essay_com: acc.essay_com + r.essay_com,
      essay_app: acc.essay_app + r.essay_app,
      essay_total: acc.essay_total + r.essay_rec + r.essay_com + r.essay_app,
      total_rec: acc.total_rec + r.total_rec,
      total_com: acc.total_com + r.total_com,
      total_app: acc.total_app + r.total_app,
      grand_total_questions:
        acc.grand_total_questions +
        r.mc_rec +
        r.mc_com +
        r.mc_app +
        r.tf_rec +
        r.tf_com +
        r.tf_app +
        r.sa_rec +
        r.sa_com +
        r.sa_app +
        r.essay_rec +
        r.essay_com +
        r.essay_app,
    }),
    {
      mc_rec: 0,
      mc_com: 0,
      mc_app: 0,
      mc_total: 0,
      tf_rec: 0,
      tf_com: 0,
      tf_app: 0,
      tf_total: 0,
      sa_rec: 0,
      sa_com: 0,
      sa_app: 0,
      sa_total: 0,
      essay_rec: 0,
      essay_com: 0,
      essay_app: 0,
      essay_total: 0,
      total_rec: 0,
      total_com: 0,
      total_app: 0,
      grand_total_questions: 0,
    }
  );

  // Points distribution
  const part1Pts = structure?.parts?.find((p) => p.part === 1)?.totalPoints ?? 3.0;
  const part2Pts = structure?.parts?.find((p) => p.part === 2)?.totalPoints ?? 2.0;
  const part3Pts = structure?.parts?.find((p) => p.part === 3)?.totalPoints ?? 2.0;
  const part4Pts = structure?.parts?.find((p) => p.part === 4)?.totalPoints ?? 3.0;

  const cogDist = structure?.cognitiveDistribution || { recognition: 4.0, comprehension: 3.0, application: 3.0 };
  const recPts = cogDist.recognition || 4.0;
  const comPts = cogDist.comprehension || 3.0;
  const appPts = (cogDist.application || 2.0) + ((cogDist as any).advanced_application || 1.0);

  const points = {
    mc_total: part1Pts,
    tf_total: part2Pts,
    sa_total: part3Pts,
    essay_total: part4Pts,
    total_rec: recPts,
    total_com: comPts,
    total_app: appPts,
    grand_total_points: 10.0,
  };

  const percentages = {
    mc_total: Math.round((part1Pts / 10.0) * 100),
    tf_total: Math.round((part2Pts / 10.0) * 100),
    sa_total: Math.round((part3Pts / 10.0) * 100),
    essay_total: Math.round((part4Pts / 10.0) * 100),
    total_rec: Math.round((recPts / 10.0) * 100),
    total_com: Math.round((comPts / 10.0) * 100),
    total_app: Math.round((appPts / 10.0) * 100),
    grand_total_percentage: 100,
  };

  return {
    title,
    subject,
    grade,
    term,
    durationMinutes,
    rows,
    specRows,
    summary: {
      counts,
      points,
      percentages,
    },
  };
}

/**
 * Format point with comma (Vietnamese standard e.g. 3,0)
 */
export function formatVnNumber(val: number): string {
  return Number.isInteger(val) ? `${val},0` : val.toFixed(1).replace('.', ',');
}

/**
 * Generate Complete HTML for 1. MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ (CV 7991)
 */
export function renderCV7991MatrixHtml(data: CV7991Data): string {
  const { summary, rows } = data;
  const formatCell = (val: number) => (val > 0 ? String(val) : '');

  return `
  <div class="cv7991-matrix-container" style="font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; line-height: 1.3;">
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-weight: bold; font-size: 11pt;">PHỤ LỤC</div>
      <div style="font-style: italic; font-size: 10pt;">(Kèm theo Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ GDĐT)</div>
      <div style="font-weight: bold; font-size: 13pt; margin-top: 6px; text-transform: uppercase;">1. MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ</div>
      <div style="font-weight: bold; font-size: 11pt; margin-top: 2px;">
        MÔN: ${data.subject.toUpperCase()} - LỚP ${data.grade} (${data.title})
      </div>
      <div style="font-style: italic; font-size: 10pt;">Thời gian làm bài: ${data.durationMinutes} phút</div>
    </div>

    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 10pt;" border="1" cellpadding="4" cellspacing="0">
        <thead>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th rowspan="4" style="width: 32px;">TT</th>
            <th rowspan="4" style="min-width: 110px; max-width: 150px;">Chủ đề/ Chương</th>
            <th rowspan="4" style="min-width: 120px; max-width: 180px;">Nội dung/đơn vị kiến thức</th>
            <th colspan="12">Mức độ đánh giá</th>
            <th colspan="3">Tổng</th>
            <th rowspan="4" style="width: 48px;">Tỷ lệ % điểm</th>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th colspan="9">TNKQ</th>
            <th colspan="3" rowspan="2">Tự luận</th>
            <th colspan="3" rowspan="2" style="background-color: #f1f5f9;"></th>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th colspan="3">Nhiều lựa chọn</th>
            <th colspan="3">" Đúng – Sai " <sup>2</sup></th>
            <th colspan="3">Trả lời ngắn <sup>3</sup></th>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px; background-color: #f1f5f9;">Biết</th>
            <th style="width: 32px; background-color: #f1f5f9;">Hiểu</th>
            <th style="width: 34px; background-color: #f1f5f9;">Vận dụng</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${r.tt}</td>
              <td style="text-align: left; font-weight: bold; padding: 4px 6px;">${r.topic}</td>
              <td style="text-align: left; padding: 4px 6px;">${r.contentUnit}</td>
              <td>${formatCell(r.mc_rec)}</td>
              <td>${formatCell(r.mc_com)}</td>
              <td>${formatCell(r.mc_app)}</td>
              <td>${formatCell(r.tf_rec)}</td>
              <td>${formatCell(r.tf_com)}</td>
              <td>${formatCell(r.tf_app)}</td>
              <td>${formatCell(r.sa_rec)}</td>
              <td>${formatCell(r.sa_com)}</td>
              <td>${formatCell(r.sa_app)}</td>
              <td>${formatCell(r.essay_rec)}</td>
              <td>${formatCell(r.essay_com)}</td>
              <td>${formatCell(r.essay_app)}</td>
              <td style="font-weight: bold; background-color: #fafafa;">${formatCell(r.total_rec)}</td>
              <td style="font-weight: bold; background-color: #fafafa;">${formatCell(r.total_com)}</td>
              <td style="font-weight: bold; background-color: #fafafa;">${formatCell(r.total_app)}</td>
              <td style="font-weight: bold;">${(r.total_rec || 0) + (r.total_com || 0) + (r.total_app || 0)} câu<br/><span style="font-size: 8pt; color: #4338ca;">(${r.percentage}%)</span></td>
            </tr>
          `
            )
            .join('')}

          <!-- FOOTER ROW 1: Tổng số câu/lệnh hỏi -->
          <tr style="font-weight: bold; background-color: #f8fafc;">
            <td colspan="3" style="text-align: left; padding-left: 8px;">Tổng số câu/lệnh hỏi</td>
            <td>${summary.counts.mc_rec ?? 0}</td>
            <td>${summary.counts.mc_com ?? 0}</td>
            <td>${summary.counts.mc_app ?? 0}</td>
            <td>${summary.counts.tf_rec ?? 0}</td>
            <td>${summary.counts.tf_com ?? 0}</td>
            <td>${summary.counts.tf_app ?? 0}</td>
            <td>${summary.counts.sa_rec ?? 0}</td>
            <td>${summary.counts.sa_com ?? 0}</td>
            <td>${summary.counts.sa_app ?? 0}</td>
            <td>${summary.counts.essay_rec ?? 0}</td>
            <td>${summary.counts.essay_com ?? 0}</td>
            <td>${summary.counts.essay_app ?? 0}</td>
            <td style="background-color: #f1f5f9;">${summary.counts.total_rec ?? 0}</td>
            <td style="background-color: #f1f5f9;">${summary.counts.total_com ?? 0}</td>
            <td style="background-color: #f1f5f9;">${summary.counts.total_app ?? 0}</td>
            <td style="font-weight: 800; color: #1e1b4b;">${summary.counts.grand_total_questions ?? 0} câu</td>
          </tr>

          <!-- FOOTER ROW 2: Tổng số điểm -->
          <tr style="font-weight: bold; background-color: #f8fafc;">
            <td colspan="3" style="text-align: left; padding-left: 8px;">Tổng số điểm</td>
            <td colspan="3">${formatVnNumber(summary.points.mc_total)}<sup>5</sup></td>
            <td colspan="3">${formatVnNumber(summary.points.tf_total)}</td>
            <td colspan="3">${formatVnNumber(summary.points.sa_total)}</td>
            <td colspan="3">${formatVnNumber(summary.points.essay_total)}</td>
            <td style="background-color: #f1f5f9;">${formatVnNumber(summary.points.total_rec)}</td>
            <td style="background-color: #f1f5f9;">${formatVnNumber(summary.points.total_com)}</td>
            <td style="background-color: #f1f5f9;">${formatVnNumber(summary.points.total_app)}</td>
            <td>${formatVnNumber(summary.points.grand_total_points)}</td>
          </tr>

          <!-- FOOTER ROW 3: Tỷ lệ % -->
          <tr style="font-weight: bold; background-color: #f8fafc;">
            <td colspan="3" style="text-align: left; padding-left: 8px;">Tỷ lệ %</td>
            <td colspan="3">${summary.percentages.mc_total}</td>
            <td colspan="3">${summary.percentages.tf_total}</td>
            <td colspan="3">${summary.percentages.sa_total}</td>
            <td colspan="3">${summary.percentages.essay_total}</td>
            <td style="background-color: #f1f5f9;">${summary.percentages.total_rec}</td>
            <td style="background-color: #f1f5f9;">${summary.percentages.total_com}</td>
            <td style="background-color: #f1f5f9;">${summary.percentages.total_app}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FOOTNOTES -->
    <div style="margin-top: 12px; font-size: 9.5pt; font-style: italic; line-height: 1.45; color: #1e293b;">
      <div><sup>2</sup> Mỗi câu hỏi bao gồm 4 ý nhỏ, mỗi ý học sinh phải chọn đúng hoặc sai. Một số tài liệu xếp loại câu hỏi này vào loại <i>Nhiều lựa chọn phức hợp</i> hoặc <i>Nhiều lựa chọn có nhiều phương án đúng</i>.</div>
      <div><sup>3</sup> Đối với môn học không sử dụng dạng này thì chuyển toàn bộ số điểm cho dạng <i>" Đúng - Sai"</i>.</div>
      <div><sup>4</sup> Có ở trong một số ô của ma trận, thể hiện số câu hỏi hoặc câu hỏi số bao nhiêu.</div>
      <div><sup>5</sup> Lựa chọn sao cho được khoảng 3,0 điểm, tương ứng với tỷ lệ khoảng 30%; tương tự như thế đối với các dạng khác.</div>
    </div>
  </div>
  `;
}

/**
 * Generate Complete HTML for 2. BẢNG ĐẶC TẢ KIỂM TRA ĐỊNH KÌ (CV 7991)
 */
export function renderCV7991SpecificationHtml(data: CV7991Data): string {
  const { specRows } = data;

  return `
  <div class="cv7991-spec-container" style="font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; line-height: 1.3; margin-top: 24px;">
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-weight: bold; font-size: 13pt; text-transform: uppercase;">2. BẢNG ĐẶC TẢ KIỂM TRA ĐỊNH KÌ</div>
      <div style="font-weight: bold; font-size: 11pt; margin-top: 2px;">
        MÔN: ${data.subject.toUpperCase()} - LỚP ${data.grade} (${data.title})
      </div>
    </div>

    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 10pt;" border="1" cellpadding="4" cellspacing="0">
        <thead>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th rowspan="4" style="width: 32px;">TT</th>
            <th rowspan="4" style="min-width: 110px; max-width: 140px;">Chủ đề/ Chương</th>
            <th rowspan="4" style="min-width: 110px; max-width: 150px;">Nội dung/đơn vị kiến thức</th>
            <th rowspan="4" style="min-width: 300px; width: 38%;">Yêu cầu cần đạt</th>
            <th colspan="12">Số câu hỏi ở các mức độ đánh giá</th>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th colspan="9">TNKQ</th>
            <th colspan="3" rowspan="2">Tự luận</th>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th colspan="3">Nhiều lựa chọn</th>
            <th colspan="3">"Đúng – Sai"</th>
            <th colspan="3">Trả lời ngắn</th>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
            <th style="width: 32px;">Biết</th>
            <th style="width: 32px;">Hiểu</th>
            <th style="width: 34px;">Vận dụng</th>
          </tr>
        </thead>
        <tbody>
          ${specRows
            .map(
              (r) => `
            <!-- Level 1: Biết -->
            <tr>
              <td rowspan="3">${r.tt}</td>
              <td rowspan="3" style="text-align: left; font-weight: bold; padding: 4px 6px;">${r.topic}</td>
              <td rowspan="3" style="text-align: left; padding: 4px 6px;">${r.contentUnit}</td>
              <td style="text-align: left; padding: 6px 8px; width: 38%; min-width: 300px; vertical-align: top;">
                <div style="font-weight: bold; color: #1e3a8a;">Biết:</div>
                <div style="white-space: pre-line;">${r.recognition.requirement}</div>
              </td>
              <td>${r.recognition.mc_questions || (r.recognition.mc_count > 0 ? r.recognition.mc_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.recognition.tf_questions || (r.recognition.tf_count > 0 ? r.recognition.tf_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.recognition.sa_questions || (r.recognition.sa_count > 0 ? r.recognition.sa_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.recognition.essay_questions || (r.recognition.essay_count > 0 ? r.recognition.essay_count : '')}</td>
              <td></td>
              <td></td>
            </tr>

            <!-- Level 2: Hiểu -->
            <tr>
              <td style="text-align: left; padding: 6px 8px; width: 38%; min-width: 300px; vertical-align: top;">
                <div style="font-weight: bold; color: #166534;">Hiểu:</div>
                <div style="white-space: pre-line;">${r.comprehension.requirement}</div>
              </td>
              <td></td>
              <td>${r.comprehension.mc_questions || (r.comprehension.mc_count > 0 ? r.comprehension.mc_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.comprehension.tf_questions || (r.comprehension.tf_count > 0 ? r.comprehension.tf_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.comprehension.sa_questions || (r.comprehension.sa_count > 0 ? r.comprehension.sa_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.comprehension.essay_questions || (r.comprehension.essay_count > 0 ? r.comprehension.essay_count : '')}</td>
              <td></td>
            </tr>

            <!-- Level 3: Vận dụng -->
            <tr>
              <td style="text-align: left; padding: 6px 8px; width: 38%; min-width: 300px; vertical-align: top;">
                <div style="font-weight: bold; color: #9a3412;">Vận dụng:</div>
                <div style="white-space: pre-line;">${r.application.requirement}</div>
              </td>
              <td></td>
              <td></td>
              <td>${r.application.mc_questions || (r.application.mc_count > 0 ? r.application.mc_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.application.tf_questions || (r.application.tf_count > 0 ? r.application.tf_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.application.sa_questions || (r.application.sa_count > 0 ? r.application.sa_count : '')}</td>
              <td></td>
              <td></td>
              <td>${r.application.essay_questions || (r.application.essay_count > 0 ? `${r.application.essay_count} (NL?)⁶` : '')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- FOOTNOTES -->
    <div style="margin-top: 10px; font-size: 9.5pt; font-style: italic; line-height: 1.45; color: #1e293b;">
      <div><sup>6</sup> (n) là số thứ tự câu hỏi; (NL?) là năng lực thành phần được đánh giá.</div>
    </div>
  </div>
  `;
}

/**
 * Generate OpenXML Table for Word (.docx): 1. MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ (CV 7991)
 */
export function renderCV7991MatrixWordXml(data: CV7991Data): string {
  const { summary, rows } = data;
  // Optimized for A4 Landscape: Total width = 15110 dxa (Available 15138 dxa with 850 margins)
  const colWidths = [550, 2600, 2900, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 650, 650, 650, 1350];

  let xml = '';

  // Title section
  xml += createWordParagraph(parseTextToWordRuns('PHỤ LỤC', { bold: true, size: 22 }), { align: 'center', spacingBefore: 40, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns('(Kèm theo Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ GDĐT)', { italic: true, size: 20 }), { align: 'center', spacingBefore: 0, spacingAfter: 40 });
  xml += createWordParagraph(parseTextToWordRuns('1. MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ', { bold: true, size: 26 }), { align: 'center', spacingBefore: 40, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns(`MÔN: ${data.subject.toUpperCase()} - LỚP ${data.grade} (${data.title.toUpperCase()})`, { bold: true, size: 22 }), { align: 'center', spacingBefore: 0, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns(`Thời gian làm bài: ${data.durationMinutes} phút`, { italic: true, size: 20 }), { align: 'center', spacingBefore: 0, spacingAfter: 80 });

  // Table rows
  let rowsXml = '';

  // Header Row 1
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('TT', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[0], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Chủ đề/ Chương', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[1], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Nội dung/đơn vị kiến thức', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[2], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Mức độ đánh giá', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(3, 15).reduce((a, b) => a + b, 0), colSpan: 12, bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tổng', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(15, 18).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tỷ lệ % điểm', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[18], bgColor: 'F1F5F9' }),
    true
  );

  // Header Row 2
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('TNKQ', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(3, 12).reduce((a, b) => a + b, 0), colSpan: 9, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tự luận', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(12, 15).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths.slice(15, 18).reduce((a, b) => a + b, 0), colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[18] }),
    true
  );

  // Header Row 3
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Nhiều lựa chọn', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths.slice(3, 6).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('" Đúng – Sai " ²', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths.slice(6, 9).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Trả lời ngắn ³', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths.slice(9, 12).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths.slice(12, 15).reduce((a, b) => a + b, 0), colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths.slice(15, 18).reduce((a, b) => a + b, 0), colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[18] }),
    true
  );

  // Header Row 4: Biết / Hiểu / Vận dụng
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2] }) +
    // Nhiều lựa chọn
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[3] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[4] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[5] }) +
    // Đúng - Sai
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[6] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[7] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[8] }) +
    // Trả lời ngắn
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[9] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[10] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[11] }) +
    // Tự luận
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[12] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[13] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[14] }) +
    // Tổng
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[15], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[16], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[17], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[18] }),
    true
  );

  // Data rows
  const fmt = (v: number) => (v > 0 ? String(v) : '');

  rows.forEach((r) => {
    rowsXml += createWordTableRow(
      createWordTableCell(createWordParagraph(parseTextToWordRuns(String(r.tt), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[0] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.topic, { bold: true, size: 18 })), { widthDxa: colWidths[1] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.contentUnit, { size: 18 })), { widthDxa: colWidths[2] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.mc_rec), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[3] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.mc_com), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[4] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.mc_app), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[5] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.tf_rec), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[6] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.tf_com), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[7] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.tf_app), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[8] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.sa_rec), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[9] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.sa_com), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[10] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.sa_app), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[11] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.essay_rec), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[12] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.essay_com), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[13] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.essay_app), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[14] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.total_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[15], bgColor: 'F8FAFC' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.total_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[16], bgColor: 'F8FAFC' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(r.total_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[17], bgColor: 'F8FAFC' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(`${(r.total_rec || 0) + (r.total_com || 0) + (r.total_app || 0)} câu (${r.percentage}%)`, { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[18] })
    );
  });

  // Footer Row 1: Tổng số câu/lệnh hỏi
  const col1to3W = colWidths[0] + colWidths[1] + colWidths[2];
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tổng số câu/lệnh hỏi', { bold: true, size: 18 })), { widthDxa: col1to3W, colSpan: 3, bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.mc_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[3] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.mc_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[4] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.mc_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[5] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.tf_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[6] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.tf_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[7] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.tf_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[8] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.sa_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[9] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.sa_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[10] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.sa_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[11] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.essay_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[12] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.essay_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[13] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(fmt(summary.counts.essay_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[14] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.counts.total_rec ?? 0), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[15], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.counts.total_com ?? 0), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[16], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.counts.total_app ?? 0), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[17], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(`${summary.counts.grand_total_questions ?? 0} câu`, { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[18] })
  );

  // Footer Row 2: Tổng số điểm
  const w3 = colWidths[3] + colWidths[4] + colWidths[5];
  const w4 = colWidths[6] + colWidths[7] + colWidths[8];
  const w5 = colWidths[9] + colWidths[10] + colWidths[11];
  const w6 = colWidths[12] + colWidths[13] + colWidths[14];

  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tổng số điểm', { bold: true, size: 18 })), { widthDxa: col1to3W, colSpan: 3, bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(`${formatVnNumber(summary.points.mc_total)}⁵`, { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w3, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.tf_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w4, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.sa_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w5, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.essay_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w6, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.total_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[15], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.total_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[16], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.total_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[17], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(formatVnNumber(summary.points.grand_total_points), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[18] })
  );

  // Footer Row 3: Tỷ lệ %
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tỷ lệ %', { bold: true, size: 18 })), { widthDxa: col1to3W, colSpan: 3, bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.mc_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w3, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.tf_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w4, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.sa_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w5, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.essay_total), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: w6, colSpan: 3 }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.total_rec), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[15], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.total_com), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[16], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns(String(summary.percentages.total_app), { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[17], bgColor: 'F1F5F9' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('100%', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[18] })
  );

  xml += createWordTable(rowsXml, { borders: true, colWidths });

  // Footnotes
  xml += createWordParagraph(parseTextToWordRuns('² Mỗi câu hỏi bao gồm 4 ý nhỏ, mỗi ý học sinh phải chọn đúng hoặc sai. Một số tài liệu xếp loại câu hỏi này vào loại Nhiều lựa chọn phức hợp hoặc Nhiều lựa chọn có nhiều phương án đúng.', { italic: true, size: 18 }), { spacingBefore: 80, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns('³ Đối với môn học không sử dụng dạng này thì chuyển toàn bộ số điểm cho dạng " Đúng - Sai".', { italic: true, size: 18 }), { spacingBefore: 0, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns('⁴ Có ở trong một số ô của ma trận, thể hiện số câu hỏi hoặc câu hỏi số bao nhiêu.', { italic: true, size: 18 }), { spacingBefore: 0, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns('⁵ Lựa chọn sao cho được khoảng 3,0 điểm, tương ứng với tỷ lệ khoảng 30%; tương tự như thế đối với các dạng khác.', { italic: true, size: 18 }), { spacingBefore: 0, spacingAfter: 80 });

  return xml;
}

/**
 * Generate OpenXML Table for Word (.docx): 2. BẢNG ĐẶC TẢ KIỂM TRA ĐỊNH KÌ (CV 7991)
 */
export function renderCV7991SpecificationWordXml(data: CV7991Data): string {
  const { specRows } = data;
  // Optimized for A4 Landscape: Total width = 15110 dxa (Available 15138 dxa with 850 margins)
  // Col 3 ("Yêu cầu cần đạt") given 5800 dxa (wide and spacious for complete pedagogical requirements)
  const colWidths = [450, 2100, 2200, 5800, 380, 380, 380, 380, 380, 380, 380, 380, 380, 380, 380, 380];

  let xml = '';

  xml += createWordParagraph(parseTextToWordRuns('2. BẢNG ĐẶC TẢ KIỂM TRA ĐỊNH KÌ', { bold: true, size: 26 }), { align: 'center', spacingBefore: 120, spacingAfter: 20 });
  xml += createWordParagraph(parseTextToWordRuns(`MÔN: ${data.subject.toUpperCase()} - LỚP ${data.grade} (${data.title.toUpperCase()})`, { bold: true, size: 22 }), { align: 'center', spacingBefore: 0, spacingAfter: 80 });

  let rowsXml = '';

  // Header 1
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('TT', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[0], bgColor: 'F1F5F9', vMerge: 'restart', verticalAlign: 'center' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Chủ đề/ Chương', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[1], bgColor: 'F1F5F9', vMerge: 'restart', verticalAlign: 'center' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Nội dung/đơn vị kiến thức', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[2], bgColor: 'F1F5F9', vMerge: 'restart', verticalAlign: 'center' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Yêu cầu cần đạt', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths[3], bgColor: 'F1F5F9', vMerge: 'restart', verticalAlign: 'center' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Số câu hỏi ở các mức độ đánh giá', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(4).reduce((a, b) => a + b, 0), colSpan: 12, bgColor: 'F1F5F9' }),
    true
  );

  // Header 2
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[3], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('TNKQ', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(4, 13).reduce((a, b) => a + b, 0), colSpan: 9, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Tự luận', { bold: true, size: 18 }), { align: 'center' }), { widthDxa: colWidths.slice(13, 16).reduce((a, b) => a + b, 0), colSpan: 3, vMerge: 'restart', bgColor: 'F8FAFC', verticalAlign: 'center' }),
    true
  );

  // Header 3
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[3], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Nhiều lựa chọn', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths.slice(4, 7).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('"Đúng – Sai"', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths.slice(7, 10).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Trả lời ngắn', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths.slice(10, 13).reduce((a, b) => a + b, 0), colSpan: 3, bgColor: 'F8FAFC' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths.slice(13, 16).reduce((a, b) => a + b, 0), colSpan: 3, vMerge: 'continue' }),
    true
  );

  // Header 4
  rowsXml += createWordTableRow(
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2], vMerge: 'continue' }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[3], vMerge: 'continue' }) +
    // Nhiều lựa chọn
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[4] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[5] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[6] }) +
    // Đúng - Sai
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[7] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[8] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[9] }) +
    // Trả lời ngắn
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[10] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[11] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[12] }) +
    // Tự luận
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Biết', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[13] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('Hiểu', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[14] }) +
    createWordTableCell(createWordParagraph(parseTextToWordRuns('VD', { bold: true, size: 17 }), { align: 'center' }), { widthDxa: colWidths[15] }),
    true
  );

  // Body rows
  specRows.forEach((r) => {
    // Row 1: Biết
    rowsXml += createWordTableRow(
      createWordTableCell(createWordParagraph(parseTextToWordRuns(String(r.tt), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[0], vMerge: 'restart', verticalAlign: 'center' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.topic, { bold: true, size: 18 })), { widthDxa: colWidths[1], vMerge: 'restart', verticalAlign: 'center' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.contentUnit, { size: 18 })), { widthDxa: colWidths[2], vMerge: 'restart', verticalAlign: 'center' }) +
      createWordTableCell(
        createWordParagraph(parseTextToWordRuns('Biết:\n', { bold: true, size: 18, color: '1E3A8A' }) + parseTextToWordRuns(r.recognition.requirement, { size: 18 })),
        { widthDxa: colWidths[3] }
      ) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.recognition.mc_questions || (r.recognition.mc_count > 0 ? String(r.recognition.mc_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[4] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[5] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[6] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.recognition.tf_questions || (r.recognition.tf_count > 0 ? String(r.recognition.tf_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[7] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[8] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[9] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.recognition.sa_questions || (r.recognition.sa_count > 0 ? String(r.recognition.sa_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[10] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[11] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[12] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.recognition.essay_questions || (r.recognition.essay_count > 0 ? String(r.recognition.essay_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[13] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[14] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[15] })
    );

    // Row 2: Hiểu
    rowsXml += createWordTableRow(
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0], vMerge: 'continue' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1], vMerge: 'continue' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2], vMerge: 'continue' }) +
      createWordTableCell(
        createWordParagraph(parseTextToWordRuns('Hiểu:\n', { bold: true, size: 18, color: '166534' }) + parseTextToWordRuns(r.comprehension.requirement, { size: 18 })),
        { widthDxa: colWidths[3] }
      ) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[4] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.comprehension.mc_questions || (r.comprehension.mc_count > 0 ? String(r.comprehension.mc_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[5] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[6] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[7] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.comprehension.tf_questions || (r.comprehension.tf_count > 0 ? String(r.comprehension.tf_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[8] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[9] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[10] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.comprehension.sa_questions || (r.comprehension.sa_count > 0 ? String(r.comprehension.sa_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[11] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[12] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[13] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.comprehension.essay_questions || (r.comprehension.essay_count > 0 ? String(r.comprehension.essay_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[14] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[15] })
    );

    // Row 3: Vận dụng
    rowsXml += createWordTableRow(
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[0], vMerge: 'continue' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[1], vMerge: 'continue' }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[2], vMerge: 'continue' }) +
      createWordTableCell(
        createWordParagraph(parseTextToWordRuns('Vận dụng:\n', { bold: true, size: 18, color: '9A3412' }) + parseTextToWordRuns(r.application.requirement, { size: 18 })),
        { widthDxa: colWidths[3] }
      ) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[4] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[5] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.application.mc_questions || (r.application.mc_count > 0 ? String(r.application.mc_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[6] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[7] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[8] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.application.tf_questions || (r.application.tf_count > 0 ? String(r.application.tf_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[9] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[10] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[11] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.application.sa_questions || (r.application.sa_count > 0 ? String(r.application.sa_count) : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[12] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[13] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns('', { size: 18 })), { widthDxa: colWidths[14] }) +
      createWordTableCell(createWordParagraph(parseTextToWordRuns(r.application.essay_questions || (r.application.essay_count > 0 ? `${r.application.essay_count} (NL?)⁶` : ''), { size: 18 }), { align: 'center' }), { widthDxa: colWidths[15] })
    );
  });

  xml += createWordTable(rowsXml, { borders: true, colWidths });

  // Footnotes
  xml += createWordParagraph(parseTextToWordRuns('⁶ (n) là số thứ tự câu hỏi; (NL?) là năng lực thành phần được đánh giá.', { italic: true, size: 18 }), { spacingBefore: 60, spacingAfter: 80 });

  return xml;
}
