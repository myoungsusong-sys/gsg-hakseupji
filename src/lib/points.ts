import type { Grading, PointEntry, StudentTimetable } from '../types'
import { dateKey } from './dates'
import { TT_DAYS } from './timetable'

// ── 포인트 리워드 엔진 (1포인트 = 1원) ─────────────────────────────
// 자동 적립·차감은 저장하지 않고 학습 기록에서 매번 파생 계산한다 → 중복 적립·기록 불일치가 원천적으로 없다.
// 차감은 "그날 번 만큼만" 깎아 하루 합계가 마이너스로 내려가지 않게 한다(빚지면 포기해버리는 것 방지).
// 학원 지급분은 월 상한(기본 3만원)을 적용하고, 학부모 용돈은 상한 없이 별도 합산한다.

export const POINT_RULES = {
  block: 200,            // 시간표 블록 1개 완료
  perfectDay: 500,       // 그날 블록 전부 완료 (보너스)
  sheet100: 1000,        // 학습지 100점
  sheet80: 500,          // 학습지 80점 이상
  blockMissed: -100,     // 블록 미완료 (지난 날짜만)
} as const

export const MONTHLY_CAP = 30000   // 학원 지급분 월 상한 (원). 학부모 용돈은 제외.

export interface DayPoint {
  date: string
  items: { label: string; amount: number }[]
  earned: number      // 적립 합계
  deducted: number    // 차감 합계 (음수)
  net: number         // 그날 순액 (0 미만으로 내려가지 않음)
}

export interface MonthPoint {
  month: string           // YYYY-MM
  days: DayPoint[]        // 최신순
  academyRaw: number      // 상한 적용 전 학원 지급분 (자동 + 수동)
  academyAmount: number   // 상한 적용 후
  capped: boolean         // 상한에 걸렸는지
  parentAmount: number    // 학부모 용돈 (상한 없음)
  total: number           // 최종 지급 예정액
  manual: PointEntry[]
  parent: PointEntry[]
}

const ymOf = (d: string) => d.slice(0, 7)
function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}
function dayLabelOf(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return TT_DAYS[(d.getDay() + 6) % 7]
}

// 하루치 자동 계산 — 시간표 완료/미완 + 그날 학습지 점수
function autoDay(
  date: string, todayKeyStr: string, timetable: StudentTimetable | undefined,
  studentId: string, ttChecks: Record<string, true>, gradings: Grading[],
): { label: string; amount: number }[] {
  const items: { label: string; amount: number }[] = []
  const blocks = timetable?.blocks?.[dayLabelOf(date)] ?? []
  if (blocks.length > 0) {
    let done = 0
    blocks.forEach((_, i) => { if (ttChecks[`${studentId}|${date}|${i}`]) done++ })
    if (done > 0) items.push({ label: `공부 시간 ${done}칸 완료`, amount: POINT_RULES.block * done })
    if (done === blocks.length) items.push({ label: '오늘 계획 전부 완료 보너스', amount: POINT_RULES.perfectDay })
    // 미완 차감은 지난 날짜만 (오늘·미래는 아직 할 시간이 남았다)
    const missed = blocks.length - done
    if (missed > 0 && date < todayKeyStr) {
      items.push({ label: `못 한 시간 ${missed}칸`, amount: POINT_RULES.blockMissed * missed })
    }
  }
  // 학습지 점수 — 그날 채점 건별
  for (const g of gradings) {
    if (g.studentId !== studentId || dateKey(g.date) !== date) continue
    const total = g.results.length
    if (total === 0) continue
    const correct = g.results.filter(r => r.correct).length
    const score = Math.round((correct / total) * 100)
    if (score === 100) items.push({ label: `학습지 100점 (${total}문항)`, amount: POINT_RULES.sheet100 })
    else if (score >= 80) items.push({ label: `학습지 ${score}점 (${total}문항)`, amount: POINT_RULES.sheet80 })
  }
  return items
}

export function computeMonth(
  studentId: string, month: string, todayKeyStr: string,
  timetable: StudentTimetable | undefined,
  ttChecks: Record<string, true>, gradings: Grading[], entries: PointEntry[],
): MonthPoint {
  const mine = entries.filter(e => e.studentId === studentId && ymOf(e.date) === month)
  const manual = mine.filter(e => e.kind === 'manual')
  const parent = mine.filter(e => e.kind === 'parent')

  const days: DayPoint[] = []
  for (const date of daysInMonth(month)) {
    if (date > todayKeyStr) continue                    // 미래는 계산하지 않음
    const items = autoDay(date, todayKeyStr, timetable, studentId, ttChecks, gradings)
    for (const e of manual) if (e.date === date) items.push({ label: e.reason || '선생님 조정', amount: e.amount })
    if (items.length === 0) continue
    const earned = items.filter(i => i.amount > 0).reduce((a, i) => a + i.amount, 0)
    const deducted = items.filter(i => i.amount < 0).reduce((a, i) => a + i.amount, 0)
    days.push({ date, items, earned, deducted, net: Math.max(0, earned + deducted) })
  }
  days.sort((a, b) => b.date.localeCompare(a.date))

  const academyRaw = days.reduce((a, d) => a + d.net, 0)
  const academyAmount = Math.min(academyRaw, MONTHLY_CAP)
  const parentAmount = parent.reduce((a, e) => a + e.amount, 0)
  return {
    month, days, academyRaw, academyAmount, capped: academyRaw > MONTHLY_CAP,
    parentAmount, total: academyAmount + parentAmount, manual, parent,
  }
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
export function monthKeyOf(dateStr: string): string { return dateStr.slice(0, 7) }
