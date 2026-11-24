// 마음: 관계의 여러 차원(신뢰·존경·두려움·원한·질투·빚), 스트레스, 외로움, 정신 건강
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const M = (G.Mind = {});

  // 관계 한 줄에 들어가는 수치
  //  v 호감 -100~100 · love 사랑 0~100 · trust 신뢰 -100~100 · respect 존경 0~100
  //  fear 두려움 0~100 · grudge 원한 0~100 · jealousy 질투 0~100 · owe 내가 빌린 돈 · lent 내가 빌려준 돈
  M.DIMS = {
    trust: { name: '신뢰', min: -100, max: 100 },
    respect: { name: '존경', min: 0, max: 100 },
    fear: { name: '두려움', min: 0, max: 100 },
    grudge: { name: '원한', min: 0, max: 100 },
    jealousy: { name: '질투', min: 0, max: 100 },
  };

  M.adj = (sim, h, o, patch) => {
    const r = G.Social.rel(h, o);
    for (const k in patch) {
      const d = M.DIMS[k];
      const before = r[k] || 0;
      let mult = 1;
      if (k === 'jealousy' && h.has('질투심 많은')) mult = 2;
      if (k === 'grudge' && h.has('너그러운') && patch[k] > 0) mult = 0.6;
      if (k === 'grudge' && h.has('냉정한') && patch[k] > 0) mult = 1.3;
      r[k] = clamp(before + patch[k] * mult, d.min, d.max);
      if (k === 'grudge' && before < 70 && r[k] >= 70) h.log(sim, `${o.name}에게 깊은 원한을 품었다`);
      if (k === 'trust' && before > -50 && r[k] <= -50) h.log(sim, `더 이상 ${josa(o.name, '을/를')} 믿지 않는다`);
      if (k === 'respect' && before < 75 && r[k] >= 75 && !G.Social.isFamily(h, o.id)) h.log(sim, `${josa(o.name, '을/를')} 깊이 존경하게 되었다`);
    }
    return r;
  };

  // 그 사람이 얼마나 존경받을 만한가
  M.respectScore = (o) => {
    let s = 10 + Math.min(30, o.age * 0.5);
    if (o.job === J.CHIEF) s += 35;
    if (o.job === J.PRIEST || o.job === J.HEALER) s += 20;
    if (o.job === J.SMITH) s += 10;
    s += Math.min(20, o.kills * 4) + Math.min(15, o.gold / 10);
    s -= (o.notoriety || 0) * 0.6;
    return clamp(s, 0, 100);
  };
  M.fearScore = (o) => clamp((o.notoriety || 0) * 0.8 + o.kills * 6 + (o.job === J.WARRIOR ? 15 : 0) + (o.job === J.GUARD ? 10 : 0), 0, 100);

  // 두 사람이 어울릴 때마다 조금씩 변하는 것들
  M.onMeet = (sim, h, o, kind) => {
    const r = G.Social.rel(h, o);
    r.respect = (r.respect || 0) + (M.respectScore(o) - (r.respect || 0)) * 0.08;
    r.fear = (r.fear || 0) + (M.fearScore(o) - (r.fear || 0)) * 0.08;
    // 좋게 만나면 원한과 질투가 조금 풀린다
    if (kind === 'chat' || kind === 'gift' || kind === 'comfort') {
      if (r.grudge) r.grudge = Math.max(0, r.grudge - (h.has('냉정한') ? 0.3 : h.has('너그러운') ? 2 : 1));
      if (r.jealousy) r.jealousy = Math.max(0, r.jealousy - 0.5);
    }
    if (kind === 'chat') M.adj(sim, h, o, { trust: 1 });
    if (kind === 'gift') M.adj(sim, h, o, { trust: 5 });
    if (kind === 'comfort') M.adj(sim, h, o, { trust: 6 });
    if (kind === 'argue') M.adj(sim, h, o, { trust: -3, grudge: 7 });
    if (kind === 'brawl') M.adj(sim, h, o, { grudge: 20, fear: o.has('용감한') ? 10 : 4 });
    // 부러움
    if (o.gold > h.gold * 3 + 30 && (h.has('질투심 많은') || h.has('탐욕스러운'))) M.adj(sim, h, o, { jealousy: 3 });
    // 연적: 내가 사랑하는 사람의 짝
    for (const [id, rr] of h.rel) {
      if (rr.love < 50 || id === o.id) continue;
      const crush = sim.byId.get(id);
      if (crush && crush.alive && (crush.partner === o || crush.lover === o) && h.partner !== crush && h.lover !== crush) {
        M.adj(sim, h, o, { jealousy: 5 });
        r.rival = true;
        if (r.jealousy >= 60) M.adj(sim, h, o, { grudge: 2 });
      }
    }
    // 빚 갚기
    if (r.owe > 0 && h.gold >= r.owe && !h.has('교활한')) M.repay(sim, h, o);
    // 돈 빌려주기
    else {
      const back = G.Social.rel(o, h);
      if (o.gold < 5 && h.gold > 30 && r.v >= 40 && (r.trust || 0) >= 10 && !back.owe && chance(h.has('너그러운') ? 0.3 : 0.12)) M.lend(sim, h, o);
    }
    // 오래 안 갚은 빚
    if (r.lent > 0 && r.lentAt && sim.year - r.lentAt > 3 && chance(0.2)) {
      M.adj(sim, h, o, { trust: -10, grudge: 8 });
      if (!r.debtLogged) { r.debtLogged = true; h.log(sim, `${josa(o.name, '이/가')} 빌려간 금화 ${r.lent}개를 갚지 않는다`); }
    }
  };

  M.lend = (sim, h, o) => {
    const amt = randi(10, 20);
    h.gold -= amt; o.gold += amt;
    const r = G.Social.rel(h, o), back = G.Social.rel(o, h);
    r.lent = (r.lent || 0) + amt; r.lentAt = sim.year;
    back.owe = (back.owe || 0) + amt;
    G.Social.bump(sim, o, h, 8);
    M.adj(sim, o, h, { trust: 8 });
    h.log(sim, `${o.name}에게 금화 ${amt}개를 빌려주었다`);
    o.log(sim, `${h.name}에게서 금화 ${amt}개를 빌렸다`);
  };

  M.repay = (sim, h, o) => {
    const r = G.Social.rel(h, o), back = G.Social.rel(o, h);
    const amt = r.owe;
    h.gold -= amt; o.gold += amt;
    r.owe = 0; back.lent = 0; back.debtLogged = false;
    M.adj(sim, o, h, { trust: 12 }); G.Social.bump(sim, o, h, 6);
    h.log(sim, `${o.name}에게 빌린 금화 ${amt}개를 갚았다`);
  };

  // 형제자매
  M.siblings = (a, b) => a.parents.length && b.parents.length && a.parents.some((p) => b.parents.some((q) => q.id === p.id));

  // 같은 일을 하는 나이 많은 사람이 스승이 된다
  M.findMentor = (sim, h) => {
    if (!h.tribe || !h.adult || h.age > 30) return;
    const cands = h.tribe.members.filter((m) => m !== h && m.job === h.job && m.age >= h.age + 10 && m.age < 65);
    if (!cands.length) return;
    const m = cands.sort((a, b) => (G.Social.peek(h, b)?.v || 0) - (G.Social.peek(h, a)?.v || 0))[0];
    const r = G.Social.rel(h, m), back = G.Social.rel(m, h);
    r.mentor = true; back.pupil = true;
    G.Social.bump(sim, h, m, 15); G.Social.bump(sim, m, h, 10);
    M.adj(sim, h, m, { respect: 30, trust: 15 });
    h.log(sim, `${josa(m.name, '을/를')} 스승으로 모시고 ${h.job} 일을 배웠다`);
    m.log(sim, `${josa(h.name, '을/를')} 제자로 받았다`);
  };

  // ---------------- 스트레스와 외로움 (60틱마다) ----------------
  M.tick = (sim, h) => {
    // 외로움: 오래 아무와도 어울리지 못하면 커진다
    // 외향적일수록 혼자 있으면 빨리 외로워진다
    h.social = clamp((h.social || 0) + 2.5 * (0.3 + h.p.extra / 100 * 1.3), 0, 100);
    // 질투: 연적이 내 짝 곁에 있으면 속이 끓는다
    const mate = G.Social.mate(h);
    if (mate) {
      for (const [id, r] of h.rel) {
        if (!r.rival || (r.jealousy || 0) < 40) continue;
        const rv = sim.byId.get(id);
        if (!rv || !rv.alive || G.dist(rv.x, rv.y, mate.x, mate.y) > 3) continue;
        M.adj(sim, h, rv, { jealousy: 4, grudge: 2 });
        G.Social.addMood(sim, h, 'jealous');
        if (!h.jail && chance(h.p.impulse / 300) && G.dist(h.x, h.y, rv.x, rv.y) < 15) h.goTo(sim, rv.x, rv.y, { kind: 'confront', with: rv.id });
        break;
      }
    }
    // 원한과 질투는 세월이 지나면 옅어진다 (한 해에 약 3)
    for (const r of h.rel.values()) {
      if (r.grudge) r.grudge = Math.max(0, r.grudge - (h.has('냉정한') ? 0.12 : 0.3));
      if (r.jealousy) r.jealousy = Math.max(0, r.jealousy - 0.4);
    }
    if (h.social > 70 && h.adult) G.Social.addMood(sim, h, 'lonely');
    // 스트레스
    let ds = -1.2;
    if (h.happy < 35) ds += 2;
    if (h.hunger > 80) ds += 2;
    if (h.jail) ds += 2;
    if (h.outlaw) ds += 1;
    for (const r of h.rel.values()) if ((r.grudge || 0) >= 60) { ds += 1; break; }
    if (h.happy > 65) ds -= 1.5;
    if (h.has('침착한')) ds *= ds > 0 ? 0.6 : 1.3;
    if (ds > 0) ds *= (0.6 + h.p.neuro / 100 * 0.9) * (h.p.consc > 70 ? 1.15 : h.p.consc < 30 ? 0.8 : 1);
    if (h.sick) ds += 1;
    if (h.has('충동적인') && ds > 0) ds *= 1.3;
    h.stress = clamp((h.stress || 0) + ds, 0, 100);
    if (h.happy < 25) h.lowTime = (h.lowTime || 0) + 1; else h.lowTime = Math.max(0, (h.lowTime || 0) - 1);
    if (h.stress > 75) h.highStress = (h.highStress || 0) + 1; else h.highStress = Math.max(0, (h.highStress || 0) - 1);
    M.checkOnset(sim, h);
    M.conditionTick(sim, h);
  };

  // ---------------- 정신 건강 ----------------
  // 병이 사람을 위험하게 만들지는 않는다. 대신 일, 어울림, 기분을 바꾸고, 주변의 도움으로 낫는다.
  M.CONDITIONS = {
    우울증: { desc: '기운이 없고 사람을 피한다. 일이 느려진다', mood: -15, color: '#7d8fc7' },
    불안증: { desc: '늘 초조하고 사람 많은 곳을 피한다', mood: -10, color: '#c7a77d' },
    트라우마: { desc: '끔찍한 기억이 자꾸 떠오른다', mood: -12, color: '#c77d9a' },
    편집증: { desc: '모두가 자신을 해치려 한다고 의심한다', mood: -8, color: '#9ac77d' },
  };

  M.setCondition = (sim, h, c, sev, why) => {
    if (h.mind) return;
    h.mind = { c, sev: sev ?? randi(40, 70), since: sim.year };
    h.log(sim, `${why ? why + ' ' : ''}${josa(c, '을/를')} 앓기 시작했다`);
    sim.stats.illness = (sim.stats.illness || 0) + 1;
  };

  M.checkOnset = (sim, h) => {
    if (h.mind || !h.adult) return;
    const res = (h.has('침착한') ? 0.5 : 1) * (0.5 + h.p.neuro / 100 * 1.5);
    if (h.lowTime >= 8 && chance(0.12 * res)) M.setCondition(sim, h, '우울증', null, '오랜 슬픔 끝에');
    else if (h.highStress >= 8 && chance(0.1 * res)) M.setCondition(sim, h, '불안증', null, '쌓인 스트레스로');
    else if (h.stress > 60 && h.has('의심 많은') && [...h.rel.values()].filter((r) => (r.trust || 0) <= -40).length >= 3 && chance(0.04)) {
      M.setCondition(sim, h, '편집증', null, '거듭된 배신 끝에');
    }
  };

  // 큰 충격을 겪었을 때 (살인 목격, 자식을 잃음, 전투, 운석)
  M.trauma = (sim, h, p, why) => {
    if (!h.alive || h.mind || h.age < 6) return;
    if (chance(p * (h.has('침착한') ? 0.5 : 1))) M.setCondition(sim, h, '트라우마', randi(40, 80), why);
  };

  M.conditionTick = (sim, h) => {
    const m = h.mind;
    if (!m) return;
    const C = M.CONDITIONS[m.c];
    // 자연 회복과 악화
    let d = h.happy > 50 ? -1.2 : h.happy < 30 ? 1 : -0.3;
    if (h.partner && h.partner.alive) d -= 0.4;
    if ([...h.rel.values()].filter((r) => r.v >= 60).length >= 2) d -= 0.4;
    m.sev = clamp(m.sev + d, 0, 100);
    // 증상
    if (m.c === '트라우마' && chance(0.08)) { G.Social.addMood(sim, h, 'flashback'); h.say('…', 90); }
    if (m.c === '편집증') {
      for (const r of h.rel.values()) if (!r.spouse) r.trust = Math.max(-100, (r.trust || 0) - 0.5);
      if (chance(0.05)) { h.say('?', 90); }
    }
    if (m.c === '우울증' && chance(0.05) && h.state !== 'jailed') { h.state = 'rest'; h.timer = 200; h.say('…', 150); }
    if (m.sev <= 0) {
      h.log(sim, `${m.c}에서 회복했다`);
      G.Social.addMood(sim, h, 'recovered');
      h.mind = null;
      sim.stats.recovered = (sim.stats.recovered || 0) + 1;
    }
    return C;
  };

  M.workMult = (h) => {
    if (!h.mind) return 1;
    return h.mind.c === '우울증' ? 1 + h.mind.sev / 150 : h.mind.c === '불안증' ? 1.15 : 1.05;
  };
  M.moodPenalty = (h) => (h.mind ? M.CONDITIONS[h.mind.c].mood * (0.5 + h.mind.sev / 200) : 0) - (h.stress || 0) * 0.15;

  // 위로받으면 병이 나아진다
  M.support = (sim, h, amount) => { if (h.mind) h.mind.sev = Math.max(0, h.mind.sev - amount); h.stress = Math.max(0, (h.stress || 0) - amount); };

  // ---------------- 치료사 ----------------
  M.findPatient = (sim, healer) => {
    const t = healer.tribe;
    if (!t) return null;
    let best = null, bs = 0;
    for (const m of t.members) {
      if (m === healer || !m.alive || m.jail) continue;
      const need = (m.maxHp - m.health) * 0.8 + (m.mind ? m.mind.sev : 0) + (m.stress > 60 ? 15 : 0) + (m.sick ? 30 : 0) + (m.addiction > 60 ? 15 : 0);
      if (need > 25 && need - G.dist(m.x, m.y, healer.x, healer.y) * 0.5 > bs) { bs = need; best = m; }
    }
    return best;
  };

  M.treat = (sim, healer, p) => {
    if (!p || !p.alive || G.dist(p.x, p.y, healer.x, healer.y) > 3) return;
    const herbal = healer.tribe && healer.tribe.has('약초학') ? 1.5 : 1;
    p.health = Math.min(p.maxHp, p.health + 30 * herbal);
    if (p.sick && chance(0.6 * herbal)) { p.log(sim, `치료사 ${healer.name} 덕분에 ${josa(p.sick.name, '이/가')} 나았다`); p.sick = null; }
    if (p.addiction > 20) p.addiction = Math.max(0, p.addiction - 15);
    const hadMind = p.mind ? p.mind.c : null;
    M.support(sim, p, randi(15, 25));
    G.Social.addMood(sim, p, 'treated');
    G.Social.bump(sim, p, healer, 8);
    M.adj(sim, p, healer, { trust: 6, respect: 5 });
    p.say('✚', 80); healer.say('✚', 80);
    if (sim.year - (p.lastTreatLog || -99) > 2) {
      p.lastTreatLog = sim.year;
      p.log(sim, `치료사 ${healer.name}에게 ${hadMind ? hadMind + ' 상담을' : '치료를'} 받았다`);
    }
  };

  // ---------------- 신의 권능: 치유 ----------------
  M.heal = (sim, x, y) => {
    let n = 0, minds = 0;
    sim.near(x, y, 5, (h) => {
      h.health = h.maxHp; h.stress = Math.max(0, (h.stress || 0) - 50); h.sick = null; h.addiction = Math.max(0, h.addiction - 40);
      if (h.mind) { h.mind.sev = Math.max(0, h.mind.sev - 60); minds++; }
      for (const r of h.rel.values()) if (r.grudge) r.grudge = Math.max(0, r.grudge - 30);
      G.Social.addMood(sim, h, 'healed');
      h.faith = Math.min(100, h.faith + 10); h.miracles++;
      h.say('✚', 90);
      n++;
    });
    sim.effects.push({ kind: 'bless', x, y, r: 5, age: 0, ttl: 70, color: '120,230,170' });
    if (n) sim.event(`신의 치유가 ${n}명의 몸과 마음을 어루만졌습니다${minds ? ` (마음의 병 ${minds}명)` : ''}`, '#7fe0a8', x, y);
  };
})();
