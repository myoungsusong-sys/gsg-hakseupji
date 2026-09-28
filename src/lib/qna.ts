// ── 문제 질문함 ────────────────────────────────────────────────
// 학생이 모르는 문제를 찍어 올리고 질문을 적으면, 명수쌤 맥의 워커가 해설 노트 이미지를
// 만들어 돌려준다. 여기는 그 「앞단」(올리기·조회)만 담당한다.
//
// 🔴 새 테이블·새 버킷을 만들지 않았다.
//    그러려면 Supabase 대시보드 로그인(DDL)이 필요한데 세션이 만료돼 있고,
//    비밀번호는 클로드가 다루지 않는다. 그래서 DDL 없이:
//      · 행  = 기존 hj_settings 에 `qna_<질문id>` 한 줄 (사진이 없으니 작다)
//      · 사진 = Storage 버킷 'qna' — /api/diagnose 가 service_role 로 올린다
//        (서비스 키는 Vercel 안에만 있고 브라우저로 내려오지 않는다)
// 🔴 store/backend 를 타지 않는다.
//    backend.ts 의 rows()/loadAll() 은 9개 테이블을 전량으로 받고 실시간 변경마다 다시 돈다.
//    질문이 오갈 때마다 전 기기가 그걸 반복하면 2026-09-02 의 egress 402 잠김이 재발한다.
//    그래서 조회는 언제나 like(본인 것) + limit 이고, 실시간 구독은 qna_ 를 무시한다.

import { supabase } from './supabase'

const 접두 = 'qna_'

export type QnaStatus = '대기' | '만드는중' | '완료' | '보류' | '실패'

export interface Question {
  id: string
  studentId: string
  studentName: string
  text: string                 // 학생이 적은 질문
  shotUrl: string              // 학생이 찍은 문제 사진
  createdAt: string
  status: QnaStatus
  answerUrl?: string           // 해설 노트 이미지
  answerText?: string          // 해설 한 줄 요약(워커가 넣는다)
  card?: { 핵심?: string; 정답?: string; 다음?: string }   // 앱에 글로 보여주는 3줄
  context?: string             // 개인화용 학생 맥락(학생앱이 만들어 붙인다)
  answeredAt?: string
  error?: string               // 실패 사유(선생님 화면에만)
  tries?: number
  push?: PushSubscriptionJSON  // 📲 해설이 오면 알릴 기기(질문 보낸 기기) — qna-done 이 여기로 푸시를 보낸다
  pushResult?: string          // 📲 폰 알림 결과(보냄 · 구독 없음 · 실패 …) — 서버가 적는다
  worker?: string              // 만든 워커 칸(맥#칸)
  takenAt?: string             // 워커가 집은 시각
  seenAt?: string              // 👀 학생이 질문함에서 해설을 처음 본 시각(학생앱이 적는다)
}

/** 시험 질문(qna-testq)은 학생 id 가 st-qnatest — 선생님 목록·알림에서 뺀다 */
export const isTestQuestion = (q: { studentId?: string; sid?: string }) => (q.studentId ?? q.sid) === 'st-qnatest'

/** 해설이 늦는 질문 — 기다림·만드는 중인 채로 20분이 넘었다(워커가 멈췄을 수 있다) */
export function stuckMinutes(q: { status?: string; st?: string; createdAt?: string; c?: string }): number {
  const st = q.status ?? q.st
  if (st !== '대기' && st !== '만드는중') return 0
  const m = Math.floor((Date.now() - Date.parse(q.createdAt ?? q.c ?? '')) / 60_000)
  return m >= 20 ? m : 0
}

/** 질문 1건의 id — 본인 것만 골라 읽으려고 학생 id 를 접두어로 박는다(live_* 와 같은 관례) */
export function newQuestionId(studentId: string): string {
  return `q-${studentId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** 사진을 줄인다 — 문제 «글자가 읽혀야» 하므로 붙임사진(1100px)보다 크게 잡는다 */
export async function shrinkPhoto(file: File, maxW = 1600, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const el = new Image()
      el.onload = () => ok(el)
      el.onerror = () => no(new Error('사진을 읽지 못했어요'))
      el.src = url
    })
    const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d')
    if (!ctx) throw new Error('사진을 줄이지 못했어요')
    ctx.drawImage(img, 0, 0, w, h)
    return cv.toDataURL('image/jpeg', quality).split(',')[1]   // base64 본문만
  } finally { URL.revokeObjectURL(url) }
}

/** 질문 올리기 — 사진은 서버가 Storage 에, 본문은 hj_settings 한 줄에 */
export async function askQuestion(args: {
  studentId: string; studentName: string; text: string; photo: File; context?: string
  push?: PushSubscriptionJSON
}): Promise<Question> {
  if (!supabase) throw new Error('클라우드에 연결돼 있지 않아 질문을 보낼 수 없어요.')
  const id = newQuestionId(args.studentId)
  const b64 = await shrinkPhoto(args.photo)

  const r = await fetch('/api/diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'qna-upload', questionId: id, kind: 'shot', b64 }),
  })
  const up = await r.json().catch(() => ({}))
  if (!r.ok || !up.url) {
    const 원문 = String(up.error || r.status)
    console.warn('[질문함 업로드 실패]', 원문)
    // 🔴 2026-09-27: 학생 화면에 「업로드 실패(400) {"statusCode":"404","error":"Bucket not found"…}」 영문 JSON 이 그대로 떴다.
    //    서버 설정(관리자 키·사진 저장소) 문제는 학생이 할 수 있는 게 없다 → 알아들을 수 있는 말로 바꾼다.
    if (/Bucket not found|NoSuchBucket|저장 실패|row-level security|Supabase 설정|401|403/.test(원문)) {
      throw new Error('질문함이 아직 준비 중이에요. 오늘은 선생님께 문제를 직접 보여 주세요 — 준비가 끝나면 여기서 바로 해설을 받을 수 있어요.')
    }
    throw new Error('사진을 올리지 못했어요. 인터넷을 확인하고 잠시 뒤 다시 시도해 주세요.')
  }

  const q: Question = {
    id,
    studentId: args.studentId,
    studentName: args.studentName,
    text: args.text.trim(),
    shotUrl: up.url,
    createdAt: new Date().toISOString(),
    status: '대기',
    tries: 0,
    // 개인화 단계에서만 쓰인다. 풀이·검증에는 들어가지 않는다(삼자토론 확정).
    context: (args.context || '').slice(0, 1200) || undefined,
    push: args.push?.endpoint ? args.push : undefined,
  }
  const { error } = await supabase.from('hj_settings')
    .upsert({ id: 접두 + id, data: { __id: 접두 + id, value: q }, updated_at: q.createdAt })
  if (error) throw new Error(error.message.slice(0, 200))
  return q
}

async function 읽기(like: string, limit: number): Promise<Question[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('hj_settings')
    .select('id, data')
    .like('id', like)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message.slice(0, 200))
  return (data ?? [])
    .map((r: any) => r?.data?.value as Question)
    .filter((q): q is Question => !!q && !!q.id)
}

/** 내 질문 목록 (최근순) */
export function myQuestions(studentId: string, limit = 30): Promise<Question[]> {
  return 읽기(`${접두}q-${studentId}-%`, limit)
}

/** 선생님 알림용 — 질문 줄에서 필요한 칸만(사진·푸시 구독·맥락은 안 받는다, egress) */
export interface QnaLite {
  id: string; up: string; st: QnaStatus; name: string; sid: string; text: string
  c: string; a?: string; e?: string; seen?: string; push?: string
}
export async function qnaFeed(limit = 40): Promise<QnaLite[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('hj_settings')
    .select('id, up:updated_at, st:data->value->>status, name:data->value->>studentName, sid:data->value->>studentId, text:data->value->>text, c:data->value->>createdAt, a:data->value->>answeredAt, e:data->value->>error, seen:data->value->>seenAt, push:data->value->>pushResult')
    .like('id', `${접두}%`).order('updated_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message.slice(0, 200))
  return ((data ?? []) as any[]).map(r => ({ ...r, id: String(r.id).slice(접두.length) }) as QnaLite).filter(q => !isTestQuestion(q))
}

/** 👀 학생이 질문함에서 해설을 봤다 — 처음 한 번만 seenAt 을 적는다(선생님 화면 「학생 확인」) */
export async function markSeen(list: Question[]): Promise<void> {
  if (!supabase) return
  const now = new Date().toISOString()
  for (const q of list) {
    if (q.status !== '완료' || q.seenAt) continue
    const v = { ...q, seenAt: now }
    await supabase.from('hj_settings').update({ data: { __id: 접두 + q.id, value: v } }).eq('id', 접두 + q.id)
  }
}

/** 선생님 질문함 (전체 최근순) */
export function allQuestions(limit = 60): Promise<Question[]> {
  return 읽기(`${접두}%`, limit)
}

/** 워커(아이맥) 상태 보고 — 워커가 5분마다·단계가 바뀔 때 서버 wcfg_qna_beat 에 쓴다 */
export interface WorkerBeat {
  at: string                                   // 서버가 받은 시각
  host?: string                                // 워커 맥 이름
  시작?: string                                 // 워커가 켜진 시각
  상태?: string                                 // 대기중 · 처리중 · 한도대기 · 오류
  현재?: { 질문?: string; 학생?: string; 단계?: string; 시작?: string } | null
  오늘?: { 날짜?: string; 완료?: number; 보류?: number; 실패?: number }
  최근오류?: { at: string; 글: string; 화면?: string }[]   // 화면 = 실패한 순간의 ChatGPT 화면(진단용)
  최근기록?: string[]
  설정버전?: number | null
  동시?: number                                  // 이 맥이 동시에 만드는 칸 수(2026-09-28)
  작업?: { 칸: number; 질문?: string; 학생?: string; 단계?: string; 시작?: string }[]   // 칸마다 지금 하는 일
  코드버전?: number
}

/** 워커 맥들의 상태 — 맥마다 줄이 따로다(wcfg_qna_beat__<맥>). 옛 줄(wcfg_qna_beat)은 같은 맥이면 새 것만 남긴다. 최근 신호순 */
export async function workerBeats(): Promise<WorkerBeat[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('hj_settings').select('id, data').like('id', 'wcfg_qna_beat%')
  if (error) throw new Error(error.message.slice(0, 200))
  const 맥별 = new Map<string, WorkerBeat>()
  for (const r of (data ?? []) as any[]) {
    const b = r?.data?.value as WorkerBeat | undefined
    if (!b?.at) continue
    const k = b.host || r.id
    const 전 = 맥별.get(k)
    if (!전 || 전.at < b.at) 맥별.set(k, b)
  }
  return [...맥별.values()].sort((a, b) => b.at.localeCompare(a.at))
}

/** (옛 호출용) 가장 최근 신호를 보낸 워커 하나 */
export async function workerBeat(): Promise<WorkerBeat | null> {
  return (await workerBeats())[0] ?? null
}

// ── ⏳ 대기 순서 — 학생 화면 「앞에 2명 · 약 12분 뒤 도착」 (2026-09-28 명수쌤) ──
// 읽는 것은 상태·시각 몇 칸뿐이다(jsonb 통째로 받지 않는다 — egress).
export interface QueueInfo {
  ahead: number        // 내 앞에 있는 질문 수(만드는 중 포함)
  slots: number        // 지금 켜져 있는 워커 칸 수 합(0 이면 워커가 꺼져 있음)
  perMin: number       // 한 건에 걸리는 시간(분) — 최근 완료 평균, 없으면 6
  etaMin: number       // 대략 몇 분 뒤 도착
  making: boolean      // 내 질문을 지금 만드는 중
}
/** 기다리는 내 질문들의 대기 순서 — 서버를 세 번만 읽고(열·워커·최근 완료) 질문마다 계산한다 */
export async function queueInfos(mine: Question[]): Promise<Map<string, QueueInfo>> {
  const out = new Map<string, QueueInfo>()
  const 기다림 = mine.filter(q => q.status === '대기' || q.status === '만드는중')
  if (!supabase || !기다림.length) return out
  const [열, 맥들, 끝난] = await Promise.all([
    supabase.from('hj_settings')
      .select('id, st:data->value->>status, c:data->value->>createdAt, t:data->value->>takenAt')
      .like('id', 'qna_%').in('data->value->>status', ['대기', '만드는중']).limit(100),
    workerBeats().catch(() => [] as WorkerBeat[]),
    supabase.from('hj_settings')
      .select('t:data->value->>takenAt, a:data->value->>answeredAt')
      .like('id', 'qna_%').eq('data->value->>status', '완료').order('updated_at', { ascending: false }).limit(12),
  ])
  if (열.error) return out
  const rows = (열.data ?? []) as { id: string; st: string; c: string; t?: string }[]
  const 살아있음 = 맥들.filter(b => Date.now() - Date.parse(b.at) < 15 * 60_000)
  const slots = 살아있음.reduce((n, b) => n + Math.max(1, Number(b.동시) || 1), 0)
  const 걸린 = ((끝난.data ?? []) as { t?: string; a?: string }[])
    .map(r => (r.t && r.a ? (Date.parse(r.a) - Date.parse(r.t)) / 60_000 : NaN))
    .filter(m => m > 1 && m < 30)
  const perMin = 걸린.length ? Math.round(걸린.reduce((a, b) => a + b, 0) / 걸린.length) : 6
  for (const mine1 of 기다림) {
    const 나 = `qna_${mine1.id}`
    const 내것 = rows.find(r => r.id === 나)
    const making = (내것?.st ?? mine1.status) === '만드는중'
    const ahead = making ? 0 : rows.filter(r => r.id !== 나 && (r.st === '만드는중' || (r.st === '대기' && r.c < mine1.createdAt))).length
    const etaMin = making
      ? Math.max(1, Math.round(perMin - (Date.now() - Date.parse(내것?.t || mine1.createdAt)) / 60_000))
      : (Math.floor(ahead / Math.max(1, slots)) + 1) * perMin
    out.set(mine1.id, { ahead, slots, perMin, etaMin, making })
  }
  return out
}

/** 질문 지우기 — 학생이 잘못 올렸을 때 */
export async function removeQuestion(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('hj_settings').delete().eq('id', 접두 + id)
  if (error) throw new Error(error.message.slice(0, 200))
}

/** 아직 안 본 완료 답변 수 — 헤더 배지용(읽음 시각은 기기 로컬에 둔다) */
export const QNA_READ_KEY = 'gsg-qna-read-at'
export function unreadCount(list: Question[]): number {
  return unreadOf(list).length
}
/** 아직 안 본 완료 답변들 — 이 기기에서 한 번도 질문함을 안 열었으면 최근 3일 것만 센다(옛 답이 전부 «새 것» 으로 뜨지 않게) */
export function unreadOf(list: Question[]): Question[] {
  let readAt = ''
  try { readAt = localStorage.getItem(QNA_READ_KEY) ?? '' } catch { /* 무시 */ }
  if (!readAt) readAt = new Date(Date.now() - 3 * 86400_000).toISOString()
  return list.filter(q => q.status === '완료' && (q.answeredAt ?? '') > readAt)
}
export function markQnaRead(): void {
  try { localStorage.setItem(QNA_READ_KEY, new Date().toISOString()) } catch { /* 무시 */ }
  try { window.dispatchEvent(new Event('qna:read')) } catch { /* 무시 */ }
}
