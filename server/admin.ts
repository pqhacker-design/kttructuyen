import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase Admin Client
let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdminClient) return supabaseAdminClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (url && serviceRoleKey && url.startsWith('http')) {
    supabaseAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseAdminClient;
  }
  return null;
}

// In-memory fallback stores for when Supabase Service Role is not yet configured
interface LocalUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'locked';
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  password?: string; // Only stored in local demo fallback
}

export interface LocalAuditLog {
  id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  target_user_id?: string | null;
  target_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

const localUsersStore: LocalUser[] = [
  {
    id: 'admin-001',
    user_id: 'admin-001',
    email: process.env.INITIAL_ADMIN_EMAIL || 'admin@eduexam.com',
    full_name: 'Quản trị viên Hệ thống (Admin)',
    role: 'admin',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    password: process.env.INITIAL_ADMIN_PASSWORD || '300506',
  },
  {
    id: 'user-gv-toan',
    user_id: 'user-gv-toan',
    email: 'giaovien.toan@eduexam.edu.vn',
    full_name: 'Thầy Nguyễn Văn An (Toán)',
    role: 'user',
    status: 'active',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'user-gv-van',
    user_id: 'user-gv-van',
    email: 'giaovien.van@eduexam.edu.vn',
    full_name: 'Cô Trần Thị Mai (Văn)',
    role: 'user',
    status: 'active',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const localAuditLogsStore: LocalAuditLog[] = [
  {
    id: 'log-001',
    actor_email: process.env.INITIAL_ADMIN_EMAIL || 'admin@eduexam.com',
    action: 'SYSTEM_INIT',
    entity_type: 'SYSTEM',
    entity_id: 'SYS-BOOT',
    metadata: { note: 'EduExam User Isolation & Security Subsystem Bootstrapped' },
    created_at: new Date().toISOString(),
  },
];

export async function logAuditEvent(entry: Omit<LocalAuditLog, 'id' | 'created_at'>) {
  const log: LocalAuditLog = {
    id: 'log-' + Math.random().toString(36).slice(2, 9),
    ...entry,
    created_at: new Date().toISOString(),
  };
  localAuditLogsStore.unshift(log);

  // Also persist to Supabase if connected
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      await admin.from('audit_logs').insert([
        {
          actor_user_id: entry.actor_user_id || null,
          actor_email: entry.actor_email || null,
          target_user_id: entry.target_user_id || null,
          target_email: entry.target_email || null,
          action: entry.action,
          entity_type: entry.entity_type || null,
          entity_id: entry.entity_id || null,
          metadata: entry.metadata || {},
        },
      ]);
    } catch (e) {
      console.warn('[Audit] Could not insert log to Supabase:', e);
    }
  }

  return log;
}

export function getLocalAuditLogs(limit = 100): LocalAuditLog[] {
  return localAuditLogsStore.slice(0, limit);
}

/**
 * Bootstrap the Initial Admin account on server start
 */
export async function bootstrapInitialAdmin() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@eduexam.com';
  const adminPass = process.env.INITIAL_ADMIN_PASSWORD || '300506';

  console.log(`[Admin Bootstrap] Checking initial admin account: ${adminEmail}...`);

  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      // Check if admin user already exists in auth.users
      const { data: userList, error: listError } = await admin.auth.admin.listUsers();
      if (listError) {
        console.warn('[Admin Bootstrap] listUsers error:', listError.message);
        return;
      }

      const users = (userList?.users as any[]) || [];
      const existing = users.find((u: any) => u.email?.toLowerCase() === adminEmail.toLowerCase());

      if (!existing) {
        console.log(`[Admin Bootstrap] Creating initial admin in Supabase Auth: ${adminEmail}`);
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email: adminEmail,
          password: adminPass,
          email_confirm: true,
          user_metadata: {
            full_name: 'Quản trị viên Hệ thống',
            role: 'admin',
          },
        });

        if (createError) {
          console.warn('[Admin Bootstrap] Create admin error:', createError.message);
        } else if (newUser.user) {
          // Upsert profile
          await admin.from('profiles').upsert([
            {
              user_id: newUser.user.id,
              email: adminEmail,
              full_name: 'Quản trị viên Hệ thống',
              role: 'admin',
              status: 'active',
            },
          ]);
          console.log('[Admin Bootstrap] Initial admin created successfully in Supabase!');
        }
      } else {
        // Ensure profile is marked as admin
        await admin.from('profiles').upsert([
          {
            user_id: existing.id,
            email: adminEmail,
            full_name: existing.user_metadata?.full_name || 'Quản trị viên Hệ thống',
            role: 'admin',
            status: 'active',
          },
        ]);
        console.log('[Admin Bootstrap] Initial admin already configured in Supabase.');
      }
    } catch (err: any) {
      console.warn('[Admin Bootstrap] Error configuring admin in Supabase:', err?.message);
    }
  } else {
    console.log('[Admin Bootstrap] Running in local/mock database mode. Admin account is ready in local store.');
  }
}

// --------------------------------------------------------------------------
// User Management Operations
// --------------------------------------------------------------------------

export async function listAllUsers() {
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { data, error } = await admin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('[Admin] Failed fetching from Supabase profiles, using local store:', err);
    }
  }

  // Fallback
  return localUsersStore.map(({ password, ...u }) => u);
}

export async function createNewUser(payload: {
  email: string;
  password?: string;
  full_name: string;
  status?: 'active' | 'inactive' | 'locked';
  actorEmail?: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const password = payload.password || '123456';
  const status = payload.status || 'active';
  const fullName = payload.full_name.trim();

  const admin = getSupabaseAdmin();
  let createdId = 'user-' + Math.random().toString(36).slice(2, 9);

  if (admin) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: 'user',
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        createdId = data.user.id;
        await admin.from('profiles').upsert([
          {
            user_id: data.user.id,
            email: normalizedEmail,
            full_name: fullName,
            role: 'user',
            status,
          },
        ]);
      }
    } catch (e: any) {
      throw new Error(e.message || 'Lỗi khi tạo người dùng trên Supabase Auth.');
    }
  } else {
    // Check duplicate in local store
    if (localUsersStore.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('Email này đã được đăng ký trong hệ thống.');
    }
    const newUser: LocalUser = {
      id: createdId,
      user_id: createdId,
      email: normalizedEmail,
      full_name: fullName,
      role: 'user',
      status,
      password,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localUsersStore.push(newUser);
  }

  await logAuditEvent({
    actor_email: payload.actorEmail || 'admin@eduexam.com',
    target_email: normalizedEmail,
    action: 'ADMIN_CREATE_USER',
    entity_type: 'USER',
    entity_id: createdId,
    metadata: { full_name: fullName, role: 'user', status },
  });

  return {
    id: createdId,
    user_id: createdId,
    email: normalizedEmail,
    full_name: fullName,
    role: 'user',
    status,
    created_at: new Date().toISOString(),
  };
}

export async function updateUserStatus(
  userId: string,
  newStatus: 'active' | 'inactive' | 'locked',
  actorEmail?: string
) {
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { error } = await admin
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  // Also update local store
  const target = localUsersStore.find((u) => u.user_id === userId || u.id === userId);
  if (target) {
    target.status = newStatus;
    target.updated_at = new Date().toISOString();
  }

  await logAuditEvent({
    actor_email: actorEmail || 'admin@eduexam.com',
    target_user_id: userId,
    target_email: target?.email || userId,
    action: newStatus === 'locked' ? 'ADMIN_LOCK_USER' : newStatus === 'active' ? 'ADMIN_UNLOCK_USER' : 'ADMIN_DEACTIVATE_USER',
    entity_type: 'USER',
    entity_id: userId,
    metadata: { new_status: newStatus },
  });

  return { success: true, status: newStatus };
}

export async function resetUserPassword(userId: string, newPass: string, actorEmail?: string) {
  if (!newPass || newPass.length < 6) {
    throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: newPass,
      });
      if (error) throw new Error(error.message);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  const target = localUsersStore.find((u) => u.user_id === userId || u.id === userId);
  if (target) {
    target.password = newPass;
    target.updated_at = new Date().toISOString();
  }

  await logAuditEvent({
    actor_email: actorEmail || 'admin@eduexam.com',
    target_user_id: userId,
    target_email: target?.email || userId,
    action: 'ADMIN_RESET_PASSWORD',
    entity_type: 'USER',
    entity_id: userId,
    metadata: { note: 'Admin updated password securely' },
  });

  return { success: true };
}

export async function checkUserDataDependencies(userId: string): Promise<{
  hasData: boolean;
  classCount: number;
  examCount: number;
  questionCount: number;
}> {
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const [classesRes, examsRes, questionsRes] = await Promise.all([
        admin.from('classes').select('id', { count: 'exact', head: true }).or(`user_id.eq.${userId},teacher_id.eq.${userId}`),
        admin.from('exams').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
        admin.from('questions').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      ]);

      const classCount = classesRes.count || 0;
      const examCount = examsRes.count || 0;
      const questionCount = questionsRes.count || 0;

      return {
        hasData: classCount > 0 || examCount > 0 || questionCount > 0,
        classCount,
        examCount,
        questionCount,
      };
    } catch (e) {
      // Ignore error and return safe default
    }
  }

  return { hasData: false, classCount: 0, examCount: 0, questionCount: 0 };
}

export async function deleteUserSafely(userId: string, force = false, actorEmail?: string) {
  // Check dependencies first
  const dependencies = await checkUserDataDependencies(userId);
  if (dependencies.hasData && !force) {
    return {
      success: false,
      blocked: true,
      dependencies,
      message: `Người dùng này đang có ${dependencies.classCount} lớp học, ${dependencies.examCount} đề thi và ${dependencies.questionCount} câu hỏi. Để bảo vệ toàn vẹn dữ liệu, hãy chuyển trạng thái sang "Khóa (locked)" hoặc "Tắt (inactive)".`,
    };
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      // If force, delete profile and auth user
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  const idx = localUsersStore.findIndex((u) => u.user_id === userId || u.id === userId);
  let targetEmail = '';
  if (idx !== -1) {
    targetEmail = localUsersStore[idx].email;
    localUsersStore.splice(idx, 1);
  }

  await logAuditEvent({
    actor_email: actorEmail || 'admin@eduexam.com',
    target_user_id: userId,
    target_email: targetEmail || userId,
    action: 'ADMIN_DELETE_USER',
    entity_type: 'USER',
    entity_id: userId,
    metadata: { forced: force },
  });

  return { success: true, blocked: false };
}
