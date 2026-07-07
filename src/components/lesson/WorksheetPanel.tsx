import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Assignment, GradeResult, Grading, Problem, Student, Worksheet } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import { normAnswer } from '../../lib/answers'
import { typeName } from '../../data/curriculum'
import ProblemContent from '../ProblemContent'
import DrillModal, { type DrillWrong } from './DrillModal'
import PeriodWrongModal from './PeriodWrongModal'

const CIRCLED = ['①', '②', '③', '④', '⑤']

// 수업 > 학습지 탭 (매쓰플랫 동일) — 이 학생에게 출제한 학습지 목록·자동채점·오답 재출제
export default function WorksheetPanel({ student }: { student: Student }) {
  const { worksheets, assignments, gradings, problems, addAssignment, removeAssignment } = useStore()
  const nav = useNavigate()

  const [tag, setTag] = useState('전체')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'assigned' | 'graded'>('assigned')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [gradeWs, setGradeWs] = useState<Worksheet | null>(null)
  const [drill, setDrill] = useState<{ title: string; wrongs: DrillWrong[] } | null>(null)
  const [periodOpen, setPeriodOpen] = useState(false)

  const problemMap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])

  // 이 학생 출제 행 (학습지 조인, 삭제분 제외)
  const rows = useMemo(() => {
    return assignments
      .filter(a => a.studentId === student.id)
      .map(a => ({ a, ws: worksheets.find(w => w.id === a.worksheetId) }))
      .filter((r): r is { a: Assignment; ws: Worksheet } => !!r.ws && !r.ws.deletedAt)
  }, [assignments, worksheets, student.id])

  // 학습지별 최신 채점
  const latestBy = useMemo(() => {
    const m = new Map<string, Grading>()
    for (const g of gradings) {
      if (g.studentId !== student.id || g.source !== '학습지' || !g.worksheetId) continue
      const cur = m.get(g.worksheetId)
      if (!cur || g.date > cur.date) m.set(g.worksheetId, g)
    }
    return m
  }, [gradings, student.id])

  const tags = useMemo(() => [...new Set(rows.flatMap(r => r.ws.tags))], [rows])

  const shown = useMemo(() => {
    let list = rows
    if (tag !== '전체') list = list.filter(r => r.ws.tags.includes(tag))
    const needle = q.trim().toLowerCase()
    if (needle) list = list.filter(r => r.ws.title.toLowerCase().includes(needle))
    return [...list].sort((x, y) => {
      if (sort === 'graded') {
        const gx = latestBy.get(x.ws.id)?.date ?? ''
        const gy = latestBy.get(y.ws.id)?.date ?? ''
        if (gx !== gy) return gy.localeCompare(gx)
      }
      return y.a.date.localeCompare(x.a.date)
    })
  }, [rows, tag, q, sort, latestBy])

  function scoreOf(wsId: string): string {
    const g = latestBy.get(wsId)
    if (!g || g.results.length === 0) return '미채점'
    const correct = g.results.filter(r => r.correct).length
    return `${Math.round(correct / g.results.length * 100)}점`
  }

  const hasHomework = (wsId: string) =>
    assignments.some(a => a.worksheetId === wsId && a.studentId === student.id && a.kind === '숙제')

  // 최신 채점의 오답 → 오답 재출제 (틀린 원문제 id 포함)
  function redrill(ws: Worksheet) {
    const g = latestBy.get(ws.id)
    if (!g) {
      alert('채점 기록이 없습니다. 먼저 채점하세요.')
      return
    }
    const wrongs: DrillWrong[] = []
    g.results.forEach((r, i) => {
      if (r.correct) return
      const pid = ws.problemIds[i]
      const p = pid ? problemMap.get(pid) : undefined
      const typeId = r.typeId ?? p?.typeId
      if (typeId) wrongs.push({ typeId, diff: p?.diff, problemId: pid })
    })
    if (wrongs.length === 0) {
      alert('최신 채점에 오답이 없습니다.')
      return
    }
    setDrill({ title: `[오답] ${ws.title}`, wrongs })
  }

  function cancelAssign(ws: Worksheet) {
    if (confirm('채점 기록은 유지됩니다. 출제를 취소할까요?')) removeAssignment(ws.id, student.id)
  }

  if (gradeWs) {
    return <WorksheetGrade student={student} ws={gradeWs} onBack={() => setGradeWs(null)} />
  }

  return (
    <div>
      {/* 상단 필터 바 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <select value={tag} onChange={e => setTag(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-semibold">
          <option value="전체">전체 태그</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="학습지명 검색"
          className="w-48 rounded-lg border border-line px-3 py-2" />
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button onClick={() => setSort('assigned')}
            className={`px-3 py-2 font-semibold ${sort === 'assigned' ? 'bg-pine text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
            출제일순
          </button>
          <button onClick={() => setSort('graded')}
            className={`px-3 py-2 font-semibold ${sort === 'graded' ? 'bg-pine text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
            채점일순
          </button>
        </div>
        <div className="grow" />
        <button onClick={() => setPeriodOpen(true)}
          className="rounded-lg bg-amber px-5 py-2 font-bold text-white hover:brightness-105">
          기간별 오답 학습지
        </button>
      </div>

      {/* 목록 */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          {rows.length === 0
            ? <>아직 이 학생에게 출제한 학습지가 없습니다. <b className="text-pine">학습지 만들기</b>에서 만든 학습지를 출제하세요.</>
            : '조건에 맞는 학습지가 없습니다.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="px-4 py-2.5">출제일</th>
                <th className="py-2.5">구분</th>
                <th className="py-2.5">학습지명</th>
                <th className="py-2.5">문항</th>
                <th className="py-2.5">점수</th>
                <th className="py-2.5 text-right pr-4">관리</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ a, ws }) => {
                const g = latestBy.get(ws.id)
                return (
                  <tr key={a.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink2">{dateKey(a.date)}</td>
                    <td className="py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${a.kind === '수업' ? 'bg-pine-soft text-pine-dark' : 'bg-amber-soft text-amber'}`}>
                        {a.kind}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <b>{ws.title}</b>
                        {ws.tags.map(t => (
                          <span key={t} className="rounded bg-paper2 px-1.5 py-0.5 text-[11px] text-ink2">{t}</span>
                        ))}
                        {ws.options.autoGrade && (
                          <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">자동채점</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 whitespace-nowrap text-ink2">{ws.problemIds.length}문제</td>
                    <td className={`py-2.5 whitespace-nowrap ${g ? 'font-bold text-pine-dark' : 'text-ink2'}`}>
                      {scoreOf(ws.id)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="relative flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Link to={`/worksheet/${ws.id}`}
                          className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-paper2">
                          미리보기
                        </Link>
                        {ws.options.autoGrade && (
                          <button onClick={() => setGradeWs(ws)}
                            className="rounded-lg bg-pine px-2.5 py-1 text-xs font-bold text-paper hover:brightness-110">
                            채점
                          </button>
                        )}
                        {a.kind === '수업' && (
                          <button onClick={() => addAssignment(ws.id, [student.id], '숙제')}
                            disabled={hasHomework(ws.id)}
                            className="rounded-lg border border-amber px-2.5 py-1 text-xs font-bold text-amber hover:bg-amber-soft disabled:opacity-40 disabled:hover:bg-transparent">
                            숙제내기
                          </button>
                        )}
                        <button onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
                          className="rounded-lg border border-line px-2 py-1 text-xs font-bold hover:bg-paper2">
                          ⋮
                        </button>
                        {menuFor === a.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-line bg-white py-1 text-left shadow-lg">
                              <MenuItem onClick={() => { setMenuFor(null); nav(`/make?edit=${ws.id}`) }}>수정</MenuItem>
                              <MenuItem onClick={() => { setMenuFor(null); redrill(ws) }}>오답 재출제</MenuItem>
                              <MenuItem danger onClick={() => { setMenuFor(null); cancelAssign(ws) }}>출제 취소</MenuItem>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {drill && (
        <DrillModal student={student} title={drill.title} wrongs={drill.wrongs} onClose={() => setDrill(null)} />
      )}
      {periodOpen && <PeriodWrongModal student={student} onClose={() => setPeriodOpen(false)} />}
    </div>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`block w-full px-4 py-2 text-left text-sm hover:bg-paper2 ${danger ? 'text-clay' : 'text-ink'}`}>
      {children}
    </button>
  )
}

// ── 자동채점 화면 — 문제 렌더 + 답 입력 → 채점 저장 ──────────────────────────────
function WorksheetGrade({ student, ws, onBack }: { student: Student; ws: Worksheet; onBack: () => void }) {
  const { problems, saveGrading } = useStore()
  const list = useMemo(() => {
    const m = new Map(problems.map(p => [p.id, p]))
    return ws.problemIds.map(id => m.get(id)).filter((p): p is Problem => !!p)
  }, [problems, ws.problemIds])

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{
    correct: number
    total: number
    wrongs: DrillWrong[]
    marks: Record<string, boolean>
  } | null>(null)
  const [drillOpen, setDrillOpen] = useState(false)

  function setAnswer(pid: string, v: string) {
    setAnswers(prev => ({ ...prev, [pid]: v }))
  }

  function grade() {
    if (list.length === 0) {
      alert('채점할 문제가 없습니다.')
      return
    }
    const results: GradeResult[] = []
    const wrongs: DrillWrong[] = []
    const marks: Record<string, boolean> = {}
    for (const p of list) {
      const studentAnswer = answers[p.id] ?? ''
      const correct = normAnswer(studentAnswer) !== '' && normAnswer(studentAnswer) === normAnswer(p.answer)
      results.push({ typeId: p.typeId, studentAnswer, correct })
      marks[p.id] = correct
      if (!correct) wrongs.push({ typeId: p.typeId, diff: p.diff, problemId: p.id })
    }
    saveGrading({
      studentId: student.id,
      source: '학습지',
      worksheetId: ws.id,
      date: new Date().toISOString(),
      results,
    })
    setResult({ correct: results.filter(r => r.correct).length, total: results.length, wrongs, marks })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 목록</button>
        <div>
          <div className="font-black">{ws.title}</div>
          <div className="text-xs text-ink2">{student.name} · {list.length}문제 자동채점</div>
        </div>
        <div className="grow" />
        <button onClick={grade} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-110">
          자동 채점 저장
        </button>
      </div>

      {result && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-pine-soft/50 p-4 text-sm">
          <span>
            ✅ 채점 저장됨 — <b>{result.total}문제 중 {result.correct}개 정답</b>
            (<b className="text-pine-dark">{Math.round(result.correct / result.total * 100)}점</b>)
          </span>
          <div className="grow" />
          {result.wrongs.length > 0 && (
            <button onClick={() => setDrillOpen(true)}
              className="rounded-lg bg-amber px-4 py-2 font-bold text-white hover:brightness-105">
              오답 {result.wrongs.length}문제로 오답 학습지 만들기
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {list.map((p, i) => {
          const mark = result?.marks[p.id]
          return (
            <div key={p.id} className={`rounded-2xl border bg-white p-5 ${result ? (mark ? 'border-pine' : 'border-clay') : 'border-line'}`}>
              <div className="mb-2 flex items-center gap-2 text-xs text-ink2">
                <b className="text-sm text-ink">{i + 1}.</b>
                <span>{typeName(p.typeId)}</span>
                {result && (
                  <span className={`ml-auto text-lg font-black ${mark ? 'text-pine' : 'text-clay'}`}>
                    {mark ? '○' : '✕'}
                  </span>
                )}
              </div>
              <ProblemContent p={p} />
              <div className="mt-3 flex items-center gap-2">
                {p.kind === '객관식' ? (
                  <div className="flex gap-1.5">
                    {CIRCLED.map(c => (
                      <button key={c} type="button"
                        onClick={() => setAnswer(p.id, answers[p.id] === c ? '' : c)}
                        className={`h-9 w-9 rounded-full border text-base font-bold ${answers[p.id] === c ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={answers[p.id] ?? ''} onChange={e => setAnswer(p.id, e.target.value)}
                    placeholder="답 입력"
                    className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
                )}
                {result && !mark && (
                  <span className="text-xs text-ink2">정답 <b className="text-pine-dark">{p.answer}</b></span>
                )}
              </div>
            </div>
          )
        })}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
            이 학습지의 문제를 문제은행에서 찾을 수 없습니다.
          </div>
        )}
      </div>

      {drillOpen && result && (
        <DrillModal student={student} title={`[오답] ${ws.title}`} wrongs={result.wrongs} onClose={() => setDrillOpen(false)} />
      )}
    </div>
  )
}
