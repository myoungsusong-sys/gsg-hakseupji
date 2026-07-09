import { useMemo, useState } from 'react'
import type { Grading, WBItem, Workbook } from '../../types'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import { typeName, typeUnitName } from '../../data/curriculum'
import MathText from '../../components/MathText'
import { useStudentSelf } from './common'

// ── 교재 탭 (매쓰플랫 학생앱 교재 구조) — 선생님 채점 결과 열람 전용 ──
// 목록: 출제일 | [시중교재] 교재명 | 진척도 % 게이지 (채점된 문항/전체 문항)
// 상세: 페이지 네비([←] NP [→], 시작=마지막 채점 쪽) + 오답/모름만 토글 + 문항 카드 3열
//       번호 밴드 ○/✕/?/미채점 + 유형명 + 정답(공개설정 따름, 비공개면 🔒 안내)
// 학생은 교재를 채점할 수 없다 — 채점은 수업 시간에 선생님이 한다.

type Mark = '정답' | '오답' | '모름'
const MARK_ICON: Record<Mark, string> = { 정답: '○', 오답: '✕', 모름: '?' }
// 번호 밴드: 정답 연파랑(pine-soft, 결과 화면과 동일 팔레트)/오답 연분홍/모름 연노랑/미채점 회색
const BAND_CLASS: Record<Mark, string> = {
  정답: 'bg-pine-soft text-pine-dark',
  오답: 'bg-red-50 text-clay',
  모름: 'bg-amber-soft text-amber',
}
const BAND_UNMARKED = 'bg-paper2 text-ink2/60'

// 문항별 최신 채점 마크 (같은 문항을 여러 번 채점하면 최신 기록 우선)
function latestMarks(gradings: Grading[], studentId: string, workbookId: string): Map<string, { mark: Mark; date: string }> {
  const m = new Map<string, { mark: Mark; date: string }>()
  for (const g of gradings) {
    if (g.studentId !== studentId || g.workbookId !== workbookId) continue
    for (const r of g.results) {
      if (!r.itemId) continue
      const prev = m.get(r.itemId)
      if (prev && prev.date > g.date) continue
      m.set(r.itemId, { mark: r.unknown ? '모름' : r.correct ? '정답' : '오답', date: g.date })
    }
  }
  return m
}

// WBItem 정답 표시 (채점판 AnswerLabel과 동일 규칙)
const CIRCLED = ['①', '②', '③', '④', '⑤']
function WbAnswer({ item }: { item: WBItem }) {
  const a = (item.answer ?? '').trim()
  if (!a || ['.', '-'].includes(a)) return <span className="text-ink2/70">풀이참조</span>
  if (item.kind === '객관식') {
    const t = a.split(',').map(s => {
      const n = Number(s.trim())
      return n >= 1 && n <= 5 ? CIRCLED[n - 1] : s.trim()
    }).join(', ')
    return <b>{t}</b>
  }
  if (a.includes('$')) return <MathText text={a} />
  if (/[\\{}^_]/.test(a)) return <MathText text={`$${a}$`} />
  return <b>{a}</b>
}

export default function StudentWorkbooks() {
  const me = useStudentSelf()
  const { workbooks, wbItems, gradings } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  const myBooks = useMemo(() => workbooks.filter(w => w.studentId === me.id), [workbooks, me.id])

  const rows = useMemo(() => {
    return myBooks.map(wb => {
      const items = wbItems.filter(i => i.workbookId === wb.id)
      const marks = latestMarks(gradings, me.id, wb.id)
      let graded = 0
      for (const i of items) if (marks.has(i.id)) graded++
      // 출제일: 배정 시각 기록이 없어 첫 채점일로 표시 (미채점이면 —)
      let first = ''
      for (const g of gradings) {
        if (g.studentId !== me.id || g.workbookId !== wb.id) continue
        if (!first || g.date < first) first = g.date
      }
      return { wb, total: items.length, graded, first }
    })
  }, [myBooks, wbItems, gradings, me.id])

  const open = openId ? myBooks.find(w => w.id === openId) : undefined
  if (open) return <WorkbookDetail wb={open} onBack={() => setOpenId(null)} />

  return (
    <div>
      <h1 className="mb-1 text-xl font-black">교재</h1>
      <p className="mb-4 text-sm text-ink2">교재 채점은 수업 시간에 선생님이 해요 — 여기서 결과를 확인할 수 있어요.</p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          아직 배정된 교재가 없어요. 선생님이 교재를 배정하면 여기에 나타나요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="px-4 py-2.5">출제일</th>
                <th className="py-2.5">교재명</th>
                <th className="py-2.5 pr-4">진척도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ wb, total, graded, first }) => {
                const pct = total > 0 ? Math.round(graded / total * 100) : 0
                return (
                  <tr key={wb.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-ink2">
                      {first ? dateKey(first).slice(2).replace(/-/g, '.') : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      <button onClick={() => setOpenId(wb.id)} className="text-left hover:text-pine">
                        {wb.matchKey && (
                          <span className="mr-1.5 rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">시중교재</span>
                        )}
                        <span className="font-bold hover:underline">{wb.name}</span>
                        <span className="ml-2 text-xs text-ink2">{wb.publisher} · {wb.grade}</span>
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-36 overflow-hidden rounded-full bg-paper2">
                          <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 whitespace-nowrap text-xs font-bold text-pine-dark">
                          {pct}% <span className="font-normal text-ink2">({graded}/{total})</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 교재 상세 — 페이지별 채점 결과 (읽기 전용) ────────────────────
function WorkbookDetail({ wb, onBack }: { wb: Workbook; onBack: () => void }) {
  const me = useStudentSelf()
  const { wbItems, gradings, studentAppConfig: cfg } = useStore()
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [pageList, setPageList] = useState(false)   // 페이지 리스트 모달

  const items = useMemo(
    () => wbItems.filter(i => i.workbookId === wb.id).sort((a, b) => a.page - b.page || a.no - b.no),
    [wbItems, wb.id],
  )
  const marks = useMemo(() => latestMarks(gradings, me.id, wb.id), [gradings, me.id, wb.id])
  const pages = useMemo(() => [...new Set(items.map(i => i.page))].sort((a, b) => a - b), [items])

  // 시작 페이지 = 마지막(최신) 채점 쪽 — 채점된 문항 중 가장 최근 기록의 최대 쪽
  const [page, setPage] = useState<number>(() => {
    let bestDate = ''
    let bestPage = pages[0] ?? 1
    for (const i of items) {
      const m = marks.get(i.id)
      if (!m) continue
      if (m.date > bestDate || (m.date === bestDate && i.page > bestPage)) { bestDate = m.date; bestPage = i.page }
    }
    return bestPage
  })

  const pageIdx = Math.max(0, pages.indexOf(page))
  const pageItems = items.filter(i => i.page === page)
  const shown = onlyWrong
    ? pageItems.filter(i => { const m = marks.get(i.id)?.mark; return m === '오답' || m === '모름' })
    : pageItems

  const gradedOnPage = pageItems.filter(i => marks.has(i.id)).length
  const wrongOnPage = pageItems.filter(i => { const m = marks.get(i.id)?.mark; return m === '오답' || m === '모름' }).length

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={onBack}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">← 교재</button>
        <div>
          <h1 className="text-lg font-black">
            {wb.matchKey && (
              <span className="mr-1.5 align-[2px] rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">시중교재</span>
            )}
            {wb.name}
          </h1>
          <div className="text-xs text-ink2">{wb.publisher} · {wb.grade} · 전체 {items.length}문항 — 선생님 채점 결과 열람</div>
        </div>
      </div>

      {/* 페이지 네비 + 토글 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPage(pages[pageIdx - 1] ?? page)} disabled={pageIdx <= 0}
            className="h-9 w-9 rounded-lg border border-line font-bold text-ink2 hover:bg-paper2 disabled:opacity-30">←</button>
          <select value={page} onChange={e => setPage(Number(e.target.value))}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-black text-pine-dark">
            {pages.map(p => <option key={p} value={p}>{p}P</option>)}
          </select>
          <button onClick={() => setPage(pages[pageIdx + 1] ?? page)} disabled={pageIdx >= pages.length - 1}
            className="h-9 w-9 rounded-lg border border-line font-bold text-ink2 hover:bg-paper2 disabled:opacity-30">→</button>
          <button onClick={() => setPageList(true)}
            className="h-9 rounded-lg border border-line px-2.5 text-sm font-semibold text-ink2 hover:bg-paper2">
            ≡ 페이지 리스트
          </button>
        </div>
        <span className="text-xs text-ink2">
          이 쪽 {pageItems.length}문항 · 채점 {gradedOnPage} · 오답·모름 <b className="text-clay">{wrongOnPage}</b>
        </span>
        <div className="grow" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)}
            className="h-4 w-4 accent-pine" />
          오답/모르는 문제만 보기
        </label>
      </div>

      {/* 문항 카드 그리드 (3열) */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          {onlyWrong ? '이 쪽에는 오답·모르는 문제가 없어요 🎉' : '이 쪽에는 문항이 없어요.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(i => {
            const m = marks.get(i.id)?.mark
            return (
              <div key={i.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className={`flex items-center gap-2 px-3.5 py-2 ${m ? BAND_CLASS[m] : BAND_UNMARKED}`}>
                  <span className="text-lg font-black leading-none">{m ? MARK_ICON[m] : '·'}</span>
                  <b>{i.label ?? i.no}번</b>
                  {!m && <span className="text-[11px]">미채점</span>}
                </div>
                <div className="grid gap-1.5 p-3.5 text-sm">
                  <div className="text-xs text-ink2">{typeName(i.typeId)}</div>
                  {cfg.showAnswer ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-ink2">답 :</span>
                      <WbAnswer item={i} />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-paper2/60 px-2.5 py-2 text-xs text-ink2">
                      🔒 정답 · 해설이 비공개 상태입니다.
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 페이지 리스트 모달 — 단원명 섹션별 페이지 행 (채점 완료 페이지 ✓) */}
      {pageList && (
        <PageListModal items={items} marks={marks} current={page}
          onPick={p => { setPage(p); setPageList(false) }} onClose={() => setPageList(false)} />
      )}
    </div>
  )
}

// ── 페이지 리스트 모달 (매쓰플랫 "페이지 리스트" — 단원명 섹션 + 페이지 행 ✓) ──
function PageListModal({ items, marks, current, onPick, onClose }: {
  items: WBItem[]
  marks: Map<string, { mark: Mark; date: string }>
  current: number
  onPick: (page: number) => void
  onClose: () => void
}) {
  // 페이지 → 단원명(그 쪽 첫 문항의 대단원·중단원) 섹션으로 묶기
  const sections = useMemo(() => {
    const byPage = new Map<number, WBItem[]>()
    for (const i of items) {
      const arr = byPage.get(i.page)
      if (arr) arr.push(i); else byPage.set(i.page, [i])
    }
    const out: { unit: string; pages: { page: number; done: boolean }[] }[] = []
    for (const [page, arr] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
      const unit = typeUnitName(arr[0].typeId) || '기타'
      const done = arr.length > 0 && arr.every(i => marks.has(i.id))
      const last = out[out.length - 1]
      if (last && last.unit === unit) last.pages.push({ page, done })
      else out.push({ unit, pages: [{ page, done }] })
    }
    return out
  }, [items, marks])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start gap-3">
          <h2 className="text-lg font-black">페이지 리스트</h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-lg px-2 py-0.5 text-lg text-ink2 hover:bg-paper2">✕</button>
        </div>
        <div className="grid gap-3">
          {sections.map((s, si) => (
            <section key={si}>
              <div className="mb-1.5 text-xs font-black text-ink2">{s.unit}</div>
              <div className="grid gap-1">
                {s.pages.map(({ page, done }) => (
                  <button key={page} onClick={() => onPick(page)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold hover:bg-paper2 ${
                      page === current ? 'border-pine bg-pine-soft/50 text-pine-dark' : 'border-line/70'}`}>
                    <span className="text-ink2">≡</span>
                    {done && <span className="font-black text-pine">✓</span>}
                    <span>{page}P</span>
                    <div className="grow" />
                    <span className="text-ink2">›</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
