import { useEffect, useMemo, useRef, useState } from 'react'
import { useStudentSelf } from './common'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import {
  flattenVoca, isCorrect, isMeaningCorrect, loadVoca, mergeVocaResults, MODE_LABEL, planVoca,
  vocaItemId, vocaLevelOf, vocaSessions, vocaSettingsOf, vocaWorkbookOf, type VocaFlat, type VocaMode,
} from '../../lib/voca'
import type { GradeResult } from '../../types'

// ── 🔤 영어 단어시험 (학생앱) ────────────────────────────────────────────
//
// 🎚️ 2026-09-14 — 책·하루 분량·시험 종류를 **선생님이 학생마다** 정한다(수업 > 학생 > 영어단어).
//   · 단어시험: 뜻을 보고 영단어를 쓴다 → 자동채점, 틀린 것만 곧바로 2차 시험(맞히면 '실수').
//   · 뜻시험  : 영단어를 보고 뜻을 쓴다 → 책에 적힌 뜻 중 하나와 맞으면 자동 정답.
//               안 맞으면 책의 뜻을 보여 주고 **학생이 ○/✕ 를 고른다**. 뜻은 표현이 여러 갈래라
//               기계 대조만 하면 맞게 쓴 학생을 오답 처리하게 된다. 자기판정은 self 표시로 남긴다.
//   · 진도는 단어 번호로 센다 — 오늘 범위를 끝내면 다음 날은 마지막 단어 다음부터.
//
// 🔴 결과는 평범한 Grading 으로 남긴다(교재 = 학생별 단어장). 「오늘 교실」·호출·지도 패널이 그대로 동작한다.

type Row = { no: number; w: string; mean: string; typed: string; ok?: boolean; retry?: string; ok2?: boolean }
type Phase = 'write' | 'result' | 'judge' | 'done'

export default function StudentVoca() {
  const me = useStudentSelf()
  const { gradings, workbooks, addWorkbook, upsertGrading } = useStore()
  const today = todayKey()
  const settings = useMemo(() => vocaSettingsOf(me), [me.grade, me.voca])   // eslint-disable-line react-hooks/exhaustive-deps

  const [flat, setFlat] = useState<VocaFlat | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    setFlat(null); setErr('')
    loadVoca(settings.book.file).then(d => setFlat(flattenVoca(settings.book.file, d)))
      .catch(e => setErr(String(e?.message ?? e)))
  }, [settings.book.file])

  const book = vocaWorkbookOf(workbooks, me.id, settings.book)
  const sessions = useMemo(
    () => (flat ? vocaSessions(gradings.filter(g => g.studentId === me.id), book?.id, flat) : []),
    [flat, gradings, me.id, book?.id])
  const plan = useMemo(
    () => (flat ? planVoca(settings, sessions, flat.words.length, today) : null),
    [flat, settings, sessions, today])

  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const [mode, setMode] = useState<VocaMode>('word')
  const [rows, setRows] = useState<Row[]>([])
  const [phase, setPhase] = useState<Phase>('write')
  const firstRef = useRef<HTMLInputElement>(null)

  // 처음 들어오면 **오늘 할 범위 · 남은 시험**으로 맞춘다
  useEffect(() => {
    if (!plan || range || plan.finished) return
    setRange({ from: plan.from, to: plan.to })
    setMode(plan.pending[0] ?? settings.modes[0])
  }, [plan])   // eslint-disable-line react-hooks/exhaustive-deps

  // 범위나 시험이 바뀌면 문항을 새로 세운다
  useEffect(() => {
    if (!flat || !range) return
    setRows(flat.words.slice(range.from - 1, range.to).map(x => ({ no: x.no, w: x.w, mean: x.mean, typed: '' })))
    setPhase('write')
    setTimeout(() => firstRef.current?.focus(), 50)
  }, [flat, range, mode])

  const cur = range
    ? sessions.find(s => s.from === range.from && s.to === range.to && dateKey(s.date) === today)
    : undefined

  // 볼 수 있는 범위 — 오늘(또는 다음) 범위 + 지난 범위(복습). 앞질러 건너뛰는 선택지는 두지 않는다.
  const options = useMemo(() => {
    const m = new Map<string, { from: number; to: number; label: string }>()
    if (plan && !plan.finished) {
      m.set(`${plan.from}-${plan.to}`, { from: plan.from, to: plan.to, label: `${plan.doneToday ? '다음 범위' : '오늘'} ${plan.from}~${plan.to}번` })
    }
    if (range && !m.has(`${range.from}-${range.to}`)) m.set(`${range.from}-${range.to}`, { ...range, label: `${range.from}~${range.to}번` })
    for (const s of sessions) {
      const k = `${s.from}-${s.to}`
      if (!m.has(k)) m.set(k, { from: s.from, to: s.to, label: s.legacyDay ? `지난 DAY ${s.legacyDay} (${s.from}~${s.to}번)` : `지난 ${s.from}~${s.to}번` })
    }
    return [...m.values()]
  }, [plan, range, sessions])

  const wrong = rows.filter(r => r.ok === false)
  const firstOk = rows.filter(r => r.ok).length
  const finalOk = rows.filter(r => r.ok || r.ok2).length

  function grade() {
    const next = rows.map(r => ({ ...r, ok: mode === 'word' ? isCorrect(r.w, r.typed) : isMeaningCorrect(r.mean, r.typed) }))
    setRows(next)
    if (!next.some(r => !r.ok)) { setPhase('done'); save(next); return }
    setPhase(mode === 'word' ? 'result' : 'judge')
  }
  function finishRetry() {
    const next = rows.map(r => r.ok === false ? { ...r, ok2: isCorrect(r.w, r.retry ?? '') } : r)
    setRows(next); setPhase('done'); save(next)
  }
  function judge(i: number, v: boolean) {
    setRows(p => p.map((x, k) => k === i ? { ...x, ok2: v } : x))
  }
  function finishJudge() { setPhase('done'); save(rows) }

  function save(final: Row[]) {
    if (!range) return
    const wbId = book?.id ?? addWorkbook({
      name: settings.book.name, publisher: '쎄듀', grade: me.grade, studentId: me.id, subject: '영어' })
    const results: GradeResult[] = final.map(r => mode === 'word'
      ? {
          itemId: vocaItemId('word', r.no), studentAnswer: r.typed, correct: !!r.ok || !!r.ok2,
          // 처음 틀렸다가 2차에 맞힘 = 실수. 통계에서 진짜 오답과 분리된다
          attempts: r.ok === false ? 2 : 1,
          careless: r.ok === false && r.ok2 ? true : undefined,
          retryAnswer: r.ok === false ? r.retry : undefined,
        }
      : {
          itemId: vocaItemId('meaning', r.no), studentAnswer: r.typed, correct: !!r.ok || !!r.ok2,
          self: r.ok === false ? true : undefined,        // 기계가 못 맞춰 학생이 스스로 판정한 것
        })
    const exist = gradings.find(g => g.studentId === me.id && g.workbookId === wbId
      && g.pageFrom === range.from && g.pageTo === range.to && dateKey(g.date) === today)
    upsertGrading({
      id: exist?.id ?? uid('gr'),
      studentId: me.id, source: '교재', workbookId: wbId,
      pageFrom: range.from, pageTo: range.to,
      date: new Date().toISOString(),
      results: mergeVocaResults(exist?.results ?? [], mode, results),
    })
  }

  if (err) return <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-clay">{err}</div>
  if (!flat || !plan) return <div className="p-8 text-center text-sm text-ink2">단어를 불러오는 중…</div>
  if (!range) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <div className="text-3xl">🎉</div>
        <p className="mt-2 font-black text-pine-dark">{settings.book.name} 을 끝까지 다 봤어요!</p>
        <p className="mt-1 text-sm text-ink2">선생님께 다음 단어장을 정해 달라고 말해 주세요.</p>
      </div>
    )
  }

  const otherPending = settings.modes.filter(m => m !== mode && !cur?.[m])
  const isWord = mode === 'word'

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-black">🔤 영어 단어시험</h1>
        <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{settings.book.name}</span>
        <span className="text-xs text-ink2">{vocaLevelOf(settings.book)} · 하루 {settings.perDay}개</span>
        <select value={`${range.from}-${range.to}`}
          onChange={e => { const o = options.find(x => `${x.from}-${x.to}` === e.target.value); if (o) setRange({ from: o.from, to: o.to }) }}
          className="rounded-lg border border-line bg-white px-2.5 py-1 text-sm font-bold">
          {options.map(o => <option key={`${o.from}-${o.to}`} value={`${o.from}-${o.to}`}>{o.label}</option>)}
        </select>
      </div>

      {settings.modes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {settings.modes.map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
                mode === m ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:border-pine'}`}>
              {MODE_LABEL[m]}{cur?.[m] ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      {phase === 'write' && (
        <>
          <p className="text-sm text-ink2">
            {rows.length}단어 · {isWord ? '뜻을 보고 영어로 쓰세요' : '영어 단어를 보고 우리말 뜻을 쓰세요'}
          </p>
          <div className="grid gap-1.5">
            {rows.map((r, i) => (
              <div key={r.no} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <span className="w-9 shrink-0 text-xs font-bold text-ink2">{r.no}</span>
                {isWord
                  ? <span className="min-w-0 grow text-sm">{r.mean}</span>
                  : <b className="min-w-0 grow text-[15px]">{r.w}</b>}
                <input ref={i === 0 ? firstRef : undefined}
                  value={r.typed} onChange={e => setRows(p => p.map((x, k) => k === i ? { ...x, typed: e.target.value } : x))}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    const next = e.currentTarget.closest('div')?.parentElement?.children[i + 1]
                    next?.querySelector('input')?.focus()
                  }}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  placeholder={isWord ? '영어로' : '뜻을 우리말로'} aria-label={`${r.no}번 답`}
                  className={`${isWord ? 'w-40' : 'w-52'} shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-pine`} />
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
            <b className="text-pine-dark">{rows.length}개 중 {firstOk}개 맞았어요.</b>
            <span className="ml-2 text-sm text-ink2">틀린 {wrong.length}개만 다시 써볼까요?</span>
          </div>
          <div className="grid gap-1.5">
            {rows.map((r, i) => r.ok === false && (
              <div key={r.no} className="flex items-center gap-3 rounded-xl border border-clay/40 bg-red-50 px-3 py-2">
                <span className="min-w-0 grow text-sm">{r.mean}</span>
                <span className="shrink-0 text-xs text-ink2">쓴 답 <b className="text-clay">{r.typed || '—'}</b></span>
                <input value={r.retry ?? ''}
                  onChange={e => setRows(p => p.map((x, k) => k === i ? { ...x, retry: e.target.value } : x))}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  placeholder="다시" aria-label={`${r.no}번 재시도`}
                  className="w-32 shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-pine" />
              </div>
            ))}
          </div>
          <button onClick={finishRetry}
            className="rounded-lg bg-pine py-3 text-sm font-bold text-paper hover:brightness-110">다시 채점하기</button>
        </>
      )}

      {phase === 'judge' && (
        <>
          <div className="rounded-2xl bg-pine-soft px-4 py-3">
            <b className="text-pine-dark">{rows.length}개 중 {firstOk}개는 책의 뜻과 똑같이 맞았어요.</b>
            <span className="ml-2 text-sm text-ink2">나머지 {wrong.length}개는 책의 뜻과 비교해서 직접 표시해 주세요.</span>
          </div>
          <div className="grid gap-1.5">
            {rows.map((r, i) => r.ok === false && (
              <div key={r.no} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white px-3 py-2">
                <b className="w-36 shrink-0">{r.w}</b>
                <span className="min-w-0 grow text-sm">책의 뜻 <b className="text-pine-dark">{r.mean}</b></span>
                <span className="shrink-0 text-xs text-ink2">내 답 <b className="text-ink">{r.typed || '(빈칸)'}</b></span>
                <div className="flex shrink-0 gap-1">
                  <button disabled={!r.typed.trim()} onClick={() => judge(i, true)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold disabled:opacity-40 ${
                      r.ok2 === true ? 'border-pine bg-pine text-paper' : 'border-line bg-white'}`}>○ 맞게 썼어요</button>
                  <button onClick={() => judge(i, false)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                      r.ok2 === false ? 'border-clay bg-clay text-white' : 'border-line bg-white'}`}>✕ 틀렸어요</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={finishJudge} disabled={wrong.some(r => r.ok2 === undefined)}
            className="rounded-lg bg-pine py-3 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
            결과 저장하기 {wrong.some(r => r.ok2 === undefined) ? `(${wrong.filter(r => r.ok2 === undefined).length}개 남음)` : ''}
          </button>
        </>
      )}

      {phase === 'done' && (
        <>
          <div className="rounded-2xl bg-pine-soft px-4 py-4">
            <div className="text-lg font-black text-pine-dark">
              {MODE_LABEL[mode]} · {range.from}~{range.to}번 — {rows.length}개 중 {finalOk}개
            </div>
            <p className="mt-1 text-sm text-ink2">
              {rows.length - finalOk > 0
                ? `아직 ${rows.length - finalOk}개가 남았어요. 다시 외워 봐요.`
                : '다 맞았어요!'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {otherPending.length > 0 && (
                <button onClick={() => setMode(otherPending[0])}
                  className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">{MODE_LABEL[otherPending[0]]} 보러 가기 →</button>
              )}
              {otherPending.length === 0 && plan.doneToday && !plan.finished && range.from !== plan.from && (
                <button onClick={() => setRange({ from: plan.from, to: plan.to })}
                  className="rounded-lg border border-pine bg-white px-4 py-2 text-sm font-bold text-pine">
                  다음 범위 미리 하기 ({plan.from}~{plan.to}번)
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            {rows.map(r => (
              <div key={r.no} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                r.ok ? 'border-line bg-white' : r.ok2 ? 'border-amber/40 bg-amber-soft/40' : 'border-clay/40 bg-red-50'}`}>
                <span className="w-5 shrink-0">{r.ok ? '○' : r.ok2 ? (isWord ? '△' : '○') : '✕'}</span>
                <b className="w-40 shrink-0">{r.w}</b>
                <span className="min-w-0 grow text-ink2">{r.mean}</span>
                {!r.ok && (
                  <span className="shrink-0 text-xs text-ink2">
                    쓴 답 {r.typed || '—'}{isWord && r.retry ? ` → ${r.retry}` : ''}{!isWord && r.ok2 ? ' · 직접 인정' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
