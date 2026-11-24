// 사람들이 땅 위를 실제로 오가며 세상이 넓어진다
//  · 이주 무리: 새 부족은 갑자기 생기지 않는다. 처음 섬에 생긴 사람들의 후손이 무리를 지어 짐을 지고 걸어가,
//    도착한 곳에 야영지를 꾸리고 부족을 세운다. (인구 과밀, 굶주림, 족장과의 갈등, 젊은 부부의 독립)
//  · 부족의 병합: 영역이 겹치고 사이가 좋으면 합쳐지고, 아주 작은 부족은 큰 부족에 들어간다.
//  · 떠나 사는 사람: 부족을 떠나 혼자 움막을 짓고 산다. 돌아오기도, 현자가 되어 사람을 모으기도, 짝을 만나 가정을 꾸리기도 한다.
//    드물게 사람을 납치해 강제로 붙잡아 두는 범죄를 저지른다 (18세 이상만, 기록 문장만, 구출·탈출이 있다).
//  · 아는 땅: 사람마다 가 본 땅을 기억한다. 신이 낯선 곳에 옮겨 놓으면 길을 몰라 헤매다가,
//    아는 곳에 닿으면 집을 찾아가고, 끝내 못 찾으면 그곳에 적응해 산다.
//  · 신의 권능: 사람 옮기기, 지진, 역병, 계시, 짐승 무리
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa, shuffle } = G;
  const J = G.JOB;
  const S = G.Social, M = G.Mind;
  const X = (G.Migrate = {});
  const CELL = 8;            // 아는 땅을 기억하는 칸 크기
  const SIGHT = 12;          // 마을이 눈에 들어오는 거리

  Object.assign(G.MOODS, {
    trek: { t: '먼 길을 떠나는 중', v: -4, d: 0.3 },
    newHome: { t: '새 터전을 일구었다', v: 18, d: 1.5 },
    lost: { t: '길을 잃고 헤맨다', v: -18, d: 0.3 },
    foundWay: { t: '집으로 가는 길을 찾았다', v: 22, d: 1 },
    missing: { t: '가족이 사라졌다', v: -25, d: 1.5 },
    reunited: { t: '사라졌던 가족이 돌아왔다', v: 25, d: 1.2 },
    solitude: { t: '홀로 지내는 평온함', v: 8, d: 0.4 },
    abducted: { t: '납치되어 붙잡혀 있다', v: -35, d: 0.3 },
    quake: { t: '땅이 흔들렸다', v: -20, d: 1 },
    revelation: { t: '꿈에서 계시를 받았다', v: 22, d: 1.5 },
    merged: { t: '두 부족이 하나가 되었다', v: 6, d: 0.6 },
  });
  Object.assign(G.Crime.SEV, { 납치: 5 });
  G.Crime3.SEXUAL.add('납치');

  const able = (h) => h && h.alive && h.adult && !h.jail && !h.held && !h.abducted;
  const tribeNear = (sim, x, y, r) => sim.tribes.find((t) => t.alive && G.dist(t.cx, t.cy, x, y) < r) || null;

  // ================= 아는 땅 =================
  X.cellOf = (sim, x, y) => {
    const cols = Math.ceil(sim.world.w / CELL);
    return Math.floor(y / CELL) * cols + Math.floor(x / CELL);
  };
  X.known = (sim, h) => {
    if (!h.knownMap) {
      const cols = Math.ceil(sim.world.w / CELL), rows = Math.ceil(sim.world.h / CELL);
      h.knownMap = new Uint8Array(cols * rows);
      // 태어나 자란 곳 둘레는 처음부터 안다
      const c = h.tribe ? { x: h.tribe.cx, y: h.tribe.cy } : { x: h.x, y: h.y };
      X.markAround(sim, h, c.x, c.y, 2);
    }
    return h.knownMap;
  };
  X.markAround = (sim, h, x, y, r) => {
    const m = h.knownMap;
    if (!m) return;
    const cols = Math.ceil(sim.world.w / CELL), rows = Math.ceil(sim.world.h / CELL);
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) m[ny * cols + nx] = 1;
    }
  };
  X.knows = (sim, h, x, y) => !!X.known(sim, h)[X.cellOf(sim, x, y)];

  // ================= 이주 무리 =================
  // 무리는 부족을 떠나 지도 위를 걸어간다. 도착해야 비로소 부족이 선다
  X.startTrek = (sim, from, leader, members, why) => {
    const site = from.findSite(sim, 18, 45, 30);
    if (!site) return false;
    sim.treks = sim.treks || [];
    const trek = { id: (sim.trekId = (sim.trekId || 0) + 1), leader: leader.id, members: members.map((m) => m.id), from: from.id, fromName: from.name, x: site.x, y: site.y, since: sim.year, why, color: from.color };
    for (const m of members) {
      from.remove(sim, m);
      m.trek = trek.id;
      m.task = null; m.state = 'idle';
      S.addMood(sim, m, 'trek');
      if (m.adult) m.log(sim, m === leader ? `${why} ${members.length}명을 이끌고 ${josa(from.name, '을/를')} 떠났다` : `${josa(leader.name, '을/를')} 따라 ${josa(from.name, '을/를')} 떠났다`);
    }
    leader.job = J.CHIEF;
    sim.treks.push(trek);
    from.log(sim, `${why} ${josa(leader.name, '이/가')} ${members.length}명을 이끌고 새 땅을 찾아 길을 떠났습니다`);
    sim.stats.treks = (sim.stats.treks || 0) + 1;
    return true;
  };

  // 누구를 데리고 갈까: 지도자와 그 가족, 그리고 지도자를 따르는 사람들
  X.gather = (sim, t, leader, share) => {
    const out = new Set([leader]);
    const addFam = (m) => {
      for (const p of [m.partner, m.lover]) if (p && p.alive && p.tribe === t && p !== t.chief && !p.jail) out.add(p);
      for (const cid of m.children) { const c = sim.byId.get(cid); if (c && c.alive && !c.adult && c.tribe === t) out.add(c); }
    };
    addFam(leader);
    const fans = t.members.filter((m) => m.adult && m !== t.chief && !m.jail && !out.has(m) && !m.labor && !m.enslaved)
      .sort((a, b) => ((S.peek(b, leader)?.v || 0) + b.p.open * 0.3) - ((S.peek(a, leader)?.v || 0) + a.p.open * 0.3));
    for (const m of fans) { if (out.size >= Math.max(4, t.members.length * share)) break; out.add(m); addFam(m); }
    return [...out];
  };

  // 해마다: 떠날 이유가 있는 부족에서 무리가 갈라져 나간다 (tribe.yearly에서 부른다)
  X.tribeYearly = (sim, t) => {
    if (t.bandit || !t.alive || t.members.length < 10 || (sim.treks || []).some((k) => k.from === t.id)) return;
    const adults = t.members.filter((m) => m.adult && m !== t.chief && !m.jail && !m.labor && !m.enslaved);
    if (adults.length < 6) return;
    const foodPer = t.stock.food / t.members.length;
    let why = null, leader = null, share = 0.25;
    if (t.members.length > 26 && chance(0.3)) { why = '마을이 비좁아'; leader = adults.find((m) => m.has('야심찬')) || adults.sort((a, b) => b.p.open - a.p.open)[0]; }
    else if (foodPer < 1 && t.members.length >= 12 && chance(0.25)) { why = '먹을 것이 모자라'; leader = adults.sort((a, b) => b.p.open + b.p.impulse - a.p.open - a.p.impulse)[0]; share = 0.35; }
    else if (t.chief) {
      // 족장과 사이가 틀어진 사람이 따르는 이들을 데리고 떠난다
      const rival = adults.find((m) => (S.peek(m, t.chief)?.grudge || 0) >= 50 && m.p.extra > 45);
      if (rival && chance(0.3)) { why = '족장과 등을 돌리고'; leader = rival; }
      // 젊은 부부가 독립한다
      else {
        const young = adults.find((m) => m.partner && m.partner.alive && m.partner.tribe === t && m.age < 30 && m.p.open > 60);
        if (young && t.members.length >= 14 && chance(0.15)) { why = '새 삶을 꿈꾸며'; leader = young; share = 0.15; }
      }
    }
    if (!leader) return;
    const members = X.gather(sim, t, leader, share);
    if (members.filter((m) => m.adult).length < 3) return;
    X.startTrek(sim, t, leader, members, why);
  };

  X.trekTick = (sim) => {
    if (!sim.treks || !sim.treks.length) return;
    for (let i = sim.treks.length - 1; i >= 0; i--) {
      const k = sim.treks[i];
      const ms = k.members.map((id) => sim.byId.get(id)).filter((m) => m && m.alive && m.trek === k.id);
      if (!ms.length) { sim.treks.splice(i, 1); continue; }
      let leader = sim.byId.get(k.leader);
      if (!leader || !leader.alive || leader.trek !== k.id) {
        leader = ms.filter((m) => m.adult).sort((a, b) => b.age - a.age)[0] || ms[0];
        k.leader = leader.id; leader.job = J.CHIEF;
        leader.log(sim, '무리를 이끌게 되었다');
      }
      // 이미 다른 부족이 그 땅을 차지했으면 다른 곳을 찾는다
      if (sim.tribes.some((t) => t.alive && G.dist(t.cx, t.cy, k.x, k.y) < 12)) {
        const site = G.Tribe.prototype.findSite.call({ cx: leader.x, cy: leader.y }, sim, 8, 30, 20);
        if (site) { k.x = site.x; k.y = site.y; }
      }
      const arrived = G.dist(leader.x, leader.y, k.x, k.y) < 3;
      const tooLong = sim.year - k.since > 1.5;
      if (arrived || (tooLong && !tribeNear(sim, leader.x, leader.y, 12))) X.settle(sim, k, ms, leader, arrived);
    }
  };

  X.settle = (sim, k, ms, leader, arrived) => {
    const p = sim.world.nearestWalkable(arrived ? k.x : leader.x, arrived ? k.y : leader.y, 3);
    if (!p) return;
    const t = new G.Tribe(sim, p.x, p.y);
    sim.tribes.push(t);
    t.chief = leader;
    t.stock.food = 6 + ms.length; t.treasury = 20;
    for (const m of ms) { m.trek = null; t.add(sim, m); S.addMood(sim, m, 'newHome'); X.markAround(sim, m, p.x, p.y, 2); }
    leader.job = J.CHIEF;
    const from = sim.tribeById(k.from);
    if (from) sim.setRel(from, t, 25); // 같은 뿌리라 처음엔 사이가 좋다
    t.origin = k.fromName;
    const days = Math.round((sim.year - k.since) * G.CFG.DAYS);
    leader.log(sim, `${days}일의 여정 끝에 ${josa(t.name, '을/를')} 세웠다`);
    t.log(sim, `${k.fromName}에서 떠나온 ${ms.length}명이 ${days}일을 걸어 ${arrived ? '새 땅에 도착해' : '더 가지 못하고 그 자리에'} ${josa(t.name, '을/를')} 세웠습니다`);
    sim.treks.splice(sim.treks.indexOf(k), 1);
  };

  // ================= 부족의 병합 =================
  X.mergeYearly = (sim) => {
    const ts = sim.tribes.filter((t) => t.alive && !t.bandit && t.members.length);
    for (const a of ts) for (const b of ts) {
      if (a === b || !a.alive || !b.alive || a.members.length < b.members.length || a.wars.has(b.id)) continue;
      const d = G.dist(a.cx, a.cy, b.cx, b.cy);
      const ra = 5 + Math.sqrt(a.members.length) * 1.4, rb = 5 + Math.sqrt(b.members.length) * 1.4;
      const rel = sim.getRel(a, b);
      const overlap = d < (ra + rb) * 0.8;
      // 영역이 겹치고 사이가 좋으면 하나가 된다. 아주 작은 부족은 가까운 큰 부족에 들어간다
      if ((overlap && rel > 30 && chance(0.3)) || (b.members.length <= 4 && d < 30 && rel > -10 && chance(0.25))) X.merge(sim, a, b, overlap ? '영역이 겹쳐' : '세가 약해져');
    }
  };
  X.merge = (sim, a, b, why) => {
    const n = b.members.length;
    for (const m of [...b.members]) { if (m.jail && m.jail.tid === b.id) m.jail.tid = a.id; a.add(sim, m); S.addMood(sim, m, 'merged'); m.log(sim, `${josa(b.name, '이/가')} ${josa(a.name, '과/와')} 합쳐져 ${a.name} 사람이 되었다`); }
    a.treasury += b.treasury; for (const r in b.stock) a.stock[r] += b.stock[r];
    a.tools += b.tools; a.lore = Math.max(a.lore || 0, b.lore || 0); a.found = [...new Set([...(a.found || []), ...(b.found || [])])];
    for (const hs of b.houses) if (G.dist(hs.x, hs.y, a.cx, a.cy) < 14) a.houses.push(hs);
    if (!a.temple && b.temple && G.dist(a.cx, a.cy, b.cx, b.cy) < 10) a.temple = true;
    sim.destroyTribe(b, `${why} ${josa(a.name, '과/와')} 하나가 되었습니다 (${n}명 합류)`);
    sim.stats.merges = (sim.stats.merges || 0) + 1;
  };

  // ================= 떠나 사는 사람 =================
  X.personTick = (sim, h) => {
    // 가 본 땅을 기억한다
    if (h.knownMap || h.lost || h.hermit || h.trek) { X.known(sim, h); X.markAround(sim, h, h.x, h.y, h.lost ? 0 : 1); }
    if (h.lost) return X.lostTick(sim, h);
    if (h.abducted) return X.abductedTick(sim, h);
    if (h.hermit) return X.hermitTick(sim, h);
    if (!able(h) || !h.tribe || h.tribe.bandit || h === h.tribe.chief || h.trek || h.labor || h.enslaved) return;
    const kidsHome = h.children.some((id) => { const c = sim.byId.get(id); return c && c.alive && !c.adult; });
    if (h.partner && h.partner.alive || kidsHome) return;
    let pull = 0;
    if (h.p.extra < 25) pull += 1;
    if (S.hasMood(h, 'rejected') || S.hasMood(h, 'divorce') || S.hasMood(h, 'breakup') || S.hasMood(h, 'widowed')) pull += 1;
    if (h.convictions && !h.redeemed) pull += 1;
    if ((h.wg || 0) > 50) pull += 1;
    if (h.has('호기심 많은') && h.p.open > 70) pull += 0.5;
    if (pull < 1.5 || !chance(0.0025 * pull)) return;
    X.becomeHermit(sim, h);
  };

  X.becomeHermit = (sim, h, here) => {
    let site = here ? { x: h.x, y: h.y } : null;
    for (let k = 0; k < 40 && !site; k++) {
      const a = Math.random() * Math.PI * 2, r = rand(14, 30);
      const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
      if (!sim.world.walkable(x, y) || sim.tribes.some((t) => t.alive && G.dist(t.cx, t.cy, x, y) < 12)) continue;
      if (sim.world.foodAround(x, y, 4) < 6) continue;
      site = { x, y };
    }
    if (!site) return false;
    const from = h.tribe;
    if (from) from.remove(sim, h);
    h.hermit = { x: site.x, y: site.y, since: sim.year, hut: 0, from: from ? from.id : null, followers: [] };
    h.job = J.NONE;
    h.log(sim, here ? '낯선 땅에 홀로 움막을 짓고 살기로 했다' : `사람들 곁을 떠나 홀로 움막을 짓고 살기로 했다`);
    if (from) from.log(sim, `${josa(h.name, '이/가')} 마을을 떠나 홀로 살러 갔습니다`, false);
    sim.stats.hermits = (sim.stats.hermits || 0) + 1;
    return true;
  };

  X.hermitTick = (sim, h) => {
    const H = h.hermit;
    if (!h.alive) return;
    if (h.adult && !(h.social > 60) && h.p.extra < 50) S.addMood(sim, h, 'solitude');
    // 짝을 만나 가정을 꾸린다: 떠돌이나 쫓겨난 사람과 마음이 맞으면 함께 산다
    if (!S.mate(h) && h.age >= 18 && h.age < 55 && chance(0.05)) {
      let o = null;
      sim.near(h.x, h.y, 10, (x) => { if (!o && x !== h && x.age >= 18 && x.age < 55 && !x.tribe && !x.hermit && !x.trek && !S.mate(x) && !x.abducted && !sim.isRelative(h, x) && x.gender !== h.gender) o = x; });
      if (o && (S.peek(o, h)?.v || 0) > -20) {
        S.bump(sim, h, o, 30, 55); S.bump(sim, o, h, 30, 55);
        S.makeLovers(sim, h, o);
        o.hermit = { x: H.x, y: H.y, since: sim.year, hut: H.hut, partnerOf: h.id, followers: [] };
        h.log(sim, `홀로 지내다 ${josa(o.name, '을/를')} 만나 함께 살게 되었다`);
        o.log(sim, `떠돌다 만난 ${josa(h.name, '과/와')} 움막에서 함께 살게 되었다`);
      }
    }
    // 현자: 지식이 깊어지면 사람들이 찾아오고, 따르는 사람이 모이면 부족이 된다
    if (h.knowledge >= 30 && !H.sage) { H.sage = true; h.log(sim, '오랜 홀로 공부 끝에 현자로 불리게 되었다'); }
    if (H.sage && chance(0.04)) {
      const t = tribeNear(sim, H.x, H.y, 40);
      const f = t && t.members.find((m) => able(m) && m !== t.chief && !m.partner && (m.has('호기심 많은') || m.p.open > 70) && !H.followers.includes(m.id));
      if (f) {
        t.remove(sim, f); f.hermit = { x: H.x + rand(-2, 2), y: H.y + rand(-2, 2), since: sim.year, hut: 1, followerOf: h.id, followers: [] };
        H.followers.push(f.id);
        f.log(sim, `현자 ${josa(h.name, '을/를')} 따라 마을을 떠났다`);
      }
    }
    // 집안이나 따르는 사람이 넷 이상이면 부족이 된다
    if (!H.followerOf && !H.partnerOf) {
      const house = [h, ...[S.mate(h)].filter(Boolean), ...h.children.map((id) => sim.byId.get(id)).filter((c) => c && c.alive && !c.tribe && G.dist(c.x, c.y, H.x, H.y) < 10), ...H.followers.map((id) => sim.byId.get(id)).filter((m) => m && m.alive && m.hermit)];
      if (house.filter((m) => m.age >= 14).length >= 4 && !tribeNear(sim, H.x, H.y, 12)) return X.hermitTribe(sim, h, house);
    }
    // 외로움이 깊으면 마을로 돌아간다
    if (!S.mate(h) && !H.sage && (h.social || 0) > 85 && h.p.extra > 30 && chance(0.03)) {
      const t = H.from && sim.tribeById(H.from);
      if (t && G.Crime.canJoin(sim, h, t)) {
        h.hermit = null; t.add(sim, h);
        h.log(sim, `홀로 사는 삶을 접고 ${josa(t.name, '으로/로')} 돌아갔다`);
        t.log(sim, `${josa(h.name, '이/가')} 홀로 살던 삶을 접고 돌아왔습니다`, false);
        return;
      }
    }
    // 드물게 사람을 납치한다 (범죄)
    X.abductTick(sim, h);
  };

  X.hermitTribe = (sim, h, house) => {
    const p = sim.world.nearestWalkable(h.hermit.x, h.hermit.y, 3);
    if (!p) return;
    const t = new G.Tribe(sim, p.x, p.y);
    sim.tribes.push(t);
    t.chief = h;
    for (const m of house) { m.hermit = null; t.add(sim, m); }
    h.job = J.CHIEF;
    t.stock.food = 8; t.treasury = 10;
    t.origin = '움막';
    h.log(sim, `움막에 모여 살던 이들과 ${josa(t.name, '을/를')} 세웠다`);
    t.log(sim, `${josa(h.name, '이/가')} 홀로 살던 움막에 사람들이 모여 ${josa(t.name, '이/가')} 되었습니다`);
  };

  // 떠나 사는 사람의 하루 (human.decide 앞에서 부른다)
  X.hermitDecide = (sim, h) => {
    const H = h.hermit, w = sim.world;
    if (h.hunger > 50 && !(h.carry === 'food' && h.carryAmt > 0)) {
      const f = w.findResource(h.x, h.y, 'food', 10);
      if (f) return h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 3 });
    }
    if (G.dist(h.x, h.y, H.x, H.y) > 6) return h.goTo(sim, H.x + rand(-1, 1), H.y + rand(-1, 1), { kind: 'wander' });
    if (H.hut < 1 && h.adult) { H.hutBusy = true; return h.goTo(sim, H.x + 0.8, H.y + 0.3, { kind: 'build', hut: H }); }
    if (chance(0.25)) { const f = w.findResource(H.x, H.y, 'food', 6); if (f) return h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 3 }); }
    if (chance(0.2) && G.Persona.goStudy) { const s = { x: H.x + rand(-3, 3), y: H.y + rand(-3, 3) }; if (w.walkable(s.x, s.y)) return h.goTo(sim, s.x, s.y, { kind: 'hobby', hobby: '공부' }); }
    if (chance(0.1)) return h.startPray(sim, '홀로');
    return h.wander(sim, H.x, H.y, 4);
  };

  // ================= 납치 (범죄, 18세 이상끼리만) =================
  X.abductTick = (sim, h) => {
    if (S.mate(h) || h.age < 18 || h.age > 55 || h.p.agree >= 25 || !(h.has('냉정한') || h.has('교활한')) || h.has('다정한') || !chance(0.004)) return;
    const t = tribeNear(sim, h.x, h.y, 35);
    if (!t || t.bandit) return;
    let v = null;
    sim.near(t.cx, t.cy, 18, (o) => {
      if (v || !able(o) || o.age < 18 || o.gender === h.gender || S.mate(o) || o.tribe !== t || o.job === J.GUARD || o.job === J.WARRIOR) return;
      let n = 0; sim.near(o.x, o.y, 6, (x) => { if (x !== o && x.state !== 'sleep') n++; });
      if (n === 0 && G.dist(o.x, o.y, t.cx, t.cy) > 6) v = o;
    });
    if (!v) return;
    // 저항하면 실패한다
    if (chance(0.25 + (v.has('용감한') ? 0.25 : 0) + (v.body - h.body) / 200)) {
      h.log(sim, `${josa(v.name, '을/를')} 끌고 가려다 거센 저항에 달아났다`);
      v.log(sim, `낯선 ${h.name}에게 끌려갈 뻔했지만 힘껏 뿌리쳤다`);
      M.adj(sim, v, h, { fear: 40, grudge: 40 });
      G.Crime.record(sim, h, '납치', v.name, true);
      G.Crime.report(sim, h, '납치', v.name);
      return;
    }
    v.abducted = { by: h.id, since: sim.year, from: t.id };
    v.task = null; v.state = 'idle';
    v.x = h.hermit.x + rand(-1, 1); v.y = h.hermit.y + rand(-1, 1); v.tx = v.x; v.ty = v.y; v.path = null;
    S.addMood(sim, v, 'abducted');
    M.adj(sim, v, h, { fear: 70, grudge: 80, trust: -100 });
    M.trauma(sim, v, 0.4, '끌려간 뒤');
    h.log(sim, `${t.name}의 ${josa(v.name, '을/를')} 납치해 움막에 가두었다`);
    v.log(sim, `낯선 ${h.name}에게 납치되어 외딴 움막에 갇혔다`);
    G.Crime.record(sim, h, '납치', v.name, false);
    t.log(sim, `${josa(v.name, '이/가')} 마을 밖에서 사라졌습니다`);
    for (const id of [...v.parents.map((p) => p.id), ...v.children]) { const o = sim.byId.get(id); if (o) { S.addMood(sim, o, 'missing'); o.log(sim, `${josa(v.name, '이/가')} 사라져 애타게 찾았다`); } }
    sim.stats.abductions = (sim.stats.abductions || 0) + 1;
  };
  X.abductedTick = (sim, v) => {
    const A = v.abducted;
    const h = sim.byId.get(A.by);
    const home = sim.tribeById(A.from);
    S.addMood(sim, v, 'abducted');
    v.stress = clamp((v.stress || 0) + 3, 0, 100);
    let how = null;
    if (!h || !h.alive || !h.hermit) how = '붙잡아 둔 사람이 사라져';
    else if (chance(v.has('용감한') || v.has('교활한') ? 0.02 : 0.007)) how = '감시가 소홀한 틈에 달아나';
    else if (home) {
      // 가족과 경비병이 수색대를 꾸려 찾아 나선다
      const searchers = home.members.filter((m) => able(m) && (m.job === J.GUARD || m.job === J.WARRIOR || S.isFamily(m, v.id))).length;
      const d = G.dist(home.cx, home.cy, h.hermit.x, h.hermit.y);
      if (chance(0.004 * searchers * (d < 25 ? 1.5 : 0.7))) how = `${home.name}의 수색대에 발견되어`;
    }
    // 원치 않는 임신 (기록 문장으로만)
    if (!how && h && v.gender === 'F' && h.gender === 'M' && !v.pregnant && v.age < 45 && chance(0.02)) {
      v.pregnant = Math.floor(G.CFG.TPY * 0.75);
      v.babyFather = { id: h.id, name: h.name, traits: h.traits.slice(), faith: h.faith };
      v.unwantedPreg = true;
      S.addMood(sim, v, 'unwanted');
      v.log(sim, '붙잡혀 있는 동안 원치 않는 임신을 하게 되었다');
    }
    if (!how) return;
    v.abducted = null;
    v.log(sim, `${how} 집으로 돌아왔다`);
    S.addMood(sim, v, 'freed');
    if (home) {
      if (v.tribe !== home) home.add(sim, v);
      v.goTo(sim, home.cx, home.cy, { kind: 'wander' });
      // 그 사이에 태어난 아이도 함께
      for (const cid of v.children) { const c = sim.byId.get(cid); if (c && c.alive && !c.adult && !c.tribe) { home.add(sim, c); c.x = v.x; c.y = v.y; } }
      for (const id of [...v.parents.map((p) => p.id), ...v.children]) { const o = sim.byId.get(id); if (o) S.addMood(sim, o, 'reunited'); }
      home.log(sim, `사라졌던 ${josa(v.name, '이/가')} ${how} 돌아왔습니다`);
    }
    if (h && h.alive) {
      for (const c of h.crimes) if (c.type === '납치' && c.victim === v.name) c.known = true;
      G.Crime.report(sim, h, '납치', v.name);
      if (home) for (const m of home.members) if (m.adult) M.adj(sim, m, h, { grudge: 30 });
    }
  };
  X.abductedDecide = (sim, v) => {
    const h = sim.byId.get(v.abducted.by);
    if (!h || !h.hermit) return false;
    const H = h.hermit;
    if (v.hunger > 55) { const f = sim.world.findResource(H.x, H.y, 'food', 4); if (f) return v.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 2 }); }
    return v.wander(sim, H.x, H.y, 1.5);
  };

  // ================= 길 잃은 사람 =================
  X.lostTick = (sim, h) => {
    const L = h.lost;
    S.addMood(sim, h, 'lost');
    const home = L.home && sim.tribeById(L.home);
    // 마을이 눈에 들어오거나 아는 땅에 닿으면 길을 찾는다
    const ty = sim.world.typeAt(h.x, h.y);
    const sight = ty === G.T.HILL || ty === G.T.MOUNTAIN ? SIGHT * 1.8 : SIGHT; // 높은 곳에 오르면 멀리 보인다
    if (home && (G.dist(h.x, h.y, home.cx, home.cy) < sight || (X.knows(sim, h, h.x, h.y) && L.knew !== X.cellOf(sim, h.x, h.y)))) {
      h.lost = null;
      S.addMood(sim, h, 'foundWay');
      h.log(sim, `${Math.max(1, Math.round((sim.year - L.since) * G.CFG.DAYS))}일 동안 헤맨 끝에 ${G.dist(h.x, h.y, home.cx, home.cy) < sight ? '멀리 마을을 알아보고' : '눈에 익은 땅에 닿아'} 집으로 가는 길을 찾았다`);
      if (h.tribe !== home && G.Crime.canJoin(sim, h, home)) home.add(sim, h);
      h.goTo(sim, home.cx, home.cy, { kind: 'wander' });
      for (const id of [...h.parents.map((p) => p.id), ...h.children, ...(h.partner ? [h.partner.id] : [])]) { const o = sim.byId.get(id); if (o) S.addMood(sim, o, 'reunited'); }
      return;
    }
    // 적응: 오래 헤매면 근처 부족에 들어가거나, 그 자리에 터를 잡는다
    const t = tribeNear(sim, h.x, h.y, 10);
    if (sim.year - L.since > 0.5 && t && t !== home && !t.bandit && G.Crime.canJoin(sim, h, t) && chance(0.3)) {
      h.lost = null;
      t.add(sim, h);
      h.log(sim, `돌아갈 길을 끝내 찾지 못하고 낯선 ${t.name}에 받아들여져 새 삶을 시작했다`);
      t.log(sim, `길 잃은 ${josa(h.name, '이/가')} 찾아와 ${t.name} 사람이 되었습니다`, false);
      X.markAround(sim, h, t.cx, t.cy, 2);
      return;
    }
    if (sim.year - L.since > 1.5 && h.adult && chance(0.2)) { h.lost = null; X.becomeHermit(sim, h, true); }
  };
  X.lostDecide = (sim, h) => {
    const w = sim.world;
    if (h.hunger > 50 && !(h.carry === 'food' && h.carryAmt > 0)) {
      const f = w.findResource(h.x, h.y, 'food', 8);
      if (f) return h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 3 });
    }
    // 아직 가 보지 않은 쪽으로 조금씩 나아간다 (높은 곳이 있으면 올라가 둘러본다)
    const L = h.lost;
    if (L.dir === undefined || chance(0.25)) L.dir = Math.random() * Math.PI * 2;
    let best = null, bs = -1e9;
    for (let k = 0; k < 10; k++) {
      const a = L.dir + rand(-1.2, 1.2), r = rand(6, 12);
      const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
      if (!w.walkable(x, y)) continue;
      const ty = w.typeAt(x, y);
      const sc = (X.knows(sim, h, x, y) ? 0 : 5) + (ty === G.T.HILL ? 3 : ty === G.T.MOUNTAIN ? 1 : 0) + rand(0, 2);
      if (sc > bs) { bs = sc; best = { x, y, a }; }
    }
    if (!best) { L.dir += Math.PI; return h.wander(sim, h.x, h.y, 5); }
    L.dir = best.a;
    return h.goTo(sim, best.x, best.y, { kind: 'wander' });
  };

  // ================= human.decide 앞에서 부른다 =================
  X.decide = (sim, h) => {
    if (!(h.abducted || h.lost || h.trek || h.hermit)) return false;
    // 밤에는 그 자리에서 잔다 (마을 집으로 가지 않는다)
    if (sim.sleepTime() && h.hunger < 80) { h.state = 'sleep'; return true; }
    if (h.abducted) return X.abductedDecide(sim, h) !== false;
    if (h.lost) { X.lostDecide(sim, h); return true; }
    if (h.trek) {
      const k = (sim.treks || []).find((x) => x.id === h.trek);
      if (!k) { h.trek = null; return false; }
      if (h.hunger > 70) { const f = sim.world.findResource(h.x, h.y, 'food', 6); if (f) return h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 2 }); }
      const leader = sim.byId.get(k.leader);
      if (leader === h || !leader) return h.goTo(sim, k.x + rand(-1, 1), k.y + rand(-1, 1), { kind: 'wander' }) || true;
      if (G.dist(leader.x, leader.y, h.x, h.y) > 2.5) return h.goTo(sim, leader.x + rand(-1.5, 1.5), leader.y + rand(-1.5, 1.5), { kind: 'wander' }) || true;
      h.state = 'rest'; h.timer = 15;
      return true;
    }
    if (h.hermit) { X.hermitDecide(sim, h); return true; }
    return false;
  };

  // ================= 신의 권능 =================
  // 사람 옮기기: 집어 들어 다른 곳에 내려놓는다. 낯선 곳이면 길을 잃는다
  X.carry = (sim, h, x, y) => {
    const w = sim.world;
    const p = w.nearestWalkable(x, y, 2);
    if (!p) return { ok: false, msg: '물 위에는 내려놓을 수 없습니다' };
    const cost = G.POWERS.carry.cost;
    if (sim.faith < cost) return { ok: false, msg: `신앙이 부족합니다 (필요 ${cost})` };
    sim.faith -= cost;
    X.known(sim, h);
    const fromX = h.x, fromY = h.y;
    h.x = p.x; h.y = p.y; h.tx = p.x; h.ty = p.y; h.path = null; h.task = null; h.state = 'idle';
    if (h.jail) { h.jail = null; h.wanted = true; h.log(sim, '신의 손에 들려 감옥 밖으로 나왔다'); }
    if (h.held) h.held = null;
    if (h.abducted) { h.abducted = null; }
    h.faith = Math.min(100, h.faith + 20); h.miracles++;
    sim.effects.push({ kind: 'beam', x: fromX, y: fromY, age: 0, ttl: 50 });
    sim.effects.push({ kind: 'bless', x: p.x, y: p.y, r: 2, age: 0, ttl: 60 });
    sim.near(fromX, fromY, 10, (o) => { if (o !== h) { o.faith = Math.min(100, o.faith + 6); o.say('!', 60); } });
    const home = h.tribe;
    const knows = X.knows(sim, h, p.x, p.y) || (home && G.dist(home.cx, home.cy, p.x, p.y) < SIGHT);
    if (knows || G.dist(fromX, fromY, p.x, p.y) < 10) {
      h.log(sim, '신의 손에 들려 옮겨졌지만 아는 곳이었다');
      return { ok: true, msg: `${h.name}을(를) 옮겼습니다 (아는 곳이라 길을 압니다)` };
    }
    h.lost = { home: home ? home.id : null, since: sim.year, knew: X.cellOf(sim, p.x, p.y) };
    if (h.trek) h.trek = null;
    if (h.hermit) h.hermit = null;
    h.log(sim, '신의 손에 들려 하늘을 날았다. 정신을 차려 보니 처음 보는 땅이었다');
    h.say('?', 200);
    if (home) {
      home.log(sim, `${josa(h.name, '이/가')} 신의 손에 들려 사라졌습니다`, false);
      for (const id of [...h.parents.map((q) => q.id), ...h.children, ...(h.partner ? [h.partner.id] : [])]) { const o = sim.byId.get(id); if (o) { S.addMood(sim, o, 'missing'); } }
    }
    sim.event(`신이 ${josa(h.name, '을/를')} 낯선 땅으로 옮겼습니다. 집으로 가는 길을 모릅니다`, '#f5d76e', p.x, p.y);
    return { ok: true, msg: `${h.name}을(를) 옮겼습니다. 길을 잃고 헤매게 됩니다` };
  };

  // 지진: 집과 신전과 감옥이 무너지고 사람이 다친다
  X.quake = (sim, x, y) => {
    const r = 8;
    let hurt = 0, dead = 0, houses = 0;
    for (const t of sim.tribes) {
      if (!t.alive) continue;
      const before = t.houses.length;
      t.houses = t.houses.filter((hs) => !(G.dist(hs.x, hs.y, x, y) < r && chance(0.6)));
      houses += before - t.houses.length;
      if (t.temple && G.dist(t.cx, t.cy, x, y) < r && chance(0.6)) { t.temple = false; t.log(sim, `${t.name}의 신전이 지진에 무너졌습니다`); }
      if (t.jail && G.dist(t.jail.x, t.jail.y, x, y) < r && chance(0.5)) { t.log(sim, `${t.name}의 감옥이 지진에 무너졌습니다`); G.Crime.jailDestroyed(sim, t); }
    }
    const victims = [];
    sim.near(x, y, r, (h) => victims.push(h));
    for (const h of victims) {
      const near = G.dist(h.x, h.y, x, y) < r * 0.5;
      h.health -= rand(near ? 15 : 5, near ? 45 : 20);
      S.addMood(sim, h, 'quake'); h.say('!', 90);
      h.faith = Math.min(100, h.faith + (h.has('의심 많은') ? 5 : 12)); h.miracles++;
      if (h.health <= 0) { sim.kill(h, '지진'); dead++; } else { hurt++; if (near) M.trauma(sim, h, 0.1, '지진에 집이 무너지는 것을 보고'); }
    }
    // 땅이 조금씩 솟고 꺼진다
    for (let k = 0; k < 6; k++) sim.world.modifyHeight(x + rand(-r, r) * 0.7, y + rand(-r, r) * 0.7, 2, rand(-0.02, 0.02));
    sim.world.dirty = true;
    sim.effects.push({ kind: 'quake', x, y, age: 0, ttl: 60 });
    sim.event(`지진이 일어났습니다. 집 ${houses}채가 무너지고 ${hurt}명이 다쳤습니다${dead ? `. ${dead}명이 목숨을 잃었습니다` : ''}`, '#d9a066', x, y);
    G.Crime3.disaster(sim, x, y, '지진');
  };
  // 역병: 옮는 병을 퍼뜨린다
  X.plague = (sim, x, y) => {
    let n = 0;
    sim.near(x, y, 6, (h) => { if (!h.sick || h.sick.name !== '역병') { h.sick = { name: '역병', left: randi(8, 14), contagious: true }; n++; h.log(sim, '역병에 걸렸다'); } });
    sim.effects.push({ kind: 'bless', x, y, r: 6, age: 0, ttl: 70, color: '140,180,90' });
    if (n) sim.event(`역병이 돌기 시작했습니다 (${n}명)`, '#9ab060', x, y);
  };
  // 계시: 한 사람에게 꿈으로 깨달음을 준다
  X.revelation = (sim, h) => {
    const cost = G.POWERS.revelation.cost;
    if (sim.faith < cost) return { ok: false, msg: `신앙이 부족합니다 (필요 ${cost})` };
    sim.faith -= cost;
    const gain = randi(25, 45);
    h.knowledge += gain; h.faith = 100; h.miracles++;
    S.addMood(sim, h, 'revelation');
    h.say('✦', 200);
    h.log(sim, '꿈속에서 신의 계시를 받아 큰 깨달음을 얻었다');
    if (h.tribe) G.Persona.addLore(sim, h.tribe, gain * 3, h);
    sim.near(h.x, h.y, 8, (o) => { if (o !== h) { o.faith = Math.min(100, o.faith + 5); M.adj(sim, o, h, { respect: 20 }); } });
    sim.effects.push({ kind: 'beam', x: h.x, y: h.y, age: 0, ttl: 70 });
    sim.event(`${josa(h.name, '이/가')} 꿈속에서 신의 계시를 받았습니다`, '#f5d76e', h.x, h.y);
    return { ok: true, msg: `${h.name}에게 계시를 내렸습니다 (지식 +${gain})` };
  };
  // 짐승 무리: 사슴·멧돼지·산양 무리를 불러온다
  X.beasts = (sim, x, y) => {
    const kind = pick(['deer', 'deer', 'boar', 'sheep', 'cattle', 'fowl']);
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const p = sim.world.nearestWalkable(x + rand(-2, 2), y + rand(-2, 2), 3);
      if (p) { G.Wild.spawn(sim, kind, p.x, p.y); n++; }
    }
    sim.effects.push({ kind: 'bless', x, y, r: 3, age: 0, ttl: 60, color: '200,230,150' });
    sim.near(x, y, 10, (h) => { h.faith = Math.min(100, h.faith + 4); });
    sim.event(`신이 ${G.Wild.KINDS[kind].name} ${n}마리를 불러왔습니다`, '#c8e0a0', x, y);
  };
  // 역병은 가까이 있는 사람에게 옮는다 (persona.tick에서 부른다)
  X.spread = (sim, h) => {
    if (!h.sick || !h.sick.contagious || !chance(0.25)) return;
    sim.near(h.x, h.y, 2, (o) => { if (o !== h && !o.sick && chance(0.15 * (o.body < 40 ? 1.5 : 1))) { o.sick = { name: '역병', left: randi(8, 14), contagious: true }; } });
  };

  // ================= 매 사회 틱 / 해마다 =================
  X.social = (sim) => { X.trekTick(sim); };
  X.yearly = (sim) => { X.mergeYearly(sim); };
})();
