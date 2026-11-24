// 날씨(비·눈구름)와 피 흔적
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;

  // ---------------- 비구름 ----------------
  const Wt = (G.Weather = {});

  Wt.ensure = (sim) => {
    if (!sim.clouds) { sim.clouds = []; sim.wind = { x: rand(-1, 1), y: rand(-0.4, 0.4) }; }
  };

  // 매 틱: 구름이 바람 따라 움직인다 (화면에서 자연스럽게 보이도록 실제 시간 기준)
  Wt.tick = (sim) => {
    Wt.ensure(sim);
    const w = sim.world;
    for (const c of sim.clouds) {
      c.x += sim.wind.x * 0.025; c.y += sim.wind.y * 0.025;
      c.age += sim.dt;
    }
    sim.clouds = sim.clouds.filter((c) => c.age < c.life && c.x > -30 && c.y > -30 && c.x < w.w + 30 && c.y < w.h + 30);
  };

  // 하루에 몇 번: 구름 생기기, 비 효과
  Wt.lifeTick = (sim) => {
    Wt.ensure(sim);
    const w = sim.world;
    const area = (w.w * w.h) / 19200;
    let p = [0.35, 0.15, 0.3, 0.25][sim.season] * Math.sqrt(area);
    if (sim.drought) p *= 0.15;
    if (sim.clouds.length < 3 + area * 2 && chance(p)) {
      // 바람이 불어오는 쪽 가장자리에서 생긴다
      const fromX = sim.wind.x > 0 ? -8 : w.w + 8;
      const c = {
        x: chance(0.5) ? fromX : rand(0, w.w), y: rand(0, w.h),
        r: rand(5, 13), age: 0, life: G.CFG.BPD * rand(1.5, 5),
        rain: chance(0.75), seed: Math.random(),
      };
      if (c.x !== fromX) c.x = rand(0, w.w);
      sim.clouds.push(c);
    }
    if (chance(0.03)) sim.wind = { x: rand(-1, 1), y: rand(-0.5, 0.5) };
    const snow = sim.season === 3;
    for (const c of sim.clouds) {
      if (!c.rain) continue;
      // 불을 끄고, 피를 씻고, 땅을 적신다
      if (sim.fires.size) {
        for (const i of [...sim.fires]) {
          const fx = (i % w.w) + 0.5, fy = ((i / w.w) | 0) + 0.5;
          if (G.dist(fx, fy, c.x, c.y) <= c.r) G.Fire.out(sim, i, false);
        }
      }
      G.Blood.wash(sim, c.x, c.y, c.r);
      if (!snow) {
        for (let k = 0; k < 20; k++) {
          const x = Math.floor(c.x + rand(-c.r, c.r)), y = Math.floor(c.y + rand(-c.r, c.r));
          if (!w.inb(x, y)) continue;
          const i = w.idx(x, y);
          if (w.type[i] === G.T.GRASS || w.type[i] === G.T.FOREST) w.fert[i] = Math.min(1.8, w.fert[i] + 0.05);
        }
      }
      if (!c.announced && sim.timeMode !== 'vfast' && sim.tribes.some((t) => t.alive && G.dist(t.cx, t.cy, c.x, c.y) < c.r)) {
        c.announced = true;
        const t = sim.tribes.find((t) => t.alive && G.dist(t.cx, t.cy, c.x, c.y) < c.r);
        if (sim.year - (t.lastRainLog || -99) > 0.3) { t.lastRainLog = sim.year; t.log(sim, `${t.name}에 ${snow ? '눈' : '비'}이 내립니다`, false); }
      }
    }
  };

  Wt.rainingAt = (sim, x, y) => (sim.clouds || []).some((c) => c.rain && G.dist(c.x, c.y, x, y) < c.r);

  // ---------------- 피 흔적 ----------------
  const B = (G.Blood = {});
  const LIFE_DAYS = 30;
  const CAP = 450;

  // kind: pool(고인 피) / drops(핏방울) / animal(짐승 피)
  B.add = (sim, x, y, size, kind = 'drops', caseKey = null) => {
    if (!sim.blood) sim.blood = [];
    const w = sim.world;
    const t = w.typeAt(x, y);
    if (t <= G.T.WATER) return; // 물 위에는 남지 않는다
    sim.blood.push({ x: x + rand(-0.2, 0.2), y: y + rand(-0.15, 0.15), size, kind, born: sim.bt, seed: Math.random(), case: caseKey, seen: null });
    if (sim.blood.length > CAP) sim.blood.shift();
  };

  B.splash = (sim, x, y, n, size, kind, caseKey) => {
    for (let k = 0; k < n; k++) B.add(sim, x + rand(-0.6, 0.6), y + rand(-0.5, 0.5), size * rand(0.5, 1), kind, caseKey);
  };

  B.ageDays = (sim, b) => (sim.bt - b.born) / G.CFG.BPD;

  // 30일이 지나면 저절로 사라진다
  B.expire = (sim) => {
    if (!sim.blood) return;
    sim.blood = sim.blood.filter((b) => B.ageDays(sim, b) < LIFE_DAYS);
  };

  // 비(구름이나 신의 권능)가 씻어 낸다
  B.wash = (sim, x, y, r) => {
    if (!sim.blood || !sim.blood.length) return 0;
    const before = sim.blood.length;
    sim.blood = sim.blood.filter((b) => G.dist(b.x, b.y, x, y) > r);
    return before - sim.blood.length;
  };

  B.near = (sim, x, y, r, filter) => (sim.blood || []).some((b) => G.dist(b.x, b.y, x, y) <= r && (!filter || filter(b)));

  // 사람이 핏자국을 보면 놀란다 (아이와 예민한 사람은 더)
  B.witness = (sim, h) => {
    if (!sim.blood || !sim.blood.length || h.state === 'sleep' || h.jail) return;
    for (const b of sim.blood) {
      if (b.kind === 'animal' || Math.abs(b.x - h.x) > 1.5 || Math.abs(b.y - h.y) > 1.5) continue;
      if (B.ageDays(sim, b) > 10) continue;
      b.seen = b.seen || new Set();
      if (b.seen.has(h.id)) continue;
      b.seen.add(h.id);
      G.Social.addMood(sim, h, 'sawBlood');
      if (b.kind === 'pool') {
        if (h.age < 14 || h.p.neuro > 70) G.Mind.trauma(sim, h, 0.04, '핏자국을 보고');
        if (sim.year - (h.lastBloodLog || -99) > 3) { h.lastBloodLog = sim.year; h.log(sim, '피가 고인 자리를 보고 몸서리쳤다'); }
      }
      h.say('!', 50);
      break;
    }
  };

  // 다친 사람이 걸으면 핏방울을 흘린다
  B.trail = (sim, h) => {
    if (h.health < 30 && h.moving && chance(0.04)) B.add(sim, h.x, h.y, 0.4, 'drops');
  };
})();
