// 개념강의 요약 정리노트(여고생 스타일) + 이해확인 — 과정별 정적 파일(/lecnotes-<course>.json) 지연 로드
// 형식: { "<강의id>": { t, intro?, sec[], memo[], q[] } }
//   intro : 이 강의에서 뭘 배우는지 한 줄
//   sec   : 요약 섹션 { h: 이모지 소제목, pts: 핵심 요점[], tip?: 꿀팁/주의 }
//           요점 텍스트 안에서 ==형광펜== 강조, $...$ KaTeX 수식
//   memo  : 시험 전 외워야 할 개념·공식 카드 { k: 이름, v: 내용/공식 }
//   q     : 이해확인 객관식 { q, c[], a(정답 index), e(해설) }
// ⚠️ 요약이지만 시험에 나오는 개념·공식·유형은 빠뜨리지 않는다. 공식·수식은 원본과 정확히 일치.

export type Quiz = { q: string; c: string[]; a: number; e: string }
export type NoteSec = { h: string; pts: string[]; tip?: string }
export type Memo = { k: string; v: string }
export type LecNote = { t: string; intro?: string; sec: NoteSec[]; memo: Memo[]; q: Quiz[] }
export type LecNoteMap = Record<string, LecNote>

const cache = new Map<string, LecNoteMap>()
const inflight = new Map<string, Promise<LecNoteMap>>()

export function loadLecNotes(course: string): Promise<LecNoteMap> {
  const hit = cache.get(course)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(course)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}lecnotes-${course}.json`)
      .then(r => (r.ok ? r.json() : {}))
      .then((d: LecNoteMap) => { const m = d && typeof d === 'object' ? d : {}; cache.set(course, m); return m })
      .catch(() => { inflight.delete(course); return {} as LecNoteMap })
    inflight.set(course, p)
  }
  return p
}
