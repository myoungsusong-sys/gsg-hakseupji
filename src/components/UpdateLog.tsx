import { useEffect, useMemo, useRef, useState } from 'react'

// 앱 업데이트 알림 + 이력. changelog.json(최신순 배열)을 폴링해 배포를 감지한다.
// JS 해시 비교와 달리 데이터만 바뀐 배포(wb-match 등)도 잡힌다 — 배포 때마다 changelog에 한 줄 추가하면 됨.
export interface ChangeEntry { ts: string; title: string; detail?: string }

export function useChangelog() {
  const [entries, setEntries] = useState<ChangeEntry[]>([])
  const [stale, setStale] = useState(false)
  const baseline = useRef<string | null>(null)   // 앱 로드 시점의 최신 ts
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}changelog.json?u=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const data = await r.json() as ChangeEntry[]
        if (!alive || !Array.isArray(data) || data.length === 0) return
        setEntries(data)
        const top = data[0].ts
        if (baseline.current === null) baseline.current = top
        else if (top !== baseline.current) setStale(true)
      } catch { /* 오프라인 등 무시 */ }
    }
    load()
    const t = setInterval(load, 3 * 60 * 1000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  // 로드 이후 새로 추가된 항목(ts 문자열이 고정폭이라 사전순 비교 = 시간순)
  const unseen = useMemo(
    () => (stale && baseline.current ? entries.filter(e => e.ts > baseline.current!) : []),
    [entries, stale],
  )
  return { entries, stale, unseen }
}

// 상단 배너 — 변경 내용을 보여주고 카운트다운 후 자동 새로고침(‘나중에’로 중단 가능)
export function UpdateBanner({ items, seconds = 20 }: { items: ChangeEntry[]; seconds?: number }) {
  const [count, setCount] = useState(seconds)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    if (count <= 0) { location.reload(); return }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, paused])
  const top = items[0]
  if (!top) return null
  return (
    <div className="no-print sticky top-0 z-40 bg-amber text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm">
        <span className="text-lg leading-none">🎉</span>
        <div className="min-w-0 grow leading-snug">
          <b>업데이트: {top.title}</b>
          {top.detail && <span className="ml-2 opacity-90">{top.detail}</span>}
          {items.length > 1 && <span className="ml-2 whitespace-nowrap opacity-75">외 {items.length - 1}건</span>}
        </div>
        <button onClick={() => location.reload()}
          className="shrink-0 rounded-lg bg-white/25 px-3 py-1 font-bold hover:bg-white/35">
          지금 새로고침{!paused && ` (${count})`}
        </button>
        {!paused && (
          <button onClick={() => setPaused(true)} title="자동 새로고침 중단"
            className="shrink-0 rounded-lg px-2 py-1 opacity-80 hover:opacity-100">나중에</button>
        )}
      </div>
    </div>
  )
}

// 업데이트 이력 창 — 날짜·시간별 변경 기록 (우측 슬라이드 패널)
export function UpdateLogModal({ entries, onClose }: { entries: ChangeEntry[]; onClose: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-96 max-w-[90vw] overflow-y-auto border-l border-line bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <h3 className="font-black">📋 업데이트 이력</h3>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>
        {entries.length === 0 ? (
          <div className="pt-16 text-center text-sm text-ink2">기록이 없습니다.</div>
        ) : (
          <div className="grid gap-3.5">
            {entries.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="border-l-2 border-pine/40 pl-3">
                <div className="text-xs text-ink2">{e.ts}</div>
                <div className="font-bold leading-snug">{e.title}</div>
                {e.detail && <div className="mt-0.5 text-sm leading-snug text-ink2">{e.detail}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
