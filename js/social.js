// 관계, 기분, 연애, 결혼, 임신
// 사람마다 rel(관계 지도)과 moodlets(기분 요인)를 가진다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa, shuffle } = G;
  const J = G.JOB;

  const REL_CAP = 16;      // 한 사람이 기억하는 관계 수
  const MOOD_CAP = 8;      // 동시에 가지는 기분 요인 수
  const PREG_YEARS = 0.75; // 임신 기간 (9개월)

  // 기분 요인: 값(행복에 더해짐)과 지속 기간(년)
  const MOODS = (G.MOODS = {
    love: { t: '사랑에 빠졌다', v: 20, d: 1.5 },
    cupid: { t: '운명적인 사랑', v: 28, d: 2 },
    lover: { t: '연인이 생겼다', v: 18, d: 1.5 },
    date: { t: '즐거운 데이트', v: 12, d: 0.35 },
    wedding: { t: '결혼했다', v: 30, d: 2 },
    guest: { t: '결혼식에 갔다', v: 8, d: 0.3 },
    expecting: { t: '아이를 가졌다', v: 15, d: 0.75 },
    newborn: { t: '아이가 태어났다', v: 25, d: 1.5 },
    chat: { t: '즐거운 수다', v: 5, d: 0.15 },
    played: { t: '친구와 놀았다', v: 7, d: 0.2 },
    hug: { t: '가족과 함께', v: 6, d: 0.3 },
    gift: { t: '선물을 받았다', v: 9, d: 0.35 },
    comforted: { t: '위로를 받았다', v: 14, d: 0.5 },
    festival: { t: '축제를 즐겼다', v: 16, d: 0.6 },
    blessed: { t: '신의 축복', v: 20, d: 1 },
    rain: { t: '단비가 내렸다', v: 6, d: 0.4 },
    argued: { t: '말다툼을 했다', v: -8, d: 0.3 },
    brawl: { t: '주먹다짐을 했다', v: -15, d: 0.6 },
    rejected: { t: '고백을 거절당했다', v: -20, d: 1 },
    breakup: { t: '이별했다', v: -25, d: 1.5 },
    divorce: { t: '이혼했다', v: -28, d: 2 },
    jealous: { t: '질투에 불탄다', v: -20, d: 1 },
    betrayed: { t: '배신당했다', v: -35, d: 2.5 },
    guilty: { t: '죄책감', v: -10, d: 1 },
    lonely: { t: '외롭다', v: -8, d: 0.5 },
    widowed: { t: '배우자를 잃었다', v: -40, d: 4 },
    lostChild: { t: '자식을 잃었다', v: -45, d: 5 },
    lostParent: { t: '부모를 잃었다', v: -25, d: 2 },
    lostFriend: { t: '친구를 잃었다', v: -15, d: 1.5 },
    fear: { t: '하늘이 두렵다', v: -15, d: 0.8 },
    terror: { t: '불덩이를 보았다', v: -25, d: 1.2 },
    discord: { t: '이유 없이 짜증이 난다', v: -18, d: 0.7 },
    fertile: { t: '다산의 축복', v: 10, d: 2 },
    flashback: { t: '끔찍한 기억이 떠올랐다', v: -15, d: 0.3 },
    recovered: { t: '마음의 병이 나았다', v: 18, d: 1 },
    treated: { t: '치료를 받았다', v: 8, d: 0.4 },
    healed: { t: '신의 치유', v: 22, d: 1 },
    robbed: { t: '도둑맞았다', v: -15, d: 0.8 },
    witnessMurder: { t: '살인을 목격했다', v: -30, d: 2 },
    murderGuilt: { t: '살인의 죄책감', v: -30, d: 4 },
    imprisoned: { t: '감옥에 갇혀 있다', v: -25, d: 0.2 },
    freed: { t: '자유를 되찾았다', v: 20, d: 0.8 },
    exiled: { t: '추방당했다', v: -30, d: 2 },
    justice: { t: '정의가 이루어졌다', v: 12, d: 0.8 },
    debtFree: { t: '빚을 갚았다', v: 6, d: 0.4 },
    craving: { t: '술과 도박이 당긴다', v: -12, d: 0.3 },
    study: { t: '새로운 것을 깨달았다', v: 7, d: 0.4 },
    hobby: { t: '좋아하는 일을 했다', v: 8, d: 0.4 },
    annoyed: { t: '싫어하는 걸 참았다', v: -4, d: 0.2 },
    tamed: { t: '동물과 마음이 통했다', v: 10, d: 0.6 },
    hero: { t: '불을 끄고 마을을 지켰다', v: 12, d: 0.8 },
    suspicious: { t: '연인의 마음이 의심스럽다', v: -15, d: 1 },
  });

  const S = (G.Social = {});

  // ---------------- 기분 ----------------
  S.addMood = (sim, h, key, mult = 1) => {
    const m = MOODS[key];
    if (!m) return;
    const until = sim.year + m.d * mult;
    const ex = h.moodlets.find((x) => x.k === key);
    if (ex) { ex.until = Math.max(ex.until, until); return; }
    h.moodlets.push({ k: key, until });
    if (h.moodlets.length > MOOD_CAP) {
      // 가장 약한 것부터 지운다
      h.moodlets.sort((a, b) => Math.abs(MOODS[b.k].v) - Math.abs(MOODS[a.k].v));
      h.moodlets.length = MOOD_CAP;
    }
  };
  S.hasMood = (h, key) => h.moodlets.some((m) => m.k === key);

  S.updateMood = (sim, h) => {
    h.moodlets = h.moodlets.filter((m) => m.until > sim.year);
    let v = 50;
    for (const m of h.moodlets) v += MOODS[m.k].v;
    if (h.hunger > 80) v -= 15; else if (h.hunger > 55) v -= 5;
    if (h.health < 50) v -= 10;
    if (h.partner && h.partner.alive) v += 6;
    else if (h.lover && h.lover.alive) v += 4;
    let friends = 0;
    for (const r of h.rel.values()) if (r.v >= 40) friends++;
    v += Math.min(10, friends * 2);
    if (h.has('너그러운')) v += 3;
    if (h.has('탐욕스러운')) v -= 2;
    v += G.Mind.moodPenalty(h);
    h.happy = clamp(v, 0, 100);
  };

  S.moodLabel = (h) => {
    if (S.hasMood(h, 'betrayed') || S.hasMood(h, 'jealous')) return { t: '질투와 분노', c: '#ff7a6b' };
    if (S.hasMood(h, 'discord') || S.hasMood(h, 'brawl')) return { t: '화남', c: '#ff8a50' };
    const v = h.happy;
    if (v >= 85) return { t: '황홀함', c: '#ffd34d' };
    if (v >= 70) return { t: '행복함', c: '#9be36b' };
    if (v >= 55) return { t: '즐거움', c: '#8fd18f' };
    if (v >= 40) return { t: '평온함', c: '#b8c4d4' };
    if (v >= 25) return { t: '우울함', c: '#8aa6d9' };
    if (v >= 10) return { t: '비참함', c: '#7d8fc7' };
    return { t: '절망', c: '#9a7dc7' };
  };

  // ---------------- 관계 ----------------
  S.rel = (h, o) => {
    let r = h.rel.get(o.id);
    if (!r) {
      r = { v: 0, love: 0, trust: 0, respect: 0, fear: 0, grudge: 0, jealousy: 0, owe: 0, lent: 0, name: o.name };
      if (G.Mind.siblings(h, o)) { r.v = 50; r.trust = 40; r.sibling = true; }
      else if (o.convictions && !S.isFamily(h, o.id)) { r.trust = G.Crime2.stigma(o); r.v = Math.min(r.v, -5); }
      h.rel.set(o.id, r);
      if (h.rel.size > REL_CAP) S.prune(h, o.id);
    }
    return r;
  };
  S.peek = (h, o) => h.rel.get(o.id);

  S.isFamily = (h, id) =>
    h.parents.some((p) => p.id === id) || h.children.includes(id) ||
    (h.partner && h.partner.id === id) || (h.lover && h.lover.id === id);

  // 가장 희미한 관계부터 잊는다 (방금 만난 사람과 가족, 사랑하는 사람은 남긴다)
  S.prune = (h, keepId) => {
    let worst = null, ws = 1e9;
    for (const [id, r] of h.rel) {
      if (id === keepId || S.isFamily(h, id) || r.love >= 30) continue;
      const s = Math.abs(r.v) + r.love + (r.grudge || 0) + (r.sibling ? 30 : 0) + (r.owe || r.lent ? 40 : 0);
      if (s < ws) { ws = s; worst = id; }
    }
    if (worst !== null) h.rel.delete(worst);
  };

  S.bump = (sim, h, o, dv, dlove = 0) => {
    const r = S.rel(h, o);
    const before = r.v, beforeLove = r.love;
    r.v = clamp(r.v + dv, -100, 100);
    r.love = clamp(r.love + dlove, 0, 100);
    r.name = o.name;
    if (before < 60 && r.v >= 60 && !S.isFamily(h, o.id)) h.log(sim, `${josa(o.name, '과/와')} 절친이 되었다`);
    if (before > -60 && r.v <= -60) h.log(sim, `${josa(o.name, '과/와')} 원수가 되었다`);
    if (beforeLove < 50 && r.love >= 50 && !(h.lover === o || h.partner === o)) {
      h.log(sim, `${o.name}에게 반했다`);
      S.addMood(sim, h, 'love');
      h.say('♥', 90);
    }
    return r;
  };

  S.label = (sim, h, id, r) => {
    if (h.partner && h.partner.id === id) return '배우자';
    if (h.lover && h.lover.id === id) return '연인';
    if (h.parents.some((p) => p.id === id)) return '부모';
    if (h.children.includes(id)) return '자녀';
    if (h.affair === id) return '비밀 연인';
    const o = sim.byId.get(id);
    if (r.sibling) return '형제자매';
    if (r.forcedBy) return '강제 혼인';
    if (o && o.stalking === h.id) return '스토커';
    if (h.stalking === id) return '집착 대상';
    if (r.blackmailer) return '협박범';
    if (r.blackmailing) return '약점 잡은 사람';
    if (r.spouse) return o ? '전 배우자' : '먼저 간 배우자';
    if ((r.grudge || 0) >= 70) return '원수';
    if (r.rival && (r.jealousy || 0) >= 40) return '연적';
    if (r.ex) return '옛 연인';
    if (!o && r.love >= 50) return '그리운 사람';
    if (r.mentor) return '스승';
    if (r.pupil) return '제자';
    if (r.love >= 50) {
      const back = o && o.rel.get(h.id);
      return back && back.love >= 50 ? '썸' : '짝사랑';
    }
    if ((r.trust || 0) >= 70 && r.v >= 50) return '은인';
    if (r.cellmate && r.v >= 20) return '감방 동료';
    if (r.v >= 75) return '절친';
    if ((r.respect || 0) >= 75) return '존경하는 사람';
    if ((r.fear || 0) >= 60) return '두려운 사람';
    if ((r.jealousy || 0) >= 50) return '라이벌';
    if (r.v >= 40) return '친구';
    if (r.owe > 0) return '빚진 사람';
    if (r.lent > 0) return '돈 빌려준 사람';
    if (r.v <= -60) return '원수';
    if (r.v <= -30 || (r.grudge || 0) >= 40) return '앙숙';
    return '아는 사이';
  };

  // 성격 궁합
  S.compat = (a, b) => {
    let s = 0;
    for (const t of a.traits) {
      if (b.has(t)) s += 2;
      if (G.OPP[t] && b.has(G.OPP[t])) s -= 2;
    }
    if (a.tribe && a.tribe === b.tribe) s += 1;
    s += G.Persona.hobbyCompat(a, b);
    return s;
  };

  const attached = (h) => (h.partner && h.partner.alive) || (h.lover && h.lover.alive);
  const canRomance = (sim, a, b) =>
    a.adult && b.adult && a.age < 60 && b.age < 60 && Math.abs(a.age - b.age) < 16 && !sim.isRelative(a, b);
  // 대부분은 이성에게 끌리고, 가끔 동성에게도 끌린다
  const attraction = (a, b) => (a.gender !== b.gender ? 1 : 0.04 + a.p.open / 100 * 0.2) * G.Persona.appeal(a, b);

  // ---------------- 60틱마다: 사람들 사이의 일 ----------------
  // 달력 기준 (하루에 몇 번): 마음, 범죄, 질병, 결혼·임신·이별
  S.lifeTick = (sim) => {
    for (const h of sim.humans) {
      if (!h.alive) continue;
      G.Mind.tick(sim, h);
      if (h.alive) G.Crime.tick(sim, h);
      if (h.alive) G.Migrate.personTick(sim, h);
      if (h.alive) G.Persona.tick(sim, h);
    }
    S.couples(sim);
  };

  // 활동 기준: 기분, 만남과 수다, 연애 감정
  S.activityTick = (sim) => {
    // 관계가 변하는 빠르기가 달력과 맞도록, 느린 시간 흐름에서는 만남을 줄인다
    const k = Math.min(1, sim.dt / sim.pace * 2);
    for (const h of sim.humans) {
      if (!h.alive) continue;
      S.updateMood(sim, h);
      if (chance(k)) S.loveDrift(sim, h);
      G.Blood.witness(sim, h);
      if (h.age < 3 || h.state === 'fight' || h.state === 'pray' || h.state === 'sleep' || h.held) continue;
      // 불안증·우울증이 있으면 사람을 덜 만난다
      if (h.mind && (h.mind.c === '불안증' || h.mind.c === '우울증') && chance(0.4)) continue;
      if (!chance(k)) continue;
      S.ripen(sim, h);
      // 외향적일수록 사람을 자주 만난다
      if (!chance(0.25 + h.p.extra / 100 * 0.6)) continue;
      let pool = [];
      sim.near(h.x, h.y, 4, (o) => { if (o !== h && o.age >= 3 && o.state !== 'fight' && o.state !== 'sleep' && !!o.jail === !!h.jail && !(S.peek(o, h) || {}).avoid) pool.push(o); });
      if (!pool.length) {
        if (h.adult && chance(0.05) && ![...h.rel.values()].some((r) => r.v >= 40)) S.addMood(sim, h, 'lonely');
        continue;
      }
      // 아는 사람과 더 자주 어울린다
      pool.sort((a, b) => (S.peek(h, b)?.v || 0) + (S.peek(h, b)?.love || 0) - (S.peek(h, a)?.v || 0) - (S.peek(h, a)?.love || 0));
      const o = chance(0.4) ? pool[0] : pick(pool);
      S.interact(sim, h, o);
    }
  };
  S.tick = (sim) => { S.activityTick(sim); S.lifeTick(sim); };

  // 두 사람이 마주쳤을 때
  S.interact = (sim, h, o) => {
    const r = S.rel(h, o), back = S.rel(o, h);
    const comp = S.compat(h, o);
    const angry = h.happy < 30 || S.hasMood(h, 'discord') || S.hasMood(h, 'jealous') || (r.grudge || 0) >= 50;
    h.social = 0; o.social = 0;
    const meet = (kind) => { G.Mind.onMeet(sim, h, o, kind); G.Mind.onMeet(sim, o, h, kind); };

    // 아이들끼리 놀기
    if (h.age < 14 && o.age < 14) {
      S.bump(sim, h, o, rand(3, 7)); S.bump(sim, o, h, rand(3, 7));
      S.addMood(sim, h, 'played'); S.addMood(sim, o, 'played');
      h.say('♪', 60); o.say('♪', 60);
      meet('chat');
      return;
    }
    // 형제자매
    if (r.sibling && chance(0.5)) {
      S.bump(sim, h, o, 3); S.bump(sim, o, h, 3);
      S.addMood(sim, h, 'hug'); S.addMood(sim, o, 'hug');
      meet('chat');
      return;
    }
    // 가족끼리
    const parentChild = h.children.includes(o.id) || o.children.includes(h.id);
    if (parentChild) {
      S.bump(sim, h, o, 4); S.bump(sim, o, h, 4);
      S.addMood(sim, h, 'hug'); S.addMood(sim, o, 'hug');
      meet('chat');
      return;
    }

    // 다툼
    let pArgue = 0.05 + (r.v < 0 ? 0.12 : 0) + (angry ? 0.15 : 0) - comp * 0.02 + ((r.jealousy || 0) > 50 ? 0.1 : 0);
    if (h.has('겁많은')) pArgue *= 0.6;
    if (h.has('충동적인')) pArgue *= 1.5;
    if (h.has('침착한')) pArgue *= 0.6;
    if (h.mind && h.mind.c === '편집증') pArgue += 0.15;
    pArgue *= (0.6 + (100 - h.p.agree) / 125) * (0.7 + h.p.impulse / 125);
    if (h.drunk > 0) pArgue *= 1.8;
    if ((r.fear || 0) > 60) pArgue *= 0.4; // 무서운 사람에게는 대들지 않는다
    if (chance(clamp(pArgue, 0.01, 0.6))) return S.argue(sim, h, o, r);

    // 슬픈 친구 위로
    const comfortTh = (h.has('다정한') ? 15 : h.has('냉정한') ? 60 : 30) + (50 - h.p.agree) * 0.4 + (h.teto > 50 ? 10 : h.teto < -50 ? -10 : 0);
    if ((o.happy < 35 || (o.mind && o.mind.sev > 30)) && r.v > comfortTh && h.happy > 40) {
      S.bump(sim, h, o, 6); S.bump(sim, o, h, 10);
      S.addMood(sim, o, 'comforted');
      G.Mind.support(sim, o, h.has('다정한') ? 12 : 7);
      meet('comfort');
      h.say('…', 60);
      if (sim.year - (o.lastComfortLog || -99) > 3) { o.lastComfortLog = sim.year; o.log(sim, `슬퍼할 때 ${josa(h.name, '이/가')} 위로해 주었다`); }
      return;
    }

    // 선물
    if ((h.has('너그러운') || r.love >= 40) && h.gold > 10 && r.v > 15 && chance(0.25)) {
      const g = randi(3, 8);
      h.gold -= g; o.gold += g;
      S.bump(sim, o, h, 10, r.love >= 40 ? 6 : 0);
      S.addMood(sim, o, 'gift');
      meet('gift');
      if (r.love >= 40 && sim.year - (h.lastGiftLog || -99) > 2) { h.lastGiftLog = sim.year; h.log(sim, `${o.name}에게 선물을 주었다`); }
      h.say('♥', 50);
      return;
    }

    // 수다 (기본)
    const dv = rand(2, 5) + comp;
    S.bump(sim, h, o, dv); S.bump(sim, o, h, dv * 0.8);
    S.addMood(sim, h, 'chat'); S.addMood(sim, o, 'chat');
    h.say('♪', 50);
    meet('chat');

    // 끌림
    // 첫눈에 반하기
    if (canRomance(sim, h, o) && !attached(h) && r.love < 30 && chance(0.17 * attraction(h, o) * (comp >= 2 ? 2 : 1) * (0.6 + h.p.impulse / 125))) {
      S.bump(sim, h, o, 5, rand(25, 45));
    } else if (canRomance(sim, h, o) && r.v > 15) {
      let dl = rand(3, 8) * attraction(h, o) * (comp > 0 ? 1.5 : 1);
      if (h.happy > 65) dl *= 1.3;
      if (h.has('다정한')) dl *= 1.3;
      if ((r.trust || 0) < -30) dl *= 0.3;
      if (attached(h) && !(h.lover === o || h.partner === o)) dl *= (S.partnerLove(h) < 40 ? 0.6 : 0.1);
      S.bump(sim, h, o, 0, dl);
    }
    // 고백
    // 충동적이고 테토일수록 먼저 고백한다
    const pConfess = 0.25 + h.p.impulse / 250 + Math.max(0, h.teto) / 400;
    if (r.love >= 50 && !attached(h) && !attached(o) && canRomance(sim, h, o) && chance(pConfess)) S.confess(sim, h, o);
    // 바람·양다리: 마음이 식었거나 충동적일 때, 상대의 매력이 높을수록 잘 넘어온다
    else if (r.love >= 65 && attached(h) && !h.affair && S.mate(h) !== o) {
      const cold = S.partnerLove(h) < 40;
      const tempt = (h.p.impulse > 70 || h.p.open > 75) && G.Persona.charm(o) > 65;
      const need = 50 - (G.Persona.charm(h) - 50) * 0.5;
      if ((cold || tempt) && back.love >= need && chance(0.2 * (0.5 + h.p.impulse / 100))) {
        h.affair = o.id; o.affair = h.id;
        const two = !h.partner;
        h.log(sim, `${josa(o.name, '과/와')} 몰래 만나기 시작했다${two ? ' (양다리)' : ''}`);
        o.log(sim, `${josa(h.name, '과/와')} 몰래 만나기 시작했다`);
        if (h.p.agree > 40 && !h.has('냉정한')) S.addMood(sim, h, 'guilty');
        sim.stats.affairs = (sim.stats.affairs || 0) + 1;
      }
    }
  };

  S.mate = (h) => (h.partner && h.partner.alive && h.partner) || (h.lover && h.lover.alive && h.lover) || null;

  S.partnerLove = (h) => {
    const p = (h.partner && h.partner.alive && h.partner) || (h.lover && h.lover.alive && h.lover);
    if (!p) return 0;
    return (h.rel.get(p.id) || { love: 0 }).love;
  };

  S.argue = (sim, h, o, r) => {
    S.bump(sim, h, o, -rand(8, 15)); S.bump(sim, o, h, -rand(6, 12));
    if (h.lover === o || h.partner === o) { S.bump(sim, h, o, 0, -rand(4, 9)); S.bump(sim, o, h, 0, -rand(3, 7)); }
    S.addMood(sim, h, 'argued'); S.addMood(sim, o, 'argued');
    G.Mind.onMeet(sim, h, o, 'argue'); G.Mind.onMeet(sim, o, h, 'argue');
    if (h.partner === o) G.Crime2.domestic(sim, h, o);
    h.say('#', 70); o.say('#', 70);
    const hot = h.has('용감한') || h.has('충동적인') || S.hasMood(h, 'jealous') || S.hasMood(h, 'discord') || h.happy < 25 || (r.grudge || 0) > 40;
    if (hot && r.v < -30 && chance(0.3)) {
      h.health -= rand(5, 12); o.health -= rand(5, 12);
      S.addMood(sim, h, 'brawl'); S.addMood(sim, o, 'brawl');
      G.Mind.onMeet(sim, h, o, 'brawl'); G.Mind.onMeet(sim, o, h, 'brawl');
      h.log(sim, `${josa(o.name, '과/와')} 주먹다짐을 했다`);
      o.log(sim, `${josa(h.name, '과/와')} 주먹다짐을 했다`);
      h.say('!', 60); o.say('!', 60);
    }
  };

  S.confess = (sim, h, o) => {
    const back = S.rel(o, h);
    const lonely = o.age >= 22 && !attached(o) && ![...o.rel.values()].some((r) => r.love >= 50);
    const charmBonus = (G.Persona.charm(h) - 50) * 0.4;
    const yes = back.love >= 35 - charmBonus || (back.v >= 50 && chance(0.5)) || (back.v >= 30 && o.happy < 35 && chance(0.4)) || (lonely && back.v >= 5 && chance(0.45))
      || (o.p.impulse > 75 && G.Persona.appeal(o, h) > 1.3 && chance(0.4));
    h.say('♥', 120);
    if (yes) {
      S.makeLovers(sim, h, o);
      h.log(sim, `${o.name}에게 고백해 연인이 되었다`);
      o.log(sim, `${h.name}의 고백을 받아 연인이 되었다`);
    } else {
      S.bump(sim, h, o, -5, -20);
      S.addMood(sim, h, 'rejected');
      if (h.has('냉정한') || h.has('질투심 많은') || h.has('충동적인')) G.Mind.adj(sim, h, o, { grudge: 15 });
      G.Crime2.startStalking(sim, h, o);
      G.Crime3.onRejected(sim, h, o);
      h.log(sim, `${o.name}에게 고백했다가 거절당했다`);
      h.say('…', 120);
    }
  };

  S.makeLovers = (sim, a, b) => {
    a.lover = b; b.lover = a;
    // 두 사람을 짝사랑하던 사람들의 질투
    for (const [x, y] of [[a, b], [b, a]]) {
      for (const p of sim.humans) {
        if (!p.alive || p === x || p === y) continue;
        const pr = p.rel.get(x.id);
        if (!pr || pr.love < 50) continue;
        G.Mind.adj(sim, p, y, { jealousy: 35, grudge: 18 });
        S.rel(p, y).rival = true;
        S.addMood(sim, p, 'jealous');
        p.log(sim, `${josa(x.name, '이/가')} ${josa(y.name, '과/와')} 사귀게 되어 질투에 휩싸였다`);
      }
    }
    a.loverSince = sim.year; b.loverSince = sim.year;
    S.bump(sim, a, b, 10, 15); S.bump(sim, b, a, 10, 15);
    S.addMood(sim, a, 'lover'); S.addMood(sim, b, 'lover');
    a.say('♥', 120); b.say('♥', 120);
    sim.stats.couples = (sim.stats.couples || 0) + 1;
  };

  // 연애 감정의 변화: 함께 있으면 깊어지고, 멀어지면 식는다
  S.loveDrift = (sim, h) => {
    const p = (h.partner && h.partner.alive && h.partner) || (h.lover && h.lover.alive && h.lover);
    if (!p) return;
    const r = S.rel(h, p);
    const close = G.dist(h.x, h.y, p.x, p.y) < 6;
    r.love = clamp(r.love + (close ? 1 : -0.15) + (h.affair ? -0.6 : 0), 0, 100);
    r.v = clamp(r.v + (close ? 0.2 : 0), -100, 100);
  };

  // 오래된 친구 사이가 사랑으로 바뀌기도 한다
  S.ripen = (sim, h) => {
    if (!h.adult || h.age > 55 || attached(h) || !chance(0.8)) return;
    // 오래 혼자인 사람에게는 부족이 짝을 소개해 준다
    if (h.age >= 20 && h.tribe && chance(0.15) && ![...h.rel.values()].some((r) => r.love >= 30)) {
      const cands = h.tribe.members.filter((o) => o !== h && o.alive && !attached(o) && o.gender !== h.gender && canRomance(sim, h, o));
      if (cands.length) {
        const o = pick(cands);
        S.bump(sim, h, o, rand(10, 20), rand(15, 30)); S.bump(sim, o, h, rand(10, 20), rand(10, 25));
        if (sim.year - (h.lastMatchLog || -99) > 3) { h.lastMatchLog = sim.year; h.log(sim, `부족 사람들의 소개로 ${josa(o.name, '을/를')} 만났다`); }
        return;
      }
    }
    for (const [id, r] of h.rel) {
      if (r.v < 20 || r.love >= 50) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive || !canRomance(sim, h, o) || attached(o)) continue;
      S.bump(sim, h, o, 0, rand(3, 9) * attraction(h, o));
      if (S.rel(h, o).love >= 50 && chance(0.5)) S.confess(sim, h, o);
      break;
    }
  };

  // 연인·부부의 큰일: 결혼, 이별, 이혼, 바람이 들키는 일, 임신
  S.couples = (sim) => {
    const done = new Set();
    for (const h of sim.humans) {
      if (!h.alive || done.has(h.id)) continue;
      // 바람이 들킨다
      if (h.affair) {
        const other = sim.byId.get(h.affair);
        if (!other || !other.alive) h.affair = null;
        else {
          const spouse = h.partner && h.partner.alive ? h.partner : h.lover && h.lover.alive ? h.lover : null;
          const sneak = h.has('교활한') ? 0.4 : 1;
          if (spouse && G.dist(spouse.x, spouse.y, h.x, h.y) < 5 && chance(0.12 * sneak * (0.6 + (spouse.p ? spouse.p.neuro : 50) / 125))) {
            S.addMood(sim, spouse, 'betrayed'); S.addMood(sim, spouse, 'jealous');
            S.bump(sim, spouse, h, -40, -45); S.bump(sim, spouse, other, -50);
            G.Mind.adj(sim, spouse, h, { trust: -60, grudge: 45 });
            G.Mind.adj(sim, spouse, other, { grudge: 65, jealousy: 70 });
            S.rel(spouse, other).rival = true;
            G.Crime2.adultery(sim, h, other);
            spouse.log(sim, `${josa(h.name, '이/가')} ${josa(other.name, '과/와')} 몰래 만나는 것을 알게 되었다`);
            h.log(sim, `${josa(other.name, "과/와")}의 관계를 ${spouse.name}에게 들켰다`);
            spouse.say('#', 150);
            if (sim.year - (sim.lastAffairEvent || -99) > 2) {
              sim.lastAffairEvent = sim.year;
              sim.event(`${josa(spouse.name, '이/가')} ${h.name}의 바람을 알아챘습니다`, '#ff7a9a', h.x, h.y);
            }
          }
        }
      }
      // 연인 → 결혼 또는 이별
      if (h.lover && h.lover.alive && !h.partner) {
        const o = h.lover;
        done.add(o.id);
        const a = S.rel(h, o).love, b = S.rel(o, h).love;
        if (a >= 70 && b >= 70 && sim.year - (h.loverSince || 0) >= 1 && chance(0.3)) S.wed(sim, h, o);
        else if (Math.min(a, b) < 22 && chance(0.4)) S.breakUp(sim, h, o, false);
      } else if (h.lover && !h.lover.alive) h.lover = null;
      // 부부: 이혼
      if (h.partner && h.partner.alive) {
        const o = h.partner;
        done.add(o.id);
        const a = S.rel(h, o).love, b = S.rel(o, h).love;
        if (Math.min(a, b) < 10 && S.rel(h, o).v < -30 && chance(0.15)) S.breakUp(sim, h, o, true);
        else S.tryPregnancy(sim, h, o, 1);
        continue;
      } else if (h.lover && h.lover.alive) {
        S.tryPregnancy(sim, h, h.lover, 0.4);
      }
    }
  };

  S.wed = (sim, a, b) => {
    a.partner = b; b.partner = a;
    a.wedAt = sim.year; b.wedAt = sim.year;
    S.rel(a, b).spouse = true; S.rel(b, a).spouse = true;
    a.lover = null; b.lover = null;
    for (const x of [a, b]) { S.addMood(sim, x, 'wedding'); x.say('♥', 180); }
    a.log(sim, `${josa(b.name, '과/와')} 결혼했다`);
    b.log(sim, `${josa(a.name, '과/와')} 결혼했다`);
    // 하객들
    let guests = 0;
    sim.near(a.x, a.y, 8, (g) => {
      if (g === a || g === b) return;
      S.addMood(sim, g, 'guest'); g.say('♪', 90);
      S.bump(sim, g, a, 3); S.bump(sim, g, b, 3);
      guests++;
    });
    sim.effects.push({ kind: 'hearts', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, age: 0, ttl: 120 });
    sim.stats.weddings = (sim.stats.weddings || 0) + 1;
    const t = a.tribe;
    const text = `${josa(a.name, '과/와')} ${josa(b.name, '이/가')} 결혼했습니다${guests ? ` (하객 ${guests}명)` : ''}`;
    if (t) t.log(sim, text, sim.humans.length < 120 || chance(0.25));
    else sim.event(text, '#ff9ac1', a.x, a.y);
  };

  S.breakUp = (sim, a, b, married) => {
    if (married) { a.partner = null; b.partner = null; } else { a.lover = null; b.lover = null; }
    for (const x of [a, b]) { S.addMood(sim, x, married ? 'divorce' : 'breakup'); x.say('…', 150); x.affair = null; }
    a.log(sim, `${josa(b.name, '과/와')} ${married ? '이혼했다' : '헤어졌다'}`);
    b.log(sim, `${josa(a.name, '과/와')} ${married ? '이혼했다' : '헤어졌다'}`);
    S.bump(sim, a, b, -15, -30); S.bump(sim, b, a, -15, -30);
    S.rel(a, b).ex = true; S.rel(b, a).ex = true;
    if (married && a.tribe) a.tribe.log(sim, `${josa(a.name, '과/와')} ${josa(b.name, '이/가')} 이혼했습니다`, false);
  };

  S.tryPregnancy = (sim, h, o, mult) => {
    const mom = h.gender === 'F' ? h : o.gender === 'F' ? o : null;
    const dad = mom === h ? o : h;
    if (!mom || dad.gender !== 'M' || mom.pregnant > 0) return;
    if (mom.age < 18 || mom.age >= 45 || sim.year - mom.lastBirth < 1.5 || sim.humans.length >= G.CFG.MAX_POP) return;
    const t = mom.tribe;
    const fed = t ? t.stock.food > t.members.length * 0.5 : mom.hunger < 50;
    if (!fed) return;
    let p = 0.18 * mult;
    if (sim.season === 0) p *= 1.2;
    if (mom.happy > 65) p *= 1.3;
    if (S.hasMood(mom, 'fertile')) p *= 3;
    if (chance(p)) S.conceive(sim, mom, dad);
  };

  S.conceive = (sim, mom, dad) => {
    mom.pregnant = Math.floor(G.CFG.TPY * PREG_YEARS);
    mom.babyFather = { id: dad.id, name: dad.name, traits: dad.traits.slice(), faith: dad.faith };
    S.addMood(sim, mom, 'expecting'); S.addMood(sim, dad, 'expecting');
    mom.log(sim, `${dad.name}의 아이를 가졌다`);
    dad.log(sim, `${josa(mom.name, '이/가')} 아이를 가졌다`);
    mom.say('♥', 90);
  };

  // 출산 (human.update에서 임신이 끝나면 호출)
  S.deliver = (sim, mom) => {
    const dadInfo = mom.babyFather;
    mom.pregnant = 0; mom.babyFather = null;
    const dad = dadInfo && sim.byId.get(dadInfo.id);
    const c = sim.birth(mom, dad || dadInfo);
    for (const p of [mom, dad]) {
      if (!p || !p.alive) continue;
      S.addMood(sim, p, 'newborn');
      S.bump(sim, p, c, 60); S.bump(sim, c, p, 60);
    }
    // 드물게 출산이 위험하다 (사제나 신의 축복이 있으면 안전)
    let risk = 0.012;
    if (S.hasMood(mom, 'blessed') || S.hasMood(mom, 'fertile')) risk = 0;
    sim.near(mom.x, mom.y, 4, (o) => { if (o.job === J.PRIEST) risk *= 0.3; if (o.job === J.HEALER) risk *= 0.15; });
    if (chance(risk)) sim.kill(mom, '난산');
    // 원치 않는 임신이었거나 굶주림 속이면 아이를 버리기도 한다
    if (mom.alive && c.alive) G.Crime3.onBirth(sim, mom, c);
    else mom.unwantedPreg = false;
    return c;
  };

  // ---------------- 축제 ----------------
  S.festival = (sim, t, name = '모닥불 축제') => {
    if (t.fireAlarm) return;
    t.stock.food -= Math.floor(t.members.length * 0.5);
    t.lastFestival = sim.year;
    for (const m of t.members) {
      if (m.jail) continue;
      S.addMood(sim, m, 'festival');
      if (m.state !== 'fight') m.goTo(sim, t.cx + rand(-2.5, 2.5), t.cy + rand(-2.5, 2.5), { kind: 'party' });
    }
    // 축제에서 사람들이 가까워지고, 사랑이 싹튼다
    const adults = shuffle(t.members.filter((m) => m.adult));
    for (let i = 0; i + 1 < adults.length && i < 24; i += 2) {
      const a = adults[i], b = adults[i + 1];
      S.bump(sim, a, b, rand(4, 10)); S.bump(sim, b, a, rand(4, 10));
      if (canRomance(sim, a, b) && !attached(a) && !attached(b)) {
        S.bump(sim, a, b, 0, rand(5, 15) * attraction(a, b)); S.bump(sim, b, a, 0, rand(5, 15) * attraction(a, b));
      }
    }
    for (const m of t.members) if (m.adult && chance(0.3)) m.log(sim, `${t.name}의 ${name}에서 춤을 추었다`);
    t.log(sim, `${josa(t.name, '이/가')} ${josa(name, '을/를')} 열었습니다`, sim.humans.length < 40);
  };

  // ---------------- 데이트 ----------------
  // 경치 좋은 곳(바닷가, 숲 가장자리)을 찾는다
  S.dateSpot = (sim, h) => {
    const w = sim.world;
    const cx = h.tribe ? h.tribe.cx : h.x, cy = h.tribe ? h.tribe.cy : h.y;
    for (let k = 0; k < 30; k++) {
      const x = cx + rand(-10, 10), y = cy + rand(-10, 10);
      const t = w.typeAt(x, y);
      if (t === G.T.SAND || t === G.T.FOREST || t === G.T.HILL) return { x, y, place: t === G.T.SAND ? '바닷가' : t === G.T.FOREST ? '숲' : '언덕' };
    }
    return { x: cx + rand(-4, 4), y: cy + rand(-4, 4), place: '들판' };
  };

  S.startDate = (sim, h) => {
    const o = (h.partner && h.partner.alive && h.partner) || (h.lover && h.lover.alive && h.lover)
      || (h.affair && sim.byId.get(h.affair));
    if (!o || !o.alive || o.jail || o.hunger > 50 || o.state === 'fight' || o.state === 'gather' || o.state === 'pray' || o.state === 'busy') return false;
    if (G.dist(h.x, h.y, o.x, o.y) > 20) return false;
    const spot = S.dateSpot(sim, h);
    if (!h.goTo(sim, spot.x, spot.y, { kind: 'date', with: o.id, place: spot.place })) return false;
    o.goTo(sim, spot.x + 0.6, spot.y, { kind: 'date', with: h.id, place: spot.place });
    return true;
  };

  S.onDateArrive = (sim, h, task) => {
    h.state = 'rest'; h.timer = 140;
    const o = sim.byId.get(task.with);
    if (!o || !o.alive || G.dist(h.x, h.y, o.x, o.y) > 2.5) return;
    h.say('♥', 140); o.say('♥', 140);
    S.bump(sim, h, o, 4, 6); S.bump(sim, o, h, 4, 6);
    S.addMood(sim, h, 'date'); S.addMood(sim, o, 'date');
    if (sim.year - (h.lastDateLog || -99) > 2) {
      h.lastDateLog = sim.year; o.lastDateLog = sim.year;
      const secret = h.affair === o.id ? '몰래 ' : '';
      h.log(sim, `${josa(o.name, '과/와')} ${task.place}에서 ${secret}데이트를 했다`);
      o.log(sim, `${josa(h.name, '과/와')} ${task.place}에서 ${secret}데이트를 했다`);
    }
  };

  // 친구 찾아가기
  S.visitFriend = (sim, h) => {
    let best = null, bv = 39;
    for (const [id, r] of h.rel) {
      if (r.v <= bv) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive || G.dist(o.x, o.y, h.x, h.y) > 15) continue;
      best = o; bv = r.v;
    }
    if (!best) return false;
    return h.goTo(sim, best.x + rand(-0.5, 0.5), best.y + rand(-0.5, 0.5), { kind: 'visit', with: best.id });
  };

  // ---------------- 신의 권능: 사랑과 불화 ----------------
  S.cupid = (sim, a, b) => {
    if (!a || !b || a === b || !a.alive || !b.alive) return { ok: false, msg: '서로 다른 두 사람을 골라야 합니다' };
    if (!a.adult || !b.adult) return { ok: false, msg: '어른끼리만 이어줄 수 있습니다' };
    if (sim.isRelative(a, b)) return { ok: false, msg: '가족끼리는 이어줄 수 없습니다' };
    const cost = G.POWERS.cupid.cost;
    if (sim.faith < cost) return { ok: false, msg: `신앙이 부족합니다 (필요 ${cost})` };
    sim.faith -= cost;
    for (const [x, y] of [[a, b], [b, a]]) {
      const r = S.rel(x, y);
      r.love = 95; r.v = Math.max(r.v, 60);
      S.addMood(sim, x, 'cupid');
      x.log(sim, `신의 화살을 맞고 ${y.name}에게 운명적인 사랑을 느꼈다`);
      x.miracles++;
      x.faith = Math.min(100, x.faith + 10);
    }
    sim.effects.push({ kind: 'hearts', x: a.x, y: a.y, age: 0, ttl: 90 });
    sim.effects.push({ kind: 'hearts', x: b.x, y: b.y, age: 0, ttl: 90 });
    sim.effects.push({ kind: 'arrow', x: a.x, y: a.y, x2: b.x, y2: b.y, age: 0, ttl: 50 });
    // 질투: 원래 짝, 그리고 두 사람을 짝사랑하던 사람들
    const jealous = [];
    const bothFree = !attached(a) && !attached(b);
    for (const [x, y] of [[a, b], [b, a]]) {
      const m = S.mate(x);
      if (m && m !== y) {
        G.Mind.adj(sim, m, y, { jealousy: 45, grudge: 22 });
        S.rel(m, y).rival = true;
        G.Mind.adj(sim, m, x, { trust: -15 });
        S.bump(sim, m, x, 0, -8);
        S.addMood(sim, m, 'suspicious');
        m.log(sim, `${josa(x.name, '이/가')} ${y.name}에게 마음을 빼앗긴 것 같아 질투가 났다`);
        m.say('#', 150);
        if (!m.jail && (m.p.impulse > 45 || chance(0.5))) m.goTo(sim, y.x, y.y, { kind: 'confront', with: y.id });
        jealous.push(m.name);
      }
      if (bothFree) continue; // 둘 다 혼자면 makeLovers가 짝사랑하던 사람들의 질투를 처리한다
      for (const p of sim.humans) {
        if (!p.alive || p === x || p === y || p === m) continue;
        const pr = p.rel.get(x.id);
        if (!pr || pr.love < 50) continue;
        G.Mind.adj(sim, p, y, { jealousy: 35, grudge: 15 });
        S.rel(p, y).rival = true;
        S.addMood(sim, p, 'jealous');
        p.log(sim, `${josa(x.name, '이/가')} ${y.name}에게 빠진 것을 보고 질투에 휩싸였다`);
        jealous.push(p.name);
      }
    }
    let msg;
    if (a.partner === b || a.lover === b) {
      // 이미 짝인 두 사람: 식은 사랑이 다시 불타오른다
      a.affair = null; b.affair = null;
      msg = `신이 ${josa(a.name, '과/와')} ${b.name}의 사랑을 다시 불타오르게 했습니다`;
    } else if (!attached(a) && !attached(b)) {
      S.makeLovers(sim, a, b);
      msg = `신의 화살이 ${josa(a.name, '과/와')} ${josa(b.name, '을/를')} 이어주었습니다`;
    } else {
      // 이미 짝이 있다면 금지된 사랑이 시작된다
      a.affair = b.id; b.affair = a.id;
      S.addMood(sim, a, 'guilty'); S.addMood(sim, b, 'guilty');
      msg = `신의 화살이 ${josa(a.name, '과/와')} ${b.name} 사이에 금지된 사랑을 피웠습니다`;
    }
    // 둘이 서로를 찾아간다
    b.goTo(sim, a.x + 0.5, a.y, { kind: 'date', with: a.id, place: '들판' });
    if (jealous.length) msg += `. ${jealous.slice(0, 3).join(', ')}${jealous.length > 3 ? ' 등' : ''}이(가) 질투에 휩싸였습니다`;
    sim.event(msg, '#ff7ab6', a.x, a.y);
    return { ok: true };
  };

  S.discord = (sim, x, y) => {
    const ppl = [];
    sim.near(x, y, 5, (h) => ppl.push(h));
    for (const h of ppl) { S.addMood(sim, h, 'discord'); h.say('#', 120); }
    for (let i = 0; i < ppl.length; i++) {
      for (let j = i + 1; j < ppl.length && j < i + 6; j++) {
        S.bump(sim, ppl[i], ppl[j], -rand(10, 25), -rand(5, 15));
        S.bump(sim, ppl[j], ppl[i], -rand(10, 25), -rand(5, 15));
      }
    }
    for (const h of ppl.slice(0, 6)) if (chance(0.5)) h.log(sim, '알 수 없는 짜증에 사람들과 다투었다');
    sim.effects.push({ kind: 'discord', x, y, age: 0, ttl: 90 });
    if (ppl.length) sim.event(`불화의 기운이 ${ppl.length}명의 마음을 흔들었습니다`, '#b07ad9', x, y);
  };

  S.fertility = (sim, x, y) => {
    let n = 0;
    sim.near(x, y, 5, (h) => {
      if (!h.adult) return;
      S.addMood(sim, h, 'fertile');
      h.faith = Math.min(100, h.faith + 8);
      n++;
      const p = (h.partner && h.partner.alive && h.partner) || (h.lover && h.lover.alive && h.lover);
      if (h.gender === 'F' && p && p.gender === 'M' && !h.pregnant && h.age < 45 && chance(0.5)) S.conceive(sim, h, p);
      else if (h.gender === 'F' && h.age < 45) h.log(sim, '다산의 축복을 받았다');
    });
    sim.effects.push({ kind: 'bless', x, y, r: 5, age: 0, ttl: 70, color: '255,150,200' });
    if (n) sim.event(`${n}명이 다산의 축복을 받았습니다`, '#ff9ac1', x, y);
  };
})();
