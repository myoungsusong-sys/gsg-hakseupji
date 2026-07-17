import { useEffect, useMemo, useState } from 'react'
import GradeSelect from '../components/GradeSelect'
import VideoModal from '../components/VideoModal'
import { curriculumFor } from '../data/curriculum'
import { loadLectures, hasLectures, LECTURE_COURSES, type Lecture, type LectureUnit } from '../data/lectures'
import { loadLecNotes, type LecNoteMap } from '../data/lecnotes'
import LectureNoteModal, { getLecScore } from '../components/LectureNoteModal'

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
        <GradeSelect value={courseId} onChange={setCourseId} />
      </div>

      <p className="mb-3 text-sm text-ink2">
        <b className="text-ink">{courseLabel}</b> · 총 <b className="text-pine">{total}</b>강
        <span className="ml-2 text-xs text-ink2/70">강의명을 눌러 영상을 재생하세요.</span>
      </p>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white py-16 text-center text-sm text-ink2">불러오는 중…</div>
      ) : !hasLectures(courseId) || total === 0 ? (
        <div className="rounded-2xl border border-line bg-white py-16 text-center text-sm text-ink2">
          이 과정은 개념강의가 없습니다.
          <div className="mt-1.5 text-xs text-ink2/70">초등 1·2학년, 중3-2(22개정) 등은 매쓰플랫에 개념강의가 제공되지 않습니다.</div>
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

      {noteOf && notes[String(noteOf.L.id)] && (
        <LectureNoteModal lecId={noteOf.L.id} note={notes[String(noteOf.L.id)]} initialTab={noteOf.tab}
          onClose={() => setNoteOf(null)}
          onPlay={() => { const L = noteOf.L; setNoteOf(null); setPlay(L) }} />
      )}
    </div>
  )
}
