import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { examTitle, type ExamPaper } from './CsatLibrary'

// 기출 회차 열람·인쇄 (원본 이미지 그대로)
export default function GichulView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [papers, setPapers] = useState<ExamPaper[] | null>(null)
  const [withSolution, setWithSolution] = useState(false)

  useEffect(() => {
    fetch('/gichul/index.json').then(r => r.json()).then(setPapers).catch(() => setPapers([]))
  }, [])

  if (papers === null) return <div className="text-ink2">불러오는 중…</div>
  const p = papers.find(x => x.id === id)
  if (!p) return <div className="text-ink2">회차를 찾을 수 없습니다.</div>

  const qPages = Array.from({ length: p.qPages }, (_, i) => `/gichul/${p.id}/q${i + 1}.png`)
  const sPages = Array.from({ length: p.sPages }, (_, i) => `/gichul/${p.id}/s${i + 1}.png`)

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/prep/csat')} className="rounded-lg border border-line px-4 py-2 text-sm">← 기출 목록</button>
        <div className="text-sm font-bold">{p.grade} · {examTitle(p)} (수학, {p.region})</div>
        {p.sPages > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withSolution} onChange={e => setWithSolution(e.target.checked)} className="h-4 w-4 accent-pine" />
            해설 포함
          </label>
        )}
        <div className="grow" />
        <span className="text-xs text-ink2">EBSi 학력평가 기출 · 출처 표기 후 학습용 배포</span>
        <button onClick={() => window.print()} className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">🖨 인쇄 / PDF 저장</button>
      </div>

      <div className="print-root mx-auto max-w-4xl">
        {qPages.map((src, i) => (
          <img key={src} src={src} alt={`문제 ${i + 1}쪽`} className="sheet-page mx-auto mb-3 w-full border border-line bg-white shadow-sm" />
        ))}
        {withSolution && sPages.map((src, i) => (
          <img key={src} src={src} alt={`해설 ${i + 1}쪽`} className="sheet-page mx-auto mb-3 w-full border border-line bg-white shadow-sm" />
        ))}
      </div>
    </div>
  )
}
