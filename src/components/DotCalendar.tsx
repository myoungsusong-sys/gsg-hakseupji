import { useState } from 'react'

/* 달력 — 기록이 있는 날에 초록 점을 찍는다.
   · 기간 고르기(onPick 이 있을 때): 첫 번째로 누른 날이 시작, 두 번째가 끝(거꾸로 눌러도 바로잡는다)
   · 보기 전용(onPick 없음): 날짜를 누르면 onDay 로 알려 준다 */
const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export default function DotCalendar({ dots, from, to, onPick, onDay, selected, initial }: {
  dots: Set<string>                  // 점 찍을 날(YYYY-MM-DD)
  from?: string; to?: string         // 고른 기간(색칠)
  onPick?: (from: string, to: string) => void
  onDay?: (key: string) => void
  selected?: string | null           // 보기 전용에서 누른 날
  initial?: string                   // 처음 보여 줄 달이 든 날짜
}) {
  const base = initial ? new Date(initial) : new Date()
  const [ym, setYm] = useState({ y: base.getFullYear(), m: base.getMonth() })
  const [anchor, setAnchor] = useState<string | null>(null)   // 기간의 첫 번째 누름
  const first = new Date(ym.y, ym.m, 1)
  const days = new Date(ym.y, ym.m + 1, 0).getDate()
  const lead = first.getDay()
  const today = (() => { const t = new Date(); return keyOf(t.getFullYear(), t.getMonth(), t.getDate()) })()
  const move = (d: number) => setYm(p => { const n = new Date(p.y, p.m + d, 1); return { y: n.getFullYear(), m: n.getMonth() } })

  function click(k: string) {
    if (!onPick) { onDay?.(k); return }
    if (!anchor) { setAnchor(k); onPick(k, k); return }
    onPick(anchor <= k ? anchor : k, anchor <= k ? k : anchor)
    setAnchor(null)
  }

  return (
    <div className="w-64 select-none text-sm">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="rounded px-2 py-1 text-ink2 hover:bg-paper2" aria-label="이전 달">‹</button>
        <b>{ym.y}년 {ym.m + 1}월</b>
        <button type="button" onClick={() => move(1)} className="rounded px-2 py-1 text-ink2 hover:bg-paper2" aria-label="다음 달">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-ink2">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const k = keyOf(ym.y, ym.m, i + 1)
          const inRange = !!from && !!to && k >= from && k <= to
          const edge = k === from || k === to || k === selected
          return (
            <button type="button" key={k} onClick={() => click(k)} data-day={k}
              className={`relative mx-auto my-0.5 flex h-8 w-8 flex-col items-center justify-center rounded-full text-[13px] tabular-nums
                ${edge ? 'bg-pine font-bold text-paper' : inRange ? 'bg-pine-soft text-pine-dark' : 'hover:bg-paper2'}
                ${k === today && !edge ? 'ring-1 ring-pine' : ''}`}>
              {i + 1}
              {dots.has(k) && <span data-dot className={`absolute bottom-0.5 h-1 w-1 rounded-full ${edge ? 'bg-paper' : 'bg-emerald-500'}`} />}
            </button>
          )
        })}
      </div>
      {onPick && <p className="mt-2 text-[11px] text-ink2">{anchor ? '끝 날짜를 눌러 주세요.' : '시작 날짜를 누르고, 이어서 끝 날짜를 누르세요. 초록 점은 기록이 있는 날이에요.'}</p>}
    </div>
  )
}
