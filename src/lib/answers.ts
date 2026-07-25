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
export function isEssayAnswer(answer: string | undefined | null): boolean {
  const a = (answer ?? '').trim()
  if (!a) return false
  // "(예) …" · "예)" — 교재가 명시한 예시 답안. 정답이 하나로 정해지지 않는다.
  if (/^\(?예\)/.test(a.replace(/\s/g, ''))) return true
  const plain = a.replace(/\\[;,! ]/g, ' ')          // LaTeX 간격을 공백으로
  return plain.length >= 12 && /\s/.test(plain) && /[가-힣]/.test(plain) && ESSAY_TAIL.test(plain)
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
