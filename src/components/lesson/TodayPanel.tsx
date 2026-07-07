import { useMemo, useState } from 'react'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { pickProblems } from '../../lib/select'
import { pickDrillProblems, weakTypes, wrongByType } from '../../lib/drill'
import { CURRICULA, curriculumFor } from '../../data/curriculum'
import { DEFAULT_SHEET_OPTIONS, DIFFS, DIFF_LABEL } from '../../types'
import type { DailyConfig, Diff, Student } from '../../types'

const COUNT_PRESETS = [10, 15, 20, 25]
const KIND_OPTIONS: { value: DailyConfig['kind']; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '객관식', label: '객관식' },
  { value: '주관식', label: '주관식' },
]

// 매쓰플랫 수업>오늘의 학습 동일 구조: 설정 → 매일 1클릭 자동 출제 → 날짜별 기록
export default function TodayPanel({ student }: { student: Student }) {
  const { dailyConfigs, setDailyConfig, problems, gradings, wbItems, worksheets, assignments, saveWorksheet, addAssignment, diffMatrix } = useStore()
  const cfg = dailyConfigs[student.id]
  const [editing, setEditing] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  // 오늘 이미 '오늘의 학습' 학습지가 출제됐는지
  const todayIssued = useMemo(() => {
    const t = todayKey()
    for (const a of assignments) {
      if (a.studentId !== student.id || dateKey(a.date) !== t) continue
      const w = worksheets.find(x => x.id === a.worksheetId)
      if (w && !w.deletedAt && w.tags.includes('오늘의 학습')) return w
    }
    return null
  }, [assignments, worksheets, student.id])

  // 최근 14일 중 기록 있는 날 (최신순)
  const historyRows = useMemo(() => {
    const rows: { day: string; titles: string[]; issued: number; solved: number; score: number | null }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const day = dateKey(d)
      const dayAs = assignments.filter(a => a.studentId === student.id && dateKey(a.date) === day)
      if (dayAs.length === 0) continue
      const titles: string[] = []
      let solved = 0
      let scoreSum = 0
      let scoreN = 0
      for (const a of dayAs) {
        const w = worksheets.find(x => x.id === a.worksheetId)
        titles.push(w?.title ?? '삭제된 학습지')
        const g = gradings.find(x => x.studentId === student.id && x.worksheetId === a.worksheetId)
        if (g) {
          solved++
          if (g.results.length) {
            scoreSum += (g.results.filter(r => r.correct).length / g.results.length) * 100
            scoreN++
          }
        }
      }
      rows.push({ day, titles, issued: dayAs.length, solved, score: scoreN ? Math.round(scoreSum / scoreN) : null })
    }
    // 증감: 직전(더 오래된) 기록 대비
    return rows.map((r, i) => {
      const prev = rows.slice(i + 1).find(x => x.score !== null)
      const delta = r.score !== null && prev && prev.score !== null ? r.score - prev.score : null
      return { ...r, delta }
    })
  }, [assignments, worksheets, gradings, student.id])

  // 설정 요약
  const summary = useMemo(() => {
    if (!cfg) return null
    const cur = curriculumFor(cfg.courseId)
    const unitNames = cfg.unitIds.length
      ? cur.units.filter(u => cfg.unitIds.includes(u.id)).map(u => u.name).join(', ')
      : '전체 단원'
    return { cur, unitNames }
  }, [cfg])

  function issue() {
    if (!cfg) return
    const cur = curriculumFor(cfg.courseId)
    const units = cfg.unitIds.length ? cur.units.filter(u => cfg.unitIds.includes(u.id)) : cur.units
    const typeOrder = units.flatMap(u => u.mids.flatMap(m => m.subs.flatMap(s => s.types.map(t => t.id))))
    const typeSet = new Set(typeOrder)
    const pool = problems.filter(p => typeSet.has(p.typeId))
    let picked = pickProblems(pool, cfg.count, cfg.diff, cfg.kind, typeOrder, diffMatrix)
    if (picked.length === 0) {
      alert('선택한 범위·조건에 맞는 문제가 문제은행에 없습니다. 범위나 문제 형태를 조정해 주세요.')
      return
    }
    if (cfg.review) {
      // 최근 7일 오답 유형 상위 → 1/3을 오답 복습 문제로 교체 믹스
      const cut = new Date()
      cut.setDate(cut.getDate() - 6)
      const cutoff = dateKey(cut)
      const recent = gradings.filter(g => dateKey(g.date) >= cutoff)
      const weak = weakTypes(wrongByType(student.id, recent, wbItems))
      if (weak.length) {
        const drill = pickDrillProblems(
          weak.map(w => ({ typeId: w.typeId })),
          problems,
          { twinPer: 1, similarPer: 1, diffShift: 0, typeCap: 2, excludeIds: new Set(picked.map(p => p.id)) },
        )
        const n = Math.min(Math.floor(cfg.count / 3), drill.length)
        if (n > 0) picked = [...picked.slice(0, Math.max(0, picked.length - n)), ...drill.slice(0, n)]
      }
    }
    const now = new Date()
    const id = uid('ws')
    const title = `오늘의 학습 - ${student.name} (${now.getMonth() + 1}.${now.getDate()})`
    saveWorksheet({
      id,
      title,
      author: '깊은생각수학',
      grade: student.grade,
      tags: ['오늘의 학습', '일일 TEST'],
      theme: 'amber',
      problemIds: picked.map(p => p.id),
      conceptIds: [],
      options: DEFAULT_SHEET_OPTIONS,
      listIds: [],
      createdAt: now.toISOString(),
      deletedAt: null,
    })
    addAssignment(id, [student.id], '수업')
    setBanner(title)
  }

  return (
    <div>
      {banner && (
        <div className="mb-5 rounded-xl bg-pine-soft/60 p-4 text-sm">
          ✅ <b>{banner}</b> 출제 완료 — <b>수업 &gt; 학습지</b> 탭에서 채점하세요.
        </div>
      )}

      {!cfg ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center">
          <div className="mb-2 text-3xl">📤</div>
          <p className="mb-4 text-sm text-ink2">범위·문제 수·난이도를 설정하면 매일 1클릭으로 맞춤 학습지가 나갑니다.</p>
          <button onClick={() => setEditing(true)} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-105">
            ⚙ 설정하기
          </button>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm">
              <b className="text-pine-dark">{summary?.cur.label}</b>
              <span className="mx-1.5 text-ink2">·</span>{summary?.unitNames}
              <span className="mx-1.5 text-ink2">·</span><b>{cfg.count}문제</b>
              <span className="mx-1.5 text-ink2">·</span>난이도 <b>{DIFF_LABEL[cfg.diff]}</b>
              <span className="mx-1.5 text-ink2">·</span>{cfg.kind === 'all' ? '전체' : cfg.kind}
              <span className="mx-1.5 text-ink2">·</span>오답 복습 <b className={cfg.review ? 'text-pine' : 'text-ink2'}>{cfg.review ? 'ON' : 'OFF'}</b>
            </div>
            <div className="grow" />
            <button onClick={() => setEditing(true)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink2 hover:text-ink">
              ⚙ 수정
            </button>
            {todayIssued ? (
              <span className="rounded-lg bg-pine-soft px-4 py-2 text-sm font-bold text-pine-dark">
                오늘 출제됨 ✓ <span className="font-semibold">{todayIssued.title}</span>
              </span>
            ) : (
              <button onClick={issue} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-105">
                📤 오늘 학습지 자동 출제
              </button>
            )}
          </div>
        </div>
      )}

      {/* 날짜별 기록 (최근 14일) */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-3 text-sm font-black">날짜별 기록 <span className="font-normal text-ink2">— 최근 14일</span></div>
        {historyRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink2">최근 14일 안에 출제 기록이 없습니다. 자동 출제하면 여기 쌓입니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink2">
                <th className="py-1.5">날짜</th><th>출제 학습지</th><th>푼/출제</th><th>점수</th><th>증감</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map(r => (
                <tr key={r.day} className="border-b border-line/50">
                  <td className="py-2 font-semibold">{r.day === todayKey() ? '오늘' : r.day.slice(5).replace('-', '.')}</td>
                  <td className="py-2 pr-2">{r.titles.join(', ')}</td>
                  <td className="py-2">{r.solved}/{r.issued}</td>
                  <td className="py-2 font-bold text-pine-dark">{r.score !== null ? `${r.score}점` : '—'}</td>
                  <td className="py-2 text-xs font-bold">
                    {r.delta === null ? <span className="text-ink2">—</span>
                      : r.delta > 0 ? <span className="text-pine">▲ {r.delta}</span>
                      : r.delta < 0 ? <span className="text-clay">▼ {Math.abs(r.delta)}</span>
                      : <span className="text-ink2">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ConfigModal
          student={student}
          initial={cfg}
          onSave={next => { setDailyConfig(student.id, next); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

// ── 설정 모달 (매쓰플랫 오늘의 학습 설정 다이얼로그 구조) ──────────────────────────────
function ConfigModal({ student, initial, onSave, onClose }: {
  student: Student
  initial?: DailyConfig
  onSave: (cfg: DailyConfig) => void
  onClose: () => void
}) {
  const defaultCourse = CURRICULA.find(c => c.grade === student.grade)?.id ?? CURRICULA[0].id
  const [courseId, setCourseId] = useState(initial?.courseId ?? defaultCourse)
  const [unitIds, setUnitIds] = useState<string[]>(initial?.unitIds ?? [])
  const [count, setCount] = useState(initial?.count ?? 15)
  const [diff, setDiff] = useState<Diff>(initial?.diff ?? 3)
  const [kind, setKind] = useState<DailyConfig['kind']>(initial?.kind ?? 'all')
  const [review, setReview] = useState(initial?.review ?? true)
  const cur = curriculumFor(courseId)

  function toggleUnit(id: string) {
    setUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function save() {
    if (count < 1) { alert('문제 수는 1 이상이어야 합니다.'); return }
    onSave({ courseId, unitIds, count, diff, kind, review })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-black">오늘의 학습 설정 — {student.name}</h2>
          <button onClick={onClose} className="text-lg text-ink2 hover:text-ink">✕</button>
        </div>

        {/* ① 문제 범위 */}
        <div className="mb-5">
          <div className="mb-2 text-sm font-black text-pine-dark">① 문제 범위</div>
          <select value={courseId} onChange={e => { setCourseId(e.target.value); setUnitIds([]) }}
            className="mb-3 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold">
            {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="mb-1 text-xs text-ink2">대단원 (선택 없음 = 전체)</div>
          <div className="flex flex-wrap gap-1.5">
            {cur.units.map(u => (
              <button key={u.id} onClick={() => toggleUnit(u.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${unitIds.includes(u.id) ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line bg-white text-ink2 hover:border-pine'}`}>
                {u.name}
              </button>
            ))}
          </div>
        </div>

        {/* ② 문제 조건 */}
        <div className="mb-5">
          <div className="mb-2 text-sm font-black text-pine-dark">② 문제 조건</div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="mr-1 text-xs text-ink2">문제 수</span>
            {COUNT_PRESETS.map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${count === n ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                {n}
              </button>
            ))}
            <input type="number" min={1} value={count} onChange={e => setCount(Number(e.target.value) || 0)}
              className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm" />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-ink2">난이도</span>
            {DIFFS.map(d => (
              <label key={d} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold ${diff === d ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                <input type="radio" name="today-diff" className="sr-only" checked={diff === d} onChange={() => setDiff(d)} />
                {DIFF_LABEL[d]}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-ink2">문제 형태</span>
            {KIND_OPTIONS.map(o => (
              <label key={o.value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold ${kind === o.value ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                <input type="radio" name="today-kind" className="sr-only" checked={kind === o.value} onChange={() => setKind(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {/* ③ 오답 학습 */}
        <div className="mb-6">
          <div className="mb-2 text-sm font-black text-pine-dark">③ 오답 학습</div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} className="h-4 w-4 accent-[#2e6b4f]" />
            최근 7일 오답 유형 자동 복습 포함 <span className="text-xs text-ink2">(문제 수의 1/3을 오답 유형으로 교체)</span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:text-ink">취소</button>
          <button onClick={save} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-105">저장하기</button>
        </div>
      </div>
    </div>
  )
}
