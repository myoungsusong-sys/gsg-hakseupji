# 고3 영어(eng-h3) 빈 유형 채우기 — 25유형 × 6문항 (2026-09-28 밤 · jobP)
# 지문은 전부 직접 창작(연구 소개는 널리 확립된 내용만, 자기 말로). 발문·풀이는 한국어.
import sys, os, re; sys.path.insert(0, '/private/tmp/claude-501/-Users-songmyeongsumaegbug-eeo-Library-Mobile-Documents-com-apple-CloudDocs-08------AI/19f5d8ef-bdd5-411c-80d8-fdf503e62ef1/scratchpad/korgen')
import lib; lib.COURSE = 'eng-h3'
from lib import q, qf, s, save

F = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ']
AE = ['(A)', '(B)', '(C)', '(D)', '(E)']
WC = []   # (유형, 난이도 순번, 단어 수) — 지문 길이 점검용
T = ''


def J(t):
    """여러 줄로 쓴 산문 지문을 한 문단으로 잇는다."""
    return ' '.join(t.split())


def wc(t):
    return len(re.findall(r"[A-Za-z][A-Za-z'’\-]*", t))


def P(발문, 지문, 뒤='', cnt=True):
    if cnt:
        WC.append((T, wc(지문)))
    return f'{발문}\n\n{지문}' + (f'\n\n{뒤}' if 뒤 else '')


# ══════════════════════════════════════════════════════════════
# u0m0s0t1 독해/대의 파악/주제 파악/주제문 찾기
# ══════════════════════════════════════════════════════════════
T = 'u0m0s0t1'
발 = '다음 글의 ⓐ~ⓔ 중, 글 전체의 중심 내용을 담은 주제문으로 가장 적절한 것은?'

qf(T, 1, P(발, J("""
ⓐ Reading slowly and carefully is one of the most valuable skills a student can develop in an age of endless information.
ⓑ Online, we are trained to skim: our eyes jump from headline to headline, and we rarely stay with one text for more than a few minutes.
ⓒ This habit may help us gather facts quickly, but it leaves little room for the kind of thinking that turns information into understanding.
ⓓ When we read slowly, we have time to question the author's claims, connect new ideas to what we already know, and notice what has been left unsaid.
ⓔ Deep reading also strengthens our ability to concentrate, an ability that is increasingly rare and therefore increasingly precious.
Of course, skimming has its place; no one needs to study a bus schedule line by line.
But when a text deserves our attention, giving it that attention is not a waste of time.
It is the very process through which knowledge becomes our own.
""")), F, 0,
   ['ⓐ 「끝없는 정보의 시대에 천천히 주의 깊게 읽는 것은 학생이 기를 수 있는 가장 가치 있는 기술 중 하나이다.」 — 글 전체의 중심 내용을 첫 문장에서 먼저 제시한다.',
    'ⓑ·ⓒ는 훑어 읽기 습관의 한계(정보를 이해로 바꾸는 사고의 여지가 없음), ⓓ·ⓔ는 천천히 읽을 때의 이점(주장 검토·지식 연결, 집중력 강화)으로 ⓐ를 뒷받침한다. 마지막 문장 「그것이 바로 지식이 우리 자신의 것이 되는 과정이다」도 ⓐ를 다시 확인한다.',
    '대표 오답 ⓔ는 깊이 읽기의 여러 이점 가운데 «집중력» 하나만 말한 세부 근거이므로 주제문이 될 수 없다.'])

qf(T, 2, P(발, J("""
In school, a wrong answer is usually marked with a red X and quickly forgotten.
ⓐ In a laboratory, however, a failed experiment is rarely thrown away so easily.
ⓑ When a result does not match the prediction, a careful scientist asks why, because the gap between what was expected and what actually happened often points to something no one has noticed before.
ⓒ Many important discoveries began in exactly this way, as an annoying result that refused to go away.
ⓓ Even when a failure reveals nothing new, it tells researchers which paths are not worth following, saving others from repeating the same mistake.
ⓔ In science, then, failure is not the opposite of progress but one of its most important sources of information.
Students might benefit from adopting a similar attitude.
Instead of hiding their mistakes, they could study them, asking what each error reveals about their understanding.
A wrong answer examined honestly can teach more than a right answer reached by luck.
""")), F, 4,
   ['ⓔ 「그렇다면 과학에서 실패는 진보의 반대가 아니라 진보의 가장 중요한 정보원 중 하나이다.」 — then(그렇다면)으로 앞의 내용을 일반화해 글의 중심 내용을 정리한다.',
    'ⓐ 실험실에서는 실패를 쉽게 버리지 않음 → ⓑ 예측과 결과의 차이가 새로운 것을 가리킴 → ⓒ 중요한 발견이 그렇게 시작됨 → ⓓ 아무것도 드러나지 않아도 가지 말아야 할 길을 알려 줌 — 모두 ⓔ의 근거이다. 마지막 세 문장은 이를 학생의 태도에 적용한 것이다.',
    '대표 오답 ⓑ는 실패가 정보가 되는 한 가지 방식(예측과 결과의 차이)을 설명한 세부 내용이다.'])

qf(T, 3, P(발, J("""
ⓐ We often picture creativity as a sudden flash of inspiration that arrives from nowhere, granted only to a few gifted individuals.
ⓑ In reality, however, most creative work consists of combining existing ideas in new ways rather than producing something entirely from scratch.
ⓒ The printing press, for example, brought together technologies that already existed, such as movable type, ink, and the screw press used for making wine.
ⓓ Similarly, many musicians develop their own style by blending the traditions they grew up listening to.
ⓔ Even scientific theories are usually built on the careful work of earlier researchers, as Isaac Newton suggested when he wrote that he had seen further by standing on the shoulders of giants.
Understanding creativity in this way has a practical benefit.
If new ideas come from connecting old ones, then the best way to become more creative is not to wait for inspiration but to fill our minds with a wide range of knowledge and experiences, giving ourselves more pieces to combine.
""")), F, 1,
   ['ⓑ 「그러나 실제로 대부분의 창의적인 작업은 완전히 무에서 무언가를 만들어 내기보다 기존의 생각들을 새로운 방식으로 결합하는 것이다.」 — however로 통념(ⓐ)을 뒤집으며 글의 중심 내용을 밝힌다.',
    'ⓒ 인쇄기(가동 활자·잉크·포도주 압착기의 결합), ⓓ 여러 전통을 섞는 음악가, ⓔ 앞선 연구 위에 세워지는 과학 이론(뉴턴의 「거인의 어깨」)은 모두 ⓑ의 예시이다.',
    '대표 오답 ⓐ는 필자가 반박하려는 «통념»(창의성은 소수에게만 주어지는 갑작스러운 영감)이므로 주제문이 아니다. 통념-반박 구조에서는 however 뒤가 주제문이다.'])

qf(T, 3, P(발, J("""
Imagine a map of a city drawn at a scale of one to one, showing every tree, crack, and lamppost exactly as it is.
ⓐ Such a map would be perfectly accurate, yet completely useless, since it would be as large as the city itself.
ⓑ A subway map, by contrast, ignores real distances, straightens curved lines, and leaves out nearly every street, and yet millions of people rely on it every day.
ⓒ The lesson is that a model becomes useful not by including everything but by deliberately leaving out what does not matter for its purpose.
ⓓ Economists who describe markets, climate scientists who simulate the atmosphere, and even teachers who explain complex ideas to children all make similar choices about what to ignore.
ⓔ The danger comes only when we forget that these simplifications were chosen, and begin to treat the model as if it were the world itself.
Still, this risk does not reduce the value of simplification.
A map is helpful precisely because it is not the territory.
""")), F, 2,
   ['ⓒ 「교훈은, 모형은 모든 것을 담아서가 아니라 목적에 중요하지 않은 것을 의도적으로 빼서 유용해진다는 것이다.」 — The lesson is ~ 로 앞의 두 사례에서 일반 원리를 끌어낸다.',
    'ⓐ 1:1 축척 지도(정확하지만 쓸모없음)와 ⓑ 지하철 노선도(거리·곡선·거리 이름을 무시하지만 매일 이용됨)의 대조가 ⓒ를 이끌고, ⓓ는 같은 원리를 경제학·기후 과학·교육으로 넓힌다.',
    '대표 오답 ⓔ는 단순화를 «잊을 때»의 위험이라는 단서일 뿐이다. 바로 뒤에서 「이 위험이 단순화의 가치를 줄이지는 않는다」「지도는 실제 땅이 아니기 때문에 유용하다」고 ⓒ를 다시 확인한다.'])

qf(T, 4, P(발, J("""
ⓐ Many people speak of traditions as if they were fixed objects handed down unchanged from the distant past.
ⓑ A holiday meal, a wedding ceremony, or a folk song seems valuable precisely because it appears to connect us with our ancestors.
ⓒ Yet if we look closely, we find that each generation quietly adjusts these customs, replacing ingredients that are no longer available, shortening rituals that no longer fit modern schedules, and adding new verses that speak to current concerns.
ⓓ Far from being frozen in time, a living tradition survives precisely because people keep reshaping it to fit their changing lives.
ⓔ Customs that refuse to change often become museum pieces, admired from a distance but no longer practiced.
This does not mean that anything goes; a tradition that changes too quickly may lose the sense of continuity that gives it meaning.
The challenge for each generation is to keep what is essential while letting go of what has become empty habit, so that the tradition remains both recognizable and alive.
""")), F, 3,
   ['ⓓ 「시간 속에 얼어붙어 있기는커녕, 살아 있는 전통은 사람들이 변화하는 삶에 맞게 그것을 계속 다시 빚어내기 때문에 살아남는다.」 — 글의 핵심 주장이다.',
    'ⓐ·ⓑ는 «전통은 고정된 것»이라는 통념, ⓒ는 세대마다 관습을 조금씩 바꾼다는 관찰(재료 교체·의식 단축·새 가사 추가), ⓔ는 바뀌기를 거부한 관습이 박물관 전시품이 된다는 반대 사례로 ⓓ를 뒷받침한다.',
    '대표 오답 ⓒ는 ⓓ의 근거가 되는 관찰(구체적 사례 나열)이고, ⓐ는 반박 대상인 통념이다. 마지막 두 문장도 «본질은 지키되 변화를 허용하라»는 ⓓ의 연장이다.'])

qf(T, 5, P('다음 글의 ⓐ~ⓔ 중, 글쓴이가 사례들로부터 이끌어 낸 «일반 원리»를 담아 글의 요지를 가장 잘 드러낸 문장은?', J("""
When a hospital is judged mainly by how quickly it treats patients in its emergency room, something curious can happen.
ⓐ Staff may begin to move patients out of the emergency room into hallways or waiting areas, not because the patients are better, but because the clock stops once they leave.
ⓑ Similarly, a school rated only by test scores may devote more and more class time to test practice, while subjects that are not tested quietly disappear from the schedule.
ⓒ In both cases, the numbers improve while the thing they were meant to reflect does not.
ⓓ This is because a measurement that works well as an indicator tends to lose its value once people are rewarded for pushing it up directly.
ⓔ Numbers are not the problem in themselves; without them, it would be almost impossible to compare performance or to notice when something is going wrong.
The solution, then, is not to abandon measurement but to use several indicators at once, to change them from time to time, and to keep asking whether improvements on paper match improvements in reality.
""")), F, 3,
   ['ⓓ 「이는 지표로서 잘 작동하는 측정치가, 사람들이 그 수치를 직접 끌어올리는 데 보상을 받게 되는 순간 가치를 잃는 경향이 있기 때문이다.」 — 병원·학교 사례를 일반 원리로 끌어올린 문장이다.',
    'ⓐ(응급실 시간 줄이기 위해 환자를 복도로 옮김)와 ⓑ(시험 점수만으로 평가받는 학교가 시험 연습에 치중함)는 사례, ⓒ는 두 사례의 공통 현상(수치는 좋아지지만 실제는 그대로), ⓓ는 그 원인이 되는 일반 원리이다.',
    '매력적 오답 ⓒ는 «In both cases»라는 말처럼 두 사례에 한정된 요약이고 왜 그런지를 말하지 않는다. ⓔ는 «수치 자체가 문제는 아니다»라는 양보로, 마지막 문장의 해결책(여러 지표 사용)으로 가는 연결 고리일 뿐 요지가 아니다.'])


# ══════════════════════════════════════════════════════════════
# u0m0s2t1 독해/대의 파악/요지 파악/필자의 주장
# ══════════════════════════════════════════════════════════════
T = 'u0m0s2t1'
발 = '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?'

q(T, 1, P(발, J("""
In many classrooms, an assignment is graded once and then returned, and the story ends there.
Students glance at the score, perhaps feel pleased or disappointed, and move on to the next task without reading the comments.
I believe this system wastes one of the best opportunities for learning.
Teachers should give students the chance to revise their work after receiving feedback and to submit it again.
When students know that they can improve their grade by acting on comments, they read those comments carefully and think about what went wrong.
The second draft becomes a real conversation between teacher and student rather than a final judgment.
Some worry that allowing revisions will make grades less meaningful or give students an excuse to be careless the first time.
But the purpose of school is not simply to measure what students can do on their first try; it is to help them become better.
A grade that reflects what a student has finally learned is, in fact, more meaningful than one that records only an early mistake.
""")),
  '교사는 학생들이 피드백을 받은 뒤 과제를 고쳐 다시 제출할 수 있게 해야 한다.',
  ['과제 점수는 첫 제출물만으로 공정하게 매겨야 한다.',
   '교사는 과제에 점수 대신 서술형 논평만 달아야 한다.',
   '학생들은 과제를 내기 전에 친구와 서로 검토해야 한다.',
   '과제의 양을 줄여 학생들이 한 과제에 집중하게 해야 한다.'],
  ['주장은 「Teachers should give students the chance to revise their work after receiving feedback and to submit it again.(교사는 학생들에게 피드백을 받은 뒤 과제를 고쳐 다시 제출할 기회를 주어야 한다.)」에 직접 드러난다.',
   '근거: 고쳐 낼 수 있으면 학생들이 논평을 꼼꼼히 읽고, 두 번째 원고가 «최종 판정»이 아닌 «대화»가 된다. 반론(성적의 의미가 줄어든다)에는 「학교의 목적은 첫 시도를 재는 것이 아니라 더 나아지게 돕는 것」이라고 답한다.',
   '「첫 제출물만으로 채점」은 필자가 비판하는 현재 방식이고, 서술형 논평만 달기·동료 검토·과제 줄이기는 글에 없는 내용이다.'])

q(T, 2, P(발, J("""
For most of the last century, city streets were designed with a single goal in mind: moving cars as quickly as possible.
Roads were widened, sidewalks were narrowed, and crossings were placed far apart so that traffic would not be slowed.
The result, in many cities, is a landscape that feels hostile to anyone who is not sitting behind a wheel.
Children cannot walk safely to school, elderly residents hesitate to cross the street, and small shops struggle because few people pass by on foot.
It is time for cities to change their priorities.
When planning or rebuilding streets, city governments should put pedestrians, not vehicles, at the center of their decisions.
Wider sidewalks, more frequent crossings, trees that provide shade, and benches where people can rest may slow traffic slightly, but they bring life back to neighborhoods.
Streets are not merely channels for cars to pass through; they are among the most important public spaces a city has, and they should be designed for the people who live beside them.
""")),
  '도시의 거리는 자동차보다 보행자를 중심에 두고 설계해야 한다.',
  ['교통 체증을 줄이기 위해 도로를 넓혀야 한다.',
   '도심에서는 자동차 통행을 전면 금지해야 한다.',
   '대중교통 요금을 낮춰 자가용 이용을 줄여야 한다.',
   '노인과 어린이를 위한 전용 도로를 따로 만들어야 한다.'],
  ['주장: 「city governments should put pedestrians, not vehicles, at the center of their decisions(시 정부는 차량이 아니라 보행자를 결정의 중심에 두어야 한다)」.',
   '마지막 문장 「거리는 단지 차가 지나가는 통로가 아니라 도시의 가장 중요한 공공 공간이며, 그 옆에 사는 사람들을 위해 설계되어야 한다」가 이를 다시 강조한다.',
   '매력적 오답 「자동차 통행 전면 금지」: 필자는 보행자 중심 설계가 교통을 «약간 느리게 할 수 있다(may slow traffic slightly)»고 했을 뿐, 차를 금지하자고 하지 않았다. 도로 확장은 필자가 비판하는 과거 방식이다.'])

q(T, 3, P(발, J("""
"Great job!" It is perhaps the most common phrase heard in classrooms, offices, and homes.
We say it to encourage people, and it certainly feels pleasant to hear.
Yet such general praise tells the listener very little.
Was it the idea that was good, the effort, the organization, or simply the fact that the task was finished?
Without knowing, the person cannot repeat what worked or build on it.
Worse, praise that is given for everything eventually loses its value, much like money printed without limit.
If we truly want to help others grow, we should replace vague compliments with specific descriptions of what they did well and why it mattered.
Saying, "Your opening example made the problem easy to understand," takes only a few more seconds than "Great job," but it gives the listener something to hold on to.
Specific praise also shows that we paid attention, and being noticed in this way is often more motivating than any amount of general approval.
""")),
  '칭찬할 때는 막연한 말 대신 무엇을 왜 잘했는지 구체적으로 말해 주어야 한다.',
  ['칭찬은 동기를 떨어뜨리므로 되도록 삼가야 한다.',
   '결과보다 노력을 중심으로 칭찬해야 한다.',
   '칭찬과 비판을 균형 있게 섞어 전달해야 한다.',
   '칭찬은 다른 사람들 앞에서 공개적으로 해야 한다.'],
  ['주장: 「we should replace vague compliments with specific descriptions of what they did well and why it mattered(막연한 칭찬을, 상대가 무엇을 잘했고 그것이 왜 중요했는지에 대한 구체적인 묘사로 바꾸어야 한다)」.',
   '근거: 막연한 칭찬은 무엇이 좋았는지 알려 주지 않아 되풀이하거나 발전시킬 수 없고, 무엇에나 주는 칭찬은 한없이 찍어 낸 돈처럼 가치를 잃는다.',
   '필자는 칭찬 자체를 삼가라는 것이 아니라 «구체적으로» 하라는 것이다. 노력 칭찬·비판과의 균형·공개 칭찬은 글에서 다루지 않았다.'])

q(T, 3, P(발, J("""
When scientists speak to the public, they often feel pressure to sound certain.
Journalists want clear headlines, politicians want firm answers, and audiences seem to trust confident voices more than hesitant ones.
As a result, researchers are sometimes tempted to hide the doubts that are a normal part of their work.
This is a mistake.
Science does not advance by producing final truths; it advances by reducing uncertainty step by step, and honest scientists know that today's best answer may be revised tomorrow.
When experts present uncertain findings as settled facts and those findings later change, the public feels deceived, and trust in science as a whole is damaged.
By contrast, when scientists explain what they know, what they do not yet know, and how confident they are, people are better prepared to accept new evidence when it arrives.
Communicating uncertainty openly may seem to weaken the authority of science in the short term, but in the long term it is the surest way to protect it.
""")),
  '과학자는 대중에게 연구 결과의 불확실성을 솔직하게 알려야 한다.',
  ['과학자는 확실한 결론이 나올 때까지 연구 결과를 공개하지 말아야 한다.',
   '언론은 과학 기사의 제목을 신중하게 붙여야 한다.',
   '정치인은 과학적 판단을 전문가에게 맡겨야 한다.',
   '대중은 자신감 있게 말하는 전문가를 더 신뢰해야 한다.'],
  ['필자는 과학자들이 의심을 숨기는 것을 「This is a mistake.(이것은 잘못이다.)」라고 비판하고, 아는 것·아직 모르는 것·확신의 정도를 설명하라고 말한다.',
   '마지막 문장 「불확실성을 공개적으로 전하는 것은 단기적으로는 과학의 권위를 약하게 하는 것처럼 보이지만, 장기적으로는 그것을 지키는 가장 확실한 방법이다」가 주장을 정리한다.',
   '매력적 오답 「확실해질 때까지 공개하지 말라」: 필자는 불확실한 상태 그대로 «솔직히 알리라»고 했지 공개를 미루라고 하지 않았다. 언론·정치인의 태도는 배경 설명일 뿐이다.'])

q(T, 4, P('다음 글의 필자가 가장 동의할 만한 진술은?', J("""
Suppose a friend drives home after drinking at a party and arrives without incident.
Was it a good decision? Most of us would immediately say no, even though nothing bad happened.
Yet in many other situations, we judge decisions exactly this way: by their results alone.
A manager who launches a risky product that happens to succeed is praised as bold, while one who makes a careful, well-researched choice that fails because of bad luck is blamed.
This habit is understandable, since outcomes are easy to see and the reasoning behind a decision is not.
But it teaches the wrong lessons.
When we reward lucky gambles and punish sound decisions that turned out badly, we encourage people to take careless risks and discourage them from thinking carefully.
A fairer approach is to ask what the decision-maker knew at the time, what options were available, and whether the reasoning was sound.
Good decisions sometimes lead to bad outcomes, and bad decisions sometimes lead to good ones; confusing the two makes us worse at deciding.
""")),
  '결정의 좋고 나쁨은 결과보다 당시의 정보와 판단 과정을 기준으로 평가해야 한다.',
  ['좋은 결과를 낸 결정은 그 과정과 관계없이 칭찬받아야 한다.',
   '위험을 무릅쓰는 과감한 결정이 결국 더 큰 성공을 가져온다.',
   '실패한 결정을 내린 사람에게는 반드시 책임을 물어야 한다.',
   '결정의 결과에 운이 미치는 영향은 무시해도 될 만큼 작다.'],
  ['필자는 결과만으로 결정을 판단하는 습관이 「잘못된 교훈을 가르친다(it teaches the wrong lessons)」고 보고, 「결정한 사람이 그때 무엇을 알았는지, 어떤 선택지가 있었는지, 추론이 타당했는지」를 물으라고 한다.',
   '음주 운전의 예: 사고 없이 도착했어도 나쁜 결정이다 → 결과가 좋다고 결정이 좋은 것은 아니다.',
   '「좋은 결과면 칭찬」「실패하면 반드시 책임」은 필자가 비판하는 결과 중심 평가이고, 필자는 오히려 운(bad luck, happens to succeed)이 결과를 크게 좌우한다고 본다.'])

q(T, 5, P('다음 글의 필자의 주장과 일치하는 것만을 <보기>에서 있는 대로 고른 것은?', J("""
In many organizations, meetings end with what looks like complete agreement.
Everyone nods, no one objects, and the leader leaves satisfied that the plan is sound.
But silence is not the same as agreement.
People often keep their doubts to themselves because they fear appearing negative, damaging their relationship with the boss, or being the only one who does not understand.
When this happens, the group loses exactly the information it most needs: the warnings of those who see a problem others have missed.
Leaders, therefore, should not merely tolerate disagreement; they should actively invite it.
They can ask someone to argue against the plan on purpose, collect anonymous comments before a decision is made, or simply speak last so that their own opinion does not shape the discussion.
None of this means that every objection must be accepted.
The goal is not endless debate but better decisions, made with full knowledge of what could go wrong.
A leader who hears no disagreement should not feel reassured; he or she should start to worry.
"""), '<보기>\nㄱ. 회의에서 아무도 반대하지 않는 것을 곧 모두가 동의한다는 뜻으로 받아들여서는 안 된다.\nㄴ. 지도자는 반대 의견이 나오도록 적극적으로 이끌어 내야 한다.\nㄷ. 회의에서 나온 반대 의견은 최종 결정에 모두 반영되어야 한다.\nㄹ. 지도자는 토론 초반에 자기 의견을 먼저 밝혀 논의의 방향을 잡아 주어야 한다.'),
  'ㄱ, ㄴ',
  ['ㄱ, ㄷ', 'ㄴ, ㄹ', 'ㄱ, ㄴ, ㄷ', 'ㄴ, ㄷ, ㄹ'],
  ['ㄱ: 「silence is not the same as agreement(침묵은 동의와 같지 않다)」 — 일치.',
   'ㄴ: 「Leaders ~ should not merely tolerate disagreement; they should actively invite it.(지도자는 반대를 참아 주는 데 그치지 말고 적극적으로 요청해야 한다.)」 — 일치.',
   'ㄷ: 「None of this means that every objection must be accepted.(이 모든 것이 모든 반대를 받아들여야 한다는 뜻은 아니다.)」 — 불일치.',
   'ㄹ: 지도자는 자기 의견이 논의를 좌우하지 않도록 «마지막에 말하라(speak last)»고 했다 — 불일치.'])


# ══════════════════════════════════════════════════════════════
# u0m0s3t1 독해/대의 파악/목적 파악/글의 종류·출처
# ══════════════════════════════════════════════════════════════
T = 'u0m0s3t1'

q(T, 1, P('다음 글의 종류로 가장 적절한 것은?',
          'Waggle dance\n\n' + J("""
The waggle dance is a pattern of movement performed by honeybees to share the location of food sources with other members of the colony.
A forager returning to the hive runs in a straight line across the surface of the honeycomb while shaking its body from side to side, then circles back to its starting point and repeats the run.
The angle of the straight run in relation to the vertical direction of the comb indicates the direction of the food source in relation to the sun.
The duration of the run indicates distance: the longer the waggle, the farther away the food.
Other bees that follow the dancer closely can then fly out and find the food source on their own.
The meaning of the dance was first described in detail by the Austrian scientist Karl von Frisch, who shared the Nobel Prize in Physiology or Medicine in 1973 for his studies of animal behavior.
""") + '\n\nSee also: Honeybee · Animal communication · Pollination'),
  '백과사전의 항목',
  ['과학 소설의 한 장면', '신문의 상품 광고', '개인의 관찰 일기', '다큐멘터리 영화 감상문'],
  ['표제어(Waggle dance)를 먼저 내세우고, 그 뜻(꿀벌이 먹이 위치를 알리는 움직임)·작동 방식(직진 방향 = 태양 기준 방향, 흔드는 시간 = 거리)·연구사(카를 폰 프리슈, 1973년 노벨 생리의학상)를 객관적으로 정리한다.',
   '맨 끝의 「See also:(참고 항목)」는 백과사전 항목의 전형적인 형식이다.',
   '1인칭 감정 표현이나 판매 권유, 허구의 사건 전개가 없으므로 일기·광고·소설·감상문이 아니다.'])

q(T, 2, P('다음 글의 종류로 가장 적절한 것은?',
          'Dear Dr. Morrison,\n\n' + J("""
I am writing to apply for the summer research assistant position in your marine biology laboratory, which I learned about through my school's science department.
I am currently a senior at Westbrook High School, where I have taken advanced courses in biology and chemistry and maintained a strong academic record.
Last year, I carried out an independent project on the effects of water temperature on the growth of algae, which taught me how to design experiments, record data carefully, and draw conclusions from imperfect results.
I also volunteer every weekend at the city aquarium, where I help care for the animals and explain exhibits to visitors.
I believe these experiences have prepared me to contribute to your team, and I am eager to learn from researchers working at the forefront of the field.
I have attached my résumé and a letter of recommendation from my biology teacher.
Thank you for considering my application. I look forward to hearing from you.
""") + '\n\nSincerely,\nJenna Park'),
  '일자리에 지원하는 편지',
  ['교사가 학생을 위해 쓴 추천서', '실험실 견학을 마친 뒤의 감사 편지', '수족관 운영에 대한 항의 편지', '과학 행사에 초대하는 편지'],
  ['첫 문장 「I am writing to apply for the summer research assistant position ~(여름 연구 보조원 자리에 지원하려고 이 글을 씁니다)」에서 글의 종류가 드러난다.',
   '자신의 학업(고급 생물·화학 수업), 경험(조류 성장 연구, 수족관 봉사)을 내세우고, 이력서와 추천서를 첨부했다며 「지원서를 검토해 주셔서 감사합니다」로 끝맺는 전형적인 지원 편지(cover letter)이다.',
   '매력적 오답 「추천서」: 추천서는 «첨부했다»고 언급될 뿐이고, 이 글은 지원자 본인(Jenna Park)이 1인칭으로 쓴 편지이다.'])

q(T, 3, P('다음 글의 종류로 가장 적절한 것은?', J("""
Last week, the city council voted to cut the budget for public libraries by twenty percent, arguing that fewer residents borrow printed books than a decade ago.
This newspaper has long supported careful public spending, but we believe this decision is shortsighted.
Libraries today are far more than storage spaces for books.
They offer free Internet access to families who cannot afford it, quiet study spaces for students, and job-search help for the unemployed.
Cutting their funding will fall hardest on the residents who have the fewest alternatives.
The council's own figures show that library visits, unlike book loans, have actually increased over the past five years.
Rather than reducing support for an institution that serves so many, the council should look for savings elsewhere.
We urge council members to reconsider their vote before the budget is finalized next month, and we encourage readers to make their views known at the public hearing on March 14.
A city is judged not only by its roads and buildings but also by the opportunities it offers to all of its residents.
""")),
  '신문의 사설',
  ['신문의 사건 보도 기사', '도서관의 이용 안내문', '시 의회의 회의록', '개인의 블로그 일기'],
  ['「This newspaper has long supported ~, but we believe this decision is shortsighted.(본지는 오랫동안 신중한 공공 지출을 지지해 왔지만, 이 결정은 근시안적이라고 본다.)」 — 신문사가 «we»로 공식 의견을 밝힌다.',
   '시 의회의 도서관 예산 삭감을 비판하는 근거(무료 인터넷·학습 공간·구직 지원, 방문자 증가)를 들고, 「We urge council members to reconsider(의원들에게 재고를 촉구한다)」로 주장을 마무리하므로 사설이다.',
   '보도 기사는 기자가 사실만 객관적으로 전하며 «촉구»하지 않는다. 의회 결정은 글의 출발점일 뿐, 이 글은 회의록이 아니다.'])

q(T, 3, P('다음 글이 실리기에 가장 적절한 곳은?', J("""
This study examined whether short periods of outdoor activity during the school day affect students' ability to concentrate in class.
A total of 240 students aged 15 to 17 from four high schools participated over one semester.
Students in two of the schools took part in a fifteen-minute outdoor walk before their afternoon classes, while students in the other two schools followed their usual schedule.
Attention was measured using a standard computer-based task given at the beginning and end of the semester.
At the start of the study, the two groups showed similar attention scores.
Information on participants' sleep and physical activity outside school was also collected so that these factors could be taken into account.
Results indicated that students who took part in the outdoor walks showed significantly greater improvement in attention scores than those in the comparison group.
No significant differences were found in overall grades.
These findings suggest that brief outdoor breaks may support students' concentration, although further research is needed to determine whether the effect lasts over longer periods and applies to younger students.
""")),
  '학술지에 실린 연구 논문의 초록',
  ['학교 신문의 체육 대회 기사', '학부모에게 보내는 가정 통신문', '건강 잡지의 운동화 광고', '학생의 여름 방학 체험 일기'],
  ['「This study examined whether ~(이 연구는 ~인지를 조사했다)」로 연구 목적을 밝히고, 참가자(15~17세 240명)·방법(두 학교는 15분 야외 걷기, 두 학교는 평소대로)·측정(표준화된 컴퓨터 과제)·결과(주의력 점수 향상, 성적 차이는 없음)·결론과 한계(추가 연구 필요)를 차례로 요약한다.',
   '연구 전체를 한 문단으로 압축한 이 구성은 학술 논문 첫머리의 초록(abstract)의 전형이다.',
   '학생을 대상으로 한 내용이라 가정 통신문이나 학교 신문 기사로 착각하기 쉽지만, 알림·보도가 아니라 연구 설계와 통계적 결과(significantly)를 보고하는 글이다.'])

q(T, 4, P('다음 글이 실린 곳으로 가장 적절한 것은?', J("""
When I began teaching astronomy thirty years ago, I noticed that my students were full of questions that textbooks never seemed to answer.
Why do stars twinkle while planets usually do not?
How can we know what a star is made of if no one has ever visited one?
This book grew out of those questions.
It is not a complete guide to the universe, and it does not try to be.
Instead, each of its twelve chapters begins with a question that students have actually asked me and follows the reasoning that scientists used to find an answer.
The early chapters require no background in science, while the later ones assume that readers have become comfortable with a few basic ideas introduced along the way.
I would like to thank the many students whose curiosity shaped these pages, and my editor, who patiently read every draft.
If this book leaves you with more questions than it answers, I will consider it a success.
""")),
  '책의 서문',
  ['책의 마지막 장(결론)', '천문학 잡지의 광고', '신문의 신간 서평', '학회 발표문의 초록'],
  ['「This book grew out of those questions.(이 책은 그 질문들에서 자라났다.)」 — 저자가 책을 쓰게 된 동기를 밝힌다.',
   '책의 구성(12개 장, 각 장은 학생의 실제 질문으로 시작)과 읽는 방법(앞 장은 배경지식 불필요, 뒤 장은 앞에서 익힌 개념을 전제)을 안내하고, 학생들과 편집자에게 감사를 전한다 — 모두 서문(preface)의 특징이다.',
   '매력적 오답 「신간 서평」: 서평은 다른 사람이 책을 평가하는 글이다. 이 글은 저자 본인이 1인칭(I)으로 «this book»을 소개하고 감사 인사를 한다.'])

q(T, 5, P('다음 글의 종류와 글쓴이의 의도를 바르게 짝지은 것은?',
          'To the Editor:\n\n' + J("""
In his column on October 3, "Homework Is a Waste of Time," Richard Hale argues that schools should abolish homework entirely because students already spend too many hours studying.
As a high school teacher for eighteen years, I agree with Mr. Hale that too much homework can harm students' health and family life.
However, his conclusion goes much too far.
Homework that is short, purposeful, and connected to what was learned in class gives students a chance to practice independently and to discover what they have not yet understood.
Mr. Hale cites the stress reported by students at a few highly competitive schools, but he ignores the many schools where homework is modest and helpful.
Many students in my own classes tell me that a few well-chosen problems each night help them feel more prepared for tests.
The real problem is not homework itself but poorly designed homework.
Instead of abolishing it, schools should set clear limits on its amount and make sure that each assignment has a clear purpose.
""") + '\n\nLinda Moreno\nSpringfield'),
  '독자 투고 — 칼럼의 문제의식은 일부 인정하되 그 결론을 반박하려고',
  ['신문 칼럼 — 숙제를 전면 폐지해야 한다고 주장하려고',
   '독자 투고 — 칼럼니스트의 주장에 전적으로 동의함을 밝히려고',
   '신문 사설 — 숙제 양에 대한 신문사의 공식 입장을 밝히려고',
   '보도 기사 — 경쟁이 심한 학교 학생들의 스트레스 실태를 알리려고'],
  ['종류: 「To the Editor:(편집자님께)」로 시작하고 끝에 독자의 이름과 사는 곳(Linda Moreno, Springfield)이 있으므로 신문에 보낸 독자 투고이다.',
   '의도: 「I agree with Mr. Hale that too much homework can harm ~(숙제가 너무 많으면 해롭다는 데는 동의한다)」로 일부를 인정한 뒤, 「However, his conclusion goes much too far.(하지만 그의 결론은 너무 지나치다.)」로 «숙제 전면 폐지»라는 결론을 반박한다. 대안은 숙제의 양 제한과 목적 있는 숙제이다.',
   '「숙제 전면 폐지」는 필자가 반박하는 칼럼(Richard Hale)의 주장이고, 필자는 칼럼에 «전적으로» 동의하지 않는다. 경쟁 학교의 스트레스는 칼럼이 든 근거로 언급될 뿐이다.'])


# ══════════════════════════════════════════════════════════════
# u0m1s3t0 독해/세부 내용 파악/추론 불가/글에서 추론할 수 없는 것
# ══════════════════════════════════════════════════════════════
T = 'u0m1s3t0'

q(T, 1, P('다음 글에서 추론할 수 «없는» 것은?', J("""
Tardigrades, often called water bears, are tiny animals that are usually less than one millimeter long.
They live almost everywhere on Earth, from high mountaintops to the floor of the deep sea, but they are most easily found in the thin film of water that covers moss and lichen.
What makes tardigrades remarkable is their ability to survive conditions that would kill almost any other animal.
When their surroundings dry out, they pull in their legs, lose nearly all the water in their bodies, and curl up into a dry, lifeless-looking state.
In this condition, their metabolism slows almost to zero, and they can endure extreme cold and intense radiation.
When water returns, they can rehydrate and become active again within a few hours.
Some tardigrades have even survived exposure to the vacuum of outer space.
Scientists are now studying how tardigrades protect their cells while dried out, in the hope that this knowledge might one day help preserve medicines without refrigeration.
""")),
  '물곰은 몸속 수분을 유지해야만 극한 환경을 견딜 수 있다.',
  ['물곰은 이끼 등을 덮은 얇은 물막에서 쉽게 발견된다.',
   '건조한 상태의 물곰은 물질대사가 거의 멈춘다.',
   '물곰은 우주 공간에 노출되고도 살아남은 적이 있다.',
   '물곰 연구는 약품 보관 방법 개발에 도움이 될 수 있다.'],
  ['「they ~ lose nearly all the water in their bodies, and curl up into a dry, lifeless-looking state(몸속 수분을 거의 다 잃고 말라서 죽은 듯한 상태로 몸을 만다)」 — 물곰은 수분을 «잃은» 상태로 극한 환경을 견딘다. 따라서 「수분을 유지해야만 견딘다」는 글과 반대이다.',
   '나머지: 이끼·지의류의 얇은 물막에서 쉽게 발견됨, 건조 상태에서 물질대사가 거의 0으로 느려짐, 우주 진공에 노출되고도 살아남음, 냉장 없이 약품을 보존하는 데 도움이 되기를 기대하며 연구함 — 모두 추론할 수 있다.'])

q(T, 2, P('다음 글에서 추론할 수 «없는» 것은?', J("""
Every choice has a hidden price.
When you spend an evening watching a movie, the cost is not only the price of the ticket but also everything else you could have done with those hours: studying for a test, sleeping, or talking with a friend.
Economists call the value of the best alternative you give up the opportunity cost of a decision.
This idea explains why a free event is never entirely free.
If attending it means missing a shift at your part-time job, its real cost includes the wages you would have earned.
Opportunity cost also helps explain why busy people often value their time so highly.
For someone who could earn a large amount in an hour, waiting in a long line to save a small sum of money may be a poor choice, while the same wait might be perfectly reasonable for someone with more free time.
The concept does not tell us what we should choose, but it reminds us that every yes is also a no to something else.
""")),
  'The opportunity cost of an activity is the same for everyone who does it.',
  ['The cost of a decision includes more than the money spent.',
   'An event that charges nothing may still have a cost.',
   'Opportunity cost refers to the value of the best option given up.',
   'The concept itself does not decide which choice is right.'],
  ['줄 서서 기다리는 예: 한 시간에 큰돈을 벌 수 있는 사람에게는 나쁜 선택이지만, 여유 시간이 많은 사람에게는 합리적일 수 있다 — 같은 활동이라도 사람마다 기회비용이 «다르다». 따라서 「누구에게나 같다」는 추론할 수 없다.',
   '나머지: 영화 표값 외에 포기한 다른 일도 비용(돈 이상의 비용), 무료 행사도 아르바이트 임금을 잃으면 비용이 있음, 기회비용 = 포기한 최선의 대안의 가치, 「The concept does not tell us what we should choose(이 개념은 무엇을 골라야 할지 알려 주지 않는다)」 — 모두 추론 가능하다.'])

q(T, 3, P('다음 글에서 추론할 수 «없는» 것은?', J("""
Deep inside a mountain on a remote Norwegian island, far north of the Arctic Circle, lies one of the most unusual storage facilities in the world, built to protect the future of farming.
The Svalbard Global Seed Vault, which opened in 2008, holds backup copies of seeds from gene banks around the world.
Its location was chosen carefully: the surrounding permafrost keeps the rock naturally cold, and the site is high enough above sea level to remain dry even if the polar ice melts.
Inside, the seeds are stored at about minus eighteen degrees Celsius, a temperature at which many of them can remain alive for decades or even centuries.
The vault works much like a safe-deposit box at a bank.
Each country or institution that sends seeds keeps ownership of them, and only the depositor can withdraw them.
The first withdrawal took place in 2015, when researchers whose gene bank in Syria had been disrupted by war asked for their seeds back in order to rebuild their collection elsewhere.
""")),
  '저장고에 맡긴 종자의 소유권은 노르웨이 정부가 갖는다.',
  ['저장고의 위치는 온도와 침수 위험을 고려해 정해졌다.',
   '저장고는 각국 종자 은행이 가진 종자의 예비 사본을 보관한다.',
   '종자를 맡긴 기관만이 그 종자를 꺼낼 수 있다.',
   '전쟁은 종자 인출이 처음 이루어진 계기가 되었다.'],
  ['「Each country or institution that sends seeds keeps ownership of them(종자를 보내는 각 나라나 기관이 소유권을 유지한다)」 — 소유권은 맡긴 쪽에 있으므로 「노르웨이 정부가 갖는다」는 글과 어긋난다.',
   '위치: 영구 동토가 바위를 차갑게 유지하고, 극지방 얼음이 녹아도 마르게 있을 만큼 해발이 높다(온도·침수 고려). 은행 대여 금고처럼 «맡긴 사람만» 꺼낼 수 있다.',
   '첫 인출(2015년)은 전쟁으로 시리아의 유전자 은행이 제 기능을 못 하게 된 연구자들이 종자를 돌려받은 것이다 — 모두 추론 가능하다.'])

q(T, 3, P('다음 글에서 추론할 수 «없는» 것은?', J("""
Imagine you have paid a high price for a concert ticket, but on the day of the concert you wake up with a bad cold and a storm is raging outside.
Many people in this situation would still drag themselves to the concert, reasoning that otherwise the money would be wasted.
Yet the money is gone either way; it cannot be recovered whether you go or stay home.
The only real question is whether the evening at the concert will be better than the evening at home.
This tendency to continue something because of what we have already spent on it, rather than because of what we will gain, is known as the sunk cost fallacy.
It affects far more than concert tickets.
Companies keep funding failing projects because they have already invested millions, and individuals stay in unsatisfying courses of study because they have already spent years on them.
Recognizing a sunk cost does not mean giving up easily.
It simply means making decisions based on future benefits and costs, not on past investments that cannot be undone.
""")),
  '매몰 비용의 오류를 피하려면 어려움이 생기는 즉시 포기하는 것이 좋다.',
  ['이미 쓴 돈은 어떤 선택을 하든 되찾을 수 없다.',
   '매몰 비용의 오류는 개인뿐 아니라 기업의 결정에도 나타난다.',
   '합리적인 결정은 앞으로 얻을 이익과 들 비용을 따져야 한다.',
   '사람들은 이미 들인 시간 때문에 만족스럽지 않은 일을 계속하기도 한다.'],
  ['「Recognizing a sunk cost does not mean giving up easily.(매몰 비용을 인식한다는 것이 쉽게 포기한다는 뜻은 아니다.)」 — 「즉시 포기하라」는 글과 반대이다.',
   '나머지: 「the money is gone either way(돈은 어느 쪽이든 사라졌다)」, 기업이 이미 수백만을 투자해 실패한 사업에 계속 돈을 댐, 「decisions based on future benefits and costs(미래의 이익과 비용에 근거한 결정)」, 이미 수년을 들여 만족스럽지 않은 공부를 계속함 — 모두 추론 가능하다.'])

q(T, 4, P('다음 글에서 추론할 수 «없는» 것은?', J("""
Cities are noisy places, and most of that noise is low in pitch: the rumble of traffic, the hum of engines, the vibration of construction machinery.
For animals that rely on sound to communicate, this constant background noise creates a serious problem.
Songbirds, for example, use their songs to attract mates and to warn rivals away from their territory.
If a song is drowned out by traffic, it fails to do its job.
Researchers comparing birds of the same species in quiet forests and noisy cities have found that many urban birds sing at a higher pitch than their rural relatives, which helps their songs stand out above the low-frequency noise.
Some species also sing louder in noisy areas or shift their singing to quieter times of day.
These adjustments allow birds to keep communicating, but they may come at a cost.
In some species, females appear to prefer lower-pitched songs, so a male forced to sing higher may be less attractive to potential mates.
""")),
  'Birds in cities tend to lower the pitch of their songs to be heard over traffic.',
  ['Traffic noise can interfere with the purposes that bird songs serve.',
   'Some birds change the time of day when they sing in response to noise.',
   'Singing at a higher pitch may reduce a male bird\'s appeal to females in some species.',
   'Birds of the same species can sing differently depending on where they live.'],
  ['「many urban birds sing at a higher pitch than their rural relatives(많은 도시 새들은 시골의 같은 종보다 더 높은 음으로 노래한다)」 — 도시 소음은 «낮은» 음이므로 새들은 음을 «높여» 소음 위로 노래가 들리게 한다. 「음을 낮춘다」는 글과 반대이다.',
   '나머지: 노래가 소음에 묻히면 짝짓기·영역 경고라는 제 역할을 못 함, 조용한 시간대로 노래 시간을 옮김, 일부 종의 암컷은 낮은 음을 선호해 높게 노래하는 수컷의 매력이 떨어질 수 있음, 같은 종이라도 사는 곳(숲/도시)에 따라 노래가 다름 — 모두 추론 가능하다.'])

q(T, 5, P('다음 글에서 추론할 수 «없는» 것만을 <보기>에서 있는 대로 고른 것은?', J("""
What makes a chess master so much better than a beginner?
One might assume that masters simply have better memories or can calculate many more moves ahead.
Classic studies of chess expertise, however, point to a different explanation.
In these experiments, players were shown a chessboard from a real game for only a few seconds and then asked to reconstruct the position from memory.
Masters placed most of the pieces correctly, while beginners could recall only a handful.
But when the pieces were arranged randomly, in positions that could never occur in an actual game, the masters' advantage largely disappeared.
Their superior memory, it turned out, was not a general ability but a product of experience.
Through years of study, masters had stored thousands of familiar patterns, allowing them to see a group of pieces as a single meaningful unit rather than as separate items to be remembered one by one.
Expertise, in other words, lies less in the power of the mind than in the organization of knowledge built up over time.
"""), '<보기>\nㄱ. 체스 고수는 실제 대국의 말 배치를 초보자보다 훨씬 잘 기억했다.\nㄴ. 체스 고수는 체스와 관계없는 숫자나 단어도 초보자보다 훨씬 잘 기억할 것이다.\nㄷ. 말을 무작위로 놓았을 때는 고수와 초보자의 기억력 차이가 크게 줄었다.\nㄹ. 고수의 실력은 주로 더 많은 수를 앞서 계산하는 능력에서 나온다.'),
  'ㄴ, ㄹ',
  ['ㄱ, ㄴ', 'ㄱ, ㄷ', 'ㄷ, ㄹ', 'ㄴ, ㄷ, ㄹ'],
  ['ㄱ(추론 가능): 실제 대국 배치를 몇 초 보여 주자 고수는 대부분을 맞혔고 초보자는 몇 개만 기억했다.',
   'ㄴ(추론 불가): 「Their superior memory ~ was not a general ability but a product of experience.(그들의 뛰어난 기억력은 일반적인 능력이 아니라 경험의 산물이었다.)」 — 체스와 무관한 것까지 잘 기억한다고 볼 근거가 없고, 오히려 글과 어긋난다.',
   'ㄷ(추론 가능): 무작위 배치에서는 고수의 이점이 대부분 사라졌다(largely disappeared).',
   'ㄹ(추론 불가): 「더 많은 수를 계산한다」는 필자가 소개한 통념이고, 연구는 «다른 설명(a different explanation)», 즉 경험으로 쌓인 패턴 지식을 가리킨다.'])


# ══════════════════════════════════════════════════════════════
# u0m1s4t1 독해/세부 내용 파악/질문 확인/도표·안내문 세부 정보
# ══════════════════════════════════════════════════════════════
T = 'u0m1s4t1'

q(T, 1, P('다음 안내문의 내용과 일치하는 것은?',
          'Greenfield Public Library\nSummer Reading Challenge for Teens\n\n'
          '• Period: July 1 – August 15\n'
          '• Who can join: Students aged 13 to 18 with a Greenfield library card\n'
          '• How it works:\n'
          '   - Read at least five books during the challenge period.\n'
          '   - After finishing each book, write a short review (100 words or more) on the library website.\n'
          '   - E-books and audiobooks also count.\n'
          '• Rewards:\n'
          '   - Everyone who completes the challenge will receive a certificate and a free tote bag.\n'
          '   - Three participants will be chosen at random to receive a 50-dollar bookstore gift card.\n'
          '• A closing party will be held on August 22 in the library\'s main hall.', cnt=False),
  '전자책과 오디오북도 읽은 책으로 인정된다.',
  ['도서관 카드가 없어도 참가할 수 있다.',
   '책을 세 권 이상 읽으면 과제를 완료한 것이다.',
   '서평은 50단어 이상으로 써야 한다.',
   '과제를 완료한 모든 참가자가 서점 상품권을 받는다.'],
  ['「E-books and audiobooks also count.(전자책과 오디오북도 인정된다.)」와 일치한다.',
   '참가 대상은 «그린필드 도서관 카드가 있는» 13~18세, 과제는 «최소 다섯 권», 서평은 «100단어 이상»이다.',
   '완료자 전원은 수료증과 에코백을 받고, 50달러 상품권은 무작위로 뽑힌 «세 명»만 받는다. 50이라는 숫자는 상품권 금액이지 서평 분량이 아니다.'])

q(T, 2, P('다음 안내문의 내용과 일치하지 «않는» 것은?',
          '2026 Riverside Half Marathon — Volunteers Wanted\n\n'
          'We are looking for energetic volunteers to help make this year\'s race a success!\n\n'
          '• Date: Sunday, October 18, 6:00 a.m. – 1:00 p.m.\n'
          '• Roles: water station staff, course guides, finish-line medal distribution\n'
          '• Requirements:\n'
          '   - Volunteers must be at least 16 years old.\n'
          '   - Volunteers under 18 need a permission form signed by a parent or guardian.\n'
          '• Benefits:\n'
          '   - Official volunteer T-shirt and lunch\n'
          '   - A certificate for 7 volunteer hours\n'
          '• How to apply: Sign up on our website by October 4. Places are limited to 150 volunteers and will be filled on a first-come, first-served basis.\n'
          '• A required training session will be held online on October 11.', cnt=False),
  '자원봉사자는 선발 면접을 거쳐 뽑는다.',
  ['자원봉사 시간은 일곱 시간으로 인정된다.',
   '18세 미만은 보호자가 서명한 동의서가 필요하다.',
   '10월 4일까지 웹사이트에서 신청해야 한다.',
   '사전 교육은 온라인으로 진행된다.'],
  ['「will be filled on a first-come, first-served basis(선착순으로 채워진다)」 — 면접 선발이 아니라 선착순이므로 일치하지 않는다.',
   '봉사 시간 오전 6시~오후 1시 = 7시간이고 수료증도 7시간으로 준다. 18세 미만은 보호자 서명 동의서 필요, 10월 4일까지 웹사이트 신청, 10월 11일 필수 교육은 온라인 — 모두 일치한다.'])

qf(T, 3, P('다음 표의 내용과 일치하지 «않는» 것은?',
           'Book Reading by Format in Country A\n'
           '(Percentage of adults who read at least one book in each format during the past year)\n\n'
           '• Printed books — 2016: 65% / 2026: 52%\n'
           '• E-books — 2016: 28% / 2026: 34%\n'
           '• Audiobooks — 2016: 14% / 2026: 31%\n'
           '• Any format — 2016: 73% / 2026: 70%\n\n'
           + J("""
The table above shows how adults in Country A read books in 2016 and 2026.
ⓐ In both years, printed books were the most popular of the three formats.
ⓑ The share of adults who read e-books rose by 6 percentage points from 2016 to 2026.
ⓒ The percentage of audiobook readers in 2026 was more than twice that in 2016.
ⓓ In 2026, the gap between printed books and e-books was less than 20 percentage points.
ⓔ The share of adults who read at least one book in any format increased slightly over the ten-year period.
"""), cnt=False), F, 4,
   ['ⓔ: 어떤 형식으로든 책을 읽은 성인의 비율은 73% → 70%로 3%p «감소»했다. 「조금 증가했다」는 표와 일치하지 않는다.',
    'ⓐ 2016년 65% > 28%·14%, 2026년 52% > 34%·31% — 두 해 모두 종이책이 가장 높다(일치). ⓑ 28% → 34%, 6%p 증가(일치).',
    'ⓒ 오디오북 14% × 2 = 28% < 31% — 두 배보다 많다(일치). ⓓ 2026년 52% − 34% = 18%p < 20%p(일치).'])

q(T, 3, P('다음 안내문을 읽고 답할 수 «없는» 질문은?',
          'Maple Valley Science Museum\nSpecial Exhibition: "Inside the Human Brain"\n\n'
          '• Dates: March 3 – June 28\n'
          '• Hours: Tuesday – Sunday, 10:00 a.m. – 6:00 p.m. (closed on Mondays)\n'
          '• Admission: Adults 15 dollars / Students 10 dollars / Children under 7 free\n'
          '   ※ A special exhibition ticket also includes entry to all permanent exhibits.\n'
          '• Highlights:\n'
          '   - A walk-through model of the brain, three meters tall\n'
          '   - A virtual reality experience showing how memories are formed (ages 12 and up)\n'
          '• Guided tours: 11:00 a.m. and 3:00 p.m. daily (no reservation needed)\n'
          '• Photography is allowed, but flash is not permitted.', cnt=False),
  'How long does the virtual reality experience last?',
  ['Is the museum open on Mondays?',
   'How much does a student ticket cost?',
   'Can visitors take pictures in the exhibition?',
   'Who can take part in the virtual reality experience?'],
  ['가상 현실 체험의 «소요 시간»은 안내문에 나오지 않으므로 「How long does the virtual reality experience last?(가상 현실 체험은 얼마나 걸리는가?)」에는 답할 수 없다.',
   '월요일 휴관(closed on Mondays), 학생 10달러, 사진 촬영 가능(플래시 금지), 가상 현실 체험은 12세 이상 — 나머지 질문은 모두 답할 수 있다.',
   '(ages 12 and up)은 참가 «대상»이지 시간이 아니라는 점에 주의한다.'])

q(T, 4, P('다음 표의 내용과 일치하는 것은?',
          'How High School Students in City B Usually Get to School\n'
          '(Survey of 1,000 students)\n\n'
          '• Walking — 34% — average 14 minutes\n'
          '• Bus — 29% — average 27 minutes\n'
          '• Subway — 18% — average 31 minutes\n'
          '• Bicycle — 11% — average 18 minutes\n'
          '• Car (driven by family) — 8% — average 16 minutes', cnt=False),
  '버스로 통학하는 학생 수는 자전거로 통학하는 학생 수의 두 배보다 많다.',
  ['대중교통(버스·지하철)을 이용하는 학생은 전체의 절반을 넘는다.',
   '평균 통학 시간이 가장 긴 방법은 버스이다.',
   '걸어서 통학하는 학생은 300명보다 적다.',
   '가족의 차로 통학하는 학생은 자전거로 통학하는 학생보다 평균 통학 시간이 길다.'],
  ['버스 29% = 290명, 자전거 11% = 110명 → 110 × 2 = 220 < 290이므로 두 배보다 많다(일치).',
   '대중교통 29% + 18% = 47%로 절반이 안 된다. 평균 시간이 가장 긴 것은 지하철(31분)이다.',
   '도보 34% = 340명으로 300명보다 많다. 가족 차 16분 < 자전거 18분이므로 차가 더 짧다.'])

q(T, 5, P('다음 안내문을 바탕으로 할 때, <상황>의 Mina가 내야 할 총금액은?',
          'Coastal Youth Coding Camp\n\n'
          '• Program fees (per person):\n'
          '   - Basic Course (3 days): 120 dollars\n'
          '   - Advanced Course (5 days): 200 dollars\n'
          '• Optional lunch package: 10 dollars per day\n'
          '• Discounts (on the program fee only, not on lunch):\n'
          '   - Early registration (by May 31): 20 dollars off\n'
          '   - Sibling discount: 15 dollars off for each child when two or more siblings register together\n'
          '   ※ Both discounts can be applied together.', cnt=False,
          뒤='<상황>\nMina registered on May 25 for the Advanced Course together with her younger brother, who signed up for the Basic Course. Mina also ordered the lunch package for every day of her course. (Calculate Mina\'s payment only.)'),
  '215 dollars',
  ['165 dollars', '230 dollars', '235 dollars', '250 dollars'],
  ['Mina의 과정: Advanced Course(5일) 200달러.',
   '할인(프로그램 비용에만 적용, 두 할인은 함께 받을 수 있음 — Both discounts can be applied together): 5월 25일 등록 → 조기 등록 20달러 할인, 남동생과 함께 등록 → 형제 할인 15달러. 200 − 20 − 15 = 165달러.',
   '점심: 과정의 모든 날(5일) × 10달러 = 50달러이고, 점심에는 할인이 적용되지 않는다.',
   '합계: 165 + 50 = 215달러. (165는 점심을 빠뜨린 값, 230은 형제 할인을, 235는 조기 등록 할인을 빠뜨린 값, 250은 할인을 전혀 적용하지 않은 값이다.)'])



# ══════════════════════════════════════════════════════════════
# u0m2s0t0 독해/글의 흐름 파악/무관한 문장/전체 흐름과 관계 없는 문장
# ══════════════════════════════════════════════════════════════
T = 'u0m2s0t0'
발 = '다음 글에서 전체 흐름과 관계 없는 문장은?'

qf(T, 1, P(발, J("""
Boredom is usually seen as something to be avoided, but it may play a valuable role in our mental lives.
ⓐ When we are bored, our minds begin to wander, drifting away from the task in front of us toward memories, plans, and imaginary situations.
ⓑ This wandering is not wasted time; it gives the brain an opportunity to connect ideas that are normally kept apart.
ⓒ Regular physical exercise is widely recommended as a way to stay healthy and reduce stress.
ⓓ That is why many people report that their best ideas come to them in the shower or on a long walk, moments when there is little to hold their attention.
ⓔ Today, however, smartphones allow us to fill every empty moment with messages, videos, and games, so we rarely experience boredom at all.
By escaping boredom so efficiently, we may also be losing the quiet mental space in which creative thinking takes shape.
Occasionally allowing ourselves to be bored, then, may be one of the simplest ways to become more creative.
""")), F, 2,
   ['첫 문장 「지루함은 보통 피해야 할 것으로 여겨지지만, 우리의 정신생활에서 귀중한 역할을 할 수 있다.」가 주제이다.',
    'ⓐ 지루하면 생각이 떠돎 → ⓑ 떠도는 생각이 평소 떨어져 있던 생각들을 연결함 → ⓓ 「That is why(그래서)」 샤워 중이나 산책 중에 좋은 생각이 떠오름 → ⓔ 스마트폰 때문에 지루함을 거의 겪지 않음 — 지루함과 창의성의 관계로 이어진다.',
    'ⓒ 「규칙적인 운동은 건강을 지키고 스트레스를 줄이는 방법으로 널리 권장된다.」는 운동의 이점 이야기로 흐름과 관계가 없다. ⓓ의 That is why가 가리키는 것은 ⓑ이므로, ⓒ가 그 사이를 끊고 있다.'])

qf(T, 2, P(발, J("""
Athletes, musicians, and students facing an important exam often perform small rituals before they begin.
A tennis player may bounce the ball exactly five times before serving, and a pianist may rub her hands together in the same way before every concert.
ⓐ These actions may look like mere superstition, but they can serve a real psychological purpose.
ⓑ Before a high-pressure performance, people often feel a loss of control, since the outcome depends on many factors they cannot predict.
ⓒ A ritual, by contrast, is something entirely within their control: it has a fixed sequence, and it can be completed perfectly every time.
ⓓ Performing it gives people a sense of order and predictability, which helps calm their nerves and focus their attention on the task ahead.
ⓔ Tennis balls were once mostly white, and yellow balls were introduced partly so that they would be easier to see on television.
In this sense, a ritual works less like a magic charm than like a mental anchor, holding the performer steady in a moment of uncertainty.
""")), F, 4,
   ['주제: 중요한 수행 전의 작은 의식(ritual)은 미신처럼 보여도 실제 심리적 목적(통제감·안정)을 지닌다.',
    'ⓐ 실제 심리적 목적이 있음 → ⓑ 수행 전에는 통제력을 잃은 느낌 → ⓒ 반면 의식은 완전히 통제 가능함 → ⓓ 질서·예측 가능성을 주어 긴장을 가라앉힘 → 마지막 문장 «정신적인 닻»으로 정리된다.',
    'ⓔ 「테니스공은 한때 대부분 흰색이었고, 노란 공은 텔레비전에서 더 잘 보이도록 도입되었다.」는 테니스라는 낱말만 겹칠 뿐, 의식의 심리적 효과와 관계가 없다.'])

qf(T, 3, P(발, J("""
Virtually every language borrows words from others, and English is a particularly striking example.
ⓐ Many people believe that learning a second language is easier in childhood than in adulthood.
ⓑ English took words such as "ballet" and "menu" from French, "piano" from Italian, and "tsunami" from Japanese.
ⓒ Borrowing usually happens when speakers encounter new objects, ideas, or practices for which their own language has no convenient word.
ⓓ Once adopted, borrowed words often change to fit the sounds and grammar of the new language, until speakers no longer notice that they came from elsewhere.
ⓔ In this way, the vocabulary of a language becomes a kind of historical record, preserving traces of trade, conquest, migration, and cultural exchange.
Even an ordinary English breakfast can include words such as "coffee," "toast," and "yogurt" that arrived from other languages.
Looking closely at where our everyday words come from can therefore reveal a great deal about the contacts our ancestors had with other peoples, contacts that history books may describe only briefly or not at all.
""")), F, 0,
   ['첫 문장 「거의 모든 언어는 다른 언어에서 낱말을 빌려 오며, 영어는 특히 두드러진 예이다.」가 주제이다.',
    'ⓑ 영어의 차용어 예(ballet·menu·piano·tsunami) → ⓒ 차용이 일어나는 까닭(새 사물·개념에 맞는 낱말이 없을 때) → ⓓ 차용어가 새 언어에 맞게 바뀜 → ⓔ 그래서 어휘가 교역·정복·이주·문화 교류의 역사 기록이 됨 — 낱말 차용이라는 흐름이다.',
    'ⓐ 「많은 사람이 제2언어는 성인보다 어린 시절에 배우기가 더 쉽다고 믿는다.」는 «외국어 학습 시기» 이야기로, 언어 간 낱말 차용과 관계가 없다. 무관한 문장이 첫 자리에 올 수도 있음에 주의한다.'])

qf(T, 3, P(발, J("""
News reports often announce that "a new study shows" coffee is harmful one week and beneficial the next.
Such headlines can leave the public confused and suspicious of science.
ⓐ The problem, however, lies less in science itself than in the way individual studies are presented.
ⓑ A single study, no matter how well designed, is only one piece of evidence, and its results may be influenced by chance, by the particular group of people studied, or by small errors in method.
ⓒ Scientists therefore place greater trust in findings that have been repeated by different research teams using different methods.
ⓓ Coffee shops have become popular places for students to study and for friends to meet.
ⓔ When many studies point in the same direction, the conclusion becomes much more reliable than any one of them could be alone.
Readers who keep this in mind can respond to surprising headlines with healthy caution rather than confusion, waiting to see whether a finding holds up before changing their habits.
""")), F, 3,
   ['주제: 과학 뉴스가 오락가락하는 것은 과학 자체보다 «연구 하나»를 결론처럼 전하는 방식의 문제이며, 여러 연구가 같은 방향을 가리킬 때 결론을 믿을 수 있다.',
    'ⓐ 문제는 연구를 전하는 방식에 있음 → ⓑ 연구 하나는 증거 한 조각일 뿐 → ⓒ 그래서 과학자는 반복 검증된 결과를 더 신뢰함 → ⓔ 여러 연구가 같은 방향을 가리키면 훨씬 믿을 만함.',
    'ⓓ 「커피숍은 학생들이 공부하고 친구들이 만나는 인기 있는 장소가 되었다.」는 첫 문장의 «커피»라는 소재만 겹칠 뿐, 연구 결과의 신뢰성이라는 흐름과 관계가 없다.'])

qf(T, 4, P(발, J("""
We tend to regard forgetting as a failure of memory, a flaw that we would eliminate if we could.
ⓐ Yet a memory that kept every detail would be a burden rather than a gift.
ⓑ Memory contests, in which competitors memorize the order of shuffled playing cards, have become popular events in several countries.
ⓒ If we remembered every face we passed on the street and every word of every conversation, the important information would be buried under a mountain of trivial details.
ⓓ By letting go of specifics, the brain is able to extract general patterns, learning what dogs usually look like, for instance, rather than the exact appearance of each dog we have ever seen.
ⓔ Forgetting also allows us to update our knowledge, replacing an old phone number or an outdated rule with a new one without confusion.
Seen in this light, forgetting is not simply the opposite of remembering but a partner to it.
A healthy memory depends as much on what it discards as on what it keeps.
""")), F, 1,
   ['주제: 망각은 기억의 결함처럼 보이지만 실제로는 기억을 돕는 짝이다(건강한 기억은 버리는 것에도 달려 있다).',
    'ⓐ 모든 것을 기억하면 짐이 됨 → ⓒ 사소한 정보에 중요한 정보가 묻힘 → ⓓ 세부를 버려야 일반적인 패턴을 뽑아냄 → ⓔ 옛 정보를 새것으로 바꿀 수 있음 — 망각의 이점이 이어진다.',
    'ⓑ 「섞은 카드의 순서를 외우는 기억력 대회가 여러 나라에서 인기 행사가 되었다.」는 «기억»이라는 낱말만 같을 뿐, 망각의 가치와 관계가 없고 ⓐ(짐이 된다)와 ⓒ(그 구체적 설명) 사이를 끊는다.'])

qf(T, 5, P(발, J("""
People are surprisingly poor at judging how common different dangers are.
Many are more afraid of flying than of driving, even though, mile for mile, driving is far more likely to result in death.
ⓐ One reason is that we tend to estimate the likelihood of an event by how easily examples of it come to mind.
ⓑ A plane crash is rare, but when it happens, it is reported around the world for days, with dramatic images that stay in our memories.
ⓒ Car accidents, by contrast, happen every day, yet each one receives little attention beyond the local news.
ⓓ Modern airplanes are designed with several backup systems, so that the failure of a single part rarely causes a disaster.
ⓔ As a result, the rare event feels common because it is memorable, while the common event feels rare because it is ordinary.
Understanding this bias does not make fear disappear, but it can help us question our instincts and look at the actual numbers before deciding what to worry about.
""")), F, 3,
   ['주제: 사람들은 위험의 빈도를 «얼마나 쉽게 사례가 떠오르는가»로 판단하기 때문에 잘못 판단한다(인지적 편향).',
    'ⓐ 떠올리기 쉬운 정도로 가능성을 판단함 → ⓑ 비행기 사고는 드물지만 며칠씩 크게 보도됨 → ⓒ 자동차 사고는 매일 일어나지만 주목받지 못함 → ⓔ 그 결과 드문 일은 흔하게, 흔한 일은 드물게 느껴짐 — 판단 편향의 원인을 설명한다.',
    'ⓓ 「현대 비행기는 여러 예비 장치를 갖추어 부품 하나의 고장이 재난으로 이어지는 경우가 드물다.」는 비행기가 «실제로» 왜 안전한지에 대한 설명으로, 사람들의 «판단이 왜 틀리는가»라는 흐름에서 벗어난다. 소재(비행기 안전)가 가까워 고르기 어렵지만, ⓒ와 ⓔ(As a result) 사이의 인과를 끊는 문장이다.'])


# ══════════════════════════════════════════════════════════════
# u0m2s1t0 독해/글의 흐름 파악/문장 삽입/주어진 문장이 들어갈 위치
# ══════════════════════════════════════════════════════════════
T = 'u0m2s1t0'
발 = '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'


def 삽입(주어진, 지문):
    WC.append((T, wc(지문) + wc(주어진)))
    return f'{발}\n\n[주어진 문장]\n{주어진}\n\n{지문}'


qf(T, 1, 삽입('For instance, a person who wants to exercise more might decide to do ten push-ups every time she brushes her teeth.', J("""
Many people start the new year determined to exercise, read more, or eat healthier food, only to abandon their plans within weeks.
Building a new habit is often harder than we expect, because good intentions tend to fade once daily life becomes busy.
( A ) One effective strategy is to attach a new behavior to something we already do every day without thinking.
( B ) Because brushing her teeth is already automatic, it can serve as a reliable reminder for the new activity.
( C ) Over time, the connection between the two actions grows stronger, and the new behavior begins to feel as natural as the old one.
( D ) This approach works because it does not depend on memory or motivation, both of which are unreliable.
( E ) Instead, it uses the structure of an existing routine to carry the new habit along.
Small, consistent actions linked to familiar moments can eventually add up to lasting change.
""")), AE, 1,
   ['주어진 문장: 「예를 들어, 운동을 더 하고 싶은 사람은 이를 닦을 때마다 팔굽혀펴기를 열 번 하기로 정할 수 있다.」 — 앞에는 예시가 필요한 일반적 전략이 와야 한다.',
    '(B) 앞 문장은 「새 행동을 이미 매일 무의식적으로 하는 일에 붙이는 것」이라는 전략이고, (B) 뒤 문장 「Because brushing her teeth is already automatic(그녀에게 양치질은 이미 자동적이기 때문에)」의 her와 brushing her teeth는 주어진 문장의 a person(she)과 양치질을 받는다.',
    '(A)에 넣으면 전략이 나오기도 전에 예시가 오고, (C) 이후에 넣으면 her가 가리킬 사람이 앞에 없이 (B) 뒤 문장이 먼저 나오게 된다.'])

qf(T, 2, 삽입('The result is often a sentence that is accurate in meaning but no longer funny.', J("""
Translating a novel or a poem is difficult, but translating humor may be the hardest task of all.
( A ) Much of what makes us laugh depends on double meanings, where a single word or phrase can be understood in two different ways.
( B ) Other jokes rely on shared cultural knowledge, such as references to famous people, local customs, or popular television shows.
( C ) A translator can usually find words with the same basic meaning, but those words rarely carry the same double meanings or cultural associations in another language.
( D ) Faced with this problem, some translators replace the original joke with a completely different one that produces a similar effect on the new audience.
( E ) Others choose to keep the original and add a footnote explaining it, although, as anyone who has had a joke explained knows, humor rarely survives explanation.
In either case, something is inevitably lost, which reminds us how deeply laughter is rooted in language and culture.
""")), AE, 3,
   ['주어진 문장: 「그 결과는 흔히 의미는 정확하지만 더 이상 웃기지 않는 문장이다.」 — The result는 «번역가가 같은 뜻의 낱말로 옮긴» 결과를 가리킨다.',
    '(D) 앞 문장 「번역가는 대개 기본 의미가 같은 낱말을 찾을 수 있지만, 그 낱말이 다른 언어에서 같은 이중 의미나 문화적 연상을 지니는 경우는 드물다」의 결과가 주어진 문장이고, (D) 뒤 「Faced with this problem(이 문제에 부딪혀)」이 그 «웃기지 않게 된 번역»을 문제로 받는다.',
    '(C)에 넣으면 번역 행위가 나오기도 전에 The result가 오고, (E)에 넣으면 some translators ~ / Others ~ 로 이어지는 두 해결책 사이가 끊긴다.'])

qf(T, 3, 삽입('Yet their very success has created a problem: the more we rely on them, the less effective they become.', J("""
Since penicillin came into widespread use in the 1940s, antibiotics have saved countless lives, turning once-deadly infections into minor illnesses.
( A ) Every time antibiotics are used, the bacteria that happen to be resistant survive and multiply, while the others die.
( B ) Over many generations, this process produces populations of bacteria that the drugs can no longer kill.
( C ) The more often antibiotics are used, the faster resistance spreads, which is why unnecessary use, such as taking them for viral infections like the common cold, is particularly harmful.
( D ) Some infections that were easy to treat a few decades ago now require stronger drugs, and a few can hardly be treated at all.
( E ) For this reason, doctors today are urged to prescribe antibiotics only when they are truly needed, and patients are advised to take them exactly as directed.
Protecting the effectiveness of these medicines has become a responsibility shared by everyone.
""")), AE, 0,
   ['주어진 문장: 「그러나 바로 그 성공이 문제를 낳았다. 우리가 그것에 의존할수록 그것은 덜 효과적이 된다.」 — Yet은 앞의 «성공»과 대조하고, their는 antibiotics를 가리킨다.',
    '첫 문장이 항생제의 성공(수많은 생명을 구함)을 말하고, (A) 뒤부터 내성균이 살아남아 늘어나는 «문제»의 원리가 설명된다. 따라서 성공 → 문제 제기 → 원리 설명의 전환점인 (A)에 들어가야 한다.',
    '(B) 이후는 이미 내성의 원리를 설명하는 중이어서, 성공과 대조하는 Yet 문장이 들어갈 자리가 아니다.'])

qf(T, 3, 삽입('In other words, the price of a product can shape not only how good we believe it is but even how good it feels to us.', J("""
We usually assume that our judgments of quality are based on the product itself: how a food tastes, how a jacket feels, how well a machine works.
( A ) However, our expectations can strongly influence what we actually experience.
( B ) In one well-known study, participants tasted several wines and were told the price of each.
( C ) Unknown to them, some of the wines with different price tags were actually the same wine.
( D ) Nevertheless, participants reported enjoying the wine more when they believed it was expensive, and brain scans even showed greater activity in a region linked to pleasure.
( E ) Marketers are well aware of this effect, which is one reason why some luxury brands avoid lowering their prices even when sales are slow.
A lower price might attract more buyers, but it could also make the product seem less special to those who already own it or hope to.
""")), AE, 4,
   ['주어진 문장: 「다시 말해, 제품의 가격은 우리가 그것이 얼마나 좋다고 «믿는지»뿐 아니라 우리에게 얼마나 좋게 «느껴지는지»까지 바꿀 수 있다.」 — In other words로 앞의 실험 결과를 일반화해 다시 말한다.',
    '(E) 앞 문장: 참가자들은 같은 와인이라도 비싸다고 믿을 때 더 즐겼고, 뇌 영상에서도 쾌감 관련 영역이 더 활발했다(= 느낌까지 바뀜). (E) 뒤 「Marketers are well aware of this effect」의 this effect가 주어진 문장이 정리한 «가격 효과»를 받는다.',
    '(B)~(D)는 실험 설계와 결과가 이어지는 중간이라 결과를 요약하는 문장이 들어갈 수 없고, (A)에 넣으면 요약할 내용이 앞에 없다.'])

qf(T, 4, 삽입('As long as people traveled no faster than a horse could carry them, however, these small differences hardly mattered.', J("""
For most of human history, time was a local matter.
( A ) Each town set its clocks by the sun, declaring noon to be the moment when the sun stood highest in the sky.
( B ) Because the sun reaches that point at different moments in different places, a town slightly to the east would be a few minutes ahead of its neighbor to the west.
( C ) The arrival of the railway changed everything.
( D ) Trains connected distant towns at high speed, and a timetable that had to account for dozens of local times was confusing at best and dangerous at worst.
( E ) To solve the problem, railway companies began to adopt standard times across wide regions, and in 1883, railroads in the United States and Canada divided the continent into time zones.
Governments later followed their lead, and the time zones we now take for granted grew directly out of the needs of the railways.
""")), AE, 2,
   ['주어진 문장: 「그러나 사람들이 말이 실어 나를 수 있는 속도보다 빨리 이동하지 않는 한, 이런 작은 차이는 거의 문제가 되지 않았다.」',
    'these small differences는 (C) 앞 문장의 «동쪽 마을이 서쪽 이웃보다 몇 분 앞서는» 시간 차이를 가리킨다. 또 «말보다 빠르지 않던 시절»은 (C) 뒤 「The arrival of the railway changed everything.(철도의 등장이 모든 것을 바꾸었다.)」과 대조되어 흐름이 자연스럽다.',
    '(B)에 넣으면 시간 차이가 아직 설명되지 않았는데 these small differences가 나오고, (D) 이후에 넣으면 철도가 이미 등장한 뒤라 «말의 속도» 이야기가 어색하다.'])

qf(T, 5, 삽입('A stock market, by contrast, offers no such stable patterns to learn from.', J("""
Why can some experts make remarkably accurate judgments in a split second, while others are no better than chance?
( A ) The answer depends less on the experts themselves than on the environment in which they gained their experience.
( B ) Intuition develops when a person repeatedly faces situations that follow consistent patterns and receives quick, clear feedback on whether each judgment was right.
( C ) A firefighter who has seen hundreds of burning buildings, or a chess player who has studied thousands of games, works in exactly this kind of environment, and their sudden feelings of certainty are often trustworthy.
( D ) Its prices are influenced by countless unpredictable events, and feedback is so delayed and noisy that even a skilled investor may struggle to tell whether a success came from insight or from luck.
( E ) In such an environment, confident intuition is not a sign of expertise; it may simply be an illusion created by a few memorable successes.
Before trusting a gut feeling, then, whether our own or an expert's, we should ask whether it was formed in a world that rewards learning.
""")), AE, 3,
   ['주어진 문장: 「반면 주식 시장은 배울 만한 그런 안정된 패턴을 제공하지 않는다.」 — by contrast는 앞의 «일관된 패턴이 있는 환경(소방관·체스)»과 대조하고, no such stable patterns의 such는 (B)의 consistent patterns를 받는다.',
    '결정적 단서는 (D) 뒤 문장의 첫 낱말 「Its prices(그것의 가격)」이다. Its가 가리킬 단수 명사(a stock market)가 바로 앞에 있어야 하므로 주어진 문장은 (D)에 들어간다.',
    '(C)에 넣으면 소방관·체스의 예가 나오기도 전에 by contrast가 오고, (E)에 넣으면 Its prices가 가리킬 대상이 없어진다.'])


# ══════════════════════════════════════════════════════════════
# u0m2s3t0 독해/글의 흐름 파악/연결어/빈칸에 알맞은 연결어
# ══════════════════════════════════════════════════════════════
T = 'u0m2s3t0'

q(T, 1, P('다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?', J("""
Every January, gyms are crowded with people who have just signed up for a year-long membership.
Determined to get in shape, they pay the full fee in advance, confident that the money they have spent will push them to exercise regularly.
__________, by March, many of these new members have stopped showing up altogether, and the crowded gyms have returned to normal.
This pattern reveals something important about human behavior: we are often overly optimistic about our future selves.
When we make plans, we imagine a version of ourselves who has plenty of time, energy, and willpower.
The person who actually has to carry out those plans, however, is tired after work, distracted by other obligations, and tempted by easier pleasures.
Paying in advance does little to close this gap, because the pressure of the money spent fades surprisingly quickly.
A more effective approach is to make the desired behavior as easy as possible, such as choosing a gym on the way home or scheduling workouts with a friend who will notice if we are absent.
""")),
  'However',
  ['Therefore', 'For example', 'Similarly', 'In addition'],
  ['빈칸 앞: 사람들은 돈을 미리 내면 그 돈이 규칙적으로 운동하게 만들어 줄 것이라고 «확신한다».',
   '빈칸 뒤: 3월이 되면 새 회원 상당수가 아예 나오지 않는다 — 앞의 기대와 «반대되는» 결과이므로 역접의 However(그러나)가 알맞다.',
   'Therefore(그러므로)는 앞 내용의 자연스러운 결과를, For example은 예시를, Similarly·In addition은 같은 방향의 추가를 나타내므로 어울리지 않는다.'])

q(T, 2, P('다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?', J("""
Scientists who study animal behavior have long been careful not to describe animals in human terms.
Saying that a dog feels "guilty" or that a crow is "clever" may seem harmless, but such descriptions can lead researchers to see what they expect rather than what is actually there.
A dog that lowers its head after chewing a shoe may not be feeling guilt at all; it may simply be responding to its owner's angry tone.
__________, the behavior we interpret as guilt might be a reaction to our own behavior rather than a sign of the dog's moral awareness.
For this reason, researchers try to explain animal behavior in the simplest terms possible before assuming complex mental states.
This caution has served science well, but some researchers now argue that it can go too far.
If we refuse even to consider that animals might have emotions, we may overlook genuine similarities between their minds and ours.
The challenge is to remain open to such possibilities while demanding solid evidence before accepting them.
""")),
  'In other words',
  ['Nevertheless', 'For instance', 'Otherwise', 'Likewise'],
  ['빈칸 앞: 신발을 씹은 뒤 고개를 숙이는 개는 죄책감이 아니라 «주인의 화난 말투에 반응하는» 것일 수 있다.',
   '빈칸 뒤: 우리가 죄책감으로 해석하는 행동은 개의 도덕의식이 아니라 «우리 자신의 행동에 대한 반응»일 수 있다 — 앞 문장을 더 일반적인 말로 «바꾸어 말한» 것이므로 In other words(다시 말해)가 알맞다.',
   'Nevertheless(그럼에도 불구하고)·Otherwise(그렇지 않으면)는 논리가 맞지 않고, 빈칸 뒤 문장은 새로운 예시(For instance)나 비슷한 다른 사례(Likewise)가 아니라 같은 내용의 재진술이다.'])

q(T, 3, P('다음 글의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?', J("""
Open-plan offices, with their rows of desks and absence of walls, were supposed to bring workers together.
Designers argued that removing physical barriers would encourage people to talk more, share ideas freely, and collaborate on projects, while also saving companies money on office space.
(A) __________, the results have often been disappointing.
Studies have found that when companies moved from private offices to open spaces, face-to-face conversations actually decreased, while the number of emails and online messages increased.
Workers who felt constantly watched and overheard tended to put on headphones and avoid interaction, creating their own private spaces in the only way they could.
(B) __________, the noise and visual distractions of an open office made it harder for many employees to concentrate on tasks that required deep focus.
None of this means that open offices should be abandoned entirely.
Rather, it suggests that people need a variety of spaces: open areas for casual meetings and quiet rooms where they can think without interruption.
""")),
  'However …… In addition',
  ['However …… In contrast', 'Therefore …… In addition', 'Therefore …… For example', 'Similarly …… In contrast'],
  ['(A) 앞: 벽을 없애면 대화와 협업이 늘 것이라는 «기대». (A) 뒤: 결과는 종종 실망스러웠다 — 기대와 반대이므로 However.',
   '(B) 앞: 대면 대화가 줄고 헤드폰을 쓰며 교류를 피했다는 «첫 번째 문제». (B) 뒤: 소음과 시각적 방해로 집중이 어려워졌다는 «두 번째 문제» — 같은 방향의 내용을 덧붙이므로 In addition(게다가).',
   'In contrast는 반대되는 내용을 이끌 때, For example은 앞 내용의 예를 들 때 쓰므로 (B)에 맞지 않고, Therefore·Similarly는 (A)의 역접 관계와 맞지 않는다.'])

q(T, 3, P('다음 글의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?', J("""
Satellite navigation has made getting lost almost a thing of the past.
With a smartphone in hand, we can find our way through an unfamiliar city without ever looking at a paper map or asking a stranger for directions.
This convenience, however, may come at a cost to our own sense of direction.
When we follow step-by-step instructions, we pay little attention to landmarks, directions, or the overall layout of the area.
(A) __________, a driver who has used a navigation app to reach the same destination many times may still be unable to get there without it.
Some researchers suggest that the brain regions involved in forming mental maps are less active when we simply follow directions.
(B) __________, few people would be willing to give up the benefits of navigation technology, and there is no need to.
The solution may be to use it more actively: studying the route before setting out, noticing landmarks along the way, and occasionally trying to find the way without help.
""")),
  'For example …… Nevertheless',
  ['For example …… Therefore', 'In contrast …… Nevertheless', 'In contrast …… Moreover', 'Similarly …… Therefore'],
  ['(A) 앞: 단계별 안내를 따라가면 주변 지형지물·방향·배치에 거의 주의를 기울이지 않는다. (A) 뒤: 같은 목적지에 앱으로 여러 번 간 운전자가 앱 없이는 여전히 못 간다 — 앞 내용의 «구체적 사례»이므로 For example.',
   '(B) 앞: 길 찾기 기술이 방향 감각과 뇌 활동에 불리할 수 있다는 «단점». (B) 뒤: 그래도 그 이점을 포기하려는 사람은 거의 없고 그럴 필요도 없다 — 앞 내용을 인정하면서 반대 방향으로 가므로 Nevertheless(그럼에도 불구하고).',
   'Therefore를 넣으면 «단점이 있으니 포기할 사람이 없다»는 어긋난 인과가 되고, In contrast는 (A) 뒤가 앞과 대조되는 내용이 아니므로 맞지 않는다.'])

q(T, 4, P('다음 글의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?', J("""
Modern agriculture relies heavily on a small number of crop varieties chosen for their high yields.
Farmers across vast regions often plant fields of genetically similar plants, which makes planting, harvesting, and selling far more efficient.
This efficiency, however, carries a hidden risk.
When every plant in a region shares the same genes, the plants also share the same weaknesses.
(A) __________, a disease that can attack one plant can attack them all.
History offers a painful example.
In Ireland in the 1840s, much of the population depended on potatoes, and most of those potatoes belonged to a very small number of varieties.
When a plant disease arrived, it spread rapidly through the fields, contributing to a famine in which around a million people died.
(B) __________, fields planted with many different varieties are far less vulnerable, since a disease that destroys one variety may leave the others untouched.
For this reason, scientists stress the importance of preserving crop diversity, even when it seems less efficient in the short term.
""")),
  'In other words …… By contrast',
  ['In other words …… Similarly', 'Nevertheless …… By contrast', 'For example …… Similarly', 'Nevertheless …… As a result'],
  ['(A) 앞: 한 지역의 모든 작물이 같은 유전자를 가지면 같은 약점도 공유한다. (A) 뒤: 한 식물을 공격할 수 있는 병은 모든 식물을 공격할 수 있다 — «같은 약점을 공유한다»를 구체적으로 풀어 «바꾸어 말한» 것이므로 In other words. 앞뒤가 같은 방향이므로 역접의 Nevertheless는 들어갈 수 없다.',
   '(A) 뒤 문장은 특정 사례가 아니라 일반적 진술이고, 구체적 사례(아일랜드)는 다음 문장 「History offers a painful example.」에서 따로 제시되므로 For example은 알맞지 않다.',
   '(B) 앞: 소수 품종에 의존한 아일랜드의 감자 기근. (B) 뒤: 여러 품종을 심은 밭은 훨씬 덜 취약하다 — 앞과 «대조»되므로 By contrast. Similarly(마찬가지로)·As a result(그 결과)는 대조 관계를 나타내지 못한다.'])

q(T, 5, P('다음 글의 빈칸 (A), (B), (C)에 들어갈 말로 가장 적절한 것은?', J("""
When something goes wrong in a hospital or a factory, the natural response is to find the person responsible and punish them.
This seems fair, and it appears to discourage carelessness.
(A) __________, organizations that rely heavily on blame often become less safe over time.
Workers who fear punishment tend to hide their mistakes, and small errors that could have warned of a larger problem go unreported until disaster strikes.
The aviation industry learned this lesson early.
(B) __________ punishing pilots for every error, many airlines and regulators encourage them to report mistakes and near misses, often with protection from penalties.
These reports are collected and analyzed, revealing weaknesses in equipment, training, or procedures that no single pilot could have noticed alone.
(C) __________, a mistake made by one person becomes a lesson for the entire system.
This approach does not mean that reckless behavior is ignored; deliberate violations are still punished.
But honest errors are treated as information rather than as crimes.
""")),
  'However …… Instead of …… In this way',
  ['However …… In addition to …… In this way',
   'Therefore …… Instead of …… Nevertheless',
   'However …… Instead of …… Nevertheless',
   'Therefore …… In addition to …… In this way'],
  ['(A) 앞: 책임자를 찾아 처벌하는 것은 공정해 보이고 부주의를 막는 것 같다. (A) 뒤: 비난에 크게 의존하는 조직은 오히려 덜 안전해진다 — 기대와 반대되는 결과이므로 However.',
   '(B) 뒤: 조종사를 오류마다 처벌하는 «대신» 실수와 아차 사고를 보고하도록 장려한다 — Instead of(~하는 대신에). In addition to(~에 더하여)를 넣으면 처벌도 하면서 보고도 장려한다는 뜻이 되어, 처벌하지 않고 정보로 다룬다는 글의 흐름과 어긋난다.',
   '(C) 앞: 보고를 모아 분석해 개인은 알아챌 수 없던 약점을 찾아낸다. (C) 뒤: 한 사람의 실수가 시스템 전체의 교훈이 된다 — 앞 과정을 정리하는 In this way(이런 식으로). Nevertheless는 앞과 반대되는 내용을 이끌 때 쓰므로 맞지 않는다.'])


# ══════════════════════════════════════════════════════════════
# u0m3s0t0 독해/빈칸·의미 추론/빈칸 추론/빈칸에 들어갈 말(단어)
# ══════════════════════════════════════════════════════════════
T = 'u0m3s0t0'
발 = '다음 빈칸에 들어갈 말로 가장 적절한 것은?'

q(T, 1, P(발, J("""
A word on its own often means very little.
The word "light," for example, might describe the weight of a bag, the brightness of a room, or the color of a shirt, and only the surrounding sentence tells us which meaning is intended.
The same is true of actions.
A raised hand might be a greeting, a question in a classroom, or a signal for a taxi to stop.
Even facts can be misleading when they are separated from their surroundings.
A report that crime rose by fifty percent sounds alarming, but if the number of crimes increased from two to three, the change is hardly worth worrying about.
In each case, understanding depends on __________.
Readers, listeners, and citizens who want to judge information wisely should therefore ask not only what was said but also where, when, and why it was said.
A quotation cut from a longer speech, a photograph cropped to remove its background, or a statistic presented without comparison can all mislead, even when every detail in it is technically true.
""")),
  'context',
  ['memory', 'speed', 'authority', 'vocabulary'],
  ['낱말 light(무게·밝기·색)는 «주변 문장»이, 든 손(인사·질문·택시)은 «상황»이, 50% 증가라는 수치는 «비교 대상(2건→3건)»이 있어야 뜻이 정해진다.',
   '빈칸 뒤에서도 «어디서, 언제, 왜» 말했는지를 물으라고 하고, 잘라 낸 인용·배경을 없앤 사진·비교 없는 통계가 오해를 부른다고 한다. 따라서 이해는 «맥락(context)»에 달려 있다.',
   'vocabulary(어휘)는 light 예에만 걸치고 행동·통계 사례를 설명하지 못한다. 기억·속도·권위는 글과 관계가 없다.'])

q(T, 2, P(발, J("""
Why do people line up for hours to buy a limited-edition pair of sneakers, or rush to a store that advertises "only three items left"?
The answer lies in a simple principle: we tend to value things more when they are hard to get.
Marketers use this tendency constantly.
They announce that a sale ends at midnight, that only a few seats remain, or that a product will never be made again.
Such messages make us fear that we will miss an opportunity, and this fear often pushes us to buy before we have had time to think carefully.
Interestingly, an object can also seem more attractive simply because others want it too, since competition signals that it must be worth having.
In one sense, this reaction once made good sense: in the past, resources that were rare were often truly valuable.
But in modern markets, where limits are frequently created on purpose, it can lead us to spend money on things we do not need.
Recognizing when __________ is being used to influence us is the first step toward making calmer, wiser decisions.
""")),
  'scarcity',
  ['quality', 'honesty', 'variety', 'tradition'],
  ['핵심 원리: 「we tend to value things more when they are hard to get(우리는 얻기 어려운 것을 더 가치 있게 여기는 경향이 있다)」.',
   '한정판 운동화, «세 개 남음», 자정에 끝나는 할인, 몇 자리 남지 않은 좌석, 다시는 만들지 않는 제품 — 모두 «희소성(scarcity)»을 내세운 마케팅이다. 현대 시장에서는 그 한정이 일부러 만들어진다고 경고한다.',
   '품질(quality)은 오히려 희소성 때문에 판단이 흐려지는 대상이며, 정직·다양성·전통은 글의 사례와 관계가 없다.'])

q(T, 3, P(발, J("""
It seems natural to assume that creativity flourishes when people are given complete freedom.
Yet artists, designers, and writers often find the opposite to be true.
Faced with a blank page and unlimited options, many people struggle to begin at all, because every possible direction seems equally open and none seems more promising than another.
Limits, by contrast, give the mind something to push against.
A poet who must follow a strict rhyme scheme is forced to search for unexpected words, and in doing so may discover images that would never have occurred to her otherwise.
An engineer working with a tight budget may invent a simpler, more elegant solution than one who could afford any material.
Even children's games show this pattern: a game becomes interesting precisely because of the rules that restrict what players can do.
Creativity, then, is not the absence of __________ but often a response to them, and those who want to encourage it might do better to set clear challenges than to remove every restriction.
""")),
  'constraints',
  ['resources', 'mistakes', 'rewards', 'emotions'],
  ['통념(완전한 자유가 창의성을 꽃피운다)과 달리, 필자는 「Limits ~ give the mind something to push against.(제약은 마음이 맞서 밀어낼 무언가를 준다.)」고 말한다.',
   '엄격한 운율 규칙을 따르는 시인, 빠듯한 예산의 기술자, 규칙이 있어 재미있는 놀이 — 모두 «제약(constraints)»이 창의성을 낳은 예이다. 빈칸 뒤 「a response to them」「remove every restriction」도 같은 말을 가리킨다.',
   'resources(자원)를 넣으면 «자원이 없음이 아니라 자원에 대한 반응»이 되어, 빠듯한 예산의 기술자 예와 정반대가 된다.'])

q(T, 3, P(발, J("""
Not every decision deserves the same amount of time and care.
Some choices, such as selling a family home or choosing a career, are difficult to undo; once made, they commit us to a path that may last for years.
Others, such as trying a new restaurant, testing a new study method, or rearranging a schedule, can easily be changed if they do not work out.
The mistake many people make is treating all decisions as if they belonged to the first group.
They gather information endlessly, weigh every possible outcome, and delay acting for fear of choosing wrongly, even when the stakes are low.
As a result, they lose time and miss chances to learn from experience.
A more sensible approach is to ask a simple question before deciding: can this choice be undone?
If the answer is yes, it is usually better to decide quickly, observe what happens, and adjust as needed.
Careful deliberation should be saved for choices that are not __________, where a mistake cannot easily be corrected.
""")),
  'reversible',
  ['profitable', 'enjoyable', 'personal', 'frequent'],
  ['글은 결정을 «되돌리기 어려운 것»(집 팔기·진로 선택)과 «쉽게 바꿀 수 있는 것»(새 식당·공부법·일정)으로 나누고, 판단 기준으로 「can this choice be undone?(이 선택은 되돌릴 수 있는가?)」을 제시한다.',
   '되돌릴 수 있으면 빨리 결정하고 조정하라고 했으므로, 신중한 숙고는 «되돌릴 수 없는(not reversible)» 선택, 즉 「실수를 쉽게 바로잡을 수 없는」 선택에 아껴 두어야 한다.',
   '빈칸 뒤 관계절 「where a mistake cannot easily be corrected」가 빈칸의 뜻을 풀어 준다. 이익·즐거움·개인적 성격·빈도는 글의 구분 기준이 아니다.'])

q(T, 4, P(발, J("""
Designers of apps and websites have long worked to remove every obstacle between users and their goals.
A purchase that once required filling out several forms can now be completed with a single tap, and videos begin playing automatically before we have decided to watch them.
In many cases, this smoothness is welcome.
But some designers have begun to argue that a little __________ can be valuable.
When an action is too easy, we may do it without thinking: buying something we do not need, sending a message we later regret, or watching episode after episode late into the night.
Adding a small step, such as a confirmation screen or a short delay before an angry email is sent, gives us a moment to reconsider.
Some banking apps, for example, ask users to wait briefly before completing large transfers to unfamiliar accounts, a pause that can prevent costly mistakes and even fraud.
The goal is not to make technology frustrating but to place difficulty where it helps us act more deliberately.
""")),
  'friction',
  ['speed', 'automation', 'convenience', 'entertainment'],
  ['앞부분: 설계자들은 사용자와 목표 사이의 «모든 장애물을 없애» 왔다(한 번 탭하면 결제, 자동 재생). 빈칸 문장은 But으로 이를 뒤집는다.',
   '뒷부분: 확인 화면, 화난 이메일 발송 전 짧은 지연, 큰 송금 전 잠깐 기다리기처럼 «작은 단계·어려움»을 일부러 더하면 다시 생각할 틈이 생긴다. 마지막 문장 「place difficulty where it helps us」 — 따라서 약간의 «마찰(friction)»이 가치 있을 수 있다.',
   'speed·automation·convenience는 글쓴이가 반성하는 «매끄러움» 쪽 낱말이라 정반대이다.'])

q(T, 5, P(발, J("""
Politicians who change their positions are often accused of weakness, and in everyday life we tend to admire people who stick to their views.
Consistency seems to signal strong character, while changing one's mind suggests confusion or a lack of principles.
Yet this admiration can lead us astray.
The world changes, new evidence appears, and arguments that once seemed convincing are sometimes shown to be wrong.
A person who never revises an opinion in the face of such developments is not displaying strength; he or she is simply ignoring information.
Scientists offer a useful model here.
A good researcher holds conclusions firmly enough to act on them, but loosely enough to abandon them when the data demand it.
In fields where knowledge advances quickly, a willingness to say "I was wrong" is not a failure but a sign that thinking is still taking place.
Perhaps, then, we should reconsider the standards we use to judge one another.
In a world of changing evidence, a certain degree of __________ may be the mark of an honest mind rather than a weak one.
""")),
  'inconsistency',
  ['stubbornness', 'certainty', 'loyalty', 'silence'],
  ['통념: 일관성(consistency)은 강한 성격, 생각을 바꾸는 것은 혼란·원칙 없음의 표시로 여겨진다. 필자는 「Yet this admiration can lead us astray.(그러나 이런 존경은 우리를 잘못 이끌 수 있다.)」로 이를 뒤집는다.',
   '새 증거 앞에서 의견을 절대 바꾸지 않는 것은 강함이 아니라 정보를 무시하는 것이고, 「I was wrong」이라고 말할 수 있는 것은 생각이 계속되고 있다는 표시이다. 따라서 «어느 정도의 비일관성(inconsistency)», 즉 생각을 바꾸는 것이 약한 마음이 아니라 «정직한 마음»의 표시일 수 있다.',
   'stubbornness(고집)·certainty(확신)는 필자가 비판하는 태도이다. 글 초반의 consistency가 부정적으로 뒤집힌다는 점을 잡아야 하는 고난도 문항이다.'])


# ══════════════════════════════════════════════════════════════
# u0m3s1t1 독해/빈칸·의미 추론/의미 추론/함축적 의미
# ══════════════════════════════════════════════════════════════
T = 'u0m3s1t1'
발 = '굵은 글씨로 표시한 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?'

q(T, 1, P(발, J("""
Parents and teachers often find themselves spending most of their energy on children's misbehavior.
A child who interrupts, throws toys, or refuses to share quickly receives attention, while a child who plays quietly and cooperates is left alone.
The intention is good: adults want to correct problems before they grow.
Yet for many children, attention of any kind is a powerful reward.
When scolding is the surest way to be noticed, some children learn to misbehave more, not less.
In this sense, adults who respond only to bad behavior may be **watering the weeds** in a garden they hope to keep tidy.
A more effective strategy is to notice and comment on good behavior as it happens, praising a child for waiting patiently or for helping a friend.
Behavior that receives attention tends to grow, whatever that behavior may be.
Adults who want to see more kindness and cooperation, therefore, should make sure that these qualities, rather than their opposites, are what earn a child the spotlight.
""")),
  'encouraging the very behavior they want to reduce',
  ['ignoring the needs of children who behave well',
   'punishing children too harshly for small mistakes',
   'teaching children how to take care of nature',
   'spending too little time with their children'],
  ['잡초(weeds) = 없애고 싶은 나쁜 행동, 물 주기(watering) = 관심 주기. 「Behavior that receives attention tends to grow(관심을 받는 행동은 자라는 경향이 있다)」 — 나쁜 행동에만 반응하면 그 행동이 오히려 자란다.',
   '따라서 「줄이고 싶은 바로 그 행동을 부추기는 것」이 뜻이다.',
   '매력적 오답 「얌전한 아이의 필요를 무시하는 것」: 글에 얌전한 아이가 내버려진다는 말은 있지만, 밑줄 부분은 «나쁜 행동이 자라게 하는 것»을 비유한다.'])

q(T, 2, P(발, J("""
When exams approach, many students cut back on sleep to find more hours for studying.
Staying up until three in the morning seems like a sensible trade: a few hours of rest in exchange for a few more chapters reviewed.
But sleep is not idle time.
During sleep, the brain strengthens and organizes the memories formed during the day, and without enough of it, much of what was studied is less likely to be retained.
The tired student also pays the next day, struggling to concentrate and making careless mistakes that more rest would have prevented.
The hours gained at night, then, are not really gained at all; they are **borrowed from tomorrow at a high rate of interest**.
What looks like extra study time on the clock often turns into less learning in the mind.
Many students discover this only after an exam goes worse than they expected.
Those who protect their sleep, even during busy periods, usually find that the hours they spend studying become far more productive.
""")),
  'gaining time now at a greater cost to later performance',
  ['saving time now in order to relax during exams',
   'studying the next day\'s material in advance',
   'paying money for extra lessons at night',
   'using the morning hours for more efficient study'],
  ['잠을 줄여 얻은 밤 시간은 다음 날의 집중력 저하·실수, 기억이 덜 남는 손실로 «더 크게» 갚아야 한다 — 높은 이자를 붙여 내일에서 빌려 온 것과 같다.',
   '따라서 「나중의 수행을 더 큰 대가로 치르며 지금 시간을 얻는 것」이 뜻이다.',
   '「내일 공부할 것을 미리 하는 것」은 borrowed from tomorrow를 글자 그대로 읽은 오답이고, 실제 돈(interest)을 내는 이야기도 아니다.'])

q(T, 3, P(발, J("""
There is an old joke about a man who is searching for his keys under a streetlight late at night.
A passerby offers to help and asks where exactly he dropped them.
"Over there in the park," the man replies.
"Then why are you looking here?" "Because this is where the light is."
The joke is funny because the man's behavior is so obviously foolish, yet serious researchers often do something similar.
It is tempting to study what is easy to measure, such as the number of hours students spend in class, the number of steps a person takes, or the number of clicks a website receives, rather than what actually matters, such as how deeply students understand, how healthy people feel, or how satisfied customers are.
Easy measurements produce neat numbers and clear charts, which makes them attractive.
But when the thing we care about lies somewhere darker and harder to observe, **searching under the streetlight** gives us precise answers to the wrong questions.
""")),
  'focusing on data that is convenient to collect rather than meaningful',
  ['working late at night to finish research on time',
   'asking strangers for help with difficult problems',
   'refusing to admit mistakes made during research',
   'studying topics that the public finds interesting'],
  ['열쇠를 공원에서 잃어버렸는데 «불빛이 있는 곳»에서 찾는 남자처럼, 연구자들은 정말 중요한 것(이해의 깊이·건강·만족) 대신 «재기 쉬운 것»(수업 시간·걸음 수·클릭 수)을 연구하기 쉽다.',
   '따라서 「의미 있는 것이 아니라 모으기 편한 자료에 집중하는 것」이 뜻이다. 마지막 구절 「precise answers to the wrong questions(엉뚱한 질문에 대한 정확한 답)」도 이를 확인한다.',
   '밤늦게 일하기·낯선 사람에게 도움 청하기는 농담 속 겉모습만 따온 오답이다.'])

q(T, 3, P(발, J("""
When a business begins to lose customers, its managers often respond with a flurry of activity.
They redesign the company logo, reorganize departments, rename job titles, and hold long meetings about the color of the new website.
All of this creates a comforting sense that something is being done.
Yet if customers are leaving because the product itself no longer meets their needs, none of these changes will make any difference.
Such efforts resemble **rearranging the deck chairs on a sinking ship**: they keep people busy and make the surface look orderly, while the real danger continues to grow below.
Facing the fundamental problem is harder.
It may require admitting that a once-successful product has become outdated, abandoning plans that took years to develop, or investing heavily in something new and uncertain.
Because such steps are painful, it is tempting to focus on minor adjustments that can be completed quickly.
But activity is not the same as progress, and an organization that confuses the two may not realize its mistake until it is too late.
""")),
  'making minor changes that ignore the fundamental problem',
  ['preparing carefully for an unexpected emergency',
   'improving the comfort of loyal customers',
   'replacing leaders in order to solve a crisis',
   'reducing costs by closing unnecessary departments'],
  ['가라앉는 배(= 제품이 더는 고객의 필요를 채우지 못해 고객이 떠나는 회사)에서 갑판 의자를 다시 배열하는 것(= 로고·부서·직함·웹사이트 색 바꾸기)은 바쁘고 겉보기엔 정돈되어 보이지만 진짜 위험을 해결하지 못한다.',
   '따라서 「근본적인 문제를 외면한 채 사소한 변화만 주는 것」이 뜻이다. 「activity is not the same as progress(활동은 진전과 같지 않다)」가 이를 확인한다.',
   '부서 재편이 언급되지만 비용 절감이 목적이라는 말은 없고, 의자(chairs)를 고객의 편안함으로 읽는 것도 글자에 얽매인 오답이다.'])

q(T, 4, P(발, J("""
There is an old saying that if you want to know what water is, you should not ask a fish.
The fish has lived in water its whole life and has never experienced anything else, so water is simply the way the world is.
Culture works in much the same way for human beings.
The customs, values, and assumptions we grow up with feel less like choices than like facts of nature: of course people greet each other this way, of course children are raised like this, of course this is how time should be spent.
Only when we encounter people who do things differently do these hidden assumptions come into view.
A student who studies abroad, for example, often returns home seeing her own society with new eyes, noticing habits she had never questioned before.
In this sense, traveling to another culture is less about learning what others are like than about finally seeing **the water we have always been swimming in**.
The discomfort of such encounters, then, may be one of their greatest gifts.
""")),
  'the unquestioned assumptions of one\'s own culture',
  ['the difficulties of adjusting to a foreign country',
   'the natural environment of one\'s hometown',
   'the knowledge gained by studying abroad',
   'the common values shared by all human beings'],
  ['물고기에게 물은 너무 당연해서 보이지 않듯, 우리가 자라며 익힌 관습·가치·가정은 «선택이 아니라 자연의 사실»처럼 느껴진다.',
   '다른 문화를 만나야 이 «숨은 가정(hidden assumptions)»이 보인다. 따라서 「늘 헤엄쳐 온 물」은 「자기 문화의, 한 번도 의문을 품지 않은 가정들」을 뜻한다.',
   '매력적 오답 「유학으로 얻은 지식」: 필자는 여행이 «남이 어떤지 배우는 것»보다 «자기 것을 보는 것»이라고 했다. 「모든 인류가 공유하는 가치」는 문화마다 다르다는 글의 전제와 어긋난다.'])

q(T, 5, P(발, J("""
In one of Arthur Conan Doyle's stories, Sherlock Holmes solves a mystery by noticing something that did not happen.
A valuable racehorse has disappeared from its stable at night, yet the guard dog, according to witnesses, remained silent.
Holmes realizes that the dog would certainly have barked at a stranger, so the person who took the horse must have been someone the dog knew well.
The detective's insight lay in paying attention to an absence.
Most of us find this remarkably difficult.
We naturally focus on what is in front of us, such as the events that occurred, the data that were collected, and the people who spoke up, and we rarely ask what is missing.
A company that surveys its customers hears only from those who stayed, not from those who quietly left.
A study of successful entrepreneurs tells us little if it ignores the many who used the same strategies and failed.
Good thinkers, like good detectives, train themselves to listen for **the dog that did not bark**, because what is absent can be as revealing as what is present.
""")),
  'evidence that lies in what failed to happen or appear',
  ['warnings that are ignored because they are too loud',
   'clues that only trained experts are able to notice',
   'information hidden on purpose by dishonest people',
   'events that happen too quietly to be recorded'],
  ['홈스는 개가 «짖지 않았다»는 사실, 즉 일어나지 않은 일에서 범인이 개가 잘 아는 사람이라는 결론을 끌어냈다. 「The detective\'s insight lay in paying attention to an absence.(탐정의 통찰은 부재에 주의를 기울인 데 있었다.)」',
   '떠난 고객(설문에 없음), 같은 전략으로 실패한 사람들(연구에서 빠짐)도 «빠져 있는 것»이 드러내는 정보의 예이다. 따라서 「일어나지 않았거나 나타나지 않은 것에 담긴 증거」가 뜻이다.',
   '매력적 오답 「너무 조용히 일어나 기록되지 않은 사건」: 핵심은 조용히 «일어난» 일이 아니라 «일어나지 않은» 일이다. 「전문가만 알아채는 단서」는 필자가 누구나 훈련하라고 한 태도와 다르고, 의도적으로 숨긴 정보라는 말도 없다.'])



# ══════════════════════════════════════════════════════════════
# u1m0s1t0 어법·어휘/어법/틀린 것 고르기/밑줄 친 부분 중 어법상 틀린 것
# ══════════════════════════════════════════════════════════════
T = 'u1m0s1t0'
발 = '다음 글의 굵은 글씨로 표시한 ⓐ~ⓔ 중, 어법상 틀린 것은?'

qf(T, 1, P(발, J("""
Many people assume that the most productive workers are those who stay at the office the longest.
However, research on work habits ⓐ**suggests** that long hours do not necessarily lead to better results.
After a certain point, fatigue causes people ⓑ**to make** more mistakes, and the time spent correcting those mistakes can cancel out the benefits of working longer.
Long hours may look impressive, but they often hide a great deal of wasted effort.
Workers who take regular breaks, by contrast, often return to their tasks with renewed energy and ⓒ**sharper** focus.
Some companies have even experimented with shorter workweeks, and several of them ⓓ**has reported** that productivity stayed the same or even improved.
Rest, in other words, is not the opposite of work but part of it.
Of course, not every job can be shortened so easily, but the lesson is clear: what matters is not how long we work but how well we use the time ⓔ**that** we have.
""")), F, 3,
   ['ⓓ 주어는 several of them(그중 몇몇 회사)으로 «복수»이다. 따라서 has reported가 아니라 have reported가 되어야 한다.',
    'ⓐ 주어 research(불가산, 단수) → suggests(○). ⓑ cause + 목적어 + to부정사 → to make(○).',
    'ⓒ 명사 focus를 꾸미는 형용사 비교급 sharper(○). ⓔ 선행사 the time을 꾸미는 목적격 관계대명사 that(○, we have the time).'])

qf(T, 2, P(발, J("""
Honeybees are famous for making honey, but their most important contribution to human life ⓐ**are** pollination.
As bees move from flower to flower collecting nectar, they carry pollen ⓑ**that** allows many plants to produce fruits and seeds.
Without this service, many fruits and vegetables would become scarce and far more expensive.
Many of the crops we eat, from apples to almonds, ⓒ**depend** at least partly on insects like bees.
In some farming regions, bees are in such high demand that growers rent hives and have them transported by truck to their orchards during the flowering season.
In recent decades, however, bee populations in many regions have declined, a trend ⓓ**caused** by a combination of disease, pesticide use, and the loss of natural habitats.
Protecting bees therefore means more than saving a single species; it means protecting the food supply ⓔ**on which** millions of people rely.
Planting flowers that bloom at different times of the year is one simple way that ordinary people can help.
""")), F, 0,
   ['ⓐ 주어의 핵심은 contribution(단수)이다. to human life는 수식어일 뿐이므로 are가 아니라 is가 되어야 한다. (주격 보어 pollination도 단수)',
    'ⓑ 선행사 pollen을 받는 주격 관계대명사 that(○). ⓒ Many of the crops(복수) → depend(○).',
    'ⓓ a trend를 뒤에서 꾸미는 과거분사 caused(추세가 «야기된» 것, 수동 ○). ⓔ rely on the food supply → 전치사+관계대명사 on which(○).'])

qf(T, 3, P(발, J("""
Before the invention of the printing press, books in Europe were copied by hand, a process that could take months for a single volume.
As a result, books were rare and expensive, and reading was a skill ⓐ**possessed** by only a small part of the population.
The printing press, developed in Europe in the fifteenth century, changed this situation dramatically.
Once texts could be reproduced quickly and cheaply, ideas ⓑ**that** had once been available only to scholars began to reach ordinary people.
Pamphlets and newspapers spread news across great distances, ⓒ**allowed** people in different cities to follow the same events and debates.
Some historians argue that without this technology, movements such as the Scientific Revolution would have developed far more slowly.
It is no exaggeration to say that the printing press ⓓ**helped** create the modern world, ⓔ**shaping** the way we communicate, learn, and think to this day.
Every time we share an article online, we are continuing a revolution that began with those early printed pages.
""")), F, 2,
   ['ⓒ 문장의 동사는 이미 spread이고, 콤마 뒤는 주절에 이어지는 분사구문이어야 한다. 뉴스를 퍼뜨린 것이 사람들이 사건을 따라갈 수 있게 «한» 것(능동)이므로 allowed가 아니라 allowing이 되어야 한다.',
    'ⓐ a skill을 꾸미는 과거분사(기술이 «소유된», 수동 ○). ⓑ 선행사 ideas를 받는 주격 관계대명사 that(○).',
    'ⓓ help + 동사원형(create) 구조의 과거형 helped(○). ⓔ 주절 뒤의 능동 분사구문 shaping(인쇄기가 방식을 «형성하며» ○).'])

qf(T, 3, P(발, J("""
Humans appear to be the only animals that cry emotional tears.
Scientists have long wondered why this should be so.
Other animals produce tears to keep their eyes moist, but only humans seem to cry ⓐ**when** they feel sad, happy, or deeply moved.
One theory suggests that emotional tears serve a social function.
Because tears blur vision and are difficult to fake, they may act as an honest signal ⓑ**that** the person crying needs help or comfort.
In one study, people shown photographs of faces with tears ⓒ**judged** those faces as sadder than the same faces with the tears digitally removed.
In this sense, crying may be less about ⓓ**expressing** emotions to ourselves than about communicating them to others.
Tears, it seems, do ⓔ**which** words sometimes cannot: they turn a private feeling into a message that others can instantly read.
Perhaps this is why a friend's tears can move us even when no words are spoken at all.
""")), F, 4,
   ['ⓔ do의 목적어 자리이면서 뒤의 words sometimes cannot (do)의 목적어 역할도 해야 하므로, 선행사를 포함한 관계대명사 what(~하는 것)이 필요하다. 앞에 선행사가 없으므로 which는 틀리다.',
    'ⓐ 때를 나타내는 접속사 when(○). ⓑ a signal의 내용을 설명하는 동격의 접속사 that(○, 뒤가 완전한 문장).',
    'ⓒ 주어 people(shown ~ tears는 수식어)의 동사, 과거 시제 judged(○). ⓓ 전치사 about 뒤의 동명사 expressing(○, communicating과 병렬).'])

qf(T, 4, P(발, J("""
Why do some ideas spread rapidly while others, ⓐ**equally** valuable, are quickly forgotten?
The answer often ⓑ**lays** not in the quality of the idea itself but in how easily it can be passed from one person to another.
Ideas that are simple, concrete, and connected to strong emotions are far more likely to be remembered and retold.
A vague statement such as "exercise is good for you" rarely sticks, ⓒ**whereas** a vivid story about a grandmother who ran her first marathon at seventy is shared again and again.
Advertisers, politicians, and storytellers have long understood this.
It also explains why skilled teachers so often rely on examples and stories: they know that an idea must first be ⓓ**understood** before it can be accepted.
Those who want their ideas to spread, therefore, should spend as much effort on how they present them as on ⓔ**developing** the ideas in the first place.
A brilliant idea that no one remembers, after all, cannot change anything.
""")), F, 1,
   ['ⓑ 「~에 있다」는 자동사 lie(lie-lay-lain)이다. lay는 「~을 놓다」라는 타동사(lay-laid-laid)이고 목적어가 없으므로, 3인칭 단수 현재형 lies가 되어야 한다.',
    'ⓐ 형용사 valuable을 꾸미는 부사 equally(○). ⓒ 대조를 나타내는 접속사 whereas(○, 뒤가 완전한 절).',
    'ⓓ 생각이 «이해되는» 것이므로 수동 be understood(○). ⓔ 전치사 on 뒤의 동명사 developing(○, on how they present them과 병렬).'])

qf(T, 5, P(발, J("""
Imagine a town that, for centuries, drew all of its water from a single river flowing past its walls.
As the population grew, ⓐ**so did** the demand for water, and eventually the river could barely meet the needs of the residents.
ⓑ**Had** the town's leaders planned ahead, they might have built reservoirs while land was still cheap.
Instead, they waited, assuming that the river would always provide ⓒ**what** the town required.
Warnings from engineers were politely noted and then forgotten.
Only after a severe drought left thousands without clean water ⓓ**the leaders recognized** the danger of relying on a single source.
They quickly began building reservoirs and pipelines, a project so costly that ⓔ**it** took more than thirty years to pay off.
The lesson of this imaginary town applies to many real systems today: those that depend on a single source are efficient in good times but fragile in bad ones.
Having more than one source may cost more, but it buys security when it is most needed.
""")), F, 3,
   ['ⓓ 「Only + 부사절」이 문장 앞에 오면 주절의 주어와 동사가 도치된다. 따라서 the leaders recognized가 아니라 did the leaders recognize가 되어야 한다.',
    'ⓐ 「so + 대동사 + 주어」(~도 그러했다): the demand grew → so did the demand(○). ⓑ If the town\'s leaders had planned ahead에서 if를 생략하고 도치한 가정법 과거완료 Had(○, 주절 might have built와 호응).',
    'ⓒ provide의 목적어이자 required의 목적어 역할을 하는, 선행사를 포함한 관계대명사 what(○). ⓔ 「so ~ that」 구문에서 that절의 주어 it = a project(○).'])


# ══════════════════════════════════════════════════════════════
# u1m0s2t0 어법·어휘/어법/어법 서술형/어법에 맞게 고쳐 쓰기 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u1m0s2t0'

s(T, 1, '다음 두 문장의 괄호 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오.\n\n'
        '(1) Each of the participants (be) given a short questionnaire before the experiment began.\n'
        '(2) The data (collect) last year were analyzed by a team of experts.',
  '(1) was (had been도 정답)  (2) collected  [채점 포인트] 두 개 모두 맞아야 정답. (1)을 were로 쓰면 오답.',
  ['(1) 「Each of + 복수명사」는 단수 취급한다. 실험이 시작되기 전(before the experiment began)의 일이므로 과거 단수 was. (해석: 실험이 시작되기 전에 참가자 각자에게 짧은 설문지가 주어졌다.)',
   '(2) 문장의 동사는 were analyzed이고, (collect)는 주어 The data를 꾸미는 말이다. 데이터는 «수집된» 것이므로 과거분사 collected. (해석: 작년에 수집된 데이터는 전문가 팀이 분석했다.)'], essay=True)

s(T, 2, '다음 글의 괄호 (A), (B) 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오.\n\n'
        'The museum, (A)(build) more than a century ago, still attracts thousands of visitors every year. '
        'Standing in its main hall, visitors can\'t help (B)(feel) small beneath the enormous glass ceiling.',
  '(A) built  (B) feeling  [채점 포인트] (A) 과거분사 built, (B) 동명사 feeling 두 개가 모두 맞아야 정답. (B)를 to feel로 쓰면 오답.',
  ['(A) 콤마 사이는 주어 The museum을 보충 설명하는 분사구이다. 박물관은 «지어진» 것이므로 과거분사 built.',
   '(B) can\'t help -ing: 「~하지 않을 수 없다」 → can\'t help feeling.',
   '해석: 100여 년 전에 지어진 그 박물관은 여전히 해마다 수천 명의 방문객을 끌어모은다. 중앙 홀에 서면, 방문객들은 거대한 유리 천장 아래에서 자신이 작다고 느끼지 않을 수 없다.'], essay=True)

s(T, 3, '다음 글의 괄호 (A)~(C) 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오. (필요하면 두 단어 이상으로 쓸 것)\n\n'
        'If I (A)(know) about the traffic jam, I would have left home earlier. Instead, I arrived late and missed the opening speech. '
        'It was the first time that I (B)(be) late for such an important event, and my manager looked (C)(disappoint).',
  '(A) had known  (B) had been  (C) disappointed  [채점 포인트] 세 개가 모두 맞아야 정답. (A)를 knew, (B)를 was, (C)를 disappointing으로 쓰면 오답.',
  ['(A) 주절이 would have left(가정법 과거완료)이므로 if절은 had + p.p. → had known. (해석: 교통 체증에 대해 알았더라면 집을 더 일찍 나섰을 텐데.)',
   '(B) 「It was the first time that ~」에서 that절은 그 시점까지의 경험이므로 과거완료 had been. (It is the first time 뒤에는 현재완료를 쓴다.)',
   '(C) 매니저가 «실망한» 감정을 느끼는 쪽이므로 과거분사 disappointed. disappointing은 «실망시키는» 대상에 쓴다.'], essay=True)

s(T, 3, '다음 글의 괄호 (A), (B) 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오. (필요하면 두 단어 이상으로 쓸 것)\n\n'
        '(A)(Compare) with last year\'s results, this year\'s scores show a clear improvement. '
        'The principal insisted that every teacher (B)(analyze) the data carefully before the next meeting.',
  '(A) Compared  (B) (should) analyze  [채점 포인트] (A) Compared, (B) analyze 또는 should analyze이면 정답. (B)를 analyzes·analyzed로 쓰면 오답.',
  ['(A) 주절의 주어 this year\'s scores는 작년 결과와 «비교되는» 대상이므로 수동의 분사구문 Compared (with ~).',
   '(B) insist가 「~해야 한다고 요구하다」의 뜻일 때 that절에는 (should) + 동사원형을 쓴다 → (should) analyze. 다음 회의 «전에» 해야 할 일을 요구한 것이지 이미 일어난 사실을 주장한 것이 아니다.',
   '해석: 작년 결과와 비교하면, 올해 점수는 뚜렷한 향상을 보여 준다. 교장은 모든 교사가 다음 회의 전에 자료를 꼼꼼히 분석해야 한다고 요구했다.'], essay=True)

s(T, 4, '다음 글의 괄호 (A)~(C) 안에 주어진 말을 어법에 맞게 고쳐 쓰시오.\n\n'
        '(A)(Not know) where to begin, many students spend more time planning how to study than actually studying. '
        'A better strategy is (B)(start) with the easiest task, which builds confidence. '
        'Once the first task is done, the next one seems far less (C)(overwhelm).',
  '(A) Not knowing  (B) to start (또는 starting)  (C) overwhelming  [채점 포인트] 세 개가 모두 맞아야 정답. (A)의 not 위치(Knowing not ✕), (C)의 -ing(과제가 «압도하는» 것)가 핵심.',
  ['(A) 이유를 나타내는 분사구문의 부정은 분사 «앞»에 not을 둔다 → Not knowing (= Because they do not know ~).',
   '(B) be동사 is의 보어 자리이므로 to부정사 to start 또는 동명사 starting 모두 가능하다.',
   '(C) 다음 과제가 사람을 «압도하는» 것이므로 현재분사 overwhelming. overwhelmed는 사람이 압도당한 감정을 나타낼 때 쓴다.',
   '해석: 어디서 시작할지 몰라서, 많은 학생이 실제로 공부하는 것보다 어떻게 공부할지 계획하는 데 더 많은 시간을 쓴다. 더 나은 전략은 가장 쉬운 과제부터 시작하는 것인데, 이는 자신감을 길러 준다. 첫 과제를 끝내면, 다음 과제는 훨씬 덜 버겁게 느껴진다.'], essay=True)

s(T, 5, '다음 글의 괄호 (A)~(E) 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오. (필요하면 두 단어 이상으로 쓸 것)\n\n'
        'Hardly (A)(have) the experiment begun when the power went out. '
        'The researchers, (B)(leave) in complete darkness, had no choice but (C)(wait). '
        'Such (D)(be) their frustration that some of them wanted to give up for the day. '
        'But the longer they waited, the (E)(calm) they became.',
  '(A) had  (B) left  (C) to wait  (D) was  (E) calmer  [채점 포인트] 다섯 개가 모두 맞아야 정답(네 개면 부분 점수). 특히 (A) 도치의 had, (D) 보어 도치에서 주어 their frustration(단수)에 맞춘 was가 핵심.',
  ['(A) 「Hardly + had + 주어 + p.p. ~ when + 과거」(~하자마자 …했다): 부정어 Hardly가 앞에 와서 도치된 과거완료 → had.',
   '(B) 연구자들이 어둠 속에 «남겨진» 것이므로 과거분사 left(수동의 분사구).',
   '(C) have no choice but to + 동사원형(~할 수밖에 없다) → to wait.',
   '(D) 「Such + be + 주어 + that ~」은 Their frustration was such that ~의 보어 도치이다. 주어 their frustration이 단수이고 과거이므로 was.',
   '(E) 「the + 비교급 ~, the + 비교급 …」(~할수록 더 …하다) → the calmer.'], essay=True)


# ══════════════════════════════════════════════════════════════
# u1m1s0t0 어법·어휘/어휘/낱말 쓰임/문맥상 낱말의 쓰임이 적절하지 않은 것
# ══════════════════════════════════════════════════════════════
T = 'u1m1s0t0'
발 = '다음 글의 굵은 글씨로 표시한 ⓐ~ⓔ 중, 문맥상 낱말의 쓰임이 적절하지 «않은» 것은?'

qf(T, 1, P(발, J("""
Our minds are excellent at generating ideas but poor at storing them.
When we try to hold a long list of tasks in our heads, we use up mental energy that could be ⓐ**devoted** to more demanding work.
Worse, unfinished tasks tend to pop up at the wrong moments, ⓑ**improving** our concentration with sudden reminders.
Writing tasks down on paper or in an app can ⓒ**relieve** this burden.
Once a task is recorded in a trusted place, the mind no longer needs to keep ⓓ**reminding** us of it, and we can give our full attention to the work in front of us.
Many people find that this simple habit ⓔ**reduces** stress and even helps them sleep better, since the day's worries have been safely stored outside their heads.
A notebook, in this sense, works like an extension of memory, holding what the mind does not need to carry.
Keeping a list is not a sign of a weak memory but of a wise use of it.
""")), F, 1,
   ['ⓑ 앞의 Worse(더 나쁜 것은)와 「at the wrong moments(엉뚱한 때에)」로 보아, 끝내지 못한 일이 불쑥 떠올라 집중을 «방해한다»는 내용이어야 한다. 따라서 improving(향상시키며)이 아니라 interrupting / disturbing(방해하며)이 알맞다.',
    'ⓐ 더 힘든 일에 «쓰일» 수 있는 에너지(devoted ○). ⓒ 적어 두면 이 부담을 «덜어 준다»(relieve ○).',
    'ⓓ 마음이 더 이상 그 일을 계속 «상기시킬» 필요가 없다(reminding ○). ⓔ 스트레스를 «줄인다»(reduces ○).'])

qf(T, 2, P(발, J("""
Humans are naturally drawn to stories.
From ancient myths to modern advertisements, stories have always been one of our most powerful tools for sharing ideas.
A list of facts about poverty may leave readers ⓐ**unmoved**, while the story of a single child struggling to attend school can inspire people to donate generously.
This tendency has a clear ⓑ**advantage**: stories help us understand complex situations and remember information for a long time.
However, it also has a ⓒ**downside**.
Because a single vivid story can affect us more strongly than statistics describing thousands of people, we may ⓓ**misjudge** the true size of a problem.
A charity that relies only on emotional stories might therefore attract support for causes that are memorable rather than those where help is most needed.
Stories, in other words, are powerful but ⓔ**reliable** guides to where our help should go.
Letting emotion motivate us while allowing data to guide us may be the wisest approach.
""")), F, 4,
   ['ⓔ 바로 앞 문장은 이야기에만 의존하면 «도움이 가장 필요한 곳이 아니라 기억에 남는 곳»에 지원이 몰릴 수 있다고 한다. 따라서 이야기는 강력하지만 «믿을 수 없는» 안내자이다. reliable(믿을 만한)이 아니라 unreliable이 되어야 한다. 역접의 but도 앞의 powerful과 반대되는 부정적 말을 요구한다.',
    'ⓐ 사실의 목록은 독자를 «감동시키지 못한 채» 둔다(unmoved ○). ⓑ 이야기는 이해와 기억을 돕는 «장점»이 있다(○).',
    'ⓒ However로 이어지는 «단점»(○). ⓓ 생생한 이야기 하나 때문에 문제의 실제 규모를 «잘못 판단한다»(○).'])

qf(T, 3, P(발, J("""
When learning a new skill, most people prefer to practice one thing at a time: a basketball player shoots from the same spot again and again, and a math student solves twenty problems of the same type in a row.
This approach, called blocked practice, feels ⓐ**ineffective**, because performance improves quickly during the session.
However, research suggests that mixing different types of problems or skills, known as interleaved practice, often leads to ⓑ**better** long-term results.
Interleaving feels harder and ⓒ**slower**, since learners must constantly figure out which approach each problem requires.
Yet this very difficulty is what makes it ⓓ**valuable**: by choosing a strategy each time, learners develop the ability to recognize problem types, a skill that blocked practice never ⓔ**demands**.
The feeling of fluency during practice, it turns out, can be a poor guide to how much we are actually learning.
Learners who accept a little struggle during practice are often rewarded with deeper and longer-lasting skills.
""")), F, 0,
   ['ⓐ 「because performance improves quickly during the session(연습하는 동안 실력이 빨리 느는 것 같기 때문에)」 — 이유와 맞으려면 한 가지씩 몰아서 하는 연습이 «효과적으로» 느껴진다고 해야 한다. ineffective가 아니라 effective가 알맞다.',
    '이어지는 However(그러나 연구에 따르면 섞어서 하는 연습이 장기적으로 «더 나은» 결과, ⓑ ○)도 «느낌은 효과적이지만 실제로는 아니다»라는 대조를 전제한다.',
    'ⓒ 섞어 하는 연습은 더 어렵고 «느리게» 느껴진다(○). ⓓ 그 어려움이 가치를 만든다(○). ⓔ 몰아서 하는 연습은 문제 유형을 알아보는 능력을 결코 «요구하지» 않는다(○).'])

qf(T, 3, P(발, J("""
Advertisements for new technologies often promise that they will save us time.
Washing machines, microwave ovens, and email were all ⓐ**marketed** as ways to free people from tedious tasks.
In a narrow sense, they ⓑ**delivered** on this promise: washing clothes by machine takes far less effort than washing them by hand.
Few people would want to return to washing by hand, of course.
Yet many people today feel busier than ever.
One reason is that as tasks become easier, our expectations ⓒ**rise**.
Because clothes are easy to wash, we wash them more often; because messages can be sent instantly, we are expected to reply instantly.
The time ⓓ**wasted** by each technology is quickly filled with new demands.
Technology, then, does not automatically give us more free time; it changes the standards by which we measure how much we should do, and those standards tend to ⓔ**expand** to fill the time available.
Understanding this pattern may help us decide more carefully which new demands we are willing to accept.
""")), F, 3,
   ['ⓓ 기술은 좁은 의미에서 시간을 아껴 준다는 약속을 지켰고(ⓑ), 그렇게 «절약된» 시간이 새로운 요구로 금세 채워진다는 흐름이다. wasted(낭비된)가 아니라 saved(절약된)가 알맞다.',
    'ⓐ 지루한 일에서 해방시켜 준다고 «홍보되었다»(○). ⓑ 약속을 «지켰다(deliver on)»(○).',
    'ⓒ 일이 쉬워질수록 기대가 «높아진다»(○ — 더 자주 빨래하고 즉시 답장해야 함). ⓔ 기준은 쓸 수 있는 시간을 채우도록 «늘어난다»(○).'])

qf(T, 4, P(발, J("""
In many cultures, admitting ignorance is seen as a sign of weakness.
Many people would rather guess than admit that they do not know an answer.
Students hesitate to ask questions for fear of looking foolish, and professionals ⓐ**pretend** to understand terms they have never heard.
Yet the ability to say "I don't know" is ⓑ**essential** to learning.
A question reveals exactly where a person's understanding ends, allowing a teacher or colleague to provide the missing piece.
Those who hide their ignorance, by contrast, ⓒ**accelerate** their own progress, since problems that are never admitted can never be solved.
Interestingly, people who are genuinely ⓓ**secure** in their knowledge tend to ask questions more freely, because they are not worried that a single gap will damage their reputation.
Creating an environment where not knowing is ⓔ**acceptable** may therefore be one of the most effective ways to encourage real learning.
Teachers who openly admit what they do not know can set a powerful example for their students.
""")), F, 2,
   ['ⓒ by contrast로 앞의 «질문이 부족한 부분을 채워 준다»와 대조되고, 이유절 「인정하지 않은 문제는 결코 해결될 수 없기 때문에」가 뒤따른다. 따라서 모르는 것을 숨기는 사람은 자신의 발전을 «늦춘다». accelerate(가속하다)가 아니라 slow / hinder / delay가 알맞다.',
    'ⓐ 바보처럼 보일까 봐 들어 본 적 없는 용어를 아는 «척한다»(○). ⓑ 「모른다」고 말하는 능력은 배움에 «필수적»이다(○).',
    'ⓓ 자기 지식에 정말 «자신 있는(secure)» 사람이 더 자유롭게 묻는다(○). ⓔ 모르는 것이 «받아들여지는» 환경(○).'])

qf(T, 5, P(발, J("""
Translation is often described as simply moving meaning from one language to another, but the reality is far more complicated.
Every translation involves choices, and those choices ⓐ**inevitably** reflect the translator's interpretation of the original.
A single word in one language may correspond to several words in another, each carrying slightly different shades of meaning.
When translators select one of these options, they ⓑ**narrow** the range of possible readings that the original allowed.
For this reason, readers who compare several translations of the same poem often find that each ⓒ**illuminates** a different aspect of the work.
No single translation can capture everything; rather, the translations together offer a fuller picture than any one of them could alone.
Seen in this way, the ⓓ**uniformity** among translations is not a sign of failure but a source of insight.
Instead of searching for a perfect translation, readers might ⓔ**benefit** from reading several side by side.
Each version then becomes a window, and every window shows the same landscape from a slightly different angle.
""")), F, 3,
   ['ⓓ 앞에서 번역마다 작품의 «서로 다른» 면을 밝혀 주고, 여러 번역이 «함께» 더 풍부한 그림을 준다고 했다. 따라서 통찰의 원천이 되는 것은 번역들 사이의 «다양성·차이»이다. uniformity(획일성)가 아니라 diversity / variation이 알맞다.',
    'ⓐ 선택은 번역가의 해석을 «불가피하게» 반영한다(○). ⓑ 여러 뜻 중 하나를 고르면 원문이 허용하던 해석의 폭을 «좁힌다»(○).',
    'ⓒ 각 번역은 작품의 다른 면을 «밝혀 준다»(○). ⓔ 여러 번역을 나란히 읽으면 «도움을 얻는다»(○).',
    '「not a sign of failure(실패의 표시가 아니라)」도, 번역들이 서로 «다르다»는 점이 실패처럼 보일 수 있다는 전제를 깔고 있다는 점이 단서이다.'])


# ══════════════════════════════════════════════════════════════
# u1m1s2t1 어법·어휘/어휘/어휘 관계/파생어·품사 변화
# ══════════════════════════════════════════════════════════════
T = 'u1m1s2t1'

q(T, 1, '다음 중 동사와 그 명사형이 바르게 짝지어지지 «않은» 것은?',
  'deny — denyment',
  ['persist — persistence', 'arrive — arrival', 'refuse — refusal', 'assist — assistance'],
  ['deny(부인하다)의 명사형은 denial(부인, 거부)이다. denyment라는 낱말은 없다.',
   'persist → persistence(끈기), arrive → arrival(도착), refuse → refusal(거절), assist → assistance(도움) — 모두 바르다.',
   '-al로 명사를 만드는 동사: arrive·refuse·deny·approve(approval)·survive(survival).'])

q(T, 2, '다음 문장의 빈칸에 들어갈 말로 알맞은 것은?\n\nThe scientist\'s __________ to the project was recognized with a special award.',
  'contribution',
  ['contribute', 'contributive', 'contributed', 'contributing'],
  ['빈칸은 소유격 The scientist\'s 뒤, 동사 was 앞의 주어 자리이므로 «명사»가 와야 한다.',
   'contribute(동사) → contribution(명사, 기여). contribution to ~: ~에 대한 기여.',
   '해석: 그 과학자의 프로젝트에 대한 기여는 특별상으로 인정받았다. 동사원형·형용사·분사는 주어 자리에 올 수 없다.'])

q(T, 3, '다음 중 굵은 글씨로 표시한 단어의 형태가 어법에 맞는 것은?',
  'The results were remarkably **consistent** across all groups.',
  ['She spoke **confident** in front of the large audience.',
   'In the end, the plan was **success** beyond our expectations.',
   'His sudden **decide** to quit surprised everyone.',
   'They worked **effective** as a team to finish on time.'],
  ['were의 보어 자리에 형용사 consistent(일관된)가 알맞다. remarkably는 형용사를 꾸미는 부사이다.',
   'spoke를 꾸미려면 부사 confidently, 「성공이었다」는 a success 또는 형용사 successful, 소유격 His 뒤 주어 자리는 명사 decision, worked를 꾸미려면 부사 effectively가 되어야 한다.'])

q(T, 3, '다음 <보기>의 단어들 앞에 공통으로 붙어 반대의 뜻을 만드는 접두사로 알맞은 것은?\n\n<보기>\nlegal    logical    literate',
  'il-',
  ['in-', 'im-', 'ir-', 'un-'],
  ['l로 시작하는 형용사에는 부정 접두사 il-이 붙는다: illegal(불법의), illogical(비논리적인), illiterate(글을 모르는).',
   '비교: im-은 p·m·b 앞(impossible, immature, imbalance), ir-은 r 앞(irregular, irrelevant), in-은 그 밖의 많은 경우(incomplete, invisible)에 붙는다.'])

q(T, 4, '다음 글의 (A), (B), (C)의 각 네모 안에서 어법에 맞는 낱말로 가장 적절한 것은?\n\n'
        'The (A)[variety / various] of life in a tropical rainforest is astonishing. '
        'Scientists believe that many of the insects living there have never been (B)[scientific / scientifically] described. '
        'Protecting such forests is (C)[critic / critical] not only for wildlife but also for the stability of the global climate.',
  'variety …… scientifically …… critical',
  ['various …… scientifically …… critical',
   'variety …… scientific …… critical',
   'various …… scientific …… critic',
   'variety …… scientific …… critic'],
  ['(A) 정관사 The 뒤, 동사 is 앞의 주어 자리이므로 명사 variety(다양성). various는 형용사이다.',
   '(B) 과거분사 described(기술된)를 꾸미므로 부사 scientifically.',
   '(C) be동사 is의 보어로 «매우 중요한»이라는 형용사 critical. critic은 «비평가»라는 명사이다.',
   '해석: 열대 우림의 생명 다양성은 놀랍다. 과학자들은 그곳에 사는 곤충 중 다수가 과학적으로 기술된 적이 없다고 본다. 그런 숲을 보호하는 것은 야생 생물뿐 아니라 지구 기후의 안정에도 매우 중요하다.'])

q(T, 5, '다음 <보기>의 문장 중 굵은 글씨로 표시한 단어의 형태가 어법상 옳은 것만을 있는 대로 고른 것은?\n\n<보기>\n'
        'ㄱ. The new policy had a **significant** impact on employment.\n'
        'ㄴ. Her **explanation** of the theory was clear and concise.\n'
        'ㄷ. The company plans to **broad** its range of products.\n'
        'ㄹ. We need to **priority** safety over speed.\n'
        'ㅁ. The instructions were **deliberately** vague.',
  'ㄱ, ㄴ, ㅁ',
  ['ㄱ, ㄷ', 'ㄴ, ㄹ', 'ㄱ, ㄴ, ㄷ', 'ㄴ, ㄹ, ㅁ'],
  ['ㄱ: 명사 impact를 꾸미는 형용사 significant(○). ㄴ: 소유격 Her 뒤의 명사 explanation(○). ㅁ: 형용사 vague를 꾸미는 부사 deliberately(○).',
   'ㄷ: to 뒤에는 동사가 와야 하므로 형용사 broad(넓은)가 아니라 동사 broaden(넓히다)이 되어야 한다(✕).',
   'ㄹ: to 뒤 동사 자리이므로 명사 priority(우선 사항)가 아니라 동사 prioritize(우선시하다)가 되어야 한다(✕).'])



# ══════════════════════════════════════════════════════════════
# u2m0s0t0 서술형/영작/주어진 단어로 문장 완성 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u2m0s0t0'
발 = '다음 우리말과 같은 뜻이 되도록 <조건>에 맞게 주어진 단어를 활용하여 영어 문장을 완성하시오.'

s(T, 1, f'{발}\n\n우리말: 나는 그렇게 아름다운 경치를 한 번도 본 적이 없다.\n주어진 단어: never, such, beautiful, scenery, see\n<조건> 현재완료를 쓸 것 / 필요하면 어형을 바꿀 것',
  'I have never seen such beautiful scenery.  [채점 포인트] ① 현재완료 have never seen ② such + 형용사 + 명사 어순. scenery는 셀 수 없는 명사이므로 such a beautiful scenery·sceneries로 쓰면 감점.',
  ['「~한 적이 한 번도 없다」는 경험을 나타내는 현재완료 부정 have never + p.p.로 쓴다: see → seen.',
   'such는 「such (a/an) + 형용사 + 명사」 어순을 따른다. scenery(경치)는 셀 수 없는 명사라 a를 붙이지 않는다.',
   '비교: so를 쓰면 so beautiful a scene(so + 형용사 + a + 명사) 어순이 된다.'], essay=True)

s(T, 2, f'{발}\n\n우리말: 그가 도와주지 않았더라면, 나는 그 일을 끝내지 못했을 것이다.\n주어진 단어: if, help, finish, the work\n<조건> 가정법 과거완료를 쓸 것 / 필요하면 어형을 바꾸고 단어를 더할 것',
  'If he had not helped me, I could not have finished the work.  (I would not have finished the work / I would not have been able to finish the work, If it had not been for his help, ~ 도 정답)  [채점 포인트] ① if절 had + p.p.(had not helped / had not been for his help) ② 주절 조동사 과거형(could/would) + not + have + p.p.',
  ['과거 사실(그가 도와주었다)의 반대를 가정하므로 가정법 과거완료를 쓴다.',
   'if절: If + 주어 + had + p.p. → If he had not(hadn\'t) helped me.',
   '주절: 주어 + could/would + have + p.p. → I could not have finished the work. («끝낼 수 없었을 것이다»의 뜻을 살리면 could가 가장 자연스럽다.)'], essay=True)

s(T, 3, f'{발}\n\n우리말: 창밖을 바라보며, 그는 옛 친구들을 떠올렸다.\n주어진 단어: look out of, the window, remember, his old friends\n<조건> 분사구문으로 문장을 시작할 것 / 필요하면 어형을 바꿀 것',
  'Looking out of the window, he remembered his old friends.  [채점 포인트] ① 현재분사 Looking으로 시작하는 분사구문 ② 주절의 과거 시제 remembered. (While looking ~ 도 정답)',
  ['「~하며(동시 동작)」는 분사구문으로 나타낸다. 주절의 주어 he가 «바라보는» 주체(능동)이므로 현재분사 Looking.',
   '원래 문장: As he looked out of the window, he remembered his old friends. → 접속사와 주어를 빼고 동사를 -ing로 바꾼다.',
   '떠올렸다는 과거의 일이므로 remember → remembered.'], essay=True)

s(T, 3, f'{발}\n\n우리말: 내가 그 문제를 푸는 데 도움이 된 것은 바로 너의 조언이었다.\n주어진 단어: it, your advice, that, help, solve, the problem\n<조건> 「It ~ that」 강조 구문을 쓸 것 / 필요하면 어형을 바꾸고 단어를 더할 것',
  'It was your advice that helped me (to) solve the problem.  [채점 포인트] ① It was + 강조할 말(your advice) + that ② help + 목적어 + (to) 동사원형. 과거 시제(was, helped)여야 정답.',
  ['강조하지 않은 문장: Your advice helped me (to) solve the problem.',
   '주어 your advice를 강조하여 It was와 that 사이에 넣는다 → It was your advice that helped me (to) solve the problem.',
   'help는 목적격 보어로 동사원형과 to부정사를 모두 쓸 수 있다.'], essay=True)

s(T, 4, f'{발}\n\n우리말: 그는 눈을 감은 채로 그 음악을 들었다.\n주어진 단어: with, eyes, close, listen to, the music\n<조건> 「with + 목적어 + 분사」 구문을 쓸 것 / 필요하면 어형을 바꾸고 단어를 더할 것',
  'He listened to the music with his eyes closed.  (With his eyes closed, he listened to the music. 도 정답)  [채점 포인트] ① with his eyes closed(과거분사) ② listened to(과거). with his eyes closing으로 쓰면 오답.',
  ['「~한 채로」라는 부대 상황은 「with + 목적어 + 분사」로 나타낸다.',
   '눈은 스스로 감는 것이 아니라 «감긴» 상태이므로 목적어 his eyes와 close는 수동 관계 → 과거분사 closed.',
   '비교: with his arms folded(팔짱을 낀 채로), with the engine running(엔진을 켠 채로 — 엔진이 «돌아가는» 능동이라 현재분사).'], essay=True)

s(T, 5, f'{발}\n\n우리말: 나는 그렇게 감동적인 연설을 거의 들어 본 적이 없다.\n주어진 단어: seldom, such, moving, speech, hear\n<조건> Seldom으로 문장을 시작할 것 / 현재완료를 쓸 것 / 필요하면 어형을 바꾸고 단어를 더할 것',
  'Seldom have I heard such a moving speech.  [채점 포인트] ① Seldom 뒤 조동사-주어 도치 have I heard ② such a + 형용사 + 명사. Seldom I have heard(도치 없음)는 오답.',
  ['기본 문장: I have seldom heard such a moving speech.',
   '부정의 뜻을 가진 부사 seldom(좀처럼 ~ 않는)이 문장 맨 앞에 오면 조동사와 주어의 자리가 바뀐다 → Seldom have I heard ~.',
   'speech는 셀 수 있는 명사이므로 such a moving speech. moving은 «감동적인»이라는 형용사이다(moved는 «감동받은»).'], essay=True)


# ══════════════════════════════════════════════════════════════
# u2m0s0t1 서술형/영작/조건 영작 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u2m0s0t1'
발 = '다음 우리말을 <조건>에 맞게 영작하시오.'

s(T, 1, f'{발}\n\n우리말: 매일 운동하는 것은 건강에 좋다.\n<조건>\n1. 가주어 it과 진주어 to부정사를 쓸 것\n2. exercise와 your health를 쓸 것\n3. 축약형 없이 10단어로 쓸 것',
  'It is good for your health to exercise every day.  [채점 포인트] 가주어 It, 진주어 to exercise, for your health, 10단어가 모두 맞아야 정답.',
  ['To exercise every day is good for your health. 에서 긴 주어(to부정사구)를 뒤로 보내고 그 자리에 가주어 It을 쓴다.',
   'It(1) is(2) good(3) for(4) your(5) health(6) to(7) exercise(8) every(9) day(10) — 10단어.',
   'everyday(형용사, 일상의)를 한 단어로 쓰면 «매일»이라는 부사구가 되지 않으므로 every day로 띄어 쓴다.'], essay=True)

s(T, 2, f'{발}\n\n우리말: 내가 원하는 것은 약간의 휴식이다.\n<조건>\n1. 관계대명사 what으로 문장을 시작할 것\n2. some을 쓸 것\n3. 6단어로 쓸 것',
  'What I want is some rest.  [채점 포인트] What I want(주어) + is(단수 동사) + some rest, 6단어.',
  ['관계대명사 what은 선행사를 포함하여 「~하는 것」(= the thing that)의 뜻이다: What I want = 내가 원하는 것.',
   'what절이 주어일 때는 단수 취급하므로 is를 쓴다.',
   'What(1) I(2) want(3) is(4) some(5) rest(6) — 6단어.'], essay=True)

s(T, 3, f'{발}\n\n우리말: 내가 너라면, 그 제안을 받아들일 텐데.\n<조건>\n1. 가정법 과거로 쓸 것\n2. accept, offer를 쓸 것\n3. 9단어로 쓸 것',
  'If I were you, I would accept the offer.  [채점 포인트] If I were you(was도 구어에서는 쓰지만 가정법 원칙대로 were), 주절 would accept, 9단어.',
  ['현재 사실(나는 네가 아니다)의 반대를 가정하므로 가정법 과거: If + 주어 + were/과거형, 주어 + would + 동사원형.',
   'If(1) I(2) were(3) you(4) I(5) would(6) accept(7) the(8) offer(9) — 9단어.',
   '「~할 텐데」는 would, 「~할 수 있을 텐데」라면 could를 쓴다.'], essay=True)

s(T, 3, f'{발}\n\n우리말: 그 규칙은 모든 학생에 의해 지켜져야 한다.\n<조건>\n1. 조동사 must와 수동태를 쓸 것\n2. follow를 활용할 것\n3. 8단어로 쓸 것',
  'The rule must be followed by all students.  (by every student도 정답)  [채점 포인트] must be followed(조동사 + be + p.p.), by all students(또는 by every student), 8단어. (obey·observe 대신 follow를 써야 함)',
  ['조동사가 있는 수동태: 조동사 + be + 과거분사 → must be followed.',
   '행위자는 by + 목적격: by all students.',
   'The(1) rule(2) must(3) be(4) followed(5) by(6) all(7) students(8) — 8단어. all the students로 쓰면 9단어가 되어 조건에 어긋난다.'], essay=True)

s(T, 4, '다음 글의 요지를 <조건>에 맞게 한 문장의 영어로 쓰시오.\n\n' + J("""
Many people believe that great performers are simply born with special gifts.
But when researchers look closely at the lives of top musicians, athletes, and chess players, they usually find years of steady, focused practice behind the apparent magic.
Talent may help someone start quickly, but it rarely carries anyone to the top alone.
Those who reach the highest levels are almost always the ones who kept practicing long after others had stopped.
""") + '\n\n<조건>\n1. 「not A but B」 구문을 쓸 것\n2. success, depend, talent, consistent, practice를 모두 쓸 것(필요하면 어형 변화)\n3. 축약형 없이 9단어로 쓸 것',
  'Success depends not on talent but on consistent practice.  [채점 포인트] depend on을 살려 not on A but on B로 병렬, 주어 Success(3인칭 단수)에 맞춘 depends, 9단어.',
  ['글의 요지: 뛰어난 성과는 타고난 재능이 아니라 꾸준하고 집중된 연습에서 나온다.',
   'depend on(~에 달려 있다)을 not A but B에 넣으면 전치사 on이 A와 B 양쪽에 걸리도록 not on talent but on consistent practice로 쓴다.',
   'Success(1) depends(2) not(3) on(4) talent(5) but(6) on(7) consistent(8) practice(9) — 9단어.'], essay=True)

s(T, 5, f'{발}\n\n우리말: 중요한 것은 우리가 얼마나 많이 아느냐가 아니라 우리가 아는 것을 어떻게 사용하느냐이다.\n<조건>\n1. What matters로 문장을 시작할 것\n2. 「not A but B」 구문을 쓸 것\n3. 관계대명사 what을 한 번 더 쓸 것\n4. 15단어로 쓸 것',
  'What matters is not how much we know but how we use what we know.  [채점 포인트] ① 주어 What matters + is ② not + 간접의문문(how much we know) + but + 간접의문문(how we use ~) ③ 목적어 what we know ④ 15단어.',
  ['「중요한 것」 = What matters(what 관계대명사절 주어, 단수 → is).',
   '「얼마나 많이 아느냐」 = 간접의문문 how much we know(의문사 + 주어 + 동사 어순), 「어떻게 사용하느냐」 = how we use ~.',
   '「우리가 아는 것」 = what we know. 두 간접의문문을 not A but B로 병렬한다.',
   'What(1) matters(2) is(3) not(4) how(5) much(6) we(7) know(8) but(9) how(10) we(11) use(12) what(13) we(14) know(15) — 15단어.'], essay=True)


# ══════════════════════════════════════════════════════════════
# u2m0s1t0 서술형/순서 배열/단어 배열해 문장 만들기 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u2m0s1t0'
발 = '다음 우리말과 같은 뜻이 되도록 괄호 안의 말을 바르게 배열하여 문장을 완성하시오.'

s(T, 1, f'{발}\n\n우리말: 그녀는 나에게 창문을 열어 달라고 부탁했다.\n( asked / open / me / to / the window / she )',
  'She asked me to open the window.  [채점 포인트] ask + 목적어 + to부정사 어순이 맞아야 정답.',
  ['「A에게 ~해 달라고 부탁하다」 = ask + A(목적어) + to부정사.',
   '주어 She → 동사 asked → 목적어 me → 목적격 보어 to open the window.'], essay=True)

s(T, 2, f'{발}\n\n우리말: 나는 무엇을 해야 할지 몰랐다.\n( what / I / to / know / do / didn\'t )',
  'I didn\'t know what to do.  [채점 포인트] 「의문사 + to부정사」 what to do가 know의 목적어 자리에 와야 정답.',
  ['「무엇을 ~해야 할지」 = what + to부정사(= what I should do).',
   '주어 I → 부정 동사 didn\'t know → 목적어 what to do.'], essay=True)

s(T, 3, f'{발}\n\n우리말: 이것은 내가 지금까지 읽은 책 중에서 가장 흥미로운 책이다.\n( the most / book / ever / I / have / read / interesting / this / is )',
  'This is the most interesting book I have ever read.  [채점 포인트] ① the most interesting book(최상급 + 명사) ② 목적격 관계대명사가 생략된 I have ever read.',
  ['「지금까지 ~한 것 중 가장 …한」 = the + 최상급 + 명사 + (that) + 주어 + have ever + p.p.',
   'book 뒤에 목적격 관계대명사 that이 생략되어 I have ever read가 book을 꾸민다.',
   'ever는 have와 과거분사 read 사이에 온다.'], essay=True)

s(T, 3, f'{발}\n\n우리말: 그는 너무 피곤해서 더 이상 걸을 수 없었다.\n( too / to / walk / tired / was / he / any farther )',
  'He was too tired to walk any farther.  [채점 포인트] too + 형용사 + to부정사(너무 ~해서 …할 수 없다) 어순이 맞아야 정답.',
  ['「너무 ~해서 …할 수 없다」 = too + 형용사/부사 + to부정사 (= so ~ that + 주어 + can\'t).',
   'He was too tired to walk any farther. = He was so tired that he couldn\'t walk any farther.',
   'any farther(더 이상 멀리)는 문장 끝에 둔다.'], essay=True)

s(T, 4, f'{발}\n\n우리말: 그가 그 대회에서 우승했다는 소식이 우리 모두를 놀라게 했다.\n( the news / surprised / that / won / he / the contest / all of us )',
  'The news that he won the contest surprised all of us.  [채점 포인트] ① 동격의 that절 the news that he won the contest가 주어 ② 동사 surprised + 목적어 all of us.',
  ['「~라는 소식」 = the news + 동격의 접속사 that + 완전한 문장.',
   '주어가 길어도 동사는 the news에 맞춘 surprised 하나이다: [The news that he won the contest] surprised all of us.',
   'that 뒤 he won the contest는 주어·동사·목적어를 다 갖춘 완전한 문장이므로 관계대명사가 아닌 동격의 접속사이다.'], essay=True)

s(T, 5, f'{발} (단, 필요 없는 한 단어를 빼고 배열할 것)\n\n우리말: 그 문제에 대해 더 많이 생각할수록, 그것은 더 복잡해 보였다.\n( the more / I / thought / about / the problem / the more / complicated / it / seemed / much )',
  'The more I thought about the problem, the more complicated it seemed.  (필요 없는 단어: much)  [채점 포인트] ① The more + 주어 + 동사, the more + 형용사 + 주어 + 동사 ② much를 빼야 정답.',
  ['「~할수록 더 …하다」 = The + 비교급 + 주어 + 동사, the + 비교급 + 주어 + 동사.',
   '앞 절: The more I thought about the problem (더 많이 생각할수록). 뒤 절: the more complicated it seemed — seemed의 보어인 형용사 complicated가 the more와 함께 앞으로 나온다.',
   'much는 비교급 강조에 쓰이지만 the more complicated 앞에 넣을 자리가 없으므로 필요 없는 단어이다.'], essay=True)


# ══════════════════════════════════════════════════════════════
# u2m0s2t0 서술형/틀린 부분 고치기/문장에서 틀린 부분 찾아 고치기 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u2m0s2t0'

s(T, 1, '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고쳐 쓰시오.\n\nNeither the teacher nor the students was ready for the sudden change in schedule.',
  'was → were  [채점 포인트] 틀린 곳 was를 찾아 were로 고치면 정답.',
  ['「neither A nor B」가 주어이면 동사는 B(가까운 쪽)에 수를 맞춘다.',
   'B = the students(복수)이므로 was → were.',
   '해석: 선생님도 학생들도 갑작스러운 일정 변경에 대비가 되어 있지 않았다.'], essay=True)

s(T, 2, '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고쳐 쓰시오.\n\nI am really looking forward to see you again at the reunion next month.',
  'see → seeing  [채점 포인트] to see를 to seeing으로 고치면 정답.',
  ['look forward to의 to는 to부정사가 아니라 «전치사»이므로 뒤에 동명사가 온다: look forward to -ing(~하기를 고대하다).',
   '같은 유형: be used to -ing(~에 익숙하다), object to -ing(~에 반대하다), when it comes to -ing(~에 관해서라면).',
   '해석: 다음 달 동창회에서 너를 다시 보기를 정말 고대하고 있어.'], essay=True)

s(T, 3, '다음 두 문장에서 어법상 틀린 부분을 각각 하나씩 찾아 바르게 고쳐 쓰시오.\n\n(1) The number of tourists visiting the island have doubled over the past decade.\n(2) The doctor suggested that he goes on a diet as soon as possible.',
  '(1) have → has  (2) goes → (should) go  [채점 포인트] 두 곳을 모두 바르게 고쳐야 정답(한 곳만 맞으면 부분 점수).',
  ['(1) 「The number of + 복수명사」(~의 수)는 단수 취급한다 → has doubled. 「A number of + 복수명사」(많은 ~)는 복수 취급하는 것과 구별한다. (해석: 그 섬을 방문하는 관광객의 수는 지난 10년 동안 두 배가 되었다.)',
   '(2) 제안·요구·주장(suggest, demand, insist 등)의 that절이 «~해야 한다»는 뜻이면 (should) + 동사원형을 쓴다 → (should) go. (해석: 의사는 그에게 가능한 한 빨리 식이 요법을 하라고 제안했다.)'], essay=True)

s(T, 3, '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고쳐 쓰시오.\n\nThe man whom I thought was honest turned out to be lying to everyone.',
  'whom → who  [채점 포인트] whom을 주격 who로 고치면 정답(that도 정답).',
  ['I thought는 관계절 안에 끼어든 삽입절이다: The man [who (I thought) was honest] ~.',
   '삽입절을 빼면 who was honest — 관계대명사가 was의 주어 역할을 하므로 목적격 whom이 아니라 주격 who가 알맞다.',
   '해석: 내가 정직하다고 생각했던 그 남자는 모든 사람에게 거짓말을 하고 있었던 것으로 드러났다.'], essay=True)

s(T, 4, '다음 글에서 어법상 틀린 부분을 두 군데 찾아 바르게 고쳐 쓰시오.\n\n' + J("""
When I was young, my grandmother used to telling me stories before bed.
Every story she told had a lesson, which I didn't understand it until I grew up.
Now that I have children of my own, I find myself repeating her stories, hoping they will someday understand them as I did.
"""),
  'used to telling → used to tell / which I didn\'t understand it → which I didn\'t understand (it 삭제)  [채점 포인트] 두 곳을 모두 찾아 고쳐야 정답. 둘째 오류는 which를 but으로 바꾸어(~ had a lesson, but I didn\'t understand it ~) 고쳐도 정답.',
  ['「used to + 동사원형」은 «(과거에) ~하곤 했다»이다. used to telling은 be used to -ing(~에 익숙하다)와 혼동한 것이므로 used to tell로 고친다.',
   '관계대명사 which가 이미 understand의 목적어 역할을 하므로 뒤의 it은 중복이다. it을 지운다.',
   'Now that(~이므로), find oneself -ing(자신이 ~하고 있음을 깨닫다), 분사구문 hoping, 대동사 as I did는 모두 바르다.'], essay=True)

s(T, 5, '다음 글에서 어법상 틀린 부분 3개를 찾아 바르게 고쳐 쓰시오.\n\n' + J("""
Not until the final results were announced we realized how close the competition had been.
Our team, which had practiced for months, lost by a single point.
Had we scored two more points, we would win the championship.
Looking back, I think the defeat taught us more than a victory would have.
It made us to realize that effort alone does not guarantee success.
"""),
  'we realized → did we realize / would win → would have won / made us to realize → made us realize  [채점 포인트] 세 곳을 모두 바르게 고쳐야 정답(두 곳이면 부분 점수). 바른 표현(which had practiced, would have)을 고치면 감점.',
  ['「Not until ~」이 문장 앞에 오면 주절이 도치된다: Not until the final results were announced did we realize ~. (최종 결과가 발표되고 나서야 비로소 우리는 ~을 깨달았다.)',
   'Had we scored ~는 if를 생략한 가정법 과거완료(= If we had scored)이므로 주절도 would have + p.p. → would have won.',
   '사역동사 make의 목적격 보어는 동사원형이다: made us realize.',
   'a victory would have (taught us)는 반복되는 부분을 생략한 바른 표현이고, which had practiced(계속적 용법, 과거완료)도 바르다.'], essay=True)


# ══════════════════════════════════════════════════════════════
# u2m0s3t0 서술형/본문 서술형/본문 빈칸 채우기 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u2m0s3t0'

s(T, 1, P('다음 글의 빈칸에 들어갈 알맞은 말을 쓰시오. (단, ex로 시작하는 8글자 한 단어)', J("""
Most people think of volunteering as something we do only for others.
We give our time to serve meals at a shelter, clean up a park, or tutor children, expecting nothing in return.
Yet volunteers often discover that they receive as much as they give.
Helping others can create a sense of purpose, build new friendships, and provide a welcome break from personal worries.
Many volunteers report feeling happier and more connected to their communities after only a few weeks of regular service.
In this sense, volunteering is not a one-way act of giving but a two-way ex______, in which both the helper and the helped benefit.
""")),
  'exchange  [채점 포인트] exchange(교환) 한 단어이면 정답. 철자가 틀리면 오답.',
  ['빈칸 앞 not a one-way act of giving(일방적으로 주는 행위가 아니라)과 대조되어 a two-way ~(양방향의 ~)가 온다.',
   '빈칸 뒤 「in which both the helper and the helped benefit(돕는 사람과 도움받는 사람 모두가 이익을 얻는)」 — 서로 주고받는 «교환(exchange)»이다.',
   '근거: volunteers ~ receive as much as they give(자원봉사자들은 주는 만큼 받는다).'], essay=True)

s(T, 2, P('다음 글의 빈칸에 들어갈 말을 본문에서 찾아 한 단어로 쓰시오.', J("""
Attention is a limited resource.
Every notification, advertisement, and headline competes for a share of it, and whatever receives our attention shapes what we think about and, eventually, who we become.
Companies understand this well; many of the apps on our phones are designed to capture as much of our attention as possible, because attention can be turned into profit through advertising.
If we do not decide for ourselves where our attention goes, others will gladly decide for us.
Protecting our __________, then, may be one of the most important skills of modern life.
""")),
  'attention  [채점 포인트] attention 한 단어이면 정답.',
  ['첫 문장 「Attention is a limited resource.(주의력은 한정된 자원이다.)」가 글 전체의 주제이다.',
   '알림·광고·앱이 모두 우리의 주의를 차지하려고 경쟁하고, 우리가 스스로 정하지 않으면 남이 대신 정한다 — 그러므로 지켜야 할 것은 우리의 «주의력(attention)»이다.'], essay=True)

s(T, 3, P('다음 글의 내용을 한 문장으로 요약할 때, 빈칸 (A), (B)에 들어갈 말을 주어진 철자로 시작하여 쓰시오. (단, _ 의 개수는 나머지 글자 수와 같다)', J("""
In a classic experiment, researchers gave coffee mugs to half of the students in a class.
The students who received mugs were asked how much money they would accept to sell their mugs, while the other students were asked how much they would pay to buy one.
Logically, the two amounts should have been similar, since the mugs were identical and had been handed out at random.
Yet the owners demanded about twice as much as the buyers were willing to pay.
Simply owning the mug, even for a few minutes, seemed to make it more valuable in the owners' eyes.
This tendency, known as the endowment effect, helps explain why people often hold on to things they no longer use and why sellers so often set prices that buyers find unreasonable.
"""), '[요약] People tend to place a higher (A) v____ on objects simply because they (B) o__ them.'),
  '(A) value  (B) own  [채점 포인트] 두 개 모두 맞아야 정답.',
  ['실험: 머그잔을 받은 학생(소유자)은 사려는 학생이 내려는 금액의 약 두 배를 요구했다. 「Simply owning the mug ~ seemed to make it more valuable(단지 머그잔을 소유한 것만으로 더 가치 있게 여겨졌다)」.',
   '(A) place a higher value on ~: ~에 더 높은 가치를 두다 → value.',
   '(B) 그 물건을 «소유한다»는 이유만으로 → own. (owning은 because 뒤 동사 자리에 맞지 않는다.)'], essay=True)

s(T, 3, P('다음 글의 내용을 한 문장으로 요약할 때, 빈칸 (A), (B)에 들어갈 말을 본문에서 찾아 각각 한 단어로 쓰시오. (필요하면 형태를 바꿀 것)', J("""
Teachers often say that they did not truly understand a subject until they had to teach it.
There is good reason to believe them.
When we prepare to explain something to others, we must organize our knowledge, identify the key ideas, and anticipate questions we might be asked.
This process reveals gaps in our understanding that we might never notice while simply reading or listening.
Students can use the same principle.
Explaining a concept aloud to a classmate, or even to an imaginary audience, forces them to put vague impressions into clear words.
If they cannot explain it simply, they probably do not understand it well enough yet.
"""), '[요약] (A) __________ something to others helps us find the (B) __________ in our own understanding.'),
  '(A) Explaining (Teaching도 정답)  (B) gaps  [채점 포인트] (A)는 주어 자리이므로 동명사(-ing) 형태여야 정답. (B)는 복수형 gaps(gap 단수는 부분 점수).',
  ['(A) 문장의 주어 자리이면서 helps의 주어이므로 동명사가 알맞다. 본문의 explain(Explaining a concept aloud ~) → Explaining. 본문의 teach를 바꾼 Teaching도 뜻이 통한다.',
   '(B) 근거: 「This process reveals gaps in our understanding(이 과정은 우리 이해의 빈틈을 드러낸다)」 → gaps.',
   '해석: 무언가를 다른 사람에게 설명하는 것은 우리 자신의 이해에 있는 빈틈을 찾는 데 도움이 된다.'], essay=True)

s(T, 4, P('다음 글의 내용을 한 문장으로 요약할 때, 빈칸 (A), (B)에 들어갈 말을 본문에서 찾아 각각 한 단어로 쓰시오.', J("""
Why do we often grow to like a song that we did not care for the first time we heard it?
Psychologists have found that simply being exposed to something repeatedly tends to make us like it more, a phenomenon known as the mere exposure effect.
In experiments, people shown unfamiliar shapes, words, or faces several times later rated them as more pleasant than ones they had seen only once or not at all, even when they could not remember having seen them before.
One explanation is that familiar things are easier for the brain to process, and we tend to mistake this ease for a sign that something is good or safe.
Advertisers take advantage of this effect by repeating the same messages and images, knowing that familiarity can quietly turn into preference.
"""), '[요약] Repeated (A) __________ to something can increase our (B) __________ for it, partly because what is familiar is easier to process.'),
  '(A) exposure  (B) preference  [채점 포인트] 두 개 모두 맞아야 정답. (A)를 exposed로 쓰면 오답(형용사 Repeated 뒤 명사 자리).',
  ['(A) 형용사 Repeated(반복된)의 꾸밈을 받는 명사 자리이고, 뒤에 to something이 이어진다: exposure to ~(~에 노출됨). 본문의 the mere exposure effect에서 찾는다.',
   '(B) 소유격 our 뒤 명사 자리, for it과 어울리는 말: preference for ~(~에 대한 선호). 본문 마지막 문장의 preference에서 찾는다.',
   '해석: 어떤 것에 반복해서 노출되면 그것에 대한 선호가 커질 수 있는데, 부분적으로는 익숙한 것이 처리하기 더 쉽기 때문이다.'], essay=True)

s(T, 5, P('다음 글의 내용을 한 문장으로 요약할 때, 빈칸 (A), (B), (C)에 들어갈 말을 주어진 철자로 시작하여 쓰시오. (단, _ 의 개수는 나머지 글자 수와 같다)', J("""
When students are asked how long it will take them to finish a major assignment, their estimates are usually far too optimistic.
In one study, students predicted when they would complete their senior theses, and on average they took longer than even their "worst-case" predictions.
This tendency to underestimate the time a task will take, known as the planning fallacy, affects not only students but also governments and companies, whose construction projects regularly run over schedule and over budget.
The error arises partly because people focus on the specific task in front of them and imagine how it will go if everything goes smoothly, while ignoring how long similar tasks have actually taken in the past.
One simple remedy is to ask, before making a prediction, how long comparable projects took for others, or for ourselves the last time.
"""), '[요약] People tend to (A) u____________ how long tasks will take because they imagine an (B) i____ scenario while ignoring their (C) p___ experience with similar tasks.'),
  '(A) underestimate  (B) ideal  (C) past  [채점 포인트] 세 개 모두 맞아야 정답(두 개면 부분 점수). 글자 수 조건 때문에 idealized·previous는 오답.',
  ['(A) 「This tendency to underestimate the time a task will take(과제에 걸릴 시간을 과소평가하는 경향)」 → underestimate.',
   '(B) 「imagine how it will go if everything goes smoothly(모든 것이 순조롭게 진행된다면 어떻게 될지 상상한다)」 → 모든 것이 잘 풀리는 «이상적인(ideal)» 시나리오. an 뒤이므로 모음으로 시작하는 ideal이 알맞다.',
   '(C) 「ignoring how long similar tasks have actually taken in the past(비슷한 과제가 과거에 실제로 얼마나 걸렸는지를 무시한다)」 → «과거의(past)» 경험.'], essay=True)


# ══════════════════════════════════════════════════════════════
# u2m0s3t1 서술형/본문 서술형/본문 내용 우리말로 쓰기 (서술형)
# ══════════════════════════════════════════════════════════════
T = 'u2m0s3t1'

s(T, 1, P('다음 글에서 소개한 «규칙»이 무엇인지 우리말로 쓰시오.', J("""
Online shopping has made it easier than ever to buy things we do not need.
With a single click, a product we saw only seconds ago can be on its way to our door.
To avoid regrettable purchases, some people follow a simple rule: whenever they want to buy something that is not a necessity, they wait twenty-four hours before paying.
During that time, the initial excitement often fades, and they can ask themselves calmly whether they really need the item.
If they still want it the next day, they buy it without guilt.
Many who follow this rule find that they end up buying far fewer things, and enjoying the things they do buy much more.
""")),
  '꼭 필요한 물건이 아닌 것을 사고 싶을 때는, 돈을 내기 전에 24시간을 기다리는 것.  [채점 포인트] ‘필요한 물건이 아닐 때’와 ‘사기(결제하기) 전에 24시간 기다린다’ 두 요소가 모두 있어야 정답.',
  ['근거 문장: whenever they want to buy something that is not a necessity, they wait twenty-four hours before paying.',
   '해석: 필수품이 아닌 무언가를 사고 싶을 때마다, 그들은 돈을 내기 전에 24시간을 기다린다.',
   '「다음 날에도 원하면 죄책감 없이 산다」는 규칙을 따른 결과이지 규칙 자체가 아니다.'], essay=True)

s(T, 2, P('다음 글의 굵은 글씨로 표시한 this problem이 가리키는 내용을 우리말로 쓰시오.', J("""
Sea turtle hatchlings emerge from their nests on the beach at night and must find their way to the ocean quickly.
For millions of years, they have done this by moving toward the brightest horizon, which on a natural beach is the sky over the open sea.
Today, however, bright lights from hotels, roads, and houses near the shore can lead hatchlings in the wrong direction, away from the water, where many die from exhaustion or are caught by predators.
To solve **this problem**, some coastal towns now require buildings near nesting beaches to turn off or shield their lights during the nesting season.
""")),
  '해안 근처 호텔·도로·집의 밝은 불빛 때문에 갓 부화한 바다거북 새끼들이 바다가 아닌 엉뚱한 방향으로 가서, 지쳐 죽거나 포식자에게 잡아먹히는 문제.  [채점 포인트] ‘인공 불빛’이 원인이고, ‘새끼 거북이 바다 반대 방향으로 가서 죽는다’는 결과가 모두 들어가야 정답.',
  ['this problem은 바로 앞 문장의 내용을 가리킨다.',
   '근거: bright lights from hotels, roads, and houses near the shore can lead hatchlings in the wrong direction, away from the water, where many die from exhaustion or are caught by predators.',
   '배경: 새끼 거북은 가장 밝은 수평선(자연 해변에서는 바다 위 하늘)을 향해 움직여 바다를 찾는데, 인공 불빛이 이를 혼란시킨다.'], essay=True)

s(T, 3, P('다음 글에서 필자가 오늘날 «질문에 답하는 능력»의 가치가 예전보다 줄어들고 있다고 보는 이유를 우리말로 쓰시오.', J("""
In an age when any fact can be found in seconds, the ability to answer questions is becoming less valuable than it once was.
Search engines and AI tools can provide answers faster and more accurately than most people ever could.
What they cannot do as easily is decide which questions are worth asking.
A good question directs attention to what matters, reveals hidden assumptions, and opens new areas of inquiry.
For this reason, I believe schools should spend less time training students to memorize answers and more time teaching them to ask thoughtful questions.
""")),
  '어떤 사실이든 몇 초 만에 찾을 수 있고, 검색 엔진과 AI 도구가 대부분의 사람보다 더 빠르고 정확하게 답을 내놓을 수 있기 때문이다.  [채점 포인트] ‘검색 엔진·AI가 사람보다 더 빠르고 정확하게 답을 준다’는 내용이 있으면 정답.',
  ['근거 문장 1: In an age when any fact can be found in seconds(어떤 사실이든 몇 초 만에 찾을 수 있는 시대에).',
   '근거 문장 2: Search engines and AI tools can provide answers faster and more accurately than most people ever could.',
   '필자의 주장(학교는 좋은 질문을 하는 법을 가르쳐야 한다)은 이유가 아니라 결론이므로 답에 쓰지 않는다.'], essay=True)

s(T, 3, P('다음 글에서 도시의 나무가 하는 역할 세 가지를 우리말로 쓰시오.', J("""
City trees are often thought of as decoration, but they perform valuable services that are easy to overlook.
On hot summer days, their shade and the water that evaporates from their leaves can make nearby streets noticeably cooler.
During heavy rain, their roots and the soil around them absorb water that would otherwise rush into drains, reducing the risk of flooding.
Trees also appear to benefit people's mental health; residents of leafy neighborhoods often report feeling less stressed than those living among bare concrete.
Planting and caring for trees, then, is not a luxury but a practical investment in a city's future.
""")),
  '(1) 그늘과 잎에서 증발하는 수분으로 더운 날 주변 거리를 시원하게 한다. (2) 뿌리와 주변 흙이 빗물을 흡수해 홍수 위험을 줄인다. (3) 사람들의 스트레스를 줄여 정신 건강에 도움을 준다.  [채점 포인트] 세 가지가 모두 있어야 정답(두 가지면 부분 점수).',
  ['(1) their shade and the water that evaporates from their leaves can make nearby streets noticeably cooler.',
   '(2) their roots and the soil around them absorb water ~, reducing the risk of flooding.',
   '(3) Trees also appear to benefit people\'s mental health; residents of leafy neighborhoods often report feeling less stressed.',
   '「장식으로 여겨진다」는 통념이지 역할이 아니다.'], essay=True)

s(T, 4, P('다음 글의 굵은 글씨 문장이 의미하는 바를 글의 내용을 바탕으로 우리말로 풀어 쓰시오.', J("""
When we start learning something new, progress often comes quickly.
A beginner guitarist learns her first chords within days, and a new runner improves his time every week.
After a while, however, improvement slows and may seem to stop altogether.
Many learners become discouraged at this point and conclude that they have reached the limit of their ability.
But a plateau is rarely a dead end.
More often, it is a sign that the methods that worked for a beginner are no longer enough, and that the learner must find new challenges, seek feedback, or practice in a different way.
**A plateau is not a wall but a signpost.**
"""), '*plateau: 정체기'),
  '정체기는 더 이상 나아갈 수 없는 능력의 한계(벽)가 아니라, 초보 때의 방법으로는 부족하니 새로운 도전·피드백·다른 연습 방식으로 바꾸라고 알려 주는 신호(이정표)라는 뜻이다.  [채점 포인트] ‘벽 = 능력의 한계·끝이 아니다’와 ‘이정표 = 방법을 바꾸라는 신호’ 두 요소가 모두 있어야 정답.',
  ['wall(벽) ↔ 앞 문장의 dead end(막다른 길), 「they have reached the limit of their ability(능력의 한계에 도달했다)」.',
   'signpost(이정표) ↔ 「a sign that the methods that worked for a beginner are no longer enough(초보자에게 통하던 방법이 더는 충분하지 않다는 신호)」 — 새 도전, 피드백, 다른 연습 방식이라는 «방향»을 가리킨다.',
   '해석: 정체기는 벽이 아니라 이정표이다.'], essay=True)

s(T, 5, P('다음 글을 읽고, (1) 글자와 잉크 색이 다를 때 잉크 색을 말하기 어려운 이유와 (2) 이 현상이 보여 주는 점을 각각 우리말로 쓰시오.', J("""
Try this simple test.
Look at the word RED printed in blue ink, and say aloud the color of the ink, not the word.
Most people hesitate for a moment, and some even say "red" by mistake.
When the word and the ink color match, however, naming the color is quick and easy.
This delay, first described by the psychologist John Ridley Stroop in 1935, occurs because reading is so automatic for skilled readers that the brain processes the meaning of a word even when we try to ignore it.
The two pieces of information then compete, and resolving the conflict takes time.
The effect shows that practice does more than make a skill faster; it can make the skill so automatic that we cannot switch it off.
""")),
  '(1) 숙련된 독자에게 읽기는 너무 자동적이어서, 무시하려 해도 뇌가 단어의 뜻을 처리하고, 단어의 뜻과 잉크 색이라는 두 정보가 서로 경쟁해 그 충돌을 해결하는 데 시간이 걸리기 때문이다. (2) 연습은 기술을 빠르게 만들 뿐 아니라, 끌 수 없을 만큼 자동적으로 만들 수 있다.  [채점 포인트] (1) ‘읽기의 자동성’과 ‘두 정보의 경쟁(충돌)’, (2) ‘연습이 기술을 멈출 수 없을 만큼 자동화한다’가 모두 있어야 정답.',
  ['(1) 근거: reading is so automatic for skilled readers that the brain processes the meaning of a word even when we try to ignore it. The two pieces of information then compete, and resolving the conflict takes time.',
   '(so ~ that 구문: 너무 자동적이어서 무시하려 해도 뜻을 처리한다.)',
   '(2) 근거: practice does more than make a skill faster; it can make the skill so automatic that we cannot switch it off.',
   '(do more than ~: ~ 이상의 일을 하다 = ~할 뿐 아니라 …도 한다.)'], essay=True)



# ══════════════════════════════════════════════════════════════
# u3m0s0t0 단어·문장/단어/단어 뜻/영어를 우리말로 (객관식)
# ══════════════════════════════════════════════════════════════
T = 'u3m0s0t0'

q(T, 1, '다음 영어 단어의 뜻으로 알맞은 것은?\n\ninevitable',
  '피할 수 없는, 필연적인',
  ['눈에 보이지 않는', '매우 귀중한', '믿을 수 없는', '관련이 없는'],
  ['inevitable = in(부정) + evitable(피할 수 있는) → 피할 수 없는, 필연적인. 예: an inevitable result(필연적인 결과).',
   '오답은 모양이 비슷한 낱말의 뜻이다: invisible(눈에 보이지 않는), invaluable(매우 귀중한), incredible(믿을 수 없는), irrelevant(관련이 없는).'])

q(T, 2, '다음 영어 단어의 뜻으로 알맞은 것은?\n\nmitigate',
  '(피해·고통 등을) 완화하다, 누그러뜨리다',
  ['이주하다', '모방하다', '명상하다', '악화시키다'],
  ['mitigate = 완화하다, 경감하다. 예: mitigate the effects of climate change(기후 변화의 영향을 완화하다).',
   '오답: migrate(이주하다), imitate(모방하다), meditate(명상하다) — 철자가 비슷한 낱말. 「악화시키다」는 worsen / aggravate로 mitigate의 반대말이다.'])

q(T, 3, '다음 문장에서 굵은 글씨로 표시한 단어의 뜻으로 가장 알맞은 것은?\n\nThe government must **address** the problem of rising housing costs before it gets worse.',
  '(문제 등을) 다루다, 처리하다',
  ['주소를 쓰다', '연설하다', '말을 걸다', '(우편물을) 보내다'],
  ['address는 뜻이 여러 개인 다의어이다: 주소(를 쓰다), 연설(하다), 말을 걸다, (문제를) 다루다.',
   '목적어가 the problem of rising housing costs(오르는 주거비 문제)이고 「더 나빠지기 전에」라는 말이 이어지므로 «(문제를) 다루다, 처리하다»가 알맞다.',
   '해석: 정부는 오르는 주거비 문제가 더 나빠지기 전에 그것을 다루어야 한다.'])

q(T, 3, '다음 중 단어와 그 뜻이 바르게 짝지어지지 «않은» 것은?',
  'deliberate — 우연한',
  ['ambiguous — 모호한', 'abundant — 풍부한', 'compatible — 양립할 수 있는', 'tentative — 잠정적인'],
  ['deliberate는 «의도적인, 고의의» 또는 «신중한»이라는 뜻이다. 「우연한」은 accidental / coincidental이므로 짝이 틀렸다.',
   '예: a deliberate attempt(의도적인 시도), a deliberate decision(신중한 결정). 동사로는 «숙고하다».',
   'ambiguous(모호한), abundant(풍부한), compatible(양립할 수 있는, 호환되는), tentative(잠정적인, 임시의) — 모두 바르다.'])

q(T, 4, '다음 문장에서 굵은 글씨로 표시한 단어의 뜻으로 가장 알맞은 것은?\n\nHer argument was so **sound** that no one in the room could find a single flaw in it.',
  '(논리·판단이) 타당한, 건전한',
  ['(소리가) 큰', '(잠이) 깊은', '시끄러운', '(몸이) 건강한'],
  ['sound는 명사 «소리» 외에 형용사로 «건전한, 타당한»(a sound argument / sound judgment), «(몸이) 건강한»(sound in body), «(잠이) 깊은»(a sound sleep)의 뜻이 있다.',
   '주어가 argument(논증)이고 「아무도 결점 하나 찾을 수 없었다」가 결과로 이어지므로 «논리적으로 타당한»이 알맞다.',
   '「(몸이) 건강한」도 sound의 뜻이지만 argument를 설명하는 말로는 맞지 않는다. 문맥에 맞는 뜻을 고르는 것이 핵심이다.'])

q(T, 5, '다음 <보기>의 문장에서 굵은 글씨로 표시한 단어의 뜻풀이가 바른 것만을 있는 대로 고른 것은?\n\n<보기>\n'
        'ㄱ. The results were **consistent** with our hypothesis. → 일치하는\n'
        'ㄴ. He gave a **candid** answer to the difficult question. → 솔직한\n'
        'ㄷ. The medicine had an **adverse** effect on her sleep. → 유익한\n'
        'ㄹ. The plan seemed **feasible** within our budget. → 실현 가능한\n'
        'ㅁ. She remained **indifferent** to the harsh criticism. → 민감한',
  'ㄱ, ㄴ, ㄹ',
  ['ㄱ, ㄷ', 'ㄴ, ㅁ', 'ㄱ, ㄴ, ㄷ', 'ㄴ, ㄹ, ㅁ'],
  ['ㄱ consistent with ~: ~와 일치하는(○). ㄴ candid: 솔직한(○). ㄹ feasible: 실현 가능한(○).',
   'ㄷ adverse: 해로운, 불리한(an adverse effect = 부작용, 악영향) — 「유익한」(beneficial)은 반대 뜻이다(✕).',
   'ㅁ indifferent to ~: ~에 무관심한 — 「민감한」(sensitive)은 반대 뜻이다(✕). 「가혹한 비판에도 무관심했다(개의치 않았다)」가 바른 해석이다.'])


# ══════════════════════════════════════════════════════════════
# u3m0s0t1 단어·문장/단어/단어 뜻/우리말을 영어로 (객관식)
# ══════════════════════════════════════════════════════════════
T = 'u3m0s0t1'

q(T, 1, '다음 우리말 뜻에 해당하는 영어 단어로 알맞은 것은?\n\n「결과, (행동의) 결말」',
  'consequence',
  ['confidence', 'conference', 'coincidence', 'convenience'],
  ['consequence = 결과, 결말. 예: face the consequences(결과를 감수하다).',
   '모두 con-/co-로 시작해 헷갈리기 쉽다: confidence(자신감), conference(회의), coincidence(우연의 일치), convenience(편리).'])

q(T, 2, '다음 우리말 뜻에 해당하는 영어 단어로 알맞은 것은?\n\n「강조하다」',
  'emphasize',
  ['empathize', 'summarize', 'criticize', 'organize'],
  ['emphasize = 강조하다(명사 emphasis). 예: emphasize the importance of safety(안전의 중요성을 강조하다).',
   '가장 헷갈리는 오답 empathize는 «공감하다»(명사 empathy)이다. summarize(요약하다), criticize(비판하다), organize(조직하다, 정리하다).'])

q(T, 3, '다음 우리말 뜻에 해당하는 영어 단어로 알맞은 것은?\n\n「(~하기를) 꺼리는, 마지못해 하는」',
  'reluctant',
  ['relevant', 'reliable', 'resilient', 'redundant'],
  ['reluctant = 꺼리는, 마지못해 하는. be reluctant to + 동사원형: ~하기를 꺼리다.',
   '오답: relevant(관련 있는), reliable(믿을 만한), resilient(회복력 있는), redundant(불필요한, 중복된) — 모두 re-로 시작하는 고3 필수 어휘이다.'])

q(T, 3, '다음 중 우리말 뜻과 영어 표현이 바르게 짝지어지지 «않은» 것은?',
  '~에 영향을 미치다 — take place',
  ['~을 설명하다, (비율을) 차지하다 — account for', '~에 의존하다 — depend on', '~을 없애다 — get rid of', '~을 고수하다 — stick to'],
  ['take place는 «(일이) 일어나다, 개최되다»라는 뜻이다. 「~에 영향을 미치다」는 affect / have an effect on / influence이다.',
   'account for(설명하다; 차지하다), depend on(의존하다), get rid of(없애다), stick to(고수하다) — 모두 바르다.'])

q(T, 4, '다음 우리말과 뜻이 같도록 빈칸에 들어갈 단어로 알맞은 것은?\n\n그 연구는 수면과 기억 사이의 밀접한 상관관계를 보여 준다.\n→ The study shows a close __________ between sleep and memory.',
  'correlation',
  ['collaboration', 'corporation', 'correction', 'contribution'],
  ['「상관관계」 = correlation. a correlation between A and B: A와 B 사이의 상관관계.',
   '오답: collaboration(협력), corporation(기업), correction(수정), contribution(기여) — 모두 co-/cor-로 시작해 헷갈리기 쉽다.'])

q(T, 5, '다음 (a)~(c)의 우리말 뜻에 해당하는 영어 단어를 <보기>에서 골라 바르게 짝지은 것은?\n\n(a) 취약한, 상처받기 쉬운\n(b) 모호한, 여러 뜻으로 해석되는\n(c) 번성하다, 잘 자라다\n\n<보기>\nvulnerable   versatile   ambiguous   ambitious   flourish   flatter',
  '(a) vulnerable  (b) ambiguous  (c) flourish',
  ['(a) versatile  (b) ambiguous  (c) flourish',
   '(a) vulnerable  (b) ambitious  (c) flourish',
   '(a) vulnerable  (b) ambiguous  (c) flatter',
   '(a) versatile  (b) ambitious  (c) flatter'],
  ['(a) vulnerable: 취약한(be vulnerable to ~: ~에 취약하다). versatile은 «다재다능한, 다용도의»이다.',
   '(b) ambiguous: 모호한. ambitious는 «야심 있는»이다.',
   '(c) flourish: 번성하다, 잘 자라다. flatter는 «아첨하다»이다.'])


# ══════════════════════════════════════════════════════════════
# u3m0s1t0 단어·문장/단어/철자/철자 쓰기 (객관식)
# ══════════════════════════════════════════════════════════════
T = 'u3m0s1t0'
발 = '다음 뜻에 해당하는 단어의 철자로 옳은 것은?'

q(T, 1, f'{발}\n\n「필요한」',
  'necessary',
  ['neccessary', 'necesary', 'neccesary', 'necessery'],
  ['necessary: c는 하나, s는 둘(ne-c-e-ss-a-ry).',
   '외우는 법: 셔츠에는 칼라(collar, c) 하나와 소매(sleeves, s) 두 개가 필요하다(necessary).',
   '끝은 -ary이다(-ery ✕).'])

q(T, 2, f'{발}\n\n「(사람을) 수용하다, 숙박시키다; (요구 등을) 받아들이다」',
  'accommodate',
  ['accomodate', 'acommodate', 'acomodate', 'accommadate'],
  ['accommodate: c도 둘, m도 둘(a-cc-o-mm-o-date). 명사 accommodation도 같다.',
   '가장 흔한 실수는 m을 하나만 쓰는 accomodate이다. 가운데 모음은 o(-commo-)이다.'])

q(T, 3, f'{발}\n\n「발생, 일어남」',
  'occurrence',
  ['occurence', 'ocurrence', 'occurrance', 'occurrense'],
  ['occur(발생하다)는 강세가 뒤에 있어 명사를 만들 때 r을 겹쳐 쓴다: occur → occurred, occurring, occurrence.',
   'c도 둘(o-cc-), r도 둘(-rr-)이고 끝은 -ence이다(-ance ✕, -ense ✕).'])

q(T, 3, f'{발}\n\n「특권, 특전」',
  'privilege',
  ['priviledge', 'privelege', 'privilage', 'previlege'],
  ['privilege: pri-vi-lege — i, i, e 순서이고 d가 없다.',
   '흔한 실수: knowledge에 끌려 d를 넣는 priviledge, 가운데 모음을 e로 쓰는 privelege, 끝을 -age로 쓰는 privilage.'])

q(T, 4, f'{발}\n\n「과장하다」',
  'exaggerate',
  ['exagerate', 'exaggarate', 'exxagerate', 'exaggerrate'],
  ['exaggerate: g는 둘, r은 하나(ex-a-gg-e-rate). 명사 exaggeration.',
   '흔한 실수: g를 하나만 쓰는 exagerate, r을 겹쳐 쓰는 exaggerrate, 가운데 e를 a로 쓰는 exaggarate.'])

q(T, 5, '다음 <보기>의 우리말 뜻에 해당하는 영어 단어의 철자가 모두 바르게 짝지어진 것은?\n\n<보기>\n양심적인 — 인내, 끈기 — 리듬',
  'conscientious — perseverance — rhythm',
  ['conscientious — perseverence — rhythm',
   'consciencious — perseverance — rhythm',
   'conscientious — perseverance — rythm',
   'conscentious — perseverence — rhythym'],
  ['conscientious(양심적인): science가 들어 있다고 기억한다(con-sci-en-tious). -cious ✕.',
   'perseverance(인내): 끝이 -ance이다(persevere + -ance). -ence ✕.',
   'rhythm(리듬): 모음 글자 없이 r-h-y-t-h-m. h가 두 번 들어간다.'])


# ══════════════════════════════════════════════════════════════
# u3m1s0t0 단어·문장/문장/문장 학습/문장 해석 (객관식)
# ══════════════════════════════════════════════════════════════
T = 'u3m1s0t0'
발 = '다음 문장의 해석으로 가장 알맞은 것은?'

q(T, 1, f'{발}\n\nThe book I borrowed from the library was more interesting than I had expected.',
  '내가 도서관에서 빌린 책은 예상했던 것보다 더 재미있었다.',
  ['내가 도서관에서 빌린 책은 예상했던 것만큼 재미있지는 않았다.',
   '나는 도서관에서 빌린 책이 더 재미있을 것이라고 예상했다.',
   '나는 재미있을 것 같은 책을 도서관에서 빌렸다.',
   '내가 도서관에 빌려준 책은 예상했던 것보다 더 재미있었다.'],
  ['주어: The book (that) I borrowed from the library — 목적격 관계대명사가 생략되어 «내가 도서관에서 빌린 책».',
   '동사·보어: was more interesting than I had expected — «(내가) 예상했던 것보다 더 재미있었다». 예상은 책을 읽기 전의 일이라 과거완료 had expected를 썼다.',
   'borrow는 «빌리다»(lend가 «빌려주다»)이고, 비교급 more ~ than은 «~보다 더»이다.'])

q(T, 2, f'{발}\n\nHaving finished her homework, she went out to meet her friends.',
  '숙제를 끝낸 뒤에, 그녀는 친구들을 만나러 나갔다.',
  ['숙제를 끝내기 위해, 그녀는 친구들을 만나러 나가지 않았다.',
   '그녀는 친구들을 만난 뒤에 숙제를 끝냈다.',
   '숙제를 끝내지 못해서, 그녀는 친구들을 만나지 못했다.',
   '그녀는 친구들과 함께 숙제를 끝내려고 나갔다.'],
  ['Having + p.p.는 완료 분사구문으로, 주절보다 «먼저» 일어난 일을 나타낸다: 숙제를 끝냄 → 그 뒤 나감.',
   '= After she had finished her homework, she went out to meet her friends.',
   'to meet her friends는 «친구들을 만나기 위해»라는 목적을 나타낸다.'])

q(T, 3, f'{발}\n\nIt was not until he lost his job that he realized the value of a steady income.',
  '그는 직장을 잃고 나서야 비로소 안정적인 수입의 가치를 깨달았다.',
  ['그는 직장을 잃기 전에 안정적인 수입의 가치를 깨달았다.',
   '그는 직장을 잃었지만 안정적인 수입의 가치를 깨닫지 못했다.',
   '그가 직장을 잃은 것은 안정적인 수입의 가치를 몰랐기 때문이다.',
   '그는 안정적인 수입의 가치를 깨닫고 나서 직장을 그만두었다.'],
  ['「It is[was] not until A that B」 = A하고 나서야 비로소 B하다.',
   '= He did not realize the value of a steady income until he lost his job. (직장을 잃을 때까지는 깨닫지 못했다 → 잃고 나서야 깨달았다.)',
   '깨달은 시점은 직장을 잃은 «뒤»이며, 결국 깨닫기는 했다는 점에 주의한다.'])

q(T, 3, f'{발}\n\nNot all the students agreed with the teacher\'s decision.',
  '모든 학생이 선생님의 결정에 동의한 것은 아니었다.',
  ['어떤 학생도 선생님의 결정에 동의하지 않았다.',
   '대부분의 학생이 선생님의 결정에 동의했다.',
   '학생들은 모두 선생님의 결정에 동의했다.',
   '선생님은 모든 학생의 결정에 동의하지는 않았다.'],
  ['not + all(every, always, both 등)은 «모두 ~한 것은 아니다»라는 부분 부정이다. 동의한 학생도 있고 동의하지 않은 학생도 있다는 뜻이다.',
   '「어떤 학생도 동의하지 않았다」는 전체 부정(None of the students agreed ~)이다.',
   '「대부분이 동의했다」는 문장에서 알 수 없는 정보이고, 동의한 주체는 선생님이 아니라 학생들이다.'])

q(T, 4, f'{발}\n\nWere it not for the Internet, it would be much harder to stay in touch with friends who live abroad.',
  '인터넷이 없다면, 해외에 사는 친구들과 연락하며 지내기가 훨씬 더 어려울 것이다.',
  ['인터넷이 없었더라면, 해외에 사는 친구들과 연락하며 지내기가 훨씬 더 어려웠을 것이다.',
   '인터넷이 있어서 해외에 사는 친구들과 연락하며 지내기가 더 어려워졌다.',
   '인터넷이 없어도 해외에 사는 친구들과 연락하며 지내기는 어렵지 않다.',
   '인터넷이 없을 때는 해외에 사는 친구들과 거의 연락하지 않았다.'],
  ['Were it not for ~ = If it were not for ~(~이 없다면): if를 생략하고 도치한 가정법 «과거»로, 현재 사실의 반대를 가정한다.',
   '주절도 would be(가정법 과거) → «~할 것이다». 따라서 현재 시점의 해석이 알맞다.',
   '매력적 오답 「없었더라면 ~어려웠을 것이다」는 가정법 과거완료(Had it not been for ~, it would have been ~)의 해석이다.'])

q(T, 5, '다음 <보기>의 문장 중 해석이 바른 것만을 있는 대로 고른 것은?\n\n<보기>\n'
        'ㄱ. Seldom does he complain about his work. → 그는 자기 일에 대해 좀처럼 불평하지 않는다.\n'
        'ㄴ. She could not have seen the accident. → 그녀는 그 사고를 봤어야 했다.\n'
        'ㄷ. The harder you practice, the more confident you will become. → 더 열심히 연습할수록, 너는 더 자신감이 생길 것이다.\n'
        'ㄹ. He is the last person to tell a lie. → 그는 거짓말을 한 마지막 사람이다.',
  'ㄱ, ㄷ',
  ['ㄱ, ㄴ', 'ㄴ, ㄹ', 'ㄱ, ㄷ, ㄹ', 'ㄴ, ㄷ, ㄹ'],
  ['ㄱ(○): 부정어 Seldom(좀처럼 ~ 않는)이 앞으로 나가 does he complain으로 도치되었다.',
   'ㄴ(✕): could not have + p.p.는 «~했을 리가 없다»(과거에 대한 강한 부정 추측)이다. 「봤어야 했다」는 should have seen이다. → 그녀가 그 사고를 봤을 리가 없다.',
   'ㄷ(○): the + 비교급 ~, the + 비교급 … = ~할수록 더 …하다.',
   'ㄹ(✕): the last person to + 동사원형은 «결코 ~하지 않을 사람»이다. → 그는 결코 거짓말을 할 사람이 아니다.'])


# ══════════════════════════════════════════════════════════════
# u3m1s0t1 단어·문장/문장/문장 학습/문장 빈칸 채우기 (객관식)
# ══════════════════════════════════════════════════════════════
T = 'u3m1s0t1'
발 = '다음 문장의 빈칸에 들어갈 말로 알맞은 것은?'

q(T, 1, f'{발}\n\nShe has lived in this city __________ she was ten years old.',
  'since',
  ['for', 'during', 'while', 'until'],
  ['현재완료(has lived)와 함께 «~ 이후로 (지금까지)»라는 기준 시점을 나타낼 때는 since를 쓴다. since 뒤에는 과거 시점의 절(she was ten years old)이 온다.',
   'for는 기간(for ten years), during은 명사(during the summer) 앞에 쓰며 절을 이끌지 못한다. while·until은 현재완료의 기준 시점을 나타내지 않는다.',
   '해석: 그녀는 열 살 때부터 이 도시에 살아 왔다.'])

q(T, 2, f'{발}\n\nThe man __________ car was stolen last night called the police immediately.',
  'whose',
  ['who', 'whom', 'which', 'that'],
  ['빈칸 뒤 car는 «그 남자의 차»이다. 선행사(the man)와 뒤의 명사(car)가 소유 관계이므로 소유격 관계대명사 whose.',
   'who·whom·which·that 뒤에는 명사가 바로 붙어 «~의 명사»를 만들 수 없다.',
   '해석: 어젯밤 차를 도둑맞은 그 남자는 즉시 경찰에 전화했다.'])

q(T, 3, f'{발}\n\nIf I __________ enough money, I would buy a new laptop right away.',
  'had',
  ['have', 'will have', 'had had', 'would have'],
  ['주절이 would buy(조동사 과거 + 동사원형)이므로 현재 사실의 반대를 가정하는 가정법 과거이다. if절에는 동사의 과거형 had를 쓴다.',
   'had had는 가정법 과거완료(주절 would have bought)에, have·will have는 직설법 조건문(주절 will buy)에 쓴다. if절에는 would를 쓰지 않는다.',
   '해석: 돈이 충분히 있다면, 나는 새 노트북을 당장 살 텐데.'])

q(T, 3, f'{발}\n\nIt is essential that every applicant __________ the form by Friday.',
  'submit',
  ['to submit', 'submitted', 'will submit', 'submitting'],
  ['essential(필수적인), necessary, important 같은 «필요·당위»의 형용사 뒤 that절에는 (should) + 동사원형을 쓴다 → (should) submit.',
   '주어가 every applicant(3인칭 단수)라도 -s를 붙이지 않고 동사원형을 쓰는 것이 이 구문의 핵심이다. that절의 동사 자리이므로 to submit·submitting은 올 수 없다.',
   '해석: 모든 지원자가 금요일까지 서류를 제출하는 것이 필수적이다.'])

q(T, 4, f'{발}\n\nThe new evidence was so __________ that even the most skeptical members of the committee were convinced.',
  'compelling',
  ['trivial', 'ambiguous', 'irrelevant', 'fragile'],
  ['so ~ that 구문: 증거가 «너무 ~해서» 가장 회의적인 위원들조차 «확신하게 되었다». 따라서 설득력 있는 증거여야 한다 → compelling(설득력 있는, 강력한).',
   'trivial(사소한), ambiguous(모호한), irrelevant(관련 없는), fragile(깨지기 쉬운, 취약한)은 모두 설득하지 «못하는» 증거를 묘사하므로 결과와 어긋난다.',
   '해석: 새 증거가 너무 설득력이 있어서 위원회에서 가장 회의적인 위원들조차 확신하게 되었다.'])

q(T, 5, '다음 두 문장의 빈칸에 공통으로 들어갈 말로 알맞은 것은?\n\n(a) Hardly __________ we arrived at the station when it began to rain heavily.\n(b) __________ I known the answer, I would have told you right away.',
  'had',
  ['did', 'have', 'were', 'should'],
  ['(a) 「Hardly + had + 주어 + p.p. ~ when + 과거」 = ~하자마자 …했다. 부정어 Hardly가 앞에 와 had we arrived로 도치된다. (did we arrived는 did 뒤에 과거형이 와서 틀리다.)',
   '(b) If I had known the answer에서 if를 생략하고 도치한 가정법 과거완료 → Had I known ~. 주절 would have told와 호응한다.',
   'were·should도 if 생략 도치에 쓰이지만, 뒤에 known(과거분사)과 결합하는 것은 had뿐이다.'])


# ══════════════════════════════════════════════════════════════
save(os.path.expanduser('~/hakseupji-deploy/_gen/eng-h3/p-seed.json'))
짧 = [(t, w) for t, w in WC if w < 160]
print('독해 지문 단어 수 범위:', min(w for t, w in WC if t.startswith(('u0', 'u1'))), '~', max(w for t, w in WC))
print('160단어 미만 지문(서술형 짧은 지문 포함):', 짧)
