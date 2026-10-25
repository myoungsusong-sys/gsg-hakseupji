import type { Problem } from '../types'

/**
 * 📒 족보닷컴 문항 본문 = 지문 글 + 빈 줄 + 문항 그림(figs/zb/…/qNN.webp) (2026-10-25).
 * 풀기 화면은 한 문항씩 보이므로 지문을 문항마다 싣지만, 인쇄할 때 바로 앞 문항과 지문이 같으면
 * 원본 문제지처럼 지문을 한 번만 싣는다 — 안 그러면 두 쪽짜리 소설이 문항마다 되풀이된다.
 */
export function zbBodyFor(p: Problem, prev?: Problem): string {
  if (!prev || !p.set || p.set !== prev.set || !p.id.startsWith('zb-')) return p.body
  const m = p.body.match(/\[\[그림:figs\/zb\/[^\]]*\/q\d+(?:_\d+)?\.webp\]\]/)
  return m && m.index ? '(앞의 글을 읽고 답하시오.)\n' + p.body.slice(m.index) : p.body
}
