import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

// 문항별 풀이영상 재생 모달 — HLS(m3u8). Safari는 네이티브, 그 외는 hls.js
export default function VideoModal({ src, subtitle, title, onClose, badge = '풀이영상' }: {
  src: string
  subtitle?: string
  title: string
  onClose: () => void
  badge?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    let hls: Hls | null = null
    // hls.js 우선 — 일부 Chrome이 canPlayType에 'maybe'를 반환해 네이티브 분기로 빠지면 재생 실패
    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
    } else {
      video.src = src                       // Safari 네이티브 HLS 등
    }
    return () => { if (hls) hls.destroy() }
  }, [src])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-3">
          <span className="rounded bg-pine-soft px-2 py-0.5 text-xs font-bold text-pine-dark">{badge}</span>
          <b className="min-w-0 truncate text-sm">{title}</b>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-ink2 hover:bg-paper2">✕</button>
        </div>
        <video ref={ref} controls autoPlay playsInline crossOrigin="anonymous"
          className="aspect-video w-full rounded-lg bg-black">
          {subtitle && <track kind="subtitles" srcLang="ko" label="자막" src={subtitle} default />}
        </video>
      </div>
    </div>
  )
}
