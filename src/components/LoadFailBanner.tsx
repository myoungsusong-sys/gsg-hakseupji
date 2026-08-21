import { useStore } from '../lib/store'

// ── ⚠️ 「못 읽었다」를 선생님에게 알린다 ────────────────────────────────────────
//
// 왜 만들었나 (2026-08-21 명수쌤): "김준우 수학 답 입력했던 내역이 다 또 없어졌어."
// 클라우드 읽기가 실패하면 그 표가 빈 배열로 내려왔고, 앱은 그걸 «없는 것»으로 알고
// 화면과 localStorage 를 덮어썼다. 선생님 눈에는 채점이 사라진 것으로 보인다.
//
// 🔴 이제 실패한 표는 덮어쓰지 않는다(store.fromCloud). 그래도 **조용히 넘기면 안 된다** —
//    선생님이 "사라졌네" 하고 다시 채점하면 그게 진짜 유실을 만든다.
//    화면에 «못 읽었다»라고 분명히 말하고, 새로고침을 권한다.

const LABEL: Record<string, string> = {
  gradings: '채점 기록', students: '학생', worksheets: '학습지', workbooks: '교재',
  wbItems: '교재 문항', customProblems: '문제', myLists: '내 목록',
  dailyNotes: '수업 기록', settings: '설정·출제',
}

export default function LoadFailBanner() {
  const { loadFail } = useStore()
  if (!loadFail) return null
  const names = Object.keys(loadFail).map(k => LABEL[k] ?? k)
  if (!names.length) return null
  return (
    <div className="sticky top-0 z-50 border-b border-clay/50 bg-red-50 px-4 py-2 text-sm">
      <b className="text-clay">⚠️ {names.join(' · ')}을(를) 서버에서 못 읽었습니다.</b>{' '}
      <span className="text-ink2">
        데이터가 지워진 것이 <b className="text-ink">아닙니다</b> — 화면이 갱신되지 않았을 뿐입니다.
        <b className="text-ink"> 다시 채점하지 마시고</b> 새로고침해 주세요.
      </span>
      <button onClick={() => location.reload()}
        className="ml-2 rounded-lg bg-clay px-3 py-1 text-xs font-bold text-white hover:brightness-110">
        새로고침
      </button>
    </div>
  )
}
