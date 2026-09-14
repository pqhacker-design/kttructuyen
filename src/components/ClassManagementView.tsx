import React, { useEffect, useState, useMemo } from 'react';
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
  Hash,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  CopyPlus,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { ClassGroup, Student, Profile } from '../types';
import { 
  fetchClasses, 
  createClass, 
  createBulkClasses,
  deleteClass, 
  fetchStudentsByClass, 
  addStudentToClass, 
  addBulkStudents,
  deleteStudent 
} from '../services/classService';
import { ConfirmDialog } from './ConfirmDialog';
import { generateStudentCode } from '../lib/idUtils';

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
  const [isBulkAddClassOpen, setIsBulkAddClassOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isBulkAddStudentOpen, setIsBulkAddStudentOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Class Form (Single)
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState(10);
  const [schoolYear, setSchoolYear] = useState('2026 - 2027');

  // Bulk Class Form
  const [bulkClassText, setBulkClassText] = useState('');
  const [bulkDefaultGrade, setBulkDefaultGrade] = useState(10);
  const [bulkClassSchoolYear, setBulkClassSchoolYear] = useState('2026 - 2027');
  const [isSubmittingBulkClass, setIsSubmittingBulkClass] = useState(false);

  // New Student Form (Single)
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentStt, setStudentStt] = useState<number>(1);
  const [isAutoCode, setIsAutoCode] = useState<boolean>(true);

  // Bulk Student Form
  const [bulkStudentText, setBulkStudentText] = useState('');
  const [bulkSttMode, setBulkSttMode] = useState<'continue' | 'start1'>('continue');
  const [isSubmittingBulkStudent, setIsSubmittingBulkStudent] = useState(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Parse bulk classes dynamically
  const parsedBulkClasses = useMemo(() => {
    if (!bulkClassText.trim()) return [];
    const tokens = bulkClassText
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const result: { name: string; grade: number; school_year: string }[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      if (seen.has(token.toLowerCase())) continue;
      seen.add(token.toLowerCase());

      let detectedGrade = bulkDefaultGrade;
      const match = token.match(/^(6|7|8|9|10|11|12)/);
      if (match) {
        detectedGrade = parseInt(match[1]);
      }

      result.push({
        name: token,
        grade: detectedGrade,
        school_year: bulkClassSchoolYear.trim() || '2026 - 2027',
      });
    }
    return result;
  }, [bulkClassText, bulkDefaultGrade, bulkClassSchoolYear]);

  // Parse bulk students dynamically with smart auto-STT & auto-ID generation
  const parsedBulkStudents = useMemo(() => {
    if (!bulkStudentText.trim() || !selectedClass) return [];
    const lines = bulkStudentText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const result: { stt: number; student_code: string; full_name: string; email?: string }[] = [];
    const seenCodes = new Set<string>();

    const baseSeq = bulkSttMode === 'continue' ? students.length + 1 : 1;
    let autoIndex = 0;

    for (const rawLine of lines) {
      const lower = rawLine.toLowerCase();
      // Skip table header rows
      if (
        (lower.includes('stt') && (lower.includes('tên') || lower.includes('mã'))) ||
        lower.startsWith('họ và tên') ||
        lower.startsWith('họ tên') ||
        lower.startsWith('danh sách')
      ) {
        continue;
      }

      let parts: string[] = [];
      if (rawLine.includes('\t')) {
        parts = rawLine.split('\t').map((p) => p.trim()).filter((p) => p.length > 0);
      } else if (rawLine.includes('|')) {
        parts = rawLine.split('|').map((p) => p.trim()).filter((p) => p.length > 0);
      } else if (rawLine.includes(',') && !rawLine.match(/^\d+[\.\)]\s/)) {
        parts = rawLine.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
      } else {
        parts = [rawLine];
      }

      let detectedStt: number | null = null;
      let explicitCode = '';
      let name = '';
      let email = '';

      // Pattern 1: Numbered line (e.g. "1. Nguyễn Văn An", "01 - Nguyễn Văn An", "1/ Nguyễn Văn An")
      const orderMatch = parts[0]?.match(/^(\d+)[\.\)\/\-:\s]+\s*(.+)$/);
      if (orderMatch && parts.length === 1) {
        detectedStt = parseInt(orderMatch[1], 10);
        name = orderMatch[2].trim();
      } else if (parts.length >= 3) {
        if (/^\d+$/.test(parts[0])) {
          // Col 0: STT, Col 1: Họ tên, Col 2: Email hoặc Mã HS
          detectedStt = parseInt(parts[0], 10);
          name = parts[1];
          if (parts[2].includes('@')) {
            email = parts[2];
          } else {
            explicitCode = parts[2];
          }
        } else {
          // Col 0: Mã HS, Col 1: Họ tên, Col 2: Email
          explicitCode = parts[0];
          name = parts[1];
          email = parts[2];
        }
      } else if (parts.length === 2) {
        if (/^\d+$/.test(parts[0])) {
          // Col 0: STT, Col 1: Họ tên
          detectedStt = parseInt(parts[0], 10);
          name = parts[1];
        } else if (parts[1].includes('@')) {
          // Col 0: Họ tên, Col 1: Email
          name = parts[0];
          email = parts[1];
        } else {
          // Check if Col 0 is a code
          const isCodeFirst = /^[a-zA-Z0-9_\-\/]{2,12}$/.test(parts[0]) && !parts[0].includes(' ');
          if (isCodeFirst) {
            explicitCode = parts[0];
            name = parts[1];
          } else {
            name = `${parts[0]} ${parts[1]}`;
          }
        }
      } else {
        name = parts[0] || '';
      }

      name = name.trim();
      if (!name) continue;

      const effectiveStt = detectedStt !== null && !isNaN(detectedStt) ? detectedStt : (baseSeq + autoIndex);
      autoIndex++;

      let code = explicitCode
        ? explicitCode.toUpperCase().trim()
        : generateStudentCode(selectedClass.name, effectiveStt);

      let finalCode = code;
      let counter = 1;
      while (seenCodes.has(finalCode)) {
        finalCode = `${code}-${counter++}`;
      }
      seenCodes.add(finalCode);

      result.push({
        stt: effectiveStt,
        student_code: finalCode,
        full_name: name,
        email: email.trim() || undefined,
      });
    }

    return result;
  }, [bulkStudentText, selectedClass, bulkSttMode, students.length]);

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

  const handleOpenAddStudent = () => {
    if (!selectedClass) return;
    const nextStt = students.length + 1;
    setStudentStt(nextStt);
    setStudentName('');
    setStudentEmail('');
    setStudentCode(generateStudentCode(selectedClass.name, nextStt));
    setIsAutoCode(true);
    setIsAddStudentOpen(true);
  };

  const handleOpenBulkAddStudent = () => {
    if (!selectedClass) return;
    setBulkSttMode(students.length === 0 ? 'start1' : 'continue');
    setBulkStudentText('');
    setIsBulkAddStudentOpen(true);
  };

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

  const handleCreateBulkClasses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) {
      onOpenAuth();
      return;
    }
    if (parsedBulkClasses.length === 0) {
      alert('Vui lòng nhập danh sách tên lớp học.');
      return;
    }
    setIsSubmittingBulkClass(true);
    try {
      await createBulkClasses(
        parsedBulkClasses.map((cls) => ({
          ...cls,
          owner_id: currentProfile.user_id,
        }))
      );
      setIsBulkAddClassOpen(false);
      setBulkClassText('');
      await loadClasses();
    } catch (err: any) {
      alert('Lỗi thêm danh sách lớp: ' + err.message);
    } finally {
      setIsSubmittingBulkClass(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !selectedClass) return;

    if (!studentName.trim()) {
      alert('Vui lòng nhập họ và tên học sinh.');
      return;
    }

    const finalCode = (
      studentCode.trim() || generateStudentCode(selectedClass.name, studentStt)
    ).toUpperCase();

    try {
      const added = await addStudentToClass({
        class_id: selectedClassId,
        full_name: studentName.trim(),
        student_code: finalCode,
        email: studentEmail.trim() || undefined,
      });

      if (!added) {
        throw new Error('Không thể thêm học sinh. Vui lòng thử lại.');
      }

      setIsAddStudentOpen(false);
      setStudentName('');
      setStudentCode('');
      setStudentEmail('');
      
      await loadStudents(selectedClassId);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId
            ? { ...c, student_count: (c.student_count || 0) + 1 }
            : c
        )
      );
    } catch (err: any) {
      alert('Lỗi thêm học sinh: ' + (err?.message || 'Không xác định'));
    }
  };

  const handleCreateBulkStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !selectedClass) return;
    if (parsedBulkStudents.length === 0) {
      alert('Vui lòng nhập hoặc dán danh sách học sinh.');
      return;
    }
    setIsSubmittingBulkStudent(true);
    try {
      const countToAdd = parsedBulkStudents.length;
      await addBulkStudents(
        parsedBulkStudents.map((st) => ({
          student_code: st.student_code,
          full_name: st.full_name,
          email: st.email,
          class_id: selectedClassId,
        }))
      );
      setIsBulkAddStudentOpen(false);
      setBulkStudentText('');
      await loadStudents(selectedClassId);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId
            ? { ...c, student_count: (c.student_count || 0) + countToAdd }
            : c
        )
      );
    } catch (err: any) {
      alert('Lỗi thêm học sinh hàng loạt: ' + err.message);
    } finally {
      setIsSubmittingBulkStudent(false);
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
      if (selectedClassId) {
        setClasses((prev) =>
          prev.map((c) =>
            c.id === selectedClassId
              ? { ...c, student_count: Math.max(0, (c.student_count || 0) - 1) }
              : c
          )
        );
      }
      setStudentToDelete(null);
    } catch (err: any) {
      alert('Lỗi xóa học sinh: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

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

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => {
              if (!currentProfile) {
                onOpenAuth();
                return;
              }
              setIsBulkAddClassOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 shadow-xs transition-colors flex items-center space-x-1.5"
            title="Thêm hàng loạt nhiều lớp học cùng lúc"
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Thêm nhiều lớp hàng loạt</span>
          </button>

          <button
            onClick={() => {
              if (!currentProfile) {
                onOpenAuth();
                return;
              }
              setIsAddClassOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm 1 lớp</span>
          </button>
        </div>
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
                <div className="flex items-center space-x-2 self-start sm:self-auto">
                  <button
                    onClick={handleOpenBulkAddStudent}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-xs transition-colors flex items-center space-x-1.5"
                    title="Dán danh sách từ Excel hoặc nhập nhiều học sinh"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Thêm nhiều học sinh hàng loạt</span>
                  </button>
                  <button
                    onClick={handleOpenAddStudent}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Thêm 1 học sinh</span>
                  </button>
                </div>
              )}
            </div>

            {/* Students Table */}
            {!selectedClass ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Chọn một lớp học ở danh sách bên trái để xem học sinh.
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-3">
                <p>Lớp {selectedClass.name} hiện chưa có học sinh nào.</p>
                <div className="flex items-center justify-center space-x-2 pt-1">
                  <button
                    onClick={handleOpenBulkAddStudent}
                    className="px-3.5 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-xs hover:bg-indigo-700 flex items-center space-x-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Dán danh sách học sinh từ Excel</span>
                  </button>
                  <button
                    onClick={handleOpenAddStudent}
                    className="px-3.5 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-lg border border-indigo-200 hover:bg-indigo-100"
                  >
                    Thêm từng học sinh
                  </button>
                </div>
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

      {/* Modal: Bulk Add Classes */}
      {isBulkAddClassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-base">Thêm nhiều lớp học hàng loạt</h3>
              </div>
              <button 
                onClick={() => setIsBulkAddClassOpen(false)} 
                className="text-indigo-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBulkClasses} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-indigo-800">
                  <AlertCircle className="w-4 h-4 text-indigo-600" />
                  Hướng dẫn nhập danh sách lớp:
                </p>
                <p className="text-slate-600">
                  Nhập danh sách tên các lớp, cách nhau bởi <strong>dấu phẩy, chấm phẩy hoặc xuống dòng</strong>. Hệ thống tự động nhận diện Khối lớp (VD: 6A1 &rarr; Khối 6, 10A2 &rarr; Khối 10...).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Danh sách tên lớp học
                </label>
                <textarea
                  rows={4}
                  required
                  value={bulkClassText}
                  onChange={(e) => setBulkClassText(e.target.value)}
                  placeholder={`Ví dụ nhập:\n10A1, 10A2, 10A3, 10A4\nhoặc mỗi dòng một lớp:\n6A1\n6A2\n7A1\n8A1\n9A1`}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Khối mặc định (nếu tên lớp không có số)
                  </label>
                  <select
                    value={bulkDefaultGrade}
                    onChange={(e) => setBulkDefaultGrade(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <optgroup label="Cấp THCS">
                      <option value={6}>Khối 6</option>
                      <option value={7}>Khối 7</option>
                      <option value={8}>Khối 8</option>
                      <option value={9}>Khối 9</option>
                    </optgroup>
                    <optgroup label="Cấp THPT">
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
                    value={bulkClassSchoolYear}
                    onChange={(e) => setBulkClassSchoolYear(e.target.value)}
                    placeholder="2026 - 2027"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Preview parsed classes */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Xem trước danh sách ({parsedBulkClasses.length} lớp):
                  </span>
                  {parsedBulkClasses.length > 0 && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Hợp lệ
                    </span>
                  )}
                </div>

                {parsedBulkClasses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa có lớp nào được nhận diện. Vui lòng nhập tên lớp vào ô phía trên.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {parsedBulkClasses.map((cls, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-900 rounded-md text-xs font-medium shadow-2xs"
                      >
                        <span className="font-bold">{cls.name}</span>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded">
                          Khối {cls.grade}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBulkAddClassOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={parsedBulkClasses.length === 0 || isSubmittingBulkClass}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center space-x-1.5"
                >
                  {isSubmittingBulkClass ? (
                    <span>Đang tạo lớp...</span>
                  ) : (
                    <span>Tạo {parsedBulkClasses.length} lớp học</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Student */}
      {isAddStudentOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Thêm Học sinh vào lớp {selectedClass.name}</h3>
              </div>
              <button onClick={() => setIsAddStudentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              {/* STT Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Số thứ tự (STT) trong lớp
                  </label>
                  <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                    Tự động đánh số
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={studentStt}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setStudentStt(val);
                    if (isAutoCode && selectedClass) {
                      setStudentCode(generateStudentCode(selectedClass.name, val));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="VD: Nguyễn Văn An"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Student Code / ID with Auto-generation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mã học sinh / SBD
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedClass) {
                        setStudentCode(generateStudentCode(selectedClass.name, studentStt));
                        setIsAutoCode(true);
                      }
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    title="Tự động sinh lại theo tên lớp và STT"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tự sinh mã ({generateStudentCode(selectedClass.name, studentStt)})</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={studentCode}
                    onChange={(e) => {
                      setStudentCode(e.target.value.toUpperCase());
                      setIsAutoCode(false);
                    }}
                    placeholder={generateStudentCode(selectedClass.name, studentStt)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                  {isAutoCode && (
                    <span className="absolute right-2.5 top-2.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Tự sinh
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Quy tắc sinh mã: Tên lớp + STT (ví dụ: <strong className="text-slate-800 font-mono">{generateStudentCode(selectedClass.name, studentStt)}</strong>)
                </p>
              </div>

              {/* Email */}
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

      {/* Modal: Bulk Add Students */}
      {isBulkAddStudentOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-base">
                  Thêm học sinh hàng loạt vào lớp {selectedClass.name}
                </h3>
              </div>
              <button 
                onClick={() => setIsBulkAddStudentOpen(false)} 
                className="text-indigo-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBulkStudents} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Auto STT & Code Mode Selector */}
              <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Tự động đánh số thứ tự & sinh Mã HS
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mã HS sinh theo tên lớp + STT: <strong className="text-indigo-700 font-mono">{generateStudentCode(selectedClass.name, 1)}</strong>, <strong className="text-indigo-700 font-mono">{generateStudentCode(selectedClass.name, 2)}</strong>...
                  </p>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-indigo-200 text-xs self-start sm:self-auto shrink-0 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setBulkSttMode('continue')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      bulkSttMode === 'continue'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tiếp nối ({students.length + 1}...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkSttMode('start1')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      bulkSttMode === 'start1'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Từ 1 (01...)
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1.5">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CopyPlus className="w-4 h-4 text-indigo-600" />
                  Hướng dẫn dán danh sách:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[11px]">
                  <li>
                    <strong>Chỉ cần dán tên học sinh:</strong> Mỗi bạn một dòng (hoặc có số thứ tự như <code className="bg-slate-200 text-slate-800 px-1 rounded">1. Nguyễn Văn An</code>). Hệ thống sẽ tự động đánh STT và sinh mã HS dạng <strong className="text-indigo-700 font-mono">{generateStudentCode(selectedClass.name, 1)}</strong>.
                  </li>
                  <li>
                    <strong>Dán từ Excel / Google Sheets:</strong> Copy các cột (STT, Họ và tên, Email) rồi dán trực tiếp vào ô bên dưới.
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nội dung danh sách học sinh
                </label>
                <textarea
                  rows={6}
                  required
                  value={bulkStudentText}
                  onChange={(e) => setBulkStudentText(e.target.value)}
                  placeholder={`Dán danh sách vào đây, ví dụ:\n1. Nguyễn Văn An\n2. Trần Thị Bình\n3. Lê Quốc Cường\n\nHoặc copy từ Excel:\n1\tNguyễn Văn An\tan@gmail.com\n2\tTrần Thị Bình\tbinh@gmail.com`}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Preview parsed students table */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Bảng xem trước ({parsedBulkStudents.length} học sinh):
                  </span>
                  {parsedBulkStudents.length > 0 && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tự động sinh mã HS hoàn tất
                    </span>
                  )}
                </div>

                {parsedBulkStudents.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                    Chưa có dữ liệu học sinh. Dán hoặc nhập danh sách vào ô phía trên để xem trước.
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2 text-center w-12">STT</th>
                          <th className="p-2 w-32">Mã HS tự sinh</th>
                          <th className="p-2">Họ và tên</th>
                          <th className="p-2">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedBulkStudents.map((st, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-bold text-slate-500">{st.stt}</td>
                            <td className="p-2">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                {st.student_code}
                              </span>
                            </td>
                            <td className="p-2 font-medium text-slate-900">{st.full_name}</td>
                            <td className="p-2 text-slate-500">{st.email || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBulkAddStudentOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={parsedBulkStudents.length === 0 || isSubmittingBulkStudent}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center space-x-1.5"
                >
                  {isSubmittingBulkStudent ? (
                    <span>Đang lưu danh sách...</span>
                  ) : (
                    <span>Lưu {parsedBulkStudents.length} học sinh vào lớp</span>
                  )}
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
