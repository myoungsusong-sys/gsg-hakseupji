// ── 연필 소리 — 오디오 파일 없이 웹오디오로 만든다 ─────────────────────
//
// 왜 파일을 안 쓰나: 녹음 파일을 반복 재생하면 **같은 소리가 반복되는 게 금방 들통난다.**
// 연필 소리는 사실 "잡음을 필터에 통과시킨 것"이라, 속도·필압으로 실시간 조절하면
// 훨씬 진짜 같다. 파일 다운로드도 없고 용량도 0이다.
//
// 소리의 구조:
//   흰잡음(루프) → 대역통과(연필이 긁는 2~4kHz) → 저역차단(웅웅거림 제거) → 음량
//   · 빠르게 그으면 → 커지고 높아진다
//   · 세게 누르면(필압) → 커지고 낮아진다(굵게 뭉개지는 소리)
//   · 멈추면 → 0.08초에 걸쳐 사라진다 (뚝 끊기면 그게 더 어색하다)
//
// 🔴 브라우저는 사용자가 화면을 건드리기 전에는 소리를 못 내게 막는다(자동재생 정책).
//    그래서 AudioContext 를 **처음 펜을 댈 때** 만들고 resume 한다.
// 🔴 교실에서 태블릿 여러 대가 동시에 울리면 시끄럽다 — 끌 수 있어야 하고,
//    기본 음량도 아주 작게 잡았다(0.05). 기기별 설정이라 localStorage 에 둔다.

const KEY = 'gsg-pencil-sound'

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}
export function setSoundOn(v: boolean) {
  try { localStorage.setItem(KEY, v ? 'on' : 'off') } catch { /* 무시 */ }
  if (!v) stop()
}

let ctx: AudioContext | null = null
let src: AudioBufferSourceNode | null = null
let band: BiquadFilterNode | null = null
let gain: GainNode | null = null
let lastAt = 0
let lastXY: [number, number] | null = null

function build() {
  if (ctx) return
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()

  // 흰잡음 2초치를 만들어 루프 — 짧으면 주기가 귀에 잡힌다
  const len = Math.floor(ctx.sampleRate * 2)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1
  src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true

  band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2600      // 연필이 종이를 긁는 대역
  band.Q.value = 0.7               // 너무 좁으면 삐- 소리가 난다

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 700         // 낮은 웅웅거림 제거

  gain = ctx.createGain()
  gain.gain.value = 0

  src.connect(band); band.connect(hp); hp.connect(gain); gain.connect(ctx.destination)
  src.start()
}

// 펜을 댔다 — 오디오를 깨운다(사용자 제스처 안에서 불려야 한다)
export function begin() {
  if (!soundOn()) return
  build()
  if (ctx?.state === 'suspended') void ctx.resume()
  lastAt = performance.now()
  lastXY = null
}

/**
 * 펜이 움직였다. 화면 좌표(px)와 필압으로 소리를 조절한다.
 * 매 pointermove 마다 불려도 되게 setTargetAtTime 으로 부드럽게만 끌고 간다
 * (값을 직접 대입하면 지지직 하는 잡음이 난다).
 */
export function move(x: number, y: number, pressure?: number) {
  if (!ctx || !gain || !band || !soundOn()) return
  const now = performance.now()
  const dt = Math.max(8, now - lastAt)        // 너무 작은 dt 는 속도를 폭주시킨다
  const d = lastXY ? Math.hypot(x - lastXY[0], y - lastXY[1]) : 0
  lastAt = now; lastXY = [x, y]

  const speed = Math.min(1, d / dt / 1.6)      // px/ms → 0~1
  const p = pressure === undefined ? 0.5 : Math.min(1, Math.max(0, pressure))
  // 아주 느리게 움직이면 거의 안 들린다(멈춰 있는데 소리가 나면 어색하다)
  const vol = 0.05 * speed * (0.5 + 0.9 * p)
  gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02)
  // 빠를수록 높고, 세게 누를수록 낮게
  band.frequency.setTargetAtTime(1900 + speed * 2200 - p * 500, ctx.currentTime, 0.05)
}

// 펜을 뗐다 — 뚝 끊지 않고 잦아들게
export function stop() {
  if (!ctx || !gain) return
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
  lastXY = null
}
