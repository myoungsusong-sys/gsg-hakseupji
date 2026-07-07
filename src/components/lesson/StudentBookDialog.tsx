import { useMemo, useState } from 'react'
import { WB_MATCH_BOOKS } from '../../data/wbMatch'
import { useStore } from '../../lib/store'
import type { Student } from '../../types'
import BookCatalogDialog from '../BookCatalogDialog'

// 매쓰플랫 「(학생명) 학생 교재」 다이얼로그 — 등록된 교재 중 채점할 교재 선택
export default function StudentBookDialog({ student, currentId, onSelect, onClose }: {
  student: Student
  currentId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const { workbooks, wbItems, gradings, addWorkbook } = useStore()
  const [selId, setSelId] = useState<string | null>(currentId)
  const [catalog, setCatalog] = useState(false)

  const rows = useMemo(() => {
    const matchCount = new Map(WB_MATCH_BOOKS.map(b => [b.key, b.count]))
    return [...workbooks]
      // 학생 학년과 같은 과정 우선 (stable sort)
      .sort((a, b) => (a.grade === student.grade ? 0 : 1) - (b.grade === student.grade ? 0 : 1))
      .map(w => {
        const count = wbItems.filter(i => i.workbookId === w.id).length
          || (w.matchKey ? matchCount.get(w.matchKey) ?? 0 : 0)
        // gradings는 최신순 정렬 → 이 학생·교재의 첫 기록이 최근 진도
        const last = gradings.find(g => g.studentId === student.id && g.workbookId === w.id && g.pageTo != null)
        return { w, count, progress: last?.pageTo != null ? `~${last.pageTo}쪽` : '-' }
      })
  }, [workbooks, wbItems, gradings, student.id, student.grade])

  const existingKeys = useMemo(
    () => new Set(workbooks.map(w => w.matchKey).filter((k): k is string => !!k)),
    [workbooks],
  )

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-lg font-bold">「{student.name}」 학생 교재</h3>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>

        <div className="min-h-0 grow overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper2">
              <tr className="text-left text-xs text-ink2">
                <th className="w-8 px-3 py-2"></th><th className="py-2">학년</th><th>교재명</th><th>출판사</th>
                <th className="text-right">문항 수</th><th className="px-3 text-right">최근 진도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ w, count, progress }) => {
                const on = selId === w.id
                return (
                  <tr key={w.id} onClick={() => setSelId(w.id)}
                    className={`cursor-pointer border-t border-line/50 ${on ? 'bg-pine-soft/50' : 'hover:bg-paper2'}`}>
                    <td className="px-3 py-2">
                      <input type="radio" checked={on} readOnly className="pointer-events-none accent-[var(--color-pine,#2e6b4f)]" />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 text-xs text-ink2">{w.grade}</td>
                    <td className={`py-2 pr-2 font-semibold ${on ? 'text-pine-dark' : ''}`}>{w.name}</td>
                    <td className="whitespace-nowrap py-2 pr-2 text-xs text-ink2">{w.publisher}</td>
                    <td className="whitespace-nowrap py-2 text-right text-xs text-ink2">{count}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold">{progress}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-8 text-center text-sm text-ink2">등록된 교재가 없습니다. 아래에서 교재를 등록하세요.</p>}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setCatalog(true)}
            className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">
            ＋ 다른 교재 등록
          </button>
          <div className="grow" />
          <button onClick={() => { if (selId) { onSelect(selId); onClose() } }} disabled={!selId}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper disabled:opacity-40">
            선택 완료
          </button>
        </div>

        {catalog && (
          <BookCatalogDialog
            defaultGrade={student.grade}
            existingKeys={existingKeys}
            onClose={() => setCatalog(false)}
            onAdd={books => {
              let last: string | null = null
              for (const b of books) last = addWorkbook(b)
              if (last) setSelId(last)   // 마지막 교재 자동 선택
              setCatalog(false)
            }} />
        )}
      </div>
    </div>
  )
}
