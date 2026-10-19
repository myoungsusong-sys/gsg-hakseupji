// 🆘 틀린 문제 → 선생님앱 (2026-10-19 명수쌤 "학생이 틀린문제를 선생님한테도 뜨게해서 선생님이 학생을 불러서 설명")
//
// 승강제에서 학생이 틀릴 때마다 «오늘 틀린 문제» 작은 행을 학생·날짜별로 하나 갱신한다.
//   hj_settings id = `wrong_<학습지앱 학생id>_<yyyy-mm-dd>`  value = { studentId, name, mgmtId, day, entries[] }
// 선생님앱(학원관리앱)은 이 작은 행들만 읽는다 — 거대한 masteries 행을 30초마다 받으면 egress 가 터진다(9/2 실사고).
// 한 학생 행은 그 학생 기기만 쓰므로 덮어써도 서로 지우지 않는다. 하루 최근 60건만 남긴다.
// 이 행들은 학습지앱이 설정을 읽어 올 때 빠진다(backend.ts SKIP_SETTING · not like 'wrong_%').

import { supabase } from './supabase'

export interface WrongEntry {
  at: string            // ISO
  course: string
  typeId: string
  typeName: string
  floor: number         // 0 개념 · 1 기본 · 2 표준 · 3 심화 · 4 최상
  problemId: string
  imageUrl?: string     // 수학 — 문제 그림
  body?: string         // 글 문제 — 지문(앞 800자)
  choices?: string[]
  answer?: string       // 정답 (선생님 확인용)
  needsTeacher?: boolean // 같은 유형에서 혼자 3번 막힘
}

const mine = new Map<string, WrongEntry[]>()
const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export async function pushWrong(stu: { id: string; name?: string; mgmtId?: string }, e: WrongEntry): Promise<void> {
  if (!supabase || !stu.id || stu.id === 'me') return
  const d = day()
  const id = `wrong_${stu.id}_${d}`
  try {
    let list = mine.get(id)
    if (!list) {
      const { data } = await supabase.from('hj_settings').select('data').eq('id', id).maybeSingle()
      list = ((data as { data?: { value?: { entries?: WrongEntry[] } } } | null)?.data?.value?.entries) ?? []
    }
    list = [...list, e].slice(-60)
    mine.set(id, list)
    await supabase.from('hj_settings').upsert({
      id, data: { __id: id, value: { studentId: stu.id, name: stu.name ?? '', mgmtId: stu.mgmtId ?? null, day: d, entries: list } },
      updated_at: new Date().toISOString(),
    })
  } catch { /* 피드는 못 올려도 풀이는 계속된다 */ }
}
