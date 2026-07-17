import katex from 'katex'
import 'katex/dist/katex.min.css'

// 정리노트 텍스트 렌더 — $...$ 는 KaTeX 수식, ==...== 는 형광펜 강조
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function noteToHtml(text: string): string {
  // 먼저 수식 구간을 보호하며 분할, 나머지에서 ==형광펜== 처리
  return text.split(/(\$[^$]+\$)/g).map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      try { return katex.renderToString(part.slice(1, -1), { throwOnError: false }) }
      catch { return esc(part) }
    }
    // ==강조== → 형광펜 span
    return part.split(/(==[^=]+==)/g).map(seg => {
      if (seg.startsWith('==') && seg.endsWith('==') && seg.length > 4) {
        return `<mark class="rounded-[3px] bg-hilite/70 px-0.5 font-semibold text-ink decoration-clone">${esc(seg.slice(2, -2))}</mark>`
      }
      return esc(seg)
    }).join('')
  }).join('')
}

export default function NoteText({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: noteToHtml(text) }} />
}
