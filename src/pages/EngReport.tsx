import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, uid } from '../lib/store'
import { CURRICULA, typeName } from '../data/curriculum'
import { DEFAULT_SHEET_OPTIONS, type Problem } from '../types'
import { grammarName, grammarOf, grammarStats, rate, recommendEng } from '../lib/engGrammar'

// 🔤 영어 문법 성장 리포트 + 오답 추천 학습지 (2026-11-10 workerE — 잉글리시플랫 «문법 성장 리포트»·«오답 추천 학습지» 대응)
// 학생의 영어 채점 기록을 ① 문법 개념별(해설 낱말로 붙임, lib/engGrammar) ② 유형별(독해·어법·서술형)로 모아
// 이번 기간 ↔ 지난 기간 정답률을 나란히 보이고, 약한 것에서 아직 안 푼 문항으로 학습지를 만든다.
// 데이터는 전부 스토어에서 다시 계산한다 — 저장 테이블 없음. 인쇄(.note-print)로 학부모 배포.

const PERIODS = [{ label: '최근 4주', days: 28 }, { label: '최근 8주', days: 56 }, { label: '최근 12주', days: 84 }]
const baseGrade = (g: string) => g.slice(0, 2)   // '중2-1' → '중2'

export default function EngReport() {
  const { students, worksheets, gradings, problems, ensureCourse, saveWorksheet, addAssignment } = useStore()
  const nav = useNavigate()
  const active = useMemo(() => students.filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [students])
  const [sid, setSid] = useState('')
  const [days, setDays] = useState(28)
  const [count, setCount] = useState(20)
  const student = active.find(s => s.id === sid)

  // 학생 학년의 영어 과정(공통 + 교과서별) 문항을 불러온다 — 채점 기록의 문항 글을 읽어야 개념을 붙일 수 있다
  const courses = useMemo(() => student ? CURRICULA.filter(c => c.subject === '영어' && baseGrade(c.grade) === baseGrade(student.grade)).map(c => c.id) : [], [student])
  useEffect(() => { courses.forEach(c => ensureCourse(c)) }, [courses, ensureCourse])

  const pmap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])

  const data = useMemo(() => {
    if (!student) return null
    const now = Date.now()
    const since = new Date(now - days * 864e5).toISOString()
    const from = new Date(now - days * 2 * 864e5).toISOString()
    const rows: { problem?: Problem; correct: boolean; date: string }[] = []
    const solved = new Set<string>()
    const books = new Map<string, number>()
    for (const g of gradings) {
      if (g.studentId !== student.id || g.date < from) continue
      const ws = g.worksheetId ? worksheets.find(w => w.id === g.worksheetId) : undefined
      g.results.forEach((r, i) => {
        const pid = r.itemId ?? ws?.problemIds[i]
        const p = pid ? pmap.get(pid) : undefined
        if (!p || !p.typeId.includes('eng')) return
        solved.add(p.id)
        if (p.book) books.set(p.book, (books.get(p.book) ?? 0) + 1)
        rows.push({ problem: p, correct: r.correct, date: g.date })
      })
    }
    // 이미 푼 문항은 기간과 상관없이 추천에서 뺀다
    for (const g of gradings) if (g.studentId === student.id) {
      const ws = g.worksheetId ? worksheets.find(w => w.id === g.worksheetId) : undefined
      g.results.forEach((r, i) => { const pid = r.itemId ?? ws?.problemIds[i]; if (pid) solved.add(pid) })
    }
    const gStats = grammarStats(rows, since)
    const tAcc = new Map<string, { total: number; wrong: number; prevTotal: number; prevWrong: number }>()
    for (const r of rows) {
      const t = r.problem!.typeId
      const s = tAcc.get(t) ?? { total: 0, wrong: 0, prevTotal: 0, prevWrong: 0 }
      if (r.date >= since) { s.total++; if (!r.correct) s.wrong++ } else { s.prevTotal++; if (!r.correct) s.prevWrong++ }
      tAcc.set(t, s)
    }
    const tStats = [...tAcc.entries()].map(([typeId, s]) => ({ typeId, ...s })).sort((a, b) => b.wrong - a.wrong)
    const cur = rows.filter(r => r.date >= since)
    const book = [...books.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    return { gStats, tStats, solved, book, curTotal: cur.length, curWrong: cur.filter(r => !r.correct).length, tagged: cur.filter(r => grammarOf(r.problem).length).length }
  }, [student, gradings, worksheets, pmap, days])

  const weakG = useMemo(() => (data?.gStats ?? []).filter(s => s.wrong > 0).sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong).slice(0, 4).map(s => s.id), [data])
  const weakT = useMemo(() => (data?.tStats ?? []).filter(s => s.wrong > 0).slice(0, 3).map(s => s.typeId), [data])
  const pool = useMemo(() => problems.filter(p => courses.some(c => p.typeId.startsWith(c + '-'))), [problems, courses])
  const rec = useMemo(() => data ? recommendEng({ pool, weakGrammar: weakG, weakTypes: weakT, solved: data.solved, book: data.book, count }) : [], [data, pool, weakG, weakT, count])

  function makeSheet(assign: boolean) {
    if (!student || !rec.length) return
    const id = uid('ws')
    saveWorksheet({
      id, title: `${student.name} 영어 오답 추천 ${new Date().toLocaleDateString('ko-KR')}`, author: '', subject: '영어',
      grade: student.grade, tags: ['오답 추천', '영어'], theme: 'pine', problemIds: rec.map(p => p.id), conceptIds: [],
      options: DEFAULT_SHEET_OPTIONS, listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
    })
    if (assign) addAssignment(id, [student.id], '숙제')
    nav(`/worksheet/${id}`)
  }

  const arrow = (now: number | null, prev: number | null) => now == null || prev == null ? '' : now > prev ? `▲${now - prev}` : now < prev ? `▼${prev - now}` : '–'

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">영어 문법 성장 리포트 · 오답 추천</h1>
        <select value={sid} onChange={e => setSid(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="">학생 고르기</option>
          {active.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
        </select>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label} (앞 기간과 비교)</option>)}
        </select>
        <div className="grow" />
        {student && <button onClick={() => window.print()} className="rounded-lg border border-line px-4 py-2 text-sm">🖨 리포트 인쇄</button>}
      </div>

      {!student && <p className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink2">학생을 고르면 영어 채점 기록을 <b>문법 개념별</b>·<b>유형별</b>로 모아 보여 주고, 약한 곳에서 안 푼 문항으로 <b>오답 추천 학습지</b>를 만듭니다.</p>}

      {student && data && (
        <div className="note-print space-y-6">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="text-lg font-bold">{student.name} · {student.grade} 영어</div>
            <div className="mt-1 text-sm text-ink2">
              {PERIODS.find(p => p.days === days)?.label} 영어 {data.curTotal}문항 · 정답률 {rate(data.curTotal, data.curWrong) ?? '—'}%
              {data.book && <> · 교과서 {data.book}</>}
              {data.curTotal > 0 && <> · 문법 개념이 붙은 문항 {data.tagged}개(해설에 문법 설명이 있는 문항)</>}
            </div>
          </div>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-3 font-bold">문법 개념별 정답률</h2>
            {data.gStats.length === 0 ? <p className="text-sm text-ink2">이 기간에 문법 개념이 붙은 채점 기록이 없습니다.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-ink2"><th className="py-2">개념</th><th>이번 기간</th><th>앞 기간</th><th>변화</th><th className="w-1/3" /></tr></thead>
                <tbody>{data.gStats.map(s => {
                  const now = rate(s.total, s.wrong), prev = rate(s.prevTotal, s.prevWrong)
                  return (
                    <tr key={s.id} className="border-b border-line/60">
                      <td className="py-2 font-bold">{s.name}{weakG.includes(s.id) && <span className="ml-2 rounded bg-red-100 px-1.5 text-[11px] text-red-800">보충</span>}</td>
                      <td>{now ?? '—'}{now != null && '%'} <span className="text-xs text-ink2">({s.total - s.wrong}/{s.total})</span></td>
                      <td className="text-ink2">{prev ?? '—'}{prev != null && '%'}</td>
                      <td className={(now ?? 0) >= (prev ?? 0) ? 'text-pine' : 'text-clay'}>{arrow(now, prev)}</td>
                      <td><div className="h-2 rounded bg-paper2"><div className="h-2 rounded bg-pine" style={{ width: `${now ?? 0}%` }} /></div></td>
                    </tr>)
                })}</tbody>
              </table>)}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-3 font-bold">유형별(독해·어법·서술형) 오답</h2>
            {data.tStats.length === 0 ? <p className="text-sm text-ink2">채점 기록이 없습니다.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-ink2"><th className="py-2">유형</th><th>이번 기간</th><th>앞 기간</th></tr></thead>
                <tbody>{data.tStats.slice(0, 12).map(s => (
                  <tr key={s.typeId} className="border-b border-line/60">
                    <td className="py-2">{typeName(s.typeId)}{weakT.includes(s.typeId) && <span className="ml-2 rounded bg-red-100 px-1.5 text-[11px] text-red-800">보충</span>}</td>
                    <td>{rate(s.total, s.wrong) ?? '—'}{s.total > 0 && '%'} <span className="text-xs text-ink2">(오답 {s.wrong}/{s.total})</span></td>
                    <td className="text-ink2">{rate(s.prevTotal, s.prevWrong) ?? '—'}{s.prevTotal > 0 && '%'}</td>
                  </tr>))}</tbody>
              </table>)}
          </section>

          <section className="no-print rounded-2xl border border-amber/40 bg-amber-soft/40 p-5">
            <h2 className="mb-2 font-bold">오답 추천 학습지</h2>
            <p className="mb-3 text-sm text-ink2">«보충» 표시한 문법 개념(2/3)·유형(1/3)에서 <b>아직 안 푼 문항</b>만 고릅니다{data.book && <> — {data.book} 교과서 문항 먼저</>}. 정답 없는 문항·서술형 자기채점 문항은 뺍니다.</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">문항 수 <select value={count} onChange={e => setCount(Number(e.target.value))} className="ml-1 rounded border border-line bg-white px-2 py-1">{[10, 15, 20, 25, 30].map(n => <option key={n}>{n}</option>)}</select></label>
              <span className="text-sm">고른 문항 <b>{rec.length}</b>개</span>
              <div className="grow" />
              <button disabled={!rec.length} onClick={() => makeSheet(false)} className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine disabled:opacity-40">학습지로 만들기</button>
              <button disabled={!rec.length} onClick={() => makeSheet(true)} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">만들고 숙제로 내기</button>
            </div>
            {rec.length > 0 && <ul className="mt-3 max-h-56 space-y-1 overflow-auto text-xs text-ink2">{rec.map((p, i) => (
              <li key={p.id}>{i + 1}. [{grammarOf(p).map(grammarName).join('·') || typeName(p.typeId)}] {p.body.replace(/\s+/g, ' ').slice(0, 70)}…</li>))}</ul>}
            {!rec.length && <p className="mt-2 text-xs text-ink2">{weakG.length + weakT.length ? '고를 문항이 없습니다(약한 곳 문항을 다 풀었거나 문항을 불러오는 중).' : '틀린 기록이 없어 추천할 곳이 없습니다.'}</p>}
          </section>
        </div>
      )}
    </div>
  )
}
