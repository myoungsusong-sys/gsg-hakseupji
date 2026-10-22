// 📊 실시간 문제풀이 현황 → 선생님앱 (2026-10-21 명수쌤 "선생님앱에 학생들 실시간 문제풀이 현황 뜨게 해줘")
//
// 학생이 승강제에서 답할 때·학습지를 풀 때 «지금 무엇을, 오늘 몇 문제, 몇 개 맞았나» 작은 행 하나를 갱신한다.
//   hj_settings id = `prog_<학습지앱 학생id>_<yyyy-mm-dd>`  value = ProgFeed (1KB 안팎)
// 선생님앱(학원관리앱)은 이 작은 행들만 15초마다 읽는다 — wrongFeed 와 같은 방식(거대한 masteries 행을 받지 않는다).
// 🔴 올리기는 학생마다 10초에 한 번까지(마지막 것은 꼭 올린다) — 답할 때마다 전 기기에 실시간 알림이 가지 않게.
// 이 행들은 학습지앱이 설정을 읽어 올 때 빠진다(backend.ts SKIP_SETTING · not like 'prog_%').

import { supabase } from './supabase'

export interface ProgNow {
  kind: '승강제' | '학습지'
  title: string            // 승강제 = 유형 이름 · 학습지 = 학습지 제목
  subject?: string         // 수학·과학·국어·영어·사회·역사 — 과목별 맞음·틀림을 센다(학부모 보고)
  course?: string
  unitName?: string        // 오늘 단원 승강제면 단원 이름
  floor?: number           // 0 개념 · 1 기본 · 2 표준 · 3 심화 · 4 최상
  unitDone?: number        // 오늘 단원 정복 유형 / 전체
  unitTotal?: number
  answered?: number        // 학습지 — 답 넣은 문항 / 전체
  total?: number
  score?: [number, number] // 학습지 제출 — 맞힌 수 / 전체
  needsTeacher?: boolean   // 같은 유형에서 혼자 3번 막힘
  mastered?: boolean
}
export interface ProgFeed {
  studentId: string; name: string; mgmtId: string | null; day: string
  start: string            // 오늘 처음 푼 시각(ISO)
  at: string               // 마지막으로 움직인 시각(ISO)
  solved: number           // 오늘 승강제에서 답한 수
  correct: number
  mastered: number         // 오늘 정복한 유형 수
  now: ProgNow
  recent: [string, 0 | 1, number][]   // 최근 답 [시각, 맞음, 층] — 12개
  // 📊 과목별 오늘 (2026-10-22 명수쌤 «학습한 문제 중 몇 개 맞고 틀렸는지 과목별 현황도 학부모 보고에»)
  //   n 푼 수 · ok 맞힌 수 · m 정복 유형 · w 틀린 유형(최근 5개, 겹침 없이)
  subj?: Record<string, { n: number; ok: number; m: number; w: string[] }>
  sheets?: [string, number, number, string][]   // 오늘 제출한 학습지 [제목, 맞힌 수, 전체, 과목]
}

type Stu = { id: string; name?: string; mgmtId?: string }
const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const cur = new Map<string, ProgFeed>()          // 행 id → 이 기기의 최신 값
const loaded = new Map<string, Promise<void>>()
const timer = new Map<string, ReturnType<typeof setTimeout>>()
const lastPut = new Map<string, number>()
const GAP = 10_000

async function base(stu: Stu): Promise<[string, ProgFeed] | null> {
  if (!supabase || !stu.id || stu.id === 'me') return null
  const d = day(); const id = `prog_${stu.id}_${d}`
  if (!loaded.has(id)) {
    loaded.set(id, (async () => {
      try {
        const { data } = await supabase!.from('hj_settings').select('data').eq('id', id).maybeSingle()
        const v = (data as { data?: { value?: ProgFeed } } | null)?.data?.value
        if (v && !cur.has(id)) cur.set(id, v)
      } catch { /* 처음부터 센다 */ }
    })())
  }
  await loaded.get(id)
  const now = new Date().toISOString()
  const v = cur.get(id) ?? {
    studentId: stu.id, name: stu.name ?? '', mgmtId: stu.mgmtId ?? null, day: d, start: now, at: now,
    solved: 0, correct: 0, mastered: 0, now: { kind: '승강제', title: '' }, recent: [],
  }
  return [id, v]
}

function put(id: string, v: ProgFeed) {
  cur.set(id, v)
  const send = async () => {
    timer.delete(id); lastPut.set(id, Date.now())
    const x = cur.get(id)
    if (!supabase || !x) return
    try {
      await supabase.from('hj_settings').upsert({ id, data: { __id: id, value: x }, updated_at: new Date().toISOString() })
    } catch { /* 현황은 못 올려도 풀이는 계속된다 */ }
  }
  if (timer.has(id)) return                          // 이미 곧 올라갈 예정 — 그때 최신 값이 실린다
  const wait = Math.max(0, GAP - (Date.now() - (lastPut.get(id) ?? 0)))
  if (wait === 0) void send(); else timer.set(id, setTimeout(() => void send(), wait))
}

/** 승강제 — 답 하나 (맞음/틀림) 또는 유형을 연 순간(answer 없음) */
export async function noteMastery(stu: Stu, now: ProgNow, answer?: { at: string; correct: boolean; floor: number; justMastered?: boolean }) {
  const b = await base(stu); if (!b) return
  const [id, v] = b
  const t = answer?.at ?? new Date().toISOString()
  const n: ProgFeed = { ...v, name: stu.name ?? v.name, mgmtId: stu.mgmtId ?? v.mgmtId, at: t, now }
  if (answer) {
    n.solved = v.solved + 1
    n.correct = v.correct + (answer.correct ? 1 : 0)
    n.mastered = v.mastered + (answer.justMastered ? 1 : 0)
    n.recent = [...v.recent, [t, answer.correct ? 1 : 0, answer.floor] as [string, 0 | 1, number]].slice(-12)
    const k = now.subject || '수학'
    const o = v.subj?.[k] ?? { n: 0, ok: 0, m: 0, w: [] }
    const w = answer.correct || !now.title ? o.w : [...o.w.filter((x) => x !== now.title), now.title].slice(-5)
    n.subj = { ...(v.subj ?? {}), [k]: { n: o.n + 1, ok: o.ok + (answer.correct ? 1 : 0), m: o.m + (answer.justMastered ? 1 : 0), w } }
  }
  put(id, n)
}

/** 학습지 — 푸는 중(답 넣은 수) 또는 제출(점수) */
export async function noteSheet(stu: Stu, now: ProgNow) {
  const b = await base(stu); if (!b) return
  const [id, v] = b
  const n: ProgFeed = { ...v, name: stu.name ?? v.name, mgmtId: stu.mgmtId ?? v.mgmtId, at: new Date().toISOString(), now }
  if (now.score) {
    // 제출한 학습지 — 같은 학습지를 다시 내면 앞 기록을 바꾼다(과목 합계도 앞 것을 빼고 더한다)
    const k = now.subject || '수학'
    const prev = (v.sheets ?? []).find((x) => x[0] === now.title)
    const o = v.subj?.[k] ?? { n: 0, ok: 0, m: 0, w: [] }
    n.subj = { ...(v.subj ?? {}), [k]: { ...o, n: o.n - (prev?.[2] ?? 0) + now.score[1], ok: o.ok - (prev?.[1] ?? 0) + now.score[0] } }
    n.sheets = [...(v.sheets ?? []).filter((x) => x[0] !== now.title), [now.title, now.score[0], now.score[1], k] as [string, number, number, string]].slice(-10)
  }
  put(id, n)
}
