-- ==============================================================================
-- MIGRATION: AI EXAM GENERATION & LEGAL REGULATIONS (CV 7991 & GDPT 2018)
-- ==============================================================================

-- 1. Legal regulations repository
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

-- 2. Subject profiles defining specific pedagogical rules & allowed structures
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

-- 3. AI Exam Generation audit & tracking
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

-- 4. Question level AI tracking
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

-- 5. Exam Validation Results
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

-- 6. Enable RLS
alter table public.legal_regulations enable row level security;
alter table public.subject_profiles enable row level security;
alter table public.ai_exam_generations enable row level security;
alter table public.ai_question_generations enable row level security;
alter table public.exam_validation_results enable row level security;

-- Policies
create policy "Anyone can read legal regulations" on public.legal_regulations for select using (true);
create policy "Authenticated users can manage regulations" on public.legal_regulations for all using (auth.role() = 'authenticated');

create policy "Anyone can read subject profiles" on public.subject_profiles for select using (true);
create policy "Authenticated users can manage subject profiles" on public.subject_profiles for all using (auth.role() = 'authenticated');

create policy "Users can read own ai exam generations" on public.ai_exam_generations for select using (auth.uid() = user_id or auth.role() = 'authenticated');
create policy "Users can insert ai exam generations" on public.ai_exam_generations for insert with check (auth.role() = 'authenticated');
create policy "Users can update own ai exam generations" on public.ai_exam_generations for update using (auth.uid() = user_id or auth.role() = 'authenticated');

create policy "Authenticated users can manage ai question generations" on public.ai_question_generations for all using (auth.role() = 'authenticated');
create policy "Authenticated users can manage validation results" on public.exam_validation_results for all using (auth.role() = 'authenticated');
