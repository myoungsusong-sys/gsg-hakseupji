import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { typeName, subjectOfType } from '../data/curriculum'
import { useSubject } from '../lib/subject'
import { useBrand, myAuthorSet } from '../lib/brand'
import MathText from '../components/MathText'
import WorksheetOutputDialog from '../components/WorksheetOutputDialog'
import type { Assignment, Student, Worksheet } from '../types'
import { DIFF_COLOR, DIFF_LABEL, TAG_FILTER_OPTIONS } from '../types'

export type View = 'active' | 'favorites' | 'trash'

type GradeGroup = '초' | '중' | '고'
type SortMode = 'created' | 'name'

// 매쓰플랫 「학습지 유형」 필터 칩 — tags·title 키워드 매칭
const WS_TYPE_CHIPS = ['단원유형별', '시중교재', '수능모의고사', '학교별 기출', '병합 학습지'] as const
const WS_TYPE_KEYWORDS: Record<string, string[]> = {
  '단원유형별': ['유형', '단원'],
  '시중교재': ['교재', '쎈', 'RPM', '일품', '개념원리', '마플', '자이스토리', '시중'],
  '수능모의고사': ['수능', '모의고사', '모평', '학평'],
  '학교별 기출': ['기출', '학교'],
  '병합 학습지': ['병합'],
}

// 학년 그룹 판별: 첫 글자 초/중/고. '공통수학'·'대수' 등 고등 과목명도 고로 분류
function gradeGroup(grade: string): GradeGroup {
  const c = grade.charAt(0)
  return c === '초' ? '초' : c === '중' ? '중' : '고'
}

// 표 학년 칸: '중1-1' → '중1', 고등 과목명('공통수학1' 등)은 그대로
function gradeLabel(grade: string): string {
  return /^[초중고]/.test(grade) ? grade.split('-')[0] : grade
}

// 생성일 「26.07.05」 (YY.MM.DD)
function fmtYMD(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${String(d.getFullYear()).slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

export default function WorksheetList({ view }: { view: View }) {
  const store = useStore()
  const {
    worksheets, problems, favorites, myLists, toggleFavorite,
    trashWorksheet, restoreWorksheet, purgeWorksheet, duplicateWorksheet,
    addList, renameList, removeList, setWorksheetLists,
    students, assignments, addAssignment,
    saveWorksheet, updateWorksheet, addMyBook, academyProfile,
  } = store
  const [subject] = useSubject()
  const brand = useBrand()
  const mineSet = useMemo(() => myAuthorSet(academyProfile.academyName?.trim() || '깊은생각수학'), [academyProfile.academyName])
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeGroup>('all')
  const [sortMode, setSortMode] = useState<SortMode>('created')
  const [listFilter, setListFilter] = useState<string>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [excludeReview, setExcludeReview] = useState(false)   // 오답·복습학습지 제외
  const [mineOnly, setMineOnly] = useState(false)             // 내가 만든 학습지만
  const [wsTypes, setWsTypes] = useState<Set<string>>(new Set())
  const [listsOpen, setListsOpen] = useState(true)            // 마이리스트 스트립 접기
  const [cardSort, setCardSort] = useState<SortMode>('created')
  const [listModal, setListModal] = useState<Worksheet | null>(null)
  const [menuFor, setMenuFor] = useState<{ id: string; x: number; y: number } | null>(null)
  const [listMenu, setListMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<string[] | null>(null)
  const [outDialog, setOutDialog] = useState<'download' | 'print' | null>(null)
  const [bulkListOpen, setBulkListOpen] = useState(false)   // 일괄 「리스트에 담기」
  const nav = useNavigate()

  // 인쇄/다운로드 다이얼로그 — 다중 선택 지원 (첫 학습지 현재 탭 + 나머지 새 탭 자동 인쇄)
  function openOut(mode: 'download' | 'print') {
    if (checked.size === 0) return
    setOutDialog(mode)
  }

  // 태그 필터: 매쓰플랫과 동일하게 프리셋 27종 상시 노출 + 프리셋 외 사용 중 태그 추가
  const tagOptions = useMemo(() => {
    const extra = new Set<string>()
    worksheets.forEach(w => w.tags.forEach(t => { if (!TAG_FILTER_OPTIONS.includes(t)) extra.add(t) }))
    return [...TAG_FILTER_OPTIONS, ...extra]
  }, [worksheets])

  // 학습지 과목: 저장값 우선, 없으면(레거시) 문항 유형으로 유도(과학 유형 있으면 과학), 그래도 없으면 수학
  const probType = useMemo(() => new Map(problems.map(p => [p.id, p.typeId])), [problems])
  const wsSubject = useMemo(() => (w: Worksheet): '수학' | '과학' => {
    if (w.subject) return w.subject
    for (const pid of w.problemIds) {
      const tid = probType.get(pid)
      if (tid && subjectOfType(tid) === '과학') return '과학'
    }
    return '수학'
  }, [probType])

  const list = useMemo(() => {
    let base = worksheets.filter(w => (view === 'trash') === !!w.deletedAt)
    base = base.filter(w => wsSubject(w) === subject)
    if (gradeFilter !== 'all') base = base.filter(w => gradeGroup(w.grade) === gradeFilter)
    if (tagFilter !== 'all') base = base.filter(w => w.tags.includes(tagFilter))
    if (listFilter !== 'all') base = base.filter(w => w.listIds.includes(listFilter))
    if (dateFrom) base = base.filter(w => w.createdAt.slice(0, 10) >= dateFrom)
    if (dateTo) base = base.filter(w => w.createdAt.slice(0, 10) <= dateTo)
    if (excludeReview) base = base.filter(w => !w.tags.some(t => t.includes('오답') || t.includes('복습')))
    if (mineOnly) base = base.filter(w => mineSet.has(w.author))
    if (wsTypes.size > 0) {
      base = base.filter(w => {
        const hay = w.title + ' ' + w.tags.join(' ')
        return [...wsTypes].some(c => (WS_TYPE_KEYWORDS[c] ?? []).some(k => hay.includes(k)))
      })
    }
    if (q.trim()) {
      const k = q.trim()
      base = base.filter(w =>
        w.title.includes(k) || w.author.includes(k) || w.tags.some(t => t.includes(k)))
    }
    return [...base].sort((a, b) => sortMode === 'name'
      ? a.title.localeCompare(b.title, 'ko')
      : b.createdAt.localeCompare(a.createdAt))
  }, [worksheets, view, q, gradeFilter, sortMode, tagFilter, listFilter, dateFrom, dateTo, excludeReview, mineOnly, wsTypes, subject, wsSubject, mineSet])

  // 학습지별 출제된 학생 (수업·숙제 무관, 학생 중복 제거)
  const assignedByWs = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const a of assignments) {
      const s = m.get(a.worksheetId) ?? new Set<string>()
      s.add(a.studentId)
      m.set(a.worksheetId, s)
    }
    return m
  }, [assignments])

  const sortedLists = useMemo(() => [...myLists].sort((a, b) => cardSort === 'name'
    ? a.name.localeCompare(b.name, 'ko')
    : a.createdAt.localeCompare(b.createdAt)), [myLists, cardSort])

  function toggleChecked(id: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function emptyTrash() {
    const trashed = worksheets.filter(w => w.deletedAt)
    if (trashed.length === 0) return
    if (!confirm(`휴지통의 학습지 ${trashed.length}개를 모두 완전히 삭제할까요? 되돌릴 수 없습니다.`)) return
    trashed.forEach(w => purgeWorksheet(w.id))
    setChecked(new Set())
  }
  function resetFilters() {
    setDateFrom(''); setDateTo(''); setTagFilter('all'); setListFilter('all')
    setExcludeReview(false); setMineOnly(false); setWsTypes(new Set())
  }
  function openMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation()
    if (menuFor?.id === id) { setMenuFor(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setMenuFor({ id, x: Math.max(8, r.right - 176), y: r.bottom + 4 })
    setListMenu(null)
  }
  function openListMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation()
    if (listMenu?.id === id) { setListMenu(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setListMenu({ id, x: Math.max(8, r.right - 144), y: r.bottom + 4 })
    setMenuFor(null)
  }

  const favProblems = useMemo(
    () => problems.filter(p => favorites.includes(p.id)),
    [problems, favorites],
  )

  // ── 일괄 액션 (매쓰플랫 액션바) ──────────────────────────────
  const checkedWs = () => worksheets.filter(w => checked.has(w.id))

  // 학습지 병합: 선택한 학습지들의 문제를 합쳐 새 학습지 1개 생성 (중복 문제 제거)
  function mergeChecked() {
    const targets = checkedWs()
    if (targets.length < 2) { alert('학습지 병합은 2개 이상 선택 시 가능합니다.'); return }
    if (!confirm(`선택한 학습지 ${targets.length}개를 병합해 새 학습지를 만들까요? (원본은 유지됩니다)`)) return
    const pids: string[] = []
    const seen = new Set<string>()
    for (const w of targets) for (const pid of w.problemIds) if (!seen.has(pid)) { seen.add(pid); pids.push(pid) }
    const base = targets[0]
    const id = `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    saveWorksheet({
      ...base, id,
      title: `병합 학습지 — ${base.title} 외 ${targets.length - 1}개`,
      tags: [...new Set(targets.flatMap(w => w.tags))],
      problemIds: pids,
      conceptIds: [...new Set(targets.flatMap(w => w.conceptIds))],
      listIds: [], createdAt: new Date().toISOString(), deletedAt: null,
      supplement: undefined, studentHidden: undefined,
    })
    setChecked(new Set())
    nav(`/worksheet/${id}`)
  }

  // 교재 만들기: 선택한 학습지들을 내 교재로 묶기 (교재 > 내 교재)
  function makeBookFrom(wsIds: string[]) {
    const targets = worksheets.filter(w => wsIds.includes(w.id))
    if (targets.length === 0) return
    const name = prompt('새 교재 이름', targets.length === 1 ? `${targets[0].title} 교재` : `${targets[0].title} 외 ${targets.length - 1}개 교재`)
    if (!name?.trim()) return
    addMyBook({ title: name.trim(), grade: targets[0].grade, worksheetIds: wsIds })
    setChecked(new Set())
    alert('내 교재로 저장했습니다. (교재 > 내 교재 탭에서 확인)')
  }

  // 학생앱 비공개 토글: 하나라도 공개면 전체 비공개로, 전부 비공개면 공개로
  function toggleHidden() {
    const targets = checkedWs()
    const hide = targets.some(w => !w.studentHidden)
    targets.forEach(w => updateWorksheet(w.id, { studentHidden: hide }))
    alert(hide ? `${targets.length}개 학습지를 학생앱에서 비공개했습니다.` : `${targets.length}개 학습지를 다시 공개했습니다.`)
  }

  // 메일 전송: mailto 링크 등가 (첨부는 다운로드 후 수동 — 브라우저 mailto는 첨부 불가)
  function mailChecked() {
    const targets = checkedWs()
    const body = [
      '학습지를 전달합니다.', '',
      ...targets.map(w => `- ${w.title} (${w.grade}, ${w.problemIds.length}문제)`),
      '', '※ PDF는 다운로드 후 첨부해 주세요.',
    ].join('\n')
    location.href = `mailto:?subject=${encodeURIComponent(`[${brand}] 학습지 ${targets.length}개`)}&body=${encodeURIComponent(body)}`
  }

  // 일괄 「리스트에 담기」: 선택한 리스트를 선택 학습지 전체에 추가
  function addAllToList(listId: string) {
    for (const w of checkedWs())
      if (!w.listIds.includes(listId)) setWorksheetLists(w.id, [...w.listIds, listId])
  }

  const filterActive = !!(dateFrom || dateTo || excludeReview || mineOnly || wsTypes.size > 0)

  // 행 부제: 유형 트리에 실제로 있는 유형명만 사용(옛 시드의 내부 id 노출 방지),
  // 유효한 이름이 없으면 유형 범위 생략
  function rangeSummary(w: Worksheet): string {
    const ps = w.problemIds.map(pid => problems.find(p => p.id === pid)).filter(p => p != null)
    if (ps.length === 0) return '0문제'
    const avg = ps.reduce((a, p) => a + p.diff, 0) / ps.length
    const diffLabel = DIFF_LABEL[Math.round(avg) as 1 | 2 | 3 | 4 | 5]
    const names = ps.map(p => p.typeId).filter(id => typeName(id) !== id).map(id => typeName(id))
    if (names.length === 0) return `${ps.length}문제 | ${diffLabel}`
    const range = names[0] === names[names.length - 1]
      ? names[0] : `${names[0]} ~ ${names[names.length - 1]}`
    return `${ps.length}문제 | ${diffLabel} | ${range}`
  }

  return (
    <div onClick={() => { setMenuFor(null); setListMenu(null) }}>
      {/* 필터 줄 */}
      {view !== 'favorites' && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-line bg-white p-1">
            {(['all', '초', '중', '고'] as const).map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`rounded-full px-3 py-1 text-sm ${gradeFilter === g ? 'bg-pine font-semibold text-paper' : 'text-ink2 hover:text-ink'}`}>
                {g === 'all' ? '전체' : g}
              </button>
            ))}
          </div>
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="rounded-full border border-line bg-white px-3 py-2 text-sm">
            <option value="all">태그 전체</option>
            {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setFilterOpen(v => !v) }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${filterActive ? 'border-pine text-pine-dark' : 'border-line bg-white text-ink2'}`}>
              ☰ 필터
            </button>
            {filterOpen && (
              <div onClick={e => e.stopPropagation()}
                className="absolute left-0 top-11 z-20 w-80 rounded-2xl border border-line bg-white p-5 shadow-lg">
                <div className="mb-3 text-sm font-bold">검색 필터</div>
                <ToggleRow label="오답·복습학습지 제외" on={excludeReview} onToggle={() => setExcludeReview(v => !v)} />
                <ToggleRow label="내가 만든 학습지만" on={mineOnly} onToggle={() => setMineOnly(v => !v)} />
                <div className="mb-2 mt-4 text-sm font-bold">학습지 생성 기간</div>
                <div className="flex items-center gap-2 text-sm">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="rounded border border-line px-2 py-1.5" />
                  ~
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="rounded border border-line px-2 py-1.5" />
                </div>
                <div className="mb-2 mt-4 text-sm font-bold">학습지 유형</div>
                <div className="flex flex-wrap gap-1.5">
                  {WS_TYPE_CHIPS.map(c => {
                    const on = wsTypes.has(c)
                    return (
                      <button key={c} onClick={() => setWsTypes(prev => {
                        const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n
                      })}
                        className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-pine bg-pine-soft font-semibold text-pine-dark' : 'border-line text-ink2 hover:text-ink'}`}>
                        {c}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 flex justify-between text-sm">
                  <button onClick={resetFilters} className="text-ink2 hover:text-ink">🔄 전체 초기화</button>
                  <button onClick={() => setFilterOpen(false)} className="font-bold text-pine">적용하기</button>
                </div>
              </div>
            )}
          </div>
          {view === 'trash' && <SortToggle value={sortMode} onChange={setSortMode} />}
          <span className="text-sm text-ink2">{list.length}개</span>
          <div className="grow" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="학습지명, 태그, 출제자 검색"
            className="w-64 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-pine"
          />
          {view === 'active' ? (
            <>
              <button onClick={() => nav('/prep/worksheet-upload')}
                className="rounded-full border border-blue-500 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                ↥ 학습지 업로드하기
              </button>
              <button onClick={() => nav('/make')}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                ⊕ 학습지 만들기
              </button>
            </>
          ) : (
            <>
              <button title="삭제된 학습지는 여기서 복구하거나 완전 삭제할 수 있습니다."
                onClick={() => alert('삭제된 학습지는 여기서 복구하거나 완전 삭제할 수 있습니다.')}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink2 hover:text-ink">
                학습지 복구 안내 ⓘ
              </button>
              <button onClick={emptyTrash}
                className="rounded-full border border-clay px-4 py-2 text-sm font-semibold text-clay hover:bg-clay/10">
                🗑 휴지통 비우기
              </button>
            </>
          )}
        </div>
      )}

      {/* 학습지 마이리스트 스트립 */}
      {view === 'active' && (
        <div className="mb-6 rounded-2xl border border-line bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold">학습지 마이리스트</span>
            <button onClick={() => setListsOpen(v => !v)} className="text-xs text-ink2 hover:text-ink">
              {listsOpen ? '접기 ▲' : '마이 리스트 보기 ▼'}
            </button>
            <div className="grow" />
            <span className="text-xs text-ink2">리스트 정렬</span>
            <SortToggle value={cardSort} onChange={setCardSort} />
            <span className="ml-2 text-xs text-ink2">학습지 정렬</span>
            <SortToggle value={sortMode} onChange={setSortMode} />
          </div>
          {listsOpen && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => {
                const name = prompt('새 마이 리스트 이름')
                if (name?.trim()) addList(name.trim())
              }} className="shrink-0 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink2 hover:border-pine hover:text-pine">
                ＋ 마이 리스트
              </button>
              {sortedLists.map(l => {
                const on = listFilter === l.id
                const count = worksheets.filter(w => !w.deletedAt && w.listIds.includes(l.id)).length
                return (
                  <div key={l.id}
                    className={`flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 ${on ? 'border-pine bg-pine-soft/40' : 'border-line bg-white'}`}>
                    <button onClick={() => setListFilter(on ? 'all' : l.id)} className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-amber-soft px-1 text-[10px] font-black text-amber">MY</span>
                      <span className="font-semibold">{l.name}</span>
                      <span className="text-xs text-ink2">({count})</span>
                    </button>
                    <button onClick={e => openListMenu(e, l.id)}
                      className="px-1 text-sm text-ink2 hover:text-ink">⋮</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 즐겨찾는 문제 뷰 */}
      {view === 'favorites' && (
        <div className="grid gap-3">
          {favProblems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
              <div className="mb-3 text-3xl">🔖</div>
              즐겨찾기에 추가된 문제가 없습니다.<br />
              마음에 드는 문제를 지정하여 학습지나 교재를 만들 때 활용하세요.
            </div>
          )}
          {favProblems.map(p => (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-bold ${DIFF_COLOR[p.diff]}`}>{DIFF_LABEL[p.diff]}</span>
                <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">{p.kind}</span>
                <span className="text-ink2">{typeName(p.typeId)}</span>
                <div className="grow" />
                <button onClick={() => toggleFavorite(p.id)}
                  className="rounded border border-line px-2 py-1 text-ink2 hover:border-clay hover:text-clay">★ 해제</button>
              </div>
              <MathText text={p.body} className="text-[15px] leading-relaxed" />
            </div>
          ))}
        </div>
      )}

      {/* 학습지 목록 (표) */}
      {view !== 'favorites' && (
        <>
          {/* 일괄 선택 액션바 — 선택 시에만 표시 */}
          {checked.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-5 py-2.5 text-sm">
              <span className="font-semibold">학습지 {checked.size}개 선택됨</span>
              {view === 'active' ? (
                <>
                  <button onClick={mergeChecked}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-pine hover:text-pine-dark">
                    학습지 병합
                  </button>
                  <button onClick={() => setBulkListOpen(true)}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-pine hover:text-pine-dark">
                    리스트에 담기
                  </button>
                  <button onClick={() => makeBookFrom([...checked])}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-pine hover:text-pine-dark">
                    교재 만들기
                  </button>
                  <button onClick={toggleHidden}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-pine hover:text-pine-dark">
                    학생앱 비공개
                  </button>
                  <button onClick={() => setAssignTarget([...checked])}
                    className="rounded-lg bg-pine px-4 py-1.5 font-semibold text-paper">
                    일괄 출제
                  </button>
                  <button onClick={mailChecked}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-blue-500 hover:text-blue-600">
                    메일전송
                  </button>
                  <button onClick={() => openOut('print')}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-blue-500 hover:text-blue-600">
                    인쇄하기
                  </button>
                  <button onClick={() => openOut('download')}
                    className="rounded-lg border border-line px-4 py-1.5 font-semibold hover:border-blue-500 hover:text-blue-600">
                    다운로드
                  </button>
                  <button onClick={() => {
                    if (!confirm(`선택한 학습지 ${checked.size}개를 휴지통으로 이동할까요?`)) return
                    ;[...checked].forEach(trashWorksheet)
                    setChecked(new Set())
                  }} className="rounded-lg border border-line px-4 py-1.5 text-ink2 hover:border-clay hover:text-clay">
                    선택 삭제
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { [...checked].forEach(restoreWorksheet); setChecked(new Set()) }}
                    className="rounded-lg border border-pine px-4 py-1.5 font-semibold text-pine hover:bg-pine-soft">
                    일괄 복구
                  </button>
                  <button onClick={() => {
                    if (!confirm(`선택한 학습지 ${checked.size}개를 완전히 삭제할까요? 되돌릴 수 없습니다.`)) return
                    ;[...checked].forEach(purgeWorksheet)
                    setChecked(new Set())
                  }} className="rounded-lg border border-line px-4 py-1.5 text-ink2 hover:border-clay hover:text-clay">
                    일괄 완전 삭제
                  </button>
                </>
              )}
              <button onClick={() => setChecked(new Set())} className="text-ink2 hover:text-ink">선택 해제</button>
            </div>
          )}
          {list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
              {view === 'active'
                ? <>조건에 맞는 학습지가 없습니다. 우측 상단 <b className="text-amber">⊕ 학습지 만들기</b>로 시작하세요.</>
                : '휴지통이 비어 있습니다.'}
            </div>
          )}
          {list.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper2/60 text-xs text-ink2">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" className="h-4 w-4 accent-pine"
                        checked={list.every(w => checked.has(w.id))}
                        onChange={e => setChecked(e.target.checked ? new Set(list.map(w => w.id)) : new Set())} />
                    </th>
                    <th className="whitespace-nowrap px-3 py-3">학년</th>
                    <th className="whitespace-nowrap px-3 py-3">태그</th>
                    <th className="px-3 py-3 text-left">학습지명</th>
                    <th className="whitespace-nowrap px-3 py-3">생성일</th>
                    <th className="whitespace-nowrap px-3 py-3">출제자</th>
                    <th className="whitespace-nowrap px-3 py-3">미리보기</th>
                    <th className="whitespace-nowrap px-3 py-3">출제</th>
                    <th className="whitespace-nowrap px-3 py-3">더보기</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(w => {
                    const isNew = Date.now() - new Date(w.createdAt).getTime() < 7 * 24 * 3600 * 1000
                    const assignedNames = [...(assignedByWs.get(w.id) ?? [])]
                      .map(sid => students.find(s => s.id === sid)?.name)
                      .filter((n): n is string => !!n)
                    const sub = rangeSummary(w)
                    return (
                      <tr key={w.id} className="border-b border-line last:border-b-0 hover:bg-paper2/40">
                        <td className="px-3 py-3 text-center">
                          <input type="checkbox" checked={checked.has(w.id)} onChange={() => toggleChecked(w.id)}
                            className="h-4 w-4 accent-pine" />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          <div className="font-semibold">{gradeLabel(w.grade)}</div>
                          <div className="text-[11px] text-ink2">(22개정)</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-wrap justify-center gap-1">
                            {w.tags.slice(0, 2).map(t => (
                              <span key={t} className="whitespace-nowrap rounded bg-pine-soft px-2 py-0.5 text-xs font-semibold text-pine-dark">{t}</span>
                            ))}
                            {w.tags.length > 2 && <span className="text-xs text-ink2">+{w.tags.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => nav(`/worksheet/${w.id}`)}
                              className="truncate text-left font-bold hover:underline">{w.title}</button>
                            {w.options.autoGrade && (
                              <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">자동 채점</span>
                            )}
                            {isNew && <span className="shrink-0 rounded bg-clay/10 px-1.5 py-0.5 text-[10px] font-black text-clay">NEW</span>}
                            {w.studentHidden && <span title="학생앱 비공개" className="shrink-0 rounded bg-paper2 px-1.5 py-0.5 text-[10px] font-bold text-ink2">비공개</span>}
                          </div>
                          <div className="mt-0.5 text-xs font-semibold text-blue-500">{sub}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center text-ink2">{fmtYMD(w.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-center text-ink2">{w.author}</td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => nav(`/worksheet/${w.id}`)} title="미리보기"
                            className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper2">🔍</button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          {assignedNames.length > 0 ? (
                            <span className="text-xs font-semibold text-pine-dark">
                              {assignedNames.slice(0, 3).join(', ')}
                              {assignedNames.length > 3 && ` 외 ${assignedNames.length - 3}명`}
                            </span>
                          ) : view === 'active' ? (
                            <button onClick={() => setAssignTarget([w.id])}
                              className="rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-paper hover:bg-pine-dark">
                              출제하기
                            </button>
                          ) : (
                            <span className="text-xs text-ink2">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={e => openMenu(e, w.id)}
                            className="rounded-lg border border-line px-2.5 py-1.5 text-ink2 hover:bg-paper2">⋮</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 행 더보기 메뉴 */}
      {menuFor && (() => {
        const w = worksheets.find(x => x.id === menuFor.id)
        if (!w) return null
        return (
          <div onClick={e => e.stopPropagation()} style={{ left: menuFor.x, top: menuFor.y }}
            className="fixed z-30 w-44 rounded-xl border border-line bg-white py-1 text-sm shadow-lg">
            {view === 'active' ? (
              <>
                <MenuItem label="리스트에 담기" onClick={() => { setListModal(w); setMenuFor(null) }} />
                <MenuItem label="수정" onClick={() => nav(`/make?edit=${w.id}`)} />
                <MenuItem label="복제 후 수정" onClick={() => {
                  const nid = duplicateWorksheet(w.id)
                  if (nid) nav(`/make?edit=${nid}`)
                }} />
                <MenuItem label="동일 옵션으로 교재 만들기" onClick={() => { setMenuFor(null); makeBookFrom([w.id]) }} />
                <MenuItem label="삭제" danger onClick={() => { trashWorksheet(w.id); setMenuFor(null) }} />
              </>
            ) : (
              <>
                <MenuItem label="복구" onClick={() => { restoreWorksheet(w.id); setMenuFor(null) }} />
                <MenuItem label="완전 삭제" danger onClick={() => {
                  if (confirm('완전히 삭제할까요? 되돌릴 수 없습니다.')) purgeWorksheet(w.id)
                  setMenuFor(null)
                }} />
              </>
            )}
          </div>
        )
      })()}

      {/* 마이리스트 카드 ⋮ 메뉴 */}
      {listMenu && (() => {
        const l = myLists.find(x => x.id === listMenu.id)
        if (!l) return null
        return (
          <div onClick={e => e.stopPropagation()} style={{ left: listMenu.x, top: listMenu.y }}
            className="fixed z-30 w-36 rounded-xl border border-line bg-white py-1 text-sm shadow-lg">
            <MenuItem label="이름 변경" onClick={() => {
              const name = prompt('리스트 이름 변경', l.name)
              if (name?.trim()) renameList(l.id, name.trim())
              setListMenu(null)
            }} />
            <MenuItem label="삭제" danger onClick={() => {
              if (confirm(`"${l.name}" 리스트를 삭제할까요? (학습지는 삭제되지 않습니다)`)) {
                removeList(l.id)
                if (listFilter === l.id) setListFilter('all')
              }
              setListMenu(null)
            }} />
          </div>
        )
      })()}

      {/* 학습지 다운로드/인쇄 다이얼로그 — 다중 선택 시 첫 학습지 현재 탭 + 나머지 새 탭 자동 인쇄 */}
      {outDialog && (() => {
        const targets = list.filter(w => checked.has(w.id))
        const target = targets[0]
        if (!target) return null
        const names = [...(assignedByWs.get(target.id) ?? [])]
          .map(sid => students.find(s => s.id === sid)?.name)
          .filter((n): n is string => !!n)
        return (
          <WorksheetOutputDialog mode={outDialog} ws={target} extraWs={targets.slice(1)} studentNames={names}
            onClose={() => setOutDialog(null)} />
        )
      })()}

      {/* 일괄 「리스트에 담기」 모달 */}
      {bulkListOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={() => setBulkListOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 font-bold">리스트에 담기</h3>
            <p className="mb-4 text-sm text-ink2">선택한 학습지 {checked.size}개를 담을 리스트를 선택하세요.</p>
            {myLists.length === 0 && (
              <div className="mb-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">
                아직 리스트가 없습니다. 아래에서 새로 만들어 보세요.
              </div>
            )}
            <div className="grid gap-2">
              {myLists.map(l => (
                <button key={l.id} onClick={() => { addAllToList(l.id); setBulkListOpen(false); setChecked(new Set()) }}
                  className="flex items-center gap-2 rounded-xl border border-line p-3 text-left text-sm hover:border-pine hover:bg-pine-soft/40">
                  <span className="rounded bg-amber-soft px-1 text-[10px] font-black text-amber">MY</span>
                  {l.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <button onClick={() => {
                const name = prompt('새 마이 리스트 이름')
                if (name?.trim()) {
                  const id = addList(name.trim())
                  addAllToList(id)
                  setBulkListOpen(false); setChecked(new Set())
                }
              }} className="rounded-lg border border-line px-4 py-2 text-sm">+ 새 마이 리스트</button>
              <button onClick={() => setBulkListOpen(false)} className="rounded-lg border border-line px-5 py-2 text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 출제하기 모달 */}
      {assignTarget && (
        <AssignModal
          title={assignTarget.length === 1
            ? `「${worksheets.find(w => w.id === assignTarget[0])?.title ?? ''}」`
            : `학습지 ${assignTarget.length}개`}
          students={students.filter(s => s.active)}
          onClose={() => setAssignTarget(null)}
          onSubmit={(ids, kind) => {
            assignTarget.forEach(wsId => addAssignment(wsId, ids, kind))
            setAssignTarget(null)
            setChecked(new Set())
          }}
        />
      )}

      {/* 마이 리스트에 담기 모달 */}
      {listModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={() => setListModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 font-bold">마이 리스트에 담기</h3>
            <p className="mb-4 text-sm text-ink2">「{listModal.title}」를 담을 리스트를 선택하세요.</p>
            {myLists.length === 0 && (
              <div className="mb-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">
                아직 리스트가 없습니다. 아래에서 새로 만들어 보세요.
              </div>
            )}
            <div className="grid gap-2">
              {myLists.map(l => {
                const on = listModal.listIds.includes(l.id)
                return (
                  <label key={l.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${on ? 'border-pine bg-pine-soft/40' : 'border-line'}`}>
                    <input type="checkbox" checked={on} className="h-4 w-4 accent-pine"
                      onChange={() => {
                        const next = on ? listModal.listIds.filter(x => x !== l.id) : [...listModal.listIds, l.id]
                        setWorksheetLists(listModal.id, next)
                        setListModal({ ...listModal, listIds: next })
                      }} />
                    <span className="rounded bg-amber-soft px-1 text-[10px] font-black text-amber">MY</span>
                    {l.name}
                  </label>
                )
              })}
            </div>
            <div className="mt-4 flex justify-between">
              <button onClick={() => {
                const name = prompt('새 마이 리스트 이름')
                if (name?.trim()) {
                  const id = addList(name.trim())
                  const next = [...listModal.listIds, id]
                  setWorksheetLists(listModal.id, next)
                  setListModal({ ...listModal, listIds: next })
                }
              }} className="rounded-lg border border-line px-4 py-2 text-sm">+ 새 마이 리스트</button>
              <button onClick={() => setListModal(null)} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper">완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortToggle({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  return (
    <div className="flex gap-1 rounded-full border border-line bg-white p-1 text-xs">
      {([['created', '생성순'], ['name', '이름순']] as const).map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`rounded-full px-2.5 py-0.5 ${value === k ? 'bg-paper2 font-semibold text-ink' : 'text-ink2 hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between text-sm">
      <span>{label}</span>
      <button onClick={onToggle} aria-pressed={on}
        className={`h-5 w-9 rounded-full p-0.5 transition-colors ${on ? 'bg-pine' : 'bg-line'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  )
}

function AssignModal({ title, students, onClose, onSubmit }: {
  title: string
  students: Student[]
  onClose: () => void
  onSubmit: (studentIds: string[], kind: Assignment['kind']) => void
}) {
  const [kind, setKind] = useState<Assignment['kind']>('수업')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const allOn = students.length > 0 && students.every(s => sel.has(s.id))

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 font-bold">출제하기</h3>
        <p className="mb-4 text-sm text-ink2">{title}를 출제할 학생을 선택하세요.</p>
        <div className="mb-4 flex gap-2">
          {([['수업', '수업으로 출제'], ['숙제', '숙제로 출제']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)}
              className={`grow rounded-lg border px-4 py-2 text-sm font-semibold ${kind === k ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
              {label}
            </button>
          ))}
        </div>
        {students.length === 0 ? (
          <div className="mb-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink2">
            활성 학생이 없습니다. 학생 관리에서 학생을 먼저 등록하세요.
          </div>
        ) : (
          <>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={allOn} className="h-4 w-4 accent-pine"
                onChange={e => setSel(e.target.checked ? new Set(students.map(s => s.id)) : new Set())} />
              전체 선택 ({students.length}명)
            </label>
            <div className="grid max-h-64 gap-2 overflow-auto">
              {students.map(s => {
                const on = sel.has(s.id)
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${on ? 'border-pine bg-pine-soft/40' : 'border-line'}`}>
                    <input type="checkbox" checked={on} className="h-4 w-4 accent-pine"
                      onChange={() => setSel(prev => {
                        const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n
                      })} />
                    <b>{s.name}</b>
                    <span className="text-xs text-ink2">{s.grade}{s.klass ? ` · ${s.klass}` : ''}</span>
                  </label>
                )
              })}
            </div>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">취소</button>
          <button disabled={sel.size === 0} onClick={() => onSubmit([...sel], kind)}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
            출제하기 ({sel.size}명)
          </button>
        </div>
      </div>
    </div>
  )
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left hover:bg-paper2 ${danger ? 'text-clay' : ''}`}>
      {label}
    </button>
  )
}
