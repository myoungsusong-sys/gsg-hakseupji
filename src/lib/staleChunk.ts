// ── 새 배포로 옛 청크가 사라진 상황(stale chunk) 판별 ────────────────────
//
// 무슨 일이 벌어지나: 이 앱은 무거운 모듈(PDF 조판기 등)을 필요할 때만 동적으로 부른다.
// 새 버전을 배포하면 빌드가 파일 이름에 새 해시를 붙이므로 옛 파일은 서버에서 사라진다.
// 그런데 선생님이 **탭을 열어 둔 채** 오래 쓰다가 그 기능을 누르면, 그 탭은 여전히 옛 이름을
// 부르고 → 404 → "Failed to fetch dynamically imported module" 이 뜬다.
//
// 🔴 이건 앱 고장이 아니라 **새로고침 한 번이면 끝나는 일**이다. 그런데 영문 TypeError 로만
//    보여서 선생님에겐 앱이 깨진 것으로 읽힌다 (2026-08-13 실제 문의: PDF 인쇄가 안 된다).
//    브라우저마다 문구가 달라서 아래 세 갈래를 모두 본다.
//
// ⚠️ 자동 새로고침은 하지 않는다 — 선생님 화면은 채점 도중 리로드되면 진행이 날아간다
//    (Layout.tsx 의 같은 경고 참조). 반드시 물어보고 사용자가 고르게 한다.
export function isStaleChunkError(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e)
  return /Failed to fetch dynamically imported module/i.test(m)   // Chrome·Edge
    || /error loading dynamically imported module/i.test(m)        // Firefox
    || /Importing a module script failed/i.test(m)                 // Safari
}
