import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { Problem } from '../types'

// ── 학교별 기출 (2026-11-07) ─────────────────────────────────────
// 학원이 «나의 DB» 에 올린 학교 시험지(출처 이름에 학교·중간·기말·기출이 든 묶음)를 학교별로 모아 보인다.
// 학원 주소(내 정보 > 교육기관 주소)와 같은 시·군·구 학교가 먼저, 이어서 같은 시·도, 나머지는 가나다순.
// 학교 주소는 교육청 공개 학교정보(open.neis.go.kr)에서 한 번 찾아 이 기기에 기억해 둔다.

const ADDR_CACHE = 'hj_school_addr_v1'

interface SchoolGroup {
  school: string
  level: '초' | '중' | '고' | '?'
  sets: { source: string; problems: Problem[]; year?: string; term?: string }[]
}

function isExamSource(src: string) {
  return /학교|기출|중간|기말|모의/.test(src)
}
function schoolOf(src: string): string | null {
  const m = src.match(/([가-힣A-Za-z0-9]+?(?:초등학교|중학교|고등학교|여자중학교|여자고등학교|초|중|고|여중|여고))(?=[\s_·\-()\[\]0-9]|$)/)
  if (!m) return null
  let n = m[1]
  if (/여중$/.test(n)) n = n.replace(/여중$/, '여자중학교')
  else if (/여고$/.test(n)) n = n.replace(/여고$/, '여자고등학교')
  else if (/초$/.test(n)) n = n.replace(/초$/, '초등학교')
  else if (/중$/.test(n)) n = n.replace(/중$/, '중학교')
  else if (/고$/.test(n)) n = n.replace(/고$/, '고등학교')
  return n
}
function levelOf(n: string): SchoolGroup['level'] {
  return /초등학교$/.test(n) ? '초' : /중학교$/.test(n) ? '중' : /고등학교$/.test(n) ? '고' : '?'
}
/** «충청남도 홍성군 홍북읍 …» → ['충청남도', '홍성군'] — 시·도 이름은 줄임말도 맞춘다 */
function regionOf(addr: string): [string, string] {
  const t = addr.replace(/\s+/g, ' ').trim().split(' ')
  const 시도줄임: Record<string, string> = { 서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: '광주광역시', 대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시', 경기: '경기도', 강원: '강원특별자치도', 충북: '충청북도', 충남: '충청남도', 전북: '전북특별자치도', 전남: '전라남도', 경북: '경상북도', 경남: '경상남도', 제주: '제주특별자치도' }
  let 시도 = t[0] ?? ''
  for (const [k, v] of Object.entries(시도줄임)) if (시도 === k || 시도.startsWith(k)) { 시도 = v; break }
  return [시도, t[1] ?? '']
}
function loadCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ADDR_CACHE) || '{}') } catch { return {} }
}

export default function SchoolTest() {
  const { customProblems, academyProfile } = useStore()
  const nav = useNavigate()
  const [lv, setLv] = useState<'전체' | '초' | '중' | '고'>('전체')
  const [q, setQ] = useState('')
  const [addr, setAddr] = useState<Record<string, string>>(loadCache)

  const groups = useMemo<SchoolGroup[]>(() => {
    const bySrc = new Map<string, Problem[]>()
    for (const p of customProblems) {
      const s = p.source || ''
      if (!s || !isExamSource(s)) continue
      bySrc.set(s, [...(bySrc.get(s) ?? []), p])
    }
    const bySchool = new Map<string, SchoolGroup>()
    for (const [source, problems] of bySrc) {
      const school = schoolOf(source) ?? '학교 미지정'
      const g = bySchool.get(school) ?? { school, level: levelOf(school), sets: [] }
      g.sets.push({ source, problems, year: source.match(/20\d\d/)?.[0], term: source.match(/[12]\s*학기|중간|기말/g)?.join(' ') })
      bySchool.set(school, g)
    }
    return [...bySchool.values()]
  }, [customProblems])

  // 학교 주소 찾기 — 아직 모르는 학교만, 한 번에 하나씩(공개 API 예의)
  useEffect(() => {
    const todo = groups.map(g => g.school).filter(n => n !== '학교 미지정' && !(n in addr))
    if (!todo.length) return
    let stop = false
    ;(async () => {
      for (const n of todo.slice(0, 30)) {
        if (stop) return
        try {
          const r = await fetch(`https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=5&SCHUL_NM=${encodeURIComponent(n)}`)
          const j = await r.json()
          const rows: { SCHUL_NM: string; ORG_RDNMA: string }[] = j?.schoolInfo?.[1]?.row ?? []
          const 내지역 = regionOf(academyProfile.address ?? '')
          // 같은 이름 학교가 여러 곳이면 학원과 같은 시·도의 학교를 고른다
          const hit = rows.find(x => x.SCHUL_NM === n && regionOf(x.ORG_RDNMA)[0] === 내지역[0])
            ?? rows.find(x => x.SCHUL_NM === n) ?? rows[0]
          setAddr(prev => {
            const next = { ...prev, [n]: hit?.ORG_RDNMA ?? '' }
            try { localStorage.setItem(ADDR_CACHE, JSON.stringify(next)) } catch { /* 기억 실패는 무시 */ }
            return next
          })
        } catch { /* 찾기 실패 — 다음에 다시 */ return }
      }
    })()
    return () => { stop = true }
  }, [groups, addr, academyProfile.address])

  const 내 = regionOf(academyProfile.address ?? '')
  const rank = (n: string) => {
    if (!academyProfile.address) return 2
    const [a, b] = regionOf(addr[n] ?? '')
    if (a && a === 내[0] && b && b === 내[1]) return 0   // 같은 시·군·구
    if (a && a === 내[0]) return 1                        // 같은 시·도
    return 2
  }
  const shown = groups
    .filter(g => (lv === '전체' || g.level === lv) && (!q.trim() || g.school.includes(q.trim()) || g.sets.some(s => s.source.includes(q.trim()))))
    .sort((a, b) => rank(a.school) - rank(b.school) || a.school.localeCompare(b.school, 'ko'))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-black">학교별 기출</h2>
        <span className="text-xs text-ink2">
          {academyProfile.address
            ? <>📍 {내.filter(Boolean).join(' ')} 학교가 먼저 보여요</>
            : <>📍 내 정보 &gt; 교육기관 주소를 넣으면 우리 지역 학교가 먼저 보여요</>}
        </span>
        <div className="grow" />
        {(['전체', '초', '중', '고'] as const).map(k => (
          <button key={k} onClick={() => setLv(k)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${lv === k ? 'border-pine bg-pine-soft text-pine-dark' : 'border-line text-ink2'}`}>
            {k === '전체' ? '전체' : k + '등'}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="학교명·시험지명"
          className="w-44 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-pine" />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink2">
          아직 올린 학교 기출이 없어요.<br />
          학습지 &gt; 나의 DB 에서 시험지를 올릴 때 자료 이름을 «○○중 2026 2학기 기말» 처럼 학교 이름을 넣어 주시면 여기에 학교별로 모입니다.
          <div className="mt-4">
            <button onClick={() => nav('/prep/worksheet?tab=db')} className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">나의 DB 로 가기</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map(g => {
            const r = rank(g.school)
            return (
              <section key={g.school} className="rounded-2xl border border-line bg-white p-4">
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <b>{g.school}</b>
                  {r === 0 && <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">우리 지역</span>}
                  {r === 1 && <span className="rounded bg-paper2 px-1.5 py-0.5 text-[10px] font-bold text-ink2">인근</span>}
                  <span className="text-xs text-ink2">{addr[g.school] || ''}</span>
                  <div className="grow" />
                  <span className="text-xs text-ink2">시험지 {g.sets.length}개 · {g.sets.reduce((n, s) => n + s.problems.length, 0)}문항</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.sets.sort((a, b) => (b.year ?? '').localeCompare(a.year ?? '') || a.source.localeCompare(b.source, 'ko')).map(s => (
                    <button key={s.source} onClick={() => nav(`/prep/worksheet?tab=db&set=${encodeURIComponent(s.source)}`)}
                      className="rounded-lg border border-line px-3 py-1.5 text-left text-sm hover:border-pine hover:bg-pine-soft/40">
                      {s.source} <span className="text-xs text-ink2">· {s.problems.length}문항</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
