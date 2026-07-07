export default function Placeholder({ title, original, plan }: {
  title: string
  original: string[]   // 원본(매쓰플랫)의 구조 요약
  plan: string         // 우리 활성화 계획
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-10">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        <span className="rounded-full bg-paper2 px-3 py-1 text-xs font-bold text-ink2">구조 확보 · 콘텐츠 대기</span>
      </div>
      <p className="mb-6 text-sm text-ink2">기본 구조는 원본과 동일하게 잡아두었고, 데이터가 준비되면 활성화됩니다.</p>
      <div className="mb-5 rounded-xl bg-paper2 p-5">
        <div className="mb-2 text-sm font-bold">원본 구조 (기능 등가 목표)</div>
        <ul className="grid gap-1 text-sm text-ink2">
          {original.map((o, i) => <li key={i}>· {o}</li>)}
        </ul>
      </div>
      <div className="rounded-xl border border-dashed border-pine/40 bg-pine-soft/30 p-5 text-sm">
        <b className="text-pine-dark">활성화 계획</b> — {plan}
      </div>
    </div>
  )
}
