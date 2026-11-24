// 재범과 갱생, 그리고 여러 범죄
// 성 관련 범죄는 어른(18세 이상)끼리만 일어나고, 화면에는 그리지 않고 기록 문장으로만 남는다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const C = G.Crime, S = G.Social, M = G.Mind;
  const X = (G.Crime2 = {});

  Object.assign(C.SEV, {
    사기: 1, 횡령: 2, 뇌물: 2, '가축 도둑': 1, 밀렵: 1, '도박 사기': 1, 방화: 3, 독살: 5, 가정폭력: 2,
    인질극: 3, 무고: 2, 갈취: 2, 반역: 4, 탈영: 2, 공연음란: 2, 스토킹: 2, 성추행: 4,
  });
  Object.assign(G.MOODS, {
    disgusted: { t: '불쾌한 일을 겪었다', v: -12, d: 0.4 },
    stalked: { t: '누군가 자꾸 따라다닌다', v: -15, d: 0.5 },
    violated: { t: '성추행을 당했다', v: -30, d: 2.5 },
    abused: { t: '배우자에게 맞았다', v: -25, d: 1.5 },
    captive: { t: '인질로 잡혀 있다', v: -30, d: 0.3 },
    blackmailed: { t: '협박을 당하고 있다', v: -15, d: 0.8 },
    wronged: { t: '누명을 썼다', v: -25, d: 1 },
    cleared: { t: '누명을 벗었다', v: 15, d: 1 },
    redeemed: { t: '새 삶을 찾았다', v: 20, d: 2 },
    stigma: { t: '전과자라는 눈총', v: -8, d: 0.5 },
  });

  const grown = (h) => h && h.alive && h.age >= 18 && !h.jail && !h.held;
  const friendsOf = (sim, h) => { let n = 0; for (const [id, r] of h.rel) if (r.v >= 60 && sim.byId.get(id)) n++; return n; };
  const guardsNear = (sim, x, y, r = 8) => { let n = 0; sim.near(x, y, r, (o) => { if (o.job === J.GUARD) n++; }); return n; };

  // 범죄를 기록하고, 목격되면 신고한다
  X.commit = (sim, h, type, victim, ws, seenExtra = 0) => {
    const rec = C.record(sim, h, type, victim, false);
    const seen = C.detect(sim, h, type, victim, ws || []) || chance(seenExtra);
    if (seen) C.report(sim, h, type, victim);
    return { rec, seen };
  };

  // ---------------- 재범과 갱생 ----------------
  // 전과자에게 처음 갖는 불신
  X.stigma = (o) => {
    if (!o.convictions) return 0;
    const base = -(15 + 10 * Math.min(3, o.convictions));
    return o.redeemed ? Math.round(base * 0.3) : base;
  };

  X.onRelease = (sim, c) => {
    c.releasedAt = sim.year;
    c.rehab = clamp(20 + friendsOf(sim, c) * 8 + (c.partner && c.partner.alive ? 15 : 0), 0, 100);
    c.crimesAtRelease = c.crimes.length;
  };

  X.rehabTick = (sim, h) => {
    if (!h.convictions || h.jail || h.redeemed) return;
    let d = friendsOf(sim, h) * 0.4;
    if (h.faith > 60) d += 0.5;
    if (h.tribe && h.job !== J.NONE) d += 0.4; else d -= 0.6;
    d += h.gold > 10 ? 0.2 : -0.6;
    if ((h.stress || 0) > 60) d -= 0.8;
    if (h.mind) d -= 0.3;
    for (const r of h.rel.values()) if (r.mentor) { d += 0.4; break; }
    h.rehab = clamp((h.rehab || 0) + d, 0, 100);
    if (h.tribe && h.adult && chance(0.05)) S.addMood(sim, h, 'stigma');
    const clean = h.crimes.length <= (h.crimesAtRelease || 0);
    if (h.rehab >= 85 && sim.year - (h.releasedAt || 0) >= 5 && clean && !h.outlaw) {
      h.redeemed = true; h.notoriety = 0;
      S.addMood(sim, h, 'redeemed');
      h.log(sim, '과거를 씻고 새 삶을 살게 되었다');
      if (h.tribe) h.tribe.log(sim, `전과자였던 ${josa(h.name, '이/가')} 사람들의 믿음을 되찾았습니다`, false);
      for (const o of sim.humans) { const r = o.alive && o.rel.get(h.id); if (r && (r.trust || 0) < 0) r.trust = Math.round(r.trust * 0.4); }
    }
  };

  // 감방 동료가 곁에 있으면 범죄에 끌린다
  X.urgeMult = (sim, h) => {
    let m = 1;
    if (h.convictions && !h.redeemed) {
      for (const [id, r] of h.rel) {
        if (!r.cellmate) continue;
        const o = sim.byId.get(id);
        if (o && o.alive && !o.redeemed && G.dist(o.x, o.y, h.x, h.y) < 5) { m *= 1.5; break; }
      }
    }
    return m;
  };

  // 감옥 안: 죄수끼리 가까워지고, 범죄 솜씨를 배운다
  X.prisonTick = (sim, c, t) => {
    for (const o of sim.humans) {
      if (o === c || !o.alive || !o.jail || o.jail.tid !== t.id) continue;
      S.bump(sim, c, o, 3);
      const r = S.rel(c, o);
      if (!r.cellmate) { r.cellmate = true; c.log(sim, `감옥에서 ${josa(o.name, '과/와')} 친해졌다`); }
      c.crimeSkill = Math.min(50, (c.crimeSkill || 0) + 0.4);
    }
  };

  // ---------------- 60틱마다: 여러 범죄 ----------------
  X.tick = (sim, h) => {
    X.rehabTick(sim, h);
    if (h.held) return X.heldTick(sim, h);
    if (!grown(h)) return;
    const u = C.urge(h) * X.urgeMult(sim, h);
    X.fakeTick(sim, h);
    X.stalkTick(sim, h, u);
    X.extortTick(sim, h, u);
    if (h.has('정직한') && chance(0.9)) return;
    const r = Math.random();
    if (r < 0.2) X.embezzle(sim, h, u);
    else if (r < 0.35) X.livestockTheft(sim, h, u);
    else if (r < 0.5) X.grudgeCrimes(sim, h, u);
    else if (r < 0.6) X.falseAccuse(sim, h, u);
    else if (r < 0.7) X.rebellion(sim, h, u);
    else if (r < 0.8) X.desert(sim, h);
    else if (r < 0.9) X.indecency(sim, h, u);
    else X.harass(sim, h, u);
    X.bribeExposure(sim, h);
  };

  // 사기: 상인이 물건 양을 속인다 (human.sellGoods에서 호출)
  X.fraud = (sim, h, buyer, pay) => {
    if (h.has('정직한') || !chance(0.05 * C.urge(h) * (h.has('교활한') ? 2 : 1))) return pay;
    const extra = Math.min(Math.floor(buyer.treasury), Math.round(pay * 0.4) + 3);
    if (extra <= 0) return pay;
    buyer.treasury -= extra;
    h.log(sim, `${buyer.name}에 물건 양을 속여 팔아 금화 ${extra}개를 더 챙겼다`);
    const rec = C.record(sim, h, '사기', buyer.name, false);
    if (chance(0.25 * (1 - (h.crimeSkill || 0) / 100))) {
      C.report(sim, h, '사기', buyer.name);
      if (h.tribe) sim.changeRel(h.tribe, buyer, -8);
    }
    return pay + extra;
  };

  // 횡령: 족장이나 상인이 금고에 손을 댄다
  X.embezzle = (sim, h, u) => {
    const t = h.tribe;
    if (!t || t.bandit || (h.job !== J.CHIEF && h.job !== J.MERCHANT) || t.treasury < 60 || !chance(0.012 * u)) return;
    const amt = Math.floor(t.treasury * rand(0.1, 0.25));
    t.treasury -= amt; h.gold += amt;
    h.log(sim, `부족 금고에서 금화 ${amt}개를 몰래 빼돌렸다`);
    X.commit(sim, h, '횡령', t.name, [], 0.1 + guardsNear(sim, t.cx, t.cy, 10) * 0.08);
  };

  // 뇌물: 재판에서 족장을 매수한다 (C.trial에서 호출, 형량 배수를 돌려준다)
  X.bribe = (sim, t, c, chief, sev) => {
    if (!chief || chief === c || chief.has('정직한') || c.gold < 25) return 1;
    let p = 0.18 * (chief.has('탐욕스러운') ? 1.6 : 1) * (c.has('교활한') ? 1.3 : 1);
    if (!chance(p)) return 1;
    const amt = Math.min(Math.floor(c.gold), 20 + Math.round(sev * 10));
    c.gold -= amt; chief.gold += amt;
    C.record(sim, c, '뇌물', chief.name, false);
    C.record(sim, chief, '뇌물', c.name, false);
    c.log(sim, `족장 ${chief.name}에게 금화 ${amt}개를 몰래 건넸다`);
    chief.log(sim, `${c.name}에게서 뇌물 금화 ${amt}개를 받고 형량을 줄여 주었다`);
    return 0.4;
  };
  X.bribeExposure = (sim, h) => {
    const b = h.crimes.find((c) => c.type === '뇌물' && !c.known);
    if (!b || !chance(0.008 + guardsNear(sim, h.x, h.y) * 0.01)) return;
    C.report(sim, h, '뇌물', b.victim);
  };

  // 가축 도둑
  X.livestockTheft = (sim, h, u) => {
    if (!(h.gold < 8 || h.hunger > 60 || h.outlaw) || !chance(0.08 * u)) return;
    const mine = h.tribe ? h.tribe.id : -1;
    const a = G.Wild.near(sim, h.x, h.y, 4, (x) => x.tame && x.tame !== mine && x.kind !== 'wolf');
    if (!a) return;
    const victim = sim.tribeById(a.tame);
    const label = G.Wild.label(a);
    if (h.tribe && !h.tribe.bandit) { h.tribe.ensurePen(sim); a.tame = h.tribe.id; a.tx = h.tribe.pen.x; a.ty = h.tribe.pen.y; }
    else { a.alive = false; h.hunger = Math.max(0, h.hunger - 60); }
    h.log(sim, `${victim ? victim.name + '의 ' : ''}${josa(label, '을/를')} 훔쳤다`);
    const { seen } = X.commit(sim, h, '가축 도둑', victim ? victim.name : null, C.witnesses(sim, h.x, h.y, [h]));
    if (seen && victim && h.tribe) sim.changeRel(victim, h.tribe, -6);
  };

  // 밀렵: 다른 부족 땅에서 사냥 (wildlife에서 사냥에 성공했을 때 호출)
  X.poach = (sim, h, a) => {
    const owner = sim.tribes.find((t) => t.alive && t !== h.tribe && G.dist(t.cx, t.cy, a.x, a.y) < 12);
    if (!owner) return;
    const ws = C.witnesses(sim, h.x, h.y, [h]).filter((w) => w.tribe === owner);
    const { seen } = X.commit(sim, h, '밀렵', owner.name, ws);
    if (seen && h.tribe) { sim.changeRel(owner, h.tribe, -6); h.log(sim, `${owner.name}의 사냥터에서 몰래 사냥하다 들켰다`); }
  };

  // 도박 사기 (persona의 도박에서 호출: 이기면 true)
  X.cheat = (sim, h, opp) => {
    if (h.has('정직한') || !(h.has('교활한') || h.addiction > 50) || !chance(0.25 * C.urge(h))) return false;
    if (chance(0.3 * (1 - (h.crimeSkill || 0) / 100))) {
      M.adj(sim, opp, h, { trust: -40, grudge: 20 });
      opp.log(sim, `${josa(h.name, '이/가')} 도박에서 속임수를 쓴 것을 알아챘다`);
      X.commit(sim, h, '도박 사기', opp.name, [], 1);
      S.argue(sim, opp, h, S.rel(opp, h));
    } else C.record(sim, h, '도박 사기', opp.name, false);
    return true;
  };

  // 원한에서 비롯된 범죄: 방화, 독살
  X.grudgeCrimes = (sim, h, u) => {
    for (const [id, r] of h.rel) {
      if ((r.grudge || 0) < 70) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive || o.jail || o.held) continue;
      const cold = h.has('냉정한') || h.p.impulse > 60 || (h.stress || 0) > 60;
      if (!cold) continue;
      // 독살: 약초를 아는 사람만
      const knowsHerbs = h.knowledge >= 8 || h.job === J.HEALER || (h.tribe && h.tribe.has('약초학'));
      if (r.grudge >= 80 && knowsHerbs && G.dist(o.x, o.y, h.x, h.y) < 6 && chance(0.06 * u)) return X.poison(sim, h, o);
      // 방화: 상대 마을의 집
      const t = o.tribe;
      if (t && t.houses.length && chance(0.05 * u)) {
        const house = t.houses.reduce((b, q) => (G.dist(q.x, q.y, o.x, o.y) < G.dist(b.x, b.y, o.x, o.y) ? q : b), t.houses[0]);
        if (G.dist(house.x, house.y, h.x, h.y) > 12) continue;
        if (!G.Fire.ignite(sim, house.x, house.y, '누군가의 방화로')) continue;
        h.log(sim, `${o.name}에 대한 원한으로 ${t.name}의 집에 불을 질렀다`);
        X.commit(sim, h, '방화', o.name, C.witnesses(sim, house.x, house.y, [h]));
        r.grudge -= 20;
        return;
      }
    }
  };

  X.poison = (sim, h, o) => {
    const ws = C.witnesses(sim, o.x, o.y, [h, o]);
    h.log(sim, `${o.name}의 음식에 독초를 몰래 넣었다`);
    h.murders++;
    sim.stats.murders = (sim.stats.murders || 0) + 1;
    C.record(sim, h, '독살', o.name, false);
    S.rel(h, o).grudge = 0;
    const tid = o.tribe ? o.tribe.id : null;
    sim.scheduled.push({ t: randi(120, 360), fn: () => {
      if (!o.alive) return;
      const seen = chance(0.15) || C.detect(sim, h, '독살', o.name, ws.filter((w) => w.alive));
      sim.kill(o, '원인 모를 병');
      if (seen) C.report(sim, h, '독살', o.name);
      else sim.unsolved.push({ victim: o.name, killer: h.id, tid, y: sim.year, x: o.x, yy: o.y, type: '독살' });
    } });
  };

  // 가정폭력 (S.argue에서 부부싸움일 때 호출)
  X.domestic = (sim, h, o) => {
    if (h.partner !== o || !grown(h) || !grown(o)) return;
    const hot = h.p.impulse > 60 || h.drunk > 0 || h.has('냉정한') || (h.stress || 0) > 70;
    if (!hot || !chance(0.12 * (h.teto > 20 ? 1.3 : 0.7) * C.urge(h))) return;
    o.health -= rand(8, 18);
    o.say('!', 90); h.say('#', 90);
    S.addMood(sim, o, 'abused');
    M.adj(sim, o, h, { fear: 35, trust: -35, grudge: 25 });
    S.bump(sim, o, h, -20, -15);
    h.dv = (h.dv || 0) + 1; o.dvVictim = (o.dvVictim || 0) + 1;
    h.log(sim, `화를 참지 못하고 배우자 ${josa(o.name, '을/를')} 때렸다`);
    o.log(sim, `배우자 ${h.name}에게 맞았다`);
    M.trauma(sim, o, 0.08 * o.dvVictim, '거듭된 폭력에');
    sim.near(o.x, o.y, 5, (w) => { if (w !== h && w !== o && w.age < 14) M.trauma(sim, w, 0.1, '부모의 폭력을 보고'); });
    const rec = C.record(sim, h, '가정폭력', o.name, false);
    const pReport = 0.15 + friendsOf(sim, o) * 0.1 + (o.dvVictim >= 3 ? 0.2 : 0) + (o.has('용감한') ? 0.1 : 0);
    if (chance(pReport) || C.detect(sim, h, '가정폭력', o.name, C.witnesses(sim, o.x, o.y, [h, o]))) {
      o.log(sim, '용기를 내어 배우자의 폭력을 알렸다');
      C.report(sim, h, '가정폭력', o.name);
    } else if (o.dvVictim === 1) o.log(sim, '맞은 일을 아무에게도 말하지 못했다');
    if (o.dvVictim >= 2 && chance(0.3)) { o.log(sim, '폭력을 견디지 못하고 떠나기로 했다'); S.breakUp(sim, o, h, true); }
  };

  // 인질극: 도적단이 어른을 잡아 몸값을 요구한다 (human.raid에서 호출)
  X.takeHostage = (sim, raider, foe) => {
    const bandits = raider.tribe;
    if (!bandits || !bandits.bandit || !chance(0.25)) return false;
    let v = null;
    sim.near(raider.x, raider.y, 4, (o) => { if (!v && o.tribe === foe && grown(o) && o !== foe.chief) v = o; });
    if (!v) return false;
    const ransom = randi(30, 80);
    v.held = { tid: bandits.id, from: foe.id, ransom, since: sim.year };
    v.task = null; v.path = null; v.state = 'held';
    v.x = bandits.cx + rand(-1, 1); v.y = bandits.cy + rand(-1, 1);
    S.addMood(sim, v, 'captive');
    v.log(sim, `${bandits.name}에게 인질로 잡혀갔다`);
    C.record(sim, raider, '인질극', v.name, true);
    raider.notoriety = clamp(raider.notoriety + 16, 0, 100);
    sim.event(`${josa(bandits.name, '이/가')} ${foe.name}의 ${josa(v.name, '을/를')} 인질로 잡고 금화 ${ransom}개를 요구합니다`, '#ff8a50', v.x, v.y);
    return true;
  };

  X.heldTick = (sim, v) => {
    const H = v.held;
    const bandits = sim.tribeById(H.tid), home = sim.tribeById(H.from);
    S.addMood(sim, v, 'captive');
    if (v.hunger > 60 && bandits && bandits.stock.food >= 1) { bandits.stock.food--; v.hunger -= 40; }
    let how = null;
    if (!bandits) how = '도적단이 무너져';
    else if (home && home.treasury >= H.ransom && chance(0.12)) {
      home.treasury -= H.ransom; bandits.treasury += H.ransom;
      how = `${josa(home.name, "이/가")} 몸값 금화 ${H.ransom}개를 치러`;
    } else if (home) {
      const fighters = home.members.filter((m) => m.job === J.GUARD || m.job === J.WARRIOR).length;
      if (chance(0.006 * fighters)) how = `${home.name}의 구출대가 쳐들어와`;
    }
    if (!how && chance(v.has('용감한') || v.has('교활한') ? 0.02 : 0.008)) how = '감시가 소홀한 틈을 타';
    if (!how) return;
    v.held = null; v.state = 'idle';
    v.log(sim, `${how} 풀려났다`);
    S.addMood(sim, v, 'freed');
    M.trauma(sim, v, 0.3, '인질로 잡혀 있던 기억에');
    sim.event(`인질로 잡혀 있던 ${josa(v.name, '이/가')} ${how} 풀려났습니다`, '#7fc8f8', v.x, v.y);
    if (home) v.goTo(sim, home.cx, home.cy, { kind: 'wander' });
  };

  // 무고: 원한을 품고 죄 없는 사람을 거짓으로 고발한다
  X.falseAccuse = (sim, h, u) => {
    if (!(h.has('교활한') || h.has('냉정한') || (h.mind && h.mind.c === '편집증')) || !chance(0.05 * u)) return;
    for (const [id, r] of h.rel) {
      if ((r.grudge || 0) < 60) continue;
      const o = sim.byId.get(id);
      if (!grown(o) || o.wanted || !o.tribe) continue;
      const type = pick(['절도', '폭행']);
      o.crimes.push({ y: Math.floor(sim.year), type, victim: h.name, known: true, punished: false, fake: true, accuser: h.id });
      h.log(sim, `원한을 품고 ${josa(o.name, '을/를')} ${type}범으로 거짓 고발했다`);
      C.record(sim, h, '무고', o.name, false);
      o.wanted = true;
      if (o.tribe) o.tribe.log(sim, `${josa(h.name, '이/가')} ${josa(o.name, '을/를')} ${josa(type, '으로/로')} 고발했습니다`, false);
      S.addMood(sim, o, 'wronged');
      r.grudge -= 25;
      return;
    }
  };

  // 누명이 벗겨지기도 한다
  X.fakeTick = (sim, h) => {
    const f = h.crimes.find((c) => c.fake && !c.revealed);
    if (!f || !chance(0.02 + guardsNear(sim, h.x, h.y, 12) * 0.02)) return;
    f.revealed = true; f.known = false;
    h.wanted = false;
    h.notoriety = Math.max(0, h.notoriety - 16);
    S.addMood(sim, h, 'cleared');
    h.log(sim, `${f.type} 누명이 벗겨졌다`);
    if (h.jail) C.release(sim, h, '누명이 벗겨져');
    const acc = sim.byId.get(f.accuser);
    if (acc && acc.alive) {
      M.adj(sim, h, acc, { grudge: 50, trust: -80 });
      for (const c of acc.crimes) if (c.type === '무고' && c.victim === h.name) c.known = true;
      C.report(sim, acc, '무고', h.name);
    }
    const t = h.tribe;
    if (t) t.log(sim, `${josa(h.name, '이/가')} 쓴 ${f.type} 누명이 벗겨졌습니다`);
  };

  // 갈취: 남의 비밀(바람, 숨긴 죄)을 알고 돈을 뜯는다
  X.extortTick = (sim, h, u) => {
    // 새 비밀 알아내기
    if ((h.has('교활한') || h.has('탐욕스러운')) && !h.has('정직한') && h.gold < 40 && chance(0.005 * u)) {
      let target = null;
      sim.near(h.x, h.y, 5, (o) => {
        if (target || o === h || !grown(o)) return;
        if (o.affair || o.crimes.some((c) => !c.known && !c.fake)) target = o;
      });
      if (target && !S.rel(h, target).blackmailing) {
        S.rel(h, target).blackmailing = true; S.rel(target, h).blackmailer = true;
        const secret = target.affair ? '몰래 만나는 사람' : '숨긴 죄';
        h.log(sim, `${target.name}의 ${josa(secret, '을/를')} 알아내고 협박하기 시작했다`);
        target.log(sim, `${josa(h.name, '이/가')} 비밀을 알고 협박해 왔다`);
        C.record(sim, h, '갈취', target.name, false);
      }
    }
    // 돈 뜯기
    for (const [id, r] of h.rel) {
      if (!r.blackmailing || !chance(0.1)) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive) { r.blackmailing = false; continue; }
      if (o.gold >= 5 && (o.p.impulse < 70 || chance(0.6))) {
        const g = Math.min(Math.floor(o.gold), randi(5, 15));
        o.gold -= g; h.gold += g;
        S.addMood(sim, o, 'blackmailed');
        o.stress = clamp((o.stress || 0) + 10, 0, 100);
        M.adj(sim, o, h, { grudge: 10, fear: 5 });
        if (chance(0.06)) { o.log(sim, `협박을 견디지 못하고 ${josa(h.name, '을/를')} 신고했다`); C.report(sim, h, '갈취', o.name); r.blackmailing = false; }
      } else {
        // 거절하면 비밀을 터뜨린다
        r.blackmailing = false; S.rel(o, h).blackmailer = false;
        h.log(sim, `돈을 주지 않는 ${o.name}의 비밀을 터뜨렸다`);
        if (o.affair) {
          const sp = S.mate(o);
          if (sp) { S.addMood(sim, sp, 'betrayed'); M.adj(sim, sp, o, { trust: -60, grudge: 40 }); sp.log(sim, `${h.name}에게서 ${o.name}의 바람 이야기를 들었다`); }
        } else {
          const c = o.crimes.find((x) => !x.known && !x.fake);
          if (c) C.report(sim, o, c.type, c.victim);
        }
        M.adj(sim, o, h, { grudge: 40 });
      }
    }
  };

  // 반역: 야심가가 족장을 몰아내려 한다
  X.rebellion = (sim, h, u) => {
    const t = h.tribe;
    if (!t || t.bandit || !t.chief || t.chief === h || !(h.has('야심찬') || h.teto > 60) || h.p.extra < 45 || !chance(0.02)) return;
    const chief = t.chief;
    const adults = t.members.filter((m) => m.adult && m !== h && m !== chief && !m.jail);
    if (adults.length < 6) return;
    const sup = adults.filter((m) => (S.peek(m, h)?.v || 0) >= 30 && (S.peek(m, chief)?.v || 0) < 10).length;
    const share = sup / adults.length;
    h.log(sim, `족장 ${josa(chief.name, '을/를')} 몰아낼 음모를 꾸몄다 (지지자 ${sup}명)`);
    if (share >= 0.35) {
      const kill = h.has('냉정한') && chance(0.3);
      t.chief = null;
      if (kill) sim.kill(chief, '반역', h);
      else { chief.log(sim, `${h.name}의 반란으로 족장 자리에서 쫓겨났다`); C.exile(sim, t, chief); }
      t.chief = h; h.job = J.CHIEF;
      h.log(sim, `반란에 성공해 ${t.name}의 족장이 되었다`);
      t.log(sim, `${josa(h.name, '이/가')} 반란을 일으켜 족장 ${josa(chief.name, '을/를')} ${kill ? '죽이고' : '몰아내고'} 족장이 되었습니다`);
      for (const m of adults) if ((S.peek(m, chief)?.v || 0) >= 40) M.adj(sim, m, h, { grudge: 40, trust: -40 });
      sim.stats.coups = (sim.stats.coups || 0) + 1;
    } else if (chance(0.5)) {
      h.log(sim, '음모가 들통났다');
      X.commit(sim, h, '반역', chief.name, [], 1);
      M.adj(sim, chief, h, { grudge: 50, trust: -70 });
    }
  };

  // 탈영
  X.desert = (sim, h) => {
    const t = h.tribe;
    if (!t || h.job !== J.WARRIOR || !t.wars.size || !(h.has('겁많은') || h.p.neuro > 70) || !(h.health < 60 || (h.stress || 0) > 60) || !chance(0.15)) return;
    C.record(sim, h, '탈영', t.name, true);
    h.wanted = true;
    t.log(sim, `전사 ${josa(h.name, '이/가')} 전쟁이 무서워 탈영했습니다`, false);
    C.flee(sim, h, '전쟁이 무서워');
  };

  // 공연음란 (어른만 있는 곳에서만 일어난다)
  X.indecency = (sim, h, u) => {
    let p = 0.004 * u * (h.p.impulse > 60 ? 2 : 1) * (h.p.agree < 40 ? 1.5 : 1) * (h.addiction > 50 ? 1.5 : 1) * (h.convictions ? 1.5 : 1);
    if (!chance(p)) return;
    let kids = false; const ws = [];
    sim.near(h.x, h.y, 8, (o) => { if (o === h) return; if (o.age < 18) kids = true; else if (G.dist(o.x, o.y, h.x, h.y) < 5) ws.push(o); });
    if (kids || !ws.length) return;
    h.log(sim, '공연음란으로 사람들을 불쾌하게 했다');
    for (const w of ws) {
      S.addMood(sim, w, 'disgusted');
      M.adj(sim, w, h, { trust: -30, fear: 10 });
      S.bump(sim, w, h, -20);
      w.say('!', 60);
    }
    X.commit(sim, h, '공연음란', null, [], Math.min(0.95, 0.6 * ws.length));
  };

  // 스토킹: 거절당한 사랑이 집착이 된다 (S.confess에서 시작)
  X.startStalking = (sim, h, o) => {
    if (h.age < 18 || o.age < 18) return;
    if (!(h.p.impulse > 60 || h.p.neuro > 65 || h.has('냉정한') || h.has('질투심 많은')) || !chance(0.3)) return;
    h.stalking = o.id; h.stalkCount = 0;
    h.log(sim, `거절당했지만 ${josa(o.name, '을/를')} 잊지 못하고 집착하기 시작했다`);
  };
  X.stalkTick = (sim, h, u) => {
    if (!h.stalking) return;
    const o = sim.byId.get(h.stalking);
    const r = o && S.peek(h, o);
    if (!grown(o) || S.mate(h) || !r || r.love < 40) { h.stalking = null; return; }
    if (G.dist(o.x, o.y, h.x, h.y) > 3) { if (chance(0.3)) h.goTo(sim, o.x + rand(-1.5, 1.5), o.y + rand(-1.5, 1.5), { kind: 'wander' }); return; }
    h.stalkCount++;
    S.addMood(sim, o, 'stalked');
    M.adj(sim, o, h, { fear: 6, trust: -8 });
    o.stress = clamp((o.stress || 0) + 5, 0, 100);
    if (h.stalkCount === 1) o.log(sim, `${josa(h.name, '이/가')} 자꾸 따라다녀 불안하다`);
    if (h.stalkCount === 3) C.record(sim, h, '스토킹', o.name, false);
    if (!o.mind && chance(0.03)) M.setCondition(sim, o, '불안증', null, '계속되는 스토킹에');
    const p = 0.05 + friendsOf(sim, o) * 0.03 + guardsNear(sim, o.x, o.y) * 0.2;
    if (h.stalkCount >= 3 && chance(p)) {
      o.log(sim, `${josa(h.name, '을/를')} 스토킹으로 신고했다`);
      for (const c of h.crimes) if (c.type === '스토킹' && !c.known) c.known = true;
      C.report(sim, h, '스토킹', o.name);
    }
  };

  // 성추행 (어른끼리만, 기록 문장으로만)
  X.harass = (sim, h, u) => {
    if (h.p.agree >= 35 || h.p.impulse <= 55 || !chance(0.03 * u * (h.drunk > 0 ? 2 : 1))) return;
    let v = null;
    sim.near(h.x, h.y, 2, (o) => {
      if (v || o === h || !grown(o) || o === S.mate(h)) return;
      const mine = S.peek(h, o), theirs = S.peek(o, h);
      if ((mine && mine.love >= 30 || G.Persona.appeal(h, o) > 1.2) && !(theirs && theirs.love >= 30)) v = o;
    });
    if (!v) return;
    h.log(sim, `${josa(v.name, '을/를')} 성추행했다`);
    v.log(sim, `${h.name}에게 성추행을 당했다`);
    S.addMood(sim, v, 'violated');
    M.adj(sim, v, h, { trust: -80, fear: 40, grudge: 50 });
    S.bump(sim, v, h, -60, -40);
    M.trauma(sim, v, 0.35, '성추행을 당하고');
    v.say('!', 90);
    const ws = C.witnesses(sim, v.x, v.y, [h, v]).filter((w) => w.age >= 18);
    const pReport = 0.45 + friendsOf(sim, v) * 0.05 + (v.has('용감한') ? 0.2 : 0) - (h.job === J.CHIEF ? 0.2 : 0);
    const { seen } = X.commit(sim, h, '성추행', v.name, ws, pReport);
    if (seen) {
      for (const p of sim.humans) { const pr = p.alive && p.rel.get(v.id); if (pr && pr.v >= 50 && p !== h) M.adj(sim, p, h, { grudge: 35, trust: -60 }); }
    } else v.log(sim, '두려워서 아무에게도 말하지 못했다');
  };
})();
