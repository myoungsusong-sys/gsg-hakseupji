import type { Assignment, Problem, SchoolExam, Student, Worksheet } from '../types'
import { CURRICULA, curriculumFor, type Curriculum } from '../data/curriculum'
import { gradeKey } from './grade'
import { groupOf } from './schoolReview'

// ── 📝 시험 범위 → 출제 (학생 시험 일정 표의 [이 범위로 출제]) — 2026-09-17 명수쌤 "이 범위로 출제 버튼 만들어줘" ──
//
//   ① 과정 고르기: 학생 학년 + 시험 학기(시험 이름의 '1학기/2학기', 없으면 시험 달) + 과목 이름.
//   ② 범위 글자 읽기: 단원 **이름**이 가장 믿을 만하다(학교 교과서 단원 번호는 우리 과정 번호와 다르다).
//      이름이 없으면 'N단원'·'Ⅱ~Ⅲ' 번호, 그것도 없으면 전체. 화면에서 선생님이 칩으로 고친다.
//   ③ 문항 뽑기는 내신관(lib/naesin.ts pickNaesinProblems)을 그대로 쓴다 — 유형 고르게·쌍둥이 중복 없이·난이도 섞기.

export type ExamSubjectGroup = '수학' | '국어' | '영어' | '과학' | '사회'

/** 시험이 몇 학기 것인가 — 이름 우선, 없으면 달(3~8월 1학기) */
export function semesterOf(exam: Pick<SchoolExam, 'name' | 'days'>): 1 | 2 {
  const m = exam.name.match(/([12])\s*학기/)
  if (m) return Number(m[1]) as 1 | 2
  const mon = Number(exam.days[0]?.date.slice(5, 7) || 0)
  return mon >= 3 && mon <= 8 ? 1 : 2
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/[Ⅰ1]$/, 'Ⅰ').replace(/[Ⅱ2]$/, 'Ⅱ')
const has = (id: string) => CURRICULA.some(c => c.id === id)

/** 과목 이름 → 이 학생이 쓸 수 있는 과정 후보(첫째가 기본값). 문제은행이 없는 과목은 빈 배열. */
export function coursesForExamSubject(subject: string, grade: string, sem: 1 | 2): string[] {
  const g = gradeKey(grade)                        // '중2' · '고1'
  const lv = g[0], n = Number(g[1])
  if (!lv || !n) return []
  const name = norm(subject)
  const group = groupOf(subject) as ExamSubjectGroup | null
  const out: string[] = []
  const push = (...ids: string[]) => { for (const id of ids) if (has(id) && !out.includes(id)) out.push(id) }

  if (group === '수학') {
    if (lv === '중') push(`m${n}-${sem}`, `m${n}-${sem === 1 ? 2 : 1}`)
    else {
      if (/공통수학Ⅰ|공통수학1/.test(name)) push('h-cm1')
      if (/공통수학Ⅱ|공통수학2/.test(name)) push('h-cm2')
      if (/대수/.test(name)) push('h-alg')
      if (/미적분Ⅱ|미적분2/.test(name)) push('h-calc2')
      else if (/미적/.test(name)) push('h-calc1')
      if (/확률|확통/.test(name)) push('h-stat')
      if (/기하/.test(name)) push('h-geo')
      if (n === 1) push(sem === 1 ? 'h-cm1' : 'h-cm2', 'h-cm1', 'h-cm2')
      if (n === 2) push('h-alg', 'h-calc1', 'h-stat')
      if (n === 3) push('h-calc2', 'h-geo', 'h-stat')
    }
  } else if (group === '과학') {
    if (lv === '중') {
      if (n === 3) push(sem === 2 ? 'm-sci3-2' : 'm-sci3', 'm-sci3', 'm-sci3-2')
      else push(`m-sci${n}-${sem}`, `m-sci${n}-${sem === 1 ? 2 : 1}`)
    } else {
      if (/통합과학Ⅰ|통합과학1/.test(name)) push('h-int1')
      if (/통합과학Ⅱ|통합과학2/.test(name)) push('h-int2')
      if (/물리/.test(name)) push('h-phy')
      if (/화학/.test(name)) push('h-chem')
      if (/생명|생물/.test(name)) push('h-bio')
      if (/지구/.test(name)) push('h-earth')
      if (n === 1) push(sem === 1 ? 'h-int1' : 'h-int2', 'h-int1', 'h-int2')
    }
  } else if (group === '사회') {
    if (/한국사|역사/.test(name)) return []
    if (lv === '중') push(`m-soc${n}-${sem}`, `m-soc${n}-${sem === 1 ? 2 : 1}`)
    else {
      if (/통합사회Ⅰ|통합사회1/.test(name)) push('h-soc1')
      if (/통합사회Ⅱ|통합사회2/.test(name)) push('h-soc2')
      if (n === 1 || /통합사회/.test(name)) push(sem === 1 ? 'h-soc1' : 'h-soc2', 'h-soc1', 'h-soc2')
    }
  } else if (group === '영어') {
    push(`eng-${lv === '중' ? 'm' : 'h'}${n}`)
  } else if (group === '국어') {
    push(`kor-${lv === '중' ? 'm' : 'h'}${n}`)
  }
  return out
}
export function subjectGroupOfCourse(courseId: string): ExamSubjectGroup {
  return (curriculumFor(courseId).subject ?? '수학') as ExamSubjectGroup
}

// ── 범위 글자 → 중단원 ──────────────────────────────────────────────────────
export interface RangePick { midIds: string[]; how: 'name' | 'number' | 'all' }
const ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ'
const STOP = new Set(['단원', '범위', '까지', '부터', '전체', '교과서', '교재', '시험', '중간', '기말', '프린트', '학습지', '활동지', '포함', '제외', '본문'])

export function parseRange(range: string | undefined, cur: Curriculum): RangePick {
  const all = cur.units.flatMap(u => u.mids.map(m => m.id))
  const text = (range ?? '').trim()
  if (!text || cur.units.length <= 1) return { midIds: all, how: 'all' }
  const flat = text.replace(/\s+/g, '')

  // ① 이름 — 중단원·대단원 이름이 글자에 있거나, 글자의 낱말이 이름 안에 있으면
  type Hit = { pos: number; mids: string[] }
  const hits: Hit[] = []
  const words = [...new Set(text.split(/[\s,·/~\-–()[\]]+/).map(w => w.replace(/(단원|까지|부터|에서)$/, '')).filter(w => /[가-힣]{2,}/.test(w) && !STOP.has(w)))]
  for (const u of cur.units) {
    const un = u.name.replace(/\s+/g, '')
    const uPos = flat.indexOf(un)
    if (un.length >= 2 && uPos >= 0) { hits.push({ pos: uPos, mids: u.mids.map(m => m.id) }); continue }
    for (const m of u.mids) {
      const mn = m.name.replace(/\s+/g, '')
      let pos = mn.length >= 2 ? flat.indexOf(mn) : -1
      if (pos < 0) for (const w of words) { if (w.length >= 2 && mn.includes(w)) { pos = flat.indexOf(w); break } }
      if (pos >= 0) hits.push({ pos, mids: [m.id] })
    }
    if (!hits.some(h => u.mids.some(m => h.mids.includes(m.id)))) {
      for (const w of words) if (w.length >= 3 && un.includes(w)) { hits.push({ pos: flat.indexOf(w), mids: u.mids.map(m => m.id) }); break }
    }
  }
  if (hits.length) {
    hits.sort((a, b) => a.pos - b.pos)
    const pick = new Set<string>()
    hits.forEach(h => h.mids.forEach(id => pick.add(id)))
    // 'A~B' — 사이의 중단원도 넣는다
    for (let i = 0; i + 1 < hits.length; i++) {
      const between = flat.slice(hits[i].pos, hits[i + 1].pos)
      if (/[~∼\-–]|부터/.test(between)) {
        const a = Math.min(...hits[i].mids.map(id => all.indexOf(id)))
        const b = Math.max(...hits[i + 1].mids.map(id => all.indexOf(id)))
        for (let k = a; k <= b; k++) pick.add(all[k])
      }
    }
    return { midIds: all.filter(id => pick.has(id)), how: 'name' }
  }

  // ② 번호 — 'N단원' · 'N~M단원' · 'Ⅱ~Ⅲ'
  const units = new Set<number>()
  const toks: { pos: number; end: number; n: number }[] = []
  for (const m of text.matchAll(/(\d+)\s*[~∼\-–]\s*(\d+)\s*단원/g)) {
    for (let k = Number(m[1]); k <= Number(m[2]); k++) units.add(k)
  }
  for (const m of text.matchAll(/(\d+)\s*단원/g)) toks.push({ pos: m.index!, end: m.index! + m[0].length, n: Number(m[1]) })
  for (const m of text.matchAll(new RegExp(`[${ROMAN}]`, 'g'))) toks.push({ pos: m.index!, end: m.index! + 1, n: ROMAN.indexOf(m[0]) + 1 })
  toks.sort((a, b) => a.pos - b.pos)
  toks.forEach((t, i) => {
    units.add(t.n)
    const prev = toks[i - 1]
    if (prev && /[~∼\-–]|부터/.test(text.slice(prev.end, t.pos))) for (let k = prev.n; k <= t.n; k++) units.add(k)
  })
  const midIds = cur.units.filter((_, i) => units.has(i + 1)).flatMap(u => u.mids.map(m => m.id))
  if (midIds.length) return { midIds, how: 'number' }
  return { midIds: all, how: 'all' }
}

/**
 * 고른 중단원의 유형 — **중단원을 번갈아** 늘어놓는다(1번 중단원 첫 유형, 2번 중단원 첫 유형, …).
 * 🔴 차례대로 이어 붙이면 뽑기(pickNaesinProblems)가 앞에서부터 유형을 돌아 25문항이 첫 단원에서 다 찬다
 *    (2026-09-17 실측: '삼각비~원의 성질' 25문항이 전부 삼각비, 영어는 독해·어법에만).
 */
export function typeIdsOfMids(cur: Curriculum, midIds: string[]): string[] {
  const want = new Set(midIds)
  const lists = cur.units.flatMap(u => u.mids.filter(m => want.has(m.id)).map(m => m.subs.flatMap(s => s.types.map(t => t.id))))
  const out: string[] = []
  for (let k = 0; lists.some(l => k < l.length); k++) for (const l of lists) if (k < l.length) out.push(l[k])
  return out
}

/** 이 학생에게 이미 나간 문항 — 다시 안 낸다 */
export function assignedProblemIds(studentId: string, worksheets: Worksheet[], assignments: Assignment[]): Set<string> {
  const byId = new Map(worksheets.map(w => [w.id, w]))
  const out = new Set<string>()
  for (const a of assignments) if (a.studentId === studentId) for (const id of byId.get(a.worksheetId)?.problemIds ?? []) out.add(id)
  return out
}

/** 학습지 제목 — '내신대비' 로 시작해야 시험 일정 표의 대비 학습지 수에 잡힌다(lib/exam.ts naesinSheetsFor) */
export function examSheetTitle(exam: SchoolExam, subject: string, cur: Curriculum, midIds: string[], st: Pick<Student, 'name'>): string {
  const all = cur.units.flatMap(u => u.mids.map(m => m.id))
  let scope: string
  if (midIds.length === all.length) scope = '전 범위'
  else {
    const units = cur.units.filter(u => u.mids.some(m => midIds.includes(m.id)))
    scope = units.length === 1 && units[0].mids.every(m => midIds.includes(m.id)) ? units[0].name
      : units.length === 1 ? units[0].mids.filter(m => midIds.includes(m.id)).map(m => m.name).join('·')
        : `${units[0].name}~${units[units.length - 1].name}`
  }
  return `내신대비 | ${exam.name} ${subject} (${scope}) - ${st.name}`
}

export const pickCandidates = (pool: Problem[], typeIds: string[]) => {
  const want = new Set(typeIds)
  return pool.filter(p => want.has(p.typeId))
}
