-- 문제 질문함 (학생이 문제를 찍어 올리고 질문 → 해설 노트 이미지를 돌려받는다)
-- Supabase 대시보드 SQL Editor 에 붙여넣고 Run.
-- 🔴 맨 아래 「워커 키」 한 줄을 반드시 자기 값으로 바꿔서 실행할 것.
--
-- 왜 hj_settings 나 기존 테이블에 얹지 않았나
--    src/lib/backend.ts 의 rows() 는 **9개 테이블을 전량**으로 받아오고, 실시간 변경마다
--    loadAll() 이 다시 돈다. 사진이 든 행을 거기 넣으면 앱을 켤 때마다 전부 다시 내려받는다.
--    2026-09-02 에 실제로 egress 30.8GB(무료 5GB의 6.2배)로 프로젝트가 402 로 잠겨
--    학습지앱·학원관리앱이 함께 멈췄다. 그래서 질문은 **전량로드 경로 밖**의 새 테이블에 두고,
--    사진은 jsonb 가 아니라 **Storage** 에 둔다(행에는 URL 한 줄만).

create table if not exists hj_questions (
  id         text primary key,          -- q-<학생id>-<시각36>-<난수> → like 'q-<학생id>-%' 로 본인 것만
  data       jsonb not null,
  updated_at timestamptz default now()
);
alter table hj_questions enable row level security;
drop policy if exists "hj auth all" on hj_questions;
create policy "hj auth all" on hj_questions for all to authenticated using (true) with check (true);
create index if not exists hj_questions_updated on hj_questions (updated_at desc);
create index if not exists hj_questions_status  on hj_questions ((data->>'status'));

-- ── 워커 비밀키 보관 ──────────────────────────────────────────
-- 🔴 워커(명수쌤 맥)는 «비밀번호를 갖지 않는다». 아래 키 하나로 아래 함수들만 부를 수 있다.
--    관리앱의 DIGEST_KEY(ds_owner_report) 와 같은 방식이다.
create table if not exists hj_secrets (id text primary key, value text not null);
alter table hj_secrets enable row level security;   -- 정책 없음 = anon/authenticated 모두 직접 읽기 불가

-- ── 사진 버킷 ────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('qna', 'qna', true)
on conflict (id) do update set public = true;

drop policy if exists "qna read"    on storage.objects;
drop policy if exists "qna write"   on storage.objects;
drop policy if exists "qna modify"  on storage.objects;
drop policy if exists "qna worker"  on storage.objects;
-- 보기: 누구나(경로가 난수라 추측 불가 — 학원관리앱 snapshots 버킷과 같은 방식)
create policy "qna read"   on storage.objects for select using (bucket_id = 'qna');
-- 학생이 올리는 문제 사진: 로그인한 사람만
create policy "qna write"  on storage.objects for insert to authenticated with check (bucket_id = 'qna');
create policy "qna modify" on storage.objects for update to authenticated using (bucket_id = 'qna');
-- 워커가 올리는 해설 이미지: 로그인 없이, 단 «…/answer.jpg» 한 가지 이름만
create policy "qna worker" on storage.objects for insert to anon
  with check (bucket_id = 'qna' and name like '%/answer.jpg');

-- ── 워커용 함수 3개 (키를 아는 쪽만 부를 수 있다) ─────────────
create or replace function hj_qna_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_key is not null and exists (select 1 from hj_secrets where id = 'qna_worker' and value = p_key);
$$;

-- 한 건 집어 오면서 «만드는중» 으로 잠근다. 20분 넘게 만드는중인 것도 다시 집는다(워커가 죽은 경우).
create or replace function hj_qna_take(p_key text)
returns table(q_id text, q_data jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not hj_qna_key_ok(p_key) then raise exception '키가 맞지 않습니다'; end if;
  return query
  update hj_questions q
     set data = q.data || jsonb_build_object('status', '만드는중'), updated_at = now()
   where q.id = (
     select q2.id from hj_questions q2
      where q2.data->>'status' = '대기'
         or (q2.data->>'status' = '만드는중' and q2.updated_at < now() - interval '20 minutes')
      order by q2.updated_at asc limit 1
      for update skip locked)
  returning q.id, q.data;
end $$;

create or replace function hj_qna_done(p_key text, p_id text, p_url text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hj_qna_key_ok(p_key) then raise exception '키가 맞지 않습니다'; end if;
  update hj_questions
     set data = (data - 'error') || jsonb_build_object(
           'status', '완료', 'answerUrl', p_url, 'answerText', coalesce(p_title, ''),
           'answeredAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
         updated_at = now()
   where id = p_id;
end $$;

create or replace function hj_qna_fail(p_key text, p_id text, p_error text, p_final boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hj_qna_key_ok(p_key) then raise exception '키가 맞지 않습니다'; end if;
  update hj_questions
     set data = data || jsonb_build_object(
           'status', case when p_final then '실패' else '대기' end,
           'error', left(coalesce(p_error, ''), 300),
           'tries', coalesce((data->>'tries')::int, 0) + 1),
         updated_at = now()
   where id = p_id;
end $$;

create or replace function hj_qna_stat(p_key text)
returns table(status text, n bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not hj_qna_key_ok(p_key) then raise exception '키가 맞지 않습니다'; end if;
  return query select coalesce(q.data->>'status', '?'), count(*) from hj_questions q group by 1 order by 1;
end $$;

revoke all on function hj_qna_key_ok(text) from public, anon, authenticated;
grant execute on function hj_qna_take(text)                       to anon, authenticated;
grant execute on function hj_qna_done(text, text, text, text)     to anon, authenticated;
grant execute on function hj_qna_fail(text, text, text, boolean)  to anon, authenticated;
grant execute on function hj_qna_stat(text)                       to anon, authenticated;

-- ── 🔴 워커 키 심기 — 이 줄의 값을 워커의 ~/.config/질문워커/워커.env 와 똑같이 맞춘다 ──
insert into hj_secrets (id, value) values ('qna_worker', 'qw_XztCQ5GwR6C_q11HUfkH2dpY679qmvXpjXFzt8pyxic')
on conflict (id) do update set value = excluded.value;

-- 확인
select 'hj_questions' as t, count(*)::text from hj_questions
union all select 'bucket qna', count(*)::text from storage.buckets where id = 'qna'
union all select 'worker key', case when exists(select 1 from hj_secrets where id='qna_worker') then '심어짐' else '없음' end;
