import { useState } from 'react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { supabase, SUPABASE_ON } from '../lib/supabase'

// 마이페이지 — 매쓰플랫 /mypage/user-info 등가(경량).
// 원본 사이드 메뉴의 이용 현황·교재비 정산·고객 지원·VOD류는 결제·서비스 지원 구조라 자체 앱 해당 없음(⚖️).
export default function MyPage() {
  const { academyProfile, setAcademyProfile } = useStore()
  const { email, signOut } = useAuth()

  const [teacherName, setTeacherName] = useState(academyProfile.teacherName ?? '')
  const [phone, setPhone] = useState(academyProfile.phone ?? '')
  const [academyName, setAcademyName] = useState(academyProfile.academyName ?? '')
  const [contactEmail, setContactEmail] = useState(academyProfile.contactEmail ?? '')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // 비밀번호 변경 (Supabase 모드 — 본인 세션 계정)
  const [showPw, setShowPw] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const dirty = teacherName !== (academyProfile.teacherName ?? '')
    || phone !== (academyProfile.phone ?? '')
    || academyName !== (academyProfile.academyName ?? '')
    || contactEmail !== (academyProfile.contactEmail ?? '')

  const save = () => {
    setAcademyProfile({
      teacherName: teacherName.trim() || undefined,
      phone: phone.trim() || undefined,
      academyName: academyName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
    })
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }

  const changePw = async () => {
    setPwMsg(null)
    if (pw1.length < 6) { setPwMsg({ ok: false, text: '비밀번호는 6자 이상이어야 해요.' }); return }
    if (pw1 !== pw2) { setPwMsg({ ok: false, text: '두 비밀번호가 일치하지 않아요.' }); return }
    if (!supabase) return
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setPwBusy(false)
    if (error) setPwMsg({ ok: false, text: `변경 실패: ${error.message}` })
    else { setPwMsg({ ok: true, text: '비밀번호가 변경되었어요.' }); setPw1(''); setPw2('') }
  }

  const INPUT = 'w-full rounded-lg border border-line px-3 py-2 text-sm'
  const label = 'mb-1 text-xs font-bold text-ink2'

  return (
    <div className="grid gap-6 lg:grid-cols-[11rem_1fr]">
      {/* 사이드 메뉴 (원본 구성 중 자체 앱 필요분만) */}
      <aside>
        <div className="rounded-2xl border border-line bg-white p-3">
          <div className="rounded-lg bg-pine-soft px-3 py-2 text-sm font-bold text-pine-dark">내 정보</div>
          <p className="mt-2 px-1 text-xs leading-relaxed text-ink2">
            이용 현황·교재비 정산·1:1 문의·사용 가이드 등은 외부 서비스의 결제·고객지원 기능이라 자체 앱에는 없어요.
          </p>
        </div>
      </aside>

      <div>
        <h1 className="mb-4 text-xl font-black">내 정보</h1>
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 좌측 카드 — 계정 */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <h3 className="mb-4 font-black">계정</h3>
            <div className="grid gap-4">
              <div>
                <div className={label}>아이디</div>
                <div className="flex items-center gap-2 text-sm">
                  <b className="break-all">{SUPABASE_ON ? (email ?? '—') : '로컬 모드 (계정 없음)'}</b>
                  <span className="rounded bg-pine-soft px-1.5 py-0.5 text-[10px] font-bold text-pine-dark">관리자</span>
                </div>
              </div>
              <div>
                <div className={label}>비밀번호</div>
                {SUPABASE_ON ? (
                  <div>
                    <button onClick={() => setShowPw(v => !v)}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink2 hover:border-pine hover:text-pine">
                      비밀번호 변경
                    </button>
                    {showPw && (
                      <div className="mt-3 grid gap-2 rounded-xl bg-paper2/60 p-3">
                        <input type="password" value={pw1} onChange={e => setPw1(e.target.value)}
                          placeholder="새 비밀번호 (6자 이상)" className={INPUT} />
                        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                          placeholder="새 비밀번호 확인" className={INPUT} />
                        {pwMsg && (
                          <p className={`text-xs ${pwMsg.ok ? 'text-pine-dark' : 'text-clay'}`}>{pwMsg.text}</p>
                        )}
                        <button onClick={changePw} disabled={pwBusy || !pw1}
                          className="justify-self-start rounded-lg bg-pine px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">
                          {pwBusy ? '변경 중…' : '변경하기'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink2">로컬 모드 — 비밀번호가 없어요. (Supabase 모드에서 변경 가능)</p>
                )}
              </div>
              <div>
                <div className={label}>선생님 이름</div>
                <input value={teacherName} onChange={e => setTeacherName(e.target.value)}
                  placeholder="명수쌤" className={INPUT} />
                <p className="mt-1 text-xs text-ink2">학습지 및 반 담당에서 표시되는 이름입니다.</p>
              </div>
              <div>
                <div className={label}>연락처</div>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="숫자만 입력해주세요." className={INPUT} />
              </div>
            </div>
          </section>

          {/* 우측 카드 — 교육기관 */}
          <section className="rounded-2xl border border-line bg-white p-6">
            <h3 className="mb-4 font-black">교육기관</h3>
            <div className="grid gap-4">
              <div>
                <div className={label}>교육기관 명</div>
                <input value={academyName} onChange={e => setAcademyName(e.target.value)}
                  placeholder="깊은생각수학" className={INPUT} />
                <p className="mt-1 text-xs text-ink2">헤더의 계정 버튼과 학생 안내에 보여지는 교육기관 이름입니다.</p>
              </div>
              <div>
                <div className={label}>대표 이메일</div>
                <input value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  placeholder="예시 : academy@math.com" className={INPUT} />
                <p className="mt-1 text-xs text-ink2">학습지·보고서를 이메일로 보낼 때 사용할 주소입니다.</p>
              </div>
              <div>
                <div className={label}>로고</div>
                <p className="text-sm text-ink2">자체 앱 고정 브랜드(깊은생각 학습지) — 별도 로고 설정이 필요 없어요.</p>
              </div>
            </div>
          </section>
        </div>

        {/* 하단 바 — 로그아웃 · 정보수정 */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4">
          {SUPABASE_ON ? (
            <button onClick={() => signOut()}
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink2 hover:border-clay hover:text-clay">
              로그아웃
            </button>
          ) : (
            <span className="text-xs text-ink2">로컬 모드 — 로그인 없이 사용 중</span>
          )}
          <div className="grow" />
          {savedAt && !dirty && <span className="text-xs text-pine-dark">✓ 저장됨 {savedAt}</span>}
          {dirty && <span className="text-xs text-clay">저장하지 않은 변경이 있어요</span>}
          <button onClick={save} disabled={!dirty}
            className="rounded-lg bg-pine px-6 py-2.5 text-sm font-bold text-paper disabled:opacity-40">
            정보수정
          </button>
        </div>
      </div>
    </div>
  )
}
