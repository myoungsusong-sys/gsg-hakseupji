import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { typeName, typeUnitName } from '../data/curriculum'
import { CONCEPTS } from '../data/concepts'
import MathText from '../components/MathText'
import VideoModal from '../components/VideoModal'
import type { Problem } from '../types'
import { DEFAULT_SHEET_OPTIONS, DIFF_LABEL, THEMES } from '../types'

// 매쓰플랫 원본 PDF 실물 기준 3부 구성: 문제지 → 빠른정답(별지) → 해설지(별지, 2단)
// 인쇄 구성은 3개 독립 토글로 선택 (문제만 / 정답만 / 해설만 / 조합 전부 가능)
export default function WorksheetView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { worksheets, problems } = useStore()
  const [showSheet, setShowSheet] = useState(true)
  const [showQuick, setShowQuick] = useState(true)
  const [showSol, setShowSol] = useState(true)
  const [video, setVideo] = useState<{ src: string; subtitle?: string; title: string } | null>(null)

  const ws = worksheets.find(w => w.id === id)
  const items = useMemo(
    () => (ws?.problemIds ?? []).map(pid => problems.find(p => p.id === pid)).filter(p => p != null),
    [ws, problems],
  )

  if (!ws) return <div className="text-ink2">학습지를 찾을 수 없습니다.</div>
  const theme = THEMES[ws.theme]
  const opts = ws.options ?? DEFAULT_SHEET_OPTIONS

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const dateText = opts.showDate
    ? (opts.customDate ? opts.customDate.replaceAll('-', '.') : fmtDate(new Date(ws.createdAt)))
    : null

  // 부제: 범위 요약 (첫 문항 유형의 대단원 · 중단원)
  const subtitle = items.length ? typeUnitName(items[0].typeId) : ''

  const spacingMm = [0, 3, 5, 7, 9, 12][opts.spacing]

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

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => nav('/')} className="rounded-lg border border-line px-4 py-2 text-sm">← 목록</button>
        <button onClick={() => nav(`/make?edit=${ws.id}`)} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-pine hover:text-pine">✏ 수정</button>
        {/* 인쇄 구성 선택 (매쓰플랫 원본 PDF의 3부 구성) */}
        <div className="flex items-center gap-1 rounded-lg border border-line p-1 text-sm">
          {([
            ['문제지', showSheet, setShowSheet],
            ['빠른정답', showQuick, setShowQuick],
            ['정답해설', showSol, setShowSol],
          ] as const).map(([label, on, set]) => (
            <button key={label} onClick={() => set(!on)}
              className={`rounded-md px-3 py-1.5 font-semibold ${on ? 'bg-pine text-paper' : 'text-ink2 hover:bg-paper2'}`}>
              {on ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
        <div className="grow" />
        <button onClick={() => window.print()}
          disabled={!showSheet && !showQuick && !showSol}
          className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark disabled:opacity-40">
          🖨 인쇄 / PDF 저장
        </button>
      </div>

      <div className="print-root mx-auto max-w-4xl rounded-xl border border-line bg-white p-10 shadow-md">
        {/* ══ 1부. 문제지 ══ */}
        {showSheet && (
          <div className="sheet-page">
            <SheetHeader ws={{ grade: ws.grade, title: ws.title, author: ws.author }} subtitle={subtitle}
              dateText={dateText} count={items.length} theme={theme.main} />

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

            {opts.layout === 'basic' ? (
              opts.wrongNoteArea ? (
                /* 기본 + 오답 노트 영역: 매쓰플랫 실물 — 좌 문제 · 우 '풀이' 공간(괘선) */
                <div className="mt-6">
                  {items.map((p, i) => (
                    <div key={p.id} className="sheet-problem grid grid-cols-[1fr_42%] gap-x-6"
                      style={{ marginBottom: `${spacingMm + 8}mm` }}>
                      <ProblemBlock p={p} idx={i} caption={caption(p)} themeMain={theme.main} onVideo={(pp, ii) => setVideo({ src: pp.videoUrl!, subtitle: pp.subtitleUrl, title: `${ii + 1}번 풀이영상` })} />
                      <div className="min-h-[52mm]">
                        <div className="border-t border-ink/40 pt-1 text-[10px] text-ink2">풀이</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 기본: 매쓰플랫 실물 — 2단 흐름 배치 */
                <div className="sheet-cols mt-6">
                  {items.map((p, i) => (
                    <div key={p.id} className="sheet-problem" style={{ marginBottom: `${spacingMm}mm` }}>
                      <ProblemBlock p={p} idx={i} caption={caption(p)} themeMain={theme.main} onVideo={(pp, ii) => setVideo({ src: pp.videoUrl!, subtitle: pp.subtitleUrl, title: `${ii + 1}번 풀이영상` })} />
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* 2·4·6분할: 문제마다 고정 칸 (6분할은 폰트 축소 — 매쓰플랫 동일) */
              <div className={`mt-6 gap-x-8 ${opts.layout === 'split2' ? 'grid grid-cols-1' : 'grid grid-cols-2'} ${opts.layout === 'split6' ? 'text-[92%]' : ''}`}
                style={{ rowGap: `${spacingMm}mm` }}>
                {items.map((p, i) => (
                  <div key={p.id}
                    className={`sheet-problem border-b border-dotted border-line pb-3 ${
                      opts.layout === 'split2' ? 'min-h-[120mm]' : opts.layout === 'split4' ? 'min-h-[105mm]' : 'min-h-[72mm]'}`}>
                    <ProblemBlock p={p} idx={i} caption={caption(p)} themeMain={theme.main} onVideo={(pp, ii) => setVideo({ src: pp.videoUrl!, subtitle: pp.subtitleUrl, title: `${ii + 1}번 풀이영상` })} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ 2부. 빠른정답 (별지, 매쓰플랫 3열 표) ══ */}
        {showQuick && (
          <div className="sheet-page">
            {showSheet && <div className="h-6" />}
            <SheetHeader ws={{ grade: ws.grade, title: ws.title, author: ws.author }} subtitle={subtitle}
              dateText={dateText} count={items.length} theme={theme.main} />
            <div className="mx-auto mt-8 w-fit border-t border-line px-6 pt-1.5 text-center text-sm font-black">빠른정답</div>
            <div className="mx-auto mt-3 max-w-xl border-t-2 border-ink">
              <div className="grid grid-cols-3">
                {items.map((p, i) => (
                  <div key={p.id}
                    className={`flex items-center gap-2 border-b border-line px-3 py-1.5 text-[13px] ${i % 3 !== 2 ? 'border-r' : ''}`}>
                    <b style={{ color: theme.main }}>{String(i + 1).padStart(2, '0')}</b>
                    <span className="min-w-0"><MathText text={p.answer} className="max-h-8 w-auto" /></span>
                  </div>
                ))}
                {/* 마지막 줄 빈 칸 채움 */}
                {items.length % 3 !== 0 && Array.from({ length: 3 - (items.length % 3) }).map((_, k) => (
                  <div key={k} className={`border-b border-line px-3 py-2 ${k < 2 - (items.length % 3) ? 'border-r' : ''}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ 3부. 해설지 (별지, 매쓰플랫 2단·문항 블록) ══ */}
        {showSol && (
          <div className="sheet-page">
            {(showSheet || showQuick) && <div className="h-6" />}
            <SheetHeader ws={{ grade: ws.grade, title: ws.title, author: ws.author }} subtitle={subtitle}
              dateText={dateText} count={items.length} theme={theme.main} />
            <div className="sheet-cols mt-6">
              {items.map((p, i) => (
                <div key={p.id} className="sheet-problem mb-5">
                  <div className="flex items-baseline gap-3">
                    <span className="text-lg font-black" style={{ color: theme.main }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[12px] font-black">정답</span>
                    <span className="min-w-0 text-[13px] font-bold"><MathText text={p.answer} className="max-h-9 w-auto" /></span>
                  </div>
                  <div className="mb-1.5 mt-1 border-t border-line" />
                  {opts.solutionWithBody && (
                    <div className="mb-1.5 rounded bg-paper2/60 p-2 text-[12px]">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" className="w-full" />
                        : <>
                            <MathText text={p.body} />
                            {p.choices && (
                              <div className="mt-1 flex flex-wrap gap-x-4 text-ink2">
                                {p.choices.map((c, ci) => <span key={ci}>{'①②③④⑤'[ci]} <MathText text={c} /></span>)}
                              </div>
                            )}
                          </>}
                    </div>
                  )}
                  <div className="flex gap-2 text-[12.5px] leading-relaxed">
                    <span className="shrink-0 text-[12px] font-black text-ink2">해설</span>
                    <div className="min-w-0 grow"><MathText text={p.solution} className="text-ink" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {video && <VideoModal src={video.src} subtitle={video.subtitle} title={video.title} onClose={() => setVideo(null)} />}
    </div>
  )
}

// 지면 머리글 (매쓰플랫 원본: 학년 뱃지 + 제목 / 소단원 부제 / 날짜|문제수|출제자 + 이름)
export function SheetHeader({ ws, subtitle, dateText, count, theme }: {
  ws: { grade: string; title: string; author: string }
  subtitle: string; dateText: string | null; count: number; theme: string
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="rounded-md px-2.5 py-1 text-sm font-black text-white" style={{ background: theme }}>
          {ws.grade}
        </span>
        <h1 className="text-2xl font-black tracking-tight">{ws.title}</h1>
      </div>
      {subtitle && <div className="mt-1.5 text-[13px] text-ink2">{subtitle}</div>}
      <div className="mt-4 flex items-center justify-between border-b border-line pb-3 text-xs text-ink2">
        <span>
          {dateText && <>{dateText} | </>}
          {count}문제 | {ws.author}
          <span className="ml-3 font-semibold text-ink">이름 ________________</span>
        </span>
      </div>
    </div>
  )
}

export function ProblemBlock({ p, idx, caption, themeMain, onVideo }: {
  p: Problem; idx: number; caption: string; themeMain: string; onVideo?: (p: Problem, idx: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-lg font-black" style={{ color: themeMain }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
        {caption && <span className="text-[10px] text-ink2">{caption}</span>}
        {onVideo && p.videoUrl && (
          <button onClick={() => onVideo(p, idx)}
            className="no-print rounded-full border border-pine px-1.5 py-0 text-[10px] font-bold text-pine hover:bg-pine-soft">▶</button>
        )}
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
