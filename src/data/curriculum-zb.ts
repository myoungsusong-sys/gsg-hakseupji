// 자동 생성 — 족보닷컴 PDF 변환(zb_build.py). 손으로 고치지 마라.
// 📒 족보닷컴 과정(2026-10-25 명수쌤 «족보닷컴에서 받는 자료를 그대로 과목별로 올려»):
//    교과서 한 권(학기) = 과정 하나 · 트리 = 대단원 → 중단원 → 문제지 한 장(소단원) → 유형 하나.
//    문항 = 지문 글(밑줄 살림) + 문항 그림(figs/zb/…) · 정답은 정답표 그림을 읽은 것 · 해설은 해설 그림.
//    문항 id = <과정>_<ZB번호>_<문항번호> — 학습지가 이 id 로 자기 과정 파일만 불러온다(zbCoursesOf).
type ZType = [string, string]
type ZSub = [string, ZType[]]
type ZMid = [string, ZSub[]]
type ZBig = [string, ZMid[]]
export interface ZbCourse { id: string; grade: string; subject: '국어' | '영어' | '수학' | '과학' | '사회' | '역사'; book: string; sem: number; title: string; tree: ZBig[] }
export const ZB_COURSES: ZbCourse[] = [
 {
  "id": "zb-kor-m22-chj-nms",
  "grade": "중2",
  "subject": "국어",
  "book": "천재(노미숙)",
  "sem": 2,
  "title": "국어 중2-2 족보닷컴",
  "tree": [
   [
    "1단원",
    [
     [
      "1-1. 문학, 시대의 거울",
      [
       [
        "1-1-2 수난이대",
        [
         [
          "zb-kor-m22-chj-nms-0168",
          "족보닷컴 수난이대 (30문항)"
         ]
        ]
       ]
      ]
     ]
    ]
   ]
  ]
 }
]

/** 족보 문항 id(zb-…_ZB번호_번호) → 과정 id. 족보 문항이 아니면 null */
export function zbCourseOf(problemId: string): string | null {
  if (!problemId.startsWith('zb-')) return null
  const i = problemId.indexOf('_')
  return i > 0 ? problemId.slice(0, i) : null
}
/** 학습지 문항들이 든 족보 과정들 — 학습지마다 필요한 과정 파일만 부른다 */
export function zbCoursesOf(problemIds: readonly string[] | undefined): string[] {
  const out = new Set<string>()
  for (const id of problemIds ?? []) { const c = zbCourseOf(id); if (c) out.add(c) }
  return [...out]
}
