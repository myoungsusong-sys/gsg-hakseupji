// ── Summit On 브랜드 마크 ────────────────────────────────────────────
// 제품명(로고)을 한 곳에서 관리한다. 예전엔 "깊은생각 학습지"가 5개 화면에
// 각각 하드코딩돼 있어 바꿀 때마다 흩어졌다 → 여기 하나만 고치면 전부 반영된다.
//
// 🔴 서울대 공식 엠블럼은 서울대의 등록상표라 상업용 앱에 복제하면 상표권·제휴 오인
//    문제가 된다(대표님께 별도 안내함). 그래서 서울대 마크 대신 이름 "Summit On"에 맞는
//    오리지널 정상(峰) 마크를 쓴다. 위로 솟는 봉우리 = summit, 동시에 "on/up" 의 상승감.
//    최종 교체 여부는 대표님 결정.

export const APP_NAME = 'Summit On'        // 제품명(영문 워드마크)
export const APP_NAME_KO = '서밋온'         // 한글 표기
export const APP_NAME_FULL = 'Summit On'   // 문서 title 등

// 정상 마크 (원형 배지 안 이중 봉우리). currentColor 를 따르므로 어디에 놔도 톤이 맞는다.
export function SummitMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" className="fill-pine" />
      {/* 눈 덮인 이중 봉우리 — 뒤 봉우리(옅게) + 앞 봉우리(선명) */}
      <path d="M6 23 L13 11 L17 17 L20.5 12 L26 23 Z" fill="#fff" fillOpacity="0.35" />
      <path d="M6 23 L12 13.5 L16 19 L19 14.5 L24 23 Z" fill="#fff" />
      {/* 정상 눈 캡 */}
      <path d="M10.6 17 L12 13.5 L13.4 17 L12 16.2 Z" className="fill-pine" fillOpacity="0.9" />
    </svg>
  )
}

// 로고 = 마크 + 워드마크. variant 로 배치를 고른다.
//  · 'full'   : 마크 + "Summit On" (헤더 기본)
//  · 'stacked': 큰 마크 위, 아래 워드마크 (로그인 화면)
export function BrandLogo({
  variant = 'full', className = '', markSize,
}: { variant?: 'full' | 'stacked'; className?: string; markSize?: number }) {
  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <SummitMark size={markSize ?? 52} />
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black tracking-tight text-pine-dark">Summit</span>
          <span className="text-2xl font-light text-ink">On</span>
        </div>
      </div>
    )
  }
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <SummitMark size={markSize ?? 26} />
      <span className="flex items-baseline gap-1">
        <span className="text-xl font-black tracking-tight text-pine-dark">Summit</span>
        <span className="text-xl font-light text-ink">On</span>
      </span>
    </span>
  )
}
