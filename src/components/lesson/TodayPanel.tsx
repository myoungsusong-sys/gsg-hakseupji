import { useEffect, useMemo, useState } from 'react'
import { useStore, uid } from '../../lib/store'
import { dateKey, todayKey } from '../../lib/dates'
import { pickProblems } from '../../lib/select'
import { pickDrillProblems, weakTypes, wrongByType } from '../../lib/drill'
import { CURRICULA, curriculumFor } from '../../data/curriculum'
import { DEFAULT_SHEET_OPTIONS, DIFFS, DIFF_LABEL } from '../../types'
import type { DailyConfig, Diff, Problem, Student } from '../../types'

const COUNT_PRESETS = [10, 50, 75, 100]
const KIND_OPTIONS: { value: DailyConfig['kind']; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '객관식', label: '객관식' },
  { value: '주관식', label: '주관식' },
]
const TAB_NAMES = ['문제 범위 설정', '문제 조건 설정', '오답 학습 설정']
// 요일 버튼 순서는 매쓰플랫과 동일(월~일), 저장 값은 JS getDay() 기준(일=0)
const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 0, label: '일' },
]
const REVIEW_MODES: { value: NonNullable<DailyConfig['reviewMode']>; title: string; desc: string }[] = [
  { value: 'same', title: '틀린 문제 그대로', desc: '틀렸던 문제를 원문 그대로 다시 풀어요' },
  { value: 'twin', title: '쌍둥이·유사문제', desc: '같은 유형의 새 문제로 복습해요' },
  { value: 'both', title: '틀린 문제 + 쌍둥이·유사문제', desc: '원문제와 새 문제를 함께 복습해요' },
]

// 매쓰플랫 수업>오늘의 학습 동일 구조: 설정 → 매일 1클릭 자동 출제 → 날짜별 기록
export default function TodayPanel({ student }: { student: Student }) {
  const { dailyConfigs, setDailyConfig, problems, gradings, wbItems, worksheets, assignments, saveWorksheet, addAssignment, diffMatrix, ensureCourse } = useStore()
  const cfg = dailyConfigs[student.id]
  useEffect(() => { ensureCourse(cfg?.courseId || '') }, [cfg?.courseId])   // 설정 과정 풀 로드
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
    const rows: { day: string; titles: string[]; issued: number; solved: number; score: number | null; right: number; wrong: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const day = dateKey(d)
      const dayAs = assignments.filter(a => a.studentId === student.id && dateKey(a.date) === day)
      if (dayAs.length === 0) continue
      const titles: string[] = []
      let solved = 0, scoreSum = 0, scoreN = 0, right = 0, wrong = 0
      for (const a of dayAs) {
        const w = worksheets.find(x => x.id === a.worksheetId)
        titles.push(w?.title ?? '삭제된 학습지')
        const g = gradings.find(x => x.studentId === student.id && x.worksheetId === a.worksheetId)
        if (g) {
          solved++
          right += g.results.filter(r => r.correct).length
          wrong += g.results.filter(r => !r.correct).length
          if (g.results.length) {
            scoreSum += (g.results.filter(r => r.correct).length / g.results.length) * 100
            scoreN++
          }
        }
      }
      rows.push({ day, titles, issued: dayAs.length, solved, score: scoreN ? Math.round(scoreSum / scoreN) : null, right, wrong })
    }
    // 증감: 직전(더 오래된) 기록 대비
    return rows.map((r, i) => {
      const prev = rows.slice(i + 1).find(x => x.score !== null)
      const delta = r.score !== null && prev && prev.score !== null ? r.score - prev.score : null
      return { ...r, delta }
    })
  }, [assignments, worksheets, gradings, student.id])

  // 점수 추이 그래프용 (오래된→최신, 점수 있는 날만)
  const chart = useMemo(() => historyRows.filter(r => r.score !== null).reverse(), [historyRows])

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
    // 오답 학습: ON이고 오늘이 복습 요일이면(요일 미선택 시 매일) 복습 문제 믹스
    const reviewDays = cfg.reviewDays ?? []
    if (cfg.review && (reviewDays.length === 0 || reviewDays.includes(new Date().getDay()))) {
      const cut = new Date()
      cut.setDate(cut.getDate() - 6)
      const cutoff = dateKey(cut)
      const recent = gradings.filter(g => dateKey(g.date) >= cutoff)
      const mode = cfg.reviewMode ?? 'twin'
      const cap = Math.min(100, Math.max(1, cfg.reviewCap ?? 50))
      const used = new Set(picked.map(p => p.id))
      const reviewPicked: Problem[] = []
      if (mode === 'same' || mode === 'both') {
        // 최근 7일 학습지 채점에서 틀린 원문제 그대로 (results 순서 = problemIds 순서)
        const pMap = new Map(problems.map(p => [p.id, p]))
        for (const g of recent) {
          if (g.studentId !== student.id || !g.worksheetId) continue
          const ws = worksheets.find(w => w.id === g.worksheetId)
          if (!ws) continue
          g.results.forEach((r, i) => {
            if (r.correct) return
            const p = pMap.get(ws.problemIds[i] ?? '')
            if (p && !used.has(p.id)) { used.add(p.id); reviewPicked.push(p) }
          })
        }
      }
      if (mode === 'twin' || mode === 'both') {
        const weak = weakTypes(wrongByType(student.id, recent, wbItems))
        if (weak.length) {
          const drill = pickDrillProblems(
            weak.map(w => ({ typeId: w.typeId })),
            problems,
            { twinPer: 1, similarPer: 1, diffShift: 0, typeCap: 2, excludeIds: used },
          )
          reviewPicked.push(...drill)
        }
      }
      if (reviewPicked.length) picked = [...picked, ...reviewPicked.slice(0, cap)]
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

      <div className="mb-4 text-sm font-black">{student.name} 학생 오늘의 학습 결과를 확인하세요.</div>

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

      {/* 점수 추이 그래프 (매쓰플랫: 점수 라인) */}
      {chart.length > 0 && (
        <div className="mb-5 rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center gap-3 text-sm font-black">
            점수 추이
            <span className="ml-auto text-[11px] font-normal text-ink2"><span className="text-pine">●</span> 점수</span>
          </div>
          <ScoreChart data={chart.map(r => ({ label: r.day.slice(5).replace('-', '.'), score: r.score! }))} />
        </div>
      )}

      {/* 날짜별 기록 (최근 14일) */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-3 text-sm font-black">날짜별 기록 <span className="font-normal text-ink2">— 최근 14일</span></div>
        {historyRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink2">최근 14일 안에 출제 기록이 없습니다. 자동 출제하면 여기 쌓입니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink2">
                  <th className="py-1.5">날짜</th><th>푼/출제</th><th>점수</th><th>증감</th><th>맞은</th><th>틀린</th><th>출제 학습지</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map(r => (
                  <tr key={r.day} className="border-b border-line/50">
                    <td className="whitespace-nowrap py-2 font-semibold">{r.day === todayKey() ? '오늘' : r.day.slice(5).replace('-', '.')}</td>
                    <td className="py-2">{r.solved}/{r.issued}</td>
                    <td className="py-2 font-bold text-pine-dark">{r.score !== null ? `${r.score}점` : '—'}</td>
                    <td className="py-2 text-xs font-bold">
                      {r.delta === null ? <span className="text-ink2">—</span>
                        : r.delta > 0 ? <span className="text-pine">▲ {r.delta}</span>
                        : r.delta < 0 ? <span className="text-clay">▼ {Math.abs(r.delta)}</span>
                        : <span className="text-ink2">—</span>}
                    </td>
                    <td className="py-2 text-pine">{r.solved ? r.right : '—'}</td>
                    <td className="py-2 text-clay">{r.solved ? r.wrong : '—'}</td>
                    <td className="max-w-[180px] truncate py-2 pr-2 text-ink2">{r.titles.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

// 점수 추이 SVG 라인 그래프 (0~100점)
function ScoreChart({ data }: { data: { label: string; score: number }[] }) {
  const W = 640, H = 160, padL = 28, padB = 22, padT = 10, padR = 10
  const iw = W - padL - padR, ih = H - padT - padB
  const n = data.length
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (s: number) => padT + (1 - s / 100) * ih
  const pts = data.map((d, i) => `${x(i)},${y(d.score)}`).join(' ')
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" style={{ height: H }}>
        {[0, 50, 100].map(g => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize={9} fill="var(--color-ink2)">{g}</text>
          </g>
        ))}
        {n > 1 && <polyline points={pts} fill="none" stroke="var(--color-pine)" strokeWidth={2} />}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.score)} r={3.5} fill="var(--color-pine)" />
            <text x={x(i)} y={y(d.score) - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--color-pine-dark)">{d.score}</text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--color-ink2)">{d.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── 설정 모달 (매쓰플랫 오늘의 학습 설정 다이얼로그: 3탭 구조) ──────────────────────────────
function ConfigModal({ student, initial, onSave, onClose }: {
  student: Student
  initial?: DailyConfig
  onSave: (cfg: DailyConfig) => void
  onClose: () => void
}) {
  const defaultCourse = CURRICULA.find(c => c.grade === student.grade)?.id ?? CURRICULA[0].id
  const [tab, setTab] = useState(0)
  const [courseId, setCourseId] = useState(initial?.courseId ?? defaultCourse)
  const [unitIds, setUnitIds] = useState<string[]>(initial?.unitIds ?? [])
  const [count, setCount] = useState(initial?.count ?? 10)
  const [diff, setDiff] = useState<Diff>(initial?.diff ?? 2)
  const [kind, setKind] = useState<DailyConfig['kind']>(initial?.kind ?? 'all')
  const [review, setReview] = useState(initial?.review ?? false)
  const [reviewDays, setReviewDays] = useState<number[]>(initial?.reviewDays ?? [])
  const [reviewMode, setReviewMode] = useState<NonNullable<DailyConfig['reviewMode']>>(initial?.reviewMode ?? 'same')
  const [capStr, setCapStr] = useState(initial?.reviewCap != null ? String(initial.reviewCap) : '')
  const cur = curriculumFor(courseId)

  // 변경 없으면 저장하기 비활성
  const dirty = useMemo(() => {
    if (!initial) return true
    const cap = capStr.trim() === '' ? undefined : Number(capStr)
    return courseId !== initial.courseId
      || JSON.stringify([...unitIds].sort()) !== JSON.stringify([...initial.unitIds].sort())
      || count !== initial.count
      || diff !== initial.diff
      || kind !== initial.kind
      || review !== initial.review
      || JSON.stringify([...reviewDays].sort()) !== JSON.stringify([...(initial.reviewDays ?? [])].sort())
      || reviewMode !== (initial.reviewMode ?? 'same')
      || cap !== initial.reviewCap
  }, [initial, courseId, unitIds, count, diff, kind, review, reviewDays, reviewMode, capStr])

  function toggleUnit(id: string) {
    setUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleDay(day: number) {
    setReviewDays(prev => prev.includes(day) ? prev.filter(x => x !== day) : [...prev, day])
  }
  function save() {
    if (!Number.isFinite(count) || count < 10 || count > 100) { alert('문제 수는 최소 10 ~ 최대 100 문제입니다.'); return }
    let reviewCap: number | undefined
    if (capStr.trim() !== '') {
      const n = Number(capStr)
      if (!Number.isFinite(n) || n < 1 || n > 100) { alert('복습 최대 문제 수는 1 ~ 100 사이여야 합니다.'); return }
      reviewCap = Math.floor(n)
    }
    onSave({ courseId, unitIds, count, diff, kind, review, reviewDays, reviewMode, reviewCap })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-black">오늘의 학습 설정</h2>
            <p className="mt-0.5 text-xs text-ink2">오늘의 학습 설정을 변경할 수 있습니다.</p>
          </div>
          <button onClick={onClose} className="text-lg text-ink2 hover:text-ink">✕</button>
        </div>

        {/* 탭 바 */}
        <div className="mb-5 flex border-b border-line">
          {TAB_NAMES.map((name, i) => (
            <button key={name} onClick={() => setTab(i)}
              className={`-mb-px px-4 py-2.5 text-sm font-bold ${tab === i ? 'border-b-2 border-pine text-pine-dark' : 'text-ink2 hover:text-ink'}`}>
              {name}
            </button>
          ))}
        </div>

        {/* 탭1: 문제 범위 설정 */}
        {tab === 0 && (
          <div>
            <select value={courseId} onChange={e => { setCourseId(e.target.value); setUnitIds([]) }}
              className="mb-3 w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold">
              {CURRICULA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="mb-1 text-xs text-ink2">대단원 (선택 없음 = 전체)</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {cur.units.map(u => (
                <label key={u.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${unitIds.includes(u.id) ? 'border-pine bg-pine-soft/60 text-pine-dark' : 'border-line bg-white text-ink2 hover:border-pine'}`}>
                  <input type="checkbox" checked={unitIds.includes(u.id)} onChange={() => toggleUnit(u.id)} className="h-4 w-4 accent-[#2e6b4f]" />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 탭2: 문제 조건 설정 */}
        {tab === 1 && (
          <div>
            <div className="mb-5">
              <div className="text-sm font-black">문제 수</div>
              <div className="mb-2 text-xs text-ink2">최소 10 ~ 최대 100 문제</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {COUNT_PRESETS.map(n => (
                  <button key={n} onClick={() => setCount(n)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${count === n ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                    {n}
                  </button>
                ))}
                <input type="number" min={10} max={100} value={count} onChange={e => setCount(Number(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="mb-5">
              <div className="mb-2 text-sm font-black">난이도</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DIFFS.map(d => (
                  <label key={d} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold ${diff === d ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                    <input type="radio" name="today-diff" className="sr-only" checked={diff === d} onChange={() => setDiff(d)} />
                    {DIFF_LABEL[d]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-black">문제 타입</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {KIND_OPTIONS.map(o => (
                  <label key={o.value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold ${kind === o.value ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2 hover:border-pine'}`}>
                    <input type="radio" name="today-kind" className="sr-only" checked={kind === o.value} onChange={() => setKind(o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 탭3: 오답 학습 설정 */}
        {tab === 2 && (
          <div>
            <div className="mb-5 rounded-xl bg-pine-soft p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-pine-dark">틀린 문제로 복습</span>
                <button onClick={() => setReview(r => !r)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${review ? 'bg-pine' : 'bg-stone-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${review ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="mt-1 text-xs text-ink2">최근 7일간 오늘의 학습 틀린 문제를 선택한 요일에 복습하는 기능이에요!</p>
            </div>
            <div className="mb-5">
              <div className="mb-2 text-sm font-black">요일 선택 <span className="font-normal text-ink2">(선택 없음 = 매일)</span></div>
              <div className="flex gap-1.5">
                {DAY_OPTIONS.map(d => (
                  <button key={d.value} disabled={!review} onClick={() => toggleDay(d.value)}
                    className={`h-9 w-9 rounded-full border text-xs font-bold ${reviewDays.includes(d.value) ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2'} ${review ? 'hover:border-pine' : 'cursor-not-allowed opacity-40'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <div className="mb-2 text-sm font-black">출제 방식</div>
              <div className="grid gap-2">
                {REVIEW_MODES.map(m => (
                  <button key={m.value} disabled={!review} onClick={() => setReviewMode(m.value)}
                    className={`rounded-xl border p-3 text-left ${reviewMode === m.value ? 'border-pine bg-pine-soft/60' : 'border-line bg-white'} ${review ? 'hover:border-pine' : 'cursor-not-allowed opacity-40'}`}>
                    <div className="text-sm font-bold">{m.title}</div>
                    <div className="mt-0.5 text-xs text-ink2">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-black">문제 수 제한</div>
              <div className="mb-2 text-xs text-ink2">최대 문제 수 100개</div>
              <input type="number" min={1} max={100} placeholder="50" disabled={!review}
                value={capStr} onChange={e => setCapStr(e.target.value)}
                className="w-24 rounded-lg border border-line px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40" />
            </div>
          </div>
        )}

        {/* 하단 합계 바 */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="text-sm">오늘의 학습 문제 수 <b className="text-pine-dark">{count}</b> 개</span>
          <div className="grow" />
          {tab === 0 && (
            <button onClick={() => setUnitIds([])}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink2 hover:text-ink">
              🔄 모든 단원 선택 해제
            </button>
          )}
          <button onClick={save} disabled={!dirty}
            className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">
            저장하기
          </button>
        </div>
      </div>
    </div>
  )
}
