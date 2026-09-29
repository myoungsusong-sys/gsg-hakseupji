// 질문함 «학생 맥락» — 해설의 개인화 단계(⑤)에만 쓰인다. 풀이·검증에는 들어가지 않는다(삼자토론 확정).
// 원래 StudentQuestions.tsx 안에 있던 것을 «문제 바로 질문»(AskProblemButton)도 쓰도록 옮겼다.
import { wrongTypesOf } from './wrongTypes'
import { typeName } from '../data/curriculum'
import type { useStore } from './store'

// 🔴 «관련 있는 증거 2~3개만» 넣는다 (삼자토론 확정). 학생 DB 를 통째로 보내지 않는다.
//    전체 오답 목록·질문 이력·학교·선생님 평가 메모는 넣지 않는다 — 잡음이고 편견이다.
export function studentQnaContext(
  me: { id: string; name: string; grade?: string },
  store: ReturnType<typeof useStore> | null,
  이번문제: string[] = [],
): string {
  let 최근 = ''
  if (store) try {
    const rows = wrongTypesOf({
      studentId: me.id, gradings: store.gradings, wbItems: store.wbItems,
      problems: store.problems, masteries: store.masteries, days: 21,
    }).slice(0, 2)
    최근 = rows.map(r => {
      const st = r.state ? ` (유형 정복 ${r.state.floor}/4층)` : ''
      return `- ${typeName(r.typeId)} — 최근 ${r.wrong}문항 틀림${st}`
    }).join('\n')
  } catch { /* 기록이 없으면 그냥 비운다 */ }
  return [
    '[학생 맥락]',
    `이름: ${me.name}`,
    `과정: ${me.grade ?? ''}`,
    '',
    ...(이번문제.length ? ['이번 문제에서 학생이 한 것:', ...이번문제.map(s => `- ${s}`), ''] : []),
    '최근 3주 안에 자주 틀린 유형(참고용):',
    최근 || '- 기록 없음',
    '',
    '🔴 위 기록은 이번 문제와 «핵심 개념이 명확히 같을 때만» 언급하라.',
    '   같은 단원이라는 이유만으로 잇지 마라. 근거가 분명하지 않으면 아예 언급하지 마라.',
  ].join('\n')
}
