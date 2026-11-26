import { useEffect, useRef } from 'react'

/**
 * 🎉 유형 마스터 축하 — 색종이 + 팡파르 (2026-11-26 명수쌤 «유형이 마스터되면 축하음이나 영상같은 학생이 성취감을 느낄수있게»)
 *
 * · 소리 파일 없이 Web Audio 로 짧은 팡파르(도-미-솔-도↑ + 화음)를 낸다 — 마지막 정답을 누른 손길 직후라
 *   브라우저 자동재생 막힘에 걸리지 않는다. 기기 소리가 꺼져 있으면 조용히 넘어간다.
 * · 색종이는 화면 위에 캔버스를 덮어 약 4초 떨어뜨리고 스스로 지운다(누르기·스크롤을 막지 않게 pointer-events 없음).
 * · 움직임 줄이기(prefers-reduced-motion)를 켠 기기에서는 색종이를 생략한다.
 */
export default function Celebrate() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    // ── 팡파르 ──
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ctx = new AC()
      const now = ctx.currentTime + 0.05
      const note = (f: number, t: number, d: number, g = 0.18, type: OscillatorType = 'triangle') => {
        const o = ctx.createOscillator(); const v = ctx.createGain()
        o.type = type; o.frequency.value = f
        v.gain.setValueAtTime(0.0001, now + t)
        v.gain.exponentialRampToValueAtTime(g, now + t + 0.02)
        v.gain.exponentialRampToValueAtTime(0.0001, now + t + d)
        o.connect(v); v.connect(ctx.destination); o.start(now + t); o.stop(now + t + d + 0.05)
      }
      // 도 미 솔 — 높은 도(길게) + 화음
      note(523.25, 0.00, 0.16); note(659.25, 0.15, 0.16); note(783.99, 0.30, 0.16)
      note(1046.5, 0.45, 0.9, 0.22)
      note(659.25, 0.45, 0.9, 0.10, 'sine'); note(783.99, 0.45, 0.9, 0.10, 'sine')
      setTimeout(() => { try { ctx.close() } catch { /* 이미 닫힘 */ } }, 2000)
    } catch { /* 소리를 못 내는 기기 */ }

    // ── 색종이 ──
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const c = ref.current; if (!c) return
    const g = c.getContext('2d'); if (!g) return
    const dpr = window.devicePixelRatio || 1
    const W = window.innerWidth, H = window.innerHeight
    c.width = W * dpr; c.height = H * dpr; g.scale(dpr, dpr)
    const colors = ['#2f855a', '#f6ad55', '#63b3ed', '#f56565', '#ecc94b', '#9f7aea']
    const bits = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, col: colors[(Math.random() * colors.length) | 0],
    }))
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => {
      const el = t - t0
      g.clearRect(0, 0, W, H)
      for (const b of bits) {
        b.vy += 0.28; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.globalAlpha = Math.max(0, 1 - el / 4000)
        g.fillStyle = b.col; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore()
      }
      if (el < 4000) raf = requestAnimationFrame(tick); else g.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />
}
