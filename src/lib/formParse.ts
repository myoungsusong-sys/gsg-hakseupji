import type { Student, TTResource } from '../types'
import { uid } from './store'

// ── 양식지 파싱 — 인쇄 양식에 손으로 적은 내용을 그대로 옮겨 적으면 학생·시간표가 만들어진다 ──
// 형식: "항목: 값" 한 줄씩. 항목명은 몇 가지 표기를 모두 허용하고, 모르는 줄은 조용히 무시한다.

const ALIAS: Record<string, string> = {
  이름: 'name', 학생이름: 'name', 성명: 'name',
  학년: 'grade',
  학교: 'school',
  출결번호: 'attendNo', 출결: 'attendNo',
  학생연락처: 'studentPhone', 학생전화: 'studentPhone',
  학부모연락처: 'parentPhone', 학부모전화: 'parentPhone', 보호자연락처: 'parentPhone',
  생년월일: 'birth', 생일: 'birth',
  주소: 'address', 집주소: 'address',
  반: 'klass',
  수업요일: 'classDays', 등원요일: 'classDays',
  등원시간: 'arriveTime', 하원시간: 'leaveTime',
  mbti: 'mbti', MBTI: 'mbti', 엠비티아이: 'mbti',
  혈액형: 'bloodType',
  목표: 'goal', 학습목표: 'goal',
  성향: 'traits', 학습성향: 'traits',
  이전학원: 'prevEdu', 이전학습: 'prevEdu', 학원이력: 'prevEdu',
  현재진도: 'progressNow', 현행진도: 'progressNow', 진도: 'progressNow',
  자기공부시간: 'weeklyHours', 주당공부시간: 'weeklyHours',
  학부모요청: 'parentConcern', 요청사항: 'parentConcern', 걱정: 'parentConcern',
  특이사항: 'memo', 메모: 'memo', 비고: 'memo',
  최근시험: 'exams', 시험점수: 'exams', 학교시험: 'exams',
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/[()[\]]/g, '').toLowerCase()
const DAY_RE = /[월화수목금토일]/g

export interface ParsedStudent {
  patch: Partial<Omit<Student, 'id' | 'active'>>
  unknownLines: string[]
  found: string[]     // 인식한 항목 라벨 (미리보기용)
}

export function parseStudentForm(text: string): ParsedStudent {
  const patch: Record<string, any> = {}
  const unknownLines: string[] = []
  const found: string[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || /^[-=·•#]+$/.test(line)) continue
    const m = line.match(/^([^:：]+)[:：](.*)$/)
    if (!m) { if (line.length > 1) unknownLines.push(line); continue }
    const keyRaw = m[1].trim()
    const val = m[2].trim()
    if (!val || val === '-') continue
    const key = ALIAS[norm(keyRaw)] ?? ALIAS[keyRaw.replace(/\s/g, '')]
    if (!key) { unknownLines.push(line); continue }

    switch (key) {
      case 'classDays': {
        const days = [...new Set(val.match(DAY_RE) ?? [])]
        if (days.length) { patch.classDays = days; found.push(`수업 요일 ${days.join('·')}`) }
        break
      }
      case 'traits': {
        const arr = val.split(/[,·/]/).map(s => s.trim()).filter(Boolean)
        if (arr.length) { patch.traits = arr; found.push(`학습 성향 ${arr.length}개`) }
        break
      }
      case 'exams': {
        // "1학기 중간 수학 82, 기말 수학 90" 또는 "수학 82"
        const rows = val.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(chunk => {
          const sm = chunk.match(/(\d{1,3})\s*점?$/)
          const score = sm ? sm[1] : ''
          const rest = sm ? chunk.slice(0, sm.index).trim() : chunk
          const parts = rest.split(/\s+/)
          const subject = parts.length > 1 ? parts[parts.length - 1] : ''
          const name = parts.length > 1 ? parts.slice(0, -1).join(' ') : rest
          return { name, subject, score }
        }).filter(r => r.score || r.name)
        if (rows.length) { patch.recentExams = rows; found.push(`최근 시험 ${rows.length}건`) }
        break
      }
      case 'mbti': {
        const t = val.toUpperCase().replace(/[^A-Z]/g, '')
        if (/^[EI][NS][TF][JP]$/.test(t)) { patch.mbti = t; found.push(`MBTI ${t}`) }
        break
      }
      case 'bloodType': {
        const b = val.toUpperCase().replace(/[^ABO]/g, '')
        if (['A', 'B', 'O', 'AB'].includes(b)) { patch.bloodType = b; found.push(`혈액형 ${b}`) }
        break
      }
      case 'arriveTime': case 'leaveTime': {
        const t = normTime(val)
        if (t) { patch[key] = t; found.push(`${key === 'arriveTime' ? '등원' : '하원'} ${t}`) }
        break
      }
      case 'grade': {
        patch.grade = val.replace(/\s/g, '')
        found.push(`학년 ${patch.grade}`)
        break
      }
      default:
        patch[key] = val
        found.push(`${keyRaw.trim()}`)
    }
  }
  return { patch: patch as ParsedStudent['patch'], unknownLines, found }
}

// "17시", "17:00", "오후 5시", "1700" → "17:00"
export function normTime(v: string): string | null {
  const s = v.trim()
  let m = s.match(/^(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/)
  if (m) {
    let h = Number(m[2]); const mi = Number(m[3] ?? 0)
    if (m[1] === '오후' && h < 12) h += 12
    if (m[1] === '오전' && h === 12) h = 0
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  }
  m = s.match(/^(\d{3,4})$/)
  if (m) {
    const n = m[1].padStart(4, '0')
    const h = Number(n.slice(0, 2)), mi = Number(n.slice(2))
    if (h <= 23 && mi <= 59) return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  }
  return null
}

export interface ParsedTimetable {
  days: Record<string, { start: string; end: string } | null>
  slotMin?: number
  resources: TTResource[]
  found: string[]
  unknownLines: string[]
}

// 시간표 양식지 파싱
//   "월: 16:00~22:00"  … 요일별 공부시간
//   "블록: 60분"
//   "교재: 쎈 중등수학 1(상) / 수학 / 주5"
//   "인강: 엠베스트 국어 / 국어 / 주3"
export function parseTimetableForm(text: string): ParsedTimetable {
  const days: Record<string, { start: string; end: string } | null> = {}
  const resources: TTResource[] = []
  const found: string[] = []
  const unknownLines: string[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || /^[-=·•#]+$/.test(line)) continue
    const m = line.match(/^([^:：]+)[:：](.*)$/)
    if (!m) { if (line.length > 1) unknownLines.push(line); continue }
    const key = m[1].trim()
    const val = m[2].trim()
    if (!val || val === '-' || val === '휴무' || val === 'x' || val === 'X') {
      if (/^[월화수목금토일]$/.test(key)) days[key] = null
      continue
    }

    if (/^[월화수목금토일]$/.test(key)) {
      const t = val.split(/[~\-–—]/).map(x => normTime(x)).filter(Boolean) as string[]
      if (t.length >= 2) { days[key] = { start: t[0], end: t[1] }; found.push(`${key} ${t[0]}~${t[1]}`) }
      continue
    }
    if (/블록|슬롯|길이/.test(key)) {
      const n = Number(val.replace(/[^\d]/g, ''))
      if (n >= 20 && n <= 180) found.push(`블록 ${n}분`)
      continue
    }
    if (/교재|인강|강의/.test(key)) {
      const kind: TTResource['kind'] = /인강|강의/.test(key) ? '인강' : '교재'
      const parts = val.split('/').map(s => s.trim())
      const title = parts[0]
      if (!title) continue
      const subject = parts[1] || '수학'
      const weekly = Number((parts[2] ?? '').replace(/[^\d]/g, '')) || 0
      resources.push({ id: uid('ttr'), kind, title, subject, weekly })
      found.push(`${kind} ${title}${weekly ? ` 주${weekly}` : ''}`)
      continue
    }
    unknownLines.push(line)
  }

  const slot = text.match(/블록[^:：]*[:：]\s*(\d+)/)
  return { days, slotMin: slot ? Number(slot[1]) : undefined, resources, found, unknownLines }
}
