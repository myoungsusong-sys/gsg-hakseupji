import type { Problem } from '../types'

// 자체 제작 샘플 문제은행 (중1-1, 22개정) — 전 문항 검산 완료.
// $...$ 구간은 KaTeX로 렌더링된다.
export const SEED_PROBLEMS: Problem[] = [
  // ── 소수와 합성수 ──────────────────────────────
  {
    id: 'p001', typeId: 't-prime', kind: '객관식', diff: 1,
    body: '다음 중 소수인 것은?',
    choices: ['$1$', '$9$', '$15$', '$17$', '$21$'],
    answer: '④',
    solution: '$1$은 소수가 아니고, $9=3^2$, $15=3\\times5$, $21=3\\times7$은 합성수이다. $17$의 약수는 $1$과 $17$뿐이므로 소수이다.',
    source: '자체제작',
  },
  {
    id: 'p002', typeId: 't-prime', kind: '주관식', diff: 2,
    body: '$20$ 이하의 자연수 중 소수의 개수를 구하시오.',
    answer: '8개',
    solution: '$20$ 이하의 소수는 $2, 3, 5, 7, 11, 13, 17, 19$로 모두 $8$개이다.',
    source: '자체제작',
  },
  {
    id: 'p003', typeId: 't-prime', kind: '객관식', diff: 3,
    body: '다음 설명 중 옳은 것은?',
    choices: [
      '가장 작은 소수는 $1$이다.',
      '모든 소수는 홀수이다.',
      '두 소수의 곱은 항상 홀수이다.',
      '소수의 약수는 $2$개이다.',
      '합성수의 약수는 $2$개이다.',
    ],
    answer: '④',
    solution: '가장 작은 소수는 $2$이고, $2$는 짝수인 소수이다. $2\\times3=6$은 짝수이므로 ③도 거짓. 소수는 약수가 $1$과 자기 자신뿐이므로 $2$개(④ 참). 합성수는 약수가 $3$개 이상이다.',
    source: '자체제작',
  },
  // ── 거듭제곱 ──────────────────────────────
  {
    id: 'p004', typeId: 't-power', kind: '객관식', diff: 1,
    body: '$2\\times2\\times2\\times3\\times3$을 거듭제곱을 사용하여 나타내면?',
    choices: ['$2^2\\times3^3$', '$2^3\\times3^2$', '$2^3\\times3^3$', '$6^5$', '$2^5\\times3$'],
    answer: '②',
    solution: '$2$가 $3$번, $3$이 $2$번 곱해져 있으므로 $2^3\\times3^2$이다.',
    source: '자체제작',
  },
  {
    id: 'p005', twinGroup: 'tg-power', typeId: 't-power', kind: '주관식', diff: 2,
    body: '$2^a=32$일 때, 자연수 $a$의 값을 구하시오.',
    answer: '$a=5$',
    solution: '$32=2\\times2\\times2\\times2\\times2=2^5$이므로 $a=5$이다.',
    source: '자체제작',
  },
  // ── 소인수분해 하기 ──────────────────────────────
  {
    id: 'p006', typeId: 't-factorize', kind: '객관식', diff: 2,
    body: '$84$를 소인수분해하면?',
    choices: ['$2\\times42$', '$2^2\\times21$', '$2^2\\times3\\times7$', '$2^3\\times3\\times7$', '$4\\times21$'],
    answer: '③',
    solution: '$84=2\\times42=2\\times2\\times21=2^2\\times3\\times7$. 소인수분해는 소수들만의 곱으로 나타내야 하므로 ①, ②, ⑤는 소인수분해가 아니다.',
    source: '자체제작',
  },
  {
    id: 'p007', typeId: 't-factorize', kind: '주관식', diff: 2,
    body: '$180$을 소인수분해하시오.',
    answer: '$180=2^2\\times3^2\\times5$',
    solution: '$180=2\\times90=2\\times2\\times45=2^2\\times9\\times5=2^2\\times3^2\\times5$.',
    source: '자체제작',
  },
  // ── 제곱수 만들기 ──────────────────────────────
  {
    id: 'p008', typeId: 't-square', kind: '주관식', diff: 4, isNew: true,
    body: '$48$에 자연수 $a$를 곱하여 어떤 자연수의 제곱이 되도록 할 때, 가장 작은 자연수 $a$의 값을 구하시오.',
    answer: '$a=3$',
    solution: '$48=2^4\\times3$. 제곱수가 되려면 모든 소인수의 지수가 짝수여야 하므로 $3$을 한 번 더 곱해야 한다. $48\\times3=144=12^2$. 따라서 $a=3$.',
    source: '자체제작',
  },
  // ── 약수의 개수 ──────────────────────────────
  {
    id: 'p009', twinGroup: 'tg-divcount', typeId: 't-divcount', kind: '객관식', diff: 3,
    body: '$72$의 약수의 개수는?',
    choices: ['$8$개', '$9$개', '$10$개', '$12$개', '$15$개'],
    answer: '④',
    solution: '$72=2^3\\times3^2$이므로 약수의 개수는 $(3+1)\\times(2+1)=12$개이다.',
    source: '자체제작',
  },
  {
    id: 'p010', typeId: 't-divcount', kind: '주관식', diff: 5,
    body: '$2^3\\times5^n$의 약수의 개수가 $16$개일 때, 자연수 $n$의 값을 구하시오.',
    answer: '$n=3$',
    solution: '약수의 개수는 $(3+1)(n+1)=16$이므로 $n+1=4$, 즉 $n=3$이다.',
    source: '자체제작',
  },
  // ── 최대공약수 ──────────────────────────────
  {
    id: 'p011', twinGroup: 'tg-gcd', typeId: 't-gcd', kind: '주관식', diff: 2,
    body: '두 수 $36$, $60$의 최대공약수를 구하시오.',
    answer: '$12$',
    solution: '$36=2^2\\times3^2$, $60=2^2\\times3\\times5$. 공통인 소인수의 지수가 작은 쪽을 택하면 $2^2\\times3=12$.',
    source: '자체제작',
  },
  // ── 최소공배수 ──────────────────────────────
  {
    id: 'p012', typeId: 't-lcm', kind: '객관식', diff: 3,
    body: '두 수 $12$, $18$의 최소공배수는?',
    choices: ['$6$', '$24$', '$36$', '$54$', '$72$'],
    answer: '③',
    solution: '$12=2^2\\times3$, $18=2\\times3^2$. 지수가 큰 쪽을 모두 택하면 $2^2\\times3^2=36$.',
    source: '자체제작',
  },
  // ── 활용 ──────────────────────────────
  {
    id: 'p013', typeId: 't-gcdlcm-app', kind: '주관식', diff: 4,
    body: '가로 $84\\,\\mathrm{cm}$, 세로 $60\\,\\mathrm{cm}$인 직사각형 모양의 벽에 가능한 한 큰 정사각형 모양의 타일을 빈틈없이 붙이려고 한다. 타일 한 변의 길이를 구하시오.',
    answer: '$12\\,\\mathrm{cm}$',
    solution: '타일 한 변의 길이는 $84$와 $60$의 최대공약수이다. $84=2^2\\times3\\times7$, $60=2^2\\times3\\times5$이므로 최대공약수는 $2^2\\times3=12$. 따라서 $12\\,\\mathrm{cm}$.',
    source: '자체제작',
  },
  {
    id: 'p014', typeId: 't-gcdlcm-app', kind: '주관식', diff: 5,
    body: '어느 정류장에서 A 버스는 $15$분마다, B 버스는 $25$분마다 출발한다. 오전 $9$시에 두 버스가 동시에 출발했다면, 다음에 처음으로 동시에 출발하는 시각을 구하시오.',
    answer: '오전 10시 15분',
    solution: '$15=3\\times5$, $25=5^2$의 최소공배수는 $3\\times5^2=75$(분). $75$분 후는 $1$시간 $15$분 후이므로 오전 $10$시 $15$분이다.',
    source: '자체제작',
  },
  // ── 정수와 유리수의 분류 ──────────────────────────────
  {
    id: 'p015', typeId: 't-classify', kind: '객관식', diff: 1,
    body: '다음 중 정수가 아닌 유리수는?',
    choices: ['$-3$', '$0$', '$\\dfrac{1}{2}$', '$5$', '$-10$'],
    answer: '③',
    solution: '$-3, 0, 5, -10$은 모두 정수이다. $\\dfrac{1}{2}$은 유리수이지만 정수는 아니다.',
    source: '자체제작',
  },
  // ── 절댓값 ──────────────────────────────
  {
    id: 'p016', typeId: 't-abs', kind: '주관식', diff: 2,
    body: '절댓값이 $4$인 수를 모두 구하시오.',
    answer: '$4, -4$',
    solution: '원점에서 거리가 $4$인 수는 $4$와 $-4$의 두 개다.',
    source: '자체제작',
  },
  {
    id: 'p017', twinGroup: 'tg-abs-calc', typeId: 't-abs', kind: '객관식', diff: 3,
    body: '$|-5|+|3|-|-2|$의 값은?',
    choices: ['$0$', '$4$', '$6$', '$8$', '$10$'],
    answer: '③',
    solution: '$|-5|=5$, $|3|=3$, $|-2|=2$이므로 $5+3-2=6$.',
    source: '자체제작',
  },
  // ── 대소 비교 ──────────────────────────────
  {
    id: 'p018', typeId: 't-compare', kind: '객관식', diff: 2,
    body: '다음 중 두 수의 대소 관계가 옳은 것은?',
    choices: [
      '$-3>-1$',
      '$|-2|<1$',
      '$0<-5$',
      '$-\\dfrac{1}{2}>-\\dfrac{1}{3}$',
      '$-\\dfrac{2}{3}>-\\dfrac{3}{4}$',
    ],
    answer: '⑤',
    solution: '음수는 절댓값이 작을수록 크다. $\\left|-\\dfrac{2}{3}\\right|=\\dfrac{8}{12}<\\dfrac{9}{12}=\\left|-\\dfrac{3}{4}\\right|$이므로 $-\\dfrac{2}{3}>-\\dfrac{3}{4}$ (⑤ 참). ①은 $-3<-1$, ②는 $2>1$, ③은 $0>-5$, ④는 $-\\dfrac{1}{2}<-\\dfrac{1}{3}$이므로 모두 거짓.',
    source: '자체제작',
  },
  // ── 덧셈과 뺄셈 ──────────────────────────────
  {
    id: 'p019', typeId: 't-addsub', kind: '객관식', diff: 1,
    body: '$(-3)+(-4)$의 값은?',
    choices: ['$-12$', '$-7$', '$-1$', '$1$', '$7$'],
    answer: '②',
    solution: '같은 부호의 두 수의 합은 절댓값의 합에 공통 부호를 붙인다. $-(3+4)=-7$.',
    source: '자체제작',
  },
  {
    id: 'p020', typeId: 't-addsub', kind: '주관식', diff: 2,
    body: '$(-7)+(+3)-(-5)$를 계산하시오.',
    answer: '$1$',
    solution: '$(-7)+(+3)-(-5)=(-7)+3+5=1$.',
    source: '자체제작',
  },
  // ── 곱셈과 나눗셈 ──────────────────────────────
  {
    id: 'p021', twinGroup: 'tg-muldiv', typeId: 't-muldiv', kind: '객관식', diff: 3,
    body: '$(-2)^3\\times(-3)\\div6$의 값은?',
    choices: ['$-4$', '$-2$', '$2$', '$4$', '$6$'],
    answer: '④',
    solution: '$(-2)^3=-8$이므로 $(-8)\\times(-3)\\div6=24\\div6=4$.',
    source: '자체제작',
  },
  // ── 혼합 계산 ──────────────────────────────
  {
    id: 'p022', typeId: 't-mixed', kind: '주관식', diff: 4,
    body: '$3-\\left\\{(-2)^2\\times\\dfrac{1}{2}-5\\right\\}$를 계산하시오.',
    answer: '$6$',
    solution: '$(-2)^2=4$, $4\\times\\dfrac{1}{2}=2$, $2-5=-3$이므로 $3-(-3)=6$.',
    source: '자체제작',
  },
  {
    id: 'p023', typeId: 't-mixed', kind: '객관식', diff: 5,
    body: '$-1^2+(-1)^2-(-1)^3+1$의 값은?',
    choices: ['$-2$', '$-1$', '$0$', '$1$', '$2$'],
    answer: '⑤',
    solution: '$-1^2=-1$, $(-1)^2=1$, $(-1)^3=-1$이므로 $-1+1-(-1)+1=-1+1+1+1=2$.',
    source: '자체제작',
  },
  // ── 문자를 사용한 식 ──────────────────────────────
  {
    id: 'p024', typeId: 't-expr', kind: '객관식', diff: 1,
    body: '한 개에 $a$원인 사과 $3$개와 한 개에 $b$원인 배 $2$개를 샀을 때, 지불한 금액을 문자를 사용한 식으로 나타내면?',
    choices: ['$(a+b)$원', '$(3a+2b)$원', '$(2a+3b)$원', '$5ab$원', '$6ab$원'],
    answer: '②',
    solution: '사과 값은 $3a$원, 배 값은 $2b$원이므로 합계는 $(3a+2b)$원이다.',
    source: '자체제작',
  },
  // ── 식의 값 ──────────────────────────────
  {
    id: 'p025', typeId: 't-value', kind: '주관식', diff: 2,
    body: '$x=-2$일 때, $3x^2+x$의 값을 구하시오.',
    answer: '$10$',
    solution: '$3\\times(-2)^2+(-2)=3\\times4-2=12-2=10$.',
    source: '자체제작',
  },
  // ── 일차식의 계산 ──────────────────────────────
  {
    id: 'p026', twinGroup: 'tg-lincalc', typeId: 't-linear-calc', kind: '객관식', diff: 2,
    body: '$2(3x-1)-(x+3)$을 간단히 하면?',
    choices: ['$5x+1$', '$5x-5$', '$7x-5$', '$5x+5$', '$7x+1$'],
    answer: '②',
    solution: '$2(3x-1)-(x+3)=6x-2-x-3=5x-5$.',
    source: '자체제작',
  },
  {
    id: 'p027', typeId: 't-linear-calc', kind: '주관식', diff: 3,
    body: '$(6x-9)\\div3+2(x+1)$을 간단히 하시오.',
    answer: '$4x-1$',
    solution: '$(6x-9)\\div3=2x-3$, $2(x+1)=2x+2$이므로 $2x-3+2x+2=4x-1$.',
    source: '자체제작',
  },
  // ── 일차방정식의 풀이 ──────────────────────────────
  {
    id: 'p028', twinGroup: 'tg-eqsolve', typeId: 't-eq-solve', kind: '주관식', diff: 2,
    body: '일차방정식 $4x-7=2x+5$를 푸시오.',
    answer: '$x=6$',
    solution: '$4x-2x=5+7$에서 $2x=12$, 따라서 $x=6$.',
    source: '자체제작',
  },
  {
    id: 'p029', typeId: 't-eq-solve', kind: '객관식', diff: 3,
    body: '일차방정식 $0.3x-0.5=0.1x+0.9$의 해는?',
    choices: ['$x=3$', '$x=5$', '$x=7$', '$x=9$', '$x=11$'],
    answer: '③',
    solution: '양변에 $10$을 곱하면 $3x-5=x+9$, $2x=14$, $x=7$.',
    source: '자체제작',
  },
  {
    id: 'p030', typeId: 't-eq-solve', kind: '주관식', diff: 4,
    body: '일차방정식 $\\dfrac{x-1}{2}-\\dfrac{2x+1}{3}=1$을 푸시오.',
    answer: '$x=-11$',
    solution: '양변에 $6$을 곱하면 $3(x-1)-2(2x+1)=6$, $3x-3-4x-2=6$, $-x-5=6$, $-x=11$, 따라서 $x=-11$.',
    source: '자체제작',
  },
  // ── 일차방정식의 활용 ──────────────────────────────
  {
    id: 'p031', typeId: 't-eq-app', kind: '주관식', diff: 4,
    body: '연속하는 세 자연수의 합이 $51$일 때, 세 수 중 가장 큰 수를 구하시오.',
    answer: '$18$',
    solution: '세 수를 $x-1, x, x+1$로 놓으면 $3x=51$에서 $x=17$. 가장 큰 수는 $x+1=18$.',
    source: '자체제작',
  },
  {
    id: 'p032', typeId: 't-eq-app', kind: '주관식', diff: 5,
    body: '집에서 학교까지 갈 때는 시속 $4\\,\\mathrm{km}$, 같은 길로 돌아올 때는 시속 $6\\,\\mathrm{km}$로 걸었더니 총 $1$시간 $15$분이 걸렸다. 집에서 학교까지의 거리를 구하시오.',
    answer: '$3\\,\\mathrm{km}$',
    solution: '거리를 $x\\,\\mathrm{km}$라 하면 $\\dfrac{x}{4}+\\dfrac{x}{6}=\\dfrac{5}{4}$. 양변에 $12$를 곱하면 $3x+2x=15$, $5x=15$, $x=3$.',
    source: '자체제작',
  },
  // ── 순서쌍과 좌표 ──────────────────────────────
  {
    id: 'p033', typeId: 't-coord', kind: '주관식', diff: 1,
    body: '두 순서쌍 $(a,\\,3)$, $(2,\\,b)$가 서로 같을 때, $a+b$의 값을 구하시오.',
    answer: '$5$',
    solution: '두 순서쌍이 같으므로 $a=2$, $b=3$. 따라서 $a+b=5$.',
    source: '자체제작',
  },
  // ── 사분면 ──────────────────────────────
  {
    id: 'p034', typeId: 't-quadrant', kind: '객관식', diff: 2,
    body: '점 $(-3,\\,5)$는 제몇 사분면 위의 점인가?',
    choices: ['제1사분면', '제2사분면', '제3사분면', '제4사분면', '어느 사분면에도 속하지 않는다'],
    answer: '②',
    solution: '$x$좌표가 음수, $y$좌표가 양수이므로 제2사분면 위의 점이다.',
    source: '자체제작',
  },
  {
    id: 'p035', typeId: 't-quadrant', kind: '객관식', diff: 4, isNew: true,
    body: '점 $\\mathrm{P}(a,\\,b)$가 제4사분면 위의 점일 때, 점 $\\mathrm{Q}(-a,\\,ab)$는 제몇 사분면 위의 점인가?',
    choices: ['제1사분면', '제2사분면', '제3사분면', '제4사분면', '어느 사분면에도 속하지 않는다'],
    answer: '③',
    solution: '제4사분면이므로 $a>0$, $b<0$. 따라서 $-a<0$, $ab<0$이므로 점 Q는 ($-$, $-$)인 제3사분면 위의 점이다.',
    source: '자체제작',
  },
  // ── 상황을 식·그래프로 ──────────────────────────────
  {
    id: 'p036', typeId: 't-graph', kind: '주관식', diff: 3,
    body: '민수는 집에서 $800\\,\\mathrm{m}$ 떨어진 도서관까지 분속 $80\\,\\mathrm{m}$로 걸어간다. 출발한 지 $x$분 후 도서관까지 남은 거리를 $y\\,\\mathrm{m}$라 할 때, $y$를 $x$의 식으로 나타내시오. (단, $0\\le x\\le10$)',
    answer: '$y=800-80x$',
    solution: '$x$분 동안 걸은 거리는 $80x\\,\\mathrm{m}$이므로 남은 거리는 $y=800-80x$.',
    source: '자체제작',
  },
  // ── 정비례 ──────────────────────────────
  {
    id: 'p037', twinGroup: 'tg-direct', typeId: 't-direct', kind: '객관식', diff: 2,
    body: '$y$가 $x$에 정비례하고 $x=2$일 때 $y=6$이다. $x=5$일 때 $y$의 값은?',
    choices: ['$9$', '$12$', '$15$', '$18$', '$21$'],
    answer: '③',
    solution: '$y=ax$에 $(2,\\,6)$을 대입하면 $a=3$, 즉 $y=3x$. 따라서 $x=5$일 때 $y=15$.',
    source: '자체제작',
  },
  {
    id: 'p038', typeId: 't-direct', kind: '주관식', diff: 4,
    body: '정비례 관계 $y=ax$의 그래프가 점 $(3,\\,-9)$를 지난다. $x=-2$일 때의 $y$의 값과 $a$의 값의 합을 구하시오.',
    answer: '$3$',
    solution: '$-9=3a$에서 $a=-3$, 즉 $y=-3x$. $x=-2$일 때 $y=6$이므로 $a+y=-3+6=3$.',
    source: '자체제작',
  },
  // ── 반비례 ──────────────────────────────
  {
    id: 'p039', typeId: 't-inverse', kind: '주관식', diff: 3,
    body: '$y$가 $x$에 반비례하고 $x=3$일 때 $y=8$이다. $x=6$일 때 $y$의 값을 구하시오.',
    answer: '$4$',
    solution: '$y=\\dfrac{a}{x}$에 $(3,\\,8)$을 대입하면 $a=24$, 즉 $y=\\dfrac{24}{x}$. 따라서 $x=6$일 때 $y=4$.',
    source: '자체제작',
  },
  {
    id: 'p040', typeId: 't-inverse', kind: '객관식', diff: 5,
    body: '반비례 관계 $y=\\dfrac{a}{x}\\ (a\\ne0)$의 그래프가 점 $(4,\\,-3)$을 지날 때, 다음 중 이 그래프 위의 점은?',
    choices: ['$(2,\\,6)$', '$(-3,\\,-4)$', '$(1,\\,-12)$', '$(6,\\,2)$', '$(-2,\\,-6)$'],
    answer: '③',
    solution: '$-3=\\dfrac{a}{4}$에서 $a=-12$, 즉 $y=-\\dfrac{12}{x}$. $x=1$일 때 $y=-12$이므로 $(1,\\,-12)$가 그래프 위의 점이다. 나머지는 $xy=-12$를 만족하지 않는다.',
    source: '자체제작',
  },
  // ── 쌍둥이 문제 (같은 템플릿, 숫자 변형 — 전 항목 검산 완료) ──
  {
    id: 'p041', twinGroup: 'tg-power', typeId: 't-power', kind: '주관식', diff: 2,
    body: '$3^a=81$일 때, 자연수 $a$의 값을 구하시오.',
    answer: '$a=4$',
    solution: '$81=3\\times3\\times3\\times3=3^4$이므로 $a=4$이다.',
    source: '자체제작',
  },
  {
    id: 'p042', twinGroup: 'tg-divcount', typeId: 't-divcount', kind: '객관식', diff: 3,
    body: '$48$의 약수의 개수는?',
    choices: ['$8$개', '$9$개', '$10$개', '$12$개', '$15$개'],
    answer: '③',
    solution: '$48=2^4\\times3$이므로 약수의 개수는 $(4+1)\\times(1+1)=10$개이다.',
    source: '자체제작',
  },
  {
    id: 'p043', twinGroup: 'tg-gcd', typeId: 't-gcd', kind: '주관식', diff: 2,
    body: '두 수 $48$, $72$의 최대공약수를 구하시오.',
    answer: '$24$',
    solution: '$48=2^4\\times3$, $72=2^3\\times3^2$. 공통인 소인수의 지수가 작은 쪽을 택하면 $2^3\\times3=24$.',
    source: '자체제작',
  },
  {
    id: 'p044', twinGroup: 'tg-abs-calc', typeId: 't-abs', kind: '객관식', diff: 3,
    body: '$|-7|+|2|-|-4|$의 값은?',
    choices: ['$1$', '$3$', '$5$', '$9$', '$13$'],
    answer: '③',
    solution: '$|-7|=7$, $|2|=2$, $|-4|=4$이므로 $7+2-4=5$.',
    source: '자체제작',
  },
  {
    id: 'p045', twinGroup: 'tg-muldiv', typeId: 't-muldiv', kind: '객관식', diff: 3,
    body: '$(-3)^2\\times(-2)\\div6$의 값은?',
    choices: ['$-6$', '$-3$', '$-2$', '$3$', '$6$'],
    answer: '②',
    solution: '$(-3)^2=9$이므로 $9\\times(-2)\\div6=-18\\div6=-3$.',
    source: '자체제작',
  },
  {
    id: 'p046', twinGroup: 'tg-lincalc', typeId: 't-linear-calc', kind: '객관식', diff: 2,
    body: '$3(2x-1)-(2x+5)$를 간단히 하면?',
    choices: ['$4x-8$', '$4x+2$', '$6x-8$', '$4x-6$', '$8x-8$'],
    answer: '①',
    solution: '$3(2x-1)-(2x+5)=6x-3-2x-5=4x-8$.',
    source: '자체제작',
  },
  {
    id: 'p047', twinGroup: 'tg-eqsolve', typeId: 't-eq-solve', kind: '주관식', diff: 2,
    body: '일차방정식 $5x-9=2x+6$을 푸시오.',
    answer: '$x=5$',
    solution: '$5x-2x=6+9$에서 $3x=15$, 따라서 $x=5$.',
    source: '자체제작',
  },
  {
    id: 'p048', twinGroup: 'tg-direct', typeId: 't-direct', kind: '객관식', diff: 2,
    body: '$y$가 $x$에 정비례하고 $x=3$일 때 $y=12$이다. $x=6$일 때 $y$의 값은?',
    choices: ['$16$', '$18$', '$20$', '$24$', '$30$'],
    answer: '④',
    solution: '$y=ax$에 $(3,\\,12)$를 대입하면 $a=4$, 즉 $y=4x$. 따라서 $x=6$일 때 $y=24$.',
    source: '자체제작',
  },
]
