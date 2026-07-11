import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { curriculumFor } from '../data/curriculum'
import { useStore, uid } from '../lib/store'
import { useBrand } from '../lib/brand'
import MathText from '../components/MathText'
import GradeSelect from '../components/GradeSelect'
import type { Problem } from '../types'
import { DEFAULT_SHEET_OPTIONS } from '../types'

// ── 연산 종류 ────────────────────────────────────────────
const OPS = [
  { id: 'nat-add', label: '자연수 덧셈' },
  { id: 'nat-sub', label: '자연수 뺄셈' },
  { id: 'nat-mul', label: '자연수 곱셈' },
  { id: 'nat-div', label: '자연수 나눗셈' },
  { id: 'nat-mix', label: '자연수 혼합계산' },
  { id: 'int-four', label: '정수 사칙' },
  { id: 'frac-addsub', label: '분수 덧셈·뺄셈' },
  { id: 'dec-four', label: '소수 사칙' },
  { id: 'lin-eq', label: '일차방정식' },
] as const
type OpId = typeof OPS[number]['id']

function opLabel(id: OpId): string {
  return OPS.find(o => o.id === id)?.label ?? id
}

// ── 산술 유틸 (eval 금지 — 전부 정수 연산으로 직접 계산) ──
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b)
  while (b) { const t = a % b; a = b; b = t }
  return a
}

// 자릿수 → 자연수 범위
function rangeFor(d: number): [number, number] {
  return d === 1 ? [2, 9] : d === 2 ? [10, 99] : [100, 999]
}

// 정수 표기: (+3), (-3)
function sInt(n: number): string {
  return n < 0 ? `(${n})` : `(+${n})`
}

// 부동소수점 오차 방지: 10^k 배 정수(scaled)와 배율(scale)로 계산 후 문자열 변환
function fmtDec(scaled: number, scale: number): string {
  const sign = scaled < 0 ? '-' : ''
  const n = Math.abs(scaled)
  const int = Math.floor(n / scale)
  const frac = String(n % scale).padStart(String(scale).length - 1, '0').replace(/0+$/, '')
  return sign + (frac ? `${int}.${frac}` : String(int))
}

interface GenItem { body: string; answer: string; solution: string }

function genOne(op: OpId, d: number): GenItem {
  const [lo, hi] = rangeFor(d)
  switch (op) {
    case 'nat-add': {
      const a = randInt(lo, hi), b = randInt(lo, hi)
      return { body: `$${a}+${b}=$`, answer: String(a + b), solution: `$${a}+${b}=${a + b}$` }
    }
    case 'nat-sub': {
      let a = randInt(lo, hi), b = randInt(lo, hi)
      while (a === b) b = randInt(lo, hi)
      if (a < b) { const t = a; a = b; b = t }   // a>b 보장
      return { body: `$${a}-${b}=$`, answer: String(a - b), solution: `$${a}-${b}=${a - b}$` }
    }
    case 'nat-mul': {
      const a = randInt(lo, hi), b = randInt(lo, hi)
      return { body: `$${a}\\times ${b}=$`, answer: String(a * b), solution: `$${a}\\times ${b}=${a * b}$` }
    }
    case 'nat-div': {
      const b = randInt(Math.max(2, lo), hi), q = randInt(lo, hi)
      const a = b * q                            // 나누어떨어지게 역산
      return { body: `$${a}\\div ${b}=$`, answer: String(q), solution: `$${a}\\div ${b}=${q}$` }
    }
    case 'nat-mix': {
      const a = randInt(lo, hi), b = randInt(lo, hi), c = randInt(lo, hi)
      const ans = a + b * c                      // 곱셈 먼저 (연산 우선순위)
      return {
        body: `$${a}+${b}\\times ${c}=$`,
        answer: String(ans),
        solution: `곱셈 먼저: $${b}\\times ${c}=${b * c}$, $${a}+${b * c}=${ans}$`,
      }
    }
    case 'int-four': {
      const o = randInt(0, 3)
      const sgn = () => Math.random() < 0.5 ? -1 : 1
      if (o === 3) {                             // 나눗셈: 나누어떨어지게 역산
        const b = randInt(Math.max(2, lo), hi) * sgn()
        const q = randInt(2, 9) * sgn()
        const a = b * q
        return { body: `$${sInt(a)}\\div ${sInt(b)}=$`, answer: String(q), solution: `$${sInt(a)}\\div ${sInt(b)}=${q}$` }
      }
      const a = randInt(lo, hi) * sgn(), b = randInt(lo, hi) * sgn()
      const ans = o === 0 ? a + b : o === 1 ? a - b : a * b
      const sym = o === 0 ? '+' : o === 1 ? '-' : '\\times '
      return { body: `$${sInt(a)}${sym}${sInt(b)}=$`, answer: String(ans), solution: `$${sInt(a)}${sym}${sInt(b)}=${ans}$` }
    }
    case 'frac-addsub': {
      const plus = Math.random() < 0.5
      for (let t = 0; t < 60; t++) {
        const b = randInt(2, 12), d2 = randInt(2, 12)
        const a = randInt(1, b - 1), c = randInt(1, d2 - 1)
        const l = a * d2, r = c * b
        if (!plus && l <= r) continue            // 뺄셈은 결과가 양수가 되도록
        const num0 = plus ? l + r : l - r
        const den0 = b * d2
        const g = gcd(num0, den0)
        const num = num0 / g, den = den0 / g     // 기약분수로 약분
        const sym = plus ? '+' : '-'
        const reduced = den === 1 ? `${num}` : `\\frac{${num}}{${den}}`
        return {
          body: `$\\frac{${a}}{${b}}${sym}\\frac{${c}}{${d2}}=$`,
          answer: den === 1 ? String(num) : `${num}/${den}`,
          solution: `통분: $\\frac{${l}}{${den0}}${sym}\\frac{${r}}{${den0}}=\\frac{${num0}}{${den0}}$${g > 1 ? `, 약분: $${reduced}$` : ''}`,
        }
      }
      return { body: '$\\frac{1}{2}+\\frac{1}{3}=$', answer: '5/6', solution: '통분: $\\frac{3}{6}+\\frac{2}{6}=\\frac{5}{6}$' }
    }
    case 'dec-four': {
      const o = randInt(0, 3)
      const maxInt = Math.pow(10, d)
      const pickScale = () => Math.random() < 0.5 ? 10 : 100   // 소수 첫째~둘째 자리
      const rnd = (sc: number) => {
        let v = randInt(1, maxInt * sc - 1)
        for (let t = 0; t < 60 && v % sc === 0; t++) v = randInt(1, maxInt * sc - 1)
        return v
      }
      if (o === 3) {                             // 나눗셈: a = b×몫 역산 (정확)
        const sb = pickScale()
        const bi = rnd(sb), q = randInt(2, 9)
        const ai = bi * q
        return { body: `$${fmtDec(ai, sb)}\\div ${fmtDec(bi, sb)}=$`, answer: String(q), solution: `$${fmtDec(ai, sb)}\\div ${fmtDec(bi, sb)}=${q}$` }
      }
      if (o === 2) {                             // 곱셈: 정수 곱 후 배율 나누기
        const sa = pickScale(), sb = pickScale()
        const ai = rnd(sa), bi = rnd(sb)
        const ans = fmtDec(ai * bi, sa * sb)
        return { body: `$${fmtDec(ai, sa)}\\times ${fmtDec(bi, sb)}=$`, answer: ans, solution: `$${fmtDec(ai, sa)}\\times ${fmtDec(bi, sb)}=${ans}$` }
      }
      // 덧셈·뺄셈: 공통 배율(sc)의 정수로 통일해 계산 (fmtDec가 끝 0을 지워 표기는 동일)
      const sa = pickScale(), sb = pickScale()
      const sc = Math.max(sa, sb)
      let A = rnd(sa) * (sc / sa)
      let B = rnd(sb) * (sc / sb)
      if (o === 1) {                             // 뺄셈: a>b 보장, a=b 자명 문항 금지
        for (let t = 0; t < 60 && A === B; t++) B = rnd(sb) * (sc / sb)
        if (A === B) A += sc / 10
        if (A < B) { const t = A; A = B; B = t }
      }
      const ans = o === 0 ? A + B : A - B
      const sym = o === 0 ? '+' : '-'
      return {
        body: `$${fmtDec(A, sc)}${sym}${fmtDec(B, sc)}=$`,
        answer: fmtDec(ans, sc),
        solution: `$${fmtDec(A, sc)}${sym}${fmtDec(B, sc)}=${fmtDec(ans, sc)}$`,
      }
    }
    case 'lin-eq': {
      const a = randInt(2, 9)
      const x = randInt(d === 1 ? 1 : d === 2 ? 10 : 100, d === 1 ? 9 : d === 2 ? 99 : 999)  // 해는 정수
      const b = randInt(1, 20) * (Math.random() < 0.5 ? -1 : 1)
      const c = a * x + b
      const bs = b >= 0 ? `+${b}` : String(b)
      return {
        body: `$${a}x${bs}=${c}$`,
        answer: String(x),
        solution: `이항: $${a}x=${c}${b >= 0 ? `-${b}` : `+${-b}`}=${a * x}$, $x=${a * x}\\div ${a}=${x}$`,
      }
    }
  }
}

// ── 유형 매핑 ────────────────────────────────────────────
function typesOf(courseId: string): { id: string; name: string; unit: string }[] {
  const out: { id: string; name: string; unit: string }[] = []
  for (const u of curriculumFor(courseId).units)
    for (const m of u.mids)
      for (const s of m.subs)
        for (const t of s.types) out.push({ id: t.id, name: t.name, unit: u.name })
  return out
}

const OP_KEYWORDS: Record<OpId, string[]> = {
  'nat-add': ['자연수의 덧셈', '받아올림 있는 덧셈', '덧셈'],
  'nat-sub': ['자연수의 뺄셈', '받아내림 있는 뺄셈', '뺄셈'],
  'nat-mul': ['곱셈'],
  'nat-div': ['나눗셈'],
  'nat-mix': ['혼합 계산', '혼합'],
  'int-four': ['정수의 덧셈', '정수와 유리수', '정수'],
  'frac-addsub': ['분모가 다른 분수의 덧셈', '분수의 덧셈', '분수'],
  'dec-four': ['소수의 덧셈', '소수'],
  'lin-eq': ['일차방정식의 풀이', '일차방정식', '방정식'],
}

function recommendType(courseId: string, op: OpId): string {
  const types = typesOf(courseId)
  for (const kw of OP_KEYWORDS[op]) {
    const hit = types.find(t => t.name.includes(kw))
    if (hit) return hit.id
  }
  return types[0].id
}

// ── 페이지 ───────────────────────────────────────────────
export default function ArithmeticGen() {
  const { addProblem, saveWorksheet } = useStore()
  const brand = useBrand()
  const nav = useNavigate()

  const [op, setOp] = useState<OpId>('nat-add')
  const [digits, setDigits] = useState(1)
  const [count, setCount] = useState(25)
  const [courseId, setCourseId] = useState('m1-1')
  const [typeId, setTypeId] = useState(() => recommendType('m1-1', 'nat-add'))
  const [items, setItems] = useState<GenItem[]>([])
  const [saving, setSaving] = useState(false)

  const types = useMemo(() => typesOf(courseId), [courseId])

  function changeOp(next: OpId) {
    setOp(next)
    setTypeId(recommendType(courseId, next))
  }
  function changeCourse(next: string) {
    setCourseId(next)
    setTypeId(recommendType(next, op))
  }

  function generate() {
    const seen = new Set<string>()
    const out: GenItem[] = []
    for (let i = 0; i < count; i++) {
      let it = genOne(op, digits)
      for (let t = 0; t < 30 && seen.has(it.body); t++) it = genOne(op, digits)  // 중복 문항 회피
      seen.add(it.body)
      out.push(it)
    }
    setItems(out)
  }

  function register() {
    if (items.length === 0 || saving) return
    setSaving(true)
    const ids: string[] = []
    for (const it of items) {
      const p: Problem = {
        id: uid('p'), typeId, kind: '주관식', diff: 2,
        body: it.body, answer: it.answer, solution: it.solution,
        source: '연산 생성기', twinGroup: `arith-${op}-${digits}`, custom: true,
      }
      addProblem(p)
      ids.push(p.id)
    }
    const now = new Date()
    const wsId = uid('ws')
    saveWorksheet({
      id: wsId,
      title: `연산 - ${opLabel(op)} (${now.getMonth() + 1}.${now.getDate()})`,
      author: brand,
      grade: curriculumFor(courseId).grade,
      tags: ['연산'],
      theme: 'pine',
      problemIds: ids,
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, layout: 'split4' },
      listIds: [],
      createdAt: now.toISOString(),
      deletedAt: null,
    })
    nav(`/worksheet/${wsId}`)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-lg font-bold">연산 학습지 자동 생성기</h2>
        <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine-dark">자체 생성 — 저작권 무관</span>
      </div>
      <p className="mb-5 text-sm text-ink2">숫자 랜덤 템플릿으로 무한 생성합니다. 답은 생성 로직이 역산·검산해 정확성이 보장됩니다.</p>

      {/* 설정 패널 */}
      <div className="mb-6 rounded-2xl border border-line bg-white p-5">
        <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 font-bold">
            연산 종류
            <select value={op} onChange={e => changeOp(e.target.value as OpId)}
              className="rounded-lg border border-line px-3 py-2 font-normal">
              {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 font-bold">
            자릿수 <span className="font-normal text-ink2">(분수는 분모 2~12 고정)</span>
            <div className="flex gap-2 font-normal">
              {[1, 2, 3].map(d => (
                <button key={d} onClick={() => setDigits(d)}
                  className={`rounded-lg border px-4 py-1.5 ${digits === d ? 'border-pine bg-pine-soft font-semibold' : 'border-line'}`}>
                  {d}자리
                </button>
              ))}
            </div>
          </label>
          <label className="grid gap-1 font-bold">
            문항 수
            <div className="flex gap-2 font-normal">
              {[25, 50, 75, 100].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`rounded-lg border px-3 py-1.5 ${count === n ? 'border-pine bg-pine-soft font-semibold' : 'border-line'}`}>
                  {n}
                </button>
              ))}
            </div>
          </label>
          <div className="flex items-end">
            <button onClick={generate}
              className="w-full rounded-lg bg-pine px-5 py-2.5 font-bold text-paper hover:bg-pine-dark">
              문항 생성
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 text-sm md:grid-cols-2">
          <label className="grid gap-1 font-bold">
            과정 <span className="font-normal text-ink2">(문제은행 등록 시 소속 과정)</span>
            <GradeSelect value={courseId} onChange={changeCourse} className="rounded-lg border border-line bg-white px-3 py-2 font-normal" />
          </label>
          <label className="grid gap-1 font-bold">
            유형 <span className="font-normal text-ink2">(연산 종류에 맞게 자동 추천 — 변경 가능)</span>
            <select value={typeId} onChange={e => setTypeId(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 font-normal">
              {types.map(t => <option key={t.id} value={t.id}>{t.unit} › {t.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* 미리보기 */}
      {items.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-bold">미리보기 <span className="text-sm font-normal text-ink2">{items.length}문항</span></h3>
            <div className="grow" />
            <button onClick={generate} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">다시 생성</button>
            <button onClick={register} disabled={saving}
              className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:bg-pine-dark disabled:opacity-50">
              {saving ? '저장 중…' : '문제은행 등록 + 학습지 만들기'}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-line bg-white p-4">
                <div className="mb-1.5 text-xs font-bold text-ink2">{i + 1}</div>
                <MathText text={it.body} />
                <div className="mt-2 text-xs text-pine-dark">답: <MathText text={it.answer} /></div>
              </div>
            ))}
          </div>
        </>
      )}
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink2">
          연산 종류·자릿수·문항 수를 고르고 [문항 생성]을 누르세요.
        </div>
      )}
    </div>
  )
}
