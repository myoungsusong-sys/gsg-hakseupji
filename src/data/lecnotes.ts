// 개념강의 필기노트 + 이해확인 문제 — 과정별 정적 파일(/lecnotes-<course>.json) 지연 로드
// 형식: { "<강의id>": { t: 제목, n: 노트블록[], q: 확인문제[] } }
//   노트블록 b: { t:'h'|'p'|'box'|'ex', x: 텍스트($...$는 KaTeX), s?: 풀이단계[] }
//     h=소제목 / p=본문 / box=핵심정리(강조) / ex=예제(x=문제, s=풀이 단계들)
//   확인문제 q: { q: 발문, c: 선택지[], a: 정답 index(0~), e: 해설 }
// ⚠️ 노트는 요약본이 아니다 — 강의가 다루는 개념·정의·예제·주의점을 빠짐없이 담는다(무누락 원칙).

export type NoteBlock = { t: 'h' | 'p' | 'box' | 'ex'; x: string; s?: string[] }
export type Quiz = { q: string; c: string[]; a: number; e: string }
export type LecNote = { t: string; n: NoteBlock[]; q: Quiz[] }
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
