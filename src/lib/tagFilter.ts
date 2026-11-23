// 태그 거르기 공통 — 목록은 «실제 학습지가 가진 태그»로 만들고 개수를 붙인다.
// (윤자혜 선생님 11/23: 태그 전체에만 학습지가 나오고 기본·연습문제… 를 고르면 빈 목록이던 문제)
// 같은 뜻의 태그는 하나로 묶는다: 띄어쓰기 차이('입학 TEST'/'입학TEST'), 오답·오답학습·학습지 오답.
import { TAG_FILTER_OPTIONS } from '../types'

const ALIAS: Record<string, string> = {
  '오답': '학습지 오답',
  '오답학습': '학습지 오답',
}

const noSpace = (s: string) => s.replace(/\s+/g, '')
const PRESET_BY_KEY = new Map(TAG_FILTER_OPTIONS.map(t => [noSpace(t), t]))

/** 태그 하나를 대표 이름으로 바꾼다 */
export function canonTag(t: string): string {
  const s = t.trim()
  const a = ALIAS[s] ?? s
  return PRESET_BY_KEY.get(noSpace(a)) ?? a
}

export function hasTag(tags: string[] | undefined, canon: string): boolean {
  return (tags ?? []).some(t => canonTag(t) === canon)
}

/** 학습지 목록에서 실제 쓰이는 태그와 학습지 수(한 학습지는 태그마다 1번씩 센다) */
export function tagCounts(list: { tags?: string[] }[]): { tag: string; count: number }[] {
  const m = new Map<string, number>()
  for (const w of list) {
    for (const c of new Set((w.tags ?? []).map(canonTag))) if (c) m.set(c, (m.get(c) ?? 0) + 1)
  }
  return [...m.entries()].map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'))
}
