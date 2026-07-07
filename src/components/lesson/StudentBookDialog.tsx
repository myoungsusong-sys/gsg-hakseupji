import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Student } from '../../types'
import BookCatalogDialog from '../BookCatalogDialog'

// 매쓰플랫 「(학생명) 학생 교재」 다이얼로그 — 등록된 교재 중 채점할 교재 선택
const TABS = ['전체', '내 교재', '시그니처 교재', '시중교재', '교과서'] as const
type Tab = typeof TABS[number]

export default function StudentBookDialog({ student, currentId, onSelect, onClose }: {
  student: Student
  currentId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const { workbooks, gradings, addWorkbook, removeWorkbook } = useStore()
  const [selId, setSelId] = useState<string | null>(currentId)
  const [tab, setTab] = useState<Tab>('전체')
  const [catalog, setCatalog] = useState(false)

  const rows = useMemo(() => {
    return [...workbooks]
      // 학생 학년과 같은 과정 우선 (stable sort)
      .sort((a, b) => (a.grade === student.grade ? 0 : 1) - (b.grade === student.grade ? 0 : 1))
      .map(w => {
        // gradings는 최신순 정렬 → 이 학생·교재의 첫 기록이 최근 진도
        const last = gradings.find(g => g.studentId === student.id && g.workbookId === w.id && g.pageTo != null)
        return { w, progress: last?.pageTo != null ? `${last.pageTo}p` : '-' }
      })
  }, [workbooks, gradings, student.id, student.grade])

  // 시중교재 = 쌍둥이 매칭키 보유 · 내 교재 = 직접 입력 (시그니처·교과서는 데이터 없음)
  const visible = useMemo(() => {
    if (tab === '전체') return rows
    if (tab === '내 교재') return rows.filter(r => !r.w.matchKey)
    if (tab === '시중교재') return rows.filter(r => !!r.w.matchKey)
    return []
  }, [rows, tab])

  const isMarket = tab === '시중교재'

  const existingKeys = useMemo(
    () => new Set(workbooks.map(w => w.matchKey).filter((k): k is string => !!k)),
    [workbooks],
  )

  function cancelIssue() {
    if (!selId) return
    if (!confirm('이 교재를 제거할까요? 이 교재의 채점 기록도 함께 삭제됩니다.')) return
    removeWorkbook(selId)
    setSelId(null)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-lg font-bold">{student.name} 학생 교재</h3>
          <div className="grow" />
          <button onClick={onClose} className="text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 탭: 전체 | 내 교재 | 시그니처 교재 | 시중교재 | 교과서 */}
        <div className="mb-3 flex gap-1 border-b border-line text-sm">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px px-3 py-2 font-semibold ${tab === t ? 'border-b-2 border-ink font-bold text-ink' : 'text-ink2 hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 grow overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper2">
              <tr className="text-left text-xs text-ink2">
                <th className="px-3 py-2">학년</th><th className="py-2">교재명</th>
                {isMarket && <th>정답</th>}
                <th>출판사</th><th className="px-3 text-right">최근진도</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ w, progress }) => {
                const on = selId === w.id
                return (
                  <tr key={w.id} onClick={() => setSelId(w.id)}
                    className={`cursor-pointer border-t border-line/50 ${on ? 'bg-pine-soft/50' : 'hover:bg-paper2'}`}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink2">{w.grade}</td>
                    <td className={`py-2 pr-2 font-semibold ${on ? 'text-pine-dark' : ''}`}>
                      {w.name}
                      {w.matchKey && (
                        <span className="ml-1.5 rounded bg-lime-100 px-1.5 py-0.5 text-[10px] font-bold text-lime-700">쌍둥이 지원</span>
                      )}
                    </td>
                    {isMarket && <td className="whitespace-nowrap py-2 pr-2 text-xs text-ink2">지원</td>}
                    <td className="whitespace-nowrap py-2 pr-2 text-xs text-ink2">{w.publisher}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold">{progress}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="whitespace-pre-line p-8 text-center text-sm text-ink2">{'검색 결과가 없습니다.\n다시 입력해주세요.'}</p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={cancelIssue} disabled={!selId}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:bg-paper2 disabled:opacity-40">
            출제 취소
          </button>
          <button onClick={() => setCatalog(true)}
            className="rounded-lg border border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine-soft">
            ＋ 다른 교재 출제
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
