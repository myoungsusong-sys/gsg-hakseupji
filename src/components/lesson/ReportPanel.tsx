import { useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import type { Grading, Student } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey, monthKey, todayKey, krDateLabel, nextClassDate } from '../../lib/dates'
import { resultTypeId } from '../../lib/drill'
import { typeName, typeUnitName } from '../../data/curriculum'

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


function pct(correct: number, total: number): number {
  return total ? Math.round(correct / total * 100) : 0
}

function isBook(g: Grading): boolean {
  return (g.source ?? '교재') === '교재'   // source 없으면 교재 (구버전 데이터 호환)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
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
  const { gradings, workbooks, worksheets, wbItems, dailyNotes, lecturePlans, saveDailyNote, addSavedReport } = useStore()
  const [date, setDate] = useState(initialDate ?? todayKey())
  const initial = dailyNotes.find(n => n.studentId === student.id && n.date === date)
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [nextPlan, setNextPlan] = useState(initial?.nextPlan ?? '')
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? '')       // 등원 시간 (체크해야 기록)
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? '')     // 하원 시간
  const [makeupDate, setMakeupDate] = useState(initial?.makeupDate ?? '') // 보강일 (있으면 다음수업 우선)
  const [copied, setCopied] = useState(false)
  // 같은 틱에 여러 필드를 저장해도(예: 등원·하원 연속 클릭) 스테일 클로저로 서로 덮어쓰지 않도록 ref로 최신값 동기 유지
  const noteRef = useRef({
    comment: initial?.comment ?? '', nextPlan: initial?.nextPlan ?? '',
    checkIn: initial?.checkIn ?? '', checkOut: initial?.checkOut ?? '', makeupDate: initial?.makeupDate ?? '',
  })

  // 날짜가 바뀌면 저장분 불러오기
  useEffect(() => {
    const n = dailyNotes.find(x => x.studentId === student.id && x.date === date)
    setComment(n?.comment ?? '')
    setNextPlan(n?.nextPlan ?? '')
    setCheckIn(n?.checkIn ?? '')
    setCheckOut(n?.checkOut ?? '')
    setMakeupDate(n?.makeupDate ?? '')
    noteRef.current = {
      comment: n?.comment ?? '', nextPlan: n?.nextPlan ?? '',
      checkIn: n?.checkIn ?? '', checkOut: n?.checkOut ?? '', makeupDate: n?.makeupDate ?? '',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, date])

  // 현재 값 전체를 하나의 노트로 저장 (ref 기준으로 병합 → 부분 저장 시 다른 필드가 지워지지 않음)
  function persist(patch: Partial<{ comment: string; nextPlan: string; checkIn: string; checkOut: string; makeupDate: string }>) {
    const m = { ...noteRef.current, ...patch }
    noteRef.current = m
    saveDailyNote({
      studentId: student.id, date,
      comment: m.comment, nextPlan: m.nextPlan,
      checkIn: m.checkIn || undefined,
      checkOut: m.checkOut || undefined,
      makeupDate: m.makeupDate || undefined,
    })
  }

  // 다음 수업일 — 보강일이 있으면 우선(수업 변경), 없으면 수업 요일 기준 자동 계산
  const autoNext = useMemo(() => nextClassDate(date, student.classDays), [date, student.classDays])
  const nextSession = makeupDate
    ? { key: makeupDate, label: krDateLabel(makeupDate), isMakeup: true }
    : autoNext ? { key: autoNext, label: krDateLabel(autoNext), isMakeup: false } : null

  // 진도표 연동 — 오늘/다음 수업일의 계획된 진도(교재·쪽·단원)
  const myPlans = useMemo(() => lecturePlans.filter(p => p.studentId === student.id), [lecturePlans, student.id])
  function planForDate(k: string | undefined): string {
    if (!k) return ''
    for (const p of myPlans) {
      const s = p.sessions.find(x => x.date === k)
      if (s) {
        const wbName = workbooks.find(w => w.id === p.workbookId)?.name ?? '교재'
        return `${wbName} ${s.pageFrom}~${s.pageTo}p${s.unit ? ` · ${s.unit}` : ''}`
      }
    }
    return ''
  }
  const todayPlanText = useMemo(() => planForDate(date), [myPlans, date, workbooks])
  const nextPlanText = useMemo(() => planForDate(nextSession?.key), [myPlans, nextSession, workbooks])

  // 등원/하원 체크 — 버튼을 눌러야 시간이 기록된다(안 누르면 보고서 미표시)
  function nowHM(): string {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  function stampIn() { const t = checkIn ? '' : (student.arriveTime || nowHM()); setCheckIn(t); persist({ checkIn: t }) }
  function stampOut() { const t = checkOut ? '' : (student.leaveTime || nowHM()); setCheckOut(t); persist({ checkOut: t }) }

  const itemMap = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [wbItems])
  const dayGradings = useMemo(
    () => gradings.filter(g => g.studentId === student.id && dateKey(g.date) === date),
    [gradings, student.id, date],
  )

  // 교재/학습지 분리 집계 — 같은 교재·학습지의 여러 채점(낱장)은 한 줄로 묶어 쪽 범위·점수 합산
  const bookRows = useMemo(() => {
    const m = new Map<string, { name: string; minP: number; maxP: number; total: number; correct: number; unknown: number }>()
    for (const g of dayGradings.filter(isBook)) {
      const name = workbooks.find(w => w.id === g.workbookId)?.name ?? '교재'
      const e = m.get(name) ?? { name, minP: Infinity, maxP: -Infinity, total: 0, correct: 0, unknown: 0 }
      if (g.pageFrom != null) { e.minP = Math.min(e.minP, g.pageFrom); e.maxP = Math.max(e.maxP, g.pageTo ?? g.pageFrom) }
      e.total += g.results.length
      e.correct += g.results.filter(r => r.correct).length
      e.unknown += g.results.filter(r => r.unknown).length
      m.set(name, e)
    }
    return [...m.values()].map(e => ({
      name: e.name, range: e.minP <= e.maxP ? `${e.minP}~${e.maxP}p` : '—',
      total: e.total, correct: e.correct, unknown: e.unknown, score: pct(e.correct, e.total),
    }))
  }, [dayGradings, workbooks])
  const sheetRows = useMemo(() => {
    const m = new Map<string, { name: string; total: number; correct: number; unknown: number }>()
    for (const g of dayGradings.filter(g => !isBook(g))) {
      const name = worksheets.find(w => w.id === g.worksheetId)?.title ?? '학습지'
      const e = m.get(name) ?? { name, total: 0, correct: 0, unknown: 0 }
      e.total += g.results.length
      e.correct += g.results.filter(r => r.correct).length
      e.unknown += g.results.filter(r => r.unknown).length
      m.set(name, e)
    }
    return [...m.values()].map(e => ({ name: e.name, range: '', total: e.total, correct: e.correct, unknown: e.unknown, score: pct(e.correct, e.total) }))
  }, [dayGradings, worksheets])
  const totalSolved = dayGradings.reduce((a, g) => a + g.results.length, 0)
  const totalCorrect = dayGradings.reduce((a, g) => a + g.results.filter(r => r.correct).length, 0)
  const totalUnknown = dayGradings.reduce((a, g) => a + g.results.filter(r => r.unknown).length, 0)
  const overall = pct(totalCorrect, totalSolved)

  // 내용 업그레이드: 지난 7일 평균 대비 + 연속 학습일
  const { weekAvg, weekDelta, streak } = useMemo(() => {
    const my = gradings.filter(g => g.studentId === student.id)
    const d0 = new Date(date + 'T00:00:00')
    // 지난 7일(오늘 제외) 평균 정답률
    let c = 0, t = 0
    for (const g of my) {
      const gd = new Date(dateKey(g.date) + 'T00:00:00')
      const diff = (d0.getTime() - gd.getTime()) / 86400000
      if (diff >= 1 && diff <= 7) { t += g.results.length; c += g.results.filter(r => r.correct).length }
    }
    const avg = t ? pct(c, t) : null
    // 연속 학습일 (오늘 포함해 과거로)
    const days = new Set(my.map(g => dateKey(g.date)))
    let s = 0
    for (let i = 0; i < 60; i++) {
      const k = dateKey(new Date(d0.getTime() - i * 86400000).toISOString())
      if (days.has(k)) s++
      else break
    }
    return { weekAvg: avg, weekDelta: avg == null || !totalSolved ? null : overall - avg, streak: s }
  }, [gradings, student.id, date, overall, totalSolved])

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

  // 오늘 수업 내용: 채점된 문항의 유형 → 단원(대·중단원) 단위로 집계
  const coveredUnits = useMemo(() => {
    const units = new Map<string, number>()   // "대단원 · 중단원" → 문항수
    const types = new Set<string>()
    for (const g of dayGradings)
      for (const r of g.results) {
        const t = resultTypeId(r, itemMap)
        if (!t) continue
        types.add(t)
        const raw = typeUnitName(t)
        if (raw) {
          const [big, mid] = raw.split(' · ')
          const label = !mid || big === mid ? big : raw   // 대단원=중단원이면 한 번만
          units.set(label, (units.get(label) ?? 0) + 1)
        }
      }
    return { units: [...units.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })), typeCount: types.size }
  }, [dayGradings, itemMap])

  // 오늘 만든 오답 드릴
  const drills = worksheets.filter(w =>
    !w.deletedAt && dateKey(w.createdAt) === date && w.title.startsWith(student.name) && w.tags.includes('오답'))

  const dateKr = date.replaceAll('-', '. ') + '.'

  // 오늘 데이터를 AI에 넘길 컨텍스트 문자열
  const aiContext = useMemo(() => {
    const L: string[] = [`학생: ${student.name}${student.klass ? ` (${student.klass})` : ''} · ${dateKr}`]
    if (coveredUnits.units.length) L.push('오늘 수업 단원: ' + coveredUnits.units.slice(0, 5).map(u => `${u.name}(${u.n}문항)`).join(', '))
    for (const r of bookRows) L.push(`교재 ${r.name} ${r.range}: ${r.total}문항 중 ${r.correct}정답 (${r.score}점)${r.unknown ? ` 모름 ${r.unknown}` : ''}`)
    for (const r of sheetRows) L.push(`학습지 ${r.name}: ${r.total}문항 중 ${r.correct}정답 (${r.score}점)`)
    if (totalSolved) L.push(`오늘 합계: ${totalSolved}문항 중 ${totalCorrect}정답 (${overall}점)${totalUnknown ? ` 모름 ${totalUnknown}` : ''}`)
    if (weekAvg != null && weekDelta != null) L.push(`지난 7일 평균 ${weekAvg}점 대비 ${weekDelta >= 0 ? '+' : ''}${weekDelta}점`)
    if (streak >= 2) L.push(`연속 학습 ${streak}일째`)
    if (wrongTypes.length) L.push('오늘 취약 유형: ' + wrongTypes.slice(0, 3).map(t => t.name).join(', ') + (drills.length ? ' (오답 드릴 학습지 생성함)' : ''))
    if (nextPlan) L.push('다음 학습 계획: ' + nextPlan)
    return L.join('\n')
  }, [student.name, student.klass, dateKr, coveredUnits, bookRows, sheetRows, totalSolved, totalCorrect, totalUnknown, overall, weekAvg, weekDelta, streak, wrongTypes, drills.length, nextPlan])

  // 오프라인/무키 폴백용 템플릿 초안 (API 미설정 시 사용)
  const templateComment = useMemo(() => {
    const parts: string[] = []
    const unitNames = coveredUnits.units.slice(0, 2).map(u => u.name.split(' · ').pop()).filter(Boolean)
    if (unitNames.length) parts.push(`오늘은 ${unitNames.join(', ')} 단원을 학습했습니다.`)
    if (totalSolved) {
      if (overall >= 90) parts.push(`${totalSolved}문항 중 ${totalCorrect}문항을 맞혀 ${overall}점, 아주 훌륭했습니다.`)
      else if (overall >= 70) parts.push(`${totalSolved}문항 기준 ${overall}점으로 안정적으로 잘 해냈습니다.`)
      else parts.push(`오늘은 ${overall}점으로 조금 아쉬웠지만 끝까지 성실하게 풀었습니다.`)
    }
    if (weekDelta != null && weekDelta >= 5) parts.push(`지난 7일 평균보다 ${weekDelta}점 올라 상승세가 뚜렷합니다.`)
    else if (weekDelta != null && weekDelta <= -5) parts.push(`지난 7일 평균보다 ${Math.abs(weekDelta)}점 내려가 다음 시간에 집중 보완하겠습니다.`)
    if (wrongTypes.length) parts.push(`「${wrongTypes[0].name}」 유형은 ${drills.length ? '오답 드릴 학습지로 한 번 더 다지겠습니다.' : '다음 시간에 복습하겠습니다.'}`)
    if (streak >= 3) parts.push(`${streak}일 연속 학습 중입니다. 꾸준함이 큰 힘이 됩니다!`)
    return parts.join(' ')
  }, [coveredUnits, totalSolved, totalCorrect, overall, weekDelta, wrongTypes, drills.length, streak])

  // 선생님 한마디 AI — 작성(generate)/다듬기(polish). 서버리스(/api/comment) 호출, 실패 시 템플릿 폴백.
  const [aiBusy, setAiBusy] = useState<'' | 'generate' | 'polish'>('')
  const [aiNote, setAiNote] = useState('')
  async function aiComment(mode: 'generate' | 'polish') {
    if (mode === 'polish' && !comment.trim()) { setAiNote('다듬을 내용을 먼저 입력하세요.'); return }
    setAiBusy(mode); setAiNote('')
    try {
      const r = await fetch('/api/comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, context: aiContext, draft: comment }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({} as { error?: string }))
        if (r.status === 503) {   // 키 미설정 → 템플릿 폴백(generate) / 안내(polish)
          if (mode === 'generate' && templateComment) { setComment(templateComment); persist({ comment: templateComment }); setAiNote('AI 미설정 — 기본 문구로 작성(설정하면 더 자연스러워집니다).') }
          else setAiNote('AI 다듬기는 서버 설정(ANTHROPIC_API_KEY) 후 사용할 수 있습니다.')
        } else setAiNote('AI 오류: ' + (e.error ?? r.status))
        return
      }
      const { text } = await r.json() as { text: string }
      setComment(text); persist({ comment: text })
    } catch {
      if (mode === 'generate' && templateComment) { setComment(templateComment); persist({ comment: templateComment }); setAiNote('네트워크 오류 — 기본 문구로 작성.') }
      else setAiNote('네트워크 오류로 AI 호출에 실패했습니다.')
    } finally { setAiBusy('') }
  }

  // 단톡방 복사용 텍스트 (교재/학습지 섹션 분리, 모름 표기)
  const kakaoText = useMemo(() => {
    const lines: (string | null)[] = [
      `[깊은생각수학] ${student.name}${student.klass ? ` (${student.klass})` : ''} 오늘 학습`,
      `📅 ${dateKr}`,
      (checkIn || checkOut) ? `⏰ 등원 ${checkIn || '—'} · 하원 ${checkOut || '—'}` : null,
      todayPlanText ? `📘 오늘 진도: ${todayPlanText}` : null,
      '',
      coveredUnits.units.length ? '📚 오늘 수업 내용' : null,
      ...coveredUnits.units.slice(0, 4).map(u => `· ${u.name} (${u.n}문항)`),
      coveredUnits.units.length ? '' : null,
      bookRows.length ? '📖 오늘 푼 교재' : null,
      ...bookRows.map(r => `· ${r.name} ${r.range} — ${r.total}문항 중 ${r.correct}개 정답 (${r.score}점)${r.unknown ? ` · 모름 ${r.unknown}개` : ''}`),
      sheetRows.length ? '🧾 오늘 푼 학습지' : null,
      ...sheetRows.map(r => `· ${r.name} — ${r.total}문항 중 ${r.correct}개 정답 (${r.score}점)${r.unknown ? ` · 모름 ${r.unknown}개` : ''}`),
      totalSolved
        ? `= 오늘 총 ${totalSolved}문항 중 ${totalCorrect}개 정답 (${overall}점)${totalUnknown ? ` · 모름 ${totalUnknown}개` : ''}`
        : '오늘 채점 기록이 없습니다.',
      weekDelta != null ? `📈 지난 7일 평균(${weekAvg}점) 대비 ${weekDelta >= 0 ? '+' : ''}${weekDelta}점` : null,
      streak >= 2 ? `🔥 연속 학습 ${streak}일째!` : null,
      wrongTypes.length ? '' : null,
      wrongTypes.length ? '🔁 오늘 약했던 유형' : null,
      wrongTypes.length ? `· ${wrongTypes.map(t => t.name).join(', ')}` : null,
      wrongTypes.length ? (drills.length ? '→ 오답 드릴 학습지로 복습 예정' : '→ 다음 시간 복습 예정') : null,
      (comment.trim() || templateComment) ? '' : null,
      (comment.trim() || templateComment) ? '📝 선생님 한마디' : null,
      (comment.trim() || templateComment) || null,
      nextPlan ? '' : null,
      nextPlan ? `📌 다음 학습: ${nextPlan}` : null,
      nextSession ? `📅 다음 수업${nextSession.isMakeup ? '(보강)' : ''}: ${nextSession.label}${nextPlanText ? ` (${nextPlanText})` : ''}` : null,
      '',
      '오늘도 열심히 했습니다. 감사합니다 😊',
    ]
    return lines.filter((l): l is string => l !== null).join('\n')
  }, [student.name, student.klass, dateKr, coveredUnits, bookRows, sheetRows, totalSolved, totalCorrect, totalUnknown, overall, weekAvg, weekDelta, streak, wrongTypes, drills.length, comment, templateComment, nextPlan, checkIn, checkOut, nextSession, todayPlanText, nextPlanText])

  // 이미지 카드 복사/저장
  const cardRef = useRef<HTMLDivElement>(null)
  const [imgState, setImgState] = useState<'idle' | 'busy' | 'copied' | 'saved'>('idle')
  async function cardToBlob(): Promise<Blob | null> {
    if (!cardRef.current) return null
    return toBlob(cardRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
  }
  async function copyCardImage() {
    setImgState('busy')
    try {
      const blob = await cardToBlob()
      if (!blob) throw new Error('render fail')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setImgState('copied')
    } catch {
      // 클립보드 이미지가 안 되는 환경(사파리 등) → 파일 저장 폴백
      try {
        const blob = await cardToBlob()
        if (!blob) throw new Error('render fail')
        downloadBlob(blob, `${student.name}_일일리포트_${date}.png`)
        setImgState('saved')
      } catch { setImgState('idle'); alert('이미지 생성에 실패했습니다.') }
    }
    setTimeout(() => setImgState('idle'), 2200)
  }
  async function saveCardImage() {
    setImgState('busy')
    try {
      const blob = await cardToBlob()
      if (!blob) throw new Error('render fail')
      downloadBlob(blob, `${student.name}_일일리포트_${date}.png`)
      setImgState('saved')
    } catch { alert('이미지 생성에 실패했습니다.') }
    setTimeout(() => setImgState('idle'), 2200)
  }

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
          className="rounded-lg border border-amber px-4 py-2 text-sm font-semibold text-amber hover:bg-amber/10">
          {copied ? '✓ 복사됨' : '💬 텍스트 복사'}
        </button>
        <button onClick={copyCardImage} disabled={imgState === 'busy'}
          className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white hover:brightness-105 disabled:opacity-60">
          {imgState === 'busy' ? '만드는 중…' : imgState === 'copied' ? '✓ 복사됨 — 카톡에 붙여넣기' : imgState === 'saved' ? '✓ 파일로 저장됨' : '🖼 이미지 카드 복사'}
        </button>
        <button onClick={saveCardImage} disabled={imgState === 'busy'}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink2 hover:bg-paper2" title="PNG 파일로 저장">⬇</button>
        <button onClick={() => window.print()} className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">🖨 보고지 인쇄</button>
      </div>

      <div className="no-print mb-5 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 text-sm font-bold">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span>선생님 한마디 <span className="font-normal text-ink2">(자동 저장)</span></span>
            <div className="flex gap-1">
              <button type="button" onClick={() => aiComment('generate')} disabled={!!aiBusy}
                className="rounded-md border border-amber/60 px-2.5 py-1 text-xs font-bold text-amber hover:bg-amber/10 disabled:opacity-50"
                title="오늘 데이터로 선생님 한마디를 AI가 작성합니다.">
                {aiBusy === 'generate' ? '작성 중…' : '✨ AI 작성'}
              </button>
              <button type="button" onClick={() => aiComment('polish')} disabled={!!aiBusy}
                className="rounded-md border border-pine/60 px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft disabled:opacity-50"
                title="직접 쓴 문장을 AI가 자연스럽고 정중하게 다듬어 줍니다(내용은 유지).">
                {aiBusy === 'polish' ? '다듬는 중…' : '🪄 AI 다듬기'}
              </button>
            </div>
          </div>
          <textarea value={comment}
            onChange={e => { setComment(e.target.value); persist({ comment: e.target.value }) }} rows={3}
            placeholder="직접 입력하거나 [✨ AI 작성]으로 초안을 만들 수 있습니다. 직접 쓴 뒤 [🪄 AI 다듬기]로 문장을 정돈하세요. 비워두면 카드엔 기본 문구가 표시됩니다."
            className="rounded-lg border border-line px-3 py-2 font-normal" />
          {aiNote && <span className="text-xs font-normal text-clay">{aiNote}</span>}
        </div>
        <label className="grid gap-1 text-sm font-bold">다음 학습 계획 <span className="font-normal text-ink2">(자동 저장)</span>
          <textarea value={nextPlan}
            onChange={e => { setNextPlan(e.target.value); persist({ nextPlan: e.target.value }) }} rows={3}
            placeholder="예: 최소공배수 오답 드릴 + 쎈 91~94p"
            className="rounded-lg border border-line px-3 py-2 font-normal" />
        </label>
      </div>

      {/* 수업 일정(다음 수업·보강) + 등·하원 체크 — 코멘트 근처 (자동 저장) */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-paper2/40 px-4 py-3 text-sm">
        {todayPlanText && (
          <div className="flex items-center gap-2">
            <span className="font-bold">오늘 진도</span>
            <span className="rounded-md bg-pine-soft px-2 py-1 text-xs font-bold text-pine-dark">{todayPlanText}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="font-bold">다음 수업</span>
          {nextSession ? (
            <span className={`rounded-md px-2 py-1 text-xs font-bold ${nextSession.isMakeup ? 'bg-amber-soft text-amber' : 'bg-pine-soft text-pine-dark'}`}>
              {nextSession.label}{nextSession.isMakeup ? ' · 보강' : ''}{nextPlanText ? ` · ${nextPlanText}` : ''}
            </span>
          ) : (
            <span className="text-xs text-ink2">수업 요일 미설정 (관리 → 학생 등록에서 지정)</span>
          )}
        </div>
        <label className="flex items-center gap-2">
          <span className="font-bold">보강일</span>
          <input type="date" value={makeupDate}
            onChange={e => { setMakeupDate(e.target.value); persist({ makeupDate: e.target.value }) }}
            className="rounded-lg border border-line px-2 py-1.5 text-sm" />
          {makeupDate && (
            <button type="button" onClick={() => { setMakeupDate(''); persist({ makeupDate: '' }) }}
              className="text-xs text-ink2 underline hover:text-ink">지우기</button>
          )}
          <span className="text-xs text-ink2">있으면 다음 수업 우선</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="font-bold">등·하원</span>
          <button type="button" onClick={stampIn}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${checkIn ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
            {checkIn ? `🟢 등원 ${checkIn}` : '🟢 등원 체크'}
          </button>
          <button type="button" onClick={stampOut}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${checkOut ? 'border-clay bg-red-50 text-clay' : 'border-line text-ink2 hover:border-pine'}`}>
            {checkOut ? `🔴 하원 ${checkOut}` : '🔴 하원 체크'}
          </button>
          <span className="text-xs text-ink2">누른 시간만 보고서에 표시</span>
        </div>
      </div>

      {/* 단톡방 이미지 카드 (미리보기가 곧 캡처 원본) */}
      <div className="no-print mb-6">
        <div className="mb-2 text-center text-xs text-ink2">👇 아래 카드가 그대로 이미지가 됩니다 — [🖼 이미지 카드 복사] 후 카톡에 붙여넣기</div>
        <div className="flex justify-center">
          <div ref={cardRef}>
            <ReportCard student={student} dateKr={dateKr} bookRows={bookRows} sheetRows={sheetRows}
              totalSolved={totalSolved} totalCorrect={totalCorrect} totalUnknown={totalUnknown} overall={overall}
              weekAvg={weekAvg} weekDelta={weekDelta} streak={streak} wrongTypes={wrongTypes}
              covered={coveredUnits.units} hasDrill={drills.length > 0} comment={comment.trim() || templateComment} nextPlan={nextPlan}
              nextSession={nextSession} checkIn={checkIn} checkOut={checkOut}
              todayPlanText={todayPlanText} nextPlanText={nextPlanText} />
          </div>
        </div>
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
        {(checkIn || checkOut) && (
          <div className="mb-4 flex gap-4 text-sm">
            <span>🟢 등원 <b>{checkIn || '—'}</b></span>
            <span>🔴 하원 <b>{checkOut || '—'}</b></span>
          </div>
        )}
        {todayPlanText && (
          <div className="mb-4 text-sm">📘 오늘 진도 <b>{todayPlanText}</b></div>
        )}

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

        {(comment.trim() || templateComment) && <Section title="📝 선생님 한마디"><p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.trim() || templateComment}</p></Section>}
        {nextPlan && <Section title="📌 다음 학습 계획"><p className="whitespace-pre-wrap text-sm leading-relaxed">{nextPlan}</p></Section>}
        {nextSession && <Section title={`📅 다음 수업${nextSession.isMakeup ? ' (보강)' : ''}`}><p className="text-sm font-semibold">{nextSession.label}{nextPlanText ? ` · ${nextPlanText}` : ''}</p></Section>}

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

// ── 단톡방용 이미지 리포트 카드 (인라인 스타일 — html-to-image 캡처 원본) ──────────
const C = { blue: '#2b7de9', blueDark: '#1b5fc2', blueSoft: '#eef5fe', ink: '#1f2937', ink2: '#6b7280',
  line: '#e5e7eb', amberSoft: '#fff7e6', amber: '#b45309', red: '#dc2626', redSoft: '#fdecec', green: '#15803d' }

function ReportCard({ student, dateKr, bookRows, sheetRows, totalSolved, totalCorrect, totalUnknown, overall,
  weekAvg, weekDelta, streak, wrongTypes, covered, hasDrill, comment, nextPlan, nextSession, checkIn, checkOut,
  todayPlanText, nextPlanText }: {
  student: Student; dateKr: string
  bookRows: { name: string; range: string; total: number; correct: number; unknown: number; score: number }[]
  sheetRows: { name: string; total: number; correct: number; unknown: number; score: number }[]
  totalSolved: number; totalCorrect: number; totalUnknown: number; overall: number
  weekAvg: number | null; weekDelta: number | null; streak: number
  wrongTypes: { name: string; n: number }[]; covered: { name: string; n: number }[]
  hasDrill: boolean; comment: string; nextPlan: string
  nextSession: { key: string; label: string; isMakeup: boolean } | null; checkIn: string; checkOut: string
  todayPlanText: string; nextPlanText: string
}) {
  const rows = [
    ...bookRows.map(r => ({ ...r, icon: '📖', sub: r.range })),
    ...sheetRows.map(r => ({ ...r, icon: '🧾', sub: '' })),
  ]
  const boxStyle = { borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.6 } as const
  return (
    <div style={{ width: 440, background: '#ffffff', borderRadius: 20, overflow: 'hidden',
      border: `1px solid ${C.line}`, color: C.ink, fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,.07)' }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`, color: '#fff', padding: '16px 20px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 900, fontSize: 15 }}>깊은생각수학</span>
          <span style={{ fontSize: 12, opacity: .85 }}>{dateKr}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>
          {student.name} <span style={{ fontWeight: 400, fontSize: 14, opacity: .9 }}>{student.klass ? `· ${student.klass}` : ''} 일일 학습 리포트</span>
        </div>
      </div>

      <div style={{ padding: '14px 18px 16px' }}>
        {/* 등·하원 (체크한 경우에만) */}
        {(checkIn || checkOut) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: C.blueSoft, borderRadius: 10, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink2 }}>🟢 등원</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: C.blueDark }}>{checkIn || '—'}</span>
            </div>
            <div style={{ flex: 1, background: C.blueSoft, borderRadius: 10, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink2 }}>🔴 하원</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: C.blueDark }}>{checkOut || '—'}</span>
            </div>
          </div>
        )}
        {todayPlanText && (
          <div style={{ ...boxStyle, background: C.blueSoft, marginBottom: 12 }}>
            <span style={{ fontWeight: 800, color: C.blueDark }}>📘 오늘 진도 </span>
            <span style={{ fontWeight: 700 }}>{todayPlanText}</span>
          </div>
        )}
        {totalSolved === 0 ? (
          <div style={{ ...boxStyle, background: C.blueSoft, textAlign: 'center', color: C.ink2 }}>오늘 채점 기록이 없습니다.</div>
        ) : (
          <>
            {/* 스탯 타일 */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '푼 문제', value: `${totalSolved}문항` },
                { label: '오늘 점수', value: `${overall}점` },
                streak >= 2 ? { label: '연속 학습', value: `🔥 ${streak}일째` } : { label: '정답', value: `${totalCorrect}개` },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: C.blueSoft, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.ink2, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: C.blueDark, marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* 정답률 바 + 주간 비교 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>정답률 {overall}%{totalUnknown > 0 && <span style={{ color: C.red, fontWeight: 600 }}> · 모름 {totalUnknown}개</span>}</span>
                {weekDelta != null && (
                  <span style={{ color: weekDelta >= 0 ? C.green : C.red }}>
                    {weekDelta >= 0 ? '▲' : '▼'} 지난 7일 평균({weekAvg}점) 대비 {weekDelta >= 0 ? '+' : ''}{weekDelta}점
                  </span>
                )}
              </div>
              <div style={{ height: 10, borderRadius: 6, background: '#eceff3', overflow: 'hidden' }}>
                <div style={{ width: `${overall}%`, height: '100%', borderRadius: 6,
                  background: `linear-gradient(90deg, ${C.blue}, ${C.blueDark})` }} />
              </div>
            </div>

            {/* 오늘 수업 내용 */}
            {covered.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>📚 오늘 수업 내용</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {covered.slice(0, 4).map((u, i) => (
                    <span key={i} style={{ background: C.blueSoft, color: C.blueDark, borderRadius: 999,
                      padding: '3px 10px', fontSize: 11.5, fontWeight: 700 }}>{u.name} · {u.n}문항</span>
                  ))}
                  {covered.length > 4 && <span style={{ fontSize: 11.5, color: C.ink2, alignSelf: 'center' }}>외 {covered.length - 4}개 단원</span>}
                </div>
              </div>
            )}

            {/* 학습 내역 */}
            <div style={{ marginTop: 12, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  borderTop: i ? `1px solid ${C.line}` : 'none', fontSize: 13 }}>
                  <span>{r.icon}</span>
                  <span style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}{r.sub && <span style={{ fontWeight: 400, color: C.ink2 }}> {r.sub}</span>}
                  </span>
                  <span style={{ color: C.ink2, fontSize: 12 }}>{r.correct}/{r.total}</span>
                  <span style={{ fontWeight: 900, color: C.blueDark, minWidth: 38, textAlign: 'right' }}>{r.score}점</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 취약 유형 */}
        {wrongTypes.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>🔁 오늘 보완할 유형</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {wrongTypes.slice(0, 4).map((t, i) => (
                <span key={i} style={{ background: C.redSoft, color: C.red, borderRadius: 999, padding: '3px 10px',
                  fontSize: 11.5, fontWeight: 700 }}>{t.name}{t.n > 1 ? ` ×${t.n}` : ''}</span>
              ))}
              {wrongTypes.length > 4 && <span style={{ fontSize: 11.5, color: C.ink2, alignSelf: 'center' }}>외 {wrongTypes.length - 4}개</span>}
            </div>
            <div style={{ fontSize: 11.5, color: C.ink2, marginTop: 5 }}>
              {hasDrill ? '→ 오답 드릴 학습지로 복습 예정입니다.' : '→ 다음 시간에 복습할 예정입니다.'}
            </div>
          </div>
        )}

        {/* 선생님 한마디 / 다음 학습 */}
        {comment && (
          <div style={{ ...boxStyle, background: C.amberSoft, marginTop: 12 }}>
            <span style={{ fontWeight: 800, color: C.amber }}>📝 선생님 한마디 </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{comment}</span>
          </div>
        )}
        {nextPlan && (
          <div style={{ ...boxStyle, background: C.blueSoft, marginTop: comment ? 8 : 12 }}>
            <span style={{ fontWeight: 800, color: C.blueDark }}>📌 다음 학습 </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{nextPlan}</span>
          </div>
        )}
        {nextSession && (
          <div style={{ ...boxStyle, background: nextSession.isMakeup ? C.amberSoft : C.blueSoft, marginTop: 8 }}>
            <span style={{ fontWeight: 800, color: nextSession.isMakeup ? C.amber : C.blueDark }}>
              📅 다음 수업{nextSession.isMakeup ? '(보강)' : ''} </span>
            <span style={{ fontWeight: 700 }}>{nextSession.label}</span>
            {nextPlanText && <span style={{ color: C.ink2 }}> · {nextPlanText}</span>}
          </div>
        )}

        {/* 푸터 */}
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.line}`,
          display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.ink2 }}>
          <span>깊은생각수학 학습관리 시스템 · 자동 생성</span>
          <span>오늘도 열심히 했습니다 😊</span>
        </div>
      </div>
    </div>
  )
}
