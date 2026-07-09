import { useEffect, useMemo, useState } from 'react'
import type { GradeResult, Grading, Student } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey, monthKey, todayKey } from '../../lib/dates'
import { resultTypeId } from '../../lib/drill'
import { typeName } from '../../data/curriculum'

// ── 수업 > 보고서: 일일 보고지 + 월간 보고서 (즉석 실시간 생성 + 저장 목록 레이어) ──────────

type Mode = 'daily' | 'monthly'

const KIND_LABEL = { daily: '일일 보고지', monthly: '월간 보고서', analysis: '유형분석 보고서' } as const

export default function ReportPanel({ student }: { student: Student }) {
  const { savedReports, removeSavedReport } = useStore()
  const [mode, setMode] = useState<Mode>('daily')
  const [q, setQ] = useState('')                               // 보고서명 검색
  const [listOpen, setListOpen] = useState(false)              // 저장 목록 섹션
  const [load, setLoad] = useState<{ mode: Mode; period: string; n: number } | null>(null)  // 저장 보고서 열기

  const myReports = useMemo(
    () => savedReports.filter(r => r.studentId === student.id)
      .filter(r => !q.trim() || r.name.includes(q.trim())),
    [savedReports, student.id, q],
  )

  function openSaved(kind: string, period: string) {
    if (kind === 'analysis') { alert('유형분석 보고서는 수업 > 유형분석 탭의 [보고서 내역]에서 확인하세요.'); return }
    setMode(kind as Mode)
    setLoad(prev => ({ mode: kind as Mode, period, n: (prev?.n ?? 0) + 1 }))
  }

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <div className="flex w-fit rounded-xl border border-line bg-white p-1 text-sm font-bold">
          {([['daily', '일일 보고지'], ['monthly', '월간 보고서']] as [Mode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 ${mode === m ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grow" />
        <input value={q} onChange={e => { setQ(e.target.value); if (e.target.value) setListOpen(true) }}
          placeholder="보고서명 검색" className="w-44 rounded-lg border border-line px-3 py-2 text-sm" />
        <button onClick={() => setListOpen(v => !v)}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${listOpen ? 'border-pine bg-pine-soft/60 text-pine-dark' : 'border-line text-ink2 hover:text-ink'}`}>
          🗂 저장 목록 ({savedReports.filter(r => r.studentId === student.id).length})
        </button>
      </div>

      {/* 저장된 보고서 목록 (이름·기간·종류·삭제 + 검색) */}
      {listOpen && (
        <div className="no-print mb-5 rounded-2xl border border-line bg-white p-4">
          {myReports.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink2">
              {q ? '검색 결과가 없습니다.' : <>아직 만들어진 보고서가 없습니다. 새로운 보고서를 만들어보세요. — 아래 [보고서 저장]을 누르면 이 목록에 쌓입니다.</>}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink2">
                  <th className="py-1.5">보고서명</th><th>종류</th><th>기간</th><th>생성일</th><th className="text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {myReports.map(r => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-2">
                      <button onClick={() => openSaved(r.kind, r.period)} className="text-left font-bold hover:text-pine hover:underline">
                        {r.name}
                      </button>
                    </td>
                    <td className="py-2 text-xs text-ink2">{KIND_LABEL[r.kind]}</td>
                    <td className="py-2 text-xs text-ink2">{r.period}</td>
                    <td className="py-2 text-xs text-ink2">{dateKey(r.createdAt).slice(2).replace(/-/g, '.')} 생성</td>
                    <td className="py-2 text-right">
                      <button onClick={() => { if (confirm(`'${r.name}' 보고서를 삭제할까요?`)) removeSavedReport(r.id) }}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-clay hover:bg-red-50">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {mode === 'daily'
        ? <DailyReport key={`${student.id}-${load?.n ?? 0}`} student={student}
            initialDate={load?.mode === 'daily' ? load.period : undefined} />
        : <MonthlyReport key={`${student.id}-${load?.n ?? 0}`} student={student}
            initialMonth={load?.mode === 'monthly' ? load.period : undefined} />}
    </div>
  )
}

// ── 공용 집계 ──────────────────────────────

function summarize(results: GradeResult[]) {
  const total = results.length
  const correct = results.filter(r => r.correct).length
  const unknown = results.filter(r => r.unknown).length
  return { total, correct, unknown, score: pct(correct, total) }
}

function pct(correct: number, total: number): number {
  return total ? Math.round(correct / total * 100) : 0
}

function isBook(g: Grading): boolean {
  return (g.source ?? '교재') === '교재'   // source 없으면 교재 (구버전 데이터 호환)
}

async function copyText(text: string, done: () => void) {
  try {
    await navigator.clipboard.writeText(text)
    done()
  } catch {
    alert('복사 실패 — 아래 미리보기 텍스트를 길게 눌러 직접 복사하세요.')
  }
}

// ── 일일 보고지 (하원 시 학부모 단톡방 피드백) ──────────────────────────────

function DailyReport({ student, initialDate }: { student: Student; initialDate?: string }) {
  const { gradings, workbooks, worksheets, wbItems, dailyNotes, saveDailyNote, addSavedReport } = useStore()
  const [date, setDate] = useState(initialDate ?? todayKey())
  const initial = dailyNotes.find(n => n.studentId === student.id && n.date === date)
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [nextPlan, setNextPlan] = useState(initial?.nextPlan ?? '')
  const [copied, setCopied] = useState(false)

  // 날짜가 바뀌면 저장분 불러오기
  useEffect(() => {
    const n = dailyNotes.find(x => x.studentId === student.id && x.date === date)
    setComment(n?.comment ?? '')
    setNextPlan(n?.nextPlan ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, date])

  function persist(c: string, p: string) {
    saveDailyNote({ studentId: student.id, date, comment: c, nextPlan: p })
  }

  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])
  const dayGradings = useMemo(
    () => gradings.filter(g => g.studentId === student.id && dateKey(g.date) === date),
    [gradings, student.id, date],
  )

  // 교재/학습지 분리 집계
  const bookRows = dayGradings.filter(isBook).map(g => ({
    name: workbooks.find(w => w.id === g.workbookId)?.name ?? '교재',
    range: g.pageFrom != null ? `${g.pageFrom}~${g.pageTo ?? g.pageFrom}p` : '—',
    ...summarize(g.results),
  }))
  const sheetRows = dayGradings.filter(g => !isBook(g)).map(g => ({
    name: worksheets.find(w => w.id === g.worksheetId)?.title ?? '학습지',
    ...summarize(g.results),
  }))
  const totalSolved = dayGradings.reduce((a, g) => a + g.results.length, 0)
  const totalCorrect = dayGradings.reduce((a, g) => a + g.results.filter(r => r.correct).length, 0)
  const totalUnknown = dayGradings.reduce((a, g) => a + g.results.filter(r => r.unknown).length, 0)
  const overall = pct(totalCorrect, totalSolved)

  // 오늘 약했던 유형 (교재 itemId·학습지 typeId 모두 집계)
  const wrongTypes = useMemo(() => {
    const cnt = new Map<string, number>()
    for (const g of dayGradings)
      for (const r of g.results)
        if (!r.correct) {
          const t = resultTypeId(r, itemMap)
          if (t) cnt.set(t, (cnt.get(t) ?? 0) + 1)
        }
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ name: typeName(t), n }))
  }, [dayGradings, itemMap])

  // 오늘 만든 오답 드릴
  const drills = worksheets.filter(w =>
    !w.deletedAt && dateKey(w.createdAt) === date && w.title.startsWith(student.name) && w.tags.includes('오답'))

  const dateKr = date.replaceAll('-', '. ') + '.'

  // 단톡방 복사용 텍스트 (교재/학습지 섹션 분리, 모름 표기)
  const kakaoText = useMemo(() => {
    const lines: (string | null)[] = [
      `[깊은생각수학] ${student.name}${student.klass ? ` (${student.klass})` : ''} 오늘 학습`,
      `📅 ${dateKr}`,
      '',
      bookRows.length ? '📖 오늘 푼 교재' : null,
      ...bookRows.map(r => `· ${r.name} ${r.range} — ${r.total}문항 중 ${r.correct}개 정답 (${r.score}점)${r.unknown ? ` · 모름 ${r.unknown}개` : ''}`),
      sheetRows.length ? '🧾 오늘 푼 학습지' : null,
      ...sheetRows.map(r => `· ${r.name} — ${r.total}문항 중 ${r.correct}개 정답 (${r.score}점)${r.unknown ? ` · 모름 ${r.unknown}개` : ''}`),
      totalSolved
        ? `= 오늘 총 ${totalSolved}문항 중 ${totalCorrect}개 정답 (${overall}점)${totalUnknown ? ` · 모름 ${totalUnknown}개` : ''}`
        : '오늘 채점 기록이 없습니다.',
      wrongTypes.length ? '' : null,
      wrongTypes.length ? '🔁 오늘 약했던 유형' : null,
      wrongTypes.length ? `· ${wrongTypes.map(t => t.name).join(', ')}` : null,
      wrongTypes.length ? (drills.length ? '→ 오답 드릴 학습지로 복습 예정' : '→ 다음 시간 복습 예정') : null,
      comment ? '' : null,
      comment ? '📝 선생님 한마디' : null,
      comment || null,
      nextPlan ? '' : null,
      nextPlan ? `📌 다음 학습: ${nextPlan}` : null,
      '',
      '오늘도 열심히 했습니다. 감사합니다 😊',
    ]
    return lines.filter((l): l is string => l !== null).join('\n')
  }, [student.name, student.klass, dateKr, bookRows, sheetRows, totalSolved, totalCorrect, totalUnknown, overall, wrongTypes, drills.length, comment, nextPlan])

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">날짜
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg border border-line px-3 py-2" />
        </label>
        <div className="grow" />
        <button
          onClick={() => {
            const name = prompt('저장할 보고서 이름', `${student.name} ${date.slice(5).replace('-', '.')} 일일 보고지`)
            if (name?.trim()) addSavedReport({ kind: 'daily', studentId: student.id, name: name.trim(), period: date })
          }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:bg-paper2">💾 보고서 저장</button>
        <button onClick={() => copyText(kakaoText, () => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}
          className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white hover:brightness-105">
          {copied ? '✓ 복사됨' : '💬 단톡방 텍스트 복사'}
        </button>
        <button onClick={() => window.print()} className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">🖨 보고지 인쇄</button>
      </div>

      <div className="no-print mb-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">선생님 한마디 <span className="font-normal text-ink2">(자동 저장)</span>
          <textarea value={comment}
            onChange={e => { setComment(e.target.value); persist(e.target.value, nextPlan) }} rows={3}
            placeholder="오늘 수업 태도·잘한 점·보완할 점을 적으면 보고지·단톡방 텍스트에 들어갑니다."
            className="rounded-lg border border-line px-3 py-2 font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-bold">다음 학습 계획 <span className="font-normal text-ink2">(자동 저장)</span>
          <textarea value={nextPlan}
            onChange={e => { setNextPlan(e.target.value); persist(comment, e.target.value) }} rows={3}
            placeholder="예: 최소공배수 오답 드릴 + 쎈 91~94p"
            className="rounded-lg border border-line px-3 py-2 font-normal" />
        </label>
      </div>

      {/* 인쇄용 일일 보고지 */}
      <div className="print-root mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-lg font-black text-pine-dark">깊은생각수학</span>
          <span className="text-lg font-light">일일 학습 보고서</span>
        </div>
        <div className="mb-4 flex items-center justify-between border-b-2 border-pine pb-2 text-sm">
          <span className="font-bold">{student.name} {student.klass && <span className="font-normal text-ink2">· {student.klass}</span>}</span>
          <span className="text-ink2">{dateKr}</span>
        </div>

        <Section title="📖 오늘 푼 교재">
          {bookRows.length === 0 ? <Dim>오늘 교재 채점 기록이 없습니다.</Dim> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-ink2"><th className="py-1">교재</th><th>범위</th><th>정답/문항</th><th>점수</th><th>모름</th></tr></thead>
              <tbody>
                {bookRows.map((r, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-1.5 font-semibold">{r.name}</td>
                    <td>{r.range}</td>
                    <td>{r.correct}/{r.total}</td>
                    <td className="font-bold text-pine-dark">{r.score}점</td>
                    <td className={r.unknown ? 'font-semibold text-clay' : 'text-ink2'}>{r.unknown ? `${r.unknown}개` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="🧾 오늘 푼 학습지">
          {sheetRows.length === 0 ? <Dim>오늘 학습지 채점 기록이 없습니다.</Dim> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-ink2"><th className="py-1">학습지</th><th>정답/문항</th><th>점수</th></tr></thead>
              <tbody>
                {sheetRows.map((r, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-1.5 font-semibold">{r.name}</td>
                    <td>{r.correct}/{r.total}</td>
                    <td className="font-bold text-pine-dark">{r.score}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {totalSolved > 0 && (
          <div className="mb-4 rounded-xl bg-pine-soft/50 px-4 py-2.5 text-sm font-bold">
            합계 — {totalSolved}문항 중 {totalCorrect}개 정답 <span className="text-pine-dark">({overall}점)</span>
            {totalUnknown > 0 && <span className="ml-2 font-semibold text-clay">모름 {totalUnknown}개</span>}
          </div>
        )}

        <Section title="🔁 오늘 약했던 유형">
          {wrongTypes.length === 0 ? <Dim>오답 유형이 없습니다.</Dim> : (
            <div className="flex flex-wrap gap-1.5">
              {wrongTypes.map(t => (
                <span key={t.name} className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                  {t.name}{t.n > 1 ? ` ×${t.n}` : ''}
                </span>
              ))}
            </div>
          )}
          {drills.length > 0 && (
            <div className="mt-2 text-sm text-ink2">
              → 오답 드릴 학습지 <b>{drills.length}건</b>으로 복습 예정
              <ul className="mt-1 list-inside list-disc text-xs">
                {drills.map(d => <li key={d.id}>{d.title}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {comment && <Section title="📝 선생님 한마디"><p className="whitespace-pre-wrap text-sm leading-relaxed">{comment}</p></Section>}
        {nextPlan && <Section title="📌 다음 학습 계획"><p className="whitespace-pre-wrap text-sm leading-relaxed">{nextPlan}</p></Section>}

        <p className="mt-6 text-center text-sm text-ink2">오늘도 열심히 했습니다. 감사합니다 😊</p>
      </div>

      <KakaoPreview text={kakaoText} />
    </div>
  )
}

// ── 월간 보고서 ──────────────────────────────

const MONTH_TOGGLES = [
  { key: 'history', label: '학습 내역' },
  { key: 'weekly', label: '주차별 분석' },
  { key: 'weak', label: '보완 유형' },
] as const
type MonthToggle = typeof MONTH_TOGGLES[number]['key']

function MonthlyReport({ student, initialMonth }: { student: Student; initialMonth?: string }) {
  const { gradings, workbooks, worksheets, wbItems, addSavedReport } = useStore()
  const [month, setMonth] = useState(initialMonth ?? monthKey(new Date()))
  const [opinion, setOpinion] = useState('')
  const [inc, setInc] = useState<Record<MonthToggle, boolean>>({ history: true, weekly: true, weak: true })
  const [copied, setCopied] = useState(false)

  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])
  const monthGradings = useMemo(
    () => gradings.filter(g => g.studentId === student.id && monthKey(g.date) === month),
    [gradings, student.id, month],
  )

  // 요약 4종
  const studyDays = useMemo(() => new Set(monthGradings.map(g => dateKey(g.date))).size, [monthGradings])
  const totalSolved = monthGradings.reduce((a, g) => a + g.results.length, 0)
  const totalCorrect = monthGradings.reduce((a, g) => a + g.results.filter(r => r.correct).length, 0)
  const totalWrong = totalSolved - totalCorrect   // 오답+모름 ('모름'도 correct=false로 기록됨)
  const overall = pct(totalCorrect, totalSolved)

  // 교재별/학습지별 집계
  const bookAggs = useMemo(() => aggByName(monthGradings.filter(isBook),
    g => workbooks.find(w => w.id === g.workbookId)?.name ?? '교재'), [monthGradings, workbooks])
  const sheetAggs = useMemo(() => aggByName(monthGradings.filter(g => !isBook(g)),
    g => worksheets.find(w => w.id === g.worksheetId)?.title ?? '학습지'), [monthGradings, worksheets])

  // 주차별 학습량 (1~7일=1주차 … 29일~=5주차)
  const weekly = useMemo(() => {
    const acc = [1, 2, 3, 4, 5].map(week => ({ week, total: 0, correct: 0 }))
    for (const g of monthGradings) {
      const day = Number(dateKey(g.date).slice(8, 10))
      const w = Math.min(4, Math.floor((day - 1) / 7))
      acc[w].total += g.results.length
      acc[w].correct += g.results.filter(r => r.correct).length
    }
    return acc
  }, [monthGradings])
  const maxWeekTotal = Math.max(1, ...weekly.map(w => w.total))

  // 보완할 유형 TOP5
  const weakTop5 = useMemo(() => {
    const cnt = new Map<string, number>()
    for (const g of monthGradings)
      for (const r of g.results)
        if (!r.correct) {
          const t = resultTypeId(r, itemMap)
          if (t) cnt.set(t, (cnt.get(t) ?? 0) + 1)
        }
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([t, n]) => ({ name: typeName(t), n }))
  }, [monthGradings, itemMap])

  const [y, m] = month.split('-')
  const monthKr = `${y}년 ${Number(m)}월`

  // 단톡방 복사용 텍스트 (내용 구성 토글 반영)
  const kakaoText = useMemo(() => {
    const lines: (string | null)[] = [
      `[깊은생각수학] ${student.name}${student.klass ? ` (${student.klass})` : ''} ${Number(m)}월 학습 리포트`,
      `📅 ${monthKr}`,
      '',
      '📊 이번 달 요약',
      `· 학습일 ${studyDays}일 · 총 ${totalSolved}문항`,
      `· 정답률 ${overall}% · 오답+모름 ${totalWrong}개`,
    ]
    if (totalSolved === 0) lines.push('이번 달 채점 기록이 없습니다.')
    if (inc.history && (bookAggs.length || sheetAggs.length)) {
      lines.push('')
      if (bookAggs.length) {
        lines.push('📖 교재별 학습')
        for (const a of bookAggs) lines.push(`· ${a.name} — ${a.total}문항 중 ${a.correct}개 정답 (${pct(a.correct, a.total)}%)`)
      }
      if (sheetAggs.length) {
        lines.push('🧾 학습지별 학습')
        for (const a of sheetAggs) lines.push(`· ${a.name} — ${a.total}문항 중 ${a.correct}개 정답 (${pct(a.correct, a.total)}%)`)
      }
    }
    if (inc.weekly && totalSolved > 0) {
      lines.push('', '📅 주차별 학습량')
      for (const w of weekly) if (w.total > 0) lines.push(`· ${w.week}주차 — ${w.total}문항 · 정답률 ${pct(w.correct, w.total)}%`)
    }
    if (inc.weak && weakTop5.length) {
      lines.push('', '🔁 보완할 유형 TOP5')
      for (const t of weakTop5) lines.push(`· ${t.name} (오답 ${t.n})`)
    }
    if (opinion) lines.push('', '📝 선생님 의견', opinion)
    lines.push('', '한 달 동안 수고 많았습니다. 감사합니다 😊')
    return lines.filter((l): l is string => l !== null).join('\n')
  }, [student.name, student.klass, m, monthKr, studyDays, totalSolved, overall, totalWrong, inc, bookAggs, sheetAggs, weekly, weakTop5, opinion])

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">월
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border border-line px-3 py-2" />
        </label>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <span className="text-xs font-bold text-ink2">내용 구성</span>
          {MONTH_TOGGLES.map(t => (
            <label key={t.key} className="flex items-center gap-1.5">
              <input type="checkbox" checked={inc[t.key]}
                onChange={e => setInc(prev => ({ ...prev, [t.key]: e.target.checked }))} />
              {t.label}
            </label>
          ))}
        </div>
        <div className="grow" />
        <button
          onClick={() => {
            const name = prompt('저장할 보고서 이름', `${y}년 ${m}월 보고서`)
            if (name?.trim()) addSavedReport({ kind: 'monthly', studentId: student.id, name: name.trim(), period: month })
          }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:bg-paper2">💾 보고서 저장</button>
        <button onClick={() => copyText(kakaoText, () => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}
          className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white hover:brightness-105">
          {copied ? '✓ 복사됨' : '💬 단톡방 텍스트 복사'}
        </button>
        <button onClick={() => window.print()} className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">🖨 인쇄</button>
      </div>

      <label className="no-print mb-5 grid gap-1 text-sm font-bold">선생님 의견 <span className="font-normal text-ink2">(보고서·단톡방 텍스트에 반영)</span>
        <textarea value={opinion} onChange={e => setOpinion(e.target.value)} rows={3}
          placeholder="이번 달 학습 태도·성장한 점·다음 달 목표를 적으면 월간 보고서에 들어갑니다."
          className="rounded-lg border border-line px-3 py-2 font-normal" />
      </label>

      {/* 인쇄용 월간 보고서 */}
      <div className="print-root mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-lg font-black text-pine-dark">깊은생각수학</span>
          <span className="text-lg font-light">월간 학습 보고서</span>
        </div>
        <div className="mb-4 flex items-center justify-between border-b-2 border-pine pb-2 text-sm">
          <span className="font-bold">{student.name} {student.klass && <span className="font-normal text-ink2">· {student.klass}</span>}</span>
          <span className="text-ink2">{monthKr}</span>
        </div>

        {/* 요약 카드 4 */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="학습일 수" value={`${studyDays}일`} />
          <SummaryCard label="총 문항" value={`${totalSolved}문항`} />
          <SummaryCard label="정답률" value={`${overall}%`} />
          <SummaryCard label="오답+모름" value={`${totalWrong}개`} accent />
        </div>
        {totalSolved === 0 && <Dim>이번 달 채점 기록이 없습니다.</Dim>}

        {inc.history && (
          <Section title="📖 학습 내역">
            {bookAggs.length === 0 && sheetAggs.length === 0 ? <Dim>이번 달 학습 내역이 없습니다.</Dim> : (
              <div className="grid gap-3">
                {bookAggs.length > 0 && <AggTable caption="교재" rows={bookAggs} />}
                {sheetAggs.length > 0 && <AggTable caption="학습지" rows={sheetAggs} />}
              </div>
            )}
          </Section>
        )}

        {inc.weekly && (
          <Section title="📅 주차별 학습량">
            {totalSolved === 0 ? <Dim>기록이 없습니다.</Dim> : (
              <div className="grid gap-1.5">
                {weekly.map(w => (
                  <div key={w.week} className="flex items-center gap-2 text-sm">
                    <span className="w-12 shrink-0 text-xs font-bold text-ink2">{w.week}주차</span>
                    <div className="h-4 grow rounded bg-paper2">
                      <div className="h-4 rounded bg-pine" style={{ width: `${Math.round(w.total / maxWeekTotal * 100)}%` }} />
                    </div>
                    <span className="w-32 shrink-0 text-right text-xs">
                      <b>{w.total}문항</b>{w.total > 0 && <span className="text-ink2"> · 정답률 {pct(w.correct, w.total)}%</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {inc.weak && (
          <Section title="🔁 보완할 유형 TOP5">
            {weakTop5.length === 0 ? <Dim>오답 유형이 없습니다.</Dim> : (
              <div className="flex flex-wrap gap-1.5">
                {weakTop5.map(t => (
                  <span key={t.name} className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                    {t.name} (오답 {t.n})
                  </span>
                ))}
              </div>
            )}
          </Section>
        )}

        {opinion && <Section title="📝 선생님 의견"><p className="whitespace-pre-wrap text-sm leading-relaxed">{opinion}</p></Section>}

        <p className="mt-6 text-center text-sm text-ink2">한 달 동안 수고 많았습니다. 감사합니다 😊</p>
      </div>

      <KakaoPreview text={kakaoText} />
    </div>
  )
}

// ── 월간 집계 헬퍼 ──────────────────────────────

interface NameAgg { name: string; total: number; correct: number }

function aggByName(gs: Grading[], nameOf: (g: Grading) => string): NameAgg[] {
  const map = new Map<string, NameAgg>()
  for (const g of gs) {
    const name = nameOf(g)
    const cur = map.get(name) ?? { name, total: 0, correct: 0 }
    cur.total += g.results.length
    cur.correct += g.results.filter(r => r.correct).length
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function AggTable({ caption, rows }: { caption: string; rows: NameAgg[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink2">
          <th className="py-1">{caption}</th><th>문항</th><th>정답</th><th>정답률</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name} className="border-b border-line/50">
            <td className="py-1.5 font-semibold">{r.name}</td>
            <td>{r.total}</td>
            <td>{r.correct}</td>
            <td className="font-bold text-pine-dark">{pct(r.correct, r.total)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent ? 'border-amber/40 bg-amber-soft' : 'border-line bg-paper2/60'}`}>
      <div className="text-xs text-ink2">{label}</div>
      <div className={`mt-0.5 text-lg font-black ${accent ? 'text-amber' : 'text-pine-dark'}`}>{value}</div>
    </div>
  )
}

// ── 공용 UI ──────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-sm font-black text-pine-dark">{title}</div>
      {children}
    </div>
  )
}

function Dim({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink2">{children}</p>
}

function KakaoPreview({ text }: { text: string }) {
  return (
    <div className="no-print mx-auto mt-5 max-w-3xl rounded-2xl border border-line bg-paper2 p-5">
      <div className="mb-2 text-xs font-bold text-ink2">단톡방 전송 미리보기 (복사 버튼으로 그대로 붙여넣기)</div>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{text}</pre>
    </div>
  )
}
