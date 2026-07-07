import type { WBItem } from '../types'
export { WB_MATCH_BOOKS } from './wbMatchIndex'
export type { WbMatchBook } from './wbMatchIndex'

// 시중교재 문항 매칭: [원문항번호, 쪽, conceptId, 난이도(1~5)]
type RawItem = [string, number, string, number]
type MatchData = Record<string, RawItem[]>

let cache: MatchData | null = null
let inflight: Promise<MatchData> | null = null

// /public/wb-match-m1-1.json 을 한 번만 받아 캐시. (22개정 중1-1 89종·8.4만 문항)
export async function loadWbMatch(): Promise<MatchData> {
  if (cache) return cache
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}wb-match-m1-1.json`)
      .then(r => { if (!r.ok) throw new Error('wb-match load ' + r.status); return r.json() })
      .then((d: MatchData) => { cache = d; return d })
      .catch(err => { inflight = null; throw err })
  }
  return inflight
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
