// 자연의 변화: 땅은 깎이고 쌓이고, 숲은 번지고 물러나고, 가뭄이 길면 메마른다.
// 동물은 짝을 짓고 새끼를 배어 낳고, 새끼는 어미를 따라다니다 자라고, 늙으면 죽는다.
// 마을 가까이는 깎거나 물에 잠기게 하지 않는다 (사람이 사는 땅이 갑자기 사라지지 않게).
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const T = G.T;
  const X = (G.Nature = {});

  // ================= 땅 =================
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const count = (w, x, y, test) => { let n = 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (w.inb(nx, ny) && test(w.type[w.idx(nx, ny)], w.idx(nx, ny))) n++; } return n; };
  const settled = (sim, x, y) => sim.tribes.some((t) => t.alive && (G.dist(t.cx, t.cy, x, y) < 9 || t.houses.some((h) => G.dist(h.x, h.y, x, y) < 2.5)));

  X.terrainTick = (sim) => {
    const w = sim.world;
    if (!w.moist0) w.moist0 = Float32Array.from(w.moist); // 원래 습도 (돌아갈 기준)
    if (!w.dry) w.dry = new Uint8Array(w.w * w.h);
    const samples = Math.round((w.w * w.h) / 160);
    let eroded = 0, built = 0, forest = 0, desert = 0;
    let note = null;
    for (let k = 0; k < samples; k++) {
      const x = randi(1, w.w - 2), y = randi(1, w.h - 2), i = w.idx(x, y), t = w.type[i];
      // 습도: 비가 오면 오르고, 가뭄이면 내리고, 평소에는 원래대로 돌아간다
      const raining = G.Weather && G.Weather.rainingAt && G.Weather.rainingAt(sim, x + 0.5, y + 0.5);
      if (raining) w.moist[i] = Math.min(1, w.moist[i] + 0.02);
      else if (sim.drought && t >= T.SAND) w.moist[i] = Math.max(0, w.moist[i] - 0.01);
      else w.moist[i] += (w.moist0[i] - w.moist[i]) * 0.05;
      const water = count(w, x, y, (tt) => tt <= T.WATER);
      const safe = !settled(sim, x + 0.5, y + 0.5);
      // 해안 침식: 물에 둘러싸인 낮은 땅은 파도에 깎인다 (겨울에 더)
      if ((t === T.SAND || t === T.GRASS) && water >= 4 && w.height[i] < 0.41 && safe && !w.farm[i]) {
        w.height[i] -= 0.003 * (sim.season === 3 ? 1.6 : 1);
        if (X.reclass(w, i)) { eroded++; note = note || { x, y, text: '파도에 바닷가가 깎여 땅이 물에 잠겼습니다' }; }
        continue;
      }
      // 퇴적: 땅으로 둘러싸인 얕은 물에는 모래가 쌓여 새 땅이 생긴다
      if (t === T.WATER && 8 - water >= 3) {
        w.height[i] += 0.004 * (8 - water >= 5 ? 1.5 : 1);
        if (X.reclass(w, i)) { built++; note = note || { x, y, text: '모래가 쌓여 물가에 새 땅이 생겼습니다' }; }
        continue;
      }
      // 산은 아주 천천히 풍화된다
      if ((t === T.MOUNTAIN || t === T.SNOW) && chance(0.2)) { w.height[i] -= 0.0008; X.reclass(w, i); continue; }
      // 숲이 번진다: 숲에 둘러싸인 촉촉한 풀밭
      if (t === T.GRASS && !w.farm[i] && w.moist[i] > 0.45 && count(w, x, y, (tt) => tt === T.FOREST) >= 3 && chance(0.25) && safe) {
        w.type[i] = T.FOREST; w.wood[i] = 2; w.food[i] = Math.min(w.food[i], 1.5); forest++;
        continue;
      }
      // 숲이 물러난다: 메마르면 풀밭이 된다
      if (t === T.FOREST && w.moist[i] < 0.33 && chance(0.3)) { w.type[i] = T.GRASS; w.wood[i] = 0; w.food[i] = 1; w.fert[i] = 0.7; forest--; continue; }
      // 사막화: 가뭄이 길면 메마른 풀밭이 모래땅이 되고, 비가 다시 오면 풀이 돋는다
      if (t === T.GRASS && !w.farm[i] && sim.drought && w.moist[i] < 0.28 && chance(0.4)) { w.type[i] = T.SAND; w.food[i] = 0.3; w.fert[i] = 0.2; w.dry[i] = 1; desert++; if (!note && !safe) note = { x, y, text: '오랜 가뭄에 마을 근처 풀밭이 메말라 모래땅이 되었습니다' }; continue; }
      if (t === T.SAND && w.dry[i] && w.moist[i] > 0.42) { w.dry[i] = 0; w.type[i] = T.GRASS; w.food[i] = 1; w.fert[i] = 0.8; desert--; }
    }
    if (eroded || built || forest || desert) w.dirty = true;
    sim.stats.landLost = (sim.stats.landLost || 0) + eroded;
    sim.stats.landGained = (sim.stats.landGained || 0) + built;
    // 사람 사는 곳 가까이에서 일어난 큰 변화는 기록에 남긴다
    if (note && sim.year - (sim.lastLandNote || -99) > 3) {
      const t = sim.tribes.find((o) => o.alive && G.dist(o.cx, o.cy, note.x, note.y) < 25);
      if (t) { sim.lastLandNote = sim.year; t.log(sim, note.text, false); }
    }
  };
  // 높이가 바뀌면 땅의 종류를 다시 정한다 (물이 된 칸에 사람이나 짐승이 있으면 뭍으로)
  X.reclass = (w, i) => {
    const old = w.type[i];
    w.classify(i);
    if (w.type[i] === old) return false;
    w.initRes(i);
    if (w.type[i] <= T.WATER) {
      const sim = G.curSim, x = (i % w.w) + 0.5, y = ((i / w.w) | 0) + 0.5;
      if (sim) sim.near(x, y, 0.8, (h) => { const p = w.nearestWalkable(h.x, h.y, 4); if (p) { h.x = p.x; h.y = p.y; } });
    }
    return true;
  };

  // ================= 동물: 짝짓기, 임신, 출산, 성장, 늙음 =================
  // mature: 다 크는 나이(년), gest: 새끼 배는 기간(년), litter: 한 번에 낳는 수, life: 수명(년)
  X.LIFE = {
    deer: { mature: 1.5, gest: 0.5, litter: [1, 1], life: 10 }, rabbit: { mature: 0.4, gest: 0.1, litter: [2, 4], life: 4 },
    boar: { mature: 1, gest: 0.3, litter: [2, 4], life: 10 }, sheep: { mature: 1, gest: 0.4, litter: [1, 2], life: 10 },
    cattle: { mature: 2, gest: 0.7, litter: [1, 1], life: 15 }, fowl: { mature: 0.4, gest: 0.08, litter: [2, 4], life: 5 },
    wolf: { mature: 1.5, gest: 0.2, litter: [2, 3], life: 11 }, tiger: { mature: 3, gest: 0.3, litter: [1, 2], life: 16 },
    bear: { mature: 4, gest: 0.6, litter: [1, 2], life: 22 },
  };
  X.ageOf = (sim, a) => {
    if (a.born === undefined) { const L = X.LIFE[a.kind]; a.born = sim.year - rand(L.mature, L.life * 0.6); a.sex = chance(0.5) ? 'F' : 'M'; }
    return sim.year - a.born;
  };
  X.young = (sim, a) => X.ageOf(sim, a) < X.LIFE[a.kind].mature;
  // 새끼는 작게 그린다 (render.js)
  X.scale = (sim, a) => { const L = X.LIFE[a.kind], age = X.ageOf(sim, a); return age >= L.mature ? 1 : 0.45 + 0.55 * age / L.mature; };

  X.animalTick = (sim) => {
    const W = G.Wild, sc = W.areaScale(sim);
    const counts = {};
    for (const a of sim.animals) if (a.alive && !a.tame) counts[a.kind] = (counts[a.kind] || 0) + 1;
    const herdCap = {};
    for (const t of sim.tribes) if (t.alive) herdCap[t.id] = { n: 0, cap: Math.max(4, Math.round(t.members.length * 0.8)) };
    for (const a of sim.animals) if (a.alive && a.tame && herdCap[a.tame]) herdCap[a.tame].n++;
    const born = [];
    for (const a of sim.animals) {
      if (!a.alive) continue;
      const L = X.LIFE[a.kind], age = X.ageOf(sim, a);
      // 늙어 죽는다
      if (age > L.life && chance(0.15)) { a.alive = false; continue; }
      // 새끼는 어미를 따라다닌다
      if (a.mom && age < L.mature) {
        const m = sim.animals.find((b) => b.id === a.mom && b.alive);
        if (m && G.dist(m.x, m.y, a.x, a.y) > 1.5) { a.tx = m.x + rand(-0.8, 0.8); a.ty = m.y + rand(-0.8, 0.8); }
        if (!m) a.mom = null;
      }
      // 출산
      if (a.preg && sim.year >= a.preg) {
        a.preg = 0;
        const n = randi(L.litter[0], L.litter[1]);
        for (let k = 0; k < n; k++) {
          const b = W.spawn(sim, a.kind, a.x + rand(-0.4, 0.4), a.y + rand(-0.4, 0.4), a.tame);
          b.born = sim.year; b.sex = chance(0.5) ? 'F' : 'M'; b.mom = a.id;
          if (a.kind === 'wolf' && a.tame) b.pet = pick(['바둑이', '누렁이', '백구', '흰둥이', '검둥이', '복실이', '점박이', '초롱이', '똘이', '해피']);
          born.push(b);
        }
        if (a.tame) { const t = sim.tribeById(a.tame); if (t && n && sim.year - (t.birthLog || -99) > 2) { t.birthLog = sim.year; t.log(sim, `${t.name}의 ${W.KINDS[a.kind].tame || W.KINDS[a.kind].name}이(가) 새끼 ${n}마리를 낳았습니다`, false); } }
        continue;
      }
      // 짝짓기: 다 자란 암컷이 가까운 수컷을 만나면 새끼를 밴다 (봄·여름에 잘, 겨울엔 드물게)
      if (a.sex !== 'F' || a.preg || age < L.mature || a.target) continue;
      const full = a.tame ? (!herdCap[a.tame] || herdCap[a.tame].n >= herdCap[a.tame].cap) : (counts[a.kind] || 0) >= Math.max(2, Math.round(W.KINDS[a.kind].cap * sc));
      if (full) continue;
      const season = [1.3, 1, 0.6, 0.15][sim.season];
      if (!chance(0.2 * season)) continue;
      let mate = null, md = 30;
      for (const b of sim.animals) { if (!b.alive || b === a || b.kind !== a.kind || b.sex !== 'M' || !!b.tame !== !!a.tame || (a.tame && b.tame !== a.tame)) continue; const d = G.dist(b.x, b.y, a.x, a.y); if (d < md && X.ageOf(sim, b) >= L.mature) { md = d; mate = b; } }
      if (!mate) continue;
      // 멀면 짝을 찾아간다
      if (md > 5) { if (!a.tame) { a.tx = mate.x + rand(-1, 1); a.ty = mate.y + rand(-1, 1); } continue; }
      a.preg = sim.year + L.gest;
      if (a.tame && herdCap[a.tame]) herdCap[a.tame].n += L.litter[0];
      else counts[a.kind] = (counts[a.kind] || 0) + L.litter[0];
    }
    if (born.length) sim.stats.animalBirths = (sim.stats.animalBirths || 0) + born.length;
  };

  // 혼자 남은 종은 대가 끊긴다. 너무 적으면 먼 곳에서 무리가 건너온다 (섬 밖에서 오는 것처럼, 아주 가끔)
  X.yearly = (sim) => {
    const W = G.Wild;
    for (const k in W.KINDS) {
      const n = sim.animals.filter((a) => a.alive && !a.tame && a.kind === k).length;
      if (n >= 2 || !chance(k === 'tiger' || k === 'bear' ? 0.1 : 0.3)) continue;
      const w = sim.world;
      for (let g = 0; g < 200; g++) {
        const x = rand(2, w.w - 2), y = rand(2, w.h - 2), t = w.typeAt(x, y);
        if ((t !== T.GRASS && t !== T.FOREST && t !== T.HILL) || sim.tribes.some((o) => o.alive && G.dist(o.cx, o.cy, x, y) < 25)) continue;
        for (const sex of ['F', 'M']) { const a = W.spawn(sim, k, x + rand(-1, 1), y + rand(-1, 1)); a.sex = sex; a.born = sim.year - X.LIFE[k].mature; }
        break;
      }
    }
  };
})();
