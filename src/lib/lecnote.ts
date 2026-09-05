// 🎧 인강노트 확인 — GPT로 만든 강의노트·문제풀이노트를 학습지앱의 학습지로 바꾼다 (2026-09-05 명수쌤)
//
//   "인강의 강의노트와 문제풀이노트는 내가 지피티로 만들어줄거야. 그거 확인 빈칸테스트와 문제는
//    우리 학습지앱에 동일하게 적용시켜서 만들어줘. 문제는 내가 스캔할거야."
//
// 두 갈래 모두 **기존 학습지 파이프라인**을 그대로 탄다 — 문제(hj_problems) → 학습지(hj_worksheets) →
// 배정(assignments) → 학생앱에서 풀고 자동채점 → 오늘 교실·관리앱 채점판에 뜬다. 새 표는 없다.
//
//  ① 빈칸테스트: 노트 글에서 [[정답]] 으로 표시된 자리를 빈칸으로 뚫어 주관식 문항을 만든다.
//     한 줄 = 한 문항. 빈칸이 여러 개면 (가)(나) 파트 답(`(가) X, (나) Y`)으로 — answers.ts answerParts 가
//     이미 칸을 나눠 받는다. 파트 규칙(각 15자·전체 60자)에 안 맞으면 빈칸마다 문항을 따로 낸다.
//  ② 스캔 문제: 스캔한 쪽 이미지를 드래그로 잘라 문항 하나씩 이미지 문항으로 만든다(GichulTag 와 같은 방식).
//     답은 객관식 ①~⑤ 또는 주관식 글. 학생앱은 이미지 문항을 그대로 보여 주고 ①~⑤ 단추로 받는다.
//
// 이 파일은 순수 함수만 둔다 — 화면 없이 노드에서 검증할 수 있게.

export const BLANK_RE = /\[\[([^\]]+?)\]\]|\{\{([^}]+?)\}\}|【([^】]+?)】|〔([^〕]+?)〕/g

export interface BlankLine {
  line: string          // 원문 한 줄 (마커 포함)
  answers: string[]     // 빈칸 정답들 (등장 순서)
}

export interface BlankProblemDraft {
  body: string          // 빈칸이 ▢ 로 뚫린 문장
  answer: string        // 단일: 정답 / 여러 개: `(가) X, (나) Y`
  solution: string      // 정답을 채운 원문
  parts: number         // 이 문항이 받는 칸 수
  warn?: string
}

const PART_LABELS = ['가', '나', '다', '라', '마', '바', '사', '아'] as const

/** `[[a|b]]` 처럼 대안이 있으면 채점기가 아는 「또는」으로 잇는다 (mathAnswer.alternatives 가 나눈다) */
function answerText(raw: string): string {
  const alts = raw.split('|').map(s => s.trim()).filter(Boolean)
  return alts.length > 1 ? alts.join(' 또는 ') : (alts[0] ?? raw.trim())
}

/** 노트 글 → 빈칸이 있는 줄 목록. 빈칸 없는 줄·제목 줄(#)은 문항이 되지 않는다. */
export function parseBlankLines(text: string): BlankLine[] {
  const out: BlankLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const answers: string[] = []
    for (const m of line.matchAll(BLANK_RE)) answers.push(answerText(m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''))
    if (answers.length === 0) continue
    out.push({ line, answers })
  }
  return out
}

/** 줄머리 번호·글머리(1. / ① / - / •)를 떼어 낸다 — 문항 번호는 학습지가 새로 붙인다 */
function stripBullet(s: string): string {
  return s.replace(/^\s*(?:\(?\d{1,2}[).]|[①-⑳]|[-•·▪◦*]|[가-힣]\.)\s*/, '')
}

/** 파트 답으로 낼 수 있나 — answers.ts answerParts 와 같은 조건 */
function partsEligible(answers: string[]): boolean {
  if (answers.length < 2 || answers.length > PART_LABELS.length) return false
  if (answers.some(a => !a || a.length > 15 || a.includes('\\;'))) return false
  const joined = answers.map((a, i) => `(${PART_LABELS[i]}) ${a}`).join(', ')
  return joined.length <= 60
}

/** 빈칸 줄 하나 → 문항 초안 1개 이상 */
export function draftsFromLine(bl: BlankLine): BlankProblemDraft[] {
  const base = stripBullet(bl.line)
  const filled = base.replace(BLANK_RE, (_m, a, b, c, d) => `「${answerText(a ?? b ?? c ?? d ?? '')}」`)
  if (bl.answers.length === 1) {
    return [{ body: base.replace(BLANK_RE, '▢'), answer: bl.answers[0], solution: filled, parts: 1 }]
  }
  if (partsEligible(bl.answers)) {
    let i = 0
    const body = base.replace(BLANK_RE, () => `(${PART_LABELS[i++]})▢`)
    const answer = bl.answers.map((a, k) => `(${PART_LABELS[k]}) ${a}`).join(', ')
    return [{ body, answer, solution: filled, parts: bl.answers.length }]
  }
  // 파트 규칙에 안 맞으면(답이 길다) 빈칸마다 문항을 따로 — 다른 빈칸은 ____ 로 가린다
  return bl.answers.map((ans, k) => {
    let i = 0
    const body = base.replace(BLANK_RE, () => (i++ === k ? '▢' : '____'))
    return { body, answer: ans, solution: filled, parts: 1, warn: '빈칸이 많거나 답이 길어 한 칸씩 따로 냈습니다' }
  })
}

export function draftsFromNote(text: string): BlankProblemDraft[] {
  return parseBlankLines(text).flatMap(draftsFromLine)
}

// ── 스캔 문제: 잘라내기 ────────────────────────────────────────────────────

export interface CropRect { x: number; y: number; w: number; h: number }   // 원본 픽셀

/** 이미지의 한 부분을 잘라 JPEG data URL 로. 긴 변 maxEdge 로 줄여 저장 크기를 잡는다(문항당 수십 KB). */
export function cropToJpeg(img: HTMLImageElement, r: CropRect, maxEdge = 1100, quality = 0.8): string {
  const sx = Math.max(0, Math.floor(r.x)), sy = Math.max(0, Math.floor(r.y))
  const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(r.w)))
  const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(r.h)))
  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(sw * scale)); cv.height = Math.max(1, Math.round(sh * scale))
  const g = cv.getContext('2d')
  if (!g) return ''
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height)
  g.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/jpeg', quality)
}

/** data URL 의 대략 바이트 수 (base64 → 3/4) */
export function dataUrlBytes(u: string): number {
  const i = u.indexOf(',')
  return i < 0 ? 0 : Math.round((u.length - i - 1) * 0.75)
}

/** 객관식 답 정규화 — 3 / ③ / 3번 → ③ */
export function normChoiceAnswer(s: string): string {
  const t = s.trim()
  const m = t.match(/^[(（]?([1-5①-⑤])[)）]?\s*번?$/)
  if (!m) return t
  const ch = m[1]
  const n = '①②③④⑤'.indexOf(ch) >= 0 ? '①②③④⑤'.indexOf(ch) + 1 : Number(ch)
  return '①②③④⑤'[n - 1] ?? t
}
