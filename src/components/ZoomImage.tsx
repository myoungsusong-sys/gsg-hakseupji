import { useEffect, useState } from 'react'

// 정답·해설 이미지 확대 보기
// ─────────────────────────────────────────────────────────────────────────────
// 서술형·그래프 정답은 표/그래프/다단계 풀이 이미지라, 목록에 맞춘 작은 높이로는 읽을 수 없다.
// 목록에서는 지금처럼 작게 두되 누르면 전체화면으로 크게 띄운다.
//  · 교사: 수업>교재 채점판의 서술형 정답(GradePanel AnswerLabel)
//  · 학생: 교재 자기채점의 정답 그림(StudentWorkbooks WbAnswer)
// 확대 화면에서 한 번 더 누르면 원래 크기(맞춤 ↔ 원본)로 토글해 세부 숫자까지 볼 수 있다.

export default function ZoomImage({ src, alt = '정답', className = '', title = '정답' }: {
  src: string
  alt?: string
  className?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState(false)   // true=원본 크기(스크롤) · false=화면 맞춤

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    // 확대 중에는 뒤 화면이 스크롤되지 않게
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      {/* 교사 채점판에서는 이 이미지가 "누르면 ○/✕가 매겨지는 문항 카드" 안에 들어간다.
          확대하려고 눌렀다가 채점까지 되면 안 되므로 클릭을 여기서 멈춘다. */}
      <button type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); setFull(false) }}
        onMouseDown={e => e.stopPropagation()}
        title="눌러서 크게 보기"
        className="group relative block cursor-zoom-in rounded bg-white">
        <img src={src} alt={alt} loading="lazy" className={className} />
        <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-ink/55 px-1 py-0.5 text-[9px] font-bold leading-none text-white opacity-0 transition group-hover:opacity-100">
          🔍 크게
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ink/85" onClick={() => setOpen(false)}>
          <div className="flex items-center gap-3 px-5 py-3 text-paper" onClick={e => e.stopPropagation()}>
            <b className="text-sm">{title}</b>
            <button type="button" onClick={() => setFull(f => !f)}
              className="rounded-lg border border-white/40 px-2.5 py-1 text-xs font-bold hover:bg-white/15">
              {full ? '화면에 맞추기' : '원본 크기'}
            </button>
            <div className="grow" />
            <span className="hidden text-xs text-paper/70 sm:inline">빈 곳을 누르거나 Esc로 닫기</span>
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-lg border border-white/40 px-3 py-1 text-sm font-bold hover:bg-white/15">✕ 닫기</button>
          </div>
          <div className={`min-h-0 grow ${full ? 'overflow-auto' : 'flex items-center justify-center'} p-4`}>
            <img src={src} alt={alt} onClick={e => e.stopPropagation()}
              className={full
                ? 'max-w-none cursor-zoom-out rounded-lg bg-white'
                : 'max-h-full max-w-full cursor-zoom-in rounded-lg bg-white'}
              onDoubleClick={() => setFull(f => !f)} />
          </div>
        </div>
      )}
    </>
  )
}
