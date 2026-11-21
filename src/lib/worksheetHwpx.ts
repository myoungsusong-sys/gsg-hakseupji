// 학습지 → 한글(HWPX) 파일 (2026-11-10 workerE) — 조판(sheetHwpx.ts)에 넘길 블록을 만든다. 브라우저 전용.
// 글 문항은 고칠 수 있는 글로, 그림·수식 문항은 문항 그림(problemShot)으로. 뒤에 빠른 정답·해설을 붙인다.
import type { Problem } from '../types'
import type { NoLabel } from './essayGroup'
import { buildHwpx, type HwpxBlock } from './sheetHwpx'
import { plainMath, problemShot } from './problemShot'
import { isImageUrl } from '../components/MathText'
import { bareChoices } from '../components/ProblemContent'

const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦']

/** 한글 글로 옮겨도 되는 문항인가 — 그림·수식·자료 그림이 없어야 한다 */
export function isPlainText(p: Problem, body = p.body): boolean {
  if (p.imageUrl || isImageUrl(body)) return false
  return !/\$|\[\[그림:|<img|\\\(|\\\[/.test(body + (p.choices ?? []).join(' '))
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64); const u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return u
}
function sizeOf(b64: string): Promise<{ w: number; h: number }> {
  return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = no; im.src = `data:image/jpeg;base64,${b64}` })
}
// 해설 그림(원격 png) → JPEG 바이트. CORS 가 막히면 null
async function urlToJpeg(url: string): Promise<{ data: Uint8Array; w: number; h: number } | null> {
  try {
    const im = new Image(); im.crossOrigin = 'anonymous'
    await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url })
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight
    const ctx = cv.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0)
    return { data: b64ToBytes(cv.toDataURL('image/jpeg', 0.88).split(',')[1]), w: cv.width, h: cv.height }
  } catch { return null }
}

export async function worksheetHwpx(opts: {
  title: string; meta: string; items: Problem[]; labels: NoLabel[]; bodyOf: (p: Problem, i: number) => string
  withSolution: boolean; onProgress?: (done: number, total: number) => void
  shotOf?: (p: Problem) => Promise<string | null>   // 화면 조판 칸 그림(JPEG base64) — 없으면 problemShot
}): Promise<Uint8Array> {
  const { title, meta, items, labels, bodyOf, withSolution, onProgress, shotOf } = opts
  const blocks: HwpxBlock[] = [{ kind: 'text', text: title, style: 'title' }, { kind: 'text', text: meta, style: 'small' }]
  for (let i = 0; i < items.length; i++) {
    const p = items[i], body = bodyOf(p, i)
    blocks.push({ kind: 'text', text: labels[i]?.big ?? String(i + 1).padStart(2, '0'), style: 'num' })
    if (isPlainText(p, body)) {
      blocks.push({ kind: 'text', text: body.replace(/\*\*/g, '').replace(/<\/?u>/g, '') })
      // 보기가 본문에 이미 적힌 문항(bareChoices)은 학습지 화면처럼 보기를 다시 붙이지 않는다
      if (p.choices?.length && !bareChoices(p.choices)) blocks.push({ kind: 'text', text: p.choices.map((c, k) => `${CIRC[k] ?? `(${k + 1})`} ${c}`).join('\n') })
    } else {
      try {
        const b64 = (await shotOf?.(p).catch(() => null)) ?? await problemShot({ ...p, body }, '')
        const { w, h } = await sizeOf(b64)
        blocks.push({ kind: 'img', data: b64ToBytes(b64), w, h, widthMm: 150 })
      } catch {
        blocks.push({ kind: 'text', text: plainMath(body) + (p.choices?.length ? '\n' + p.choices.map((c, k) => `${CIRC[k]} ${plainMath(c)}`).join('  ') : '') })
      }
    }
    onProgress?.(i + 1, items.length * (withSolution ? 2 : 1))
  }
  // 빠른 정답 — 한 줄에 5문항
  const ans = items.map((p, i) => `${labels[i]?.short ?? i + 1}) ${isImageUrl(p.answer) ? '(그림)' : plainMath(p.answer)}`)
  const rows: string[] = []
  for (let i = 0; i < ans.length; i += 5) rows.push(ans.slice(i, i + 5).join('     '))
  blocks.push({ kind: 'text', text: '빠른 정답', style: 'title', pageBreak: true }, { kind: 'text', text: rows.join('\n') || '—' })
  if (withSolution) {
    blocks.push({ kind: 'text', text: '정답과 해설', style: 'title', pageBreak: true })
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      blocks.push({ kind: 'text', text: `${labels[i]?.short ?? i + 1}번  정답 ${isImageUrl(p.answer) ? '(그림)' : plainMath(p.answer)}`, style: 'num' })
      const sol = (p.solution ?? '').trim()
      if (isImageUrl(sol)) {
        const im = await urlToJpeg(sol)
        blocks.push(im ? { kind: 'img', ...im, widthMm: 150 } : { kind: 'text', text: '(해설 그림은 앱에서 보세요)', style: 'small' })
      } else if (sol) blocks.push({ kind: 'text', text: plainMath(sol) })
      onProgress?.(items.length + i + 1, items.length * 2)
    }
  }
  return buildHwpx(title, blocks)
}
