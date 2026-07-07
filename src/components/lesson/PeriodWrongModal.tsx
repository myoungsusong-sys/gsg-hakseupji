import { useMemo, useState } from 'react'
import type { Grading, Student, Worksheet } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { weakTypes, wrongByType } from '../../lib/drill'
import { typeName } from '../../data/curriculum'
import DrillModal, { type DrillWrong } from './DrillModal'

type Tab = 'weak' | 'period' | 'sheet'

const TABS: [Tab, string][] = [
  ['weak', '단원별 취약 유형'],
  ['period', '기간별 오답'],
  ['sheet', '학습지별 오답'],
]

// 매쓰플랫 「단원·기간별 취약 유형 관리」 (풀스크린 3탭) — 모달 3탭으로 구현
export default function PeriodWrongModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { gradings, wbItems, worksheets, problems } = useStore()
  const [tab, setTab] = useState<Tab>('weak')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return dateKey(d)
  })
  const [to, setTo] = useState(todayKey())
  const [checked, setChecked] = useState<Set<string>>(new Set())   // 탭3 선택 학습지
  const [drill, setDrill] = useState<{ title: string; wrongs: DrillWrong[]; tags: string[] } | null>(null)

  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])
  const problemMap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])
  const wsMap = useMemo(() => new Map(worksheets.map(w => [w.id, w])), [worksheets])

  // ── 탭1: 이 학생 취약 유형 상위 10 (교재+학습지 전체 채점 이력 기준)
  const weak = useMemo(
    () => weakTypes(wrongByType(student.id, gradings, wbItems)).slice(0, 10),
    [student.id, gradings, wbItems],
  )

  // ── 탭2: 기간 내 오답 집계 — 교재는 itemId→WBItem, 학습지는 typeId 직접+원문제 id
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

  // ── 탭3: 채점된 학습지 목록 (학습지별 최신 채점의 오답, 원문제 id 포함)
  const gradedSheets = useMemo(() => {
    const latest = new Map<string, Grading>()
    for (const g of gradings) {
      if (g.studentId !== student.id || g.source !== '학습지' || !g.worksheetId) continue
      const cur = latest.get(g.worksheetId)
      if (!cur || g.date > cur.date) latest.set(g.worksheetId, g)
    }
    const out: { ws: Worksheet; wrongs: DrillWrong[]; date: string }[] = []
    for (const [wsId, g] of latest) {
      const ws = wsMap.get(wsId)
      if (!ws || ws.deletedAt) continue
      const wrongs: DrillWrong[] = []
      g.results.forEach((r, i) => {
        if (r.correct) return
        const pid = ws.problemIds[i]
        const p = pid ? problemMap.get(pid) : undefined
        const typeId = r.typeId ?? p?.typeId
        if (typeId) wrongs.push({ typeId, diff: p?.diff, problemId: pid })
      })
      out.push({ ws, wrongs, date: g.date })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [gradings, student.id, wsMap, problemMap])

  const selectedWrongs = useMemo(
    () => gradedSheets.filter(s => checked.has(s.ws.id)).flatMap(s => s.wrongs),
    [gradedSheets, checked],
  )

  function toggleSheet(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (drill) {
    return (
      <DrillModal
        student={student}
        title={drill.title}
        wrongs={drill.wrongs}
        defaultTags={drill.tags}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="text-lg font-black">단원·기간별 취약 유형 관리</div>
          <button onClick={onClose} aria-label="닫기"
            className="rounded-lg px-2 py-0.5 text-lg leading-none text-ink2 hover:bg-paper2">✕</button>
        </div>

        {/* 탭 3개 (매쓰플랫 동일) */}
        <div className="flex border-b border-line px-4 text-sm font-semibold">
          {TABS.map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-3 ${tab === k ? 'border-pine text-pine' : 'border-transparent text-ink2 hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="grow overflow-y-auto p-6 text-sm">
          {tab === 'weak' && (
            <div>
              <p className="mb-4 text-ink2">유형분석 탭에서 유형을 선택해 학습지를 만들 수 있습니다.</p>
              {weak.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-paper2/50 p-8 text-center text-ink2">
                  아직 채점 이력이 없어 취약 유형을 계산할 수 없습니다.
                </div>
              ) : (
                <>
                  <div className="mb-1 font-bold">{student.name} 취약 유형 TOP {weak.length}</div>
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    {weak.map(s => (
                      <span key={s.typeId} className="rounded-lg bg-paper2 px-2.5 py-1">
                        {typeName(s.typeId)} <b className="text-clay">오답 {s.wrong}</b>
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setDrill({
                        title: `[취약 유형] ${student.name}`,
                        wrongs: weak.map(s => ({ typeId: s.typeId })),
                        tags: ['오답', '취약유형'],
                      })}
                      className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110">
                      취약 유형 학습지 만들기
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'period' && (
            <div>
              <p className="mb-4 text-ink2">기간 내 채점된 교재·학습지 오답을 모아 출제합니다.</p>
              <div className="mb-4 flex items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2" />
                <span className="text-ink2">~</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2" />
              </div>
              <div className="rounded-xl bg-paper2 px-4 py-3">
                교재 오답 <b className="text-clay">{bookWrongs.length}</b>
                <span className="mx-1 text-ink2">·</span>
                학습지 오답 <b className="text-clay">{sheetWrongs.length}</b>
                <span className="mx-1 text-ink2">·</span>
                합계 <b className="text-pine-dark">{total}</b>
              </div>
              {total === 0 && <p className="mt-2 text-ink2">기간 내 오답이 없습니다</p>}
              <div className="mt-5 flex justify-end">
                <button disabled={total === 0}
                  onClick={() => setDrill({
                    title: `[오답] ${from}~${to}`,
                    wrongs: [...bookWrongs, ...sheetWrongs],
                    tags: ['오답', '기간별'],
                  })}
                  className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110 disabled:opacity-40">
                  오답 학습지 만들기
                </button>
              </div>
            </div>
          )}

          {tab === 'sheet' && (
            <div>
              <p className="mb-4 text-ink2">채점된 학습지를 선택하면 오답을 합산해 학습지를 만듭니다.</p>
              {gradedSheets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-paper2/50 p-8 text-center text-ink2">
                  아직 채점된 학습지가 없습니다.
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    {gradedSheets.map(({ ws, wrongs, date }) => (
                      <label key={ws.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 hover:bg-paper2/50">
                        <input type="checkbox" checked={checked.has(ws.id)} onChange={() => toggleSheet(ws.id)} />
                        <div className="grow">
                          <b>{ws.title}</b>
                          <div className="text-xs text-ink2">{dateKey(date)} 채점 · 오답 <b className="text-clay">{wrongs.length}</b>문제</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-end gap-3">
                    <span className="text-ink2">선택 {checked.size}개 · 오답 합계 <b className="text-pine-dark">{selectedWrongs.length}</b>문제</span>
                    <button disabled={selectedWrongs.length === 0}
                      onClick={() => setDrill({
                        title: `[오답] 학습지 ${checked.size}개 합본`,
                        wrongs: selectedWrongs,
                        tags: ['오답', '학습지 오답'],
                      })}
                      className="rounded-lg bg-pine px-5 py-2 font-bold text-paper hover:brightness-110 disabled:opacity-40">
                      오답 학습지 만들기
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
