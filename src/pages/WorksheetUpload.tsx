import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FileUploader from '../components/FileUploader'
import { BulkAddModal } from './Bank'
import { useStore } from '../lib/store'

// 매쓰플랫 「학습지 업로드하기」 전용 화면 (자료 업로드 / 자료 리스트 2탭).
// 업로드→디지털 변환은 수동 파이프라인(Claude 전사) — FileUploader 참조.
export default function WorksheetUpload() {
  const nav = useNavigate()
  const { uploads, removeUpload, setUploadStatus, addProblem } = useStore()
  const [tab, setTab] = useState<'upload' | 'list'>('upload')
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [levelFilter, setLevelFilter] = useState<'전체' | '초' | '중' | '고'>('전체')

  const list = uploads.filter(u => u.purpose === '학습지')
    .filter(u => levelFilter === '전체' || (u.grade ?? '').startsWith(levelFilter))

  return (
    <div>
      <div className="mb-6 flex items-center gap-8 border-b border-line px-1">
        {([['upload', '자료 업로드'], ['list', '자료 리스트']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-3 pt-1 text-[15px] font-bold transition ${
              tab === k ? 'border-pine text-ink' : 'border-transparent text-ink2 hover:text-ink'
            }`}>
            {label}
          </button>
        ))}
        <div className="grow" />
        <button onClick={() => nav('/prep/worksheet')}
          className="mb-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink2 hover:bg-paper2">← 학습지 목록</button>
      </div>

      {tab === 'upload' && (
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <p className="mb-2 text-lg font-black">문제를 올리면, 편집 가능한 &lsquo;디지털 문제&rsquo;로 싹 바꿔 드려요.</p>
          <p className="mb-6 text-sm text-ink2">
            보유한 기출·학습지 PDF/이미지를 올려 변환 대기 목록에 담고, Claude 전사 → 일괄 등록으로 나의 DB에 넣습니다.
          </p>
          <button onClick={() => setUploaderOpen(true)}
            className="rounded-lg bg-pine px-6 py-3 text-sm font-bold text-paper hover:bg-pine-dark">
            파일 첨부하기
          </button>
          <p className="mt-3 text-xs text-ink2">(PDF, 이미지 파일(jpg, png 등) / 세로형 / 최대 50MB)</p>
        </div>
      )}

      {tab === 'list' && (
        <div>
          <div className="mb-4 flex gap-1">
            {(['전체', '초', '중', '고'] as const).map(l => (
              <button key={l} onClick={() => setLevelFilter(l)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${levelFilter === l ? 'bg-pine text-paper' : 'border border-line text-ink2 hover:bg-paper2'}`}>
                {l}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-ink2">
              업로드한 자료가 없습니다. [자료 업로드] 탭에서 파일을 첨부하세요.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-paper2 text-xs text-ink2">
                  <tr>
                    <th className="px-4 py-2.5">학년</th>
                    <th className="px-3 py-2.5 text-left">자료명</th>
                    <th className="px-3 py-2.5">상태</th>
                    <th className="px-3 py-2.5">수정하기</th>
                    <th className="px-3 py-2.5">더보기</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(u => (
                    <tr key={u.id} className="border-t border-line/60">
                      <td className="px-4 py-2.5 text-center text-ink2">{u.grade ?? '-'}</td>
                      <td className="px-3 py-2.5 font-semibold">{u.fileKind === 'pdf' ? '📄' : '🖼'} {u.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${u.status === '등록 완료' ? 'bg-pine-soft text-pine-dark' : 'bg-amber-soft text-amber'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setBulk(true)}
                          className="rounded border border-pine px-2.5 py-1 text-xs font-bold text-pine hover:bg-pine-soft">일괄 등록으로 입력</button>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setUploadStatus(u.id, u.status === '등록 완료' ? '변환 대기' : '등록 완료')}
                          className="mr-1 rounded border border-line px-2 py-1 text-xs text-ink2 hover:border-pine hover:text-pine">
                          {u.status === '등록 완료' ? '대기로' : '완료로'}
                        </button>
                        <button onClick={() => { if (confirm(`"${u.name}" 항목을 삭제할까요?`)) removeUpload(u.id) }}
                          className="rounded border border-line px-2 py-1 text-xs text-ink2 hover:border-clay hover:text-clay">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {uploaderOpen && (
        <FileUploader purpose="학습지" onClose={() => setUploaderOpen(false)}
          onBulkAdd={() => { setUploaderOpen(false); setBulk(true) }} />
      )}
      {bulk && <BulkAddModal courseId="m1-1" onClose={() => setBulk(false)}
        onAdd={ps => { ps.forEach(addProblem); setBulk(false); alert(`${ps.length}문제를 나의 DB에 등록했습니다.`) }} />}
    </div>
  )
}
