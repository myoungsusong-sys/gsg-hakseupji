import type { LecturePlan, StudentTimetable, TTBlock, TTResource } from '../types'

// ── 주간 시간표 자동 배치 — 요일별 공부시간 창을 슬롯으로 쪼개고 교재·인강을 고르게 배분 ──

export const TT_DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

export const TT_SUBJECTS = ['수학', '영어', '과학', '국어', '사회', '기타'] as const

export const SUBJECT_CLS: Record<string, string> = {
  수학: 'bg-blue-100 text-blue-900',
  영어: 'bg-emerald-100 text-emerald-900',
  과학: 'bg-violet-100 text-violet-900',
  국어: 'bg-rose-100 text-rose-900',
  사회: 'bg-amber-100 text-amber-900',
  기타: 'bg-stone-200 text-stone-800',
}

function toMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + (m || 0)
}
function toHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// 하루 공부시간 창 → 슬롯 목록 (마지막 자투리 20분 미만은 버림)
export function daySlots(win: { start: string; end: string } | null | undefined, slotMin: number): { start: string; end: string }[] {
  if (!win || !win.start || !win.end) return []
  const s = toMin(win.start), e = toMin(win.end)
  if (e <= s) return []
  const out: { start: string; end: string }[] = []
  for (let t = s; t + 20 <= e; t += slotMin) {
    out.push({ start: toHM(t), end: toHM(Math.min(t + slotMin, e)) })
  }
  return out
}

// 자동 배치: 자료별 주당 목표(weekly, 0=균등)에 비례해 전체 슬롯을 배분하고,
// 요일 안에서는 같은 자료가 연속되지 않게(가능하면) 라운드로빈으로 채운다.
export function buildTimetable(
  days: StudentTimetable['days'],
  slotMin: number,
  resources: TTResource[],
): Record<string, TTBlock[]> {
  const blocks: Record<string, TTBlock[]> = {}
  const usable = resources.filter(r => r.title.trim())
  if (usable.length === 0) {
    for (const d of TT_DAYS) blocks[d] = []
    return blocks
  }

  const slotsByDay = TT_DAYS.map(d => ({ day: d, slots: daySlots(days[d], slotMin) }))
  const total = slotsByDay.reduce((a, x) => a + x.slots.length, 0)

  // 자료별 목표 슬롯 수 — weekly 지정분 우선, 나머지는 균등 배분(최대잉여법)
  const remain = new Map<string, number>()
  const manual = usable.filter(r => r.weekly > 0)
  const auto = usable.filter(r => !(r.weekly > 0))
  let left = total
  for (const r of manual) {
    const n = Math.min(r.weekly, left)
    remain.set(r.id, n); left -= n
  }
  if (auto.length) {
    const base = Math.floor(left / auto.length)
    auto.forEach((r, i) => remain.set(r.id, base + (i < left - base * auto.length ? 1 : 0)))
  } else if (left > 0 && manual.length) {
    // 전부 수동인데 슬롯이 남으면 순서대로 더 얹는다
    for (let i = 0; left > 0; i = (i + 1) % manual.length) { remain.set(manual[i].id, remain.get(manual[i].id)! + 1); left-- }
  }

  // 요일별 채우기 — 남은 목표가 가장 큰 자료부터, 직전 블록과 같은 자료는 피함
  for (const { day, slots } of slotsByDay) {
    const out: TTBlock[] = []
    for (const slot of slots) {
      const cands = usable
        .filter(r => (remain.get(r.id) ?? 0) > 0)
        .sort((a, b) => (remain.get(b.id) ?? 0) - (remain.get(a.id) ?? 0))
      if (cands.length === 0) break
      const prev = out[out.length - 1]
      const pick = cands.find(r => !prev || r.title !== prev.title) ?? cands[0]
      remain.set(pick.id, (remain.get(pick.id) ?? 0) - 1)
      out.push({
        start: slot.start, end: slot.end, title: pick.title, subject: pick.subject, kind: pick.kind,
        ...(pick.workbookId ? { workbookId: pick.workbookId } : {}),
      })
    }
    blocks[day] = out
  }
  return blocks
}

// 오늘 요일 라벨 ('월'~'일')
export function todayDayLabel(d = new Date()): string {
  return TT_DAYS[(d.getDay() + 6) % 7]
}

// 지금 진행 중인 블록인지 (학생앱 '지금' 강조)
export function isNowBlock(b: TTBlock, d = new Date()): boolean {
  const now = d.getHours() * 60 + d.getMinutes()
  return toMin(b.start) <= now && now < toMin(b.end)
}

// 블록의 그날 진도 — 연결된 교재의 진도표(LecturePlan)에서 해당 날짜 세션을 찾는다.
// 그날 세션이 없으면 '가장 가까운 지난 미완료 세션'(밀린 진도)을 안내한다.
export function planForBlock(
  b: TTBlock, dateKey: string, plans: LecturePlan[], studentId: string,
): { text: string; behind: boolean } | null {
  if (!b.workbookId) return null
  const p = plans.find(x => x.studentId === studentId && x.workbookId === b.workbookId)
  if (!p) return null
  const exact = p.sessions.find(s => s.date === dateKey)
  if (exact) return { text: `${exact.pageFrom}~${exact.pageTo}p${exact.unit ? ` · ${exact.unit}` : ''}`, behind: false }
  const overdue = p.sessions.filter(s => s.date < dateKey && !s.done).sort((a, b2) => b2.date.localeCompare(a.date))[0]
  if (overdue) return { text: `밀린 진도 ${overdue.pageFrom}~${overdue.pageTo}p`, behind: true }
  return null
}
