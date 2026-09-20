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

export type QnaStatus = '대기' | '만드는중' | '완료' | '실패'

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
  answeredAt?: string
  error?: string               // 실패 사유(선생님 화면에만)
  tries?: number
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
  studentId: string; studentName: string; text: string; photo: File
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
  if (!r.ok || !up.url) throw new Error(up.error || '사진을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.')

  const q: Question = {
    id,
    studentId: args.studentId,
    studentName: args.studentName,
    text: args.text.trim(),
    shotUrl: up.url,
    createdAt: new Date().toISOString(),
    status: '대기',
    tries: 0,
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

/** 선생님 질문함 (전체 최근순) */
export function allQuestions(limit = 60): Promise<Question[]> {
  return 읽기(`${접두}%`, limit)
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
  let readAt = ''
  try { readAt = localStorage.getItem(QNA_READ_KEY) ?? '' } catch { /* 무시 */ }
  return list.filter(q => q.status === '완료' && (q.answeredAt ?? '') > readAt).length
}
export function markQnaRead(): void {
  try { localStorage.setItem(QNA_READ_KEY, new Date().toISOString()) } catch { /* 무시 */ }
}
