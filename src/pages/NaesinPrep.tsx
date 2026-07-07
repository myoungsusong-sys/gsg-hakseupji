import { useState } from 'react'
import SubTabs from '../components/SubTabs'
import Placeholder from '../components/Placeholder'

// 내신 대비 — 매쓰플랫과 동일 3탭
const TABS = [
  { key: 'hall', label: '내신관' },
  { key: 'textbook', label: '내신 대비 교과서' },
  { key: 'recommend', label: '내신 대비 추천' },
]

export default function NaesinPrep() {
  const [tab, setTab] = useState('hall')
  return (
    <div>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'hall' && <Placeholder title="내신관"
        original={['학교별 시험 범위·일정에 맞춘 내신 대비 자료 허브']}
        plan="학교별 기출 DB가 쌓이면 학교·범위별 내신 세트를 모아 제공." />}
      {tab === 'textbook' && <Placeholder title="내신 대비 교과서"
        original={['출판사별 교과서 문제를 단원 단위로 출제']}
        plan="교과서 문제는 저작권 자료라 미수록. 교육과정 유형에 맞춰 자체 문제로 대체." />}
      {tab === 'recommend' && <Placeholder title="내신 대비 추천"
        original={['학생 취약 유형·학교 출제 경향 기반 추천 학습지']}
        plan="채점·오답 데이터(오답 드릴 루프)가 쌓이면 학생별 내신 추천으로 연결." />}
    </div>
  )
}
