// 소문항 분해 — "(1) ○ (2) × (3) ○" 처럼 한 문항 안에 여러 개가 든 정답을 쪼갠다.
// 과학(오투) 확인문제에 많다: 5권 2,389문항 중 396문항(16%)이 소문항형(2~8개).
// 통째로 O/✕ 하나만 주면 학생이 어디를 틀렸는지 알 수 없으므로 소문항별로 채점한다.

export type SubItem = { no: string; ans: string }

// "(1) … (2) … " 를 찾는다. 번호가 1부터 연속이고 2개 이상일 때만 소문항으로 인정.
//  · "(가) 물, (나) 산소" 처럼 한글 기호는 소문항이 아니라 한 문항의 답이므로 제외
//  · "(1) B" 하나뿐이면 소문항이 아님
export function splitSubItems(answer: string): SubItem[] | null {
  const a = (answer || '').trim()
  if (!a) return null
  const re = /\((\d{1,2})\)/g
  const hits: { n: number; at: number; len: number }[] = []
  for (let m = re.exec(a); m; m = re.exec(a)) hits.push({ n: Number(m[1]), at: m.index, len: m[0].length })
  if (hits.length < 2) return null
  // 1부터 연속인지 (아니면 본문 속 괄호숫자일 뿐)
  if (!hits.every((h, i) => h.n === i + 1)) return null
  // 첫 소문항 앞에 긴 지문이 있으면 소문항 표기가 아니라 서술 중 괄호일 수 있음
  if (a.slice(0, hits[0].at).trim().length > 12) return null
  const out: SubItem[] = []
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].at + hits[i].len
    const end = i + 1 < hits.length ? hits[i + 1].at : a.length
    const ans = a.slice(start, end).trim().replace(/^[,·]\s*/, '').replace(/[,·]\s*$/, '')
    if (!ans) return null                       // 빈 소문항이 있으면 분해하지 않음(오탐 방지)
    out.push({ no: String(hits[i].n), ans })
  }
  return out.length >= 2 ? out : null
}

// 소문항 채점 키 — 기존 문항 id와 충돌하지 않게 '#서브번호'를 붙인다.
export function subKey(itemId: string, subNo: string): string {
  return `${itemId}#${subNo}`
}
