import { useState } from 'react'
import { CURRICULUM } from '../data/curriculum'
import { useStore } from '../lib/store'

export default function Students() {
  const { students, addStudent, setStudentActive } = useStore()
  const [name, setName] = useState('')
  const [klass, setKlass] = useState('')

  const active = students.filter(s => s.active)

  return (
    <div>
      <h1 className="mb-6 text-xl font-black">학생 관리</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-5">
        <label className="grid gap-1 text-sm font-bold">이름
          <input value={name} onChange={e => setName(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-bold">반 (선택)
          <input value={klass} onChange={e => setKlass(e.target.value)} placeholder="중1 A반"
            className="rounded-lg border border-line px-3 py-2 font-normal" /></label>
        <button onClick={() => { if (name.trim()) { addStudent({ name: name.trim(), grade: CURRICULUM.grade, klass: klass.trim() || undefined }); setName(''); setKlass('') } }}
          className="rounded-lg bg-pine px-5 py-2.5 text-sm font-bold text-paper">+ 학생 등록</button>
      </div>

      <div className="grid gap-2">
        {active.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-ink2">
            등록된 학생이 없습니다. 위에서 추가하세요.
          </div>
        )}
        {active.map(s => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-5 py-3">
            <span className="rounded bg-paper2 px-2 py-0.5 text-xs font-bold text-ink2">{s.grade}</span>
            <b>{s.name}</b>
            {s.klass && <span className="text-sm text-ink2">{s.klass}</span>}
            <div className="grow" />
            <button onClick={() => { if (confirm(`${s.name} 학생을 퇴원 처리할까요?`)) setStudentActive(s.id, false) }}
              className="rounded border border-line px-3 py-1 text-sm text-ink2 hover:border-clay hover:text-clay">퇴원</button>
          </div>
        ))}
      </div>
    </div>
  )
}
