// ── 문제 질문함 ────────────────────────────────────────────────
// 학생이 모르는 문제를 찍어 올리고 질문을 적으면, 명수쌤 맥의 워커가 해설 이미지를
// 만들어 돌려준다. 여기는 그 「앞단」(업로드·조회)만 담당한다.
//
// 🔴 store/backend 를 타지 않는다.
//    backend.ts 의 rows()/loadAll() 은 9개 테이블을 전량으로 받아오고 실시간 변경마다 다시 돈다.
//    질문에는 사진이 붙으므로 그 경로에 올리면 앱을 켤 때마다 전부 재다운로드되고,
//    2026-09-02 의 egress 402 잠김이 재발한다. 그래서
//      · 전용 테이블 hj_questions (backend.ts TABLES 에 **넣지 않는다**)
//      · 사진은 jsonb 가 아니라 Storage 버킷 'qna' — 행에는 URL 한 줄만
//      · 조회는 언제나 like(본인 것) + limit
//    로 간다. 스키마는 supabase/qna.sql.

import { supabase } from './supabase'

export const QNA_BUCKET = 'qna'
const TABLE = 'hj_questions'

export type QnaStatus = '대기' | '만드는중' | '완료' | '실패'

export interface Question {
  id: string
  studentId: string
  studentName: string
  text: string                 // 학생이 적은 질문
  shotUrl: string              // 학생이 찍은 문제 사진
  createdAt: string
  status: QnaStatus
  answerUrl?: string           // 해설 이미지
  answerText?: string          // 해설 한 줄 요약(워커가 넣는다)
  answeredAt?: string
  error?: string               // 실패 사유(선생님 화면에만)
  tries?: number
}

export interface QnaRow { id: string; data: Question; updated_at: string }

/** 질문 1건의 id — 본인 것만 골라 읽으려고 학생 id 를 접두어로 박는다(live_* 와 같은 관례) */
export function newQuestionId(studentId: string): string {
  return `q-${studentId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** 사진을 문제 촬영용 크기로 줄인다 — 글자가 읽혀야 하므로 FixItButton(1100px)보다 크게 잡는다 */
export async function shrinkPhoto(file: File, maxW = 1600, quality = 0.72): Promise<Blob> {
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
    const blob = await new Promise<Blob | null>(ok => cv.toBlob(ok, 'image/jpeg', quality))
    if (!blob) throw new Error('사진을 저장하지 못했어요')
    return blob
  } finally { URL.revokeObjectURL(url) }
}

function publicUrl(path: string): string {
  return supabase!.storage.from(QNA_BUCKET).getPublicUrl(path).data.publicUrl
}

/** 질문 올리기 — 사진을 Storage 에, 본문을 hj_questions 에 */
export async function askQuestion(args: {
  studentId: string; studentName: string; text: string; photo: File
}): Promise<Question> {
  if (!supabase) throw new Error('클라우드에 연결돼 있지 않아 질문을 보낼 수 없어요.')
  const id = newQuestionId(args.studentId)
  const blob = await shrinkPhoto(args.photo)
  const path = `${id}/shot.jpg`
  const up = await supabase.storage.from(QNA_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg', upsert: true, cacheControl: '3600',
  })
  if (up.error) throw new Error(bucketHint(up.error.message))

  const q: Question = {
    id,
    studentId: args.studentId,
    studentName: args.studentName,
    text: args.text.trim(),
    shotUrl: publicUrl(path),
    createdAt: new Date().toISOString(),
    status: '대기',
    tries: 0,
  }
  const { error } = await supabase.from(TABLE).insert({ id, data: q, updated_at: q.createdAt })
  if (error) throw new Error(tableHint(error.message))
  return q
}

/** 내 질문 목록 (최근순) */
export async function myQuestions(studentId: string, limit = 30): Promise<Question[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE)
    .select('id, data')
    .like('id', `q-${studentId}-%`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(tableHint(error.message))
  return (data ?? []).map(r => (r as unknown as QnaRow).data)
}

/** 선생님 질문함 (전체 최근순) */
export async function allQuestions(limit = 50): Promise<Question[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE)
    .select('id, data')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(tableHint(error.message))
  return (data ?? []).map(r => (r as unknown as QnaRow).data)
}

/** 질문 지우기 — 학생이 잘못 올렸을 때 (사진도 같이 지운다) */
export async function removeQuestion(id: string): Promise<void> {
  if (!supabase) return
  await supabase.storage.from(QNA_BUCKET).remove([`${id}/shot.jpg`, `${id}/answer.jpg`])
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
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

// ── 아직 설치 전일 때 친절하게 ─────────────────────────────────
function tableHint(msg: string): string {
  if (/relation .*hj_questions.* does not exist|schema cache/i.test(msg))
    return '질문함이 아직 준비 중이에요. 선생님께 알려주세요. (supabase/qna.sql 실행 필요)'
  return msg.slice(0, 200)
}
function bucketHint(msg: string): string {
  if (/bucket not found|not found/i.test(msg))
    return '사진 보관함이 아직 준비 중이에요. 선생님께 알려주세요. (supabase/qna.sql 실행 필요)'
  return msg.slice(0, 200)
}
