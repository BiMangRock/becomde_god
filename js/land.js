// 땅마다 다른 먹을거리와 걷기, 사람이 닿지 않는 땅의 변화
//  - 숲: 산딸기·머루·다래·버섯·야생 사과 같은 열매가 많다 (여름·가을에 풍성, 겨울엔 거의 없음)
//  - 초원: 풀뿌리·들나물, 모래사장: 조개·게, 언덕: 산나물·더덕, 산: 약초, 설산: 이끼 정도로 아주 적다
//  - 사람이 오래 닿지 않은 숲은 우거져(야생) 점점 넓게 번지고, 열매가 많아지고, 맹수가 자주 나오고, 처음 보는 식물이 돋는다
//  - 사람이 닿지 않는 설산일수록 눈이 깊이 쌓여 걷기가 점점 힘들어진다. 사람이 다니는 길은 눈이 다져진다
//  - 길이 생각보다 너무 오래 걸리면 중간에 포기하고 되돌아온다. 너무 험한 길은 처음부터 나서지 않는다
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, lerp, josa } = G;
  const T = G.T;
  const L = (G.Land = {});
  const W = G.World.prototype;

  // 지형별 먹을거리: cap 최대 양, grow 자라는 빠르기, items 이름
  L.FORAGE = {
    [T.SAND]: { cap: 0.8, grow: 0.002, items: ['조개', '게', '해초'] },
    [T.GRASS]: { items: ['풀뿌리', '들나물', '냉이', '달래'] },
    [T.FOREST]: { cap: 3, grow: 0.012, items: ['산딸기', '머루', '다래', '버섯', '도토리', '야생 사과', '블루베리', '으름'] },
    [T.HILL]: { cap: 2, grow: 0.004, items: ['산나물', '더덕', '칡뿌리', '약초'] },
    [T.MOUNTAIN]: { cap: 1.3, grow: 0.0015, items: ['석이버섯', '약초', '잣'] },
    [T.SNOW]: { cap: 1.05, grow: 0.0004, items: ['이끼', '얼어붙은 열매'] },
  };
  const FRUIT_SEASON = [0.8, 1.3, 1.6, 0.12]; // 봄·여름·가을·겨울 숲의 열매
  const HEAL_ITEMS = new Set(['약초', '더덕']);
  L.WILD_YEARS = 3; // 이만큼 사람이 닿지 않으면 야생이 되기 시작한다
  L.EXPAND = 0.2;   // 우거진 숲이 풀밭으로 번지는 빠르기

  L.ensure = (w) => {
    if (w.spd) return;
    const n = w.w * w.h;
    w.spd = new Float32Array(n);
    w.touch = new Uint16Array(n); // 사람이 마지막으로 밟은 날
    w.wild = new Float32Array(n); // 0~1 야생 정도
    w.snow = new Float32Array(n); // 쌓인 눈의 깊이
    w.dream = new Float32Array(n); // 몽환초 (herb.js)
    w.rare = new Map();            // 칸 -> 처음 보는 식물 번호
    for (let i = 0; i < n; i++) L.refresh(w, i);
  };

  // 칸의 걷는 빠르기를 다시 계산한다
  L.refresh = (w, i) => {
    const t = w.type[i];
    if (t < T.SAND) { w.spd[i] = 0; return; }
    let s = G.TILE_SPEED[t];
    if (t === T.FOREST) s *= 1 - 0.45 * w.wild[i];        // 우거진 숲은 덤불을 헤치고 가야 한다
    if (w.snow[i] > 0.05) s /= 1 + w.snow[i] * 1.1;       // 눈이 깊을수록 푹푹 빠진다
    w.spd[i] = Math.max(0.03, s);
  };

  // ---------------- 처음 먹을거리 ----------------
  const initRes0 = W.initRes;
  W.initRes = function (i) {
    initRes0.call(this, i);
    const t = this.type[i];
    if (t === T.FOREST) this.food[i] = 2.5;
    else if (t === T.HILL) this.food[i] = 1.2;
    else if (t === T.MOUNTAIN || t === T.SNOW) this.food[i] = 1;
    else if (t === T.SAND) this.food[i] = 0.6;
    if (this.spd) { this.wild[i] = 0; if (t !== T.SNOW && t !== T.MOUNTAIN) this.snow[i] = 0; this.dream[i] = 0; this.rare.delete(i); L.refresh(this, i); }
  };

  // ---------------- 자원 재생 (world.js의 regrow를 대신한다) ----------------
  W.regrow = function (mult) {
    L.ensure(this);
    const sim = G.curSim;
    const fruit = (sim && sim.drought ? 0.3 : 1) * FRUIT_SEASON[sim ? sim.season : 0];
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) {
      const t = this.type[i];
      if (t === T.WATER || t === T.DEEP) {
        const cap = t === T.WATER ? 6 : 4;
        if (this.fish[i] < cap) this.fish[i] += 0.012;
        continue;
      }
      if (t === T.GRASS && this.farm[i]) {
        if (this.food[i] < 9) this.food[i] = Math.min(9, this.food[i] + 0.06 * Math.max(1, this.fert[i]) * mult);
        continue;
      }
      if (t === T.GRASS) {
        const cap = 4 + 2 * this.fert[i];
        if (this.food[i] < cap) this.food[i] = Math.min(cap, this.food[i] + 0.02 * this.fert[i] * mult);
        this.fert[i] += (1 - this.fert[i]) * 0.002;
        if (this.moist[i] > 0.55 && this.food[i] > 5 && Math.random() < 0.00003) {
          this.type[i] = T.FOREST; this.wood[i] = 2; this.dirty = true; L.refresh(this, i);
        }
        continue;
      }
      const F = L.FORAGE[t];
      const wl = this.wild[i];
      if (t === T.FOREST) {
        // 우거진 숲일수록 나무와 열매가 많다
        const wcap = 12 + 3 * wl;
        if (this.wood[i] < wcap) this.wood[i] = Math.min(wcap, this.wood[i] + 0.012 * mult * (1 + wl));
        const fcap = (F.cap + 2.5 * wl) * Math.max(0.35, fruit);
        if (this.food[i] < fcap) this.food[i] = Math.min(fcap, this.food[i] + F.grow * fruit * (1 + wl * 1.5));
        continue;
      }
      if (t === T.HILL) { if (this.ore[i] < 4) this.ore[i] += 0.0005; }
      else if (t === T.MOUNTAIN) { if (this.ore[i] < 10) this.ore[i] += 0.001; }
      if (F) {
        // 눈이 깊으면 먹을 것이 눈 밑에 묻힌다
        const cap = F.cap * (1 + wl * 0.3) / (1 + this.snow[i]);
        if (this.food[i] < cap) this.food[i] = Math.min(cap, this.food[i] + F.grow * mult);
      }
    }
  };

  // 나무를 다 베어 숲이 풀밭이 되면 빠르기를 다시 계산한다
  const harvest0 = W.harvest;
  W.harvest = function (i, res) {
    const t = this.type[i];
    harvest0.call(this, i, res);
    if (this.spd && this.type[i] !== t) { this.wild[i] = 0; this.rare.delete(i); L.refresh(this, i); }
  };
  const mod0 = W.modifyHeight;
  W.modifyHeight = function (cx, cy, r, d) {
    mod0.call(this, cx, cy, r, d);
    if (!this.spd) return;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, cy + r); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, cx + r); x++) L.refresh(this, y * this.w + x);
  };

  // 자원 찾기: 같은 거리라도 눈 덮인 산·우거진 숲처럼 걷기 힘든 곳은 멀게 느낀다
  W.findResource = function (x, y, res, r) {
    const arr = this[res];
    let best = null, bestScore = 1e9;
    const cx = Math.floor(x), cy = Math.floor(y);
    if (this.inb(cx, cy) && arr[this.idx(cx, cy)] >= 1 && this.walkableTile(cx, cy) && !(this.fire && this.fire[this.idx(cx, cy)] > 0)) return { x: cx, y: cy, i: this.idx(cx, cy) };
    const here = this.speedXY(x, y);
    for (let k = 0; k < 50; k++) {
      const rr = r * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const tx = Math.floor(x + Math.cos(a) * rr), ty = Math.floor(y + Math.sin(a) * rr);
      if (!this.walkableTile(tx, ty)) continue;
      const i = this.idx(tx, ty);
      if (arr[i] < 1 || (this.fire && this.fire[i] > 0)) continue; // 불타는 곳에는 가지 않는다
      const sp = Math.min(here, this.speedAt(i));
      // 부스러기만 있는 칸(산·설산의 한 줌)은 웬만하면 가지 않는다
      const score = Math.hypot(tx - x, ty - y) / Math.max(0.05, sp) - arr[i] * 0.4 + (res === 'food' ? 5 / arr[i] : 0);
      if (score < bestScore) { bestScore = score; best = { x: tx, y: ty, i }; }
    }
    return best;
  };

  L.item = (w, i) => {
    const F = L.FORAGE[w.type[i]];
    if (!F) return null;
    if (w.type[i] === T.FOREST && w.wild[i] > 0.5 && chance(0.4)) return pick(['꿀열매', '산머루', '야생 배', '송이버섯']);
    return pick(F.items);
  };

  // ---------------- 걸을 때 ----------------
  // 밟은 땅을 기억하고(야생이 되지 않음), 눈을 다지고, 떨어진 금화를 줍는다
  L.step = (sim, h) => {
    const w = sim.world;
    if (!w.spd) return;
    const tx = Math.floor(h.x), ty = Math.floor(h.y);
    if (!w.inb(tx, ty)) return;
    const i = ty * w.w + tx, day = sim.day & 0xffff;
    // 깊은 눈이나 덤불 속에서 지치고 배고프면 가던 길을 포기한다
    if (h.state === 'goto' && h.task && OPTIONAL.has(h.task.kind) && !h.task.back && w.spd[i] < 0.2 && h.hunger > 65 && h.gotoT > 60) L.giveUp(h, sim, true);
    if (w.touch[i] !== day) {
      w.touch[i] = day;
      if (w.snow[i] > 0.3) { w.snow[i] = Math.max(0.15, w.snow[i] - 0.25); L.refresh(w, i); }
      if (w.wild[i] > 0) { w.wild[i] = Math.max(0, w.wild[i] - 0.05); }
    }
    if (sim.goldPiles && sim.goldPiles.length) {
      for (let k = sim.goldPiles.length - 1; k >= 0; k--) {
        const p = sim.goldPiles[k];
        if (Math.abs(p.x - h.x) > 1.2 || Math.abs(p.y - h.y) > 1.2) continue;
        sim.goldPiles.splice(k, 1);
        h.gold += p.amt; h.say('¤', 90);
        h.log(sim, `땅에 떨어진 금화 ${p.amt}개를 주웠다`);
        G.Social.addMood(sim, h, 'goldFound');
        if (h.has('정직한') && h.tribe && chance(0.5)) { h.gold -= p.amt; h.tribe.treasury += p.amt; h.log(sim, '주운 금화를 부족 금고에 바쳤다'); }
      }
    }
  };

  // ---------------- 길이 너무 오래 걸릴 때 ----------------
  const OPTIONAL = new Set(['gather', 'wander', 'hunt', 'hobby', 'visit', 'date', 'tame', 'pilgrim', 'herb', 'confront', 'till']);
  const MUST = new Set(['arrest', 'raid', 'escape', 'fetch', 'douse']);
  L.slowness = (h) => {
    let s = 1;
    if (h.age < 10) s *= 0.7;
    if (h.age > 60) s *= 0.75;
    if (h.hunger >= 100) s *= 0.8;
    if (h.sick) s *= 0.7;
    if (h.pregnant) s *= 0.85;
    return s;
  };
  // 예상 걸음 수 (1칸을 빠르기 1로 걷는 데 20틱). 넉넉하게 잡는다
  // 사람은 길을 나설 때 대충 '이 정도 걸리겠지' 하고 어림한다 (곧은 거리의 두 배쯤).
  // 꼭 가야 하는 길이 아니면, 그 어림보다 한참 오래 걸릴 때 되돌아온다
  L.eta = (h, path, task) => {
    const end = path[path.length - 1] || { x: h.x, y: h.y };
    let cost = path.cost ?? 10;
    if (task && OPTIONAL.has(task.kind) && !task.back) cost = Math.min(cost, G.dist(h.x, h.y, end.x, end.y) * 2.2);
    return Math.ceil(cost * 20 / L.slowness(h) * 1.3 + 90);
  };

  L.worthIt = (h, sim, path, x, y, task) => {
    if (!task || h.trek || h.lost || h.abducted || task.back || !OPTIONAL.has(task.kind)) return true;
    if (task.kind === 'gather' && task.res === 'food' && h.hunger > 80) return true;
    if (task.kind === 'herb' && (h.herbAddict || 0) > 25) return true; // 중독된 사람은 험한 길도 마다하지 않는다
    if (h.avoid && h.avoid.until > sim.year && G.dist(x, y, h.avoid.x, h.avoid.y) < 4) return false;
    const d = G.dist(h.x, h.y, x, y), cost = path.cost ?? d;
    // 눈 덮인 산이나 우거진 숲을 한참 헤쳐야 하는 길이면 나서지 않는다
    if (cost > 25 && cost > d * 2.8) {
      sim.stats.tooRough = (sim.stats.tooRough || 0) + 1;
      if (h.adult && sim.year - (h.roughLog || -99) > 4) {
        const w = sim.world, i = w.idx(clamp(Math.floor(x), 0, w.w - 1), clamp(Math.floor(y), 0, w.h - 1));
        const why = w.type[i] === T.SNOW || w.snow[i] > 0.8 ? '눈이 너무 깊이 쌓여 산에 오르기를 그만두었다' : w.type[i] === T.FOREST && w.wild[i] > 0.4 ? '숲이 너무 우거져 들어가기를 그만두었다' : null;
        if (why) { h.roughLog = sim.year; h.log(sim, why); }
      }
      return false;
    }
    return true;
  };

  L.giveUp = (h, sim, tired) => {
    const k = h.task;
    if (!k || h.trek || h.lost || h.abducted || h.held || MUST.has(k.kind)) { h.eta = Infinity; return false; }
    const w = sim.world;
    const tt = w.typeAt(h.tx, h.ty), ti = w.idx(clamp(Math.floor(h.tx), 0, w.w - 1), clamp(Math.floor(h.ty), 0, w.h - 1));
    const here = w.spd ? w.speedXY(h.x, h.y) : 1;
    const where = (tt === T.SNOW || (w.snow && w.snow[ti] > 0.8)) ? '눈 덮인 산으로 가는 길이 너무 깊어'
      : (tt === T.FOREST && w.wild && w.wild[ti] > 0.4) ? '우거진 숲을 헤치고 가는 길이 너무 멀어'
      : here < 0.35 ? '험한 산길이 끝없이 이어져' : '길이 생각보다 너무 멀어';
    h.avoid = { x: h.tx, y: h.ty, until: sim.year + 1 };
    sim.stats.turnBack = (sim.stats.turnBack || 0) + 1;
    h.say('↩', 90);
    if (sim.year - (h.turnLog || -99) > 3) { h.turnLog = sim.year; h.log(sim, tired ? `${(w.snow && w.snow[w.idx(Math.floor(h.x), Math.floor(h.y))] > 0.8) ? '깊은 눈 속에서' : '우거진 덤불 속에서'}지치고 배가 고파 가던 길을 접고 되돌아왔다` : `${where} 중간에 포기하고 되돌아왔다`); }
    const home = h.tribe ? { x: h.tribe.cx, y: h.tribe.cy } : h.camp || null;
    h.state = 'idle'; h.task = null;
    if (k.back || !home || G.dist(home.x, home.y, h.x, h.y) < 4) return true;
    if (!h.goTo(sim, home.x + rand(-1.5, 1.5), home.y + rand(-1.5, 1.5), { kind: 'wander', back: true })) { h.state = 'idle'; h.task = null; }
    return true;
  };

  // ---------------- 채집: 땅마다 다른 먹을거리, 처음 보는 식물 ----------------
  const MOODS = {
    newFruit: { t: '처음 보는 열매를 맛보았다', v: 10, d: 0.3 },
    poisoned: { t: '모르는 풀을 먹고 앓았다', v: -15, d: 0.3 },
    foundPlant: { t: '깊은 숲에서 새 식물을 찾았다', v: 12, d: 0.4 },
    goldFound: { t: '금화를 주웠다', v: 10, d: 0.25 },
    goldRain: { t: '하늘에서 금화가 쏟아졌다', v: 16, d: 0.4 },
    goldEnvy: { t: '남들만 금화를 주웠다', v: -8, d: 0.25 },
  };
  Object.assign(G.MOODS, MOODS);

  const gather0 = G.Human.prototype.doGather;
  G.Human.prototype.doGather = function (sim) {
    const k = this.task, w = sim.world;
    if (this.timer <= 0 && k && k.res === 'food' && w.spd && !w.farm[k.tile]) {
      const t = w.type[k.tile];
      if (w.rare.has(k.tile)) L.discover(sim, this, k.tile);
      if (w.dream[k.tile] >= 1 && G.Herb) G.Herb.notice(sim, this, k.tile);
      if (!this.alive) return;
      // 색맹은 덜 익은 열매를 골라 헛손질을 하기도 한다
      if (t === T.FOREST && G.Genes.has(this, 'cb') && chance(0.12)) { this.timer = this.gatherTime(); return; }
      if (w.food[k.tile] >= 1) {
        const it = L.item(w, k.tile);
        if (it) {
          this.lastForage = it;
          if (chance(0.25)) this.say(it, 50);
          if (HEAL_ITEMS.has(it)) this.health = Math.min(this.maxHp, this.health + 6);
          if (t === T.SNOW || w.snow[k.tile] > 0.5) { if (!this.snowFood && this.adult) { this.snowFood = true; this.log(sim, `눈 덮인 산에서 ${josa(it, '을/를')} 겨우 찾았다`); } }
        }
      }
    }
    const before = this.carry === 'food' ? this.carryAmt : 0;
    const r = gather0.call(this, sim);
    // 여름·가을 숲은 열매가 주렁주렁 열려 한 번에 더 딴다
    if (k && k.res === 'food' && w.type[k.tile] === T.FOREST && this.carry === 'food' && this.carryAmt > before && (sim.season === 1 || sim.season === 2) && chance(0.4)) this.carryAmt++;
    return r;
  };

  // ================= 처음 보는 식물 =================
  const ADJ = ['달빛', '푸른', '붉은', '금빛', '안개', '이슬', '별', '검은', '하얀', '무지개', '은빛', '노을'];
  const NOUN = {
    fruit: ['방울열매', '꿀열매', '구슬딸기', '등불열매'],
    medicine: ['치유초', '숨결풀', '피멎이꽃', '잠풀'],
    poison: ['독버섯', '가시꽃', '저승풀'],
    dye: ['물들이꽃', '쪽풀', '빛깔이끼'],
  };
  L.KIND_TEXT = { fruit: '먹을 수 있는 열매', medicine: '약효가 있는 풀', poison: '독이 있는 풀', dye: '물감이 나오는 풀' };
  L.newSpecies = (sim) => {
    sim.flora = sim.flora || [];
    const kind = pick(['fruit', 'fruit', 'medicine', 'medicine', 'poison', 'dye']);
    for (let k = 0; k < 20; k++) {
      const name = `${pick(ADJ)} ${pick(NOUN[kind])}`;
      if (sim.flora.some((s) => s.name === name)) continue;
      const sp = { id: sim.flora.length, name, kind, found: null };
      sim.flora.push(sp);
      return sp;
    }
    return pick(sim.flora);
  };

  L.discover = (sim, h, i) => {
    const w = sim.world;
    const sp = sim.flora && sim.flora[w.rare.get(i)];
    w.rare.delete(i);
    if (!sp) return;
    const t = h.tribe;
    const known = t ? (t.flora = t.flora || new Set()) : (h.flora = h.flora || new Set());
    const first = !known.has(sp.id);
    const worldFirst = !sp.found;
    if (worldFirst) {
      sp.found = Math.floor(sim.year);
      sim.event(`${josa(h.name, '이/가')} 깊은 숲에서 처음 보는 식물 '${sp.name}'${josa(sp.name, '을/를').slice(-1)} 발견했습니다 (${L.KIND_TEXT[sp.kind]})`, '#9be3c8', h.x, h.y);
      sim.stats.newPlants = (sim.stats.newPlants || 0) + 1;
    }
    if (first) {
      known.add(sp.id);
      h.log(sim, `깊은 숲에서 처음 보는 ${josa(sp.name, '을/를')} 찾았다`);
      G.Social.addMood(sim, h, 'foundPlant');
      if (t) { G.Persona.addLore(sim, t, 3, h); if (!worldFirst) t.log(sim, `${josa(h.name, '이/가')} ${josa(sp.name, '을/를')} 부족에 처음 들여왔습니다`, false); }
      h.say('✿', 120);
    }
    switch (sp.kind) {
      case 'fruit':
        h.hunger = 0; G.Social.addMood(sim, h, 'newFruit');
        if (first) h.log(sim, `${josa(sp.name, '은/는')} 달고 배가 불렀다`);
        break;
      case 'medicine':
        h.health = h.maxHp; if (h.sick && chance(0.6)) h.sick = null;
        if (t) t.medicine = (t.medicine || 0) + 1;
        if (first) h.log(sim, `${josa(sp.name, '을/를')} 상처에 발라 보니 금세 아물었다`);
        break;
      case 'poison':
        if (first || chance(0.3)) {
          h.health -= rand(20, 40); G.Social.addMood(sim, h, 'poisoned'); h.say('×', 120);
          h.log(sim, `${josa(sp.name, '을/를')} 먹었다가 크게 앓았다`);
          if (h.health <= 0) sim.kill(h, '독초');
        }
        break;
      case 'dye':
        if (t) { t.treasury += 12; t.art = (t.art || 0) + 2; }
        if (first) h.log(sim, `${sp.name}에서 고운 물감을 얻었다`);
        break;
    }
  };

  // ================= 해마다 / 며칠마다: 야생, 눈, 숲의 팽창 =================
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  L.tick = (sim) => {
    const w = sim.world;
    L.ensure(w);
    const day = sim.day, D = G.CFG.DAYS, season = sim.season, n = w.w * w.h;
    // 마을과 집 주변은 사람 손이 늘 닿는다
    for (const t of sim.tribes) {
      if (!t.alive) continue;
      const r = 6 + Math.sqrt(t.members.length);
      for (let y = Math.max(0, Math.floor(t.cy - r)); y <= Math.min(w.h - 1, t.cy + r); y++)
        for (let x = Math.max(0, Math.floor(t.cx - r)); x <= Math.min(w.w - 1, t.cx + r); x++) w.touch[y * w.w + x] = day & 0xffff;
    }
    for (const hm of sim.humans) if (hm.alive && hm.hermit && hm.hermit.x !== undefined) { const i = w.idx(clamp(Math.floor(hm.hermit.x), 0, w.w - 1), clamp(Math.floor(hm.hermit.y), 0, w.h - 1)); w.touch[i] = day & 0xffff; }
    let snowSum = 0, wildForest = 0;
    for (let i = 0; i < n; i++) {
      const t = w.type[i];
      if (t < T.SAND) continue;
      const ago = ((day & 0xffff) - w.touch[i] + 0x10000) % 0x10000;
      const yrs = Math.min(day, ago) / D;
      const wl = clamp((yrs - L.WILD_YEARS) / 10, 0, 1);
      // 야생은 서서히 오른다 (밟으면 L.step에서 내려감)
      w.wild[i] = wl > w.wild[i] ? Math.min(wl, w.wild[i] + 0.02) : wl;
      // 눈: 설산은 사람이 안 닿을수록 깊어지고, 산은 겨울에 쌓였다가 봄에 녹는다
      let sn = w.snow[i];
      if (t === T.SNOW) {
        const cap = 0.5 + 3.5 * w.wild[i];
        const add = (season === 3 ? 0.09 : season === 0 ? 0.03 : season === 1 ? -0.02 : 0.01) * (0.6 + w.wild[i]);
        sn = clamp(sn + add, 0.2, Math.max(cap, 0.2));
        if (sn > cap) sn = Math.max(cap, sn - 0.05);
      } else if (t === T.MOUNTAIN) {
        sn = season === 3 ? Math.min(0.4 + 1.2 * w.wild[i], sn + 0.05 * (0.6 + w.wild[i])) : Math.max(0, sn - 0.06);
      } else if (sn > 0) sn = Math.max(0, sn - 0.1);
      w.snow[i] = sn;
      snowSum += sn;
      L.refresh(w, i);
      // 몽환초: 사람 손이 닿지 않는 숲과 산에서 자란다
      const wi = w.wild[i];
      if ((t === T.FOREST && wi > 0.5) || (t === T.MOUNTAIN && wi > 0.5) || (t === T.HILL && wi > 0.7)) {
        if (w.dream[i] < 2 && chance(0.00012 * wi)) w.dream[i] = Math.min(2, w.dream[i] + 1);
      } else if (w.dream[i] > 0 && t !== T.FOREST && t !== T.MOUNTAIN && t !== T.HILL) w.dream[i] = 0;
      // 처음 보는 식물: 깊이 우거진 숲에서만
      if (t === T.FOREST) {
        if (wi > 0.6) wildForest++;
        if (wi > 0.6 && w.rare.size < 40 && chance(0.0006 * wi)) {
          const sp = (!sim.flora || sim.flora.length < 10) && (!sim.flora || !sim.flora.length || chance(0.35)) ? L.newSpecies(sim) : pick(sim.flora);
          w.rare.set(i, sp.id);
          w.food[i] = Math.max(w.food[i], 1.5);
        }
      } else if (w.rare.has(i)) w.rare.delete(i);
    }
    sim.landInfo = { snow: snowSum, wildForest };
    // 숲의 팽창: 우거진 숲 옆의 사람 없는 풀밭이 숲이 된다
    const samples = Math.round(n / 80);
    const near = (x, y) => sim.tribes.some((o) => o.alive && G.dist(o.cx, o.cy, x, y) < (G.Realm ? G.Realm.radius(o) : 10) + 5);
    let grown = 0, note = null;
    for (let k = 0; k < samples; k++) {
      const x = randi(1, w.w - 2), y = randi(1, w.h - 2), i = y * w.w + x, t = w.type[i];
      if ((t !== T.GRASS && t !== T.SAND) || w.farm[i] || w.wild[i] < 0.3) continue;
      let nf = 0, nw = 0;
      for (const [dx, dy] of N8) { const j = (y + dy) * w.w + x + dx; if (w.type[j] === T.FOREST) { nf++; nw += w.wild[j]; } }
      if (nf < 2 || nw / nf < 0.4) continue;
      if (t === T.SAND) { if (w.moist[i] > 0.4 && w.height[i] > 0.38 && chance(0.2)) { w.type[i] = T.GRASS; w.food[i] = 1; w.fert[i] = 0.6; grown++; } continue; }
      if (!chance(L.EXPAND * w.wild[i]) || near(x, y)) continue;
      w.type[i] = T.FOREST; w.wood[i] = 3; w.food[i] = Math.max(1, w.food[i] * 0.4);
      L.refresh(w, i); grown++;
      // 마을 근처까지 숲이 밀려오면 기록한다
      if (!note) { const tr = sim.tribes.find((o) => o.alive && G.dist(o.cx, o.cy, x, y) < 16); if (tr) note = { tr, x, y }; }
    }
    if (grown) { w.dirty = true; sim.stats.forestGrown = (sim.stats.forestGrown || 0) + grown; }
    if (note && sim.year - (note.tr.lastForestNote || -99) > 5) { note.tr.lastForestNote = sim.year; note.tr.log(sim, `사람 손이 닿지 않은 숲이 ${note.tr.name} 근처까지 번져 왔습니다`, false); }
    if (chance(0.15)) w.dirty = true;
    L.wildBeasts(sim);
  };

  // 우거진 숲에서는 짐승, 특히 맹수가 자주 나온다
  L.wildBeasts = (sim) => {
    const w = sim.world, Wd = G.Wild;
    if (!chance(0.12)) return;
    let spot = null;
    for (let k = 0; k < 40 && !spot; k++) {
      const x = randi(2, w.w - 3), y = randi(2, w.h - 3), i = y * w.w + x;
      if (w.type[i] === T.FOREST && w.wild[i] > 0.6) spot = { x: x + 0.5, y: y + 0.5, wl: w.wild[i] };
    }
    if (!spot) return;
    const sc = Wd.areaScale(sim);
    const count = {};
    for (const a of sim.animals) if (a.alive && !a.tame) count[a.kind] = (count[a.kind] || 0) + 1;
    const beast = chance(0.25);
    const kind = beast ? pick(['wolf', 'wolf', 'wolf', 'bear', 'bear', 'tiger']) : pick(['deer', 'deer', 'boar', 'fowl', 'rabbit', 'boar']);
    const K = Wd.KINDS[kind];
    if ((count[kind] || 0) >= Math.max(kind === 'tiger' ? 1 : 2, K.cap * sc * (kind === 'tiger' ? 0.4 : beast ? 1 : 1.6))) return;
    // 큰 맹수는 마을에서 먼 깊은 숲에서만 나온다
    if (beast && sim.tribes.some((o) => o.alive && G.dist(o.cx, o.cy, spot.x, spot.y) < (kind === 'wolf' ? 24 : 30))) return;
    const n = kind === 'wolf' ? 2 : kind === 'tiger' || kind === 'bear' ? 1 : randi(1, 3);
    for (let k = 0; k < n; k++) {
      const a = Wd.spawn(sim, kind, spot.x + rand(-1, 1), spot.y + rand(-1, 1));
      a.age = rand(1, 3); a.wildborn = true;
    }
    sim.stats.wildSpawn = (sim.stats.wildSpawn || 0) + n;
    if (beast) {
      const t = sim.tribes.find((o) => o.alive && G.dist(o.cx, o.cy, spot.x, spot.y) < 35);
      if (t && sim.year - (t.lastWildBeast || -99) > 3) { t.lastWildBeast = sim.year; t.log(sim, `우거진 숲에서 ${K.name}${kind === 'wolf' ? ' 무리' : ''}${josa(K.name + (kind === 'wolf' ? ' 무리' : ''), '이/가').slice(-1)} 나타났습니다`, false); }
    }
  };

  const terr0 = G.Nature.terrainTick;
  G.Nature.terrainTick = (sim) => { terr0(sim); L.tick(sim); };

  // ---------------- 그림: 우거진 숲은 짙게, 눈이 깊으면 희게, 다져진 눈길은 회색으로 ----------------
  const paint0 = W.paint;
  W.paint = function (data) {
    paint0.call(this, data);
    if (!this.spd) return;
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) {
      const t = this.type[i];
      if (t < T.SAND) continue;
      const o = i * 4;
      const wl = this.wild[i], sn = this.snow[i];
      if (t === T.FOREST && wl > 0.05) {
        data[o] *= 1 - 0.4 * wl; data[o + 1] *= 1 - 0.18 * wl; data[o + 2] *= 1 - 0.3 * wl;
      }
      if (t === T.SNOW) {
        if (sn < 0.45) { const k = 0.35; data[o] = lerp(data[o], 178, k); data[o + 1] = lerp(data[o + 1], 180, k); data[o + 2] = lerp(data[o + 2], 186, k); }
        else { const k = Math.min(1, (sn - 0.5) / 3) * 0.5; data[o] = lerp(data[o], 250, k); data[o + 1] = lerp(data[o + 1], 252, k); data[o + 2] = lerp(data[o + 2], 255, k); }
      } else if (sn > 0.15) {
        const k = Math.min(0.75, sn / 1.4);
        data[o] = lerp(data[o], 238, k); data[o + 1] = lerp(data[o + 1], 242, k); data[o + 2] = lerp(data[o + 2], 250, k);
      }
    }
  };

  // ---------------- 신의 권능: 금화 내리기 ----------------
  L.goldRain = (sim, x, y) => {
    let n = 0, total = 0;
    sim.near(x, y, 4, (h) => {
      const g = randi(8, 20);
      h.gold += g; total += g; n++;
      h.faith = Math.min(100, h.faith + (h.has('의심 많은') ? 3 : 8));
      G.Social.addMood(sim, h, 'goldRain');
      if (sim.year - (h.goldLog || -99) > 1) { h.goldLog = sim.year; h.log(sim, `하늘에서 쏟아진 금화 ${g}개를 주웠다`); }
      h.miracles++; h.say('¤', 90);
    });
    const t = sim.tribeAt(x, y, 8);
    if (t) { t.treasury += 60; total += 60; t.log(sim, `신이 ${t.name}에 금화를 내려 금고가 넉넉해졌습니다`, false); }
    // 금화를 줍지 못한 탐욕스러운 사람은 샘을 낸다
    sim.near(x, y, 12, (h) => {
      if (G.dist(h.x, h.y, x, y) <= 4) return;
      if (h.has('탐욕스러운') || h.has('질투심 많은')) { G.Social.addMood(sim, h, 'goldEnvy'); h.stress = Math.min(100, (h.stress || 0) + 8); }
    });
    if (!n && !t) {
      sim.goldPiles = sim.goldPiles || [];
      const p = sim.world.nearestWalkable(x, y, 3);
      if (p) {
        for (let k = 0; k < 4; k++) { const q = sim.world.nearestWalkable(p.x + rand(-1.5, 1.5), p.y + rand(-1.5, 1.5), 2) || p; sim.goldPiles.push({ x: q.x, y: q.y, amt: randi(6, 15) }); }
        sim.event('아무도 없는 땅에 금화가 쏟아져 반짝입니다. 지나가는 사람이 줍겠지요', '#ffd34d', x, y);
      } else sim.event('신이 내린 금화가 바닷속으로 가라앉았습니다', '#ffd34d', x, y);
    } else sim.event(`하늘에서 금화가 쏟아졌습니다 (${n}명이 줍고, 모두 금화 ${total}개)`, '#ffd34d', x, y);
    sim.effects.push({ kind: 'gold', x, y, r: 4, age: 0, ttl: 90 });
    sim.stats.goldRain = (sim.stats.goldRain || 0) + total;
  };
})();
