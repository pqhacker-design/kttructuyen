import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Profile } from '../types';

// Get credentials from Vite / Next.js compatible environment variables
const metaEnv = (import.meta as any).env || {};

export const INITIAL_ADMIN_EMAIL =
  (typeof process !== 'undefined' && process.env?.INITIAL_ADMIN_EMAIL) ||
  (typeof process !== 'undefined' && process.env?.VITE_INITIAL_ADMIN_EMAIL) ||
  metaEnv.VITE_INITIAL_ADMIN_EMAIL ||
  metaEnv.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL ||
  'admin@eduexam.com';

export const INITIAL_ADMIN_PASSWORD =
  (typeof process !== 'undefined' && process.env?.INITIAL_ADMIN_PASSWORD) ||
  (typeof process !== 'undefined' && process.env?.VITE_INITIAL_ADMIN_PASSWORD) ||
  metaEnv.VITE_INITIAL_ADMIN_PASSWORD ||
  metaEnv.NEXT_PUBLIC_INITIAL_ADMIN_PASSWORD ||
  '';

const ENV_SUPABASE_URL = 
  metaEnv.VITE_SUPABASE_URL || 
  metaEnv.NEXT_PUBLIC_SUPABASE_URL || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  '';

const ENV_SUPABASE_ANON_KEY = 
  metaEnv.VITE_SUPABASE_ANON_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  '';

// Allow manual configuration in the preview UI with local persistence
const STORED_URL = typeof window !== 'undefined' ? localStorage.getItem('eduexam_supabase_url') : null;
const STORED_KEY = typeof window !== 'undefined' ? localStorage.getItem('eduexam_supabase_anon_key') : null;

let customUrl: string | null = STORED_URL;
let customKey: string | null = STORED_KEY;

export function setCustomSupabaseCredentials(url: string, key: string) {
  customUrl = url.trim();
  customKey = key.trim();
  if (typeof window !== 'undefined') {
    if (customUrl) {
      localStorage.setItem('eduexam_supabase_url', customUrl);
    } else {
      localStorage.removeItem('eduexam_supabase_url');
    }
    if (customKey) {
      localStorage.setItem('eduexam_supabase_anon_key', customKey);
    } else {
      localStorage.removeItem('eduexam_supabase_anon_key');
    }
  }
  // Clear cached client to recreate
  activeClient = null;
}

export function getActiveSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  const url = customUrl || ENV_SUPABASE_URL;
  const key = customKey || ENV_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(
    url && 
    key && 
    url.startsWith('http') && 
    !url.includes('your-project-id') &&
    !url.includes('placeholder.supabase.co')
  );
  return { url, key, isConfigured };
}

export function isSupabaseConfigured(): boolean {
  return getActiveSupabaseCredentials().isConfigured;
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  if (!isSupabaseConfigured()) {
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }
  const supabase = getSupabase();
  return supabase.auth.onAuthStateChange(callback);
}

let activeClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (activeClient) {
    return activeClient;
  }

  const { url, key, isConfigured } = getActiveSupabaseCredentials();

  if (!isConfigured) {
    activeClient = createClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
    return activeClient;
  }

  activeClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return activeClient;
}

// Quick connection tester to verify database and table connectivity
export async function testSupabaseConnection(url?: string, key?: string): Promise<{
  success: boolean;
  message: string;
  tablesFound?: boolean;
}> {
  try {
    const testClient = (url && key) 
      ? createClient(url, key, { auth: { persistSession: false } })
      : getSupabase();

    // Check basic ping to Supabase REST endpoint
    const { error: pingError } = await testClient.from('profiles').select('id').limit(1);

    if (pingError) {
      const msg = (pingError.message || '').toLowerCase();
      const isMissingTable =
        pingError.code === '42P01' ||
        pingError.code === 'PGRST205' ||
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        msg.includes('could not find the table');

      if (isMissingTable) {
        return {
          success: true,
          tablesFound: false,
          message: 'Kết nối Supabase thành công! Tuy nhiên dự án Supabase này chưa có bảng dữ liệu (bảng "public.profiles" chưa được tạo). Hãy sao chép mã SQL Schema và chạy trong SQL Editor của Supabase để hoàn tất.',
        };
      }
      return {
        success: false,
        message: `Lỗi kết nối: ${pingError.message} (${pingError.code || 'UNKNOWN'})`,
      };
    }

    return {
      success: true,
      tablesFound: true,
      message: 'Kết nối Supabase PostgreSQL thành công! Toàn bộ bảng đã sẵn sàng.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Không thể kết nối đến Supabase URL đã cung cấp.',
    };
  }
}

// ------------------------------------------------------------------------------
// AUTH HELPER FUNCTIONS
// ------------------------------------------------------------------------------

export function setActiveUserProfile(profile: Profile | null) {
  if (typeof window !== 'undefined') {
    if (profile) {
      localStorage.setItem('eduexam_active_user', JSON.stringify(profile));
      localStorage.removeItem('eduexam_signed_out');
    } else {
      localStorage.removeItem('eduexam_active_user');
      localStorage.setItem('eduexam_signed_out', 'true');
    }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch (err) {
    return null;
  }
}

export async function getCurrentProfile(userId?: string): Promise<Profile | null> {
  // If Supabase is not configured yet, check local session state
  if (!isSupabaseConfigured()) {
    if (typeof window !== 'undefined') {
      const isSignedOut = localStorage.getItem('eduexam_signed_out') === 'true';
      if (isSignedOut) {
        return null;
      }
      const saved = localStorage.getItem('eduexam_active_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore corrupted json
        }
      }
    }
    return null;
  }

  try {
    const supabase = getSupabase();
    const uid = userId || (await getCurrentUser())?.id;
    if (!uid) {
      // User is not signed in to Supabase
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .single();

    if (error || !data) {
      // If profile row doesn't exist yet, construct a fallback from auth user
      const user = await getCurrentUser();
      if (user && user.id === uid) {
        const userEmail = (user.email || '').toLowerCase();
        const isAdmin = userEmail === INITIAL_ADMIN_EMAIL.toLowerCase() || user.user_metadata?.role === 'admin';
        return {
          id: user.id,
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Người dùng',
          email: user.email || '',
          role: isAdmin ? 'admin' : ((user.user_metadata?.role as any) || 'teacher'),
          status: 'active',
          created_at: user.created_at,
          updated_at: user.created_at,
        };
      }
      return null;
    }

    // If profile exists, check if email matches INITIAL_ADMIN_EMAIL and elevate to admin if needed
    if (data && data.email && data.email.toLowerCase() === INITIAL_ADMIN_EMAIL.toLowerCase() && data.role !== 'admin') {
      data.role = 'admin';
      // Attempt to sync to database
      try {
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.id);
      } catch (e) {
        // ignore
      }
    }

    return data as Profile;
  } catch (err) {
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  setActiveUserProfile(null);
  if (!isSupabaseConfigured()) {
    return;
  }
  try {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    // Ignore signout error
  }
}

export const signOut = signOutUser;


