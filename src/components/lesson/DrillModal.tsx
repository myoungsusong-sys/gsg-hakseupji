import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Diff, Student } from '../../types'
import { DEFAULT_SHEET_OPTIONS } from '../../types'
import { useStore, uid } from '../../lib/store'
import { pickDrillProblems } from '../../lib/drill'
import { courseTagOfType } from '../../data/curriculum'

// 오답 참조 — problemId는 틀린 원문제(학습지 오답만)
export interface DrillWrong { typeId: string; diff?: Diff; problemId?: string }

// 매쓰플랫 「문제별 오답학습지 만들기」 다이얼로그와 동일 (재실사 기록: 항목 순서·기본값·문구)
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
  // 매쓰플랫은 자동 채점 기본 해제지만, 우리 앱은 웹 자동채점이 핵심이라 기본 체크 유지 (의도적 차이)
  const [autoGrade, setAutoGrade] = useState(true)
  const [excludePrev, setExcludePrev] = useState(false)   // 기존 출제 문제 제외 — 기본 해제 (매쓰플랫 동일)
  const [capOn, setCapOn] = useState(true)                // 유형별 최대 문제 수 제한 — 기본 체크·값 3
  const [capValue, setCapValue] = useState(3)
  const [includeOriginal, setIncludeOriginal] = useState(true)
  const [assignNow, setAssignNow] = useState(true)

  const typeCap = capOn ? capValue : 0                    // 제한 해제 시 무제한

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
      // 학년 뱃지 = 문항 과정 기준 (미적분Ⅰ 오답 학습지가 학생 학년(중1-1)으로 찍히던 문제 수정)
      grade: (wrongs[0] && courseTagOfType(wrongs[0].typeId)) || student.grade,
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
        {/* 취소는 우상단 X (매쓰플랫 동일) */}
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="text-lg font-black">문제별 오답학습지 만들기</div>
          <button onClick={onClose} aria-label="닫기"
            className="rounded-lg px-2 py-0.5 text-lg leading-none text-ink2 hover:bg-paper2">✕</button>
        </div>
        <div className="mb-4 text-sm text-ink2">{student.name} · {title}</div>

        <div className="grid gap-4 text-sm">
          {/* 1) 대상 문제 수 */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">문제 수</span>
            <b>{wrongs.length}개</b>
          </div>

          {/* 2) 문장형 옵션 (매쓰플랫 동일 문구) */}
          <div className="rounded-xl bg-paper2 px-4 py-3 leading-9">
            대상 문제의 <b className="text-pine">쌍둥이문제</b> <CountSelect value={twinPer} onChange={setTwinPer} />개와{' '}
            <b className="text-pine">유사문제</b> <CountSelect value={similarPer} onChange={setSimilarPer} />개로 학습지를 만듭니다.{' '}
            유사문제 난이도는{' '}
            <select value={diffShift} onChange={e => setDiffShift(Number(e.target.value) as -1 | 0 | 1)}
              className="rounded-lg border border-line bg-white px-2 py-1 font-bold text-pine">
              <option value={-1}>쉽게</option>
              <option value={0}>그대로</option>
              <option value={1}>어렵게</option>
            </select>{' '}
            출제합니다.
          </div>

          {/* 3) 자동 채점 — 매쓰플랫은 기본 해제지만 우리는 웹 자동채점이 핵심이라 기본 체크 (의도적 차이) */}
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={autoGrade} onChange={e => setAutoGrade(e.target.checked)} />
            자동 채점 학습지 만들기
          </label>

          {/* 4) 기존 출제 문제 제외 — 기본 해제 (매쓰플랫 동일) */}
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={excludePrev} onChange={e => setExcludePrev(e.target.checked)} />
            기존 출제 문제 제외
          </label>

          {/* 5) 유형별 최대 문제 수 제한 — 기본 체크·값 3, 해제 시 무제한 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={capOn} onChange={e => setCapOn(e.target.checked)} />
              유형별 최대 문제 수 제한
            </label>
            <div className={`flex items-center overflow-hidden rounded-lg border border-line ${capOn ? '' : 'opacity-40'}`}>
              <button type="button" disabled={!capOn} onClick={() => setCapValue(v => Math.max(1, v - 1))}
                className="px-2.5 py-1 font-bold hover:bg-paper2 disabled:hover:bg-transparent">−</button>
              <span className="w-8 border-x border-line text-center font-bold">{capValue}</span>
              <button type="button" disabled={!capOn} onClick={() => setCapValue(v => Math.min(20, v + 1))}
                className="px-2.5 py-1 font-bold hover:bg-paper2 disabled:hover:bg-transparent">＋</button>
            </div>
            <span>개</span>
          </div>

          {/* 우리 확장 토글 (매쓰플랫에 없음, 유지) */}
          {originalIds.length > 0 && (
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={includeOriginal} onChange={e => setIncludeOriginal(e.target.checked)} />
              틀린 원문제 그대로 포함 <span className="font-normal text-ink2">({originalIds.length}문제)</span>
            </label>
          )}
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={assignNow} onChange={e => setAssignNow(e.target.checked)} />
            학생에게 바로 출제
          </label>
        </div>

        {/* 6) 학습지 문제 수 — 실시간 합산 */}
        <div className="mt-4 rounded-xl bg-paper2 px-4 py-3 text-sm">
          학습지 문제 수 <b className="text-pine-dark">{problemIds.length}</b> 개
          {problemIds.length === 0 && <span className="ml-2 text-xs text-clay">선발 가능한 문제가 없습니다</span>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => create('edit')} className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">편집 후 만들기</button>
          <button onClick={() => create('view')} className="rounded-lg bg-pine px-5 py-2 text-sm font-bold text-paper hover:brightness-110">바로 만들기</button>
        </div>
      </div>
    </div>
  )
}

function CountSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      className="rounded-lg border border-line bg-white px-2 py-1 font-bold text-pine">
      {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )
}
