import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import {
  flattenVoca, loadVoca, MODE_LABEL, nextWordNo, PER_DAY_OPTIONS, planVoca, VOCA_BOOKS, vocaBookOf, vocaLevelOf,
  vocaReviewQueue, vocaReviews, vocaSessions, vocaSettingsOf, vocaWorkbookOf, type VocaFlat, type VocaMode, type VocaModeResult,
} from '../../lib/voca'
import type { Student } from '../../types'

// ── 🔤 영어단어 (수업 > 학생 탭) ─────────────────────────────────────────────
//
// 명수쌤 2026-08-25: "학습지앱에 영어단어 항목 만들어줘."
// 🎚️ 2026-09-14: "하루분량은 선택하게 해주고 2번(중등필수 책)도 선택하게 해주고 3번(뜻시험)도 해주고"
//   → 학년 대신 **영단어 수준진단 테스트** 결과로 선생님이 학생마다
//     단어장(6권) · 하루 분량 · 시험 종류(단어시험/뜻시험)를 고른다.
//
// 🔴 새 저장소를 만들지 않는다. 학생앱 단어시험 결과(평범한 Grading)를 읽어 보여 주기만 한다.
//    설정만 Student.voca 에 저장한다.

export default function VocaPanel({ student }: { student: Student }) {
  const { gradings, workbooks, updateStudent } = useStore()
  const settings = useMemo(() => vocaSettingsOf(student), [student.grade, student.voca])   // eslint-disable-line react-hooks/exhaustive-deps
  const [flat, setFlat] = useState<VocaFlat | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    setFlat(null); setErr('')
    loadVoca(settings.book.file).then(d => setFlat(flattenVoca(settings.book.file, d)))
      .catch(e => setErr(String(e?.message ?? e)))
  }, [settings.book.file])

  const mine = useMemo(() => gradings.filter(g => g.studentId === student.id), [gradings, student.id])
  const wb = vocaWorkbookOf(workbooks, student.id, settings.book)
  const sessions = useMemo(() => (flat ? vocaSessions(mine, wb?.id, flat) : []), [flat, mine, wb?.id])
  const total = flat?.words.length ?? 0
  const plan = flat ? planVoca(settings, sessions, total, todayKey()) : null
  const doneWords = nextWordNo(sessions) - 1
  // 🔁 오답 복습 — 전에 틀려서 오늘 다시 볼 단어 (시험별, 하루 분량까지)
  const queue = flat ? vocaReviewQueue(mine, wb?.id, flat, todayKey(), settings.perDay) : null
  const reviewWaiting = queue ? settings.modes.reduce((a, m) => a + queue.waiting[m], 0) : 0
  const reviews = useMemo(() => vocaReviews(mine, wb?.id), [mine, wb?.id])
  type Rec = { key: string; label: string; date: string; word?: VocaModeResult; meaning?: VocaModeResult; review: boolean }
  const records: Rec[] = [
    ...sessions.map(s => ({ key: s.gradingId, label: s.legacyDay ? `DAY ${s.legacyDay}` : `${s.from}~${s.to}번`, date: s.date, word: s.word, meaning: s.meaning, review: false })),
    ...reviews.map(r => ({ key: r.gradingId, label: '🔁 오답 복습', date: r.date, word: r.word, meaning: r.meaning, review: true })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const avg = (m: VocaMode) => {
    const xs = sessions.map(s => s[m]).filter((x): x is VocaModeResult => !!x)
    return xs.length ? Math.round(xs.reduce((a, x) => a + x.right / x.total, 0) / xs.length * 100) : null
  }
  // 이전에 다른 단어장으로 본 기록 — 책을 바꿔도 예전 기록이 사라진 것처럼 보이면 안 된다
  const others = VOCA_BOOKS
    .filter(b => b.book.key !== settings.book.key)
    .map(b => ({ b, w: vocaWorkbookOf(workbooks, student.id, b.book) }))
    .map(({ b, w }) => ({ name: b.book.name, n: w ? mine.filter(g => g.workbookId === w.id).length : 0 }))
    .filter(x => x.n > 0)

  const save = (patch: NonNullable<Student['voca']>) =>
    updateStudent(student.id, { voca: { book: settings.book.key, perDay: settings.perDay, modes: settings.modes, ...patch } })
  const toggleMode = (m: VocaMode) => {
    const has = settings.modes.includes(m)
    const next = (['word', 'meaning'] as VocaMode[]).filter(x => (x === m ? !has : settings.modes.includes(x)))
    if (next.length) save({ modes: next })            // 하나는 남겨야 시험을 볼 수 있다
  }
  const perDayOptions = [...new Set([...PER_DAY_OPTIONS, settings.perDay])].sort((a, b) => a - b)

  const card = 'rounded-2xl border border-line bg-white p-5'
  const chip = (x: VocaModeResult | undefined, label: string) => {
    if (!x) return null
    const sc = Math.round(x.right / x.total * 100)
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
        sc >= 90 ? 'bg-pine-soft text-pine-dark' : sc >= 70 ? 'bg-amber-soft text-amber' : 'bg-red-100 text-red-800'}`}>
        {label} {x.right}/{x.total}
      </span>
    )
  }

  return (
    <div className="grid gap-4">
      <div className={card}>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-black">🔤 영어단어</h2>
          <span className="rounded-full bg-paper2 px-2.5 py-1 text-xs font-semibold text-ink2">{settings.book.name}</span>
          <span className="text-xs text-ink2">{vocaLevelOf(settings.book)} · 하루 {settings.perDay}개 · {settings.modes.map(m => MODE_LABEL[m].split(' ')[0]).join(' + ')}</span>
        </div>

        {/* 🎚️ 설정 — 수준진단 테스트 결과로 정한다 */}
        <div className="mt-4 grid gap-3 rounded-xl bg-paper2/50 p-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span className="font-bold text-ink2">단어장</span>
            <select value={settings.book.key} onChange={e => save({ book: e.target.value })}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-bold">
              {VOCA_BOOKS.map(b => <option key={b.book.key} value={b.book.key}>{b.level} — {b.book.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-bold text-ink2">하루 분량</span>
            <select value={settings.perDay} onChange={e => save({ perDay: Number(e.target.value) })}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-bold">
              {perDayOptions.map(n => <option key={n} value={n}>{n}개</option>)}
            </select>
          </label>
          <div className="grid gap-1 text-xs">
            <span className="font-bold text-ink2">시험 종류</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              {(['word', 'meaning'] as VocaMode[]).map(m => (
                <label key={m} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={settings.modes.includes(m)} onChange={() => toggleMode(m)} />
                  {MODE_LABEL[m]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink2">
          분량을 바꿔도 <b className="text-ink">마지막으로 본 단어 다음부터</b> 이어집니다. 책을 바꾸면 그 책의 기록부터 이어집니다.
          {!settings.custom && <> 지금은 학년 기본값({vocaBookOf(student.grade).name}·25개·단어시험)입니다.</>}
          {settings.custom && (
            <button onClick={() => updateStudent(student.id, { voca: undefined })}
              className="ml-2 font-bold text-pine underline">학년 기본값으로 되돌리기</button>
          )}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['진도', total ? `${doneWords.toLocaleString()} / ${total.toLocaleString()}` : '—'],
            [plan?.doneToday ? '오늘 끝 · 다음' : '오늘 볼 범위',
              plan ? (plan.finished ? '책 끝' : `${plan.from}~${plan.to}번`) : '—'],
            ['오답 복습 대기', queue ? `${reviewWaiting}개` : '—'],
            ['단어시험 평균', avg('word') == null ? '—' : `${avg('word')}점`],
            ['뜻시험 평균', avg('meaning') == null ? '—' : `${avg('meaning')}점`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-paper2/60 px-3 py-2.5">
              <div className="text-[11px] font-semibold text-ink2">{k}</div>
              <div className="text-lg font-black tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {plan && !plan.finished && plan.pending.length > 0 && !plan.doneToday && plan.todaySession && (
          <p className="mt-2 text-xs font-bold text-amber">오늘 {plan.from}~{plan.to}번에서 {plan.pending.map(m => MODE_LABEL[m].split(' ')[0]).join('·')}이 남았습니다.</p>
        )}
        {queue && reviewWaiting > 0 && (
          <p className="mt-2 text-xs text-ink2">
            🔁 오답 복습: {settings.modes.map(m => `${MODE_LABEL[m].split(' ')[0]} ${queue.waiting[m]}개`).join(' · ')}
            {settings.modes.some(m => queue.waiting[m] > settings.perDay) && ` — 하루 ${settings.perDay}개씩 나눠 냅니다`}
          </p>
        )}
        {others.length > 0 && (
          <p className="mt-2 text-xs text-ink2">이전 단어장 기록: {others.map(o => `${o.name} ${o.n}회`).join(' · ')}</p>
        )}
        <p className="mt-3 text-xs text-ink2">
          학생은 <b className="text-ink">학생앱 → 영단어</b>에서 봅니다. <b className="text-ink">틀린 단어는 다음 날부터 오답 복습으로 다시 나오고</b>{' '}
          처음에 맞히면 빠집니다(시험별로, 하루 분량까지 · 재시험으로 맞힌 실수도 다시 나옴). 단어시험은 자동채점 + 틀린 것 재시험,
          뜻시험은 책의 뜻과 같으면 자동 정답이고 다르면 학생이 책의 뜻과 비교해 직접 표시합니다.
          종이 단어장·시험지는 <b className="text-ink">기본과제 → 일괄 PDF</b>에서 학생마다 다음 범위로 나옵니다.
        </p>
      </div>

      {err && <div className={`${card} text-sm text-clay`}>단어장을 불러오지 못했습니다 — {err}</div>}

      <div className={card}>
        <b className="text-sm">시험 기록</b>
        {records.length === 0 ? (
          <p className="mt-3 text-sm text-ink2">
            아직 본 단어시험이 없습니다.{plan && !plan.finished ? ` 학생앱 영단어에서 ${plan.from}~${plan.to}번부터 시작합니다.` : ''}
          </p>
        ) : (
          <div className="mt-3 grid gap-1.5">
            {records.map(s => {
              const key = s.key
              const on = open === key
              const wrongOf = (x: VocaModeResult | undefined, meaning: boolean) =>
                (x?.items ?? []).filter(({ r }) => !r.correct || r.careless || (meaning && r.self))
              const wW = wrongOf(s.word, false), wM = wrongOf(s.meaning, true)
              return (
                <div key={key} className="rounded-xl border border-line/70">
                  <button onClick={() => setOpen(on ? null : key)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm">
                    <b className="w-40 shrink-0">{s.label}</b>
                    <span className="w-20 shrink-0 text-xs text-ink2">{dateKey(s.date).slice(5)}</span>
                    {chip(s.word, '단어')}
                    {chip(s.meaning, '뜻')}
                    {(s.word?.careless ?? 0) > 0 && <span className="rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">다시 풀어 맞힘 {s.word?.careless}</span>}
                    {(s.meaning?.self ?? 0) > 0 && <span className="rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">뜻 직접 판정 {s.meaning?.self}</span>}
                    <div className="grow" />
                    <span className="text-xs font-bold text-pine">{on ? '접기 ▲' : `살펴볼 단어 ${wW.length + wM.length}개 ▼`}</span>
                  </button>
                  {on && (
                    <div className="grid gap-3 border-t border-line/70 px-3 py-3">
                      {([['단어시험', wW, false], ['뜻시험', wM, true]] as const).map(([label, list, meaning]) => (
                        (meaning ? s.meaning : s.word) && (
                          <div key={label}>
                            <div className="mb-1 text-xs font-bold text-ink2">{label}</div>
                            {list.length === 0 ? <p className="text-sm text-ink2">다 맞혔습니다.</p> : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-ink2">
                                    <th className="w-12 pb-1.5">번호</th><th className="w-36 pb-1.5">단어</th>
                                    <th className="pb-1.5">뜻</th><th className="w-40 pb-1.5">학생이 쓴 답</th><th className="w-28 pb-1.5">비고</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map(({ no, r }) => {
                                    const x = flat?.words[no - 1]
                                    return (
                                      <tr key={no} className="border-t border-line/60">
                                        <td className="py-1.5 text-xs text-ink2">{no}</td>
                                        <td className="py-1.5 font-bold">{x?.w ?? '—'}</td>
                                        <td className="py-1.5 text-ink2">{x?.mean ?? '—'}</td>
                                        <td className={`py-1.5 ${r.correct ? 'text-ink' : 'text-clay'}`}>{r.studentAnswer || <span className="text-ink2">(빈칸)</span>}</td>
                                        <td className="py-1.5">
                                          {r.careless ? <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">다시 풀어 맞힘 {r.retryAnswer ? `(${r.retryAnswer})` : ''}</span>
                                            : r.self && r.correct ? <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold text-amber">직접 인정</span>
                                              : <span className="text-xs text-ink2">틀림</span>}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )
                      ))}
                      {!flat && !err && <p className="text-xs text-ink2">단어를 불러오는 중…</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
