// 🎬 풀이 과정 자동 녹화 — 학생이 학습지를 푸는 동안 필기·답 입력·문제 이동을 시간과 함께 기록해
// 서버(hj_settings id=`replay_*`)에 올리고, 선생님이 [실시간 풀이 > 풀이 다시보기]에서 영상처럼 재생한다.
// 아이패드 사파리는 웹앱 화면녹화(getDisplayMedia)를 지원하지 않아 이벤트 기록→재생 방식으로 구현
// (허락 팝업 없이 전자동, 용량도 영상의 1/100 수준). Supabase 없으면 localStorage 폴백(같은 브라우저 데모용).
//
// 설계 규칙 (2026-08-02 멀티에이전트 리뷰 반영):
// · 행 id는 세션별(`…__{startedAt}`) — 새로고침·재입장이 이전 녹화(제출 완료 포함)를 덮어쓰지 않는다.
// · pushReplay는 성공 여부를 반환 — 호출부(20초 flush)가 실패 시 dirty를 복원해 재시도한다.
//   (supabase-js는 쿼리 오류를 throw하지 않고 {error}로 반환하므로 반드시 검사해야 한다)
// · 목록은 메타만 JSON-path 프로젝션으로 내려받는다 — events는 세션당 수백 KB라 ▶재생 시 1건만 fetch.
// · 보존 정책: 목록 조회 때 30일 경과·학습지당 최근 3개 초과 행을 지연 삭제해 무한 증식을 막는다.
import { supabase } from './supabase'

export interface ReplayStroke { color: string; size: number; erase?: boolean; pts: [number, number][] }

export interface ReplayEvent {
  t: number                        // 세션 시작부터 경과 ms
  q: number                        // 문항 인덱스(0부터)
  type: 'stroke' | 'set' | 'nav' | 'answer'
  stroke?: ReplayStroke            // stroke: 추가된 획
  strokes?: ReplayStroke[]         // set: 되돌리기·다시하기·전체지우기 후의 전체 획 상태
  v?: string                       // answer: 입력값('모름'·'SELF:○' 센티널 포함)
}

export interface ReplaySession {
  studentId: string
  name: string
  wsId: string
  title: string
  startedAt: number                // epoch ms — 세션 키(행 id에 포함)
  events: ReplayEvent[]
  done?: boolean                   // 제출 완료
  cut?: boolean                    // 이벤트 수·용량 한도 초과로 기록 중단됨
  dur?: number                     // 마지막 이벤트 t(ms) — 목록 메타 (pushReplay가 채움)
  n?: number                       // 이벤트 수 — 목록 메타 (pushReplay가 채움)
}

// 목록 표시용 메타 (events 없이)
export interface ReplayMeta {
  id: string; wsId: string; title: string; startedAt: number; done: boolean; dur: number
}

const rid = (s: ReplaySession) => `replay_${s.studentId}__${s.wsId}__${s.startedAt}`
const LKEY = 'gsg-replays'
const KEEP_PER_WS = 3                          // 학습지당 보관 세션 수
const TTL_MS = 30 * 24 * 3600 * 1000           // 30일 지나면 삭제

export async function pushReplay(s: ReplaySession): Promise<boolean> {
  s.dur = s.events[s.events.length - 1]?.t ?? 0
  s.n = s.events.length
  const id = rid(s)
  if (supabase) {
    try {
      const { error } = await supabase.from('hj_settings').upsert({
        id, data: { __id: id, value: s }, updated_at: new Date().toISOString(),
      })
      return !error
    } catch { return false }
  }
  try { const all = JSON.parse(localStorage.getItem(LKEY) || '{}'); all[id] = s; localStorage.setItem(LKEY, JSON.stringify(all)); return true } catch { return false }
}

// 최신순 정렬된 목록에서 보존 대상/삭제 대상 분리
function splitKeep(list: ReplayMeta[]): { keep: ReplayMeta[]; drop: ReplayMeta[] } {
  const now = Date.now()
  const perWs = new Map<string, number>()
  const keep: ReplayMeta[] = [], drop: ReplayMeta[] = []
  for (const m of list) {
    const cnt = perWs.get(m.wsId) ?? 0
    if (now - m.startedAt > TTL_MS || cnt >= KEEP_PER_WS) drop.push(m)
    else { keep.push(m); perWs.set(m.wsId, cnt + 1) }
  }
  return { keep, drop }
}

// 선생님: 한 학생의 녹화 목록 — 메타만 조회 (LIKE의 '_'는 임의 1글자 매칭이라
// 과매칭 가능성이 있어 studentId 정확 일치를 응답에서 한 번 더 거른다)
export async function fetchReplayList(studentId: string): Promise<ReplayMeta[]> {
  let list: ReplayMeta[] = []
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings')
        .select('id, sid:data->value->>studentId, wsId:data->value->>wsId, title:data->value->>title, startedAt:data->value->>startedAt, done:data->value->>done, dur:data->value->>dur')
        .like('id', `replay_${studentId}__%`)
      list = (data ?? [])
        .filter((r: any) => r.sid === studentId && r.startedAt)
        .map((r: any) => ({
          id: String(r.id), wsId: String(r.wsId ?? ''), title: String(r.title ?? ''),
          startedAt: Number(r.startedAt), done: r.done === 'true', dur: Number(r.dur ?? 0),
        }))
        .sort((a, b) => b.startedAt - a.startedAt)
      const { keep, drop } = splitKeep(list)
      if (drop.length) {
        // 지연 청소 — 실패해도 무해(다음 조회 때 다시 시도)
        void supabase.from('hj_settings').delete().in('id', drop.map(d => d.id)).then(() => {}, () => {})
      }
      return keep
    } catch { return [] }
  }
  try {
    const all = JSON.parse(localStorage.getItem(LKEY) || '{}') as Record<string, ReplaySession>
    list = Object.entries(all)
      .filter(([k, v]) => k.startsWith(`replay_${studentId}__`) && v.studentId === studentId && (v.events?.length ?? 0) > 0)
      .map(([k, v]) => ({ id: k, wsId: v.wsId, title: v.title, startedAt: v.startedAt, done: !!v.done, dur: v.dur ?? (v.events[v.events.length - 1]?.t ?? 0) }))
      .sort((a, b) => b.startedAt - a.startedAt)
    return splitKeep(list).keep
  } catch { return [] }
}

// ▶ 재생 시 그 세션 1건만 통째로 가져온다
export async function fetchReplay(id: string): Promise<ReplaySession | null> {
  if (supabase) {
    try {
      const { data } = await supabase.from('hj_settings').select('data').eq('id', id).maybeSingle()
      return (data as any)?.data?.value ?? null
    } catch { return null }
  }
  try { return JSON.parse(localStorage.getItem(LKEY) || '{}')[id] ?? null } catch { return null }
}
