import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CURRICULA, allTypeIds, typeName } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import { pickProblems } from '../lib/select'
import { achievementColor, weakTypes, wrongByType } from '../lib/drill'
import type { GradeResult } from '../types'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import Placeholder from '../components/Placeholder'

// 매쓰플랫과 동일한 6탭. 유형분석=우리 오답 현황·드릴, 교재=우리 채점 (오답 드릴 흡수)
type Tab = 'history' | 'today' | 'analysis' | 'worksheet' | 'material' | 'report'
const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '학습내역' },
  { key: 'today', label: '오늘의 학습' },
  { key: 'analysis', label: '유형분석' },
  { key: 'worksheet', label: '학습지' },
  { key: 'material', label: '교재' },
  { key: 'report', label: '보고서' },
]

export default function Lesson() {
  const store = useStore()
  const { students, workbooks, wbItems, gradings, problems, worksheets, dailyNotes, saveGrading, saveWorksheet, saveDailyNote, diffMatrix } = store
  const nav = useNavigate()
  const active = students.filter(s => s.active)
  const [studentId, setStudentId] = useState<string | null>(active[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('analysis')

  const student = active.find(s => s.id === studentId) ?? null

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
        먼저 <b className="text-pine">관리 → 학생 관리</b>에서 학생을 등록하세요.
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* 학생 목록 */}
      <aside className="no-print h-fit rounded-2xl border border-line bg-white p-3">
        <div className="mb-2 px-2 text-xs font-bold text-ink2">학생 {active.length}명</div>
        {active.map(s => (
          <button key={s.id} onClick={() => setStudentId(s.id)}
            className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm ${studentId === s.id ? 'bg-pine-soft font-bold text-pine-dark' : 'hover:bg-paper2'}`}>
            {s.name} {s.klass && <span className="text-xs text-ink2">· {s.klass}</span>}
          </button>
        ))}
      </aside>

      <main>
        {student && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-1">
              <h1 className="pb-3 text-lg font-black">{student.name}</h1>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-bold ${tab === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'analysis' && <WeakPanel studentId={student.id} studentName={student.name} />}
            {tab === 'material' && (
              workbooks.length === 0
                ? <Empty text={<>먼저 <b className="text-pine">수업 준비 → 교재 → 정답표</b>에서 시중문제집 정답표를 등록하세요.</>} />
                : <GradePanel studentId={student.id} />
            )}
            {tab === 'history' && <Placeholder title="학습내역"
              original={['학생에게 출제한 학습지·교재 이력, 채점 점수, 모니터링']}
              plan="출제·숙제 기능이 붙으면 학생별 출제 이력으로 채웁니다. 지금은 교재 채점 이력이 유형분석에 반영됩니다." />}
            {tab === 'today' && <Placeholder title="오늘의 학습"
              original={['학생별 범위·난이도 옵션으로 매일 맞춤 문제 자동 출제']}
              plan="문제은행이 충분해지면 학생별 취약 유형 기반 매일 자동 출제로 구현." />}
            {tab === 'worksheet' && <Placeholder title="학습지"
              original={['이 학생에게 출제한 학습지 현황·채점']}
              plan="학생 출제·자동 채점 기능과 함께 활성화." />}
            {tab === 'report' && <ReportPanel studentId={student.id} studentName={student.name} klass={student.klass} />}
          </>
        )}
      </main>
    </div>
  )

  // ── 교재 채점 ──────────────────────────────
  function GradePanel({ studentId }: { studentId: string }) {
    const [wbId, setWbId] = useState(workbooks[0].id)
    const wbAll = useMemo(() => wbItems.filter(i => i.workbookId === wbId).sort((a, b) => a.page - b.page || a.no - b.no), [wbId, wbItems])
    const pages = [...new Set(wbAll.map(i => i.page))].sort((a, b) => a - b)
    const [from, setFrom] = useState(pages[0] ?? 1)
    const [to, setTo] = useState(pages.at(-1) ?? 1)
    // 교재 전환·매칭 문항 로드 시 쪽 범위를 교재 전체로 초기화
    useEffect(() => { if (pages.length) { setFrom(pages[0]); setTo(pages[pages.length - 1]) } // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wbId, wbAll.length])
    const inRange = wbAll.filter(i => i.page >= from && i.page <= to)
    // 기본 전부 정답, 틀린 것만 체크
    const [wrong, setWrong] = useState<Set<string>>(new Set())
    const [saved, setSaved] = useState<{ score: number; total: number } | null>(null)

    function toggle(id: string) {
      setWrong(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
    }
    function grade() {
      if (inRange.length === 0) { alert('범위에 문항이 없습니다.'); return }
      const results: GradeResult[] = inRange.map(i => ({
        itemId: i.id, studentAnswer: wrong.has(i.id) ? '오답' : i.answer, correct: !wrong.has(i.id),
      }))
      saveGrading({ studentId, workbookId: wbId, date: new Date().toISOString(), pageFrom: from, pageTo: to, results })
      const correct = results.filter(r => r.correct).length
      setSaved({ score: correct, total: results.length })
      setWrong(new Set())
    }

    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <select value={wbId} onChange={e => { setWbId(e.target.value); setSaved(null) }}
            className="rounded-lg border border-line px-3 py-2 font-semibold">
            {workbooks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <label className="flex items-center gap-1">쪽
            <input type="number" value={from} onChange={e => setFrom(Number(e.target.value) || 1)} className="w-16 rounded border border-line px-2 py-1.5" />
            ~
            <input type="number" value={to} onChange={e => setTo(Number(e.target.value) || 1)} className="w-16 rounded border border-line px-2 py-1.5" />
          </label>
          <span className="text-ink2">범위 {inRange.length}문항</span>
          <div className="grow" />
          <span className="text-xs text-ink2">틀린 문항만 클릭 → 채점</span>
          <button onClick={grade} className="rounded-lg bg-pine px-5 py-2 font-bold text-paper">채점 저장</button>
        </div>

        {saved && (
          <div className="mb-4 rounded-xl bg-pine-soft/50 p-4 text-sm">
            ✅ 채점 저장됨 — <b>{saved.total}문항 중 {saved.score}개 정답</b> ({Math.round(saved.score / saved.total * 100)}점).
            오답 유형은 <b>오답 현황·드릴</b> 탭에 누적됩니다.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {inRange.map(i => {
            const isWrong = wrong.has(i.id)
            return (
              <button key={i.id} onClick={() => toggle(i.id)}
                className={`rounded-xl border p-3 text-left transition ${isWrong ? 'border-clay bg-red-50' : 'border-line bg-white hover:border-pine'}`}>
                <div className="flex items-center justify-between">
                  <b className="text-sm">p.{i.page} {i.label ?? i.no}번</b>
                  <span className={`text-lg font-black ${isWrong ? 'text-clay' : 'text-pine'}`}>{isWrong ? '✕' : '○'}</span>
                </div>
                <div className="mt-1 text-[11px] text-ink2">{typeName(i.typeId)}</div>
                <div className="text-[11px] text-ink2">정답 {i.answer || '—'}</div>
              </button>
            )
          })}
        </div>
        {inRange.length === 0 && <Empty text="이 범위에 등록된 문항이 없습니다. 교재 정답표를 확인하세요." />}
      </div>
    )
  }

  // ── 오답 현황 + 드릴 생성 ──────────────────────────────
  function WeakPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
    const stats = useMemo(() => wrongByType(studentId, gradings, wbItems), [studentId])
    const statMap = useMemo(() => new Map(stats.map(s => [s.typeId, s])), [stats])
    const weak = weakTypes(stats)
    const typeOrder = useMemo(() => allTypeIds(), [])
    const studentGrade = students.find(s => s.id === studentId)?.grade ?? '중1-1'

    function makeDrill() {
      const weakTypeIds = new Set(weak.map(w => w.typeId))
      const pool = problems.filter(p => weakTypeIds.has(p.typeId))
      if (pool.length === 0) { alert('오답 유형에 해당하는 자체 문제(쌍둥이/유사)가 문제은행에 아직 없습니다. 문제은행을 채워주세요.'); return }
      const order = typeOrder.filter(t => weakTypeIds.has(t))
      const count = Math.min(20, pool.length)
      const picked = pickProblems(pool, count, 3, 'all', order, diffMatrix)
      const id = uid('ws')
      saveWorksheet({
        id,
        title: `${studentName} 오답 드릴 (${new Date().toLocaleDateString('ko-KR')})`,
        author: '깊은생각수학',
        grade: studentGrade,
        tags: ['오답', '취약유형'],
        theme: 'amber',
        problemIds: picked.map(p => p.id),
        conceptIds: [],
        options: DEFAULT_SHEET_OPTIONS,
        listIds: [],
        createdAt: new Date().toISOString(),
        deletedAt: null,
      })
      nav(`/worksheet/${id}`)
    }

    return (
      <div>
        <div className="mb-5 flex items-center gap-3">
          <div className="text-sm text-ink2">
            누적 채점 {gradings.filter(g => g.studentId === studentId).length}회 · 취약 유형 <b className="text-clay">{weak.length}</b>개
          </div>
          <div className="grow" />
          <button onClick={makeDrill} disabled={weak.length === 0}
            className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
            🔁 오답 드릴 학습지 만들기
          </button>
        </div>

        {weak.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">
            아직 오답이 없습니다. <b>교재 채점</b> 탭에서 채점하면 여기 취약 유형이 쌓이고, 그 유형의 자체 쌍둥이로 드릴 학습지를 만듭니다.
          </div>
        )}

        {/* 성취도 매트릭스 (단원×유형) */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center gap-3 text-xs text-ink2">
            <span>성취도</span>
            <Legend c="bg-stone-100 text-stone-400" t="미학습" />
            <Legend c="bg-red-100 text-red-800" t="취약" />
            <Legend c="bg-amber-soft text-amber" t="보통" />
            <Legend c="bg-pine-soft text-pine-dark" t="양호" />
            <Legend c="bg-pine text-white" t="우수" />
          </div>
          {CURRICULA
            .filter(c => c.units.some(u => u.mids.some(m => m.subs.some(s => s.types.some(t => statMap.has(t.id))))))
            .map(c => (
              <div key={c.id} className="mb-4">
                <div className="mb-1 text-xs font-black text-amber">{c.grade} {c.label.replace(' (22개정)', '')}</div>
                {c.units.filter(u => u.mids.some(m => m.subs.some(s => s.types.some(t => statMap.has(t.id))))).map(u => (
                  <div key={u.id} className="mb-2">
                    <div className="mb-1 text-sm font-bold">{u.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {u.mids.flatMap(m => m.subs.flatMap(s => s.types)).filter(t => statMap.has(t.id)).map(t => {
                        const st = statMap.get(t.id)
                        return (
                          <span key={t.id} title={st ? `${st.total - st.wrong}/${st.total} 정답` : '기록 없음'}
                            className={`rounded px-2 py-1 text-xs font-semibold ${achievementColor(st)}`}>
                            {typeName(t.id)}{st && st.wrong > 0 ? ` (오답 ${st.wrong})` : ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          {stats.length === 0 && <p className="text-sm text-ink2">채점 기록이 쌓이면 유형별 성취도가 여기 표시됩니다.</p>}
        </div>
      </div>
    )
  }

  // ── 일일 보고지 (하원 시 학부모 단톡방 피드백) ──────────────────────────────
  function ReportPanel({ studentId, studentName, klass }: { studentId: string; studentName: string; klass?: string }) {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const saved = dailyNotes.find(n => n.studentId === studentId && n.date === date)
    const [comment, setComment] = useState(saved?.comment ?? '')
    const [nextPlan, setNextPlan] = useState(saved?.nextPlan ?? '')
    const [copied, setCopied] = useState(false)

    // 학생·날짜가 바뀌면 저장분 불러오기
    useEffect(() => {
      const n = dailyNotes.find(x => x.studentId === studentId && x.date === date)
      setComment(n?.comment ?? '')
      setNextPlan(n?.nextPlan ?? '')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId, date])

    function persist(c: string, p: string) {
      saveDailyNote({ studentId, date, comment: c, nextPlan: p })
    }

    const dayGradings = useMemo(
      () => gradings.filter(g => g.studentId === studentId && g.date.slice(0, 10) === date),
      [studentId, date],
    )
    const wbName = (wid: string) => workbooks.find(w => w.id === wid)?.name ?? '교재'
    const itemById = useMemo(() => new Map(wbItems.map(i => [i.id, i])), [])

    // 채점 요약
    const graded = dayGradings.map(g => {
      const total = g.results.length
      const correct = g.results.filter(r => r.correct).length
      return { name: wbName(g.workbookId), from: g.pageFrom, to: g.pageTo, total, correct, score: total ? Math.round(correct / total * 100) : 0 }
    })
    // 오늘 약했던 유형
    const wrongTypeNames = useMemo(() => {
      const set = new Map<string, number>()
      for (const g of dayGradings)
        for (const r of g.results)
          if (!r.correct) {
            const t = itemById.get(r.itemId)?.typeId
            if (t) set.set(t, (set.get(t) ?? 0) + 1)
          }
      return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => typeName(t))
    }, [dayGradings, itemById])
    // 오늘 만든 오답 드릴
    const drills = worksheets.filter(w =>
      !w.deletedAt && w.createdAt.slice(0, 10) === date && w.title.startsWith(studentName) && w.tags.includes('오답'))

    const totalSolved = graded.reduce((a, g) => a + g.total, 0)
    const totalCorrect = graded.reduce((a, g) => a + g.correct, 0)
    const overall = totalSolved ? Math.round(totalCorrect / totalSolved * 100) : 0
    const dateKr = date.replaceAll('-', '. ') + '.'

    // 단톡방 복사용 텍스트
    const kakaoText = [
      `[깊은생각수학] ${studentName}${klass ? ` (${klass})` : ''} 오늘 학습`,
      `📅 ${dateKr}`,
      '',
      graded.length ? '📖 오늘 푼 교재' : '',
      ...graded.map(g => `· ${g.name} ${g.from}~${g.to}p — ${g.total}문항 중 ${g.correct}개 정답 (${g.score}점)`),
      graded.length ? `= 오늘 총 ${totalSolved}문항 중 ${totalCorrect}개 정답 (${overall}점)` : '오늘 채점 기록이 없습니다.',
      '',
      wrongTypeNames.length ? '🔁 오늘 약했던 유형' : '',
      wrongTypeNames.length ? `· ${wrongTypeNames.join(', ')}` : '',
      drills.length ? '→ 오답 드릴 학습지로 복습 예정' : (wrongTypeNames.length ? '→ 다음 시간 복습 예정' : ''),
      comment ? '' : '',
      comment ? '📝 선생님 한마디' : '',
      comment ? comment : '',
      nextPlan ? '' : '',
      nextPlan ? `📌 다음 학습: ${nextPlan}` : '',
      '',
      '오늘도 열심히 했습니다. 감사합니다 😊',
    ].filter(l => l !== '').join('\n')

    async function copy() {
      try {
        await navigator.clipboard.writeText(kakaoText)
        setCopied(true); setTimeout(() => setCopied(false), 1800)
      } catch {
        alert('복사 실패 — 아래 텍스트를 길게 눌러 직접 복사하세요.')
      }
    }

    return (
      <div>
        <div className="no-print mb-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">날짜
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg border border-line px-3 py-2" />
          </label>
          <div className="grow" />
          <button onClick={copy} className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white hover:brightness-105">
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
            <span className="font-bold">{studentName} {klass && <span className="font-normal text-ink2">· {klass}</span>}</span>
            <span className="text-ink2">{dateKr}</span>
          </div>

          <Section title="📖 오늘 푼 교재">
            {graded.length === 0 ? <Dim>오늘 채점 기록이 없습니다.</Dim> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-ink2"><th className="py-1">교재</th><th>범위</th><th>정답/문항</th><th>점수</th></tr></thead>
                <tbody>
                  {graded.map((g, i) => (
                    <tr key={i} className="border-b border-line/50">
                      <td className="py-1.5 font-semibold">{g.name}</td>
                      <td>{g.from}~{g.to}p</td>
                      <td>{g.correct}/{g.total}</td>
                      <td className="font-bold text-pine-dark">{g.score}점</td>
                    </tr>
                  ))}
                  <tr className="font-bold"><td className="py-1.5">합계</td><td /><td>{totalCorrect}/{totalSolved}</td><td className="text-pine-dark">{overall}점</td></tr>
                </tbody>
              </table>
            )}
          </Section>

          <Section title="🔁 오늘 약했던 유형">
            {wrongTypeNames.length === 0 ? <Dim>오답 유형이 없습니다.</Dim> : (
              <div className="flex flex-wrap gap-1.5">
                {wrongTypeNames.map(n => <span key={n} className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">{n}</span>)}
              </div>
            )}
            {drills.length > 0 && <p className="mt-2 text-sm text-ink2">→ 오답 드릴 학습지 <b>{drills.length}건</b>으로 복습 예정</p>}
          </Section>

          {comment && <Section title="📝 선생님 한마디"><p className="whitespace-pre-wrap text-sm leading-relaxed">{comment}</p></Section>}
          {nextPlan && <Section title="📌 다음 학습 계획"><p className="whitespace-pre-wrap text-sm leading-relaxed">{nextPlan}</p></Section>}

          <p className="mt-6 text-center text-sm text-ink2">오늘도 열심히 했습니다. 감사합니다 😊</p>
        </div>

        {/* 단톡방 미리보기 */}
        <div className="no-print mx-auto mt-5 max-w-3xl rounded-2xl border border-line bg-paper2 p-5">
          <div className="mb-2 text-xs font-bold text-ink2">단톡방 전송 미리보기 (복사 버튼으로 그대로 붙여넣기)</div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{kakaoText}</pre>
        </div>
      </div>
    )
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sheet-problem mb-4">
      <div className="mb-1.5 text-sm font-black text-pine-dark">{title}</div>
      {children}
    </div>
  )
}
function Dim({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink2">{children}</p>
}

function Legend({ c, t }: { c: string; t: string }) {
  return <span className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded ${c}`} />{t}</span>
}

function Empty({ text }: { text: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">{text}</div>
}
