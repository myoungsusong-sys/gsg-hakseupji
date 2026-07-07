import { useState } from 'react'
import SubTabs from '../components/SubTabs'
import Placeholder from '../components/Placeholder'
import Workbooks from './Workbooks'

// 교재 — 매쓰플랫과 동일한 탭(시그니처/내 교재/시중교재) + 우리 오답 드릴용 '정답표' 흡수
const TABS = [
  { key: 'signature', label: '시그니처 교재' },
  { key: 'mine', label: '내 교재' },
  { key: 'market', label: '시중교재' },
  { key: 'answerkey', label: '정답표(채점용)' },
]

export default function Materials() {
  const [tab, setTab] = useState('answerkey')
  return (
    <div>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'signature' && <Placeholder title="시그니처 교재"
        original={['학원 로고를 담은 커스텀 교재(개념서·연산서 등) 제작·표지 편집·구매']}
        plan="자체 교재(수력충전·명수쌤 노트)를 표지 커스텀으로 묶어 인쇄본으로 낼 때 활성화." />}
      {tab === 'mine' && <Placeholder title="내 교재"
        original={['직접 만들어 저장한 교재 모음']}
        plan="학습지를 교재 단위로 묶어 저장하는 기능으로 확장." />}
      {tab === 'market' && <Placeholder title="시중교재"
        original={['시중 교재 목록 → 페이지 지정 출제 (쌍둥이 지원)']}
        plan="시중교재 문제는 저작권이라 수록하지 않습니다. 대신 오른쪽 정답표에 문항→유형·정답을 등록해 채점·드릴에 활용합니다." />}
      {tab === 'answerkey' && <Workbooks />}
    </div>
  )
}
