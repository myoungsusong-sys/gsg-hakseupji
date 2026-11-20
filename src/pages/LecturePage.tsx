import { useEffect, useMemo, useState } from 'react'
import GradeSelect from '../components/GradeSelect'
import VideoModal from '../components/VideoModal'
import { curriculumFor } from '../data/curriculum'
import { loadLectures, hasLectures, LECTURE_COURSES, type Lecture, type LectureUnit } from '../data/lectures'
import { loadLecNotes, type LecNoteMap } from '../data/lecnotes'
import LectureNoteModal, { getLecScore } from '../components/LectureNoteModal'
import { useStore } from '../lib/store'
import { assignKey, assignsOf, watchOf } from '../lib/lectureLog'
import { dateKey } from '../lib/dates'

// 개념강의 — 매쓰플랫 강의 목록(강 단위) 그대로. 과정 선택 → 대단원/중단원별 강의 → 영상 재생(HLS)
// 초1·2, 중3-2(22개정)은 매쓰플랫에 개념강의가 없음(강의 있는 과정만 선택지에 노출)

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// 강의 있는 첫 과정을 기본값으로
const DEFAULT_COURSE = LECTURE_COURSES.includes('m1-1') ? 'm1-1' : LECTURE_COURSES[0]

export default function LecturePage() {
  const [courseId, setCourseId] = useState<string>(DEFAULT_COURSE)
  const [units, setUnits] = useState<LectureUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [play, setPlay] = useState<Lecture | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<LecNoteMap>({})
  // 노트 창 — 어느 버튼으로 열었는지(정리노트/빈칸)까지 함께 들고 있는다
  const [noteOf, setNoteOf] = useState<{ L: Lecture; tab: 'note' | 'blank' } | null>(null)
  // 학생에게 강의 내기 · 학생앱 전체공개 · 시청 내역
  const { students, lectureLog, setLectureLog, studentAppConfig, setStudentAppConfig } = useStore()
  const active = useMemo(() => students.filter(s => s.active), [students])
  const [assignOf, setAssignOf] = useState<Lecture | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [logOpen, setLogOpen] = useState(false)
  const allAssigns = useMemo(() => assignsOf(lectureLog), [lectureLog])
  const assignedCount = (id: number) => allAssigns.filter(a => a.course === courseId && a.lectureId === id).length
  function openAssign(L: Lecture) {
    setPicked(new Set(allAssigns.filter(a => a.course === courseId && a.lectureId === L.id).map(a => a.studentId)))
    setAssignOf(L)
  }
  function saveAssign() {
    if (!assignOf) return
    const had = new Set(allAssigns.filter(a => a.course === courseId && a.lectureId === assignOf.id).map(a => a.studentId))
    const now = new Date().toISOString()
    const entries: Record<string, string | null> = {}
    for (const s of active) {
      const k = assignKey(s.id, courseId, assignOf.id)
      if (picked.has(s.id) && !had.has(s.id)) entries[k] = `${now}|${assignOf.title}`
      if (!picked.has(s.id) && had.has(s.id)) entries[k] = null       // 출제 취소
    }
    if (Object.keys(entries).length) setLectureLog(entries)
    setAssignOf(null)
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadLectures(courseId).then(u => { if (alive) { setUnits(u); setLoading(false); setOpen({}) } })
    loadLecNotes(courseId).then(n => { if (alive) setNotes(n) })
    return () => { alive = false }
  }, [courseId])

  const total = useMemo(() => units.reduce((n, u) => n + u.chapters.reduce((m, c) => m + c.lectures.length, 0), 0), [units])
  const courseLabel = curriculumFor(courseId).label

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black">강의</h1>
        <span className="rounded bg-clay px-1.5 py-0.5 text-[10px] font-bold text-white">개념강의</span>
        <div className="grow" />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold"
          title="켜면 학생이 학생앱 강의 탭에서 강의를 스스로 골라 볼 수 있어요. 끄면 선생님이 낸 강의만 보여요.">
          <input type="checkbox" className="h-4 w-4 accent-pine" checked={!!studentAppConfig.lectureOpen}
            onChange={e => setStudentAppConfig({ ...studentAppConfig, lectureOpen: e.target.checked })} />
          학생앱 강의 전체공개
        </label>
        <button onClick={() => setLogOpen(v => !v)}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-paper2">
          시청 내역 {allAssigns.length > 0 && <span className="text-pine">{allAssigns.length}</span>}
        </button>
        <GradeSelect value={courseId} onChange={setCourseId} />
      </div>

      {logOpen && (
        <div className="mb-4 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-ink2">
              <th className="px-4 py-2.5">출제일</th><th className="py-2.5">학생</th><th className="py-2.5">과정</th><th className="py-2.5">강의명</th><th className="py-2.5">상태</th><th className="py-2.5 pr-4">본 날</th>
            </tr></thead>
            <tbody>
              {allAssigns.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink2">아직 학생에게 낸 강의가 없어요. 강의 줄의 [출제]를 눌러 보세요.</td></tr>}
              {allAssigns.map(a => {
                const st = students.find(x => x.id === a.studentId)
                const w = watchOf(lectureLog, a.studentId, a.course, a.lectureId)
                return (
                  <tr key={`${a.studentId}-${a.course}-${a.lectureId}`} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2 tabular-nums text-ink2">{dateKey(a.at).slice(2).replace(/-/g, '.')}</td>
                    <td className="py-2 font-semibold">{st?.name ?? '(지워진 학생)'}</td>
                    <td className="py-2 text-ink2">{curriculumFor(a.course).label}</td>
                    <td className="py-2">{a.title}</td>
                    <td className="py-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${w.state === '학습완료' ? 'bg-pine-soft text-pine-dark' : w.state === '학습중' ? 'bg-amber-soft text-amber' : 'bg-paper2 text-ink2'}`}>{w.state === '학습가능' ? '안 봄' : w.state === '학습중' ? '보는 중' : '다 봄'}</span></td>
                    <td className="py-2 pr-4 tabular-nums text-ink2">{w.at ? dateKey(w.at).slice(2).replace(/-/g, '.') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mb-3 text-sm text-ink2">
        <b className="text-ink">{courseLabel}</b> · 총 <b className="text-pine">{total}</b>강
        <span className="ml-2 text-xs text-ink2/70">강의명을 눌러 영상을 재생하세요.</span>
      </p>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white py-16 text-center text-sm text-ink2">불러오는 중…</div>
      ) : !hasLectures(courseId) || total === 0 ? (
        <div className="rounded-2xl border border-line bg-white py-16 text-center text-sm text-ink2">
          이 과정은 개념강의가 없습니다.
          <div className="mt-1.5 text-xs text-ink2/70">초등 1·2학년, 중3-2(22개정) 등은 개념강의가 제공되지 않습니다.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map((u, ui) => {
            const uid = `u${ui}`
            const isOpen = open[uid] ?? true
            const count = u.chapters.reduce((m, c) => m + c.lectures.length, 0)
            return (
              <div key={uid} className="overflow-hidden rounded-2xl border border-line bg-white">
                <button onClick={() => setOpen(o => ({ ...o, [uid]: !isOpen }))}
                  className="flex w-full items-center gap-2 bg-paper2 px-4 py-3 text-left hover:bg-paper">
                  <span className="text-ink2">{isOpen ? '▾' : '▸'}</span>
                  <b className="text-sm">{u.unit}</b>
                  <span className="text-xs text-ink2">· {count}강</span>
                </button>
                {isOpen && (
                  <div className="divide-y divide-line/60">
                    {u.chapters.map((c, ci) => (
                      <div key={ci} className="px-4 py-2">
                        <div className="mb-1 mt-1 text-xs font-bold text-ink2">{c.name}</div>
                        <ul>
                          {c.lectures.map(L => (
                            <li key={L.id} className="flex items-center gap-1">
                              <button onClick={() => setPlay(L)}
                                className="group flex min-w-0 grow items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-pine-soft/40">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine text-xs text-white group-hover:bg-pine-dark">▶</span>
                                <span className="min-w-0 grow truncate text-sm">{L.title}</span>
                                <span className="shrink-0 text-xs tabular-nums text-ink2">{fmtDur(L.seconds)}</span>
                              </button>
                              <button onClick={() => openAssign(L)} title="이 강의를 학생에게 냅니다(학생앱 강의 탭에 뜹니다)"
                                className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-xs font-bold hover:border-pine hover:bg-pine-soft/40">
                                출제{assignedCount(L.id) > 0 && <span className="ml-1 text-pine">{assignedCount(L.id)}명</span>}
                              </button>
                              {notes[String(L.id)] && (() => {
                                const nt = notes[String(L.id)]
                                const sc = getLecScore(L.id)
                                return (
                                  <>
                                    <button onClick={() => setNoteOf({ L, tab: 'note' })} title="정리노트 · 이해 확인"
                                      className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-xs font-bold hover:border-pine hover:bg-pine-soft/40">
                                      📝 노트
                                      {sc && <span className={`ml-1 ${sc.best === sc.total ? 'text-pine-dark' : 'text-ink2'}`}>{sc.best}/{sc.total}</span>}
                                    </button>
                                    {nt.blank && nt.blank.length > 0 && (
                                      <button onClick={() => setNoteOf({ L, tab: 'blank' })} title="개념 빈칸 테스트 (인쇄 가능)"
                                        className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-xs font-bold hover:border-note-accent hover:bg-note-pink/40">
                                        ✍️ 빈칸
                                      </button>
                                    )}
                                  </>
                                )
                              })()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {play && (
        <VideoModal badge="개념강의" title={play.title} src={play.videoUrl} onClose={() => setPlay(null)} />
      )}

      {assignOf && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={() => setAssignOf(null)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold">강의 출제</h3>
            <p className="mt-1 text-sm text-ink2">{assignOf.title}</p>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <button onClick={() => setPicked(new Set(active.map(s => s.id)))} className="font-bold text-pine">모두 고르기</button>
              <button onClick={() => setPicked(new Set())} className="text-ink2">모두 풀기</button>
              <span className="ml-auto text-ink2">{picked.size}명</span>
            </div>
            <ul className="mt-2 divide-y divide-line/60 rounded-xl border border-line">
              {active.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink2">재원생이 없어요. 관리에서 학생을 먼저 등록해 주세요.</li>}
              {active.map(s => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-paper2">
                    <input type="checkbox" className="h-4 w-4 accent-pine" checked={picked.has(s.id)}
                      onChange={e => setPicked(p => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n })} />
                    <b>{s.name}</b><span className="text-xs text-ink2">{s.grade}{s.klass ? ` · ${s.klass}` : ''}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink2">체크를 풀고 저장하면 그 학생의 출제가 취소됩니다.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAssignOf(null)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">닫기</button>
              <button onClick={saveAssign} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper">저장</button>
            </div>
          </div>
        </div>
      )}

      {noteOf && notes[String(noteOf.L.id)] && (
        <LectureNoteModal lecId={noteOf.L.id} note={notes[String(noteOf.L.id)]} initialTab={noteOf.tab}
          onClose={() => setNoteOf(null)}
          onPlay={() => { const L = noteOf.L; setNoteOf(null); setPlay(L) }} />
      )}
    </div>
  )
}
