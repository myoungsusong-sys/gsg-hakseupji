// 학원관리앱 출결 → 학습지앱 일일보고서 등원/하원 자동 반영 — Vercel 서버리스 (Node).
// 같은 Supabase(fokus-academy)의 관리앱 `attendance` 테이블을 service-role로 읽는다.
// 관리앱 RLS를 authenticated 전용으로 강화해도 service-role은 우회하므로 안전. 읽기 전용.
// 매칭: 학습지앱 학생의 mgmtId == 관리앱 student.id, 날짜 일치.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { res.status(503).json({ error: '출결 연동이 아직 설정되지 않았습니다(SUPABASE_SERVICE_ROLE_KEY).' }); return }

  const auth = String(req.headers?.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) { res.status(401).json({ error: '로그인 후 이용해 주세요.' }); return }

  const mgmtId = String(req.query?.mgmtId ?? '').trim()
  const date = String(req.query?.date ?? '').trim()   // yyyy-MM-dd
  if (!mgmtId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: 'mgmtId·date(yyyy-MM-dd)가 필요합니다.' }); return }

  try {
    const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    const { data: who, error: uerr } = await admin.auth.getUser(token)
    if (uerr || !who?.user) { res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요.' }); return }

    const { data, error } = await admin.from('attendance').select('*')
      .eq('studentId', mgmtId).eq('date', date).limit(1)
    if (error) {
      if (/does not exist/i.test(error.message)) { res.status(200).json({ attendance: null }); return }
      res.status(502).json({ error: String(error.message).slice(0, 200) }); return
    }
    const row: any = (data ?? [])[0]
    if (!row) { res.status(200).json({ attendance: null }); return }
    // 관리앱 AttendanceLog: { studentId, date, checkIn?, checkOut?, status, late }
    res.status(200).json({
      attendance: {
        checkIn: row.checkIn ? String(row.checkIn) : '',
        checkOut: row.checkOut ? String(row.checkOut) : '',
        status: row.status ? String(row.status) : '',
        late: !!row.late,
      },
    })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
