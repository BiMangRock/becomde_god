// 공용 설정과 도우미 함수
(function () {
  const G = globalThis.G || (globalThis.G = {});

  G.CFG = {
    W: 160,            // 지도 가로 칸 수
    H: 120,            // 지도 세로 칸 수
    TPY: 600,          // 1년 = 600틱 (1배속에서 약 10초)
    MAX_POP: 1200,     // 최대 인구 (성능 보호)
    STORY_CAP: 40,     // 인간 한 명이 기억하는 이야기 최대 개수
    ARCHIVE_CAP: 300,  // 기록관에 남기는 죽은 사람 수
    EVENT_CAP: 150,    // 세계 사건 기록 최대 개수
  };

  // 시간 흐름 5단계
  //  tpd: 1배속에서 하루가 몇 틱인지 (60틱 = 1초)
  //  pace: 활동 속도 (배고픔·일·휴식). 느린 단계에서는 하루하루가 자세히 보이도록 활동도 느려진다
  //  night: 밤 화면, sleep: 밤에 집에 가서 잔다
  G.TIME_MODES = {
    vfast: { name: '아주 빠름', desc: '하루 0.25초 · 1년 10초', tpd: 15, pace: 1, night: false, sleep: false, speeds: [1, 3, 10, 30] },
    fast: { name: '빠름', desc: '하루 2초 · 1년 1분 20초', tpd: 120, pace: 1, night: false, sleep: false, speeds: [1, 3, 10, 30] },
    normal: { name: '보통', desc: '하루 5초 · 1년 3분 20초', tpd: 300, pace: 1, night: true, sleep: false, speeds: [1, 3, 10, 30] },
    slow: { name: '느림', desc: '하루 1분 · 1년 40분', tpd: 3600, pace: 0.2, night: true, sleep: true, speeds: [1, 3, 10, 30, 100] },
    vslow: { name: '아주 느림', desc: '하루 10분 · 1년 6시간 40분', tpd: 36000, pace: 0.04, night: true, sleep: true, speeds: [1, 3, 10, 30, 100] },
  };
  G.CFG.DAYS = 40;                         // 1년 = 4계절 × 10일
  G.CFG.BPD = G.CFG.TPY / G.CFG.DAYS;      // 하루 = 기본 시간 15
  G.SEASONS = ['봄', '여름', '가을', '겨울'];

  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.chance = (p) => Math.random() < p;
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  G.shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // 한국어 조사 붙이기: josa('하늘', '이/가') -> '하늘이'
  G.josa = (word, pair) => {
    const c = word.charCodeAt(word.length - 1);
    const isHangul = c >= 0xac00 && c <= 0xd7a3;
    const jong = isHangul ? (c - 0xac00) % 28 : 0;
    if (pair === '으로/로') return word + (jong && jong !== 8 ? '으로' : '로');
    const [a, b] = pair.split('/');
    return word + (jong ? a : b);
  };

  // 이름
  const SYL = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '하', '도', '로', '모', '보', '소', '오', '조', '호',
    '누', '두', '루', '무', '부', '수', '우', '주', '후', '미', '리', '시', '지', '히', '연', '별', '솔', '빛', '달', '강',
    '산', '들', '샘', '결', '온', '새', '란', '린', '윤', '진', '한', '슬', '봄', '유', '은', '현', '서', '해', '담', '찬', '율'];
  G.makeName = () => G.pick(SYL) + G.pick(SYL);

  const ADJ = ['붉은', '푸른', '검은', '하얀', '황금', '은빛', '잿빛', '작은', '큰', '바람의', '강가의', '숲의', '산의', '새벽의', '별의', '달빛'];
  const NOUN = ['늑대', '곰', '매', '사슴', '여우', '뱀', '까마귀', '호랑이', '물고기', '돌', '불꽃', '나무', '달', '해', '고래', '독수리'];
  G.makeTribeName = (used) => {
    for (let k = 0; k < 40; k++) {
      const n = G.pick(ADJ) + ' ' + G.pick(NOUN) + ' 부족';
      if (!used.has(n)) return n;
    }
    return G.pick(ADJ) + ' ' + G.pick(NOUN) + ' ' + G.randi(2, 99) + ' 부족';
  };
  G.TRIBE_COLORS = ['#e4572e', '#3f88c5', '#f2c14e', '#9b5de5', '#2ec4b6', '#ff6b9a', '#8ac926', '#ff924c',
    '#d0d0d0', '#6a4c93', '#1982c4', '#ffca3a', '#c1121f', '#00b4d8', '#b5838d', '#80ed99'];

  // 성격 (서로 반대되는 것은 함께 가지지 않음)
  G.TRAITS = ['용감한', '겁많은', '탐욕스러운', '너그러운', '부지런한', '게으른', '신앙심 깊은', '의심 많은', '호기심 많은', '야심찬',
    '정직한', '교활한', '다정한', '냉정한', '충동적인', '침착한', '질투심 많은'];
  const OPP = { 용감한: '겁많은', 겁많은: '용감한', 탐욕스러운: '너그러운', 너그러운: '탐욕스러운', 부지런한: '게으른', 게으른: '부지런한', '신앙심 깊은': '의심 많은', '의심 많은': '신앙심 깊은',
    정직한: '교활한', 교활한: '정직한', 다정한: '냉정한', 냉정한: '다정한', 충동적인: '침착한', 침착한: '충동적인' };
  G.TRAIT_DESC = {
    용감한: '싸움과 사냥에 강하다', 겁많은: '위험을 피하고 잘 싸우지 않는다', 탐욕스러운: '돈을 밝히고 상인이 되기 쉽다', 너그러운: '잘 나누고 원한을 빨리 잊는다',
    부지런한: '일이 빠르다', 게으른: '일이 느리다', '신앙심 깊은': '신을 깊이 믿는다', '의심 많은': '기적에 덜 감동하고 남을 잘 믿지 않는다',
    '호기심 많은': '새로운 것을 좋아한다', 야심찬: '족장 자리와 새 부족을 꿈꾼다', 정직한: '거의 죄를 짓지 않고 빚을 꼭 갚는다', 교활한: '죄를 짓고도 잘 들키지 않는다',
    다정한: '사람을 잘 위로하고 사랑에 잘 빠진다', 냉정한: '원한을 오래 품고 죄책감이 적다', 충동적인: '쉽게 화내고 다툰다', 침착한: '스트레스와 충격에 강하다', '질투심 많은': '남의 재산과 연인을 질투한다',
  };
  G.OPP = OPP;
  G.makeTraits = (parentTraits) => {
    const out = [];
    const tryAdd = (t) => {
      if (!t || out.includes(t) || out.includes(OPP[t])) return;
      out.push(t);
    };
    if (parentTraits && parentTraits.length) {
      for (const t of parentTraits) if (G.chance(0.35)) tryAdd(t);
    }
    let guard = 0;
    while (out.length < 3 && guard++ < 30) tryAdd(G.pick(G.TRAITS));
    return out.slice(0, 3);
  };
})();
