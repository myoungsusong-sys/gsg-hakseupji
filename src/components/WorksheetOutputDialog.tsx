import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Worksheet } from '../types'

/* 매쓰플랫 「학습지 다운로드/인쇄」 다이얼로그 (오답루프실사_매쓰플랫_2026-07-08.md §4)
   - 분류 선택 토글칩 4종: 문제지(기본 ✓) · 빠른정답 · 정답해설(기본 ✓) · OMR
   - 학생 이름: ◉ 표시 안 함 / ○ 학생 이름 표시
   - 다운 형식(download만): ◉ 하나의 PDF로 받기 / ○ 개별 PDF로 받기
   - 실행 → WorksheetView로 이동(?out=…&mode=…&name=…) → 조판 완료 후 자동 window.print()
   ※ 매쓰플랫의 매수·양면·흑백·프린터 선택은 서버 인쇄 전제 → 우리는 브라우저 인쇄창이 담당 */

export const OUTPUT_PARTS = ['문제지', '문제+정답', '빠른정답', '정답해설', 'OMR'] as const
export type OutputPart = (typeof OUTPUT_PARTS)[number]

export default function WorksheetOutputDialog({ mode, ws, extraWs, studentNames, studentList, onClose }: {
  mode: 'download' | 'print'
  ws: Worksheet
  extraWs?: Worksheet[]         // 다중 선택 시 나머지 학습지 — 같은 옵션으로 새 탭에서 자동 인쇄
  studentNames: string[]        // 이 학습지가 출제된 학생명 (이름 표시 옵션용)
  studentList?: { id: string; name: string }[]   // 같은 학생들의 id — 주면 학생마다 다른 QR 이 찍힌다
  onClose: () => void
}) {
  const nav = useNavigate()
  const [parts, setParts] = useState<Set<OutputPart>>(new Set(['문제지', '정답해설']))
  const [showName, setShowName] = useState(false)
  const [name, setName] = useState(studentNames[0] ?? '')
  const [pdfMode, setPdfMode] = useState<'one' | 'each'>('one')
  // 이름 찍을 학생 — 한 명(name) 또는 출제받은 학생 모두(한 파일에 학생 수만큼 이어 뽑는다)
  const [allNames, setAllNames] = useState(false)
  // 출력 옵션 — 매수 · 쪽 범위 · 역순 · 흑백 (양면·프린터는 브라우저 인쇄 창에서)
  const [copies, setCopies] = useState(1)
  const [rangeMode, setRangeMode] = useState<'all' | 'pick'>('all')
  const [pages, setPages] = useState('')
  const [reverse, setReverse] = useState(false)
  const [bw, setBw] = useState(false)
  const idOf = (n: string) => studentList?.find(x => x.name === n)?.id

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
    sp.set('act', mode)                                  // download=PDF 저장 / print=PDF 만들어 바로 인쇄창
    if (showName && allNames && studentNames.length > 1) {
      for (const n of studentNames) sp.append('who', `${idOf(n) ?? ''}~${n}`)
    } else if (showName && name) {
      sp.set('name', name)
      const id = idOf(name)
      if (id) sp.set('sid', id)
    }
    if (copies > 1) sp.set('copies', String(copies))
    if (rangeMode === 'pick' && pages.trim()) sp.set('pages', pages.trim())
    if (reverse) sp.set('rev', '1')
    if (bw) sp.set('bw', '1')
    onClose()
    // 다중 선택: 나머지 학습지는 같은 옵션으로 새 탭에서 자동 인쇄 (팝업 차단 시 허용 필요)
    for (const w of extraWs ?? []) window.open(`#/worksheet/${w.id}?${sp.toString()}`, '_blank')
    nav(`/worksheet/${ws.id}?${sp.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
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
            <select value={allNames ? '__all__' : name}
              onChange={e => { if (e.target.value === '__all__') setAllNames(true); else { setAllNames(false); setName(e.target.value) } }}
              className="rounded-lg border border-line px-2 py-1 text-sm">
              <option value="__all__">출제받은 학생 모두 ({studentNames.length}명)</option>
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

        {/* 출력 옵션 — 매수 · 범위 · 역순 · 흑백 */}
        <div className="mb-2 text-sm font-bold">출력 옵션</div>
        <div className="mb-4 grid gap-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-10 text-ink2">매수</span>
            <div className="flex items-center rounded-lg border border-line">
              <button type="button" onClick={() => setCopies(c => Math.max(1, c - 1))} className="px-3 py-1 text-ink2 hover:text-ink" aria-label="매수 줄이기">−</button>
              <span className="w-8 text-center font-bold tabular-nums">{copies}</span>
              <button type="button" onClick={() => setCopies(c => Math.min(30, c + 1))} className="px-3 py-1 text-ink2 hover:text-ink" aria-label="매수 늘리기">+</button>
            </div>
            <label className="ml-2 flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={bw} onChange={e => setBw(e.target.checked)} /> 흑백
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={reverse} onChange={e => setReverse(e.target.checked)} /> 역순
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-10 text-ink2">범위</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="wsout-range" className="h-4 w-4 accent-blue-600" checked={rangeMode === 'all'} onChange={() => setRangeMode('all')} /> 전체
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="wsout-range" className="h-4 w-4 accent-blue-600" checked={rangeMode === 'pick'} onChange={() => setRangeMode('pick')} /> 쪽 선택
            </label>
            <input value={pages} onChange={e => { setPages(e.target.value); setRangeMode('pick') }}
              placeholder="예) 1,3,5-7" disabled={rangeMode !== 'pick'}
              className="w-32 rounded-lg border border-line px-2 py-1 text-sm disabled:bg-paper2 disabled:text-ink2" />
          </div>
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
              <b>PDF 파일이 바로 저장됩니다.</b> 개별 PDF는 분류별 파일(문제지·정답해설…)로 나뉘어 저장됩니다.
            </p>
          </>
        )}
        {mode === 'print' && (
          <p className="mb-4 text-xs text-ink2">
            PDF로 만들어 인쇄창을 엽니다 — 여백·배율 설정과 무관하게 화면 그대로 출력됩니다. 양면 인쇄와 프린터는 인쇄창에서 고르세요.
          </p>
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
