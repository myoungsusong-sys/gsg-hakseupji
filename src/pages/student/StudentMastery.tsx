import MasteryPage from '../MasteryPage'
import { useStudentSelf } from './common'

// 학생 화면의 유형 마스터 — 진행상태를 **그 학생 이름으로** 저장해야 기기를 바꿔도 이어진다
export default function StudentMastery() {
  const me = useStudentSelf()
  return <MasteryPage studentId={me.id} />
}
