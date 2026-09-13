import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  UserPlus, 
  GraduationCap, 
  Search, 
  CheckCircle2, 
  X,
  Mail,
  Hash
} from 'lucide-react';
import { ClassGroup, Student, Profile } from '../types';
import { fetchClasses, createClass, deleteClass, fetchStudentsByClass, addStudentToClass, deleteStudent } from '../services/classService';
import { ConfirmDialog } from './ConfirmDialog';

interface ClassManagementViewProps {
  currentProfile: Profile | null;
  onOpenAuth: () => void;
}

export const ClassManagementView: React.FC<ClassManagementViewProps> = ({
  currentProfile,
  onOpenAuth,
}) => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Class Form
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState(10);
  const [schoolYear, setSchoolYear] = useState('2026 - 2027');

  // New Student Form
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  useEffect(() => {
    loadClasses();
  }, [currentProfile]);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const cList = await fetchClasses(currentProfile?.user_id);
      setClasses(cList);
      if (cList.length > 0 && !selectedClassId) {
        setSelectedClassId(cList[0].id);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (cId: string) => {
    try {
      const sList = await fetchStudentsByClass(cId);
      setStudents(sList);
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    try {
      await createClass({
        owner_id: currentProfile.user_id,
        name: className.trim(),
        grade: classGrade,
        school_year: schoolYear,
      });
      setIsAddClassOpen(false);
      setClassName('');
      await loadClasses();
    } catch (err: any) {
      alert('Lỗi tạo lớp học: ' + err.message);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;

    try {
      await addStudentToClass({
        class_id: selectedClassId,
        full_name: studentName.trim(),
        student_code: studentCode.trim().toUpperCase(),
        email: studentEmail.trim() || undefined,
      });
      setIsAddStudentOpen(false);
      setStudentName('');
      setStudentCode('');
      setStudentEmail('');
      await loadStudents(selectedClassId);
    } catch (err: any) {
      alert('Lỗi thêm học sinh: ' + err.message);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClass(classToDelete.id);
      const updated = classes.filter((c) => c.id !== classToDelete.id);
      setClasses(updated);
      if (selectedClassId === classToDelete.id) {
        setSelectedClassId(updated[0]?.id || '');
      }
      setClassToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa lớp: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
      setStudents(students.filter((s) => s.id !== studentToDelete.id));
      setStudentToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa học sinh: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quản lý Lớp học & Học sinh</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tổ chức danh sách lớp theo khối lớp và theo dõi kết quả làm bài theo từng đơn vị lớp
          </p>
        </div>

        <button
          onClick={() => {
            if (!currentProfile) {
              onOpenAuth();
              return;
            }
            setIsAddClassOpen(true);
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm lớp học mới</span>
        </button>
      </div>

      {/* Main Layout: Classes Sidebar + Student Roster */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Class list (Left) */}
        <div className="md:col-span-4 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Danh sách lớp học ({classes.length})
            </h3>

            {loading ? (
              <div className="text-xs text-slate-400 py-4 text-center">Đang tải danh sách lớp...</div>
            ) : classes.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center space-y-2">
                <p>Chưa có lớp học nào.</p>
                <button
                  onClick={() => setIsAddClassOpen(true)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 font-semibold rounded-lg"
                >
                  Tạo lớp ngay
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {classes.map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  return (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-200 shadow-xs'
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-sm text-slate-900 block">{cls.name}</span>
                        <span className="text-[11px] text-slate-500">Khối {cls.grade} • Năm học {cls.school_year}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClassToDelete(cls);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Student Roster (Right) */}
        <div className="md:col-span-8 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedClass ? `Danh sách học sinh lớp ${selectedClass.name}` : 'Danh sách học sinh'}
                </h3>
                <p className="text-xs text-slate-500">
                  {students.length} học sinh trong danh sách
                </p>
              </div>

              {selectedClass && (
                <button
                  onClick={() => setIsAddStudentOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Thêm học sinh</span>
                </button>
              )}
            </div>

            {/* Students Table */}
            {!selectedClass ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Chọn một lớp học ở danh sách bên trái để xem học sinh.
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <p>Lớp {selectedClass.name} hiện chưa có học sinh nào.</p>
                <button
                  onClick={() => setIsAddStudentOpen(true)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 font-semibold rounded-lg"
                >
                  Thêm học sinh vào lớp
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-center">STT</th>
                      <th className="p-3">Mã học sinh</th>
                      <th className="p-3">Họ và tên</th>
                      <th className="p-3">Email</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-medium text-slate-800">{st.student_code}</td>
                        <td className="p-3 font-semibold text-slate-900">{st.full_name}</td>
                        <td className="p-3 text-slate-500">{st.email || '---'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setStudentToDelete(st)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Create Class */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Tạo Lớp học Mới</h3>
              <button onClick={() => setIsAddClassOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên lớp
                </label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="VD: 10A1, 11B3, 12 Tin..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Khối lớp
                  </label>
                  <select
                    value={classGrade}
                    onChange={(e) => setClassGrade(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                  >
                    <optgroup label="Cấp Trung học cơ sở (THCS)">
                      <option value={6}>Khối 6</option>
                      <option value={7}>Khối 7</option>
                      <option value={8}>Khối 8</option>
                      <option value={9}>Khối 9</option>
                    </optgroup>
                    <optgroup label="Cấp Trung học phổ thông (THPT)">
                      <option value={10}>Khối 10</option>
                      <option value={11}>Khối 11</option>
                      <option value={12}>Khối 12</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Năm học
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(e.target.value)}
                    placeholder="2026 - 2027"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Student */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Thêm Học sinh vào lớp</h3>
              <button onClick={() => setIsAddStudentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="VD: Trần Hoàng Long"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã học sinh / SBD
                </label>
                <input
                  type="text"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  placeholder="VD: HS1001, 10A1-05..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (tùy chọn)
                </label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@school.edu.vn"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Dialog for Deleting Class */}
      <ConfirmDialog
        isOpen={!!classToDelete}
        title="Xác nhận xóa Lớp học"
        message={`Bạn có chắc chắn muốn xóa lớp "${classToDelete?.name}"? Toàn bộ học sinh thuộc lớp này cũng sẽ bị xóa khỏi hệ thống.`}
        confirmLabel="Xóa lớp học"
        loading={isDeleting}
        onCancel={() => setClassToDelete(null)}
        onConfirm={handleConfirmDeleteClass}
      />

      {/* Confirmation Dialog for Deleting Student */}
      <ConfirmDialog
        isOpen={!!studentToDelete}
        title="Xác nhận xóa Học sinh"
        message={`Bạn có chắc muốn xóa học sinh "${studentToDelete?.full_name}" (${studentToDelete?.student_code}) khỏi lớp?`}
        confirmLabel="Xóa học sinh"
        loading={isDeleting}
        onCancel={() => setStudentToDelete(null)}
        onConfirm={handleConfirmDeleteStudent}
      />
    </div>
  );
};
