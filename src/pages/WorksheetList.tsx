import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { typeName } from '../data/curriculum'
import MathText from '../components/MathText'
import type { Worksheet } from '../types'
import { DIFF_COLOR, DIFF_LABEL, TAG_PRESETS, THEMES } from '../types'

export type View = 'active' | 'favorites' | 'trash'

export default function WorksheetList({ view }: { view: View }) {
  const store = useStore()
  const {
    worksheets, problems, favorites, myLists, toggleFavorite,
    trashWorksheet, restoreWorksheet, purgeWorksheet, duplicateWorksheet,
    addList, renameList, removeList, setWorksheetLists,
  } = store
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [listFilter, setListFilter] = useState<string>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [listModal, setListModal] = useState<Worksheet | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const nav = useNavigate()

  const usedTags = useMemo(() => {
    const s = new Set<string>()
    worksheets.forEach(w => w.tags.forEach(t => s.add(t)))
    return TAG_PRESETS.filter(t => s.has(t))
  }, [worksheets])

  const list = useMemo(() => {
    let base = worksheets.filter(w => (view === 'trash') === !!w.deletedAt)
    if (tagFilter !== 'all') base = base.filter(w => w.tags.includes(tagFilter))
    if (listFilter !== 'all') base = base.filter(w => w.listIds.includes(listFilter))
    if (dateFrom) base = base.filter(w => w.createdAt.slice(0, 10) >= dateFrom)
    if (dateTo) base = base.filter(w => w.createdAt.slice(0, 10) <= dateTo)
    if (q.trim()) {
      const k = q.trim()
      base = base.filter(w =>
        w.title.includes(k) || w.author.includes(k) || w.tags.some(t => t.includes(k)))
    }
    return base
  }, [worksheets, view, q, tagFilter, listFilter, dateFrom, dateTo])

  const favProblems = useMemo(
    () => problems.filter(p => favorites.includes(p.id)),
    [problems, favorites],
  )

  function rangeSummary(w: Worksheet): string {
    const ps = w.problemIds.map(pid => problems.find(p => p.id === pid)).filter(p => p != null)
    if (ps.length === 0) return '0문제'
    const names = ps.map(p => typeName(p.typeId))
    const avg = ps.reduce((a, p) => a + p.diff, 0) / ps.length
    const diffLabel = DIFF_LABEL[Math.round(avg) as 1 | 2 | 3 | 4 | 5]
    const range = names[0] === names[names.length - 1]
      ? names[0] : `${names[0]} ~ ${names[names.length - 1]}`
    return `${ps.length}문제 | ${diffLabel} | ${range}`
  }

  return (
    <div onClick={() => setMenuFor(null)}>
      {/* 필터 바 */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {view !== 'favorites' && (
          <>
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className="rounded-full border border-line bg-white px-3 py-2 text-sm">
              <option value="all">태그 전체</option>
              {usedTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setFilterOpen(v => !v) }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${dateFrom || dateTo ? 'border-pine text-pine-dark' : 'border-line bg-white text-ink2'}`}>
                ☰ 필터
              </button>
              {filterOpen && (
                <div onClick={e => e.stopPropagation()}
                  className="absolute left-0 top-11 z-20 w-80 rounded-2xl border border-line bg-white p-5 shadow-lg">
                  <div className="mb-2 text-sm font-bold">학습지 생성 기간</div>
                  <div className="flex items-center gap-2 text-sm">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="rounded border border-line px-2 py-1.5" />
                    ~
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="rounded border border-line px-2 py-1.5" />
                  </div>
                  <div className="mt-4 flex justify-between text-sm">
                    <button onClick={() => { setDateFrom(''); setDateTo(''); setTagFilter('all'); setListFilter('all') }}
                      className="text-ink2 hover:text-ink">↺ 전체 초기화</button>
                    <button onClick={() => setFilterOpen(false)} className="font-bold text-pine">적용하기</button>
                  </div>
                </div>
              )}
            </div>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="학습지명·태그·출제자 검색"
              className="w-64 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-pine"
            />
            <span className="text-sm text-ink2">{list.length}개</span>
          </>
        )}
      </div>

      {/* 마이 리스트 바 */}
      {view === 'active' && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3">
          <span className="mr-1 text-xs font-bold text-ink2">학습지 마이리스트</span>
          <button onClick={() => {
            const name = prompt('새 마이 리스트 이름')
            if (name?.trim()) addList(name.trim())
          }} className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-ink2 hover:border-pine hover:text-pine">
            + 마이 리스트
          </button>
          <button onClick={() => setListFilter('all')}
            className={`rounded-full px-3 py-1 text-sm ${listFilter === 'all' ? 'bg-pine text-paper font-semibold' : 'border border-line text-ink2'}`}>
            전체
          </button>
          {myLists.map(l => (
            <span key={l.id} className="flex items-center gap-1">
              <button onClick={() => setListFilter(l.id)}
                className={`rounded-full px-3 py-1 text-sm ${listFilter === l.id ? 'bg-pine text-paper font-semibold' : 'border border-line text-ink2'}`}>
                <span className="mr-1 rounded bg-amber-soft px-1 text-[10px] font-black text-amber">MY</span>
                {l.name}
                <span className="ml-1 opacity-70">({worksheets.filter(w => !w.deletedAt && w.listIds.includes(l.id)).length})</span>
              </button>
              <button onClick={() => {
                const name = prompt('리스트 이름 변경', l.name)
                if (name === null) {
                  return
                }
                if (name.trim()) renameList(l.id, name.trim())
                else if (confirm(`"${l.name}" 리스트를 삭제할까요? (학습지는 삭제되지 않습니다)`)) removeList(l.id)
              }} className="text-xs text-line hover:text-ink2">⋮</button>
            </span>
          ))}
        </div>
      )}

      {/* 즐겨찾는 문제 뷰 */}
      {view === 'favorites' && (
        <div className="grid gap-3">
          {favProblems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
              즐겨찾는 문제가 없습니다. 문제은행이나 학습지 편집에서 ★를 눌러 저장하세요.
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

      {/* 학습지 목록 */}
      {view !== 'favorites' && (
        <>
          {list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-16 text-center text-ink2">
              {view === 'active'
                ? <>조건에 맞는 학습지가 없습니다. 우측 상단 <b className="text-amber">+ 학습지 만들기</b>로 시작하세요.</>
                : '휴지통이 비어 있습니다.'}
            </div>
          )}
          <div className="grid gap-4">
            {list.map(w => {
              const theme = THEMES[w.theme]
              return (
                <div key={w.id} className="relative flex items-center gap-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
                  <div className="h-12 w-2 shrink-0 rounded-full" style={{ background: theme.main }} />
                  <div className="min-w-0 grow">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{w.grade}</span>
                      {w.tags.slice(0, 1).map(t => (
                        <span key={t} className="rounded bg-pine-soft px-2 py-0.5 text-xs font-semibold text-pine-dark">{t}</span>
                      ))}
                      <h3 className="truncate text-lg font-bold">{w.title}</h3>
                      <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber">검산완료</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink2">
                      <span className="font-semibold text-clay">{rangeSummary(w)}</span>
                      <span>·</span>
                      <span>{new Date(w.createdAt).toLocaleDateString('ko-KR')}</span>
                      <span>·</span>
                      <span>{w.author}</span>
                      {w.listIds.map(lid => {
                        const l = myLists.find(x => x.id === lid)
                        return l ? <span key={lid} className="rounded-full border border-line px-2 py-0.5">📁 {l.name}</span> : null
                      })}
                    </div>
                  </div>
                  {view === 'active' ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => nav(`/worksheet/${w.id}`)}
                        className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">
                        보기·인쇄
                      </button>
                      <button onClick={e => { e.stopPropagation(); setMenuFor(menuFor === w.id ? null : w.id) }}
                        className="rounded-lg border border-line px-3 py-2 text-sm text-ink2 hover:bg-paper2">⋮</button>
                      {menuFor === w.id && (
                        <div onClick={e => e.stopPropagation()}
                          className="absolute right-4 top-16 z-20 w-44 rounded-xl border border-line bg-white py-1 text-sm shadow-lg">
                          <MenuItem label="리스트에 담기" onClick={() => { setListModal(w); setMenuFor(null) }} />
                          <MenuItem label="수정" onClick={() => nav(`/make?edit=${w.id}`)} />
                          <MenuItem label="복제 후 수정" onClick={() => {
                            const nid = duplicateWorksheet(w.id)
                            if (nid) nav(`/make?edit=${nid}`)
                          }} />
                          <MenuItem label="삭제" danger onClick={() => { trashWorksheet(w.id); setMenuFor(null) }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => restoreWorksheet(w.id)}
                        className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">
                        복구
                      </button>
                      <button onClick={() => { if (confirm('완전히 삭제할까요? 되돌릴 수 없습니다.')) purgeWorksheet(w.id) }}
                        className="rounded-lg border border-line px-3 py-2 text-sm text-ink2 hover:border-clay hover:text-clay">
                        완전 삭제
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
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

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left hover:bg-paper2 ${danger ? 'text-clay' : ''}`}>
      {label}
    </button>
  )
}
