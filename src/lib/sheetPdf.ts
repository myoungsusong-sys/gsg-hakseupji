// 학습지 PDF 생성 — 매쓰플랫과 같은 방식(진짜 PDF 파일)으로 출력한다.
// 기존 window.print()는 브라우저 인쇄 설정(여백·배율·용지·머리글)에 따라 조판이 깨졌다.
// 화면에 조판된 A4 페이지(.mf-page)를 고해상도로 캡처해 PDF로 조립하면
// 어떤 브라우저·프린터에서도 항상 같은 출력물이 나온다 (매쓰플랫 미리보기=PDF와 동일 경험).
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const A4 = { w: 210, h: 297 }   // mm
// 300dpi급 선명도: 페이지 DOM(210mm ≈ 794px@96dpi) × 3 ≈ 2380px 폭
const SCALE = 3

/* 현재 문서의 .mf-page 들을 순서대로 캡처해 하나의 PDF로 만든다.
   문항·해설은 원래 이미지(CDN, CORS 허용)라 useCORS로 깨끗하게 캡처된다. */
export async function buildSheetPdf(): Promise<jsPDF> {
  const pages = [...document.querySelectorAll<HTMLElement>('.mf-page')]
  if (pages.length === 0) throw new Error('조판된 페이지가 없습니다')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: SCALE,
      useCORS: true,                 // CDN 이미지(access-control-allow-origin: *) 직접 캡처
      backgroundColor: '#ffffff',
      logging: false,
    })
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
   브라우저 인쇄창이 'PDF 문서'를 인쇄하므로 여백·배율이 조판에 영향을 주지 않는다.
   (팝업/새 탭이 아니라서 차단당하지 않는다) */
export function printPdf(doc: jsPDF): void {
  const url = doc.output('bloburl') as unknown as string
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden'
  frame.src = url
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print() }
    catch { window.open(url, '_blank') }        // PDF 뷰어 미지원 등 — 새 탭 폴백
    // 인쇄창이 닫힌 뒤 정리 (print()는 동기 블록이 아닐 수 있어 넉넉히)
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 60_000)
  }
  document.body.appendChild(frame)
}
