// 학원관리앱(대치스파르타) 학생 명부 공유 — Vercel 서버리스 (Node).
// 학원관리앱과 같은 Supabase 프로젝트(fokus-academy)의 `students` 테이블을 읽어 학습지앱으로 넘긴다.
// 두 앱의 RLS 정책이 달라(관리앱=로그인전용 강화 예정) service-role로 서버에서 안전하게 읽는다.
// 보안: 호출자의 학습지앱 세션 토큰을 검증(로그인된 선생님만) → 익명 유출 차단. 읽기 전용.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { res.status(503).json({ error: '학생 공유가 아직 설정되지 않았습니다(SUPABASE_SERVICE_ROLE_KEY).' }); return }

  // 호출자 인증 — 로그인된 사용자(원장/강사)만 허용
  const auth = String(req.headers?.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) { res.status(401).json({ error: '로그인 후 이용해 주세요.' }); return }

  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    const { data: who, error: uerr } = await admin.auth.getUser(token)
    if (uerr || !who?.user) { res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }); return }

    // 관리앱 students 테이블 (무접두어). 학습지앱은 hj_ 접두어라 충돌 없음.
    const { data, error } = await admin.from('students').select('*')
    if (error) {
      // 테이블이 아직 없으면(관리앱 미배포) 빈 목록으로 안내
      if (/does not exist|relation .* does not exist/i.test(error.message)) {
        res.status(200).json({ students: [], note: '학원관리앱 학생 데이터가 아직 없습니다.' }); return
      }
      res.status(502).json({ error: String(error.message).slice(0, 200) }); return
    }

    // 관리앱 Student: { id, name, grade, school, phone, parentPhone, seat?, memo?, active }
    // → 학습지앱이 쓰기 쉬운 형태로 정규화
    const students = (data ?? []).map((s: any) => ({
      mgmtId: String(s.id),
      name: String(s.name ?? '').trim(),
      grade: String(s.grade ?? '').trim(),          // '중2'·'고1' 등 (학습지앱 grade와 호환)
      school: String(s.school ?? '').trim(),
      studentPhone: String(s.phone ?? '').trim(),
      parentPhone: String(s.parentPhone ?? '').trim(),
      memo: String(s.memo ?? '').trim(),
      active: s.active !== false,
    }))
    res.status(200).json({ students })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
