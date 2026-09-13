/**
 * JSON Repair & Sanitization Helper for AI-generated responses
 * Handles common LLM JSON artifacts:
 * - Unescaped LaTeX backslashes (\frac, \sqrt, \alpha, \times, \vec, etc.) causing "Bad escaped character in JSON"
 * - Invalid Unicode escapes (e.g. \underline, \union)
 * - Trailing commas before } or ]
 * - Markdown fences (```json ... ```)
 * - Unescaped control characters or newlines inside string literals
 * - Truncated JSON brackets
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
 * Repairs broken JSON strings containing invalid escapes, LaTeX macros, or trailing commas
 */
export function cleanAndRepairJson(raw: string): string {
  if (!raw || typeof raw !== 'string') return '{}';
  let str = raw.trim();
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
  }

  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = str.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = str.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    str = str.slice(startIdx, endIdx + 1);
  }

  let inString = false;
  let result = '';
  let i = 0;

  // Common LaTeX commands that start with b, f, n, r, t (which are otherwise valid JSON escapes)
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
            // Not a valid 4-hex unicode escape (e.g. \underline, \upsilon)
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
        // Double-escape it so JSON parser receives a literal backslash.
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
    } else {
      // Outside string: remove trailing commas before } or ]
      if (char === ',') {
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) {
          j++;
        }
        if (str[j] === '}' || str[j] === ']') {
          i++;
          continue;
        }
      }
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Balances unclosed brackets/braces if the LLM output was truncated
 */
export function balanceJsonBrackets(str: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') {
      let backslashCount = 0;
      let k = i - 1;
      while (k >= 0 && str[k] === '\\') {
        backslashCount++;
        k--;
      }
      if (backslashCount % 2 === 0) {
        inString = !inString;
      }
      continue;
    }
    if (!inString) {
      if (c === '{') openBraces++;
      else if (c === '}') openBraces = Math.max(0, openBraces - 1);
      else if (c === '[') openBrackets++;
      else if (c === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  let res = str;
  if (inString) res += '"';
  while (openBrackets > 0) {
    res += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    res += '}';
    openBraces--;
  }
  return res;
}

/**
 * Safe JSON parser specifically engineered for AI LLM outputs with LaTeX formulas and Vietnamese text.
 */
export function safeParseAIJson<T = any>(rawText: string, fallback?: T): T {
  if (!rawText || typeof rawText !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error('Dữ liệu phản hồi từ AI rỗng.');
  }

  const cleaned = cleanJsonResponse(rawText);

  // Attempt 1: Standard JSON.parse
  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // Attempt 2: Clean and repair invalid escape sequences (LaTeX \sqrt, \alpha, \frac, etc.)
    const repaired = cleanAndRepairJson(rawText);
    try {
      return JSON.parse(repaired);
    } catch (secondErr: any) {
      // Attempt 3: Balance truncated JSON brackets
      try {
        const balanced = balanceJsonBrackets(repaired);
        return JSON.parse(balanced);
      } catch (thirdErr) {
        if (fallback !== undefined) return fallback;
        console.error('[safeParseAIJson] Failed to parse AI JSON:', secondErr?.message, '\nRaw snippet:', rawText.slice(0, 500));
        throw new Error(`Lỗi định dạng dữ liệu từ AI: ${secondErr?.message || 'JSON không hợp lệ'}`);
      }
    }
  }
}
