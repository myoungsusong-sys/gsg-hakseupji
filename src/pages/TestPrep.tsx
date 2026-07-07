import { useState } from 'react'
import SubTabs from '../components/SubTabs'
import Placeholder from '../components/Placeholder'

// 테스트 — 매쓰플랫과 동일 4탭
const TABS = [
  { key: 'entrance', label: '입학 TEST' },
  { key: 'weekly', label: '주간 TEST' },
  { key: 'unit', label: '단원 TEST' },
  { key: 'total', label: '총괄 TEST' },
]

const DESC: Record<string, string> = {
  entrance: '수준별 반 편성을 위해 학생의 개인별 학습 능력을 측정하는 테스트 (학년별 일반형·심화형)',
  weekly: '한 주 학습 범위를 점검하는 주간 테스트',
  unit: '단원 마무리 점검 테스트',
  total: '여러 단원을 아우르는 총괄 테스트',
}

export default function TestPrep() {
  const [tab, setTab] = useState('entrance')
  const label = TABS.find(t => t.key === tab)!.label
  return (
    <div>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      <Placeholder title={label}
        original={[DESC[tab], '학년 필터(초1~고1) + 문제수·난이도 표기 세트 목록']}
        plan="문제은행이 충분해지면 학년별 표준 세트를 미리 만들어 배치. 지금은 학습지 만들기에서 태그(입학/주간/단원/총괄 TEST)로 직접 생성 가능." />
    </div>
  )
}
