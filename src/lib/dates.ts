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
