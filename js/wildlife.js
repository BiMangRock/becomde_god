// 야생 동물: 사슴(도망), 멧돼지(반격), 늑대(혼자 있는 사람을 노림). 사냥꾼이 잡는다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const T = G.T;
  const W = (G.Wild = {});

  W.KINDS = {
    deer: { name: '사슴', hp: 20, food: 5, speed: 0.045, cap: 45, color: '#a8743f' },
    boar: { name: '멧돼지', hp: 40, food: 7, speed: 0.035, cap: 18, color: '#5e4a3a' },
    wolf: { name: '늑대', hp: 35, food: 2, speed: 0.055, cap: 8, color: '#8a8f99' },
  };
  let NEXT = 1;

  const goodTile = (w, x, y) => { const t = w.typeAt(x, y); return t === T.GRASS || t === T.FOREST || t === T.HILL; };

  W.spawn = (sim, kind, x, y) => {
    const a = { id: NEXT++, kind, x, y, tx: x, ty: y, hp: W.KINDS[kind].hp, alive: true, dir: 1, walk: 0, cool: 0, target: null };
    sim.animals.push(a);
    return a;
  };

  W.init = (sim) => {
    const w = sim.world;
    const counts = { deer: 32, boar: 10, wolf: 5 };
    for (const k in counts) {
      let n = 0, guard = 0;
      while (n < counts[k] && guard++ < 3000) {
        const x = rand(2, w.w - 2), y = rand(2, w.h - 2);
        if (!goodTile(w, x, y)) continue;
        if (G.dist(x, y, sim.start.x, sim.start.y) < (k === 'wolf' ? 30 : 12)) continue;
        W.spawn(sim, k, x, y); n++;
      }
    }
  };

  W.tick = (sim) => {
    const w = sim.world;
    for (const a of sim.animals) {
      if (!a.alive) continue;
      const K = W.KINDS[a.kind];
      if (a.cool > 0) a.cool--;
      // 생각 (가끔)
      if ((sim.tick + a.id) % 15 === 0) {
        if (a.kind === 'deer' || (a.kind === 'boar' && a.hp > K.hp * 0.6)) {
          let threat = null;
          sim.near(a.x, a.y, a.kind === 'deer' ? 3.5 : 2, (h) => { if (!threat && h.age > 8) threat = h; });
          if (threat && a.kind === 'deer') {
            const ang = Math.atan2(a.y - threat.y, a.x - threat.x);
            a.tx = a.x + Math.cos(ang) * 6; a.ty = a.y + Math.sin(ang) * 6; a.flee = 40;
          }
        }
        if (a.kind === 'wolf' && !a.target) {
          // 마을에서 떨어져 혼자 있는 사람을 노린다
          sim.near(a.x, a.y, 7, (h) => {
            if (a.target || h.jail) return;
            if (sim.tribes.some((t) => t.alive && G.dist(t.cx, t.cy, h.x, h.y) < 10)) return;
            let others = 0;
            sim.near(h.x, h.y, 4, (o) => { if (o !== h) others++; });
            if (!others && chance(0.5)) a.target = h;
          });
        }
      }
      if (a.target) {
        const h = a.target;
        if (!h.alive || G.dist(h.x, h.y, a.x, a.y) > 12) { a.target = null; }
        else {
          a.tx = h.x; a.ty = h.y;
          if (G.dist(h.x, h.y, a.x, a.y) < 0.8 && a.cool <= 0) {
            a.cool = 30;
            h.health -= rand(6, 12);
            h.say('!', 40);
            if (!h.wolfLogged) { h.wolfLogged = true; h.log(sim, '늑대에게 습격당했다'); }
            // 반격하거나 도망
            if (h.adult && !h.has('겁많은')) { a.hp -= rand(4, 10) * (h.job === G.JOB.HUNTER || h.job === G.JOB.WARRIOR ? 2 : 1); }
            else if (h.tribe) h.goTo(sim, h.tribe.cx, h.tribe.cy, { kind: 'wander' });
            if (h.health <= 0) { sim.kill(h, '늑대'); a.target = null; }
            if (a.hp <= 0) { W.die(sim, a); h.log(sim, '덤벼든 늑대를 물리쳤다'); continue; }
            if (a.hp < 12) { a.target = null; a.tx = a.x + rand(-8, 8); a.ty = a.y + rand(-8, 8); }
          }
        }
      }
      // 이동
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 0.2) {
        if (chance(0.02)) { const nx = a.x + rand(-6, 6), ny = a.y + rand(-6, 6); if (goodTile(w, nx, ny)) { a.tx = nx; a.ty = ny; } }
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

  W.die = (sim, a) => { a.alive = false; };

  // 해마다 번식
  W.yearly = (sim) => {
    for (const k in W.KINDS) {
      const list = sim.animals.filter((a) => a.alive && a.kind === k);
      const cap = W.KINDS[k].cap;
      if (!list.length || list.length >= cap) continue;
      const n = Math.max(1, Math.floor(list.length * (k === 'wolf' ? 0.15 : 0.3)));
      for (let i = 0; i < n && list.length + i < cap; i++) {
        const p = pick(list);
        const x = p.x + rand(-2, 2), y = p.y + rand(-2, 2);
        if (goodTile(sim.world, x, y)) W.spawn(sim, k, x, y);
      }
    }
  };

  W.near = (sim, x, y, r, filter) => {
    let best = null, bd = r;
    for (const a of sim.animals) {
      if (!a.alive || (filter && !filter(a))) continue;
      const d = G.dist(a.x, a.y, x, y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  };

  // ---------------- 사냥 ----------------
  W.startHunt = (sim, h) => {
    const t = h.tribe;
    const cx = t ? t.cx : h.x, cy = t ? t.cy : h.y;
    // 마을 근처 늑대가 먼저
    const prey = W.near(sim, cx, cy, 12, (a) => a.kind === 'wolf') || W.near(sim, h.x, h.y, 24, (a) => a.kind !== 'wolf' && G.dist(a.x, a.y, cx, cy) < 26);
    if (!prey) return false;
    return h.goTo(sim, prey.x, prey.y, { kind: 'hunt', aid: prey.id, tries: 0 });
  };

  W.onArriveHunt = (sim, h, task) => {
    const a = sim.animals.find((x) => x.id === task.aid && x.alive);
    if (!a) return;
    if (G.dist(a.x, a.y, h.x, h.y) > 1.5) {
      task.tries++;
      if (task.tries < 5 && G.dist(a.x, a.y, h.x, h.y) < 15) h.goTo(sim, a.x, a.y, task);
      return;
    }
    // 공격
    const bonus = h.tribe ? h.tribe.toolBonus() : 0;
    a.hp -= rand(10, 18) * (1 + bonus) * (h.has('용감한') ? 1.2 : 1);
    h.say('➶', 40);
    if (a.kind === 'deer') { a.flee = 30; a.tx = a.x + rand(-5, 5); a.ty = a.y + rand(-5, 5); }
    if (a.kind === 'boar' || a.kind === 'wolf') {
      h.health -= rand(3, 9);
      if (h.health <= 0) { sim.kill(h, `${W.KINDS[a.kind].name} 사냥 중 사고`); return; }
    }
    if (a.hp <= 0) {
      W.die(sim, a);
      const K = W.KINDS[a.kind];
      h.carry = 'food'; h.carryAmt = K.food;
      h.hunts = (h.hunts || 0) + 1;
      if (a.kind !== 'deer' || h.hunts === 1 || h.hunts % 10 === 0) h.log(sim, `${josa(K.name, '을/를')} 사냥했다${h.hunts > 1 ? ` (${h.hunts}번째 사냥)` : ''}`);
      sim.stats.hunts = (sim.stats.hunts || 0) + 1;
    } else {
      task.tries++;
      if (task.tries < 6) h.goTo(sim, a.x, a.y, task);
    }
  };
})();
