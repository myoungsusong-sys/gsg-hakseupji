// ── 성취도 7단계 컬러 공통 체계 (매쓰플랫 원본 정의) ─────────────────────────
// 원본 ⓘ 설명 모달: "학생 학습 결과에 따라 성취도를 컬러로 보여줘요 — 학생이 학습한 학습지,
// 교과서, 시중교재, 자기주도학습(new)을 통한 모든 채점 데이터를 다음과 같은 컬러로 표시해요."
// 화이트(시작 전) / 그레이(학습량 부족 — 2문제 미만) / 새드 / 레드 / 옐로우 / 그린 / 스마일.
// 원본은 화이트·그레이 기준만 명시(2문제 이상) — 나머지 5색의 정답률 구간은 명시가 없어
// 합리적 구간으로 정의: 새드 <25% / 레드 25~50% / 옐로우 50~70% / 그린 70~90% / 스마일 ≥90%.
// 소비처: 수업>유형분석 매트릭스·범례, 학생앱 챌린지 유형 카드, 취약 유형 판정(lib/drill.ts).

export interface AchievementStat { wrong: number; total: number }

export type AchievementKey = 'white' | 'gray' | 'sad' | 'red' | 'yellow' | 'green' | 'smile'

export interface AchievementGrade {
  key: AchievementKey
  name: string    // 컬러명 (화이트 …)
  desc: string    // 원본 설명 모달 문구 그대로
  cls: string     // 칩(배경+글자) 클래스
  dot: string     // 작은 사각 타일용 단색 클래스
  emoji: string   // 설명 모달·범례 보조 표기
}

// 순서 = 낮음 → 높음 (index로 등급 비교 가능)
export const ACHIEVEMENT_GRADES: AchievementGrade[] = [
  { key: 'white',  name: '화이트',  desc: '아직 학습을 시작하지 않았어요.', cls: 'border border-line bg-white text-ink2/60', dot: 'border border-line bg-white', emoji: '⬜' },
  { key: 'gray',   name: '그레이',  desc: '학습량이 부족해요. 2문제 이상 풀어보세요!', cls: 'bg-stone-200 text-stone-600', dot: 'bg-stone-300', emoji: '🩶' },
  { key: 'sad',    name: '새드',    desc: '전혀 이해하지 못하고 있어요.', cls: 'bg-rose-600 text-white', dot: 'bg-rose-600', emoji: '😢' },
  { key: 'red',    name: '레드',    desc: '이해도가 낮은 상태예요.', cls: 'bg-red-400 text-white', dot: 'bg-red-400', emoji: '🔴' },
  { key: 'yellow', name: '옐로우',  desc: '개념을 이해하고 있지만 보충이 필요해요.', cls: 'bg-amber-300 text-amber-900', dot: 'bg-amber-300', emoji: '🟡' },
  { key: 'green',  name: '그린',    desc: '개념을 충분히 이해하여, 문제를 풀 수 있어요.', cls: 'bg-lime-400 text-lime-950', dot: 'bg-lime-400', emoji: '🟢' },
  { key: 'smile',  name: '스마일',  desc: '완전히 이해하고 있어요.', cls: 'bg-pine text-white', dot: 'bg-pine', emoji: '😊' },
]

const byKey = new Map(ACHIEVEMENT_GRADES.map((g, i) => [g.key, i]))

// 유형별 채점 집계 → 성취도 등급
export function achievementOf(stat: AchievementStat | undefined): AchievementGrade {
  if (!stat || stat.total === 0) return ACHIEVEMENT_GRADES[0]           // 화이트: 시작 전
  if (stat.total < 2) return ACHIEVEMENT_GRADES[1]                      // 그레이: 학습량 부족(2문제 미만)
  const rate = 1 - stat.wrong / stat.total
  if (rate >= 0.9) return ACHIEVEMENT_GRADES[6]                         // 스마일
  if (rate >= 0.7) return ACHIEVEMENT_GRADES[5]                         // 그린
  if (rate >= 0.5) return ACHIEVEMENT_GRADES[4]                         // 옐로우
  if (rate >= 0.25) return ACHIEVEMENT_GRADES[3]                        // 레드
  return ACHIEVEMENT_GRADES[2]                                          // 새드
}

// 등급 비교용 인덱스 (0=화이트 … 6=스마일)
export function achievementIndex(stat: AchievementStat | undefined): number {
  return byKey.get(achievementOf(stat).key) ?? 0
}

// 취약 판정 통일: 새드·레드(정답률 50% 미만, 2문제 이상)면 취약
export function isWeakGrade(stat: AchievementStat | undefined): boolean {
  const k = achievementOf(stat).key
  return k === 'sad' || k === 'red'
}
