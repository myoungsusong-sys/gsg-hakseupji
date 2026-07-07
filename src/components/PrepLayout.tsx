import { NavLink, Outlet } from 'react-router-dom'

const item = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive ? 'bg-pine-soft font-bold text-pine-dark' : 'text-ink2 hover:bg-paper2'
  }`

function Group({ title }: { title: string }) {
  return <div className="mb-1 mt-4 px-3 text-xs font-bold text-amber">{title}</div>
}

// 매쓰플랫 수업 준비 사이드바와 동일 골격
export default function PrepLayout() {
  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
      <aside className="no-print w-44 shrink-0">
        <nav className="sticky top-20 rounded-2xl border border-line bg-white p-2">
          <NavLink to="/prep/worksheet" className={item}>학습지</NavLink>
          <NavLink to="/prep/workbook" className={item}>교재</NavLink>
          <Group title="시험 대비" />
          <NavLink to="/prep/school-test" className={item}>학교별 기출</NavLink>
          <NavLink to="/prep/school-exam" className={item}>내신 대비</NavLink>
          <NavLink to="/prep/csat" className={item}>수능·모의고사</NavLink>
          <NavLink to="/prep/test" className={item}>테스트</NavLink>
          <NavLink to="/prep/kmm" className={item}>KMM수학경시대회</NavLink>
          <Group title="영역별 학습" />
          <NavLink to="/prep/arithmetic" className={item}>연산</NavLink>
          <NavLink to="/prep/essay" className={item}>서술형</NavLink>
          <NavLink to="/prep/lecture" className={item}>강의</NavLink>
          <div className="my-2 border-t border-line" />
          <NavLink to="/prep/share" className={item}>다른 기관 학습지</NavLink>
        </nav>
      </aside>
      <main className="min-w-0 grow">
        <Outlet />
      </main>
    </div>
  )
}
