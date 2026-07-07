import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Diff, Student } from '../../types'
import { DEFAULT_SHEET_OPTIONS } from '../../types'
import { useStore, uid } from '../../lib/store'
import { pickDrillProblems } from '../../lib/drill'

// 오답 참조 — problemId는 틀린 원문제(학습지 오답만)
export interface DrillWrong { typeId: string; diff?: Diff; problemId?: string }

// 매쓰플랫 오답학습지 옵션 다이얼로그와 동일
export default function DrillModal({ student, title, wrongs, defaultTags, onClose }: {
  student: Student
  title: string
  wrongs: DrillWrong[]
  defaultTags?: string[]
  onClose: () => void
}) {
  const { problems, worksheets, assignments, saveWorksheet, addAssignment } = useStore()
  const nav = useNavigate()

  const [twinPer, setTwinPer] = useState(1)
  const [similarPer, setSimilarPer] = useState(1)
  const [diffShift, setDiffShift] = useState<-1 | 0 | 1>(0)
  const [typeCap, setTypeCap] = useState(3)
  const [excludePrev, setExcludePrev] = useState(true)
  const [includeOriginal, setIncludeOriginal] = useState(true)
  const [autoGrade, setAutoGrade] = useState(true)
  const [assignNow, setAssignNow] = useState(true)

  const problemMap = useMemo(() => new Map(problems.map(p => [p.id, p])), [problems])

  // 틀린 원문제 (문제은행에 실존하는 것만)
  const originalIds = useMemo(() => {
    const ids: string[] = []
    for (const w of wrongs) {
      if (w.problemId && problemMap.has(w.problemId) && !ids.includes(w.problemId)) ids.push(w.problemId)
    }
    return ids
  }, [wrongs, problemMap])

  // 이 학생에게 출제된 학습지들의 문제 id (기존 출제 문제 제외용)
  const prevIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of assignments) {
      if (a.studentId !== student.id) continue
      const ws = worksheets.find(w => w.id === a.worksheetId)
      if (ws) for (const pid of ws.problemIds) set.add(pid)
    }
    return set
  }, [assignments, worksheets, student.id])

  // 예상 문항 실시간 미리보기
  const problemIds = useMemo(() => {
    const excludeIds = new Set<string>(excludePrev ? prevIds : [])
    const front = includeOriginal ? originalIds : []
    for (const id of front) excludeIds.add(id)   // 원문제 중복 선발 방지
    const picked = pickDrillProblems(wrongs, problems, { twinPer, similarPer, diffShift, typeCap, excludeIds })
    return [...front, ...picked.map(p => p.id)]
  }, [wrongs, problems, twinPer, similarPer, diffShift, typeCap, excludePrev, prevIds, includeOriginal, originalIds])

  function create(mode: 'view' | 'edit') {
    if (problemIds.length === 0) {
      alert('해당 유형의 쌍둥이·유사 문제가 문제은행에 없습니다')
      return
    }
    const id = uid('ws')
    saveWorksheet({
      id,
      title,
      author: '깊은생각수학',
      grade: student.grade,
      tags: defaultTags ?? ['오답'],
      theme: 'amber',
      problemIds,
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, autoGrade },
      listIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    })
    if (assignNow) addAssignment(id, [student.id], '수업')
    onClose()
    nav(mode === 'view' ? `/worksheet/${id}` : `/make?edit=${id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 text-lg font-black">오답 학습지 만들기</div>
        <div className="mb-4 text-sm text-ink2">{student.name} · 오답 {wrongs.length}문항 기준</div>

        <div className="grid gap-4 text-sm">
          <Row label="문제당 쌍둥이 수">
            <CountPicker value={twinPer} onChange={setTwinPer} />
          </Row>
          <Row label="문제당 유사 수">
            <CountPicker value={similarPer} onChange={setSimilarPer} />
          </Row>
          <Row label="유사 난이도">
            <div className="flex gap-1">
              {([[-1, '쉽게'], [0, '그대로'], [1, '어렵게']] as const).map(([v, t]) => (
                <button key={v} type="button" onClick={() => setDiffShift(v)}
                  className={`rounded-lg border px-3 py-1.5 font-semibold ${diffShift === v ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Row>
          <Row label="유형별 최대 문제 수">
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={typeCap}
                onChange={e => setTypeCap(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded-lg border border-line px-3 py-1.5" />
              <span className="text-xs text-ink2">0 = 무제한</span>
            </div>
          </Row>

          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={excludePrev} onChange={e => setExcludePrev(e.target.checked)} />
            기존 출제 문제 제외
          </label>
          {originalIds.length > 0 && (
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={includeOriginal} onChange={e => setIncludeOriginal(e.target.checked)} />
              틀린 원문제 그대로 포함 <span className="font-normal text-ink2">({originalIds.length}문제)</span>
            </label>
          )}
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={autoGrade} onChange={e => setAutoGrade(e.target.checked)} />
            자동채점 학습지
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={assignNow} onChange={e => setAssignNow(e.target.checked)} />
            학생에게 바로 출제
          </label>
        </div>

        <div className="mt-4 rounded-xl bg-paper2 px-4 py-3 text-sm">
          예상 문항 수 <b className="text-pine-dark">{problemIds.length}문제</b>
          {problemIds.length === 0 && <span className="ml-2 text-xs text-clay">선발 가능한 문제가 없습니다</span>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper2">취소</button>
          <button onClick={() => create('edit')} className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">편집 후 만들기</button>
          <button onClick={() => create('view')} className="rounded-lg bg-amber px-5 py-2 text-sm font-bold text-white hover:brightness-105">바로 만들기</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      {children}
    </div>
  )
}

function CountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`h-8 w-8 rounded-lg border text-sm font-bold ${value === n ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink hover:bg-paper2'}`}>
          {n}
        </button>
      ))}
    </div>
  )
}
