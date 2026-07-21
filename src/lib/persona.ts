// ── 학습 성향 힌트 (MBTI·혈액형) ────────────────────────────────
// ⚠️ 이건 "참고 힌트"다. 실제 편성·코칭은 진단 결과·완료 기록(실측)이 우선하고,
//    여기서 나온 값은 기본값 제안과 상담 문구에만 쓴다. 학생에게 낙인이 되지 않게 표현도 순화한다.

export const MBTI_TYPES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
] as const
export const BLOOD_TYPES = ['A', 'B', 'O', 'AB'] as const

export interface PersonaHint {
  slotMin: number         // 권장 블록 길이(분)
  interleave: boolean     // 과목을 자주 바꿔주는 게 좋은지
  planStyle: string       // 계획 스타일 한 줄
  tips: string[]          // 코칭 팁 (상담·리포트에 인용)
}

// 4지표 각각이 학습 운영에 주는 시사점만 뽑아 조합한다(성격 규정이 아니라 운영 파라미터).
export function personaOf(mbti?: string, blood?: string): PersonaHint | null {
  const t = (mbti ?? '').toUpperCase().trim()
  if (!/^[EI][NS][TF][JP]$/.test(t)) return null
  const [ei, ns, tf, jp] = t.split('') as ['E' | 'I', 'N' | 'S', 'T' | 'F', 'J' | 'P']

  // 블록 길이: 내향+판단형은 긴 몰입이 잘 붙고, 외향+인식형은 짧게 끊는 편이 유지된다
  let slotMin = 60
  if (ei === 'I' && jp === 'J') slotMin = 90
  else if (ei === 'E' && jp === 'P') slotMin = 40
  else if (ei === 'E' || jp === 'P') slotMin = 50

  const interleave = jp === 'P' || ei === 'E'   // 지루함을 덜 타게 과목 교차

  const planStyle = jp === 'J'
    ? '미리 정해진 계획을 지키는 쪽이 편한 편 — 주간 계획을 한 번에 확정해 주세요.'
    : '빡빡한 계획엔 부담을 느낄 수 있음 — 필수 분량 + 선택 분량으로 여지를 두세요.'

  const tips: string[] = []
  tips.push(ei === 'I'
    ? '조용한 자리·개별 피드백에서 더 잘 나옵니다. 발표형 확인보다 노트 확인이 효과적.'
    : '설명하게 하면 이해가 빨라집니다. 짝 설명·질문 유도를 섞어 주세요.')
  tips.push(ns === 'S'
    ? '구체적인 예제 → 규칙 순서가 잘 맞습니다. 추상 설명이 길면 놓칠 수 있어요.'
    : '왜 그런지(원리·연결)를 먼저 짚어주면 몰입이 빨라집니다. 반복 연산은 지루해할 수 있어요.')
  tips.push(tf === 'T'
    ? '틀린 이유를 논리적으로 짚어주면 납득이 빠릅니다.'
    : '먼저 인정해 주고 고칠 점을 말하면 훨씬 잘 받아들입니다.')
  tips.push(jp === 'J'
    ? '체크리스트·마감일이 동기부여가 됩니다.'
    : '마감 직전 몰아치기 경향 — 중간 점검일을 하나 끼워 두세요.')

  const b = (blood ?? '').toUpperCase().trim()
  if (b) tips.push(`혈액형 ${b}형 — 라포 형성용 참고 정보입니다(학습 판단 근거로는 쓰지 않습니다).`)

  return { slotMin, interleave, planStyle, tips }
}

// 성향 한 줄 요약 (학생 목록·리포트 뱃지용)
export function personaBadge(mbti?: string, blood?: string): string {
  const parts: string[] = []
  if (mbti) parts.push(mbti.toUpperCase())
  if (blood) parts.push(`${blood.toUpperCase()}형`)
  return parts.join(' · ')
}
