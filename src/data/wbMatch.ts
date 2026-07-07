import type { WBItem } from '../types'
export { WB_MATCH_BOOKS } from './wbMatchIndex'
export type { WbMatchBook } from './wbMatchIndex'
import { WB_MATCH_BOOKS } from './wbMatchIndex'

// 시중교재 문항 매칭: [원문항번호, 쪽, conceptId(유형), 난이도(1~5)]
type RawItem = [string, number, string, number]
export type MatchData = Record<string, RawItem[]>

// 과정 라벨('중1-1'·'공통수학1'…) → 파일키('m1-1'·'h-cm1'…)
const COURSE_OF_GRADE = new Map(WB_MATCH_BOOKS.map(b => [b.grade, b.course]))
export function courseOfGrade(grade: string): string | undefined {
  return COURSE_OF_GRADE.get(grade)
}

const cache = new Map<string, MatchData>()
const inflight = new Map<string, Promise<MatchData>>()

// /public/wb-match-<course>.json 을 과정 단위로 받아 캐시 (과정당 0.1~1.8MB)
export function loadWbMatch(course: string): Promise<MatchData> {
  const hit = cache.get(course)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(course)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}wb-match-${course}.json`)
      .then(r => { if (!r.ok) throw new Error('wb-match ' + course + ' ' + r.status); return r.json() })
      .then((d: MatchData) => { cache.set(course, d); return d })
      .catch(err => { inflight.delete(course); throw err })
    inflight.set(course, p)
  }
  return p
}

// 매칭 교재 → 문항(WBItem) 파생. id는 workbookId 기준 결정적 → 채점 결과가 재로드/기기 전환에도 유지됨.
export function deriveWBItems(workbookId: string, matchKey: string, data: MatchData): WBItem[] {
  const raw = data[matchKey]
  if (!raw) return []
  return raw.map(([label, page, cid, lv], i) => ({
    id: `${workbookId}#${i}`,
    workbookId,
    page,
    no: i + 1,
    label,
    typeId: cid,
    kind: '주관식',
    answer: '',
    diff: (lv >= 1 && lv <= 5 ? lv : 3) as WBItem['diff'],
  }))
}
