import { useMemo, useState } from 'react'
import SubTabs from '../components/SubTabs'
import Placeholder from '../components/Placeholder'
import Workbooks from './Workbooks'
import { WB_MATCH_BOOKS } from '../data/wbMatch'
import { useStore } from '../lib/store'

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
      {tab === 'market' && <MarketCatalog />}
      {tab === 'answerkey' && <Workbooks />}
    </div>
  )
}

// 시중교재 라이브러리 (매쓰플랫 구조: 행 = 학년|교재명|출판사|등록) — 문항→유형 매칭 719종
function MarketCatalog() {
  const { workbooks, addWorkbook } = useStore()
  const [level, setLevel] = useState<'전체' | '중' | '고'>('전체')
  const [q, setQ] = useState('')
  const registered = useMemo(() => new Set(workbooks.map(w => w.matchKey).filter(Boolean)), [workbooks])

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return WB_MATCH_BOOKS.filter(b => {
      if (level === '중' && !b.grade.startsWith('중')) return false
      if (level === '고' && b.grade.startsWith('중')) return false
      if (kw && !b.name.toLowerCase().includes(kw) && !b.publisher.toLowerCase().includes(kw)) return false
      return true
    })
  }, [level, q])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['전체', '중', '고'] as const).map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${level === l ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:bg-paper2'}`}>{l}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="교재명·출판사 검색"
          className="w-64 rounded-lg border border-line px-3 py-2 text-sm" />
        <span className="text-sm text-ink2">{list.length}종 · 문항별 유형 자동 매칭</span>
      </div>
      <div className="max-h-[65vh] overflow-y-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-paper2">
            <tr className="text-left text-xs text-ink2">
              <th className="px-4 py-2.5">학년</th><th>교재명</th><th>출판사</th><th className="text-right">문항 수</th><th className="pr-4 text-right">등록</th>
            </tr>
          </thead>
          <tbody>
            {list.map(b => {
              const has = registered.has(b.key)
              return (
                <tr key={b.key} className="border-t border-line/60">
                  <td className="px-4 py-2 text-ink2">{b.grade}</td>
                  <td className="font-semibold">{b.name}</td>
                  <td className="text-ink2">{b.publisher}</td>
                  <td className="text-right text-ink2">{b.count.toLocaleString()}</td>
                  <td className="pr-4 text-right">
                    {has ? <span className="text-xs text-ink2">등록됨</span> : (
                      <button onClick={() => addWorkbook({ name: b.name, publisher: b.publisher, grade: b.grade, matchKey: b.key })}
                        className="rounded-lg bg-pine px-3 py-1 text-xs font-bold text-paper">등록</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink2">등록하면 수업 → 교재에서 바로 OX채점할 수 있고, 틀린 유형의 쌍둥이·유사 문제로 오답 학습지가 만들어집니다. (문제 원문·정답은 저장하지 않습니다)</p>
    </div>
  )
}
