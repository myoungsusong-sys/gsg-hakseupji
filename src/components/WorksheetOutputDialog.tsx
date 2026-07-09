import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Worksheet } from '../types'

/* 매쓰플랫 「학습지 다운로드/인쇄」 다이얼로그 (오답루프실사_매쓰플랫_2026-07-08.md §4)
   - 분류 선택 토글칩 4종: 문제지(기본 ✓) · 빠른정답 · 정답해설(기본 ✓) · OMR
   - 학생 이름: ◉ 표시 안 함 / ○ 학생 이름 표시
   - 다운 형식(download만): ◉ 하나의 PDF로 받기 / ○ 개별 PDF로 받기
   - 실행 → WorksheetView로 이동(?out=…&mode=…&name=…) → 조판 완료 후 자동 window.print()
   ※ 매쓰플랫의 매수·양면·흑백·프린터 선택은 서버 인쇄 전제 → 우리는 브라우저 인쇄창이 담당 */

export const OUTPUT_PARTS = ['문제지', '빠른정답', '정답해설', 'OMR'] as const
export type OutputPart = (typeof OUTPUT_PARTS)[number]

export default function WorksheetOutputDialog({ mode, ws, extraWs, studentNames, onClose }: {
  mode: 'download' | 'print'
  ws: Worksheet
  extraWs?: Worksheet[]         // 다중 선택 시 나머지 학습지 — 같은 옵션으로 새 탭에서 자동 인쇄
  studentNames: string[]        // 이 학습지가 출제된 학생명 (이름 표시 옵션용)
  onClose: () => void
}) {
  const nav = useNavigate()
  const [parts, setParts] = useState<Set<OutputPart>>(new Set(['문제지', '정답해설']))
  const [showName, setShowName] = useState(false)
  const [name, setName] = useState(studentNames[0] ?? '')
  const [pdfMode, setPdfMode] = useState<'one' | 'each'>('one')

  const actionLabel = mode === 'download' ? '다운로드' : '인쇄하기'

  function togglePart(p: OutputPart) {
    setParts(prev => {
      const n = new Set(prev)
      if (n.has(p)) n.delete(p); else n.add(p)
      return n
    })
  }

  function run() {
    const sel = OUTPUT_PARTS.filter(p => parts.has(p))   // 매쓰플랫 합본 순서 고정
    if (sel.length === 0) return
    const sp = new URLSearchParams()
    sp.set('out', sel.join(','))
    sp.set('mode', mode === 'download' ? pdfMode : 'one')
    if (showName && name) sp.set('name', name)
    onClose()
    // 다중 선택: 나머지 학습지는 같은 옵션으로 새 탭에서 자동 인쇄 (팝업 차단 시 허용 필요)
    for (const w of extraWs ?? []) window.open(`#/worksheet/${w.id}?${sp.toString()}`, '_blank')
    nav(`/worksheet/${ws.id}?${sp.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        {/* 제목 줄: 「학습지 다운로드  <학습지명>」 + ✕ */}
        <div className="mb-5 flex items-start gap-3">
          <h3 className="text-base font-bold">
            학습지 {mode === 'download' ? '다운로드' : '인쇄'}
            <span className="ml-2 align-middle text-sm font-semibold text-ink2">
              {ws.title}{extraWs && extraWs.length > 0 && ` 외 ${extraWs.length}개`}
            </span>
          </h3>
          <button onClick={onClose} className="ml-auto text-lg leading-none text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 학생 이름 표시 */}
        <div className="mb-2 text-sm font-bold">학생 이름</div>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="wsout-name" className="h-4 w-4 accent-blue-600"
              checked={!showName} onChange={() => setShowName(false)} />
            표시 안 함
          </label>
          <label className={`flex items-center gap-1.5 ${studentNames.length === 0 ? 'opacity-40' : 'cursor-pointer'}`}>
            <input type="radio" name="wsout-name" className="h-4 w-4 accent-blue-600"
              disabled={studentNames.length === 0}
              checked={showName} onChange={() => setShowName(true)} />
            학생 이름 표시
          </label>
          {showName && studentNames.length > 1 && (
            <select value={name} onChange={e => setName(e.target.value)}
              className="rounded-lg border border-line px-2 py-1 text-sm">
              {studentNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {showName && studentNames.length === 1 && <b className="text-blue-600">{name}</b>}
          {studentNames.length === 0 && <span className="text-xs text-ink2">(출제된 학생 없음)</span>}
        </div>

        {/* 분류 선택 — 토글 칩 4종 (선택: 파란 테두리 + 연파랑) */}
        <div className="mb-2 text-sm font-bold">분류 선택</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {OUTPUT_PARTS.map(p => {
            const on = parts.has(p)
            return (
              <button key={p} type="button" onClick={() => togglePart(p)}
                className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold ${
                  on ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-line bg-white text-ink2 hover:text-ink'}`}>
                {p}
              </button>
            )
          })}
        </div>

        {/* 다운 형식 (download 모드만) */}
        {mode === 'download' && (
          <>
            <div className="mb-2 text-sm font-bold">다운 형식</div>
            <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="wsout-pdfmode" className="h-4 w-4 accent-blue-600"
                  checked={pdfMode === 'one'} onChange={() => setPdfMode('one')} />
                하나의 PDF로 받기
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="wsout-pdfmode" className="h-4 w-4 accent-blue-600"
                  checked={pdfMode === 'each'} onChange={() => setPdfMode('each')} />
                개별 PDF로 받기
              </label>
            </div>
            <p className="mb-4 text-xs text-ink2">
              인쇄창에서 대상 프린터를 <b>PDF로 저장</b>으로 선택하면 됩니다. 개별 PDF는 분류별로 인쇄창이 순서대로 열립니다.
            </p>
          </>
        )}
        {mode === 'print' && (
          <p className="mb-4 text-xs text-ink2">매수·양면·흑백·역순 등은 이어서 열리는 브라우저 인쇄창에서 설정합니다.</p>
        )}

        <div className="flex justify-end">
          <button onClick={run} disabled={parts.size === 0}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
