-- 깊은생각 학습지앱 — Supabase 스키마 (fokus-academy 프로젝트 재사용, hj_ 접두어로 학원관리앱과 분리)
-- 각 테이블 = (id text PK, data jsonb, updated_at). 앱 객체를 data에 통째로 저장.
-- Supabase 대시보드 SQL Editor에 붙여넣고 Run.

create table if not exists hj_problems     (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_worksheets   (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_lists        (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_workbooks    (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_wb_items     (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_students     (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_gradings     (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_daily_notes  (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists hj_settings     (id text primary key, data jsonb not null, updated_at timestamptz default now());

-- RLS: 로그인 없는 단일 학원 도구라 anon 전체 허용 (v1). 추후 auth 도입 시 tighten.
do $$
declare t text;
begin
  foreach t in array array['hj_problems','hj_worksheets','hj_lists','hj_workbooks','hj_wb_items','hj_students','hj_gradings','hj_daily_notes','hj_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "hj anon all" on %I', t);
    execute format('create policy "hj anon all" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- 실시간 구독을 위해 publication에 추가 (이미 있으면 무시)
do $$
declare t text;
begin
  foreach t in array array['hj_problems','hj_worksheets','hj_lists','hj_workbooks','hj_wb_items','hj_students','hj_gradings','hj_daily_notes','hj_settings']
  loop
    begin execute format('alter publication supabase_realtime add table %I', t); exception when duplicate_object then null; end;
  end loop;
end $$;
