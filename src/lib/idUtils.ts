import { CognitiveLevel, QuestionType, Difficulty } from '../types';

/**
 * Validates whether a string matches standard UUID v4/v1 format.
 */
export function isUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim()) ||
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Normalizes input cognitive level string to strict PostgreSQL enum values.
 * Allowed: 'recognition' | 'comprehension' | 'application' | 'advanced_application'
 */
export function normalizeCognitiveLevel(level: any): CognitiveLevel {
  if (!level) return 'recognition';
  const str = String(level).toLowerCase().trim();
  
  if (
    str === 'advanced_application' || 
    str.includes('van_dung_cao') || 
    str.includes('vận dụng cao') || 
    str.includes('vdc') || 
    str.includes('advanced')
  ) {
    return 'advanced_application';
  }
  
  if (
    str === 'application' || 
    str.includes('van_dung') || 
    str.includes('vận dụng') || 
    str.includes('vd') || 
    str.includes('apply')
  ) {
    return 'application';
  }
  
  if (
    str === 'comprehension' || 
    str.includes('thong_hieu') || 
    str.includes('thông hiểu') || 
    str.includes('th') || 
    str.includes('understand')
  ) {
    return 'comprehension';
  }
  
  if (
    str === 'recognition' || 
    str.includes('nhan_biet') || 
    str.includes('nhận biết') || 
    str.includes('nb') || 
    str.includes('know')
  ) {
    return 'recognition';
  }
  
  return 'recognition';
}

/**
 * Normalizes input question type to strict PostgreSQL enum values.
 * Allowed: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
 */
export function normalizeQuestionType(type: any): QuestionType {
  if (!type) return 'single_choice';
  const str = String(type).toLowerCase().trim();
  
  if (str === 'essay' || str.includes('tu_luan') || str.includes('tự luận') || str.includes('tl')) {
    return 'essay';
  }
  
  if (str === 'short_answer' || str.includes('tra_loi_ngan') || str.includes('trả lời ngắn') || str.includes('tln') || str.includes('short')) {
    return 'short_answer';
  }
  
  if (str === 'true_false' || str.includes('dung_sai') || str.includes('đúng sai') || str.includes('tf') || str.includes('true')) {
    return 'true_false';
  }
  
  if (str === 'multiple_choice' || str.includes('nhieu_lua_chon') || str.includes('nhiều lựa chọn')) {
    return 'multiple_choice';
  }
  
  return 'single_choice';
}

/**
 * Normalizes difficulty to 'easy' | 'medium' | 'hard'
 */
export function normalizeDifficulty(diff: any): Difficulty {
  if (!diff) return 'medium';
  const str = String(diff).toLowerCase().trim();
  if (str === 'easy' || str.includes('de') || str.includes('dễ')) return 'easy';
  if (str === 'hard' || str.includes('kho') || str.includes('khó')) return 'hard';
  return 'medium';
}

/**
 * Strips topic, chapter, cognitive level, and redundant question prefixes from question content.
 * e.g. "[Chủ đề: Phương trình] Tìm x..." -> "Tìm x..."
 * e.g. "(Chủ đề 1: Động học) Một vật..." -> "Một vật..."
 * e.g. "Chủ đề 1: Động học - Một vật..." -> "Một vật..."
 * e.g. "Câu 1: Cho hình..." -> "Cho hình..."
 */
export function cleanQuestionContent(rawContent: string): string {
  if (!rawContent) return '';
  let text = String(rawContent).trim();

  // Strip redundant leading "Câu 1:", "Bài 1:" if present
  text = text.replace(/^(câu|bài)\s*\d+[\s\.:\-_–—]*/i, '');

  // Strip bracketed topic tags: [Chủ đề ...], [Chương ...], [Bài ...], [Topic ...]
  text = text.replace(/^\[\s*(chủ\s*đề|chương|bài|chuyên\s*đề|topic|theme)[^\]]*\]\s*[:-]?\s*/i, '');
  text = text.replace(/^\(\s*(chủ\s*đề|chương|bài|chuyên\s*đề|topic|theme)[^\)]*\)\s*[:-]?\s*/i, '');

  // Strip unbracketed topic prefixes: "Chủ đề 1: ... - " or "Chủ đề: ...: "
  text = text.replace(/^(chủ\s*đề|chương|chuyên\s*đề)\s*[\dIVXabc\.\:]*[^:\n–—-]*[:–—-]\s*/i, '');

  // Strip bracketed cognitive level tags: [Biết], [Hiểu], [Vận dụng], [Nhận biết], etc.
  text = text.replace(/^\[\s*(nhận\s*biết|thông\s*hiểu|vận\s*dụng|vận\s*dụng\s*cao|biết|hiểu|mức\s*độ\s*\d)[^\]]*\]\s*[:-]?\s*/i, '');
  text = text.replace(/^\(\s*(nhận\s*biết|thông\s*hiểu|vận\s*dụng|vận\s*dụng\s*cao|biết|hiểu|mức\s*độ\s*\d)[^\)]*\)\s*[:-]?\s*/i, '');

  // Strip again in case there was both topic and level: e.g. "[Chủ đề 1] [Thông hiểu] Cho hình..."
  text = text.replace(/^\[\s*(nhận\s*biết|thông\s*hiểu|vận\s*dụng|vận\s*dụng\s*cao|biết|hiểu|mức\s*độ\s*\d)[^\]]*\]\s*[:-]?\s*/i, '');
  text = text.replace(/^\(\s*(nhận\s*biết|thông\s*hiểu|vận\s*dụng|vận\s*dụng\s*cao|biết|hiểu|mức\s*độ\s*\d)[^\)]*\)\s*[:-]?\s*/i, '');

  return text.trim();
}

/**
 * Automatically generates a standardized student code based on class name and sequence number (STT).
 * e.g.:
 * - className: "6/1", stt: 1 -> "6/101"
 * - className: "6/1", stt: 15 -> "6/115"
 * - className: "6A", stt: 1 -> "6A01"
 * - className: "10A1", stt: 5 -> "10A105"
 */
export function generateStudentCode(className: string, stt: number): string {
  const cleanClass = (className || '').trim();
  const paddedStt = String(Math.max(1, stt)).padStart(2, '0');
  return `${cleanClass}${paddedStt}`.toUpperCase();
}
