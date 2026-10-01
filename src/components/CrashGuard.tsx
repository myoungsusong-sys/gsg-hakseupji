import { Component, type ReactNode } from 'react'

// 🛟 화면이 하얗게 지워지는 것을 막는 받이 (2026-10-01 명수쌤 「먹통이 될 때 갑자기 화면이 하얗게 변한대」)
//
// 그때까지 앱 어디에도 오류 받이가 없었다. React 는 화면을 그리다 오류가 하나라도 나면 **앱 전체를 지운다**
// → 하얀 화면. 학생은 앱을 껐다 켜야 했고, 켜면 처음 화면이었다.
// 이제 오류가 나면 그 부분만 안내로 바꾸고, 한 번은 스스로 다시 그려 본다(대개 자료가 잠깐 비어서 난 오류라
// 다시 그리면 된다). 보던 자리(교재·쪽·문항·승강제 유형)는 기기에 기억돼 있어 다시 그려도 그 자리다.
// 두 번째부터는 [이어서 하기] 버튼 — 같은 오류로 무한히 다시 그리지 않게.

// quiet: 머리 줄의 작은 부품처럼 안내를 띄울 자리가 없는 곳 — 오류가 나면 그 부품만 조용히 숨긴다
type Props = { children: ReactNode; where: string; full?: boolean; quiet?: boolean }
type State = { err: Error | null; tries: number }

const AUTO_RETRY_MS = 1200
const RETRY_WINDOW_MS = 30_000

export default class CrashGuard extends Component<Props, State> {
  state: State = { err: null, tries: 0 }
  private lastAt = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(err: Error): Partial<State> {
    return { err }
  }

  componentDidCatch(err: Error, info: { componentStack?: string | null }) {
    // errorLog 가 console.error 를 주워 담는다 → 「화면이 이상해요」 점검에 그대로 실린다
    console.error(`[화면 오류·${this.props.where}] ${err?.message ?? err}`, (info?.componentStack ?? '').slice(0, 400))
    const now = Date.now()
    const tries = now - this.lastAt < RETRY_WINDOW_MS ? this.state.tries + 1 : 1
    this.lastAt = now
    this.setState({ tries })
    if (tries === 1) this.timer = setTimeout(() => this.retry(), AUTO_RETRY_MS)
  }

  componentWillUnmount() { if (this.timer) clearTimeout(this.timer) }

  retry = () => {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this.setState({ err: null })
  }

  render() {
    if (!this.state.err) return this.props.children
    if (this.props.quiet) return null
    const auto = this.state.tries <= 1
    return (
      <div className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${this.props.full ? 'min-h-screen' : 'py-16'}`}>
        <div className="text-3xl">🛟</div>
        <p className="font-black text-ink">화면을 다시 그리고 있어요</p>
        <p className="max-w-sm text-sm text-ink2">
          {auto ? '잠깐만 기다려 주세요. 하던 자리 그대로 이어집니다.'
            : '아래 버튼을 눌러 주세요. 하던 자리 그대로 이어집니다. 계속되면 선생님께 알려 주세요.'}
        </p>
        {!auto && (
          <div className="flex gap-2">
            <button type="button" onClick={this.retry}
              className="rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper">이어서 하기</button>
            <button type="button" onClick={() => location.reload()}
              className="rounded-lg border border-line px-4 py-2 text-sm">새로고침</button>
          </div>
        )}
      </div>
    )
  }
}
