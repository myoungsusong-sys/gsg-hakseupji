// ── 문제 바로 질문 — 앱 문제를 «사진처럼» 한 장의 JPEG 로 만든다 (2026-09-29 명수쌤) ─────
// 「학습지 문제를 풀다가 사진 찍지 않고 그 문제를 바로 질문할 수 있게」
// 질문함 워커는 질문마다 문제 그림(shotUrl, 5KB 이상)을 받아 쓴다 → 앱이 문제를 직접 그려 올린다.
//  ① 이미지 문항(기출 크롭·완자 등)  : 문제 그림을 흰 바탕에 옮겨 그린다(CDN 은 CORS 허용).
//  ② 글 문항(수식·표·[[그림:]] 포함) : 화면 밖에 문제를 그려 domShot 으로 캡처 — 화면에 보이는 모습 그대로.
//  ③ ②가 막히는 기기(사파리 foreignObject 오염·빈 그림 등) : 글자와 자료 그림을 캔버스에 직접 그린다.
// 워커는 문제 원문(problem 칸)도 같이 받으므로, 그림은 사람이 보는 용도(학생·선생님 목록)와 그림 자료용이다.

import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import ProblemContent from '../components/ProblemContent'
import { captureNode } from './domShot'
import type { Problem } from '../types'

const W = 680           // 그림 폭(css px) — 폰 사진보다 좁고 글자가 또렷한 폭
const RATIO = 2
const MIN_H = 320       // 너무 짧으면 JPEG 가 5KB 아래로 떨어져 워커가 «사진을 못 받았다» 고 본다

function loadImg(src: string, cors: boolean, ms = 8000): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const im = new Image()
    if (cors) im.crossOrigin = 'anonymous'
    const t = setTimeout(() => no(new Error('그림을 불러오지 못했어요')), ms)
    im.onload = () => { clearTimeout(t); ok(im) }
    im.onerror = () => { clearTimeout(t); no(new Error('그림을 불러오지 못했어요')) }
    im.src = src
  })
}

/** 캔버스가 거의 하얗기만 한가(사파리가 foreignObject 를 조용히 빈 그림으로 그리는 경우) */
function isBlank(cv: HTMLCanvasElement): boolean {
  try {
    const s = document.createElement('canvas')
    s.width = 120; s.height = Math.max(20, Math.round(120 * cv.height / cv.width))
    const c = s.getContext('2d')!
    c.drawImage(cv, 0, 0, s.width, s.height)
    const d = c.getImageData(0, 0, s.width, s.height).data
    let ink = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) ink++
    return ink < (s.width * s.height) * 0.002
  } catch { return true }        // 읽기조차 막히면(오염) 쓸 수 없다
}

function toJpegB64(cv: HTMLCanvasElement): string {
  let url = cv.toDataURL('image/jpeg', 0.86)          // 오염된 캔버스면 여기서 SecurityError
  if (url.length * 0.75 < 7000) url = cv.toDataURL('image/jpeg', 0.97)
  return url.split(',')[1]
}

function blankCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
  return [cv, ctx]
}

// ① 이미지 문항 — 머리글 한 줄 + 문제 그림
async function viaImage(p: Problem, head: string): Promise<HTMLCanvasElement> {
  const im = await loadImg(p.imageUrl!, true)
  const pad = 22 * RATIO, headH = 30 * RATIO
  const w = W * RATIO, iw = w - pad * 2
  const ih = Math.round(im.naturalHeight * (iw / Math.max(1, im.naturalWidth)))
  const [cv, ctx] = blankCanvas(w, Math.max(MIN_H * RATIO, pad * 2 + headH + ih))
  ctx.fillStyle = '#6b7280'; ctx.font = `bold ${12 * RATIO}px sans-serif`; ctx.textBaseline = 'top'
  ctx.fillText(head, pad, pad)
  ctx.drawImage(im, pad, pad + headH, iw, ih)
  return cv
}

// ② 글 문항 — 화면 밖에 그려 캡처
async function viaDom(p: Problem, head: string): Promise<HTMLCanvasElement> {
  const outer = document.createElement('div')          // 화면 밖 자리잡기(캡처 대상이 아니다 — 클론에 left:-12000 이 실리면 빈 그림)
  outer.style.cssText = 'position:fixed;left:-12000px;top:0;pointer-events:none;z-index:-1'
  const inner = document.createElement('div')
  inner.style.cssText = `width:${W}px;min-height:${MIN_H}px;box-sizing:border-box;padding:22px 26px;background:#ffffff;color:#1c2321`
  outer.appendChild(inner)
  document.body.appendChild(outer)
  const root = createRoot(inner)
  try {
    flushSync(() => root.render(
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>{head}</div>
        <ProblemContent p={p} textClass="text-[16px] leading-relaxed" />
      </div>,
    ))
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    await Promise.all([...inner.querySelectorAll('img')].map(im => im.complete ? null
      : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 6000) })))
    try { await document.fonts.ready } catch { /* 무시 */ }
    const math = /\$[^$]+\$/.test(p.body + (p.choices ?? []).join(' '))
    return await captureNode(inner, RATIO, { withFonts: math, timeoutMs: 12_000 })
  } finally {
    root.unmount(); outer.remove()
  }
}

// ③ 예비 — 수식은 읽을 수 있는 글로 풀고, 자료 그림은 제자리에 그린다
export function plainMath(s: string): string {
  let t = String(s ?? '')
  for (let i = 0; i < 3; i++) t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
  return t
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/\\left|\\right|\\,|\\;|\\!|\\quad/g, ' ')
    .replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\cdot/g, '·').replace(/\\pm/g, '±')
    .replace(/\\le(?:q)?\b/g, '≤').replace(/\\ge(?:q)?\b/g, '≥').replace(/\\ne(?:q)?\b/g, '≠')
    .replace(/\\pi\b/g, 'π').replace(/\\theta\b/g, 'θ').replace(/\\alpha\b/g, 'α').replace(/\\beta\b/g, 'β')
    .replace(/\\infty\b/g, '∞').replace(/\\angle\b/g, '∠').replace(/\\triangle\b/g, '△').replace(/\\circ\b/g, '°')
    .replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '_($1)')
    .replace(/\$/g, '').replace(/\*\*/g, '').replace(/<\/?u>/g, '')
}

/** 예비 경로만 따로(점검용) — 캡처가 막히는 기기에서 학생이 실제로 보내게 되는 그림 */
export async function plainShot(p: Problem, head: string): Promise<string> {
  return toJpegB64(await viaCanvas(p, head))
}

async function viaCanvas(p: Problem, head: string): Promise<HTMLCanvasElement> {
  type Seg = { kind: 'text'; s: string; size: number; color: string; bold?: boolean } | { kind: 'img'; im: HTMLImageElement }
  const segs: Seg[] = [{ kind: 'text', s: head, size: 12, color: '#6b7280', bold: true }]
  for (const part of String(p.body ?? '').split(/(\[\[그림:[^\]]+\]\])/g)) {
    const m = /^\[\[그림:\/?(figs\/[A-Za-z0-9_\-./]+\.(?:png|svg|webp|jpg))\]\]$/.exec(part)
    if (m) {
      if (m[1].includes('..')) continue
      try { segs.push({ kind: 'img', im: await loadImg(`${import.meta.env.BASE_URL}${m[1]}`, false) }) } catch { segs.push({ kind: 'text', s: '(그림)', size: 16, color: '#1c2321' }) }
    } else if (part.trim()) segs.push({ kind: 'text', s: plainMath(part).trim(), size: 16, color: '#1c2321' })
  }
  if (p.choices?.length) segs.push({ kind: 'text', s: p.choices.map((c, i) => `${'①②③④⑤'[i] ?? `(${i + 1})`} ${plainMath(c)}`).join('\n'), size: 15, color: '#1c2321' })

  const pad = 24 * RATIO, maxW = W * RATIO - pad * 2
  const [, mctx] = blankCanvas(1, 1)
  const font = (g: { size: number; bold?: boolean }) => `${g.bold ? 'bold ' : ''}${g.size * RATIO}px -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
  const wrap = (s: string, g: { size: number; bold?: boolean }): string[] => {
    mctx.font = font(g)
    const out: string[] = []
    for (const para of s.split('\n')) {
      let line = ''
      for (const ch of para) {
        if (mctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch.trimStart() }
        else line += ch
      }
      out.push(line)
    }
    return out
  }
  const plan: Array<{ seg: Seg; lines?: string[]; h: number }> = segs.map(seg => {
    if (seg.kind === 'img') {
      const w = Math.min(maxW, seg.im.naturalWidth * RATIO * 0.75)
      return { seg, h: Math.round(seg.im.naturalHeight * (w / Math.max(1, seg.im.naturalWidth))) + 12 * RATIO }
    }
    const lines = wrap(seg.s, seg)
    return { seg, lines, h: lines.length * seg.size * RATIO * 1.6 + 8 * RATIO }
  })
  const H = Math.max(MIN_H * RATIO, pad * 2 + plan.reduce((a, b) => a + b.h, 0))
  const [cv, ctx] = blankCanvas(W * RATIO, Math.round(H))
  let y = pad
  ctx.textBaseline = 'top'
  for (const it of plan) {
    if (it.seg.kind === 'img') {
      const im = it.seg.im
      const w = Math.min(maxW, im.naturalWidth * RATIO * 0.75)
      ctx.drawImage(im, pad, y + 6 * RATIO, w, it.h - 12 * RATIO)
    } else {
      ctx.font = font(it.seg); ctx.fillStyle = it.seg.color
      it.lines!.forEach((ln, i) => ctx.fillText(ln, pad, y + i * (it.seg as { size: number }).size * RATIO * 1.6))
    }
    y += it.h
  }
  return cv
}

/**
 * 앱 문제 한 장 → JPEG base64(본문만). 머리글에는 «어디 문제인지» 를 적는다(예: 「중2 수학 · 일차함수의 그래프」).
 * 어떤 경로든 실패하면 다음 경로로 내려간다(사다리) — 마지막 캔버스 글 그림은 모든 브라우저에서 된다.
 */
export async function problemShot(p: Problem, head: string): Promise<string> {
  if (p.imageUrl) {
    try { return toJpegB64(await viaImage(p, head)) } catch (e) { console.warn('[문제 그림] 이미지 문항 실패', e) }
  } else {
    try {
      const cv = await viaDom(p, head)
      if (!isBlank(cv)) return toJpegB64(cv)
      console.warn('[문제 그림] 캡처가 빈 그림 — 글자 그림으로')
    } catch (e) { console.warn('[문제 그림] 캡처 실패 — 글자 그림으로', e) }
  }
  return toJpegB64(await viaCanvas(p, head))
}
