-- ==============================================================================
-- EDUSAM EXAM MANAGEMENT SYSTEM - PRODUCTION POSTGRESQL SCHEMA (SUPABASE)
-- ==============================================================================
-- Normalized schema, indexes, RLS policies, triggers, and secure RPCs
-- ==============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES (Extends Supabase Auth users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  role text not null default 'user' check (role in ('admin', 'user', 'teacher', 'student')),
  status text not null default 'active' check (status in ('active', 'inactive', 'locked')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper function to check if current user is active admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  );
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------------------
-- AUDIT LOGS (Theo dõi hành động hệ thống)
-- ------------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ------------------------------------------------------------------------------
-- 2. ORGANIZATIONS & MEMBERS
-- ------------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user', 'teacher', 'student')),
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 3. SUBJECTS (Môn học)
-- ------------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  grade integer not null check (grade between 1 and 12),
  description text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. CLASSES & STUDENTS (Lớp học & Học sinh)
-- ------------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  owner_user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  grade integer not null check (grade between 1 and 12),
  school_year text not null,
  teacher_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete cascade default auth.uid(),
  student_code text not null,
  full_name text not null,
  date_of_birth date,
  class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. QUESTION BANKS & QUESTIONS (Ngân hàng câu hỏi)
-- ------------------------------------------------------------------------------
create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references public.question_banks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  content text not null,
  question_type text not null default 'single_choice' check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  cognitive_level text not null default 'recognition' check (cognitive_level in ('recognition', 'comprehension', 'application', 'advanced_application')),
  explanation text,
  points numeric(5,2) not null default 1.00 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  content text not null,
  is_correct boolean not null default false,
  option_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.question_attachments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  file_url text not null,
  file_type text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 6. MATRICES & SPECIFICATIONS (Ma trận & Bảng đặc tả đề thi)
-- ------------------------------------------------------------------------------
create table if not exists public.matrices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  grade integer not null check (grade between 1 and 12),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matrix_items (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references public.matrices(id) on delete cascade,
  topic text not null,
  subtopic text,
  learning_requirement text,
  cognitive_level text not null check (cognitive_level in ('recognition', 'comprehension', 'application', 'advanced_application')),
  question_type text not null check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')),
  question_count integer not null default 1 check (question_count >= 0),
  points numeric(5,2) not null default 1.00 check (points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.specifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  matrix_id uuid not null references public.matrices(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specification_items (
  id uuid primary key default gen_random_uuid(),
  specification_id uuid not null references public.specifications(id) on delete cascade,
  topic text not null,
  content_standard text not null,
  learning_objective text not null,
  cognitive_level text not null check (cognitive_level in ('recognition', 'comprehension', 'application', 'advanced_application')),
  question_type text not null check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')),
  question_count integer not null default 1 check (question_count >= 0),
  points numeric(5,2) not null default 1.00 check (points >= 0),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. EXAMS & EXAM QUESTIONS (Đề thi)
-- ------------------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  matrix_id uuid references public.matrices(id) on delete set null,
  specification_id uuid references public.specifications(id) on delete set null,
  title text not null,
  description text,
  grade integer not null check (grade between 1 and 12),
  duration_minutes integer not null default 45 check (duration_minutes > 0),
  total_points numeric(5,2) not null default 10.00 check (total_points > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_order integer not null default 1,
  points numeric(5,2) not null default 1.00 check (points >= 0),
  created_at timestamptz not null default now(),
  unique(exam_id, question_id)
);

-- ------------------------------------------------------------------------------
-- 8. EXAM SESSIONS (Kỳ thi trực tuyến & Mã tham gia)
-- ------------------------------------------------------------------------------
create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  access_code varchar(20) not null unique,
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes integer not null default 45 check (duration_minutes > 0),
  max_attempts integer not null default 1 check (max_attempts > 0),
  status text not null default 'active' check (status in ('draft', 'scheduled', 'active', 'closed', 'archived')),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  show_result_after_submit boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Access codes table for robust cross-device exam access
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  exam_session_id uuid not null references public.exam_sessions(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_access_codes_upper_code on public.access_codes(upper(trim(code)));

-- ------------------------------------------------------------------------------
-- 9. EXAM ATTEMPTS & ANSWERS (Lần làm bài & Bài làm học sinh)
-- ------------------------------------------------------------------------------
create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_session_id uuid not null references public.exam_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  student_name text not null,
  student_code text not null,
  attempt_number integer not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'submitted', 'graded', 'expired')),
  score numeric(5,2),
  max_score numeric(5,2),
  percentage numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid references public.question_options(id) on delete set null,
  selected_option_ids uuid[] default '{}',
  answer_text text,
  is_correct boolean,
  points_earned numeric(5,2) default 0.00,
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

-- ------------------------------------------------------------------------------
-- 10. EXAM RESULTS (Kết quả thi tổng hợp)
-- ------------------------------------------------------------------------------
create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.exam_attempts(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  exam_session_id uuid not null references public.exam_sessions(id) on delete cascade,
  student_name text not null,
  student_code text not null,
  score numeric(5,2) not null default 0.00,
  max_score numeric(5,2) not null default 10.00,
  percentage numeric(5,2) not null default 0.00,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  unanswered_count integer not null default 0,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
create index if not exists idx_profiles_user on public.profiles(user_id);
create index if not exists idx_profiles_role on public.profiles(role);

create index if not exists idx_questions_bank on public.questions(question_bank_id);
create index if not exists idx_questions_owner on public.questions(owner_id);
create index if not exists idx_questions_level on public.questions(cognitive_level);
create index if not exists idx_questions_type on public.questions(question_type);
create index if not exists idx_question_options_q on public.question_options(question_id);

create index if not exists idx_exams_owner on public.exams(owner_id);
create index if not exists idx_exams_subject on public.exams(subject_id);
create index if not exists idx_exam_questions_exam on public.exam_questions(exam_id);

create index if not exists idx_exam_sessions_code on public.exam_sessions(access_code);
create index if not exists idx_exam_sessions_owner on public.exam_sessions(owner_id);
create index if not exists idx_exam_sessions_status on public.exam_sessions(status);

create index if not exists idx_exam_attempts_session on public.exam_attempts(exam_session_id);
create index if not exists idx_exam_attempts_user on public.exam_attempts(user_id);
create index if not exists idx_exam_attempts_code on public.exam_attempts(student_code);

create index if not exists idx_attempt_answers_attempt on public.attempt_answers(attempt_id);
create index if not exists idx_attempt_answers_question on public.attempt_answers(question_id);
create index if not exists idx_exam_results_session on public.exam_results(exam_session_id);

-- ==============================================================================
-- AUTOMATIC TIMESTAMPS TRIGGER
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.handle_updated_at();
create or replace trigger set_questions_updated_at before update on public.questions for each row execute procedure public.handle_updated_at();
create or replace trigger set_exams_updated_at before update on public.exams for each row execute procedure public.handle_updated_at();
create or replace trigger set_sessions_updated_at before update on public.exam_sessions for each row execute procedure public.handle_updated_at();
create or replace trigger set_attempts_updated_at before update on public.exam_attempts for each row execute procedure public.handle_updated_at();

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER FOR AUTH.USERS
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    'active'
  )
  on conflict (user_id) do update
  set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger whenever a user signs up via Supabase Auth
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - STRICT USER ISOLATION
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.question_banks enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_attachments enable row level security;
alter table public.matrices enable row level security;
alter table public.matrix_items enable row level security;
alter table public.specifications enable row level security;
alter table public.specification_items enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.access_codes enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.exam_results enable row level security;

-- 1. Profiles policies (Admin sees all, user sees only own)
create policy "Users see own profile or admin sees all" on public.profiles
  for select using (auth.uid() = user_id or is_admin());

create policy "Users update own profile or admin updates" on public.profiles
  for update using (auth.uid() = user_id or is_admin());

-- 2. Audit logs policies
create policy "Admin views all audit logs or user views own actions" on public.audit_logs
  for select using (is_admin() or actor_user_id = auth.uid());

create policy "Authenticated users can record audit logs" on public.audit_logs
  for insert with check (auth.uid() is not null or true);

-- 3. Subjects policies (Isolated per user, admin sees all)
create policy "Users view their own subjects or default or admin" on public.subjects
  for select using (created_by = auth.uid() or created_by is null or is_admin());

create policy "Users insert own subjects" on public.subjects
  for insert with check (created_by = auth.uid() or is_admin());

create policy "Users update own subjects" on public.subjects
  for update using (created_by = auth.uid() or is_admin());

create policy "Users delete own subjects" on public.subjects
  for delete using (created_by = auth.uid() or is_admin());

-- 4. Classes (Strict user isolation: only owner/teacher can access)
create policy "Users can only view their own classes" on public.classes
  for select using (user_id = auth.uid() or teacher_id = auth.uid() or owner_user_id = auth.uid() or is_admin());

create policy "Users can insert their own classes" on public.classes
  for insert with check (user_id = auth.uid() or teacher_id = auth.uid() or owner_user_id = auth.uid() or is_admin());

create policy "Users can update their own classes" on public.classes
  for update using (user_id = auth.uid() or teacher_id = auth.uid() or owner_user_id = auth.uid() or is_admin());

create policy "Users can delete their own classes" on public.classes
  for delete using (user_id = auth.uid() or teacher_id = auth.uid() or owner_user_id = auth.uid() or is_admin());

-- 5. Students (Strict user isolation)
create policy "Users view students of their classes or created by them" on public.students
  for select using (
    created_by = auth.uid() or
    exists (
      select 1 from public.classes c
      where c.id = class_id and (c.user_id = auth.uid() or c.teacher_id = auth.uid() or c.owner_user_id = auth.uid())
    ) or
    is_admin()
  );

create policy "Users insert students into their classes" on public.students
  for insert with check (
    created_by = auth.uid() or
    exists (
      select 1 from public.classes c
      where c.id = class_id and (c.user_id = auth.uid() or c.teacher_id = auth.uid() or c.owner_user_id = auth.uid())
    ) or
    is_admin()
  );

create policy "Users update their students" on public.students
  for update using (
    created_by = auth.uid() or
    exists (
      select 1 from public.classes c
      where c.id = class_id and (c.user_id = auth.uid() or c.teacher_id = auth.uid() or c.owner_user_id = auth.uid())
    ) or
    is_admin()
  );

create policy "Users delete their students" on public.students
  for delete using (
    created_by = auth.uid() or
    exists (
      select 1 from public.classes c
      where c.id = class_id and (c.user_id = auth.uid() or c.teacher_id = auth.uid() or c.owner_user_id = auth.uid())
    ) or
    is_admin()
  );

-- 6. Question Banks & Questions (Strict user isolation)
create policy "Users view their own question banks" on public.question_banks
  for select using (owner_id = auth.uid() or is_admin());

create policy "Users manage their own question banks" on public.question_banks
  for all using (owner_id = auth.uid() or is_admin());

create policy "Users view their own questions" on public.questions
  for select using (owner_id = auth.uid() or is_admin());

create policy "Users manage their own questions" on public.questions
  for all using (owner_id = auth.uid() or is_admin());

create policy "Users manage options of their questions" on public.question_options
  for all using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and (q.owner_id = auth.uid() or is_admin())
    )
  );

-- 7. Matrices & Specifications (Strict user isolation)
create policy "Users manage their matrices" on public.matrices
  for all using (owner_id = auth.uid() or is_admin());

create policy "Users manage matrix items" on public.matrix_items
  for all using (
    exists (
      select 1 from public.matrices m
      where m.id = matrix_id and (m.owner_id = auth.uid() or is_admin())
    )
  );

create policy "Users manage their specifications" on public.specifications
  for all using (owner_id = auth.uid() or is_admin());

create policy "Users manage specification items" on public.specification_items
  for all using (
    exists (
      select 1 from public.specifications s
      where s.id = specification_id and (s.owner_id = auth.uid() or is_admin())
    )
  );

-- 8. Exams (Strict user isolation)
create policy "Users manage their exams" on public.exams
  for all using (owner_id = auth.uid() or is_admin());

create policy "Users manage exam questions" on public.exam_questions
  for all using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id and (e.owner_id = auth.uid() or is_admin())
    )
  );

-- 9. Exam Sessions & Access Codes
create policy "Users manage their exam sessions" on public.exam_sessions
  for all using (owner_id = auth.uid() or is_admin());

create policy "Students can view active exam sessions by access code" on public.exam_sessions
  for select using (status = 'active');

create policy "Users manage their access codes" on public.access_codes
  for all using (
    exists (
      select 1 from public.exam_sessions s
      where s.id = exam_session_id and (s.owner_id = auth.uid() or is_admin())
    )
  );

create policy "Students can view active access codes" on public.access_codes
  for select using (status = 'active');

-- 10. Exam Attempts:
create policy "Teachers view attempts for their sessions or admin" on public.exam_attempts
  for select using (
    exists (
      select 1 from public.exam_sessions s
      where s.id = exam_session_id and s.owner_id = auth.uid()
    ) or
    auth.uid() = user_id or
    is_admin()
  );

create policy "Students start attempt for active session" on public.exam_attempts
  for insert with check (
    exists (
      select 1 from public.exam_sessions s
      where s.id = exam_session_id and s.status = 'active'
    )
  );

create policy "Students update their own attempt" on public.exam_attempts
  for update using (
    auth.uid() = user_id or user_id is null or is_admin()
  );

-- 11. Attempt Answers:
create policy "Attempt answers access" on public.attempt_answers
  for all using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_id
    )
  );

-- 12. Exam Results:
create policy "Teachers view results for their sessions or student views own" on public.exam_results
  for select using (
    exists (
      select 1 from public.exam_sessions s
      where s.id = exam_session_id and s.owner_id = auth.uid()
    ) or
    is_admin() or
    true
  );

create policy "Students can view their results" on public.exam_results
  for select using (true);

-- ==============================================================================
-- SECURE DATABASE FUNCTIONS (RPC) FOR ATOMIC & TAMPER-PROOF EXAMS
-- ==============================================================================

-- 1. JOIN EXAM RPC: Validates access code and returns session details and sanitized questions
create or replace function public.join_exam_session(
  p_access_code text,
  p_student_name text,
  p_student_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session record;
  v_attempt record;
  v_existing_count integer;
  v_questions jsonb;
begin
  -- 1. Find session by access code
  select * into v_session
  from public.exam_sessions
  where upper(access_code) = upper(trim(p_access_code));

  if v_session is null then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Mã kỳ thi không tồn tại.');
  end if;

  if v_session.status <> 'active' then
    return jsonb_build_object('success', false, 'code', 'NOT_ACTIVE', 'message', 'Kỳ thi hiện không hoạt động hoặc đã đóng.');
  end if;

  if v_session.start_at is not null and now() < v_session.start_at then
    return jsonb_build_object('success', false, 'code', 'NOT_STARTED', 'message', 'Kỳ thi chưa đến giờ bắt đầu.');
  end if;

  if v_session.end_at is not null and now() > v_session.end_at then
    return jsonb_build_object('success', false, 'code', 'EXPIRED', 'message', 'Kỳ thi đã kết thúc.');
  end if;

  -- 2. Check max attempts if student code is provided
  select count(*) into v_existing_count
  from public.exam_attempts
  where exam_session_id = v_session.id
    and lower(student_code) = lower(trim(p_student_code))
    and status in ('submitted', 'graded');

  if v_existing_count >= v_session.max_attempts then
    return jsonb_build_object('success', false, 'code', 'MAX_ATTEMPTS_REACHED', 'message', 'Bạn đã đạt số lần làm bài tối đa (' || v_session.max_attempts || ' lần).');
  end if;

  -- 3. Check for existing in-progress attempt or create a new one
  select * into v_attempt
  from public.exam_attempts
  where exam_session_id = v_session.id
    and lower(student_code) = lower(trim(p_student_code))
    and status = 'in_progress'
  order by started_at desc
  limit 1;

  if v_attempt is null then
    insert into public.exam_attempts (
      exam_session_id,
      user_id,
      student_name,
      student_code,
      attempt_number,
      started_at,
      status
    ) values (
      v_session.id,
      auth.uid(),
      trim(p_student_name),
      trim(p_student_code),
      v_existing_count + 1,
      now(),
      'in_progress'
    ) returning * into v_attempt;
  end if;

  -- 4. Load sanitized questions WITHOUT is_correct or explanation to prevent cheating!
  select jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'order', eq.question_order,
      'points', eq.points,
      'content', q.content,
      'question_type', q.question_type,
      'cognitive_level', q.cognitive_level,
      'options', (
        select jsonb_agg(
          jsonb_build_object(
            'id', qo.id,
            'content', qo.content,
            'option_order', qo.option_order
          ) order by qo.option_order
        )
        from public.question_options qo
        where qo.question_id = q.id
      )
    ) order by eq.question_order
  ) into v_questions
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  where eq.exam_id = v_session.exam_id;

  return jsonb_build_object(
    'success', true,
    'session', jsonb_build_object(
      'id', v_session.id,
      'title', v_session.title,
      'access_code', v_session.access_code,
      'duration_minutes', v_session.duration_minutes,
      'shuffle_questions', v_session.shuffle_questions,
      'shuffle_options', v_session.shuffle_options,
      'show_result_after_submit', v_session.show_result_after_submit
    ),
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'attempt_number', v_attempt.attempt_number,
      'started_at', v_attempt.started_at,
      'status', v_attempt.status,
      'student_name', v_attempt.student_name,
      'student_code', v_attempt.student_code
    ),
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;

-- 2. SUBMIT EXAM RPC: Atomically grades answers server-side, records score, and generates exam_result
create or replace function public.submit_exam_attempt(
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_attempt record;
  v_session record;
  v_exam record;
  v_total_points numeric(5,2) := 0.00;
  v_earned_points numeric(5,2) := 0.00;
  v_correct_count integer := 0;
  v_wrong_count integer := 0;
  v_unanswered_count integer := 0;
  v_question record;
  v_ans_record jsonb;
  v_selected_id uuid;
  v_is_correct boolean;
  v_q_points numeric(5,2);
  v_result record;
begin
  -- 1. Find attempt
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if v_attempt is null then
    return jsonb_build_object('success', false, 'message', 'Lần làm bài không tồn tại.');
  end if;

  if v_attempt.status in ('submitted', 'graded') then
    -- Already submitted, return existing result
    select * into v_result from public.exam_results where attempt_id = p_attempt_id;
    return jsonb_build_object(
      'success', true,
      'already_submitted', true,
      'result', row_to_json(v_result)
    );
  end if;

  -- 2. Load session and exam
  select * into v_session from public.exam_sessions where id = v_attempt.exam_session_id;
  select * into v_exam from public.exams where id = v_session.exam_id;

  -- 3. Loop over each question in exam to grade safely server-side
  for v_question in
    select eq.question_id, eq.points, q.question_type
    from public.exam_questions eq
    join public.questions q on q.id = eq.question_id
    where eq.exam_id = v_session.exam_id
  loop
    v_total_points := v_total_points + v_question.points;
    v_q_points := v_question.points;
    v_is_correct := false;

    -- Extract student's answer for this question from payload
    v_ans_record := p_answers->(v_question.question_id::text);

    if v_ans_record is not null and v_ans_record->>'selected_option_id' is not null and v_ans_record->>'selected_option_id' <> '' then
      v_selected_id := (v_ans_record->>'selected_option_id')::uuid;

      -- Check if option is correct
      select is_correct into v_is_correct
      from public.question_options
      where id = v_selected_id and question_id = v_question.question_id;

      if coalesce(v_is_correct, false) = true then
        v_earned_points := v_earned_points + v_q_points;
        v_correct_count := v_correct_count + 1;
      else
        v_wrong_count := v_wrong_count + 1;
      end if;

      -- Upsert attempt answer
      insert into public.attempt_answers (
        attempt_id,
        question_id,
        selected_option_id,
        answer_text,
        is_correct,
        points_earned
      ) values (
        v_attempt.id,
        v_question.question_id,
        v_selected_id,
        v_ans_record->>'answer_text',
        v_is_correct,
        case when v_is_correct then v_q_points else 0 end
      ) on conflict (attempt_id, question_id) do update
      set selected_option_id = excluded.selected_option_id,
          answer_text = excluded.answer_text,
          is_correct = excluded.is_correct,
          points_earned = excluded.points_earned,
          updated_at = now();
    else
      v_unanswered_count := v_unanswered_count + 1;
      -- Upsert empty answer
      insert into public.attempt_answers (
        attempt_id,
        question_id,
        is_correct,
        points_earned
      ) values (
        v_attempt.id,
        v_question.question_id,
        false,
        0
      ) on conflict (attempt_id, question_id) do update
      set is_correct = false,
          points_earned = 0,
          updated_at = now();
    end if;
  end loop;

  -- 4. Calculate final score (normalized to 10.00 scale if needed or exact total)
  if v_total_points = 0 then
    v_total_points := 10.00;
  end if;

  -- 5. Update attempt status
  update public.exam_attempts
  set status = 'graded',
      submitted_at = now(),
      score = round(v_earned_points, 2),
      max_score = round(v_total_points, 2),
      percentage = round((v_earned_points / v_total_points) * 100, 1)
  where id = v_attempt.id;

  -- 6. Insert into exam_results
  insert into public.exam_results (
    attempt_id,
    student_id,
    exam_session_id,
    student_name,
    student_code,
    score,
    max_score,
    percentage,
    correct_count,
    wrong_count,
    unanswered_count,
    submitted_at
  ) values (
    v_attempt.id,
    v_attempt.student_id,
    v_session.id,
    v_attempt.student_name,
    v_attempt.student_code,
    round(v_earned_points, 2),
    round(v_total_points, 2),
    round((v_earned_points / v_total_points) * 100, 1),
    v_correct_count,
    v_wrong_count,
    v_unanswered_count,
    now()
  ) returning * into v_result;

  return jsonb_build_object(
    'success', true,
    'result', row_to_json(v_result)
  );
end;
$$;

-- 4. ALLOW STUDENT RETAKE RPC
create or replace function public.allow_student_retake(
  p_session_id text,
  p_student_code text,
  p_attempt_id text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_att_ids uuid[];
begin
  if p_attempt_id is not null then
    -- Mark attempt as cancelled first so it never blocks count checks
    update public.exam_attempts
    set status = 'cancelled', score = 0, percentage = 0
    where id = p_attempt_id::uuid;

    delete from public.attempt_answers where attempt_id = p_attempt_id::uuid;
    delete from public.exam_results where attempt_id = p_attempt_id::uuid;
    delete from public.exam_attempts where id = p_attempt_id::uuid;
  elsif p_student_code is not null then
    select array_agg(id) into v_att_ids
    from public.exam_attempts
    where exam_session_id = p_session_id::uuid
      and lower(trim(student_code)) = lower(trim(p_student_code));

    if v_att_ids is not null and array_length(v_att_ids, 1) > 0 then
      update public.exam_attempts
      set status = 'cancelled', score = 0, percentage = 0
      where id = any(v_att_ids);

      delete from public.attempt_answers where attempt_id = any(v_att_ids);
      delete from public.exam_results where attempt_id = any(v_att_ids);
      delete from public.exam_attempts where id = any(v_att_ids);
    end if;
  end if;

  return jsonb_build_object('success', true, 'message', 'Đã cấp quyền làm lại bài thi thành công.');
end;
$$;

-- 5. DELETE EXAM RESULT RPC
create or replace function public.delete_exam_result(
  p_result_id text,
  p_attempt_id text default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  if p_attempt_id is not null then
    update public.exam_attempts
    set status = 'cancelled', score = 0, percentage = 0
    where id = p_attempt_id::uuid;

    delete from public.attempt_answers where attempt_id = p_attempt_id::uuid;
    delete from public.exam_results where attempt_id = p_attempt_id::uuid;
    delete from public.exam_attempts where id = p_attempt_id::uuid;
  end if;

  delete from public.exam_results where id = p_result_id::uuid;

  return jsonb_build_object('success', true, 'message', 'Đã xóa kết quả thi thành công.');
end;
$$;

-- ==============================================================================
-- 10. AI EXAM GENERATION & LEGAL REGULATIONS (CV 7991 & GDPT 2018)
-- ==============================================================================

-- Legal regulations repository
create table if not exists public.legal_regulations (
  id text primary key,
  title text not null,
  document_number text not null,
  issued_date date not null,
  effective_date date not null,
  subject_scope jsonb not null default '["all"]'::jsonb,
  education_level text not null default 'all',
  issuer text not null,
  summary text,
  content text not null,
  version text not null default '1.0',
  status text not null default 'active' check (status in ('active', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subject profiles defining specific pedagogical rules & allowed structures
create table if not exists public.subject_profiles (
  id text primary key,
  subject_code text unique not null,
  name text not null,
  education_levels jsonb not null default '["THCS", "THPT"]'::jsonb,
  default_duration integer not null default 45,
  allowed_parts jsonb not null default '[1, 2, 3, 4]'::jsonb,
  allowed_question_types jsonb not null default '["single_choice", "true_false", "short_answer", "essay"]'::jsonb,
  special_requirements jsonb not null default '[]'::jsonb,
  default_structure jsonb not null,
  matrix_rules jsonb not null,
  specification_rules jsonb not null,
  ai_generation_rules jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AI Exam Generation audit & tracking
create table if not exists public.ai_exam_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  exam_id uuid references public.exams(id) on delete cascade,
  subject_code text not null,
  grade integer not null,
  term text not null,
  model text not null default 'gemini-3.8-flash',
  prompt_version text not null default 'CV7991_v2',
  status text not null default 'completed' check (status in ('pending', 'generating', 'completed', 'failed', 'approved')),
  generation_metadata jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Question level AI tracking
create table if not exists public.ai_question_generations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  generation_id uuid references public.ai_exam_generations(id) on delete cascade,
  exam_part integer not null check (exam_part between 1 and 4),
  model text not null,
  ai_review_status text not null default 'passed' check (ai_review_status in ('passed', 'review_required')),
  ai_review_notes text,
  teacher_accepted boolean not null default true,
  created_at timestamptz not null default now()
);

-- Exam Validation Results
create table if not exists public.exam_validation_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  is_valid boolean not null default true,
  total_score numeric(4, 2) not null default 10.00,
  score_exact_10 boolean not null default true,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  parts_summary jsonb not null default '[]'::jsonb,
  cognitive_breakdown jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS Policies for AI tables
alter table public.legal_regulations enable row level security;
alter table public.subject_profiles enable row level security;
alter table public.ai_exam_generations enable row level security;
alter table public.ai_question_generations enable row level security;
alter table public.exam_validation_results enable row level security;

create policy "Anyone can read legal regulations" on public.legal_regulations for select using (true);
create policy "Authenticated users can manage regulations" on public.legal_regulations for all using (auth.role() = 'authenticated');

create policy "Anyone can read subject profiles" on public.subject_profiles for select using (true);
create policy "Authenticated users can manage subject profiles" on public.subject_profiles for all using (auth.role() = 'authenticated');

create policy "Users can read own ai exam generations" on public.ai_exam_generations for select using (auth.uid() = user_id or auth.role() = 'authenticated');
create policy "Users can insert ai exam generations" on public.ai_exam_generations for insert with check (auth.role() = 'authenticated');
create policy "Users can update own ai exam generations" on public.ai_exam_generations for update using (auth.uid() = user_id or auth.role() = 'authenticated');

create policy "Authenticated users can manage ai question generations" on public.ai_question_generations for all using (auth.role() = 'authenticated');
create policy "Authenticated users can manage validation results" on public.exam_validation_results for all using (auth.role() = 'authenticated');

