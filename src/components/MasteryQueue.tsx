import { useMemo } from 'react'
import { useStore } from '../lib/store'
import { CURRICULA } from '../data/curriculum'
import { FLOOR_NAME } from '../lib/mastery'
import { wrongTypesOf, recentWrongGradings, type WrongTypeRow } from '../lib/wrongTypes'
import { dateKey } from '../lib/dates'

/**
 * 🪜 정복 대기 큐 — 교재·학습지에서 틀린 유형이 저절로 줄을 선다 (2026-09-08)
 * 선생님이 배정하지 않아도 뜬다. 학생은 위에서부터 누르면 된다(순서는 규칙: 선생님 호출 → 재정복 → 진행중 → 대기).
 */
export function typeNameOf(typeId: string): { name: string; course: string; sub: string } | null {
  for (const c of CURRICULA) for (const u of c.units) for (const m of u.mids)
    for (const s of m.subs) for (const t of s.types) if (t.id === typeId) return { name: t.name, course: c.id, sub: s.name }
  return null
}

const BADGE: Record<WrongTypeRow['status'], string> = {
  선생님: 'bg-red-100 text-red-700', 재정복: 'bg-amber-100 text-amber-800', 진행중: 'bg-sky-100 text-sky-800', 대기: 'bg-paper2 text-ink2',
}

export function useWrongTypes(studentId: string, days = 30, gradingIds?: string[], opt?: { pageRange?: [number, number]; skip?: boolean }): WrongTypeRow[] {
  const { gradings, wbItems, problems, masteries } = useStore()
  const scopeKey = gradingIds?.join(',') ?? ''
  const prKey = opt?.pageRange?.join('-') ?? ''
  const skip = !!opt?.skip
  return useMemo(
    () => (studentId && !skip ? wrongTypesOf({ studentId, gradings, wbItems, problems, masteries, days, gradingIds, pageRange: opt?.pageRange }) : []),
    [studentId, gradings, wbItems, problems, masteries, days, scopeKey, prKey, skip],   // eslint-disable-line react-hooks/exhaustive-deps
  )
}

/**
 * 📕 방금 채점한 오답 — 학생 홈 맨 위 (2026-09-19 명수쌤: "교재 오답을 입력하면 바로")
 * 선생님이 채점판에 오답을 넣든 학생이 자가채점하든, **그 채점의 오답 유형만** 모아 한 번에 사다리로 보낸다.
 * 최근 3일 · 아직 정복 안 된 유형이 남은 채점만 · 최대 2건.
 */
export function RecentWrongShortcut({ studentId, onGo, disabled = false, disabledTitle }: {
  studentId: string; onGo: (gradingIds: string[]) => void
  disabled?: boolean; disabledTitle?: string        // 선생님 학생앱 미리보기에서는 누르지 못하게 (리뷰 F2)
}) {
  const { gradings, wbItems, problems, masteries, workbooks, worksheets } = useStore()
  const items = useMemo(
    () => (studentId ? recentWrongGradings({ studentId, gradings, wbItems, problems, masteries }) : []),
    [studentId, gradings, wbItems, problems, masteries],
  )
  if (!items.length) return null
  const label = (g: (typeof items)[number]['grading']) => {
    if ((g.source ?? '교재') === '학습지') return worksheets.find((w) => w.id === g.worksheetId)?.title ?? g.title ?? '학습지'
    const name = workbooks.find((w) => w.id === g.workbookId)?.name ?? g.title ?? '교재'
    const pg = g.pageFrom == null ? '' : g.pageTo != null && g.pageTo !== g.pageFrom ? ` p.${g.pageFrom}~${g.pageTo}` : ` p.${g.pageFrom}`
    return name + pg
  }
  return (
    <section className="rounded-2xl border-2 border-pine bg-pine-soft/60 p-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="font-black">📕 방금 채점한 오답 — 이 유형만 바로 정복</h2>
        <span className="text-xs text-ink2">틀린 문제의 유형만 골라 개념→기본→표준→심화→최상으로 올립니다</span>
      </div>
      <div className="grid gap-2">
        {items.map(({ grading: g, rows }) => (
          <button key={g.id} type="button" onClick={() => onGo([g.id])} disabled={disabled} title={disabled ? disabledTitle : undefined}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm ring-1 ring-line hover:ring-pine disabled:cursor-not-allowed disabled:opacity-60">
            <b className="text-ink">{label(g)}</b>
            <span className="text-xs text-ink2">{dateKey(g.date).slice(5).replace('-', '/')} · 오답 {rows.length}유형</span>
            <span className="ml-auto rounded-lg bg-pine px-3 py-1.5 text-xs font-black text-paper">바로 정복 →</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function MasteryQueue({ studentId, onPick, limit = 12, compact = false, gradingIds, rows: given, disabled = false, disabledTitle }: {
  studentId: string
  onPick: (row: WrongTypeRow) => void
  limit?: number
  compact?: boolean
  gradingIds?: string[]          // 주면 그 채점의 오답 유형만 (📕 채점 단위 정복)
  rows?: WrongTypeRow[]          // 부르는 쪽이 이미 계산했으면 넘긴다 — 같은 계산을 두 번 하지 않게 (리뷰 F6)
  disabled?: boolean             // 선생님 학생앱 미리보기 (리뷰 F2)
  disabledTitle?: string
}) {
  const computed = useWrongTypes(studentId, 30, gradingIds, { skip: !!given })
  const rows = given ?? computed
  const scoped = !!gradingIds?.length
  if (!rows.length) {
    return compact ? null : (
      <div className="rounded-2xl border border-line bg-white p-5 text-sm text-ink2">
        최근 30일 안에 틀린 유형이 없어요. 교재·학습지를 채점하면 틀린 유형이 여기에 저절로 줄을 섭니다.
      </div>
    )
  }
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        {scoped ? (
          <>
            <h2 className="font-black">📕 이번 채점 오답 유형 {rows.length}개</h2>
            <span className="text-xs text-ink2">틀린 문제의 유형만 — 하나 정복하면 다음 유형으로 넘어갑니다</span>
          </>
        ) : (
          <>
            <h2 className="font-black">🪜 정복할 유형 {rows.length}개</h2>
            <span className="text-xs text-ink2">교재·학습지에서 틀린 유형이 저절로 줄을 섰어요 · 위에서부터</span>
          </>
        )}
      </div>
      <ul className="divide-y divide-line">
        {rows.slice(0, limit).map((r) => {
          const t = typeNameOf(r.typeId)
          return (
            <li key={r.typeId} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${BADGE[r.status]}`}>{r.status}</span>
              {/* 커리큘럼에 이름이 없는 유형도 사다리는 돈다 — 번호라도 보여 준다 (2026-09-12) */}
              <span className="font-bold">{t?.name ?? `유형 ${r.typeId}`}</span>
              {t?.sub && <span className="text-xs text-ink2">{t.sub}</span>}
              <span className="text-xs text-ink2">
                오답 {r.wrong} · {r.sources.join('+')} · {r.lastAt.slice(5).replace('-', '/')}
                {r.state && !r.state.mastered ? ` · 지금 ${FLOOR_NAME[r.state.floor]}층` : ` · ${FLOOR_NAME[r.startFloor]}부터`}
              </span>
              <button
                type="button"
                onClick={() => onPick(r)}
                disabled={disabled}
                title={disabled ? disabledTitle : undefined}
                className="ml-auto rounded-xl bg-pine px-3 py-1.5 text-xs font-black text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {r.status === '진행중' ? '이어서' : r.status === '재정복' ? '다시 정복' : '정복 시작'} →
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length > limit && <div className="mt-2 text-xs text-ink2">외 {rows.length - limit}개</div>}
    </section>
  )
}
