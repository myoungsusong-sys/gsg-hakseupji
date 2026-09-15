import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { todayKey, weekdayOf } from '../../lib/dates'
import { flattenVoca, loadVoca, MODE_LABEL, vocaSettingsOf, vocaStatusOf, type VocaFlat, type VocaMode, type VocaStatus } from '../../lib/voca'
import type { Student } from '../../types'

// ── 📊 반 전체 영단어 현황 (수업 > 과목 영어 > 반·학년 [전체] · 영단어 전체 현황) ─────────
//
// 명수쌤 2026-09-15: "반 전체 영단어 현황 화면 만들어줘"
//   누가 오늘 단어시험을 안 봤는지, 누가 오답 복습이 밀렸는지, 진도가 어디인지를 한 표로 본다.
//   기본 정렬은 **안 본 학생 → 하는 중 → 끝**, 같은 상태면 밀린 단어가 많은 학생이 위.
//   이름을 누르면 그 학생의 영어단어 탭(설정·기록)으로 간다.
//
// 🔴 새 저장소 없음 — 학생앱 단어시험 기록(Grading)과 학생별 설정(Student.voca)을 읽기만 한다.
//    단어 파일은 학생들이 쓰는 책마다 한 번씩만 받는다.

type Sort = 'state' | 'wrong' | 'progress' | 'name'
const STATE_RANK = { none: 0, partial: 1, done: 2 } as const
const short = (m: VocaMode) => MODE_LABEL[m].split(' ')[0].replace('시험', '')
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`

export default function VocaClassPanel({ label, students, onOpen }: {
  label: string; students: Student[]; onOpen: (studentId: string) => void
}) {
  const { gradings, workbooks } = useStore()
  const today = todayKey()
  const files = useMemo(() => [...new Set(students.map(s => vocaSettingsOf(s).book.file))].sort(), [students])
  const [flats, setFlats] = useState<Record<string, VocaFlat>>({})
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true
    for (const f of files) {
      if (flats[f]) continue
      loadVoca(f).then(d => { if (alive) setFlats(p => ({ ...p, [f]: flattenVoca(f, d) })) })
        .catch(e => { if (alive) setErr(String(e?.message ?? e)) })
    }
    return () => { alive = false }
  }, [files.join('|')])   // eslint-disable-line react-hooks/exhaustive-deps

  const [sort, setSort] = useState<Sort>('state')
  const rows = useMemo(() => students.map(st => {
    const flat = flats[vocaSettingsOf(st).book.file]
    return { st, s: flat ? vocaStatusOf(st, gradings, workbooks, flat, today) : null }
  }), [students, gradings, workbooks, flats, today])

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const byName = a.st.name.localeCompare(b.st.name, 'ko')
    const A = a.s, B = b.s
    if (!A || !B) return A ? -1 : B ? 1 : byName
    if (sort === 'name') return byName
    if (sort === 'wrong') return B.openWrong - A.openWrong || byName
    if (sort === 'progress') return B.done / (B.total || 1) - A.done / (A.total || 1) || byName
    return STATE_RANK[A.state] - STATE_RANK[B.state] || (B.reviewLeft + B.openWrong) - (A.reviewLeft + A.openWrong) || byName
  }), [rows, sort])

  const ready = rows.filter((r): r is { st: Student; s: VocaStatus } => !!r.s)
  const count = (k: VocaStatus['state']) => ready.filter(r => r.s.state === k).length
  const sum = (f: (s: VocaStatus) => number) => ready.reduce((a, r) => a + f(r.s), 0)
  const cards: [string, string, string][] = [
    ['학생', `${students.length}명`, 'text-ink'],
    ['오늘 끝', `${count('done')}명`, 'text-pine'],
    ['하는 중', `${count('partial')}명`, 'text-amber'],
    ['안 봄', `${count('none')}명`, count('none') ? 'text-clay' : 'text-ink'],
    ['오늘 남은 복습', `${sum(s => s.reviewLeft)}단어`, 'text-ink'],
    ['아직 못 맞힌 단어', `${sum(s => s.openWrong)}개`, 'text-ink'],
  ]

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-black">🔤 {label} 영단어 현황</h1>
        <span className="text-sm text-ink2">{Number(today.slice(5, 7))}월 {Number(today.slice(8, 10))}일 ({weekdayOf(today)}) 기준</span>
      </div>
      <p className="mb-4 text-sm text-ink2">
        학생앱 단어시험 기록으로 만듭니다. <b className="text-ink">안 본 학생이 위</b>에 오고, 같으면 밀린 단어가 많은 학생이 먼저입니다.
        이름을 누르면 그 학생의 단어장 설정·기록으로 갑니다.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-line bg-white px-3 py-2">
            <div className="text-xs text-ink2">{k}</div>
            <div className={`text-lg font-black ${c}`}>{ready.length || k === '학생' ? v : '—'}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="rounded-lg border border-line px-2 py-1.5">
          <option value="state">안 본 학생 먼저</option>
          <option value="wrong">못 맞힌 단어 많은 순</option>
          <option value="progress">진도 많이 나간 순</option>
          <option value="name">이름순</option>
        </select>
        {ready.length < rows.length && <span className="text-xs text-ink2">단어장 불러오는 중… ({ready.length}/{rows.length})</span>}
        {err && <span className="text-xs text-clay">단어장을 못 불러왔어요: {err}</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-paper2 text-left text-xs text-ink2">
            <tr>
              <th className="px-3 py-2">학생</th>
              <th className="px-3 py-2">오늘</th>
              <th className="px-3 py-2">단어장</th>
              <th className="px-3 py-2">진도</th>
              <th className="px-3 py-2">오답 복습</th>
              <th className="px-3 py-2">최근 7일</th>
              <th className="px-3 py-2 text-right">최근 정답률</th>
              <th className="px-3 py-2 text-right">마지막</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ st, s }) => {
              const noClass = !!st.classDays?.length && !st.classDays.includes(weekdayOf(today))
              return (
                <tr key={st.id} className="border-t border-line align-top hover:bg-paper2/40">
                  <td className="px-3 py-2.5">
                    <button onClick={() => onOpen(st.id)} className="font-black text-ink hover:text-pine hover:underline">{st.name}</button>
                    <div className="text-xs text-ink2">{st.grade}{st.klass ? ` · ${st.klass}` : ''}</div>
                  </td>
                  {!s ? (
                    <td colSpan={7} className="px-3 py-2.5 text-xs text-ink2">단어장 불러오는 중…</td>
                  ) : (
                    <>
                      <td className="px-3 py-2.5">
                        <TodayCell s={s} />
                        {s.state === 'none' && noClass && <div className="mt-0.5 text-[11px] text-ink2">오늘 수업 없는 날</div>}
                      </td>
                      <td className="max-w-[210px] px-3 py-2.5">
                        <div className="truncate font-semibold" title={s.settings.book.name}>{s.settings.book.name}</div>
                        <div className="text-xs text-ink2">
                          하루 {s.settings.perDay} · {s.settings.modes.map(short).join('+')}
                          {!s.settings.custom && <span className="ml-1 rounded bg-paper2 px-1">학년 기본</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs"><b className="text-ink">{s.done.toLocaleString()}</b> / {s.total.toLocaleString()}</div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-paper2">
                          <div className="h-full rounded-full bg-pine" style={{ width: `${s.total ? Math.round(s.done / s.total * 100) : 0}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {s.reviewLeft === 0 && s.openWrong === 0 ? <span className="text-ink2">—</span> : (
                          <>
                            <div>오늘 남음 <b className={s.reviewLeft ? 'text-clay' : 'text-ink'}>{s.reviewLeft}</b></div>
                            <div className="text-ink2">못 맞힌 단어 <b className="text-ink">{s.openWrong}</b></div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-0.5">
                          {s.week.map(w => (
                            <span key={w.day} title={`${md(w.day)} (${weekdayOf(w.day)}) ${w.did ? '응시' : '기록 없음'}`}
                              className={`h-4 w-4 rounded-sm ${w.did ? 'bg-pine' : 'border border-line bg-paper2'} ${w.day === today ? 'ring-1 ring-ink/40 ring-offset-1' : ''}`} />
                          ))}
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink2">{s.week.filter(w => w.did).length}/7일</div>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold ${s.recentRate == null ? 'text-ink2'
                        : s.recentRate >= 85 ? 'text-pine' : s.recentRate >= 60 ? 'text-amber' : 'text-clay'}`}>
                        {s.recentRate == null ? '—' : `${s.recentRate}%`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-ink2">
                        {s.lastDate == null ? '기록 없음' : s.lastDate === today ? '오늘' : md(s.lastDate)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TodayCell({ s }: { s: VocaStatus }) {
  if (s.state === 'done') {
    return s.todayTotal === 0
      ? <span className="rounded-full bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{s.plan.finished ? '📕 책 끝' : '할 것 없음'}</span>
      : (
        <div>
          <span className="rounded-full bg-pine-soft px-2 py-0.5 text-xs font-black text-pine-dark">✓ 끝</span>
          <span className="ml-1.5 text-xs text-ink2">{s.todayRight}/{s.todayTotal}</span>
        </div>
      )
  }
  const left = [...s.rangeLeft.map(short), ...(s.reviewLeft ? [`복습 ${s.reviewLeft}`] : [])].join(' · ')
  return (
    <div>
      {s.state === 'partial'
        ? <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-black text-amber">하는 중</span>
        : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-black text-clay">안 봄</span>}
      {s.state === 'partial' && <span className="ml-1.5 text-xs text-ink2">{s.todayRight}/{s.todayTotal}</span>}
      <div className="mt-0.5 text-[11px] text-ink2">
        {s.rangeLeft.length > 0 && `${s.plan.from}~${s.plan.to}번 · `}{left} 남음
      </div>
    </div>
  )
}
