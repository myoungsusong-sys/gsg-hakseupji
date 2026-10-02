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
          <h2 className="text-lg font-black">오답 승강제와 심화학습에 대해 알려드려요</h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>

        {/* ① 오답 → 승강제 (2026-10-02 명수쌤 «모든 오답은 승강제에서») */}
        <section className="mb-4 rounded-xl border border-line p-4">
          <div className="mb-1.5 font-black text-clay">🪜 오답 승강제</div>
          <p className="text-sm leading-relaxed">
            틀린 문제의 유형을 승강제로 공부해요. 개념 → 기본 → 표준 → 심화 → 최상까지,
            연속 2문제를 맞히면 한 칸 올라가고 틀리면 한 칸 내려가요.
          </p>
          <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            최상 단계에서 연속 2문제를 맞히면 그 유형은 마스터! 3번 연속 막히면 선생님께 질문하세요.
          </p>
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
          ⓘ 심화학습은 하나가 끝나기 전까지 새로운 심화학습을 만들 수 없어요. 오답 승강제는 언제든 이어서 할 수 있어요.
        </p>
      </div>
    </div>
  )
}
