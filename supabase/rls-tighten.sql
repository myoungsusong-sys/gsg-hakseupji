-- 로그인 도입 후 RLS 조이기: anon 전체허용 → authenticated(로그인)만 허용.
-- ⚠️ 이걸 실행하면 로그인해야 데이터가 보인다. 계정이 하나 이상 있어야 함(학원관리앱 계정 재사용 가능).
do $$
declare t text;
begin
  foreach t in array array['hj_problems','hj_worksheets','hj_lists','hj_workbooks','hj_wb_items','hj_students','hj_gradings','hj_daily_notes','hj_settings']
  loop
    execute format('drop policy if exists "hj anon all" on %I', t);
    execute format('drop policy if exists "hj auth all" on %I', t);
    execute format('create policy "hj auth all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
