-- Supabase Migration: 20260908_initial_schema.sql
-- Run via `supabase db push` or execute directly in Supabase Dashboard SQL Editor.

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  role text not null default 'teacher' check (role in ('admin', 'teacher', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organizations & Members
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
  role text not null default 'teacher' check (role in ('admin', 'teacher', 'student')),
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- Subjects
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  grade integer not null check (grade between 1 and 12),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Classes & Students
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  grade integer not null check (grade between 1 and 12),
  school_year text not null,
  teacher_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  student_code text not null,
  full_name text not null,
  date_of_birth date,
  class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Question Banks & Questions
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

-- Matrices & Specifications
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

-- Exams & Questions
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

-- Exam Sessions
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

-- Exam Attempts & Answers
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

-- Exam Results
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

-- Enable RLS
alter table public.profiles enable row level security;
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
alter table public.exam_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.exam_results enable row level security;

-- Setup basic policies
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);

create policy "Anyone can view subjects" on public.subjects for select using (true);
create policy "Teachers insert subjects" on public.subjects for insert with check (auth.uid() is not null);
create policy "Teachers update subjects" on public.subjects for update using (auth.uid() is not null);

create policy "Classes viewable" on public.classes for select using (true);
create policy "Teachers manage classes" on public.classes for all using (auth.uid() is not null);

create policy "Students viewable" on public.students for select using (true);
create policy "Teachers manage students" on public.students for all using (auth.uid() is not null);

create policy "Teachers manage question banks" on public.question_banks for all using (auth.uid() = owner_id);
create policy "Teachers manage questions" on public.questions for all using (auth.uid() = owner_id);
create policy "Teachers manage options" on public.question_options for all using (
  exists (select 1 from public.questions q where q.id = question_id and q.owner_id = auth.uid())
);

create policy "Teachers manage matrices" on public.matrices for all using (auth.uid() = owner_id);
create policy "Teachers manage matrix items" on public.matrix_items for all using (
  exists (select 1 from public.matrices m where m.id = matrix_id and m.owner_id = auth.uid())
);

create policy "Teachers manage specifications" on public.specifications for all using (auth.uid() = owner_id);
create policy "Teachers manage specification items" on public.specification_items for all using (
  exists (select 1 from public.specifications s where s.id = specification_id and s.owner_id = auth.uid())
);

create policy "Teachers manage exams" on public.exams for all using (auth.uid() = owner_id);
create policy "Teachers manage exam questions" on public.exam_questions for all using (
  exists (select 1 from public.exams e where e.id = exam_id and e.owner_id = auth.uid())
);

create policy "Teachers manage sessions" on public.exam_sessions for all using (auth.uid() = owner_id);
create policy "Students view active sessions" on public.exam_sessions for select using (status = 'active');

create policy "Teachers view session attempts" on public.exam_attempts for select using (
  exists (select 1 from public.exam_sessions s where s.id = exam_session_id and s.owner_id = auth.uid())
);
create policy "Anyone start attempt on active session" on public.exam_attempts for insert with check (
  exists (select 1 from public.exam_sessions s where s.id = exam_session_id and s.status = 'active')
);
create policy "Users view their attempts" on public.exam_attempts for select using (auth.uid() = user_id or auth.uid() is null);
create policy "Users update their attempts" on public.exam_attempts for update using (auth.uid() = user_id or auth.uid() is null);

create policy "Attempt answers access" on public.attempt_answers for all using (
  exists (select 1 from public.exam_attempts a where a.id = attempt_id)
);

create policy "Teachers view results" on public.exam_results for select using (
  exists (select 1 from public.exam_sessions s where s.id = exam_session_id and s.owner_id = auth.uid())
);
create policy "Students view results" on public.exam_results for select using (true);
