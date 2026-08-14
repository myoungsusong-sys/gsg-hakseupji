import { useEffect, useState } from 'react'
import { onOutbox, flush, type OutboxStatus } from '../lib/outbox'

// 아직 클라우드에 못 올라간 저장이 있으면 화면 구석에 계속 띄운다.
//
// 왜 필요한가: 예전에는 저장이 실패해도 화면이 아무 말을 안 했다. 선생님은 채점이 끝난 줄
// 알고 창을 닫았고, 그 채점은 다음 동기화 때 사라졌다(2026-08-15 "채점했는데 기록 0건").
// 이제는 못 올라간 것이 남아 있는 한 이 표시가 없어지지 않는다 —
// 이게 보이면 아직 끝난 게 아니라는 뜻이다. 데이터 자체는 outbox 가 들고 있다가 다시 보낸다.
export default function SaveGuard() {
  const [s, setS] = useState<OutboxStatus>({ pending: 0, failing: false, overflow: false })
  const [busy, setBusy] = useState(false)
  useEffect(() => onOutbox(setS), [])

  if (s.pending === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-xs rounded-xl border-2 border-clay bg-white p-3 text-xs shadow-lg print:hidden">
      <div className="font-bold text-clay">⚠ 저장 대기 {s.pending}건</div>
      <div className="mt-1 leading-relaxed text-ink2">
        {s.overflow
          // 이 경우만 진짜 위험하다 — 큐가 브라우저 저장 한도를 넘어 메모리에만 있다
          ? '저장 공간이 가득 차 이 창에만 남아 있어요. 창을 닫기 전에 다시 보내주세요.'
          : '인터넷이 끊겼거나 로그인이 만료돼 아직 못 올렸어요. 계속 다시 보내는 중이라 사라지지는 않아요.'}
        {s.failing && s.lastError && <div className="mt-1 text-ink2/70">({s.lastError})</div>}
      </div>
      <button
        onClick={async () => { setBusy(true); await flush(); setBusy(false) }}
        disabled={busy}
        className="mt-2 w-full rounded-lg bg-clay px-3 py-1.5 font-bold text-white disabled:opacity-50">
        {busy ? '보내는 중…' : '지금 다시 보내기'}
      </button>
    </div>
  )
}
