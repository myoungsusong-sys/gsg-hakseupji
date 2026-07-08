import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Assignment, Diff, GradeResult, Grading, Problem, Student, Worksheet } from '../../types'
import { DIFF_LABEL } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import { normAnswer } from '../../lib/answers'
import { typeName } from '../../data/curriculum'
import ProblemContent from '../ProblemContent'
import VideoModal from '../VideoModal'
import WorksheetOutputDialog from '../WorksheetOutputDialog'
import DrillModal, { type DrillWrong } from './DrillModal'
import PeriodWrongModal from './PeriodWrongModal'

const CIRCLED = ['①', '②', '③', '④', '⑤']

// 태그 필터 고정 목록 (매쓰플랫 동일 — 존재 태그가 아니라 이 고정 세트)
const TAG_OPTIONS = [
  '태그 전체', '기본', '연산문제', '숙제', '복습', '연산',
  '입학TEST', '일일TEST', '주간TEST', '단원TEST', '총괄TEST', '내신대비', '서술형',
]

// 수업 > 학습지 탭 (매쓰플랫 동일) — 이 학생에게 출제한 학습지 목록·자동채점·오답 재출제
export default function WorksheetPanel({ student }: { student: Student }) {
  const { worksheets, assignments, gradings, problems, addAssignment, removeAssignment, duplicateWorksheet } = useStore()
  const nav = useNavigate()

  const [tag, setTag] = useState('태그 전체')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'assigned' | 'graded'>('assigned')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [gradeWs, setGradeWs] = useState<Worksheet | null>(null)
  const [drill, setDrill] = useState<{ title: string; wrongs: DrillWrong[] } | null>(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  // 행 체크 선택(학습지 id) → 하단 고정 다크 액션바 (매쓰플랫 동일)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [outDialog, setOutDialog] = useState<'download' | 'print' | null>(null)

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

  const shown = useMemo(() => {
    let list = rows
    if (tag !== '태그 전체') list = list.filter(r => r.ws.tags.includes(tag))
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

  function scoreOf(g: Grading): number {
    const correct = g.results.filter(r => r.correct).length
    return Math.round(correct / g.results.length * 100)
  }

  const hasHomework = (wsId: string) =>
    assignments.some(a => a.worksheetId === wsId && a.studentId === student.id && a.kind === '숙제')

  // 학습지명 밑 파란 부제: "n문제 | 난이도(최빈) | 첫유형 ~ 끝유형"
  function sheetMeta(ws: Worksheet): string {
    const list = ws.problemIds.map(id => problemMap.get(id)).filter((p): p is Problem => !!p)
    if (list.length === 0) return `${ws.problemIds.length}문제`
    const count = new Map<Diff, number>()
    for (const p of list) count.set(p.diff, (count.get(p.diff) ?? 0) + 1)
    let best: Diff = list[0].diff
    let bestN = 0
    for (const [d, n] of count) if (n > bestN) { best = d; bestN = n }
    const first = typeName(list[0].typeId)
    const last = typeName(list[list.length - 1].typeId)
    const range = first === last ? first : `${first} ~ ${last}`
    return `${ws.problemIds.length}문제 | ${DIFF_LABEL[best]} | ${range}`
  }

  // 수정 후 재출제 — 복제본을 만들어 편집 화면으로 (원본·채점 기록은 보존)
  function editReassign(ws: Worksheet) {
    const nid = duplicateWorksheet(ws.id)
    if (nid) nav(`/make?edit=${nid}`)
  }

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

  /* ── 하단 액션바 동작 (선택 학습지 일괄) ── */
  function toggleChecked(wsId: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(wsId)) n.delete(wsId); else n.add(wsId); return n })
  }
  // 숙제 내기 — 이미 숙제면 addAssignment가 무시
  function homeworkChecked() {
    ;[...checked].forEach(wsId => addAssignment(wsId, [student.id], '숙제'))
    setChecked(new Set())
  }
  // 인쇄/다운로드 — v1은 한 번에 1개 학습지만
  function openOut(mode: 'download' | 'print') {
    if (checked.size !== 1) {
      alert('인쇄·다운로드는 한 번에 1개 학습지만 지원합니다')
      return
    }
    setOutDialog(mode)
  }
  function cancelChecked() {
    if (!confirm(`선택한 학습지 ${checked.size}개의 출제를 취소할까요? (채점 기록은 유지됩니다)`)) return
    ;[...checked].forEach(wsId => removeAssignment(wsId, student.id))
    setChecked(new Set())
  }

  if (gradeWs) {
    return <WorksheetGrade student={student} ws={gradeWs} onBack={() => setGradeWs(null)} />
  }

  return (
    <div>
      {/* 상단 필터 바 (매쓰플랫 동일) */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <select value={tag} onChange={e => setTag(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 font-semibold">
          {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="학습지명 검색"
          className="w-48 rounded-lg border border-line px-3 py-2" />
        <div className="grow" />
        <button onClick={() => setPeriodOpen(true)}
          className="rounded-lg border border-pine px-4 py-2 font-bold text-pine hover:bg-pine-soft">
          단원·기간별 취약 유형 관리
        </button>
      </div>

      {/* 안내문 + 정렬 토글 */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-ink2">
        <span>학습지를 선택해서 숙제를 낼 수 있습니다.</span>
        <div className="grow" />
        <div className="flex items-center gap-1.5 font-semibold">
          <button onClick={() => setSort('assigned')}
            className={sort === 'assigned' ? 'text-pine' : 'text-ink2 hover:text-ink'}>
            {sort === 'assigned' && '✓ '}출제일
          </button>
          <span>·</span>
          <button onClick={() => setSort('graded')}
            className={sort === 'graded' ? 'text-pine' : 'text-ink2 hover:text-ink'}>
            {sort === 'graded' && '✓ '}채점일
          </button>
        </div>
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
                <th className="w-10 px-3 py-2.5 text-center">
                  <input type="checkbox" className="h-4 w-4 accent-pine"
                    checked={shown.length > 0 && shown.every(r => checked.has(r.ws.id))}
                    onChange={e => setChecked(e.target.checked ? new Set(shown.map(r => r.ws.id)) : new Set())} />
                </th>
                <th className="px-2 py-2.5">학년</th>
                <th className="py-2.5">태그</th>
                <th className="py-2.5">학습지명</th>
                <th className="py-2.5">출제일</th>
                <th className="py-2.5">숙제내기</th>
                <th className="py-2.5">미리보기</th>
                <th className="py-2.5">채점</th>
                <th className="py-2.5 pr-4 text-right">더보기</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ a, ws }) => {
                const g = latestBy.get(ws.id)
                return (
                  <tr key={a.id} className="border-b border-line/50 last:border-0">
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked={checked.has(ws.id)} onChange={() => toggleChecked(ws.id)}
                        className="h-4 w-4 accent-pine" />
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <div className="font-semibold">{ws.grade.split('-')[0]}</div>
                      <div className="text-[11px] text-ink2">(22개정)</div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {ws.tags.map(t => (
                          <span key={t} className="rounded bg-paper2 px-1.5 py-0.5 text-[11px] text-ink2">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <b>{ws.title}</b>
                        {ws.options.autoGrade && (
                          <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[11px] font-bold text-pine-dark">자동 채점</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-pine">{sheetMeta(ws)}</div>
                    </td>
                    <td className="py-2.5 whitespace-nowrap text-ink2">{dateKey(a.date).slice(2).replace(/-/g, '.')}</td>
                    <td className="py-2.5 whitespace-nowrap">
                      {a.kind === '수업' ? (
                        <button onClick={() => addAssignment(ws.id, [student.id], '숙제')}
                          disabled={hasHomework(ws.id)}
                          className="rounded-lg border border-amber px-2.5 py-1 text-xs font-bold text-amber hover:bg-amber-soft disabled:opacity-40 disabled:hover:bg-transparent">
                          숙제내기
                        </button>
                      ) : (
                        <span className="rounded bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">숙제</span>
                      )}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <Link to={`/worksheet/${ws.id}`}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-paper2">
                        미리보기
                      </Link>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      {!ws.options.autoGrade ? (
                        <span className="text-ink2">-</span>
                      ) : g && g.results.length > 0 ? (
                        <button onClick={() => setGradeWs(ws)}
                          className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">
                          {scoreOf(g)}점
                        </button>
                      ) : (
                        <button onClick={() => setGradeWs(ws)}
                          className="rounded-lg bg-pine px-2.5 py-1 text-xs font-bold text-paper hover:brightness-110">
                          이어 채점
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="relative flex items-center justify-end whitespace-nowrap">
                        <button onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
                          className="rounded-lg border border-line px-2 py-1 text-xs font-bold hover:bg-paper2">
                          ⋮
                        </button>
                        {menuFor === a.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-line bg-white py-1 text-left shadow-lg">
                              <MenuItem onClick={() => { setMenuFor(null); nav(`/make?edit=${ws.id}`) }}>수정</MenuItem>
                              <MenuItem onClick={() => { setMenuFor(null); editReassign(ws) }}>수정 후 재출제</MenuItem>
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

      {/* 하단 고정 다크 액션바 (매쓰플랫 동일): "학습지 N개 선택됨" + 숙제 내기·인쇄·다운로드·출제 취소 + ✕ */}
      {checked.size > 0 && (
        <>
          <div className="h-20" />{/* 액션바가 마지막 행을 가리지 않게 여백 */}
          <div className="fixed inset-x-0 bottom-0 z-30">
            <div className="mx-auto flex max-w-4xl items-center gap-1 rounded-t-2xl bg-[#3d4350] px-6 py-2.5 text-white shadow-[0_-4px_16px_rgba(0,0,0,0.25)]">
              <span className="text-sm font-semibold">학습지 {checked.size}개 선택됨</span>
              <div className="grow" />
              <BarBtn icon="📖" label="숙제 내기" onClick={homeworkChecked} />
              <BarBtn icon="🖨" label="인쇄" onClick={() => openOut('print')} />
              <BarBtn icon="⬇" label="다운로드" onClick={() => openOut('download')} />
              <BarBtn icon="⊖" label="출제 취소" onClick={cancelChecked} />
              <button onClick={() => setChecked(new Set())} title="선택 해제"
                className="ml-3 self-start text-base leading-none text-white/60 hover:text-white">✕</button>
            </div>
          </div>
        </>
      )}

      {/* 학습지 다운로드/인쇄 다이얼로그 (1개 선택 시) */}
      {outDialog && (() => {
        const target = worksheets.find(w => w.id === [...checked][0])
        return target ? (
          <WorksheetOutputDialog mode={outDialog} ws={target} studentNames={[student.name]}
            onClose={() => setOutDialog(null)} />
        ) : null
      })()}

      {drill && (
        <DrillModal student={student} title={drill.title} wrongs={drill.wrongs} onClose={() => setDrill(null)} />
      )}
      {periodOpen && <PeriodWrongModal student={student} onClose={() => setPeriodOpen(false)} />}
    </div>
  )
}

/* 액션바 아이콘 버튼 (아이콘 위 · 라벨 아래) */
function BarBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs text-white/90 hover:bg-white/10">
      <span className="text-base leading-none">{icon}</span>
      {label}
    </button>
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
const isImgAnswer = (a: string) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(a)

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
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

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
      // 답이 이미지(서술형 등)인 문항은 텍스트 대조 불가 → 선생님 ○/✕ 수동 마크
      const correct = isImgAnswer(p.answer)
        ? studentAnswer === '○'
        : normAnswer(studentAnswer) !== '' && normAnswer(studentAnswer) === normAnswer(p.answer)
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
                {p.videoUrl && (
                  <button onClick={() => setVideo({ src: p.videoUrl!, subtitle: p.subtitleUrl, title: `${i + 1}번 풀이영상` })}
                    className="rounded-full border border-pine px-2 py-0.5 text-[11px] font-bold text-pine hover:bg-pine-soft">
                    ▶ 풀이영상
                  </button>
                )}
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
                ) : isImgAnswer(p.answer) ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-lg border border-line bg-paper2/60 p-2">
                      <div className="mb-1 text-[10px] text-ink2">정답 (이미지) — 학생 답과 대조 후 표시</div>
                      <img src={p.answer} alt="정답" className="max-h-16 w-auto" />
                    </div>
                    {(['○', '✕'] as const).map(m2 => (
                      <button key={m2} type="button" onClick={() => setAnswer(p.id, answers[p.id] === m2 ? '' : m2)}
                        className={`h-9 w-9 rounded-full border text-base font-black ${answers[p.id] === m2 ? (m2 === '○' ? 'border-pine bg-pine text-paper' : 'border-clay bg-clay text-white') : 'border-line bg-white text-ink hover:bg-paper2'}`}>
                        {m2}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={answers[p.id] ?? ''} onChange={e => setAnswer(p.id, e.target.value)}
                    placeholder="답 입력"
                    className="w-56 rounded-lg border border-line px-3 py-2 text-sm" />
                )}
                {result && !mark && !isImgAnswer(p.answer) && (
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
      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}
