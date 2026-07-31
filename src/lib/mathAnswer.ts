// 수식 답안 정규화·대조 엔진
// ─────────────────────────────────────────────────────────────────────────────
// 문제: 교재 정답은 LaTeX·조합문자(㎠ ㎝)·수학기호(√ π ± ≤ ∠)로 저장돼 있는데,
// 학생은 키보드로 그런 문자를 칠 수 없다. (등록 교재 주관식 80만 문항 중 13.7%가
// "학생이 물리적으로 입력할 수 없는" 정답 — 중등은 18.6%)
// 해결: ① 정답·학생답을 같은 표준형(canonical)으로 접고
//       ② 학생이 쓸 법한 대체표기(루트2, pi, cm2, <=, +-)를 표준형으로 흡수하고
//       ③ 그래도 다르면 "값"으로 비교한다(4/8 = 1/2 = 0.5, 2√2 = √8).
// 입력 UI 쪽 보조는 components/student/MathKeypad.tsx 참고.

// ── 1. 조합문자 단위 → ASCII ────────────────────────────────────────────────
const SQUARE_UNITS: [RegExp, string][] = [
  [/[㎠]/g, 'cm^2'], [/[㎤]/g, 'cm^3'], [/[㎝]/g, 'cm'], [/[㎜]/g, 'mm'],
  [/[㎡]/g, 'm^2'], [/[㎥]/g, 'm^3'], [/[㎢]/g, 'km^2'], [/[㎞]/g, 'km'],
  [/[㎏]/g, 'kg'], [/[㎎]/g, 'mg'], [/[㎍]/g, 'ug'], [/[㎖]/g, 'ml'],
  [/[㎗]/g, 'dl'], [/[ℓℒ]/g, 'l'], [/[㏄]/g, 'cc'], [/[㎉]/g, 'kcal'],
  [/[㎈]/g, 'cal'], [/[㎧]/g, 'm/s'], [/[㎨]/g, 'm/s^2'], [/[㎩]/g, 'pa'],
  [/[㎛]/g, 'um'], [/[㎳]/g, 'ms'], [/[㎐]/g, 'hz'], [/[㎑]/g, 'khz'], [/[㎒]/g, 'mhz'],
]

// ── 2. 위첨자·아래첨자 문자 → ^n ────────────────────────────────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const SUB = '₀₁₂₃₄₅₆₇₈₉'

// ── 3. LaTeX 명령 → 기호 ────────────────────────────────────────────────────
// ⚠️ 명령 끝은 \b 가 아니라 (?![a-zA-Z]) 로 판정해야 한다.
// "x\leq10" 은 q 와 1 이 둘 다 단어문자라 \b 가 성립하지 않아 \leq 가 안 잡힌다.
const E = '(?![a-zA-Z])'
const cmd = (body: string) => new RegExp('\\\\(?:' + body + ')' + E, 'g')
const LATEX_SYM: [RegExp, string][] = [
  [cmd('times'), '*'], [cmd('div'), '/'], [cmd('cdot'), '*'],
  [cmd('pm'), '±'], [cmd('mp'), '∓'],
  [cmd('leq?'), '≤'], [cmd('geq?'), '≥'], [cmd('neq?'), '≠'],
  [cmd('fallingdotseq|doteq'), '='],
  [cmd('pi'), 'π'], [cmd('theta'), 'θ'], [cmd('alpha'), 'α'], [cmd('beta'), 'β'],
  [cmd('angle'), '∠'], [cmd('triangle'), '△'], [cmd('square'), '□'],
  [cmd('bigcirc|circledcirc'), '○'],
  [cmd('cdots|dots|ldots|vdots'), '…'],
  [cmd('rightarrow|to|longrightarrow'), '→'],
  [cmd('infty'), '∞'], [cmd('perp'), '⊥'], [cmd('parallel'), '∥'],
  [cmd('equiv'), '≡'], [cmd('sim'), '∽'], [cmd('propto'), '∝'],
]

// 값을 바꾸지 않는 장식 명령 — 안쪽만 남긴다 (\overline{AB} → AB)
const DECOR = /\\(?:overline|underline|overrightarrow|overleftarrow|vec|widehat|hat|bar|boxed|mathrm|mathbf|mathit|text|textbf|mbox|rm|bf|it|operatorname)\s*\{([^{}]*)\}/g
// 순환소수 \dot{3} → 3 (0.\dot{3} → 0.3 으로 관대하게 대조)
const DOT = /\\(?:dot|ddot)\s*\{([^{}]*)\}/g

// ── 4. 학생이 칠 법한 대체표기 → 기호 ───────────────────────────────────────
const TYPED_ALIAS: [RegExp, string][] = [
  [/루\s*트|sqrt|√/gi, '√'],
  [/파\s*이(?![가-힣])|(?<![a-z])pi(?![a-z])/gi, 'π'],
  [/<=|=</g, '≤'], [/>=|=>/g, '≥'],
  [/!=|=\/=|<>|≒/g, '≠'],
  [/\+\/-|\+-|-\+/g, '±'],
  [/÷/g, '/'],
  [/\.\.\.|···|⋯/g, '…'],
  [/각\s*도?(?=[A-Z])/g, '∠'],   // "각ABC" → ∠ABC
  [/무한대/g, '∞'],
]

// ── 5. 단위 (값 비교 시 분리) ───────────────────────────────────────────────
// 길이·넓이·부피·무게 등 "학생이 생략해도 정답으로 볼" 단위. 시간(시간/분/초)처럼
// 서로 혼동하면 안 되는 단위도 목록에 넣되, 서로 다른 단위끼리는 오답 처리한다.
const UNIT_RE = new RegExp(
  '(?:' + [
    'cm\\^3', 'cm\\^2', 'm\\^3', 'm\\^2', 'km\\^2', 'mm\\^2', 'mm\\^3',
    'cm3', 'cm2', 'm3', 'm2', 'km2', 'mm2', 'mm3',
    'cm', 'mm', 'km', 'kg', 'mg', 'ug', 'ml', 'dl', 'kcal', 'cal', 'cc',
    'khz', 'mhz', 'hz', 'pa', 'm/s', 'kmh', 'm', 'g', 'l', 't',
    '％', '%', '원', '개', '명', '권', '자루', '쪽', '번', '살', '장', '병', '마리',
    '대', '켤레', '벌', '송이', '줄', '모둠', '인분', '회', '배', '판', '판', '통',
    '그루', '상자', '봉지', '컵', '조각', '도막', '바퀴', '점', '문제', '가지',
    '시간', '분', '초', '일', '주', '주일', '달', '개월', '년', '도',
  ].join('|') + ')$',
)

/** 조합문자·LaTeX·대체표기를 하나의 표준형으로 접는다. */
export function normMath(input: string): string {
  let t = (input ?? '').toString()
  if (!t.trim()) return ''

  // 전각 → 반각, KaTeX 구분자 제거
  t = t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  t = t.replace(/\$/g, '')
  // 원문자 ①②③… → 1,2,3 — 교재 정답은 '4', 학생앱 객관식 버튼은 '④'로 들어온다.
  // (이 변환이 빠지면 객관식 전 문항이 오답 처리된다)
  t = t.replace(/[①-⑳]/g, ch => String(ch.charCodeAt(0) - 0x245f))
  // 표(배열) 답안 껍데기 제거
  t = t.replace(/\\begin\{[a-z*]+\}(?:\{[^{}]*\})?|\\end\{[a-z*]+\}|\\hline/g, ' ')
  // LaTeX 간격 명령
  t = t.replace(/\\(?:quad|qquad|space|hspace\{[^{}]*\}|[;,!:> ])|~/g, ' ')

  // 장식 명령은 여러 겹일 수 있어 반복 적용 (\overline{\mathrm{AB}})
  for (let i = 0; i < 4 && DECOR.test(t); i++) t = t.replace(DECOR, '$1')
  t = t.replace(DOT, '$1')

  // 근호 \sqrt[n]{a} · \sqrt{a} · \sqrt a
  //
  // ⚠️ 분수보다 **먼저** 풀어야 한다. 아래 분수 정규식의 {…} 는 [^{}]* 라서 중괄호가
  // 겹치면 못 잡는다. \frac{\sqrt{10}}{3} 의 분자에 \sqrt{10} 의 중괄호가 들어 있어
  // 분수로 인식되지 않았고, 그래서 학생이 √10/3 이라고 제대로 써도 전부 오답이 됐다.
  // (2026-07-28 발견 — 라이트쎈 3(상) 분모의 유리화 51문항이 통째로 걸려 있었다)
  // 근호를 먼저 √(…) 로 바꾸면 분자에 중괄호가 없어져 분수 변환이 정상 동작한다.
  t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, '(($2)^(1/($1)))')
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
  t = t.replace(/\\sqrt\s*/g, '√')

  // 분수 — 대분수(앞이 숫자)면 덧셈으로, 아니면 나눗셈으로 괄호 씌워 보존
  // (반복: 중첩 분수는 안쪽이 괄호꼴로 바뀐 뒤 바깥이 잡힌다)
  for (let i = 0; i < 6; i++) {
    const next = t.replace(
      /(\d*)\s*\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      (_m, whole: string, a: string, b: string) =>
        whole ? `(${whole}+(${a})/(${b}))` : `((${a})/(${b}))`,
    )
    if (next === t) break
    t = next
  }

  for (const [re, s] of LATEX_SYM) t = t.replace(re, s)
  t = t.replace(/\\circ(?![a-zA-Z])/g, '°')
  // 30^{\circ} → 30° (지수가 아니라 도 기호)
  t = t.replace(/\^\s*\{?\s*°\s*\}?/g, '°')
  // 남은 LaTeX 명령의 백슬래시만 제거 (\left( → ( )
  t = t.replace(/\\left|\\right/g, '').replace(/\\([a-zA-Z]+)/g, '$1').replace(/\\/g, '')

  for (const [re, s] of SQUARE_UNITS) t = t.replace(re, s)
  t = t.replace(new RegExp(`[${SUP}]+`, 'g'), m =>
    '^' + [...m].map(c => SUP.indexOf(c)).join(''))
  t = t.replace(new RegExp(`[${SUB}]`, 'g'), c => String(SUB.indexOf(c)))
  for (const [re, s] of TYPED_ALIAS) t = t.replace(re, s)
  // ×는 피연산자 사이일 때만 곱셈 — 그 밖에는 "틀림 표시(✕)"이므로 건드리지 않는다
  t = t.replace(/(?<=[\d a-zπθ)])\s*[×✕]\s*(?=[\d a-zπθ(√])/gi, '*')

  // 대분수 — 학생이 "2 4/7" 처럼 띄어 쓴 것도 2+4/7 로 (공백 제거 전에 처리)
  t = t.replace(/(?<![\d.)])(\d+)\s+(\d+)\s*\/\s*(\d+)/g, '($1+($2)/($3))')
  // 지시문 접두어 제거 — "(위에서부터)3,5" · "(예)…" · "(순서대로)…"
  t = t.replace(/^\s*\((?:위에서부터|왼쪽에서부터|순서대로|차례로|예|답)\)\s*/g, '')
  // 중괄호는 그룹 표시일 뿐 — 지수 표기 ^{2} 는 ^2 로
  t = t.replace(/\^\s*\{([^{}]*)\}/g, '^($1)').replace(/[{}]/g, '')
  // 천단위 쉼표는 한 수의 일부 — 떼어낸다. "1,200" = "1200".
  // ⚠️ 공백을 지우기 전에 처리해야 한다. 붙여 쓴 "1,200"만 한 수로 보고,
  //    띄어 쓴 "1, 200"은 답 두 개(1과 200)로 남긴다.
  // 안 하면 1,200을 답 두 개로 읽어 "200,1"까지 정답이 되고, 정작 "1200"이라 쓴 학생이 오답 처리된다.
  t = t.replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
  t = t.replace(/\s+/g, '').toLowerCase()
  // 정답 데이터에 섞여 들어온 꼬리 마침표 제거 ("3., 4" → "3,4") — 소수점은 뒤에 숫자가 있어 무사
  t = t.replace(/(\d)\.(?=,|$)/g, '$1')
  // O/X 통일 — 다중답("×,○")도 각 칸마다 적용
  return t.split(',').map(tok =>
    /^[oο○◯〇]$/i.test(tok) ? 'O'
      : /^[xχ×✕✗╳]$/i.test(tok) ? 'X'
        : tok).join(',')
}

// "( )( ○ )( )" 처럼 빈 괄호가 자리(칸)를 뜻하는 문항 — 괄호를 지우면 자리가 뒤바뀌어도
// 정답이 돼 버리므로 괄호를 보존한다. ("1/4에 ○표"처럼 빈 칸이 없으면 해당 없음)
const POSITIONAL = /\(\)/

/**
 * 표준형에서 "표기 차이"만 더 지운 느슨한 형태 (x^2 = x2, 30° = 30).
 * 분수 표기 차이(\frac{x+1}{2} = (x+1)/2)를 흡수하려고 괄호도 지우지만,
 * 자리 표시형 답에서는 괄호를 남긴다.
 */
export function looseMath(s: string): string {
  const n = normMath(s).replace(/\^/g, '').replace(/[°·・]/g, '')
  return POSITIONAL.test(n) ? n : n.replace(/[()]/g, '')
}

// ── 값 계산 ────────────────────────────────────────────────────────────────
/** 숫자·사칙연산·괄호·√·π·^ 로만 이뤄진 식이면 값을 계산한다. eval 미사용. */
export function mathValue(src: string): number | null {
  const s = src.replace(/\s+/g, '')
  if (!s || !/^[0-9+\-*/^().√π]+$/.test(s)) return null
  let i = 0
  const peek = () => s[i]
  function parseExpr(): number | null {
    let v = parseTerm()
    if (v === null) return null
    while (peek() === '+' || peek() === '-') {
      const op = s[i++]
      const r = parseTerm()
      if (r === null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  function parseTerm(): number | null {
    let v = parseUnary()
    if (v === null) return null
    while (peek() === '*' || peek() === '/') {
      const op = s[i++]
      const r = parseUnary()
      if (r === null) return null
      if (op === '/' && r === 0) return null
      v = op === '*' ? v * r : v / r
    }
    return v
  }
  function parseUnary(): number | null {
    if (peek() === '+') { i++; return parseUnary() }
    if (peek() === '-') { i++; const v = parseUnary(); return v === null ? null : -v }
    if (peek() === '√') {
      i++
      const v = parseUnary()
      return v === null || v < 0 ? null : Math.sqrt(v)
    }
    return parsePower()
  }
  function parsePower(): number | null {
    const base = parseAtom()
    if (base === null) return null
    if (peek() === '^') {
      i++
      const ex = parseUnary()
      if (ex === null) return null
      const r = Math.pow(base, ex)
      return Number.isFinite(r) ? r : null
    }
    // 2√3 · 3π 처럼 붙여 쓴 곱
    if (peek() === '√' || peek() === 'π' || peek() === '(') {
      const r = parseUnary()
      return r === null ? null : base * r
    }
    return base
  }
  function parseAtom(): number | null {
    if (peek() === '(') {
      i++
      const v = parseExpr()
      if (v === null || s[i] !== ')') return null
      i++
      return v
    }
    if (peek() === 'π') { i++; return Math.PI }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i))
    if (!m) return null
    i += m[0].length
    return parseFloat(m[0])
  }
  const v = parseExpr()
  return v !== null && i === s.length && Number.isFinite(v) ? v : null
}

/** 표준형 토큰에서 뒤에 붙은 단위를 떼어 [식, 단위]로 나눈다. */
function splitUnit(tok: string): [string, string] {
  const m = UNIT_RE.exec(tok)
  if (!m || m.index === 0) return [tok, '']
  // cm^2 · cm2 는 같은 단위로 본다
  return [tok.slice(0, m.index), m[0].replace(/\^/g, '')]
}

// ── 입력칸 밖에 보여줄 단위 라벨 ──────────────────────────────────────────
// 정답이 `\sqrt{6}cm` 이면 학생에게 단위를 치게 하지 말고 칸 옆에 'cm' 을 적어 준다.
// (2026-07-31 명수쌤 지시 — 원본이 단위를 답과 분리해 갖고 있는 것을 보고 도입)
//
// 🔴 단위 목록은 **여기 UNIT_RE 하나만** 쓴다. 화면용으로 목록을 복사해 두면 채점이 보는
//    단위와 갈라져 "라벨엔 cm 이라 써놓고 채점은 단위로 안 보는" 조용한 불일치가 난다.
// 🔴 오탐이 무섭다. UNIT_RE 는 문자열 **끝**만 보므로 '지우개'(→개)·'공원'(→원)·'필통'(→통)
//    같은 낱말 정답이 값+단위로 쪼개진다. 그래서 **앞이 실제 수식일 때만** 단위로 인정한다.
const UNIT_LABEL: Record<string, string> = { cm2: 'cm²', cm3: 'cm³', m2: 'm²', m3: 'm³', km2: 'km²', mm2: 'mm²', mm3: 'mm³' }

export function answerUnit(answer: string | undefined | null): { unit: string; label: string } | null {
  const raw = (answer ?? '').trim()
  if (!raw) return null
  if (raw.includes(',')) return null            // 답이 여럿이면 칸 분리 쪽이 처리한다
  const tok = normMath(raw)
  const [head, unit] = splitUnit(tok)
  if (!unit || !head) return null
  // 앞이 값으로 읽히는 식일 때만 단위로 본다 — 낱말 정답('지우개')과 초등 '3 m 2 cm' 를 막는다
  if (!/^[0-9+\-*/^().√π\s]+$/.test(head)) return null
  if (mathValue(head) === null) return null
  return { unit, label: UNIT_LABEL[unit] ?? unit }
}

const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))

/** 토큰 하나끼리 비교 — 표기·값·단위(학생 생략 허용)를 모두 고려. */
function tokenEq(correct: string, student: string): boolean {
  if (!student) return false
  if (correct === student) return true
  const [ce, cu] = splitUnit(correct)
  const [se, su] = splitUnit(student)
  // 학생이 단위를 생략한 건 허용, 다른 단위를 쓴 건 오답
  if (su && cu && su !== cu) return false
  if (ce === se) return true
  const cv = mathValue(ce), sv = mathValue(se)
  if (cv !== null && sv !== null && near(cv, sv)) return true
  // 값이 다르거나 값으로 못 읽는 식(변수 포함) — 표기 차이만 무시하고 비교.
  // ("5/6 / 1/6"처럼 /가 나눗셈이 아니라 답 구분자로 쓰인 데이터가 있어 값 비교만으론 부족)
  const cl = looseMath(ce), sl = looseMath(se)
  return cl !== '' && cl === sl
}

/** "x=3" 처럼 붙은 변수 라벨을 뗀다 (학생이 값만 써도 정답). */
// 답 앞에 붙는 라벨을 뗀다 — "x=3"의 x=, 그리고 (가)·가)·가:·가= 같은 소문항 표기.
// `(가) D` 와 `가=D` 를 같은 답으로 보게 해준다. 라벨을 뗀 뒤 내용이 다르면 여전히 오답.
// ⚠️ 라벨을 떼서 빈 문자열이 되면(정답 자체가 "(가)"인 기호 고르기 문항) 떼지 않는다.
//    안 그러면 정답 (가) 와 학생 답 (나) 가 둘 다 ''가 되어 오답이 정답으로 뒤집힌다.
const stripLabel = (t: string) => {
  const s = t.replace(/^\(?\s*[가-아]\s*[):=]\s*/, '').replace(/^[a-zπθ가-힣]{1,4}=/, '')
  return s.trim() ? s : t
}

/** "A(또는B)" · "A또는B" 형태의 대안 정답을 모두 펼친다. */
function alternatives(raw: string): string[] {
  const out = new Set<string>()
  const base = raw.replace(/\s+/g, ' ').trim()
  const push = (s: string) => { if (s.trim()) out.add(s.trim()) }
  // 괄호 안 대안: "∠DOE(또는 ∠EOD)" → ∠DOE / ∠EOD
  const paren = /\((?:또는|혹은|=)\s*([^()]*)\)/g
  let m: RegExpExecArray | null
  const alts: string[] = []
  while ((m = paren.exec(base))) alts.push(m[1])
  push(base.replace(paren, ''))
  for (const a of alts) push(a)
  // "또는"/"/"으로 나뉜 대안 (쉼표 답안과 섞이지 않도록 또는가 있을 때만)
  for (const s of [...out]) {
    if (/또는|혹은/.test(s)) for (const p of s.split(/또는|혹은/)) push(p)
  }
  return [...out]
}

/**
 * 학생 답이 정답과 같은지 판정한다.
 * 표기(LaTeX·조합문자·루트/파이 한글표기)·단위 생략·다중답 순서·값 동치를 모두 허용.
 */
export function mathEqual(correct: string, student: string): boolean {
  const sRaw = (student ?? '').trim()
  if (!sRaw || !(correct ?? '').trim()) return false

  const sAlts = alternatives(sRaw).map(normMath).filter(Boolean)
  if (!sAlts.length) return false
  // 답이 여러 개인 문항(정답 "E, 이자")을 학생이 쉼표 없이 "E 이자"로 띄어 쓴 경우 —
  // 조각 수가 정답과 같을 때만 쉼표를 넣은 것으로 보고 다중답 비교에 태운다.
  // (조각 수가 다르면 그대로 오답. "15.4 kg, 1.1 kg"를 띄어 쓰면 4조각이라 매칭 안 됨)
  // ⚠️ 천단위 쉼표("1,200")는 답이 두 개가 아니라 한 수이므로 제외한다.
  if (!sRaw.includes(',') && /\s/.test(sRaw) && !/\d\s*,\s*\d{3}(?!\d)/.test(correct ?? '')) {
    const cn = (correct ?? '').split(',').length
    const toks = sRaw.split(/\s+/).filter(Boolean)
    if (cn > 1 && toks.length === cn) {
      for (const a of alternatives(toks.join(','))) {
        const n = normMath(a)
        if (n) sAlts.push(n)
      }
    }
  }

  for (const cAlt of alternatives(correct)) {
    const c = normMath(cAlt)
    if (!c) continue
    for (const s of sAlts) {
      if (c === s) return true
      if (tokenEq(c, s)) return true
      // 다중 답 — 쉼표로 나눠 순서 무관 비교 (개수는 같아야 함)
      const ct = c.split(',').map(x => x.trim()).filter(Boolean)
      const st = s.split(',').map(x => x.trim()).filter(Boolean)
      if (ct.length > 1 && ct.length === st.length) {
        const pool = [...st]
        const ok = ct.every(x => {
          const hit = pool.findIndex(y => tokenEq(x, y) || tokenEq(stripLabel(x), stripLabel(y)))
          if (hit < 0) return false
          pool.splice(hit, 1)
          return true
        })
        if (ok) return true
      }
      if (ct.length === 1 && st.length === 1 && tokenEq(stripLabel(c), stripLabel(s))) return true
    }
  }
  return false
}
