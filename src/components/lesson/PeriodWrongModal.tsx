import { useMemo, useState } from 'react'
import type { Student } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import DrillModal, { type DrillWrong } from './DrillModal'

// 매쓰플랫 기간별 오답 학습지 — 기간 내 교재+학습지 오답 합본
export default function PeriodWrongModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { gradings, wbItems, worksheets, problems } = useStore()
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return dateKey(d)
  })
  const [to, setTo] = useState(todayKey())
  const [drillOpen, setDrillOpen] = useState(false)

  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])
  const problemMap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])
  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])

  // 기간 내 오답 집계 — 교재는 itemId→WBItem, 학습지는 typeId 직접+원문제 id
  const { bookWrongs, sheetWrongs } = useMemo(() => {
    const book: DrillWrong[] = []
    const sheet: DrillWrong[] = []
    for (const g of gradings) {
      if (g.studentId !== student.id) continue
      const k = dateKey(g.date)
      if (k < from || k > to) continue
      const isSheet = g.source === '학습지'
      const ws = g.worksheetId ? wsMap.get(g.worksheetId) : undefined
      g.results.forEach((r, i) => {
        if (r.correct) return
        if (isSheet) {
          const pid = ws?.problemIds[i]
          const p = pid ? problemMap.get(pid) : undefined
          const typeId = r.typeId ?? p?.typeId
          if (typeId) sheet.push({ typeId, diff: p?.diff, problemId: pid })
        } else if (r.itemId) {
          const it = itemMap.get(r.itemId)
          if (it) book.push({ typeId: it.typeId, diff: it.diff })
        }
      })
    }
    return { bookWrongs: book, sheetWrongs: sheet }
  }, [gradings, student.id, from, to, wsMap, problemMap, itemMap])

  const total = bookWrongs.length + sheetWrongs.length

  if (drillOpen) {
    return (
      <DrillModal
        student={student}
        title={`[오답] ${from}~${to}`}
        wrongs={[...bookWrongs, ...sheetWrongs]}
        defaultTags={['오답', '기간별']}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 text-lg font-black">기간별 오답 학습지</div>
        <div className="mb-4 text-sm text-ink2">{student.name} · 기간 내 채점된 교재·학습지 오답을 모아 출제합니다</div>

        <div className="mb-4 flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-line px-3 py-2" />
          <span className="text-ink2">~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-line px-3 py-2" />
        </div>

        <div className="rounded-xl bg-paper2 px-4 py-3 text-sm">
          교재 오답 <b className="text-clay">{bookWrongs.length}</b>
          <span className="mx-1 text-ink2">·</span>
          학습지 오답 <b className="text-clay">{sheetWrongs.length}</b>
          <span className="mx-1 text-ink2">·</span>
          합계 <b className="text-pine-dark">{total}</b>
        </div>
        {total === 0 && <p className="mt-2 text-sm text-ink2">기간 내 오답이 없습니다</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">취소</button>
          <button onClick={() => setDrillOpen(true)} disabled={total === 0}
            className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white hover:brightness-105 disabled:opacity-40">
            오답 학습지 만들기
          </button>
        </div>
      </div>
    </div>
  )
}
