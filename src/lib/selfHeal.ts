// 🛠 AI 점검이 고른 조치를 실제로 실행한다 (2026-07-28 명수쌤 지시)
//
// ⚠️ 실행할 수 있는 것은 **이 파일에 적힌 여섯 가지뿐**이다. AI가 보내온 문자열을 코드로
// 실행하는 경로는 없다(서버에서 enum 으로 거르고, 여기서 한 번 더 거른다). AI가 엉뚱한
// 조치를 지어내도 알 수 없는 타입은 그냥 무시된다.
//
// 데이터를 지우는 조치(free_space)는 **핵심 학습 데이터를 건드리지 않고**, 무엇을 지울지
// 사용자에게 보여주고 확인을 받은 뒤에만 실행한다.

export type HealAction = 'reload' | 'hard_reload' | 'go_home' | 'relogin' | 'free_space' | 'none'
export type HealOutcome = { done: boolean; note: string; reloads?: boolean }

/** 지우면 안 되는 키 — 학습 기록·로그인 정보 */
const PROTECTED = (k: string) =>
  k === 'gsg-hakseupji-v1' || k === 'gsg-student-session' ||
  k.startsWith('sb-') || /auth|token|session/i.test(k)

export const ACTION_LABEL: Record<HealAction, string> = {
  reload: '화면 새로 불러오기',
  hard_reload: '옛 화면 지우고 새로 불러오기',
  go_home: '첫 화면으로 이동',
  relogin: '로그인 다시 하기',
  free_space: '꽉 찬 저장 공간 정리',
  none: '이 화면에서는 고칠 수 없음',
}

/** 정리 후보 — 핵심 데이터를 뺀 나머지 중 큰 것부터 */
export function cleanupCandidates(): { key: string; kb: number }[] {
  const out: { key: string; kb: number }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || PROTECTED(k)) continue
      const kb = Math.round(((localStorage.getItem(k)?.length ?? 0) * 2) / 1024)
      if (kb >= 1) out.push({ key: k, kb })
    }
  } catch { /* 접근 불가 */ }
  return out.sort((a, b) => b.kb - a.kb)
}

export async function runHealAction(action: HealAction, app: 'student' | 'teacher'): Promise<HealOutcome> {
  switch (action) {
    case 'reload':
      setTimeout(() => location.reload(), 400)
      return { done: true, note: '화면을 새로 불러올게요.', reloads: true }

    case 'hard_reload': {
      // 배포 직후 옛 화면이 남아 깨지는 경우 — 캐시와 서비스워커를 비우고 새로 받는다
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
        if (navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        }
      } catch { /* 지원 안 하는 브라우저는 그냥 새로고침 */ }
      setTimeout(() => location.reload(), 400)
      return { done: true, note: '저장된 옛 화면을 지우고 새로 불러올게요.', reloads: true }
    }

    case 'go_home':
      location.hash = app === 'student' ? '#/student' : '#/lesson'
      return { done: true, note: '첫 화면으로 옮겼어요.' }

    case 'relogin': {
      if (app !== 'student') {
        // 선생님 로그인은 함부로 끊지 않는다 — 안내만 하고 사람이 판단하게 둔다
        return { done: false, note: '선생님 화면은 자동으로 로그아웃하지 않아요. 오른쪽 위에서 직접 로그아웃 후 다시 로그인해 주세요.' }
      }
      try { localStorage.removeItem('gsg-student-session') } catch { /* 무시 */ }
      location.hash = '#/student-login'
      setTimeout(() => location.reload(), 400)
      return { done: true, note: '로그인 화면으로 갈게요. 이름과 번호로 다시 들어와 주세요.', reloads: true }
    }

    case 'free_space': {
      const cands = cleanupCandidates()
      if (!cands.length) return { done: false, note: '지울 수 있는 임시 자료가 없어요. 학습 기록은 지우지 않아요.' }
      const list = cands.slice(0, 6).map(c => `· ${c.key} (${c.kb}KB)`).join('\n')
      const total = cands.reduce((s, c) => s + c.kb, 0)
      const ok = confirm(
        `저장 공간이 꽉 차서 화면이 깨질 수 있어요.\n아래 임시 자료를 지울까요? (총 ${total}KB)\n\n${list}\n\n` +
        '학습 기록과 로그인 정보는 지우지 않아요.',
      )
      if (!ok) return { done: false, note: '정리를 취소했어요.' }
      let freed = 0
      for (const c of cands) {
        try { localStorage.removeItem(c.key); freed += c.kb } catch { /* 무시 */ }
      }
      setTimeout(() => location.reload(), 600)
      return { done: true, note: `임시 자료 ${freed}KB를 정리하고 새로 불러올게요.`, reloads: true }
    }

    default:
      return { done: false, note: '이 화면에서 자동으로 고칠 수 있는 건 없어요.' }
  }
}
