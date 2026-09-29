// 화면 요소 → canvas 캡처 (SVG foreignObject 직접 구현, 라이브러리 무의존)
// 원래 sheetPdf.ts 안에 있던 것을 떼어 냈다 — 학습지 PDF 와 «문제 바로 질문»(problemShot.ts)이 같이 쓴다.
//  · html2canvas: 자체 텍스트 엔진이라 한글 글리프가 뭉개지고 상단이 잘림 (실출력 검증됨)
//  · html-to-image: 이 워크로드에서 무한 대기 (실크롬 검증됨)
//  · 직접 구현: 실크롬 검증 — A4 1쪽 300dpi 캡처 153ms, 한글·이미지 완벽 (2026-08-01)
// 원리: 요소 클론(+화면전용 요소 제거) → <img>·@font-face를 dataURL로 인라인 →
//       문서 CSS와 함께 foreignObject SVG로 직렬화 → Image로 로드 → canvas에 배율 렌더.

export function blobToDataURL(b: Blob): Promise<string> {
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b) })
}

// 문서 CSS 수집 — @font-face의 url()은 dataURL로 인라인(실패 규칙은 제외 → 시스템 폰트 폴백).
// foreignObject 안에서는 외부 리소스를 못 불러오므로 전부 SVG 안에 넣어야 한다.
// withFonts=false 면 @font-face 를 통째로 뺀다(수식 없는 문제 — 폰에서 글꼴 수십 개를 받지 않게).
const cssCache = new Map<string, string>()
export async function collectCss(withFonts = true): Promise<string> {
  const key = withFonts ? 'all' : 'nofont'
  const hit = cssCache.get(key)
  if (hit != null) return hit
  let css = ''
  for (const sheet of document.styleSheets) {
    let rules: CSSRule[]
    try { rules = [...sheet.cssRules] } catch { continue }        // 교차출처 시트는 스킵
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        if (!withFonts) continue
        const m = /url\(["']?([^"')]+)["']?\)/.exec(rule.cssText)
        if (!m) continue
        try {
          const abs = new URL(m[1], sheet.href || location.href).href
          const r = await fetch(abs); if (!r.ok) throw new Error()
          const durl = await blobToDataURL(await r.blob())
          css += rule.cssText.replace(/url\(["']?[^"')]+["']?\)[^,;]*/g, `url(${durl})`) + '\n'
        } catch { /* 폰트 인라인 실패 — 규칙 제외 */ }
      } else css += rule.cssText + '\n'
    }
  }
  cssCache.set(key, css)
  return css
}

/* 요소 하나를 고해상도 canvas로 캡처 */
export async function captureNode(page: HTMLElement, ratio = 3, opts: { withFonts?: boolean; timeoutMs?: number } = {}): Promise<HTMLCanvasElement> {
  const W = page.offsetWidth, H = page.offsetHeight
  const clone = page.cloneNode(true) as HTMLElement
  // 화면 전용 요소 제거 — 인쇄 CSS와 달리 캡처에는 화면 CSS가 적용되므로 직접 걸러야 한다
  clone.querySelectorAll('.no-print').forEach(n => n.remove())

  // 이미지 인라인 (외부 URL은 foreignObject 렌더 시 canvas를 오염시킴). CDN은 CORS 허용(*) 확인됨.
  await Promise.all([...clone.querySelectorAll('img')].map(async img => {
    const src = img.getAttribute('src') || ''
    if (src.startsWith('data:')) return
    try {
      const r = await fetch(new URL(src, location.href).href, { mode: 'cors' })
      if (!r.ok) throw new Error()
      img.setAttribute('src', await blobToDataURL(await r.blob()))
    } catch { img.remove() }                                      // 실패 이미지는 제거(전체 오염 방지)
  }))

  const css = await collectCss(opts.withFonts ?? true)
  const xhtml = new XMLSerializer().serializeToString(clone)
  // ⚠️ SVG는 XML로 파싱된다 — Tailwind CSS에는 '>' '&' 같은 문자가 흔해서
  //    <style>을 그대로 넣으면 XML 파싱이 깨져 렌더가 실패한다(=페이지 렌더 실패).
  //    CDATA로 감싸 CSS를 문자 데이터로 취급하게 한다.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style><![CDATA[${css.replace(/]]>/g, ']] >')}]]></style>${xhtml}</div></foreignObject></svg>`

  // ⚠️ blob: URL은 쓰면 안 된다 — SVG를 blob으로 로드하면 캔버스가 오염돼(tainted)
  //    toDataURL이 막힌다(실측 확인). data: URL이어야 오염 없이 내보낼 수 있다.
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error(`페이지 렌더 실패 (SVG ${Math.round(svg.length / 1024)}KB)`))
    setTimeout(() => rej(new Error('캡처 시간 초과')), opts.timeoutMs ?? 30_000)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(ratio, ratio); ctx.drawImage(img, 0, 0)
  return canvas
}
