import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { SchoolClass, Student, DEFAULT_ACADEMIC_YEAR } from '../types';
import { mockStore } from './mockStore';
import { isUUID } from '../lib/idUtils';
import { clearStudentExamHistory } from './resultService';

export async function fetchClasses(teacherId?: string): Promise<SchoolClass[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getClasses();
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('classes')
      .select(`
        *,
        students:students(count)
      `)
      .order('grade', { ascending: true })
      .order('name', { ascending: true });

    if (teacherId && isUUID(teacherId)) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for classes:', error.message);
      return mockStore.getClasses();
    }

    const mapped = (data || []).map((c: any) => ({
      ...c,
      student_count: c.students?.[0]?.count || 0,
    }));
    mockStore.syncClasses(mapped);
    return mapped;
  } catch (err: any) {
    console.warn('Network error fetching classes, using local store:', err?.message);
    return mockStore.getClasses();
  }
}

export async function createClass(cls: {
  name: string;
  grade: number;
  school_year: string;
  teacher_id?: string;
  owner_id?: string;
}): Promise<SchoolClass | null> {
  const localClass = mockStore.addClass(cls);
  if (!isSupabaseConfigured()) {
    return localClass;
  }

  try {
    const supabase = getSupabase();
    const payload: any = {
      name: cls.name.trim(),
      grade: cls.grade,
      school_year: cls.school_year || DEFAULT_ACADEMIC_YEAR,
    };
    if (cls.teacher_id && isUUID(cls.teacher_id)) {
      payload.teacher_id = cls.teacher_id;
    } else if (cls.owner_id && isUUID(cls.owner_id)) {
      payload.teacher_id = cls.owner_id;
    }

    const { data, error } = await supabase
      .from('classes')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase class create error, class retained in local store:', error.message);
      return localClass;
    }
    if (data) {
      mockStore.syncClasses([data]);
      return data;
    }
    return localClass;
  } catch (err: any) {
    console.warn('Network error creating class in Supabase, using local store:', err?.message);
    return localClass;
  }
}

export async function createBulkClasses(classList: {
  name: string;
  grade: number;
  school_year: string;
  teacher_id?: string;
  owner_id?: string;
}[]): Promise<SchoolClass[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.addBulkClasses(classList);
  }

  try {
    const supabase = getSupabase();
    const payloads = classList.map((cls) => ({
      name: cls.name,
      grade: cls.grade,
      school_year: cls.school_year || DEFAULT_ACADEMIC_YEAR,
      teacher_id: cls.teacher_id || cls.owner_id,
    }));
    const { data, error } = await supabase
      .from('classes')
      .insert(payloads)
      .select();

    if (error || !data) {
      return mockStore.addBulkClasses(classList);
    }
    return data;
  } catch (err) {
    return mockStore.addBulkClasses(classList);
  }
}

export async function fetchStudents(classId?: string): Promise<Student[]> {
  const localList = mockStore.getStudents(classId);

  if (!isSupabaseConfigured() || (classId && !isUUID(classId))) {
    return localList;
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('students')
      .select(`
        *,
        class:classes(name)
      `)
      .order('student_code', { ascending: true });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for students:', error.message);
      return localList;
    }

    const remoteStudents: Student[] = (data || []).map((s: any) => ({
      ...s,
      class_name: s.class?.name || 'Chưa phân lớp',
    }));

    // Merge remote and local students, avoiding duplicates
    const combined = [...remoteStudents];
    for (const loc of localList) {
      const exists = combined.some(
        (r) => r.id === loc.id || (r.student_code && r.student_code.toUpperCase() === loc.student_code.toUpperCase())
      );
      if (!exists) {
        combined.push(loc);
      }
    }

    return combined;
  } catch (err: any) {
    console.warn('Network error fetching students, using local store:', err?.message);
    return localList;
  }
}

export const fetchStudentsByClass = fetchStudents;

export async function lookupStudentByCode(studentCode: string): Promise<Student | null> {
  const clean = studentCode.trim().toUpperCase();
  if (!clean) return null;

  if (!isSupabaseConfigured()) {
    return mockStore.findStudentByCode(clean);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        class:classes(name)
      `)
      .ilike('student_code', clean)
      .maybeSingle();

    if (error || !data) {
      return mockStore.findStudentByCode(clean);
    }

    return {
      ...data,
      class_name: data.class?.name || data.class_name || 'Chưa phân lớp',
    };
  } catch (err) {
    return mockStore.findStudentByCode(clean);
  }
}

export async function addStudentToClass(student: {
  student_code: string;
  full_name: string;
  class_id: string;
  email?: string;
}): Promise<Student | null> {
  const cleanCode = student.student_code.trim().toUpperCase();
  const cleanName = student.full_name.trim();

  // Always save locally first so student is guaranteed to be saved
  const localStudent = mockStore.addStudent({
    student_code: cleanCode,
    full_name: cleanName,
    class_id: student.class_id,
    email: student.email,
  });

  if (!isSupabaseConfigured() || !isUUID(student.class_id)) {
    return localStudent;
  }

  try {
    const supabase = getSupabase();
    // Do not send fields not in Supabase schema (e.g. email)
    const payload: any = {
      student_code: cleanCode,
      full_name: cleanName,
      class_id: student.class_id,
    };
    const { data, error } = await supabase
      .from('students')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase student insert error, retained in local store:', error.message);
      return localStudent;
    }
    return data;
  } catch (err: any) {
    console.warn('Error adding student to Supabase, retained in local store:', err?.message);
    return localStudent;
  }
}

export async function addBulkStudents(studentsList: {
  student_code: string;
  full_name: string;
  class_id: string;
  email?: string;
}[]): Promise<Student[]> {
  const localSaved = mockStore.addBulkStudents(studentsList);

  const firstClassId = studentsList[0]?.class_id;
  if (!isSupabaseConfigured() || !firstClassId || !isUUID(firstClassId)) {
    return localSaved;
  }

  try {
    const supabase = getSupabase();
    const payloads = studentsList.map((st) => ({
      student_code: st.student_code.trim().toUpperCase(),
      full_name: st.full_name.trim(),
      class_id: st.class_id,
    }));
    const { data, error } = await supabase
      .from('students')
      .insert(payloads)
      .select();

    if (error || !data) {
      console.warn('Supabase bulk student insert error, retained in local store:', error?.message);
      return localSaved;
    }
    return data;
  } catch (err: any) {
    console.warn('Network error adding bulk students to Supabase, retained in local store:', err?.message);
    return localSaved;
  }
}

export async function deleteClass(classId: string): Promise<boolean> {
  const localStudents = mockStore.getStudents(classId);
  const studentCodes = new Set<string>(localStudents.map((s) => (s.student_code || '').trim().toUpperCase()).filter(Boolean));

  mockStore.deleteClass(classId);

  if (isSupabaseConfigured() && isUUID(classId)) {
    try {
      const supabase = getSupabase();
      const { data: dbStudents } = await supabase.from('students').select('student_code').eq('class_id', classId);
      for (const s of (dbStudents || [])) {
        if (s.student_code) {
          studentCodes.add(s.student_code.trim().toUpperCase());
        }
      }
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) {
        console.warn('Error deleting class from Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Network error deleting class from Supabase:', err);
    }
  }

  // Clear exam history for all students previously in this class so re-creating them doesn't block them
  for (const code of Array.from(studentCodes)) {
    await clearStudentExamHistory(code);
  }

  return true;
}

export async function deleteStudent(studentId: string): Promise<boolean> {
  let studentCode = '';
  const localStudent = mockStore.getStudents().find((s) => s.id === studentId);
  if (localStudent?.student_code) {
    studentCode = localStudent.student_code.trim().toUpperCase();
  }

  mockStore.deleteStudent(studentId);

  if (isSupabaseConfigured() && isUUID(studentId)) {
    try {
      const supabase = getSupabase();
      if (!studentCode) {
        const { data: sData } = await supabase.from('students').select('student_code').eq('id', studentId).maybeSingle();
        if (sData?.student_code) {
          studentCode = sData.student_code.trim().toUpperCase();
        }
      }
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) {
        console.warn('Error deleting student from Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Network error deleting student from Supabase:', err);
    }
  }

  if (studentCode) {
    await clearStudentExamHistory(studentCode);
  }

  return true;
}

export async function createStudent(student: {
  student_code: string;
  full_name: string;
  date_of_birth?: string;
  class_id?: string;
}): Promise<Student | null> {
  const cleanCode = (student.student_code || '').trim().toUpperCase();

  // If re-creating a student with existing code, wipe prior zombie attempt records
  if (cleanCode) {
    await clearStudentExamHistory(cleanCode);
  }

  if (!isSupabaseConfigured()) {
    return mockStore.addStudent({
      student_code: student.student_code,
      full_name: student.full_name,
      class_id: student.class_id || '',
    });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('students')
      .insert([student])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  } catch (err) {
    return mockStore.addStudent({
      student_code: student.student_code,
      full_name: student.full_name,
      class_id: student.class_id || '',
    });
  }
}

export async function batchImportStudents(
  classId: string,
  students: { student_code: string; full_name: string; date_of_birth?: string }[]
): Promise<number> {
  // Clear any old history for these student codes
  for (const s of students) {
    if (s.student_code) {
      await clearStudentExamHistory(s.student_code);
    }
  }

  if (!isSupabaseConfigured()) {
    for (const s of students) {
      mockStore.addStudent({
        student_code: s.student_code,
        full_name: s.full_name,
        class_id: classId,
      });
    }
    return students.length;
  }

  try {
    const supabase = getSupabase();
    const rows = students.map((s) => ({
      ...s,
      class_id: classId,
    }));

    const { data, error } = await supabase.from('students').insert(rows).select('id');
    if (error) {
      throw new Error(error.message);
    }
    return data ? data.length : 0;
  } catch (err) {
    for (const s of students) {
      mockStore.addStudent({
        student_code: s.student_code,
        full_name: s.full_name,
        class_id: classId,
      });
    }
    return students.length;
  }
}

