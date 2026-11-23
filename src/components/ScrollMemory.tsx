import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * 뒤로 가기 때 «보던 자리»로 돌아오게 한다 (2026-11-23 윤자혜 «전단계로 돌아가려고 하면 항상 위 화면으로»).
 * 화면(주소)마다 스크롤 위치를 기억해 두었다가, 뒤로/앞으로 가기(POP)로 들어오면 그 위치로 되돌린다.
 * 다른 화면으로 들어갈 때(PUSH)는 맨 위에서 시작하고, 같은 화면 안의 탭·학생 바꿈은 스크롤을 그대로 둔다. 내용이 늦게 불러와져도 몇 번 다시 맞춘다.
 */
const mem = (key: string) => `scroll:${key}`
export default function ScrollMemory() {
  const loc = useLocation()
  const type = useNavigationType()
  const keyRef = useRef(loc.key)
  const pathRef = useRef(loc.pathname)
  // 새 주소로 바뀐 직후(그리려진 뒤)부터 그 주소의 키로 저장한다 — 이전 화면의 값은 건드리지 않는다
  useLayoutEffect(() => { keyRef.current = loc.key }, [loc.key])
  useEffect(() => {
    const save = () => { try { sessionStorage.setItem(mem(keyRef.current), String(window.scrollY)) } catch { /* 무시 */ } }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [])
  useEffect(() => {
    const pathChanged = pathRef.current !== loc.pathname
    pathRef.current = loc.pathname
    let want = 0
    if (type === 'POP') { try { want = Number(sessionStorage.getItem(mem(loc.key))) || 0 } catch { /* 무시 */ } }
    if (!want) { if (type !== 'POP' && pathChanged) window.scrollTo(0, 0); return }
    const timers = [0, 120, 400, 900, 1800].map(ms => window.setTimeout(() => {
      if (Math.abs(window.scrollY - want) > 4) window.scrollTo(0, want)
    }, ms))
    return () => timers.forEach(clearTimeout)
  }, [loc.key, type])
  return null
}
