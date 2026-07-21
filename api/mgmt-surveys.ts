// 학원관리앱(대치스파르타) 학습습관 자가진단 공유 — Vercel 서버리스 (Node).
// 관리앱 `surveys` 테이블(무접두, RLS authenticated)을 service-role로 읽어
// 학습지앱 입학 진단 리포트의 '학습습관' 섹션에 공급한다. 읽기 전용.
// 보안: 호출자의 학습지앱 세션 토큰 검증(로그인된 선생님만) — mgmt-students.ts와 동일.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { res.status(503).json({ error: '연동이 아직 설정되지 않았습니다(SUPABASE_SERVICE_ROLE_KEY).' }); return }

  const mgmtId = String(req.query?.mgmtId ?? '').trim()
  if (!mgmtId) { res.status(400).json({ error: 'mgmtId가 필요합니다.' }); return }

  const auth = String(req.headers?.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) { res.status(401).json({ error: '로그인 후 이용해 주세요.' }); return }

  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    const { data: who, error: uerr } = await admin.auth.getUser(token)
    if (uerr || !who?.user) { res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }); return }

    const { data, error } = await admin.from('surveys')
      .select('date, scores')
      .eq('studentId', mgmtId)
      .order('date', { ascending: false })
      .limit(1)
    if (error) {
      if (/does not exist/i.test(error.message)) { res.status(200).json({ survey: null }); return }
      res.status(502).json({ error: String(error.message).slice(0, 200) }); return
    }
    const row = data?.[0]
    res.status(200).json({ survey: row ? { date: String(row.date), scores: row.scores ?? {} } : null })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
