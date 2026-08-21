import { useEffect, useMemo, useRef, useState } from 'react'
import { useStudentSelf } from './common'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { isCorrect, loadVoca, nextDay, vocaBookOf } from '../../lib/voca'
import type { GradeResult } from '../../types'

// ── 🔤 영어 단어시험 (학생앱) ────────────────────────────────────────────
//
// 뜻을 보고 영단어를 쓴다. 25개(DAY 1회분)를 한 화면에서 쓰고 [채점하기] 한 번.
// 틀린 것만 곧바로 2차 시험 → 그때 맞히면 '실수'로 기록한다(attempts·careless 규약 재사용).
//
// 🔴 결과는 평범한 Grading 으로 남긴다. 그래야 선생님 「오늘 교실」에 오답 수로 뜨고
//    [호출]·지도 패널이 그대로 동작한다 — 화면을 새로 만들 필요가 없다.

type Row = { w: string; mean: string; typed: string; ok?: boolean; retry?: string; ok2?: boolean }

export default function StudentVoca() {
  const me = useStudentSelf()
  const { gradings, workbooks, addWorkbook, upsertGrading } = useStore()
  const today = todayKey()

  // 🔴 학년에 맞는 단어장 — 고등은 고등필수, 중등은 중등필수 (voca.ts vocaBookOf)
  const book0 = useMemo(() => vocaBookOf(me.grade), [me.grade])
  const [all, setAll] = useState<Record<string, [string, string][]> | null>(null)
  const [err, setErr] = useState('')
  const [day, setDay] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [phase, setPhase] = useState<'write' | 'result' | 'retry' | 'done'>('write')
  const firstRef = useRef<HTMLInputElement>(null)

  // 이 학생이 이미 본 DAY (교재 기록의 pageFrom 에 DAY 를 넣어 둔다)
  const book = useMemo(
    () => workbooks.find(w => w.studentId === me.id && w.name === book0.name),
    [workbooks, me.id, book0.name])
  const doneDays = useMemo(() => gradings
    .filter(g => g.studentId === me.id && book && g.workbookId === book.id && g.pageFrom != null)
    .map(g => g.pageFrom as number), [gradings, me.id, book])

  useEffect(() => {
    loadVoca(book0.file).then(d => { setAll(d); setDay(nextDay(doneDays, Object.keys(d).length)) })
      .catch(e => setErr(String(e?.message ?? e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book0.file])

  // DAY 가 정해지면 문항을 세운다
  useEffect(() => {
    if (!all || day == null) return
    const ws = all[String(day)] ?? []
    setRows(ws.map(([w, mean]) => ({ w, mean, typed: '' })))
    setPhase('write')
    setTimeout(() => firstRef.current?.focus(), 50)
  }, [all, day])

  const wrong = rows.filter(r => r.ok === false)
  const score = rows.filter(r => r.ok).length

  function grade() {
    const next = rows.map(r => ({ ...r, ok: isCorrect(r.w, r.typed) }))
    setRows(next)
    setPhase(next.some(r => !r.ok) ? 'result' : 'done')
    if (!next.some(r => !r.ok)) save(next)
  }

  function gradeRetry() {
    const next = rows.map(r => r.ok === false ? { ...r, ok2: isCorrect(r.w, r.retry ?? '') } : r)
    setRows(next); setPhase('done'); save(next)
  }

  // 🔴 교재 1권을 학생당 하나 만들어 두고, DAY 를 pageFrom 에 넣는다 —
  //    "이미 본 DAY"가 공짜로 계산되고 선생님 화면에도 교재명으로 보인다.
  function save(final: Row[]) {
    // addWorkbook 은 id 를 스스로 만들어 돌려준다
    const wbId = book?.id ?? addWorkbook({
      name: book0.name, publisher: '쎄듀',
      grade: me.grade, studentId: me.id })
    const results: GradeResult[] = final.map((r, i) => ({
      itemId: `voca-${day}-${i}`,
      studentAnswer: r.typed,
      correct: !!r.ok || !!r.ok2,
      // 처음 틀렸다가 2차에 맞힘 = 실수. 통계에서 진짜 오답과 분리된다
      attempts: r.ok === false ? 2 : 1,
      careless: r.ok === false && r.ok2 ? true : undefined,
      retryAnswer: r.ok === false ? r.retry : undefined,
    }))
    const exist = gradings.find(g =>
      g.studentId === me.id && g.workbookId === wbId && g.pageFrom === day && dateKey(g.date) === today)
    upsertGrading({
      id: exist?.id ?? uid('gr'),
      studentId: me.id, source: '교재', workbookId: wbId,
      pageFrom: day ?? 1, pageTo: day ?? 1,
      date: new Date().toISOString(), results,
    })
  }

  if (err) return <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-clay">{err}</div>
  if (!all || day == null) return <div className="p-8 text-center text-sm text-ink2">단어를 불러오는 중…</div>

  const finalOk = rows.filter(r => r.ok || r.ok2).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-black">🔤 영어 단어시험</h1>
        <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{book0.name}</span>
        <select value={day} onChange={e => setDay(Number(e.target.value))}
          className="rounded-lg border border-line bg-white px-2.5 py-1 text-sm font-bold">
          {Array.from({ length: Object.keys(all).length }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>DAY {d}{doneDays.includes(d) ? ' ✓' : ''}</option>
          ))}
        </select>
        <span className="text-sm text-ink2">{rows.length}단어 · 뜻을 보고 영어로 쓰세요</span>
      </div>

      {phase === 'write' && (
        <>
          <div className="grid gap-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <span className="w-6 shrink-0 text-xs font-bold text-ink2">{i + 1}</span>
                <span className="min-w-0 grow text-sm">{r.mean}</span>
                <input ref={i === 0 ? firstRef : undefined}
                  value={r.typed} onChange={e => setRows(p => p.map((x, k) => k === i ? { ...x, typed: e.target.value } : x))}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    const next = e.currentTarget.closest('div')?.parentElement?.children[i + 1]
                    next?.querySelector('input')?.focus()
                  }}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  placeholder="영어로" aria-label={`${i + 1}번 답`}
                  className="w-40 shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-pine" />
              </div>
            ))}
          </div>
          <button onClick={grade}
            className="rounded-lg bg-pine py-3 text-sm font-bold text-paper hover:brightness-110">
            채점하기 ({rows.filter(r => r.typed.trim()).length}/{rows.length} 입력)
          </button>
        </>
      )}

      {phase === 'result' && (
        <>
          <div className="rounded-2xl bg-pine-soft px-4 py-3">
            <b className="text-pine-dark">{rows.length}개 중 {score}개 맞았어요.</b>
            <span className="ml-2 text-sm text-ink2">틀린 {wrong.length}개만 다시 써볼까요?</span>
          </div>
          <div className="grid gap-1.5">
            {rows.map((r, i) => r.ok === false && (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-clay/40 bg-red-50 px-3 py-2">
                <span className="min-w-0 grow text-sm">{r.mean}</span>
                <span className="shrink-0 text-xs text-ink2">쓴 답 <b className="text-clay">{r.typed || '—'}</b></span>
                <input value={r.retry ?? ''}
                  onChange={e => setRows(p => p.map((x, k) => k === i ? { ...x, retry: e.target.value } : x))}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  placeholder="다시" aria-label={`${i + 1}번 재시도`}
                  className="w-32 shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-pine" />
              </div>
            ))}
          </div>
          <button onClick={gradeRetry}
            className="rounded-lg bg-pine py-3 text-sm font-bold text-paper hover:brightness-110">다시 채점하기</button>
        </>
      )}

      {phase === 'done' && (
        <>
          <div className="rounded-2xl bg-pine-soft px-4 py-4">
            <div className="text-lg font-black text-pine-dark">
              DAY {day} — {rows.length}개 중 {finalOk}개
            </div>
            <p className="mt-1 text-sm text-ink2">
              {rows.length - finalOk > 0
                ? `아직 ${rows.length - finalOk}개가 남았어요. 선생님께 물어보고 다시 외워봐요.`
                : '다 맞았어요! 내일 다음 DAY로 이어가요.'}
            </p>
          </div>
          <div className="grid gap-1.5">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                r.ok ? 'border-line bg-white' : r.ok2 ? 'border-amber/40 bg-amber-soft/40' : 'border-clay/40 bg-red-50'}`}>
                <span className="w-5 shrink-0">{r.ok ? '○' : r.ok2 ? '△' : '✕'}</span>
                <b className="w-40 shrink-0">{r.w}</b>
                <span className="min-w-0 grow text-ink2">{r.mean}</span>
                {!r.ok && <span className="shrink-0 text-xs text-ink2">쓴 답 {r.typed || '—'}{r.retry ? ` → ${r.retry}` : ''}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
