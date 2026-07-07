import { useMemo, useState } from 'react'
import { CURRICULA } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import type { Diff, Kind, WBItem } from '../types'
import { DIFF_LABEL, DIFFS } from '../types'

// 시중문제집 관리: 정답표(문항→정답·유형)만 등록. 문제 원문은 저장하지 않는다.
export default function Workbooks() {
  const { workbooks, wbItems, addWorkbook, removeWorkbook, setWBItems } = useStore()
  const [sel, setSel] = useState<string | null>(workbooks[0]?.id ?? null)
  const [adding, setAdding] = useState(false)

  const current = workbooks.find(w => w.id === sel) ?? null
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
          {workbooks.length === 0 && (
            <p className="px-1 text-sm text-ink2">내가 쓰는 문제집을 추가하세요. (쎈, RPM 등)</p>
          )}
          {workbooks.map(w => (
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

        {/* 정답표 편집 */}
        <div className="rounded-2xl border border-line bg-white p-6">
          {!current ? (
            <p className="text-sm text-ink2">왼쪽에서 교재를 선택하거나 새로 추가하세요.</p>
          ) : (
            <ItemEditor key={current.id} workbookId={current.id} name={current.name}
              items={items} onSave={next => setWBItems(current.id, next)} />
          )}
        </div>
      </div>

      {adding && <AddWorkbookModal onClose={() => setAdding(false)}
        onAdd={w => { const id = addWorkbook(w); setSel(id); setAdding(false) }} />}
    </div>
  )
}

function ItemEditor({ workbookId, name, items, onSave }: {
  workbookId: string; name: string; items: WBItem[]; onSave: (items: WBItem[]) => void
}) {
  const [rows, setRows] = useState<WBItem[]>(items)
  const [page, setPage] = useState(items.at(-1)?.page ?? 1)

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
        <button disabled={!dirty} onClick={() => onSave(rows)}
          className="rounded-lg bg-amber px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40">저장</button>
      </div>

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

function AddWorkbookModal({ onClose, onAdd }: { onClose: () => void; onAdd: (w: { name: string; publisher: string; grade: string }) => void }) {
  const [name, setName] = useState('')
  const [publisher, setPublisher] = useState('')
  const [grade, setGrade] = useState('중1-1')
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold">교재 추가</h3>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1 font-bold">교재명
            <input value={name} onChange={e => setName(e.target.value)} placeholder="쎈 중등수학 1(상)"
              className="rounded-lg border border-line px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 font-bold">출판사
            <input value={publisher} onChange={e => setPublisher(e.target.value)} placeholder="좋은책신사고"
              className="rounded-lg border border-line px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 font-bold">학년·학기
            <input value={grade} onChange={e => setGrade(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 font-normal" /></label>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-4 py-2">취소</button>
            <button onClick={() => name.trim() ? onAdd({ name: name.trim(), publisher: publisher.trim(), grade }) : alert('교재명을 입력하세요.')}
              className="rounded-lg bg-pine px-5 py-2 font-bold text-paper">추가</button>
          </div>
        </div>
      </div>
    </div>
  )
}
