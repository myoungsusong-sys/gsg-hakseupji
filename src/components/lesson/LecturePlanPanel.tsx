import { useEffect, useMemo, useState } from 'react'
import { typeUnitName } from '../../data/curriculum'
import { useStore } from '../../lib/store'
import { todayKey, krDateLabel } from '../../lib/dates'
import { classDatesBetween, buildSessions } from '../../lib/plan'
import type { PlanSession, Student } from '../../types'

// 오늘 + days 뒤의 날짜 키
function addDaysKey(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 수업 > 진도표: 학생×교재 강의 진도 계획 (수업요일 기준 자동 분배 → 오늘/다음 수업 반영)
export default function LecturePlanPanel({ student }: { student: Student }) {
  const { workbooks, wbItems, lecturePlans, setLecturePlan, removeLecturePlan } = useStore()
  const myBooks = useMemo(() => workbooks.filter(w => w.studentId === student.id), [workbooks, student.id])
  const [wbId, setWbId] = useState<string | null>(myBooks[0]?.id ?? null)
  useEffect(() => { if (!myBooks.some(w => w.id === wbId)) setWbId(myBooks[0]?.id ?? null) }, [myBooks, wbId])
  const wb = myBooks.find(w => w.id === wbId) ?? null

  const items = useMemo(
    () => wbItems.filter(i => i.workbookId === wbId).sort((a, b) => a.page - b.page || a.no - b.no),
    [wbItems, wbId],
  )
  // 쪽별 대표 단원 [{page, unit}]
  const pages = useMemo(() => {
    const seen = new Map<number, string>()
    for (const i of items) if (!seen.has(i.page)) seen.set(i.page, typeUnitName(i.typeId) || '')
    return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([page, unit]) => ({ page, unit }))
  }, [items])

  const classDays = student.classDays ?? []
  const planId = wbId ? `${student.id}_${wbId}` : ''
  const existing = useMemo(() => lecturePlans.find(p => p.id === planId), [lecturePlans, planId])

  const [start, setStart] = useState(existing?.startDate ?? todayKey())
  const [end, setEnd] = useState(existing?.endDate ?? addDaysKey(todayKey(), 56))
  const [sessions, setSessions] = useState<PlanSession[]>(existing?.sessions ?? [])

  // 교재 전환 시 저장된 계획 불러오기
  useEffect(() => {
    const p = lecturePlans.find(x => x.id === planId)
    setStart(p?.startDate ?? todayKey())
    setEnd(p?.endDate ?? addDaysKey(todayKey(), 56))
    setSessions(p?.sessions ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbId, student.id])

  const dates = useMemo(() => classDatesBetween(start, end, classDays), [start, end, classDays])

  function persist(next: PlanSession[]) {
    if (!wbId) return
    setSessions(next)
    setLecturePlan({ id: planId, studentId: student.id, workbookId: wbId, startDate: start, endDate: end, sessions: next, updatedAt: new Date().toISOString() })
  }
  function generate() {
    if (!wbId || !pages.length) return
    if (!classDays.length) { alert('먼저 관리 → 학생 등록/수정에서 수업 요일을 지정하세요.'); return }
    if (!dates.length) { alert('설정한 기간에 수업일이 없습니다. 기간을 확인하세요.'); return }
    persist(buildSessions(pages, dates))
  }
  function toggleDone(idx: number) {
    persist(sessions.map((s, i) => i === idx ? { ...s, done: !s.done } : s))
  }
  function editRange(idx: number, key: 'pageFrom' | 'pageTo', v: number) {
    persist(sessions.map((s, i) => i === idx ? { ...s, [key]: v } : s))
  }
  function clearPlan() {
    if (!planId) return
    if (!confirm('이 교재의 진도표를 삭제할까요?')) return
    removeLecturePlan(planId); setSessions([])
  }

  const today = todayKey()
  const doneCount = sessions.filter(s => s.done).length

  if (myBooks.length === 0 || !wb) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
        <b>{student.name}</b> 학생에게 배정된 교재가 없습니다. 먼저 교재를 등록하세요.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={wbId ?? ''} onChange={e => setWbId(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-bold">
          {myBooks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <span className="rounded-md bg-paper2 px-2 py-1 text-xs text-ink2">
          수업 요일 {classDays.length ? classDays.join('·') : <span className="text-clay">미설정</span>}
        </span>
        <span className="text-xs text-ink2">교재 {pages.length}쪽</span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper2/40 px-4 py-3 text-sm">
        <label className="grid gap-1">시작일
          <input type="date" value={start} onChange={e => setStart(e.target.value)}
            className="rounded-lg border border-line px-2 py-1.5" />
        </label>
        <label className="grid gap-1">종료일
          <input type="date" value={end} onChange={e => setEnd(e.target.value)}
            className="rounded-lg border border-line px-2 py-1.5" />
        </label>
        <span className="pb-1.5 text-xs text-ink2">기간 내 수업일 <b className="text-ink">{dates.length}</b>회</span>
        <div className="grow" />
        <button onClick={generate} disabled={!classDays.length || !pages.length}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-105 disabled:opacity-40">
          진도표 생성 {sessions.length > 0 && '(다시)'}
        </button>
        {sessions.length > 0 && (
          <button onClick={clearPlan} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:bg-paper2">삭제</button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          기간을 정하고 <b>진도표 생성</b>을 누르면 수업일별 진도가 자동으로 짜입니다.<br />
          쪽수를 고르게 나누되 단원 경계에서 끊습니다. 생성 후 각 줄의 쪽 범위는 직접 수정할 수 있습니다.
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-ink2">총 <b className="text-ink">{sessions.length}</b>회 · 완료 <b className="text-pine">{doneCount}</b>회 · 진행률 {Math.round(doneCount / sessions.length * 100)}%</div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper2 text-left text-xs text-ink2">
                  <th className="px-3 py-2">회차</th><th>수업일</th><th>진도(쪽)</th><th>단원</th><th className="text-center">완료</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const isToday = s.date === today
                  return (
                    <tr key={i} className={`border-b border-line/50 ${isToday ? 'bg-pine-soft/40' : s.done ? 'bg-paper2/50 text-ink2' : ''}`}>
                      <td className="px-3 py-2 font-bold">{i + 1}회</td>
                      <td className="whitespace-nowrap">{krDateLabel(s.date)}{isToday && <span className="ml-1 rounded bg-pine px-1.5 py-0.5 text-[10px] font-bold text-paper">오늘</span>}</td>
                      <td className="whitespace-nowrap">
                        <input type="number" value={s.pageFrom} onChange={e => editRange(i, 'pageFrom', Number(e.target.value) || 0)}
                          className="w-14 rounded border border-line px-1.5 py-1" />
                        <span className="mx-1">~</span>
                        <input type="number" value={s.pageTo} onChange={e => editRange(i, 'pageTo', Number(e.target.value) || 0)}
                          className="w-14 rounded border border-line px-1.5 py-1" />p
                      </td>
                      <td className="text-xs">{s.unit || '—'}</td>
                      <td className="text-center">
                        <input type="checkbox" checked={!!s.done} onChange={() => toggleDone(i)}
                          className="accent-[var(--color-pine,#2e6b4f)]" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink2">이 진도표의 <b>오늘/다음 수업 진도</b>가 보고서(선생님 한마디 아래 &lsquo;다음 수업&rsquo;)에 자동으로 표시됩니다.</p>
        </>
      )}
    </div>
  )
}
