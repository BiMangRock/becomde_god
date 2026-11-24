// 몽환초: 사람 손이 닿지 않는 숲과 산에서 자라는, 중독성이 아주 강한 풀
//  - 처음 찾은 사람이 부족에 알리면 그 부족 사람들이 알게 되고, 가까운 부족으로 소문이 번진다
//  - 피우면 기분이 크게 좋아지고 스트레스가 사라지지만, 금방 깊이 빠져든다 (중독 기질·성격·스트레스가 클수록)
//  - 중독되면 늘 몽환초 생각뿐이고, 몸이 상하고, 일이 느려지고, 돈이 떨어지면 훔치기도 한다. 너무 많이 피우면 죽기도 한다
//  - 부족마다 족장이 금지할지 정한다. 금지된 부족에서도 중독된 사람은 몰래 피우고, 밀매꾼에게 사며, 들키면 재판을 받는다
//  - 배우자·치료사·깊은 신앙이 곁에 있으면 끊기 쉽고, 신의 치유로도 씻긴다
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const T = G.T;
  const C = G.Crime;
  const H = (G.Herb = {});

  Object.assign(G.MOODS, {
    herbHigh: { t: '몽환초에 취해 세상이 아득하다', v: 26, d: 0.12 },
    herbCrave: { t: '몽환초 생각뿐이다', v: -22, d: 0.3 },
    herbFamily: { t: '가족이 몽환초에 빠졌다', v: -12, d: 0.6 },
    herbQuit: { t: '몽환초를 끊어 냈다', v: 18, d: 0.6 },
  });
  Object.assign(C.SEV, { '몽환초 사용': 1, '몽환초 밀매': 2 });
  H.PRICE = 6;

  const banned = (t) => !!(t && t.law && t.law.herb === 'ban');
  const knows = (sim, h) => h.herbStock > 0 || h.herbUses > 0 || (h.tribe && h.tribe.knowsDream) || (h.outlaw && sim.dreamKnown);

  // ---------------- 처음 찾기 ----------------
  H.notice = (sim, h, tile) => {
    const t = h.tribe;
    if (t && t.knowsDream) return;
    if (!t && h.herbSeen) return;
    h.herbSeen = true;
    if (!sim.dreamKnown) {
      sim.dreamKnown = Math.floor(sim.year);
      sim.event(`${josa(h.name, '이/가')} 사람 손이 닿지 않은 숲에서 이상한 향기를 내는 풀, 몽환초를 찾았습니다`, '#c9a0ff', h.x, h.y);
    }
    h.log(sim, '깊은 숲에서 맡으면 머리가 아득해지는 이상한 풀을 찾았다');
    if (t) { t.knowsDream = Math.floor(sim.year); t.log(sim, `${josa(h.name, '이/가')} 몽환초를 마을에 가지고 왔습니다`, false); }
    const w = sim.world;
    if (w.dream[tile] >= 1) { w.dream[tile] -= 1; h.herbStock = (h.herbStock || 0) + 1; }
    if (chance(0.5 * H.temptation(sim, h))) H.use(sim, h);
  };

  // 처음 손을 대고 싶은 마음
  H.temptation = (sim, h) => {
    let m = Math.pow(Math.max(5, h.p.addict) / 50, 1.5) * G.Genes.risk(h, 'add');
    if ((h.stress || 0) > 60) m *= 3;
    if (h.mind) m *= 2;
    if (h.happy < 30) m *= 1.6;
    if (h.has('충동적인')) m *= 1.5;
    if (h.has('호기심 많은')) m *= 1.3;
    if (h.has('신앙심 깊은')) m *= 0.4;
    if (h.has('정직한')) m *= 0.6;
    if (h.has('침착한')) m *= 0.7;
    if (h.outlaw) m *= 2;
    if (banned(h.tribe) && !h.has('충동적인')) m *= 0.5;
    if (h.age < 20) m *= 1.3;
    // 가까운 사람이 피우면 따라 한다
    for (const [id, r] of h.rel) {
      if (r.v < 40) continue;
      const o = sim.byId.get(id);
      if (o && o.alive && (o.herbAddict || 0) > 30) { m *= 1.8; break; }
    }
    return m;
  };

  // ---------------- 피우기 ----------------
  H.use = (sim, h) => {
    if (!(h.herbStock > 0)) return;
    h.herbStock--;
    const a0 = h.herbAddict || 0;
    h.herbAddict = Math.min(100, a0 + (12 + h.p.addict / 8) * G.Genes.addMult(h) * (a0 > 60 ? 0.5 : 1));
    h.herbUses = (h.herbUses || 0) + 1;
    h.lastHerb = sim.year;
    G.Social.addMood(sim, h, 'herbHigh');
    h.stress = Math.max(0, (h.stress || 0) - 35);
    h.say('≈', 150);
    if (h.herbUses === 1) {
      h.log(sim, banned(h.tribe) ? '법으로 금지된 몽환초를 몰래 처음 피워 보았다' : '처음으로 몽환초를 피워 보았다');
      sim.stats.herbUsers = (sim.stats.herbUsers || 0) + 1;
    }
    if (['idle', 'rest', 'hobby'].includes(h.state)) { h.state = 'rest'; h.timer = randi(120, 220); h.task = null; }
    // 너무 많이 피우면 쓰러진다
    if (h.herbAddict > 70 && chance(0.03 * (h.body < 35 ? 2 : 1))) {
      h.health -= rand(35, 60);
      if (h.health <= 0) {
        if (h.tribe) h.tribe.herbDeaths = (h.tribe.herbDeaths || 0) + 1;
        sim.stats.herbDeaths = (sim.stats.herbDeaths || 0) + 1;
        sim.event(`${josa(h.name, '이/가')} 몽환초를 너무 많이 피우다 숨졌습니다`, '#c9a0ff', h.x, h.y);
        return sim.kill(h, '몽환초 과용');
      }
      h.log(sim, '몽환초를 너무 많이 피워 쓰러졌다가 겨우 깨어났다');
      h.say('×', 150);
    }
    // 조현 기질이 있으면 깊이 빠졌을 때 환청이 시작되기도 한다
    if (!h.mind && h.herbAddict > 50 && h.genes && h.genes.liab.scz > 0.22 && chance(0.006 * G.Genes.risk(h, 'scz'))) {
      G.Mind.setCondition(sim, h, '조현병', randi(40, 70), '몽환초에 빠져 지내다');
    }
    if (banned(h.tribe)) H.crime(sim, h, '몽환초 사용', null, 0.5);
  };

  // 금지된 부족에서 들키면 수배된다
  H.crime = (sim, h, type, victim, p) => {
    const ws = C.witnesses(sim, h.x, h.y, [h]);
    C.record(sim, h, type, victim, false);
    if (ws.length && C.detect(sim, h, type, victim, ws) && chance(p)) C.report(sim, h, type, victim);
  };

  // ---------------- 사기 ----------------
  H.buy = (sim, h, dealer) => {
    const price = H.PRICE * (banned(dealer.tribe) || banned(h.tribe) ? 2 : 1);
    if (h.gold < price) return false;
    h.gold -= price; dealer.gold += price;
    dealer.herbStock--; h.herbStock = (h.herbStock || 0) + 1;
    dealer.herbSold = (dealer.herbSold || 0) + 1;
    if (dealer.herbSold === 1 || dealer.herbSold % 10 === 0) dealer.log(sim, `몽환초를 ${dealer.herbSold}번째 팔았다`);
    if (banned(dealer.tribe) || banned(h.tribe)) H.crime(sim, dealer, '몽환초 밀매', h.name, 0.8);
    H.use(sim, h);
    return true;
  };

  H.findHerb = (w, x, y, r) => {
    let best = null, bd = 1e9;
    for (let k = 0; k < 70; k++) {
      const rr = r * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      const tx = Math.floor(x + Math.cos(a) * rr), ty = Math.floor(y + Math.sin(a) * rr);
      if (!w.walkableTile(tx, ty)) continue;
      const i = w.idx(tx, ty);
      if (w.dream[i] < 1) continue;
      const d = Math.hypot(tx - x, ty - y);
      if (d < bd) { bd = d; best = { x: tx, y: ty, i }; }
    }
    return best;
  };

  const free = (h) => !h.jail && !h.held && !h.trek && !h.lost && !h.abducted && (h.state === 'idle' || h.state === 'rest' || (h.state === 'goto' && h.task && h.task.kind === 'wander' && !h.task.back));

  // ---------------- 60틱마다 ----------------
  H.tick = (sim, h) => {
    if (!h.alive) return;
    const a = h.herbAddict || 0;
    if (a > 0) {
      const since = sim.year - (h.lastHerb ?? -99);
      if (since > 0.15 && a > 25) {
        G.Social.addMood(sim, h, 'herbCrave');
        h.stress = Math.min(100, (h.stress || 0) + 1.5 * a / 50);
        if (chance(0.03)) h.say('≈?', 80);
      }
      // 오래 안 피우면 천천히 벗어난다. 곁에 있는 사람이 도우면 더 빨리
      if (since > 0.4) {
        let sup = 1;
        if (h.partner && h.partner.alive) sup += 0.5;
        if (h.tribe && h.tribe.members.some((m) => m.job === G.JOB.HEALER)) sup += 0.5;
        if (h.faith > 70) sup += 0.3;
        if (h.jail) sup += 0.5; // 감옥에서는 구할 수 없다
        h.herbAddict = Math.max(0, a - 0.3 * sup);
      }
      if (a > 70 && !h.jail) h.health -= 0.35;
      if (a >= 60 && !h.herbHooked) {
        h.herbHooked = true;
        h.log(sim, '몽환초에 깊이 중독되었다');
        sim.stats.herbAddicts = (sim.stats.herbAddicts || 0) + 1;
        for (const id of [...h.children, ...h.parents.map((p) => p.id), h.partner && h.partner.id]) {
          const o = id && sim.byId.get(id);
          if (o && o.alive && o.adult) { G.Social.addMood(sim, o, 'herbFamily'); if (chance(0.5)) o.log(sim, `${josa(h.name, '이/가')} 몽환초에 빠져 속이 탔다`); }
        }
      }
      if (h.herbHooked && h.herbAddict < 12) {
        h.herbHooked = false;
        h.log(sim, '오랜 싸움 끝에 몽환초를 끊었다');
        G.Social.addMood(sim, h, 'herbQuit');
      }
      if (h.health <= 0) { if (h.tribe) h.tribe.herbDeaths = (h.tribe.herbDeaths || 0) + 1; return sim.kill(h, '몽환초 중독'); }
    }
    if (!h.adult || h.jail || h.held || !knows(sim, h)) return;
    // 밀매꾼: 탐욕스럽거나 교활한 사람이 돈벌이로 삼는다
    if (h.herbDealer) {
      if (h.convictions && chance(0.3) && !h.outlaw) { h.herbDealer = false; h.log(sim, '붙잡힌 뒤로 몽환초 장사를 그만두었다'); }
      else if ((h.herbStock || 0) < 3 && free(h) && chance(0.08)) {
        const f = H.findHerb(sim.world, h.x, h.y, 30);
        if (f) h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'herb', tile: f.i, deal: true });
      }
    } else if (!h.has('정직한') && (h.has('탐욕스러운') || h.has('교활한') || h.outlaw) && h.gold < 40 && chance(0.0006)) {
      h.herbDealer = true;
      h.log(sim, banned(h.tribe) ? '금지된 몽환초를 몰래 팔기 시작했다' : '몽환초를 캐다 팔기 시작했다');
      sim.stats.herbDealers = (sim.stats.herbDealers || 0) + 1;
    }
    // 피우고 싶은가
    const want = a > 0 ? 0.05 + a / 100 * 0.35 : 0.0015 * H.temptation(sim, h);
    if (!chance(want)) return;
    if (h.herbStock > 0) return H.use(sim, h);
    // 가까운 밀매꾼에게 산다
    let dealer = null;
    sim.near(h.x, h.y, 25, (o) => { if (!dealer && o !== h && o.herbDealer && o.herbStock > 0 && !o.jail) dealer = o; });
    if (dealer && H.buy(sim, h, dealer)) return;
    // 직접 캐러 간다 (중독된 사람은 맹수가 나오는 깊은 숲도 마다하지 않는다)
    if (free(h) && (a > 15 || chance(0.4))) {
      const f = H.findHerb(sim.world, h.x, h.y, a > 50 ? 35 : 22);
      if (f) h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'herb', tile: f.i });
    }
  };

  H.onArrive = (sim, h, k) => {
    const w = sim.world;
    if (w.dream[k.tile] >= 1) {
      const take = k.deal ? Math.min(3, Math.floor(w.dream[k.tile])) : 1;
      w.dream[k.tile] -= take;
      h.herbStock = (h.herbStock || 0) + take;
      h.say('✿', 80);
      if (!(h.tribe && h.tribe.knowsDream)) H.notice(sim, h, k.tile);
      if (!k.deal && h.herbStock > 0) H.use(sim, h);
    }
    if (h.alive && h.state === 'idle') { h.state = 'rest'; h.timer = 30; }
  };

  const arrive0 = G.Human.prototype.onArrive;
  G.Human.prototype.onArrive = function (sim) {
    if (this.task && this.task.kind === 'herb') { const k = this.task; this.task = null; this.state = 'idle'; return H.onArrive(sim, this, k); }
    return arrive0.call(this, sim);
  };

  const ptick0 = G.Persona.tick;
  G.Persona.tick = (sim, h) => { ptick0(sim, h); if (h.alive) H.tick(sim, h); };

  // ---------------- 해마다: 법, 소문, 단속 ----------------
  H.yearly = (sim) => {
    for (const t of sim.tribes) {
      if (!t.alive || !t.members.length) continue;
      // 이웃 부족에서 소문이 건너온다
      if (!t.knowsDream && sim.dreamKnown) {
        const src = sim.tribes.find((o) => o !== t && o.alive && o.knowsDream && G.dist(o.cx, o.cy, t.cx, t.cy) < 50 && sim.getRel(t, o) > -40);
        if (src && chance(0.25)) { t.knowsDream = Math.floor(sim.year); t.log(sim, `${src.name}에서 몽환초 이야기가 건너왔습니다`, false); }
      }
      if (!t.knowsDream || t.bandit) continue;
      const users = t.members.filter((m) => (m.herbAddict || 0) > 50).length;
      const deaths = t.herbDeaths || 0;
      const chief = t.chief;
      const law = (t.law = t.law || {});
      if (law.herb !== 'ban' && (users >= 1 || deaths || law.herb === undefined)) {
        let p = 0.15 + users * 0.12 + deaths * 0.35;
        if (chief) {
          if (chief.has('정직한')) p += 0.2;
          if (chief.has('신앙심 깊은')) p += 0.2;
          if (chief.has('냉정한')) p += 0.1;
          if (chief.has('탐욕스러운')) p -= 0.15;
          if (chief.has('교활한')) p -= 0.1;
          if ((chief.herbAddict || 0) > 30) p -= 0.6;
          if (chief.herbDealer) p -= 0.8;
        }
        if (chance(clamp(p, 0, 0.95))) {
          law.herb = 'ban';
          t.log(sim, `${t.chief ? `${t.name}의 ${t.title} ${josa(t.chief.name, '이/가')} ` : `${josa(t.name, '이/가')} `}몽환초를 법으로 금지했습니다${users ? ` (중독된 사람 ${users}명)` : ''}${deaths ? ` · 지금까지 ${deaths}명이 목숨을 잃음` : ''}`);
        } else if (law.herb === undefined) {
          law.herb = 'allow';
          t.log(sim, `${josa(t.name, '은/는')} 몽환초를 금하지 않기로 했습니다`, false);
        }
      }
      // 금지된 부족에서는 경비병이 밀매꾼을 뒤쫓는다
      if (law.herb === 'ban') {
        const guards = t.members.filter((m) => m.job === G.JOB.GUARD).length;
        for (const m of t.members) {
          if (!m.herbDealer || m.wanted || m.jail) continue;
          if (chance(0.15 + guards * 0.12)) {
            C.record(sim, m, '몽환초 밀매', null, false);
            m.log(sim, '몽환초를 팔다가 꼬리가 밟혔다');
            C.report(sim, m, '몽환초 밀매', null);
          }
        }
      }
    }
  };
  const yearly0 = G.Sim.prototype.yearly;
  G.Sim.prototype.yearly = function () { yearly0.call(this); H.yearly(this); };

  // ---------------- 다른 체계와 잇기 ----------------
  const urge0 = C.urge;
  C.urge = (h) => urge0(h) * ((h.herbAddict || 0) > 45 && h.gold < 10 ? 1.8 : 1);
  const work0 = G.Mind.workMult;
  G.Mind.workMult = (h) => work0(h) * (1 + (h.herbAddict || 0) / 200);
  const heal0 = G.Mind.heal;
  G.Mind.heal = (sim, x, y) => {
    sim.near(x, y, 5, (h) => {
      if ((h.herbAddict || 0) > 10) { h.herbAddict = Math.max(0, h.herbAddict - 50); h.log(sim, '신의 치유로 몽환초의 굴레가 느슨해졌다'); }
    });
    return heal0(sim, x, y);
  };
  const lawText0 = G.Crime3.lawText;
  G.Crime3.lawText = (law) => {
    const s = lawText0(law);
    return law && law.herb ? `${s} · 몽환초 ${law.herb === 'ban' ? '금지' : '허용'}` : s;
  };
})();
