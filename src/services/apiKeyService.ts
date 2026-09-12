/**
 * Service to manage user-specific Gemini API Key in browser local storage.
 * Users must provide their own Gemini API key for AI exam and question generation.
 */

const STORAGE_KEY = 'edu_user_gemini_api_key';

export function getUserApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setUserApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
    window.dispatchEvent(new Event('edu_api_key_changed'));
  } catch (e) {
    console.error('Failed to save API key to local storage:', e);
  }
}

export function clearUserApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('edu_api_key_changed'));
  } catch (e) {
    console.error('Failed to clear API key:', e);
  }
}

export function hasUserApiKey(): boolean {
  const key = getUserApiKey();
  return key.length >= 10;
}

export function getMaskedApiKey(key?: string): string {
  const target = key || getUserApiKey();
  if (!target) return 'Chưa cấu hình';
  if (target.length <= 8) return '••••••••';
  const prefix = target.slice(0, 6);
  const suffix = target.slice(-4);
  return `${prefix}...${suffix}`;
}

export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/ai/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    });
    
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({ success: false }));
      if (data.success) {
        return {
          success: true,
          message: data.message || 'Kết nối thành công! API Key của bạn hợp lệ và sẵn sàng sử dụng.',
        };
      }
      return {
        success: false,
        message: data.error || 'API Key không hợp lệ hoặc không có quyền truy cập mô hình Gemini.',
      };
    }

    // Fallback: When hosted on Vercel static or serverless without Node backend,
    // test directly against Google Gemini REST API endpoint
    const directRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`
    );
    const directData = await directRes.json().catch(() => ({}));
    if (directRes.ok) {
      return {
        success: true,
        message: 'Kết nối thành công! API Key Google Gemini hợp lệ và sẵn sàng sử dụng.',
      };
    }
    return {
      success: false,
      message: directData.error?.message || 'API Key không hợp lệ hoặc không có quyền truy cập Google Gemini API.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Không thể kết nối đến máy chủ kiểm tra API.',
    };
  }
}
