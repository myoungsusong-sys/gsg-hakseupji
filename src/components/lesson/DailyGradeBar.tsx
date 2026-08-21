import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { WorksheetGrade } from './WorksheetPanel'
import type { Grading, Student, Worksheet } from '../../types'

// ── ✏️ 오늘 기본과제 채점 — 선생님이 직접 채점한다 ──────────────────────────────
//
// 왜 만들었나 (2026-08-21 명수쌤): "이건 선생님이 직접 채점을 하시는 게 좋을 것 같애.
// 선생님앱에 채점을 할 수 있게 해주고, 선생님앱엔 문제풀이까지 다 뜨게 해줘."
//
// 🔴 「오늘 교실」의 본 목록에는 이 학생들이 **안 뜬다.** 그쪽은 오늘 답을 입력한 학생만
//    거르는데(gradings 기준), 선생님이 채점하는 방식에서는 채점 전에 기록이 없기 때문이다.
//    그래서 **출제된 기본과제 자체**를 기준으로 하는 줄을 따로 둔다.
//
// 🔴 채점 화면은 새로 만들지 않고 수업 > 학습지의 WorksheetGrade 를 그대로 연다.
//    그 화면은 이미 정답·문제·해설·풀이영상·자동저장(병합 저장)을 갖고 있다.
//    복사해 새로 만들면 2026-08-13 에 고친 「선생님이 한 문항 표시하면 학생 제출이
//    통째로 사라지던」 병합 저장 버그를 다시 만들게 된다.

type Cell = {
  ws: Worksheet
  done: number          // 채점한 문항 수
  total: number
  wrong: number
}

export default function DailyGradeBar() {
  const { students, worksheets, assignments, gradings } = useStore()
  const [open, setOpen] = useState<{ st: Student; ws: Worksheet } | null>(null)
  const [fold, setFold] = useState(false)
  const today = todayKey()

  const rows = useMemo(() => {
    // 오늘 만든 기본과제 학습지 (DailySet 이 tags 에 '기본과제' 를 넣는다)
    const daily = worksheets.filter(w =>
      !w.deletedAt && (w.tags ?? []).includes('기본과제') && dateKey(w.createdAt) === today)
    if (!daily.length) return []

    const wsById = new Map(daily.map(w => [w.id, w]))
    const stById = new Map(students.map(s => [s.id, s]))
    // 오늘 채점 기록 — 학습지별로 하나
    const gByWs = new Map<string, Grading>()
    for (const g of gradings as Grading[]) {
      if (dateKey(g.date) !== today || !g.worksheetId) continue
      if (!wsById.has(g.worksheetId)) continue
      gByWs.set(`${g.studentId}|${g.worksheetId}`, g)
    }

    const by = new Map<string, { st: Student; cells: Cell[] }>()
    for (const a of assignments) {
      const ws = wsById.get(a.worksheetId)
      const st = stById.get(a.studentId)
      if (!ws || !st) continue
      const g = gByWs.get(`${st.id}|${ws.id}`)
      const marked = (g?.results ?? []).filter(r => !r.pending)
      const cell: Cell = {
        ws,
        total: ws.problemIds.length,
        done: marked.length,
        wrong: marked.filter(r => !r.correct && !r.careless).length,
      }
      const cur = by.get(st.id) ?? { st, cells: [] }
      if (!cur.cells.some(c => c.ws.id === ws.id)) cur.cells.push(cell)
      by.set(st.id, cur)
    }
    // 수학 → 과학 차례로 (Worksheet.subject 는 선택 필드라 빈 값을 뒤로 보낸다)
    for (const v of by.values()) v.cells.sort((a, b) => (a.ws.subject ?? 'zz').localeCompare(b.ws.subject ?? 'zz'))
    // 안 끝난 사람 먼저 — 선생님이 위에서부터 훑으면 된다
    return [...by.values()].sort((a, b) => {
      const left = (x: typeof a) => x.cells.reduce((s, c) => s + (c.total - c.done), 0)
      return left(b) - left(a) || a.st.name.localeCompare(b.st.name)
    })
  }, [worksheets, assignments, gradings, students, today])

  if (open) {
    return (
      <div className="fixed inset-0 z-40 overflow-auto bg-paper2 p-4">
        <div className="mx-auto max-w-4xl">
          <WorksheetGrade student={open.st} ws={open.ws} onBack={() => setOpen(null)} />
        </div>
      </div>
    )
  }

  if (!rows.length) return null

  const left = rows.reduce((s, r) => s + r.cells.reduce((t, c) => t + (c.total - c.done), 0), 0)
  const all = rows.reduce((s, r) => s + r.cells.reduce((t, c) => t + c.total, 0), 0)

  return (
    <div className="mb-4 rounded-2xl border border-pine/40 bg-pine-soft/50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <b className="text-sm text-pine-dark">✏️ 오늘 기본과제 채점</b>
        <span className="text-xs text-ink2">
          {rows.length}명 · {all - left}/{all}문항 채점
          {left > 0 ? <b className="ml-1 text-clay">— {left}문항 남음</b> : <b className="ml-1 text-pine-dark">— 다 했습니다</b>}
        </span>
        <div className="grow" />
        <button onClick={() => setFold(v => !v)}
          className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink2 hover:border-pine">
          {fold ? '펼치기' : '접기'}
        </button>
      </div>

      {!fold && (
        <div className="grid gap-1.5">
          {rows.map(r => (
            <div key={r.st.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2">
              <b className="w-20 shrink-0 text-sm">{r.st.name}</b>
              <span className="w-10 shrink-0 text-xs text-ink2">{r.st.grade}</span>
              {r.cells.map(c => {
                const finished = c.done >= c.total && c.total > 0
                return (
                  <button key={c.ws.id} onClick={() => setOpen({ st: r.st, ws: c.ws })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      finished
                        ? 'border-pine bg-pine-soft text-pine-dark hover:brightness-95'
                        : 'border-clay bg-clay text-white hover:brightness-110'}`}>
                    {c.ws.subject ?? '과제'} {finished
                      ? `✓ ${c.total - c.wrong}/${c.total}${c.wrong ? ` · 오답 ${c.wrong}` : ''}`
                      : `채점 ${c.done}/${c.total}`}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
