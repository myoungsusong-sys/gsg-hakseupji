import { useMemo, useState } from 'react'
import { CURRICULA, typeName, subjectOfCourse } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import { useSubject } from '../lib/subject'
import BookCatalogDialog from '../components/BookCatalogDialog'
import BulkImportModal from '../components/BulkImportModal'
import type { Diff, Kind, WBItem, Workbook } from '../types'
import { DIFF_LABEL, DIFFS } from '../types'

// 시중문제집 관리: 정답표(문항→정답·유형)만 등록. 문제 원문은 저장하지 않는다.
export default function Workbooks() {
  const { workbooks, wbItems, addWorkbook, removeWorkbook, setWBItems } = useStore()
  const [subject] = useSubject()
  // 교재 과목: 저장값 → course로 유도 → 수학(레거시). 헤더 과목 스위처로 필터
  const shownWorkbooks = useMemo(
    () => workbooks.filter(w => (w.subject ?? subjectOfCourse(w.course) ?? '수학') === subject),
    [workbooks, subject],
  )
  const [sel, setSel] = useState<string | null>(workbooks[0]?.id ?? null)
  const [adding, setAdding] = useState(false)

  // 과목 전환 시 선택된 교재가 현재 과목에 없으면 첫 항목으로
  const selInSubject = shownWorkbooks.some(w => w.id === sel)
  const current = (selInSubject ? workbooks.find(w => w.id === sel) : shownWorkbooks[0]) ?? null
  const items = useMemo(
    () => wbItems.filter(i => i.workbookId === sel).sort((a, b) => a.page - b.page || a.no - b.no),
    [wbItems, sel],
  )

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-black">시중문제집 정답표</h1>
        <span className="rounded-full bg-pine-soft px-3 py-1 text-xs font-bold text-pine-dark">채점·유형 진단용 · 문제 원문 저장 안 함</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* 교재 목록 */}
        <div className="h-fit rounded-2xl border border-line bg-white p-4">
          <button onClick={() => setAdding(true)}
            className="mb-3 w-full rounded-lg bg-pine px-3 py-2 text-sm font-bold text-paper">+ 교재 추가</button>
          {shownWorkbooks.length === 0 && (
            <p className="px-1 text-sm text-ink2">{subject} 교재가 없습니다. 위 「+ 교재 추가」로 등록하세요.</p>
          )}
          {shownWorkbooks.map(w => (
            <div key={w.id}
              className={`mb-1 flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${sel === w.id ? 'bg-pine-soft' : 'hover:bg-paper2'}`}>
              <button onClick={() => setSel(w.id)} className="min-w-0 grow text-left">
                <div className={`truncate font-bold ${sel === w.id ? 'text-pine-dark' : ''}`}>{w.name}</div>
                <div className="text-xs text-ink2">{w.publisher} · {w.grade} · {wbItems.filter(i => i.workbookId === w.id).length}문항</div>
              </button>
              <button onClick={() => { if (confirm(`"${w.name}" 교재와 정답표를 삭제할까요?`)) { removeWorkbook(w.id); if (sel === w.id) setSel(null) } }}
                className="text-xs text-line hover:text-clay">✕</button>
            </div>
          ))}
        </div>

        {/* 정답표 편집 / 매칭 요약 */}
        <div className="rounded-2xl border border-line bg-white p-6">
          {!current ? (
            <p className="text-sm text-ink2">왼쪽에서 교재를 선택하거나 새로 추가하세요.</p>
          ) : current.matchKey ? (
            <MatchSummary name={current.name} items={items} />
          ) : (
            <ItemEditor key={current.id} workbook={current}
              items={items} onSave={next => setWBItems(current.id, next)} />
          )}
        </div>
      </div>

      {adding && <BookCatalogDialog onClose={() => setAdding(false)}
        existingKeys={new Set(workbooks.map(w => w.matchKey).filter((k): k is string => !!k))}
        onAdd={books => {
          let last: string | null = null
          // 현재 과목으로 태깅 (course로 유도되면 그 값 우선)
          for (const b of books) last = addWorkbook({ ...b, subject: subjectOfCourse(b.course) ?? subject })
          if (last) setSel(last)
          setAdding(false)
        }} />}
    </div>
  )
}

function ItemEditor({ workbook, items, onSave }: {
  workbook: Workbook; items: WBItem[]; onSave: (items: WBItem[]) => void
}) {
  const workbookId = workbook.id
  const name = workbook.name
  const [rows, setRows] = useState<WBItem[]>(items)
  const [page, setPage] = useState(items.at(-1)?.page ?? 1)
  const [bulk, setBulk] = useState(false)

  function addRow() {
    const lastNo = rows.filter(r => r.page === page).at(-1)?.no ?? 0
    setRows(prev => [...prev, {
      id: uid('wi'), workbookId, page, no: lastNo + 1,
      typeId: CURRICULA[0].units[0].mids[0].subs[0].types[0].id, kind: '객관식', answer: '',
    }])
  }
  function patch(id: string, p: Partial<WBItem>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...p } : r))
  }
  function del(id: string) { setRows(prev => prev.filter(r => r.id !== id)) }

  const dirty = JSON.stringify(rows) !== JSON.stringify(items)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-bold">{name} — 정답표</h2>
        <div className="grow" />
        <label className="flex items-center gap-1 text-sm">페이지
          <input type="number" min={1} value={page} onChange={e => setPage(Number(e.target.value) || 1)}
            className="w-16 rounded border border-line px-2 py-1" /></label>
        <button onClick={addRow} className="rounded-lg border border-pine px-3 py-1.5 text-sm font-semibold text-pine hover:bg-pine-soft">+ 문항</button>
        <button onClick={() => setBulk(true)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-paper2">📋 일괄 등록</button>
        <button disabled={!dirty} onClick={() => onSave(rows)}
          className="rounded-lg bg-amber px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40">저장</button>
      </div>

      {bulk && <BulkImportModal workbook={workbook} existing={rows}
        onSave={next => { setRows(next); setBulk(false) }} onClose={() => setBulk(false)} />}

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink2">
          페이지를 정하고 <b className="text-pine">+ 문항</b>으로 답지를 보고 정답·유형을 입력하세요.<br />
          문제 원문은 넣지 않습니다 — 번호·정답·유형만.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="py-2">쪽</th><th>번호</th><th>형태</th><th>정답</th><th>난이도</th><th className="w-1/2">유형</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-line/50">
                  <td className="py-1.5 pr-2"><input type="number" value={r.page} onChange={e => patch(r.id, { page: Number(e.target.value) || 1 })} className="w-14 rounded border border-line px-1.5 py-1" /></td>
                  <td className="pr-2"><input type="number" value={r.no} onChange={e => patch(r.id, { no: Number(e.target.value) || 1 })} className="w-14 rounded border border-line px-1.5 py-1" /></td>
                  <td className="pr-2">
                    <select value={r.kind} onChange={e => patch(r.id, { kind: e.target.value as Kind })} className="rounded border border-line px-1.5 py-1">
                      <option value="객관식">객관식</option><option value="주관식">주관식</option>
                    </select>
                  </td>
                  <td className="pr-2"><input value={r.answer} onChange={e => patch(r.id, { answer: e.target.value })} placeholder={r.kind === '객관식' ? '③' : '12'} className="w-16 rounded border border-line px-1.5 py-1" /></td>
                  <td className="pr-2">
                    <select value={r.diff ?? ''} onChange={e => patch(r.id, { diff: e.target.value ? Number(e.target.value) as Diff : undefined })} className="rounded border border-line px-1.5 py-1">
                      <option value="">-</option>
                      {DIFFS.map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
                    </select>
                  </td>
                  <td className="pr-2">
                    <select value={r.typeId} onChange={e => patch(r.id, { typeId: e.target.value })} className="w-full rounded border border-line px-1.5 py-1">
                      {CURRICULA.map(c => (
                        <optgroup key={c.id} label={`${c.grade} ${c.label.replace(' (22개정)', '')}`}>
                          {c.units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => (
                            <option key={t.id} value={t.id}>{u.name} › {t.name}</option>
                          )))))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td><button onClick={() => del(r.id)} className="text-line hover:text-clay">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 매칭 교재 요약 (읽기 전용) — 문항·유형이 시중교재 매칭표에서 자동으로 붙는다
function MatchSummary({ name, items }: { name: string; items: WBItem[] }) {
  const pages = items.map(i => i.page).filter(p => p > 0)
  const typeCount = new Set(items.map(i => i.typeId)).size
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.typeId, (m.get(i.typeId) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [items])
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-bold">{name}</h2>
        <span className="rounded-full bg-pine-soft px-3 py-1 text-xs font-bold text-pine-dark">시중교재 자동 매칭</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink2">매칭 데이터를 불러오는 중…</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink2">
            <b className="text-ink">{items.length}문항</b> · <b className="text-ink">{typeCount}개 유형</b>
            {pages.length ? <> · {Math.min(...pages)}~{Math.max(...pages)}쪽</> : null}
            <br />각 문항이 유형(conceptId)에 자동 연결돼 있어, <b>수업 → 교재</b>에서 OX채점만 하면 틀린 유형의 쌍둥이·유사 문제로 오답 드릴이 만들어집니다. (문제 원문·정답은 저장하지 않음)
          </p>
          <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper2">
                <tr className="text-left text-xs text-ink2"><th className="px-3 py-2">유형</th><th className="py-2 pr-3 text-right">문항 수</th></tr>
              </thead>
              <tbody>
                {byType.map(([tid, n]) => (
                  <tr key={tid} className="border-t border-line/50">
                    <td className="px-3 py-1.5">{typeName(tid)}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
