import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { typeName } from '../data/curriculum'
import { CONCEPTS } from '../data/concepts'
import MathText from '../components/MathText'
import type { Problem } from '../types'
import { DEFAULT_SHEET_OPTIONS, DIFF_LABEL, THEMES } from '../types'

export default function WorksheetView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { worksheets, problems } = useStore()
  const [withAnswers, setWithAnswers] = useState(true)

  const ws = worksheets.find(w => w.id === id)
  const items = useMemo(
    () => (ws?.problemIds ?? []).map(pid => problems.find(p => p.id === pid)).filter(p => p != null),
    [ws, problems],
  )

  if (!ws) return <div className="text-ink2">학습지를 찾을 수 없습니다.</div>
  const theme = THEMES[ws.theme]
  const opts = ws.options ?? DEFAULT_SHEET_OPTIONS

  const dateText = opts.showDate
    ? (opts.customDate
        ? opts.customDate.replaceAll('-', '. ') + '.'
        : new Date(ws.createdAt).toLocaleDateString('ko-KR'))
    : null

  const spacingMm = [0, 3, 5, 7, 9, 12][opts.spacing] // 문제 간격 단계 → 여백

  const caption = (p: Problem) => {
    const parts: string[] = []
    if (opts.showTypeName) parts.push(typeName(p.typeId))
    if (opts.showDiff) parts.push(DIFF_LABEL[p.diff])
    if (opts.showCorrectRate && p.correctRate != null) parts.push(`정답률 ${p.correctRate}%`)
    if (opts.showNew && p.isNew) parts.push('신경향')
    return parts.join(' · ')
  }

  const concepts = (ws.conceptIds ?? [])
    .map(cid => CONCEPTS.find(c => c.id === cid))
    .filter(c => c != null)

  const gridClass =
    opts.layout === 'split2' ? 'grid grid-cols-1'
    : opts.layout === 'split4' ? 'grid grid-cols-2'
    : opts.layout === 'split6' ? 'grid grid-cols-2'
    : ''

  const cellMinH =
    opts.layout === 'split2' ? 'min-h-[120mm]'
    : opts.layout === 'split4' ? 'min-h-[110mm]'
    : opts.layout === 'split6' ? 'min-h-[72mm]'
    : ''

  return (
    <div>
      <div className="no-print mb-6 flex items-center gap-3">
        <button onClick={() => nav('/')} className="rounded-lg border border-line px-4 py-2 text-sm">← 목록</button>
        <button onClick={() => nav(`/make?edit=${ws.id}`)} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-pine hover:text-pine">✏ 수정</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withAnswers} onChange={e => setWithAnswers(e.target.checked)}
            className="h-4 w-4 accent-pine" />
          빠른 정답·해설지 포함
        </label>
        <div className="grow" />
        <button onClick={() => window.print()}
          className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">
          🖨 인쇄 / PDF 저장
        </button>
      </div>

      {/* ── 시험지 본문 ── */}
      <div className="print-root mx-auto max-w-4xl rounded-xl border border-line bg-white p-10 shadow-md">
        <div className="sheet-page">
          {/* 머리글 */}
          <div className="mb-2 flex items-center gap-3">
            <span className="rounded-md px-2.5 py-1 text-sm font-black text-white" style={{ background: theme.main }}>
              {ws.grade}
            </span>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: theme.main }}>{ws.title}</h1>
          </div>
          <div className="flex items-center justify-between border-b-2 pb-3 text-xs text-ink2" style={{ borderColor: theme.main }}>
            <span>
              {dateText && <>{dateText} | </>}
              {items.length}문제 | 출제 {ws.author}
              {ws.tags.length > 0 && <> | {ws.tags.join(' · ')}</>}
            </span>
            <span className="font-semibold text-ink">이름 ______________</span>
          </div>

          {/* 개념 정리 */}
          {concepts.length > 0 && (
            <div className="sheet-problem mt-6 rounded-lg border p-4" style={{ borderColor: theme.main }}>
              <div className="mb-2 text-sm font-black" style={{ color: theme.main }}>■ 개념 정리</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {concepts.map(c => (
                  <div key={c.id}>
                    <b className="text-[13px]">{c.title}</b>
                    {c.lines.map((l, li) => (
                      <div key={li} className="text-[12px] leading-relaxed text-ink2">· <MathText text={l} /></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 문제 배치 */}
          {opts.layout === 'basic' ? (
            <div className="sheet-cols mt-6">
              {items.map((p, i) => (
                <div key={p.id} className="sheet-problem" style={{ marginBottom: `${spacingMm}mm` }}>
                  <ProblemBlock p={p} idx={i} caption={caption(p)} themeMain={theme.main} />
                  {opts.wrongNoteArea && (
                    <div className="mt-2 rounded border border-dashed border-line p-1 text-[9px] text-ink2">
                      오답 노트
                      <div className="h-14" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`${gridClass} mt-6 gap-x-8`} style={{ rowGap: `${spacingMm}mm` }}>
              {items.map((p, i) => (
                <div key={p.id} className={`sheet-problem border-b border-dotted border-line pb-3 ${cellMinH}`}>
                  <ProblemBlock p={p} idx={i} caption={caption(p)} themeMain={theme.main} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 정답·해설지 ── */}
        {withAnswers && (
          <div className="sheet-page mt-10 border-t-4 border-double pt-6" style={{ borderColor: theme.main }}>
            <h2 className="mb-4 text-xl font-black" style={{ color: theme.main }}>빠른 정답 · 해설</h2>
            <div className="mb-6 grid grid-cols-5 gap-1 rounded-lg border border-line p-3 text-center text-sm">
              {items.map((p, i) => (
                <div key={p.id} className="py-0.5">
                  <b>{i + 1}</b>. <MathText text={p.answer} />
                </div>
              ))}
            </div>
            <div className="grid gap-3">
              {items.map((p, i) => (
                <div key={p.id} className="sheet-problem text-[12.5px] leading-relaxed">
                  <b style={{ color: theme.main }}>{String(i + 1).padStart(2, '0')}</b>{' '}
                  {opts.solutionWithBody && (
                    <div className="mb-1 rounded bg-paper2/60 p-2 text-[12px]">
                      <MathText text={p.body} />
                      {p.choices && (
                        <div className="mt-1 flex flex-wrap gap-x-4 text-ink2">
                          {p.choices.map((c, ci) => <span key={ci}>{'①②③④⑤'[ci]} <MathText text={c} /></span>)}
                        </div>
                      )}
                    </div>
                  )}
                  <b><MathText text={p.answer} /></b>{' — '}
                  <MathText text={p.solution} className="text-ink2" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProblemBlock({ p, idx, caption, themeMain }: {
  p: Problem; idx: number; caption: string; themeMain: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-lg font-black" style={{ color: themeMain }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
        {caption && <span className="text-[10px] text-ink2">{caption}</span>}
      </div>
      {p.imageUrl
        ? <img src={p.imageUrl} alt={p.body} className="w-full" />
        : <>
            <MathText text={p.body} className="text-[13.5px] leading-relaxed" />
            {p.choices && (
              <div className="mt-1.5 grid gap-0.5 pl-1 text-[13px]">
                {p.choices.map((c, ci) => (
                  <span key={ci}>{'①②③④⑤'[ci]} <MathText text={c} /></span>
                ))}
              </div>
            )}
          </>}
      {p.kind === '주관식' && !p.imageUrl && <div className="mt-5 border-b border-dotted border-line" />}
    </div>
  )
}
