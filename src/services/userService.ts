import { Profile, AuditLog } from '../types';

export interface AdminUserItem extends Profile {
  last_login_at?: string;
  status: 'active' | 'inactive' | 'locked';
}

export interface UserIsolationReport {
  timestamp: string;
  total: number;
  passedCount: number;
  failedCount: number;
  durationMs: number;
  overallStatus: 'PASSED' | 'FAILED';
  environment: string;
  results: {
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    durationMs: number;
    description: string;
    details?: string;
    evidence?: Record<string, any>;
  }[];
}

export async function fetchAllUsers(): Promise<AdminUserItem[]> {
  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      return data.users;
    }
  } catch (err) {
    console.warn('Error fetching users from API:', err);
  }

  // Fallback if offline
  return [
    {
      id: 'admin-001',
      user_id: 'admin-001',
      email: 'admin@eduexam.com',
      full_name: 'Quản trị viên Hệ thống (Admin)',
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'user-002',
      user_id: 'user-002',
      email: 'giaovien.toan@eduexam.edu.vn',
      full_name: 'Thầy Nguyễn Văn An (Toán)',
      role: 'user',
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'user-003',
      user_id: 'user-003',
      email: 'giaovien.van@eduexam.edu.vn',
      full_name: 'Cô Trần Thị Mai (Văn)',
      role: 'user',
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}

export async function createAdminUser(payload: {
  email: string;
  full_name: string;
  password?: string;
  status?: 'active' | 'inactive' | 'locked';
  actorEmail?: string;
}): Promise<AdminUserItem> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Không thể tạo tài khoản người dùng.');
  }
  return data.user;
}

export async function changeUserStatus(
  userId: string,
  newStatus: 'active' | 'inactive' | 'locked',
  actorEmail?: string
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, actorEmail }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Không thể cập nhật trạng thái người dùng.');
  }
}

export async function resetUserPassword(
  userId: string,
  newPass: string,
  actorEmail?: string
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPass, actorEmail }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Không thể đặt lại mật khẩu.');
  }
}

export async function deleteUser(
  userId: string,
  force = false,
  actorEmail?: string
): Promise<{ success: boolean; blocked?: boolean; message?: string }> {
  const res = await fetch(`/api/admin/users/${userId}?force=${force}&actorEmail=${encodeURIComponent(actorEmail || '')}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const res = await fetch('/api/admin/audit-logs');
    const data = await res.json();
    if (data.success && Array.isArray(data.logs)) {
      return data.logs;
    }
  } catch (err) {
    console.warn('Error fetching audit logs:', err);
  }
  return [];
}

export async function runUserIsolationTests(): Promise<UserIsolationReport> {
  const res = await fetch('/api/test/user-isolation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Lỗi khi thực hiện bộ kiểm thử phân quyền.');
  }
  return data.report;
}
