import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { typeUnitName, subjectOfCourse } from '../../data/curriculum'
import { useSubject } from '../../lib/subject'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { wbAnswerImg } from '../../lib/answers'
import { splitSubItems, subKey } from '../../lib/subitems'
import type { GradeResult, Grading, Student, WBItem } from '../../types'
import BookCatalogDialog from '../BookCatalogDialog'
import BulkImportModal from '../BulkImportModal'
import MathText from '../MathText'
import DrillModal, { type DrillWrong, type PagePicker } from './DrillModal'
import StudentBookDialog from './StudentBookDialog'

// 정답 표시 (매쓰플랫 채점판 동일): 객관식 숫자→①~⑤, 수식(LaTeX)→KaTeX 렌더, 그 외 원문
const CIRCLED = ['①', '②', '③', '④', '⑤']
// 정답은 크고 진하게(선생님이 한눈에 보이게) — "정답" 라벨만 작게, 값은 굵고 크게
function AnswerLabel({ item }: { item: WBItem }) {
  const a = item.answer
  if (!a) return null
  const wrap = (v: ReactNode, faded = false) => (
    <div className="mt-0.5 text-xs text-ink2">정답 <span className={faded ? 'text-ink2/70' : 'text-[15px] font-extrabold text-ink'}>{v}</span></div>
  )
  // 서술형: 정답이 이미지(매쓰플랫 answerImageUrl, 표·그래프·다단계 풀이)로 제공되는 문항.
  // 정답 이미지는 표/그래프라 텍스트 크기로 줄이면 안 보임 → 문항 간 통일된 읽히는 높이(64px)로.
  const img = wbAnswerImg(a)
  if (img) return (
    <div className="mt-0.5 text-xs text-ink2">정답
      <img src={img} alt="정답"
        className="mt-0.5 block max-h-16 w-auto max-w-full rounded bg-white" />
    </div>
  )
  if (['.', '-'].includes(a.trim())) return wrap('풀이참조', true)
  if (item.kind === '객관식') {
    const t = a.split(',').map(s => {
      const n = Number(s.trim())
      return n >= 1 && n <= 5 ? CIRCLED[n - 1] : s.trim()
    }).join(',')
    return wrap(t)
  }
  if (/[\\{}^_]/.test(a)) return wrap(<MathText text={`$${safeLatex(a)}$`} />)
  return wrap(a)
}

// LaTeX 정답이 KaTeX 에러(원문 노출·빨간 에러박스) 없이 렌더되도록 보정:
// ① 끝의 백슬래시 제거(잘린 명령), ② 짝 안 맞는 중괄호 정리(여분 } 삭제·열린 { 닫기).
// 매쓰플랫 answer 필드의 마크업 잔재(예: '\frac{6}{8}}', '[(예)}', '[7/8}')로 인한 에러 방지.
function safeLatex(s: string): string {
  let raw = s
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '')               // 제어문자 제거(form-feed 등 매쓰플랫 데이터 잔재)
    .replace(/^!+/, '')                         // answerMathflat 마커('!!') 제거
    .replace(/\$/g, '')                         // 임베디드 $ 제거(AnswerLabel이 $로 감쌈)
    .replace(/\{\^/g, '{')                       // 그룹이 ^로 시작(무효, 매쓰플랫 '{^x^2}'류) → 선행 ^ 제거
    .replace(/\\(begin|end)(pmatrix|bmatrix|matrix|cases|array)/g, '\\$1{$2}')  // 중괄호 빠진 환경명 복원
    .replace(/\\+\s*$/, '')                     // 끝의 백슬래시 제거(잘린 명령)
  let depth = 0, out = ''
  for (const ch of raw) {
    if (ch === '{') { depth++; out += ch }
    else if (ch === '}') { if (depth > 0) { depth--; out += ch } /* 짝 없는 } 는 버림 */ }
    else out += ch
  }
  if (depth > 0) out += '}'.repeat(depth)    // 닫히지 않은 { 닫기
  return out
}

// 매쓰플랫 「수업 > 교재」 채점 화면
// 클릭 순환(4상태): 미채점 → ✕(오답) → ?(모름) → ○(정답) → 미채점 → ✕ … (명수쌤 지시 2026-07-17)
//   정답 다음 한 번 더 누르면 아무것도 안 매긴 처음 상태로 돌아온다(개별 취소).
//   ※ 그래서 '전체 정답' 후 틀린 것을 오답으로 만들려면 두 번 눌러야 한다(정답→미채점→오답).
// ⚠️ 저장은 "마킹된 문항만" 기록한다 — 미채점 문항을 정답으로 간주해 통째로 저장하면
//    진도·통계가 오염된다(2026-07-08 실사 P0). 미채점 = 기록 없음.
type Mark = '정답' | '오답' | '모름'
// 다음 상태 — 정답에서 undefined(미채점)로 한 바퀴 돈다
const NEXT: Record<Mark, Mark | undefined> = { 오답: '모름', 모름: '정답', 정답: undefined }
function nextMark(cur: Mark | undefined): Mark | undefined { return cur ? NEXT[cur] : '오답' }
const MARK_ICON: Record<Mark, string> = { 정답: '○', 오답: '✕', 모름: '?' }
const MARK_CLASS: Record<Mark, string> = { 정답: 'text-pine', 오답: 'text-clay', 모름: 'text-amber' }
// 행 배경: 정답=연파랑 · 오답=연분홍 · 모름=연노랑 · 미채점=흰색 (매쓰플랫 동일)
const CARD_CLASS: Record<Mark, string> = {
  정답: 'border-line bg-pine-soft/40 hover:border-pine',
  오답: 'border-clay bg-red-50',
  모름: 'border-amber bg-amber-soft/50',
}
const CARD_UNMARKED = 'border-line bg-white hover:border-pine'

// ── 채점 화면 "마지막 상태" 기억 ────────────────────────────────
// 학생을 바꾸면 GradePanel이 리마운트(key=student.id)되어 로컬 state가 사라진다.
// 다른 학생 갔다 돌아와도 마지막으로 보던 교재·쪽 범위가 그대로 복원되도록
// 학생별·교재별로 저장한다(세션 넘어 새로고침에도 유지되게 localStorage).
const LV_KEY = 'gsg-grade-lastview-v1'
type LVEntry = { wb?: string | null; pages?: Record<string, [number, number]>; scroll?: Record<string, number> }
let LV_CACHE: Record<string, LVEntry> | null = null
function lvAll(): Record<string, LVEntry> {
  if (!LV_CACHE) { try { LV_CACHE = JSON.parse(localStorage.getItem(LV_KEY) || '{}') } catch { LV_CACHE = {} } }
  return LV_CACHE!
}
function lvSaveAll() { try { localStorage.setItem(LV_KEY, JSON.stringify(lvAll())) } catch { /* 저장 실패 무시 */ } }
function lvGet(sid: string): LVEntry { return lvAll()[sid] ?? {} }
function lvSetWb(sid: string, wb: string | null) { const a = lvAll(); a[sid] = { ...a[sid], wb }; lvSaveAll() }
function lvSetPages(sid: string, wb: string, from: number, to: number) {
  const a = lvAll(); const e = a[sid] ?? {}
  a[sid] = { ...e, pages: { ...(e.pages ?? {}), [wb]: [from, to] } }; lvSaveAll()
}
function lvSetScroll(sid: string, wb: string, top: number) {
  const a = lvAll(); const e = a[sid] ?? {}
  a[sid] = { ...e, scroll: { ...(e.scroll ?? {}), [wb]: top } }; lvSaveAll()
}

export default function GradePanel({ student }: { student: Student }) {
  const { workbooks, wbItems, gradings, upsertGrading, addWorkbook, setWBItems } = useStore()
  const [subject] = useSubject()
  // 이 학생에게 배정된 교재만 (매쓰플랫: 학생 교재 = 배정분) — 현재 과목 모드에 맞는 교재만
  // (과목 = 명시 subject > course로 유도 > 없으면 수학. 과학 창에서 수학 교재가 뜨지 않도록)
  const myBooks = useMemo(
    () => workbooks.filter(w => w.studentId === student.id
      && (w.subject ?? subjectOfCourse(w.course) ?? '수학') === subject),
    [workbooks, student.id, subject],
  )
  const [wbId, setWbId] = useState<string | null>(() => {
    const saved = lvGet(student.id).wb        // 마지막으로 보던 교재 복원 (아직 배정돼 있을 때만)
    return saved && myBooks.some(b => b.id === saved) ? saved : (myBooks[0]?.id ?? null)
  })
  const [bookDlg, setBookDlg] = useState(false)
  const [catalog, setCatalog] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [menu, setMenu] = useState(false)
  // 좌측 페이지 목록 스크롤 위치 복원용 (다른 학생 갔다 와도 스크롤 유지)
  const asideRef = useRef<HTMLElement>(null)
  const scrollRef = useRef(0)

  // 학생 전환·교재 추가/삭제 시 선택 보정 (다른 학생 교재가 선택돼 있지 않도록)
  useEffect(() => {
    if (!myBooks.some(w => w.id === wbId)) setWbId(myBooks[0]?.id ?? null)
  }, [myBooks, wbId])
  // 선택 교재를 학생별로 기억 (다른 학생 갔다 와도 마지막 교재 유지)
  useEffect(() => { lvSetWb(student.id, wbId) }, [wbId, student.id])
  const wb = myBooks.find(w => w.id === wbId) ?? null

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
  const [marks, setMarks] = useState<Record<string, Mark>>({})   // 없으면 미채점(기록 안 함)
  // 연타 유실 방지: 같은 틱에 여러 카드를 클릭해도 항상 최신 marks 위에서 갱신되도록 ref 동기 유지
  const marksRef = useRef(marks)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageChecked, setPageChecked] = useState<Set<number>>(new Set())   // 페이지별 오답학습지용
  const [drill, setDrill] = useState<{ title: string; wrongs: DrillWrong[]; pagePicker?: PagePicker } | null>(null)
  // 실시간 자동 저장 상태
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState('')

  // 교재 전환·매칭 문항 로드 시: 마지막으로 보던 쪽 범위를 복원(없거나 무효면 교재 전체)
  useEffect(() => {
    if (pages.length) {
      const saved = wbId ? lvGet(student.id).pages?.[wbId] : undefined
      const ok = saved && pages.some(([p]) => p === saved[0]) && pages.some(([p]) => p === saved[1]) && saved[0] <= saved[1]
      if (ok) { setFrom(saved![0]); setTo(saved![1]) }
      else { setFrom(pages[0][0]); setTo(pages[pages.length - 1][0]) }
    }
    setSelecting(false); setSelected(new Set()); setPageChecked(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbId, items.length])

  // 쪽 범위가 바뀔 때마다 학생·교재별로 기억 (유효 페이지일 때만)
  useEffect(() => {
    if (wbId && pages.some(([p]) => p === from)) lvSetPages(student.id, wbId, from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, wbId])

  // 좌측 페이지 목록: 저장된 스크롤 위치 복원 (레이아웃 확정 후 적용 — 마운트 직후엔 아직 스크롤 불가라 rAF로 한 번 더)
  useEffect(() => {
    if (!wbId) return
    const saved = lvGet(student.id).scroll?.[wbId]
    if (saved == null) return
    const apply = () => { if (asideRef.current) asideRef.current.scrollTop = saved }
    apply()
    const r = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbId, pages.length])
  // 스크롤 위치 저장 — 스크롤할 때마다 즉시 기록(rAF로 프레임당 1회로 스로틀). 언마운트 타이밍에 의존하지 않아 견고함.
  const scrollSaveRef = useRef<number | null>(null)
  function onAsideScroll(top: number) {
    scrollRef.current = top
    if (scrollSaveRef.current != null || !wbId) return
    scrollSaveRef.current = requestAnimationFrame(() => {
      scrollSaveRef.current = null
      if (wbId) lvSetScroll(student.id, wbId, scrollRef.current)
    })
  }

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
    // ★ 마킹된 문항만 기록 — 미채점 문항은 결과에 넣지 않는다 (진도·통계 오염 방지)
    const results: GradeResult[] = inRange
      .filter(i => next[i.id] != null)
      .map(i => {
        const m = next[i.id]!
        return { itemId: i.id, correct: m === '정답', unknown: m === '모름' || undefined }
      })
    const today = todayKey()
    const exist = gradingsRef.current.find(g =>
      g.studentId === student.id && g.workbookId === wb.id &&
      g.pageFrom === from && g.pageTo === to && dateKey(g.date) === today)
    // 아무것도 마킹돼 있지 않고 기존 기록도 없으면 빈 기록을 만들지 않는다
    if (results.length === 0 && !exist && !gidRef.current) return
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

  // 범위·교재·학생이 바뀌면: 대기분 즉시 저장 → 채점 기록을 불러와 이어서 채점.
  // ★ 정확한 쪽 범위 일치에 의존하지 않는다 — 이 학생·이 교재의 '모든' 채점 기록을
  //    오래된→최신 순으로 병합(최신이 덮어씀)해 복원한다. 그래서 채점 후 다른 페이지를
  //    보다가 학생을 갔다 와도(=복원 범위가 채점 범위와 달라도) 정답·오답 표시가 유지된다.
  useEffect(() => {
    const pend = pendingRef.current   // 아직 store에 반영 안 된 대기 저장분(같은 학생 범위 전환 시)
    flushRef.current()
    gidRef.current = null
    const relevant = gradingsRef.current
      .filter(g => g.studentId === student.id && g.workbookId === wbId)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
    if (pend && pend.workbookId === wbId) relevant.push(pend)   // 방금 마킹분을 최신으로 취급
    const seeded: Record<string, Mark> = {}
    for (const g of relevant) {
      for (const r of g.results) {
        if (!r.itemId) continue
        seeded[r.itemId] = r.unknown ? '모름' : r.correct ? '정답' : '오답'
      }
    }
    marksRef.current = seeded
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

  function markOf(id: string): Mark | undefined { return marks[id] }
  // marks 갱신은 반드시 이 함수를 통해서 — ref를 동기 갱신해 같은 틱 연타에도 유실 없음
  function applyMarks(mutate: (prev: Record<string, Mark>) => Record<string, Mark>) {
    const next = mutate(marksRef.current)
    marksRef.current = next
    setMarks(next)
    queueSave(next)
  }
  function cycle(id: string) {
    applyMarks(prev => {
      const next = { ...prev }
      const nx = nextMark(prev[id])                   // 미채점→✕→?→○→미채점 순환
      if (nx) next[id] = nx
      else delete next[id]                            // 정답 다음 = 미채점(기록에서도 빠진다)
      return next
    })
  }

  // 소문항 채점 — 소문항 하나를 돌리고, 그 결과로 문항 전체 마크를 자동 집계한다.
  //  · 하나라도 오답이면 문항은 오답 / 오답 없고 모름이 있으면 모름 / 전부 정답이어야 정답
  //  · 아직 안 매긴 소문항이 남아 있으면 문항은 미채점으로 둔다(통계 오염 방지, 기존 규칙과 동일)
  function cycleSub(itemId: string, subNo: string, allSubNos: string[]) {
    applyMarks(prev => {
      const next = { ...prev }
      const k = subKey(itemId, subNo)
      const nx = nextMark(prev[k])                    // 소문항도 미채점→✕→?→○→미채점
      if (nx) next[k] = nx
      else delete next[k]
      const subMarks = allSubNos.map(n => next[subKey(itemId, n)])
      if (subMarks.some(s => !s)) delete next[itemId]                    // 미완 → 문항은 미채점
      else if (subMarks.some(s => s === '오답')) next[itemId] = '오답'
      else if (subMarks.some(s => s === '모름')) next[itemId] = '모름'
      else next[itemId] = '정답'
      return next
    })
  }
  function setAll(m: Mark) {
    applyMarks(prev => {
      const next = { ...prev }
      for (const i of inRange) {
        next[i.id] = m
        // 소문항이 있으면 같이 맞춰 준다 — 문항만 바꾸면 카드 안 소문항이 미채점으로 남아 어긋난다
        for (const s of splitSubItems(i.answer) ?? []) next[subKey(i.id, s.no)] = m
      }
      return next
    })
  }
  function clearAll() {   // 전체 취소 — 범위 전체를 미채점으로 (기록에서도 제거)
    applyMarks(prev => {
      const next = { ...prev }
      for (const i of inRange) {
        delete next[i.id]
        for (const s of splitSubItems(i.answer) ?? []) delete next[subKey(i.id, s.no)]
      }
      return next
    })
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

  // 현재 범위 실시간 요약 — 마킹된 문항 기준 (미채점은 집계에서 제외)
  const live = useMemo(() => {
    let marked = 0, correct = 0, wrong = 0, unknown = 0
    const wrongs: DrillWrong[] = []
    for (const i of inRange) {
      const m = marks[i.id]
      if (!m) continue
      marked++
      if (m === '정답') correct++
      else {
        if (m === '모름') unknown++
        else wrong++
        wrongs.push({ typeId: i.typeId, diff: i.diff, page: i.page })
      }
    }
    return { marked, correct, wrong, unknown, wrongs }
  }, [inRange, marks])

  function finishSelect() {
    if (!wb || selected.size === 0) return
    const wrongs: DrillWrong[] = inRange
      .filter(i => selected.has(i.id))
      .map(i => ({ typeId: i.typeId, diff: i.diff, page: i.page }))
    setDrill({ title: `[오답] ${wb.name}`, wrongs })
    setSelecting(false)
    setSelected(new Set())
  }

  // 페이지별 오답학습지 — 체크한 페이지(없으면 현재 쪽 범위)의 오답·모름 문항으로 생성
  // 저장 기록 + 지금 화면에서 찍은 ✕/? 를 합쳐서 본다 (체크·저장 없이도 바로 동작)
  // 페이지별 오답학습지 — 다이얼로그 안에서 페이지 범위·틀린 문제만 여부를 고른다 (매쓰플랫 동일)
  function pageDrill() {
    if (!wb || items.length === 0) return
    const allPages = pages.map(([p]) => p)
    const initialPages = pageChecked.size > 0
      ? [...pageChecked].sort((a, b) => a - b)
      : [...new Set(inRange.map(i => i.page))].sort((a, b) => a - b)
    // 선택 페이지·틀린문제 여부로 오답 계산 (저장 기록 + 화면 표시 병합)
    const wrongsForPages = (sel: number[], onlyWrong: boolean): DrillWrong[] => {
      const latest = new Map<string, GradeResult>()
      for (const g of gradings) {
        if (g.studentId !== student.id || g.workbookId !== wbId) continue
        for (const r of g.results) if (r.itemId && !latest.has(r.itemId)) latest.set(r.itemId, r)
      }
      for (const i of inRange) {
        const m = marks[i.id]
        if (m) latest.set(i.id, { itemId: i.id, correct: m === '정답', unknown: m === '모름' || undefined })
      }
      const selSet = new Set(sel)
      const out: DrillWrong[] = []
      for (const i of items) {
        if (!selSet.has(i.page)) continue
        if (onlyWrong) { const r = latest.get(i.id); if (r && (!r.correct || r.unknown)) out.push({ typeId: i.typeId, diff: i.diff, page: i.page }) }
        else out.push({ typeId: i.typeId, diff: i.diff, page: i.page })
      }
      return out
    }
    setDrill({ title: `[오답] ${wb.name}`, wrongs: [], pagePicker: { allPages, initialPages, wrongsForPages } })
  }

  // ⋮ 메뉴 > 재출제 — 채점 초기화 없이 첫 페이지부터 다시 진행
  function reissue() {
    setMenu(false)
    if (!confirm('이 교재를 재출제(채점 초기화 없이 다시 진행)하시겠습니까?')) return
    if (pages.length) { setFrom(pages[0][0]); setTo(pages[0][0]) }
  }

  // 이 학생에게 이미 배정된 교재의 matchKey (중복 등록 방지)
  const existingKeys = useMemo(
    () => new Set(myBooks.map(w => w.matchKey).filter((k): k is string => !!k)),
    [myBooks],
  )

  // ── 이 학생에게 배정된 교재가 없을 때 ──
  if (myBooks.length === 0 || !wb) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center">
        <p className="mb-4 text-sm text-ink2"><b>{student.name}</b> 학생에게 배정된 {subject === '과학' ? '과학' : ''} 교재가 없습니다. {subject === '과학' ? '오투 중등과학 교재를 등록하면 쪽·문항·유형이 자동으로 붙어 바로 채점할 수 있습니다.' : '시중교재를 등록하면 문항·유형이 자동으로 붙어 바로 채점할 수 있습니다.'}</p>
        <button onClick={() => setCatalog(true)}
          className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper">＋ 교재 등록</button>
        {catalog && (
          <BookCatalogDialog defaultGrade={student.grade} existingKeys={existingKeys} subject={subject}
            onClose={() => setCatalog(false)}
            onAdd={books => {
              let last: string | null = null
              for (const b of books) last = addWorkbook({ ...b, studentId: student.id })
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
        <button
          onClick={() => {
            const body = `교재: ${wb.name}%0A쪽 범위: ${from}~${to}p%0A오류 문항·내용: `
            location.href = `mailto:songmyoungsu79@gmail.com?subject=${encodeURIComponent(`[문제 오류 신고] ${wb.name} ${from}~${to}p`)}&body=${body}`
          }}
          title="정답표·유형 매칭 오류를 신고합니다"
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:bg-paper2">
          🔔 문제 오류 신고
        </button>
        <button onClick={() => { setSelecting(true); setSelected(new Set()) }} disabled={selecting || inRange.length === 0}
          className="rounded-lg px-3 py-2 text-xs font-bold text-pine hover:bg-pine-soft disabled:opacity-40">
          ＋ 문제별 오답학습지
        </button>
        <button onClick={pageDrill} disabled={selecting || items.length === 0}
          title="좌측에서 페이지를 체크하면 그 페이지들, 체크가 없으면 현재 쪽 범위의 오답·모름으로 만듭니다"
          className="rounded-lg bg-pine px-3 py-2 text-xs font-bold text-paper hover:brightness-105 disabled:opacity-40">
          ＋ 페이지별 오답학습지{pageChecked.size > 0 ? ` (${pageChecked.size})` : ''}
        </button>
        {/* 흔들림 방지: 오답이 생겨 이 버튼이 나타났다 사라질 때 툴바가 줄바꿈되며 그리드가 튀지 않도록,
            항상 자리를 차지하고 오답이 없을 땐 보이지 않게만 처리(invisible=공간 유지) */}
        <button onClick={() => setDrill({ title: `[오답] ${wb.name}`, wrongs: live.wrongs })}
          disabled={live.wrongs.length === 0 || selecting}
          className={`rounded-lg bg-amber px-4 py-2 text-xs font-bold text-white hover:brightness-105 ${live.wrongs.length > 0 && !selecting ? '' : 'invisible pointer-events-none'}`}>
          오답·모름 {live.wrongs.length}문제로 오답 학습지
        </button>
      </div>

      {/* 안내 문구(실시간 자동 저장) + 현재 요약 + 일괄 채점 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-xs text-ink2">
          채점 기록은 실시간으로 자동 저장됩니다.
          {/* 흔들림 방지: 저장 상태 글자는 항상 같은 폭을 차지(자리 예약)해 줄바꿈이 흔들리지 않게 */}
          <span className="ml-2 inline-block w-24 align-baseline">
            {saveState === 'saving' && <span className="text-amber">저장 중…</span>}
            {saveState === 'saved' && <span className="text-pine">✓ 저장됨 {savedAt}</span>}
          </span>
        </span>
        {inRange.length > 0 && (
          <span className="text-xs font-semibold tabular-nums">
            채점 {live.marked}문항 · <b className="text-pine">정답 {live.correct}</b> · <b className="text-clay">오답 {live.wrong}</b> · <b className="text-amber">모름 {live.unknown}</b>
            {/* 흔들림 방지: 점수는 항상 자리를 예약(채점 시작해도 폭이 변하지 않게) */}
            <span className="ml-1 inline-block w-12">{live.marked > 0 ? `(${Math.round(live.correct / live.marked * 100)}점)` : ''}</span>
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
        <aside ref={asideRef} onScroll={e => onAsideScroll(e.currentTarget.scrollTop)}
          className="h-fit max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-white p-2">
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
                    ? (m && m !== '정답' ? 'border-clay bg-red-50' : sel ? 'border-pine bg-pine-soft/40' : 'border-line bg-white hover:border-pine')
                    : (m ? CARD_CLASS[m] : CARD_UNMARKED)
                  // "(1) ○ (2) × …" 처럼 소문항이 여러 개면 소문항별로 채점한다(어디를 틀렸는지 남기려고).
                  const subs = selecting ? null : splitSubItems(i.answer)
                  if (subs) {
                    return (
                      <div key={i.id} className={`rounded-xl border p-3 text-left transition ${cardCls}`}>
                        <div className="flex items-center justify-between gap-1">
                          <b className="text-sm">p.{i.page} {i.label ?? i.no}번</b>
                          <span className="flex items-center gap-1">
                            <span className="text-[10px] text-ink2">{subs.length}개</span>
                            <span className={`text-lg font-black ${m ? MARK_CLASS[m] : 'text-ink2/25'}`}>{m ? MARK_ICON[m] : '○'}</span>
                          </span>
                        </div>
                        <div className="mt-1 grid gap-1">
                          {subs.map(s => {
                            const sm = markOf(subKey(i.id, s.no))
                            return (
                              <button key={s.no} onClick={() => cycleSub(i.id, s.no, subs.map(x => x.no))}
                                className={`flex items-start gap-1.5 rounded-lg border px-2 py-1 text-left text-xs transition ${
                                  sm === '정답' ? 'border-pine/40 bg-pine-soft/50'
                                  : sm === '오답' ? 'border-clay bg-red-50'
                                  : sm === '모름' ? 'border-amber bg-amber-soft/50'
                                  : 'border-line/70 bg-white hover:border-pine'}`}>
                                <span className={`shrink-0 font-black ${sm ? MARK_CLASS[sm] : 'text-ink2/25'}`}>{sm ? MARK_ICON[sm] : '○'}</span>
                                <span className="shrink-0 font-bold text-ink2">({s.no})</span>
                                <span className="min-w-0 grow break-words"><MathText text={safeLatex(s.ans)} /></span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <button key={i.id} onClick={() => selecting ? toggleSelect(i.id) : cycle(i.id)}
                      className={`rounded-xl border p-3 text-left transition ${cardCls}`}>
                      <div className="flex items-center justify-between gap-1">
                        <b className="text-sm">p.{i.page} {i.label ?? i.no}번</b>
                        {selecting
                          ? <input type="checkbox" checked={sel} readOnly className="pointer-events-none accent-[var(--color-pine,#2e6b4f)]" />
                          : <span className={`text-lg font-black ${m ? MARK_CLASS[m] : 'text-ink2/25'}`}>{m ? MARK_ICON[m] : '○'}</span>}
                      </div>
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
            for (const b of books) last = addWorkbook({ ...b, studentId: student.id })
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
        <DrillModal student={student} title={drill.title} wrongs={drill.wrongs} pagePicker={drill.pagePicker}
          onClose={() => setDrill(null)} />
      )}
    </div>
  )
}
