import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CURRICULA, curriculumFor, typeName, typeSubUnitId, typeUnitName } from '../data/curriculum'
import { conceptsForSubUnits } from '../data/concepts'
import { pickProblems, twinProblems, similarProblems } from '../lib/select'
import { useStore, uid } from '../lib/store'
import { getSubject, useSubject, SUBJECTS } from '../lib/subject'
import MathText, { isImageUrl } from '../components/MathText'
import ProblemContent from '../components/ProblemContent'
import { ProblemBlock, SheetHeader } from './WorksheetView'
import type { Diff, DiffMatrix, Kind, LayoutMode, Problem, SheetOptions, ThemeKey } from '../types'
import {
  DEFAULT_DIFF_MATRIX, DEFAULT_SHEET_OPTIONS, DIFFS, DIFF_COLOR, DIFF_LABEL,
  LAYOUT_LABEL, TAG_PRESETS, THEMES, spacingMmOf,
} from '../types'

type KindFilter = 'all' | Kind
type LeftTab = 'summary' | 'add' | 'twin' | 'mine' | 'concept'
type SortMode = 'curriculum' | 'diffAsc' | 'diffDesc' | 'objFirst' | 'shuffle' | 'probOrder' | 'user'
type ViewMode = 'problem' | 'answer' | 'full'   // 보기: 문제만 / 문제+정답 / 문제+해설+정답
type SrcTab = 'chapter' | 'workbook' | 'csat' | 'signature' | 'school' | 'upload'
type MockFilter = 'include' | 'exclude' | 'only'

// 헤더 STEP 대제목 (매쓰플랫 동일)
const STEP_TITLES: Record<1 | 2 | 3, string> = {
  1: '학습지 종류 및 범위 선택', 2: '학습지 상세 편집', 3: '학습지 설정',
}

// 교육 과정 외 문제 판별(출처 기준) — 경시·올림피아드 등
const isOutOfCurriculum = (p: Problem) => /경시|올림피아드|교육과정 외|KMO/.test(p.source)

// 시드 셔플 (새로 불러오기용 — seed 바뀌면 순서 재배치)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  if (seed === 0) return arr
  const out = [...arr]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const MOCK_FILTERS: { key: MockFilter; label: string }[] = [
  { key: 'include', label: '모의고사 포함' },
  { key: 'exclude', label: '모의고사 제외' },
  { key: 'only', label: '모의고사만' },
]
// 모의고사 문제 판별: 출처에 모의고사·수능·학평 포함
const isMockProblem = (p: Problem) => /모의고사|수능|학평/.test(p.source)

// 학교급 칩 (초·중·고) — CURRICULA id 접두사로 매핑
const SCHOOL_LEVELS: { label: string; prefix: string }[] = [
  { label: '초', prefix: 'e' }, { label: '중', prefix: 'm' }, { label: '고', prefix: 'h' },
]
// 과목 토글 — 목록은 lib/subject.ts SUBJECTS 단일 소스 (확장 시 거기에만 추가)
// 학기 칩 라벨: 초중 「1 - 1(22개정)」 · 고 「공통수학1(22개정)」 · 중등과학 「과학 1(22개정)」
function semesterChipLabel(grade: string, label: string): string {
  const m = grade.match(/^[초중](\d)-(\d)$/)
  if (m) return `${m[1]} - ${m[2]}(22개정)`
  const sci = grade.match(/^중(\d)$/)                       // 중등 과학 과정 (grade '중1'~'중3')
  const rev = label.match(/\((\d+개정)\)/)?.[1] ?? '22개정'
  if (sci) return `과학 ${sci[1]}(${rev})`
  return label.replace(/ \((\d+개정)\)/, '($1)')
}

// 매쓰플랫 추가 태그 4종 (기존 22종 뒤)
const EXTRA_TAGS = ['기타자료 유사', '그룹취약유형', '교재 오답', '모의고사쌍둥이']

const SRC_TABS: { key: SrcTab; label: string; note?: string }[] = [
  { key: 'chapter', label: '단원·유형별' },
  { key: 'workbook', label: '시중교재', note: '교재 페이지→유형 매핑 데이터 구축 후 활성화' },
  { key: 'csat', label: '수능/모의고사', note: 'EBSi·평가원 기출 변환 등록 후 활성화 (학년·연도·월 선택 → 회차 문항 선택 구조)' },
  { key: 'signature', label: '시그니처 교재', note: '자체 교재 등록 후 활성화' },
  { key: 'school', label: '학교별 기출', note: '학교 기출 DB 구축 후 활성화 (학교급·지역·학교·중간기말 필터 구조)' },
  { key: 'upload', label: '기출 업로드', note: 'PDF/이미지 업로드 → Claude가 문제·정답·해설 추출·유형 매칭(디지털 문제 변환) — 2차 개발' },
]

const COUNT_PRESETS = [25, 50, 75, 100]

// STEP3 '기본 폼' — 매쓰플랫 템플릿처럼 배치·간격·표기를 한 번에 세팅하는 프리셋
const SHEET_TEMPLATES: { key: string; name: string; desc: string; icon: string; patch: Partial<SheetOptions> }[] = [
  { key: 'basic',   name: '기본형',      desc: '2단 흘림 · 유형·난이도', icon: '▤', patch: { layout: 'basic',  wrongNoteArea: false, spacing: 3, showTypeName: true,  showDiff: true } },
  { key: 'solve',   name: '풀이 공간형', desc: '문제 옆 풀이칸',        icon: '✎', patch: { layout: 'basic',  wrongNoteArea: true,  spacing: 3, showTypeName: true,  showDiff: true } },
  { key: 'test',    name: '시험형',      desc: '2분할 · 넉넉한 간격',    icon: '❑', patch: { layout: 'split2', wrongNoteArea: false, spacing: 4, showTypeName: false, showDiff: false } },
  { key: 'quad',    name: '4분할',       desc: '한 면에 4문제',         icon: '⊞', patch: { layout: 'split4', wrongNoteArea: false, spacing: 3 } },
  { key: 'compact', name: '압축형',      desc: '6분할 · 좁게',          icon: '▦', patch: { layout: 'split6', wrongNoteArea: false, spacing: 2 } },
]
// 현재 옵션과 일치하는 템플릿 (배치+오답노트로 판정 — 서로 겹치지 않음)
function activeTemplateKey(o: SheetOptions): string | null {
  const t = SHEET_TEMPLATES.find(t =>
    t.patch.layout === o.layout && (t.patch.wrongNoteArea ?? false) === (o.wrongNoteArea ?? false))
  return t?.key ?? null
}

export default function MakeWizard() {
  const store = useStore()
  const {
    problems, saveWorksheet, updateWorksheet, worksheets, favorites, toggleFavorite, diffMatrix, setDiffMatrix, assignments,
    customProblems, sheetTemplates, addSheetTemplate, removeSheetTemplate,
  } = store
  const nav = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const editing = worksheets.find(w => w.id === editId) ?? null

  const [step, setStep] = useState<1 | 2 | 3>(editing ? 2 : 1)
  const [compact, setCompact] = useState(false)   // [줄여서 보기] — STEP 대제목 접기

  // STEP 1
  const [srcTab, setSrcTab] = useState<SrcTab>('chapter')
  // 초기 과정: 전역 과목(헤더 스위처)의 중등 첫 과정으로 시작 (수학이면 기존 기본 m1-1 유지)
  const [gradeId, setGradeId] = useState(() => {
    const s = getSubject()
    if (s === '수학') return 'm1-1'
    const first = CURRICULA.find(c => c.id.startsWith('m') && (c.subject ?? '수학') === s)
      ?? CURRICULA.find(c => (c.subject ?? '수학') === s)
    return (first ?? CURRICULA[0]).id
  })
  const cur = curriculumFor(gradeId)
  useEffect(() => { store.ensureCourse(gradeId) }, [gradeId])   // 과정 문제 풀 지연 로드
  const [gSubject, setGSubject] = useSubject()   // 전역 과목 (헤더 [수학|과학] 스위처)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(50)
  const [diffFocus, setDiffFocus] = useState<Diff>(3)
  const [kind, setKind] = useState<KindFilter>('all')
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [excludeRecent, setExcludeRecent] = useState(false)  // 기존(최근 30일) 출제 문제 제외
  const [includeMyDb, setIncludeMyDb] = useState(true)       // 나의 DB 문제 포함 (기본 on)
  const [excludeOutCurr, setExcludeOutCurr] = useState(true) // 교육 과정 외 유형 제외 (기본 on)
  const [evenTypes, setEvenTypes] = useState(false)          // 유형별 균등 배분
  const [mockFilter, setMockFilter] = useState<MockFilter>('include')  // 모의고사 포함 여부
  const [rateOpen, setRateOpen] = useState(false)            // 세부 정답률 (접이식)
  const [rateMin, setRateMin] = useState(0)                  // 정답률 범위 %
  const [rateMax, setRateMax] = useState(100)
  const [unitSearchOpen, setUnitSearchOpen] = useState(false)  // "내가 찾는 단원이 어디있지?"
  const [expanded, setExpanded] = useState<Set<string>>(new Set())     // 좌측 트리에서 펼친 대단원 (기본 전부 접힘)
  const [treeTarget, setTreeTarget] = useState<string | null>(null)    // 우측 유형 패널 대상 노드(대·중·소단원 id)

  // 전역 과목(헤더 스위처)과 동기화 — 헤더에서 바꾸면 트리도 그 과목 첫 과정으로 전환
  useEffect(() => {
    if ((cur.subject ?? '수학') === gSubject) return
    const first = CURRICULA.find(c => c.id.startsWith(gradeId[0]) && (c.subject ?? '수학') === gSubject)
      ?? CURRICULA.find(c => (c.subject ?? '수학') === gSubject)
    if (first) { setGradeId(first.id); setSelected(new Set()); setExpanded(new Set()); setTreeTarget(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gSubject])

  // STEP 2
  const [items, setItems] = useState<Problem[]>([])
  const [conceptIds, setConceptIds] = useState<Set<string>>(new Set())
  const [leftTab, setLeftTab] = useState<LeftTab>('summary')
  const [twinTarget, setTwinTarget] = useState<Problem | null>(null)
  const [twinDiffs, setTwinDiffs] = useState<Set<Diff>>(new Set())     // 쌍둥이 패널 난이도 필터 (빈 = 전체)
  const [twinSeed, setTwinSeed] = useState(0)                          // 쌍둥이 패널 새로 불러오기
  const [candSeed, setCandSeed] = useState(0)                          // 새 문제 추가 새로 불러오기
  const [coachOff, setCoachOff] = useState(() => localStorage.getItem('mw-coach-drag') === '1')
  const [dragNewId, setDragNewId] = useState<string | null>(null)      // 좌→우 드래그 중인 후보 문제
  const [mineTab, setMineTab] = useState<'fav' | 'db'>('fav')          // 내 문제 서브탭
  const [conceptMode, setConceptMode] = useState<'type' | 'sub'>('sub') // 개념: 유형별/소단원별
  const [mathGuideOpen, setMathGuideOpen] = useState(false)            // [? 수식 가이드]
  const [sortMode, setSortMode] = useState<SortMode>('curriculum')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('problem')        // 보기 셀렉트 (편집 단계 전용)
  const keepItemsRef = useRef(false)                                   // [⊞ 범위 변경] 복귀 시 담은 문제 유지

  // 나의 DB(직접 업로드) 문제 id — 뱃지·포함 옵션용
  const myDbIds = useMemo(() => new Set(customProblems.map(p => p.id)), [customProblems])

  // STEP 3
  const [title, setTitle] = useState('')
  const [wsGrade, setWsGrade] = useState('')                 // 학년 선택 (빈값 = 현재 과정)
  const [author, setAuthor] = useState('깊은생각수학')
  const [tags, setTags] = useState<Set<string>>(new Set(['기본']))
  const [theme, setTheme] = useState<ThemeKey>('pine')
  const [opts, setOpts] = useState<SheetOptions>(DEFAULT_SHEET_OPTIONS)

  // 수정 모드 초기화
  useEffect(() => {
    if (!editing) return
    setItems(editing.problemIds.map(pid => problems.find(p => p.id === pid)).filter(p => p != null))
    setTitle(editing.title)
    setAuthor(editing.author)
    setTags(new Set(editing.tags))
    setTheme(editing.theme)
    setOpts(editing.options)
    setConceptIds(new Set(editing.conceptIds ?? []))
    setSelected(new Set(editing.problemIds
      .map(pid => problems.find(p => p.id === pid)?.typeId)
      .filter((t): t is string => !!t)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  // URL 프리셋: ?types=id1,id2&course=courseId → 해당 과정·유형이 선택된 상태로 STEP1 시작
  useEffect(() => {
    if (editing) return
    const course = params.get('course')
    const types = params.get('types')
    if (!course && !types) return
    const c = course && curriculumFor(course).id === course ? curriculumFor(course) : cur
    if (course && c.id === course) setGradeId(course)
    if (types) {
      const valid = new Set(c.units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))))
      const ids = types.split(',').map(t => t.trim()).filter(t => valid.has(t))
      if (ids.length > 0) {
        setSelected(new Set(ids))
        // 선택된 유형이 속한 첫 대단원을 펼치고 우측 패널 대상으로
        const idSet = new Set(ids)
        const firstUnit = c.units.find(u => u.mids.some(m => m.subs.some(s => s.types.some(t => idSet.has(t.id)))))
        if (firstUnit) { setExpanded(new Set([firstUnit.id])); setTreeTarget(firstUnit.id) }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 이탈 가드: 편집 중(STEP2·3 또는 STEP1에서 유형 선택 있음) 새로고침·창 닫기 경고
  const dirty = step > 1 || selected.size > 0
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const typeOrder = useMemo(
    () => cur.units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))),
    [cur],
  )
  const selectedOrder = typeOrder.filter(t => selected.has(t))
  const pool = useMemo(() => problems.filter(p => selected.has(p.typeId)), [problems, selected])

  // 최근 30일 출제(수업·숙제, 전체 학생)된 학습지의 문제 id
  const recentProblemIds = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000
    const wsIds = new Set(assignments.filter(a => new Date(a.date).getTime() >= cutoff).map(a => a.worksheetId))
    const s = new Set<string>()
    for (const w of worksheets) if (wsIds.has(w.id)) for (const pid of w.problemIds) s.add(pid)
    return s
  }, [assignments, worksheets])
  const effectivePool = useMemo(() => {
    let arr = excludeRecent ? pool.filter(p => !recentProblemIds.has(p.id)) : pool
    if (mockFilter === 'exclude') arr = arr.filter(p => !isMockProblem(p))
    else if (mockFilter === 'only') arr = arr.filter(isMockProblem)
    if (!includeMyDb) arr = arr.filter(p => !myDbIds.has(p.id))                 // 나의 DB 문제 포함 off
    if (excludeOutCurr) arr = arr.filter(p => !isOutOfCurriculum(p))            // 교육 과정 외 유형 제외
    if (rateMin > 0 || rateMax < 100)                                           // 세부 정답률 범위 (데이터 있는 문제만 적용)
      arr = arr.filter(p => p.correctRate == null || (p.correctRate >= rateMin && p.correctRate <= rateMax))
    return arr
  }, [pool, excludeRecent, recentProblemIds, mockFilter, includeMyDb, myDbIds, excludeOutCurr, rateMin, rateMax])
  const availableCount = effectivePool.filter(p => kind === 'all' || p.kind === kind).length
  const usedIds = useMemo(() => new Set(items.map(p => p.id)), [items])

  function toggleType(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleMany(ids: string[], on: boolean) {
    setSelected(prev => { const n = new Set(prev); for (const id of ids) { if (on) n.add(id); else n.delete(id) } return n })
  }
  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  // 우측 유형 패널 대상: treeTarget(대·중·소단원 id) → 표시할 이름·소단원 목록
  const targetInfo = useMemo(() => {
    if (!treeTarget) return null
    for (const u of cur.units) {
      if (u.id === treeTarget) return { name: u.name, subs: u.mids.flatMap(m => m.subs) }
      for (const m of u.mids) {
        if (m.id === treeTarget) return { name: m.name, subs: m.subs }
        for (const s of m.subs) if (s.id === treeTarget) return { name: s.name, subs: [s] }
      }
    }
    return null
  }, [cur, treeTarget])

  function goStep2() {
    let picked = pickProblems(effectivePool, count, diffFocus, kind, selectedOrder, diffMatrix)
    if (evenTypes && selectedOrder.length > 0) {
      // 유형별 균등 배분: 유형별 최대 = ceil(문제 수 / 선택 유형 수) 상한 적용
      const cap = Math.ceil(count / selectedOrder.length)
      const per = new Map<string, number>()
      picked = picked.filter(p => {
        const n = per.get(p.typeId) ?? 0
        if (n >= cap) return false
        per.set(p.typeId, n + 1)
        return true
      })
    }
    if (keepItemsRef.current && items.length > 0) {
      // [⊞ 범위 변경] 복귀: 담아둔 문제 유지 + 부족분만 새 범위에서 보충
      keepItemsRef.current = false
      const have = new Set(items.map(p => p.id))
      const extra = picked.filter(p => !have.has(p.id)).slice(0, Math.max(0, count - items.length))
      setItems([...items, ...extra])
    } else {
      setItems(picked)
    }
    setStep(2)
  }

  // STEP3 진입: 학습지명이 비어 있으면 선택 범위의 대단원명으로 자동 채움
  function goStep3() {
    if (!title.trim()) {
      const unitNames = cur.units
        .filter(u => u.mids.some(m => m.subs.some(s => s.types.some(t => selected.has(t.id)))))
        .map(u => u.name)
      if (unitNames.length > 0)
        setTitle(unitNames.length > 1 ? `${unitNames[0]} ~ ${unitNames[unitNames.length - 1]}` : unitNames[0])
    }
    setStep(3)
  }

  // ✕ 닫기: 확인 후 학습지 목록으로 이동 (beforeunload 가드와 별개)
  function closeWizard() {
    if (confirm('주의 — 화면을 이동하면 수정된 내용이 저장되지 않습니다. 다른 화면으로 이동하시겠습니까?'))
      nav('/prep/worksheet')
  }

  function applySort(mode: SortMode) {
    setSortMode(mode)
    if (mode === 'user') return   // 사용자 정렬: 현재 순서 유지 (드래그·↑↓로 편집)
    setItems(prev => {
      const next = [...prev]
      if (mode === 'curriculum') next.sort((a, b) => {
        const ta = typeOrder.indexOf(a.typeId), tb = typeOrder.indexOf(b.typeId)
        return ta !== tb ? ta - tb : a.diff - b.diff
      })
      else if (mode === 'diffAsc') next.sort((a, b) => a.diff - b.diff)
      else if (mode === 'diffDesc') next.sort((a, b) => b.diff - a.diff)
      else if (mode === 'objFirst') next.sort((a, b) =>
        a.kind === b.kind ? 0 : a.kind === '객관식' ? -1 : 1)   // 객관식 상단배치 (안정 정렬)
      else if (mode === 'probOrder') next.sort((a, b) =>
        a.source !== b.source ? a.source.localeCompare(b.source, 'ko') : a.id.localeCompare(b.id))  // 문제(출처·번호) 순
      else if (mode === 'shuffle') for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]
      }
      return next
    })
  }

  function removeItem(id: string) { setItems(prev => prev.filter(p => p.id !== id)) }
  function moveItem(idx: number, dir: -1 | 1) {
    setSortMode('user')   // 수동 이동 → 사용자 정렬
    setItems(prev => {
      const next = [...prev]; const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }
  function swapItem(oldP: Problem, newP: Problem) {
    setItems(prev => prev.map(p => p.id === oldP.id ? newP : p))
    setTwinTarget(null)
  }
  function addItem(p: Problem, afterId?: string) {
    setItems(prev => {
      if (prev.some(x => x.id === p.id)) return prev
      if (!afterId) return [...prev, p]
      const idx = prev.findIndex(x => x.id === afterId)
      const next = [...prev]; next.splice(idx + 1, 0, p); return next
    })
  }
  function dropOn(target: number) {
    // 좌측 후보 카드에서 끌어온 문제는 해당 위치에 삽입 (좌→우 드래그 추가)
    if (dragNewId !== null) {
      const p = problems.find(x => x.id === dragNewId)
      setDragNewId(null)
      if (p && !items.some(x => x.id === p.id))
        setItems(prev => { const next = [...prev]; next.splice(target, 0, p); return next })
      return
    }
    if (dragIdx === null || dragIdx === target) { setDragIdx(null); return }
    setSortMode('user')   // 드래그 순서 변경 → 사용자 정렬
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(target, 0, moved)
      return next
    })
    setDragIdx(null)
  }
  function toggleConcept(id: string) {
    setConceptIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  // 학년 선택값 (기본 = 현재 과정 / 수정 모드는 기존 학년)
  const gradeValue = wsGrade || (editing ? editing.grade : cur.grade)

  function save() {
    if (!title.trim()) { alert('학습지명을 입력해주세요.'); return }
    const payload = {
      title: title.trim(),
      author: author.trim() || '출제자',
      grade: gradeValue,
      subject: cur.subject ?? '수학',
      tags: [...tags],
      theme,
      problemIds: items.map(p => p.id),
      conceptIds: [...conceptIds],
      options: opts,
    }
    if (editing) {
      updateWorksheet(editing.id, payload)
      nav(`/worksheet/${editing.id}`)
    } else {
      const id = uid('ws')
      saveWorksheet({ ...payload, id, listIds: [], createdAt: new Date().toISOString(), deletedAt: null })
      nav(`/worksheet/${id}`)
    }
  }

  // 선택 범위(소단원)에 해당하는 개념
  const rangeSubIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of items) s.add(typeSubUnitId(p.typeId))
    return s
  }, [items])
  const rangeConcepts = useMemo(() => conceptsForSubUnits(rangeSubIds), [rangeSubIds])

  const diffStats = useMemo(() => {
    const s: Record<Diff, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const p of items) s[p.diff]++
    return s
  }, [items])

  // 새 문제 추가 후보: 선택 범위 내, 미사용 ([↺ 새로 불러오기] 시 순서 재배치)
  const candidates = useMemo(
    () => seededShuffle(pool.filter(p => !usedIds.has(p.id)), candSeed),
    [pool, usedIds, candSeed],
  )
  const favoriteProblems = useMemo(
    () => problems.filter(p => favorites.includes(p.id)),
    [problems, favorites],
  )

  // 쌍둥이·유사 패널: 난이도 필터 + 새로 불러오기(순서 재배치)
  const twinList = useMemo(() => !twinTarget ? [] :
    seededShuffle(twinProblems(problems, twinTarget, usedIds), twinSeed)
      .filter(p => twinDiffs.size === 0 || twinDiffs.has(p.diff)),
    [problems, twinTarget, usedIds, twinSeed, twinDiffs])
  const similarList = useMemo(() => !twinTarget ? [] :
    seededShuffle(similarProblems(problems, twinTarget, usedIds), twinSeed)
      .filter(p => twinDiffs.size === 0 || twinDiffs.has(p.diff)),
    [problems, twinTarget, usedIds, twinSeed, twinDiffs])

  // 문제 오류 신고 — 접수 기록을 로컬에 남기고 확인 알림 (원본: 신고 폼 제출)
  function reportProblem(p: Problem) {
    const reason = prompt(`「${typeName(p.typeId)}」 문제 오류 신고\n오류 내용을 적어주세요 (오탈자·정답 오류·그림 문제 등)`)
    if (!reason?.trim()) return
    try {
      const key = 'problem-reports'
      const arr = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
      arr.push({ problemId: p.id, reason: reason.trim(), at: new Date().toISOString() })
      localStorage.setItem(key, JSON.stringify(arr))
    } catch { /* 무시 */ }
    alert('오류 신고가 접수되었습니다. 확인 후 문제은행에 반영합니다.')
  }

  // STEP3 실물 미리보기 파생값 (WorksheetView 지면 규칙과 동일하게 계산 — 매쓰플랫 실측 간격)
  const previewSpacingMm = spacingMmOf(opts.spacing)
  const previewDateText = opts.showDate
    ? (opts.customDate
        ? opts.customDate.replaceAll('-', '. ') + '.'
        : new Date().toLocaleDateString('ko-KR'))
    : null
  const previewSubtitle = items.length ? typeUnitName(items[0].typeId) : ''
  const previewCaption = (p: Problem) => {
    const parts: string[] = []
    if (opts.showTypeName) parts.push(typeName(p.typeId))
    if (opts.showDiff) parts.push(DIFF_LABEL[p.diff])
    if (opts.showCorrectRate && p.correctRate != null) parts.push(`정답률 ${p.correctRate}%`)
    if (opts.showNew && p.isNew) parts.push('신경향')
    if (opts.showRelated && p.twinGroup) {
      const rel = items.filter(x => x.id !== p.id && x.twinGroup === p.twinGroup).map(x => items.indexOf(x) + 1)
      if (rel.length) parts.push(`연관 ${rel.join(',')}번`)
    }
    return parts.join(' · ')
  }
  // 첫 페이지 분량만 (기본 5 · 오답노트 3 · 2분할 2 · 4분할 4 · 6분할 6)
  const previewItems = items.slice(0,
    opts.layout === 'basic' ? (opts.wrongNoteArea ? 3 : 5)
    : opts.layout === 'split2' ? 2
    : opts.layout === 'split4' ? 4 : 6)

  return (
    <div className="pb-24">
      {/* STEP 대제목 + [줄여서 보기] (매쓰플랫 헤더 형식) */}
      {!compact && (
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-xl font-black">
            <span className="mr-2 text-pine-dark">STEP {step}</span>{STEP_TITLES[step]}
          </h1>
          <button onClick={() => setCompact(true)}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink2 hover:bg-paper2">
            줄여서 보기 ∧
          </button>
        </div>
      )}
      {/* 단계 표시 */}
      <div className="mb-8 flex items-center gap-3 text-sm">
        {compact && (
          <button onClick={() => setCompact(false)} title={`STEP ${step} ${STEP_TITLES[step]}`}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink2 hover:bg-paper2">
            전체 화면 ∨
          </button>
        )}
        {([[1, '범위 선택'], [2, '상세 편집'], [3, '구성 설정']] as const).map(([n, label]) => (
          <div key={n} className={`flex items-center gap-2 ${step === n ? '' : 'opacity-40'}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${step === n ? 'bg-pine text-paper' : 'bg-paper2 text-ink2'}`}>{n}</span>
            <span className="font-semibold">{label}</span>
            {n !== 3 && <span className="mx-1 text-line">─</span>}
          </div>
        ))}
        {editing && <span className="rounded-full bg-amber-soft px-3 py-1 text-xs font-bold text-amber">수정 모드: {editing.title}</span>}
        <div className="grow" />
        <button onClick={closeWizard}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-paper2 hover:text-ink">
          ✕ 닫기
        </button>
      </div>

      {step === 1 && (
        <div className="mb-5 flex gap-7 border-b border-line px-1">
          {SRC_TABS.map(t => (
            <button key={t.key} onClick={() => setSrcTab(t.key)}
              className={`-mb-px border-b-2 pb-3 pt-1 text-[15px] font-bold transition ${
                srcTab === t.key ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {step === 1 && srcTab !== 'chapter' && (
        <div className="rounded-2xl border border-line bg-white p-10">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-lg font-black">{SRC_TABS.find(t => t.key === srcTab)?.label}</h2>
            <span className="rounded-full bg-paper2 px-3 py-1 text-xs font-bold text-ink2">구조 확보 · 콘텐츠 대기</span>
          </div>
          <p className="text-sm text-ink2">{SRC_TABS.find(t => t.key === srcTab)?.note}</p>
          <button onClick={() => setSrcTab('chapter')}
            className="mt-6 rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">
            ← 단원·유형별로 만들기
          </button>
        </div>
      )}

      {step === 1 && srcTab === 'chapter' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-4">
              {/* 과목 + 학교급 칩 + 전체 선택/해제 */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* 과목 토글 (수학/과학) */}
                  <div className="flex gap-1 rounded-lg bg-paper2 p-1">
                    {SUBJECTS.map(sub => (
                      <button key={sub}
                        onClick={() => {
                          if ((cur.subject ?? '수학') === sub) return
                          setGSubject(sub)   // 전역 과목도 함께 변경 (헤더 스위처와 동기)
                          const first = CURRICULA.find(c => c.id.startsWith(gradeId[0]) && (c.subject ?? '수학') === sub)
                            ?? CURRICULA.find(c => (c.subject ?? '수학') === sub)
                          if (first) { setGradeId(first.id); setSelected(new Set()); setExpanded(new Set()); setTreeTarget(null) }
                        }}
                        className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${
                          (cur.subject ?? '수학') === sub ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'
                        }`}>
                        {sub}
                      </button>
                    ))}
                  </div>
                  {/* 학교급 칩 */}
                  <div className="flex gap-1 rounded-lg bg-paper2 p-1">
                    {SCHOOL_LEVELS.map(lv => {
                      const has = CURRICULA.some(c => c.id.startsWith(lv.prefix) && (c.subject ?? '수학') === (cur.subject ?? '수학'))
                      return (
                        <button key={lv.prefix} disabled={!has}
                          onClick={() => {
                            if (gradeId.startsWith(lv.prefix)) return
                            const first = CURRICULA.find(c => c.id.startsWith(lv.prefix) && (c.subject ?? '수학') === (cur.subject ?? '수학'))
                            if (first) { setGradeId(first.id); setSelected(new Set()); setExpanded(new Set()); setTreeTarget(null) }
                          }}
                          className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${
                            gradeId.startsWith(lv.prefix) ? 'bg-pine text-paper' : has ? 'text-ink2 hover:text-ink' : 'text-ink2/30 cursor-not-allowed'
                          }`}>
                          {lv.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => toggleMany(typeOrder, true)} className="rounded border border-line px-2 py-1 hover:bg-paper2">전체 선택</button>
                  <button onClick={() => toggleMany(typeOrder, false)} className="rounded border border-line px-2 py-1 hover:bg-paper2">전체 해제</button>
                </div>
              </div>
              {/* 학기 칩 (가로 스크롤, 현재 과목·학교급) */}
              <div className="flex gap-2 overflow-x-auto border-b border-line pb-3">
                {CURRICULA.filter(c => c.id.startsWith(gradeId[0]) && (c.subject ?? '수학') === (cur.subject ?? '수학')).map(c => (
                  <button key={c.id}
                    onClick={() => { if (c.id !== gradeId) { setGradeId(c.id); setSelected(new Set()); setExpanded(new Set()); setTreeTarget(null) } }}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
                      c.id === gradeId ? 'border-pine bg-pine-soft font-bold text-pine-dark' : 'border-line text-ink2 hover:text-ink'
                    }`}>
                    {semesterChipLabel(c.grade, c.label)}
                  </button>
                ))}
              </div>
              <button onClick={() => setUnitSearchOpen(true)}
                className="mt-2 text-xs font-semibold text-blue-600 underline-offset-2 hover:underline">
                내가 찾는 단원이 어디있지?
              </button>
            </div>
            {/* 매쓰플랫식 2패널: 좌 단원 트리(아코디언) · 우 유형 목록 */}
            <div className="grid grid-cols-[300px_1fr] overflow-hidden rounded-xl border border-line">
              {/* 좌: 단원 트리 */}
              <div className="max-h-[560px] overflow-auto border-r border-line py-2">
                <div className="flex items-center gap-2 px-3 py-2">
                  <TriCheck state={checkStateOf(typeOrder, selected)}
                    onChange={on => toggleMany(typeOrder, on)} />
                  <span className="truncate text-sm font-black">{semesterChipLabel(cur.grade, cur.label)}</span>
                </div>
                {cur.units.map(u => {
                  const unitTypeIds = u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))
                  const open = expanded.has(u.id)
                  return (
                    <div key={u.id}>
                      {/* 대단원 행: 화살표=펼침 · 체크=전체 토글 · 이름=우측 대상 */}
                      <div className={`flex items-center gap-1.5 py-1.5 pl-2 pr-2 ${treeTarget === u.id ? 'bg-pine-soft' : 'hover:bg-paper2'}`}>
                        <button onClick={() => toggleExpand(u.id)} title={open ? '접기' : '펼치기'}
                          className="w-5 shrink-0 text-center text-xs text-ink2">{open ? '▾' : '▸'}</button>
                        <TriCheck state={checkStateOf(unitTypeIds, selected)}
                          onChange={on => toggleMany(unitTypeIds, on)} />
                        <button onClick={() => setTreeTarget(u.id)}
                          className="grow truncate text-left text-sm font-bold">{u.name}</button>
                      </div>
                      {open && u.mids.map(m => {
                        const midTypeIds = m.subs.flatMap(s => s.types.map(t => t.id))
                        const midRedundant = m.name === u.name // 초등: 단원명 반복 → 행 생략
                        return (
                          <div key={m.id}>
                            {!midRedundant && (
                              <div className={`flex items-center gap-1.5 py-1 pl-9 pr-2 ${treeTarget === m.id ? 'bg-pine-soft' : 'hover:bg-paper2'}`}>
                                <TriCheck state={checkStateOf(midTypeIds, selected)} size="h-3.5 w-3.5"
                                  onChange={on => toggleMany(midTypeIds, on)} />
                                <button onClick={() => setTreeTarget(m.id)}
                                  className="grow truncate text-left text-sm font-semibold">{m.name}</button>
                              </div>
                            )}
                            {m.subs.map(s => {
                              if (!midRedundant && s.name === m.name) return null // 중단원명 반복 소단원 생략(중단원 행이 대신함)
                              const subTypeIds = s.types.map(t => t.id)
                              return (
                                <div key={s.id}
                                  className={`flex items-center gap-1.5 py-1 pr-2 ${midRedundant ? 'pl-9' : 'pl-14'} ${treeTarget === s.id ? 'bg-pine-soft' : 'hover:bg-paper2'}`}>
                                  <TriCheck state={checkStateOf(subTypeIds, selected)} size="h-3 w-3"
                                    onChange={on => toggleMany(subTypeIds, on)} />
                                  <button onClick={() => setTreeTarget(s.id)}
                                    className="grow truncate text-left text-sm text-ink2">{s.name}</button>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              {/* 우: 유형 목록 */}
              <div className="max-h-[560px] overflow-auto p-4">
                {!targetInfo ? (
                  <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-ink2">
                    단원과 유형을 선택해주세요.
                  </div>
                ) : (() => {
                  const targetTypeIds = targetInfo.subs.flatMap(s => s.types.map(t => t.id))
                  const selCount = targetTypeIds.filter(id => selected.has(id)).length
                  return (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
                        <span className="text-sm font-bold">{targetInfo.name}</span>
                        <span className="text-xs text-ink2">— 유형 {targetTypeIds.length}개 · 선택 {selCount}개</span>
                        <div className="grow" />
                        <button onClick={() => toggleMany(targetTypeIds, true)}
                          className="rounded border border-line px-2 py-1 text-xs font-semibold hover:bg-paper2">이 범위 전체 선택</button>
                        <button onClick={() => toggleMany(targetTypeIds, false)}
                          className="rounded border border-line px-2 py-1 text-xs font-semibold hover:bg-paper2">해제</button>
                      </div>
                      {targetInfo.subs.map(s => (
                        <div key={s.id} className="mb-4">
                          <div className="mb-1.5 rounded bg-paper2 px-2.5 py-1.5 text-xs font-bold text-ink2">{s.name}</div>
                          <div className="grid gap-0.5">
                            {s.types.map(t => {
                              const n = problems.filter(p => p.typeId === t.id).length
                              return (
                                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-paper2">
                                  <input type="checkbox" checked={selected.has(t.id)}
                                    onChange={() => toggleType(t.id)} className="h-3.5 w-3.5 shrink-0 accent-pine" />
                                  {t.name}
                                  <span className="text-xs text-ink2">({n})</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
            <div>
              <div className="mb-2 text-sm font-bold">문제 수 <span className="font-normal text-ink2">최대 150문제</span></div>
              <div className="flex gap-2">
                {COUNT_PRESETS.map(c => (
                  <button key={c} onClick={() => setCount(c)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${count === c ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
                    {c}
                  </button>
                ))}
                <input type="number" min={1} max={150} value={count}
                  onChange={e => setCount(Math.max(1, Math.min(150, Number(e.target.value) || 1)))}
                  className="w-16 rounded-lg border border-line px-2 py-1.5 text-center text-sm" />
              </div>
              <input type="range" min={1} max={150} value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="mt-2 w-full accent-pine" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                난이도
                <button onClick={() => setMatrixOpen(true)}
                  className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs font-semibold text-ink2 hover:bg-paper2">
                  ⚙ 난이도 설정
                </button>
              </div>
              <div className="flex gap-2">
                {DIFFS.map(d => (
                  <button key={d} onClick={() => setDiffFocus(d)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${diffFocus === d ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
                    {DIFF_LABEL[d]}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-xs text-ink2">
                출제 비율: {DIFFS.map((d, i) => `${DIFF_LABEL[d]} ${diffMatrix[diffFocus][i]}%`).join(' · ')}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                문제 타입
                <button onClick={() => setOpts(o => ({ ...o, autoGrade: !(o.autoGrade ?? true) }))}
                  className="flex items-center gap-1.5 text-xs font-semibold text-ink2" title="자동채점 학습지 (수업>학습지 탭에서 답 입력 채점)">
                  자동채점
                  <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${(opts.autoGrade ?? true) ? 'justify-end bg-pine' : 'justify-start bg-line'}`}>
                    <span className="h-4 w-4 rounded-full bg-white" />
                  </span>
                </button>
              </div>
              <div className="flex gap-2">
                {(['all', '객관식', '주관식'] as KindFilter[]).map(k => (
                  <button key={k} onClick={() => setKind(k)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${kind === k ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
                    {k === 'all' ? '전체' : k}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-bold">모의고사 포함 여부</div>
              <div className="flex flex-wrap gap-2">
                {MOCK_FILTERS.map(f => (
                  <button key={f.key} onClick={() => setMockFilter(f.key)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${mockFilter === f.key ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="font-bold">추가 옵션</div>
              <label className="flex cursor-pointer flex-wrap items-center gap-2">
                <input type="checkbox" checked={excludeRecent}
                  onChange={e => setExcludeRecent(e.target.checked)} className="h-4 w-4 accent-pine" />
                기존 출제 문제 제외 <span className="text-xs text-ink2">(최근 30일)</span>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">같은 문제, 다시 출제되지 않아요</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2" title="직접 업로드한 나의 DB 문제를 출제 풀에 포함합니다">
                <input type="checkbox" checked={includeMyDb}
                  onChange={e => setIncludeMyDb(e.target.checked)} className="h-4 w-4 accent-pine" />
                나의 DB 문제 포함 <span className="text-xs text-ink2">ⓘ</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2" title="경시·올림피아드 등 교육 과정 밖 출처 문제를 제외합니다">
                <input type="checkbox" checked={excludeOutCurr}
                  onChange={e => setExcludeOutCurr(e.target.checked)} className="h-4 w-4 accent-pine" />
                교육 과정 외 유형 제외
              </label>
              <label className="flex cursor-pointer items-center gap-2" title="선택 유형별로 문제 수를 고르게 배분합니다">
                <input type="checkbox" checked={evenTypes}
                  onChange={e => setEvenTypes(e.target.checked)} className="h-4 w-4 accent-pine" />
                문제 수 균등 배분 <span className="text-xs text-ink2">ⓘ</span>
              </label>
            </div>

            {/* 세부 정답률 (접이식 범위) */}
            <div className="text-sm">
              <button onClick={() => setRateOpen(v => !v)} className="flex w-full items-center font-bold">
                세부 정답률 <span className="ml-2 text-xs font-normal text-ink2">{rateMin}% ~ {rateMax}%</span>
                <span className="grow" />{rateOpen ? '∧' : '∨'}
              </button>
              {rateOpen && (
                <div className="mt-2 grid gap-1.5">
                  <label className="flex items-center gap-2 text-xs text-ink2">
                    최소 {rateMin}%
                    <input type="range" min={0} max={100} value={rateMin}
                      onChange={e => setRateMin(Math.min(Number(e.target.value), rateMax))} className="grow accent-pine" />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-ink2">
                    최대 {rateMax}%
                    <input type="range" min={0} max={100} value={rateMax}
                      onChange={e => setRateMax(Math.max(Number(e.target.value), rateMin))} className="grow accent-pine" />
                  </label>
                  <span className="text-[11px] text-ink2">정답률 데이터가 있는 문제에만 적용됩니다 (없는 문제는 포함).</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white px-6 py-4">
            <div className="text-sm">총 <b className="text-lg">{items.length}</b>문제</div>
            <div className="text-sm text-ink2">
              객관식 {items.filter(p => p.kind === '객관식').length} · 주관식 {items.filter(p => p.kind === '주관식').length} · 선다형 {items.filter(p => p.kind === '객관식' && p.choices && p.choices.length > 0).length}
            </div>
            {(() => {
              const rated = items.filter(p => p.correctRate != null)
              return (
                <div className="text-sm text-ink2">
                  원내 정답률 <b className="text-ink">{rated.length ? `${Math.round(rated.reduce((a, p) => a + (p.correctRate ?? 0), 0) / rated.length)}%` : '-'}</b>
                </div>
              )
            })()}
            <div className="flex items-end gap-1.5">
              {DIFFS.map(d => (
                <div key={d} className="flex flex-col items-center gap-1">
                  <div className="w-6 rounded-t bg-pine/70" style={{ height: `${6 + diffStats[d] * 7}px` }} />
                  <span className="text-[10px] text-ink2">{DIFF_LABEL[d]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* 좌측 도구 탭 */}
            <div className="h-fit rounded-2xl border border-line bg-white">
              <div className="flex border-b border-line text-sm font-semibold">
                {([['summary', '단원 요약'], ['add', '새 문제 추가'], ['twin', '쌍둥이·유사'], ['mine', '내 문제'], ['concept', '개념 추가']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setLeftTab(k)}
                    className={`grow px-2 py-3 text-[13px] ${leftTab === k ? 'border-b-2 border-pine text-pine-dark' : 'text-ink2'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                {leftTab === 'summary' && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-ink2">
                        <th className="py-1.5">번호</th><th>타입</th><th>난이도</th><th>유형명</th><th className="text-center">순서 변경</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p, i) => (
                        <tr key={p.id}
                          draggable
                          onDragStart={() => setDragIdx(i)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => dropOn(i)}
                          onDragEnd={() => setDragIdx(null)}
                          className={`border-b border-line/50 ${dragIdx === i ? 'opacity-40' : ''}`}>
                          <td className="py-1.5 font-bold">{i + 1}</td>
                          <td>{p.kind}</td>
                          <td>{DIFF_LABEL[p.diff]}</td>
                          <td className="text-ink2">{typeName(p.typeId)}</td>
                          <td className="whitespace-nowrap text-center">
                            <span className="cursor-grab select-none px-1 text-line" title="드래그해서 순서 변경">≡</span>
                            <button onClick={() => moveItem(i, -1)} className="px-1 text-ink2 hover:text-ink">↑</button>
                            <button onClick={() => moveItem(i, 1)} className="px-1 text-ink2 hover:text-ink">↓</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {leftTab === 'add' && (
                  <div>
                    {!coachOff && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-pine/40 bg-pine-soft/40 px-3 py-2 text-xs font-semibold text-pine-dark">
                        문제를 오른쪽으로 끌면 쉽게 문제를 추가할 수 있습니다.
                        <button onClick={() => { setCoachOff(true); try { localStorage.setItem('mw-coach-drag', '1') } catch { /* 무시 */ } }}
                          className="ml-auto text-ink2 hover:text-ink">✕</button>
                      </div>
                    )}
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-ink2">범위 내 후보 {candidates.length}개</span>
                      <div className="grow" />
                      <button onClick={() => {
                        if (!confirm('범위 선택으로 돌아갑니다. 담은 문제는 유지되고, 새 범위에서 부족분만 보충됩니다.')) return
                        keepItemsRef.current = true
                        setStep(1)
                      }} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-paper2">⊞ 범위 변경</button>
                      <button onClick={() => setCandSeed(Date.now() % 233280)}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-paper2">↺ 새로 불러오기</button>
                      <button
                        onClick={() => candidates.forEach(p => addItem(p))}
                        className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper">+ 전체 추가</button>
                    </div>
                    {candidates.map(p => (
                      <CandidateCard key={p.id} p={p} onAdd={() => addItem(p)}
                        myDb={myDbIds.has(p.id)}
                        onDragStart={() => setDragNewId(p.id)} onDragEnd={() => setDragNewId(null)}
                        fav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} />
                    ))}
                    {candidates.length === 0 && <Empty text="추가할 수 있는 문제가 없습니다. 문제은행에 문제를 더 쌓아주세요." />}
                  </div>
                )}

                {leftTab === 'twin' && (
                  !twinTarget
                    ? <Empty text="오른쪽 문제 카드의 [쌍둥이·유사] 버튼을 눌러주세요." />
                    : (
                      <div>
                        <div className="mb-2 flex items-start gap-2 text-sm font-bold">
                          <div>
                            {items.findIndex(x => x.id === twinTarget.id) + 1}번 쌍둥이 · 유사문제
                            <div className="font-normal text-ink2">문제를 교체하거나, 추가할 수 있습니다. — {typeName(twinTarget.typeId)}</div>
                          </div>
                          <button onClick={() => setTwinSeed(Date.now() % 233280)}
                            className="ml-auto shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-paper2">↺ 새로 불러오기</button>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {DIFFS.map(d => {
                            const on = twinDiffs.has(d)
                            return (
                              <button key={d} onClick={() => setTwinDiffs(prev => {
                                const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n
                              })}
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${on ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
                                {DIFF_LABEL[d]}
                              </button>
                            )
                          })}
                          {twinDiffs.size > 0 && (
                            <button onClick={() => setTwinDiffs(new Set())} className="text-xs text-ink2 hover:text-ink">초기화</button>
                          )}
                        </div>
                        <div className="mb-2 text-xs font-bold text-pine-dark">● 쌍둥이 문제 (같은 템플릿·숫자 변형)</div>
                        {twinList.map(p => (
                          <CandidateCard key={p.id} p={p}
                            onAdd={() => addItem(p, twinTarget.id)}
                            onSwap={() => swapItem(twinTarget, p)}
                            myDb={myDbIds.has(p.id)}
                            fav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} />
                        ))}
                        {twinList.length === 0 &&
                          <div className="mb-3 rounded-lg border border-dashed border-line p-3 text-xs text-ink2">쌍둥이 문제가 아직 없습니다. (AI 쌍둥이 생성은 2차 개발)</div>}
                        <div className="mb-2 mt-4 text-xs font-bold text-amber">● 유사 문제 (같은 유형)</div>
                        {similarList.map(p => (
                          <CandidateCard key={p.id} p={p}
                            onAdd={() => addItem(p, twinTarget.id)}
                            onSwap={() => swapItem(twinTarget, p)}
                            myDb={myDbIds.has(p.id)}
                            fav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} />
                        ))}
                        {similarList.length === 0 &&
                          <div className="rounded-lg border border-dashed border-line p-3 text-xs text-ink2">유사 문제가 없습니다.</div>}
                      </div>
                    )
                )}

                {leftTab === 'mine' && (
                  <div>
                    {/* 서브탭: 즐겨찾는 문제 / 나의DB (매쓰플랫 동일) */}
                    <div className="mb-3 flex gap-1 rounded-full border border-line bg-paper2/60 p-1 text-xs font-bold">
                      {([['fav', '즐겨찾는 문제'], ['db', '나의DB']] as const).map(([k, label]) => (
                        <button key={k} onClick={() => setMineTab(k)}
                          className={`grow rounded-full px-3 py-1.5 ${mineTab === k ? 'bg-white text-pine-dark shadow-sm' : 'text-ink2'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {mineTab === 'fav' && (
                      <>
                        <div className="mb-3 text-sm text-ink2">즐겨찾는 문제 {favoriteProblems.length}개</div>
                        {favoriteProblems.map(p => (
                          <CandidateCard key={p.id} p={p} onAdd={() => addItem(p)} added={usedIds.has(p.id)}
                            myDb={myDbIds.has(p.id)} fav onFav={() => toggleFavorite(p.id)} />
                        ))}
                        {favoriteProblems.length === 0 && <Empty text="즐겨찾기에 추가된 문제가 없습니다. 문제 카드의 ☆를 눌러 저장하세요." />}
                      </>
                    )}
                    {mineTab === 'db' && (
                      <>
                        <div className="mb-3 text-sm text-ink2">나의 DB 문제 {customProblems.length}개</div>
                        {customProblems.map(p => (
                          <CandidateCard key={p.id} p={p} onAdd={() => addItem(p)} added={usedIds.has(p.id)}
                            myDb fav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} />
                        ))}
                        {customProblems.length === 0 && <Empty text="나의 DB에 업로드한 문제가 없습니다. (학습지 > 나의 DB에서 등록)" />}
                      </>
                    )}
                  </div>
                )}

                {leftTab === 'concept' && (
                  <div>
                    <div className="mb-3 text-sm text-ink2">
                      개념 배치는 개념 추가 후 다음 단계에서 정하실 수 있습니다. (범위 내 {rangeConcepts.length}개)
                    </div>
                    <div className="mb-3 flex items-center gap-4 text-sm">
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input type="radio" checked={conceptMode === 'type'} onChange={() => setConceptMode('type')} className="accent-pine" />
                        유형별 개념
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input type="radio" checked={conceptMode === 'sub'} onChange={() => setConceptMode('sub')} className="accent-pine" />
                        소단원별 개념
                      </label>
                      <div className="grow" />
                      <button onClick={() => setConceptIds(new Set(rangeConcepts.map(c => c.id)))}
                        className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper">전체 추가</button>
                    </div>
                    {rangeConcepts.map(c => {
                      const on = conceptIds.has(c.id)
                      // 연관된 문제: 이 개념의 소단원에 속한 문항 번호
                      const related = items
                        .map((p, i) => ({ i, sub: typeSubUnitId(p.typeId) }))
                        .filter(x => x.sub === c.subId)
                        .map(x => x.i + 1)
                      // 유형별 보기: 연관 유형명을 부제로 병기
                      const relTypes = conceptMode === 'type'
                        ? [...new Set(items.filter(p => typeSubUnitId(p.typeId) === c.subId).map(p => typeName(p.typeId)))]
                        : []
                      return (
                        <div key={c.id} className={`mb-2 rounded-xl border p-3 ${on ? 'border-pine bg-pine-soft/30' : 'border-line'}`}>
                          <div className="mb-1 flex items-center gap-2">
                            <b className="text-sm text-pine-dark">{c.title}</b>
                            <button onClick={() => alert('개념 오류 신고가 접수되었습니다. 확인 후 반영합니다.')}
                              title="오류 신고" className="text-xs text-line hover:text-clay">🔔</button>
                            <div className="grow" />
                            <button onClick={() => toggleConcept(c.id)}
                              className={`rounded px-2 py-0.5 text-xs font-bold ${on ? 'border border-line text-ink2' : 'bg-pine text-paper'}`}>
                              {on ? '뺐다 담기' : '+ 개념 추가'}
                            </button>
                          </div>
                          {conceptMode === 'type' && relTypes.length > 0 && (
                            <div className="mb-1 text-[11px] text-ink2">연관 유형: {relTypes.join(' · ')}</div>
                          )}
                          {c.lines.map((l, li) => (
                            <div key={li} className="text-[12px] leading-relaxed text-ink2">· <MathText text={l} /></div>
                          ))}
                          {related.length > 0 && (
                            <div className="mt-1.5 text-[11px] font-semibold text-blue-600">
                              연관된 문제 보기 [{related.join(', ')} 번]
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {rangeConcepts.length === 0 && <Empty text="이 범위에 등록된 개념이 없습니다." />}
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 선택한 문제 목록 (드래그로 순서 변경 · 좌측 후보를 끌어다 놓으면 추가) */}
            <div className="grid h-fit gap-3"
              onDragOver={e => { if (dragNewId) e.preventDefault() }}
              onDrop={() => {
                if (!dragNewId) return
                const p = problems.find(x => x.id === dragNewId)
                setDragNewId(null)
                if (p) addItem(p)
              }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold">선택한 문제 목록</span>
                <button onClick={() => setMathGuideOpen(true)}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink2 hover:bg-paper2">? 수식 가이드</button>
                <div className="grow" />
                <select value={sortMode} onChange={e => applySort(e.target.value as SortMode)}
                  title="모든 단원의 정렬 순서가 변경됩니다."
                  className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
                  <option value="curriculum">유형 오름차순</option>
                  <option value="diffAsc">난이도 오름차순</option>
                  <option value="diffDesc">난이도 내림차순</option>
                  <option value="objFirst">객관식 상단배치</option>
                  <option value="shuffle">무작위</option>
                  <option value="probOrder">문제 순 정렬</option>
                  <option value="user">사용자 정렬</option>
                </select>
                <select value={viewMode} onChange={e => setViewMode(e.target.value as ViewMode)}
                  title="편집 단계에서만 적용되는 보기 옵션입니다."
                  className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
                  <option value="problem">문제만 보기</option>
                  <option value="answer">문제 + 정답</option>
                  <option value="full">문제 + 해설 + 정답</option>
                </select>
              </div>
              <div className="-mt-2 text-right text-[11px] text-ink2">
                정렬: 모든 단원의 정렬 순서가 변경됩니다 · 보기: 편집 단계에서만 적용되는 보기 옵션입니다
              </div>
              {items.map((p, i) => (
                <div key={p.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.stopPropagation(); dropOn(i) }}
                  onDragEnd={() => setDragIdx(null)}
                  className={`rounded-2xl border bg-white p-5 transition ${
                    dragIdx === i ? 'opacity-40' : ''
                  } ${twinTarget?.id === p.id ? 'border-pine' : 'border-line'}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="cursor-grab select-none text-line" title="드래그해서 순서 변경">⠿</span>
                    <span className="text-base font-black text-pine-dark">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`rounded px-1.5 py-0.5 font-bold ${DIFF_COLOR[p.diff]}`}>{DIFF_LABEL[p.diff]}</span>
                    <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">{p.kind}</span>
                    <span className="text-ink2">{typeName(p.typeId)}</span>
                    {p.isNew && <span className="rounded bg-clay/10 px-1.5 py-0.5 font-bold text-clay">신경향</span>}
                    {myDbIds.has(p.id) && <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-600">나의DB</span>}
                    {p.correctRate != null && <span className="text-ink2">정답률 {p.correctRate}%</span>}
                    <button onClick={() => reportProblem(p)} title="문제 오류 신고"
                      className="text-sm leading-none text-line hover:text-clay">🔔</button>
                    <button onClick={() => toggleFavorite(p.id)} title="즐겨찾기"
                      className={`text-base leading-none ${favorites.includes(p.id) ? 'text-amber' : 'text-line hover:text-amber'}`}>★</button>
                    <div className="grow" />
                    <button onClick={() => moveItem(i, -1)} className="rounded border border-line px-2 py-1 hover:bg-paper2">↑</button>
                    <button onClick={() => moveItem(i, 1)} className="rounded border border-line px-2 py-1 hover:bg-paper2">↓</button>
                    <button onClick={() => { setTwinTarget(p); setLeftTab('twin') }}
                      className="rounded border border-pine px-2 py-1 font-semibold text-pine hover:bg-pine-soft">쌍둥이·유사</button>
                    <button onClick={() => removeItem(p.id)} className="rounded border border-line px-2 py-1 text-ink2 hover:border-clay hover:text-clay">삭제</button>
                  </div>
                  <ProblemContent p={p} imgClass="w-full max-w-[465px]" />
                  {viewMode !== 'problem' && (
                    <div className="mt-3 rounded-xl bg-paper2/70 p-3 text-[13px]">
                      <div className="flex items-start gap-2">
                        <b className="shrink-0 text-pine-dark">정답</b>
                        {isImageUrl(p.answer) ? <img src={p.answer} alt="" className="max-w-[120px]" /> : <MathText text={p.answer} />}
                      </div>
                      {viewMode === 'full' && (
                        <div className="mt-1.5 flex items-start gap-2 border-t border-line/60 pt-1.5">
                          <b className="shrink-0 text-ink2">해설</b>
                          {isImageUrl(p.solution) ? <img src={p.solution} alt="" className="w-full max-w-[400px]" /> : <MathText text={p.solution} />}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold">
                학습지명
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="예: 중1-1 소인수분해 단원 TEST"
                  className="rounded-lg border border-line px-3 py-2.5 font-normal outline-none focus:border-pine" />
              </label>
              <label className="grid gap-1.5 text-sm font-bold">
                출제자
                <input value={author} onChange={e => setAuthor(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2.5 font-normal outline-none focus:border-pine" />
              </label>
              <label className="grid gap-1.5 text-sm font-bold">
                학년 선택
                <select value={gradeValue} onChange={e => setWsGrade(e.target.value)}
                  className="rounded-lg border border-line bg-white px-3 py-2.5 font-normal outline-none focus:border-pine">
                  {[...new Set([...CURRICULA.map(c => c.grade), gradeValue])].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-1.5 text-sm font-bold">
              <div className="flex flex-wrap items-center gap-2">
                학습지 디자인 템플릿
                {/* [직접 선택▾] — 저장해둔 사용자 템플릿 적용 */}
                <select value="" onChange={e => {
                  const t = sheetTemplates.find(x => x.id === e.target.value)
                  if (t) { setOpts({ ...DEFAULT_SHEET_OPTIONS, ...t.opts }); setTheme(t.theme) }
                }} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-normal">
                  <option value="" disabled>직접 선택 ▾ {sheetTemplates.length ? `(${sheetTemplates.length})` : '(저장된 템플릿 없음)'}</option>
                  {sheetTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={() => {
                  const name = prompt('현재 디자인(배치·간격·표기·색상)을 템플릿으로 저장합니다.\n템플릿 이름')
                  if (name?.trim()) { addSheetTemplate({ name: name.trim(), opts, theme }); alert('템플릿을 저장했습니다.') }
                }} className="rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">+ 템플릿 추가</button>
                {sheetTemplates.length > 0 && (
                  <button onClick={() => {
                    const name = prompt(`삭제할 템플릿 이름을 입력하세요:\n${sheetTemplates.map(t => `· ${t.name}`).join('\n')}`)
                    const t = sheetTemplates.find(x => x.name === name?.trim())
                    if (t && confirm(`"${t.name}" 템플릿을 삭제할까요?`)) removeSheetTemplate(t.id)
                  }} className="text-xs font-normal text-ink2 hover:text-clay">템플릿 삭제</button>
                )}
              </div>
              기본 폼 <span className="font-normal text-ink2">— 자주 쓰는 배치를 한 번에</span>
              <div className="flex flex-wrap gap-2 font-normal">
                {SHEET_TEMPLATES.map(t => {
                  const on = activeTemplateKey(opts) === t.key
                  return (
                    <button key={t.key} onClick={() => setOpts(o => ({ ...o, ...t.patch }))}
                      className={`flex w-[140px] items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-pine bg-pine-soft' : 'border-line hover:border-pine/50 hover:bg-paper2'}`}>
                      <span className={`text-lg leading-none ${on ? 'text-pine' : 'text-ink2'}`}>{t.icon}</span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold ${on ? 'text-pine-dark' : 'text-ink'}`}>{t.name}</span>
                        <span className="block text-[11px] leading-tight text-ink2">{t.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-1.5 text-sm font-bold">
              태그
              <div className="flex flex-wrap gap-2 font-normal">
                {[...TAG_PRESETS, ...EXTRA_TAGS].map(t => (
                  <button key={t}
                    onClick={() => setTags(prev => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n })}
                    className={`rounded-full border px-3 py-1 text-sm ${tags.has(t) ? 'border-pine bg-pine-soft font-semibold text-pine-dark' : 'border-line text-ink2'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5 text-sm font-bold">
              표지 색상
              <div className="flex gap-3 font-normal">
                {(Object.keys(THEMES) as ThemeKey[]).map(k => (
                  <button key={k} onClick={() => setTheme(k)} title={THEMES[k].name}
                    className={`h-9 w-9 rounded-full border-2 ${theme === k ? 'border-ink' : 'border-transparent'}`}
                    style={{ background: THEMES[k].main }} />
                ))}
              </div>
            </div>

            <div className="grid gap-1.5 text-sm font-bold">
              분할 선택
              <div className="flex gap-2 font-normal">
                {(Object.keys(LAYOUT_LABEL) as LayoutMode[]).map(l => (
                  <button key={l} onClick={() => setOpts(o => ({ ...o, layout: l }))}
                    className={`rounded-lg border px-4 py-2 text-sm ${opts.layout === l ? 'border-pine bg-pine-soft font-semibold text-pine-dark' : 'border-line text-ink2'}`}>
                    {LAYOUT_LABEL[l]}
                  </button>
                ))}
              </div>
              <span className="text-xs font-normal text-ink2">기본=2단 흘림 배치 · 2/4/6분할=문제마다 고정 칸(풀이 공간 확보)</span>
            </div>

            <label className="grid gap-1.5 text-sm font-bold">
              문제 간격 <span className="font-normal text-ink2">(좁게 ~ 넓게)</span>
              <input type="range" min={1} max={5} value={opts.spacing}
                onChange={e => setOpts(o => ({ ...o, spacing: Number(e.target.value) as SheetOptions['spacing'] }))}
                className="w-64 accent-pine" />
            </label>

            <div className="grid gap-2 text-sm">
              <div className="font-bold">제목 영역 옵션</div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={opts.showDate}
                  onChange={e => setOpts(o => ({ ...o, showDate: e.target.checked }))} className="h-4 w-4 accent-pine" />
                날짜 표시
              </label>
              {opts.showDate && (
                <div className="ml-6 flex items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={opts.customDate === null}
                      onChange={() => setOpts(o => ({ ...o, customDate: null }))} className="accent-pine" />
                    오늘/생성일
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={opts.customDate !== null}
                      onChange={() => setOpts(o => ({ ...o, customDate: new Date().toISOString().slice(0, 10) }))} className="accent-pine" />
                    직접 선택
                  </label>
                  {opts.customDate !== null && (
                    <input type="date" value={opts.customDate}
                      onChange={e => setOpts(o => ({ ...o, customDate: e.target.value }))}
                      className="rounded border border-line px-2 py-1" />
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2 text-sm">
              <div className="font-bold">문제 영역 옵션</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.showTypeName}
                    onChange={e => setOpts(o => ({ ...o, showTypeName: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  유형명 표시
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.showDiff}
                    onChange={e => setOpts(o => ({ ...o, showDiff: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  난이도 표시
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.showCorrectRate}
                    onChange={e => setOpts(o => ({ ...o, showCorrectRate: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  정답률 표시 <span className="text-xs text-ink2">(데이터 있을 때)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.showNew}
                    onChange={e => setOpts(o => ({ ...o, showNew: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  신경향 라벨
                </label>
                <label className="flex items-center gap-2" title="같은 쌍둥이 그룹(연관) 문항의 번호를 문제 캡션에 표시합니다">
                  <input type="checkbox" checked={opts.showRelated ?? false}
                    onChange={e => setOpts(o => ({ ...o, showRelated: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  연관 문항 정보 <span className="text-xs text-ink2">ⓘ</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.wrongNoteArea}
                    onChange={e => setOpts(o => ({ ...o, wrongNoteArea: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  오답 노트 영역 추가 <span className="text-xs text-ink2">('기본' 분할 적용)</span>
                </label>
              </div>
            </div>

            {conceptIds.size > 0 && (
              <div className="grid gap-2 text-sm">
                <div className="font-bold">개념 배치 <span className="font-normal text-ink2">— 담은 개념 {conceptIds.size}개</span></div>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="radio" checked={(opts.conceptPlacement ?? 'front') === 'front'}
                      onChange={() => setOpts(o => ({ ...o, conceptPlacement: 'front' }))} className="accent-pine" />
                    학습지 맨 앞
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="radio" checked={opts.conceptPlacement === 'unit'}
                      onChange={() => setOpts(o => ({ ...o, conceptPlacement: 'unit' }))} className="accent-pine" />
                    각 단원 앞
                  </label>
                </div>
              </div>
            )}

            <div className="grid gap-2 text-sm">
              <div className="font-bold">해설지 옵션</div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={opts.solutionWithBody}
                  onChange={e => setOpts(o => ({ ...o, solutionWithBody: e.target.checked }))} className="h-4 w-4 accent-pine" />
                해설지에 문제 포함
              </label>
            </div>

          </div>

          {/* 실물 미리보기 (매쓰플랫 방식: A4 1페이지 축소 렌더) */}
          <div className="h-fit rounded-2xl border border-line bg-white p-6">
            <div className="mb-3 text-sm">
              <span className="font-bold text-ink">학습지 미리보기</span>
              <span className="text-ink2"> — 미리보기 화면은 실제 학습지와 약간의 차이가 있습니다.</span>
            </div>
            <div className="relative aspect-[210/297] overflow-hidden rounded-md border border-line bg-white shadow-md">
              <div className="w-[182%] origin-top-left scale-[0.55] px-[11mm] py-[12mm]">
                <SheetHeader
                  ws={{ grade: gradeValue, title: title.trim() || '학습지 제목', author: author.trim() || '출제자' }}
                  subtitle={previewSubtitle} dateText={previewDateText}
                  count={items.length} theme={THEMES[theme].main} />
                {opts.layout === 'basic' ? (
                  opts.wrongNoteArea ? (
                    /* 기본 + 오답 노트: 좌 문제 · 우 '풀이' 공간(괘선) */
                    <div className="mt-6">
                      {previewItems.map((p, i) => (
                        <div key={p.id} className="grid grid-cols-[1fr_46%] gap-x-6"
                          style={{ marginBottom: `${previewSpacingMm}mm` }}>
                          <ProblemBlock p={p} idx={i} caption={previewCaption(p)} themeMain={THEMES[theme].main} />
                          <div className="min-h-[40mm]">
                            <div className="border-t border-ink pt-1 text-[9pt] font-bold text-[#777777]">풀이</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* 기본: 2단 흐름 배치 */
                    <div className="sheet-cols mt-6">
                      {previewItems.map((p, i) => (
                        <div key={p.id} className="sheet-problem" style={{ marginBottom: `${previewSpacingMm}mm` }}>
                          <ProblemBlock p={p} idx={i} caption={previewCaption(p)} themeMain={THEMES[theme].main} />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* 2·4·6분할: 문제마다 고정 칸 (6분할은 폰트 축소) */
                  <div className={`mt-6 gap-x-8 ${opts.layout === 'split2' ? 'grid grid-cols-1' : 'grid grid-cols-2'} ${opts.layout === 'split6' ? 'text-[92%]' : ''}`}
                    style={{ rowGap: `${previewSpacingMm}mm` }}>
                    {previewItems.map((p, i) => (
                      <div key={p.id}
                        className={`border-b border-dotted border-line pb-3 ${
                          opts.layout === 'split2' ? 'min-h-[120mm]' : opts.layout === 'split4' ? 'min-h-[105mm]' : 'min-h-[72mm]'}`}>
                        <ProblemBlock p={p} idx={i} caption={previewCaption(p)} themeMain={THEMES[theme].main} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold text-ink2">01</div>
            </div>
          </div>
        </div>
      )}

      {/* 하단 고정 바: 문제 수·유형 수 + 단계 이동 (매쓰플랫 방식) */}
      {(step > 1 || srcTab === 'chapter') && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3">
            <div className="text-sm">
              학습지 문제 수 <b className="text-pine-dark">{step === 1 ? Math.min(count, availableCount) : items.length}</b> 개
              {' | '}유형 <b>{step === 1 ? selected.size : new Set(items.map(p => p.typeId)).size}</b>개
            </div>
            {step === 1 && availableCount < count && selected.size > 0 && (
              <span className="text-xs text-clay">범위 내 문제가 {availableCount}개뿐이라 그만큼만 담깁니다.</span>
            )}
            <div className="grow" />
            {step === 2 && !editing && (
              <button onClick={() => {
                if (items.length > 0 && !confirm('편집 내용이 초기화됩니다. 범위 선택으로 돌아갈까요?')) return
                setStep(1)
              }} className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-paper2">← 이전</button>
            )}
            {step === 3 && (
              <button onClick={() => setStep(2)}
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-paper2">← 이전</button>
            )}
            {step === 1 && (
              <button disabled={selected.size === 0} onClick={goStep2}
                className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper transition enabled:hover:bg-pine-dark disabled:opacity-40">
                다음 단계 →
              </button>
            )}
            {step === 2 && (
              <button disabled={items.length === 0} onClick={goStep3}
                className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper transition enabled:hover:bg-pine-dark disabled:opacity-40">
                다음 단계 →
              </button>
            )}
            {step === 3 && (
              <button onClick={save}
                className="rounded-lg bg-amber px-6 py-2.5 text-sm font-bold text-white hover:brightness-105">
                {editing ? '수정 저장하기' : '학습지 만들기'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 난이도 비율 매트릭스 모달 */}
      {matrixOpen && (
        <MatrixModal matrix={diffMatrix}
          onClose={() => setMatrixOpen(false)}
          onSave={m => { setDiffMatrix(m); setMatrixOpen(false) }} />
      )}

      {/* "내가 찾는 단원이 어디있지?" — 단원·유형 검색 */}
      {unitSearchOpen && (
        <UnitSearchModal cur={cur} onClose={() => setUnitSearchOpen(false)}
          onPick={(unitId, targetId) => {
            setExpanded(prev => new Set([...prev, unitId]))
            setTreeTarget(targetId)
            setUnitSearchOpen(false)
          }} />
      )}

      {/* [? 수식 가이드] */}
      {mathGuideOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={() => setMathGuideOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 font-bold">수식 입력 가이드</h3>
            <p className="mb-3 text-sm text-ink2">직접 입력·일괄 등록에서 수식은 <b>$…$</b> 사이에 LaTeX로 적으면 그대로 렌더링됩니다.</p>
            <table className="w-full text-sm">
              <tbody>
                {[['분수', '$\\dfrac{a}{b}$'], ['거듭제곱', '$x^{2}$'], ['제곱근', '$\\sqrt{2}$'], ['부등호', '$\\le, \\ge, \\ne$'], ['조합·순열', '$_{n}\\mathrm{C}_{r}, \\ _{n}\\mathrm{P}_{r}$ (한국 교과서식)'], ['원주율·무한', '$\\pi, \\infty$']].map(([k, v]) => (
                  <tr key={k} className="border-b border-line/50">
                    <td className="py-1.5 font-semibold">{k}</td>
                    <td className="py-1.5"><code className="rounded bg-paper2 px-1.5 py-0.5 text-xs">{v}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right">
              <button onClick={() => setMathGuideOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// "내가 찾는 단원이 어디있지?" — 현재 과정의 단원·유형 이름 검색 → 트리 펼침·대상 지정
function UnitSearchModal({ cur, onClose, onPick }: {
  cur: ReturnType<typeof curriculumFor>
  onClose: () => void
  onPick: (unitId: string, targetId: string) => void
}) {
  const [kw, setKw] = useState('')
  const results = useMemo(() => {
    const k = kw.trim()
    if (!k) return []
    const out: { unitId: string; targetId: string; path: string }[] = []
    for (const u of cur.units) {
      if (u.name.includes(k)) out.push({ unitId: u.id, targetId: u.id, path: u.name })
      for (const m of u.mids) {
        if (m.name.includes(k) && m.name !== u.name) out.push({ unitId: u.id, targetId: m.id, path: `${u.name} › ${m.name}` })
        for (const s of m.subs) {
          if (s.name.includes(k) && s.name !== m.name) out.push({ unitId: u.id, targetId: s.id, path: `${u.name} › ${s.name}` })
          for (const t of s.types)
            if (t.name.includes(k)) out.push({ unitId: u.id, targetId: s.id, path: `${u.name} › ${s.name} › ${t.name}` })
        }
      }
    }
    return out.slice(0, 30)
  }, [cur, kw])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 font-bold">내가 찾는 단원이 어디있지?</h3>
        <p className="mb-3 text-sm text-ink2">단원·유형 이름으로 검색하면 트리에서 바로 열어드립니다. (현재 과정: {cur.label})</p>
        <input autoFocus value={kw} onChange={e => setKw(e.target.value)} placeholder="예: 소인수분해, 일차방정식 활용"
          className="mb-3 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-pine" />
        <div className="max-h-72 overflow-y-auto">
          {kw.trim() && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">검색 결과가 없습니다.</div>
          )}
          {results.map((r, i) => (
            <button key={i} onClick={() => onPick(r.unitId, r.targetId)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-pine-soft/50">
              {r.path}
            </button>
          ))}
        </div>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">닫기</button>
        </div>
      </div>
    </div>
  )
}

function CandidateCard({ p, onAdd, onSwap, added, fav, onFav, myDb, onDragStart, onDragEnd }: {
  p: Problem; onAdd: () => void; onSwap?: () => void; added?: boolean; fav?: boolean; onFav?: () => void
  myDb?: boolean; onDragStart?: () => void; onDragEnd?: () => void
}) {
  return (
    <div className="mb-2 rounded-xl border border-line p-3"
      draggable={!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={onDragStart ? { cursor: 'grab' } : undefined}>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 font-bold ${DIFF_COLOR[p.diff]}`}>{DIFF_LABEL[p.diff]}</span>
        <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">{p.kind}</span>
        <span className="text-ink2">{typeName(p.typeId)}</span>
        {myDb && <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-600">나의DB</span>}
        {onFav && (
          <button onClick={onFav} className={`text-sm leading-none ${fav ? 'text-amber' : 'text-line hover:text-amber'}`}>★</button>
        )}
        <div className="grow" />
        {onSwap && <button onClick={onSwap} className="rounded border border-line px-2 py-0.5 text-ink2 hover:border-pine hover:text-pine">교체</button>}
        <button onClick={onAdd} disabled={added}
          className="rounded bg-pine px-2 py-0.5 font-bold text-paper disabled:opacity-40">{added ? '담김' : '+ 추가'}</button>
      </div>
      <ProblemContent p={p} textClass="text-[13px] leading-relaxed" imgClass="w-full max-w-[400px]" />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">{text}</div>
}

// tri-state 체크 상태: 전체/일부/없음
type CheckState = 'all' | 'some' | 'none'
function checkStateOf(ids: string[], selected: Set<string>): CheckState {
  let n = 0
  for (const id of ids) if (selected.has(id)) n++
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}

// tri-state 체크박스 (일부 선택 시 indeterminate 표시)
function TriCheck({ state, onChange, size }: {
  state: CheckState; onChange: (on: boolean) => void; size?: string
}) {
  return (
    <input type="checkbox" checked={state === 'all'}
      ref={el => { if (el) el.indeterminate = state === 'some' }}
      onChange={e => onChange(e.target.checked)}
      className={`${size ?? 'h-4 w-4'} shrink-0 accent-pine`} />
  )
}

function MatrixModal({ matrix, onClose, onSave }: {
  matrix: DiffMatrix; onClose: () => void; onSave: (m: DiffMatrix) => void
}) {
  const [m, setM] = useState<DiffMatrix>(JSON.parse(JSON.stringify(matrix)) as DiffMatrix)
  const rows: Diff[] = [5, 4, 3, 2, 1]

  function setCell(row: Diff, col: number, val: number) {
    setM(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as DiffMatrix
      next[row][col] = Math.max(0, Math.min(100, val))
      return next
    })
  }
  const rowSum = (row: Diff) => m[row].reduce((a, b) => a + b, 0)
  const valid = rows.every(r => rowSum(r) === 100)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold">난이도 비율 선택</h3>
        <p className="mb-4 text-sm text-ink2">난이도 별 출제 비율의 합이 각 행마다 100이 되어야 합니다.</p>
        <table className="w-full text-center text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink2">
              <th className="py-2 text-left">선택 난이도</th>
              {DIFFS.map(d => <th key={d}>{DIFF_LABEL[d]}</th>)}
              <th>총합</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r} className="border-b border-line/50">
                <td className="py-2 text-left font-bold">{DIFF_LABEL[r]} 선택 시</td>
                {DIFFS.map((_, ci) => (
                  <td key={ci} className="px-1 py-2">
                    <input type="number" min={0} max={100} value={m[r][ci]}
                      onChange={e => setCell(r, ci, Number(e.target.value) || 0)}
                      className="w-14 rounded border border-line px-1 py-1.5 text-center" />
                  </td>
                ))}
                <td className={`font-bold ${rowSum(r) === 100 ? 'text-pine-dark' : 'text-clay'}`}>{rowSum(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 flex justify-between">
          <button onClick={() => setM(JSON.parse(JSON.stringify(DEFAULT_DIFF_MATRIX)) as DiffMatrix)}
            className="rounded-lg border border-line px-4 py-2 text-sm">기본값 복원</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">취소</button>
            <button onClick={() => onSave(m)} disabled={!valid}
              className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">저장하기</button>
          </div>
        </div>
      </div>
    </div>
  )
}
