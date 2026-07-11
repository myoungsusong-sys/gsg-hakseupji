import { useStore } from './store'
import { useSubject, type Subject } from './subject'

// 학원명 과목 반영: 과목이 과학이면 이름 끝의 '수학'→'과학' (예: 깊은생각수학→깊은생각과학).
// 그 외(수학이거나, '수학'으로 끝나지 않는 커스텀 학원명)는 그대로 둔다.
export function brandFor(academyName: string, subject: Subject): string {
  return subject === '과학' ? academyName.replace(/수학$/, '과학') : academyName
}

export const DEFAULT_ACADEMY = '깊은생각수학'

// 설정된 학원명(academyProfile) + 현재 전역 과목(헤더 스위처)을 반영한 표시 브랜드
export function useBrand(): string {
  const { academyProfile } = useStore()
  const [subject] = useSubject()
  return brandFor(academyProfile.academyName?.trim() || DEFAULT_ACADEMY, subject)
}

// 학습지 '출제자/게시자'가 우리 학원(과목 무관) 것인지 — 마이리스트·내가 만든 필터용.
// 설정 학원명과 그 과학 변형, 기본값(깊은생각수학/과학)을 모두 우리 것으로 인정.
export function myAuthorSet(academyName: string): Set<string> {
  const base = academyName.trim() || DEFAULT_ACADEMY
  return new Set([base, brandFor(base, '과학'), DEFAULT_ACADEMY, brandFor(DEFAULT_ACADEMY, '과학')])
}
