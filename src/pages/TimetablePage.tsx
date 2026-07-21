import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import type { StudentTimetable, TTBlock, TTResource } from '../types'
import { buildTimetable, daySlots, SUBJECT_CLS, TT_DAYS, TT_SUBJECTS } from '../lib/timetable'

// ── 주간 시간표 — 요일별 공부시간 + 교재·인강 선택 → 자동 배치 → 학생앱 홈에 '오늘 시간표'로 노출 ──

const INPUT = 'rounded-lg border border-line px-2 py-1.5 text-sm'

function emptyTT(): StudentTimetable {
  return {
    days: Object.fromEntries(TT_DAYS.map(d => [d, null])),
    slotMin: 60,
    resources: [],
    blocks: Object.fromEntries(TT_DAYS.map(d => [d, []])),
    updatedAt: '',
  }
}

export default function TimetablePage() {
  const { studentId } = useParams()
  const { students, workbooks, updateStudent } = useStore()
  const brand = useBrand()
  const student = students.find(s => s.id === studentId)

  const [tt, setTT] = useState<StudentTimetable>(() => {
    const saved = students.find(s => s.id === studentId)?.timetable
    if (saved) return { ...emptyTT(), ...saved, days: { ...emptyTT().days, ...saved.days } }
    const init = emptyTT()
    // 등록 정보(수업 요일·등하원 시간)가 있으면 초기값으로 깔아준다
    const st = students.find(s => s.id === studentId)
    if (st?.classDays?.length && st.arriveTime && st.leaveTime) {
      for (const d of st.classDays) init.days[d] = { start: st.arriveTime, end: st.leaveTime }
    }
    return init
  })
  const [dirty, setDirty] = useState(false)

  const myWorkbooks = useMemo(
    () => workbooks.filter(w => w.studentId === student?.id),
    [workbooks, student?.id])

  if (!student) {
    return <div className="p-8 text-sm text-ink2">학생을 찾을 수 없습니다. <Link to="/manage" className="text-pine underline">학생 관리로</Link></div>
  }

  const set = (patch: Partial<StudentTimetable>) => { setTT(prev => ({ ...prev, ...patch })); setDirty(true) }
  const setDay = (d: string, win: { start: string; end: string } | null) =>
    set({ days: { ...tt.days, [d]: win } })
  const setRes = (i: number, patch: Partial<TTResource>) =>
    set({ resources: tt.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  const totalSlots = TT_DAYS.reduce((a, d) => a + daySlots(tt.days[d], tt.slotMin).length, 0)

  function generate() {
    const blocks = buildTimetable(tt.days, tt.slotMin, tt.resources)
    const next = { ...tt, blocks, updatedAt: new Date().toISOString() }
    setTT(next); setDirty(false)
    updateStudent(student!.id, { timetable: next })
  }
  function save() {
    const next = { ...tt, updatedAt: new Date().toISOString() }
    setTT(next); setDirty(false)
    updateStudent(student!.id, { timetable: next })
  }
  function removeBlock(d: string, i: number) {
    const next = { ...tt, blocks: { ...tt.blocks, [d]: tt.blocks[d].filter((_, j) => j !== i) }, updatedAt: new Date().toISOString() }
    setTT(next)
    updateStudent(student!.id, { timetable: next })
  }

  const presetWeekday = () => set({
    days: { ...tt.days, ...Object.fromEntries(['월', '화', '수', '목', '금'].map(d => [d, { start: '16:00', end: '22:00' }])) } })
  const presetWeekend = () => set({
    days: { ...tt.days, 토: { start: '10:00', end: '16:00' }, 일: { start: '10:00', end: '16:00' } } })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="note-noprint mb-3 flex items-center justify-between">
        <Link to="/manage" className="text-sm text-ink2 hover:text-ink">← 학생 관리</Link>
        <div className="flex items-center gap-2">
          <Link to={`/diagnosis/${student.id}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink2 hover:border-pine">🧭 진단 리포트</Link>
          <button onClick={() => window.print()} className="rounded-lg bg-pine px-4 py-1.5 text-sm font-bold text-paper">🖨 인쇄 / PDF</button>
        </div>
      </div>

      {/* ── 입력부 (인쇄 제외) ── */}
      <div className="note-noprint grid gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm font-black">1. 요일별 공부시간</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink2">
            <button type="button" onClick={presetWeekday} className="rounded-md border border-line px-2 py-1 font-semibold hover:border-pine">평일 16~22시 채우기</button>
            <button type="button" onClick={presetWeekend} className="rounded-md border border-line px-2 py-1 font-semibold hover:border-pine">주말 10~16시 채우기</button>
            <span>· 블록 길이</span>
            <select value={tt.slotMin} onChange={e => set({ slotMin: Number(e.target.value) })} className={INPUT}>
              {[40, 50, 60, 90].map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
            <span>· 이번 주 총 {totalSlots}블록</span>
          </div>
          <div className="mt-3 grid gap-1.5">
            {TT_DAYS.map(d => {
              const win = tt.days[d]
              return (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <span className="w-8 font-black">{d}</span>
                  <label className="flex items-center gap-1 text-xs text-ink2">
                    <input type="checkbox" checked={!!win}
                      onChange={e => setDay(d, e.target.checked ? { start: '16:00', end: '22:00' } : null)} />
                    공부
                  </label>
                  {win && (
                    <>
                      <input type="time" value={win.start} onChange={e => setDay(d, { ...win, start: e.target.value })} className={INPUT} />
                      <span className="text-ink2">~</span>
                      <input type="time" value={win.end} onChange={e => setDay(d, { ...win, end: e.target.value })} className={INPUT} />
                      <span className="text-xs text-ink2">{daySlots(win, tt.slotMin).length}블록</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm font-black">2. 교재·인강 선택 <span className="text-xs font-semibold text-ink2">— 주당 블록 0이면 남는 시간을 균등 배분</span></p>
          {myWorkbooks.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold text-ink2">배정 교재 빠른 추가:</span>
              {myWorkbooks.map(w => (
                <button key={w.id} type="button"
                  onClick={() => set({ resources: [...tt.resources, { id: uid('ttr'), kind: '교재', title: w.name, subject: w.subject ?? '수학', weekly: 0 }] })}
                  className="rounded-md border border-line px-2 py-1 font-semibold text-ink2 hover:border-pine">
                  ＋ {w.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-1.5">
            {tt.resources.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                <select value={r.kind} onChange={e => setRes(i, { kind: e.target.value as TTResource['kind'] })} className={INPUT}>
                  <option value="교재">📗 교재</option>
                  <option value="인강">🎧 인강</option>
                </select>
                <input value={r.title} onChange={e => setRes(i, { title: e.target.value })}
                  placeholder={r.kind === '교재' ? '예: 쎈 중등수학 1(상)' : '예: 엠베스트 국어'}
                  className="w-0 min-w-40 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" />
                <select value={r.subject} onChange={e => setRes(i, { subject: e.target.value })} className={INPUT}>
                  {TT_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-ink2">
                  주당
                  <input type="number" min={0} max={40} value={r.weekly}
                    onChange={e => setRes(i, { weekly: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-14 rounded-lg border border-line px-2 py-1.5 text-sm" />
                  블록
                </label>
                <button type="button" onClick={() => set({ resources: tt.resources.filter((_, j) => j !== i) })}
                  className="text-ink2 hover:text-ink" aria-label="자료 삭제">✕</button>
              </div>
            ))}
            <button type="button"
              onClick={() => set({ resources: [...tt.resources, { id: uid('ttr'), kind: '교재', title: '', subject: '수학', weekly: 0 }] })}
              className="self-start rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink2 hover:border-pine">
              ＋ 교재/인강 추가
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={generate}
              disabled={totalSlots === 0 || tt.resources.filter(r => r.title.trim()).length === 0}
              className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
              ⚡ 시간표 자동 생성
            </button>
            {dirty && <button type="button" onClick={save} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink2 hover:border-pine">설정만 저장</button>}
            <span className="text-xs text-ink2">생성하면 저장되고, 학생앱 홈에 &lsquo;오늘 시간표&rsquo;로 바로 표시됩니다.</span>
          </div>
        </div>
      </div>

      {/* ── 시간표 (인쇄 대상) ── */}
      <div className="note-print mt-4 rounded-2xl border border-line bg-white p-6">
        <div className="mb-3 flex items-end justify-between border-b-2 border-ink pb-2">
          <h1 className="text-lg font-black">{student.name} 주간 시간표</h1>
          <span className="text-xs text-ink2">{brand} · {new Date().toISOString().slice(0, 10).replace(/-/g, '.')}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {TT_DAYS.map(d => (
            <div key={d} className="min-w-0">
              <p className="mb-1 text-center text-xs font-black">{d}</p>
              <div className="grid gap-1">
                {(tt.blocks[d] ?? []).map((b: TTBlock, i: number) => (
                  <div key={i} className={`group rounded-lg px-1.5 py-1 text-[11px] leading-tight ${SUBJECT_CLS[b.subject] ?? SUBJECT_CLS.기타}`}>
                    <div className="flex items-start justify-between gap-0.5">
                      <span className="font-black tabular-nums">{b.start}</span>
                      <button type="button" onClick={() => removeBlock(d, i)}
                        className="note-noprint hidden text-[10px] group-hover:inline" aria-label="블록 삭제">✕</button>
                    </div>
                    <p className="truncate font-semibold" title={b.title}>{b.kind === '인강' ? '🎧 ' : ''}{b.title}</p>
                  </div>
                ))}
                {(tt.blocks[d] ?? []).length === 0 && <p className="text-center text-[10px] text-ink2">—</p>}
              </div>
            </div>
          ))}
        </div>
        {Object.values(tt.blocks).every(b => (b ?? []).length === 0) && (
          <p className="mt-3 text-center text-sm text-ink2">위에서 공부시간과 교재·인강을 정하고 [⚡ 시간표 자동 생성]을 누르세요.</p>
        )}
      </div>
    </div>
  )
}
