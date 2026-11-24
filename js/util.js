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
  G.TRAITS = ['용감한', '겁많은', '탐욕스러운', '너그러운', '부지런한', '게으른', '신앙심 깊은', '의심 많은', '호기심 많은', '야심찬'];
  const OPP = { 용감한: '겁많은', 겁많은: '용감한', 탐욕스러운: '너그러운', 너그러운: '탐욕스러운', 부지런한: '게으른', 게으른: '부지런한', '신앙심 깊은': '의심 많은', '의심 많은': '신앙심 깊은' };
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
    while (out.length < 2 && guard++ < 20) tryAdd(G.pick(G.TRAITS));
    return out.slice(0, 2);
  };
})();
