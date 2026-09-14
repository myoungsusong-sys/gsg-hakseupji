import { useEffect, useMemo, useRef, useState } from 'react'
import { useStudentSelf } from './common'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import {
  flattenVoca, isCorrect, isMeaningCorrect, isVocaReviewGrading, loadVoca, mergeVocaResults, MODE_LABEL, planVoca,
  vocaItemId, vocaLevelOf, vocaReviewQueue, vocaSessions, vocaSettingsOf, vocaWorkbookOf, type VocaFlat, type VocaMode,
} from '../../lib/voca'
import type { GradeResult } from '../../types'

// ── 🔤 영어 단어시험 (학생앱) ────────────────────────────────────────────
//
// 🎚️ 2026-09-14 — 책·하루 분량·시험 종류를 **선생님이 학생마다** 정한다(수업 > 학생 > 영어단어).
//   · 단어시험: 뜻을 보고 영단어를 쓴다 → 자동채점, 틀린 것만 곧바로 2차 시험(맞히면 '실수').
//   · 뜻시험  : 영단어를 보고 뜻을 쓴다 → 책에 적힌 뜻 중 하나와 맞으면 자동 정답.
//               안 맞으면 책의 뜻을 보여 주고 **학생이 ○/✕ 를 고른다**(self 표시).
//   · 진도는 단어 번호로 센다 — 오늘 범위를 끝내면 다음 날은 마지막 단어 다음부터.
// 🔁 2026-09-14 — **틀린 단어는 다음 날부터 '오답 복습'으로 다시 나온다**(맞힐 때까지, 하루 분량만큼).
//   들어오면 복습부터 하고, 끝나면 오늘 새 단어로 넘어간다.
//
// 🔴 결과는 평범한 Grading 으로 남긴다(교재 = 학생별 단어장). 복습은 pageFrom 없이 rw-/rm- 로 저장한다.

type Row = { no: number; w: string; mean: string; typed: string; ok?: boolean; retry?: string; ok2?: boolean }
type Phase = 'write' | 'result' | 'judge' | 'done'
type Target = { kind: 'range'; from: number; to: number } | { kind: 'review' }
const short = (m: VocaMode) => MODE_LABEL[m].split(' ')[0]

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
  const mine = useMemo(() => gradings.filter(g => g.studentId === me.id), [gradings, me.id])
  const sessions = useMemo(() => (flat ? vocaSessions(mine, book?.id, flat) : []), [flat, mine, book?.id])
  const plan = useMemo(
    () => (flat ? planVoca(settings, sessions, flat.words.length, today) : null),
    [flat, settings, sessions, today])
  const queue = useMemo(
    () => (flat ? vocaReviewQueue(mine, book?.id, flat, today, settings.perDay) : null),
    [flat, mine, book?.id, today, settings.perDay])
  // 복습 문항은 **시작할 때의 목록**으로 세운다 — 저장하면 대기열이 줄어드는데 그걸 따라 문항이 사라지면 결과 화면이 날아간다
  const queueRef = useRef(queue)
  queueRef.current = queue
  const reviewLeft = queue ? settings.modes.filter(m => queue[m].length > 0 && !queue.doneToday[m]) : []

  const [target, setTarget] = useState<Target | null>(null)
  const [mode, setMode] = useState<VocaMode>('word')
  const [rows, setRows] = useState<Row[]>([])
  const [phase, setPhase] = useState<Phase>('write')
  const [rowsKey, setRowsKey] = useState('')   // 지금 rows 가 어느 시험(범위|종류) 것인가
  const firstRef = useRef<HTMLInputElement>(null)

  // 처음 들어오면 — 오답 복습이 남았으면 **복습부터**, 아니면 오늘 새 범위의 남은 시험
  useEffect(() => {
    if (!plan || !queue || target) return
    if (reviewLeft.length) { setTarget({ kind: 'review' }); setMode(reviewLeft[0]); return }
    if (plan.finished) return
    setTarget({ kind: 'range', from: plan.from, to: plan.to })
    setMode(plan.pending[0] ?? settings.modes[0])
  }, [plan, queue])   // eslint-disable-line react-hooks/exhaustive-deps

  const targetKey = !target ? '' : target.kind === 'review' ? 'review' : `${target.from}-${target.to}`
  useEffect(() => {
    if (!flat || !target) return
    const list = target.kind === 'review' ? (queueRef.current?.[mode] ?? []) : flat.words.slice(target.from - 1, target.to)
    setRows(list.map(x => ({ no: x.no, w: x.w, mean: x.mean, typed: '' })))
    setPhase('write')
    setRowsKey(`${targetKey}|${mode}`)
    setTimeout(() => firstRef.current?.focus(), 50)
  }, [flat, targetKey, mode])   // eslint-disable-line react-hooks/exhaustive-deps

  const cur = target?.kind === 'range'
    ? sessions.find(s => s.from === target.from && s.to === target.to && dateKey(s.date) === today)
    : undefined

  // 볼 수 있는 것 — 오답 복습 · 오늘(또는 다음) 범위 · 지난 범위(복습). 앞질러 건너뛰는 선택지는 두지 않는다.
  const options = useMemo(() => {
    const m = new Map<string, { key: string; label: string; target: Target }>()
    if (queue && (settings.modes.some(x => queue[x].length > 0) || target?.kind === 'review')) {
      m.set('review', { key: 'review', label: `🔁 오답 복습 (${settings.modes.map(x => `${short(x)} ${queue[x].length}`).join(' · ')})`, target: { kind: 'review' } })
    }
    if (plan && !plan.finished) {
      const k = `${plan.from}-${plan.to}`
      m.set(k, { key: k, label: `${plan.doneToday ? '다음 범위' : '오늘'} ${plan.from}~${plan.to}번`, target: { kind: 'range', from: plan.from, to: plan.to } })
    }
    if (target?.kind === 'range' && !m.has(targetKey)) m.set(targetKey, { key: targetKey, label: `${target.from}~${target.to}번`, target })
    for (const s of sessions) {
      const k = `${s.from}-${s.to}`
      if (!m.has(k)) m.set(k, { key: k, label: s.legacyDay ? `지난 DAY ${s.legacyDay} (${s.from}~${s.to}번)` : `지난 ${s.from}~${s.to}번`, target: { kind: 'range', from: s.from, to: s.to } })
    }
    return [...m.values()]
  }, [plan, queue, target, targetKey, sessions, settings.modes])

  const wrong = rows.filter(r => r.ok === false)
  const firstOk = rows.filter(r => r.ok).length
  const finalOk = rows.filter(r => r.ok || r.ok2).length
  // 내일 오답 복습에 다시 나올 수 — 단어시험은 2차에 맞혀도(실수) 나온다, 뜻시험은 스스로 ○ 고르면 안 나온다
  const again = rows.filter(r => !r.ok && (mode === 'word' || !r.ok2)).length

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
    if (!target || !final.length) return
    const review = target.kind === 'review'
    const wbId = book?.id ?? addWorkbook({
      name: settings.book.name, publisher: '쎄듀', grade: me.grade, studentId: me.id, subject: '영어' })
    const results: GradeResult[] = final.map(r => mode === 'word'
      ? {
          itemId: vocaItemId('word', r.no, review), studentAnswer: r.typed, correct: !!r.ok || !!r.ok2,
          attempts: r.ok === false ? 2 : 1,                       // 처음 틀렸다가 2차에 맞힘 = 실수
          careless: r.ok === false && r.ok2 ? true : undefined,
          retryAnswer: r.ok === false ? r.retry : undefined,
        }
      : {
          itemId: vocaItemId('meaning', r.no, review), studentAnswer: r.typed, correct: !!r.ok || !!r.ok2,
          self: r.ok === false ? true : undefined,              // 기계가 못 맞춰 학생이 스스로 판정한 것
        })
    const exist = gradings.find(g => g.studentId === me.id && g.workbookId === wbId && dateKey(g.date) === today
      && (review ? isVocaReviewGrading(g) : g.pageFrom === target.from && g.pageTo === target.to))
    upsertGrading({
      id: exist?.id ?? uid('gr'),
      studentId: me.id, source: '교재', workbookId: wbId,
      ...(review ? {} : { pageFrom: target.from, pageTo: target.to }),
      date: new Date().toISOString(),
      results: mergeVocaResults(exist?.results ?? [], mode, results, review),
    })
  }

  if (err) return <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-clay">{err}</div>
  if (!flat || !plan || !queue) return <div className="p-8 text-center text-sm text-ink2">단어를 불러오는 중…</div>
  if (!target) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <div className="text-3xl">🎉</div>
        <p className="mt-2 font-black text-pine-dark">{settings.book.name} 을 끝까지 다 봤어요!</p>
        <p className="mt-1 text-sm text-ink2">선생님께 다음 단어장을 정해 달라고 말해 주세요.</p>
      </div>
    )
  }

  const isReview = target.kind === 'review'
  const isWord = mode === 'word'
  // 🔴 시험 종류를 바꾸면 문항은 effect 로 다시 세운다 → 그 사이 한 프레임 동안 이전 시험 결과가 비친다. 그 틈엔 문항을 그리지 않는다.
  const ready = rowsKey === `${targetKey}|${mode}`
  const tabModes = isReview
    ? settings.modes.filter(m => queue[m].length > 0 || queue.doneToday[m] || m === mode)
    : settings.modes
  const doneMark = (m: VocaMode) => (isReview ? queue.doneToday[m] : !!cur?.[m])
  const otherPending = isReview
    ? settings.modes.filter(m => m !== mode && queue[m].length > 0 && !queue.doneToday[m])
    : settings.modes.filter(m => m !== mode && !cur?.[m])
  const startRange = () => {
    if (!plan.finished) { setTarget({ kind: 'range', from: plan.from, to: plan.to }); setMode(plan.pending[0] ?? settings.modes[0]) }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-black">🔤 영어 단어시험</h1>
        <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{settings.book.name}</span>
        <span className="text-xs text-ink2">{vocaLevelOf(settings.book)} · 하루 {settings.perDay}개</span>
        <select value={targetKey}
          onChange={e => { const o = options.find(x => x.key === e.target.value); if (!o) return
            setTarget(o.target)
            if (o.target.kind === 'review') { const rl = settings.modes.filter(m => queue[m].length > 0); if (rl.length) setMode(rl[0]) } }}
          className="rounded-lg border border-line bg-white px-2.5 py-1 text-sm font-bold">
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {isReview && (
        <div className="rounded-xl border border-amber/40 bg-amber-soft/40 px-4 py-2.5 text-sm">
          <b>🔁 오답 복습</b> — 전에 틀린 단어를 다시 봅니다. <b>맞히면 복습에서 빠지고</b>, 또 틀리면 내일 다시 나와요.
        </div>
      )}

      {tabModes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {tabModes.map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
                mode === m ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:border-pine'}`}>
              {MODE_LABEL[m]}{isReview && !queue.doneToday[m] ? ` ${queue[m].length}` : ''}{doneMark(m) ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      {ready && phase === 'write' && rows.length === 0 && (
        <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-ink2">
          {isReview ? `${short(mode)} 오답 복습할 단어가 없어요.` : '볼 단어가 없어요.'}
          {isReview && !plan.finished && (
            <button onClick={startRange} className="mt-3 block w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper">
              오늘 새 단어 {plan.from}~{plan.to}번 시작 →
            </button>
          )}
        </div>
      )}

      {ready && phase === 'write' && rows.length > 0 && (
        <>
          <p className="text-sm text-ink2">
            {rows.length}단어{isReview ? ' · 오답 복습' : ''} · {isWord ? '뜻을 보고 영어로 쓰세요' : '영어 단어를 보고 우리말 뜻을 쓰세요'}
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

      {ready && phase === 'result' && (
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

      {ready && phase === 'judge' && (
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

      {ready && phase === 'done' && (
        <>
          <div className="rounded-2xl bg-pine-soft px-4 py-4">
            <div className="text-lg font-black text-pine-dark">
              {MODE_LABEL[mode]} · {isReview ? '오답 복습' : `${target.from}~${target.to}번`} — {rows.length}개 중 {finalOk}개
            </div>
            <p className="mt-1 text-sm text-ink2">
              {again > 0
                ? `처음에 틀린 ${again}개는 내일 오답 복습으로 다시 나와요.`
                : isReview ? '다 맞혔어요! 복습에서 모두 빠졌어요.' : '다 맞았어요!'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {otherPending.length > 0 && (
                <button onClick={() => setMode(otherPending[0])}
                  className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">
                  {MODE_LABEL[otherPending[0]]}{isReview ? ' 오답 복습' : ''} 보러 가기 →
                </button>
              )}
              {otherPending.length === 0 && isReview && !plan.finished && (
                <button onClick={startRange} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">
                  오늘 새 단어 {plan.from}~{plan.to}번 시작 →
                </button>
              )}
              {otherPending.length === 0 && !isReview && reviewLeft.length > 0 && (
                <button onClick={() => { setTarget({ kind: 'review' }); setMode(reviewLeft[0]) }}
                  className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">🔁 오답 복습 하러 가기 →</button>
              )}
              {otherPending.length === 0 && !isReview && reviewLeft.length === 0 && plan.doneToday && !plan.finished && target.from !== plan.from && (
                <button onClick={() => setTarget({ kind: 'range', from: plan.from, to: plan.to })}
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
