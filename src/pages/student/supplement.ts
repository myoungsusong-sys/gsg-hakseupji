import { useNavigate } from 'react-router-dom'
import type { Grading, Problem, Student, StudentAppConfig, Worksheet } from '../../types'
import { DEFAULT_SHEET_OPTIONS } from '../../types'
import { useStore, uid } from '../../lib/store'
import { pickDrillProblems, type WrongRef } from '../../lib/drill'
import { courseTagOfType } from '../../data/curriculum'
import { latestGradingFor, statusOf } from './common'

// ── 보충학습 (매쓰플랫 학생앱 [오답학습]·[심화학습] 버튼) — 원본 규칙 정합 ──
// ① 오답학습: "틀린문제의 유형을 틀리지 않을 때까지 반복" — 회차(N회차) 루프.
//    틀린 유형으로 오답학습-1회차 생성 → 그 회차에서 또 틀리면 그 틀린 유형으로 다음 회차 재생성.
//    틀린 유형의 문제를 모두 맞으면 추가학습을 생성할 수 없다(완료).
// ② 심화학습: "정답문제마다 한 단계씩 높은 난이도" — 직전 학습지에서 **맞힌 문제의 유형만**
//    diffShift +1 로 선발. 심화 회차에서 모두 맞으면 완료.
// ③ 동시 진행: 오답학습과 심화학습은 동시에 진행할 수 있지만, 같은 종류의 진행 중(미완료)
//    학습이 있으면 새로운 학습을 생성할 수 없다(중복 생성 방지 가드).
// → 새 학습지 생성(태그 '오답학습'/'심화학습', supplement 체인 기록) + 자기에게 배정(숙제) + 바로 풀기

export type SupplementKind = '오답학습' | '심화학습'

// 원본 ⓘ 모달 안내문 (매쓰플랫 문구 그대로)
export const SUPPLEMENT_RULE_MSG = '오답학습과 심화학습은 동시에 진행할 수 있지만, 하나의 학습은 끝나기 전까지 새로운 학습을 생성할 수 없어요!'
export const WRONG_DONE_MSG = '틀린 유형의 문제를 모두 맞으면 추가학습을 생성할 수 없습니다.'
export const ONE_CLICK_OFF_MSG = '선생님이 이 학년의 원클릭 복습(보충학습)을 꺼두었어요.'

// 관리 > 실험실 「원클릭 복습 학습지」 설정 소비 — 학년 OFF면 보충학습(오답·심화) 버튼 비활성
// (grade '중1-1' 과정형도 '중1' 학년 그룹 기준으로 판정)
export function oneClickAllowed(cfg: StudentAppConfig, me: Student): boolean {
  const lab = cfg.lab
  if (!lab) return true
  if (lab.oneClickOn === false) return false
  const m = me.grade.match(/^(초|중|고)\s*(\d)/)
  const short = m ? `${m[1]}${m[2]}` : me.grade
  return !(lab.oneClickGradesOff ?? []).includes(short)
}

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

// 직전 학습지에서 맞힌 문제 참조 — 심화학습 대상 (원본: "정답문제마다 한 단계씩 높은 난이도")
export function correctRefsOf(ws: Worksheet, g: Grading, problemMap: Map<string, Problem>): WrongRef[] {
  const refs: WrongRef[] = []
  g.results.forEach((r, i) => {
    if (!r.correct) return
    const pid = r.itemId ?? ws.problemIds[i]
    const p = pid ? problemMap.get(pid) : undefined
    const typeId = r.typeId ?? p?.typeId
    if (typeId) refs.push({ typeId, diff: p?.diff })
  })
  return refs
}

// 이 학습지의 보충학습 종류 (supplement 체인 필드 우선 · 구버전은 태그로 판별)
export function supplementKindOf(ws: Worksheet): SupplementKind | null {
  if (ws.supplement) return ws.supplement.kind
  if (ws.tags.includes('오답학습')) return '오답학습'
  if (ws.tags.includes('심화학습')) return '심화학습'
  return null
}

// 체인 원본 학습지명 — "[오답학습-2회차] 제목" → "제목"
function baseTitleOf(ws: Worksheet): string {
  return ws.title.replace(/^\[(오답학습|심화학습)(-\d+회차)?\]\s*/, '')
}

export function useSupplement(me: Student) {
  const { problems, worksheets, assignments, gradings, saveWorksheet, addAssignment, studentAppConfig } = useStore()
  const nav = useNavigate()
  const allowed = oneClickAllowed(studentAppConfig, me)

  // 진행 중(미완료) 보충학습 — 같은 종류가 끝나기 전엔 새로 생성할 수 없다 (원본 규칙 ③)
  function pendingOf(kind: SupplementKind): Worksheet | undefined {
    const myWsIds = new Set(assignments.filter(a => a.studentId === me.id).map(a => a.worksheetId))
    return worksheets.find(w => {
      if (w.deletedAt || !myWsIds.has(w.id)) return false
      if (supplementKindOf(w) !== kind) return false
      return statusOf(w.id, latestGradingFor(gradings, me.id, w.id)) !== '학습완료'
    })
  }

  function create(kind: SupplementKind, ws: Worksheet, g: Grading): void {
    // 가드0: 선생님이 원클릭 복습을 꺼둔 학년이면 생성 불가 (관리 > 실험실)
    if (!allowed) { alert(ONE_CLICK_OFF_MSG); return }
    // 가드: 같은 종류의 진행 중 보충학습이 있으면 생성 불가
    const pending = pendingOf(kind)
    if (pending) {
      alert(`${SUPPLEMENT_RULE_MSG}\n\n진행 중: ${pending.title}\n먼저 풀고 제출해주세요.`)
      return
    }

    const problemMap = new Map(problems.map(p => [p.id, p]))
    const chainKind = supplementKindOf(ws)
    const sourceWsId = ws.supplement?.sourceWsId ?? ws.id
    // 회차: 같은 종류 체인에서 이어가면 +1, 아니면 1회차부터
    const round = chainKind === kind ? (ws.supplement?.round ?? 1) + 1 : 1

    let refs: WrongRef[]
    let opts: Parameters<typeof pickDrillProblems>[2]
    // 체인 전체(원 학습지+이전 회차들)의 문제는 다시 내지 않음
    const excludeIds = new Set<string>()
    for (const w of worksheets) {
      if (w.id === sourceWsId || w.id === ws.id || w.supplement?.sourceWsId === sourceWsId) {
        for (const pid of w.problemIds) excludeIds.add(pid)
      }
    }

    if (kind === '오답학습') {
      refs = wrongRefsOf(ws, g, problemMap)
      if (refs.length === 0) {
        // 틀린 유형을 모두 맞음 — 오답학습 완료 (원본: 추가학습 생성 불가)
        alert(chainKind === '오답학습'
          ? `오답학습 완료! 🎉 ${WRONG_DONE_MSG}`
          : `틀린 문제가 없어요. ${WRONG_DONE_MSG}`)
        return
      }
      opts = { twinPer: 1, similarPer: 1, diffShift: 0, typeCap: 3, excludeIds }
    } else {
      // 심화학습: 직전 학습지에서 **맞힌 문제의 유형만** 난이도 한 단계 위로 (원본 규칙 ②)
      refs = correctRefsOf(ws, g, problemMap)
      if (refs.length === 0) {
        alert('맞힌 문제가 없어요. 심화학습은 정답 문제의 유형으로 만들어져요 — 오답학습으로 먼저 연습해보세요!')
        return
      }
      opts = { twinPer: 0, similarPer: 1, diffShift: 1, typeCap: 2, excludeIds }
    }

    const picked = pickDrillProblems(refs, problems, opts)
    if (picked.length === 0) { alert('출제할 수 있는 문제가 문제은행에 없어요.'); return }

    const id = uid('ws')
    saveWorksheet({
      id,
      title: `[${kind}-${round}회차] ${baseTitleOf(ws)}`,
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
      supplement: { kind, sourceWsId, round },
    })
    addAssignment(id, [me.id], '숙제')
    nav(`/student/solve/${id}`)
  }

  return { create, pendingOf, allowed }
}
