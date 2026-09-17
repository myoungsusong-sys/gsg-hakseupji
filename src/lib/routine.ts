import type { Assignment, DailyNote, Grading, SchoolExam, Student, Teacher, Worksheet } from '../types'
import { dateKey } from './dates'
import { isTeacherAccountEmail, teacherByEmail } from './role'
import { isVocaGrading } from './voca'
import { examRows } from './exam'

// ── ✅ 선생님 하루 루틴(체크리스트) ─────────────────────────────────────────────
//
// 명수쌤 2026-09-15: "박성우 선생님은 뭘 어떻게 진행해야 하는지 모르고 적극적으로 학생을 불러서
//   가르치지 않고 학생이 올 때까지 기다리기만 해! 이러면 우리 학원 망해 ㅜ 체크리스트를 만들어줘!"
//
// 설계
//   · 강사 계정으로 로그인하면 **이 화면이 첫 화면**이다(App.tsx). 뭘 할지 몰라 기다리는 일이 없게.
//   · 항목은 화면에 실제로 있는 기능으로만 쓴다 — 항목마다 [열기] 버튼이 그 화면으로 간다.
//   · 할 수 있는 것은 **기록으로 자동 확인**한다(오늘 호출 몇 명·기본과제 채점 몇/몇·한마디 몇 명).
//     자기 보고만 믿으면 체크만 하고 안 한다.
//   · 체크 저장: settings 'routineChecks' 키 `강사키|날짜|항목id` (호출 기록은 `강사키|날짜|call|학생id`).
//     강사키 = teachers 레코드 id, 강사 레코드가 없는 강사 계정은 이메일, 원장은 'owner'.
//   · 원장 화면에는 강사별 오늘 진행이 표로 보인다 — "안 하고 있다"가 숫자로 드러나야 한다.

export type RoutineWhen = '수업 전' | '수업 중' | '수업 후'
export interface RoutineItem {
  id: string
  when: RoutineWhen
  label: string
  why: string                 // 왜 해야 하나 — 강사가 이유를 알아야 한다
  link?: string               // 그 일을 하는 화면
  linkLabel?: string
  subjects?: string[]         // 이 과목을 맡은 강사에게만(없으면 전원)
  repeat?: string             // '30분마다' 처럼 반복 안내
}

export const ROUTINE: RoutineItem[] = [
  // ── 수업 전 ──
  { id: 'daily-made', when: '수업 전', label: '오늘 기본과제 만들기',
    why: '학생이 오면 앉자마자 풀 것이 있어야 한다. 없으면 학생은 논다.',
    link: '/daily', linkLabel: '기본과제' },
  { id: 'room-open', when: '수업 전', label: '오늘 교실 화면 켜 두기',
    why: '수업 내내 이 화면이 누가 막혔는지 알려 준다. 닫아 두면 아무것도 모른다.',
    link: '/today', linkLabel: '오늘 교실' },
  { id: 'exam-prep', when: '수업 전', label: '시험 2주 이내 학생 내신 대비 학습지 챙기기',
    why: '학생이 넣은 시험 일정이 D-14 안이면 그 범위의 내신 대비 학습지가 나가 있어야 한다. 시험 전날 허둥대면 늦다.',
    link: '/prep/school-exam', linkLabel: '수업 준비 › 내신 대비 › 학생 시험 일정' },
  { id: 'voca-none', when: '수업 전', label: '단어시험 안 본 학생 확인 → 오면 바로 보게 하기',
    why: '단어는 매일 봐야 붙는다. 하루 빠지면 다음 날 두 배가 된다.',
    link: '/lesson', linkLabel: '수업 › 영어 › 영단어 전체 현황', subjects: ['영어'] },
  // ── 수업 중 ──
  { id: 'call-first', when: '수업 중', label: '오답 많은 학생부터 선생님이 먼저 불러서 설명하기',
    why: '학생은 스스로 질문하러 오지 않는다. 기다리면 아무도 안 온다. 앱이 위에 올려 준 학생부터 부른다.',
    link: '/today', linkLabel: '오늘 교실', repeat: '30분마다' },
  { id: 'idle-call', when: '수업 중', label: '입력 없는 학생 불러서 시작시키기',
    why: '입력이 없는 학생은 안 풀고 있는 학생이다. 오답 많은 학생보다 더 위험하다.',
    link: '/today', linkLabel: '오늘 교실 › 오늘 입력 없음', repeat: '30분마다' },
  { id: 'grade-daily', when: '수업 중', label: '기본과제 채점 확인하고 틀린 것 설명하기',
    why: '학생이 고쳐서 들고 오면 그 자리에서 설명한다. 채점 줄이 비어 있으면 아직 안 푼 것이다.',
    link: '/today', linkLabel: '오늘 교실 › 기본과제 채점' },
  { id: 'eng-test', when: '수업 중', label: '오늘 수업 내용으로 테스트 내기',
    why: '수업만 하고 끝나면 남는 게 없다. 그 교과서 문항으로 바로 확인해야 내신이 된다.',
    link: '/lesson', linkLabel: '수업 › 영어 › 반 [전체] › 수업 연계 테스트', subjects: ['영어'] },
  { id: 'eng-review', when: '수업 중', label: '오답 복습 밀린 학생 챙기기',
    why: '틀린 단어는 다음 날 다시 나온다. 복습이 쌓인 학생은 새 단어를 못 나간다.',
    link: '/lesson', linkLabel: '수업 › 영어 › 영단어 전체 현황', subjects: ['영어'] },
  // ── 수업 후 ──
  { id: 'note', when: '수업 후', label: '오늘 온 학생마다 선생님 한마디 남기기',
    why: '학부모 보고서에 그대로 나간다. 비어 있으면 학원이 아무것도 안 본 것처럼 보인다.',
    link: '/lesson', linkLabel: '수업 › 학생 › 보고서' },
  { id: 'tomorrow', when: '수업 후', label: '내일 올 학생 확인하고 기본과제·단어 범위 미리 보기',
    why: '내일 아침에 허둥대지 않게. 오늘 못 부른 학생은 내일 제일 먼저 부른다.',
    link: '/lesson', linkLabel: '수업' },
]
export const ROUTINE_WHENS: RoutineWhen[] = ['수업 전', '수업 중', '수업 후']

/** 로그인한 사람의 루틴 키 — 강사 레코드 id › 강사 계정 이메일 › 원장 'owner' */
export function routineKeyOf(teachers: Pick<Teacher, 'id' | 'loginId' | 'loginEmail'>[], email: string | null | undefined): string {
  const t = teacherByEmail(teachers, email)
  if (t) return t.id
  return isTeacherAccountEmail(email) ? (email ?? '').trim().toLowerCase() : 'owner'
}
export const routineCheckKey = (teacherKey: string, date: string, itemId: string) => `${teacherKey}|${date}|${itemId}`

/** 이 강사가 볼 항목 — 과목 전용 항목은 그 과목을 맡았을 때만(과목이 안 적힌 강사·원장은 전부) */
export function routineItemsFor(teacher: Pick<Teacher, 'subjects'> | undefined): RoutineItem[] {
  const subs = teacher?.subjects?.filter(Boolean) ?? []
  if (!subs.length) return ROUTINE
  return ROUTINE.filter(it => !it.subjects || it.subjects.some(s => subs.includes(s)))
}

export interface RoutineCtx {
  today: string
  students: Student[]
  worksheets: Worksheet[]
  gradings: Grading[]
  dailyNotes: DailyNote[]
  routineChecks: Record<string, true>
  schoolExams?: SchoolExam[]
  assignments?: Assignment[]
}
export interface AutoStatus { done?: boolean; note?: string }

/** 기록으로 알 수 있는 것은 기록으로 말한다. done 이 없으면 사람이 체크해야 하는 항목(숫자만 거든다). */
export function autoStatus(item: RoutineItem, teacherKey: string, ctx: RoutineCtx): AutoStatus {
  const { today } = ctx
  const active = ctx.students.filter(s => s.active)
  const todayG = ctx.gradings.filter(g => dateKey(g.date) === today)
  switch (item.id) {
    case 'daily-made': {
      const n = ctx.worksheets.filter(w => !w.deletedAt && (w.tags ?? []).includes('기본과제') && dateKey(w.createdAt) === today).length
      return { done: n > 0, note: n ? `오늘 ${n}장 만들어짐` : '아직 안 만듦' }
    }
    case 'exam-prep': {
      const rows = examRows(active, ctx.schoolExams ?? [], ctx.worksheets, ctx.assignments ?? [], today)
      const soon = rows.filter(r => r.exam && (r.dDay ?? 99) <= 14)
      if (!soon.length) return { done: true, note: '2주 이내 시험인 학생 없음' }
      const miss = soon.filter(r => r.sheets === 0)
      return { done: miss.length === 0, note: `2주 이내 ${soon.length}명 · 대비 학습지 없는 학생 ${miss.length}명${miss.length ? ` (${miss.slice(0, 4).map(r => r.st.name).join('·')}${miss.length > 4 ? ' 외' : ''})` : ''}` }
    }
    case 'voca-none': {
      const did = new Set(todayG.filter(isVocaGrading).map(g => g.studentId))
      const n = active.filter(s => !did.has(s.id)).length
      return { note: n ? `아직 안 본 학생 ${n}명` : '전원 봤음' }
    }
    case 'call-first': {
      const pre = `${teacherKey}|${today}|call|`
      const n = Object.keys(ctx.routineChecks).filter(k => k.startsWith(pre)).length
      return { done: n > 0, note: n ? `오늘 ${n}명 불렀음` : '오늘 아직 아무도 안 불렀음' }
    }
    case 'idle-call': {
      const did = new Set(todayG.map(g => g.studentId))
      const n = active.filter(s => !did.has(s.id)).length
      return { note: n ? `지금 입력 없는 학생 ${n}명` : '전원 입력 있음' }
    }
    case 'grade-daily': {
      const daily = ctx.worksheets.filter(w => !w.deletedAt && (w.tags ?? []).includes('기본과제') && dateKey(w.createdAt) === today)
      if (!daily.length) return { note: '오늘 기본과제 없음' }
      const graded = new Set(todayG.map(g => g.worksheetId).filter(Boolean))
      const g = daily.filter(w => graded.has(w.id)).length
      return { done: g === daily.length, note: `채점 ${g}/${daily.length}` }
    }
    case 'eng-test': {
      const n = ctx.worksheets.filter(w => !w.deletedAt && (w.tags ?? []).includes('수업연계') && dateKey(w.createdAt) === today).length
      return { done: n > 0, note: n ? `오늘 ${n}장 냈음` : '오늘 아직 안 냄' }
    }
    case 'note': {
      const came = new Set(todayG.map(g => g.studentId))
      const wrote = ctx.dailyNotes.filter(n => n.date === today && (
        n.comment?.trim() || Object.values(n.bySubject ?? {}).some(v => v.comment?.trim()))).map(n => n.studentId)
      const w = new Set(wrote).size
      if (!came.size) return { note: '오늘 기록 있는 학생 없음' }
      return { done: w >= came.size, note: `오늘 온 ${came.size}명 중 ${w}명 작성` }
    }
    default: return {}
  }
}

export function routineProgress(teacherKey: string, items: RoutineItem[], ctx: RoutineCtx): { done: number; total: number; undone: RoutineItem[] } {
  const undone = items.filter(it => {
    const manual = !!ctx.routineChecks[routineCheckKey(teacherKey, ctx.today, it.id)]
    return !(manual || autoStatus(it, teacherKey, ctx).done)
  })
  return { done: items.length - undone.length, total: items.length, undone }
}
