// ── 🎓 유형별 개념 강의 — 승강제 0층의 첫 화면 (2026-10-29 명수쌤) ────────────────
// «0단계가 강의와 지피티 이론노트, 그다음 빈칸» · «처음만 끝까지»(처음 들어올 땐 영상을 끝까지 봐야 빈칸으로,
// 틀려서 다시 내려왔을 땐 건너뛸 수 있다).
// 목록은 public/type-lectures/index.json 한 파일 — 코드를 고치지 않고 유형만 늘린다.
//   { "<유형 id>": { "video": "type-lectures/<파일>.mp4", "sec": 195, "title": "…", "notes": ["type-lectures/<파일>-1.jpg", …] } }
// 영상 = Gemini Notebook «Explainer»(우리 강사 녹음 합집합으로 만든 GPT 이론노트를 소스로), 노트 = 그 GPT 이론노트 그림.

import { useEffect, useRef, useState } from 'react'

export interface TypeLectureInfo { video?: string; sec?: number; title?: string; notes?: string[] }

let 목록: Promise<Record<string, TypeLectureInfo>> | null = null
function 목록받기(): Promise<Record<string, TypeLectureInfo>> {
  if (!목록) {
    목록 = fetch(`${import.meta.env.BASE_URL}type-lectures/index.json`)
      .then(r => (r.ok ? r.json() : {})).catch(() => ({}))
  }
  return 목록
}
const url = (u: string) => (/^https?:\/\//.test(u) ? u : `${import.meta.env.BASE_URL}${u}`)

/** 이 유형의 개념 강의 — 없으면 null(0층은 종전대로 빈칸부터), 목록을 받는 중이면 undefined
 *  (받기 전에 빈칸을 먼저 보여 주면 학생이 강의를 못 보고 넘어갈 수 있다) */
export function useTypeLecture(typeId: string): TypeLectureInfo | null | undefined {
  const [v, setV] = useState<TypeLectureInfo | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setV(undefined)
    목록받기().then(m => { if (alive) setV(m[typeId] ?? null) })
    return () => { alive = false }
  }, [typeId])
  return v
}

export default function TypeLecture({ lecture, watched, onWatched, onNext }: {
  lecture: TypeLectureInfo
  /** 예전에 끝까지 본 적이 있나 — 있으면 건너뛸 수 있다 */
  watched: boolean
  onWatched: () => void
  onNext: () => void
}) {
  const vid = useRef<HTMLVideoElement>(null)
  const maxT = useRef(0)
  const [ended, setEnded] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const canGo = watched || ended || !lecture.video
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-bold text-pine-dark">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-800">개념 강의</span>
        {lecture.title ?? ''}
      </p>
      {lecture.video && (
        <video ref={vid} src={url(lecture.video)} controls playsInline preload="metadata"
          className="mt-3 aspect-video w-full rounded-xl bg-black object-contain"
          // 🔴 2026-11-28 윤자혜 선생님 «강의도 아는 부분은 빨리감기나 되돌리기를 마우스로 되게» —
          //    예전엔 처음 볼 때 안 본 곳으로 앞질러 가지 못하게 막았다. 이제 재생 막대로 앞뒤 어디든 옮길 수 있다.
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            if (v.currentTime > maxT.current) maxT.current = v.currentTime
            if (v.duration) setLeft(Math.max(0, Math.ceil(v.duration - v.currentTime)))
          }}
          onEnded={() => { setEnded(true); onWatched() }} />
      )}
      {!!lecture.notes?.length && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-bold text-ink2">📒 이론노트 — 강의를 보며 같이 보세요</p>
          <div className="grid gap-2">
            {lecture.notes.map((n, i) => (
              <a key={n} href={url(n)} target="_blank" rel="noreferrer">
                <img src={url(n)} alt={`이론노트 ${i + 1}`} loading="lazy" className="w-full rounded-lg border border-line" />
              </a>
            ))}
          </div>
        </div>
      )}
      <button type="button" disabled={!canGo} onClick={onNext}
        className="mt-3 w-full rounded-lg bg-pine py-2.5 text-sm font-bold text-paper hover:bg-pine-dark disabled:cursor-not-allowed disabled:opacity-40">
        {canGo ? (watched && !ended ? '강의 건너뛰고 개념 빈칸으로' : '강의 다 봤어요 — 개념 빈칸으로')
          : `강의를 끝까지 보면 넘어갈 수 있어요${left != null ? ` (남은 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})` : ''}`}
      </button>
    </div>
  )
}
