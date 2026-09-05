import { useMemo } from 'react'
import type { Problem } from '../types'
import { DIFF_LABEL } from '../types'
import ProblemContent from './ProblemContent'
import MathText from './MathText'
import { newMastery, pickForFloor, conceptBlanks, type Floor, type MasteryState } from '../lib/mastery'

/**
 * 🖨 유형 마스터 — **종이판** (2026-09-05 명수쌤 질문: "이 시스템을 출력물로 만들기는 어렵지?")
 *
 * 종이는 학생의 답을 못 읽으니 앱처럼 **자동으로** 갈라 줄 수는 없다.
 * 대신 **갈래를 전부 미리 인쇄하고 학생이 화살표를 따라가게** 한다(프로그램 학습지).
 * 규칙은 앱과 글자 그대로 같다 — 연속 두 문제를 맞히면 올라가고, 하나라도 틀리면 내려간다.
 */

const FLOORS: { f: Floor; tag: string; name: string }[] = [
  { f: 1, tag: 'B', name: '기본' },
  { f: 2, tag: 'C', name: '표준' },
  { f: 3, tag: 'D', name: '심화' },
  { f: 4, tag: 'E', name: '최상' },
]

export default function MasteryPrint({ typeId, typeName, base, pool, onClose }: {
  typeId: string; typeName: string; base: Problem; pool: Problem[]; onClose?: () => void
}) {
  const blanks = useMemo(() => conceptBlanks(typeId), [typeId])

  // 층마다 2문항씩 — 앱이 뽑는 것과 같은 함수를 쓰되, 이미 쓴 문항은 빼 가며 8개를 채운다
  const sheet = useMemo(() => {
    const used: string[] = []
    return FLOORS.map(({ f, tag, name }) => {
      const items: Problem[] = []
      for (let k = 0; k < 2; k++) {
        const st: MasteryState = { ...newMastery('print', typeId, f), floor: f, servedIds: [...used] }
        const p = pickForFloor(st, base, pool)
        if (p && !used.includes(p.id)) { items.push(p); used.push(p.id) }
      }
      return { f, tag, name, items }
    })
  }, [typeId, base, pool])

  const label = (tag: string, i: number) => `${tag}${i + 1}`
  const prevTag = (f: Floor) => (f === 1 ? 'A' : `${FLOORS[f - 2].tag}1`)
  const nextTag = (f: Floor) => (f === 4 ? '끝' : `${FLOORS[f].tag}1`)

  return (
    <div className="mx-auto max-w-[820px] bg-paper p-6 print:p-0">
      <style>{`@media print {
        .no-print { display: none !important }
        .page-break { break-before: page }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
      }`}</style>

      <div className="no-print mb-4 flex gap-2">
        <button type="button" onClick={() => window.print()}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">인쇄</button>
        {onClose && <button type="button" onClick={onClose}
          className="rounded-lg border border-line px-4 py-2 text-sm">화면으로 풀기</button>}
      </div>

      <h1 className="text-xl font-bold text-ink">유형 마스터 · {typeName}</h1>
      <div className="mt-2 rounded-lg border border-line bg-paper2/50 p-3 text-[13px] leading-relaxed text-ink2">
        <b className="text-ink">쓰는 법</b> — <b>C1</b>부터 시작한다.
        문제를 풀고 뒷장 정답과 맞춰 본 뒤 <b>그 문제 아래 화살표대로</b> 이동한다.
        연속 두 문제를 맞히면 한 단계 올라가고, 하나라도 틀리면 한 단계 내려간다.
        기본(B)에서 또 틀리면 <b>A 개념칸</b>으로 돌아가 채운 뒤 B1부터 다시 올라온다.
        <b> E2</b>까지 맞히면 이 유형은 끝이다. 같은 칸에서 세 번 틀리면 <b>선생님을 부른다.</b>
      </div>

      {/* A. 개념·공식 빈칸 — 가장 아래 칸 */}
      <section className="mt-5">
        <h2 className="border-b-2 border-pine pb-1 text-base font-bold text-pine-dark">
          A. 개념·공식 빈칸 <span className="text-xs font-normal text-ink2">(여기서 막히면 선생님께)</span>
        </h2>
        {blanks.length ? (
          <ol className="mt-2 space-y-2">
            {blanks.map((b, i) => (
              <li key={i} className="rounded-lg border border-line p-3 text-[14px] leading-relaxed">
                <span className="mr-1.5 rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{b.kind}</span>
                <MathText text={b.text} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink2">이 유형에 연결된 개념 정리가 없습니다 — 교재 개념 쪽을 다시 읽고 B1로.</p>
        )}
        <p className="mt-2 text-[13px] font-bold text-pine-dark">→ 다 채웠으면 <b>B1</b>로</p>
      </section>

      {/* B~E. 층별 2문항 */}
      {sheet.map(({ f, tag, name, items }) => (
        <section key={tag} className="mt-6">
          <h2 className="border-b-2 border-pine pb-1 text-base font-bold text-pine-dark">
            {tag}. {name}
          </h2>
          {items.map((p, i) => (
            <div key={p.id} className="mt-3 rounded-lg border border-line p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-ink2">
                <b className="text-sm text-ink">{label(tag, i)}</b>
                <span>{DIFF_LABEL[p.diff]}</span>
              </div>
              <ProblemContent p={p} />
              <div className="mt-3 h-16 rounded border border-dashed border-line" />
              <p className="mt-2 text-[13px]">
                <span className="font-bold text-pine-dark">○ 맞았다 → {i === 0 ? label(tag, 1) : nextTag(f)}</span>
                <span className="mx-2 text-line">|</span>
                <span className="font-bold text-red-600">✗ 틀렸다 → {prevTag(f)}</span>
              </p>
            </div>
          ))}
          {!items.length && <p className="mt-2 text-sm text-ink2">이 난이도의 문항이 부족합니다.</p>}
        </section>
      ))}

      {/* 정답·해설 — 뒷장 */}
      <section className="page-break mt-8">
        <h2 className="border-b-2 border-ink pb-1 text-base font-bold text-ink">정답과 해설</h2>
        {blanks.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-bold text-ink">A. 개념·공식 빈칸</p>
            <ol className="mt-1 list-decimal pl-5 text-[13px] leading-relaxed text-ink2">
              {blanks.map((b, i) => (
                <li key={i}><MathText text={b.kind === '공식' ? `$${b.answer}$` : b.answer} /></li>
              ))}
            </ol>
          </div>
        )}
        {sheet.map(({ tag, items }) => items.map((p, i) => (
          <div key={p.id} className="mt-3 border-t border-line pt-2">
            {/* 매쓰플랫 문항은 답·해설이 **이미지**로 온다 — 글자로 그리면 빈칸이 된다(2026-09-05 실측) */}
            <p className="flex items-center gap-1 text-sm font-bold text-ink">
              <span>{label(tag, i)} · 답</span>
              {p.answer.startsWith('http')
                ? <img src={p.answer} alt="답" className="max-h-6" />
                : <MathText text={p.answer} />}
            </p>
            {p.solution && (p.solution.startsWith('http')
              ? <img src={p.solution} alt="해설" className="mt-1 w-full max-w-[420px]" />
              : <div className="mt-1 text-[13px] leading-relaxed text-ink2"><MathText text={p.solution} /></div>)}
          </div>
        )))}
      </section>
    </div>
  )
}
