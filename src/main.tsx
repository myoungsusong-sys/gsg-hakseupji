import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { installErrorLog } from './lib/errorLog'

installErrorLog()   // 🛠 AI 점검이 쓸 오류·화면이동 기록 시작 (개인정보 없음)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
