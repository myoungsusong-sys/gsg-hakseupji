import { useEffect, useMemo, useRef, useState } from 'react'
import { typeName, typeUnitName } from '../../data/curriculum'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import type { GradeResult, Grading, Student, WBItem } from '../../types'
import BookCatalogDialog from '../BookCatalogDialog'
import BulkImportModal from '../BulkImportModal'
import MathText from '../MathText'
import DrillModal, { type DrillWrong } from './DrillModal'
import StudentBookDialog from './StudentBookDialog'

// 페이지 목록을 연속 구간으로 축약: [7,8,9,12] → "7~9, 12"
function pageRange(pages: number[]): string {
  const s = [...pages].sort((a, b) => a - b)
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    out.push(i === j ? `${s[i]}` : `${s[i]}~${s[j]}`)
    i = j + 1
  }
  return out.join(', ')
}

// 정답 표시 (매쓰플랫 채점판 동일): 객관식 숫자→①~⑤, 수식(LaTeX)→KaTeX 렌더, 그 외 원문
const CIRCLED = ['①', '②', '③', '④', '⑤']
function AnswerLabel({ item }: { item: WBItem }) {
  const a = item.answer
  if (!a) return null
  if (['.', '-'].includes(a.trim())) {
    return <div className="text-[11px] text-ink2">정답 <span className="text-ink2/70">풀이참조</span></div>
  }
  if (item.kind === '객관식') {
    const t = a.split(',').map(s => {
      const n = Number(s.trim())
      return n >= 1 && n <= 5 ? CIRCLED[n - 1] : s.trim()
    }).join(',')
    return <div className="text-[11px] text-ink2">정답 {t}</div>
  }
  if (/[\\{}^_]/.test(a)) {
    return <div className="text-[11px] text-ink2">정답 <MathText text={`$${a}$`} /></div>
  }
  return <div className="text-[11px] text-ink2">정답 {a}</div>
}

// 매쓰플랫 「수업 > 교재」 채점 화면
// 클릭 순환: ○(정답) → ✕(오답) → ?(모름) → ○ · 기본 전부 정답
type Mark = '정답' | '오답' | '모름'
const NEXT: Record<Mark, Mark> = { 정답: '오답', 오답: '모름', 모름: '정답' }
const MARK_ICON: Record<Mark, string> = { 정답: '○', 오답: '✕', 모름: '?' }
const MARK_CLASS: Record<Mark, string> = { 정답: 'text-pine', 오답: 'text-clay', 모름: 'text-amber' }
// 행 배경: 정답=연파랑 · 오답=연분홍 · 모름=연노랑
const CARD_CLASS: Record<Mark, string> = {
  정답: 'border-line bg-pine-soft/40 hover:border-pine',
  오답: 'border-clay bg-red-50',
  모름: 'border-amber bg-amber-soft/50',
}

export default function GradePanel({ student }: { student: Student }) {
  const { workbooks, wbItems, gradings, upsertGrading, addWorkbook, setWBItems } = useStore()
  const [wbId, setWbId] = useState<string | null>(workbooks[0]?.id ?? null)
  const [bookDlg, setBookDlg] = useState(false)
  const [catalog, setCatalog] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [menu, setMenu] = useState(false)

  // 교재가 삭제되거나 처음 등록되면 선택 보정
  useEffect(() => {
    if (!workbooks.some(w => w.id === wbId)) setWbId(workbooks[0]?.id ?? null)
  }, [workbooks, wbId])
  const wb = workbooks.find(w => w.id === wbId) ?? null

  const items = useMemo(
    () => wbItems.filter(i => i.workbookId === wbId).sort((a, b) => a.page - b.page || a.no - b.no),
    [wbItems, wbId],
  )
  const pages = useMemo(() => {
    const m = new Map<number, number>()
    for (const i of items) m.set(i.page, (m.get(i.page) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0] - b[0])   // [쪽, 문항 수]
  }, [items])

  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(1)
  const [marks, setMarks] = useState<Record<string, Mark>>({})   // 없으면 '정답'
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageChecked, setPageChecked] = useState<Set<number>>(new Set())   // 페이지별 오답학습지용
  const [drill, setDrill] = useState<{ title: string; wrongs: DrillWrong[] } | null>(null)
  // 실시간 자동 저장 상태
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState('')

  // 교재 전환·매칭 문항 로드 시 쪽 범위를 교재 전체로 초기화
  useEffect(() => {
    if (pages.length) { setFrom(pages[0][0]); setTo(pages[pages.length - 1][0]) }
    setSelecting(false); setSelected(new Set()); setPageChecked(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbId, items.length])

  const inRange = useMemo(() => items.filter(i => i.page >= from && i.page <= to), [items, from, to])

  // ── 실시간 자동 저장 (매쓰플랫 방식) ────────────────────────
  // 문항 클릭마다 디바운스 저장. 같은 날·같은 범위 채점은 한 기록에 덮어쓰기(upsert).
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

  function queueSave(next: Record<string, Mark>) {
    if (!wb || inRange.length === 0) return
    const results: GradeResult[] = inRange.map(i => {
      const m = next[i.id] ?? '정답'
      return { itemId: i.id, correct: m === '정답', unknown: m === '모름' || undefined }
    })
    const today = todayKey()
    const exist = gradingsRef.current.find(g =>
      g.studentId === student.id && g.workbookId === wb.id &&
      g.pageFrom === from && g.pageTo === to && dateKey(g.date) === today)
    const id = exist?.id ?? gidRef.current ?? uid('gr')
    gidRef.current = id
    pendingRef.current = {
      id, studentId: student.id, source: '교재', workbookId: wb.id,
      date: new Date().toISOString(), pageFrom: from, pageTo: to, results,
    }
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flushRef.current(), 900)
  }

  // 범위·교재·학생이 바뀌면: 대기분 즉시 저장 → 그 범위의 오늘 채점 기록을 불러와 이어서 채점
  useEffect(() => {
    flushRef.current()
    gidRef.current = null
    const today = todayKey()
    const exist = gradingsRef.current.find(g =>
      g.studentId === student.id && g.workbookId === wbId &&
      g.pageFrom === from && g.pageTo === to && dateKey(g.date) === today)
    const seeded: Record<string, Mark> = {}
    if (exist) {
      for (const r of exist.results) {
        if (!r.itemId) continue
        if (r.unknown) seeded[r.itemId] = '모름'
        else if (!r.correct) seeded[r.itemId] = '오답'
      }
    }
    setMarks(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbId, from, to, student.id])

  // 탭 이동·언마운트 시 대기분 저장
  useEffect(() => () => flushRef.current(), [])

  // 이 학생이 이 교재에서 이미 채점한 문항 id (좌측 진도 뱃지용)
  const gradedIds = useMemo(() => {
    const s = new Set<string>()
    for (const g of gradings) {
      if (g.studentId !== student.id || g.workbookId !== wbId) continue
      for (const r of g.results) if (r.itemId) s.add(r.itemId)
    }
    return s
  }, [gradings, student.id, wbId])

  // 좌측 페이지 목록 + 유형(대단원) 구간 헤더 (각 페이지 첫 문항의 단원이 바뀌는 지점)
  const pageRows = useMemo(() => {
    let prev = ''
    return pages.map(([p, n]) => {
      const first = items.find(i => i.page === p)
      const unit = first ? typeUnitName(first.typeId) : ''
      const header = unit && unit !== prev ? unit : null
      if (unit) prev = unit
      return { p, n, header }
    })
  }, [pages, items])

  // 채점판 하단 이전/다음 페이지 이동
  const prevPage = useMemo(() => {
    const before = pages.filter(([p]) => p < from)
    return before.length ? before[before.length - 1][0] : null
  }, [pages, from])
  const nextPage = useMemo(() => {
    const after = pages.find(([p]) => p > to)
    return after ? after[0] : null
  }, [pages, to])

  function markOf(id: string): Mark { return marks[id] ?? '정답' }
  function cycle(id: string) {
    const next = { ...marks, [id]: NEXT[marks[id] ?? '정답'] }
    setMarks(next); queueSave(next)
  }
  function setAll(m: Mark) {
    const next = { ...marks }
    for (const i of inRange) next[i.id] = m
    setMarks(next); queueSave(next)
  }
  function clearAll() {   // 전체 취소 — 범위 전체를 ○(기본)으로 초기화
    const next = { ...marks }
    for (const i of inRange) delete next[i.id]
    setMarks(next); queueSave(next)
  }
  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function togglePage(p: number) {
    setPageChecked(prev => {
      const n = new Set(prev)
      if (n.has(p)) n.delete(p); else n.add(p)
      return n
    })
  }

  // 현재 범위 실시간 요약 (자동 저장이므로 항상 최신)
  const live = useMemo(() => {
    const total = inRange.length
    let correct = 0, unknown = 0
    const wrongs: DrillWrong[] = []
    for (const i of inRange) {
      const m = marks[i.id] ?? '정답'
      if (m === '정답') correct++
      else {
        if (m === '모름') unknown++
        wrongs.push({ typeId: i.typeId, diff: i.diff })
      }
    }
    return { total, correct, unknown, wrongs }
  }, [inRange, marks])

  function finishSelect() {
    if (!wb || selected.size === 0) return
    const wrongs: DrillWrong[] = inRange
      .filter(i => selected.has(i.id))
      .map(i => ({ typeId: i.typeId, diff: i.diff }))
    setDrill({ title: `[오답] ${wb.name} 선택 ${wrongs.length}문항`, wrongs })
    setSelecting(false)
    setSelected(new Set())
  }

  // 페이지별 오답학습지 — 체크한 페이지(없으면 현재 쪽 범위)의 오답·모름 문항으로 생성
  // 저장 기록 + 지금 화면에서 찍은 ✕/? 를 합쳐서 본다 (체크·저장 없이도 바로 동작)
  function pageDrill() {
    if (!wb || items.length === 0) return
    const targetPages = pageChecked.size > 0
      ? pageChecked
      : new Set(inRange.map(i => i.page))
    if (targetPages.size === 0) { alert('좌측 페이지 목록에서 페이지를 선택하거나 쪽 범위를 지정하세요.'); return }
    // gradings는 최신순 → 문항별 가장 최근 채점 결과
    const latest = new Map<string, GradeResult>()
    for (const g of gradings) {
      if (g.studentId !== student.id || g.workbookId !== wbId) continue
      for (const r of g.results) if (r.itemId && !latest.has(r.itemId)) latest.set(r.itemId, r)
    }
    // 지금 화면에서 찍은 표시가 최우선 (자동 저장 디바운스 중이어도 반영)
    for (const i of inRange) {
      const m = marks[i.id]
      if (m) latest.set(i.id, { itemId: i.id, correct: m === '정답', unknown: m === '모름' || undefined })
    }
    const wrongs: DrillWrong[] = []
    for (const i of items) {
      if (!targetPages.has(i.page)) continue
      const r = latest.get(i.id)
      if (r && (!r.correct || r.unknown)) wrongs.push({ typeId: i.typeId, diff: i.diff })
    }
    if (wrongs.length === 0) {
      alert('선택한 페이지에 오답·모름이 없습니다.\n문항 카드를 클릭해 ✕(오답)/?(모름)를 표시한 뒤 다시 누르세요.')
      return
    }
    const ps = pageRange([...targetPages])
    setDrill({ title: `[오답] ${wb.name} p${ps}`, wrongs })
  }

  // ⋮ 메뉴 > 재출제 — 채점 초기화 없이 첫 페이지부터 다시 진행
  function reissue() {
    setMenu(false)
    if (!confirm('이 교재를 재출제(채점 초기화 없이 다시 진행)하시겠습니까?')) return
    if (pages.length) { setFrom(pages[0][0]); setTo(pages[0][0]) }
  }

  const existingKeys = useMemo(
    () => new Set(workbooks.map(w => w.matchKey).filter((k): k is string => !!k)),
    [workbooks],
  )

  // ── 등록된 교재가 없을 때 ──
  if (workbooks.length === 0 || !wb) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center">
        <p className="mb-4 text-sm text-ink2">아직 등록된 교재가 없습니다. 시중교재를 등록하면 문항·유형이 자동으로 붙어 바로 채점할 수 있습니다.</p>
        <button onClick={() => setCatalog(true)}
          className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper">＋ 교재 등록</button>
        {catalog && (
          <BookCatalogDialog defaultGrade={student.grade} existingKeys={existingKeys}
            onClose={() => setCatalog(false)}
            onAdd={books => {
              let last: string | null = null
              for (const b of books) last = addWorkbook(b)
              if (last) setWbId(last)
              setCatalog(false)
            }} />
        )}
      </div>
    )
  }

  return (
    <div>
      {/* 상단 툴바 */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <button onClick={() => setBookDlg(true)}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-bold hover:border-pine">
          <span className="max-w-56 truncate">{wb.name}</span>
          <span className="text-xs text-ink2">▾</span>
        </button>
        <div className="relative">
          <button onClick={() => setMenu(v => !v)}
            className="rounded-lg border border-line px-2.5 py-2 font-bold text-ink2 hover:border-pine hover:text-ink">⋮</button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-line bg-white py-1 shadow-lg">
                <button onClick={reissue} className="w-full px-3 py-2 text-left text-sm hover:bg-paper2">재출제</button>
              </div>
            </>
          )}
        </div>
        <label className="flex items-center gap-1">쪽
          <input type="number" value={from} onChange={e => setFrom(Number(e.target.value) || 1)}
            className="w-16 rounded border border-line px-2 py-1.5" />
          ~
          <input type="number" value={to} onChange={e => setTo(Number(e.target.value) || 1)}
            className="w-16 rounded border border-line px-2 py-1.5" />
        </label>
        <span className="text-ink2">범위 {inRange.length}문항</span>
        <div className="grow" />
        <button onClick={() => { setSelecting(true); setSelected(new Set()) }} disabled={selecting || inRange.length === 0}
          className="rounded-lg px-3 py-2 text-xs font-bold text-pine hover:bg-pine-soft disabled:opacity-40">
          ＋ 문제별 오답학습지
        </button>
        <button onClick={pageDrill} disabled={selecting || items.length === 0}
          title="좌측에서 페이지를 체크하면 그 페이지들, 체크가 없으면 현재 쪽 범위의 오답·모름으로 만듭니다"
          className="rounded-lg bg-pine px-3 py-2 text-xs font-bold text-paper hover:brightness-105 disabled:opacity-40">
          ＋ 페이지별 오답학습지{pageChecked.size > 0 ? ` (${pageChecked.size})` : ''}
        </button>
        {live.wrongs.length > 0 && !selecting && (
          <button onClick={() => setDrill({ title: `[오답] ${wb.name} ${from}~${to}p`, wrongs: live.wrongs })}
            className="rounded-lg bg-amber px-4 py-2 text-xs font-bold text-white hover:brightness-105">
            오답·모름 {live.wrongs.length}문제로 오답 학습지
          </button>
        )}
      </div>

      {/* 안내 문구(실시간 자동 저장) + 현재 요약 + 일괄 채점 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-xs text-ink2">
          채점 기록은 실시간으로 자동 저장됩니다.
          {saveState === 'saving' && <span className="ml-2 text-amber">저장 중…</span>}
          {saveState === 'saved' && <span className="ml-2 text-pine">✓ 저장됨 {savedAt}</span>}
        </span>
        {inRange.length > 0 && (
          <span className="text-xs font-semibold">
            {live.total}문항 중 <b className="text-pine">{live.correct}개 정답</b> ({Math.round(live.correct / live.total * 100)}점) · 모름 {live.unknown}개
          </span>
        )}
        <div className="grow" />
        <button onClick={clearAll} disabled={selecting}
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:bg-paper2 disabled:opacity-40">
          전체 취소
        </button>
        {(['정답', '오답', '모름'] as const).map(m => (
          <button key={m} onClick={() => setAll(m)} disabled={selecting}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:bg-paper2 disabled:opacity-40">
            전체 {m}
          </button>
        ))}
      </div>

      {/* 선택 모드 헤더 */}
      {selecting && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber bg-amber-soft/40 px-4 py-3 text-sm">
          <b>문제를 선택해주세요</b>
          <span className="text-xs text-ink2">선택한 문제로 오답 학습지를 만듭니다 · {selected.size}문항 선택됨</span>
          <div className="grow" />
          <button onClick={() => { setSelecting(false); setSelected(new Set()) }}
            className="rounded-lg border border-line bg-white px-4 py-1.5 text-xs font-semibold">취소</button>
          <button onClick={finishSelect} disabled={selected.size === 0}
            className="rounded-lg bg-amber px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">문제 선택 완료</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* 좌측: 교재 페이지 목록 + 진도 (체크박스 = 페이지별 오답학습지 대상) */}
        <aside className="h-fit max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-white p-2">
          <div className="mb-1 flex items-center gap-2 px-2.5 pt-1 text-[11px] font-bold text-ink2">
            <span>선택</span><span className="grow">페이지</span><span>진도 확인</span>
          </div>
          {pageRows.map(({ p, n, header }) => {
            const done = items.filter(i => i.page === p && gradedIds.has(i.id)).length
            const status = done >= n ? '완료됨' : done > 0 ? '진행중' : '미시작'
            const badge = status === '완료됨' ? 'bg-pine-soft text-pine-dark'
              : status === '진행중' ? 'bg-amber-soft text-amber' : 'bg-paper2 text-ink2'
            const on = from === p && to === p
            return (
              <div key={p}>
                {header && (
                  <div className="mb-0.5 mt-1 rounded bg-paper2 px-2 py-1 text-[10px] font-bold text-ink2">{header}</div>
                )}
                <div className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 ${on ? 'bg-pine-soft font-bold text-pine-dark' : 'hover:bg-paper2'}`}>
                  <input type="checkbox" checked={pageChecked.has(p)} onChange={() => togglePage(p)}
                    className="accent-[var(--color-pine,#2e6b4f)]" />
                  <button onClick={() => { setFrom(p); setTo(p) }}
                    className="flex grow items-center gap-2 text-left text-sm">
                    <span className="grow">{p}쪽 <span className="text-xs text-ink2">({n}문항)</span></span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{status}</span>
                  </button>
                </div>
              </div>
            )
          })}
          {pages.length === 0 && <p className="p-3 text-xs text-ink2">문항이 없습니다.</p>}
        </aside>

        {/* 문항 카드 그리드 */}
        <div>
          {items.length === 0 ? (
            wb.matchKey ? (
              <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
                매칭 데이터 불러오는 중…
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm">
                <p className="mb-1 font-bold">아직 정답표가 없는 교재입니다.</p>
                <p className="mb-4 text-ink2">빠른정답 사진을 Claude에게 주면 텍스트로 만들어 줍니다. 그대로 붙여넣어 등록하세요.</p>
                <button onClick={() => setBulk(true)}
                  className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper">📋 정답표 일괄 등록</button>
              </div>
            )
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {inRange.map(i => {
                  const m = markOf(i.id)
                  const sel = selected.has(i.id)
                  const cardCls = selecting
                    ? (m !== '정답' ? 'border-clay bg-red-50' : sel ? 'border-pine bg-pine-soft/40' : 'border-line bg-white hover:border-pine')
                    : CARD_CLASS[m]
                  return (
                    <button key={i.id} onClick={() => selecting ? toggleSelect(i.id) : cycle(i.id)}
                      className={`rounded-xl border p-3 text-left transition ${cardCls}`}>
                      <div className="flex items-center justify-between gap-1">
                        <b className="text-sm">p.{i.page} {i.label ?? i.no}번</b>
                        {selecting
                          ? <input type="checkbox" checked={sel} readOnly className="pointer-events-none accent-[var(--color-pine,#2e6b4f)]" />
                          : <span className={`text-lg font-black ${MARK_CLASS[m]}`}>{MARK_ICON[m]}</span>}
                      </div>
                      <div className="mt-1 text-[11px] text-ink2">{typeName(i.typeId)}</div>
                      <AnswerLabel item={i} />
                    </button>
                  )
                })}
              </div>
              {inRange.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
                  이 범위에 등록된 문항이 없습니다. 좌측 페이지 목록에서 쪽을 선택하세요.
                </div>
              )}
              {/* 채점판 하단: 이전/다음 페이지 이동 */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { if (prevPage != null) { setFrom(prevPage); setTo(prevPage) } }} disabled={prevPage == null}
                  className="rounded-xl border border-line bg-white py-3 text-sm font-bold hover:border-pine disabled:opacity-40">
                  ← 이전 페이지
                </button>
                <button onClick={() => { if (nextPage != null) { setFrom(nextPage); setTo(nextPage) } }} disabled={nextPage == null}
                  className="rounded-xl border border-line bg-white py-3 text-sm font-bold hover:border-pine disabled:opacity-40">
                  다음 페이지 →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 다이얼로그들 */}
      {bookDlg && (
        <StudentBookDialog student={student} currentId={wbId}
          onSelect={id => setWbId(id)} onClose={() => setBookDlg(false)} />
      )}
      {catalog && (
        <BookCatalogDialog defaultGrade={student.grade} existingKeys={existingKeys}
          onClose={() => setCatalog(false)}
          onAdd={books => {
            let last: string | null = null
            for (const b of books) last = addWorkbook(b)
            if (last) setWbId(last)
            setCatalog(false)
          }} />
      )}
      {bulk && (
        <BulkImportModal workbook={wb} existing={items}
          onSave={next => { setWBItems(wb.id, next); setBulk(false) }}
          onClose={() => setBulk(false)} />
      )}
      {drill && (
        <DrillModal student={student} title={drill.title} wrongs={drill.wrongs}
          onClose={() => setDrill(null)} />
      )}
    </div>
  )
}
