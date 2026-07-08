import { useNavigate } from 'react-router-dom'
import type { Grading, Problem, Student, Worksheet } from '../../types'
import { DEFAULT_SHEET_OPTIONS } from '../../types'
import { useStore, uid } from '../../lib/store'
import { pickDrillProblems, type WrongRef } from '../../lib/drill'
import { courseTagOfType } from '../../data/curriculum'

// ── 보충학습 (매쓰플랫 학생앱 [오답학습]·[심화학습] 버튼) ─────────
// 오답학습: 최근 채점의 오답·모름 유형으로 쌍둥이 우선 선발 (문제당 쌍둥이1+유사1, 유형당 최대 3)
// 심화학습: 학습지 전체 유형에서 난이도 한 단계 위(diffShift +1) 선발 (유형당 최대 2)
// → 새 학습지 생성(태그 '오답학습'/'심화학습') + 자기에게 배정(숙제) + 바로 풀기 진입

export type SupplementKind = '오답학습' | '심화학습'

// 최근 채점의 오답·모름 참조 (신규 기록 itemId 기준 · 구버전은 순서 기준)
export function wrongRefsOf(ws: Worksheet, g: Grading, problemMap: Map<string, Problem>): WrongRef[] {
  const refs: WrongRef[] = []
  g.results.forEach((r, i) => {
    if (r.correct) return
    const pid = r.itemId ?? ws.problemIds[i]
    const p = pid ? problemMap.get(pid) : undefined
    const typeId = r.typeId ?? p?.typeId
    if (typeId) refs.push({ typeId, diff: p?.diff })
  })
  return refs
}

export function useSupplement(me: Student) {
  const { problems, saveWorksheet, addAssignment } = useStore()
  const nav = useNavigate()

  return function createSupplement(kind: SupplementKind, ws: Worksheet, g: Grading): void {
    const problemMap = new Map(problems.map(p => [p.id, p]))
    const excludeIds = new Set(ws.problemIds)   // 원 학습지 문제는 다시 내지 않음

    let refs: WrongRef[]
    let opts: Parameters<typeof pickDrillProblems>[2]
    if (kind === '오답학습') {
      refs = wrongRefsOf(ws, g, problemMap)
      opts = { twinPer: 1, similarPer: 1, diffShift: 0, typeCap: 3, excludeIds }
    } else {
      refs = ws.problemIds
        .map(id => problemMap.get(id))
        .filter((p): p is Problem => !!p)
        .map(p => ({ typeId: p.typeId, diff: p.diff }))
      opts = { twinPer: 0, similarPer: 1, diffShift: 1, typeCap: 2, excludeIds }
    }
    if (refs.length === 0) { alert('대상 문제가 없어요.'); return }

    const picked = pickDrillProblems(refs, problems, opts)
    if (picked.length === 0) { alert('출제할 수 있는 문제가 문제은행에 없어요.'); return }

    const id = uid('ws')
    saveWorksheet({
      id,
      title: `[${kind}] ${ws.title}`,
      author: me.name,
      grade: (refs[0] && courseTagOfType(refs[0].typeId)) || ws.grade,
      tags: [kind],
      theme: 'blue',
      problemIds: picked.map(p => p.id),
      conceptIds: [],
      options: { ...DEFAULT_SHEET_OPTIONS, autoGrade: true },
      listIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    })
    addAssignment(id, [me.id], '숙제')
    nav(`/student/solve/${id}`)
  }
}
