import MathText from './MathText'
import type { Problem } from '../types'

// 문제 본문 렌더 — 이미지 기반(기출)이면 이미지, 아니면 텍스트+보기(KaTeX)
export default function ProblemContent({ p, textClass, imgClass }: {
  p: Problem; textClass?: string; imgClass?: string
}) {
  if (p.imageUrl) {
    // 매쓰플랫 문제 이미지는 폭 930px(@2x) 규격 — 원본의 50%(465px)로 캡해야
    // 모든 문항의 글자 크기가 균일하고 원본 비율이 된다 (좁은 컨테이너에선 100%)
    return <img src={p.imageUrl} alt={p.body || '기출 문항'} className={imgClass ?? 'w-full max-w-[465px]'} />
  }
  return (
    <>
      <MathText text={p.body} className={textClass ?? 'text-[15px] leading-relaxed'} />
      {p.choices && (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink2">
          {p.choices.map((c, ci) => (
            <span key={ci}>{'①②③④⑤'[ci]} <MathText text={c} /></span>
          ))}
        </div>
      )}
    </>
  )
}
