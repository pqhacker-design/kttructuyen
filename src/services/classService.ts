import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { SchoolClass, Student } from '../types';
import { mockStore } from './mockStore';

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

    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for classes:', error.message);
      return mockStore.getClasses();
    }

    return (data || []).map((c: any) => ({
      ...c,
      student_count: c.students?.[0]?.count || 0,
    }));
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
  if (!isSupabaseConfigured()) {
    return mockStore.addClass(cls);
  }

  try {
    const supabase = getSupabase();
    const payload = {
      name: cls.name,
      grade: cls.grade,
      school_year: cls.school_year,
      teacher_id: cls.teacher_id || cls.owner_id,
    };
    const { data, error } = await supabase
      .from('classes')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  } catch (err) {
    return mockStore.addClass(cls);
  }
}

export async function fetchStudents(classId?: string): Promise<Student[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getStudents(classId);
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('students')
      .select(`
        *,
        class:classes(name)
      `)
      .order('full_name', { ascending: true });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for students:', error.message);
      return mockStore.getStudents(classId);
    }

    return (data || []).map((s: any) => ({
      ...s,
      class_name: s.class?.name || 'Chưa phân lớp',
    }));
  } catch (err: any) {
    console.warn('Network error fetching students, using local store:', err?.message);
    return mockStore.getStudents(classId);
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
  if (!isSupabaseConfigured()) {
    return mockStore.addStudent(student);
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
    return mockStore.addStudent(student);
  }
}

export async function deleteClass(classId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteClass(classId);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  } catch (err) {
    return mockStore.deleteClass(classId);
  }
}

export async function deleteStudent(studentId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteStudent(studentId);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  } catch (err) {
    return mockStore.deleteStudent(studentId);
  }
}

export async function createStudent(student: {
  student_code: string;
  full_name: string;
  date_of_birth?: string;
  class_id?: string;
}): Promise<Student | null> {
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

