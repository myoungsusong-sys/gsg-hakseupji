import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CURRICULA } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import ProblemContent from '../components/ProblemContent'
import { DEFAULT_SHEET_OPTIONS } from '../types'
import type { Problem } from '../types'
import { AddProblemModal, BulkAddModal } from './Bank'

// 매쓰플랫 '나의 DB' — 업로드한 문제 자료(세트) 목록
// 자료 = customProblems를 source 문자열로 그룹핑한 묶음

interface DbSet {
  source: string
  problems: Problem[]
}

const SET_CATEGORIES = ['전체', '학교별 기출', '직접 입력', '연산 생성', '기타'] as const
type SetCategory = typeof SET_CATEGORIES[number]

const PUBLISHER = '깊은생각수학'

function categoryOf(source: string): SetCategory {
  if (source === '직접 입력') return '직접 입력'
  if (source.includes('연산')) return '연산 생성'
  if (source.includes('학교') || source.includes('기출') || source.includes('중간') || source.includes('기말') || source.includes('모의')) return '학교별 기출'
  return '기타'
}

// 그룹 첫 문제의 typeId가 속한 과정 찾기
function courseOf(typeId: string) {
  for (const c of CURRICULA)
    for (const u of c.units) for (const m of u.mids) for (const s of m.subs)
      if (s.types.some(t => t.id === typeId)) return c
  return null
}

export default function MyDb() {
  const { customProblems, addProblem, removeProblem, saveWorksheet } = useStore()
  const nav = useNavigate()

  const [category, setCategory] = useState<SetCategory>('전체')
  const [publisher, setPublisher] = useState('전체')
  const [selected, setSelected] = useState<string[]>([])       // 선택한 자료(source) 목록
  const [expanded, setExpanded] = useState<string | null>(null) // 문제 미리보기 펼친 자료
  const [showAll, setShowAll] = useState(false)                 // 펼친 자료의 6번째 이후 문제
  const [menuFor, setMenuFor] = useState<string | null>(null)   // ⋮ 메뉴 열린 자료
  const [choosing, setChoosing] = useState(false)               // 업로드 방식 선택 모달
  const [adding, setAdding] = useState(false)
  const [bulk, setBulk] = useState(false)

  const sets = useMemo<DbSet[]>(() => {
    const bySource = new Map<string, Problem[]>()
    for (const p of customProblems) {
      const key = p.source || '직접 입력'
      const list = bySource.get(key)
      if (list) list.push(p)
      else bySource.set(key, [p])
    }
    return [...bySource.entries()].map(([source, problems]) => ({ source, problems }))
  }, [customProblems])

  const visible = sets.filter(g =>
    (category === '전체' || categoryOf(g.source) === category) &&
    (publisher === '전체' || publisher === PUBLISHER))

  const visibleSelected = selected.filter(s => visible.some(g => g.source === s))
  const allChecked = visible.length > 0 && visible.every(g => selected.includes(g.source))

  function toggleAll() {
    if (allChecked) setSelected(prev => prev.filter(s => !visible.some(g => g.source === s)))
    else setSelected(prev => [...new Set([...prev, ...visible.map(g => g.source)])])
  }

  function toggleOne(source: string) {
    setSelected(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source])
  }

  function toggleExpand(source: string) {
    setExpanded(prev => prev === source ? null : source)
    setShowAll(false)
  }

  function gradeLabel(g: DbSet): string {
    const c = courseOf(g.problems[0].typeId)
    return c ? `${c.grade} (22개정)` : '-'
  }

  function removeSet(g: DbSet) {
    if (!confirm(`이 자료의 ${g.problems.length}문제를 삭제할까요?`)) return
    g.problems.forEach(p => removeProblem(p.id))
    setSelected(prev => prev.filter(s => s !== g.source))
    if (expanded === g.source) setExpanded(null)
  }

  function removeSelected() {
    const targets = sets.filter(g => visibleSelected.includes(g.source))
    const n = targets.reduce((acc, g) => acc + g.problems.length, 0)
    if (targets.length === 0) return
    if (!confirm(`선택한 ${targets.length}개 자료의 ${n}문제를 삭제할까요?`)) return
    targets.forEach(g => g.problems.forEach(p => removeProblem(p.id)))
    setSelected([])
    setExpanded(null)
  }

  function makeWorksheet(g: DbSet) {
    const c = courseOf(g.problems[0].typeId)
    const id = uid('ws')
    saveWorksheet({
      id,
      title: g.source,
      author: PUBLISHER,
      grade: c?.grade ?? '중1-1',
      tags: ['나의 DB'],
      theme: 'pine',
      problemIds: g.problems.map(p => p.id),
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
      {/* 필터 줄 */}
      <div className="mb-4 flex items-center gap-3">
        <select value={category} onChange={e => setCategory(e.target.value as SetCategory)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">
          {SET_CATEGORIES.map(c => <option key={c} value={c}>{c === '전체' ? '자료 유형 · 전체' : c}</option>)}
        </select>
        <select value={publisher} onChange={e => setPublisher(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">
          <option value="전체">게시자 · 전체</option>
          {sets.length > 0 && <option value={PUBLISHER}>{PUBLISHER}</option>}
        </select>
        {visibleSelected.length > 0 && (
          <button onClick={removeSelected}
            className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-clay hover:border-clay">
            선택 삭제 ({visibleSelected.length})
          </button>
        )}
        <div className="grow" />
        <button onClick={() => setChoosing(true)}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:bg-pine-dark">
          문제 업로드하기
        </button>
      </div>

      {/* 자료 목록 표 */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white py-20 text-center">
          <p className="mb-4 text-ink2">아직 업로드한 문제가 없습니다.</p>
          <button onClick={() => setChoosing(true)}
            className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">
            문제 업로드하기
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper2 text-xs text-ink2">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th className="w-32 px-3 py-3">학년</th>
                <th className="px-3 py-3">자료명</th>
                <th className="w-28 px-3 py-3">게시자</th>
                <th className="w-28 px-3 py-3">업로드 일자</th>
                <th className="w-14 px-3 py-3 text-center">더보기</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(g => (
                <SetRow key={g.source} g={g}
                  grade={gradeLabel(g)}
                  checked={selected.includes(g.source)}
                  expanded={expanded === g.source}
                  showAll={showAll}
                  menuOpen={menuFor === g.source}
                  onCheck={() => toggleOne(g.source)}
                  onExpand={() => toggleExpand(g.source)}
                  onShowAll={() => setShowAll(true)}
                  onMenu={() => setMenuFor(prev => prev === g.source ? null : g.source)}
                  onMake={() => { setMenuFor(null); makeWorksheet(g) }}
                  onRemove={() => { setMenuFor(null); removeSet(g) }} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ⋮ 메뉴 바깥 클릭 닫기 */}
      {menuFor && <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />}

      {/* 업로드 방식 선택 */}
      {choosing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={() => setChoosing(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">문제 업로드하기</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line p-5">
                <div className="mb-2 text-base font-bold">✏️ 문제 직접 입력 / 일괄 등록</div>
                <p className="mb-4 text-sm text-ink2">직접 만든 문제를 한 문제씩 입력하거나, 텍스트로 여러 문제를 한 번에 등록합니다.</p>
                <div className="flex gap-2">
                  <button onClick={() => { setChoosing(false); setAdding(true) }}
                    className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:bg-pine-dark">직접 입력</button>
                  <button onClick={() => { setChoosing(false); setBulk(true) }}
                    className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">일괄 등록</button>
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-paper2 p-5">
                <div className="mb-2 text-base font-bold">📄 기출 PDF 업로드</div>
                <p className="text-sm text-ink2">
                  수능·모의고사 탭의 회차별 [문항 태깅]에서 편입하거나, 보유 PDF를 Claude에게 주면 텍스트로 변환해 일괄 등록합니다.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setChoosing(false)} className="rounded-lg border border-line px-5 py-2.5 text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}

      {adding && <AddProblemModal onClose={() => setAdding(false)} onAdd={p => { addProblem(p); setAdding(false) }} />}
      {bulk && <BulkAddModal courseId="m1-1" onClose={() => setBulk(false)}
        onAdd={ps => { ps.forEach(addProblem); setBulk(false); alert(`${ps.length}문제를 등록했습니다.`) }} />}
    </div>
  )
}

const PREVIEW_LIMIT = 5

function SetRow({ g, grade, checked, expanded, showAll, menuOpen, onCheck, onExpand, onShowAll, onMenu, onMake, onRemove }: {
  g: DbSet
  grade: string
  checked: boolean
  expanded: boolean
  showAll: boolean
  menuOpen: boolean
  onCheck: () => void
  onExpand: () => void
  onShowAll: () => void
  onMenu: () => void
  onMake: () => void
  onRemove: () => void
}) {
  const preview = expanded ? (showAll ? g.problems : g.problems.slice(0, PREVIEW_LIMIT)) : []
  return (
    <>
      <tr className="cursor-pointer border-t border-line hover:bg-paper2/60" onClick={onExpand}>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={onCheck} />
        </td>
        <td className="px-3 py-3 text-ink2">{grade}</td>
        <td className="px-3 py-3">
          <div className="font-semibold text-ink">{g.source}</div>
          <div className="text-xs font-bold text-pine">{g.problems.length}문제</div>
        </td>
        <td className="px-3 py-3 text-ink2">{PUBLISHER}</td>
        <td className="px-3 py-3 text-ink2">-</td>
        <td className="relative px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
          <button onClick={onMenu} className="rounded px-2 py-1 text-lg leading-none text-ink2 hover:bg-paper2">⋮</button>
          {menuOpen && (
            <div className="absolute right-3 top-10 z-20 w-40 rounded-xl border border-line bg-white py-1 text-left shadow-lg">
              <button onClick={onExpand} className="block w-full px-4 py-2 text-sm hover:bg-paper2">
                문제 보기
              </button>
              <button onClick={onMake} className="block w-full px-4 py-2 text-sm hover:bg-paper2">
                학습지로 만들기
              </button>
              <button onClick={onRemove} className="block w-full px-4 py-2 text-sm text-clay hover:bg-paper2">
                삭제
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-line bg-paper2/40">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid gap-3">
              {preview.map((p, i) => (
                <div key={p.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="mb-1.5 text-xs font-bold text-ink2">{i + 1}번</div>
                  <ProblemContent p={p} imgClass="w-full max-w-md" />
                </div>
              ))}
              {!showAll && g.problems.length > PREVIEW_LIMIT && (
                <button onClick={onShowAll}
                  className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">
                  나머지 {g.problems.length - PREVIEW_LIMIT}문제 더보기
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
