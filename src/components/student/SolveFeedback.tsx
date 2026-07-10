import { useMemo, useRef, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Problem } from '../../types'

// 학생앱: 문항별 "풀이 쓰고 AI 피드백 받기" (사진 업로드 + 직접 필기 둘 다)
// 정답을 알려주지 않고 풀이 과정을 채점/힌트. 서버리스 /api/solve-feedback (Claude 비전) 호출.
export default function SolveFeedback({ studentId, worksheetId, problem }: {
  studentId: string; worksheetId: string; problem: Problem
}) {
  const { solveFeedbacks, saveSolveFeedback } = useStore()
  const fbId = `${studentId}_${worksheetId}_${problem.id}`
  const saved = useMemo(() => solveFeedbacks.find(f => f.id === fbId), [solveFeedbacks, fbId])

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'photo' | 'draw'>('draw')
  const [img, setImg] = useState<{ dataUrl: string; mediaType: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // ── 사진 업로드 ──
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setImg({ dataUrl: String(r.result), mediaType: f.type || 'image/jpeg' })
    r.readAsDataURL(f)
  }

  // ── 필기 캔버스 ──
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  function ctx() { return canvasRef.current?.getContext('2d') ?? null }
  function xy(e: React.PointerEvent) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function down(e: React.PointerEvent) {
    e.preventDefault(); const g = ctx(); if (!g) return
    drawing.current = true; dirty.current = true
    g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = '#16324f'
    const { x, y } = xy(e); g.beginPath(); g.moveTo(x, y)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return
    const g = ctx(); if (!g) return
    const { x, y } = xy(e); g.lineTo(x, y); g.stroke()
  }
  function up() { drawing.current = false }
  function clearCanvas() {
    const c = canvasRef.current, g = ctx(); if (!c || !g) return
    g.clearRect(0, 0, c.width, c.height); dirty.current = false
  }

  function currentImage(): { dataUrl: string; mediaType: string } | null {
    if (mode === 'photo') return img
    if (!dirty.current || !canvasRef.current) return null
    // 흰 배경 위에 필기 합성 (투명 배경이면 인식이 어려움)
    const c = canvasRef.current
    const off = document.createElement('canvas'); off.width = c.width; off.height = c.height
    const g = off.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, off.width, off.height); g.drawImage(c, 0, 0)
    return { dataUrl: off.toDataURL('image/png'), mediaType: 'image/png' }
  }

  async function submit() {
    const image = currentImage()
    if (!image) { setErr(mode === 'photo' ? '먼저 사진을 올려주세요.' : '먼저 풀이를 써주세요.'); return }
    setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/solve-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.dataUrl, mediaType: image.mediaType,
          problemText: (problem as any).q ?? (problem as any).question ?? undefined,
          answer: problem.answer,
        }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        setErr(r.status === 503 ? '선생님이 AI 피드백을 아직 켜지 않았어요.' : (e.error || '피드백을 받지 못했어요. 잠시 후 다시 시도해주세요.'))
        setBusy(false); return
      }
      const j = await r.json()
      saveSolveFeedback({
        id: fbId, studentId, worksheetId, problemId: problem.id,
        hasWork: j.hasWork !== false, correct: j.correct ?? null, feedback: String(j.feedback ?? ''),
        at: new Date().toISOString(),
      })
      setBusy(false)
    } catch {
      setErr('네트워크 오류예요. 잠시 후 다시 시도해주세요.'); setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-paper2/40 p-2.5">
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between text-left text-sm font-bold text-pine-dark">
        <span>✏️ 풀이 쓰고 AI 피드백 받기</span>
        <span className="text-xs text-ink2">{open ? '▲' : '▼'}</span>
      </button>

      {saved && !open && (
        <div className="mt-1.5 rounded-lg bg-white px-3 py-2 text-xs text-ink2">
          {saved.hasWork ? '' : '⚠️ 풀이 과정이 필요해요 · '}이전 피드백 있음 — 펼쳐서 확인
        </div>
      )}

      {open && (
        <div className="mt-2">
          <div className="mb-2 flex gap-1 text-xs font-bold">
            {(['draw', 'photo'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 ${mode === m ? 'bg-pine text-paper' : 'border border-line text-ink2'}`}>
                {m === 'draw' ? '✍️ 직접 쓰기' : '📷 사진 올리기'}
              </button>
            ))}
          </div>

          {mode === 'draw' ? (
            <div>
              <canvas ref={canvasRef} width={640} height={360}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
                className="w-full touch-none rounded-lg border border-line bg-white"
                style={{ aspectRatio: '16 / 9' }} />
              <div className="mt-1 text-right">
                <button onClick={clearCanvas} className="text-xs text-ink2 underline">지우고 다시</button>
              </div>
            </div>
          ) : (
            <div>
              <input type="file" accept="image/*" capture="environment" onChange={onFile}
                className="block w-full text-sm" />
              {img && <img src={img.dataUrl} alt="내 풀이" className="mt-2 max-h-60 rounded-lg border border-line" />}
            </div>
          )}

          {err && <p className="mt-2 text-xs text-clay">{err}</p>}
          <button onClick={submit} disabled={busy}
            className="mt-2 w-full rounded-lg bg-pine py-2 text-sm font-bold text-paper hover:brightness-105 disabled:opacity-60">
            {busy ? 'AI가 풀이를 확인하는 중…' : 'AI 피드백 받기'}
          </button>

          {saved && (
            <div className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${saved.hasWork ? 'border-pine/40 bg-pine-soft/40' : 'border-amber bg-amber-soft/50'}`}>
              <div className="mb-1 text-xs font-bold text-ink2">
                {saved.hasWork
                  ? (saved.correct === true ? '✅ 풀이 확인' : saved.correct === false ? '📝 다시 볼 부분이 있어요' : '📝 풀이 피드백')
                  : '⚠️ 풀이 과정을 써 주세요'}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{saved.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
