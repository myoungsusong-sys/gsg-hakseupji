import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { curriculumFor, typeName, typeSubUnitId } from '../data/curriculum'
import GradeSelect from '../components/GradeSelect'
import { conceptsForSubUnits } from '../data/concepts'
import { pickProblems, twinProblems, similarProblems } from '../lib/select'
import { useStore, uid } from '../lib/store'
import MathText from '../components/MathText'
import ProblemContent from '../components/ProblemContent'
import type { Diff, DiffMatrix, Kind, LayoutMode, Problem, SheetOptions, ThemeKey } from '../types'
import {
  DEFAULT_DIFF_MATRIX, DEFAULT_SHEET_OPTIONS, DIFFS, DIFF_COLOR, DIFF_LABEL,
  LAYOUT_LABEL, TAG_PRESETS, THEMES,
} from '../types'

type KindFilter = 'all' | Kind
type LeftTab = 'summary' | 'add' | 'twin' | 'mine' | 'concept'
type SortMode = 'curriculum' | 'diff' | 'shuffle'
type SrcTab = 'chapter' | 'workbook' | 'csat' | 'signature' | 'school' | 'upload'

const SRC_TABS: { key: SrcTab; label: string; note?: string }[] = [
  { key: 'chapter', label: '단원·유형별' },
  { key: 'workbook', label: '시중교재', note: '교재 페이지→유형 매핑 데이터 구축 후 활성화' },
  { key: 'csat', label: '수능/모의고사', note: 'EBSi·평가원 기출 변환 등록 후 활성화 (학년·연도·월 선택 → 회차 문항 선택 구조)' },
  { key: 'signature', label: '시그니처 교재', note: '자체 교재 등록 후 활성화' },
  { key: 'school', label: '학교별 기출', note: '학교 기출 DB 구축 후 활성화 (학교급·지역·학교·중간기말 필터 구조)' },
  { key: 'upload', label: '기출 업로드', note: 'PDF/이미지 업로드 → Claude가 문제·정답·해설 추출·유형 매칭(디지털 문제 변환) — 2차 개발' },
]

const COUNT_PRESETS = [25, 50, 75, 100]

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(50)
  const [diffFocus, setDiffFocus] = useState<Diff>(3)
  const [kind, setKind] = useState<KindFilter>('all')
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [excludeRecent, setExcludeRecent] = useState(false)  // 최근 30일 출제 문제 제외
  const [evenTypes, setEvenTypes] = useState(false)          // 유형별 균등 배분

  // STEP 2
  const [items, setItems] = useState<Problem[]>([])
  const [conceptIds, setConceptIds] = useState<Set<string>>(new Set())
  const [leftTab, setLeftTab] = useState<LeftTab>('summary')
  const [twinTarget, setTwinTarget] = useState<Problem | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('curriculum')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  // STEP 3
  const [title, setTitle] = useState('')
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
      if (ids.length > 0) setSelected(new Set(ids))
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
  const effectivePool = useMemo(
    () => excludeRecent ? pool.filter(p => !recentProblemIds.has(p.id)) : pool,
    [pool, excludeRecent, recentProblemIds],
  )
  const availableCount = effectivePool.filter(p => kind === 'all' || p.kind === kind).length
  const usedIds = useMemo(() => new Set(items.map(p => p.id)), [items])

  function toggleType(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleMany(ids: string[], on: boolean) {
    setSelected(prev => { const n = new Set(prev); for (const id of ids) { if (on) n.add(id); else n.delete(id) } return n })
  }

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

  function applySort(mode: SortMode) {
    setSortMode(mode)
    setItems(prev => {
      const next = [...prev]
      if (mode === 'curriculum') next.sort((a, b) => {
        const ta = typeOrder.indexOf(a.typeId), tb = typeOrder.indexOf(b.typeId)
        return ta !== tb ? ta - tb : a.diff - b.diff
      })
      else if (mode === 'diff') next.sort((a, b) => a.diff - b.diff)
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

  function save() {
    if (!title.trim()) { alert('학습지명을 입력해주세요.'); return }
    const payload = {
      title: title.trim(),
      author: author.trim() || '출제자',
      grade: editing ? editing.grade : cur.grade,
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

  return (
    <div>
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <GradeSelect value={gradeId} onChange={id => { setGradeId(id); setSelected(new Set()) }} />
              <div className="flex gap-2 text-xs">
                <button onClick={() => toggleMany(typeOrder, true)} className="rounded border border-line px-2 py-1 hover:bg-paper2">전체 선택</button>
                <button onClick={() => toggleMany(typeOrder, false)} className="rounded border border-line px-2 py-1 hover:bg-paper2">전체 해제</button>
              </div>
            </div>
            {cur.units.map(u => {
              const unitTypeIds = u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id)))
              const allOn = unitTypeIds.every(t => selected.has(t))
              return (
                <div key={u.id} className="mb-4">
                  {/* 대단원 */}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-paper2 px-3 py-2 font-bold">
                    <input type="checkbox" checked={allOn}
                      onChange={e => toggleMany(unitTypeIds, e.target.checked)}
                      className="h-4 w-4 accent-pine" />
                    {u.name}
                  </label>
                  <div className="ml-4 mt-2 grid gap-2">
                    {u.mids.map(m => {
                      const midTypeIds = m.subs.flatMap(s => s.types.map(t => t.id))
                      const midOn = midTypeIds.every(t => selected.has(t))
                      const midRedundant = m.name === u.name // 초등: 단원명 반복 → 접기
                      return (
                        <div key={m.id}>
                          {/* 중단원 (대단원과 이름이 같으면 생략) */}
                          {!midRedundant && (
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
                              <input type="checkbox" checked={midOn}
                                onChange={e => toggleMany(midTypeIds, e.target.checked)}
                                className="h-3.5 w-3.5 accent-pine" />
                              {m.name}
                            </label>
                          )}
                          <div className={midRedundant ? 'grid gap-1' : 'ml-5 mt-1 grid gap-1'}>
                            {m.subs.map(s => {
                              const subTypeIds = s.types.map(t => t.id)
                              const subOn = subTypeIds.every(t => selected.has(t))
                              const subRedundant = s.name === m.name
                              return (
                                <div key={s.id}>
                                  {/* 소단원 (중단원과 이름이 같으면 생략) */}
                                  {!subRedundant && (
                                    <label className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-ink2">
                                      <input type="checkbox" checked={subOn}
                                        onChange={e => toggleMany(subTypeIds, e.target.checked)}
                                        className="h-3 w-3 accent-pine" />
                                      {s.name}
                                    </label>
                                  )}
                                  {/* 유형 */}
                                  <div className={`flex flex-wrap gap-x-5 gap-y-1 py-0.5 ${subRedundant ? 'ml-1' : 'ml-5'}`}>
                                    {s.types.map(t => {
                                      const n = problems.filter(p => p.typeId === t.id).length
                                      return (
                                        <label key={t.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                          <input type="checkbox" checked={selected.has(t.id)}
                                            onChange={() => toggleType(t.id)} className="h-3.5 w-3.5 accent-pine" />
                                          {t.name}
                                          <span className="text-xs text-ink2">({n})</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
                문제 형태
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
            <div className="mt-auto rounded-xl bg-paper2 p-4 text-sm">
              학습지 문제 수 <b className="text-pine-dark">{Math.min(count, availableCount)}</b>개 | 유형 <b>{selected.size}</b>개
              {availableCount < count && selected.size > 0 && (
                <div className="mt-1 text-xs text-clay">범위 내 문제가 {availableCount}개뿐이라 그만큼만 담깁니다.</div>
              )}
            </div>
            <button disabled={selected.size === 0} onClick={goStep2}
              className="rounded-xl bg-pine py-3 font-bold text-paper transition enabled:hover:bg-pine-dark disabled:opacity-40">
              다음 단계 →
            </button>
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
            <select value={sortMode} onChange={e => applySort(e.target.value as SortMode)}
              className="rounded-lg border border-line px-2 py-1.5 text-sm">
              <option value="curriculum">교육과정순</option>
              <option value="diff">난이도순</option>
              <option value="shuffle">무작위 섞기</option>
            </select>
            <div className="grow" />
            {!editing && (
              <button onClick={() => {
                if (items.length > 0 && !confirm('편집 내용이 초기화됩니다. 범위 선택으로 돌아갈까요?')) return
                setStep(1)
              }} className="rounded-lg border border-line px-4 py-2 text-sm">← 범위 다시 선택</button>
            )}
            <button disabled={items.length === 0} onClick={() => setStep(3)}
              className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">다음 단계 →</button>
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
                  </div>
                  <ProblemContent p={p} imgClass="w-full max-h-64 object-contain" />
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
            </div>

            <div className="grid gap-1.5 text-sm font-bold">
              태그
              <div className="flex flex-wrap gap-2 font-normal">
                {TAG_PRESETS.map(t => (
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

            <div className="mt-auto flex gap-3">
              <button onClick={() => setStep(2)} className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">← 이전</button>
              <button onClick={save} className="grow rounded-xl bg-amber py-3 font-bold text-white hover:brightness-105">
                {editing ? '수정 저장하기' : '학습지 저장하기'}
              </button>
            </div>
          </div>

          {/* 간이 미리보기 */}
          <div className="h-fit rounded-2xl border border-line bg-white p-6">
            <div className="mb-3 text-sm font-bold text-ink2">미리보기</div>
            <div className="rounded-xl border border-line p-5" style={{ background: THEMES[theme].soft }}>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded px-2 py-0.5 text-xs font-black text-white" style={{ background: THEMES[theme].main }}>
                  {editing ? editing.grade : cur.grade}
                </span>
                <span className="font-black" style={{ color: THEMES[theme].main }}>{title || '학습지 제목'}</span>
              </div>
              <div className="text-xs text-ink2">
                {opts.showDate && <>{(opts.customDate ?? new Date().toISOString().slice(0, 10)).replaceAll('-', '. ')} | </>}
                {items.length}문제 | {author} | 이름 ______
              </div>
              <div className={`mt-3 grid gap-2 ${opts.layout === 'basic' ? 'grid-cols-2' : opts.layout === 'split2' ? 'grid-cols-1' : opts.layout === 'split4' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {items.slice(0, opts.layout === 'split2' ? 2 : 4).map((p, i) => (
                  <div key={p.id} className="rounded bg-white/80 p-2 text-[10px] leading-snug text-ink2">
                    <b>{String(i + 1).padStart(2, '0')}</b>{' '}
                    {opts.showTypeName && <span className="text-pine-dark">[{typeName(p.typeId)}]</span>}{' '}
                    <MathText text={p.body.length > 34 ? p.body.slice(0, 34) + '…' : p.body} />
                  </div>
                ))}
              </div>
            </div>
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
      <ProblemContent p={p} textClass="text-[13px] leading-relaxed" imgClass="w-full max-h-48 object-contain" />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">{text}</div>
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
