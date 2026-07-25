import { useRef, useState } from 'react'
import { normMath } from '../../lib/mathAnswer'

// 주관식 답 입력칸 + 수식 키패드
// ─────────────────────────────────────────────────────────────────────────────
// 학생 키보드로는 √ π ± ≤ ∠ ㎠ ㉠ 같은 기호를 칠 수 없다. (등록 교재 주관식의
// 13.7%가 이런 기호를 포함 — 중등은 18.6%) 그래서 눌러서 넣는 키패드를 붙인다.
// 채점은 lib/mathAnswer.ts 가 "루트2 = √2", "cm2 = ㎠", "<= = ≤" 처럼 흡수하므로
// 키패드를 안 쓰고 그냥 타이핑해도 정답 처리된다. 키패드는 표기를 편하게 할 뿐.

export type KeypadLevel = '초등' | '중등' | '고등'

/** 교재 course(m3-1, e5-2, h-int2 …) → 키패드 묶음 */
export function levelFromCourse(course?: string): KeypadLevel {
  if (course?.startsWith('e')) return '초등'
  if (course?.startsWith('m')) return '중등'
  return '고등'
}
/** 학습지 grade('중2', '초5-1', '고1' …) → 키패드 묶음 */
export function levelFromGrade(grade?: string): KeypadLevel {
  if (grade?.startsWith('초')) return '초등'
  if (grade?.startsWith('중')) return '중등'
  return '고등'
}

type Key = { t: string; ins?: string; back?: number; hint?: string }
const K = (t: string, ins?: string, back?: number, hint?: string): Key => ({ t, ins, back, hint })

// back = 삽입 후 커서를 왼쪽으로 옮길 칸수 (분수 "/" 처럼 가운데로 보낼 때)
const GROUPS: Record<string, Key[]> = {
  '수·기호': [
    K('√', '√'), K('제곱', '^2'), K('세제곱', '^3'), K('^', '^'),
    K('π', 'π'), K('±', '±'), K('°', '°'), K('÷', '/'), K('×', '*'),
  ],
  '분수': [
    K('a/b', '/', 0, '분수는 15/2 처럼'), K('대분수', ' ', 0, '2 4/7 처럼 정수 뒤에 띄고'),
    K('(', '('), K(')', ')'), K('소수점', '.'), K('-', '-'),
  ],
  '비교': [K('≤', '≤'), K('≥', '≥'), K('≠', '≠'), K('<', '<'), K('>', '>'), K('=', '='), K('∞', '∞')],
  '도형': [
    K('∠', '∠'), K('△', '△'), K('□', '□'), K('○', '○'), K('✕', '✕'),
    K('⊥', '⊥'), K('∥', '∥'), K('∽', '∽'), K('≡', '≡'), K('→', '→'),
  ],
  '단위': [
    K('cm', 'cm'), K('cm²', 'cm^2'), K('cm³', 'cm^3'), K('m', 'm'), K('m²', 'm^2'),
    K('km', 'km'), K('kg', 'kg'), K('g', 'g'), K('L', 'L'), K('mL', 'mL'),
    K('개', '개'), K('명', '명'), K('원', '원'), K('시간', '시간'), K('분', '분'),
  ],
  '보기': [K('㉠', '㉠'), K('㉡', '㉡'), K('㉢', '㉢'), K('㉣', '㉣'), K('㉤', '㉤'), K('ㄱ', 'ㄱ'), K('ㄴ', 'ㄴ'), K('ㄷ', 'ㄷ')],
}

const TABS_BY_LEVEL: Record<KeypadLevel, string[]> = {
  초등: ['분수', '수·기호', '도형', '단위', '보기'],
  중등: ['수·기호', '분수', '비교', '도형', '단위', '보기'],
  고등: ['수·기호', '분수', '비교', '도형', '단위', '보기'],
}

/** 학생이 친 표기를 표준 기호로 예쁘게 보여준다 (루트2 → √2). 채점 결과와 무관한 안내용. */
function preview(v: string): string {
  if (!v.trim()) return ''
  const t = normMath(v)
    .replace(/\^\(?(\d+)\)?/g, (_m, d: string) =>
      [...d].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c] ?? c).join(''))
    .replace(/\*/g, '×')
  return t === v.replace(/\s+/g, '') ? '' : t
}

export default function MathAnswerField({
  value, onChange, level = '중등', placeholder = '답 입력', className = '', width = 'w-44',
}: {
  value: string
  onChange: (v: string) => void
  level?: KeypadLevel
  placeholder?: string
  className?: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(TABS_BY_LEVEL[level][0])
  const ref = useRef<HTMLInputElement>(null)

  function insert(k: Key) {
    const el = ref.current
    const ins = k.ins ?? k.t
    if (!el) { onChange(value + ins); return }
    const s = el.selectionStart ?? value.length
    const e = el.selectionEnd ?? s
    const next = value.slice(0, s) + ins + value.slice(e)
    onChange(next)
    // 커서를 삽입 지점 뒤로 (back 지정 시 그만큼 왼쪽으로)
    const pos = s + ins.length - (k.back ?? 0)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos) })
  }

  const tabs = TABS_BY_LEVEL[level]
  const pv = preview(value)

  return (
    <div className={`grid gap-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input ref={ref} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoComplete="off"
          className={`${width} rounded-lg border border-line px-3 py-2 text-sm`} />
        <button type="button" onClick={() => setOpen(o => !o)}
          title="수식 기호 넣기"
          className={`h-9 rounded-lg border px-2.5 text-sm font-bold ${
            open ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
          √π
        </button>
      </div>

      {pv && (
        <div className="text-[11px] text-ink2">
          입력한 답 <b className="text-pine-dark">{pv}</b> <span className="text-ink2/60">(이렇게 채점돼요)</span>
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-line bg-paper2/50 p-2">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {tabs.map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  tab === t ? 'bg-pine text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {(GROUPS[tab] ?? []).map(k => (
              <button key={k.t} type="button" onClick={() => insert(k)} title={k.hint}
                className="min-w-9 rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-bold text-ink hover:border-pine hover:bg-pine-soft">
                {k.t}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink2/70">
            키패드를 안 써도 돼요 — <b>루트2</b>=√2, <b>파이</b>=π, <b>cm2</b>=㎠, <b>&lt;=</b>=≤ 처럼 쳐도 정답으로 인정돼요.
          </p>
        </div>
      )}
    </div>
  )
}
