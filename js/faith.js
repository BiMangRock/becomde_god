// 신앙: 시설과 활동, 그리고 신의 모습
//  · 시설: 제단 → 신전 → 대신전, 묘지(조상 숭배), 토템, 성지(기적이 일어난 자리)
//  · 활동: 계절 제사, 성년식, 장례, 신탁(전쟁을 미루기도 함), 금식, 축일, 순례, 선교, 교리 분화
//  · 신의 모습: 신(플레이어)이 권능을 어떻게 쓰느냐에 따라 부족마다 믿는 신의 얼굴이 달라진다
//    (비·축복·치유 → 자비, 번개·운석·지진·역병 → 두려움, 다산·짐승 → 풍요, 사랑의 화살 → 사랑, 신의 재판 → 심판)
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const S = G.Social, M = G.Mind;
  const X = (G.Faith = {});

  Object.assign(G.MOODS, {
    rite: { t: '제사를 올렸다', v: 8, d: 0.3 },
    cameOfAge: { t: '성년식을 치렀다', v: 14, d: 1 },
    funeral: { t: '장례로 마음을 달랬다', v: 6, d: 0.6 },
    pilgrim: { t: '성지를 순례했다', v: 18, d: 1.5 },
    fasting: { t: '금식 중이다', v: -4, d: 0.3 },
    holyday: { t: '축일을 지냈다', v: 12, d: 0.5 },
    converted: { t: '새 믿음을 받아들였다', v: 8, d: 1 },
  });

  // 신의 모습
  X.GODS = {
    mercy: { name: '자비의 신', desc: '비와 축복과 치유를 내리는 신. 제사에서 더 큰 위안을 얻는다' },
    wrath: { name: '두려움의 신', desc: '번개와 재앙을 내리는 신. 사람들이 두려워 죄를 덜 짓지만, 제물을 바치는 광신이 생기기 쉽다' },
    bounty: { name: '풍요의 신', desc: '아이와 짐승을 늘려 주는 신. 제사 때마다 창고가 조금 넉넉해진다' },
    love: { name: '사랑의 신', desc: '사람을 이어 주는 신. 부부에게 아이가 조금 더 잘 생긴다' },
    justice: { name: '심판의 신', desc: '숨은 죄를 드러내는 신. 사람들이 죄를 덜 짓는다' },
  };
  const POWER_GOD = { rain: 'mercy', bless: 'mercy', heal: 'mercy', lightning: 'wrath', meteor: 'wrath', quake: 'wrath', plague: 'wrath', discord: 'wrath', fertility: 'bounty', beasts: 'bounty', create: 'bounty', cupid: 'love', judgment: 'justice', revelation: 'mercy', carry: 'wrath' };
  X.godOf = (t) => (t && t.god ? X.GODS[t.god] : null);

  // 권능이 내려졌을 때 (sim.power 뒤, 그리고 사람을 고르는 권능에서 부른다)
  X.onPower = (sim, kind, x, y) => {
    const g = POWER_GOD[kind];
    if (!g) return;
    for (const t of sim.tribes) {
      if (!t.alive || t.bandit || G.dist(t.cx, t.cy, x, y) > 22) continue;
      t.belief = t.belief || {};
      t.belief[g] = (t.belief[g] || 0) + 1;
      X.updateGod(sim, t);
    }
    // 기적이 일어난 자리는 성지가 된다
    const SITE = { bless: '축복의 언덕', rain: '단비의 샘', heal: '치유의 바위', meteor: '별이 떨어진 곳', revelation: '계시의 자리', fertility: '다산의 숲', judgment: '심판의 돌' };
    if (SITE[kind] && chance(kind === 'meteor' ? 0.8 : 0.35)) X.makeSite(sim, x, y, SITE[kind]);
  };
  X.updateGod = (sim, t) => {
    const b = t.belief || {};
    let best = null, bv = 2;
    for (const k in b) if (b[k] > bv) { bv = b[k]; best = k; }
    if (best && best !== t.god) {
      t.god = best;
      t.log(sim, `${josa(t.name, '이/가')} 신을 '${X.GODS[best].name}'으로 섬기기 시작했습니다`);
      if (best === 'wrath' && t.law && !t.law.zealot && chance(0.3)) { t.law.zealot = true; t.log(sim, `두려움 속에 ${t.name}에 제물을 바치는 풍습이 생겼습니다`, false); }
    }
  };
  X.makeSite = (sim, x, y, name) => {
    sim.sacred = sim.sacred || [];
    if (sim.sacred.some((s) => G.dist(s.x, s.y, x, y) < 10)) return;
    const p = sim.world.nearestWalkable(x, y, 3);
    if (!p) return;
    const t = sim.tribes.find((o) => o.alive && !o.bandit && G.dist(o.cx, o.cy, p.x, p.y) < 25);
    sim.sacred.push({ x: p.x, y: p.y, name, year: Math.floor(sim.year), tid: t ? t.id : null, visits: 0 });
    sim.event(`기적이 일어난 자리가 '${name}'이라는 성지가 되었습니다`, '#f5d76e', p.x, p.y);
  };

  // 신의 모습이 범죄 성향과 아이에 미치는 힘
  X.urgeMult = (h) => (h.tribe && (h.tribe.god === 'justice' || h.tribe.god === 'wrath') && h.faith > 40 ? 0.85 : 1);
  X.fertMult = (h) => (h.tribe && h.tribe.god === 'love' ? 1.15 : 1);

  // ================= 시설 (해마다) =================
  X.tribeYearly = (sim, t) => {
    if (!t.alive || t.bandit || !t.members.length) return;
    const n = t.members.length;
    const avg = t.members.reduce((s, m) => s + m.faith, 0) / n;
    const spot = (r0, r1) => {
      for (let k = 0; k < 30; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(r0, r1);
        const x = t.cx + Math.cos(a) * r, y = t.cy + Math.sin(a) * r;
        if (sim.world.walkable(x, y) && !t.houses.some((h) => Math.hypot(h.x - x, h.y - y) < 1.3) && !(t.jail && Math.hypot(t.jail.x - x, t.jail.y - y) < 1.5)) return { x, y };
      }
      return null;
    };
    if (!t.altar && n >= 4 && avg > 30 && t.stock.wood >= 4) { const p = spot(1.5, 3); if (p) { t.altar = p; t.stock.wood -= 4; t.log(sim, `${josa(t.name, '이/가')} 신께 제물을 올릴 제단을 쌓았습니다`, false); } }
    if (t.temple && !t.greatTemple && n >= 20 && avg > 60 && t.stock.wood >= 40) { t.greatTemple = true; t.stock.wood -= 40; t.log(sim, `${josa(t.name, '이/가')} 웅장한 대신전을 세웠습니다`); }
    if (!t.graveyard && t.deaths > 0) { const p = spot(5, 7.5); if (p) { t.graveyard = { ...p, graves: Math.min(12, t.deaths) }; t.log(sim, `${josa(t.name, '이/가')} 마을 밖에 묘지를 만들었습니다`, false); } }
    if (!t.totem && n >= 10 && t.stock.wood >= 8) {
      const p = spot(2, 4);
      if (p) { t.totem = { ...p, animal: (t.name.match(/(늑대|곰|매|사슴|여우|뱀|까마귀|호랑이|물고기|돌|불꽃|나무|달|해|고래|독수리)/) || [, '독수리'])[1] }; t.stock.wood -= 8; t.log(sim, `${josa(t.name, '이/가')} ${t.totem.animal} 토템을 세웠습니다`, false); }
    }
    // 금식: 가뭄에 신앙이 깊은 부족은 먹을 것을 아끼며 기도한다
    if (sim.drought && (avg > 60 || (t.law && t.law.zealot)) && chance(0.6)) {
      t.stock.food += Math.round(n * 0.6);
      for (const m of t.members) if (m.adult && m.faith > 40) { S.addMood(sim, m, 'fasting'); m.faith = Math.min(100, m.faith + 4); }
      t.log(sim, `${josa(t.name, '이/가')} 가뭄을 끝내 달라며 금식하고 기도합니다`, false);
    }
    // 축일: 부족의 성지에서 해마다 축제를 연다
    const site = (sim.sacred || []).find((s) => s.tid === t.id);
    if (site && chance(0.5) && t.stock.food > n * 2) {
      t.stock.food -= Math.floor(n * 0.4);
      for (const m of t.members) if (!m.jail && m.adult) { S.addMood(sim, m, 'holyday'); m.faith = Math.min(100, m.faith + 3); if (G.dist(m.x, m.y, site.x, site.y) < 30 && chance(0.5)) m.goTo(sim, site.x + rand(-2, 2), site.y + rand(-2, 2), { kind: 'party' }); }
      t.log(sim, `${josa(t.name, '이/가')} 성지 '${site.name}'에서 축일을 지냈습니다`, false);
    }
    X.mission(sim, t, avg);
    X.schism(sim, t, avg);
  };

  // ================= 계절 제사 (tribe.seasonal에서 부른다) =================
  X.rite = (sim, t) => {
    if (!t.alive || t.bandit || !(t.altar || t.temple)) return;
    const priest = t.members.find((m) => m.job === J.PRIEST && !m.jail) || null;
    if (!priest && !chance(0.4)) return;
    const at = t.altar || { x: t.cx, y: t.cy };
    let n = 0;
    for (const m of t.members) {
      if (m.jail || m.held || m.state === 'fight' || m.state === 'sleep' || m.faith < 25) continue;
      S.addMood(sim, m, 'rite', t.god === 'mercy' ? 1.5 : 1);
      m.faith = Math.min(100, m.faith + (priest ? 4 : 2));
      if (chance(0.6)) m.goTo(sim, at.x + rand(-2, 2), at.y + rand(-1.5, 2), { kind: 'pray', why: '제사' });
      n++;
    }
    if (t.god === 'bounty') t.stock.food += Math.round(n * 0.3);
    if (priest && sim.year - (priest.riteLog || -99) > 4) { priest.riteLog = sim.year; priest.log(sim, `${n}명과 함께 계절 제사를 올렸다`); }
    if (n >= 6 && sim.year - (t.riteLog || -99) > 6) { t.riteLog = sim.year; t.log(sim, `${josa(t.name, '이/가')} ${t.god ? X.GODS[t.god].name + '께 ' : ''}계절 제사를 올렸습니다 (${n}명)`, false); }
  };

  // ================= 성년식과 장례 =================
  X.comingOfAge = (sim, h) => {
    const t = h.tribe;
    if (!t || t.bandit || !(t.altar || t.temple || t.members.some((m) => m.job === J.PRIEST))) return;
    S.addMood(sim, h, 'cameOfAge');
    h.faith = Math.min(100, h.faith + 6);
    h.log(sim, `${t.altar ? '제단 앞에서 ' : ''}성년식을 치렀다`);
    for (const p of h.parents) { const o = sim.byId.get(p.id); if (o) { S.bump(sim, o, h, 4); } }
  };
  X.funeral = (sim, dead, t) => {
    if (!t || !t.alive || t.bandit) return;
    if (t.graveyard) t.graveyard.graves = Math.min(30, (t.graveyard.graves || 0) + 1);
    const priest = t.members.find((m) => m.job === J.PRIEST && !m.jail);
    let n = 0;
    for (const o of sim.humans) {
      if (!o.alive || o === dead) continue;
      const r = o.rel.get(dead.id);
      if (!r || (r.v < 40 && !S.isFamily(o, dead.id))) continue;
      S.addMood(sim, o, 'funeral', priest ? 1.5 : 1);
      // 장례를 치르면 슬픔이 조금 빨리 가라앉는다
      for (const m of o.moodlets) if (['lostChild', 'lostParent', 'lostFriend', 'widowed'].includes(m.k)) m.until -= (m.until - sim.year) * (priest ? 0.3 : 0.15);
      n++;
    }
    if (n >= 3 && (dead.job === J.CHIEF || dead.age >= 70) && t.graveyard) t.log(sim, `${dead.name}의 장례에 ${n}명이 모였습니다`, false);
  };

  // ================= 신탁: 전쟁 전에 묻는다 (tribe 외교에서 부른다. true면 전쟁을 미룬다) =================
  X.forbidWar = (sim, t, o) => {
    const priest = t.members.find((m) => m.job === J.PRIEST && !m.jail);
    if (!priest || !chance(0.5)) return false;
    // 두려움의 신을 섬기거나 최근 재앙을 겪었으면 흉조가 잘 나온다
    const bad = chance(0.3 + (t.god === 'wrath' ? 0.15 : 0) + (t.god === 'mercy' ? 0.2 : 0));
    if (!bad) { if (sim.year - (t.omenLog || -99) > 5) { t.omenLog = sim.year; t.log(sim, `사제 ${josa(priest.name, '이/가')} 신탁에 길조가 나왔다고 알렸습니다`, false); } return false; }
    t.log(sim, `사제 ${josa(priest.name, '이/가')} 신탁에 흉조가 나왔다며 ${o.name}과(와)의 전쟁을 말렸습니다`);
    sim.changeRel(t, o, 8);
    return true;
  };

  // ================= 순례 =================
  X.personTick = (sim, h) => {
    if (!h.adult || h.jail || h.held || h.lost || h.trek || h.abducted || h.faith < 75 || h.state === 'fight') return;
    if (sim.year - (h.lastPilgrim || -99) < 6 || !sim.sacred || !sim.sacred.length || !chance(0.008)) return;
    const site = sim.sacred.filter((s) => G.dist(s.x, s.y, h.x, h.y) < 55).sort((a, b) => G.dist(a.x, a.y, h.x, h.y) - G.dist(b.x, b.y, h.x, h.y))[0];
    if (!site || h.hunger > 40) return;
    h.lastPilgrim = sim.year;
    if (h.tribe && h.tribe.stock.food >= 2 && h.ration < 2) { h.tribe.stock.food -= 2 - h.ration; h.ration = 2; }
    h.goTo(sim, site.x + rand(-1.5, 1.5), site.y + rand(-1.5, 1.5), { kind: 'pilgrim', site: sim.sacred.indexOf(site) });
  };
  X.onPilgrim = (sim, h, task) => {
    const site = sim.sacred && sim.sacred[task.site];
    if (!site) return;
    site.visits++;
    h.faith = 100;
    S.addMood(sim, h, 'pilgrim');
    if (h.mind) M.support(sim, h, 15);
    h.log(sim, `성지 '${site.name}'를 순례했다`);
    // 다른 부족의 순례자와 만나면 두 부족이 가까워진다
    sim.near(site.x, site.y, 5, (o) => {
      if (o === h || !o.tribe || !h.tribe || o.tribe === h.tribe || (o.state !== 'pray' && !(o.task && o.task.kind === 'pilgrim'))) return;
      sim.changeRel(h.tribe, o.tribe, 3); S.bump(sim, h, o, 10);
    });
    h.startPray(sim, '순례');
    sim.stats.pilgrims = (sim.stats.pilgrims || 0) + 1;
  };

  // ================= 선교: 믿음이 깊은 부족이 이웃에게 믿음을 전한다 =================
  X.mission = (sim, t, avg) => {
    if (!t.temple || avg < 55 || !chance(0.15)) return;
    const priest = t.members.find((m) => m.job === J.PRIEST && !m.jail && m.adult);
    if (!priest) return;
    const o = sim.tribes.filter((x) => x.alive && !x.bandit && x !== t && !t.wars.has(x.id) && x.faithFrom !== t.id && (x.faithFrom || x.id) !== (t.faithFrom || t.id) && G.dist(x.cx, x.cy, t.cx, t.cy) < 60)
      .sort((a, b) => G.dist(a.cx, a.cy, t.cx, t.cy) - G.dist(b.cx, b.cy, t.cx, t.cy))[0];
    if (!o) return;
    const oavg = o.members.reduce((s, m) => s + m.faith, 0) / Math.max(1, o.members.length);
    const accept = (o.temple ? 0.15 : 0.45) + (oavg < 35 ? 0.2 : 0) + (sim.getRel(t, o) > 20 ? 0.15 : 0);
    priest.log(sim, `${o.name}에 가서 믿음을 전했다`);
    if (!chance(accept)) { t.log(sim, `${t.name}의 사제 ${josa(priest.name, '이/가')} ${o.name}에 믿음을 전하려 했지만 받아들여지지 않았습니다`, false); return; }
    o.faithFrom = t.faithFrom || t.id;
    if (t.god) { o.belief = { ...(t.belief || {}) }; o.god = t.god; }
    for (const m of o.members) { m.faith = Math.min(100, m.faith + 10); if (m.adult) S.addMood(sim, m, 'converted'); }
    sim.changeRel(t, o, 15);
    t.log(sim, `${t.name}의 사제 ${josa(priest.name, '이/가')} 전한 믿음을 ${josa(o.name, '이/가')} 받아들였습니다`);
  };
  // 같은 믿음을 나눈 부족끼리는 해마다 가까워진다 (tribe 외교에서 더한다)
  X.kinship = (a, b) => ((a.faithFrom || a.id) === (b.faithFrom || b.id) && (a.faithFrom || b.faithFrom) ? 2 : 0);

  // ================= 교리 분화: 다른 믿음을 외치는 사람이 따르는 이들을 데리고 떠난다 =================
  X.schism = (sim, t, avg) => {
    if (t.members.length < 14 || !t.temple || !chance(0.06)) return;
    const prophet = t.members.find((m) => m.adult && m !== t.chief && m.job !== J.PRIEST && m.knowledge > 25 && m.p.open > 65 && m.faith > 60 && !m.jail);
    if (!prophet) return;
    const others = Object.keys(X.GODS).filter((k) => k !== t.god);
    const newGod = pick(others);
    const members = G.Migrate.gather(sim, t, prophet, 0.25).filter((m) => !m.adult || m.faith > 45 || m === prophet);
    if (members.filter((m) => m.adult).length < 3) return;
    prophet.log(sim, `신은 '${X.GODS[newGod].name}'이라고 외치며 새 믿음을 세웠다`);
    if (G.Migrate.startTrek(sim, t, prophet, members, '교리가 갈라져')) {
      const k = sim.treks[sim.treks.length - 1];
      k.god = newGod;
      t.log(sim, `${josa(prophet.name, '이/가')} '${X.GODS[newGod].name}'을 외치며 따르는 이들과 떠났습니다`);
    }
  };
  // 이주 무리가 세운 새 부족은 떠나온 부족의 믿음을 이어받는다 (교리가 갈라졌으면 새 믿음)
  X.inherit = (sim, from, t, k) => {
    if (k && k.god) { t.god = k.god; t.belief = { [k.god]: 5 }; t.log(sim, `${josa(t.name, '은/는')} '${X.GODS[k.god].name}'을 섬깁니다`, false); return; }
    if (!from) return;
    t.faithFrom = from.faithFrom || from.id;
    if (from.god) { t.god = from.god; t.belief = { ...(from.belief || {}) }; }
  };
})();
