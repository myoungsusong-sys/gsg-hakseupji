import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { useStudentSelf } from './StudentShell'
import { latestGradingFor, myWorksheetRows, readDraft, statusOf, STATUS_CLASS } from './common'

const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']

// ── 학습 홈 (매쓰플랫 학생앱 학습 홈 구조) ──────────────────────
// ① 오늘의 학습 — 이번주 날짜 스트립 + 학습한 날 불꽃
// ② 이번주 학습정보 — 푼 문제 수 · 정답률 · 학습한 날 수
// ③ 진행중/최근 — 배정 학습지 중 미완료 최신
export default function StudentHome() {
  const me = useStudentSelf()
  const { assignments, worksheets, gradings } = useStore()
  const nav = useNavigate()

  const myGradings = useMemo(() => gradings.filter(g => g.studentId === me.id), [gradings, me.id])

  // 이번주(일~토) 날짜들
  const week = useMemo(() => {
    const now = new Date()
    const sun = new Date(now)
    sun.setDate(now.getDate() - now.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sun)
      d.setDate(sun.getDate() + i)
      return d
    })
  }, [])
  const today = todayKey()
  const learnedDays = useMemo(() => new Set(myGradings.map(g => dateKey(g.date))), [myGradings])

  // 이번주 학습정보
  const weekStat = useMemo(() => {
    const keys = new Set(week.map(dateKey))
    let solved = 0, correct = 0
    const days = new Set<string>()
    for (const g of myGradings) {
      const k = dateKey(g.date)
      if (!keys.has(k)) continue
      solved += g.results.length
      correct += g.results.filter(r => r.correct).length
      if (g.results.length > 0) days.add(k)
    }
    return { solved, correct, rate: solved > 0 ? Math.round(correct / solved * 100) : null, days: days.size }
  }, [myGradings, week])

  // 진행중/최근 — 배정 학습지 중 미완료(채점 없음) 최신 3개
  const pending = useMemo(() => {
    return myWorksheetRows(assignments, worksheets, me.id)
      .map(r => ({ ...r, g: latestGradingFor(gradings, me.id, r.ws.id) }))
      .filter(r => statusOf(r.ws.id, r.g) !== '학습완료')
      .slice(0, 3)
  }, [assignments, worksheets, gradings, me.id])

  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`

  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-black">{me.name} 학생, 안녕하세요! 👋</h1>

      {/* ① 오늘의 학습 */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="font-black">오늘의 학습</h2>
          <span className="text-xs text-ink2">{fmt(week[0])} - {fmt(week[6])}</span>
          <div className="grow" />
          <span className="text-xs text-ink2">연속 달성을 놓치지 않게 노력해봐요!</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.map(d => {
            const k = dateKey(d)
            const learned = learnedDays.has(k)
            const isToday = k === today
            return (
              <div key={k}
                className={`flex flex-col items-center gap-1 rounded-xl border py-3 ${
                  isToday ? 'border-pine bg-pine-soft/60' : 'border-line/60 bg-paper2/40'}`}>
                <span className="text-[11px] font-semibold text-ink2">{DAY_LABEL[d.getDay()]}</span>
                <span className={`text-sm font-black ${isToday ? 'text-pine-dark' : ''}`}>{d.getDate()}</span>
                <span className={`text-lg leading-none ${learned ? '' : 'opacity-20 grayscale'}`}>🔥</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ② 이번주 학습정보 */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 font-black">이번주 학습정보</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-paper2/70 py-5">
            <div className="text-2xl font-black text-pine-dark">{weekStat.solved}<span className="text-sm font-bold">문제</span></div>
            <div className="mt-1 text-xs text-ink2">푼 문제 수</div>
          </div>
          <div className="rounded-xl bg-paper2/70 py-5">
            <div className="text-2xl font-black text-pine-dark">
              {weekStat.rate != null ? <>{weekStat.rate}<span className="text-sm font-bold">%</span></> : '-'}
            </div>
            <div className="mt-1 text-xs text-ink2">정답률</div>
          </div>
          <div className="rounded-xl bg-paper2/70 py-5">
            <div className="text-2xl font-black text-pine-dark">{weekStat.days}<span className="text-sm font-bold">일</span></div>
            <div className="mt-1 text-xs text-ink2">학습한 날</div>
          </div>
        </div>
      </section>

      {/* ③ 진행중/최근 학습지 */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex items-baseline">
          <h2 className="font-black">진행중인 학습지</h2>
          <div className="grow" />
          <Link to="/student/worksheets" className="text-sm font-semibold text-pine hover:underline">학습지 전체 보기 →</Link>
        </div>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink2">
            지금 풀 학습지가 없어요. 완료한 학습지는 <Link to="/student/worksheets" className="font-bold text-pine hover:underline">학습지</Link>에서 볼 수 있어요.
          </div>
        ) : (
          <div className="grid gap-2">
            {pending.map(({ ws, date, g }) => {
              const st = statusOf(ws.id, g)
              return (
                <div key={ws.id} className="flex items-center gap-3 rounded-xl border border-line/70 px-4 py-3">
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[st]}`}>{st}</span>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{ws.title}</div>
                    <div className="text-xs text-ink2">{ws.problemIds.length}문제 · 출제일 {dateKey(date).slice(2).replace(/-/g, '.')}</div>
                  </div>
                  <div className="grow" />
                  <button onClick={() => nav(`/student/solve/${ws.id}`)}
                    className="shrink-0 rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
                    {readDraft(ws.id) ? '이어서 풀기' : '풀기'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
