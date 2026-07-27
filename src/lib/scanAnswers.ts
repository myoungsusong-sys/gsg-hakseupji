// 사진 한 장으로 한 쪽 답 채우기 — 클라이언트 쪽 도우미 (2026-07-27 명수쌤 지시)
//
// 흐름: 학생이 공책에 쓴 답을 찍는다 → /api/scan-answers 가 번호별로 **읽어서** 돌려준다
//       → 그 값을 입력칸에 채운다 → 학생이 눈으로 확인·수정 → 기존 [채점하기]로 채점.
// AI는 읽기만 하고 채점은 기존 엔진(mathEqual)이 그대로 한다 — 채점 로직이 안 바뀌므로
// 전수 감사 기준선도 그대로다. 오독은 칸에 그대로 보이니 학생이 고칠 수 있다.

export type ScanKind = '객관식' | 'OX' | '주관식'
export type ScanItem = { no: string; kind: ScanKind; parts?: number }
export type ScanResult = { no: string; answer: string; confidence: 'high' | 'mid' | 'low' }

/** 촬영/선택한 사진을 긴 변 기준으로 줄여 JPEG data URL 로 만든다 (업로드 크기·토큰 절약) */
export function fileToScaledJpeg(file: File, maxEdge = 1600): Promise<{ dataUrl: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('사진을 열지 못했습니다.'))
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        const g = cv.getContext('2d')
        if (!g) { reject(new Error('사진을 처리하지 못했습니다.')); return }
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h)
        g.drawImage(img, 0, 0, w, h)
        resolve({ dataUrl: cv.toDataURL('image/jpeg', 0.82), mediaType: 'image/jpeg' })
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** 사진에서 번호별 학생 답을 읽어온다. 정답은 보내지 않는다(편향 방지 — api/scan-answers.ts 주석 참고). */
export async function scanAnswersFromPhoto(args: {
  dataUrl: string
  mediaType: string
  items: ScanItem[]
  pageLabel?: string
}): Promise<ScanResult[]> {
  const res = await fetch('/api/scan-answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: args.dataUrl,
      mediaType: args.mediaType,
      items: args.items,
      pageLabel: args.pageLabel,
    }),
  })
  if (!res.ok) {
    let msg = `사진 읽기에 실패했습니다 (${res.status})`
    try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch { /* 그대로 */ }
    throw new Error(msg)
  }
  const j = await res.json()
  return Array.isArray(j?.answers) ? (j.answers as ScanResult[]) : []
}
