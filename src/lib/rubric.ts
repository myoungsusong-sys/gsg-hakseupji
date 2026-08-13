import { supabase } from './supabase'
import type { Rubric } from '../types'

// ── 서술형 배점 기준표(루브릭) 저장소 ─────────────────────────────
//
// 왜 store(hj_settings 키 하나)에 넣지 않았나 — 실측으로 걸러진 결정이다.
//  · setSetting 은 **맵 전체를 매번 통째로 upsert** 한다. 루브릭은 문항 수만큼 늘어나므로
//    (서술형 후보 문항만 풀에 7만 개) 쓰기 한 번이 곧 전량 업로드가 된다.
//  · 게다가 backend.subscribe 는 어느 행이 바뀌든 loadAll() 로 hj_settings 전량을 다시 받는다.
//    학생이 서술형을 제출할 때마다 접속 중인 모든 기기가 루브릭 뭉치를 통째로 재다운로드한다.
//  · 읽기-수정-쓰기라서 두 학생이 서로 다른 문항을 동시에 채점하면 뒤에 쓴 쪽이 앞의 것을 지운다.
//
// → live.ts·replay.ts 와 같은 방식으로 **문항당 1행**(`rubric_<problemId>`)에 담는다.
//   쓰기 O(1) · 부팅 비용 0(backend.ts 의 like 필터로 제외) · 동시 충돌 0 · 건수 무제한.
//   🔴 `rubric_` 접두어를 바꾸지 마라 — backend.ts 의 부팅 로드 필터와 실시간 구독 필터가
//      이 문자열에 걸려 있다. 바꾸면 루브릭이 부팅마다 전량 로드되고 실시간 리로드 폭풍이 난다.

const LKEY = 'gsg-rubrics'                 // Supabase 없는 로컬/데모 모드 폴백
const rid = (problemId: string) => `rubric_${problemId}`

// 같은 세션에서 같은 문항을 여러 학생이 연달아 채점할 때 왕복을 없앤다
const mem = new Map<string, Rubric | null>()

function localAll(): Record<string, Rubric> {
  try { return JSON.parse(localStorage.getItem(LKEY) || '{}') } catch { return {} }
}

export async function getRubric(problemId: string): Promise<Rubric | null> {
  if (mem.has(problemId)) return mem.get(problemId)!
  let out: Rubric | null = null
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings').select('data').eq('id', rid(problemId)).maybeSingle()
      out = (data as any)?.data?.value ?? null
    } catch { out = null }
  } else {
    out = localAll()[problemId] ?? null
  }
  mem.set(problemId, out)
  return out
}

export async function putRubric(r: Rubric): Promise<void> {
  mem.set(r.id, r)
  if (supabase) {
    try {
      await supabase.from('hj_settings').upsert({
        id: rid(r.id), data: { __id: rid(r.id), value: r }, updated_at: new Date().toISOString(),
      })
    } catch { /* 네트워크 오류 — 채점은 이미 끝났다. 다음 학생 때 다시 만들면 된다 */ }
  } else {
    try { const all = localAll(); all[r.id] = r; localStorage.setItem(LKEY, JSON.stringify(all)) } catch { /* 쿼터 등 무시 */ }
  }
}

// 기준이 나쁠 때 그 문항만 지우면 다음 채점에서 새로 만들어진다 (다른 문항에 영향 0)
export async function dropRubric(problemId: string): Promise<void> {
  mem.delete(problemId)
  if (supabase) {
    try { await supabase.from('hj_settings').delete().eq('id', rid(problemId)) } catch { /* 무시 */ }
  } else {
    try { const all = localAll(); delete all[problemId]; localStorage.setItem(LKEY, JSON.stringify(all)) } catch { /* 무시 */ }
  }
}
