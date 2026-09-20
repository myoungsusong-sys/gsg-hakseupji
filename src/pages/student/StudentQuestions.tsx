import { useCallback, useEffect, useRef, useState } from 'react'
import { useStudentSelf, usePreview, PREVIEW_LOCK_TITLE } from './common'
import {
  askQuestion, myQuestions, removeQuestion, markQnaRead,
  type Question, type QnaStatus,
} from '../../lib/qna'
import { SUPABASE_ON } from '../../lib/supabase'

// ── 질문함 — 모르는 문제를 찍어 올리면 해설 노트가 돌아온다 ────────────
// 흐름: 학생이 사진+질문 올림 → (명수쌤 맥의 워커가 해설 이미지 생성) → 여기 목록에 도착
// 데이터는 store 를 타지 않는다. 이유는 src/lib/qna.ts 머리말 참조(egress).

const BADGE: Record<QnaStatus, { t: string; c: string }> = {
  대기:    { t: '접수됨',        c: 'bg-paper2 text-ink2' },
  만드는중: { t: '해설 만드는 중', c: 'bg-amber-soft text-amber' },
  완료:    { t: '해설 도착',      c: 'bg-pine-soft text-pine-dark' },
  실패:    { t: '다시 만드는 중', c: 'bg-amber-soft text-amber' },
}

export default function StudentQuestions() {
  const me = useStudentSelf()
  const preview = usePreview()
  const [list, setList] = useState<Question[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState<Question | null>(null)

  const load = useCallback(async () => {
    try {
      setList(await myQuestions(me.id))
      setErr('')
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [me.id])

  useEffect(() => { void load(); markQnaRead() }, [load])

  // 아직 답을 기다리는 게 있을 때만 주기 확인 (없으면 서버를 두드리지 않는다)
  const waiting = list.some(q => q.status !== '완료')
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => { void load() }, 20_000)
    return () => clearInterval(t)
  }, [waiting, load])

  if (!SUPABASE_ON) return (
    <Empty title="질문함" msg="이 기기는 오프라인(로컬) 모드예요. 인터넷에 연결된 계정으로 들어오면 질문을 보낼 수 있어요." />
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-black">질문함</h1>
        <div className="grow" />
        <button
          onClick={() => setOpen(true)}
          disabled={preview.on}
          title={preview.on ? PREVIEW_LOCK_TITLE : undefined}
          className="rounded-full bg-pine px-4 py-2 text-sm font-bold text-paper transition hover:brightness-110 disabled:opacity-40"
        >❓ 문제 찍어서 질문하기</button>
      </div>

      <p className="mb-4 text-sm text-ink2">
        모르는 문제를 사진으로 찍고 <b>어디가 막히는지</b> 적어 보내면, 그 질문에 맞춘 <b>해설 노트</b>를 만들어 드려요.
        <span className="text-ink2/70"> (AI가 만들고 선생님이 확인합니다)</span>
      </p>

      {err && <div className="mb-4 rounded-2xl border border-line bg-amber-soft px-4 py-3 text-sm text-amber">{err}</div>}

      {loading ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-14 text-center text-sm text-ink2">불러오는 중…</div>
      ) : list.length === 0 ? (
        <Empty title="" msg="아직 보낸 질문이 없어요. 풀다가 막히는 문제가 나오면 바로 찍어서 물어보세요." />
      ) : (
        <div className="grid gap-3">
          {list.map(q => (
            <Card key={q.id} q={q} onZoom={() => setZoom(q)} onDelete={async () => {
              if (!confirm('이 질문을 지울까요?')) return
              await removeQuestion(q.id); void load()
            }} />
          ))}
        </div>
      )}

      {open && <AskModal me={{ id: me.id, name: me.name }} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load() }} />}
      {zoom?.answerUrl && <Lightbox url={zoom.answerUrl} onClose={() => setZoom(null)} />}
    </div>
  )
}

function Empty({ title, msg }: { title: string; msg: string }) {
  return (
    <div>
      {title && <h1 className="mb-4 text-xl font-black">{title}</h1>}
      <div className="rounded-2xl border border-line bg-white px-6 py-14 text-center text-sm text-ink2">{msg}</div>
    </div>
  )
}

function Card({ q, onZoom, onDelete }: { q: Question; onZoom: () => void; onDelete: () => void }) {
  const b = BADGE[q.status] ?? BADGE.대기
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <img src={q.shotUrl} alt="올린 문제" className="h-20 w-20 shrink-0 rounded-xl border border-line object-cover" />
        <div className="min-w-0 grow">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${b.c}`}>{b.t}</span>
            <span className="text-xs text-ink2/70">{fmt(q.createdAt)}</span>
            <div className="grow" />
            {q.status !== '완료' && (
              <button onClick={onDelete} className="text-xs text-ink2/60 hover:text-ink2">지우기</button>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-ink">{q.text}</p>
        </div>
      </div>

      {q.status === '완료' && q.answerUrl && (
        <div className="mt-3">
          {q.answerText && <p className="mb-2 text-sm font-bold text-pine-dark">💡 {q.answerText}</p>}
          <button onClick={onZoom} className="block w-full overflow-hidden rounded-xl border border-line">
            <img src={q.answerUrl} alt="해설 노트" className="w-full" />
          </button>
          <div className="mt-1.5 text-center text-xs text-ink2/70">눌러서 크게 보기</div>
        </div>
      )}

      {(q.status === '대기' || q.status === '만드는중' || q.status === '실패') && (
        <div className="mt-3 rounded-xl bg-paper2 px-3 py-2.5 text-xs text-ink2">
          {q.status === '실패'
            ? '해설을 만들다 막혀서 다시 시도하고 있어요. 오래 걸리면 선생님이 직접 답해 주실 거예요.'
            : '해설 노트를 만들고 있어요. 다 되면 이 화면에 그림으로 도착해요.'}
        </div>
      )}
    </div>
  )
}

function AskModal({ me, onClose, onDone }: {
  me: { id: string; name: string }; onClose: () => void; onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  function choose(f: File | null) {
    if (!f) return
    if (url) URL.revokeObjectURL(url)
    setFile(f); setUrl(URL.createObjectURL(f)); setErr('')
  }

  async function send() {
    if (!file) { setErr('문제 사진을 먼저 찍어 주세요.'); return }
    if (text.trim().length < 5) { setErr('어디가 막히는지 한 줄이라도 적어 주세요. 그래야 그 부분을 짚어 드려요.'); return }
    setBusy(true); setErr('')
    try {
      await askQuestion({ studentId: me.id, studentName: me.name, text, photo: file })
      onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center">
          <h2 className="text-lg font-black">문제 질문하기</h2>
          <div className="grow" />
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-ink2 hover:bg-paper2">닫기</button>
        </div>

        <input ref={pick} type="file" accept="image/*" capture="environment" className="hidden"
               onChange={e => choose(e.target.files?.[0] ?? null)} />

        {url ? (
          <button onClick={() => pick.current?.click()} className="mb-3 block w-full overflow-hidden rounded-2xl border border-line">
            <img src={url} alt="찍은 문제" className="max-h-72 w-full object-contain bg-paper2" />
          </button>
        ) : (
          <button onClick={() => pick.current?.click()}
            className="mb-3 flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line bg-paper2 text-sm text-ink2">
            <span className="text-3xl">📷</span>
            문제를 찍거나 사진을 고르세요
          </button>
        )}
        {url && <div className="mb-3 text-center text-xs text-ink2/70">사진을 누르면 다시 찍을 수 있어요</div>}

        <label className="mb-1.5 block text-sm font-bold">어디가 막히나요?</label>
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={4}
          placeholder="예) 4f'(x) 로 봐도 되나요? 아니면 치환해야 하나요? □ 안에 x 를 넣으면 왜 안 되는지 모르겠어요."
          className="mb-1 w-full resize-y rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-pine"
        />
        <p className="mb-3 text-xs text-ink2/70">막히는 지점을 구체적으로 적을수록 해설이 정확해져요.</p>

        {err && <div className="mb-3 rounded-xl bg-amber-soft px-3 py-2.5 text-sm text-amber">{err}</div>}

        <button onClick={send} disabled={busy}
          className="w-full rounded-full bg-pine py-3 text-sm font-bold text-paper transition hover:brightness-110 disabled:opacity-40">
          {busy ? '보내는 중…' : '질문 보내기'}
        </button>
      </div>
    </div>
  )
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-3" onClick={onClose}>
      <div className="mx-auto max-w-5xl">
        <img src={url} alt="해설 노트" className="w-full rounded-xl bg-white" />
        <div className="py-4 text-center">
          <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
             className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-ink">원본 크기로 열기</a>
        </div>
      </div>
    </div>
  )
}

function fmt(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
