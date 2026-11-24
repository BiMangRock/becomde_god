// 동물: 야생 동물, 맹수, 가축(길들이기·우리·번식·생산), 사냥, 경비원
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const T = G.T;
  const W = (G.Wild = {});

  // tame: 길들이면 부르는 이름 · predator: lone(혼자 있는 사람) / bold(마을 근처까지) · territorial: 가까이 오면 공격
  W.KINDS = {
    deer: { name: '사슴', hp: 20, food: 5, speed: 0.045, cap: 40, color: '#a8743f', flee: 3.5, size: 1.1, legs: 5 },
    rabbit: { name: '토끼', hp: 6, food: 2, speed: 0.06, cap: 30, color: '#d8cfc2', flee: 3, size: 0.55, legs: 1.6 },
    boar: { name: '멧돼지', tame: '돼지', hp: 40, food: 7, speed: 0.035, cap: 16, color: '#5e4a3a', fight: true, size: 1, legs: 3.2 },
    sheep: { name: '산양', tame: '양', hp: 18, food: 5, speed: 0.035, cap: 20, color: '#ecebe4', flee: 2.5, size: 0.95, legs: 3 },
    cattle: { name: '들소', tame: '소', hp: 45, food: 10, speed: 0.035, cap: 14, color: '#6b4a33', fight: true, size: 1.3, legs: 4 },
    fowl: { name: '들닭', tame: '닭', hp: 5, food: 2, speed: 0.04, cap: 20, color: '#c9773a', flee: 2, size: 0.5, legs: 1.4 },
    wolf: { name: '늑대', tame: '개', hp: 35, food: 2, speed: 0.055, cap: 8, color: '#8a8f99', predator: 'lone', fight: true, size: 1, legs: 3.4, dmg: [6, 12] },
    tiger: { name: '호랑이', hp: 80, food: 6, speed: 0.058, cap: 2, color: '#e08a2e', predator: 'bold', fight: true, size: 1.4, legs: 4, dmg: [12, 20] },
    bear: { name: '곰', hp: 90, food: 10, speed: 0.04, cap: 4, color: '#4e3627', territorial: true, fight: true, size: 1.5, legs: 3.6, dmg: [12, 22] },
  };
  W.TAMEABLE = ['boar', 'sheep', 'cattle', 'fowl', 'wolf'];
  W.isBeast = (a) => !a.tame && (W.KINDS[a.kind].predator || W.KINDS[a.kind].territorial);
  W.label = (a) => (a.tame ? (a.pet ? `${W.KINDS[a.kind].tame} ${a.pet}` : W.KINDS[a.kind].tame) : W.KINDS[a.kind].name);
  let NEXT = 1;
  const DOG_NAMES = ['바둑이', '누렁이', '백구', '흰둥이', '검둥이', '복실이', '점박이', '초롱이', '똘이', '해피'];

  const goodTile = (w, x, y) => { const t = w.typeAt(x, y); return t === T.GRASS || t === T.FOREST || t === T.HILL; };

  W.spawn = (sim, kind, x, y, tame) => {
    const a = { id: NEXT++, kind, x, y, tx: x, ty: y, hp: W.KINDS[kind].hp, alive: true, dir: 1, walk: 0, cool: 0, target: null, tame: tame || 0, age: 0 };
    sim.animals.push(a);
    return a;
  };

  W.areaScale = (sim) => (sim.world.w * sim.world.h) / (160 * 120);

  W.init = (sim, mult = 1) => {
    const w = sim.world;
    const sc = W.areaScale(sim) * mult;
    const base = { deer: 26, rabbit: 18, boar: 8, sheep: 10, cattle: 7, fowl: 10, wolf: 4, tiger: 1.2, bear: 2 };
    for (const k in base) {
      let n = 0, guard = 0;
      const want = Math.max(1, Math.round(base[k] * sc));
      while (n < want && guard++ < 5000) {
        const x = rand(2, w.w - 2), y = rand(2, w.h - 2);
        if (!goodTile(w, x, y)) continue;
        const K = W.KINDS[k];
        const minD = K.predator === 'bold' || K.territorial ? 35 : K.predator ? 28 : 12;
        if (G.dist(x, y, sim.start.x, sim.start.y) < minD) continue;
        if ((k === 'tiger' || k === 'bear') && w.typeAt(x, y) === T.GRASS && chance(0.7)) continue;
        W.spawn(sim, k, x, y); n++;
      }
    }
  };

  const villageNear = (sim, x, y, r) => sim.tribes.find((t) => t.alive && G.dist(t.cx, t.cy, x, y) < r);

  W.tick = (sim) => {
    const w = sim.world;
    for (const a of sim.animals) {
      if (!a.alive) continue;
      const K = W.KINDS[a.kind];
      if (a.cool > 0) a.cool--;
      if (a.burn > 0) a.burn--;
      if ((sim.tick + a.id) % 15 === 0) W.think(sim, a, K);
      if (a.target) W.chase(sim, a, K);
      if (!a.alive) continue;
      // 이동
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 0.2) {
        if (chance(0.02)) {
          const home = a.tame ? W.homeOf(sim, a) : null;
          const cx = home ? home.x : a.x, cy = home ? home.y : a.y, r = home ? (a.kind === 'wolf' ? 6 : 2.2) : 6;
          const nx = cx + rand(-r, r), ny = cy + rand(-r, r);
          if (w.walkable(nx, ny) && (home || goodTile(w, nx, ny))) { a.tx = nx; a.ty = ny; }
        }
        a.moving = false;
        continue;
      }
      let sp = K.speed * (a.flee > 0 ? 1.8 : a.target ? 1.4 : 0.5);
      if (a.flee > 0) a.flee--;
      sp = Math.min(sp, d);
      const nx = a.x + dx / d * sp, ny = a.y + dy / d * sp;
      if (w.walkable(nx, ny)) { a.x = nx; a.y = ny; a.walk += sp * 4; a.moving = true; if (Math.abs(dx) > 0.05) a.dir = dx > 0 ? 1 : -1; }
      else { a.tx = a.x + rand(-4, 4); a.ty = a.y + rand(-4, 4); }
    }
    if (sim.tick % 120 === 0) sim.animals = sim.animals.filter((a) => a.alive);
  };

  W.homeOf = (sim, a) => {
    const t = sim.tribeById(a.tame);
    if (!t) { a.tame = 0; a.pet = null; return null; }
    if (a.kind === 'wolf') return { x: t.cx, y: t.cy };
    return t.pen || { x: t.cx, y: t.cy };
  };

  W.think = (sim, a, K) => {
    // 가축: 우리로 돌아가기, 개는 맹수를 쫓는다
    if (a.tame) {
      const home = W.homeOf(sim, a);
      if (!home) return;
      if (a.kind === 'wolf' && !a.target) {
        const beast = W.near(sim, a.x, a.y, 8, (b) => W.isBeast(b) && b.id !== a.id);
        if (beast) a.target = { animal: beast };
      }
      if (!a.target && G.dist(a.x, a.y, home.x, home.y) > (a.kind === 'wolf' ? 8 : 4)) { a.tx = home.x + rand(-1.5, 1.5); a.ty = home.y + rand(-1.5, 1.5); }
      return;
    }
    // 겁 많은 동물은 사람을 피한다
    if (K.flee || (a.kind === 'boar' && a.hp > K.hp * 0.6) || a.kind === 'cattle') {
      let threat = null;
      sim.near(a.x, a.y, K.flee || 2, (h) => { if (!threat && h.age > 8) threat = h; });
      if (threat && (K.flee || chance(0.3))) {
        const ang = Math.atan2(a.y - threat.y, a.x - threat.x);
        a.tx = a.x + Math.cos(ang) * 6; a.ty = a.y + Math.sin(ang) * 6; a.flee = 40;
      }
    }
    // 곰: 가까이 오는 사람을 공격
    if (K.territorial && !a.target && a.cool <= 0) {
      sim.near(a.x, a.y, 2, (h) => { if (!a.target && !h.jail && chance(0.5 * Math.min(1, sim.dt * 4))) { a.target = { human: h }; } });
    }
    // 맹수: 사냥감 고르기
    // 맹수는 피 냄새를 맡고 모여든다
    if (K.predator && !a.target && sim.blood && sim.blood.length && chance(0.3)) {
      const b = sim.blood.find((b) => G.Blood.ageDays(sim, b) < 8 && G.dist(b.x, b.y, a.x, a.y) < 15);
      if (b) { a.tx = b.x + rand(-1, 1); a.ty = b.y + rand(-1, 1); }
    }
    if (K.predator && !a.target && a.hp > K.hp * 0.4) {
      const r = K.predator === 'bold' ? 9 : 7;
      const core = K.predator === 'bold' ? 8 : 10;
      sim.near(a.x, a.y, r, (h) => {
        if (a.target || h.jail) return;
        if (villageNear(sim, h.x, h.y, core)) return;
        let others = 0;
        sim.near(h.x, h.y, 4, (o) => { if (o !== h) others++; });
        let p = K.predator === 'lone' ? (others ? 0 : 0.3) : (h.age < 14 ? 0.4 : others >= 2 ? 0.08 : 0.25);
        if (sim.isNight()) p *= 1.8;          // 맹수는 밤에 사냥한다
        if (h.state === 'sleep') p *= 1.5;
        if (chance(p * sim.dt)) a.target = { human: h };
      });
      if (!a.target) {
        const prey = W.near(sim, a.x, a.y, 10, (b) => b.tame && b.kind !== 'wolf');
        if (prey && chance(0.4 * sim.dt)) a.target = { animal: prey };
      }
      if (a.target && a.target.human && K.predator === 'bold' && !a.roared) {
        a.roared = true;
        a.target.human.say('!', 90);
      }
    }
  };

  W.chase = (sim, a, K) => {
    const tg = a.target;
    const victim = tg.human || tg.animal;
    if (!victim || !victim.alive || G.dist(victim.x, victim.y, a.x, a.y) > 14) { a.target = null; a.roared = false; return; }
    a.tx = victim.x; a.ty = victim.y;
    if (G.dist(victim.x, victim.y, a.x, a.y) > 0.9 || a.cool > 0) return;
    a.cool = 30;
    if (tg.animal) {
      // 동물끼리 싸움 (맹수 vs 가축, 개 vs 맹수)
      const b = tg.animal;
      b.hp -= rand(8, 16) * (a.kind === 'tiger' ? 1.6 : 1);
      G.Blood.add(sim, b.x, b.y, 0.6, 'animal');
      sim.effects.push({ kind: 'claw', x: b.x, y: b.y, age: 0, ttl: 20 });
      if (W.KINDS[b.kind].fight && b.alive && chance(0.6)) a.hp -= rand(5, 12);
      if (b.hp <= 0) {
        b.alive = false;
        a.target = null;
        if (b.tame) {
          const t = sim.tribeById(b.tame);
          if (t && sim.year - (t.lastLivestockLoss || -99) > 1) { t.lastLivestockLoss = sim.year; t.log(sim, `${W.KINDS[a.kind].name}이(가) ${t.name}의 ${W.label(b)}을(를) 물어 갔습니다`, false); }
        } else if (a.tame) {
          const t = sim.tribeById(a.tame);
          if (t) t.log(sim, `${W.label(a)}이(가) 마을에 다가온 ${W.KINDS[b.kind].name}을(를) 쫓아냈습니다`, false);
        }
      }
      if (a.hp <= 0) a.alive = false;
      return;
    }
    const h = tg.human;
    const [d0, d1] = K.dmg || [6, 12];
    h.health -= rand(d0, d1);
    G.Blood.splash(sim, h.x, h.y, 2, 0.6, 'drops');
    h.say('!', 40);
    if (h.tribe) h.tribe.beastHeat = (h.tribe.beastHeat || 0) + 1;
    sim.effects.push({ kind: 'claw', x: h.x, y: h.y, age: 0, ttl: 20 });
    if (!h.beastLogged || sim.year - h.beastLogged > 3) { h.beastLogged = sim.year; h.log(sim, `${K.name}에게 습격당했다`); }
    // 목격자의 공포
    sim.near(h.x, h.y, 7, (o) => { if (o !== h) { G.Social.addMood(sim, o, 'fear'); o.say('!', 50); } });
    // 반격 또는 도망
    const fighter = h.job === G.JOB.HUNTER || h.job === G.JOB.WARRIOR || h.job === G.JOB.WATCH || h.job === G.JOB.GUARD;
    if (h.adult && (fighter || !h.has('겁많은'))) a.hp -= rand(4, 10) * (fighter ? 2.2 : 1);
    else if (h.tribe) h.goTo(sim, h.tribe.cx, h.tribe.cy, { kind: 'wander' });
    if (h.health <= 0) {
      sim.kill(h, K.name);
      a.target = null;
      sim.near(h.x, h.y, 8, (o) => G.Mind.trauma(sim, o, 0.12, `${K.name}의 습격을 보고`));
      if (K.predator === 'bold') sim.event(`${josa(K.name, '이/가')} ${josa(h.name, '을/를')} 덮쳤습니다`, '#ff8a50', h.x, h.y);
    }
    if (a.hp <= 0) { a.alive = false; h.log(sim, `덤벼든 ${josa(K.name, '을/를')} 물리쳤다`); return; }
    if (a.hp < K.hp * 0.35 || (K.territorial && chance(0.5))) { a.target = null; a.roared = false; a.tx = a.x + rand(-8, 8); a.ty = a.y + rand(-8, 8); a.flee = 40; }
  };

  W.die = (sim, a) => { a.alive = false; };

  // ---------------- 해마다: 번식, 가축 생산과 도축 ----------------
  W.yearly = (sim) => {
    const sc = W.areaScale(sim);
    for (const k in W.KINDS) {
      const list = sim.animals.filter((a) => a.alive && a.kind === k && !a.tame);
      const cap = Math.max(2, Math.round(W.KINDS[k].cap * sc));
      if (list.length < 2 || list.length >= cap) continue;
      const rate = k === 'tiger' || k === 'bear' ? 0.1 : k === 'wolf' ? 0.15 : 0.3;
      const n = Math.max(1, Math.floor(list.length * rate));
      for (let i = 0; i < n && list.length + i < cap; i++) {
        const p = pick(list);
        const x = p.x + rand(-2, 2), y = p.y + rand(-2, 2);
        if (goodTile(sim.world, x, y)) W.spawn(sim, k, x, y);
      }
    }
    for (const t of sim.tribes) {
      if (!t.alive) continue;
      const herd = sim.animals.filter((a) => a.alive && a.tame === t.id);
      if (!herd.length) continue;
      const cap = Math.max(4, Math.round(t.members.length * 0.8));
      const byKind = {};
      for (const a of herd) (byKind[a.kind] = byKind[a.kind] || []).push(a);
      // 번식
      let born = 0;
      for (const k in byKind) {
        if (byKind[k].length >= 2 && herd.length + born < cap && chance(0.6)) {
          const p = byKind[k][0];
          const b = W.spawn(sim, k, p.x + rand(-0.5, 0.5), p.y + rand(-0.5, 0.5), t.id);
          if (k === 'wolf') b.pet = pick(DOG_NAMES);
          born++;
        }
      }
      // 기본 생산 (목동이 없어도 조금은)
      W.produce(sim, t, 0.5);
      // 식량이 모자라면 도축
      const meat = herd.filter((a) => a.kind !== 'wolf');
      if (t.stock.food < t.members.length && meat.length > 3) {
        const v = pick(meat);
        v.alive = false;
        t.stock.food += Math.round(W.KINDS[v.kind].food * 1.5);
        t.log(sim, `굶주림을 피하려 ${josa(W.label(v), '을/를')} 잡았습니다`, false);
      }
    }
  };

  // 젖, 달걀, 양털
  W.produce = (sim, t, mult) => {
    let food = 0, gold = 0;
    for (const a of sim.animals) {
      if (!a.alive || a.tame !== t.id) continue;
      if (a.kind === 'cattle') food += 1.2;
      else if (a.kind === 'sheep') { food += 0.5; gold += 2; }
      else if (a.kind === 'fowl') food += 0.8;
      else if (a.kind === 'boar') food += 0.3;
    }
    t.stock.food += Math.floor(food * mult);
    t.treasury += Math.floor(gold * mult);
    return food;
  };

  W.livestock = (sim, t) => sim.animals.filter((a) => a.alive && a.tame === t.id);

  W.near = (sim, x, y, r, filter) => {
    let best = null, bd = r;
    for (const a of sim.animals) {
      if (!a.alive || (filter && !filter(a))) continue;
      const d = G.dist(a.x, a.y, x, y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  };

  // ---------------- 사냥 (사냥꾼) / 맹수 퇴치 (경비원) ----------------
  W.startHunt = (sim, h, beastsOnly) => {
    const t = h.tribe;
    const cx = t ? t.cx : h.x, cy = t ? t.cy : h.y;
    const beast = W.near(sim, cx, cy, beastsOnly ? 22 : 12, W.isBeast)
      || (t && t.pen ? W.near(sim, t.pen.x, t.pen.y, 16, W.isBeast) : null);
    const prey = beast || (beastsOnly ? null : W.near(sim, h.x, h.y, 24, (a) => !a.tame && !W.isBeast(a) && G.dist(a.x, a.y, cx, cy) < 26));
    if (!prey) return false;
    return h.goTo(sim, prey.x, prey.y, { kind: 'hunt', aid: prey.id, tries: 0 });
  };

  W.onArriveHunt = (sim, h, task) => {
    const a = sim.animals.find((x) => x.id === task.aid && x.alive);
    if (!a || a.tame) return;
    if (G.dist(a.x, a.y, h.x, h.y) > 1.5) {
      task.tries++;
      if (task.tries < 5 && G.dist(a.x, a.y, h.x, h.y) < 15) h.goTo(sim, a.x, a.y, task);
      return;
    }
    const K = W.KINDS[a.kind];
    const bonus = h.tribe ? h.tribe.toolBonus() : 0;
    const pro = h.job === G.JOB.WATCH || h.job === G.JOB.HUNTER ? 1.4 : 1;
    a.hp -= rand(10, 18) * (1 + bonus) * (h.has('용감한') ? 1.2 : 1) * pro;
    h.say('➶', 40);
    sim.effects.push({ kind: 'claw', x: a.x, y: a.y, age: 0, ttl: 15 });
    if (K.flee) { a.flee = 30; a.tx = a.x + rand(-5, 5); a.ty = a.y + rand(-5, 5); }
    if (K.fight) {
      const [d0, d1] = K.dmg || [3, 9];
      h.health -= rand(d0 * 0.6, d1 * 0.6);
      if (h.health <= 0) { sim.kill(h, `${K.name} 사냥 중 사고`); return; }
      if (K.predator || K.territorial) a.target = { human: h };
    }
    if (a.hp <= 0) {
      a.alive = false;
      G.Blood.splash(sim, a.x, a.y, 2, 0.7, 'animal');
      h.carry = 'food'; h.carryAmt = K.food;
      h.hunts = (h.hunts || 0) + 1;
      sim.stats.hunts = (sim.stats.hunts || 0) + 1;
      if (!W.isBeast(a)) G.Crime2.poach(sim, h, a);
      if (a.kind === 'tiger' || a.kind === 'bear') {
        h.log(sim, `${josa(K.name, '을/를')} 쓰러뜨렸다`);
        sim.event(`${josa(h.name, '이/가')} ${josa(K.name, '을/를')} 쓰러뜨렸습니다`, '#f5d76e', a.x, a.y);
        sim.near(h.x, h.y, 10, (o) => { if (o !== h) { G.Mind.adj(sim, o, h, { respect: 25 }); G.Social.bump(sim, o, h, 8); } });
      } else if (h.hunts === 1 || h.hunts % 10 === 0 || K.predator) h.log(sim, `${josa(K.name, '을/를')} 사냥했다${h.hunts > 1 ? ` (${h.hunts}번째 사냥)` : ''}`);
    } else {
      task.tries++;
      if (task.tries < 6) h.goTo(sim, a.x, a.y, task);
    }
  };

  // ---------------- 목동: 길들이기와 돌보기 ----------------
  W.startTame = (sim, h) => {
    const t = h.tribe;
    if (!t) return false;
    const herd = W.livestock(sim, t).length;
    if (herd >= Math.max(4, Math.round(t.members.length * 0.8))) return false;
    const brave = h.has('용감한') || (h.teto || 0) > 40;
    const a = W.near(sim, t.cx, t.cy, 22, (x) => !x.tame && W.TAMEABLE.includes(x.kind) && (x.kind !== 'wolf' || brave));
    if (!a) return false;
    return h.goTo(sim, a.x, a.y, { kind: 'tame', aid: a.id, tries: 0 });
  };

  W.onArriveTame = (sim, h, task) => {
    const a = sim.animals.find((x) => x.id === task.aid && x.alive);
    const t = h.tribe;
    if (!a || a.tame || !t) return;
    if (G.dist(a.x, a.y, h.x, h.y) > 1.6) {
      task.tries++;
      if (task.tries < 4) h.goTo(sim, a.x, a.y, task);
      return;
    }
    let p = 0.3;
    if (h.has('다정한')) p *= 1.5;
    if ((h.teto || 0) < -30) p *= 1.2;
    if (a.kind === 'wolf') p *= 0.35;
    if (a.kind === 'cattle' || a.kind === 'boar') p *= 0.8;
    if (!chance(p)) {
      a.flee = 40; a.tx = a.x + rand(-6, 6); a.ty = a.y + rand(-6, 6);
      if (a.kind === 'wolf' || (a.kind === 'boar' && chance(0.3))) { h.health -= rand(4, 10); h.say('!', 40); }
      task.tries++;
      if (task.tries < 3) h.goTo(sim, a.x, a.y, task);
      return;
    }
    t.ensurePen(sim);
    a.tame = t.id; a.flee = 0; a.target = null;
    a.tx = t.pen.x; a.ty = t.pen.y;
    if (a.kind === 'wolf') { a.pet = pick(DOG_NAMES); a.tx = t.cx; a.ty = t.cy; }
    h.tamed = (h.tamed || 0) + 1;
    h.say('♥', 80);
    G.Social.addMood(sim, h, 'tamed');
    const label = W.label(a);
    if (h.tamed === 1 || a.kind === 'wolf') h.log(sim, `${josa(W.KINDS[a.kind].name, '을/를')} 길들여 ${a.kind === 'wolf' ? `개 '${a.pet}'로` : W.KINDS[a.kind].tame + '로'} 삼았다`);
    t.firstTame = t.firstTame || {};
    if (!t.firstTame[a.kind]) { t.firstTame[a.kind] = true; t.log(sim, `${josa(t.name, '이/가')} 처음으로 ${josa(W.KINDS[a.kind].tame, '을/를')} 기르기 시작했습니다`); }
    sim.stats.tamed = (sim.stats.tamed || 0) + 1;
    return label;
  };

  W.startTend = (sim, h) => {
    const t = h.tribe;
    if (!t || !t.pen || !W.livestock(sim, t).length) return false;
    return h.goTo(sim, t.pen.x + rand(-1, 1), t.pen.y + rand(-1, 1), { kind: 'tend' });
  };
  W.finishTend = (sim, h) => {
    const t = h.tribe;
    if (!t) return;
    const f = W.produce(sim, t, 0.25);
    if (f > 0 && sim.year - (h.lastTendLog || -99) > 4) { h.lastTendLog = sim.year; h.log(sim, '가축을 돌보며 젖과 달걀을 거두었다'); }
  };

  // ---------------- 경비원: 맹수로부터 마을과 가축을 지킨다 ----------------
  W.watchDecide = (sim, h) => {
    if (W.startHunt(sim, h, true)) { h.say('!', 50); return true; }
    const t = h.tribe;
    const c = t.pen && chance(0.5) ? t.pen : { x: t.cx, y: t.cy };
    const a = Math.random() * Math.PI * 2, r = rand(5, 9);
    return h.goTo(sim, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, { kind: 'wander' });
  };
})();
