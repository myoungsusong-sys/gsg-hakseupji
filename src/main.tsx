import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { installErrorLog } from './lib/errorLog'
import { isStaleChunkError } from './lib/staleChunk'

installErrorLog()   // 🛠 AI 점검이 쓸 오류·화면이동 기록 시작 (개인정보 없음)

// 🔴 새 배포 뒤 열어 둔 탭이 사라진 옛 청크를 부를 때의 전역 안전망.
//    Vite 가 청크 로딩에 실패하면 window 에 'vite:preloadError' 를 쏜다. 그때 영문 오류 대신
//    "새로고침하면 됩니다"로 안내한다 — 실제로 새로고침 한 번이면 끝나는 일이다.
//    (호출부에서 개별로 잡는 곳도 있다: WorksheetView 의 PDF 조판기)
//    ⚠️ 자동 새로고침 금지 — 채점 도중 리로드되면 진행이 날아간다. 반드시 물어본다.
window.addEventListener('vite:preloadError', (e: Event) => {
  e.preventDefault()          // Vite 기본 동작(오류 재던지기)을 막고 우리가 안내한다
  if (confirm(
    '새 버전이 배포되어 지금 열어 둔 화면이 오래됐어요.\n' +
    '새로고침하면 정상으로 돌아옵니다.\n\n지금 새로고침할까요?',
  )) location.reload()
})

// 이벤트를 안 쏘는 경로(직접 import().catch) 대비 — 처리되지 않은 거부도 같은 기준으로 본다
window.addEventListener('unhandledrejection', ev => {
  if (!isStaleChunkError(ev.reason)) return
  ev.preventDefault()
  if (confirm(
    '새 버전이 배포되어 지금 열어 둔 화면이 오래됐어요.\n' +
    '새로고침하면 정상으로 돌아옵니다.\n\n지금 새로고침할까요?',
  )) location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
