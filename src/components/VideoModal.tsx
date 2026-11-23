import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

// 문항별 풀이영상 재생 모달 — HLS(m3u8). Safari는 네이티브, 그 외는 hls.js
export default function VideoModal({ src, subtitle, title, onClose, badge = '풀이영상', onEnded }: {
  src: string
  subtitle?: string
  title: string
  onClose: () => void
  badge?: string
  onEnded?: () => void   // 끝까지 봤을 때(강의 시청 완료 기록용)
}) {
  const ref = useRef<HTMLVideoElement>(null)
  // 2026-11-23 윤자혜 «개념강의가 플레이가 안됨» — 첫 화면만 서고 재생이 안 시작되는 경우(자동재생 막힘·불러오기 지연·네트워크 오류)에
  //  큰 ▶ 단추·오류 안내·다시 시도를 띄운다. 예전엔 첫 화면 그림만 남고 아무 안내도 없었다.
  const [started, setStarted] = useState(false)   // 실제로 재생이 시작됐나
  const [err, setErr] = useState('')
  const [tries, setTries] = useState(0)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    setStarted(false); setErr('')
    let hls: Hls | null = null
    let dead = false
    const tryPlay = () => { video.play().catch(() => { /* 자동재생 막힘 → ▶ 단추가 남는다 */ }) }
    // hls.js 우선 — 일부 Chrome이 canPlayType에 'maybe'를 반환해 네이티브 분기로 빠지면 재생 실패
    if (Hls.isSupported()) {
      hls = new Hls({ manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4, fragLoadingMaxRetry: 6 })
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay)
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal || dead) return
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) { hls?.startLoad(); return }
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { hls?.recoverMediaError(); return }
        setErr('영상을 불러오지 못했습니다. 인터넷 연결을 확인하고 «다시 시도»를 눌러 주세요.')
      })
      hls.loadSource(src)
      hls.attachMedia(video)
    } else {
      video.src = src                       // Safari 네이티브 HLS 등
      tryPlay()
    }
    return () => { dead = true; if (hls) hls.destroy() }
  }, [src, tries])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-3">
          <span className="rounded bg-pine-soft px-2 py-0.5 text-xs font-bold text-pine-dark">{badge}</span>
          <b className="min-w-0 truncate text-sm">{title}</b>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-ink2 hover:bg-paper2">✕</button>
        </div>
        <div className="relative">
          <video ref={ref} controls autoPlay playsInline crossOrigin="anonymous" onEnded={onEnded}
            onPlaying={() => { setStarted(true); setErr('') }}
            onError={() => setErr('영상을 불러오지 못했습니다. «다시 시도»를 눌러 주세요.')}
            className="aspect-video w-full rounded-lg bg-black">
            {subtitle && <track kind="subtitles" srcLang="ko" label="자막" src={subtitle} default />}
          </video>
          {!started && !err && (
            <button onClick={() => ref.current?.play().catch(() => setErr('재생을 시작하지 못했습니다. «다시 시도»를 눌러 주세요.'))}
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/25" aria-label="재생">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-4xl text-pine-dark shadow-lg">▶</span>
            </button>
          )}
          {err && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/75 p-6 text-center text-sm text-white">
              <div>{err}</div>
              <button onClick={() => setTries(n => n + 1)} className="rounded-lg bg-white px-4 py-2 font-bold text-ink">다시 시도</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
