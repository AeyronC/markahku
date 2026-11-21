create type public.exam_type as enum ('sumatif_1','sumatif_2','uasa');
create type public.mark_status as enum ('completed','pending','exempted','absent');
create type public.mark_source as enum ('manual','import','ocr');
create type public.goal_scope as enum ('subject','exam');
create type public.insight_kind as enum ('analysis','study_plan');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  school text,
  class_name text,
  current_form int check (current_form between 1 and 5),
  language text not null default 'ms' check (language in ('ms','en')),
  theme text not null default 'dark' check (theme in ('dark','light')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.subject_catalog (
  id serial primary key,
  name_ms text not null,
  name_en text not null,
  forms int[] not null,
  is_core boolean not null default true,
  sort_order int not null default 0
);
grant select on public.subject_catalog to authenticated;
grant all on public.subject_catalog to service_role;
alter table public.subject_catalog enable row level security;
create policy read_catalog on public.subject_catalog for select to authenticated using (true);

create table public.user_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  form int not null check (form between 1 and 5),
  catalog_id int references public.subject_catalog(id),
  custom_name text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (catalog_id is not null or custom_name is not null)
);
grant select, insert, update, delete on public.user_subjects to authenticated;
grant all on public.user_subjects to service_role;
alter table public.user_subjects enable row level security;
create policy own_rows on public.user_subjects for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  form int not null check (form between 1 and 5),
  exam public.exam_type not null,
  academic_year int,
  rank_position int check (rank_position > 0),
  rank_total int check (rank_total > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, form, exam),
  check (rank_position is null or rank_total is null or rank_position <= rank_total)
);
grant select, insert, update, delete on public.exam_sessions to authenticated;
grant all on public.exam_sessions to service_role;
alter table public.exam_sessions enable row level security;
create policy own_rows on public.exam_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.source_files to authenticated;
grant all on public.source_files to service_role;
alter table public.source_files enable row level security;
create policy own_rows on public.source_files for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  user_subject_id uuid not null references public.user_subjects(id) on delete cascade,
  mark int check (mark between 0 and 100),
  status public.mark_status not null default 'pending',
  source public.mark_source not null default 'manual',
  source_file_id uuid references public.source_files(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (session_id, user_subject_id),
  check (
    (status = 'completed' and mark is not null) or
    (status = 'absent' and mark = 0) or
    (status in ('pending','exempted') and mark is null)
  )
);
grant select, insert, update, delete on public.marks to authenticated;
grant all on public.marks to service_role;
alter table public.marks enable row level security;
create policy own_rows on public.marks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope public.goal_scope not null,
  form int not null check (form between 1 and 5),
  user_subject_id uuid references public.user_subjects(id) on delete cascade,
  exam public.exam_type,
  target_grade text check (target_grade in ('A','B','C','D','E')),
  target_average numeric(5,2) check (target_average between 0 and 100),
  target_cgpa numeric(3,2) check (target_cgpa between 0 and 4),
  created_at timestamptz not null default now(),
  check (
    (scope = 'subject' and user_subject_id is not null and target_grade is not null) or
    (scope = 'exam' and exam is not null and (target_average is not null or target_cgpa is not null))
  )
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy own_rows on public.goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind public.insight_kind not null,
  form int,
  language text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_insights to authenticated;
grant all on public.ai_insights to service_role;
alter table public.ai_insights enable row level security;
create policy own_rows on public.ai_insights for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.ai_usage (
  user_id uuid not null,
  day date not null default current_date,
  ai_calls int not null default 0,
  ocr_calls int not null default 0,
  primary key (user_id, day)
);
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy own_usage_read on public.ai_usage for select to authenticated using (user_id = auth.uid());

create index on public.marks (user_id, session_id);
create index on public.exam_sessions (user_id, form, exam);
create index on public.user_subjects (user_id, form);

-- Atomically count one AI/OCR call for the signed-in user; returns false when the daily cap is reached.
create or replace function public.consume_ai_call(_kind text, _cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _n int;
begin
  if _uid is null then return false; end if;
  insert into public.ai_usage (user_id, day) values (_uid, current_date)
    on conflict (user_id, day) do nothing;
  if _kind = 'ocr' then
    update public.ai_usage set ocr_calls = ocr_calls + 1
      where user_id = _uid and day = current_date and ocr_calls < _cap
      returning ocr_calls into _n;
  else
    update public.ai_usage set ai_calls = ai_calls + 1
      where user_id = _uid and day = current_date and ai_calls < _cap
      returning ai_calls into _n;
  end if;
  return _n is not null;
end $$;
revoke all on function public.consume_ai_call(text, int) from public, anon;
grant execute on function public.consume_ai_call(text, int) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.subject_catalog (name_ms, name_en, forms, is_core, sort_order) values
  ('Bahasa Melayu', 'Malay Language', '{1,2,3,4,5}', true, 1),
  ('Bahasa Inggeris', 'English', '{1,2,3,4,5}', true, 2),
  ('Matematik', 'Mathematics', '{1,2,3,4,5}', true, 3),
  ('Sains', 'Science', '{1,2,3,4,5}', true, 4),
  ('Sejarah', 'History', '{1,2,3,4,5}', true, 5),
  ('Geografi', 'Geography', '{1,2,3}', true, 6),
  ('Pendidikan Seni Visual', 'Visual Arts Education', '{1,2,3}', true, 7),
  ('Pendidikan Jasmani dan Kesihatan', 'Physical and Health Education', '{1,2,3}', true, 8),
  ('Asas Sains Komputer', 'Basic Computer Science', '{1,2,3}', true, 9),
  ('Pendidikan Moral', 'Moral Education', '{1,2,3,4,5}', true, 10),
  ('Pendidikan Islam', 'Islamic Education', '{1,2,3,4,5}', false, 11);

-- Storage: each student can only reach files inside their own folder of the mark-sources bucket.
create policy "own mark sources read" on storage.objects for select to authenticated
  using (bucket_id = 'mark-sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own mark sources insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'mark-sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own mark sources update" on storage.objects for update to authenticated
  using (bucket_id = 'mark-sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own mark sources delete" on storage.objects for delete to authenticated
  using (bucket_id = 'mark-sources' and (storage.foldername(name))[1] = auth.uid()::text);