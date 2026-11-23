import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * 화면 상태(탭·학생·그룹 …)를 주소의 쿼리(#/경로?키=값)에 남긴다 (2026-11-23 윤자혜 «전단계로 돌아가려고 하면 항상 위 화면으로»).
 * 값이 바뀔 때마다 브라우저 기록(history)에 한 칸씩 쌓이므로 «뒤로 가기»가 직전에 보던 탭·학생으로 돌아온다.
 * 기본값은 주소에 적지 않는다(깔끔하게 유지). replace=true 는 기록을 쌓지 않고 자리만 바꾼다(자동 보정용).
 */
export type UrlPatch = Record<string, string | null | undefined>

export function useUrlParams() {
  const [qs, setQs] = useSearchParams()
  const patch = useCallback((p: UrlPatch, replace = false) => {
    setQs(prev => {
      const n = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(p)) { if (v == null || v === '') n.delete(k); else n.set(k, v) }
      return n
    }, { replace })
  }, [setQs])
  return { qs, patch }
}

/** 탭 하나짜리 상태 — 값이 기본값이면 주소에서 뺀다 */
export function useUrlTab<T extends string>(key: string, def: T, valid?: readonly T[]): [T, (v: T, replace?: boolean) => void] {
  const { qs, patch } = useUrlParams()
  const raw = qs.get(key) as T | null
  const value = raw && (!valid || valid.includes(raw)) ? raw : def
  const set = useCallback((v: T, replace = false) => patch({ [key]: v === def ? null : v }, replace), [patch, key, def])
  return [value, set]
}
