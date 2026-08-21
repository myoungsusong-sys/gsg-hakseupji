import type { Assignment, DailyConfig, DiffMatrix, Grading, Problem, Student, WBItem, Worksheet } from '../types'
import { pickProblems } from './select'
import { pickDrillProblems, weakTypes, wrongByType } from './drill'
import { curriculumFor } from '../data/curriculum'
import { dateKey } from './dates'

// ── 오늘의 학습 선발 엔진 (순수함수) ─────────────────────────────────
//
// 🔴 이 코드는 TodayPanel.issue() 안에 박혀 있던 것을 **그대로** 꺼낸 것이다.
//    로직을 새로 만들지 않았다 — 검증된 선발기(pickProblems 난이도 매트릭스 배분,
//    pickDrillProblems 오답 복습)를 그대로 쓴다. 바뀐 것은 "학생 1명씩 선생님이 눌러야
//    했던 것"을 반 전체에 한 번에 걸 수 있게 함수로 뺀 것뿐이다.
//
// 왜 뺐나: 반 30명을 한 번에 내보내는 코드가 앱에 없었다. 그래서 아무도 안 눌렀고,
//    오답이 안 생겼고, 「오늘 교실」이 비어 있었고, 결국 선생님이 할 일이 없었다.

const isMock = (p: Problem) => /모의|수능|평가원|교육청/.test(p.source ?? '')
const isOutOfCurriculum = (p: Problem) => /교육과정\s*외|과정외/.test(p.source ?? '')

export interface DailyCtx {
  problems: Problem[]
  gradings: Grading[]
  wbItems: WBItem[]
  worksheets: Worksheet[]
  assignments: Assignment[]
  diffMatrix: DiffMatrix
}

/** 그 학생의 오늘치 문항을 고른다. 조건에 맞는 게 없으면 빈 배열(호출부가 건너뛴다). */
export function buildDailyPicks(student: Student, cfg: DailyConfig, ctx: DailyCtx): Problem[] {
  const { problems, gradings, wbItems, worksheets, assignments, diffMatrix } = ctx
  const cur = curriculumFor(cfg.courseId)
  const units = cfg.unitIds.length ? cur.units.filter(u => cfg.unitIds.includes(u.id)) : cur.units
  const midSel = new Set(cfg.midIds ?? [])
  const mids = units.flatMap(u => u.mids).filter(m => midSel.size === 0 || midSel.has(m.id))
  const typeOrder = mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))
  const typeSet = new Set(typeOrder)

  const prevIds = new Set<string>()
  if (cfg.excludePrev) {
    for (const a of assignments) {
      if (a.studentId !== student.id) continue
      const w = worksheets.find(x => x.id === a.worksheetId)
      if (w) for (const pid of w.problemIds) prevIds.add(pid)
    }
  }
  const pool = problems.filter(p => {
    if (!typeSet.has(p.typeId)) return false
    if (cfg.mock === 'exclude' && isMock(p)) return false
    if (cfg.mock === 'only' && !isMock(p)) return false
    if (cfg.outOfCurriculumOff && isOutOfCurriculum(p)) return false
    if (cfg.excludePrev && prevIds.has(p.id)) return false
    return true
  })

  let picked: Problem[]
  if (cfg.evenBy) {
    const groups: string[][] = cfg.evenBy === 'unit'
      ? units.map(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))).filter(g => g.length)
      : cfg.evenBy === 'mid'
        ? mids.map(m => m.subs.flatMap(s => s.types.map(t => t.id))).filter(g => g.length)
        : cfg.evenBy === 'sub'
          ? mids.flatMap(m => m.subs.map(s => s.types.map(t => t.id))).filter(g => g.length)
          : typeOrder.map(t => [t])
    const per = Math.max(1, Math.ceil(cfg.count / Math.max(1, groups.length)))
    const acc: Problem[] = []
    const used = new Set<string>()
    for (const g of groups) {
      const gset = new Set(g)
      const sub = pickProblems(pool.filter(p => gset.has(p.typeId) && !used.has(p.id)), per, cfg.diff, cfg.kind, g, diffMatrix)
      for (const p of sub) { used.add(p.id); acc.push(p) }
    }
    picked = acc.slice(0, cfg.count)
  } else {
    picked = pickProblems(pool, cfg.count, cfg.diff, cfg.kind, typeOrder, diffMatrix)
  }
  if (picked.length === 0) return []

  // 오답 복습 믹스 — 최근 7일에 틀린 것(same) · 그 유형의 쌍둥이·유사(twin)
  const reviewDays = cfg.reviewDays ?? []
  if (cfg.review && (reviewDays.length === 0 || reviewDays.includes(new Date().getDay()))) {
    const cut = new Date()
    cut.setDate(cut.getDate() - 6)
    const cutoff = dateKey(cut)
    const recent = gradings.filter(g => dateKey(g.date) >= cutoff)
    const mode = cfg.reviewMode ?? 'twin'
    const cap = Math.min(100, Math.max(1, cfg.reviewCap ?? 50))
    const used = new Set(picked.map(p => p.id))
    const reviewPicked: Problem[] = []
    if (mode === 'same' || mode === 'both') {
      const pMap = new Map(problems.map(p => [p.id, p]))
      for (const g of recent) {
        if (g.studentId !== student.id || !g.worksheetId) continue
        const ws = worksheets.find(w => w.id === g.worksheetId)
        if (!ws) continue
        g.results.forEach((r, i) => {
          if (r.correct) return
          const p = pMap.get(r.itemId ?? ws.problemIds[i] ?? '')
          if (p && !used.has(p.id)) { used.add(p.id); reviewPicked.push(p) }
        })
      }
    }
    if (mode === 'twin' || mode === 'both') {
      const weak = weakTypes(wrongByType(student.id, recent, wbItems))
      if (weak.length) {
        reviewPicked.push(...pickDrillProblems(
          weak.map(w => ({ typeId: w.typeId })), problems,
          { twinPer: 1, similarPer: 1, diffShift: 0, typeCap: 2, excludeIds: used },
        ))
      }
    }
    if (reviewPicked.length) picked = [...picked, ...reviewPicked.slice(0, cap)]
  }
  return picked
}

// ── 결정적 학습지 id ────────────────────────────────────────────────
// 🔴 uid('ws') 로 매번 새 id 를 만들면, 선생님이 두 번 누르거나 기기 두 대에서 동시에
//    누를 때 같은 학생에게 학습지가 2장 나간다. 학생·과목·날짜로 id 를 **결정적으로**
//    만들면 두 번 눌러도 같은 행을 덮어써 1장이 유지된다.
//    (addAssignment 는 같은 worksheetId·studentId 면 아무것도 안 한다 — store.tsx)
// 한글을 id 에 넣지 않는다 — supabase id 로 쓰이므로 영문 코드로 바꾼다.
const SUBJ_CODE: Record<string, string> = { 수학: 'math', 과학: 'sci', 영어: 'eng', 사회: 'soc', 역사: 'his' }
export function dailyWsId(studentId: string, subject: string, dayKey: string): string {
  return `dly_${studentId}_${SUBJ_CODE[subject] ?? 'etc'}_${dayKey.replace(/-/g, '')}`
}

/** 평일인가 (월~금). 주말엔 기본과제를 내지 않는다. */
export function isWeekday(d = new Date()): boolean {
  const n = d.getDay()
  return n >= 1 && n <= 5
}

// ── 유형 순회 배정 — 「대표유형부터, 다음엔 유형별 2번째 문제」 ──────────────
//
// 명수쌤 지시(2026-08-21): "고등은 마플시너지 대표유형부터, 처음엔 유형문제만 중간범위까지,
// 그다음은 유형별 2번째 문제를 풀게 해줘."
//
// 🔴 핵심 발견: 마플시너지의 유형 221개가 **문제은행에 100% 있다**(실측). 그 유형에 걸린
//    문제은행 문항이 23,678개고 전부 **문제 이미지·해설 이미지**를 갖고 있다.
//    반면 교재(wb-match)는 정답만 있고 이미지가 없다 — 선생님이 화면에서 문제를 못 본다.
//    → **유형 순서는 교재를 따르고, 문제는 문제은행에서 뽑는다.** 그러면
//      학생 화면·PDF·선생님 지도화면이 한꺼번에 해결된다.
//
// 회차(round) 개념:
//   1회차 = 각 유형의 1번째 문제(대표유형)
//   2회차 = 각 유형의 2번째 문제
//   범위를 "중간까지"로 자르면 앞쪽 유형만 돈다 — 진도에 맞춰 앞에서부터 훑는 방식.

export interface TypeRoundOpts {
  typeOrder: string[]      // 교재가 정한 유형 순서 (앞에서부터 진도 순)
  round: number            // 1=대표유형, 2=유형별 2번째 …
  count: number            // 오늘 낼 문항 수
  // 🔴 범위는 **단원**으로 자른다. 명수쌤: "중간범위의 기준은 보통 4단원이면 1,2단원."
  //    유형 개수의 몇 %가 아니라 진도가 나간 단원까지 — 그게 선생님이 쓰는 단위다.
  units?: string[]         // 낼 단원 이름들(대단원). 비면 전체
  unitOf?: (typeId: string) => string   // 유형 → 대단원 이름
}

/** 유형 순서를 대단원 이름으로 묶는다 — 화면에서 단원을 고르게 하려고 쓴다. */
export function unitsOfOrder(typeOrder: string[], unitOf: (t: string) => string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of typeOrder) {
    const u = unitOf(t)
    if (!u || seen.has(u)) continue
    seen.add(u); out.push(u)
  }
  return out
}

/**
 * 유형 순서를 따라 각 유형의 `round`번째 문제를 골라 온다.
 * 그 유형에 `round`번째가 없으면 그 유형은 건너뛴다(유형마다 문항 수가 다르다).
 * 같은 학생·같은 회차면 **항상 같은 문제**가 나온다 — 정렬이 결정적이라 재실행에 안전하다.
 */
export function buildByTypeRound(problems: Problem[], o: TypeRoundOpts): Problem[] {
  // 단원을 골랐으면 그 단원의 유형만 남긴다(책 차례 순서는 그대로 유지)
  const pick = new Set(o.units ?? [])
  const slice = pick.size && o.unitOf
    ? o.typeOrder.filter(t => pick.has(o.unitOf!(t)))
    : o.typeOrder
  if (!slice.length) return []

  // 유형별로 문항을 모아 **결정적으로** 정렬한다(id 오름차순) — 같은 회차는 같은 문제가 나와야
  // 재출제·PDF 재생성 때 학생이 받은 것과 어긋나지 않는다.
  const byType = new Map<string, Problem[]>()
  for (const p of problems) {
    const arr = byType.get(p.typeId)
    if (arr) arr.push(p); else byType.set(p.typeId, [p])
  }
  for (const arr of byType.values()) arr.sort((a, b) => a.id.localeCompare(b.id))

  const out: Problem[] = []
  for (const t of slice) {
    const arr = byType.get(t)
    if (!arr) continue
    const p = arr[o.round - 1]        // round 1 = 첫 문제(대표유형)
    if (p) out.push(p)
    if (out.length >= o.count) break
  }
  return out
}

/** 교재(wb-match)가 정한 유형 순서를 뽑는다 — 책에 실린 차례 그대로, 중복 제거. */
export function typeOrderOfBook(rows: unknown[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    const t = String(r[2] ?? '')
    if (!t || seen.has(t)) continue
    seen.add(t); out.push(t)
  }
  return out
}

// ── 🎓 학년 정규화 ────────────────────────────────────────────────────────
//
// 🔴 명수쌤(2026-08-21): "학생이 학년이 다 다른 거 알지?"  — 맞다. 그리고 **저장 형태도 다르다.**
//    types.ts:201 에 적혀 있듯 Student.grade 는 '중2' 짧은 표기와 '중2-2' 과정형을 **둘 다** 허용한다.
//    실제로 앱 4곳(Students·Lesson·WorksheetList·supplement)이 각자 같은 정규화를 갖고 있는데,
//    기본과제 화면만 없어서 '중2-2' 로 저장된 학생이 통째로 "지원하지 않는 학년" 으로 빠졌다.
//
// 🔴 고등은 한 가지가 더 있다: 학년 칸에 **과목명**('공통수학2'·'대수')이 들어간 학생이 있다
//    (WorksheetList.tsx:34 가 그 경우를 그대로 표시한다). 그건 학년보다 **더 정확한 정보**라
//    버리지 않고 살려 쓴다 — 과목명이 곧 낼 과정이기 때문이다.

/** 학년 칸에 과목명이 들어간 고등학생 — 과목명이 곧 과정이라 학년 추정보다 정확하다. */
const SUBJ_GRADE: Record<string, string> = {
  공통수학1: '고1', 공통수학2: '고1', 통합과학1: '고1', 통합과학2: '고1',
  대수: '고2', 미적분: '고2', 미적분1: '고2', 미적분Ⅰ: '고2', 확률과통계: '고2', 확통: '고2',
  미적분2: '고3', 미적분Ⅱ: '고3', 기하: '고3',
}

/**
 * 어떤 형태로 저장돼 있든 '중2'·'고1' 같은 **학년 키**로 되돌린다.
 * '중2-2'·'중 2'·'고1-1' → '중2'·'중2'·'고1' · '공통수학2' → '고1' · 못 읽으면 '' .
 */
export function gradeKey(grade: string): string {
  const g = (grade ?? '').trim()
  if (!g) return ''
  const m = g.match(/^(초|중|고)\s*(\d)/)
  if (m) return `${m[1]}${m[2]}`
  return SUBJ_GRADE[g.replace(/\s|\(.*\)/g, '')] ?? ''
}
