import { useStore } from './store'
import { useSubject, type Subject } from './subject'

// 학원명 과목 반영: 과목이 과학이면 이름 끝의 '수학'→'과학' (예: 깊은생각수학→깊은생각과학).
// 그 외(수학이거나, '수학'으로 끝나지 않는 커스텀 학원명 — 예: 대치스파르타 프리미엄)는 그대로 둔다.
export function brandFor(academyName: string, subject: Subject): string {
  return subject === '과학' ? academyName.replace(/수학$/, '과학') : academyName
}

export const DEFAULT_ACADEMY = '대치스파르타 프리미엄'
// 이전 기본 학원명 — 이 이름으로 만들어 둔 학습지도 계속 '내 것'으로 인식하기 위해 남겨 둔다.
export const LEGACY_ACADEMY = '깊은생각수학'

// 설정된 학원명(academyProfile) + 현재 전역 과목(헤더 스위처)을 반영한 표시 브랜드
export function useBrand(): string {
  const { academyProfile } = useStore()
  const [subject] = useSubject()
  return brandFor(academyProfile.academyName?.trim() || DEFAULT_ACADEMY, subject)
}

// 학습지 '출제자/게시자'가 우리 학원(과목 무관) 것인지 — 마이리스트·내가 만든 필터용.
// 설정 학원명과 그 과학 변형, 기본값, 그리고 예전 기본값(깊은생각수학/과학)까지 우리 것으로 인정
// — 브랜드를 바꿔도 이전에 만든 학습지가 '내가 만든' 목록에서 빠지지 않도록.
export function myAuthorSet(academyName: string): Set<string> {
  const base = academyName.trim() || DEFAULT_ACADEMY
  return new Set([
    base, brandFor(base, '과학'),
    DEFAULT_ACADEMY, brandFor(DEFAULT_ACADEMY, '과학'),
    LEGACY_ACADEMY, brandFor(LEGACY_ACADEMY, '과학'),
  ])
}
