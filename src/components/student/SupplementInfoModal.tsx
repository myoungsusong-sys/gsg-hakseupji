// ── 보충학습 ⓘ 설명 모달 (매쓰플랫 "오답학습과 심화학습에 대해 알려드려요" — 문구 원문) ──

function RoundBadges({ kind, color }: { kind: string; color: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[1, 2, 3].map(n => (
        <span key={n} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${color} ${n === 3 ? '' : 'opacity-80'}`}>
          {kind}-{n}회차
        </span>
      ))}
      <span className="self-center text-[11px] text-ink2">… 끝날 때까지 반복돼요</span>
    </div>
  )
}

export default function SupplementInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start gap-3">
          <h2 className="text-lg font-black">오답학습과 심화학습에 대해 알려드려요</h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>

        {/* ① 오답학습 */}
        <section className="mb-4 rounded-xl border border-line p-4">
          <div className="mb-1.5 font-black text-clay">◎ 오답학습</div>
          <p className="text-sm leading-relaxed">
            틀린문제의 유형을 틀리지 않을 때까지 반복해서 공부할 수 있는 학습이에요.
          </p>
          <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            틀린 유형의 문제를 모두 맞으면 추가학습을 생성할 수 없습니다.
          </p>
          <RoundBadges kind="오답학습" color="bg-red-50 text-clay" />
        </section>

        {/* ② 심화학습 */}
        <section className="mb-4 rounded-xl border border-line p-4">
          <div className="mb-1.5 font-black text-pine-dark">📊 심화학습</div>
          <p className="text-sm leading-relaxed">
            정답문제마다 한 단계씩 높은 난이도의 문제를 활용해서 나의 수준을 올릴 수 있는 학습이에요.
          </p>
          <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            한 단계씩 높은 난이도의 문제를 모두 맞으면 추가학습을 완료할 수 있어요!
          </p>
          <RoundBadges kind="심화학습" color="bg-pine-soft text-pine-dark" />
        </section>

        {/* ③ 동시 진행 규칙 */}
        <p className="rounded-xl bg-paper2/70 px-4 py-3 text-xs leading-relaxed text-ink2">
          ⓘ 오답학습과 심화학습은 동시에 진행할 수 있지만, 하나의 학습은 끝나기 전까지 새로운 학습을
          생성할 수 없어요!
        </p>
      </div>
    </div>
  )
}
