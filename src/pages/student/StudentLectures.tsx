import { useState } from 'react'

// ── 강의 탭 (매쓰플랫 학생앱 강의 구조 — 상태 탭 + 표) ─────────────
// 아직 강의 콘텐츠가 없어 빈 상태만 제공한다. (명수쌤 강의 영상이 연결되면 활성화)

const TABS = ['전체', '학습가능', '학습중', '학습완료'] as const

export default function StudentLectures() {
  const [tab, setTab] = useState<typeof TABS[number]>('전체')

  return (
    <div>
      <h1 className="mb-4 text-xl font-black">강의</h1>

      <div className="mb-4 flex gap-1.5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-pine text-paper' : 'border border-line bg-white text-ink2 hover:text-ink'}`}>
            {t} 0
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink2">
              <th className="px-4 py-2.5">출제일</th>
              <th className="py-2.5">단원명</th>
              <th className="py-2.5">강의명</th>
              <th className="py-2.5">시청기한</th>
              <th className="py-2.5">상태</th>
              <th className="py-2.5 pr-4">학습하기</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-14 text-center text-sm text-ink2">
                선생님이 출제한 강의가 없습니다.
                <div className="mt-1.5 text-xs text-ink2/70">
                  선생님이 강의(풀이 영상 숙제)를 내주시면 여기에서 볼 수 있어요. 지금 준비 중이에요.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
