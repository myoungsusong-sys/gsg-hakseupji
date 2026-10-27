// 📝 시험대비·수업세트 — 학생 «시험대비» 탭 · 선생님 «시험대비·수업세트» 탭 · 학부모 보고 글이 함께 쓰는 계산 (2026-10-27)
//
//   명수쌤 2026-10-27: «시험대비 세트를 학습지앱에 반영해서 채점을 할 수 있게» ·
//                      «따로 탭을 만들어서 학부모 보고까지 될 수 있게»
//
// 과정·문항은 curriculum-exam.ts(자동 생성) · 학습지 행 목록은 public/figs/exam/_worksheets.json.
// 학습지 id 는 ws-<과정>-NN 으로 정해져 있어서 id 만 보고 어느 과정인지 안다.
// 채점은 기존 학습지 채점(Grading source '학습지') 그대로 — 여기서는 모아서 보여 주기만 한다.
import { EXAM_COURSES, type ExamCourse } from '../data/curriculum-exam'
import { typeName } from '../data/curriculum'
import type { Assignment, Grading, Student, Worksheet } from '../types'

export type ExamKind = '시험대비' | '수업세트'
export const kindOfCourse = (id: string): ExamKind => (id.startsWith('set') ? '수업세트' : '시험대비')
export const courseById = (id: string): ExamCourse | undefined => EXAM_COURSES.find(c => c.id === id)

/** 학습지 id → 과정 id (ws-exam-m22-03 → exam-m22). 우리가 만든 학습지가 아니면 null */
export function courseOfWorksheet(wsId: string): string | null {
  const m = /^ws-(.+)-\d{2}$/.exec(wsId)
  return m && courseById(m[1]) ? m[1] : null
}

/** 학습지 행 (public/figs/exam/_worksheets.json — 저장소반영.py 가 만든다) */
export interface ExamSheetRow { id: string; course: string; title: string; grade: string; subject: Worksheet['subject']; tags: string[]; problemIds: string[] }

let rowsCache: Promise<ExamSheetRow[]> | null = null
export function loadExamSheetRows(): Promise<ExamSheetRow[]> {
  if (!rowsCache) {
    rowsCache = fetch(`${import.meta.env.BASE_URL}figs/exam/_worksheets.json`)
      .then(r => { if (!r.ok) throw new Error('worksheets ' + r.status); return r.json() as Promise<ExamSheetRow[]> })
      .catch(e => { rowsCache = null; throw e })
  }
  return rowsCache
}

/** 학습지 행 → 앱 학습지 (LecNoteCheck 와 같은 모양 · DEFAULT_SHEET_OPTIONS 에 자동채점) */
export function worksheetFromRow(r: ExamSheetRow, options: Worksheet['options']): Worksheet {
  return {
    id: r.id, title: r.title, author: '대치스파르타', grade: r.grade, subject: r.subject, tags: r.tags,
    theme: 'pine', problemIds: r.problemIds, conceptIds: [], options: { ...options, autoGrade: true },
    listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
  }
}

/** 유형 id → 소단원 이름 (유형 이름이 «소단원 · O·X 확인» 꼴) */
export function subOfType(typeId: string): string {
  const n = typeName(typeId) || ''
  const i = n.lastIndexOf(' · ')
  return i > 0 ? n.slice(0, i) : n
}

function latest(gradings: Grading[], studentId: string, wsId: string): Grading | undefined {
  let out: Grading | undefined
  for (const g of gradings) {
    if (g.studentId !== studentId || g.source !== '학습지' || g.worksheetId !== wsId) continue
    if (!out || g.date > out.date) out = g
  }
  return out
}

export interface SheetResult { ws: Worksheet; assigned: boolean; g?: Grading; total: number; answered: number; correct: number; score: number | null }
export interface CourseResult {
  course: ExamCourse; kind: ExamKind; sheets: SheetResult[]
  done: number; answered: number; correct: number
  weak: { name: string; wrong: number; total: number }[]   // 틀린 문항이 많은 소단원(학생 기준)
  lastAt: string | null
}

/** 한 학생의 과정별 결과 — 배정된 학습지가 하나라도 있는 과정만 (onlyAssigned=false 면 푼 것도 포함) */
export function studentCourseResults(student: Student, worksheets: Worksheet[], assignments: Assignment[], gradings: Grading[]): CourseResult[] {
  const mineAssigned = new Set(assignments.filter(a => a.studentId === student.id).map(a => a.worksheetId))
  const byCourse = new Map<string, SheetResult[]>()
  for (const ws of worksheets) {
    if (ws.deletedAt) continue
    const c = courseOfWorksheet(ws.id)
    if (!c) continue
    const g = latest(gradings, student.id, ws.id)
    const assigned = mineAssigned.has(ws.id)
    if (!assigned && !g) continue
    const answered = g ? g.results.length : 0
    const correct = g ? g.results.filter(r => r.correct).length : 0
    const total = ws.problemIds.length
    const arr = byCourse.get(c) ?? []
    arr.push({ ws, assigned, g, total, answered, correct, score: g && g.results.length ? Math.round(correct / total * 100) : null })
    byCourse.set(c, arr)
  }
  const out: CourseResult[] = []
  for (const [cid, sheets] of byCourse) {
    const course = courseById(cid)
    if (!course) continue
    sheets.sort((a, b) => a.ws.id.localeCompare(b.ws.id))
    const weakMap = new Map<string, { wrong: number; total: number }>()
    let lastAt: string | null = null
    for (const s of sheets) {
      if (!s.g) continue
      if (!lastAt || s.g.date > lastAt) lastAt = s.g.date
      for (const r of s.g.results) {
        const name = r.typeId ? subOfType(r.typeId) : ''
        if (!name) continue
        const w = weakMap.get(name) ?? { wrong: 0, total: 0 }
        w.total++
        if (!r.correct) w.wrong++
        weakMap.set(name, w)
      }
    }
    const weak = [...weakMap].map(([name, v]) => ({ name, ...v }))
      .filter(w => w.wrong > 0).sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong)
    out.push({
      course, kind: kindOfCourse(cid), sheets,
      done: sheets.filter(s => s.g && s.g.results.length).length,
      answered: sheets.reduce((n, s) => n + s.answered, 0),
      correct: sheets.reduce((n, s) => n + s.correct, 0),
      weak, lastAt,
    })
  }
  return out.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.course.id.localeCompare(b.course.id))
}

const pct = (a: number, b: number) => (b ? Math.round(a / b * 100) : 0)

/** 한 줄 평 초안 — 숫자만 보고 쓴다(지어내지 않는다). 선생님이 고쳐서 보낸다 */
export function draftComment(r: CourseResult): string {
  if (!r.answered) return '아직 푼 문항이 없습니다. 이번 주 안에 풀도록 지도하겠습니다.'
  const rate = pct(r.correct, r.answered)
  const top = r.weak[0]
  const head = rate >= 90 ? '개념이 잘 잡혀 있습니다.' : rate >= 70 ? '기본은 갖추었고, 몇 곳만 다지면 됩니다.' : '아직 개념이 흔들리는 곳이 있어 보충이 필요합니다.'
  const tail = top ? ` «${top.name}» 에서 ${top.wrong}문항을 틀려 다음 시간에 다시 짚겠습니다.` : ' 틀린 문항 없이 잘 풀었습니다.'
  return head + tail
}

/** 학부모 보고 글 (카톡에 붙여 넣는 글) — 보내는 것은 선생님이 한다 */
export function parentReportText(brand: string, student: Student, results: CourseResult[], comments: Record<string, string>): string {
  const L: string[] = [`[${brand}] ${student.name} 시험대비 학습 현황`, '']
  for (const r of results) {
    L.push(`📝 ${r.course.label}`)
    for (const s of r.sheets) {
      const name = s.ws.title.replace(/^(내신대비|수업세트) \| /, '')
      if (s.g && s.g.results.length) L.push(`· ${name} — ${s.total}문항 중 ${s.correct}개 정답 (${s.score}점)`)
      else L.push(`· ${name} — 아직 안 풂`)
    }
    if (r.answered) L.push(`= 푼 ${r.answered}문항 중 ${r.correct}개 정답 (정답률 ${pct(r.correct, r.answered)}%)`)
    if (r.weak.length) L.push(`🔁 더 볼 곳: ${r.weak.slice(0, 3).map(w => `${w.name}(${w.wrong}/${w.total} 오답)`).join(', ')}`)
    const c = (comments[r.course.id] ?? draftComment(r)).trim()
    if (c) L.push(`💬 ${c}`)
    L.push('')
  }
  L.push('감사합니다 😊')
  return L.join('\n')
}
