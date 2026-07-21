// 학생 계정 발급·비밀번호 초기화 — Vercel 서버리스 (Node). 선생님이 앱에서 직접 처리한다.
// (이메일 등록 없이) 아이디+비번으로 계정 생성: 이메일 = s-<loginId>@student.gsg.app 규약.
// 보안: 호출자의 Supabase 세션 토큰 검증(로그인된 선생님만) → 익명 호출 차단.
// action 'create' = 계정 생성 · 'reset' = 기존 계정 비밀번호 변경(Admin API — 브라우저 anon 키로는 불가).
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'
const STUDENT_DOMAIN = 'student.gsg.app'

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { res.status(503).json({ error: '계정 발급이 아직 설정되지 않았습니다(SUPABASE_SERVICE_ROLE_KEY).' }); return }

  // 호출자 인증 — 로그인된 선생님만
  const auth = String(req.headers?.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) { res.status(401).json({ error: '로그인 후 이용해 주세요.' }); return }

  const { action, loginId, password, name } = await readBody(req)
  const act = action === 'reset' ? 'reset' : 'create'
  const id = String(loginId ?? '').trim().toLowerCase()
  const pw = String(password ?? '')
  if (!/^[a-z0-9._-]{3,}$/.test(id)) { res.status(400).json({ error: '아이디는 영문·숫자 3자 이상(공백 없이)이어야 합니다.' }); return }
  if (pw.length < 6) { res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' }); return }

  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    const { data: who, error: uerr } = await admin.auth.getUser(token)
    if (uerr || !who?.user) { res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }); return }
    // 학생 계정으로는 계정 발급 불가 (선생님 세션만)
    const callerEmail = String(who.user.email ?? '').toLowerCase()
    if (callerEmail.endsWith(`@${STUDENT_DOMAIN}`)) { res.status(403).json({ error: '선생님 계정으로 로그인해 주세요.' }); return }

    const email = `s-${id}@${STUDENT_DOMAIN}`

    if (act === 'create') {
      const { error } = await admin.auth.admin.createUser({
        email, password: pw, email_confirm: true,
        user_metadata: { role: 'student', name: String(name ?? '').slice(0, 40) },
      })
      if (error) {
        const msg = /already been registered|already exists/i.test(error.message)
          ? '이미 계정이 있는 아이디입니다. 비밀번호 초기화를 이용하세요.' : String(error.message).slice(0, 200)
        res.status(409).json({ error: msg }); return
      }
      res.status(200).json({ ok: true, email }); return
    }

    // reset — 이메일로 사용자 검색(소규모 학원 규모라 페이지 스캔으로 충분) → 비밀번호 변경
    let uid: string | null = null
    for (let page = 1; page <= 10 && !uid; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) { res.status(502).json({ error: String(error.message).slice(0, 200) }); return }
      uid = data.users.find(u => (u.email ?? '').toLowerCase() === email)?.id ?? null
      if (data.users.length < 200) break
    }
    if (!uid) { res.status(404).json({ error: '이 아이디의 계정이 아직 없습니다. 먼저 계정을 만들어 주세요.' }); return }
    const { error: perr } = await admin.auth.admin.updateUserById(uid, { password: pw })
    if (perr) { res.status(502).json({ error: String(perr.message).slice(0, 200) }); return }
    res.status(200).json({ ok: true, email })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
