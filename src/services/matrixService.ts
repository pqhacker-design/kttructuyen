import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Matrix, MatrixItem, Specification, SpecificationItem, CognitiveLevel, QuestionType } from '../types';
import { mockStore } from './mockStore';
import { isUUID, normalizeCognitiveLevel, normalizeQuestionType } from '../lib/idUtils';

export async function fetchMatrices(ownerId?: string): Promise<Matrix[]> {
  if (!isSupabaseConfigured()) {
    return mockStore.getMatrices();
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('matrices')
      .select(`
        *,
        subject:subjects(name),
        items:matrix_items(*)
      `)
      .order('created_at', { ascending: false });

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase query failed, using local store for matrices:', error.message);
      return mockStore.getMatrices();
    }

    return (data || []).map((m: any) => {
      const items = m.items || [];
      const total_questions = items.reduce((acc: number, cur: any) => acc + (cur.question_count || 0), 0);
      const total_points = items.reduce((acc: number, cur: any) => acc + (Number(cur.points) || 0), 0);

      return {
        ...m,
        subject_name: m.subject?.name || 'Môn học',
        items,
        total_questions,
        total_points,
      };
    });
  } catch (err: any) {
    console.warn('Network error fetching matrices, using local store:', err?.message);
    return mockStore.getMatrices();
  }
}

export async function createMatrix(
  matrix: {
    owner_id: string;
    subject_id: string;
    name: string;
    grade: number;
    description?: string;
    cells?: any[];
    exam_id?: string;
  },
  items: Omit<MatrixItem, 'id' | 'matrix_id'>[]
): Promise<Matrix | null> {
  // If Supabase is not configured or foreign keys are not UUIDs, use local mock store
  if (!isSupabaseConfigured() || !isUUID(matrix.owner_id) || !isUUID(matrix.subject_id)) {
    return mockStore.addMatrix(matrix, items);
  }

  try {
    const supabase = getSupabase();

    const insertPayload: any = {
      owner_id: matrix.owner_id,
      subject_id: matrix.subject_id,
      name: matrix.name,
      grade: matrix.grade,
      description: matrix.description,
    };

    const { data: newMatrix, error } = await supabase
      .from('matrices')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (items && items.length > 0) {
      const buildItemPayload = (it: any, includeLearningReq: boolean) => {
        const payload: any = {
          matrix_id: newMatrix.id,
          topic: it.topic || 'Chủ đề kiến thức',
          subtopic: it.subtopic || null,
          cognitive_level: normalizeCognitiveLevel(it.cognitive_level),
          question_type: normalizeQuestionType(it.question_type),
          question_count: Math.max(1, Number(it.question_count) || 1),
          points: Math.max(0, Number(it.points) || 1.0),
        };
        if (includeLearningReq && it.learning_requirement) {
          payload.learning_requirement = it.learning_requirement;
        }
        return payload;
      };

      const primaryPayload = items.map((it) => buildItemPayload(it, true));
      const { error: itemsErr } = await supabase.from('matrix_items').insert(primaryPayload);

      if (itemsErr) {
        // If learning_requirement column is missing in schema cache (PGRST204), retry gracefully without it
        if (itemsErr.code === 'PGRST204' || itemsErr.message?.includes('learning_requirement')) {
          console.warn('Column learning_requirement not found in remote matrix_items schema cache. Retrying without column...');
          const fallbackPayload = items.map((it) => {
            const item = buildItemPayload(it, false);
            if (it.learning_requirement && !item.subtopic) {
              item.subtopic = String(it.learning_requirement).substring(0, 200);
            }
            return item;
          });
          const { error: retryErr } = await supabase.from('matrix_items').insert(fallbackPayload);
          if (retryErr) {
            console.error('Error inserting fallback matrix items:', retryErr);
          }
        } else {
          console.error('Error inserting matrix items:', itemsErr);
        }
      }
    }

    // Mirror to mockStore so local views stay in sync
    mockStore.addMatrix(matrix, items);

    return newMatrix;
  } catch (err) {
    return mockStore.addMatrix(matrix, items);
  }
}

export async function deleteMatrix(matrixId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return mockStore.deleteMatrix(matrixId);
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('matrices').delete().eq('id', matrixId);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  } catch (err) {
    return mockStore.deleteMatrix(matrixId);
  }
}

export async function fetchSpecifications(ownerId?: string): Promise<Specification[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('specifications')
      .select(`
        *,
        items:specification_items(*)
      `)
      .order('created_at', { ascending: false });

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function createSpecification(
  spec: {
    owner_id: string;
    matrix_id: string;
    name: string;
    description?: string;
  },
  items: Omit<SpecificationItem, 'id' | 'specification_id'>[]
): Promise<Specification | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabase();

    const { data: newSpec, error } = await supabase
      .from('specifications')
      .insert([spec])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (items && items.length > 0) {
      const itemsWithSpecId = items.map((it) => ({
        ...it,
        specification_id: newSpec.id,
      }));

      const { error: itemsErr } = await supabase.from('specification_items').insert(itemsWithSpecId);
      if (itemsErr) {
        console.error('Error inserting specification items:', itemsErr);
      }
    }

    return newSpec;
  } catch (err) {
    return null;
  }
}

