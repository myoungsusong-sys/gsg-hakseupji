// 답안 정규화 — 채점 대조는 normAnswer(a) === normAnswer(b)
const CIRCLED = '①②③④⑤'

// 매쓰플랫 서술형(정답이 텍스트로 없는 문항) — 정답이 풀이(정답) 이미지로만 제공된다.
// 수집 시 answer 를 `@<pid>/<hash>` 마커로 저장 → 표시 때 매쓰플랫 CDN answer.png 로 렌더.
// (pool.ts 의 broken 정답 처리와 동일한 freewheelin-contents CDN·이미지 방식)
// 매쓰플랫 서술형 실제 정답 이미지(S3 essay-answer) 공통 프리픽스 — wb-match엔 '@s3/<suffix>'로 압축 저장
const S3_ANSWER_PREFIX =
  'https://mathflat-user-uploads.s3.ap-northeast-2.amazonaws.com/supported-workbook/public-workbook/essay-answer/'

export function wbAnswerImg(answer: string | undefined | null): string | null {
  if (!answer) return null
  const a = answer.trim()
  // 압축형: @s3/<책해시>/<파일>.png → 실제 정답 이미지 URL
  if (a.startsWith('@s3/')) return S3_ANSWER_PREFIX + a.slice(4)
  // 실제 정답 이미지 URL(매쓰플랫 서술형 answerImageUrl, S3 등) — 직접 사용
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(a)) return a
  // (레거시) @pid/hash → freewheelin CDN answer.png
  const m = a.match(/^@(\d+)\/([0-9a-f]+)$/i)
  if (!m) return null
  return `https://freewheelin-contents.mathflat.com/problem/${m[1]}/${m[2]}/answer.png`
}

// 서술형(문장으로 답하는) 문항인지 — 정답이 "문장"이거나 "(예)…" 예시답안인 경우.
// 이런 답은 학생이 뜻만 맞게 써도 글자가 같을 리 없어 기계 대조가 불가능하다.
// (자동채점에 두면 사실상 무조건 오답 — 과학 서술형 8.9%, 초등 문장제 0.7%가 여기 해당)
// → 자동채점에서 빼고, 모범답안을 보여주는 자기채점으로 돌린다.
const ESSAY_TAIL = /(다|요|음|임|함|됨)\s*\.?\s*$/
// 서술어미로 끝나지 않지만 정답이 하나로 정해지지 않는 꼬리 — 자동채점하면 무조건 오답이다.
//  · `… 등` : 예시 나열("윷짝 던지기, 주사위 던지기 등"). 앞에 공백·쉼표·괄호가 와야 한다 —
//    붙여 쓴 `20등`·`신호등`·`가로등`은 멀쩡한 정답이라 건드리면 안 된다(전수 확인: 걸러낼 것 37건).
//  · `… 중 하나`·`… 중 한 가지` : 교재가 택일을 허용한 답("3,6,9,12,15,18 중 하나").
const ESSAY_OPEN_TAIL =
  /(?:[\s,、·)\]】]등|[\s,、·)\]】]중\s*(?:한|하나|두|세|네|다섯|[0-9]+)\s*(?:가지|개)?)\s*\.?\s*$/
export function isEssayAnswer(answer: string | undefined | null): boolean {
  const a = (answer ?? '').trim()
  if (!a) return false
  // "(예) …" · "예) …" · "예: …" · "예시: …" — 교재가 명시한 예시 답안. 정답이 하나로 정해지지 않는다.
  if (/^\(?예(시)?[):：]/.test(a.replace(/\s/g, ''))) return true
  const plain = a.replace(/\\[;,! ]/g, ' ')          // LaTeX 간격을 공백으로
  // 예시 나열·택일은 길이·한글 조건을 두지 않는다(수식 나열 "…,\sqrt{2}+0.1 등"도 대조 불가라 같다)
  if (ESSAY_OPEN_TAIL.test(plain)) return true
  return plain.length >= 12 && /\s/.test(plain) && /[가-힣]/.test(plain) && ESSAY_TAIL.test(plain)
}

// ── 손으로 치기엔 너무 긴 수식 답 ────────────────────────────────────────
// 베이직쎈 공통수학1 8P처럼 한 쪽 12문항이 전부 `x^3-2x^2+4xy+3y^2-y+5` 급 다항식인
// 곳이 있다. 답을 알아도 한 쪽에 250타를 쳐야 해서 학생이 못 견딘다.
// → 자동채점에서 빼고, 서술형과 같은 모범답안 자기채점으로 돌린다. (2026-07-27 명수쌤 지시)
//
// 기준은 "학생이 실제로 쳐야 하는 타수" 15자 이상 + 변수 + (지수·분수·근호). 셋을 모두
// 요구하는 이유 —
//  · 길이만 보면 `진호: 55점, 혜영: 53점` 같은 초등 나열형이 대량으로 딸려온다.
//  · 변수·수식 기호가 없는 답은 아무리 길어도 그냥 숫자·낱말이라 치는 부담이 작다.
// 초등 교재는 아예 제외한다(자기채점을 맡기기 이른 학년이고, 대상도 986건뿐이었다).

/** 학생이 실제로 쳐야 하는 타수 추정 — LaTeX 껍데기를 학생 표기(`{x}^{3}`→`x^3`)로 벗긴 길이 */
function typeLen(a: string): number {
  let t = a
  for (let i = 0; i < 6; i++) {
    const n = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
    if (n === t) break
    t = n
  }
  return t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√$1')
    .replace(/\\[a-zA-Z]+/g, '@')      // 남은 LaTeX 명령은 한 글자로 친다
    .replace(/[{}]/g, '').replace(/\s+/g, '').length
}

export function isHeavyMathAnswer(answer: string | undefined | null, elementary = false): boolean {
  const a = (answer ?? '').trim()
  if (!a || elementary) return false
  if (typeLen(a) < 15) return false
  if (!/[a-zA-Z]/.test(a.replace(/\\[a-zA-Z]+/g, ''))) return false   // 변수 없는 답은 제외
  // 각도 `^{\circ}` 는 지수로 세지 않는다 — `∠x=50°, ∠y=130°` 는 치기 쉬운 답이다(996건)
  const s = a.replace(/\^\s*\{?\s*(?:\\circ|°|o)\s*\}?/g, '°')
  return /\^|\\frac|\\sqrt/.test(s)
}

// ── (가)·(나)를 함께 묻는 주관식 ────────────────────────────────────────
// 오투 중등과학 2-2 41P 14번처럼 한 문항이 (가)·(나) 두 가지를 묻는 주관식이 있다.
// 정답은 `(가) D, (나) 펩신` 형태로 저장돼 있는데 입력칸이 하나뿐이라, 학생이
// `가=D 위, 나=펩신`처럼 자기 식으로 적으면 내용이 맞아도 오답 처리됐다.
// → 정답에서 파트를 읽어 (가)·(나) 칸을 나눠 받고, 같은 포맷으로 합성해 저장한다.
// 오탐 방지: 문장형 서술답(\; 포함·60자 초과·15자 넘는 파트)이나 라벨이 가·나·다 순서가
// 아닌 답은 대상에서 뺀다. (등록 교재 주관식 128만 문항 중 약 390건이 대상)
// (2026-07-26 명수쌤 지시)
export const PART_LABELS = ['가', '나', '다', '라', '마', '바', '사', '아'] as const

export function answerParts(answer: string | undefined | null): { label: string; value: string }[] | null {
  const a = (answer ?? '').trim()
  if (!a || a.includes('\\;') || a.length > 60) return null
  if (!a.startsWith('(가)')) return null
  const labels = [...a.matchAll(/\(([가-아])\)/g)].map(m => m[1])
  if (labels.length < 2 || labels.some((l, i) => l !== PART_LABELS[i])) return null
  const chunks = a.split(/\(([가-아])\)/)          // ['', '가', ' D, ', '나', ' 펩신']
  const out: { label: string; value: string }[] = []
  for (let i = 1; i < chunks.length; i += 2) {
    const value = (chunks[i + 1] ?? '').trim().replace(/^[,·]\s*/, '').replace(/[,·]\s*$/, '').trim()
    if (!value || value.length > 15) return null
    out.push({ label: chunks[i], value })
  }
  return out.length >= 2 ? out : null
}

/**
 * 파트별 학생 입력을 정답과 같은 포맷(`(가) X, (나) Y`)으로 합친다. 전부 비면 ''.
 * 빈 칸은 빼고 합친다 — `(가) D, (나) ` 같은 어정쩡한 답이 기록으로 남지 않게.
 * (칸을 덜 채우면 정답과 개수가 달라 오답 처리되는데, 이건 실제로 덜 푼 것이 맞다)
 *
 * ⚠️ 라벨 사이를 무엇으로 잇는지는 **정답 원문을 따라야 한다**. 교재 정답의 절반은
 * `(가) n-r (나) r!` 처럼 쉼표가 없는데 늘 `, `로 이으면 조각 수가 달라 보여
 * 칸을 정확히 채워도 오답이 됐다(349건 중 175건). answer 를 넘기면 그 형식에 맞춘다.
 */
export function joinAnswerParts(values: string[], answer?: string | null): string {
  const sep = answer && !/,\s*\([가-아]\)/.test(answer) ? ' ' : ', '
  return values
    .map((v, i) => (v.trim() ? `(${PART_LABELS[i]}) ${v.trim()}` : ''))
    .filter(Boolean)
    .join(sep)
}

// ── 라벨 없이 쉼표로만 나열된 여러 답 ──────────────────────────────────
// `2x, 5, 2, 5` 처럼 답이 여러 개인데 라벨이 없는 문항. 입력칸이 하나뿐이라 학생이
// 쉼표·순서까지 맞춰 한 줄에 몰아 써야 했다. → (가)·(나)와 같이 칸을 나눠 받는다.
// 채점값은 달라지지 않는다 — 쪼갠 조각을 `, `로 도로 합치면 원문과 같다(10만 건 왕복 검증 0 불일치).
// (mathEqual 은 다중답을 순서 무관으로 비교하므로 칸 순서가 뒤바뀌어도 정답이다)
// (2026-07-27 명수쌤 지시)

/** 괄호 밖(top-level) 쉼표로만 자른다 — 좌표 `(2, 3)`·집합 `{1, 2}` 안의 쉼표는 구분자가 아니다 */
function topSplitComma(a: string): string[] {
  const out: string[] = []
  let depth = 0, cur = '', i = 0
  while (i < a.length) {
    if (a.startsWith('\\left', i)) { depth++; cur += a.slice(i, i + 5); i += 5; continue }
    if (a.startsWith('\\right', i)) { depth--; cur += a.slice(i, i + 6); i += 6; continue }
    const c = a[i]
    if ('([{｛'.includes(c)) depth++
    else if (')]}｝'.includes(c)) depth--
    if (c === ',' && depth <= 0) { out.push(cur); cur = ''; i++; continue }
    cur += c; i++
  }
  out.push(cur)
  return out.map(s => s.trim())
}

/** 조각 하나가 "칸에 넣어도 되는 짧고 깨끗한 답"인가 */
function plainChunkOk(p: string): boolean {
  if (!p || typeLen(p) > 10) return false
  // 한글이 섞이면 지시문일 수 있다 — `(위에서부터)3`·`5+5에 ○표`·`'선분 ㄱㅇ'에 색칠`
  if (/[가-힣]/.test(p)) return false
  if (/\\[;,!:> ]|\\quad|\\qquad|\\text|~/.test(p)) return false   // LaTeX 간격/문장 껍데기
  return true
}

/** 한 칸에 몰아 쓰던 여러 답 → 칸별 조각. 나눌 수 없으면 null. */
export function plainAnswerParts(answer: string | undefined | null): string[] | null {
  const a = (answer ?? '').trim()
  if (!a) return null
  if (/\d\s*,\s*\d{3}(?!\d)/.test(a)) return null   // 천단위 쉼표 `1,200` 은 한 수다
  if (answerParts(a)) return null                   // (가)·(나)는 라벨 붙은 쪽에서 처리
  if (/또는|그리고|이고/.test(a)) return null        // 대안 답·문장은 쪼개면 뜻이 깨진다
  const p = topSplitComma(a)
  if (p.length < 2 || p.length > 6) return null
  return p.every(plainChunkOk) ? p : null
}

/** 칸별 입력을 정답과 같은 포맷(`a, b, c`)으로 합친다. 빈 칸은 빼고 합친다. */
export function joinPlainParts(values: string[]): string {
  return values.map(v => v.trim()).filter(Boolean).join(', ')
}

/** 합성된 `a, b, c` 를 다시 칸별 값으로 되돌린다 (입력 중 상태 복원용). */
export function splitPlainParts(joined: string, n: number): string[] {
  const out = Array<string>(n).fill('')
  if (!joined || joined === '모름') return out
  topSplitComma(joined).slice(0, n).forEach((v, i) => { out[i] = v })
  return out
}

/** 합성된 `(가) X, (나) Y` 문자열을 다시 칸별 값으로 되돌린다 (입력 중 상태 복원용). */
export function splitAnswerParts(joined: string, n: number): string[] {
  const out = Array<string>(n).fill('')
  if (!joined || joined === '모름') return out
  const chunks = joined.split(/\(([가-아])\)/)
  for (let i = 1; i < chunks.length; i += 2) {
    const idx = PART_LABELS.indexOf(chunks[i] as typeof PART_LABELS[number])
    if (idx >= 0 && idx < n) out[idx] = (chunks[i + 1] ?? '').trim().replace(/[,·]\s*$/, '').trim()
  }
  return out
}

export function normAnswer(s: string): string {
  let t = s.trim()
  // 공백 전부 제거
  t = t.replace(/\s+/g, '')
  // KaTeX 구분자 제거
  t = t.replace(/\$/g, '')
  // 전각 문자 → 반각 (！-～ 범위)
  t = t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  // 원문자 ①~⑤ → 숫자 1~5 (원문자·숫자 답안 상호 통일)
  t = t.replace(/[①②③④⑤]/g, ch => String(CIRCLED.indexOf(ch) + 1))
  // O/X 동치 매핑 — 대소문자·그리스 오미크론·원기호·엑스 기호를 정답 O / X 로 통일
  if (/^[oOοΟ○◯〇]$/.test(t)) t = 'O'
  else if (/^[xXχΧ✕✗×╳]$/.test(t)) t = 'X'
  return t
}
