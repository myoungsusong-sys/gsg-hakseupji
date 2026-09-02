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

// 선생님: live 스냅샷 조회 (첨삭 노트 live_note_* 는 제외)
//
// 🔴 대역폭 주의 — 이 함수는 3초마다 돌고, 각 행에는 학생 필기 JPEG dataURL(장당 10~13KB)이 들어 있다.
//    전량(`live_%`)을 매번 받으면 「그동안 한 번이라도 푼 학생」 전원분이 3초마다 다시 내려온다.
//    2026-09-02 이것 때문에 Supabase egress 가 한 달 30.8GB(무료 한도 5GB의 6.2배)까지 올라가
//    프로젝트 전체가 402 로 잠겼고, 학습지앱·학원관리앱이 같이 멈췄다.
//    → `sinceIso` 를 주면 **그 시각 이후 갱신된 행만** 받는다. 지금 필기 중인 학생만 오간다.
//    호출부는 받은 것을 캐시에 병합해 쓴다(GroupPanel 의 라이브 모니터).
export async function fetchLive(sinceIso?: string): Promise<LiveSolve[]> {
  if (supabase) {
    try {
      let q = supabase.from('hj_settings').select('data').like('id', 'live_%')
      if (sinceIso) q = q.gt('updated_at', sinceIso)
      const { data } = await q
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
// ── 📢 학생 호출 (선생님 → 학생) ─────────────────────────────────────────
// "아이들이 질문을 잘 안 한다. 선생님은 놀고 있다" — 학생이 손들기를 기다리지 말고
// **오늘 틀린 학생을 앱이 지목하고 선생님이 먼저 부른다.** (2026-08-12 명수쌤 지시)
//
// 🔴 id 접두어는 반드시 `live_` 로 시작한다. backend.ts:176 이 settings 의 `live_*` 변경을
//    realtime 구독에서 무시하기 때문 — 안 그러면 호출 한 번에 **접속 중인 전 기기가 전체 리로드**된다.
//    대신 학생 쪽은 아래 fetchCall 을 스스로 폴링한다(첨삭 note 와 같은 방식).
// 🔴 note(첨삭)와 **다른 행**을 쓴다. 같은 행을 쓰면 첨삭과 호출이 서로를 지운다.
export type CallState = 'calling' | 'coming' | 'done'
export interface TeacherCall {
  studentId: string
  by: string          // 부른 사람(선생님 이름) — 학생 화면에 그대로 보인다
  text: string        // "앞으로 나오세요" 등
  reason?: string     // "오답 9개 · 쎈 중2 p.42~43" — 왜 불렀는지(선생님 화면 표시용)
  state: CallState
  at: number          // 부른 시각
  ackAt?: number      // 학생이 [갈게요] 누른 시각
  expiresAt: number   // 이 시각이 지나면 무시·삭제 (기본 15분)
}

const CKEY = 'gsg-live-calls'
const callId = (sid: string) => `live_call_${sid}`

/** 선생님: 호출 보내기(또는 상태 갱신) — 학생당 1행 upsert */
export async function pushCall(c: TeacherCall): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('hj_settings').upsert({
        id: callId(c.studentId), data: { __id: callId(c.studentId), value: c }, updated_at: new Date().toISOString(),
      })
    } catch { /* 네트워크 오류 무시 — 다음 호출로 복구된다 */ }
  } else {
    try { const all = JSON.parse(localStorage.getItem(CKEY) || '{}'); all[c.studentId] = c; localStorage.setItem(CKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}

/** 선생님: 전체 호출 상태 조회 (만료분은 걸러서 돌려준다) */
export async function fetchCalls(): Promise<TeacherCall[]> {
  const now = Date.now()
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings').select('data').like('id', 'live_call_%')
      return (data ?? []).map((r: any) => r.data?.value)
        .filter((v: any): v is TeacherCall => !!v && !!v.studentId && v.expiresAt > now)
    } catch { return [] }
  }
  try {
    return (Object.values(JSON.parse(localStorage.getItem(CKEY) || '{}')) as TeacherCall[])
      .filter(v => v.expiresAt > now)
  } catch { return [] }
}

/** 학생: 내 호출 하나 조회 (만료면 null) */
export async function fetchCall(studentId: string): Promise<TeacherCall | null> {
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings').select('data').eq('id', callId(studentId)).maybeSingle()
      const v = (data as any)?.data?.value as TeacherCall | undefined
      return v && v.expiresAt > Date.now() ? v : null
    } catch { return null }
  }
  try {
    const v = JSON.parse(localStorage.getItem(CKEY) || '{}')[studentId] as TeacherCall | undefined
    return v && v.expiresAt > Date.now() ? v : null
  } catch { return null }
}

/** 호출 지우기 (설명 완료·취소) */
export async function clearCall(studentId: string): Promise<void> {
  if (supabase) {
    try { await supabase.from('hj_settings').delete().eq('id', callId(studentId)) } catch { /* 무시 */ }
  } else {
    try { const all = JSON.parse(localStorage.getItem(CKEY) || '{}'); delete all[studentId]; localStorage.setItem(CKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}
