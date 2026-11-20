import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { useStudentSelf } from './StudentShell'
import { usePreview, PREVIEW_LOCK_TITLE } from './common'
import VideoModal from '../../components/VideoModal'
import { defaultCurriculumForGrade, curriculumFor } from '../../data/curriculum'
import { hasLectures, loadLectures, LECTURE_COURSES, type Lecture, type LectureUnit } from '../../data/lectures'
import { assignsOf, watchKey, watchOf, type LecState } from '../../lib/lectureLog'
import { dateKey } from '../../lib/dates'

// ── 강의 탭 — 선생님이 낸 강의(상태 탭 + 표) + 전체공개가 켜져 있으면 과정별 강의 고르기 ──
// 시청 기록: 열면 «학습중», 끝까지 보면 «학습완료»(lib/lectureLog.ts — 선생님 시청 내역에 보인다)

const TABS = ['전체', '학습가능', '학습중', '학습완료'] as const
const STATE_CLS: Record<LecState, string> = {
  학습가능: 'bg-pine-soft text-pine-dark', 학습중: 'bg-amber-soft text-amber', 학습완료: 'bg-paper2 text-ink2',
}
const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

export default function StudentLectures() {
  const me = useStudentSelf()
  const pv = usePreview()
  const { lectureLog, setLectureLog, studentAppConfig } = useStore()
  const [tab, setTab] = useState<typeof TABS[number]>('전체')
  const [play, setPlay] = useState<{ course: string; L: Lecture } | null>(null)

  // 선생님이 낸 강의 + 과정별 강의 정보(제목·길이·단원)
  const assigns = useMemo(() => assignsOf(lectureLog, me.id), [lectureLog, me.id])
  const myCourse = useMemo(() => {
    const c = defaultCurriculumForGrade(me.grade)
    return hasLectures(c) ? c : LECTURE_COURSES.find(x => x === c) ?? null
  }, [me.grade])
  const [course, setCourse] = useState<string | null>(myCourse)
  const need = useMemo(() => [...new Set([...assigns.map(a => a.course), ...(course ? [course] : [])])], [assigns, course])
  const [units, setUnits] = useState<Record<string, LectureUnit[]>>({})
  useEffect(() => {
    let alive = true
    for (const c of need) {
      if (units[c]) continue
      loadLectures(c).then(u => { if (alive) setUnits(p => ({ ...p, [c]: u })) })
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need.join(',')])
  const find = (c: string, id: number) => {
    for (const u of units[c] ?? []) for (const ch of u.chapters) {
      const L = ch.lectures.find(x => x.id === id)
      if (L) return { L, unit: `${u.unit} · ${ch.name}` }
    }
    return null
  }

  const rows = assigns.map(a => ({ a, info: find(a.course, a.lectureId), w: watchOf(lectureLog, me.id, a.course, a.lectureId) }))
  const counts: Record<string, number> = { 전체: rows.length, 학습가능: 0, 학습중: 0, 학습완료: 0 }
  for (const r of rows) counts[r.w.state]++
  const shown = tab === '전체' ? rows : rows.filter(r => r.w.state === tab)

  function open(c: string, L: Lecture) {
    if (pv.on) return
    if (watchOf(lectureLog, me.id, c, L.id).state === '학습가능') setLectureLog({ [watchKey(me.id, c, L.id)]: `ing|${new Date().toISOString()}` })
    setPlay({ course: c, L })
  }
  const finish = () => { if (play) setLectureLog({ [watchKey(me.id, play.course, play.L.id)]: `done|${new Date().toISOString()}` }) }

  return (
    <div>
      <h1 className="mb-4 text-xl font-black">강의</h1>

      <div className="mb-4 flex gap-1.5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t} {counts[t]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink2">
              <th className="px-4 py-2.5">출제일</th>
              <th className="py-2.5">단원명</th>
              <th className="py-2.5">강의명</th>
              <th className="py-2.5">길이</th>
              <th className="py-2.5">상태</th>
              <th className="py-2.5 pr-4">학습하기</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink2">
                  {rows.length === 0 ? '선생님이 낸 강의가 아직 없어요.' : '이 상태의 강의가 없어요.'}
                </td>
              </tr>
            )}
            {shown.map(({ a, info, w }) => (
              <tr key={`${a.course}-${a.lectureId}`} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 tabular-nums text-ink2">{dateKey(a.at).slice(2).replace(/-/g, '.')}</td>
                <td className="py-3 text-ink2">{info?.unit ?? curriculumFor(a.course).label}</td>
                <td className="py-3 font-semibold">{info?.L.title ?? a.title}</td>
                <td className="py-3 tabular-nums text-ink2">{info ? fmtDur(info.L.seconds) : '—'}</td>
                <td className="py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATE_CLS[w.state]}`}>{w.state}</span></td>
                <td className="py-3 pr-4">
                  <button disabled={!info || pv.on} title={pv.on ? PREVIEW_LOCK_TITLE : undefined} onClick={() => info && open(a.course, info.L)}
                    className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper hover:brightness-110 disabled:opacity-40">
                    {w.state === '학습완료' ? '다시 보기' : w.state === '학습중' ? '이어 보기' : '학습하기'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 전체공개 — 과정별 강의를 스스로 골라 본다 */}
      {studentAppConfig.lectureOpen && (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-base font-black">강의 골라 보기</h2>
            <select value={course ?? ''} onChange={e => setCourse(e.target.value || null)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm font-semibold">
              {LECTURE_COURSES.map(c => <option key={c} value={c}>{curriculumFor(c).label}</option>)}
            </select>
          </div>
          {!course || !units[course] ? (
            <div className="rounded-2xl border border-line bg-white py-10 text-center text-sm text-ink2">불러오는 중…</div>
          ) : units[course].length === 0 ? (
            <div className="rounded-2xl border border-line bg-white py-10 text-center text-sm text-ink2">이 과정에는 강의가 없어요.</div>
          ) : (
            <div className="space-y-3">
              {units[course].map((u, ui) => (
                <details key={ui} open={ui === 0} className="overflow-hidden rounded-2xl border border-line bg-white">
                  <summary className="cursor-pointer bg-paper2 px-4 py-3 text-sm font-bold">
                    {u.unit} <span className="font-normal text-ink2">· {u.chapters.reduce((n, c) => n + c.lectures.length, 0)}강</span>
                  </summary>
                  <div className="divide-y divide-line/60">
                    {u.chapters.map((ch, ci) => (
                      <div key={ci} className="px-4 py-2">
                        <div className="my-1 text-xs font-bold text-ink2">{ch.name}</div>
                        <ul>
                          {ch.lectures.map(L => {
                            const st = watchOf(lectureLog, me.id, course, L.id).state
                            return (
                              <li key={L.id}>
                                <button disabled={pv.on} onClick={() => open(course, L)}
                                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-pine-soft/40 disabled:opacity-60">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine text-xs text-white">▶</span>
                                  <span className="min-w-0 grow truncate text-sm">{L.title}</span>
                                  {st !== '학습가능' && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_CLS[st]}`}>{st}</span>}
                                  <span className="shrink-0 text-xs tabular-nums text-ink2">{fmtDur(L.seconds)}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {play && (
        <VideoModal badge="개념강의" title={play.L.title} src={play.L.videoUrl} onEnded={finish} onClose={() => setPlay(null)} />
      )}
    </div>
  )
}
