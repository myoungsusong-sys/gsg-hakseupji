# 중3 영어(eng-m3) 빈 유형 채우기 — 5유형 × 6문항 (2026-09-28 · jobH)
# 지문은 전부 직접 창작. 발문·풀이는 한국어.
import sys, os; sys.path.insert(0, '/private/tmp/claude-501/-Users-songmyeongsumaegbug-eeo-Library-Mobile-Documents-com-apple-CloudDocs-08------AI/19f5d8ef-bdd5-411c-80d8-fdf503e62ef1/scratchpad/korgen')
import lib; lib.COURSE = 'eng-m3'
from lib import q, qf, s, save

F = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ']


def P(발문, 지문, 뒤=''):
    return f'{발문}\n\n{지문}' + (f'\n\n{뒤}' if 뒤 else '')


# ══════════════════════════════════════════════════════════════
# u0m0s0t1 독해/대의 파악/주제 파악/주제문 찾기
# ══════════════════════════════════════════════════════════════
T = 'u0m0s0t1'

qf(T, 1, P('다음 글의 ⓐ~ⓔ 중, 글 전체의 중심 내용을 담은 주제문으로 가장 적절한 것은?',
           'ⓐ Eating breakfast is one of the best ways to start your day well. '
           'ⓑ After a long night\'s sleep, your body needs energy, and a good breakfast gives it that energy. '
           'ⓒ Students who eat breakfast can focus better in class because their brains get enough fuel. '
           'ⓓ They also tend to feel less tired and are less likely to eat unhealthy snacks before lunch. '
           'ⓔ Even a simple meal, such as a banana and a glass of milk, can make a big difference. '
           'It takes only five minutes to prepare, but its effects last all morning. '
           'So tomorrow morning, don\'t skip breakfast, even if you are in a hurry.'),
   F, 0,
   ['ⓐ 「아침 식사는 하루를 잘 시작하는 가장 좋은 방법 중 하나이다.」 — 글 전체가 말하려는 중심 내용을 첫 문장에서 먼저 제시했다.',
    'ⓑ(에너지 공급), ⓒ(수업 집중), ⓓ(피로·간식 줄이기), ⓔ(간단한 식사도 효과)는 모두 ⓐ를 뒷받침하는 근거와 예시이다.',
    '대표 오답 ⓒ는 아침 식사의 여러 좋은 점 가운데 «집중력» 하나만 말한 세부 내용이라 주제문이 될 수 없다.'])

qf(T, 2, P('다음 글의 ⓐ~ⓔ 중, 글의 주제문으로 가장 적절한 것은?',
           'ⓐ When you read a book aloud, you have to look at every word carefully. '
           'ⓑ You also hear the words with your own ears, so you remember them longer. '
           'ⓒ If you make a mistake in pronunciation, you can notice it and fix it right away. '
           'ⓓ Moreover, reading aloud helps you get used to the rhythm of English sentences, which makes speaking easier. '
           'ⓔ In short, reading aloud is a simple but powerful way to improve your English. '
           'It may feel a little strange at first, but you will soon get used to hearing your own voice. '
           'Try reading one page aloud every day, and you will see the change in a few months.'),
   F, 4,
   ['ⓔ 「요컨대, 소리 내어 읽기는 영어 실력을 높이는 간단하지만 강력한 방법이다.」 — In short(요컨대)로 앞의 내용을 정리하며 중심 생각을 말한다.',
    'ⓐ~ⓓ는 소리 내어 읽기의 구체적인 장점(단어를 꼼꼼히 봄, 귀로 들어 오래 기억, 발음 실수 교정, 문장 리듬 익히기)을 하나씩 든 뒷받침 문장이다.',
    '대표 오답 ⓓ는 Moreover(게다가)로 장점을 하나 더 덧붙인 세부 내용일 뿐이다. 뒷받침 문장들을 먼저 늘어놓고 뒷부분에서 중심 생각을 정리하는 구성이다(뒤의 두 문장은 독자에게 주는 격려와 권유).'])

qf(T, 3, P('다음 글에서 글쓴이가 전하려는 중심 생각이 담긴 문장으로 가장 적절한 것은?',
           'ⓐ Last summer, my family visited a small village in the mountains. '
           'ⓑ There was no Internet there, and at first I felt bored and kept checking my phone out of habit. '
           'ⓒ However, the trip taught me that we can enjoy life more when we take a break from our smartphones. '
           'ⓓ Without my phone, I talked with my parents for hours and noticed the beautiful stars at night. '
           'ⓔ I also read two books that I had wanted to read for a long time. '
           'Since then, I have turned off my phone for one hour every evening. I feel more relaxed, and I sleep better, too.'),
   F, 2,
   ['ⓒ 「그러나 그 여행은 스마트폰에서 잠시 벗어날 때 삶을 더 즐길 수 있다는 것을 나에게 가르쳐 주었다.」가 글쓴이가 깨달은 중심 생각이다.',
    'ⓐ, ⓑ는 경험을 소개하는 도입부이고, However 뒤의 ⓒ에서 깨달음을 말한 다음 ⓓ, ⓔ에서 부모님과의 대화·별 보기·독서라는 구체적 경험으로 뒷받침한다.',
    '대표 오답 ⓐ는 여행을 갔다는 사실(배경)만 말할 뿐 글쓴이의 생각이 담겨 있지 않다. 주제문이 글 가운데에 오는 중괄식 구성이다.'])

q(T, 3, P('다음 글의 빈칸에 들어갈 주제문으로 가장 알맞은 것은?',
          '__________________. Honeybees carry pollen from flower to flower, which helps plants produce fruits and seeds. '
          'Without them, many foods that we enjoy, such as apples, strawberries, and almonds, would become rare and expensive. '
          'Some farmers even rent beehives to make sure that their crops get enough visits from bees. '
          'Bees also help wild plants grow, and these plants provide food and homes for many other animals, from birds to insects. '
          'Sadly, the number of bees has been decreasing because of pesticides and the loss of flowers. '
          'If bees disappeared, the whole food chain could be in danger. '
          'That is why many people are now planting bee-friendly flowers in their gardens.'),
  'Bees play an important role in our food and in nature.',
  ['Bees make honey that is much sweeter than sugar.',
   'Pesticides are the only reason that bees are dying.',
   'Apples and strawberries are the most popular fruits.',
   'Birds and insects need bees to build their homes.'],
  ['빈칸 뒤 문장들은 꿀벌이 꽃가루를 옮겨 열매를 맺게 하고(음식), 야생 식물이 자라도록 도와 다른 동물의 먹이·집이 되게 한다(자연)는 내용이다.',
   '마지막 문장 「벌이 사라지면 먹이 사슬 전체가 위험해질 수 있다」까지 모두 «벌이 우리 음식과 자연에서 중요한 역할을 한다»는 주제문을 뒷받침한다.',
   '오답: 꿀의 단맛은 글에 없고, 농약은 원인 중 하나로만 언급되었으며(only가 틀림), 사과·딸기는 예시일 뿐이고, 새와 곤충의 «집»을 벌이 짓는 데 필요하다는 말은 글과 다르다.'])

qf(T, 4, P('다음 글의 ⓐ~ⓔ 중, 글의 주제문으로 가장 적절한 것은?',
           'ⓐ Have you ever wondered why some people seem to learn new skills so quickly? '
           'ⓑ The secret is not talent but the habit of practicing a little every day. '
           'ⓒ A person who practices the piano for twenty minutes every day will usually play better than someone who practices for three hours only on Sundays. '
           'ⓓ This is because our brains remember things better when we repeat them often. '
           'ⓔ Short, regular practice also keeps us from getting too tired or bored. '
           'So if you want to get better at something, don\'t wait for a free weekend; start with just a few minutes today.'),
   F, 1,
   ['ⓑ 「그 비결은 재능이 아니라 매일 조금씩 연습하는 습관이다.」 — ⓐ의 질문에 대한 답으로 글 전체의 중심 생각을 제시한다.',
    'ⓒ는 피아노 연습의 예시, ⓓ는 그 이유(자주 반복하면 더 잘 기억함), ⓔ는 또 다른 장점(지치거나 지루해지지 않음)으로 모두 ⓑ를 뒷받침한다.',
    '대표 오답 ⓐ는 독자의 관심을 끌기 위한 질문일 뿐 답(중심 생각)이 아니고, ⓓ는 예시에 대한 이유를 설명하는 세부 문장이다.'])

qf(T, 5, P('다음 글의 ⓐ~ⓔ 중, 글쓴이의 중심 생각을 담은 주제문으로 가장 적절한 것은?',
           'ⓐ Many people believe that making mistakes is something to be ashamed of. '
           'ⓑ In class, some students don\'t raise their hands because they are afraid of giving a wrong answer. '
           'ⓒ They think that a person who never makes mistakes is the smartest person in the room. '
           'ⓓ However, mistakes are actually one of the most important steps in learning. '
           'ⓔ When you get something wrong, your brain pays special attention to the correct answer, so you remember it longer. '
           'Mistakes also show us exactly what we still need to learn. '
           'So the next time you make a mistake, think of it as a chance to learn something new.'),
   F, 3,
   ['ⓐ~ⓒ는 «실수는 부끄러운 것»이라는 많은 사람들의 생각(통념)을 소개한 부분이다.',
    'ⓓ 「그러나 실수는 사실 배움에서 가장 중요한 단계 중 하나이다.」 — However로 통념을 뒤집으며 글쓴이의 중심 생각을 드러낸다. ⓔ와 마지막 문장은 그 근거와 당부이다.',
    '대표 오답 ⓐ는 글쓴이가 반박하려는 통념이지 글쓴이의 생각이 아니다. 「Many people believe ~ / However ~」 구조에서는 However 뒤가 주제문인 경우가 많다.'])


# ══════════════════════════════════════════════════════════════
# u0m0s2t1 독해/대의 파악/요지 파악/필자의 주장
# ══════════════════════════════════════════════════════════════
T = 'u0m0s2t1'

q(T, 1, P('다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
          'Every day, students at our school throw away hundreds of plastic cups. '
          'Most of them are used only once for a few minutes and then end up in the trash can. '
          'These cups take hundreds of years to break down, and many of them go into the sea. '
          'I think every student should bring their own tumbler to school. '
          'A tumbler can be used again and again, and it keeps drinks cold or hot for a long time. '
          'If each of us uses a tumbler instead of plastic cups, we can reduce a lot of waste. '
          'Let\'s start this small change tomorrow.'),
  '학생들은 학교에 개인 텀블러를 가지고 다녀야 한다.',
  ['플라스틱 컵은 재활용 통에 분리해서 버려야 한다.',
   '학교 매점에서 음료 판매를 금지해야 한다.',
   '바다 쓰레기를 줍는 봉사 활동에 참여해야 한다.',
   '텀블러는 뜨거운 음료를 마실 때만 사용해야 한다.'],
  ['필자의 주장은 「I think every student should bring their own tumbler to school.(나는 모든 학생이 학교에 자기 텀블러를 가져와야 한다고 생각한다.)」에 직접 드러난다.',
   '앞부분(플라스틱 컵이 한 번 쓰이고 버려져 수백 년 동안 썩지 않음)은 주장의 이유이고, 뒷부분(텀블러는 계속 쓸 수 있어 쓰레기를 줄임)은 근거이다.',
   '분리배출·매점 판매 금지·바다 쓰레기 줍기는 글에서 말하지 않았고, 텀블러는 차가운 음료와 뜨거운 음료 모두에 좋다고 했다.'])

q(T, 2, P('다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
          'Many students stay up late to study for exams. '
          'They believe that sleeping less gives them more time to learn. '
          'But this is not a good idea. '
          'While we sleep, our brains organize and store the information we learned during the day. '
          'If we don\'t get enough sleep, we can\'t remember what we studied, and we make careless mistakes on the test. '
          'Even one night without enough sleep can make it harder to think clearly the next day. '
          'So instead of studying until 2 a.m., go to bed early and get at least eight hours of sleep, especially before an exam. '
          'A rested brain works much better than a tired one.'),
  '시험 전일수록 늦게까지 공부하기보다 충분히 자야 한다.',
  ['시험 공부는 밤늦게 하는 것이 가장 효과적이다.',
   '공부한 내용은 잠들기 직전에 한 번 더 복습해야 한다.',
   '실수를 줄이려면 시험 문제를 두 번씩 읽어야 한다.',
   '수업 시간에 졸지 않으려면 낮잠을 자지 말아야 한다.'],
  ['「So instead of studying until 2 a.m., go to bed early and get at least eight hours of sleep, especially before an exam.(그러니 새벽 2시까지 공부하는 대신, 특히 시험 전에는 일찍 자서 적어도 8시간은 자라.)」가 필자의 주장이다.',
   '근거: 자는 동안 뇌가 낮에 배운 정보를 정리·저장하고, 잠이 부족하면 공부한 것을 기억하지 못하고 실수를 한다.',
   '「밤늦게 공부하는 것이 효과적」은 필자가 반대하는 생각이고(But this is not a good idea), 잠들기 전 복습·문제 두 번 읽기·낮잠 금지는 글에 나오지 않는다.'])

q(T, 3, P('다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
          'When you look at social media, it seems that everyone else is having a perfect life. '
          'Your friends post pictures of delicious food, beautiful places, and happy moments. '
          'Then you may feel that your own life is boring. '
          'But remember that people usually share only their best moments online. '
          'Nobody posts a picture of themselves doing homework on a rainy Sunday or arguing with their brother. '
          'Comparing your everyday life with someone else\'s best moments is not fair to yourself. '
          'Instead of measuring your happiness by other people\'s posts, pay attention to the small good things in your own day.'),
  'SNS 속 다른 사람의 모습과 자신의 삶을 비교하지 말아야 한다.',
  ['SNS에는 자신의 일상을 꾸밈없이 올려야 한다.',
   '친구의 게시물에 적극적으로 반응해 주어야 한다.',
   '행복한 순간은 사진으로 남겨 두어야 한다.',
   'SNS 사용 시간을 하루 한 시간으로 제한해야 한다.'],
  ['마지막 문장 「Instead of measuring your happiness by other people\'s posts, pay attention to the small good things in your own day.(다른 사람의 게시물로 네 행복을 재는 대신, 네 하루의 작은 좋은 일에 관심을 기울여라.)」가 주장이다.',
   '근거: 사람들은 SNS에 가장 좋은 순간만 올리므로, 나의 평범한 일상을 남의 가장 좋은 순간과 비교하는 것은 스스로에게 공정하지 않다.',
   '일상을 꾸밈없이 올리라거나 사용 시간을 제한하라는 말은 없다. 「사람들이 좋은 순간만 올린다」는 사실을 말했을 뿐, 올리는 방식을 바꾸라고 주장하지 않았다.'])

q(T, 3, P('다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
          'Many parents do everything for their children. '
          'They clean their children\'s rooms, pack their bags, and even do their homework for them. '
          'They do this because they love their children, but it can actually be harmful. '
          'Children who never do things for themselves don\'t learn how to solve problems on their own. '
          'Doing chores such as washing dishes or folding laundry teaches them responsibility and makes them feel that they are important members of the family. '
          'If you are a parent, give your child a few simple tasks at home, even if they don\'t do them perfectly at first.'),
  'Parents should let their children do some housework by themselves.',
  ['Parents should do their children\'s homework to help them.',
   'Children should spend more time playing outside.',
   'Parents should praise their children only when they do things perfectly.',
   'Families should hire someone to do the housework.'],
  ['마지막 문장 「If you are a parent, give your child a few simple tasks at home, even if they don\'t do them perfectly at first.(부모라면 처음에는 완벽하게 하지 못하더라도 아이에게 집안일 몇 가지를 맡겨라.)」가 필자의 주장이다.',
   '근거: 스스로 해 보지 않은 아이는 문제 해결법을 배우지 못하고, 설거지·빨래 개기 같은 집안일은 책임감과 가족 구성원으로서의 소속감을 길러 준다.',
   '숙제를 대신해 주는 것은 필자가 해롭다고 한 행동이고, «완벽할 때만 칭찬»은 «완벽하지 않아도 맡겨라»와 어긋난다. 바깥 놀이·가사 도우미는 글에 없다.'])

q(T, 4, P('다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
          'These days, we almost never feel bored. '
          'Whenever we have a free moment, such as waiting for a bus, we take out our phones and start scrolling. '
          'It seems like a great way to kill time, but we may be losing something valuable. '
          'Many people get their best ideas when their minds are free to wander. '
          'When there is nothing to entertain us, our brains start to imagine, plan, and connect ideas in new ways. '
          'The next time you have a few minutes with nothing to do, leave your phone in your pocket. '
          'Being bored for a while might be exactly what your mind needs.'),
  '잠깐의 빈 시간을 스마트폰으로 채우지 말고 지루함을 느껴 보아야 한다.',
  ['버스를 기다리는 시간을 공부하는 데 활용해야 한다.',
   '떠오른 좋은 아이디어는 반드시 메모해 두어야 한다.',
   '지루함을 없애기 위해 다양한 취미를 가져야 한다.',
   '창의력을 기르는 스마트폰 앱을 사용해야 한다.'],
  ['「The next time you have a few minutes with nothing to do, leave your phone in your pocket.(다음번에 할 일 없는 몇 분이 생기면 휴대 전화를 주머니에 그대로 두어라.)」와 「잠시 지루해하는 것이 바로 네 마음에 필요한 것일지도 모른다」가 주장이다.',
   '근거: 마음이 자유롭게 떠돌 때 좋은 아이디어가 떠오르고, 즐길 거리가 없을 때 뇌가 상상하고 계획하며 생각을 새롭게 연결한다.',
   '「지루함을 없애기 위해 취미를 가져라」는 지루함을 «느껴 보라»는 필자의 주장과 반대이고, 빈 시간 공부·메모·앱 사용은 글에 없다.'])

q(T, 5, P('다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
          'When a child gets a good grade, it is natural to say, "You\'re so smart!" '
          'Of course, such words make the child feel good, and there is nothing wrong with wanting to encourage children. '
          'However, children who are often praised for being smart may start to avoid difficult tasks. '
          'They worry that if they fail, people will no longer think they are smart. '
          'On the other hand, children who hear "You worked really hard on this!" learn that effort leads to success. '
          'They are more willing to take on challenges and keep trying even when things get hard. '
          'So when you praise children, focus on how hard they tried, not on how clever they are.'),
  '아이를 칭찬할 때는 똑똑함보다 노력에 초점을 맞추어야 한다.',
  ['칭찬은 아이를 약하게 만들므로 되도록 삼가야 한다.',
   '아이가 좋은 성적을 받았을 때만 칭찬해 주어야 한다.',
   '아이가 실패하지 않도록 쉬운 과제를 주어야 한다.',
   '아이의 타고난 재능을 일찍 찾아 길러 주어야 한다.'],
  ['마지막 문장 「So when you praise children, focus on how hard they tried, not on how clever they are.(그러니 아이를 칭찬할 때는 얼마나 똑똑한지가 아니라 얼마나 열심히 노력했는지에 초점을 맞춰라.)」가 주장이다.',
   '필자는 Of course ~ 에서 «격려하고 싶은 마음 자체는 잘못이 아니다»라고 인정(양보)한 뒤, However 이하에서 «똑똑하다는 칭찬»의 문제(어려운 과제를 피함)와 «노력 칭찬»의 효과(도전하고 끝까지 해 봄)를 대비한다.',
   '매력적 오답 「칭찬을 삼가야 한다」는 틀렸다 — 필자는 칭찬 자체가 아니라 칭찬의 «초점»을 바꾸라고 했다. 쉬운 과제를 주라는 것은 도전을 강조한 글과 반대이다.'])


# ══════════════════════════════════════════════════════════════
# u0m1s4t1 독해/세부 내용 파악/질문 확인/도표·안내문 세부 정보
# ══════════════════════════════════════════════════════════════
T = 'u0m1s4t1'

q(T, 1, P('다음 안내문의 내용과 일치하는 것은?',
          'Greenfield Middle School Book Fair\n\n'
          '• When: Monday, November 9 – Friday, November 13\n'
          '• Time: 8:30 a.m. – 4:00 p.m.\n'
          '• Where: School Library (2nd floor)\n\n'
          '- More than 500 books will be on sale.\n'
          '- All books are 30% off.\n'
          '- You can pay by cash or card.\n'
          '- Bring two old books, and you\'ll get a free bookmark.\n\n'
          'For more information, visit the library or ask Ms. Park.'),
  '모든 책은 30% 할인된 가격으로 판매된다.',
  ['행사는 학교 체육관에서 열린다.',
   '책값은 현금으로만 낼 수 있다.',
   '헌 책 한 권을 가져오면 책갈피를 받는다.',
   '행사는 매일 오후 5시에 끝난다.'],
  ['「All books are 30% off.(모든 책이 30% 할인된다.)」와 일치한다.',
   '장소는 2층 학교 도서관(School Library)이고, 현금과 카드 모두 가능(cash or card)하며, 헌 책을 «두 권» 가져와야 책갈피를 받고, 행사는 오후 4시에 끝난다.'])

q(T, 2, P('다음 안내문의 내용과 일치하지 «않는» 것은?',
          'Summer Swimming Class for Teens\n\n'
          'Learn to swim safely this summer!\n\n'
          '• Dates: July 20 – August 7 (Mondays, Wednesdays, and Fridays)\n'
          '• Time: 10:00 a.m. – 11:30 a.m.\n'
          '• Place: Riverside Community Pool\n'
          '• Who: Students aged 13 to 16\n'
          '• Fee: 60,000 won (Swimming caps are provided for free.)\n'
          '• What to bring: swimsuit, towel, and goggles\n\n'
          '※ Sign up at the front desk of the pool by July 15.'),
  '수영모는 각자 준비해 와야 한다.',
  ['수업은 일주일에 세 번 있다.',
   '13세에서 16세까지의 학생이 참가할 수 있다.',
   '한 번의 수업 시간은 1시간 30분이다.',
   '7월 15일까지 수영장 안내 데스크에서 신청해야 한다.'],
  ['「Swimming caps are provided for free.(수영모는 무료로 제공된다.)」 — 수영모는 준비할 필요가 없으므로 «각자 준비해 와야 한다»는 일치하지 않는다. 준비물은 수영복·수건·물안경이다.',
   '월·수·금 = 주 3회, 10:00~11:30 = 1시간 30분, 대상 13~16세, 7월 15일까지 안내 데스크(front desk)에서 신청 — 나머지는 모두 일치한다.'])

q(T, 3, P('다음 안내문을 읽고 알 수 «없는» 것은?',
          'Hanbit Middle School Talent Show\n\n'
          'Show us your talent!\n\n'
          '• Date: Friday, December 4\n'
          '• Time: 3:00 p.m. – 5:00 p.m.\n'
          '• Place: School Auditorium\n'
          '• Who can join: All Hanbit students (alone or in teams of up to 5 people)\n'
          '• Each performance must be shorter than 5 minutes.\n'
          '• Sign up by November 20 at the student council room.\n'
          '• Prizes: 1st place – a 50,000 won gift card / 2nd place – movie tickets for the team\n'
          '• Judges: three teachers and two student council members'),
  '공연 순서를 정하는 방법',
  ['참가 신청 장소',
   '한 팀의 최대 인원',
   '공연 한 편의 제한 시간',
   '심사위원의 구성'],
  ['신청 장소는 학생회실(student council room), 한 팀은 최대 5명(up to 5 people), 공연은 5분 미만(shorter than 5 minutes), 심사위원은 교사 3명과 학생회 임원 2명이다.',
   '공연 순서를 어떻게 정하는지는 안내문 어디에도 나오지 않으므로 알 수 없다.'])

q(T, 3, P('15세인 민지는 토요일에 아버지(45세), 남동생(5세)과 함께 다음 과학관에 가서, 세 사람 모두 플라네타륨 쇼도 보려고 한다. 안내문에 따라 세 사람이 내야 할 금액의 합계는?',
          'City Science Museum – Admission\n\n'
          '• Adults (19 and over): 8,000 won\n'
          '• Teenagers (13–18): 5,000 won\n'
          '• Children (7–12): 3,000 won\n'
          '• Under 7: Free\n\n'
          '- Planetarium show: 2,000 won extra per person (free for children under 7)\n'
          '- Groups of 10 or more get 10% off admission.\n'
          '- Closed on Mondays'),
  '17,000원',
  ['13,000원', '15,000원', '19,000원', '20,000원'],
  ['입장료: 아버지(성인) 8,000원 + 민지(13~18세 청소년) 5,000원 + 남동생(7세 미만) 무료 = 13,000원.',
   '플라네타륨 쇼: 1인당 2,000원 추가인데 7세 미만은 무료이므로 아버지·민지 2명 × 2,000원 = 4,000원.',
   '합계 13,000원 + 4,000원 = 17,000원. (세 명은 10명 이상 단체가 아니므로 할인 없음. 남동생의 쇼 요금까지 더하면 19,000원이 되는 함정에 주의.)'])

q(T, 4, P('다음 캠프 일정표에 대한 설명으로 옳은 것은?',
          'Sunny English Camp – Daily Schedule\n'
          '(Camp period: August 3 – August 7)\n\n'
          '09:00 – 09:50  Morning Speaking (Room 101)\n'
          '10:00 – 11:30  Project Class (Room 203)\n'
          '11:30 – 12:30  Lunch (Cafeteria)\n'
          '12:30 – 13:20  Movie English (Room 105)\n'
          '13:30 – 15:00  Outdoor Activity (Playground)\n'
          '   * On rainy days, Board Games in Room 101 instead of the outdoor activity\n'
          '15:10 – 15:40  Daily Review & Diary Writing (Room 203)\n\n'
          '※ Please bring your own water bottle.'),
  '비가 오는 날에는 오후 1시 30분부터 101호에서 보드게임을 한다.',
  ['점심 시간은 30분이다.',
   '하루 일과는 오후 3시에 모두 끝난다.',
   '영화로 배우는 영어 수업은 203호에서 한다.',
   '프로젝트 수업은 하루에 두 번 있다.'],
  ['13:30~15:00 야외 활동은 «비 오는 날에는 101호 보드게임으로 대신한다»는 별표(*) 안내가 있으므로, 비 오는 날 오후 1시 30분부터 101호에서 보드게임을 한다.',
   '점심은 11:30~12:30으로 1시간이고, 마지막 일과(복습·일기 쓰기)가 15:40에 끝나며, Movie English는 105호, Project Class는 하루 한 번(10:00~11:30)뿐이다.'])

q(T, 5, P('다음 안내문의 내용과 일치하는 것만을 <보기>에서 있는 대로 고른 것은?',
          'Weekend Volunteer Program at Happy Animal Shelter\n\n'
          'We are looking for volunteers to take care of our dogs and cats!\n\n'
          '• When: Every Saturday, 10:00 a.m. – 2:00 p.m.\n'
          '• Who: Anyone aged 14 or older\n'
          '   (Volunteers under 16 must come with a parent.)\n'
          '• Tasks: walking dogs, cleaning cages, feeding animals\n'
          '• Volunteers who join 3 times or more will receive a certificate.\n'
          '• Please wear comfortable clothes. Lunch is not provided.\n'
          '• To apply, send an email to the shelter by Wednesday of each week.',
          '<보기>\nㄱ. 15세인 수진이는 혼자서 봉사 활동에 참여할 수 있다.\n'
          'ㄴ. 봉사 활동은 하루에 4시간 동안 진행된다.\n'
          'ㄷ. 봉사 활동에 두 번 참여하면 확인서를 받을 수 있다.\n'
          'ㄹ. 점심 식사는 참가자가 각자 해결해야 한다.'),
  'ㄴ, ㄹ',
  ['ㄱ, ㄴ', 'ㄱ, ㄷ', 'ㄴ, ㄷ', 'ㄷ, ㄹ'],
  ['ㄱ(×): 14세 이상이면 참가할 수 있지만, 「Volunteers under 16 must come with a parent.(16세 미만은 부모와 함께 와야 한다.)」이므로 15세 수진이는 혼자 올 수 없다.',
   'ㄴ(○): 오전 10시~오후 2시 = 4시간. ㄷ(×): 확인서는 «3회 이상» 참여해야 받는다. ㄹ(○): 「Lunch is not provided.(점심은 제공되지 않는다.)」',
   '일치하는 것은 ㄴ, ㄹ이다.'])


# ══════════════════════════════════════════════════════════════
# u0m2s0t0 독해/글의 흐름 파악/무관한 문장/전체 흐름과 관계 없는 문장
# ══════════════════════════════════════════════════════════════
T = 'u0m2s0t0'
발 = '다음 글에서 전체 흐름과 관계 없는 문장은?'

qf(T, 1, P(발,
           'Dolphins are known as one of the smartest animals in the world. '
           'ⓐ They can learn to follow many different signals from their trainers and remember them for a long time. '
           'ⓑ They also use special whistles and clicks to communicate with other dolphins in their group. '
           'ⓒ Many people enjoy swimming in the sea during summer vacation. '
           'ⓓ Some dolphins have even been seen using sea sponges to protect their noses while they look for food. '
           'ⓔ Scientists also believe that dolphins can recognize themselves in a mirror. '
           'Because of these abilities, many scientists study dolphins to learn more about how intelligence develops in animals.'),
   F, 2,
   ['첫 문장 「돌고래는 세상에서 가장 영리한 동물 중 하나로 알려져 있다.」가 주제이다.',
    'ⓐ 신호 학습, ⓑ 소리로 의사소통, ⓓ 해면(sea sponge)을 도구로 사용, ⓔ 거울 속 자신을 알아봄 — 모두 돌고래의 영리함을 보여 주는 예이다.',
    'ⓒ 「많은 사람들이 여름 방학에 바다 수영을 즐긴다.」는 돌고래의 지능과 관계없는 문장이다.'])

qf(T, 2, P(발,
           'Planting trees in cities brings many benefits to the people who live there. '
           'ⓐ Trees clean the air by taking in harmful gases and giving off fresh oxygen. '
           'ⓑ In summer, they give cool shade and can lower the temperature of the streets by a few degrees. '
           'ⓒ They also make the city look beautiful and give birds a place to live. '
           'ⓓ Some trees, such as pine trees, stay green even in the cold winter. '
           'ⓔ Studies show that people who live near green spaces feel less stressed and more relaxed. '
           'That is why many cities are planting more trees along their roads and in their parks.'),
   F, 3,
   ['첫 문장 「도시에 나무를 심는 것은 그곳에 사는 사람들에게 많은 이로움을 준다.」가 주제이다.',
    'ⓐ 공기 정화, ⓑ 그늘과 기온 낮추기, ⓒ 아름다운 경관과 새의 서식처, ⓔ 스트레스 감소 — 모두 도시 나무의 이로움이다.',
    'ⓓ 「소나무 같은 일부 나무는 추운 겨울에도 푸르다.」는 나무의 특징일 뿐, 도시 사람들에게 주는 이로움과 관계가 없다.'])

qf(T, 3, P(발,
           'Hanok, the traditional Korean house, was designed to keep people comfortable in every season. '
           'ⓐ Its thick walls of soil and wood helped keep the inside cool in summer and warm in winter. '
           'ⓑ Today, most Koreans live in tall apartment buildings in big cities. '
           'ⓒ In winter, the floor was heated by ondol, a system that sent hot smoke from the kitchen fire under the stone floor. '
           'ⓓ In summer, the wide wooden floor called maru let the cool wind pass through the house. '
           'ⓔ Also, the doors and windows were covered with hanji, a traditional paper that let air flow and sunlight come in softly. '
           'Thanks to these features, people could live comfortably in a hanok all year round.'),
   F, 1,
   ['첫 문장 「한국의 전통 가옥인 한옥은 모든 계절에 사람들이 편안하도록 설계되었다.」가 주제이다.',
    'ⓐ 흙과 나무로 된 벽, ⓒ 겨울의 온돌, ⓓ 여름의 마루, ⓔ 공기와 햇빛이 드나드는 한지 — 모두 한옥이 사계절 편안한 까닭을 설명한다.',
    'ⓑ 「오늘날 대부분의 한국인은 대도시의 높은 아파트에 산다.」는 현대의 주거 형태 이야기로, 한옥의 설계와 관계가 없다.'])

qf(T, 3, P(발,
           'Volunteering is good not only for the people you help but also for yourself. '
           'ⓐ When you help others, your brain releases chemicals that make you feel happy. '
           'ⓑ You can also meet new people and make friends who share the same interests as you. '
           'ⓒ In addition, volunteering gives you a chance to learn new skills, such as teaching or cooking. '
           'ⓓ These experiences can help you find out what kind of job you would like to have in the future. '
           'ⓔ Some volunteer groups raise money by selling cookies at local markets. '
           'So why don\'t you find a volunteer activity that you would enjoy and give it a try this month?'),
   F, 4,
   ['첫 문장 「자원봉사는 도움을 받는 사람뿐 아니라 «자기 자신»에게도 좋다.」가 주제이다.',
    'ⓐ 행복감, ⓑ 새로운 친구, ⓒ 새로운 기술, ⓓ 진로 탐색 — 모두 봉사하는 사람이 얻는 이로움이다.',
    'ⓔ 「어떤 봉사 단체는 지역 시장에서 쿠키를 팔아 돈을 모은다.」는 봉사 단체의 모금 방법으로, 봉사자 자신이 얻는 이로움과 관계가 없다.'])

qf(T, 4, P(발,
           'Camels have several special features that help them survive in the desert. '
           'ⓐ In some countries, riding a camel has become a popular activity for tourists. '
           'ⓑ Their long eyelashes and hairy ears keep sand out of their eyes and ears. '
           'ⓒ Surprisingly, their humps do not hold water as many people think; instead, they store fat, which can be turned into energy when food is hard to find. '
           'ⓓ Camels can also close their noses to keep out sand during sandstorms. '
           'ⓔ In addition, their wide, flat feet help them walk on soft sand without sinking. '
           'With these features, camels can travel long distances across the hot, dry desert.'),
   F, 0,
   ['첫 문장 「낙타는 사막에서 살아남는 데 도움이 되는 몇 가지 특별한 특징을 가지고 있다.」가 주제이다.',
    'ⓑ 긴 속눈썹과 털 난 귀, ⓒ 지방을 저장하는 혹, ⓓ 모래바람 때 닫히는 코, ⓔ 넓적한 발 — 모두 사막 생존을 돕는 신체 특징이다. ⓒ는 «많은 사람의 생각과 달리»라는 말이 있어 어색해 보이지만 혹의 기능을 설명하므로 흐름에 맞다.',
    'ⓐ 「몇몇 나라에서 낙타 타기는 관광객에게 인기 있는 활동이 되었다.」는 사람의 관광 이야기로, 낙타의 생존 특징과 관계가 없다.'])

qf(T, 5, P(발,
           'Honeybees have a special way of telling each other where to find food. '
           'ⓐ When a bee finds a field full of flowers, it flies back to the hive and performs a kind of dance. '
           'ⓑ The direction of the dance shows the other bees which way to fly to reach the flowers. '
           'ⓒ How long the bee shakes its body during the dance tells them how far away the flowers are. '
           'ⓓ The honey that bees make from these flowers can stay good for a very long time without going bad. '
           'ⓔ By "reading" this dance, the other bees can fly straight to the food without wasting time and energy. '
           'Thanks to this clever system, a whole hive can quickly share one bee\'s discovery.'),
   F, 3,
   ['첫 문장 「꿀벌에게는 먹이가 있는 곳을 서로 알려 주는 특별한 방법이 있다.」가 주제이고, 글 전체가 꿀벌의 «춤»을 통한 정보 전달을 설명한다.',
    'ⓐ 춤을 춤 → ⓑ 춤의 방향 = 날아갈 방향 → ⓒ 몸을 흔드는 시간 = 거리 → ⓔ 춤을 «읽어» 곧장 먹이로 날아감 — 자연스럽게 이어진다.',
    'ⓓ 「벌이 그 꽃으로 만든 꿀은 상하지 않고 아주 오래 보관될 수 있다.」는 bees, flowers 같은 같은 낱말을 쓰지만 «꿀의 보존성» 이야기로, 먹이 위치를 알리는 방법과 관계가 없다.'])


# ══════════════════════════════════════════════════════════════
# u3m1s0t0 단어·문장/문장/문장 학습/문장 해석
# ══════════════════════════════════════════════════════════════
T = 'u3m1s0t0'

q(T, 1, '다음 영어 문장을 우리말로 가장 알맞게 옮긴 것은?\n\nI have never seen such a beautiful sunset before.',
  '나는 전에 그렇게 아름다운 일몰을 본 적이 한 번도 없다.',
  ['나는 전에 아름다운 일몰을 자주 보았다.',
   '나는 그렇게 아름다운 일몰을 다시는 보지 않을 것이다.',
   '나는 아름다운 일몰을 보러 가 본 적이 있다.',
   '나는 전에 그 아름다운 일몰을 보지 못해서 아쉬웠다.'],
  ['have never seen은 현재완료(have + p.p.)의 «경험» 용법으로 「(지금까지) 본 적이 한 번도 없다」로 옮긴다.',
   'such a beautiful sunset은 「그렇게 아름다운 일몰」이다.',
   '「자주 보았다」, 「본 적이 있다」는 never(한 번도 ~ 않다)와 반대이고, 「다시는 보지 않을 것이다」는 미래 표현이다.'])

q(T, 2, '다음 영어 문장을 우리말로 가장 알맞게 옮긴 것은?\n\nThe girl who is playing the violin on the stage is my cousin.',
  '무대 위에서 바이올린을 연주하고 있는 소녀는 내 사촌이다.',
  ['그 소녀는 무대 위에서 내 사촌과 함께 바이올린을 연주하고 있다.',
   '무대 위에서 바이올린을 연주하는 사람은 내 사촌의 친구이다.',
   '내 사촌은 무대 위에서 바이올린을 연주하고 싶어 하는 소녀이다.',
   '그 소녀는 내 사촌에게 무대 위에서 바이올린을 연주해 주었다.'],
  ['who is playing the violin on the stage는 주격 관계대명사 who가 이끄는 절로, 앞의 The girl을 꾸민다 → 「무대 위에서 바이올린을 연주하고 있는 소녀」.',
   '문장 전체의 주어는 The girl (who ~ stage), 동사는 is, 보어는 my cousin → 「~ 소녀는 내 사촌이다」.',
   '나머지는 주어와 보어의 관계를 바꾸거나(사촌과 함께, 사촌의 친구), 없는 내용(연주하고 싶어 함, 연주해 주었다)을 넣었다.'])

q(T, 3, '다음 영어 문장을 우리말로 가장 알맞게 옮긴 것은?\n\nThe boy sitting next to me showed me a picture taken in Paris.',
  '내 옆에 앉아 있는 소년이 나에게 파리에서 찍은 사진 한 장을 보여 주었다.',
  ['나는 내 옆에 앉아 있는 소년에게 파리에서 찍은 사진을 보여 주었다.',
   '파리에서 사진을 찍은 소년이 내 옆에 앉아 있었다.',
   '내 옆에 앉은 소년은 파리에서 사진을 찍고 있었다.',
   '내 옆에 앉아 있던 소년이 나에게 파리에서 사진을 찍어 달라고 부탁했다.'],
  ['sitting next to me는 현재분사구로 The boy를 뒤에서 꾸민다(능동·진행: 「내 옆에 앉아 있는」).',
   'taken in Paris는 과거분사구로 a picture를 뒤에서 꾸민다(수동: 「파리에서 찍힌 → 파리에서 찍은」).',
   '문장의 뼈대는 The boy showed me a picture(소년이 나에게 사진을 보여 주었다)이다. 주는 사람과 받는 사람을 바꾼 해석이나, 소년이 사진을 «찍었다»고 한 해석은 틀렸다.'])

q(T, 3, '다음 영어 문장을 우리말로 가장 알맞게 옮긴 것은?\n\nWhat I want to do this weekend is to read the novel you recommended.',
  '내가 이번 주말에 하고 싶은 것은 네가 추천한 소설을 읽는 것이다.',
  ['이번 주말에 무엇을 할지 네가 추천해 주면 그 소설을 읽겠다.',
   '나는 이번 주말에 네가 어떤 소설을 추천했는지 알고 싶다.',
   '네가 이번 주말에 읽고 싶은 소설을 나에게 추천해 줘.',
   '내가 추천한 소설을 이번 주말에 읽는 것이 네가 원하는 것이다.'],
  ['What I want to do this weekend는 관계대명사 what(~하는 것)이 이끄는 주어 → 「내가 이번 주말에 하고 싶은 것」.',
   'the novel (that) you recommended는 목적격 관계대명사가 생략된 형태 → 「네가 추천한 소설」. is to read ~는 「~을 읽는 것이다」.',
   '마지막 오답은 «나»와 «너»를 뒤바꿨고, 나머지는 what을 의문사(무엇을)로 잘못 읽거나 조건·명령문으로 바꾸었다.'])

q(T, 4, '다음 중 영어 문장을 우리말로 옮긴 것이 바르지 «않은» 것은?',
  'He has lived in Busan since he was ten. → 그는 열 살 때 부산에서 살았다.',
  ['It is important to wear a helmet when you ride a bike. → 자전거를 탈 때 헬멧을 쓰는 것은 중요하다.',
   'The man who helped me yesterday is a firefighter. → 어제 나를 도와준 남자는 소방관이다.',
   'I don\'t know what she wants for her birthday. → 나는 그녀가 생일에 무엇을 원하는지 모른다.',
   'The window broken by the storm has not been fixed yet. → 폭풍으로 깨진 창문은 아직 수리되지 않았다.'],
  ['has lived ~ since he was ten은 현재완료의 «계속» 용법이다. 「그는 열 살 때부터 (지금까지) 부산에서 살고 있다」로 옮겨야 한다.',
   '「열 살 때 부산에서 살았다」는 과거의 한 시점만 말할 뿐, 지금까지 이어지고 있다는 의미가 빠져 바르지 않다.',
   '나머지: 가주어 It ~ to부정사, 주격 관계대명사 who, 간접의문문 what she wants, 과거분사 broken(깨진)과 현재완료 수동 has not been fixed(아직 수리되지 않았다)가 모두 바르게 옮겨졌다.'])

q(T, 5, '다음 영어 문장이 뜻하는 바로 가장 알맞은 것은?\n\nIf I had enough money, I could buy the new laptop.',
  '나는 지금 돈이 충분하지 않아서 새 노트북을 살 수 없다.',
  ['나는 지금 돈이 충분해서 새 노트북을 살 수 있다.',
   '나는 그때 돈이 충분하지 않아서 새 노트북을 살 수 없었다.',
   '나는 돈이 충분했지만 새 노트북을 사지 않았다.',
   '나는 돈이 충분히 모이면 새 노트북을 살 것이다.'],
  ['「If + 주어 + 과거형 동사, 주어 + could/would + 동사원형」은 가정법 과거로, «현재» 사실과 반대되는 상황을 가정한다 → 「내가 돈이 충분하다면 새 노트북을 살 수 있을 텐데.」',
   '따라서 실제 뜻(현재 사실)은 「지금 돈이 충분하지 않아서 새 노트북을 살 수 없다」이다.',
   '「그때 ~ 살 수 없었다」는 과거 사실로 잘못 본 것이고(가정법 과거는 형태만 과거일 뿐 현재를 말한다), 「돈이 모이면 살 것이다」는 실제로 일어날 수 있는 일을 말하는 조건문의 뜻이다.'])

save(os.path.expanduser('~/hakseupji-deploy/_gen/eng-m3/p-seed.json'))
