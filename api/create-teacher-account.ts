// 강사 계정 발급 — Vercel 서버리스 (Node). 원장(로그인된 선생님)이 강사 아이디+비번을 정하면
// Supabase Admin API(service-role)로 실제 계정을 만든다. 계정 이메일 = t-<loginId>@teacher.gsg.app
// 보안: 호출자의 Supabase 세션 토큰을 검증(로그인된 사용자만) → 익명 계정 생성 차단.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'
const TEACHER_DOMAIN = 'teacher.gsg.app'

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

  // 호출자 인증 — 로그인된 사용자(원장/강사)만 허용
  const auth = String(req.headers?.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) { res.status(401).json({ error: '로그인 후 이용해 주세요.' }); return }

  const { loginId, password, name } = await readBody(req)
  const id = String(loginId ?? '').trim().toLowerCase()
  const pw = String(password ?? '')
  if (!/^[a-z0-9._-]{3,}$/.test(id)) { res.status(400).json({ error: '아이디는 영문·숫자 3자 이상(공백 없이)으로 입력하세요.' }); return }
  if (pw.length < 6) { res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' }); return }

  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    // 세션 토큰 검증
    const { data: who, error: uerr } = await admin.auth.getUser(token)
    if (uerr || !who?.user) { res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }); return }

    const email = `t-${id}@${TEACHER_DOMAIN}`
    const { error } = await admin.auth.admin.createUser({
      email, password: pw, email_confirm: true,
      user_metadata: { role: 'teacher', name: String(name ?? '').slice(0, 40) },
    })
    if (error) {
      const msg = /already been registered|already exists/i.test(error.message)
        ? '이미 사용 중인 아이디입니다. 다른 아이디로 만들어 주세요.' : String(error.message).slice(0, 200)
      res.status(409).json({ error: msg }); return
    }
    res.status(200).json({ ok: true, email })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
