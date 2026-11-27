import { useMemo, useState } from 'react'
import type { Problem } from '../types'
import { DIFF_LABEL } from '../types'
import ProblemContent from './ProblemContent'
import MathText from './MathText'
import { newMastery, pickForFloor, conceptBlanks, topFloorOf, type ConceptBlank, type Floor, type MasteryState } from '../lib/mastery'
import MasteryPaperGrade, { type PaperItem } from './MasteryPaperGrade'

/**
 * 🖨 유형 마스터 — **종이판** (2026-09-05 명수쌤 질문: "이 시스템을 출력물로 만들기는 어렵지?")
 *
 * 종이는 학생의 답을 못 읽으니 앱처럼 **자동으로** 갈라 줄 수는 없다.
 * 대신 **갈래를 전부 미리 인쇄하고 학생이 화살표를 따라가게** 한다(프로그램 학습지).
 * 규칙은 앱과 글자 그대로 같다 — 연속 두 문제를 맞히면 올라가고, 하나라도 틀리면 내려간다.
 *
 * 📝 문제지 (2026-11-16 명수쌤 «문제지로 출력도 할수있게해줘») — 그 유형의 문항을 **전부** 쉬운 것부터
 *    번호를 매겨 한 장에 싣고, 정답·해설은 뒷장에. 풀기 화면의 🖨 단추는 이쪽으로 연다.
 */

export type PrintKind = '문제지' | '승강제'

const FLOORS: { f: Floor; tag: string; name: string }[] = [
  { f: 1, tag: 'B', name: '기본' },
  { f: 2, tag: 'C', name: '표준' },
  { f: 3, tag: 'D', name: '심화' },
  { f: 4, tag: 'E', name: '최상' },
]

export default function MasteryPrint({ typeId, typeName, base, pool, onClose, initialKind = '승강제', current, onPaperApply }: {
  typeId: string; typeName: string; base: Problem; pool: Problem[]; onClose?: () => void
  initialKind?: PrintKind
  /** ✏️ 종이 답 입력·채점(2026-11-27) — 지금 이 학생의 승강제 상태와, 채점 결과를 저장하는 곳 */
  current?: MasteryState
  onPaperApply?: (st: MasteryState, wrong: PaperItem[]) => void
}) {
  const [kind, setKind] = useState<PrintKind>(initialKind)
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

  // 문제지 — 이 유형 문항 전부, 쉬운 것부터(같은 난이도는 원래 순서 그대로)
  const all = useMemo(() => [...pool].filter((p) => p.typeId === typeId).sort((a, b) => a.diff - b.diff), [pool, typeId])

  const label = (tag: string, i: number) => `${tag}${i + 1}`
  // ✏️ 종이 답 입력용 번호표 — 승강제 종이판은 B1·B2…(층 그대로), 문제지는 1·2…(난이도를 층에 맞춤)
  const top = useMemo(() => topFloorOf(typeId, pool), [typeId, pool])
  const paperItems = useMemo<PaperItem[]>(() => {
    if (kind === '승강제') return sheet.flatMap(({ f, tag, items }) => items.map((p, i) => ({ label: label(tag, i), p, floor: f })))
    const diffs = [...new Set(all.map((p) => p.diff))].sort((a, b) => a - b)
    return all.map((p, i) => ({ label: String(i + 1), p, floor: Math.min(top, Math.max(1, diffs.indexOf(p.diff) + 1)) as Floor }))
  }, [kind, sheet, all, top])   // eslint-disable-line react-hooks/exhaustive-deps
  const prevTag = (f: Floor) => (f === 1 ? 'A' : `${FLOORS[f - 2].tag}1`)
  const nextTag = (f: Floor) => (f === 4 ? '끝' : `${FLOORS[f].tag}1`)
  const nItems = sheet.reduce((n, s) => n + s.items.length, 0)

  return (
    // 🔴 note-print — index.css 의 인쇄 규칙이 «.note-print 밖은 전부 숨김»이라, 이게 없으면 인쇄가 빈 종이로 나왔다(2026-11-16 실측)
    <div className="note-print mx-auto max-w-[820px] bg-paper p-6 print:p-0">
      <style>{`@media print {
        .no-print { display: none !important }
        .page-break { break-before: page }
        .mp-item, .mp-item img { break-inside: avoid; page-break-inside: avoid }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
      }`}</style>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-line text-sm" role="group" aria-label="종이판 종류">
          <button type="button" onClick={() => setKind('문제지')} aria-pressed={kind === '문제지'}
            className={`px-3 py-2 font-bold ${kind === '문제지' ? 'bg-ink text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
            문제지 <span className="font-normal opacity-70">전체 {all.length}문항</span>
          </button>
          <button type="button" onClick={() => setKind('승강제')} aria-pressed={kind === '승강제'}
            className={`border-l border-line px-3 py-2 font-bold ${kind === '승강제' ? 'bg-ink text-paper' : 'bg-white text-ink2 hover:bg-paper2'}`}>
            승강제 종이판 <span className="font-normal opacity-70">{nItems}문항·화살표</span>
          </button>
        </div>
        <button type="button" onClick={() => window.print()}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">인쇄</button>
        {onClose && <button type="button" onClick={onClose}
          className="rounded-lg border border-line px-4 py-2 text-sm">화면으로 풀기</button>}
      </div>

      {kind === '문제지' ? (
        <>
          <h1 className="text-xl font-bold text-ink">{typeName}</h1>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 border-b border-line pb-2 text-sm text-ink2">
            <span>이름 <span className="inline-block w-28 border-b border-ink2/60" /></span>
            <span>날짜 <span className="inline-block w-24 border-b border-ink2/60" /></span>
            <span>점수 <span className="inline-block w-12 border-b border-ink2/60" /> / {all.length}</span>
          </div>

          {/* 개념 확인 — 앱의 0층(개념)과 같은 빈칸 */}
          {blanks.length > 0 && (
            <section className="mt-5">
              <h2 className="border-b-2 border-pine pb-1 text-base font-bold text-pine-dark">개념 확인</h2>
              <BlankList blanks={blanks} />
            </section>
          )}

          <section className="mt-6">
            <h2 className="border-b-2 border-pine pb-1 text-base font-bold text-pine-dark">문제</h2>
            {all.map((p, i) => (
              <div key={p.id} className="mp-item mt-3 rounded-lg border border-line p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-ink2">
                  <b className="text-sm text-ink">{i + 1}</b>
                  <span>{DIFF_LABEL[p.diff]}</span>
                  <span className="grow" />
                  {/* ✅ 선생님 채점 칸(2026-11-27 윤자혜 선생님) — 종이에 ○/✗ 를 치고 화면의 체크란에 옮긴다 */}
                  <span className="flex items-center gap-1 text-[11px]">채점
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-ink2/60">○</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-ink2/60">✗</span>
                  </span>
                </div>
                <ProblemContent p={p} />
                <div className="mt-3 h-16 rounded border border-dashed border-line" />
              </div>
            ))}
            {!all.length && <p className="mt-2 text-sm text-ink2">이 유형에는 인쇄할 문항이 없습니다.</p>}
          </section>

          <section className="page-break mt-8">
            <h2 className="border-b-2 border-ink pb-1 text-base font-bold text-ink">정답과 해설</h2>
            <BlankAnswers blanks={blanks} title="개념 확인" />
            {all.map((p, i) => <AnswerBlock key={p.id} p={p} label={String(i + 1)} />)}
          </section>
        </>
      ) : (
        <>
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
              <BlankList blanks={blanks} />
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
                <div key={p.id} className="mp-item mt-3 rounded-lg border border-line p-3">
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
            <BlankAnswers blanks={blanks} title="A. 개념·공식 빈칸" />
            {sheet.map(({ tag, items }) => items.map((p, i) => (
              <AnswerBlock key={p.id} p={p} label={label(tag, i)} />
            )))}
          </section>
        </>
      )}

      {current && onPaperApply && paperItems.length > 0 && (
        <MasteryPaperGrade key={kind} items={paperItems} top={top} current={current} onApply={onPaperApply} />
      )}
    </div>
  )
}

function BlankList({ blanks }: { blanks: ConceptBlank[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {blanks.map((b, i) => (
        <li key={i} className="rounded-lg border border-line p-3 text-[14px] leading-relaxed">
          <span className="mr-1.5 rounded bg-paper2 px-1.5 py-0.5 text-[11px] font-bold text-ink2">{b.kind}</span>
          <MathText text={b.text} />
        </li>
      ))}
    </ol>
  )
}

function BlankAnswers({ blanks, title }: { blanks: ConceptBlank[]; title: string }) {
  if (!blanks.length) return null
  return (
    <div className="mt-3">
      <p className="text-sm font-bold text-ink">{title}</p>
      <ol className="mt-1 list-decimal pl-5 text-[13px] leading-relaxed text-ink2">
        {blanks.map((b, i) => (
          <li key={i}><MathText text={b.kind === '공식' ? `$${b.answer}$` : b.answer} /></li>
        ))}
      </ol>
    </div>
  )
}

function AnswerBlock({ p, label }: { p: Problem; label: string }) {
  return (
    <div className="mt-3 border-t border-line pt-2">
      {/* 매쓰플랫 문항은 답·해설이 **이미지**로 온다 — 글자로 그리면 빈칸이 된다(2026-09-05 실측) */}
      <p className="flex items-center gap-1 text-sm font-bold text-ink">
        <span>{label} · 답</span>
        {p.answer.startsWith('http')
          ? <img src={p.answer} alt="답" className="max-h-6" />
          : <MathText text={p.answer} />}
      </p>
      {p.solution && (p.solution.startsWith('http')
        ? <img src={p.solution} alt="해설" className="mt-1 w-full max-w-[420px]" />
        : <div className="mt-1 text-[13px] leading-relaxed text-ink2"><MathText text={p.solution} /></div>)}
    </div>
  )
}
