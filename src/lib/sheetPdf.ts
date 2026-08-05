// 학습지 PDF 생성 — 진짜 PDF 파일로 출력한다 (참고 서비스와 동일한 방식).
// 기존 window.print()는 브라우저 인쇄 설정(여백·배율·용지·머리글)에 따라 조판이 깨졌다.
//
// 캡처는 SVG foreignObject **직접 구현**이다 (라이브러리 무의존).
//  · html2canvas: 자체 텍스트 엔진이라 한글 글리프가 뭉개지고 상단이 잘림 (실출력 검증됨)
//  · html-to-image: 이 워크로드에서 무한 대기 (실크롬 검증됨)
//  · 직접 구현: 실크롬 검증 — A4 1쪽 300dpi 캡처 153ms, 한글·이미지 완벽 (2026-08-01)
// 원리: 페이지 클론(+화면전용 요소 제거) → <img>·@font-face를 dataURL로 인라인 →
//       문서 CSS와 함께 foreignObject SVG로 직렬화 → Image로 로드 → canvas에 3배 렌더.
import { jsPDF } from 'jspdf'

const A4 = { w: 210, h: 297 }   // mm
const RATIO = 3                 // 300dpi급 (페이지 794px × 3 ≈ 2382px)

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b) })
}

// 문서 CSS 수집 — @font-face의 url()은 dataURL로 인라인(실패 규칙은 제외 → 시스템 폰트 폴백).
// foreignObject 안에서는 외부 리소스를 못 불러오므로 전부 SVG 안에 넣어야 한다.
let cssCache: string | null = null
async function collectCss(): Promise<string> {
  if (cssCache != null) return cssCache
  let css = ''
  for (const sheet of document.styleSheets) {
    let rules: CSSRule[]
    try { rules = [...sheet.cssRules] } catch { continue }        // 교차출처 시트는 스킵
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
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
  cssCache = css
  return css
}

/* 한 페이지(.mf-page)를 고해상도 canvas로 캡처 */
async function capturePage(page: HTMLElement): Promise<HTMLCanvasElement> {
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

  const css = await collectCss()
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
    setTimeout(() => rej(new Error('캡처 시간 초과')), 30_000)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * RATIO); canvas.height = Math.round(H * RATIO)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(RATIO, RATIO); ctx.drawImage(img, 0, 0)
  return canvas
}

/* 현재 문서의 .mf-page 들을 순서대로 캡처해 하나의 PDF로 만든다 */
export async function buildSheetPdf(): Promise<jsPDF> {
  const pages = [...document.querySelectorAll<HTMLElement>('.mf-page')]
  if (pages.length === 0) throw new Error('조판된 페이지가 없습니다')
  try { await document.fonts.ready } catch { /* 미지원 브라우저 — 그대로 진행 */ }
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  for (let i = 0; i < pages.length; i++) {
    const canvas = await capturePage(pages[i])
    // JPEG 0.92 — 문항이 원래 래스터 이미지라 화질 손실 체감 없이 용량을 크게 줄인다
    const img = canvas.toDataURL('image/jpeg', 0.92)
    if (i > 0) doc.addPage()
    doc.addImage(img, 'JPEG', 0, 0, A4.w, A4.h, undefined, 'FAST')
  }
  return doc
}

export function savePdf(doc: jsPDF, filename: string): void {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/* 인쇄 — 생성한 PDF를 숨김 iframe에 띄워 바로 인쇄창을 연다.
   브라우저 인쇄창이 'PDF 문서'를 인쇄하므로 여백·배율이 조판에 영향을 주지 않는다. */
export function printPdf(doc: jsPDF): void {
  const url = doc.output('bloburl') as unknown as string
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden'
  frame.src = url
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print() }
    catch { window.open(url, '_blank') }        // PDF 뷰어 미지원 등 — 새 탭 폴백
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 60_000)
  }
  document.body.appendChild(frame)
}
