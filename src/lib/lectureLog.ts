// 강의 출제·시청 기록 — 설정 한 칸(lectureLog)에 학생별 키로 모은다.
//   출제: `a|<학생 id>|<과정>|<강의 id>` → `<ISO 출제 시각>|<강의 제목>`
//   시청: `w|<학생 id>|<과정>|<강의 id>` → `<ing|done>|<ISO 시각>`
export type LecState = '학습가능' | '학습중' | '학습완료'
export interface LecAssign { studentId: string; course: string; lectureId: number; at: string; title: string }

export const assignKey = (sid: string, course: string, id: number) => `a|${sid}|${course}|${id}`
export const watchKey = (sid: string, course: string, id: number) => `w|${sid}|${course}|${id}`

export function assignsOf(log: Record<string, string>, studentId?: string): LecAssign[] {
  const out: LecAssign[] = []
  for (const [k, v] of Object.entries(log)) {
    if (!k.startsWith('a|')) continue
    const [, sid, course, id] = k.split('|')
    if (studentId && sid !== studentId) continue
    const i = v.indexOf('|')
    out.push({ studentId: sid, course, lectureId: Number(id), at: i < 0 ? v : v.slice(0, i), title: i < 0 ? '' : v.slice(i + 1) })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

export function watchOf(log: Record<string, string>, sid: string, course: string, id: number): { state: LecState; at?: string } {
  const v = log[watchKey(sid, course, id)]
  if (!v) return { state: '학습가능' }
  const [st, at] = v.split('|')
  return { state: st === 'done' ? '학습완료' : '학습중', at }
}

// 숙제 «확인» 표시 — 선생님이 손으로 찍는 완료. `h|<출제 id>` → ISO 시각 (같은 설정 칸을 함께 쓴다)
export const homeworkCheckKey = (assignmentId: string) => `h|${assignmentId}`
