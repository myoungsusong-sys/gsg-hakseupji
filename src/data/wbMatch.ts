import type { WBItem } from '../types'
export { WB_MATCH_BOOKS } from './wbMatchIndex'
export type { WbMatchBook } from './wbMatchIndex'
import { WB_MATCH_BOOKS } from './wbMatchIndex'

// 시중교재 문항 매칭: [원문항번호, 쪽, conceptId(유형), 난이도(1~5), 정답, 형태('C'=객관식/'S'=주관식)]
type RawItem = [string, number, string, number, string?, string?]
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
// 정답·형태는 매쓰플랫 교재 API에서 수집(2026-07-07, 667,610문항 100%) — 채점판에 번호+정답 자동 표시용.
// 🔴 객관식으로 표시돼 있어도 **①~⑤ 로는 낼 수 없는 답**이면 주관식으로 되돌린다.
//
// 정답표를 만들 때 형태를 "정답이 숫자뿐이면 객관식"이라는 규칙으로 붙였는데, 정답이 `8`·`17`·`0`
// 같은 단답 주관식이 전부 객관식으로 들어갔다. 학생 화면은 객관식이면 **①~⑤ 버튼만** 주므로
// 그런 문항은 **정답을 입력할 방법 자체가 없어** 무조건 오답이 됐다.
// (원본 대조로 확인 — 중3-1 한 학기에서만 2,457문항. 2026-07-31)
//
// 5지선다의 답은 원문자이거나 1~5 뿐이다. 그 밖이면 객관식일 수 없다.
const CHOICE_OK = /^[①-⑮]$/
function realKind(kd: string | undefined, ans: string): '객관식' | '주관식' {
  if (kd !== 'C') return '주관식'
  const parts = String(ans ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!parts.length) return '객관식'
  return parts.every(p => CHOICE_OK.test(p) || /^[1-5]$/.test(p)) ? '객관식' : '주관식'
}

export function deriveWBItems(workbookId: string, matchKey: string, data: MatchData): WBItem[] {
  const raw = data[matchKey]
  if (!raw) return []
  return raw.map(([label, page, cid, lv, ans, kd], i) => ({
    id: `${workbookId}#${i}`,
    workbookId,
    page,
    no: i + 1,
    label,
    typeId: String(cid),   // 풀 typeId가 문자열이라 conceptId도 문자열로 통일(교과서 원본은 정수일 수 있음)
    kind: realKind(kd, ans ?? ''),
    answer: ans ?? '',
    diff: (lv >= 1 && lv <= 5 ? lv : 3) as WBItem['diff'],
  }))
}
