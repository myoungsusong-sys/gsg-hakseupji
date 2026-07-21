import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Grading } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { typeName } from '../../data/curriculum'
import { resultTypeId, weakTypes, wrongByType } from '../../lib/drill'
import { achievementIndex } from '../../lib/achievement'
import { useStudentSelf } from './StudentShell'
import { isNowBlock, SUBJECT_CLS, todayDayLabel } from '../../lib/timetable'
import {
  fmtHM, fmtHMS, latestGradingFor, myWorksheetRows, readDraft, readStudySeconds, statusOf,
  summaryOf, usePreview, PREVIEW_LOCK_TITLE, STATUS_CLASS, type StudentWsStatus,
} from './common'

const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']
const PANEL_TABS = ['전체', '숙제', '학습지', '교재', '경시대회'] as const
type PanelTab = typeof PANEL_TABS[number]

// 유형 등급 — 매쓰플랫 성취도 7단계 컬러 체계(lib/achievement.ts)의 등급 인덱스 (0=화이트 … 6=스마일)
const levelOf = achievementIndex
const TOP_LEVEL = 6   // 스마일

// ── 학습 홈 (매쓰플랫 학생앱 학습 홈 구조) ──────────────────────
// 좌: ①오늘의 학습(요일 스트립+⏱타이머) ②이번주 학습정보 4칸 ③스마일 챌린지 ④최근 학습한 챌린지
// 우: 배정물 리스트 패널 — 탭(전체/숙제/학습지/교재) + 카드 목록(독립 스크롤)
export default function StudentHome() {
  const me = useStudentSelf()
  const { assignments, worksheets, gradings, workbooks, wbItems, studentAppConfig, students } = useStore()
  // 📅 오늘 시간표 — 선생님이 시간표 페이지에서 자동 생성한 주간 시간표의 오늘 요일 블록
  const ttToday = useMemo(() => {
    const tt = students.find(s => s.id === me.id)?.timetable
    return tt ? (tt.blocks[todayDayLabel()] ?? []) : []
  }, [students, me.id])
  // 관리 > 학생앱 설정 「오늘의 학습」 소비 — 마스터 OFF 또는 이 학생 OFF면 섹션 숨김
  const dailyOn = studentAppConfig.dailyMasterOn !== false && !(studentAppConfig.dailyOffIds ?? []).includes(me.id)
  const nav = useNavigate()
  const pv = usePreview()
  const [panelTab, setPanelTab] = useState<PanelTab>('전체')

  const myGradings = useMemo(() => gradings.filter(g => g.studentId === me.id), [gradings, me.id])

  // 이번주(월~일 — 매쓰플랫 동일) 날짜들
  const week = useMemo(() => {
    const now = new Date()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (now.getDay() + 6) % 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      return d
    })
  }, [])
  const today = todayKey()
  const learnedDays = useMemo(() => new Set(myGradings.map(g => dateKey(g.date))), [myGradings])

  // ⏱ 학습 타이머 — StudentShell이 localStorage에 누적한 오늘 학습시간(초), 1초마다 갱신
  const [nowSec, setNowSec] = useState(() => readStudySeconds(me.id, today))
  useEffect(() => {
    const t = setInterval(() => setNowSec(readStudySeconds(me.id, todayKey())), 1000)
    return () => clearInterval(t)
  }, [me.id])

  // 이번주 학습정보 4칸 — 총 학습시간 · 푼 문제 수 · 등급이 올라간 유형 · 최고 등급을 달성한 유형
  const weekStat = useMemo(() => {
    const keys = week.map(dateKey)
    const keySet = new Set(keys)
    const weekStart = keys[0]
    let solved = 0
    for (const g of myGradings) {
      if (keySet.has(dateKey(g.date))) solved += g.results.length
    }
    // 유형 등급 변화: 이번주 이전까지의 등급 vs 현재 등급
    const itemMap = new Map(wbItems.map(i => [i.id, i]))
    const agg = (pred: (g: Grading) => boolean) => {
      const m = new Map<string, { wrong: number; total: number }>()
      for (const g of myGradings) {
        if (!pred(g)) continue
        for (const r of g.results) {
          const t = resultTypeId(r, itemMap)
          if (!t) continue
          const cur = m.get(t) ?? { wrong: 0, total: 0 }
          cur.total++
          if (!r.correct) cur.wrong++
          m.set(t, cur)
        }
      }
      return m
    }
    const before = agg(g => dateKey(g.date) < weekStart)
    const now = agg(() => true)
    let up = 0, top = 0
    for (const [t, stat] of now) {
      const lv = levelOf(stat), prev = levelOf(before.get(t))
      if (lv > prev) up++
      if (lv === TOP_LEVEL && prev < TOP_LEVEL) top++
    }
    const timeSec = keys.reduce((acc, k) => acc + readStudySeconds(me.id, k), 0)
    return { solved, up, top, timeSec }
  }, [myGradings, week, wbItems, me.id, nowSec])

  // 스마일 챌린지 — 취약 유형 TOP2 칩 (오답이 있는 유형)
  const weak = useMemo(
    () => weakTypes(wrongByType(me.id, gradings, wbItems)).slice(0, 2),
    [me.id, gradings, wbItems],
  )

  // 최근 학습한 챌린지 — 챌린지 태그 학습지의 내 채점 최신 3건
  const recentChallenges = useMemo(() => {
    const out: { id: string; title: string; date: string; score: number }[] = []
    for (const g of myGradings) {
      if (g.source !== '학습지' || !g.worksheetId) continue
      const ws = worksheets.find(w => w.id === g.worksheetId)
      if (!ws || !ws.tags.includes('챌린지')) continue
      out.push({ id: g.id, title: ws.title, date: g.date, score: summaryOf(ws, g).score })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  }, [myGradings, worksheets])

  // ── 우측 배정물 패널 카드 ──
  interface PanelCard {
    key: string; icon: string; label: string; st: StudentWsStatus; title: string
    sub?: string; score?: number; date: string; solveId?: string; homework?: boolean; contest?: boolean
  }
  const panelCards = useMemo<PanelCard[]>(() => {
    const cards: PanelCard[] = []
    for (const { ws, date, kinds } of myWorksheetRows(assignments, worksheets, me.id)) {
      const g = latestGradingFor(gradings, me.id, ws.id)
      const st = statusOf(ws.id, g)
      const done = st === '학습완료' && !!g
      cards.push({
        key: `ws-${ws.id}`, icon: '📄', label: `학습지・${ws.grade}`, st, title: ws.title,
        sub: `${ws.problemIds.length}문제`, score: done ? summaryOf(ws, g!).score : undefined,
        date, solveId: done ? undefined : ws.id, homework: kinds.includes('숙제'),
        contest: ws.tags.includes('경시대회') || ws.tags.includes('KMM'),
      })
    }
    for (const wb of workbooks.filter(w => w.studentId === me.id)) {
      const items = wbItems.filter(i => i.workbookId === wb.id)
      const gradedIds = new Set<string>()
      let first = ''
      for (const g of gradings) {
        if (g.studentId !== me.id || g.workbookId !== wb.id) continue
        if (!first || g.date < first) first = g.date
        for (const r of g.results) if (r.itemId) gradedIds.add(r.itemId)
      }
      const graded = items.filter(i => gradedIds.has(i.id)).length
      const st: StudentWsStatus = items.length > 0 && graded >= items.length ? '학습완료' : graded > 0 ? '풀이중' : '학습가능'
      cards.push({
        key: `wb-${wb.id}`, icon: '📖', label: `교재・${wb.grade}`, st, title: wb.name,
        sub: items.length > 0 ? `${items.length}문항` : undefined, date: first,
      })
    }
    return cards.sort((a, b) => b.date.localeCompare(a.date))
  }, [assignments, worksheets, gradings, workbooks, wbItems, me.id])

  const shownCards = useMemo(() => {
    if (panelTab === '숙제') return panelCards.filter(c => c.homework)
    if (panelTab === '학습지') return panelCards.filter(c => c.icon === '📄')
    if (panelTab === '교재') return panelCards.filter(c => c.icon === '📖')
    if (panelTab === '경시대회') return panelCards.filter(c => c.contest)
    return panelCards
  }, [panelCards, panelTab])

  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  const goChallenge = () => pv.on ? pv.go('challenge') : nav('/student/challenge')

  return (
    <div>
      <h1 className="mb-5 text-xl font-black">{me.name} 학생, 안녕하세요! 👋</h1>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        {/* ── 좌측 본문 ── */}
        <div className="grid min-w-0 gap-5">
          {/* 📅 오늘 시간표 — 선생님이 짜준 주간 시간표의 오늘 블록 */}
          {ttToday.length > 0 && (
            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="mb-3 font-black">📅 오늘 시간표 <span className="text-xs font-semibold text-ink2">({todayDayLabel()}요일)</span></h2>
              <div className="grid gap-1.5">
                {ttToday.map((b, i) => {
                  const now = isNowBlock(b)
                  return (
                    <div key={i}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${now ? 'border-pine bg-pine-soft/50' : 'border-line/60'}`}>
                      <span className="w-24 shrink-0 font-black tabular-nums">{b.start}~{b.end}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${SUBJECT_CLS[b.subject] ?? SUBJECT_CLS.기타}`}>{b.subject}</span>
                      <span className="min-w-0 truncate font-semibold">{b.kind === '인강' ? '🎧 ' : '📗 '}{b.title}</span>
                      {now && <span className="ml-auto shrink-0 rounded-full bg-pine px-2 py-0.5 text-[10px] font-black text-paper">지금</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ① 오늘의 학습 — 선생님 설정(dailyMasterOn·dailyOffIds)이 OFF면 숨김 */}
          {dailyOn && (
          <section className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
              <h2 className="font-black">오늘의 학습</h2>
              <span className="rounded-full bg-paper2/80 px-2.5 py-1 text-xs font-semibold text-ink2">
                📅 이번주 {fmt(week[0])} - {fmt(week[6])}
              </span>
              <span className="rounded-full bg-pine-soft px-2.5 py-1 text-xs font-black tabular-nums text-pine-dark"
                title="접속 중 누적 학습시간">
                ⏱ {fmtHMS(nowSec)}
              </span>
              <div className="grow" />
              <span className="text-xs text-ink2">연속 달성을 놓치지 않게 노력해봐요!</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {week.map(d => {
                const k = dateKey(d)
                const learned = learnedDays.has(k)
                const isToday = k === today
                return (
                  <div key={k} className="flex flex-col items-center">
                    <span className={`text-[10px] leading-none text-pine ${isToday ? '' : 'invisible'}`}>▼</span>
                    <div className={`mt-0.5 flex w-full flex-col items-center gap-1 rounded-xl border py-3 ${
                      isToday ? 'border-pine bg-pine-soft/60' : 'border-line/60 bg-paper2/40'}`}>
                      <span className={`text-[11px] font-semibold ${isToday ? 'font-black text-pine' : 'text-ink2'}`}>
                        {isToday ? '오늘' : `${DAY_LABEL[d.getDay()]}요일`}
                      </span>
                      <span className={`text-sm font-black ${isToday ? 'text-pine-dark' : ''}`}>{d.getDate()}</span>
                      <span className={`text-lg leading-none ${learned ? '' : 'opacity-20 grayscale'}`}>🔥</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
          )}

          {/* ② 이번주 학습정보 — 4칸 (매쓰플랫 동일 구성) */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-4 font-black">이번주 학습정보</h2>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div className="rounded-xl bg-paper2/70 px-2 py-5">
                <div className="text-2xl font-black tabular-nums text-pine-dark">
                  {weekStat.timeSec > 0 ? fmtHM(weekStat.timeSec) : '—'}
                </div>
                <div className="mt-1 text-xs text-ink2">총 학습시간 (시간:분)</div>
              </div>
              <div className="rounded-xl bg-paper2/70 px-2 py-5">
                <div className="text-2xl font-black text-pine-dark">{weekStat.solved}<span className="text-sm font-bold"> 문제</span></div>
                <div className="mt-1 text-xs text-ink2">푼 문제 수</div>
              </div>
              <div className="rounded-xl bg-paper2/70 px-2 py-5">
                <div className="text-2xl font-black text-pine-dark">{weekStat.up}<span className="text-sm font-bold"> 개</span></div>
                <div className="mt-1 text-xs text-ink2">🟢 등급이 올라간 유형</div>
              </div>
              <div className="rounded-xl bg-paper2/70 px-2 py-5">
                <div className="text-2xl font-black text-pine-dark">{weekStat.top}<span className="text-sm font-bold"> 개</span></div>
                <div className="mt-1 text-xs text-ink2">🟠 최고 등급을 달성한 유형</div>
              </div>
            </div>
          </section>

          {/* ③ 스마일 챌린지 — 취약 유형 칩 + 챌린지 유도 */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-3 flex items-baseline">
              <h2 className="font-black">스마일 챌린지 😊</h2>
              <div className="grow" />
              {pv.on ? (
                <button onClick={() => pv.go('challenge')} className="text-sm font-semibold text-pine hover:underline">챌린지 메뉴로 이동하기 →</button>
              ) : (
                <Link to="/student/challenge" className="text-sm font-semibold text-pine hover:underline">챌린지 메뉴로 이동하기 →</Link>
              )}
            </div>
            {weak.length === 0 ? (
              <p className="text-sm text-ink2">추천할 수 있는 유형칩이 없어요. 챌린지 메뉴에서 학습을 진행해주세요.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink2">이 유형이 약해요 — 챌린지로 탈출해봐요!</span>
                {weak.map(w => (
                  <span key={w.typeId}
                    className="rounded-full border border-clay/50 bg-red-50/60 px-3 py-1.5 text-xs font-bold text-clay">
                    {typeName(w.typeId)} <span className="font-semibold opacity-70">오답 {w.wrong}/{w.total}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ④ 최근 학습한 챌린지 */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="mb-3 font-black">최근 학습한 챌린지</h2>
            {recentChallenges.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink2">
                유형을 학습한 기록이 없어요.<br />챌린지 메뉴에서 학습을 진행해주세요.
                <div className="mt-3">
                  <button onClick={goChallenge}
                    className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
                    챌린지 메뉴로 이동하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {recentChallenges.map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-line/70 px-4 py-3">
                    <span className="text-base">🎯</span>
                    <div className="min-w-0">
                      <div className="truncate font-bold">{c.title}</div>
                      <div className="text-xs text-ink2">{dateKey(c.date).slice(2).replace(/-/g, '.')}</div>
                    </div>
                    <div className="grow" />
                    <span className="shrink-0 text-sm font-black text-pine-dark">{c.score}점</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── 우측 배정물 리스트 패널 (탭 + 독립 스크롤) ── */}
        <aside className="rounded-2xl border border-line bg-white p-4 lg:sticky lg:top-20">
          <div className="mb-3 flex gap-1 text-sm">
            {PANEL_TABS.map(t => (
              <button key={t} onClick={() => setPanelTab(t)}
                className={`rounded-full px-3 py-1.5 font-bold transition ${
                  panelTab === t ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="grid gap-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            {shownCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink2">
                {panelTab === '숙제'
                  ? <>출제된 숙제가 없어요.<br />선생님에게 요청해주세요.</>
                  : panelTab === '경시대회'
                    ? <>출제된 시험지가 없어요.<br />선생님에게 요청해주세요.</>
                    : panelTab === '교재'
                      ? '배정된 교재가 없어요.'
                      : '출제된 학습지가 없어요.'}
              </div>
            ) : shownCards.map(c => (
              <div key={c.key} className="rounded-xl border border-line/70 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-ink2">
                  <span>{c.icon}</span>
                  <span className="font-semibold">{c.label}</span>
                  <div className="grow" />
                  <span className={`rounded px-1.5 py-0.5 font-bold ${STATUS_CLASS[c.st]}`}>{c.st}</span>
                </div>
                <div className="text-sm font-bold leading-snug">{c.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink2">
                  {c.sub && <span>{c.sub}</span>}
                  {c.score != null && <><span>ㅣ</span><span className="font-black text-pine-dark">점수 {c.score}점</span></>}
                  <div className="grow" />
                  {c.solveId && (
                    <button onClick={() => nav(`/student/solve/${c.solveId}`)} disabled={pv.on}
                      title={pv.on ? PREVIEW_LOCK_TITLE : undefined}
                      className="rounded-lg bg-pine px-3 py-1.5 font-bold text-paper hover:brightness-110 disabled:opacity-40">
                      {readDraft(c.solveId) ? '이어서 풀기' : '풀기'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
