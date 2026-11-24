// 사람마다 다른 기질: 성격 차원, 체력, 테토/에겐, 외모·매력, 이상형, 취미, 공부와 발견, 중독, 질병
// 성격 차원에는 장점과 단점이 함께 있다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa, shuffle } = G;
  const P = (G.Persona = {});

  P.DIMS = {
    extra: { name: '외향성', hi: '사람들과 어울릴 때 힘이 난다. 친구가 많지만 혼자 있으면 금방 외로워진다', lo: '혼자 있는 게 편하다. 덜 외롭고 공부를 좋아하지만 친구는 적다' },
    agree: { name: '친화성', hi: '잘 돕고 위로하며 다툼이 적다. 대신 거래에서 손해를 본다', lo: '자주 부딪치고 죄를 짓기 쉽다. 대신 흥정을 잘한다' },
    consc: { name: '성실성', hi: '일이 빠르고 빚을 꼭 갚는다. 대신 스트레스를 많이 받는다', lo: '게으르고 자주 쉰다. 대신 스트레스를 덜 받는다' },
    neuro: { name: '예민함', hi: '스트레스와 우울에 약하다. 대신 혼자 깊이 생각해 공부와 예술에 빠진다', lo: '마음이 단단해 쉽게 흔들리지 않는다' },
    open: { name: '개방성', hi: '새로운 것을 좋아해 취미가 많고 배우기를 즐기며 동물도 잘 길들인다', lo: '전통을 따르고 신을 더 깊이 믿는다' },
    impulse: { name: '충동성', hi: '사랑을 바로 고백하고 위험에 먼저 뛰어든다. 대신 다툼과 범죄로 번지기 쉽다', lo: '신중해서 실수가 적지만 기회를 놓치기도 한다' },
    addict: { name: '중독성', hi: '술과 도박으로 스트레스를 크게 푼다. 대신 쉽게 빠져들어 돈과 건강을 잃는다', lo: '무엇에도 쉽게 빠지지 않는다' },
  };

  P.HOBBIES = {
    노래: { emote: '♪', place: 'fire', social: true, text: '모닥불 옆에서 노래를 불렀다' },
    춤: { emote: '♫', place: 'fire', social: true, text: '사람들과 어울려 춤을 추었다' },
    이야기: { emote: '…', place: 'fire', social: true, text: '아이들에게 옛이야기를 들려주었다' },
    요리: { emote: '♨', place: 'fire', social: true, text: '이웃에게 음식을 만들어 나눠 주었다' },
    낚시: { emote: '~', place: 'shore', text: '한가롭게 낚시를 했다' },
    별보기: { emote: '★', place: 'hill', text: '언덕에 올라 밤하늘의 별을 보았다' },
    그림: { emote: '✎', place: 'any', text: '바위에 그림을 그렸다' },
    운동: { emote: '!', place: 'any', text: '몸을 단련했다' },
    산책: { emote: '~', place: 'forest', text: '숲길을 오래 걸었다' },
    도박: { emote: '⚄', place: 'fire', social: true, addictive: true, text: '돌 던지기 내기를 했다' },
    술: { emote: '♨', place: 'fire', social: true, addictive: true, text: '열매술을 마셨다' },
  };
  P.WANTS = ['외모', '다정함', '재력', '강인함', '신앙심', '재치', '지혜'];

  const nrand = (m, sd) => { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return m + (s - 2) * sd * 0.87; };

  P.init = (sim, h, parents) => {
    const mom = parents && parents[0] && sim.byId.get(parents[0].id);
    const dad = parents && parents[1] && sim.byId.get(parents[1].id);
    const inh = (get, m, sd) => {
      const ps = [mom, dad].filter(Boolean).map(get).filter((v) => v !== undefined);
      return ps.length ? nrand(ps.reduce((a, b) => a + b, 0) / ps.length * 0.5 + m * 0.5, sd * 0.85) : nrand(m, sd);
    };
    const p = {};
    for (const k in P.DIMS) p[k] = clamp(Math.round(inh((x) => x.p && x.p[k], 50, 22)), 0, 100);
    // 성격 특성과 맞춘다
    const t = (name, k, d) => { if (h.traits.includes(name)) p[k] = clamp(p[k] + d, 0, 100); };
    t('충동적인', 'impulse', 30); t('침착한', 'impulse', -30); t('침착한', 'neuro', -20);
    t('부지런한', 'consc', 30); t('게으른', 'consc', -30);
    t('다정한', 'agree', 25); t('냉정한', 'agree', -25); t('너그러운', 'agree', 15);
    t('호기심 많은', 'open', 30); t('의심 많은', 'open', -10); t('겁많은', 'neuro', 15);
    h.p = p;
    h.body = clamp(Math.round(inh((x) => x.body, 55, 22)), 3, 100);       // 체력·체질
    h.teto = clamp(Math.round(inh((x) => x.teto, h.gender === 'M' ? 25 : -25, 35)), -100, 100); // 테토(+) / 에겐(-)
    h.looks = clamp(Math.round(inh((x) => x.looks, 50, 18)), 0, 100);
    const pool = Object.keys(P.HOBBIES);
    const nh = p.open > 70 ? 3 : p.open < 30 ? 1 : 2;
    const likes = [];
    for (const par of [mom, dad]) if (par && par.likes && chance(0.4)) { const x = pick(par.likes); if (!likes.includes(x)) likes.push(x); }
    for (const x of shuffle(pool.slice())) {
      if (likes.length >= nh) break;
      if (P.HOBBIES[x].addictive && p.addict < 50 && chance(0.6)) continue;
      if (P.HOBBIES[x].social && p.extra < 35 && chance(0.5)) continue;
      if (!likes.includes(x)) likes.push(x);
    }
    h.likes = likes.slice(0, nh);
    h.dislike = pick(pool.filter((x) => !h.likes.includes(x)));
    h.wants = pick(P.WANTS);
    h.typePref = chance(0.4) ? 'teto' : chance(0.6) ? 'egen' : 'any';
    h.knowledge = 0;
    h.addiction = 0;
    h.sick = null;
    h.maxHp = Math.round(60 + h.body * 0.5);
    h.health = Math.min(h.health, h.maxHp);
  };

  P.tetoLabel = (v) => (v >= 50 ? '테토' : v >= 20 ? '약간 테토' : v > -20 ? '중간' : v > -50 ? '약간 에겐' : '에겐');
  P.bodyLabel = (v) => (v >= 80 ? '타고난 장사' : v >= 60 ? '튼튼함' : v >= 35 ? '보통' : v >= 18 ? '약한 편' : '선천적으로 허약함');

  // 매력도: 외모, 표정(기분), 성격, 지위
  P.charm = (h) => {
    let c = h.looks * 0.5 + h.happy * 0.12 + 12;
    c += (h.p.extra - 50) * 0.12 + (h.p.agree - 50) * 0.06;
    if (h.has('다정한')) c += 6;
    if (h.has('냉정한')) c -= 4;
    c += Math.min(8, h.gold / 25);
    if (h.job === G.JOB.CHIEF) c += 8;
    if (h.sick) c -= 8;
    return clamp(Math.round(c), 0, 100);
  };

  // h가 보기에 o가 얼마나 끌리는가 (0.3 ~ 2.5배)
  P.appeal = (h, o) => {
    let m = 0.5 + P.charm(o) / 100;
    if (h.typePref === 'teto') m *= o.teto >= 20 ? 1.5 : o.teto <= -20 ? 0.6 : 1;
    else if (h.typePref === 'egen') m *= o.teto <= -20 ? 1.5 : o.teto >= 20 ? 0.6 : 1;
    switch (h.wants) {
      case '외모': m *= 0.6 + o.looks / 80; break;
      case '다정함': m *= 0.7 + o.p.agree / 120; break;
      case '재력': m *= 0.7 + Math.min(1, o.gold / 80); break;
      case '강인함': m *= 0.7 + (o.body + Math.max(0, o.teto)) / 200; break;
      case '신앙심': m *= 0.6 + o.faith / 100; break;
      case '재치': m *= 0.7 + o.p.extra / 140; break;
      case '지혜': m *= 0.7 + Math.min(1, o.knowledge / 40); break;
    }
    m *= 1 + P.shared(h, o) * 0.15;
    if (o.convictions && !o.redeemed && !h.convictions) m *= 0.55; // 전과자는 연애에서 불리하다
    return clamp(m, 0.3, 2.5);
  };
  P.shared = (a, b) => a.likes.filter((x) => b.likes.includes(x)).length;
  P.hobbyCompat = (a, b) => P.shared(a, b) * 2 - (b.likes.includes(a.dislike) ? 2 : 0);

  // ---------------- 60틱마다 ----------------
  P.tick = (sim, h) => {
    // 중독: 오래 못하면 갈망
    if (h.addiction > 0) {
      h.addiction = Math.max(0, h.addiction - 0.4);
      if (h.addiction > 50 && sim.year - (h.lastIndulge || -99) > 0.3) G.Social.addMood(sim, h, 'craving');
    }
    if (h.drunk > 0) h.drunk--;
    // 몸의 병
    if (h.sick) {
      h.sick.left--;
      h.health -= 1.2 * (1.3 - h.body / 100) * (h.sick.name === '역병' ? 2.2 : 1);
      G.Migrate.spread(sim, h);
      if (h.state !== 'jailed' && h.state !== 'fight' && chance(0.3)) { h.state = 'rest'; h.timer = 120; }
      if (h.health <= 0) return sim.kill(h, h.sick.name);
      if (h.sick.left <= 0) { h.log(sim, `${h.sick.name}에서 나았다`); h.sick = null; }
    } else {
      let p = 0.004 * (1.6 - h.body / 100);
      if (h.age < 5 || h.age > 60) p *= 2;
      if (h.hunger > 80) p *= 2;
      if (sim.season === 3) p *= 2; // 겨울에는 병이 잦다
      if (chance(p)) {
        h.sick = { name: pick(['열병', '고뿔', '배앓이', '기침병']), left: randi(4, 10) };
        if (h.body < 30 || chance(0.3)) h.log(sim, `${h.sick.name}에 걸려 앓아누웠다`);
        sim.stats.sick = (sim.stats.sick || 0) + 1;
      }
    }
  };

  // ---------------- 여가: 취미와 공부 ----------------
  P.leisure = (sim, h) => {
    if (!h.adult || h.hunger > 45 || h.sick || (h.tribe && h.tribe.fireAlarm)) return false;
    // 게으른 사람은 그냥 쉰다 (스트레스가 줄어든다)
    if (h.p.consc < 30 && chance((30 - h.p.consc) / 120)) {
      h.state = 'rest'; h.timer = randi(80, 160); h.stress = Math.max(0, (h.stress || 0) - 3);
      return true;
    }
    // 공부: 혼자를 좋아하고, 열려 있고, 예민하거나 우울할수록 학구열이 높다
    const zeal = P.studyZeal(h);
    if (chance(zeal * 0.05)) return P.goStudy(sim, h);
    // 중독된 사람은 술과 도박을 찾는다
    const craving = h.addiction > 50 && sim.year - (h.lastIndulge || -99) > 0.3;
    const pc = craving ? 0.5 : 0.035 + h.p.extra / 2500;
    if (!chance(pc)) return false;
    let hobby = craving ? pick(h.likes.filter((x) => P.HOBBIES[x].addictive).concat(['술'])) : pick(h.likes);
    return P.goHobby(sim, h, hobby);
  };

  P.studyZeal = (h) => {
    let z = (h.p.open + (100 - h.p.extra) + h.p.neuro * 0.6) / 260;
    if (h.mind && h.mind.c === '우울증') z *= 1.6;
    if (h.body < 30) z *= 1.3;
    if (h.has('호기심 많은')) z *= 1.3;
    return clamp(z, 0, 1.5);
  };

  P.spot = (sim, h, place) => {
    const w = sim.world, t = h.tribe;
    const cx = t ? t.cx : h.x, cy = t ? t.cy : h.y;
    if (place === 'fire' && t) return { x: t.cx + rand(-2, 2), y: t.cy + rand(-2, 2) };
    if (place === 'shore') { const s = w.findWater(cx, cy, 16); return s ? { x: s.x + 0.5, y: s.y + 0.5 } : null; }
    for (let k = 0; k < 25; k++) {
      const x = cx + rand(-10, 10), y = cy + rand(-10, 10);
      const ty = w.typeAt(x, y);
      if (place === 'hill' && ty !== G.T.HILL && ty !== G.T.MOUNTAIN) continue;
      if (place === 'forest' && ty !== G.T.FOREST) continue;
      if (place === 'quiet') { let n = 0; sim.near(x, y, 5, () => n++); if (n) continue; }
      if (w.walkable(x, y)) return { x, y };
    }
    return w.walkable(cx + 3, cy) ? { x: cx + 3, y: cy } : null;
  };

  P.goHobby = (sim, h, hobby) => {
    const H = P.HOBBIES[hobby];
    if (!H) return false;
    const s = P.spot(sim, h, H.place);
    if (!s) return false;
    return h.goTo(sim, s.x, s.y, { kind: 'hobby', hobby });
  };
  P.goStudy = (sim, h) => {
    const s = P.spot(sim, h, 'quiet') || P.spot(sim, h, 'hill');
    if (!s) return false;
    return h.goTo(sim, s.x, s.y, { kind: 'hobby', hobby: '공부' });
  };

  P.STUDY_TEXT = ['별의 움직임을 기록했다', '풀과 약초를 살펴 그 쓰임을 알아냈다', '흙과 돌의 성질을 연구했다', '동물의 습성을 관찰했다', '혼자 깊이 생각에 잠겼다', '셈하는 법을 궁리했다'];

  P.onHobby = (sim, h, task) => {
    const hobby = task.hobby;
    h.state = 'hobby'; h.timer = randi(120, 200); h.curHobby = hobby;
    const logOnce = (text) => {
      h.hobbyLog = h.hobbyLog || {};
      if (sim.year - (h.hobbyLog[hobby] || -99) > 5) { h.hobbyLog[hobby] = sim.year; h.log(sim, text); }
    };
    if (hobby === '공부') {
      h.say('✎', 160);
      let gain = (1 + P.studyZeal(h) * 2) * G.Genes.iq(h); // 타고난 머리 (genes.js)
      if (h.mind && h.mind.c === '우울증') gain *= 1.5;
      if (h.tribe && h.tribe.has('문자')) gain *= 1.3;
      h.knowledge += gain;
      h.stress = Math.max(0, (h.stress || 0) - 4);
      G.Social.addMood(sim, h, 'study');
      if (h.mind) G.Mind.support(sim, h, 3);
      logOnce(pick(P.STUDY_TEXT));
      if (h.tribe) P.addLore(sim, h.tribe, gain, h);
      return;
    }
    const H = P.HOBBIES[hobby];
    h.say(H.emote, 160);
    G.Social.addMood(sim, h, 'hobby');
    h.stress = Math.max(0, (h.stress || 0) - (H.addictive ? 8 + h.p.addict / 10 : 6));
    logOnce(H.text);
    // 함께하는 사람들
    if (H.social) {
      sim.near(h.x, h.y, 4, (o) => {
        if (o === h || o.jail) return;
        if (o.likes.includes(hobby)) { G.Social.bump(sim, o, h, 4); G.Social.bump(sim, h, o, 4); G.Social.addMood(sim, o, 'hobby'); o.say(H.emote, 80); }
        else if (o.dislike === hobby) { G.Social.addMood(sim, o, 'annoyed'); G.Social.bump(sim, o, h, -3); }
        else if (hobby === '이야기' && o.age < 14) { G.Social.bump(sim, o, h, 5); G.Social.addMood(sim, o, 'played'); }
      });
    }
    switch (hobby) {
      case '요리':
        if (h.tribe && h.tribe.stock.food >= 2) {
          h.tribe.stock.food -= 2;
          sim.near(h.x, h.y, 4, (o) => { o.hunger = Math.max(0, o.hunger - 15); if (o !== h) G.Social.bump(sim, o, h, 4); });
        }
        break;
      case '낚시': if (chance(0.35)) { h.hunger = Math.max(0, h.hunger - 20); h.say('~', 80); } break;
      case '운동': h.body = Math.min(100, h.body + 0.3); h.maxHp = Math.round(60 + h.body * 0.5); break;
      case '별보기': h.knowledge += 0.5; if (h.tribe) P.addLore(sim, h.tribe, 0.5, h); h.faith = Math.min(100, h.faith + 1); break;
      case '그림': h.knowledge += 0.2; if (h.tribe) h.tribe.art = (h.tribe.art || 0) + 1; break;
      case '술':
        h.addiction = Math.min(100, h.addiction + (3 + h.p.addict / 15) * G.Genes.addMult(h));
        h.lastIndulge = sim.year;
        h.health -= 1.5;
        h.drunk = 3;
        break;
      case '도박': {
        h.addiction = Math.min(100, h.addiction + (2 + h.p.addict / 20) * G.Genes.addMult(h));
        h.lastIndulge = sim.year;
        let opp = null;
        sim.near(h.x, h.y, 4, (o) => { if (!opp && o !== h && o.adult && o.gold >= 3 && !o.jail) opp = o; });
        if (opp && h.gold >= 3) {
          const stake = Math.min(randi(3, 12), Math.floor(h.gold), Math.floor(opp.gold));
          const [win, lose] = G.Crime2.cheat(sim, h, opp) || chance(0.5) ? [h, opp] : [opp, h];
          win.gold += stake; lose.gold -= stake;
          G.Social.bump(sim, lose, win, -2);
          if (lose.p.impulse > 65 && chance(0.3)) G.Social.argue(sim, lose, win, G.Social.rel(lose, win));
          if (stake >= 10 && lose === h) logOnce(`도박으로 금화 ${stake}개를 잃었다`);
        }
        break;
      }
    }
  };

  // ---------------- 부족의 지식과 발견 ----------------
  P.DISCOVERIES = [
    { name: '토기', need: 30, desc: '식량이 덜 상한다' },
    { name: '약초학', need: 60, desc: '치료와 출산이 안전해진다' },
    { name: '관개', need: 100, desc: '밭의 곡식이 더 잘 자란다' },
    { name: '바퀴', need: 150, desc: '상인이 빨라지고 이익이 커진다' },
    { name: '청동', need: 220, desc: '도구 효율의 한계가 오른다' },
    { name: '천문학', need: 300, desc: '가뭄의 피해가 줄고 신앙이 깊어진다' },
    { name: '문자', need: 400, desc: '배움이 빨라진다' },
  ];
  P.addLore = (sim, t, gain, who) => {
    t.lore = (t.lore || 0) + gain;
    t.found = t.found || [];
    for (const d of P.DISCOVERIES) {
      if (t.lore >= d.need && !t.found.includes(d.name)) {
        t.found.push(d.name);
        if (who) { who.log(sim, `${josa(d.name, '을/를')} 발견했다`); who.discoveries = (who.discoveries || 0) + 1; }
        t.log(sim, `${who ? josa(who.name, '이/가') + ' ' : ''}${josa(d.name, '을/를')} 발견했습니다 (${d.desc})`);
        sim.effects.push({ kind: 'bless', x: t.cx, y: t.cy, r: 3, age: 0, ttl: 60, color: '150,200,255' });
      }
    }
  };
})();
