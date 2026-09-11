import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Search, 
  Lock, 
  Unlock, 
  KeyRound, 
  Trash2, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Mail,
  UserCheck,
  Ban,
  Activity
} from 'lucide-react';
import { Profile, AuditLog } from '../types';
import { 
  AdminUserItem, 
  fetchAllUsers, 
  createAdminUser, 
  changeUserStatus, 
  resetUserPassword, 
  deleteUser, 
  fetchAuditLogs 
} from '../services/userService';

interface AdminUsersViewProps {
  currentProfile: Profile | null;
  onOpenAuth?: () => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  currentProfile,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'locked'>('all');

  // Modal states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [selectedUserForPass, setSelectedUserForPass] = useState<AdminUserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserPass, setNewUserPass] = useState('123456');
  const [newUserStatus, setNewUserStatus] = useState<'active' | 'inactive' | 'locked'>('active');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentProfile?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      if (activeTab === 'users') {
        const data = await fetchAllUsers();
        setUsers(data);
      } else {
        const logs = await fetchAuditLogs();
        setAuditLogs(logs);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi khi tải dữ liệu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserFullName.trim()) return;

    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await createAdminUser({
        email: newUserEmail.trim(),
        full_name: newUserFullName.trim(),
        password: newUserPass,
        status: newUserStatus,
        actorEmail: currentProfile?.email,
      });

      setFeedbackMsg({ type: 'success', text: `Đã tạo thành công người dùng "${newUserFullName}"!` });
      setIsAddUserOpen(false);
      setNewUserEmail('');
      setNewUserFullName('');
      setNewUserPass('123456');
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Không thể tạo người dùng.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: AdminUserItem, newStatus: 'active' | 'inactive' | 'locked') => {
    const actionName = newStatus === 'locked' ? 'Khóa' : newStatus === 'active' ? 'Kích hoạt' : 'Tắt';
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái tài khoản ${user.email} sang "${actionName}"?`)) {
      return;
    }

    try {
      await changeUserStatus(user.user_id || user.id, newStatus, currentProfile?.email);
      setFeedbackMsg({ type: 'success', text: `Đã chuyển tài khoản ${user.email} sang trạng thái: ${newStatus}.` });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Không thể cập nhật trạng thái.' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPass || newPasswordInput.length < 6) return;

    setActionLoading(true);
    try {
      await resetUserPassword(selectedUserForPass.user_id || selectedUserForPass.id, newPasswordInput, currentProfile?.email);
      setFeedbackMsg({ type: 'success', text: `Đã đổi mật khẩu mới cho ${selectedUserForPass.email} thành công!` });
      setIsResetPassOpen(false);
      setSelectedUserForPass(null);
      setNewPasswordInput('');
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Không thể đổi mật khẩu.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: AdminUserItem) => {
    if (!window.confirm(`CẢNH BÁO BẢO MẬT: Bạn có chắc chắn muốn xóa tài khoản ${user.email}?`)) {
      return;
    }

    try {
      const res = await deleteUser(user.user_id || user.id, false, currentProfile?.email);
      if (res.blocked) {
        // Show dependency notice
        const force = window.confirm(`${res.message}\n\nBạn có muốn XÓA BẮT BUỘC (Force Delete) toàn bộ tài khoản và các dữ liệu liên quan không?`);
        if (force) {
          await deleteUser(user.user_id || user.id, true, currentProfile?.email);
          setFeedbackMsg({ type: 'success', text: `Đã xóa bắt buộc tài khoản ${user.email}.` });
          loadData();
        }
      } else {
        setFeedbackMsg({ type: 'success', text: `Đã xóa tài khoản ${user.email} an toàn.` });
        loadData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Không thể xóa tài khoản.' });
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Quản trị Người dùng & Phân quyền</h1>
              <p className="text-sm text-slate-500">
                Quản lý các tài khoản giáo viên, phân quyền truy cập và kiểm soát không gian dữ liệu riêng biệt.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách tài khoản ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Nhật ký Kiểm toán (Audit Logs)</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'users' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo email hoặc họ tên..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tất cả</option>
                <option value="active">Đang hoạt động (active)</option>
                <option value="locked">Bị khóa (locked)</option>
                <option value="inactive">Tạm ngưng (inactive)</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Họ tên & Email</th>
                  <th className="px-6 py-3.5">Vai trò</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Đăng nhập gần nhất</th>
                  <th className="px-6 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Đang tải danh sách người dùng...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Không tìm thấy người dùng nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelf = user.email === currentProfile?.email;
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                              {user.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center space-x-2">
                                <span>{user.full_name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {user.role === 'admin' ? 'Quản trị viên (admin)' : 'Giáo viên (user)'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : user.status === 'locked'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {user.status === 'active' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {user.status === 'locked' && <Ban className="w-3.5 h-3.5" />}
                            <span>
                              {user.status === 'active'
                                ? 'Hoạt động'
                                : user.status === 'locked'
                                ? 'Đã khóa'
                                : 'Tạm ngưng'}
                            </span>
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-500">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleString('vi-VN')
                            : 'Chưa ghi nhận'}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Reset password */}
                            <button
                              onClick={() => {
                                setSelectedUserForPass(user);
                                setIsResetPassOpen(true);
                              }}
                              title="Đặt lại mật khẩu"
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Lock / Unlock status */}
                            {user.status === 'locked' ? (
                              <button
                                onClick={() => handleToggleStatus(user, 'active')}
                                title="Mở khóa tài khoản"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(user, 'locked')}
                                disabled={isSelf}
                                title={isSelf ? 'Không thể tự khóa tài khoản của mình' : 'Khóa tài khoản'}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isSelf}
                              title={isSelf ? 'Không thể xóa tài khoản của mình' : 'Xóa tài khoản'}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Audit Logs Table */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Nhật ký truy vết hành vi bảo mật (100 sự kiện gần nhất)</span>
            </h3>
            <span className="text-xs text-slate-500">Bảo vệ tính toàn vẹn hệ thống</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Thời gian</th>
                  <th className="px-6 py-3.5">Người thực hiện</th>
                  <th className="px-6 py-3.5">Hành vi (Action)</th>
                  <th className="px-6 py-3.5">Đối tượng tác động</th>
                  <th className="px-6 py-3.5">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Đang tải nhật ký...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Chưa có nhật ký kiểm toán nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">
                          {log.actor_email || log.actor_user_id || 'System'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {log.target_email || log.entity_type || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 max-w-xs truncate">
                        {JSON.stringify(log.metadata || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <UserPlus className="w-5 h-5" />
                <span>Thêm tài khoản giáo viên mới</span>
              </h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="giaovien@eduexam.edu.vn"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên giáo viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  placeholder="Thầy Nguyễn Văn A"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu ban đầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Người dùng có thể tự đổi mật khẩu sau khi đăng nhập.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trạng thái khởi tạo
                </label>
                <select
                  value={newUserStatus}
                  onChange={(e: any) => setNewUserStatus(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Hoạt động (active)</option>
                  <option value="inactive">Tạm ngưng (inactive)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center space-x-2"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Tạo tài khoản</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPassOpen && selectedUserForPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <span>Đặt lại mật khẩu</span>
              </h3>
              <button
                onClick={() => setIsResetPassOpen(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Đang đặt lại mật khẩu cho tài khoản:{' '}
                <span className="font-semibold text-slate-800">{selectedUserForPass.email}</span>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsResetPassOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || newPasswordInput.length < 6}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Cập nhật mật khẩu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
