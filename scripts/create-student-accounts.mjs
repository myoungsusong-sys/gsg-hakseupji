#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// 학생 Supabase 계정 일괄 생성 스크립트 (⚠️ 이 세션에서는 실행하지 않음 — 명수쌤과 별도 실행)
//
// 무엇을 하나:
//   1) hj_students 전체 로드
//   2) 학생별 loginId 결정: data.loginId → 없으면 data.attendNo (둘 다 없으면 건너뜀)
//   3) 이메일 규약 s-<loginId>@student.gsg.app 으로 Supabase Auth 계정 생성
//   4) 생성 성공 시 hj_students.data.authEmail 에 이메일 기록 (학생앱 역할 매칭에 사용)
//
// 두 가지 생성 방식 (환경변수로 선택):
//   A. service key 방식 (권장) — SUPABASE_SERVICE_KEY 지정 시 admin.createUser 사용.
//      이메일 인증 없이 즉시 활성(email_confirm: true). Auth > Signups 꺼져 있어도 동작.
//   B. signup-enabled 방식 — SUPABASE_SERVICE_KEY 없이 anon key만 있으면 auth.signUp 사용.
//      Supabase 대시보드에서 Auth > Sign In / Up > "Allow new users to sign up" 켜고,
//      "Confirm email" 꺼야 함 (가짜 도메인이라 인증 메일 수신 불가). 생성 후 다시 끌 것.
//
// 사용법:
//   export SUPABASE_URL="https://<프로젝트>.supabase.co"
//   export SUPABASE_SERVICE_KEY="<service_role key>"     # A방식 (또는 생략하고 ↓)
//   export SUPABASE_ANON_KEY="<anon key>"                # B방식·hj_students 조회용
//   node scripts/create-student-accounts.mjs             # 전체 생성 (이미 있으면 건너뜀)
//   node scripts/create-student-accounts.mjs --dry-run   # 생성 없이 대상 목록만 출력
//   node scripts/create-student-accounts.mjs --pw 1234가나  # 공통 비밀번호 직접 지정
//   node scripts/create-student-accounts.mjs --reset 0412   # 해당 학생 비밀번호를 기본값으로 초기화 (service key 필수)
//
// 비밀번호 기본값: gsg<loginId> (Supabase 최소 6자 충족. 예: 출결번호 0412 → gsg0412)
//   → 생성 후 학생별 안내: "아이디 = 출결번호, 비밀번호 = gsg+출결번호"
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const ANON = process.env.SUPABASE_ANON_KEY
const DRY = process.argv.includes('--dry-run')
const pwArg = process.argv.indexOf('--pw')
const FIXED_PW = pwArg >= 0 ? process.argv[pwArg + 1] : null
const resetArg = process.argv.indexOf('--reset')
const RESET_ID = resetArg >= 0 ? process.argv[resetArg + 1] : null   // 비밀번호 초기화 대상 loginId

if (!URL || (!SERVICE && !ANON)) {
  console.error('환경변수 필요: SUPABASE_URL + (SUPABASE_SERVICE_KEY 또는 SUPABASE_ANON_KEY)')
  process.exit(1)
}

const DOMAIN = 'student.gsg.app'
const emailOf = id => `s-${String(id).trim().toLowerCase()}@${DOMAIN}`
const pwOf = id => FIXED_PW ?? `gsg${String(id).trim()}`

// 데이터 조회·hj_students 갱신은 service key가 있으면 그걸로 (RLS 무시), 없으면 anon으로
const db = createClient(URL, SERVICE ?? ANON)
// 계정 생성 클라이언트: A방식이면 service(admin), B방식이면 anon(signUp)
const auth = createClient(URL, SERVICE ?? ANON, { auth: { persistSession: false } })

// ── --reset <loginId>: 학생 비밀번호를 기본값(gsg<loginId>)으로 초기화 ──
//    선생님웹 학생 상세 [학생 비밀번호 초기화] 버튼이 이 명령을 안내한다. service key 필수.
if (RESET_ID) {
  if (!SERVICE) {
    console.error('--reset 은 SUPABASE_SERVICE_KEY(service_role)가 필요합니다.')
    process.exit(1)
  }
  const email = emailOf(RESET_ID)
  const newPw = pwOf(RESET_ID)
  let user = null
  for (let page = 1; page <= 50 && !user; page++) {
    const { data, error } = await auth.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error('사용자 조회 실패: ' + error.message); process.exit(1) }
    user = (data?.users ?? []).find(u => (u.email ?? '').toLowerCase() === email)
    if ((data?.users ?? []).length < 200) break
  }
  if (!user) {
    console.error(`계정 없음: ${email} — 먼저 스크립트를 --reset 없이 실행해 계정을 생성하세요.`)
    process.exit(1)
  }
  const { error } = await auth.auth.admin.updateUserById(user.id, { password: newPw })
  if (error) { console.error('초기화 실패: ' + error.message); process.exit(1) }
  console.log(`✓ ${email} 비밀번호를 기본값(${newPw})으로 초기화했습니다.`)
  process.exit(0)
}

async function loadStudents() {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('hj_students').select('id, data').range(from, from + 999)
    if (error) throw new Error('hj_students 로드 실패: ' + error.message)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

const rows = await loadStudents()
let made = 0, skipped = 0, failed = 0

for (const row of rows) {
  const st = row.data ?? {}
  if (st.active === false) { skipped++; continue }                 // 퇴원생 제외
  const loginId = (st.loginId ?? st.attendNo ?? '').trim()
  if (!loginId) {
    console.warn(`− ${st.name ?? row.id}: loginId·출결번호 없음 → 건너뜀`)
    skipped++; continue
  }
  const email = emailOf(loginId)
  if ((st.authEmail ?? '') === email) { skipped++; continue }      // 이미 생성됨

  console.log(`${DRY ? '[dry] ' : ''}${st.name} (${loginId}) → ${email}`)
  if (DRY) continue

  let error
  if (SERVICE) {
    // A방식: admin 생성 — 이메일 인증 없이 즉시 활성
    ;({ error } = await auth.auth.admin.createUser({ email, password: pwOf(loginId), email_confirm: true }))
  } else {
    // B방식: 일반 가입 — 대시보드에서 signup 허용 + 이메일 인증 해제 필요
    ;({ error } = await auth.auth.signUp({ email, password: pwOf(loginId) }))
  }
  if (error && !/already (been )?registered/i.test(error.message)) {
    console.error(`  ✗ 실패: ${error.message}`)
    failed++; continue
  }

  // 학생 레코드에 authEmail 기록 → 학생앱이 세션 이메일로 본인을 찾는다
  const next = { ...st, authEmail: email, loginId: st.loginId ?? loginId }
  const { error: upErr } = await db.from('hj_students')
    .upsert({ id: row.id, data: next, updated_at: new Date().toISOString() })
  if (upErr) console.warn(`  ! authEmail 기록 실패(계정은 생성됨): ${upErr.message}`)
  made++
}

console.log(`\n완료: 생성 ${made} · 건너뜀 ${skipped} · 실패 ${failed} (전체 ${rows.length}명)`)
