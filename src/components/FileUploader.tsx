import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import type { UploadRec } from '../types'

/* 매쓰플랫 「문제 업로드」 전체화면 업로더의 등가 구현.
   원본: PDF/이미지 업로드 → 서버가 편집 가능한 '디지털 문제'로 자동 변환.
   우리: 서버 변환 파이프라인이 없으므로 ①파일을 변환 대기 목록에 보관(메타 기록)
        ②Claude에게 전사 요청하는 절차 안내 ③변환된 텍스트를 일괄 등록 폼으로 입력.
   파일 원본은 브라우저 저장 한계(localStorage 5MB)로 저장하지 않는다 — 파일명·크기만. */

const MAX_MB = 50

export default function FileUploader({ purpose, onBulkAdd, onClose }: {
  purpose: '문제' | '학습지'
  onBulkAdd: () => void          // 「일괄 등록으로 입력」 — 부모가 BulkAddModal을 연다
  onClose: () => void
}) {
  const { uploads, addUpload, setUploadStatus, removeUpload } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [flash, setFlash] = useState('')

  const mine = uploads.filter(u => u.purpose === purpose)

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    let added = 0
    for (const f of Array.from(files)) {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
      const isImg = f.type.startsWith('image/')
      if (!isPdf && !isImg) { alert(`"${f.name}" — PDF 또는 이미지 파일만 올릴 수 있습니다.`); continue }
      if (f.size > MAX_MB * 1024 * 1024) { alert(`"${f.name}" — 최대 ${MAX_MB}MB까지 올릴 수 있습니다.`); continue }
      addUpload({ name: f.name, size: f.size, fileKind: isPdf ? 'pdf' : 'image', purpose })
      added++
    }
    if (added > 0) setFlash(`${added}개 파일을 변환 대기 목록에 담았습니다.`)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper" onClick={e => e.stopPropagation()}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center">
          <h2 className="text-xl font-black">{purpose === '문제' ? '문제 업로드하기' : '학습지 업로드하기'}</h2>
          <div className="grow" />
          <button onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink2 hover:bg-paper2">닫기 ✕</button>
        </div>

        <p className="mb-6 text-[15px] font-bold">
          문제를 올리면, 편집 가능한 &lsquo;디지털 문제&rsquo;로 싹 바꿔 드려요.
        </p>

        {/* 좌: 올린 파일 예시 · 우: 디지털 문제 예시 (원본 구성) */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-2 text-sm font-bold text-ink2">① 선생님이 올린 문제</div>
            <div className="rounded-xl border border-dashed border-line bg-paper2/60 p-6 text-center text-sm text-ink2">
              📄 기출·교재 스캔 PDF / 사진(jpg, png)
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-2 text-sm font-bold text-pine-dark">② 디지털 문제로 변환</div>
            <div className="rounded-xl border border-line p-4 text-xs">
              <div className="mb-1 flex gap-1">
                <span className="rounded bg-paper2 px-1.5 py-0.5 font-bold text-ink2">원본</span>
                <span className="rounded bg-amber-soft px-1.5 py-0.5 font-bold text-amber">난이도 중</span>
                <span className="rounded bg-paper2 px-1.5 py-0.5 text-ink2">객관식</span>
              </div>
              <div className="text-ink2">문제 / 정답 / 해설이 유형 트리에 연결된 편집 가능한 문제로 등록됩니다.</div>
            </div>
          </div>
        </div>

        {/* 파일 첨부 */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" multiple accept="application/pdf,image/*" className="hidden"
            onChange={e => onFiles(e.target.files)} />
          <button onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper hover:bg-pine-dark">
            파일 첨부하기
          </button>
          <span className="text-xs text-ink2">(PDF, 이미지 파일(jpg, png 등) / 세로형 / 최대 {MAX_MB}MB)</span>
          {flash && <span className="text-xs font-bold text-pine-dark">{flash}</span>}
        </div>
        <p className="mb-6 rounded-xl border border-dashed border-pine/40 bg-pine-soft/30 p-4 text-sm">
          <b className="text-pine-dark">변환 절차(수동 파이프라인)</b> — 완전 자동 변환은 서버가 필요해 아직 없습니다.
          ① 파일을 첨부하면 아래 <b>변환 대기 목록</b>에 담깁니다.
          ② 파일을 <b>Claude에게 전사 요청</b>(문제·정답·해설 텍스트 추출)하세요.
          ③ 받은 텍스트를 <b>일괄 등록</b>으로 붙여 넣으면 나의 DB에 디지털 문제로 등록됩니다.
        </p>

        {/* 변환 대기 목록 */}
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-bold">변환 대기 목록 <span className="text-sm font-normal text-ink2">({mine.length})</span></h3>
          <div className="grow" />
          <button onClick={onBulkAdd}
            className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine hover:bg-pine-soft">
            📋 일괄 등록으로 입력
          </button>
        </div>
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink2">
            아직 올린 파일이 없습니다. [파일 첨부하기]로 시작하세요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper2 text-xs text-ink2">
                <tr>
                  <th className="px-4 py-2.5 text-left">파일명</th>
                  <th className="px-3 py-2.5">종류</th>
                  <th className="px-3 py-2.5">크기</th>
                  <th className="px-3 py-2.5">올린 날짜</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">관리</th>
                </tr>
              </thead>
              <tbody>
                {mine.map(u => <UploadRow key={u.id} u={u}
                  onDone={() => setUploadStatus(u.id, u.status === '등록 완료' ? '변환 대기' : '등록 완료')}
                  onRemove={() => { if (confirm(`"${u.name}" 항목을 목록에서 삭제할까요?`)) removeUpload(u.id) }} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function fmtSize(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(b / 1024))}KB`
}

function UploadRow({ u, onDone, onRemove }: { u: UploadRec; onDone: () => void; onRemove: () => void }) {
  return (
    <tr className="border-t border-line/60">
      <td className="px-4 py-2.5 font-semibold">{u.fileKind === 'pdf' ? '📄' : '🖼'} {u.name}</td>
      <td className="px-3 py-2.5 text-center text-ink2">{u.fileKind === 'pdf' ? 'PDF' : '이미지'}</td>
      <td className="px-3 py-2.5 text-center text-ink2">{fmtSize(u.size)}</td>
      <td className="px-3 py-2.5 text-center text-ink2">{u.uploadedAt.slice(0, 10)}</td>
      <td className="px-3 py-2.5 text-center">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${u.status === '등록 완료' ? 'bg-pine-soft text-pine-dark' : 'bg-amber-soft text-amber'}`}>
          {u.status}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <button onClick={onDone} className="mr-1 rounded border border-line px-2 py-1 text-xs text-ink2 hover:border-pine hover:text-pine">
          {u.status === '등록 완료' ? '대기로' : '등록 완료로'}
        </button>
        <button onClick={onRemove} className="rounded border border-line px-2 py-1 text-xs text-ink2 hover:border-clay hover:text-clay">삭제</button>
      </td>
    </tr>
  )
}
