import type { Problem, Diff } from '../types'
import { CURRICULA, curriculumFor, type Curriculum, type BigUnit, type MidUnit } from '../data/curriculum'
import { POOL_COURSES } from '../data/pool'

/**
 * 🏫 내신 대비 세트 — 매쓰플랫 「내신관」과 같은 목록을 우리 문제 풀로 만든다 (2026-09-04 명수쌤 지시)
 *
 * 매쓰플랫 내신관은 세 가지를 판다: ① 학교별 기출 ② 교과서 종별 대비 ③ 유형 기반 추천.
 * 우리는 ①②의 원본(학교 기출지·교과서 문항)이 없다 — 저작권 자료라 수록 못 한다.
 * 대신 **교육과정 단원 트리 + 자체 문제 풀**로 같은 모양의 목록을 만든다:
 *   · 「내신 대비 교과서」 탭 = **대단원(교과서 단원) 단위** 세트 — 시험 범위가 "3단원까지"로 오니까
 *   · 「내신 대비 추천」 탭  = **중단원(유형) 단위** 세트 × 난이도 3종 — 매쓰플랫 추천 목록과 같은 알갱이
 *
 * 세트는 미리 저장해 두지 않는다. 목록은 매번 계산하고, [출제하기]를 누르는 순간에만 학습지로 굳힌다
 * (매쓰플랫도 그렇다 — 목록에 있는 건 "만들 수 있는 것"이지 "만들어 둔 것"이 아니다).
 */

export type NaesinLevel = '기초' | '실전' | '고난도'

export interface NaesinSet {
  key: string                 // 안정적인 식별자 (course|unit|mid|level)
  courseId: string
  grade: string               // '중1-1' · '고1' …
  courseLabel: string         // '중학교 1학년 1학기 (22개정)'
  unitName: string            // 대단원 — 표의 파란 부제
  midName?: string            // 중단원 — 추천 탭에서만
  title: string               // '내신대비 | [중1-1] 01 소인수분해 (실전)'
  level: NaesinLevel
  diffLabel: string           // 표의 「난이도」 칸 — 중하 / 중 / 중상
  typeIds: string[]           // 이 세트가 덮는 유형
  count: number               // 목표 문항 수
}

/** 난이도 배합 — 매쓰플랫 추천 목록의 「중하 / 중 / 중상」 3단과 같은 뜻 */
const LEVEL_MIX: Record<NaesinLevel, { diffs: Diff[]; label: string; count: number }> = {
  기초:  { diffs: [1, 2, 2, 3],    label: '중하', count: 20 },
  실전:  { diffs: [2, 3, 3, 4],    label: '중',   count: 25 },
  고난도: { diffs: [3, 4, 4, 5],   label: '중상', count: 20 },
}
export const LEVELS: NaesinLevel[] = ['기초', '실전', '고난도']

/** 내신 대비를 만들 수 있는 과정 — 풀이 있고 교육과정 트리가 진짜로 있는 것만 (폴백 트리에 걸리면 엉뚱한 단원이 붙는다) */
export function naesinCourses(): Curriculum[] {
  return (POOL_COURSES as readonly string[])
    .filter((id) => CURRICULA.some((c) => c.id === id))
    .map((id) => curriculumFor(id))
    .filter((c) => !c.subject || c.subject === '수학')       // 내신관은 수학 — 과학은 별도
}

const zero2 = (n: number) => String(n).padStart(2, '0')
const bracket = (grade: string) => `[${grade.replace(/^(중|고)(\d)-(\d)$/, '$1$2-$3')}]`

function typesOfMid(m: MidUnit): string[] { return m.subs.flatMap((s) => s.types.map((t) => t.id)) }
function typesOfUnit(u: BigUnit): string[] { return u.mids.flatMap(typesOfMid) }

/** 「내신 대비 교과서」 — 대단원 단위. 시험 범위 단위로 뽑는다 */
export function textbookSets(cur: Curriculum): NaesinSet[] {
  return cur.units.flatMap((u, ui) =>
    LEVELS.map((level) => ({
      key: `${cur.id}|${u.id}|*|${level}`,
      courseId: cur.id, grade: cur.grade, courseLabel: cur.label,
      unitName: u.name, level,
      title: `내신대비 | ${bracket(cur.grade)} ${zero2(ui + 1)} ${u.name} (${level})`,
      diffLabel: LEVEL_MIX[level].label,
      typeIds: typesOfUnit(u),
      count: LEVEL_MIX[level].count,
    })),
  )
}

/** 「내신 대비 추천」 — 중단원(유형 묶음) 단위 × 난이도 3종 */
export function recommendSets(cur: Curriculum): NaesinSet[] {
  const out: NaesinSet[] = []
  cur.units.forEach((u, ui) => {
    u.mids.forEach((m, mi) => {
      LEVELS.forEach((level) => {
        out.push({
          key: `${cur.id}|${u.id}|${m.id}|${level}`,
          courseId: cur.id, grade: cur.grade, courseLabel: cur.label,
          unitName: u.name, midName: m.name, level,
          title: `내신대비 | ${bracket(cur.grade)} ${zero2(ui + 1)}-${mi + 1} ${m.name} (${level})`,
          diffLabel: LEVEL_MIX[level].label,
          typeIds: typesOfMid(m),
          count: LEVEL_MIX[level].count,
        })
      })
    })
  })
  return out
}

/**
 * 세트 → 실제 문항 고르기.
 *  · 유형을 고르게 돈다 (한 유형에 몰리지 않게)
 *  · 같은 쌍둥이 그룹(숫자만 다른 문제)은 한 세트에 하나만
 *  · 난이도는 LEVEL_MIX 순환 — 없으면 이웃 난이도로 대체, 그래도 없으면 건너뛴다
 * 풀에 문항이 부족하면 목표보다 적게 돌려준다 — 억지로 채우지 않는다 (표에 실제 수를 보여준다).
 */
export function pickNaesinProblems(set: NaesinSet, pool: Problem[]): Problem[] {
  const byType = new Map<string, Problem[]>()
  for (const p of pool) {
    if (!set.typeIds.includes(p.typeId)) continue
    if (!byType.has(p.typeId)) byType.set(p.typeId, [])
    byType.get(p.typeId)!.push(p)
  }
  const types = set.typeIds.filter((t) => (byType.get(t)?.length ?? 0) > 0)
  if (!types.length) return []

  const picked: Problem[] = []
  const usedIds = new Set<string>()
  const usedTwins = new Set<string>()
  const mix = LEVEL_MIX[set.level].diffs

  const take = (typeId: string, want: Diff): boolean => {
    const cands = byType.get(typeId) ?? []
    // 원하는 난이도 → ±1 → 아무거나 순으로 찾되, 이미 쓴 문제·같은 쌍둥이는 뺀다
    const order = [want, (want - 1) as Diff, (want + 1) as Diff, 1, 2, 3, 4, 5] as Diff[]
    for (const d of order) {
      const p = cands.find((c) => c.diff === d && !usedIds.has(c.id) && !(c.twinGroup && usedTwins.has(c.twinGroup)))
      if (p) {
        picked.push(p); usedIds.add(p.id); if (p.twinGroup) usedTwins.add(p.twinGroup)
        return true
      }
    }
    return false
  }

  // 유형을 순환하며 하나씩 — 목표 수에 닿거나, 한 바퀴 내내 아무것도 못 집으면 끝
  let i = 0, dry = 0
  while (picked.length < set.count && dry < types.length) {
    const ok = take(types[i % types.length], mix[i % mix.length])
    dry = ok ? 0 : dry + 1
    i++
  }
  return picked
}

/** 세트가 덮는 유형 중 풀에 문항이 있는 유형 수 / 후보 문항 수 — 표에 "만들 수 있나"를 보여주려고 */
export function poolCoverage(set: NaesinSet, pool: Problem[]): { types: number; problems: number } {
  const ids = new Set(set.typeIds)
  const hit = pool.filter((p) => ids.has(p.typeId))
  return { types: new Set(hit.map((p) => p.typeId)).size, problems: hit.length }
}
