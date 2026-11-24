// 불: 번개·운석으로 붙고, 숲과 풀을 타고 번지며, 사람들이 물을 떠 와서 끈다
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const T = G.T;
  const F = (G.Fire = {});
  const MAX_FIRES = 160;

  F.init = (sim) => {
    const n = sim.world.w * sim.world.h;
    sim.world.fire = new Float32Array(n);   // 불의 세기 0~1
    sim.world.burnt = new Uint8Array(n);    // 그을음 (점점 옅어짐)
    sim.fires = new Set();
  };

  const fuelOf = (w, i) => {
    const t = w.type[i];
    if (t === T.FOREST) return w.wood[i] + w.food[i];
    if (t === T.GRASS) return w.food[i] * 0.8 + (w.farm[i] ? 2 : 0);
    if (t === T.HILL) return 0.4;
    return 0;
  };

  F.ignite = (sim, x, y, why) => {
    const w = sim.world;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!w.inb(tx, ty)) return false;
    const i = w.idx(tx, ty);
    if (w.fire[i] > 0 || sim.fires.size >= MAX_FIRES) return false;
    const houseHere = F.houseAt(sim, tx, ty);
    if (fuelOf(w, i) < 0.5 && !houseHere) return false;
    w.fire[i] = 0.3;
    sim.fires.add(i);
    if (why) {
      const t = sim.tribes.find((t) => t.alive && G.dist(t.cx, t.cy, x, y) < 16);
      if (t && sim.year - (t.lastFireAlarm || -99) > 0.5) { t.lastFireAlarm = sim.year; t.log(sim, `${why} ${t.name} 근처에 불이 났습니다!`); }
      else if (!t && sim.year - (sim.lastWildfire || -99) > 1) { sim.lastWildfire = sim.year; sim.event(`${why} 들불이 일어났습니다`, '#ff8a3d', x, y); }
    }
    return true;
  };

  F.houseAt = (sim, tx, ty) => {
    for (const t of sim.tribes) {
      if (!t.alive) continue;
      for (const h of t.houses) if (Math.floor(h.x) === tx && Math.floor(h.y) === ty) return { t, h };
    }
    return null;
  };

  // 10틱마다
  F.tick = (sim) => {
    const w = sim.world;
    if (!sim.fires.size) return;
    const dry = sim.drought ? 1.8 : 1;
    const newFires = [];
    for (const i of [...sim.fires]) {
      const x = i % w.w, y = (i / w.w) | 0;
      w.fire[i] = Math.min(1, w.fire[i] + 0.12);
      // 연료가 탄다
      const t = w.type[i];
      if (t === T.FOREST) { w.wood[i] = Math.max(0, w.wood[i] - 0.65); w.food[i] = Math.max(0, w.food[i] - 0.15); }
      else { w.food[i] = Math.max(0, w.food[i] - 0.35); if (w.farm[i] && chance(0.15)) w.farm[i] = 0; }
      // 집이 탄다
      const hs = F.houseAt(sim, x, y);
      if (hs && w.fire[i] > 0.6 && chance(0.25)) {
        hs.t.houses = hs.t.houses.filter((q) => q !== hs.h);
        hs.t.stock.food = Math.max(0, hs.t.stock.food - 3);
        hs.t.log(sim, `${hs.t.name}의 집 한 채가 불타 버렸습니다`, false);
      }
      if (hs && hs.t.jail && G.dist(hs.t.jail.x, hs.t.jail.y, x + 0.5, y + 0.5) < 1 && w.fire[i] > 0.7) G.Crime.jailDestroyed(sim, hs.t);
      // 번진다
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (!w.inb(nx, ny)) continue;
        const j = w.idx(nx, ny);
        if (w.fire[j] > 0) continue;
        const nt = w.type[j];
        let p = nt === T.FOREST ? 0.055 : nt === T.GRASS ? 0.022 : nt === T.HILL ? 0.006 : 0;
        if (sim.fires.size > 80) p *= 0.5;
        if (F.houseAt(sim, nx, ny)) p = Math.max(p, 0.04);
        if (w.fert[j] > 1.6) p *= 0.3; // 비가 내린 땅은 잘 안 탄다
        p *= w.fire[i] * dry * (dx && dy ? 0.6 : 1);
        if (p > 0 && chance(p) && fuelOf(w, j) >= 0.5) newFires.push(j);
      }
      // 연료가 다 타면 꺼진다
      if (fuelOf(w, i) < 0.3 || chance(0.01)) F.out(sim, i, true);
    }
    for (const j of newFires) if (sim.fires.size < MAX_FIRES && !sim.fires.has(j)) { w.fire[j] = 0.25; sim.fires.add(j); }
    // 불 위에 있는 사람과 동물
    for (const i of sim.fires) {
      const x = (i % w.w) + 0.5, y = ((i / w.w) | 0) + 0.5;
      if (w.fire[i] < 0.3) continue;
      sim.near(x, y, 0.7, (h) => {
        h.health -= 3 * w.fire[i];
        h.say('!', 30);
        if (h.health <= 0) { sim.kill(h, '화재'); return; }
        if (h.state !== 'jailed' && !(h.task && (h.task.kind === 'douse' || h.task.kind === 'fetch'))) {
          const a = Math.random() * Math.PI * 2;
          h.goTo(sim, h.x + Math.cos(a) * 5, h.y + Math.sin(a) * 5, { kind: 'wander' });
        }
      });
      for (const a of sim.animals) {
        if (!a.alive || Math.abs(a.x - x) > 0.9 || Math.abs(a.y - y) > 0.9) continue;
        a.hp -= 8; a.flee = 40; a.tx = a.x + rand(-6, 6); a.ty = a.y + rand(-6, 6);
        if (a.hp <= 0) a.alive = false;
      }
    }
    // 그을음과 화재 경보
    for (const t of sim.tribes) if (t.alive) t.fireAlarm = false;
    for (const i of sim.fires) {
      const x = (i % w.w) + 0.5, y = ((i / w.w) | 0) + 0.5;
      for (const t of sim.tribes) if (t.alive && !t.fireAlarm && G.dist(t.cx, t.cy, x, y) < 20) t.fireAlarm = true;
    }
    if (!sim.fires.size && sim.burning) {
      sim.burning = false;
      sim.event(`불길이 모두 잡혔습니다${sim.dousedCount ? ` (사람들이 ${sim.dousedCount}곳의 불을 껐습니다)` : ''}`, '#7fc8f8');
      sim.dousedCount = 0;
    } else if (sim.fires.size) sim.burning = true;
    w.dirty = true;
  };

  F.out = (sim, i, burntOut) => {
    const w = sim.world;
    w.fire[i] = 0;
    sim.fires.delete(i);
    w.burnt[i] = burntOut ? 255 : 120;
    if (burntOut && w.type[i] === T.FOREST && w.wood[i] < 1) { w.type[i] = T.GRASS; w.wood[i] = 0; w.food[i] = 0; w.fert[i] = 1.3; }
  };

  // 그을음은 천천히 사라지고, 탄 땅은 기름져진다
  F.regrow = (sim) => {
    const w = sim.world, n = w.w * w.h;
    for (let i = 0; i < n; i++) if (w.burnt[i]) w.burnt[i] = Math.max(0, w.burnt[i] - 1);
  };

  // 비가 오면 꺼진다
  F.rain = (sim, x, y, r) => {
    const w = sim.world;
    let n = 0;
    for (const i of [...sim.fires]) {
      const fx = (i % w.w) + 0.5, fy = ((i / w.w) | 0) + 0.5;
      if (G.dist(fx, fy, x, y) <= r + 0.5) { F.out(sim, i, false); n++; }
    }
    if (n) sim.event(`신이 내린 비가 불길 ${n}곳을 잠재웠습니다`, '#7fc8f8', x, y);
  };

  // ---------------- 불 끄기 ----------------
  F.nearestFire = (sim, x, y, r) => {
    const w = sim.world;
    let best = null, bd = r;
    for (const i of sim.fires) {
      const fx = (i % w.w) + 0.5, fy = ((i / w.w) | 0) + 0.5;
      const d = G.dist(fx, fy, x, y);
      if (d < bd) { bd = d; best = { i, x: fx, y: fy }; }
    }
    return best;
  };

  // 사람의 판단: 마을 근처에 불이 나면 물을 떠서 끈다
  F.decide = (sim, h) => {
    const t = h.tribe;
    if (!t || !t.fireAlarm || !h.adult || h.jail || h.sick) return false;
    if (h.carry === 'water') {
      const f = F.nearestFire(sim, h.x, h.y, 25);
      if (!f) return false;
      const a = Math.atan2(h.y - f.y, h.x - f.x);
      return h.goTo(sim, f.x + Math.cos(a) * 1.1, f.y + Math.sin(a) * 1.1, { kind: 'douse', tile: f.i });
    }
    // 겁 많고 신중한 사람은 덜 나서고, 충동적이고 친화적인 사람은 먼저 뛰어든다
    let p = 0.65 + (h.p.impulse - 50) / 200 + (h.p.agree - 50) / 250;
    if (h.has('겁많은')) p *= 0.4;
    if (h.has('용감한')) p *= 1.4;
    if (!chance(clamp(p, 0.1, 0.95))) return false;
    if (h.carry === 'water') {
      const f = F.nearestFire(sim, h.x, h.y, 25);
      if (!f) { h.carry = null; h.carryAmt = 0; return false; }
      const a = Math.atan2(h.y - f.y, h.x - f.x);
      return h.goTo(sim, f.x + Math.cos(a) * 1.1, f.y + Math.sin(a) * 1.1, { kind: 'douse', tile: f.i });
    }
    const f = F.nearestFire(sim, h.x, h.y, 28);
    if (!f) return false;
    // 불 가까운 물가에서 물을 뜬다. 물이 멀면 흙을 덮어 끈다
    const wsrc = sim.world.findWater(f.x, f.y, 12);
    h.carry = null; h.carryAmt = 0;
    if (wsrc) return h.goTo(sim, wsrc.x + 0.5, wsrc.y + 0.5, { kind: 'fetch' });
    const a = Math.atan2(h.y - f.y, h.x - f.x);
    return h.goTo(sim, f.x + Math.cos(a) * 1.1, f.y + Math.sin(a) * 1.1, { kind: 'douse', tile: f.i, dirt: true });
  };

  F.onFetch = (sim, h) => { h.carry = 'water'; h.carryAmt = 1; h.say('~', 40); };

  F.onDouse = (sim, h, task) => {
    const w = sim.world;
    let i = task.tile;
    if (!(w.fire[i] > 0)) { const f = F.nearestFire(sim, h.x, h.y, 3); if (!f) { h.carry = null; h.carryAmt = 0; return; } i = f.i; }
    const fx = (i % w.w) + 0.5, fy = ((i / w.w) | 0) + 0.5;
    w.fire[i] -= (task.dirt ? 0.6 : 1) + (h.body - 50) / 300;
    // 물이 튀어 옆 불도 약해진다
    const ix = i % w.w, iy = (i / w.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!w.inb(ix + dx, iy + dy)) continue;
      const j = w.idx(ix + dx, iy + dy);
      if (w.fire[j] > 0) { w.fire[j] -= 0.35; if (w.fire[j] <= 0) { F.out(sim, j, false); sim.dousedCount = (sim.dousedCount || 0) + 1; } }
    }
    sim.effects.push({ kind: 'steam', x: fx, y: fy, age: 0, ttl: 40 });
    h.carry = null; h.carryAmt = 0;
    h.say('~', 40);
    if (w.fire[i] <= 0) {
      F.out(sim, i, false);
      sim.dousedCount = (sim.dousedCount || 0) + 1;
      h.doused = (h.doused || 0) + 1;
      if (h.doused === 1 || h.doused % 10 === 0) h.log(sim, `물을 길어 와 불을 껐다${h.doused > 1 ? ` (${h.doused}번째)` : ''}`);
      sim.near(h.x, h.y, 8, (o) => { if (o !== h) { G.Mind.adj(sim, o, h, { respect: 3, trust: 2 }); } });
      G.Social.addMood(sim, h, 'hero');
    }
  };
})();
