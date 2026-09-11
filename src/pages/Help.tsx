import { useMemo, useState } from 'react'
import { MANUALS, type Role } from '../data/manual'

// 사용설명서 화면 — 선생님/원장은 /help, 학생앱은 /student/help 에서 같은 컴포넌트를 쓴다.
// 종이로도 나눠줄 수 있게 [설명서 내려받기](.md)와 [인쇄]를 함께 둔다.
export default function Help({ only }: { only?: Role }) {
  const list = useMemo(() => (only ? MANUALS.filter(m => m.role === only) : MANUALS), [only])
  const [role, setRole] = useState<Role>(list[0].role)
  const [openAll, setOpenAll] = useState(true)
  const cur = list.find(m => m.role === role) ?? list[0]

  // 화면에 보이는 그대로를 파일로 — 원본이 하나라 설명서와 앱이 어긋나지 않는다
  function download() {
    const lines: string[] = [`# 깊은생각 학습지앱 — ${cur.label} 사용설명서`, '', cur.summary, '']
    for (const s of cur.sections) {
      lines.push(`## ${s.title}`, '')
      if (s.intro) lines.push(s.intro, '')
      for (const st of s.steps) {
        lines.push(`### ${st.q}`, '')
        st.a.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
        lines.push('')
      }
    }
    lines.push('---', `만든 날짜: ${new Date().toLocaleDateString('ko-KR')}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `학습지앱_사용설명서_${cur.label}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">📖 사용법</h1>
        <div className="grow" />
        <button onClick={() => setOpenAll(v => !v)}
          className="no-print rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2">
          {openAll ? '모두 접기' : '모두 펼치기'}
        </button>
        <button onClick={download}
          className="no-print rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink2 hover:bg-paper2">
          ⬇ 파일로 받기
        </button>
        <button onClick={() => window.print()}
          className="no-print rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-paper hover:brightness-110">
          🖨 인쇄
        </button>
      </div>

      {list.length > 1 && (
        <div className="no-print mb-5 flex flex-wrap gap-2">
          {list.map(m => (
            <button key={m.role} onClick={() => setRole(m.role)}
              className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                role === m.role ? 'border-pine bg-pine text-paper' : 'border-line bg-white text-ink2 hover:bg-paper2'}`}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      )}

      <p className="mb-6 rounded-xl bg-paper2/60 px-4 py-3 text-sm text-ink2">{cur.summary}</p>

      {cur.sections.map((s, si) => (
        <section key={si} className="mb-7">
          <h2 className="mb-1 border-b border-line pb-1.5 text-lg font-black text-pine-dark">{s.title}</h2>
          {s.intro && <p className="mb-3 mt-2 text-sm text-ink2">{s.intro}</p>}
          <div className="mt-3 grid gap-2.5">
            {s.steps.map((st, i) => (
              <details key={i} open={openAll} className="rounded-xl border border-line bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold">{st.q}</summary>
                <ol className="mt-2.5 grid gap-1.5 pl-1">
                  {st.a.map((a, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-relaxed">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-soft text-[11px] font-bold text-pine-dark">{j + 1}</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-8 text-center text-xs text-ink2">
        기능이 바뀌면 이 설명서도 함께 업데이트됩니다 · 위쪽 📋에서 변경 내역을 볼 수 있어요
      </p>
    </div>
  )
}
