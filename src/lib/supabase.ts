import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 환경변수 없으면 null → 앱은 localStorage 단독 모드로 동작
export const supabase = url && key ? createClient(url, key) : null
export const SUPABASE_ON = !!supabase

// ── 학생 계정 클라이언트 생성 폴백 (service_role 서버 발급 실패 시) ──────────
// Vercel의 SUPABASE_SERVICE_ROLE_KEY가 잘못 설정돼 서버 발급(/api/create-student-account)이
// 실패해도 학원 운영이 막히지 않도록, anon 키로 직접 signUp 한다.
// - persistSession:false 보조 클라이언트 → 로그인된 선생님 세션을 건드리지 않음.
// - Supabase Auth "Confirm email"이 꺼져 있으면 data.session이 즉시 발급됨 → 바로 로그인.
//   켜져 있으면 계정은 생기지만 확인 전까지 로그인 불가(needConfirm=true로 안내).
export async function signUpStudentClient(email: string, password: string): Promise<
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
