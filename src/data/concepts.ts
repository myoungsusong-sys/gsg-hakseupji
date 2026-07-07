// 소단원별 개념 정리 (자체 작성 · 검산 완료). STEP2 '개념 추가' 탭에서 학습지에 삽입.
export interface Concept {
  id: string
  subId: string       // 소속 소단원 id (curriculum SubUnit.id)
  title: string
  lines: string[]     // $...$ 는 KaTeX 렌더링
}

export const CONCEPTS: Concept[] = [
  {
    id: 'c-prime', subId: 'm1-1-u0m0s0', title: '소수와 합성수',
    lines: [
      '소수: $1$보다 큰 자연수 중 $1$과 자기 자신만을 약수로 가지는 수. (예: $2,3,5,7,\\dots$)',
      '합성수: $1$보다 큰 자연수 중 소수가 아닌 수. (약수가 $3$개 이상)',
      '$1$은 소수도 합성수도 아니다. 가장 작은 소수는 $2$이며, 짝수인 소수는 $2$뿐이다.',
    ],
  },
  {
    id: 'c-power', subId: 'm1-1-u0m0s1', title: '거듭제곱',
    lines: [
      '같은 수를 여러 번 곱한 것을 거듭제곱으로 나타낸다. $a\\times a\\times a=a^3$',
      '$a$를 밑, 곱한 횟수를 지수라 한다.',
    ],
  },
  {
    id: 'c-factorize', subId: 'm1-1-u0m0s1', title: '소인수분해',
    lines: [
      '소인수: 어떤 자연수의 약수 중 소수인 것.',
      '소인수분해: 자연수를 소인수들만의 곱으로 나타내는 것. (예: $84=2^2\\times3\\times7$)',
      '소인수분해의 결과는 곱하는 순서를 생각하지 않으면 오직 한 가지뿐이다.',
    ],
  },
  {
    id: 'c-divcount', subId: 'm1-1-u0m0s2', title: '약수의 개수',
    lines: [
      '$A=a^m\\times b^n$ ($a,b$는 서로 다른 소수)으로 소인수분해될 때,',
      '$A$의 약수의 개수는 $(m+1)\\times(n+1)$이다.',
    ],
  },
  {
    id: 'c-gcd', subId: 'm1-1-u0m1s0', title: '최대공약수',
    lines: [
      '두 수의 공통인 소인수를 지수가 작은 것끼리 곱한다.',
      '서로소: 최대공약수가 $1$인 두 자연수.',
    ],
  },
  {
    id: 'c-lcm', subId: 'm1-1-u0m1s1', title: '최소공배수',
    lines: [
      '공통인 소인수는 지수가 큰 것을, 공통이 아닌 소인수는 모두 곱한다.',
      '두 수 $A,B$에 대하여 (최대공약수)$\\times$(최소공배수)$=A\\times B$.',
    ],
  },
  {
    id: 'c-abs', subId: 'm1-1-u1m0s3', title: '절댓값',
    lines: [
      '수직선 위에서 어떤 수를 나타내는 점과 원점 사이의 거리. 기호 $|\\ |$.',
      '$|a|\\ge0$이고, 절댓값이 $a\\ (a>0)$인 수는 $+a,-a$의 두 개다. $|0|=0$.',
    ],
  },
  {
    id: 'c-compare', subId: 'm1-1-u1m0s4', title: '수의 대소 관계',
    lines: [
      '(음수) $<$ $0$ $<$ (양수).',
      '양수는 절댓값이 클수록 크고, 음수는 절댓값이 클수록 작다.',
    ],
  },
  {
    id: 'c-addsub', subId: 'm1-1-u1m1s0', title: '유리수의 덧셈과 뺄셈',
    lines: [
      '부호가 같은 두 수: 절댓값의 합에 공통 부호.',
      '부호가 다른 두 수: 절댓값의 차에 절댓값이 큰 수의 부호.',
      '뺄셈은 빼는 수의 부호를 바꾸어 더한다.',
    ],
  },
  {
    id: 'c-muldiv', subId: 'm1-1-u1m1s1', title: '유리수의 곱셈과 나눗셈',
    lines: [
      '부호가 같으면 $+$, 다르면 $-$. 음수가 짝수 개면 $+$, 홀수 개면 $-$.',
      '나눗셈은 역수를 곱한다.',
    ],
  },
  {
    id: 'c-eq', subId: 'm1-1-u2m1s2', title: '일차방정식의 풀이',
    lines: [
      '이항: 등호 반대편으로 옮기며 부호를 바꾼다.',
      '$ax=b\\ (a\\ne0)$ 꼴로 정리한 뒤 양변을 $a$로 나눈다.',
    ],
  },
  {
    id: 'c-direct', subId: 'm1-1-u3m1s0', title: '정비례',
    lines: [
      '$y=ax\\ (a\\ne0)$. $x$가 $2,3,\\dots$배가 되면 $y$도 $2,3,\\dots$배가 된다.',
      '그래프는 원점을 지나는 직선.',
    ],
  },
  {
    id: 'c-inverse', subId: 'm1-1-u3m1s1', title: '반비례',
    lines: [
      '$y=\\dfrac{a}{x}\\ (a\\ne0)$. $x$가 $2,3,\\dots$배가 되면 $y$는 $\\dfrac12,\\dfrac13,\\dots$배가 된다.',
      '그래프는 원점에 대칭인 한 쌍의 곡선(쌍곡선).',
    ],
  },
]

export function conceptsForSubUnits(subIds: Set<string>): Concept[] {
  return CONCEPTS.filter(c => subIds.has(c.subId))
}
