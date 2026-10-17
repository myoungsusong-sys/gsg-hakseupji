// ── 🎬 승강제 «개념» 단계의 개념 영상 (2026-10-17 명수쌤) ─────────────────────
// «빈칸 개념 확인 옆에 [개념 영상 보기] 버튼» — 개념카드(conceptId)마다 영상이 있으면 버튼을 띄운다.
// 영상 목록은 public/concept-videos/index.json 한 파일(코드를 고치지 않고 영상만 늘릴 수 있게).
//   { "<개념카드 id>": { "src": "concept-videos/<파일>.mp4", "title": "…", "sec": 84 } }
// 영상은 Gemini Notebook «Short»(세로 9:16)로 만들고 끝의 로고 화면은 잘라서 넣는다.

import { useEffect, useState } from 'react'

export interface ConceptVideoInfo { src: string; title?: string; sec?: number }

let 목록: Promise<Record<string, ConceptVideoInfo>> | null = null
function 목록받기(): Promise<Record<string, ConceptVideoInfo>> {
  if (!목록) {
    목록 = fetch(`${import.meta.env.BASE_URL}concept-videos/index.json`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return 목록
}

/** 개념카드 id 들 가운데 영상이 있는 첫 번째 것 */
export function useConceptVideo(conceptIds: (string | undefined)[]): ConceptVideoInfo | null {
  const [v, setV] = useState<ConceptVideoInfo | null>(null)
  const key = conceptIds.filter(Boolean).join('|')
  useEffect(() => {
    let alive = true
    목록받기().then(m => {
      if (!alive) return
      const id = conceptIds.find(x => x && m[x])
      setV(id ? m[id] : null)
    })
    return () => { alive = false }
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps
  return v
}

export function ConceptVideoButton({ video, className }: { video: ConceptVideoInfo; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={className ?? 'rounded-lg border border-pine bg-white px-3 py-2.5 text-sm font-bold text-pine hover:bg-pine-soft'}>
        🎬 개념 영상 보기{video.sec ? <span className="ml-1 text-xs font-semibold opacity-70">{Math.floor(video.sec / 60)}:{String(video.sec % 60).padStart(2, '0')}</span> : null}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={() => setOpen(false)}>
          <div className="flex max-h-full w-full max-w-sm flex-col" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 text-white">
              <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold">개념 영상</span>
              <b className="min-w-0 grow truncate text-sm">{video.title ?? ''}</b>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-lg hover:bg-white/10">✕</button>
            </div>
            {/* 세로 영상(9:16) — 화면 높이에 맞춰 꽉 차게 */}
            <video src={`${import.meta.env.BASE_URL}${video.src}`} controls autoPlay playsInline
              className="max-h-[82vh] w-full rounded-xl bg-black object-contain" />
          </div>
        </div>
      )}
    </>
  )
}
