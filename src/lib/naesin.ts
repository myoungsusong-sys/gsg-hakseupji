import type { Problem, Diff } from '../types'
import { CURRICULA, curriculumFor, type Curriculum, type BigUnit, type MidUnit } from '../data/curriculum'
import { POOL_COURSES } from '../data/pool'

/**
 * 🏫 내신 대비 세트 — 매쓰플랫 「내신관」과 **같은 목록·같은 문구**를 우리 문제 풀로 만든다
 *   (2026-09-04 명수쌤 "매쓰플랫과 동일하게 만들어줘" — 두 번 강조)
 *
 * 원본 실측(teacher.mathflat.com/lesson-preparation/school-exam, 2026-09-04):
 *   탭2 「내신 대비 교과서」 — 학년 필터 19개(중1(22개정)…기하) + 출판사 10개, 표 칸 선택·학년·출판사·학습지명·문제수·미리보기·수정·출제
 *        제목 `내신대비 | [중1-1] 수와 연산-교학사1` · 부제 `(교과서 - 교학사) p.24~26 도담도담 생각 다지기` · 문제수 29
 *   탭3 「내신 대비 추천」 — 학년 필터 18개(전체·중1…기하), 표 칸 선택·학년·학습지명·문제수·난이도·미리보기·수정·출제
 *        제목 `내신대비 | [중1-1] 01 소인수분해1` / `…2` / `…3(고난도)` · 「자동 채점」 뱃지 · 부제 중단원명 · 25문제 · 난이도 중/중/중상
 *
 * 우리가 못 갖춘 것 하나 — **교과서(출판사별) 문항 원본**. 저작권 자료라 수록하지 않는다.
 * 그래서 탭2의 세트는 출판사 대신 「공통」으로 달고, 대단원(시험 범위) 단위로 1·2·3번을 만든다
 * (원본의 -교학사1·2 = 단원 중간 정리, -교학사3 = 단원 매듭짓기 → 우리도 1·2 = 기초·실전, 3 = 고난도).
 * 출판사를 고르면 표는 비고 "준비 중"이라고 말한다 — 있는 척하지 않는다.
 *
 * 세트는 미리 저장하지 않는다. 목록은 매번 계산하고, [출제하기]를 누를 때만 학습지로 굳힌다(원본도 그렇다).
 */

export type NaesinLevel = '기초' | '실전' | '고난도'
export const LEVELS: NaesinLevel[] = ['기초', '실전', '고난도']

export interface NaesinSet {
  key: string
  courseId: string
  grade: string               // 표의 「학년」 칸 윗줄 — '중1' · '고1' (원본과 같은 형식)
  revision: string            // 아랫줄 — '(22개정)' · '(15개정)'
  semester: string            // 괄호 학기 표기 — '중1-1' · '고1'
  unitName: string
  midName?: string
  title: string               // 원본 형식 그대로
  subtitle: string            // 원본의 파란 부제 자리
  publisher: string           // 탭2 「출판사」 칸 — 우리는 '공통'
  level: NaesinLevel
  diffLabel: string           // 탭3 「난이도」 — 중 / 중 / 중상 (원본과 같음)
  typeIds: string[]
  count: number               // 원본과 같이 25
}

// ── 원본 필터 문구 그대로 ────────────────────────────────────────────────────
/** 탭2 학년 필터 19개 — 원본 순서·문구 그대로. 우리 과정으로 이어지는 것만 courses 가 채워진다 */
export const TEXTBOOK_GRADE_FILTERS: { label: string; courses: string[] }[] = [
  { label: '중1(22개정)', courses: ['m1-1', 'm1-2'] },
  { label: '중1', courses: [] },
  { label: '중2(22개정)', courses: ['m2-1', 'm2-2'] },
  { label: '중2', courses: [] },
  { label: '중3', courses: ['m3-1', 'm3-2', 'm3-2-2015'] },
  { label: '공통수학1', courses: ['h-cm1'] },
  { label: '수학(상)', courses: ['h-hs1'] },
  { label: '공통수학2', courses: ['h-cm2'] },
  { label: '수학(하)', courses: ['h-hs2'] },
  { label: '대수', courses: ['h-alg'] },
  { label: '수학 I', courses: ['h-s1'] },
  { label: '미적분1', courses: ['h-calc1'] },
  { label: '수학 II', courses: ['h-s2'] },
  { label: '확통(22개정)', courses: ['h-stat'] },
  { label: '확통', courses: [] },
  { label: '미적분2(22개정)', courses: ['h-calc2'] },
  { label: '미적분', courses: ['h-calc15'] },
  { label: '기하(22개정)', courses: ['h-geo'] },
  { label: '기하', courses: [] },
]
/** 탭3 학년 필터 — 원본은 「전체」로 시작하고 22개정 중복 칩이 없다 */
export const RECOMMEND_GRADE_FILTERS: { label: string; courses: string[] }[] = [
  { label: '전체', courses: [] },
  { label: '중1', courses: ['m1-1', 'm1-2'] },
  { label: '중2', courses: ['m2-1', 'm2-2'] },
  { label: '중3', courses: ['m3-1', 'm3-2', 'm3-2-2015'] },
  { label: '공통수학1', courses: ['h-cm1'] },
  { label: '수학(상)', courses: ['h-hs1'] },
  { label: '공통수학2', courses: ['h-cm2'] },
  { label: '수학(하)', courses: ['h-hs2'] },
  { label: '대수', courses: ['h-alg'] },
  { label: '수학 I', courses: ['h-s1'] },
  { label: '미적분1', courses: ['h-calc1'] },
  { label: '수학 II', courses: ['h-s2'] },
  { label: '확통(22개정)', courses: ['h-stat'] },
  { label: '확통', courses: [] },
  { label: '미적분2(22개정)', courses: ['h-calc2'] },
  { label: '미적분', courses: ['h-calc15'] },
  { label: '기하(22개정)', courses: ['h-geo'] },
  { label: '기하', courses: [] },
]
/** 탭2 출판사 필터 — 원본 그대로. 「전체」 외에는 우리 문항이 없다 */
export const PUBLISHERS = ['전체', '교학사', '능률', '동아', '미래엔', '비상', '와이비엠', '지학사', '천재(김화경)', '천재(김동재)'] as const
export const OUR_PUBLISHER = '공통'

/** 풀이 있고 교육과정 트리가 진짜로 있는 과정만 (폴백 트리에 걸리면 엉뚱한 단원이 붙는다) */
export function hasNaesin(courseId: string): boolean {
  return (POOL_COURSES as readonly string[]).includes(courseId) && CURRICULA.some((c) => c.id === courseId)
}
/** 이 필터 칩으로 실제 세트를 만들 수 있나 (설정된 과정 수가 아니라 풀+교육과정이 진짜 있는 과정 수) */
export function filterUsable(f: { label: string; courses: string[] }): boolean {
  return f.label === '전체' || naesinCurricula(f.courses).length > 0
}
export function naesinCurricula(courseIds: string[]): Curriculum[] {
  return courseIds.filter(hasNaesin).map(curriculumFor).filter((c) => !c.subject || c.subject === '수학')
}

// ── 세트 만들기 ─────────────────────────────────────────────────────────────
const zero2 = (n: number) => String(n).padStart(2, '0')
const revisionOf = (label: string) => (label.match(/\((\d+)개정\)/)?.[1] ?? '22') + '개정'
/** '중1-1' → '중1', '고1' → '고1' (표의 학년 칸) */
const gradeOnly = (g: string) => g.replace(/^(중|고)(\d)-\d$/, '$1$2')
/** 제목의 [학기] 표기 — 22개정은 그대로, 아니면 개정을 붙여 같은 이름의 세트가 두 줄 생기지 않게 (중3-2 vs 중3-2(15개정)) */
const semesterTag = (cur: Curriculum) => {
  const rev = revisionOf(cur.label)
  return rev === '22개정' ? cur.grade : `${cur.grade}(${rev.replace('2015', '15')})`
}

/** 원본의 -교학사1 / -교학사2 / -교학사3 과 같은 꼬리표 */
const LEVEL_NO: Record<NaesinLevel, string> = { 기초: '1', 실전: '2', 고난도: '3(고난도)' }
/** 원본 추천 목록의 난이도 칸 — 1·2번은 「중」, 3번은 「중상」 */
const LEVEL_DIFF: Record<NaesinLevel, string> = { 기초: '중', 실전: '중', 고난도: '중상' }
const LEVEL_MIX: Record<NaesinLevel, Diff[]> = { 기초: [1, 2, 2, 3], 실전: [2, 3, 3, 4], 고난도: [3, 4, 4, 5] }
const COUNT = 25

function typesOfMid(m: MidUnit): string[] { return m.subs.flatMap((s) => s.types.map((t) => t.id)) }
function typesOfUnit(u: BigUnit): string[] { return u.mids.flatMap(typesOfMid) }

/** 탭2 「내신 대비 교과서」 — 대단원 × 1·2·3번. 제목 `[중1-1] 수와 연산-공통1` */
export function textbookSets(cur: Curriculum): NaesinSet[] {
  return cur.units.flatMap((u, ui) =>
    LEVELS.map((level) => ({
      key: `${cur.id}|${u.id}|*|${level}`,
      courseId: cur.id, grade: gradeOnly(cur.grade), revision: `(${revisionOf(cur.label)})`, semester: cur.grade,
      unitName: u.name, level,
      title: `내신대비 | [${semesterTag(cur)}] ${u.name}-${OUR_PUBLISHER}${LEVEL_NO[level]}`,
      subtitle: `(단원 정리 - ${OUR_PUBLISHER}) ${zero2(ui + 1)} ${u.name} ${level === '고난도' ? '단원 매듭짓기' : '생각 다지기'}`,
      publisher: OUR_PUBLISHER,
      diffLabel: LEVEL_DIFF[level],
      typeIds: typesOfUnit(u),
      count: COUNT,
    })),
  )
}

/** 탭3 「내신 대비 추천」 — 중단원 × 1·2·3(고난도). 제목 `[중1-1] 01 소인수분해1` */
export function recommendSets(cur: Curriculum): NaesinSet[] {
  const out: NaesinSet[] = []
  let n = 0
  cur.units.forEach((u) => {
    u.mids.forEach((m) => {
      n += 1
      LEVELS.forEach((level) => {
        out.push({
          key: `${cur.id}|${u.id}|${m.id}|${level}`,
          courseId: cur.id, grade: gradeOnly(cur.grade), revision: `(${revisionOf(cur.label)})`, semester: cur.grade,
          unitName: u.name, midName: m.name, level,
          title: `내신대비 | [${semesterTag(cur)}] ${zero2(n)} ${m.name}${LEVEL_NO[level]}`,
          subtitle: m.name,
          publisher: OUR_PUBLISHER,
          diffLabel: LEVEL_DIFF[level],
          typeIds: typesOfMid(m),
          count: COUNT,
        })
      })
    })
  })
  return out
}

/**
 * 세트 → 실제 문항.
 *  · 유형을 고르게 돈다 · 같은 쌍둥이 그룹은 한 세트에 하나만 · 난이도는 LEVEL_MIX 순환(없으면 이웃 난이도)
 * 풀이 모자라면 목표보다 적게 돌려준다 — 억지로 채우지 않고 표에 실제 수를 보여준다.
 */
/**
 * 풀을 유형별로 한 번만 색인한다 — 세트마다 전체 풀(수만 문항)을 훑으면 화면이 멈춘다
 * (2026-09-04 「전체」 필터에서 세트 1,300여 개 × 풀 수만 건 = 렌더러가 30초 넘게 얼어붙었다)
 */
export type PoolIndex = Map<string, Problem[]>
export function indexPool(pool: Problem[]): PoolIndex {
  const m: PoolIndex = new Map()
  for (const p of pool) { const a = m.get(p.typeId); if (a) a.push(p); else m.set(p.typeId, [p]) }
  return m
}

export function pickNaesinProblems(set: NaesinSet, poolOrIndex: Problem[] | PoolIndex, exclude: Set<string> = new Set()): Problem[] {
  const byType = poolOrIndex instanceof Map ? poolOrIndex : indexPool(poolOrIndex)
  const types = set.typeIds.filter((t) => (byType.get(t)?.length ?? 0) > 0)
  if (!types.length) return []

  const picked: Problem[] = []
  const usedIds = new Set<string>(exclude)      // 앞 세트(1번→2번→3번)에서 쓴 문항은 다시 안 집는다
  const usedTwins = new Set<string>()
  const mix = LEVEL_MIX[set.level]
  const cursor = new Map<string, number>()      // 유형별 난이도 커서 — 유형 수가 4의 배수여도 난이도가 고루 돈다

  const take = (typeId: string, wide: boolean): boolean => {
    const cands = byType.get(typeId) ?? []
    const k = cursor.get(typeId) ?? 0
    const want = mix[k % mix.length]
    // 1차는 목표·이웃 난이도까지만. 그래도 모자라면 2차(wide)에서 아무 난이도나 — 고난도 세트에 하 문항이 섞이지 않게
    const order = (wide ? [want, want - 1, want + 1, 1, 2, 3, 4, 5] : [want, want - 1, want + 1]) as Diff[]
    for (const d of order) {
      if (d < 1 || d > 5) continue
      const p = cands.find((c) => c.diff === d && !usedIds.has(c.id) && !(c.twinGroup && usedTwins.has(c.twinGroup)))
      if (p) { picked.push(p); usedIds.add(p.id); if (p.twinGroup) usedTwins.add(p.twinGroup); cursor.set(typeId, k + 1); return true }
    }
    return false
  }

  for (const wide of [false, true]) {
    let i = 0, dry = 0
    while (picked.length < set.count && dry < types.length) {
      const ok = take(types[i % types.length], wide)
      dry = ok ? 0 : dry + 1
      i++
    }
    if (picked.length >= set.count) break
  }
  return picked
}

/**
 * 같은 중단원(또는 대단원)의 1·2·3번을 **순서대로 이어 뽑는다** — 앞 번호가 쓴 문항은 뒤 번호에서 뺀다.
 * 학생이 1번·2번을 이어 풀 때 같은 문제가 다시 나오지 않게 (실측: 제외 없이 뽑으면 평균 25% 겹쳤다).
 */
export function pickNaesinChain(sets: NaesinSet[], target: NaesinSet, index: PoolIndex): Problem[] {
  const siblings = sets
    .filter((s) => s.courseId === target.courseId && s.unitName === target.unitName && s.midName === target.midName)
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
  const used = new Set<string>()
  for (const s of siblings) {
    const picked = pickNaesinProblems(s, index, used)
    if (s.key === target.key) return picked
    picked.forEach((p) => used.add(p.id))
  }
  return pickNaesinProblems(target, index)
}

/** 표의 「문제수」 — 후보가 목표보다 많으면 목표치, 적으면 후보 수 (실제 뽑기와 같은 값을 싸게 얻는다) */
export function naesinCount(set: NaesinSet, index: PoolIndex): number {
  let n = 0
  for (const t of set.typeIds) { n += index.get(t)?.length ?? 0; if (n >= set.count) return set.count }
  return n
}
