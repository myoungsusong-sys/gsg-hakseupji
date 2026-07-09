import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { dateKey } from '../../lib/dates'
import SupplementInfoModal from '../../components/student/SupplementInfoModal'
import { useStudentSelf } from './StudentShell'
import { useSupplement, SUPPLEMENT_RULE_MSG, WRONG_DONE_MSG, ONE_CLICK_OFF_MSG } from './supplement'
import {
  latestGradingFor, myWorksheetRows, statusOf, summaryOf, usePreview, PREVIEW_LOCK_TITLE,
  STATUS_CLASS, type StudentWsStatus,
} from './common'

const TABS = ['전체', '학습가능', '풀이중', '학습완료'] as const

// ── 학습지 탭 (매쓰플랫 학생앱 학습지 탭 구조) ──────────────────
// 기간 필터(📅 기본 최근 1개월) + 숙제만 보기 토글 + 상태 탭
// 표(아이콘|출제일|상태|학습지명(N문제)|결과|보충학습 ⓘ [오답학습][심화학습])
export default function StudentWorksheets() {
  const me = useStudentSelf()
  const { assignments, worksheets, gradings } = useStore()
  const nav = useNavigate()
  const supplement = useSupplement(me)
  const pv = usePreview()
  const [tab, setTab] = useState<typeof TABS[number]>('전체')
  const [homeworkOnly, setHomeworkOnly] = useState(false)
  const [info, setInfo] = useState(false)

  // 기간 필터 — 기본 최근 1개월 (매쓰플랫 동일)
  const [from, setFrom] = useState(() => dateKey(new Date(Date.now() - 30 * 864e5)))
  const [to, setTo] = useState(() => dateKey(new Date()))

  const rows = useMemo(() => {
    return myWorksheetRows(assignments, worksheets, me.id)
      .filter(r => {
        const d = dateKey(r.date)
        if (from && d < from) return false
        if (to && d > to) return false
        if (homeworkOnly && !r.kinds.includes('숙제')) return false
        return true
      })
      .map(r => {
        const g = latestGradingFor(gradings, me.id, r.ws.id)
        return { ...r, g, st: statusOf(r.ws.id, g) as StudentWsStatus }
      })
  }, [assignments, worksheets, gradings, me.id, from, to, homeworkOnly])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: rows.length, 학습가능: 0, 풀이중: 0, 학습완료: 0 }
    for (const r of rows) c[r.st]++
    return c
  }, [rows])

  const shown = tab === '전체' ? rows : rows.filter(r => r.st === tab)

  // 진행 중(미완료) 보충학습 — 있으면 그 종류 신규 생성 불가 (원본 규칙)
  const pendingWrong = supplement.pendingOf('오답학습')
  const pendingDeep = supplement.pendingOf('심화학습')

  return (
    <div>
      <h1 className="mb-4 text-xl font-black">학습지</h1>

      {/* 기간 필터 + 숙제만 보기 */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5">
          <span>📅</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-transparent text-sm font-semibold" />
          <span className="text-ink2">~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-transparent text-sm font-semibold" />
        </div>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={homeworkOnly} onChange={e => setHomeworkOnly(e.target.checked)}
            className="h-4 w-4 accent-pine" />
          숙제만 보기
        </label>
      </div>

      {/* 상태 탭 */}
      <div className="mb-4 flex gap-1.5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t} {counts[t]}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
          {rows.length === 0 ? '학습지가 없습니다. (기간·필터를 확인해보세요)' : '해당 상태의 학습지가 없어요.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="w-10 px-3 py-2.5" />
                <th className="py-2.5">출제일</th>
                <th className="py-2.5">상태</th>
                <th className="py-2.5">학습지명</th>
                <th className="py-2.5">결과</th>
                <th className="py-2.5 pr-4">
                  보충학습{' '}
                  <button onClick={() => setInfo(true)} title="오답학습과 심화학습에 대해 알려드려요"
                    className="rounded-full px-1 font-bold text-pine hover:bg-pine-soft">ⓘ</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ ws, date, g, st, kinds }) => {
                const sum = g ? summaryOf(ws, g) : null
                const wrongCount = g ? g.results.filter(r => !r.correct).length : 0
                const done = st === '학습완료' && !!g
                const wrongBlocked = pendingWrong && pendingWrong.id !== ws.id
                const deepBlocked = pendingDeep && pendingDeep.id !== ws.id
                return (
                  <tr key={ws.id} className="border-b border-line/50 last:border-0">
                    <td className="px-3 py-3 text-center text-base">📄</td>
                    <td className="py-3 whitespace-nowrap text-ink2">{dateKey(date).slice(2).replace(/-/g, '.')}</td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[st]}`}>{st}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <button onClick={() => nav(done ? `/student/result/${ws.id}` : `/student/solve/${ws.id}`)}
                        disabled={pv.on} title={pv.on ? PREVIEW_LOCK_TITLE : undefined}
                        className="text-left font-bold hover:text-pine hover:underline disabled:cursor-default disabled:hover:text-ink disabled:hover:no-underline">
                        {ws.title}
                      </button>
                      <div className="mt-0.5 text-xs text-pine">
                        {ws.problemIds.length}문제{kinds.includes('숙제') && <span className="ml-1.5 rounded bg-amber-soft px-1 py-0.5 text-[10px] font-bold text-amber">숙제</span>}
                      </div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {done && sum ? (
                        <button onClick={() => nav(`/student/result/${ws.id}`)}
                          disabled={pv.on} title={pv.on ? PREVIEW_LOCK_TITLE : undefined}
                          className="rounded-lg border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft disabled:cursor-default disabled:hover:bg-transparent">
                          {sum.score}점 <span className="ml-1 font-semibold text-clay">✕ {sum.wrong}개</span> <span className="font-semibold text-pine-dark">○ {sum.correct}개</span>
                        </button>
                      ) : (
                        <button onClick={() => nav(`/student/solve/${ws.id}`)}
                          disabled={pv.on} title={pv.on ? PREVIEW_LOCK_TITLE : undefined}
                          className="rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper hover:brightness-110 disabled:opacity-40">
                          {st === '풀이중' ? '이어서 풀기' : '풀기'}
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {done && g ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => supplement.create('오답학습', ws, g)}
                            disabled={wrongCount === 0 || pv.on || !!wrongBlocked || !supplement.allowed}
                            title={pv.on ? PREVIEW_LOCK_TITLE
                              : !supplement.allowed ? ONE_CLICK_OFF_MSG
                              : wrongBlocked ? `${SUPPLEMENT_RULE_MSG} (진행 중: ${pendingWrong!.title})`
                              : wrongCount === 0 ? WRONG_DONE_MSG
                              : '틀린 유형을 틀리지 않을 때까지 반복해서 공부해요'}
                            className="rounded-lg border border-clay/60 px-2.5 py-1 text-xs font-bold text-clay hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
                            ◎ 오답학습
                          </button>
                          <button onClick={() => supplement.create('심화학습', ws, g)}
                            disabled={pv.on || !!deepBlocked || !supplement.allowed}
                            title={pv.on ? PREVIEW_LOCK_TITLE
                              : !supplement.allowed ? ONE_CLICK_OFF_MSG
                              : deepBlocked ? `${SUPPLEMENT_RULE_MSG} (진행 중: ${pendingDeep!.title})`
                              : '맞힌 문제의 유형을 한 단계 높은 난이도로 연습해요'}
                            className="rounded-lg border border-pine/60 px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft disabled:opacity-30 disabled:hover:bg-transparent">
                            📊 심화학습
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-ink2/50">학습 완료 후 가능</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {info && <SupplementInfoModal onClose={() => setInfo(false)} />}
    </div>
  )
}
