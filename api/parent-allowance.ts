// 학부모 용돈 보태기 — Vercel 서버리스 (Node).
// 학부모앱에는 로그인 세션이 없으므로, parent-data와 동일하게 "자녀 이름 + 학부모 연락처"로 본인 확인 후
// 그 자녀 앞으로 포인트 항목(kind='parent')만 추가한다. 실제 송금이 아니라 정산용 약속 기록이다.
// 상한 없음(학원 지급분만 월 한도 적용). 삭제·수정은 선생님 화면에서만.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rttqkpquyzfrdxqhgqvi.supabase.co'
const MAX_ONE = 1000000   // 1회 입력 상한 (오타 방지용 안전장치)

function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: any) => { data += c })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}
const digits = (s: string) => (s || '').replace(/\D/g, '')

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { res.status(503).json({ error: '아직 설정되지 않았습니다(SUPABASE_SERVICE_ROLE_KEY).' }); return }

  const { name, phone, amount, message } = await readBody(req)
  const n = String(name ?? '').trim()
  const p = digits(String(phone ?? ''))
  const amt = Math.floor(Number(amount) || 0)
  if (!n || p.length < 4) { res.status(400).json({ error: '이름과 학부모 연락처를 확인해 주세요.' }); return }
  if (amt <= 0 || amt > MAX_ONE) { res.status(400).json({ error: `금액은 1원 ~ ${MAX_ONE.toLocaleString('ko-KR')}원 사이로 입력해 주세요.` }); return }

  try {
    const sb = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    const { data: srows, error } = await sb.from('hj_students').select('data')
    if (error) { res.status(502).json({ error: String(error.message).slice(0, 200) }); return }
    const me = (srows ?? []).map((r: any) => r.data).filter(Boolean).find((s: any) => {
      if (s.active === false) return false
      if (String(s.name ?? '').trim() !== n) return false
      const pp = digits(s.parentPhone ?? '')
      return pp.length >= 4 && (pp === p || pp.endsWith(p) || p.endsWith(pp))
    })
    if (!me) { res.status(404).json({ error: '이름 또는 연락처가 일치하는 학생이 없습니다.' }); return }

    // settings 'pointEntries'에 append (읽고 → 추가 → 저장)
    const { data: row } = await sb.from('hj_settings').select('data').eq('id', 'pointEntries').maybeSingle()
    const list = Array.isArray(row?.data?.value) ? row!.data.value : []
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const entry = {
      id: `pt-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      studentId: me.id, date, amount: amt,
      reason: String(message ?? '').slice(0, 60).trim() || '부모님 응원 용돈',
      kind: 'parent', by: '학부모',
    }
    const next = [...list, entry]
    const { error: werr } = await sb.from('hj_settings')
      .upsert({ id: 'pointEntries', data: { __id: 'pointEntries', value: next }, updated_at: now.toISOString() })
    if (werr) { res.status(502).json({ error: String(werr.message).slice(0, 200) }); return }

    res.status(200).json({ ok: true, entry })
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) })
  }
}
