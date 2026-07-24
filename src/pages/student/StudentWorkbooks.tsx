import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GradeResult, Grading, WBItem, Workbook } from '../../types'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { wbAnswerImg, normAnswer } from '../../lib/answers'
import { typeName, typeUnitName } from '../../data/curriculum'
import MathText from '../../components/MathText'
import { useStudentSelf } from './common'

// ── 교재 탭 (매쓰플랫 학생앱 교재 구조) ──
// 목록: 출제일 | [시중교재] 교재명 | 진척도 % 게이지 (채점된 문항/전체 문항)
// 상세: 페이지 네비([←] NP [→], 시작=마지막 채점 쪽) + 오답/모름만 토글 + 문항 카드 3열
//   · [보기 모드] 번호 밴드 ○/✕/?/미채점 + 유형명 + 내 답 (정답은 공개설정 따름, 기본 비공개)
//   · [채점 모드] "✏️ 직접 풀고 채점하기" — 학생이 페이지 문항 답을 입력→[채점하기]로 자동채점
//     (매쓰플랫 교재 채점 동일). 정답은 노출하지 않고 ○/✕만 매긴다. 정답이 이미지(서술형)인
//     문항은 대조에 정답 노출이 필요하므로 자동채점 대상에서 빼고 '선생님 채점' 문항으로 둔다.

type Mark = '정답' | '오답' | '모름'
const MARK_ICON: Record<Mark, string> = { 정답: '○', 오답: '✕', 모름: '?' }

// 자동채점 가능 문항 여부 — 정답이 텍스트(객관식·단답·OX)일 때만. 풀이참조·이미지 정답은 제외.
function wbGradable(item: WBItem): boolean {
  const a = (item.answer ?? '').trim()
  if (!a || ['.', '-'].includes(a)) return false
  if (wbAnswerImg(a)) return false   // 이미지 정답 = 자동대조하려면 정답을 보여줘야 함 → 선생님 채점
  return true
}
// 학생 답 ↔ 정답 대조 (normAnswer 정규화: 공백·원문자·전각·OX 통일)
function autoCorrectWB(item: WBItem, ans: string): boolean {
  const a = normAnswer((item.answer ?? '').trim())
  const s = normAnswer(ans)
  return s !== '' && s === a
}
type WbInputKind = '객관식' | 'OX' | '주관식'
function wbInputKind(item: WBItem): WbInputKind {
  const n = normAnswer((item.answer ?? '').trim())
  if (n === 'O' || n === 'X') return 'OX'
  if (item.kind === '객관식') return '객관식'
  return '주관식'
}

const CIRCLE5 = ['①', '②', '③', '④', '⑤']
// 교재 채점 모드 답 입력 (정답 비노출) — 객관식 ①~⑤ · OX · 단답 텍스트 + 모름
function WbAnswerInput({ item, value, onChange }: {
  item: WBItem; value: string; onChange: (v: string) => void
}) {
  const kind = wbInputKind(item)
  const unknownBtn = (
    <button type="button" onClick={() => onChange(value === '모름' ? '' : '모름')}
      className={`h-9 rounded-full border px-3 text-sm font-bold ${
        value === '모름' ? 'border-amber bg-amber text-white' : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
      모름
    </button>
  )
  if (kind === '객관식') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {CIRCLE5.map(c => (
          <button key={c} type="button" onClick={() => onChange(value === c ? '' : c)}
            className={`h-9 w-9 rounded-full border text-base font-bold ${
              value === c ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
            {c}
          </button>
        ))}
        {unknownBtn}
      </div>
    )
  }
  if (kind === 'OX') {
    return (
      <div className="flex gap-1.5">
        {(['O', 'X'] as const).map(m => (
          <button key={m} type="button" onClick={() => onChange(value === m ? '' : m)}
            className={`h-9 w-9 rounded-full border text-base font-black ${
              value === m ? (m === 'O' ? 'border-pine bg-pine text-paper' : 'border-clay bg-clay text-white')
              : 'border-line bg-white text-ink hover:bg-paper2'}`}>
            {m}
          </button>
        ))}
        {unknownBtn}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input value={value === '모름' ? '' : value} onChange={e => onChange(e.target.value)}
        placeholder="답 입력"
        className="w-40 rounded-lg border border-line px-3 py-2 text-sm" />
      {unknownBtn}
    </div>
  )
}
// 번호 밴드: 정답 연파랑(pine-soft, 결과 화면과 동일 팔레트)/오답 연분홍/모름 연노랑/미채점 회색
const BAND_CLASS: Record<Mark, string> = {
  정답: 'bg-pine-soft text-pine-dark',
  오답: 'bg-red-50 text-clay',
  모름: 'bg-amber-soft text-amber',
}
const BAND_UNMARKED = 'bg-paper2 text-ink2/60'

type MarkInfo = { mark: Mark; date: string; ans?: string; careless?: boolean; attempts?: number; gid: string }
// 문항별 최신 채점 마크 (같은 문항을 여러 번 채점하면 최신 기록 우선)
function latestMarks(gradings: Grading[], studentId: string, workbookId: string): Map<string, MarkInfo> {
  const m = new Map<string, MarkInfo>()
  for (const g of gradings) {
    if (g.studentId !== studentId || g.workbookId !== workbookId) continue
    for (const r of g.results) {
      if (!r.itemId) continue
      const prev = m.get(r.itemId)
      if (prev && prev.date > g.date) continue
      m.set(r.itemId, {
        mark: r.unknown ? '모름' : r.correct ? '정답' : '오답',
        date: g.date, ans: r.studentAnswer, careless: r.careless, attempts: r.attempts ?? 1, gid: g.id,
      })
    }
  }
  return m
}

// WBItem 정답 표시 (채점판 AnswerLabel과 동일 규칙)
const CIRCLED = ['①', '②', '③', '④', '⑤']
function WbAnswer({ item }: { item: WBItem }) {
  const a = (item.answer ?? '').trim()
  const img = wbAnswerImg(a)
  if (img) return <img src={img} alt="정답" loading="lazy" className="max-h-20 w-auto max-w-full rounded border border-line bg-white" />
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
  const [tab, setTab] = useState<'일반교재' | '시그니처교재'>('일반교재')   // 매쓰플랫 동일 탭

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
      <p className="mb-4 text-sm text-ink2">교재를 열어 직접 풀고 채점할 수 있어요 — 답을 입력하면 자동으로 채점돼요.</p>

      {/* 일반교재 | 시그니처교재 탭 (매쓰플랫 동일) */}
      <div className="mb-5 flex justify-center gap-2">
        {(['일반교재', '시그니처교재'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === '시그니처교재' ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          📖<br />학원에서 구매한 시그니처 교재가 없어요.<br />선생님께 시그니처 교재 구매를 요청해보세요.
        </div>
      ) : rows.length === 0 ? (
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

// ── 교재 상세 — 페이지별 채점 (보기 / 직접 풀고 채점) ────────────────
function WorkbookDetail({ wb, onBack }: { wb: Workbook; onBack: () => void }) {
  const me = useStudentSelf()
  const nav = useNavigate()
  const { wbItems, gradings, upsertGrading, studentAppConfig: cfg } = useStore()
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [pageList, setPageList] = useState(false)   // 페이지 리스트 모달
  const [mode, setMode] = useState<'view' | 'grade'>('view')   // 보기 / 채점(직접 풀기)
  const [answers, setAnswers] = useState<Record<string, string>>({})   // 채점 모드 입력값
  const [savedAt, setSavedAt] = useState('')
  const [retryOpen, setRetryOpen] = useState<string | null>(null)      // 다시 풀기 인라인 입력 중인 문항
  const [retryAns, setRetryAns] = useState('')                          // 다시 풀기 입력값

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
  const carelessOnPage = pageItems.filter(i => marks.get(i.id)?.careless).length   // 실수(다시 풀어 맞힌) 수

  // 이 페이지에서 자동채점 가능한 문항 (텍스트 정답) — 채점 모드 대상
  const gradableOnPage = pageItems.filter(wbGradable)
  const answeredCount = gradableOnPage.filter(i => (answers[i.id] ?? '') !== '').length

  // 채점하기 — 입력한 답을 자동채점해 저장(같은 날·같은 쪽 학생 기록에 덮어쓰기)
  function submitGrade() {
    const results: GradeResult[] = gradableOnPage
      .filter(i => (answers[i.id] ?? '') !== '')
      .map(i => {
        const ans = answers[i.id]!
        const unknown = ans === '모름'
        return { itemId: i.id, studentAnswer: ans, correct: unknown ? false : autoCorrectWB(i, ans), unknown: unknown || undefined }
      })
    if (results.length === 0) return
    const today = todayKey()
    const exist = gradings.find(g =>
      g.studentId === me.id && g.workbookId === wb.id && g.by === 'student' &&
      g.pageFrom === page && g.pageTo === page && dateKey(g.date) === today)
    upsertGrading({
      id: exist?.id ?? uid('gr'),
      studentId: me.id, source: '교재', workbookId: wb.id, by: 'student',
      date: new Date().toISOString(), pageFrom: page, pageTo: page, results,
    })
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    setAnswers({})
    setMode('view')
    setOnlyWrong(false)
  }

  // 틀린 문제 다시 풀기 — 그 문항이 든 최신 기록을 찾아 결과를 갱신(2차 시도).
  //  · 다시 풀어 맞히면 careless=true(실수 — 아는데 틀렸던 것). 여전히 틀리면 attempts=2로 두고 강의 안내.
  function regradeOne(item: WBItem, ans: string) {
    const rec = marks.get(item.id)
    if (!rec) return
    const g = gradings.find(x => x.id === rec.gid)
    if (!g) return
    const ok = autoCorrectWB(item, ans)
    const results = g.results.map(r =>
      r.itemId === item.id
        ? { ...r, attempts: 2, retryAnswer: ans, careless: ok || undefined }
        : r)
    upsertGrading({ ...g, date: new Date().toISOString(), results })
    setRetryOpen(null); setRetryAns('')
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => (mode === 'grade' ? setMode('view') : onBack())}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-paper2">
          {mode === 'grade' ? '← 채점 취소' : '← 교재'}
        </button>
        <div>
          <h1 className="text-lg font-black">
            {wb.matchKey && (
              <span className="mr-1.5 align-[2px] rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">시중교재</span>
            )}
            {wb.name}
          </h1>
          <div className="text-xs text-ink2">
            {wb.publisher} · {wb.grade} · 전체 {items.length}문항
            {mode === 'grade' ? ' — 직접 풀고 채점' : ''}
          </div>
        </div>
        <div className="grow" />
        {mode === 'view' && savedAt && (
          <span className="text-xs font-bold text-pine">✓ 채점 저장됨 {savedAt}</span>
        )}
        {mode === 'view' && (
          <button onClick={() => { setMode('grade'); setAnswers({}); setOnlyWrong(false) }}
            className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper hover:brightness-110">
            ✏️ 직접 풀고 채점하기
          </button>
        )}
      </div>

      {/* 안내 문구 */}
      {mode === 'grade' ? (
        <p className="mb-3 text-sm text-ink2">이 쪽 문항의 답을 입력하고 <b className="text-pine-dark">채점하기</b>를 누르면 자동으로 채점돼요. 정답은 공개되지 않아요.</p>
      ) : !cfg.showAnswer ? (
        <p className="mb-3 text-sm text-ink2">채점 후 답과 해설이 비공개되어 있습니다. 선생님에게 문의해주세요.</p>
      ) : null}

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
          {mode === 'grade'
            ? <>이 쪽 채점 문항 {gradableOnPage.length} · 입력 <b className="text-pine-dark">{answeredCount}</b></>
            : <>이 쪽 {pageItems.length}문항 · 채점 {gradedOnPage} · 오답·모름 <b className="text-clay">{wrongOnPage}</b>{carelessOnPage > 0 && <> · 실수 <b className="text-amber">{carelessOnPage}</b></>}</>}
        </span>
        <div className="grow" />
        {mode === 'view' && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)}
              className="h-4 w-4 accent-pine" />
            오답/모르는 문제만 보기
          </label>
        )}
      </div>

      {/* ── 채점 모드: 답 입력 카드 ── */}
      {mode === 'grade' ? (
        pageItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
            이 쪽에는 문항이 없어요.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map(i => {
                const gradable = wbGradable(i)
                return (
                  <div key={i.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                    <div className="flex items-center gap-2 bg-paper2 px-3.5 py-2 text-ink2/70">
                      <b className="text-ink">{i.label ?? i.no}번</b>
                      <span className="truncate text-[11px]">{typeName(i.typeId)}</span>
                    </div>
                    <div className="grid gap-2 p-3.5 text-sm">
                      {gradable ? (
                        <WbAnswerInput item={i} value={answers[i.id] ?? ''}
                          onChange={v => setAnswers(prev => ({ ...prev, [i.id]: v }))} />
                      ) : (
                        <div className="rounded-lg bg-paper2/60 px-2.5 py-2 text-xs text-ink2">
                          ✍️ 이 문항은 선생님이 채점해요 (자동채점 대상 아님).
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* 하단 채점 바 */}
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4">
              <span className="text-sm text-ink2">
                채점 문항 <b className="text-ink">{gradableOnPage.length}</b> 중 <b className="text-pine-dark">{answeredCount}</b>개 입력함
              </span>
              <div className="grow" />
              <button onClick={() => setMode('view')}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:bg-paper2">취소</button>
              <button onClick={submitGrade} disabled={answeredCount === 0}
                className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-40">
                채점하기
              </button>
            </div>
          </>
        )
      ) : /* ── 보기 모드: 채점 결과 카드 ── */
      shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          {onlyWrong ? '이 쪽에는 오답·모르는 문제가 없어요 🎉' : '이 쪽에는 문항이 없어요.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(i => {
            const rec = marks.get(i.id)
            const m = rec?.mark
            const careless = !!rec?.careless
            const attempts = rec?.attempts ?? 1
            const wrongish = m === '오답' || m === '모름'
            const canRetry = wrongish && !careless && attempts < 2 && wbGradable(i)
            const twiceWrong = wrongish && !careless && attempts >= 2
            const bandCls = careless ? BAND_CLASS['모름'] : m ? BAND_CLASS[m] : BAND_UNMARKED
            return (
              <div key={i.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className={`flex items-center gap-2 px-3.5 py-2 ${bandCls}`}>
                  <span className="text-lg font-black leading-none">{m ? MARK_ICON[m] : '·'}</span>
                  <b>{i.label ?? i.no}번</b>
                  {!m && <span className="text-[11px]">미채점</span>}
                  {careless && (
                    <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-amber">
                      ✏️ 실수 (다시 풀어 맞힘)
                    </span>
                  )}
                  {twiceWrong && (
                    <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-clay">
                      두 번 틀림
                    </span>
                  )}
                </div>
                <div className="grid gap-1.5 p-3.5 text-sm">
                  <div className="text-xs text-ink2">{typeName(i.typeId)}</div>
                  {rec?.ans && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-ink2">내 답 :</span>
                      <b className={m === '정답' ? 'text-pine-dark' : 'text-clay'}>
                        {rec.ans.includes('$') ? <MathText text={rec.ans} /> : rec.ans}
                      </b>
                      {careless && rec.ans && (
                        <span className="text-[11px] text-ink2">→ 다시 <b className="text-pine-dark">정답</b></span>
                      )}
                    </div>
                  )}

                  {/* 틀린 문제 다시 풀기 (재채점) */}
                  {canRetry && retryOpen !== i.id && (
                    <button onClick={() => { setRetryOpen(i.id); setRetryAns('') }}
                      className="mt-0.5 w-fit rounded-lg border border-pine px-3 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft">
                      ✏️ 다시 풀기
                    </button>
                  )}
                  {canRetry && retryOpen === i.id && (
                    <div className="mt-0.5 grid gap-2 rounded-xl bg-paper2/50 p-2.5">
                      <span className="text-[11px] font-semibold text-ink2">다시 풀어서 답을 입력하세요 (맞히면 ‘실수’로 기록돼요)</span>
                      <WbAnswerInput item={i} value={retryAns} onChange={setRetryAns} />
                      <div className="flex gap-2">
                        <button onClick={() => regradeOne(i, retryAns)} disabled={retryAns === '' || retryAns === '모름'}
                          className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper disabled:opacity-40">채점</button>
                        <button onClick={() => { setRetryOpen(null); setRetryAns('') }}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:bg-white">취소</button>
                      </div>
                    </div>
                  )}
                  {/* 두 번 틀림 → 풀이 강의 다시보기 */}
                  {twiceWrong && (
                    <button onClick={() => nav('/student/lectures')}
                      className="mt-0.5 w-fit rounded-lg bg-clay px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
                      📹 풀이 강의 다시보기
                    </button>
                  )}

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
