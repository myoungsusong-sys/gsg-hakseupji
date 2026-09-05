import katex from 'katex'
import 'katex/dist/katex.min.css'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// "$...$" 구간만 KaTeX로, 나머지는 텍스트로 렌더링
// 🔴 text 가 undefined 로 들어오면 화면 전체가 흰 화면이 된다 (2026-08-07 실측:
//    해설이 없는 문항을 학습지에서 열자 WorksheetView 가 통째로 죽었다).
//    데이터가 어떻든 화면은 살아 있어야 한다 — 빈 값으로 받아 넘긴다.
export function mathToHtml(text: string): string {
  const parts = String(text ?? '').split(/(\$[^$]+\$)/g)
  return parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      try {
        return katex.renderToString(part.slice(1, -1), { throwOnError: false })
      } catch {
        return escapeHtml(part)
      }
    }
    // 수식 밖 텍스트: 이스케이프한 **뒤에** `**굵게**` 만 태그로 되살린다.
    // (이스케이프 전에 하면 본문의 < > 가 태그로 새어 들어간다)
    return escapeHtml(part).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  }).join('')
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
