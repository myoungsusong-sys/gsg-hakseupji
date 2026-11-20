import { useMemo, useState } from 'react'
import type { Grading, GradeResult, Problem, Student, Worksheet } from '../../types'
import { DEFAULT_SHEET_OPTIONS, DIFF_LABEL } from '../../types'
import { useStore, uid } from '../../lib/store'
import { useBrand } from '../../lib/brand'
import { probIndex } from '../../lib/probIndex'
import { pickDrillProblems, type WrongRef } from '../../lib/drill'
import { dateKey, todayKey } from '../../lib/dates'
import { typeName } from '../../data/curriculum'
import MathText, { isImageUrl } from '../MathText'

/* 그룹 채점 + 통합 오답관리 (2026-11-20)
   · 학습지 한 장을 받은 반 학생들의 채점 칸을 나란히 — 칸을 누르면 ○ → ✕ → 지움, 학생별 «전체 정답»
   · 정답 숨기기(학생 칸을 더 넓게) · 문제별 정답률 · 학생별 점수
   · 통합 오답관리: 한 명이라도 틀린 문제를 모아 오답 학습지 하나 → 이 학습지를 받았던 학생 모두에게 출제 */

type Mark = 'o' | 'x'
type Way = 'same' | 'similar' | 'both'

function latestOf(gradings: Grading[], sid: string, wsId: string): Grading | undefined {
  let latest: Grading | undefined
  for (const g of gradings) {
    if (g.studentId !== sid || g.source !== '학습지' || g.worksheetId !== wsId) continue
    if (!latest || g.date > latest.date) latest = g
  }
  return latest
}

export default function GroupGrade({ ws, students, onClose }: { ws: Worksheet; students: Student[]; onClose: () => void }) {
  const { problems, gradings, assignments, upsertGrading, saveWorksheet, addAssignment } = useStore()
  const brand = useBrand()
  const list = useMemo(() => { const m = probIndex(problems); return ws.problemIds.map(id => m.get(id)).filter((p): p is Problem => !!p) }, [problems, ws])
  const [hideAns, setHideAns] = useState(false)
  const [wrongOpen, setWrongOpen] = useState(false)
  const [way, setWay] = useState<Way>('both')
  const [made, setMade] = useState<string | null>(null)

  // 학생별 표시 — 저장된 최신 채점에서 읽는다(옛 기록은 순서로 해석)
  const marks = useMemo(() => {
    const out = new Map<string, Map<string, Mark>>()
    for (const s of students) {
      const g = latestOf(gradings, s.id, ws.id)
      const m = new Map<string, Mark>()
      g?.results.forEach((r, i) => { const id = r.itemId ?? ws.problemIds[i]; if (id) m.set(id, r.correct ? 'o' : 'x') })
      out.set(s.id, m)
    }
    return out
  }, [gradings, students, ws])

  // 한 학생의 표시를 바꿔 저장 — 오늘 기록이 있으면 그 줄을 고치고, 없으면 최신 기록을 이어받아 오늘 줄을 새로 만든다
  function save(s: Student, change: (m: Map<string, Mark>) => void) {
    const base = latestOf(gradings, s.id, ws.id)
    const prev = new Map<string, GradeResult>()
    base?.results.forEach((r, i) => { const id = r.itemId ?? ws.problemIds[i]; if (id) prev.set(id, { ...r, itemId: id }) })
    const m = new Map(marks.get(s.id) ?? [])
    change(m)
    const results: GradeResult[] = []
    for (const p of list) {
      const v = m.get(p.id)
      if (!v) continue
      const old = prev.get(p.id)
      const same = old && old.correct === (v === 'o')
      results.push(same ? old : { itemId: p.id, typeId: p.typeId, correct: v === 'o', at: new Date().toISOString() })
    }
    const today = base && dateKey(base.date) === todayKey()
    void upsertGrading({
      ...(today ? base : {}),
      id: today ? base.id : uid('g'),
      studentId: s.id, source: '학습지', worksheetId: ws.id,
      date: today ? base.date : new Date().toISOString(),
      results,
    })
  }
  const cycle = (s: Student, pid: string) => save(s, m => { const v = m.get(pid); if (!v) m.set(pid, 'o'); else if (v === 'o') m.set(pid, 'x'); else m.delete(pid) })
  const allRight = (s: Student) => save(s, m => { for (const p of list) if (!m.has(p.id)) m.set(p.id, 'o') })
  const clearAll = (s: Student) => { if (confirm(`${s.name} 학생의 이 학습지 채점 표시를 모두 지울까요?`)) save(s, m => m.clear()) }

  const scoreOf = (s: Student) => { const m = marks.get(s.id); if (!m || m.size === 0) return null; return Math.round([...m.values()].filter(v => v === 'o').length / m.size * 100) }
  const rateOf = (pid: string) => {
    let n = 0, ok = 0
    for (const s of students) { const v = marks.get(s.id)?.get(pid); if (v) { n++; if (v === 'o') ok++ } }
    return n ? Math.round(ok / n * 100) : null
  }

  // 통합 오답 — 한 명이라도 틀린 문제
  const wrongs = useMemo(() => list.filter(p => students.some(s => marks.get(s.id)?.get(p.id) === 'x')), [list, students, marks])
  const preview = useMemo(() => {
    const refs: WrongRef[] = wrongs.map(p => ({ typeId: p.typeId, diff: p.diff, problemId: p.id }))
    const front = way === 'similar' ? [] : wrongs.map(p => p.id)
    const excludeIds = new Set<string>(ws.problemIds)
    const sim = way === 'same' ? [] : pickDrillProblems(refs, problems, { twinPer: 0, similarPer: 1, diffShift: 0, typeCap: 0, excludeIds }).map(p => p.id)
    return [...front, ...sim]
  }, [wrongs, way, problems, ws])

  function makeWrongSheet() {
    if (preview.length === 0) return
    const id = uid('ws')
    saveWorksheet({
      id, title: `[오답] ${ws.title} (반 전체)`, author: brand, grade: ws.grade, subject: ws.subject,
      tags: ['학습지 오답'], theme: 'amber', problemIds: preview, conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: ws.options.autoGrade }, listIds: [],
      createdAt: new Date().toISOString(), deletedAt: null,
    })
    // 원래 이 학습지를 받았던 학생 모두(이 반 안)에게 출제
    const got = new Set(assignments.filter(a => a.worksheetId === ws.id).map(a => a.studentId))
    const targets = students.filter(s => got.has(s.id)).map(s => s.id)
    if (targets.length) addAssignment(id, targets, '수업')
    setMade(`오답 학습지를 만들어 ${targets.length}명에게 냈어요 · ${preview.length}문제`)
    setWrongOpen(false)
  }

  const cellW = hideAns ? 'min-w-14' : 'min-w-12'
  return (
    <div data-group-grade>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 목록</button>
        <div>
          <div className="font-black">{ws.title}</div>
          <div className="text-xs text-ink2">그룹 채점 · {students.length}명 · {list.length}문제 · 칸을 누르면 ○ → ✕ → 지움 (바로 저장)</div>
        </div>
        <div className="grow" />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-ink2">
          <input type="checkbox" className="h-4 w-4 accent-pine" checked={hideAns} onChange={e => setHideAns(e.target.checked)} /> 정답 숨기기
        </label>
        <button onClick={() => setWrongOpen(true)} disabled={wrongs.length === 0}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">
          통합 오답관리 {wrongs.length > 0 && `· ${wrongs.length}문제`}
        </button>
      </div>
      {made && <p className="mb-3 rounded-lg bg-pine-soft px-3 py-2 text-sm font-semibold text-pine-dark">{made}</p>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-paper2/60 text-xs text-ink2">
              <th className="sticky left-0 z-10 bg-paper2 px-3 py-2 text-left">번호</th>
              {!hideAns && <th className="px-2 py-2 text-left">정답</th>}
              <th className="px-2 py-2">정답률</th>
              {students.map(s => (
                <th key={s.id} className={`${cellW} px-1 py-2 text-center`}>
                  <div className="font-bold text-ink">{s.name}</div>
                  <div className="tabular-nums">{scoreOf(s) != null ? `${scoreOf(s)}점` : '채점 전'}</div>
                  <div className="mt-1 flex justify-center gap-1">
                    <button onClick={() => allRight(s)} className="rounded border border-line px-1 text-[10px] hover:bg-white" title="빈 칸을 모두 정답으로">전체 정답</button>
                    <button onClick={() => clearAll(s)} className="rounded border border-line px-1 text-[10px] hover:bg-white" title="이 학생 표시 지우기">취소</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => {
              const rate = rateOf(p.id)
              return (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5" title={`${typeName(p.typeId)} · ${DIFF_LABEL[p.diff]}`}>
                    <b className="tabular-nums text-pine-dark">{String(i + 1).padStart(2, '0')}</b>
                  </td>
                  {!hideAns && (
                    <td className="max-w-40 truncate px-2 py-1.5 text-xs">
                      {isImageUrl(p.answer) ? <img src={p.answer} alt="" className="max-h-6" /> : <MathText text={p.answer} />}
                    </td>
                  )}
                  <td className={`px-2 py-1.5 text-center text-xs font-bold tabular-nums ${rate == null ? 'text-ink2/50' : rate < 60 ? 'text-clay' : 'text-ink'}`} data-rate>{rate != null ? `${rate}%` : '—'}</td>
                  {students.map(s => {
                    const v = marks.get(s.id)?.get(p.id)
                    return (
                      <td key={s.id} className="p-0.5 text-center">
                        <button onClick={() => cycle(s, p.id)} data-cell={`${s.id}|${p.id}`}
                          className={`h-8 w-full rounded text-base font-black ${v === 'o' ? 'bg-blue-50 text-blue-600' : v === 'x' ? 'bg-red-50 text-red-500' : 'text-ink2/30 hover:bg-paper2'}`}>
                          {v === 'o' ? '○' : v === 'x' ? '✕' : '·'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {wrongOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6" onClick={() => setWrongOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold">통합 오답관리</h3>
            <p className="mt-1 text-sm text-ink2">한 명이라도 틀린 문제 <b className="text-ink">{wrongs.length}개</b>를 모아 오답 학습지 하나를 만들고, 이 학습지를 받았던 학생 모두에게 냅니다.</p>
            <div className="mt-4 grid gap-2 text-sm">
              {([['same', '틀린 문제 그대로'], ['similar', '1:1 유사 문제'], ['both', '그대로 + 1:1 유사 문제']] as const).map(([k, t]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="gw-way" className="h-4 w-4 accent-pine" checked={way === k} onChange={() => setWay(k)} /> {t}
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm">학습지 문제 수 <b data-wrong-count>{preview.length}</b>개</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setWrongOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">닫기</button>
              <button onClick={makeWrongSheet} disabled={preview.length === 0} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">바로 만들기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
