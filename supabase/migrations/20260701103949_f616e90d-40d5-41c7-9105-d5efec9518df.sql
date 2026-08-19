
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);
grant select, insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "own subjects" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(subject_id, name)
);
grant select, insert, update, delete on public.topics to authenticated;
grant all on public.topics to service_role;
alter table public.topics enable row level security;
create policy "own topics" on public.topics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  content text not null,
  source text not null default 'text',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "own notes" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  mode text not null default 'topic',
  questions jsonb not null,
  question_count int not null,
  answers jsonb not null default '[]'::jsonb,
  current_index int not null default 0,
  status text not null default 'in_progress',
  score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "own quizzes" on public.quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question jsonb not null,
  subject_name text,
  topic_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.bookmarks to authenticated;
grant all on public.bookmarks to service_role;
alter table public.bookmarks enable row level security;
create policy "own bookmarks" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.wrong_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question jsonb not null,
  subject_name text,
  topic_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.wrong_answers to authenticated;
grant all on public.wrong_answers to service_role;
alter table public.wrong_answers enable row level security;
create policy "own wrong" on public.wrong_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql set search_path = public;

create trigger quizzes_updated_at before update on public.quizzes
for each row execute function public.touch_updated_at();
