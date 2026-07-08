import katex from 'katex'
import 'katex/dist/katex.min.css'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// "$...$" 구간만 KaTeX로, 나머지는 텍스트로 렌더링
export function mathToHtml(text: string): string {
  const parts = text.split(/(\$[^$]+\$)/g)
  return parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      try {
        return katex.renderToString(part.slice(1, -1), { throwOnError: false })
      } catch {
        return escapeHtml(part)
      }
    }
    return escapeHtml(part)
  }).join('')
}

// 이미지 URL(매쓰플랫 문제/해설 png)이면 이미지로 렌더 — LaTeX 텍스트는 https로 시작하지 않으므로 안전
export function isImageUrl(s: string): boolean {
  return typeof s === 'string' && /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?|$)/i.test(s)
}

export default function MathText({ text, className }: { text: string; className?: string }) {
  if (isImageUrl(text)) {
    return <img src={text} alt="" className={className ? className + ' max-w-full' : 'max-w-full'} />
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: mathToHtml(text) }} />
}
