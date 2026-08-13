import type { GradeResult, Problem, Rubric } from '../types'
import { normAnswer } from './answers'
import { getRubric, putRubric } from './rubric'

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

export interface AiVerdict {
  verdict: boolean | null; reason: string; confidence: 'high' | 'mid' | 'low'
  // ── 점수제(부분점수) — 루브릭이 있을 때만 채워진다 ──
  score?: number; maxScore?: number
  criteria?: { text: string; weight: number; got: number }[]
  feedback?: string          // 학생이 읽는 첨삭 (reason 은 선생님용)
  rubric?: Omit<Rubric, 'id' | 'at' | 'by'>   // 이번에 새로 만들어진 루브릭 → 캐시에 저장한다
}

export async function requestAiGrade(
  p: Problem, studentAnswer: string, workImg?: string,
  opt?: { wantRubric?: boolean; rubric?: { maxScore: number; criteria: { text: string; weight: number }[] } },
): Promise<AiVerdict> {
  const a = (p.answer ?? '').trim()
  const body = {
    wantRubric: opt?.wantRubric || undefined,
    rubric: opt?.rubric,
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
    // 🔴 여기를 빠뜨리면 서버가 점수를 잘 돌려줘도 전부 버려진다. 에러가 안 나서
    //    "왜 점수가 안 뜨지"로 한참 헤매게 된다.
    score: typeof j.score === 'number' ? j.score : undefined,
    maxScore: typeof j.maxScore === 'number' ? j.maxScore : undefined,
    criteria: Array.isArray(j.criteria) ? j.criteria : undefined,
    feedback: j.feedback ? String(j.feedback) : undefined,
    rubric: j.rubric ?? undefined,
  }
}

// ── 서술형 채점 (점수제) ───────────────────────────────────────
// 루브릭 캐시 조회 → 채점 → 새로 만들어졌으면 캐시에 저장. 호출부가 이 순서를 베끼지 않게 한다.
export async function gradeWithRubric(
  p: Problem, studentAnswer: string, workImg?: string,
): Promise<{ v: AiVerdict; rubricAt?: string }> {
  const cached = await getRubric(p.id).catch(() => null)
  const v = await requestAiGrade(p, studentAnswer, workImg, {
    wantRubric: !cached,
    rubric: cached ? { maxScore: cached.maxScore, criteria: cached.criteria } : undefined,
  })
  if (!cached && v.rubric) {
    const r: Rubric = { ...v.rubric, id: p.id, at: new Date().toISOString(), by: 'ai' }
    void putRubric(r)          // 실패해도 채점은 이미 끝났다 — 기다리지 않는다
    return { v, rubricAt: r.at }
  }
  return { v, rubricAt: cached?.at }
}

// ── 확인용 객관식 ─────────────────────────────────────────────
// 서술형을 틀린 학생이 정답을 빨간펜으로 적은 뒤 바로 풀어 보는 5지선다.
// 틀린 문항에서만 호출한다(맞으면 안 부른다).
export interface AiQuiz { question: string; choices: string[]; answerIndex: number; why: string }

export async function requestAiQuiz(p: Problem, studentAnswer: string): Promise<AiQuiz> {
  const a = (p.answer ?? '').trim()
  // 🔴 이 함수는 **서술형(=isMachineGradable false)에서만** 불린다. 그런데 예전에는 정답 텍스트를
  //    보내는 조건이 `a && !isImgUrl(a) && a !== '.' && a !== '-'` 로, 서술형 판정 조건과 **정확히 반대**였다.
  //    → 서술형이면 answerText 가 반드시 undefined → 서버의 `if (!answer) 400` 에 100% 걸려
  //    학생에게는 늘 "확인 문제를 만들지 못했어요"만 떴다. 기능이 통째로 죽어 있었다 (2026-08-13 발견).
  //    이제 정답 이미지·해설 이미지를 함께 보내고, 서버가 AI 에게 **정답을 읽게** 해서 만든다.
  // 🔴 /api/ai-quiz 로 따로 두면 Vercel 함수가 12개 한도를 넘어 배포가 통째로 막힌다
  //    (2026-08-07 실측) — ai-grade 에 mode:'quiz' 로 합쳐 부른다
  const r = await fetch('/api/ai-grade', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'quiz',
      problemImageUrl: absUrl(p.imageUrl),
      problemText: !p.imageUrl && p.body ? p.body : undefined,
      answerText: a && !isImgUrl(a) && a !== '.' && a !== '-' ? a : undefined,
      answerImageUrl: isImgUrl(a) ? absUrl(a) : undefined,
      // 정답 텍스트가 없을 때 AI 가 정답을 읽어낼 근거 — 이게 없으면 서버가 만들지 않는다
      solutionImageUrl: p.solution && isImgUrl(p.solution) ? absUrl(p.solution) : undefined,
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

// ── 확정된 문항만 (승인 대기 제외) ─────────────────────────────
// 🔴 pending 문항은 **아직 채점되지 않은 것**이다. 정답률의 분자에도 분모에도 넣지 않는다.
//    안 그러면 선생님이 승인하기 전의 AI 판정이 성적으로 굳고, 특히 AI 호출이 실패한 날은
//    correct=false 로 저장되어 학부모 화면 정답률과 포인트가 실제보다 낮게 찍힌다
//    (2026-08-13 발견). TodayRoom.tsx 가 이미 같은 규칙을 쓰고 있다.
export function settled(results: GradeResult[]): GradeResult[] {
  return results.filter(r => !r.pending)
}
