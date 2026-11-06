import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import WorksheetList from './WorksheetList'
import MyDb from './MyDb'

type Tab = 'mine' | 'db' | 'favorites' | 'trash'

// 매쓰플랫 학습지 화면과 동일한 4탭 골격
export default function WorksheetPage() {
  // ?tab=db&set=<자료> — 학교별 기출 등에서 나의 DB 의 자료 하나를 바로 연다 (2026-11-07)
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (['mine', 'db', 'favorites', 'trash'].includes(sp.get('tab') ?? '') ? sp.get('tab') as Tab : 'mine'))
  return (
    <div>
      <div className="mb-6 flex gap-8 border-b border-line px-1">
        {([['mine', '내 학습지'], ['db', '나의 DB'], ['favorites', '즐겨찾는 문제'], ['trash', '학습지 휴지통']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            // 매쓰플랫 실측: 탭 16px/700. 우리 --text-base 는 본문 기준 14px 이라 명시 지정한다.
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[16px] font-bold transition ${
              tab === k ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'mine' && <WorksheetList view="active" />}
      {tab === 'db' && <MyDb initialSet={sp.get('set') ?? undefined} />}
      {tab === 'favorites' && <WorksheetList view="favorites" />}
      {tab === 'trash' && <WorksheetList view="trash" />}
    </div>
  )
}
