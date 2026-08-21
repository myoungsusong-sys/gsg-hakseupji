import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 환경변수 없으면 null → 앱은 localStorage 단독 모드로 동작
export const supabase = url && key ? createClient(url, key) : null
export const SUPABASE_ON = !!supabase

// ── 계정 클라이언트 생성 폴백 (서버 발급 실패 시) — 학생·강사 공용 ──────────
// 서버 발급(/api/create-*-account)은 Supabase **Admin API**를 탄다. 그 관문이 죽으면
// (2026-08-21 실측: Supabase 「401 errors due to JWT rejections」 인시던트 중
//  "this endpoint requires a valid Bearer token" 반환) 계정 발급이 통째로 막힌다.
// anon 키의 일반 signUp 은 **다른 경로**라 그때도 살아 있는 경우가 많다 → 우회로로 쓴다.
// Vercel 의 SUPABASE_SERVICE_ROLE_KEY 가 잘못 설정된 경우에도 같은 우회로가 구해 준다.
// - persistSession:false 보조 클라이언트 → 로그인된 선생님 세션을 건드리지 않음.
// - Supabase Auth "Confirm email"이 꺼져 있으면 data.session이 즉시 발급됨 → 바로 로그인.
//   켜져 있으면 계정은 생기지만 확인 전까지 로그인 불가(needConfirm=true로 안내).
export async function signUpAccountClient(email: string, password: string): Promise<
  { ok: true; needConfirm: boolean } | { ok: false; text: string }> {
  if (!url || !key) return { ok: false, text: '클라우드 설정이 없어 계정을 만들 수 없어요.' }
  const tmp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await tmp.auth.signUp({ email, password })
  if (error) {
    if (/already registered|already been registered/i.test(error.message))
      return { ok: false, text: '이미 이 아이디로 계정이 있어요. 로그인이 안 되면 비밀번호 초기화가 필요합니다(서버 키 설정 후 가능).' }
    return { ok: false, text: error.message.slice(0, 160) }
  }
  if (!data.user) return { ok: false, text: '계정 생성 응답이 비어 있어요. 다시 시도해주세요.' }
  return { ok: true, needConfirm: !data.session }   // session 없으면 이메일 확인 대기
}

/** 이전 이름 — 호출부 호환용. 새 코드는 signUpAccountClient 를 쓴다. */
export const signUpStudentClient = signUpAccountClient
