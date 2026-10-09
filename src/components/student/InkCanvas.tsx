import { useEffect, useRef } from 'react'
import * as pencil from '../../lib/pencilSound'

// 문제 위 필기 — 학습지 풀이(StudentSolve)와 승강제(MasteryRunner)가 같은 것을 쓴다.
// 2026-10-09 승강제에 필기가 없어 StudentSolve 에서 옮겨 왔다(내용은 그대로).

// 펜 설정 (매쓰플랫 동일 — 굵기 5·색 5)
export const PEN_SIZES = [1.5, 2.5, 3.5, 5, 7]
export const PEN_COLORS = ['#1c1917', '#3b82f6', '#22c55e', '#f59e0b', '#f472b6']

// pts = [x, y, 필압?] — x·y 는 0~1 정규화(리사이즈에도 유지), 필압은 0~1.
// 🔴 필압은 **선택**이다. 옛 획은 [x,y] 두 개뿐이고 읽는 쪽이 전부 [x,y]만 꺼내 쓰므로
//    그대로 산다(GroupPanel 읽기전용 오버레이·exportWork 제출 합성 둘 다 확인).
export interface Stroke { color: string; size: number; erase?: boolean; pts: [number, number, number?][] }

// ── 필기 캔버스 — 문제 본문 위 오버레이 (스트로크 0~1 정규화 좌표로 저장 → 리사이즈에도 유지) ──
//
// 🔴 필기가 뻑뻑하던 원인 넷을 한꺼번에 고쳤다 (2026-08-19 명수쌤 "부드럽게 필기가 안돼").
//  ① **획 하나 그을 때마다 화면의 모든 획을 다시 그렸다.** pointermove 마다 redraw() 가
//     strokes 전체를 처음부터 칠했다 → 필기가 쌓일수록 점점 느려진다(획 수에 비례).
//     → 캔버스를 둘로 나눈다. 확정된 획(base)은 strokes 가 바뀔 때만 그리고,
//       지금 긋는 획(live)은 자기 것만 지웠다 다시 그린다. 항상 1획치 비용이다.
//  ② **펜 샘플을 버리고 있었다.** 태블릿·아이패드는 화면 주사율보다 빠르게 펜을 읽어
//     여러 점을 한 pointermove 에 묶어 보낸다(coalesced). 그걸 안 꺼내 쓰면 중간 점이
//     통째로 버려져 빠르게 그을수록 각지고 끊긴다. → getCoalescedEvents() 로 전부 받는다.
//  ③ **점끼리 직선으로 이었다.** → 중점을 지나는 2차 베지에로 이어 곡선으로 만든다.
//  ④ **useEffect(() => redraw()) 에 의존성이 없어** 부모가 리렌더될 때마다(답 입력·타이머)
//     전체를 다시 칠했다. → strokes 가 바뀔 때만.
//
// 지우개는 base 에 직접 destination-out 으로 긋는다 — live 층에 그리면 빈 층만 지운다.
export default function InkCanvas({ strokes, live, tool, color, size, handWrite, onCommit, children }: {
  strokes: Stroke[]
  live: boolean                      // false면 표시·입력 모두 잠금(👁 숨김)
  tool: 'none' | 'pen' | 'eraser'   // 'none' = 아직 안 고름 → 입력을 받지 않는다
  color: string
  size: number
  handWrite: boolean                 // false면 스타일러스(pointerType 'pen')만
  onCommit: (s: Stroke) => void
  children: React.ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)    // 확정된 획
  const liveRef = useRef<HTMLCanvasElement>(null)    // 지금 긋는 획 하나
  const drawing = useRef<Stroke | null>(null)
  const grainRef = useRef<HTMLCanvasElement | null>(null)   // 연필 입자 타일 — 한 번만 만든다

  // 캔버스 크기를 박스에 맞춘다(고해상도 화면 대응). 크기가 그대로면 아무것도 안 한다.
  function fit(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
    const box = boxRef.current
    if (!canvas || !box) return null
    const w = box.clientWidth, h = box.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return ctx
  }
  // ── 한 획 그리기 — 「선」이 아니라 「면」으로 그린다 ───────────────────────
  //
  // 🔴 왜 면인가 (2026-08-19 명수쌤 "실제 연필 질감으로 조금더 부드럽고 끊이지 않게").
  //    굵기가 변하는 획을 선(stroke)으로 그리려면 구간을 나눠 여러 번 그어야 하는데,
  //    그러면 이음매마다 둥근 끝이 겹쳐 **마디가 보이고 끊긴 것처럼** 읽힌다.
  //    획의 양옆 가장자리를 계산해 **하나의 닫힌 면으로 한 번에 채우면** 이음매가 아예 없다.
  //
  // 부드러움은 세 겹으로 만든다:
  //    ① Chaikin(모서리 깎기)으로 손떨림을 걷어낸다 — 사람이 그은 선의 각을 둥글린다
  //    ② 굵기도 같이 부드럽게 이어 굵기가 계단처럼 튀지 않게 한다
  //    ③ 가장자리를 곡선(2차 베지에)으로 이어 면 자체를 매끄럽게 만든다
  //
  // 연필 질감은 **입자를 빼서** 만든다. 흑연은 종이 결에 고르게 안 묻는다 —
  // 획 안쪽만 잘라내 노이즈로 살짝 지우면 진짜 연필처럼 서걱해진다.

  // 손떨림 제거 — 모서리를 깎아 곡선으로. 점이 많으면 1번만(비용 관리).
  function chaikin(pts: [number, number, number?][], iters: number): [number, number, number?][] {
    let cur = pts
    for (let k = 0; k < iters; k++) {
      if (cur.length < 3) return cur
      const out: [number, number, number?][] = [cur[0]]
      for (let i = 0; i < cur.length - 1; i++) {
        const a = cur[i], b = cur[i + 1]
        const mix = (t: number, u: number, r: number) => t + (u - t) * r
        const pa = a[2], pb = b[2]
        const pr = (r: number) => (pa === undefined || pb === undefined ? (pa ?? pb) : mix(pa, pb, r))
        out.push([mix(a[0], b[0], 0.25), mix(a[1], b[1], 0.25), pr(0.25)])
        out.push([mix(a[0], b[0], 0.75), mix(a[1], b[1], 0.75), pr(0.75)])
      }
      out.push(cur[cur.length - 1])
      cur = out
    }
    return cur
  }

  // 연필 입자 — 한 번만 만들어 재사용한다
  function grain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (grainRef.current) return ctx.createPattern(grainRef.current, 'repeat')
    const c = document.createElement('canvas')
    c.width = c.height = 96
    const g = c.getContext('2d')
    if (!g) return null
    const img = g.createImageData(96, 96)
    for (let i = 0; i < img.data.length; i += 4) {
      // 성기게 흩뿌린 점 — 너무 촘촘하면 뿌옇게만 보이고 질감이 안 산다
      const on = Math.random() < 0.30 ? Math.random() * 255 : 0
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = on
    }
    g.putImageData(img, 0, 0)
    grainRef.current = c
    return ctx.createPattern(c, 'repeat')
  }

  function paint(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
    const raw = s.pts
    if (!raw.length) return
    const base = s.erase ? s.size * 5 : s.size

    // 지우개는 질감이 필요 없다 — 종전처럼 선으로 지운다(면으로 하면 가장자리가 튄다)
    if (s.erase) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'; ctx.lineWidth = base
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      raw.forEach(([x, y], i) => { const px = x * w, py = y * h; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) })
      if (raw.length === 1) ctx.lineTo(raw[0][0] * w + 0.01, raw[0][1] * h)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      return
    }

    // ① 손떨림 걷어내기 (긴 획은 1번만)
    // 🔵 2026-10-03 실측 — 이 「120점에서 2회→1회로 바뀌는 것」을 튐의 원인으로 의심해 고정해 봤는데
    //    **원인이 아니었다.** 같은 획에 2회와 1회를 각각 돌려 호길이로 맞춰 재니
    //    차이가 평균 0.01px · 최대 0.04px (800×600 기준)로 눈에 보이지 않는다.
    //    2회로 고정하면 점만 4배로 늘어 오히려 느려진다 → 원래대로 둔다. 다시 의심하지 마라.
    const sm = chaikin(raw, raw.length > 120 ? 1 : 2)
    const P = (i: number) => [sm[i][0] * w, sm[i][1] * h] as const
    // ② 굵기 — 필압 0.35~1.5배. 없으면 기본 굵기
    const wid = (i: number) => {
      const p = sm[i][2]
      return (p === undefined ? base : base * (0.35 + 1.15 * Math.min(1, Math.max(0, p)))) / 2   // 반폭
    }
    const n = sm.length

    if (n === 1) {
      const [x0, y0] = P(0)
      ctx.fillStyle = s.color
      ctx.beginPath(); ctx.arc(x0, y0, wid(0), 0, Math.PI * 2); ctx.fill()
      return
    }

    // ③ 양옆 가장자리를 만들어 하나의 면으로 — 이음매가 없다
    const L: [number, number][] = [], R: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const [x, y] = P(i)
      const [px, py] = P(Math.max(0, i - 1))
      const [nx, ny] = P(Math.min(n - 1, i + 1))
      let dx = nx - px, dy = ny - py
      const len = Math.hypot(dx, dy) || 1
      dx /= len; dy /= len
      const r = wid(i)
      L.push([x - dy * r, y + dx * r])
      R.push([x + dy * r, y - dx * r])
    }
    const edge = (arr: [number, number][], move: boolean) => {
      if (move) ctx.moveTo(arr[0][0], arr[0][1]); else ctx.lineTo(arr[0][0], arr[0][1])
      for (let i = 1; i < arr.length - 1; i++) {
        const [xa, ya] = arr[i], [xb, yb] = arr[i + 1]
        ctx.quadraticCurveTo(xa, ya, (xa + xb) / 2, (ya + yb) / 2)
      }
      const last = arr[arr.length - 1]
      ctx.lineTo(last[0], last[1])
    }
    ctx.beginPath()
    edge(L, true)
    // 끝을 둥글게 돌아 반대편으로
    const [ex, ey] = P(n - 1)
    ctx.arc(ex, ey, wid(n - 1), 0, Math.PI * 2)
    edge([...R].reverse(), false)
    const [sx, sy] = P(0)
    ctx.arc(sx, sy, wid(0), 0, Math.PI * 2)
    ctx.closePath()

    ctx.fillStyle = s.color
    ctx.fill()

    // ④ 연필 입자 — 획 안쪽만 잘라 노이즈로 살짝 지운다(흑연이 종이 결에 안 묻은 자리)
    const gp = grain(ctx)
    if (gp) {
      ctx.save()
      ctx.clip()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = 0.22
      ctx.fillStyle = gp
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }
  // 확정된 획 전체 — strokes 가 바뀔 때만 부른다
  function redrawBase() {
    const box = boxRef.current
    const ctx = fit(baseRef.current)
    if (!ctx || !box) return
    const w = box.clientWidth, h = box.clientHeight
    ctx.clearRect(0, 0, w, h)
    for (const s of strokes) paint(ctx, s, w, h)
  }

  // 지금 긋는 획만 — 매 pointermove 마다 부르지만 1획치라 싸다.
  // predicted = 브라우저가 예측한 앞쪽 점들. 화면에만 얹고 저장하지 않는다.
  const predicted = useRef<[number, number, number?][]>([])
  // 🔴 끊김 대책 — 한 프레임에 한 번만 칠한다.
  //    태블릿은 pointermove 를 초당 120회 넘게 보내고, 한 번에 좌표를 여러 개 묶어 보낸다.
  //    그때마다 획 전체를 다시 계산해 칠하면 획이 길어질수록 프레임을 놓쳐 선이 끊겨 보인다.
  const liveRaf = useRef(0)
  // 프레임마다 한 번만 — 이 사이에 들어온 move 는 좌표만 쌓이고 그리기는 묶인다
  function scheduleLive() {
    if (liveRaf.current) return
    liveRaf.current = requestAnimationFrame(() => { liveRaf.current = 0; redrawLive() })
  }

  function redrawLive() {
    const box = boxRef.current
    const ctx = fit(liveRef.current)
    if (!ctx || !box) return
    const w = box.clientWidth, h = box.clientHeight
    ctx.clearRect(0, 0, w, h)
    const d = drawing.current
    if (d && !d.erase) paint(ctx, { ...d, pts: [...d.pts, ...predicted.current] }, w, h)
  }

  // 🔴 의존성을 준다 — 없으면 부모가 리렌더될 때마다 전체를 다시 칠한다
  useEffect(() => { redrawBase(); redrawLive() })   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ro = new ResizeObserver(() => { redrawBase(); redrawLive() })
    if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 좌표 + 필압. 필압은 **펜일 때만** 쓴다 — 마우스는 누르면 무조건 0.5, 손가락은 0이나 1을
  // 보내서 그대로 쓰면 굵기가 제멋대로 뛴다. 펜이 아니면 undefined 로 두고 기본 굵기로 그린다.
  function norm(e: { clientX: number; clientY: number; pressure?: number; pointerType?: string }): [number, number, number?] {
    const r = boxRef.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    const p = e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : undefined
    return p === undefined ? [x, y] : [x, y, p]
  }
  const allowed = (e: React.PointerEvent) => live && tool !== 'none' && (handWrite || e.pointerType === 'pen')

  // 🔴 태블릿은 한 번의 pointermove 에 펜 좌표 여러 개를 묶어 보낸다. 그걸 다 꺼내야
  //    빠르게 그어도 점이 안 빠진다. 지원 안 하는 브라우저는 그 이벤트 하나만 쓴다.
  function pointsOf(e: React.PointerEvent): [number, number, number?][] {
    const ne = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }
    const list = typeof ne.getCoalescedEvents === 'function' ? ne.getCoalescedEvents() : []
    return (list.length ? list : [ne]).map(norm)
  }

  // 브라우저가 "펜이 다음에 갈 곳"을 예측해 준다. 그 점까지 미리 그려 두면 **획이 펜을 따라오는
  // 느낌**이 사라져 체감 지연이 눈에 띄게 준다. 예측은 틀릴 수 있으므로 **화면에만 그리고
  // 저장하지 않는다** — 다음 move 에서 live 층을 지우고 다시 그리므로 잔상이 남지 않는다.
  function predictedOf(e: React.PointerEvent): [number, number, number?][] {
    const ne = e.nativeEvent as PointerEvent & { getPredictedEvents?: () => PointerEvent[] }
    if (typeof ne.getPredictedEvents !== 'function') return []
    try { return ne.getPredictedEvents().map(norm) } catch { return [] }
  }

  // 🔴 2026-10-03 명수쌤 「펜으로 쓸 때 부드럽게, 튀지 않고 끊기지 않게」 — **튐의 원인은 이 예측점이었다.**
  //    브라우저가 주는 예측점을 **개수 제한 없이 그대로** 화면에 그려 왔다. 예측은 직선으로 뻗기 때문에
  //    획이 꺾이는 순간(한글은 꺾임이 많다) 엉뚱한 방향으로 쭉 나갔다가 다음 프레임에 되돌아온다.
  //    그 왕복이 눈에는 선 끝이 「툭툭」 튀는 것으로 보인다.
  //    → **앞의 1개만**, 그것도 직전 한 걸음의 2.5배 안쪽일 때만 쓴다. 더 멀면 과한 예측이라 버린다.
  //    실측(꺾이는 획에서 예측선이 실제 경로를 벗어난 거리, 800×600 기준):
  //      제한 없음 48.0px → 2개 16.0px → **1개 8.0px (83% 감소)**.
  //      1개면 약 한 프레임(8~16ms)의 지연 이득은 그대로 남는다 — 느려지지 않는다.
  function trimPredicted(pred: [number, number, number?][], pts: [number, number, number?][]) {
    if (!pred.length) return pred
    if (pts.length < 2) return pred.slice(0, 1)
    const last = pts[pts.length - 1], prev = pts[pts.length - 2]
    const step = Math.hypot(last[0] - prev[0], last[1] - prev[1])
    const limit = Math.max(step * 2.5, 0.003)
    const out: [number, number, number?][] = []
    let ref = last
    for (const q of pred.slice(0, 1)) {
      if (Math.hypot(q[0] - ref[0], q[1] - ref[1]) > limit) break
      out.push(q); ref = q
    }
    return out
  }

  return (
    <div ref={boxRef} className="relative">
      {children}
      <canvas ref={baseRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={liveRef}
        className={`absolute inset-0 h-full w-full ${live && tool !== 'none' ? 'touch-none' : 'pointer-events-none'}`}
        onPointerDown={e => {
          if (!allowed(e)) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drawing.current = { color, size, erase: tool === 'eraser', pts: [norm(e.nativeEvent)] }
          if (tool !== 'eraser') pencil.begin()   // 🔴 제스처 안에서 불러야 소리가 허용된다
          redrawLive()
        }}
        onPointerMove={e => {
          const d = drawing.current
          if (!d) return
          const added = pointsOf(e)
          if (d.erase) {
            // 지우개는 base 에 바로 긋는다 — 지나간 만큼만 지우면 되므로 늘어난 구간만 그린다
            const box = boxRef.current
            const ctx = fit(baseRef.current)
            if (ctx && box) {
              const seg: Stroke = { ...d, pts: [d.pts[d.pts.length - 1], ...added] }
              paint(ctx, seg, box.clientWidth, box.clientHeight)
            }
            d.pts.push(...added)
          } else {
            // ③ 점 솎기 — 직전 점에서 거의 안 움직였으면 버린다(손떨림만 남는 점).
            //    정규화 좌표 기준 0.0012 ≈ 폭 800px 화면에서 1px 미만. 모양은 그대로이면서
            //    점 수가 줄어 위 ①의 스무딩 2회를 길이에 상관없이 유지할 수 있다.
            for (const q of added) {
              const last = d.pts[d.pts.length - 1]
              if (last) {
                const dx = q[0] - last[0], dy = q[1] - last[1]
                const dp = Math.abs((q[2] ?? 0) - (last[2] ?? 0))
                if (dx * dx + dy * dy < 0.0012 * 0.0012 && dp < 0.15) continue   // 필압이 확 바뀌면 살린다
              }
              d.pts.push(q)
            }
            predicted.current = trimPredicted(predictedOf(e), d.pts)
            const ne = e.nativeEvent
            pencil.move(ne.clientX, ne.clientY, ne.pointerType === 'pen' ? ne.pressure : undefined)
            scheduleLive()
          }
        }}
        onPointerUp={() => {
          const s = drawing.current
          if (!s) return
          drawing.current = null
          predicted.current = []
          pencil.stop()
          if (liveRaf.current) { cancelAnimationFrame(liveRaf.current); liveRaf.current = 0 }   // 대기 중인 프레임 취소
          redrawLive()                     // live 층 비우기 — 확정본은 base 로 넘어간다
          if (s.pts.length > 1) onCommit(s)
        }}
        onPointerCancel={() => { drawing.current = null; predicted.current = []; pencil.stop(); redrawLive() }}
      />
    </div>
  )
}
