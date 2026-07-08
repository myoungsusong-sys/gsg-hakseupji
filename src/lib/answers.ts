// 답안 정규화 — 채점 대조는 normAnswer(a) === normAnswer(b)
const CIRCLED = '①②③④⑤'

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
