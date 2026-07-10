// 날짜 키 — 반드시 로컬 시간 기준 (toISOString은 UTC라 오전 9시 이전이 어제로 집계되는 버그 원인)
export function dateKey(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function monthKey(d: Date | string): string {
  return dateKey(d).slice(0, 7)   // YYYY-MM
}

// ── 수업 요일 / 다음 수업일 ──────────────────────────────
export const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'] as const

// 날짜 키(YYYY-MM-DD)의 한국어 요일 한 글자
export function weekdayOf(key: string): string {
  return WEEKDAYS_KR[new Date(key + 'T00:00:00').getDay()]
}

// 보고서용 라벨 — "7월 12일 (월)"
export function krDateLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KR[d.getDay()]})`
}

// afterKey(YYYY-MM-DD) 다음날부터 classDays(['월','수'...]) 중 가장 가까운 수업일 키를 반환
export function nextClassDate(afterKey: string, classDays?: string[]): string | null {
  if (!classDays || classDays.length === 0) return null
  const base = new Date(afterKey + 'T00:00:00')
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    if (classDays.includes(WEEKDAYS_KR[d.getDay()])) return dateKey(d)
  }
  return null
}
