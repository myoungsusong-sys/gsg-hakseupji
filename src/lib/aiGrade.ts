import type { GradeResult, Problem } from '../types'
import { normAnswer } from './answers'

// ── AI 1차 채점 클라이언트 — 자동채점 불가 문항 판별 + /api/ai-grade 호출 ──
// 자동채점 가능 = 정답이 "기계 대조 가능한 텍스트"인 문항 (객관식·단답).
// 불가 = 정답이 이미지(서술형)·빈값(과학 오투 등 답 미수집) → AI 1차 채점 + 선생님 승인 대상.

const isImgUrl = (a: string) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(a) || /\.(png|jpe?g|gif|webp)$/i.test(a)

export function isMachineGradable(p: Problem): boolean {
  const a = (p.answer ?? '').trim()
  if (!a || a === '.' || a === '-') return false      // 답 미수집(과학 등)·풀이참조
  if (isImgUrl(a)) return false                        // 이미지 정답(서술형)
  return normAnswer(a) !== ''
}

// 상대 경로(/otu/… 등) → 절대 URL (서버리스가 Claude에 URL 이미지로 전달할 수 있게)
function absUrl(u?: string): string | undefined {
  if (!u) return undefined
  if (/^https?:\/\//.test(u)) return u
  if (typeof window === 'undefined') return undefined
  return new URL(u, window.location.origin).href
}

export interface AiVerdict { verdict: boolean | null; reason: string; confidence: 'high' | 'mid' | 'low' }

export async function requestAiGrade(p: Problem, studentAnswer: string, workImg?: string): Promise<AiVerdict> {
  const a = (p.answer ?? '').trim()
  const body = {
    problemImageUrl: absUrl(p.imageUrl),
    problemText: !p.imageUrl && p.body ? p.body : undefined,
    answerText: a && !isImgUrl(a) && a !== '.' && a !== '-' ? a : undefined,
    answerImageUrl: isImgUrl(a) ? absUrl(a) : undefined,
    solutionImageUrl: p.solution && isImgUrl(p.solution) ? absUrl(p.solution) : undefined,
    studentAnswer: studentAnswer || undefined,
    workImageBase64: workImg,
    workMediaType: workImg ? 'image/jpeg' : undefined,
  }
  const r = await fetch('/api/ai-grade', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`ai-grade ${r.status}`)
  const j = await r.json()
  return {
    verdict: j.verdict === true ? true : j.verdict === false ? false : null,
    reason: String(j.reason ?? ''),
    confidence: ['high', 'mid', 'low'].includes(j.confidence) ? j.confidence : 'low',
  }
}

// ── 확인용 객관식 ─────────────────────────────────────────────
// 서술형을 틀린 학생이 정답을 빨간펜으로 적은 뒤 바로 풀어 보는 5지선다.
// 틀린 문항에서만 호출한다(맞으면 안 부른다).
export interface AiQuiz { question: string; choices: string[]; answerIndex: number; why: string }

export async function requestAiQuiz(p: Problem, studentAnswer: string): Promise<AiQuiz> {
  const a = (p.answer ?? '').trim()
  const r = await fetch('/api/ai-quiz', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problemImageUrl: absUrl(p.imageUrl),
      problemText: !p.imageUrl && p.body ? p.body : undefined,
      answerText: a && !isImgUrl(a) && a !== '.' && a !== '-' ? a : undefined,
      answerImageUrl: isImgUrl(a) ? absUrl(a) : undefined,
      studentAnswer: studentAnswer || undefined,
    }),
  })
  if (!r.ok) throw new Error(`ai-quiz ${r.status}`)
  const j = await r.json()
  if (!Array.isArray(j.choices) || j.choices.length !== 5) throw new Error('ai-quiz 보기 오류')
  return {
    question: String(j.question ?? ''),
    choices: j.choices.map((c: unknown) => String(c)),
    answerIndex: Number(j.answerIndex) || 0,
    why: String(j.why ?? ''),
  }
}

// 채점 대기(승인 큐) 카운트 — results에 pending 있는 문항 수
export function pendingCount(results: GradeResult[]): number {
  return results.filter(r => r.pending).length
}
