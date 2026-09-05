import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'

/**
 * 🏫 학교별 교과서 (2026-09-05 명수쌤 지시)
 *
 * > "국어영어는 학교별로 출판사가 달라"
 *
 * 수학·과학은 교육과정이 같아 유형만 맞추면 되지만, **국어·영어는 학교가 채택한 교과서가
 * 다르면 시험 범위와 지문 자체가 달라진다.** 그래서 학생의 `school` 을 모아 두고
 * 과목마다 그 학교가 쓰는 교과서를 적어 둔다. 내신 대비·학습지 출제가 이걸 보고 고른다.
 *
 * 학교 목록은 **학생 명부에서 자동으로** 모은다 — 따로 학교를 등록하지 않는다.
 */

// 검정 교과서를 내는 출판사들. 저자까지는 학교마다 다르니 **직접 적는다**(예: "능률(김성곤)").
const PUBLISHERS = [
  '능률(NE능률)', '동아출판', 'YBM', '천재교육', '천재교과서', '미래엔', '지학사',
  '비상교육', '다락원', '금성출판사', '교학사', '창비', '해냄에듀', '대교', '좋은책신사고',
]

const SUBJECTS = ['영어', '국어', '수학', '과학', '사회', '역사'] as const

export default function SchoolBooks() {
  const { students, schoolBooks, setSchoolBook } = useStore()
  const [extra, setExtra] = useState('')          // 명부에 없는 학교를 손으로 추가

  const schools = useMemo(() => {
    const set = new Set<string>()
    for (const s of students) if (s.active && s.school?.trim()) set.add(s.school.trim())
    for (const k of Object.keys(schoolBooks)) set.add(k)
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [students, schoolBooks])

  const countOf = (school: string) =>
    students.filter((s) => s.active && s.school?.trim() === school).length

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-bold text-ink">🏫 학교별 교과서</h1>
      <p className="mt-1 text-sm text-ink2">
        국어·영어는 <b>학교마다 교과서 출판사가 다릅니다.</b> 학생이 다니는 학교의 교과서를 적어 두면
        내신 대비와 학습지 출제가 그 교과서에 맞춰 나옵니다.
        학교 목록은 학생 명부의 「학교」 칸에서 자동으로 모읍니다.
      </p>

      <datalist id="publishers">
        {PUBLISHERS.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="mt-4 flex gap-2">
        <input value={extra} onChange={(e) => setExtra(e.target.value)}
          placeholder="명부에 없는 학교 추가 (예: 당진중학교)"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
        <button type="button" disabled={!extra.trim()}
          onClick={() => { setSchoolBook(extra.trim(), '영어', ' '); setSchoolBook(extra.trim(), '영어', ''); setExtra('') }}
          className="rounded-lg border border-pine px-4 py-2 text-sm font-bold text-pine disabled:opacity-40">
          추가
        </button>
      </div>

      {!schools.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink2">
          아직 학교가 없습니다. 학생 명부의 「학교」를 채우거나 위에서 직접 추가하세요.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-paper2/60 text-left text-xs text-ink2">
              <tr>
                <th className="px-3 py-2 font-bold">학교</th>
                {SUBJECTS.map((s) => <th key={s} className="px-3 py-2 font-bold">{s}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {schools.map((school) => (
                <tr key={school}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <b className="text-ink">{school}</b>
                    {!!countOf(school) && <span className="ml-1.5 text-xs text-ink2">{countOf(school)}명</span>}
                  </td>
                  {SUBJECTS.map((sub) => (
                    <td key={sub} className="px-2 py-1.5">
                      <input
                        list="publishers"
                        defaultValue={schoolBooks[school]?.[sub] ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value
                          if (v !== (schoolBooks[school]?.[sub] ?? '')) setSchoolBook(school, sub, v)
                        }}
                        placeholder={sub === '영어' || sub === '국어' ? '출판사(저자)' : '—'}
                        className="w-32 rounded border border-line px-2 py-1 text-[13px] focus:border-pine focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink2">
        칸을 벗어나면 저장됩니다. 저자까지 적어 두면 좋습니다 — 같은 출판사라도 저자가 다르면 다른 교과서입니다
        (예: <code>능률(김성곤)</code> 과 <code>능률(양현권)</code>).
      </p>
    </div>
  )
}
