import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { mondayOf, weekDays, weekProgress, weekReview } from '../../lib/schoolReview'
import { nextDay, vocaBookOf } from '../../lib/voca'
import { COUNSEL_TAGS } from '../../types'
import type { Counsel, Student } from '../../types'

// ── 🗓 주간 상담 (수업 > 학생 탭) ────────────────────────────────────────────
//
// 명수쌤 2026-08-26: "일주일에 한 번 학생들 진도체크 및 상담을 하려고 해.
//                     학생별로 상담 양식을 만들어줘."
//
// 화면은 두 층이다.
//  ① 위 — **앱이 아는 것**(지난 한 주 실적). 선생님이 손으로 적지 않는다.
//     푼 문항·점수·학교복습률·기본과제·영단어·미해결 오답·교재 진도를 그 자리에서 계산한다.
//  ② 아래 — **선생님이 적는 것**. 진도 점검 / 잘한 점 / 보완할 점 / 학생 이야기 /
//     다음 주 목표 / 학부모 전달. 목표는 다음 주 상담에서 그 자리에서 체크한다.
//
// 🔴 ①은 저장하지 않는다. 채점 기록에서 매번 다시 계산한다 —
//    숫자를 상담지에 박아 두면 나중에 채점이 바뀌었을 때 조용히 어긋난다(savedReports 와 같은 원칙).

const card = 'rounded-2xl border border-line bg-white p-5'
const INPUT = 'w-full rounded-xl border border-line p-3 text-sm'

/** 그 주 월~일 범위 */
function weekRange(week: string): { from: string; to: string } {
  const days = weekDays(week)
  return { from: days[0].key, to: days[6].key }
}

export default function CounselPanel({ student }: { student: Student }) {
  const {
    counsels, saveCounsel, gradings, workbooks, worksheets, assignments,
    reviewChecks, lecturePlans, academyProfile,
  } = useStore()
  const today = todayKey()
  const [week, setWeek] = useState(() => mondayOf(today))
  const { from, to } = weekRange(week)

  const id = `${student.id}_${week}`
  const saved = useMemo(() => counsels.find(c => c.id === id), [counsels, id])
  const prev = useMemo(
    () => counsels.filter(c => c.studentId === student.id && c.week < week).sort((a, b) => b.week.localeCompare(a.week))[0],
    [counsels, student.id, week])

  // ── 폼 상태 (저장분이 바뀌면 다시 채운다) ──
  const [f, setF] = useState<Counsel>(() => saved ?? blank(student.id, week))
  useEffect(() => { setF(saved ?? blank(student.id, week)) }, [saved, student.id, week])
  const [dirty, setDirty] = useState(false)
  const [note, setNote] = useState('')
  const set = <K extends keyof Counsel>(k: K, v: Counsel[K]) => { setF(p => ({ ...p, [k]: v })); setDirty(true) }

  // ── ① 앱이 아는 것 — 지난 한 주 ──
  const stat = useMemo(() => {
    const mine = gradings.filter(g => g.studentId === student.id)
    const wk = mine.filter(g => { const d = dateKey(g.date); return d >= from && d <= to })
    let solved = 0, correct = 0, unresolved = 0
    const days = new Set<string>()
    for (const g of wk) {
      days.add(dateKey(g.date))
      for (const r of g.results) {
        solved++
        if (r.correct) correct++
        else if (!r.careless) unresolved++
      }
    }
    // 학교 복습
    const review = weekReview(student, week, reviewChecks, today)
    const rp = weekProgress(review)
    const lateSubs = [...new Set(review.filter(i => i.late).map(i => i.subject))]
    // 기본과제 — 그 주에 나간 것 / 푼 것
    const wsById = new Map(worksheets.map(w => [w.id, w]))
    const daily = assignments.filter(a => {
      const d = dateKey(a.date)
      if (a.studentId !== student.id || d < from || d > to) return false
      const w = wsById.get(a.worksheetId)
      return !!w && !w.deletedAt && (w.tags ?? []).includes('기본과제')
    })
    const dailyDone = daily.filter(a => wk.some(g => g.worksheetId === a.worksheetId)).length
    // 영단어
    const vb = vocaBookOf(student.grade)
    const vwb = workbooks.find(w => w.studentId === student.id && w.name === vb.name)
    const vDays = vwb ? mine.filter(g => g.workbookId === vwb.id && g.pageFrom != null).map(g => g.pageFrom as number) : []
    const vWeek = vwb ? wk.filter(g => g.workbookId === vwb.id).length : 0
    // 교재 진도 — 그 주에 채점한 교재별 마지막 쪽
    const wbById = new Map(workbooks.map(w => [w.id, w]))
    const books = new Map<string, { name: string; last: number }>()
    for (const g of wk) {
      if ((g.source ?? '교재') !== '교재' || !g.workbookId) continue
      const w = wbById.get(g.workbookId)
      if (!w || w.name === vb.name) continue
      const p = g.pageTo ?? g.pageFrom
      if (p == null) continue
      const cur = books.get(w.id)
      if (!cur || p > cur.last) books.set(w.id, { name: w.name, last: p })
    }
    // 진도표 대비
    const planNote: string[] = []
    for (const p of lecturePlans.filter(x => x.studentId === student.id)) {
      const due = p.sessions.filter(s => s.date >= from && s.date <= to)
      if (!due.length) continue
      const done = due.filter(s => s.done).length
      const wbName = wbById.get(p.workbookId)?.name ?? '교재'
      planNote.push(`${wbName} ${done}/${due.length}회`)
    }
    return {
      solved, correct, days: days.size,
      score: solved ? Math.round(correct / solved * 100) : null,
      unresolved,
      review: rp, lateSubs,
      daily: daily.length, dailyDone,
      vocaNext: nextDay(vDays, vb.days), vocaWeek: vWeek, vocaBook: vb.name,
      books: [...books.values()],
      planNote,
    }
  }, [gradings, student, from, to, week, reviewChecks, today, worksheets, assignments, workbooks, lecturePlans])

  function save() {
    saveCounsel({ ...f, id, studentId: student.id, week, at: new Date().toISOString() })
    setDirty(false); setNote('저장했습니다.')
    setTimeout(() => setNote(''), 2000)
  }

  const shift = (n: number) => {
    const d = new Date(week); d.setDate(d.getDate() + n * 7)
    setWeek(mondayOf(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`))
  }

  const kakao = useMemo(() => [
    `[${academyProfile.academyName || '대치스파르타 프리미엄'}] ${student.name} 주간 상담`,
    `🗓 ${from.slice(5).replace('-', '.')} ~ ${to.slice(5).replace('-', '.')}`,
    '',
    `📊 이번 주 ${stat.days}일 학습 · ${stat.solved}문항 · ${stat.score ?? '—'}점`,
    stat.review.total ? `🏫 학교 복습 ${stat.review.pct}% (${stat.review.done}/${stat.review.total}칸)` : '',
    stat.daily ? `📄 기본과제 ${stat.dailyDone}/${stat.daily}회` : '',
    f.progress ? `\n📖 진도\n${f.progress}` : '',
    f.good ? `\n👍 잘한 점\n${f.good}` : '',
    f.weak ? `\n🔁 보완할 점\n${f.weak}` : '',
    (f.goals ?? []).length ? `\n🎯 다음 주 목표\n${(f.goals ?? []).map(g => `· ${g.text}`).join('\n')}` : '',
    f.parentNote ? `\n📌 전달 사항\n${f.parentNote}` : '',
  ].filter(Boolean).join('\n'), [academyProfile, student.name, from, to, stat, f])

  return (
    <div className="grid gap-4">
      {/* 주 이동 + 저장 */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-black">🗓 주간 상담</h2>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => shift(-1)} className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-ink2">‹ 지난주</button>
            <span className="px-1 font-bold tabular-nums">{from.slice(5).replace('-', '.')} ~ {to.slice(5).replace('-', '.')}</span>
            <button onClick={() => shift(1)} className="rounded-lg border border-line px-2 py-1 text-xs font-bold text-ink2">다음주 ›</button>
          </div>
          {saved && <span className="rounded-full bg-pine-soft px-2.5 py-1 text-xs font-black text-pine-dark">작성됨</span>}
          <div className="grow" />
          {note && <span className="text-xs font-bold text-pine">{note}</span>}
          <button onClick={() => navigator.clipboard?.writeText(kakao)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine">💬 카톡용 복사</button>
          <button onClick={save} disabled={!dirty}
            className="rounded-lg bg-pine px-4 py-1.5 text-xs font-black text-paper disabled:opacity-40">
            {dirty ? '저장' : '저장됨'}
          </button>
        </div>
      </div>

      {/* ① 앱이 아는 것 */}
      <div className={card}>
        <b className="text-sm">📊 이번 주 실적 <span className="font-normal text-ink2">— 채점 기록에서 자동으로 계산합니다</span></b>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['학습한 날', `${stat.days}일`],
            ['푼 문항', `${stat.solved}문항`],
            ['정답률', stat.score == null ? '—' : `${stat.score}점`],
            ['미해결 오답', `${stat.unresolved}개`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-paper2/60 px-3 py-2.5">
              <div className="text-[11px] font-semibold text-ink2">{k}</div>
              <div className="text-lg font-black tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-1.5 text-sm">
          {stat.review.total > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-bold text-ink2">학교 복습</span>
              <b className="tabular-nums">{stat.review.pct}%</b>
              <span className="text-xs text-ink2">({stat.review.done}/{stat.review.total}칸)</span>
              {stat.lateSubs.length > 0 && <span className="text-xs font-bold text-clay">밀림 {stat.lateSubs.join(' · ')}</span>}
            </div>
          )}
          {stat.daily > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-bold text-ink2">기본과제</span>
              <b className="tabular-nums">{stat.dailyDone} / {stat.daily}회</b>
              {stat.dailyDone < stat.daily && <span className="text-xs font-bold text-clay">안 푼 것 {stat.daily - stat.dailyDone}회</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-bold text-ink2">영단어</span>
            <span>이번 주 <b>{stat.vocaWeek}회</b> · 다음 <b>DAY {stat.vocaNext}</b></span>
            <span className="text-xs text-ink2">{stat.vocaBook}</span>
          </div>
          {stat.books.length > 0 && (
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-20 shrink-0 text-xs font-bold text-ink2">교재 진도</span>
              <span>{stat.books.map(b => `${b.name} ~${b.last}쪽`).join(' · ')}</span>
            </div>
          )}
          {stat.planNote.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-bold text-ink2">진도표 대비</span>
              <span>{stat.planNote.join(' · ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 지난주 목표 확인 */}
      {prev && (prev.goals ?? []).length > 0 && (
        <div className={card}>
          <b className="text-sm">🎯 지난 상담({prev.week.slice(5).replace('-', '.')} 주) 목표 <span className="font-normal text-ink2">— 지켰는지 여기서 체크</span></b>
          <div className="mt-2 grid gap-1.5">
            {(prev.goals ?? []).map((g, i) => (
              <label key={i} className="flex items-center gap-2 rounded-lg bg-paper2/50 px-3 py-2 text-sm">
                <input type="checkbox" checked={!!g.done} className="size-4 accent-pine"
                  onChange={e => {
                    const goals = (prev.goals ?? []).map((x, j) => j === i ? { ...x, done: e.target.checked } : x)
                    saveCounsel({ ...prev, goals, at: new Date().toISOString() })
                  }} />
                <span className={g.done ? 'text-ink2 line-through' : ''}>{g.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ② 선생님이 적는 것 */}
      <div className={`${card} grid gap-4`}>
        <b className="text-sm">✍️ 상담 기록</b>

        <div className="grid gap-1.5">
          <span className="text-xs font-bold text-ink2">태도 — 눌러서 고르세요</span>
          <div className="flex flex-wrap gap-1.5">
            {COUNSEL_TAGS.map(t => {
              const on = (f.tags ?? []).includes(t)
              return (
                <button key={t} type="button"
                  onClick={() => set('tags', on ? (f.tags ?? []).filter(x => x !== t) : [...(f.tags ?? []), t])}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-pine text-paper' : 'border border-line text-ink2'}`}>
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {([
          ['progress', '📖 진도 점검', '어디까지 나갔고 계획 대비 어떤가 (예: 마플시너지 대수 3단원까지, 계획보다 1주 늦음)'],
          ['good', '👍 잘한 점', '이번 주에 좋았던 것'],
          ['weak', '🔁 보완할 점', '반복해서 걸리는 유형·습관'],
          ['talk', '💬 학생과 나눈 이야기', '컨디션·고민·학습 습관 (학부모에게 보내는 글에는 안 들어갑니다)'],
          ['parentNote', '📌 학부모 전달 사항', '카톡으로 그대로 나갑니다'],
        ] as const).map(([k, label, ph]) => (
          <label key={k} className="grid gap-1.5">
            <span className="text-xs font-bold text-ink2">{label}</span>
            <textarea rows={2} className={INPUT} placeholder={ph}
              value={(f[k] as string) ?? ''} onChange={e => set(k, e.target.value)} />
          </label>
        ))}

        <div className="grid gap-1.5">
          <span className="text-xs font-bold text-ink2">🎯 다음 주 목표 <span className="font-normal">— 다음 상담 때 이 자리에서 체크합니다</span></span>
          {(f.goals ?? []).map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={INPUT} value={g.text}
                onChange={e => set('goals', (f.goals ?? []).map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
              <button type="button" onClick={() => set('goals', (f.goals ?? []).filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg border border-line px-2.5 py-2 text-xs font-bold text-ink2">빼기</button>
            </div>
          ))}
          <button type="button" onClick={() => set('goals', [...(f.goals ?? []), { text: '' }])}
            className="justify-self-start rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:border-pine">
            ＋ 목표 추가
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-ink2">
            다음 상담일
            <input type="date" className="rounded-lg border border-line px-2 py-1 text-sm"
              value={f.nextDate ?? ''} onChange={e => set('nextDate', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-ink2">
            상담한 선생님
            <input className="w-32 rounded-lg border border-line px-2 py-1 text-sm"
              value={f.by ?? ''} onChange={e => set('by', e.target.value)} placeholder="이름" />
          </label>
          <div className="grow" />
          <button onClick={save} disabled={!dirty}
            className="rounded-xl bg-pine px-5 py-2 text-sm font-black text-paper disabled:opacity-40">
            {dirty ? '상담 저장' : '저장됨'}
          </button>
        </div>
      </div>

      {/* 지난 상담 이력 */}
      <div className={card}>
        <b className="text-sm">지난 상담</b>
        {counsels.filter(c => c.studentId === student.id && c.week !== week).length === 0 ? (
          <p className="mt-2 text-sm text-ink2">아직 저장된 상담이 없습니다.</p>
        ) : (
          <div className="mt-2 grid gap-1.5">
            {counsels.filter(c => c.studentId === student.id && c.week !== week).slice(0, 12).map(c => (
              <details key={c.id} className="rounded-xl border border-line/70 px-3 py-2 text-sm">
                <summary className="cursor-pointer">
                  <b className="tabular-nums">{c.week.slice(5).replace('-', '.')} 주</b>
                  {c.by && <span className="ml-2 text-xs text-ink2">{c.by}</span>}
                  {(c.tags ?? []).slice(0, 3).map(t => (
                    <span key={t} className="ml-1 rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{t}</span>
                  ))}
                </summary>
                <div className="mt-2 grid gap-1 text-[13px]">
                  {c.progress && <p><b className="text-ink2">진도</b> {c.progress}</p>}
                  {c.good && <p><b className="text-ink2">잘한 점</b> {c.good}</p>}
                  {c.weak && <p><b className="text-ink2">보완</b> {c.weak}</p>}
                  {c.talk && <p><b className="text-ink2">이야기</b> {c.talk}</p>}
                  {(c.goals ?? []).length > 0 && (
                    <p><b className="text-ink2">목표</b> {(c.goals ?? []).map(g => `${g.done ? '✓' : '·'} ${g.text}`).join('  ')}</p>
                  )}
                  {c.parentNote && <p><b className="text-ink2">전달</b> {c.parentNote}</p>}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function blank(studentId: string, week: string): Counsel {
  return { id: `${studentId}_${week}`, studentId, week, at: '', goals: [], tags: [] }
}
