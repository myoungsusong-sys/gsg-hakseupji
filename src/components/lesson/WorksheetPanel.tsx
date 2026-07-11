import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Assignment, Diff, GradeResult, Grading, Problem, Student, Worksheet } from '../../types'
import { DIFF_LABEL } from '../../types'
import { useStore, uid } from '../../lib/store'
import { useBrand } from '../../lib/brand'
import { dateKey, todayKey } from '../../lib/dates'
import { typeName } from '../../data/curriculum'
import MathText from '../MathText'
import ProblemContent from '../ProblemContent'
import VideoModal from '../VideoModal'
import WorksheetOutputDialog from '../WorksheetOutputDialog'
import DrillModal, { type DrillWrong } from './DrillModal'
import PeriodWrongModal from './PeriodWrongModal'

const CIRCLED = ['①', '②', '③', '④', '⑤']

// 태그 필터 고정 목록 (매쓰플랫 동일 27종 — 존재 태그가 아니라 이 고정 세트)
const TAG_OPTIONS = [
  '태그 전체', '기본', '연습문제', '숙제', '복습', '연산',
  '입학TEST', '일일TEST', '주간TEST', '단원TEST', '총괄TEST', '내신대비', '서술형',
  '모의고사', '모의고사 쌍둥이', '수능대비', '원본', '기출 유사', '기타자료 유사',
  '유형별 학습', '유형별 오답', '취약유형', '그룹취약유형', '단원별 취약',
  '기간별 오답', '학습지 오답', '교재 오답', '기타',
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
      // 신규 기록은 itemId=문제 id (마킹된 문항만 기록) · 구버전 기록은 순서=problemIds 순서
      const pid = r.itemId ?? ws.problemIds[i]
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

// ── 학습지 채점 화면 — 매쓰플랫 group-scoring 동일: 선생님이 정답을 보며 문항별 ○/✕/? 마킹 ──
// (구버전의 "학생이 답을 입력하는" UI는 학생앱용으로 src/components/student/AnswerInput.tsx에 보존)
// 채점 상호작용·실시간 자동 저장은 교재 채점(GradePanel)과 통일:
//  · 셀 클릭 순환: 미채점 → ✕(오답) → ?(모름) → ○(정답) → 미채점
//  · 저장은 "마킹된 문항만" 기록 (itemId=문제 id) — 미채점 = 기록 없음
//  · 같은 학습지·같은 날 기록은 한 건에 덮어쓰기(upsert), 재방문 시 최신 기록 프리필
type SheetMark = '정답' | '오답' | '모름'
const SHEET_NEXT: Record<SheetMark, SheetMark | null> = { 오답: '모름', 모름: '정답', 정답: null }
const SHEET_ICON: Record<SheetMark, string> = { 정답: '○', 오답: '✕', 모름: '?' }
const SHEET_MARK_CLASS: Record<SheetMark, string> = { 정답: 'text-pine', 오답: 'text-clay', 모름: 'text-amber' }
// 행 배경: 정답=연파랑(pine-soft) · 오답=연분홍 · 모름=연노랑 · 미채점=흰색 (GradePanel과 동일 팔레트)
const SHEET_ROW_CLASS: Record<SheetMark, string> = {
  정답: 'bg-pine-soft/40',
  오답: 'bg-red-50',
  모름: 'bg-amber-soft/50',
}

const isImgAnswer = (a: string) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(a)

// 좌열 정답 표시 — 객관식 숫자→①~⑤, 이미지 정답→이미지, 수식(LaTeX)→KaTeX, 그 외 원문
function SheetAnswer({ p }: { p: Problem }) {
  const a = p.answer?.trim() ?? ''
  if (!a || ['.', '-'].includes(a)) return <span className="text-ink2/70">풀이참조</span>
  if (isImgAnswer(a)) return <img src={a} alt="정답" className="max-h-14 w-auto" />
  if (p.kind === '객관식') {
    const t = a.split(',').map(s => {
      const raw = s.trim()
      const idx = CIRCLED.indexOf(raw)
      const n = idx >= 0 ? idx + 1 : Number(raw)
      return n >= 1 && n <= 5 ? CIRCLED[n - 1] : raw
    }).join(', ')
    return <b>{t}</b>
  }
  if (a.includes('$')) return <MathText text={a} />
  if (/[\\{}^_]/.test(a)) return <MathText text={`$${a}$`} />
  return <b>{a}</b>
}

function WorksheetGrade({ student, ws, onBack }: { student: Student; ws: Worksheet; onBack: () => void }) {
  const { problems, gradings, upsertGrading } = useStore()
  const brand = useBrand()
  const list = useMemo(() => {
    const m = new Map(problems.map(p => [p.id, p]))
    return ws.problemIds.map(id => m.get(id)).filter((p): p is Problem => !!p)
  }, [problems, ws.problemIds])

  const [marks, setMarks] = useState<Record<string, SheetMark>>({})
  // 연타 유실 방지: 같은 틱에 여러 셀을 클릭해도 항상 최신 marks 위에서 갱신 (GradePanel 동일)
  const marksRef = useRef(marks)
  const [hideAnswers, setHideAnswers] = useState(false)
  const [openBody, setOpenBody] = useState<Set<string>>(new Set())   // 「문제 보기」 펼친 문항
  const [drillOpen, setDrillOpen] = useState(false)
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState('')
  // 열람 시각 (매쓰플랫: "YYYY.MM.DD HH:MM 열람")
  const [openedAt] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })

  // ── 실시간 자동 저장 (교재 채점과 동일 패턴: 0.9초 디바운스 upsert) ──
  const pendingRef = useRef<Grading | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gidRef = useRef<string | null>(null)
  const gradingsRef = useRef(gradings)
  gradingsRef.current = gradings

  function flushSave() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    const g = pendingRef.current
    if (!g) return
    pendingRef.current = null
    upsertGrading(g)
    setSaveState('saved')
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }
  const flushRef = useRef(flushSave)
  flushRef.current = flushSave

  function queueSave(next: Record<string, SheetMark>) {
    if (list.length === 0) return
    // ★ 마킹된 문항만 기록 — itemId=문제 id (미채점 문항은 결과에 넣지 않는다)
    const results: GradeResult[] = list
      .filter(p => next[p.id] != null)
      .map(p => {
        const m = next[p.id]!
        return { itemId: p.id, typeId: p.typeId, correct: m === '정답', unknown: m === '모름' || undefined }
      })
    const today = todayKey()
    const exist = gradingsRef.current.find(g =>
      g.studentId === student.id && g.source === '학습지' && g.worksheetId === ws.id && dateKey(g.date) === today)
    // 아무것도 마킹돼 있지 않고 기존 기록도 없으면 빈 기록을 만들지 않는다
    if (results.length === 0 && !exist && !gidRef.current) return
    const id = exist?.id ?? gidRef.current ?? uid('gr')
    gidRef.current = id
    pendingRef.current = {
      id, studentId: student.id, source: '학습지', worksheetId: ws.id,
      date: new Date().toISOString(), results,
    }
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flushRef.current(), 900)
  }

  // 진입 시 최신 채점 기록 프리필 — 신규 기록은 itemId 기준, 구버전(전문항 저장)은 순서 기준
  useEffect(() => {
    gidRef.current = null
    let latest: Grading | undefined
    for (const g of gradingsRef.current) {
      if (g.studentId !== student.id || g.source !== '학습지' || g.worksheetId !== ws.id) continue
      if (!latest || g.date > latest.date) latest = g
    }
    const seeded: Record<string, SheetMark> = {}
    latest?.results.forEach((r, i) => {
      const pid = r.itemId ?? ws.problemIds[i]
      if (!pid) return
      seeded[pid] = r.unknown ? '모름' : r.correct ? '정답' : '오답'
    })
    marksRef.current = seeded
    setMarks(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.id, student.id])

  // 목록 복귀·언마운트 시 대기분 저장
  useEffect(() => () => flushRef.current(), [])

  // marks 갱신은 반드시 이 함수를 통해서 — ref 동기 갱신으로 연타 유실 없음
  function applyMarks(mutate: (prev: Record<string, SheetMark>) => Record<string, SheetMark>) {
    const next = mutate(marksRef.current)
    marksRef.current = next
    setMarks(next)
    queueSave(next)
  }
  function cycle(pid: string) {
    applyMarks(prev => {
      const cur = prev[pid]
      const next = { ...prev }
      if (!cur) next[pid] = '오답'                       // 미채점 → 첫 클릭은 오답 (오답 위주 채점)
      else if (SHEET_NEXT[cur]) next[pid] = SHEET_NEXT[cur]!
      else delete next[pid]                              // 정답 → 미채점 (마킹 해제)
      return next
    })
  }
  function setAll(m: SheetMark) {
    applyMarks(prev => {
      const next = { ...prev }
      for (const p of list) next[p.id] = m
      return next
    })
  }
  function clearAll() {   // 전체 취소 — 전 문항 미채점 (기록에서도 제거)
    applyMarks(prev => {
      const next = { ...prev }
      for (const p of list) delete next[p.id]
      return next
    })
  }
  function toggleBody(pid: string) {
    setOpenBody(prev => { const n = new Set(prev); if (n.has(pid)) n.delete(pid); else n.add(pid); return n })
  }

  // 실시간 요약 — 마킹된 문항 기준 (점수 = 정답/마킹수)
  const live = useMemo(() => {
    let marked = 0, correct = 0, wrong = 0, unknown = 0
    const wrongs: DrillWrong[] = []
    for (const p of list) {
      const m = marks[p.id]
      if (!m) continue
      marked++
      if (m === '정답') correct++
      else {
        if (m === '모름') unknown++
        else wrong++
        wrongs.push({ typeId: p.typeId, diff: p.diff, problemId: p.id })   // 원문제 id 보존 → 드릴 "원문제 포함"
      }
    }
    return { marked, correct, wrong, unknown, wrongs }
  }, [list, marks])
  const score = live.marked > 0 ? Math.round(live.correct / live.marked * 100) : null

  // [원클릭 보고서] — 이 학습지 채점 결과를 단톡방용 텍스트로 즉시 복사
  async function oneClickReport() {
    const lines = [
      `[${brand}] ${student.name} 학습 결과`,
      `📄 ${ws.title}`,
      score != null
        ? `채점 ${live.marked}/${list.length}문항 — 정답 ${live.correct} · 오답 ${live.wrong} · 모름 ${live.unknown} (${score}점)`
        : '아직 채점 전입니다.',
      '',
      '오늘도 열심히 했습니다. 감사합니다 😊',
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      alert('원클릭 보고서를 복사했습니다. 단톡방에 붙여넣으세요.')
    } catch { alert('복사에 실패했습니다. 보고서 탭에서 복사해 주세요.') }
  }

  // [🔔 문제 오류 신고] — 문항 정보를 담은 메일 작성 (오류 신고 채널)
  function reportProblem(no: number, p: Problem) {
    const body = `학습지: ${ws.title}%0A문항: ${no}번 (id ${p.id})%0A유형: ${typeName(p.typeId)}%0A오류 내용: `
    location.href = `mailto:songmyoungsu79@gmail.com?subject=${encodeURIComponent(`[문제 오류 신고] ${ws.title} ${no}번`)}&body=${body}`
  }

  return (
    <div>
      {/* 헤더: ← 학습지명 + 열람 시각 + [원클릭 보고서] (매쓰플랫 group-scoring 헤더) */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 목록</button>
        <div>
          <div className="font-black">{ws.title}</div>
          <div className="text-xs text-ink2">
            {openedAt} 열람 · {list.length}문제 · 선생님 채점 (셀 클릭: ✕ → ? → ○ → 해제)
          </div>
        </div>
        <div className="grow" />
        <button onClick={oneClickReport}
          className="rounded-lg border border-amber px-3 py-2 text-xs font-bold text-amber hover:bg-amber-soft">
          원클릭 보고서
        </button>
        {/* 학생 이름 + 점수 (실시간, 마킹 기준) */}
        <div className="rounded-xl border border-line bg-white px-4 py-2 text-right">
          <div className="text-xs font-semibold text-ink2">{student.name}</div>
          <div className={`text-lg font-black ${score != null ? 'text-pine-dark' : 'text-ink2/50'}`}>
            {score != null ? `${score}점` : '미채점'}
          </div>
        </div>
      </div>

      {/* 자동 저장 안내 + 요약 + 일괄 채점 버튼 (교재 채점과 동일) */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-xs text-ink2">
          채점 기록은 실시간으로 자동 저장됩니다.
          {saveState === 'saving' && <span className="ml-2 text-amber">저장 중…</span>}
          {saveState === 'saved' && <span className="ml-2 text-pine">✓ 저장됨 {savedAt}</span>}
        </span>
        {list.length > 0 && (
          <span className="text-xs font-semibold">
            채점 {live.marked}/{list.length}문항 · <b className="text-pine">정답 {live.correct}</b> · <b className="text-clay">오답 {live.wrong}</b> · <b className="text-amber">모름 {live.unknown}</b>
          </span>
        )}
        <div className="grow" />
        {(['정답', '오답', '모름'] as const).map(m => (
          <button key={m} onClick={() => setAll(m)} disabled={list.length === 0}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:bg-paper2 disabled:opacity-40">
            전체 {m}
          </button>
        ))}
        <button onClick={clearAll} disabled={list.length === 0}
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:bg-paper2 disabled:opacity-40">
          전체 취소
        </button>
      </div>

      {/* 채점판: 좌 정답 패널 + 우 ○/✕ 셀 (매쓰플랫 2열을 한 행에 통합 — 학생 1명) */}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          이 학습지의 문제를 문제은행에서 찾을 수 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex items-center gap-3 border-b border-line bg-paper2/60 px-4 py-2 text-[11px] font-bold text-ink2">
            <span className="w-11 shrink-0">번호</span>
            <span className="grow">정답</span>
            <button onClick={() => setHideAnswers(v => !v)}
              className="rounded border border-line bg-white px-2 py-0.5 font-semibold hover:bg-paper2">
              {hideAnswers ? '정답 보이기' : '정답 숨기기'}
            </button>
            <span className="w-20 shrink-0 text-center">채점</span>
          </div>
          {list.map((p, i) => {
            const m = marks[p.id]
            const open = openBody.has(p.id)
            return (
              <div key={p.id} className={`border-b border-line/50 transition-colors last:border-0 ${m ? SHEET_ROW_CLASS[m] : 'bg-white'}`}>
                <div className="flex items-center gap-3 px-4 py-1.5">
                  <b className="w-11 shrink-0 text-sm">{i + 1}번</b>
                  <div className="min-w-0 grow py-1 text-sm">
                    {hideAnswers ? <span className="tracking-widest text-ink2/40">•••</span> : <SheetAnswer p={p} />}
                    <div className="text-[10px] text-ink2/80">{typeName(p.typeId)}</div>
                  </div>
                  {p.videoUrl && (
                    <button onClick={() => setVideo({ src: p.videoUrl!, subtitle: p.subtitleUrl, title: `${i + 1}번 풀이영상` })}
                      title="풀이영상"
                      className="shrink-0 rounded-full border border-pine px-2 py-0.5 text-[11px] font-bold text-pine hover:bg-pine-soft">
                      ▶
                    </button>
                  )}
                  <button onClick={() => toggleBody(p.id)}
                    className="shrink-0 rounded border border-line bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-ink2 hover:bg-paper2">
                    {open ? '문제 접기' : '문제 보기'}
                  </button>
                  {/* ○/✕ 토글 셀 */}
                  <button onClick={() => cycle(p.id)} aria-label={`${i + 1}번 채점`}
                    className="flex h-9 w-20 shrink-0 items-center justify-center rounded-lg border border-line/70 bg-white/60 hover:border-pine">
                    <span className={`text-xl font-black leading-none ${m ? SHEET_MARK_CLASS[m] : 'text-ink2/25'}`}>
                      {m ? SHEET_ICON[m] : '○'}
                    </span>
                  </button>
                </div>
                {/* 문제 원문 + 해설 전문 (기본 접힘 — 채점 속도 우선) */}
                {open && (
                  <div className="border-t border-line/40 bg-white px-4 py-3 pl-[3.75rem]">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-black text-ink2">{i + 1}번 문제</span>
                      <div className="grow" />
                      <button onClick={() => reportProblem(i + 1, p)} title="문제 오류 신고"
                        className="rounded border border-line px-2 py-0.5 text-[11px] font-semibold text-ink2 hover:bg-paper2">
                        🔔 문제 오류 신고
                      </button>
                    </div>
                    <ProblemContent p={p} />
                    {p.solution && (
                      <div className="mt-3 border-t border-line/40 pt-2">
                        <div className="mb-1 text-xs font-black text-ink2">{i + 1}번 해설</div>
                        {/^https?:/.test(p.solution)
                          ? <img src={p.solution} alt="해설" loading="lazy" className="w-full max-w-[465px]" />
                          : <MathText text={p.solution} className="text-[13px] leading-relaxed" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 하단 고정: [오답학습지 만들기] (매쓰플랫 동일 — 오답·모름 ≥1이면 활성) */}
      <div className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-t-2xl border border-b-0 border-line bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
          <span className="text-xs text-ink2">
            {live.wrongs.length > 0
              ? <>오답·모름 <b className="text-clay">{live.wrongs.length}문제</b></>
              : '오답·모름으로 마킹된 문항이 없습니다'}
          </span>
          <div className="grow" />
          <button onClick={() => setDrillOpen(true)} disabled={live.wrongs.length === 0}
            className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
            오답학습지 만들기
          </button>
        </div>
      </div>

      {drillOpen && live.wrongs.length > 0 && (
        <DrillModal student={student} title={`[오답] ${ws.title}`} wrongs={live.wrongs} onClose={() => setDrillOpen(false)} />
      )}
      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}
