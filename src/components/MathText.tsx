import katex from 'katex'
import 'katex/dist/katex.min.css'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// "$...$" 구간만 KaTeX로, 나머지는 텍스트로 렌더링
// 🔴 text 가 undefined 로 들어오면 화면 전체가 흰 화면이 된다 (2026-08-07 실측:
//    해설이 없는 문항을 학습지에서 열자 WorksheetView 가 통째로 죽었다).
//    데이터가 어떻든 화면은 살아 있어야 한다 — 빈 값으로 받아 넘긴다.
function inlineToHtml(text: string): string {
  const parts = String(text ?? '').split(/(\$[^$]+\$)/g)
  return parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      try {
        return katex.renderToString(part.slice(1, -1), { throwOnError: false })
      } catch {
        return escapeHtml(part)
      }
    }
    // 수식 밖 텍스트: 이스케이프한 **뒤에** `**굵게**` 와 `<u>밑줄</u>` 만 태그로 되살린다.
    // (이스케이프 전에 하면 본문의 < > 가 태그로 새어 들어간다)
    // 🔴 2026-09-28: 통합사회 「옳지 <u>않은</u> 것은?」 43문항이 학생 화면에 태그 글자 그대로 보였다.
    // 🔴 2026-09-29: 줄바꿈(\n)을 <br> 로 — 안 하면 〈보기〉 ㄱ·ㄴ·ㄷ, 자료, 지문 문단, 해설 1·2·3 이 한 줄로 붙는다
    //    (문항 본문을 그리는 인쇄·학생 화면 어디에도 white-space 설정이 없었다).
    return escapeHtml(part)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/&lt;u&gt;((?:(?!&lt;).)+?)&lt;\/u&gt;/g, '<u>$1</u>')
      // 🆕 2026-09-29: 자료형 문항의 그림 — 본문 안 `[[그림:/figs/…/파일.png]]` 자리에 그림을 넣는다.
      //    (시중 문제집처럼 «발문 + 그래프·표 그림» 을 실으려고. 경로는 앱 안 /figs/ 아래 파일만 허용)
      .replace(/\[\[그림:\/?(figs\/[A-Za-z0-9_\-./]+\.(?:png|svg|webp|jpg))\]\]/g,
        (_m, path: string) => path.includes('..') ? '' :
          `<img src="${import.meta.env.BASE_URL}${path}" alt="자료 그림" class="my-2 block max-w-full" style="max-height:340px" />`)
      .replace(/\n/g, '<br>')
  }).join('')
}

// 📊 표 — 「구분 | A | B」 처럼 세로줄(|)로 칸을 나눈 줄이 2줄 이상 이어지면 표로 그린다(마크다운 표 `|---|` 구분줄 포함).
//    🔴 수식 안의 | (절댓값 $|x|$) 는 세지 않는다 — 수학 문항이 표로 오인되면 안 된다.
const pipesOutsideMath = (l: string) => (l.replace(/\$[^$]*\$/g, '').match(/\|/g) || []).length
const isSepRow = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)
const isRow = (l: string) => isSepRow(l) || pipesOutsideMath(l) >= 2 || (pipesOutsideMath(l) >= 1 && /^\s*\|/.test(l))
function splitCells(l: string): string[] {
  const cells: string[] = []; let cur = '', inMath = false
  for (const ch of l.trim().replace(/^\|/, '').replace(/\|$/, '')) {
    if (ch === '$') inMath = !inMath
    if (ch === '|' && !inMath) { cells.push(cur); cur = '' } else cur += ch
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}
function tableHtml(rows: string[]): string {
  const body = rows.filter(r => !isSepRow(r))
  const head = rows.length > 1 && isSepRow(rows[1])
  const td = (c: string, th: boolean) => `<${th ? 'th' : 'td'} style="border:1px solid #999;padding:2px 6px;text-align:center;${th ? 'background:#f3f3f3;font-weight:600;' : ''}">${inlineToHtml(c)}</${th ? 'th' : 'td'}>`
  return '<table style="border-collapse:collapse;margin:4px 0;font-size:inherit">' +
    body.map((r, i) => '<tr>' + splitCells(r).map(c => td(c, head && i === 0)).join('') + '</tr>').join('') + '</table>'
}

export function mathToHtml(text: string): string {
  const src = String(text ?? '')
  const lines = src.split('\n')
  // 표가 없으면 예전과 똑같이(줄바꿈만 <br>) — 수식이 여러 줄에 걸쳐도 안전
  let hasTable = false
  for (let i = 0; i + 1 < lines.length; i++) if (isRow(lines[i]) && isRow(lines[i + 1])) { hasTable = true; break }
  if (!hasTable) return inlineToHtml(src)
  const out: string[] = []
  for (let i = 0; i < lines.length;) {
    if (isRow(lines[i]) && i + 1 < lines.length && isRow(lines[i + 1])) {
      let j = i; while (j < lines.length && isRow(lines[j])) j++
      out.push(tableHtml(lines.slice(i, j))); i = j
    } else { out.push(inlineToHtml(lines[i]) + '<br>'); i++ }
  }
  return out.join('').replace(/(<br>)+$/, '')
}

// 이미지 URL(매쓰플랫 문제/해설 png)이면 이미지로 렌더 — LaTeX 텍스트는 https로 시작하지 않으므로 안전
export function isImageUrl(s: string): boolean {
  // 절대 URL(매쓰플랫 CDN) 또는 앱 내부 상대경로(/wanja/... 완자 크롭·해설 이미지)
  return typeof s === 'string' && /^(https?:\/\/\S+|\/\S+)\.(png|jpe?g|gif|webp)(\?|$)/i.test(s)
}

export default function MathText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null
  if (isImageUrl(text)) {
    return <img src={text} alt="" className={className ? className + ' max-w-full' : 'max-w-full'} />
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: mathToHtml(text) }} />
}
