import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { findUnit, tellHost } from '../../lib/unitScope'
import { hasLectures, loadLectures, type Lecture, type LectureUnit } from '../../data/lectures'
import { conceptsForSubUnits } from '../../data/concepts'
import { useConceptVideos, ConceptVideoButton } from '../../components/student/ConceptVideo'
import VideoModal from '../../components/VideoModal'
import MathText from '../../components/MathText'

/**
 * 📺 오늘 단원 개념학습 (2026-10-19 명수쌤 "학교에서 배운 단원 → 이론강의부터 → 승강제로 심화까지")
 *
 * 관리앱 학생앱 [📺 개념강의 · 강의 보기] 로 들어온다 (`#/student/unit?unit=<단원id>`).
 *   ① 개념강의 영상 — 그 단원(대·중단원 이름)으로 강의 목록을 찾아 보여 준다. 소단원 이름과 맞는 강의는 ⭐ 로 앞에.
 *   ② 개념 정리 — 소단원 개념카드 + 개념 영상(있으면)
 *   ③ [개념 다 봤어요 → 승강제 문제풀이] — 관리앱 칸을 ✓ 하고 그 단원 승강제로 바로 간다.
 * 강의가 없는 과목(과학·영어 등)은 개념 정리만으로 넘어간다.
 */

const norm = (s: string) => s.replace(/\s|\[\d+강\]/g, '')

function matchLectures(units: LectureUnit[], big: string, mid: string, sub: string): { lec: Lecture; star: boolean }[] {
  if (!units.length) return []
  const b = norm(big), m = norm(mid), s = norm(sub)
  const u = units.find(x => norm(x.unit) === b) ?? units.find(x => norm(x.unit).includes(b) || b.includes(norm(x.unit)))
  if (!u) return []
  const ch = m ? (u.chapters.find(c => norm(c.name) === m) ?? u.chapters.find(c => norm(c.name).includes(m) || m.includes(norm(c.name)))) : undefined
  const list = ch ? ch.lectures : u.chapters.flatMap(c => c.lectures)
  const out = list.map(lec => {
    const t = norm(lec.title)
    return { lec, star: !!s && (t.includes(s) || s.includes(t) || (s.length >= 4 && t.includes(s.slice(0, 4)))) }
  })
  return [...out.filter(x => x.star), ...out.filter(x => !x.star)]
}

export default function StudentUnit() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const unit = useMemo(() => findUnit(params.get('unit')), [params])
  const [lecUnits, setLecUnits] = useState<LectureUnit[] | null>(null)
  const [video, setVideo] = useState<{ src: string; title: string } | null>(null)
  const [seen, setSeen] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (!unit) return
    let alive = true
    const c = unit.course.id
    if (!hasLectures(c)) { setLecUnits([]); return }
    loadLectures(c).then(u => { if (alive) setLecUnits(u) })
    return () => { alive = false }
  }, [unit])

  const lectures = useMemo(
    () => (unit && lecUnits ? matchLectures(lecUnits, unit.bigName, unit.midName, unit.subName) : []),
    [unit, lecUnits],
  )
  const concepts = useMemo(() => (unit ? conceptsForSubUnits(new Set(unit.subIds)) : []), [unit])
  // 개념영상 — 단원 id(고른 층) · 그 아래 소단원 개념카드 id 순으로 있는 것 전부
  const cvideos = useConceptVideos(unit ? [unit.id, ...unit.subIds, ...unit.subIds.map(id => `c-${id}`), ...concepts.map(c => c.id)] : [])

  if (!unit) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-sm text-ink2">
        단원을 찾지 못했어요. 관리앱에서 오늘 단원을 다시 골라 주세요.
      </div>
    )
  }

  const finish = () => {
    tellHost({ step: 'concept', unit: unit.id, done: 1, total: 1, complete: true })
    nav(`/student/mastery?unit=${encodeURIComponent(unit.id)}`)
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <p className="text-xs font-bold text-pine-dark">📺 오늘 단원 개념학습 · {unit.course.label}</p>
      <h1 className="mt-1 text-lg font-black text-ink">{unit.name}</h1>
      <p className="text-xs text-ink2">{unit.path}</p>

      {/* ① 개념강의 */}
      <section className="mt-4 rounded-2xl border border-line bg-white p-4">
        <h2 className="text-sm font-black text-ink">① 개념강의</h2>
        {lecUnits === null ? (
          <p className="mt-2 text-sm text-ink2">강의를 찾는 중…</p>
        ) : lectures.length ? (
          <>
            <p className="mt-1 text-xs text-ink2">⭐ 표시가 오늘 단원과 딱 맞는 강의예요. 먼저 보고 나머지는 필요하면 보세요.</p>
            <div className="mt-2 divide-y divide-line">
              {lectures.map(({ lec, star }) => (
                <button key={lec.id} type="button"
                  onClick={() => { setVideo({ src: lec.videoUrl, title: lec.title }); setSeen(s => new Set(s).add(lec.id)) }}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-pine-soft/40">
                  <span className="w-5 shrink-0 text-center">{seen.has(lec.id) ? '✅' : star ? '⭐' : '▶'}</span>
                  <span className={`min-w-0 grow truncate text-sm ${star ? 'font-bold text-ink' : 'text-ink2'}`}>{lec.title}</span>
                  <span className="shrink-0 text-xs text-ink2">{Math.floor(lec.seconds / 60)}:{String(lec.seconds % 60).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink2">이 단원은 아직 강의 영상이 없어요 — 아래 개념 정리로 공부하고 넘어가요.</p>
        )}
      </section>

      {/* ② 개념 정리 */}
      <section className="mt-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-ink">② 개념 정리</h2>
        </div>
        {cvideos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {cvideos.map(v => (
              <ConceptVideoButton key={v.key} video={v} label={cvideos.length > 1 ? (v.title ?? '개념 영상') : '개념 영상 보기'}
                className="rounded-lg border border-pine bg-white px-2.5 py-1.5 text-xs font-bold text-pine hover:bg-pine-soft" />
            ))}
          </div>
        )}
        {concepts.length ? (
          <div className="mt-2 space-y-3">
            {concepts.map(c => (
              <div key={c.id} className="rounded-xl bg-paper2 p-3">
                <p className="text-sm font-bold text-ink">{c.title}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
                  {c.lines.map((l, i) => <li key={i}><MathText text={l} /></li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink2">이 단원은 개념 정리가 아직 없어요. 승강제 첫 단계에서 개념을 확인해요.</p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 backdrop-blur">
        <button type="button" onClick={finish}
          className="mx-auto block w-full max-w-3xl rounded-xl bg-pine py-3 text-base font-black text-paper">
          ✓ 개념 다 봤어요 → 승강제 문제풀이 시작
        </button>
      </div>

      {video && <VideoModal src={video.src} title={video.title} badge="개념강의" onClose={() => setVideo(null)} />}
    </div>
  )
}
