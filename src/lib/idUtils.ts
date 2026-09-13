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
