import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CURRICULA, curriculumFor, typeName, typeSubUnitId, typeUnitName } from '../data/curriculum'
import { conceptsForSubUnits } from '../data/concepts'
import { pickProblems, twinProblems, similarProblems } from '../lib/select'
import { useStore, uid } from '../lib/store'
import MathText from '../components/MathText'
import ProblemContent from '../components/ProblemContent'
import { ProblemBlock, SheetHeader } from './WorksheetView'
import type { Diff, DiffMatrix, Kind, LayoutMode, Problem, SheetOptions, ThemeKey } from '../types'
import {
  DEFAULT_DIFF_MATRIX, DEFAULT_SHEET_OPTIONS, DIFFS, DIFF_COLOR, DIFF_LABEL,
  LAYOUT_LABEL, TAG_PRESETS, THEMES,
} from '../types'

type KindFilter = 'all' | Kind
type LeftTab = 'summary' | 'add' | 'twin' | 'mine' | 'concept'
type SortMode = 'curriculum' | 'diffAsc' | 'diffDesc' | 'shuffle'
type SrcTab = 'chapter' | 'workbook' | 'csat' | 'signature' | 'school' | 'upload'
type MockFilter = 'include' | 'exclude' | 'only'

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
// 학기 칩 라벨: 초중 「1 - 1(22개정)」 · 고 「공통수학1(22개정)」
function semesterChipLabel(grade: string, label: string): string {
  const m = grade.match(/^[초중](\d)-(\d)$/)
  return m ? `${m[1]} - ${m[2]}(22개정)` : label.replace(' (22개정)', '(22개정)')
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
  const { problems, saveWorksheet, updateWorksheet, worksheets, favorites, toggleFavorite, diffMatrix, setDiffMatrix, assignments } = store
  const nav = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const editing = worksheets.find(w => w.id === editId) ?? null

  const [step, setStep] = useState<1 | 2 | 3>(editing ? 2 : 1)

  // STEP 1
  const [srcTab, setSrcTab] = useState<SrcTab>('chapter')
  const [gradeId, setGradeId] = useState('m1-1')
  const cur = curriculumFor(gradeId)
  useEffect(() => { store.ensureCourse(gradeId) }, [gradeId])   // 과정 문제 풀 지연 로드
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(50)
  const [diffFocus, setDiffFocus] = useState<Diff>(3)
  const [kind, setKind] = useState<KindFilter>('all')
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [excludeRecent, setExcludeRecent] = useState(false)  // 최근 30일 출제 문제 제외
  const [evenTypes, setEvenTypes] = useState(false)          // 유형별 균등 배분
  const [mockFilter, setMockFilter] = useState<MockFilter>('include')  // 모의고사 포함 여부
  const [expanded, setExpanded] = useState<Set<string>>(new Set())     // 좌측 트리에서 펼친 대단원 (기본 전부 접힘)
  const [treeTarget, setTreeTarget] = useState<string | null>(null)    // 우측 유형 패널 대상 노드(대·중·소단원 id)

  // STEP 2
  const [items, setItems] = useState<Problem[]>([])
  const [conceptIds, setConceptIds] = useState<Set<string>>(new Set())
  const [leftTab, setLeftTab] = useState<LeftTab>('summary')
  const [twinTarget, setTwinTarget] = useState<Problem | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('curriculum')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [problemOnly, setProblemOnly] = useState(false)      // 문제만 보기 (유형명·버튼 숨김)

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
    return arr
  }, [pool, excludeRecent, recentProblemIds, mockFilter])
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
    setItems(picked)
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
    setItems(prev => {
      const next = [...prev]
      if (mode === 'curriculum') next.sort((a, b) => {
        const ta = typeOrder.indexOf(a.typeId), tb = typeOrder.indexOf(b.typeId)
        return ta !== tb ? ta - tb : a.diff - b.diff
      })
      else if (mode === 'diffAsc') next.sort((a, b) => a.diff - b.diff)
      else if (mode === 'diffDesc') next.sort((a, b) => b.diff - a.diff)
      else for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]
      }
      return next
    })
  }

  function removeItem(id: string) { setItems(prev => prev.filter(p => p.id !== id)) }
  function moveItem(idx: number, dir: -1 | 1) {
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
    if (dragIdx === null || dragIdx === target) { setDragIdx(null); return }
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

  // 새 문제 추가 후보: 선택 범위 내, 미사용
  const candidates = useMemo(
    () => pool.filter(p => !usedIds.has(p.id)),
    [pool, usedIds],
  )
  const favoriteProblems = useMemo(
    () => problems.filter(p => favorites.includes(p.id)),
    [problems, favorites],
  )

  // STEP3 실물 미리보기 파생값 (WorksheetView 지면 규칙과 동일하게 계산)
  const previewSpacingMm = [0, 3, 5, 7, 9, 12][opts.spacing]
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
    return parts.join(' · ')
  }
  // 첫 페이지 분량만 (기본 5 · 오답노트 3 · 2분할 2 · 4분할 4 · 6분할 6)
  const previewItems = items.slice(0,
    opts.layout === 'basic' ? (opts.wrongNoteArea ? 3 : 5)
    : opts.layout === 'split2' ? 2
    : opts.layout === 'split4' ? 4 : 6)

  return (
    <div className="pb-24">
      {/* 단계 표시 */}
      <div className="mb-8 flex items-center gap-3 text-sm">
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
              {/* 학교급 칩 + 전체 선택/해제 */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1 rounded-lg bg-paper2 p-1">
                  {SCHOOL_LEVELS.map(lv => (
                    <button key={lv.prefix}
                      onClick={() => {
                        if (gradeId.startsWith(lv.prefix)) return
                        const first = CURRICULA.find(c => c.id.startsWith(lv.prefix))
                        if (first) { setGradeId(first.id); setSelected(new Set()); setExpanded(new Set()); setTreeTarget(null) }
                      }}
                      className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${
                        gradeId.startsWith(lv.prefix) ? 'bg-pine text-paper' : 'text-ink2 hover:text-ink'
                      }`}>
                      {lv.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => toggleMany(typeOrder, true)} className="rounded border border-line px-2 py-1 hover:bg-paper2">전체 선택</button>
                  <button onClick={() => toggleMany(typeOrder, false)} className="rounded border border-line px-2 py-1 hover:bg-paper2">전체 해제</button>
                </div>
              </div>
              {/* 학기·과목 칩 (가로 스크롤) */}
              <div className="flex gap-2 overflow-x-auto border-b border-line pb-3">
                {CURRICULA.filter(c => c.id.startsWith(gradeId[0])).map(c => (
                  <button key={c.id}
                    onClick={() => { if (c.id !== gradeId) { setGradeId(c.id); setSelected(new Set()); setExpanded(new Set()); setTreeTarget(null) } }}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
                      c.id === gradeId ? 'border-pine bg-pine-soft font-bold text-pine-dark' : 'border-line text-ink2 hover:text-ink'
                    }`}>
                    {semesterChipLabel(c.grade, c.label)}
                  </button>
                ))}
              </div>
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
              <div className="font-bold">출제 옵션</div>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={excludeRecent}
                  onChange={e => setExcludeRecent(e.target.checked)} className="h-4 w-4 accent-pine" />
                최근 30일 출제 문제 제외
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={evenTypes}
                  onChange={e => setEvenTypes(e.target.checked)} className="h-4 w-4 accent-pine" />
                유형별 균등 배분
              </label>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white px-6 py-4">
            <div className="text-sm">총 <b className="text-lg">{items.length}</b>문제</div>
            <div className="text-sm text-ink2">
              객관식 {items.filter(p => p.kind === '객관식').length} · 주관식 {items.filter(p => p.kind === '주관식').length}
            </div>
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
                        <th className="py-1.5">번호</th><th>타입</th><th>난이도</th><th>유형명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p, i) => (
                        <tr key={p.id} className="border-b border-line/50">
                          <td className="py-1.5 font-bold">{i + 1}</td>
                          <td>{p.kind}</td>
                          <td>{DIFF_LABEL[p.diff]}</td>
                          <td className="text-ink2">{typeName(p.typeId)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {leftTab === 'add' && (
                  <div>
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="text-ink2">범위 내 후보 {candidates.length}개</span>
                      <button
                        onClick={() => candidates.forEach(p => addItem(p))}
                        className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper">+ 전체 추가</button>
                    </div>
                    {candidates.map(p => (
                      <CandidateCard key={p.id} p={p} onAdd={() => addItem(p)}
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
                        <div className="mb-3 text-sm font-bold">
                          {items.findIndex(x => x.id === twinTarget.id) + 1}번의 쌍둥이·유사 문제
                          <div className="font-normal text-ink2">{typeName(twinTarget.typeId)}</div>
                        </div>
                        <div className="mb-2 text-xs font-bold text-pine-dark">● 쌍둥이 문제 (같은 템플릿·숫자 변형)</div>
                        {twinProblems(problems, twinTarget, usedIds).map(p => (
                          <CandidateCard key={p.id} p={p}
                            onAdd={() => addItem(p, twinTarget.id)}
                            onSwap={() => swapItem(twinTarget, p)}
                            fav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} />
                        ))}
                        {twinProblems(problems, twinTarget, usedIds).length === 0 &&
                          <div className="mb-3 rounded-lg border border-dashed border-line p-3 text-xs text-ink2">쌍둥이 문제가 아직 없습니다. (AI 쌍둥이 생성은 2차 개발)</div>}
                        <div className="mb-2 mt-4 text-xs font-bold text-amber">● 유사 문제 (같은 유형)</div>
                        {similarProblems(problems, twinTarget, usedIds).map(p => (
                          <CandidateCard key={p.id} p={p}
                            onAdd={() => addItem(p, twinTarget.id)}
                            onSwap={() => swapItem(twinTarget, p)}
                            fav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} />
                        ))}
                        {similarProblems(problems, twinTarget, usedIds).length === 0 &&
                          <div className="rounded-lg border border-dashed border-line p-3 text-xs text-ink2">유사 문제가 없습니다.</div>}
                      </div>
                    )
                )}

                {leftTab === 'mine' && (
                  <div>
                    <div className="mb-3 text-sm text-ink2">즐겨찾는 문제 {favoriteProblems.length}개</div>
                    {favoriteProblems.map(p => (
                      <CandidateCard key={p.id} p={p} onAdd={() => addItem(p)} added={usedIds.has(p.id)}
                        fav onFav={() => toggleFavorite(p.id)} />
                    ))}
                    {favoriteProblems.length === 0 && <Empty text="즐겨찾기에 추가된 문제가 없습니다. 문제 카드의 ☆를 눌러 저장하세요." />}
                  </div>
                )}

                {leftTab === 'concept' && (
                  <div>
                    <div className="mb-3 text-sm text-ink2">
                      선택한 개념은 학습지 맨 앞에 「개념 정리」로 실립니다. (범위 내 {rangeConcepts.length}개)
                    </div>
                    {rangeConcepts.map(c => {
                      const on = conceptIds.has(c.id)
                      return (
                        <div key={c.id} className={`mb-2 rounded-xl border p-3 ${on ? 'border-pine bg-pine-soft/30' : 'border-line'}`}>
                          <div className="mb-1 flex items-center gap-2">
                            <b className="text-sm text-pine-dark">{c.title}</b>
                            <div className="grow" />
                            <button onClick={() => toggleConcept(c.id)}
                              className={`rounded px-2 py-0.5 text-xs font-bold ${on ? 'border border-line text-ink2' : 'bg-pine text-paper'}`}>
                              {on ? '뺐다 담기' : '+ 추가'}
                            </button>
                          </div>
                          {c.lines.map((l, li) => (
                            <div key={li} className="text-[12px] leading-relaxed text-ink2">· <MathText text={l} /></div>
                          ))}
                        </div>
                      )
                    })}
                    {rangeConcepts.length === 0 && <Empty text="이 범위에 등록된 개념이 없습니다." />}
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 선택한 문제 목록 (드래그로 순서 변경) */}
            <div className="grid h-fit gap-3">
              <div className="flex items-center gap-3">
                <select value={sortMode} onChange={e => applySort(e.target.value as SortMode)}
                  className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
                  <option value="curriculum">문제 유형 오름차순</option>
                  <option value="diffAsc">난이도 낮은순</option>
                  <option value="diffDesc">난이도 높은순</option>
                  <option value="shuffle">무작위 섞기</option>
                </select>
                <div className="grow" />
                <button onClick={() => setProblemOnly(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-ink2" title="유형명·버튼을 숨기고 문제 본문만 봅니다">
                  문제만 보기
                  <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${problemOnly ? 'justify-end bg-pine' : 'justify-start bg-line'}`}>
                    <span className="h-4 w-4 rounded-full bg-white" />
                  </span>
                </button>
              </div>
              {items.map((p, i) => (
                <div key={p.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => dropOn(i)}
                  onDragEnd={() => setDragIdx(null)}
                  className={`rounded-2xl border bg-white p-5 transition ${
                    dragIdx === i ? 'opacity-40' : ''
                  } ${twinTarget?.id === p.id ? 'border-pine' : 'border-line'}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="cursor-grab select-none text-line" title="드래그해서 순서 변경">⠿</span>
                    <span className="text-base font-black text-pine-dark">{String(i + 1).padStart(2, '0')}</span>
                    {!problemOnly && (
                      <>
                        <span className={`rounded px-1.5 py-0.5 font-bold ${DIFF_COLOR[p.diff]}`}>{DIFF_LABEL[p.diff]}</span>
                        <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">{p.kind}</span>
                        <span className="text-ink2">{typeName(p.typeId)}</span>
                        {p.isNew && <span className="rounded bg-clay/10 px-1.5 py-0.5 font-bold text-clay">신경향</span>}
                        {p.correctRate != null && <span className="text-ink2">정답률 {p.correctRate}%</span>}
                        <button onClick={() => toggleFavorite(p.id)} title="즐겨찾기"
                          className={`text-base leading-none ${favorites.includes(p.id) ? 'text-amber' : 'text-line hover:text-amber'}`}>★</button>
                        <div className="grow" />
                        <button onClick={() => moveItem(i, -1)} className="rounded border border-line px-2 py-1 hover:bg-paper2">↑</button>
                        <button onClick={() => moveItem(i, 1)} className="rounded border border-line px-2 py-1 hover:bg-paper2">↓</button>
                        <button onClick={() => { setTwinTarget(p); setLeftTab('twin') }}
                          className="rounded border border-pine px-2 py-1 font-semibold text-pine hover:bg-pine-soft">쌍둥이·유사</button>
                        <button onClick={() => removeItem(p.id)} className="rounded border border-line px-2 py-1 text-ink2 hover:border-clay hover:text-clay">삭제</button>
                      </>
                    )}
                  </div>
                  <ProblemContent p={p} imgClass="w-full max-w-[465px]" />
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
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.wrongNoteArea}
                    onChange={e => setOpts(o => ({ ...o, wrongNoteArea: e.target.checked }))} className="h-4 w-4 accent-pine" />
                  오답 노트 영역 추가 <span className="text-xs text-ink2">('기본' 분할 적용)</span>
                </label>
              </div>
            </div>

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
                        <div key={p.id} className="grid grid-cols-[1fr_42%] gap-x-6"
                          style={{ marginBottom: `${previewSpacingMm + 8}mm` }}>
                          <ProblemBlock p={p} idx={i} caption={previewCaption(p)} themeMain={THEMES[theme].main} />
                          <div className="min-h-[52mm]">
                            <div className="border-t border-ink/40 pt-1 text-[10px] text-ink2">풀이</div>
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
                  <div className={`mt-6 gap-x-8 ${opts.layout === 'split2' ? 'grid grid-cols-1' : 'grid grid-cols-2'} ${opts.layout === 'split6' ? 'text-[85%]' : ''}`}
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
    </div>
  )
}

function CandidateCard({ p, onAdd, onSwap, added, fav, onFav }: {
  p: Problem; onAdd: () => void; onSwap?: () => void; added?: boolean; fav?: boolean; onFav?: () => void
}) {
  return (
    <div className="mb-2 rounded-xl border border-line p-3">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 font-bold ${DIFF_COLOR[p.diff]}`}>{DIFF_LABEL[p.diff]}</span>
        <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">{p.kind}</span>
        <span className="text-ink2">{typeName(p.typeId)}</span>
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
