import { jsonrepair } from 'jsonrepair';

/**
 * JSON Repair & Sanitization Helper for AI-generated responses
 * Handles common LLM JSON artifacts:
 * - Unescaped LaTeX backslashes (\frac, \sqrt, \alpha, \times, \vec, etc.) causing "Bad escaped character in JSON"
 * - Unescaped double quotes inside strings causing "Expected ',' or '}' after property value"
 * - Missing commas between object properties or array elements
 * - Truncated JSON outputs when reaching token limits
 * - Markdown fences (```json ... ```)
 */

/**
 * Cleans markdown code blocks (```json ... ```) from Gemini raw response
 */
export function cleanJsonResponse(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
  }
  return cleaned;
}

/**
 * Escapes LaTeX formulas and non-standard backslashes inside JSON strings.
 * Keeps valid standard JSON escape sequences intact: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
 */
export function escapeLatexInJson(str: string): string {
  if (!str || typeof str !== 'string') return '{}';
  let inString = false;
  let result = '';
  let i = 0;

  // LaTeX commands starting with b, f, n, r, t (which are otherwise valid JSON escapes)
  const latexB = /^(egin|ar|ullet|eta|m|f|ox|matrix|ackslash|inom)/i;
  const latexF = /^(rac|lat|orall)/i;
  const latexN = /^(eq|ot|abla|u|atural|orm)/i;
  const latexR = /^(ight|ho|ef|m|ad)/i;
  const latexT = /^(imes|ext|heta|au|an|o|ilde|op|erm)/i;

  while (i < str.length) {
    const char = str[i];

    if (char === '"') {
      let backslashCount = 0;
      let k = i - 1;
      while (k >= 0 && str[k] === '\\') {
        backslashCount++;
        k--;
      }
      if (backslashCount % 2 === 0) {
        inString = !inString;
      }
      result += char;
      i++;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        const next = str[i + 1];
        if (next === undefined) {
          result += '\\\\';
          i++;
          continue;
        }

        // Already escaped backslash: \\
        if (next === '\\') {
          result += '\\\\';
          i += 2;
          continue;
        }

        // Standard JSON escape sequences: \" and \/
        if (next === '"' || next === '/') {
          result += '\\' + next;
          i += 2;
          continue;
        }

        // Unicode escape \uXXXX
        if (next === 'u') {
          const hex = str.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += '\\u' + hex;
            i += 6;
            continue;
          } else {
            result += '\\\\u';
            i += 2;
            continue;
          }
        }

        // Potential JSON escapes that could be LaTeX commands
        if (next === 'b') {
          const rest = str.slice(i + 2, i + 12);
          result += latexB.test(rest) ? '\\\\b' : '\\b';
          i += 2;
          continue;
        }

        if (next === 'f') {
          const rest = str.slice(i + 2, i + 12);
          result += latexF.test(rest) ? '\\\\f' : '\\f';
          i += 2;
          continue;
        }

        if (next === 'n') {
          const rest = str.slice(i + 2, i + 12);
          result += latexN.test(rest) ? '\\\\n' : '\\n';
          i += 2;
          continue;
        }

        if (next === 'r') {
          const rest = str.slice(i + 2, i + 12);
          result += latexR.test(rest) ? '\\\\r' : '\\r';
          i += 2;
          continue;
        }

        if (next === 't') {
          const rest = str.slice(i + 2, i + 12);
          result += latexT.test(rest) ? '\\\\t' : '\\t';
          i += 2;
          continue;
        }

        // ANY other character following \ is an INVALID JSON escape sequence!
        // e.g. \sqrt, \sin, \alpha, \vec, \delta, \cdot, \approx, \le, \ge, etc.
        result += '\\\\' + next;
        i += 2;
        continue;
      } else if (char === '\n') {
        result += '\\n';
        i++;
        continue;
      } else if (char === '\r') {
        result += '\\r';
        i++;
        continue;
      } else if (char === '\t') {
        result += '\\t';
        i++;
        continue;
      }
    }
    result += char;
    i++;
  }

  return result;
}

/**
 * Extracts question objects if the outer JSON wrapper was completely corrupted
 */
export function extractQuestionsFromBrokenJson(raw: string): any[] {
  const questions: any[] = [];
  const regex = /\{\s*"(?:id|part|content)"\s*:/g;
  let match: RegExpExecArray | null;
  const indices: number[] = [];
  
  while ((match = regex.exec(raw)) !== null) {
    indices.push(match.index);
  }

  for (let k = 0; k < indices.length; k++) {
    const start = indices[k];
    const end = k + 1 < indices.length ? indices[k + 1] : raw.length;
    let snippet = raw.slice(start, end).trim();
    if (snippet.endsWith(',')) snippet = snippet.slice(0, -1).trim();
    if (snippet.endsWith(']')) snippet = snippet.slice(0, -1).trim();

    try {
      const repairedSnippet = jsonrepair(snippet);
      const parsedSnippet = JSON.parse(repairedSnippet);
      if (parsedSnippet && (parsedSnippet.content || parsedSnippet.id)) {
        questions.push(parsedSnippet);
      }
    } catch {
      // Try with LaTeX escape
      try {
        const escapedSnippet = escapeLatexInJson(snippet);
        const repairedSnippet = jsonrepair(escapedSnippet);
        const parsedSnippet = JSON.parse(repairedSnippet);
        if (parsedSnippet && (parsedSnippet.content || parsedSnippet.id)) {
          questions.push(parsedSnippet);
        }
      } catch {
        // Skip irrecoverable fragment
      }
    }
  }

  return questions;
}

/**
 * Robust JSON parser specifically engineered for AI LLM outputs with LaTeX formulas,
 * Vietnamese text, unescaped quotes, missing commas, and truncated responses.
 */
export function safeParseAIJson<T = any>(rawText: string, fallback?: T): T {
  if (!rawText || typeof rawText !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error('Dữ liệu phản hồi từ AI rỗng.');
  }

  const cleaned = cleanJsonResponse(rawText);

  // Attempt 1: Native JSON.parse (fastest, standard valid JSON)
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Attempt 2: Escape LaTeX then JSON.parse
  try {
    const escaped = escapeLatexInJson(cleaned);
    return JSON.parse(escaped);
  } catch {}

  // Attempt 3: Escape LaTeX then jsonrepair (solves missing commas, unescaped quotes, unclosed brackets)
  try {
    const escaped = escapeLatexInJson(cleaned);
    const repaired = jsonrepair(escaped);
    return JSON.parse(repaired);
  } catch {}

  // Attempt 4: jsonrepair first then escape LaTeX
  try {
    const repaired = jsonrepair(cleaned);
    const escaped = escapeLatexInJson(repaired);
    return JSON.parse(escaped);
  } catch {}

  // Attempt 5: jsonrepair directly
  try {
    const repaired = jsonrepair(cleaned);
    return JSON.parse(repaired);
  } catch {}

  // Attempt 6: Fallback for exam generation - extract questions individually
  try {
    const extractedQuestions = extractQuestionsFromBrokenJson(cleaned);
    if (extractedQuestions.length > 0) {
      console.info(`[safeParseAIJson] Recovered ${extractedQuestions.length} questions from broken JSON wrapper.`);
      return {
        exam: {
          title: 'Đề kiểm tra',
          instructions: 'Thí sinh làm bài theo đúng thời gian quy định.',
        },
        questions: extractedQuestions,
      } as unknown as T;
    }
  } catch {}

  if (fallback !== undefined) return fallback;
  console.error('[safeParseAIJson] Failed to parse AI JSON. Snippet:', cleaned.slice(0, 500));
  throw new Error('Dữ liệu JSON từ AI bị lỗi cú pháp và không thể tự động khôi phục. Vui lòng bấm thử lại.');
}
