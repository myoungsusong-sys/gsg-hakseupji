// 실시간 풀이 모니터링 — 학생 캔버스 스냅샷을 서버(Supabase settings id=`live_*`)에 올리고
// 선생님이 여러 학생 풀이를 한 화면에서 확인한다. Supabase가 없으면 localStorage 폴백(같은 브라우저 데모용).
import { supabase } from './supabase'

export interface LiveSolve {
  studentId: string
  name: string
  label: string      // 예: "약수와 배수 학습지 · 3번"
  img: string        // 축소 JPEG dataURL
  at: number         // epoch ms
}

// 선생님 → 학생 실시간 첨삭 (텍스트 + 빨간펜 이미지)
export interface TeacherNote {
  studentId: string
  text: string
  img?: string       // 첨삭 이미지(학생 풀이 위에 빨간펜) dataURL — 없으면 텍스트만
  at: number
}

const LKEY = 'gsg-live-solves'   // 로컬 폴백 (단일 브라우저)
const NKEY = 'gsg-live-notes'

// 학생: 내 최신 스냅샷을 올림 (studentId당 1행 upsert)
export async function pushLive(v: LiveSolve): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('hj_settings').upsert({
        id: `live_${v.studentId}`, data: { __id: `live_${v.studentId}`, value: v }, updated_at: new Date().toISOString(),
      })
    } catch { /* 네트워크 오류 무시 */ }
  } else {
    try { const all = JSON.parse(localStorage.getItem(LKEY) || '{}'); all[v.studentId] = v; localStorage.setItem(LKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}

// 선생님: 전체 live 스냅샷 조회 (첨삭 노트 live_note_* 는 제외)
export async function fetchLive(): Promise<LiveSolve[]> {
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings').select('data').like('id', 'live_%')
      return (data ?? [])
        .filter((r: any) => !String(r.data?.__id ?? '').startsWith('live_note_'))
        .map((r: any) => r.data?.value).filter((v: any): v is LiveSolve => !!v && !!v.studentId && !!v.img)
    } catch { return [] }
  }
  try { return Object.values(JSON.parse(localStorage.getItem(LKEY) || '{}')) as LiveSolve[] } catch { return [] }
}

// ── 첨삭 (선생님 → 학생) ──────────────────────────────
export async function pushNote(n: TeacherNote): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('hj_settings').upsert({
        id: `live_note_${n.studentId}`, data: { __id: `live_note_${n.studentId}`, value: n }, updated_at: new Date().toISOString(),
      })
    } catch { /* 무시 */ }
  } else {
    try { const all = JSON.parse(localStorage.getItem(NKEY) || '{}'); all[n.studentId] = n; localStorage.setItem(NKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}

export async function fetchNote(studentId: string): Promise<TeacherNote | null> {
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings').select('data').eq('id', `live_note_${studentId}`).maybeSingle()
      return (data as any)?.data?.value ?? null
    } catch { return null }
  }
  try { return JSON.parse(localStorage.getItem(NKEY) || '{}')[studentId] ?? null } catch { return null }
}

export async function clearNote(studentId: string): Promise<void> {
  if (supabase) {
    try { await supabase.from('hj_settings').delete().eq('id', `live_note_${studentId}`) } catch { /* 무시 */ }
  } else {
    try { const all = JSON.parse(localStorage.getItem(NKEY) || '{}'); delete all[studentId]; localStorage.setItem(NKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}

// 학생 퇴장 시 내 스냅샷 제거 (선택)
export async function clearLive(studentId: string): Promise<void> {
  if (supabase) {
    try { await supabase.from('hj_settings').delete().eq('id', `live_${studentId}`) } catch { /* 무시 */ }
  } else {
    try { const all = JSON.parse(localStorage.getItem(LKEY) || '{}'); delete all[studentId]; localStorage.setItem(LKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}
