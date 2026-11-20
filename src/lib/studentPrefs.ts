// 학생앱 알림 설정 — 이 기기(브라우저)에만 저장한다. 값이 없으면 모두 켬.
//  bell  : 헤더 🔔 의 새 숙제·채점 완료 알림(빨간 숫자)
//  sound : 해설 도착·선생님 호출 때 소리와 진동
//  system: 화면 밖(시스템) 알림
export type StudentNotifyKey = 'bell' | 'sound' | 'system'
const KEY = 'gsg-student-notify'

export function getNotifyPrefs(): Record<StudentNotifyKey, boolean> {
  const base = { bell: true, sound: true, system: true }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...base, ...(JSON.parse(raw) as Partial<Record<StudentNotifyKey, boolean>>) } : base
  } catch { return base }
}
export function setNotifyPref(k: StudentNotifyKey, on: boolean): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...getNotifyPrefs(), [k]: on })) } catch { /* 저장 못 해도 화면은 그대로 */ }
}
export const notifyOn = (k: StudentNotifyKey): boolean => getNotifyPrefs()[k]
