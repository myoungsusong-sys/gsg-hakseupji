// 학부모앱 데이터 — Vercel 서버리스 (Node). 학생 이름 + 학부모 연락처로 본인 확인 후
// 그 "자녀 한 명"의 데이터만 반환한다. RLS를 우회하는 service-role 키는 서버에서만 사용(브라우저 노출 없음).
// 필요 env: SUPABASE_SERVICE_ROLE_KEY (필수). SUPABASE_URL은 없으면 아래 기본값 사용(공개 주소).
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

const digits = (s: string) => (s || '').replace(/\D/g, '')

async function allData(sb: any, table: string): Promise<any[]> {
  const out: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('data').range(from, from + PAGE - 1)
    if (error) break
    const batch = (data ?? []).map((r: any) => r.data)
    out.push(...batch)
    if (batch.length < PAGE) break
  }
  return out
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { res.status(503).json({ error: '학부모앱이 아직 설정되지 않았습니다(SUPABASE_SERVICE_ROLE_KEY).' }); return }

  const { name, phone } = await readBody(req)
  const n = String(name ?? '').trim()
  const p = digits(String(phone ?? ''))
  if (!n || p.length < 4) { res.status(400).json({ error: '이름과 학부모 연락처(4자리 이상)를 입력하세요.' }); return }

  try {
    const sb = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    // 전체 학생에서 이름 일치 + 연락처(디지털) 일치/끝자리 일치
    const { data: srows, error } = await sb.from('hj_students').select('data')
    if (error) { res.status(502).json({ error: String(error.message).slice(0, 200) }); return }
    const students = (srows ?? []).map((r: any) => r.data).filter(Boolean)
    const me = students.find((s: any) => {
      if (s.active === false) return false
      if (String(s.name ?? '').trim() !== n) return false
      const pp = digits(s.parentPhone ?? '')
      return pp.length >= 4 && (pp === p || pp.endsWith(p) || p.endsWith(pp))
    })
    if (!me) { res.status(404).json({ error: '이름 또는 학부모 연락처가 일치하는 학생이 없습니다.' }); return }

    // 자녀 한 명 데이터만 (data jsonb라 studentId 컬럼 필터가 없어 전량→앱단 필터 — 학생 수 규모라 감당 가능)
    const [allNotes, allGr, settings] = await Promise.all([
      allData(sb, 'hj_daily_notes'), allData(sb, 'hj_gradings'), allData(sb, 'hj_settings'),
    ])
    const profile = settings.find((s: any) => s?.__id === 'academyProfile')?.value ?? null

    res.status(200).json({
      student: { id: me.id, name: me.name, grade: me.grade, klass: me.klass ?? '', classDays: me.classDays ?? [] },
      academyName: profile?.academyName ?? '',
      dailyNotes: allNotes.filter((d: any) => d?.studentId === me.id),
      gradings: allGr.filter((g: any) => g?.studentId === me.id),
    })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
