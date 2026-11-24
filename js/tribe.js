// 부족: 마을, 창고, 금고, 시장 가격, 직업 배분, 외교
(function () {
  const G = globalThis.G;
  const { rand, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const BASE_PRICE = { food: 2, wood: 3, ore: 5 };

  let NEXT_TRIBE = 1;

  class Tribe {
    constructor(sim, cx, cy, opts = {}) {
      this.id = NEXT_TRIBE++;
      this.bandit = !!opts.bandit;
      this.name = G.makeTribeName(sim.usedTribeNames);
      if (this.bandit) this.name = this.name.replace(/ 부족$/, ' 도적단');
      sim.usedTribeNames.add(this.name);
      this.color = this.bandit ? G.pick(['#6e6e6e', '#5b4a4a', '#4f5560']) : G.TRIBE_COLORS[(this.id - 1) % G.TRIBE_COLORS.length];
      this.tools = 0;        // 대장장이가 만든 도구
      // 부족의 법: 바람(간통)을 죄로 볼 것인가
      // 간통·부부 사이 강요·사형·명예·광신 (crime3.js)
      this.law = G.Crime3.makeLaw(this.bandit);
      this.jail = null;      // 감옥 위치
      this.farmCount = 0;
      this.cx = cx; this.cy = cy;
      this.members = [];
      this.chief = null;
      this.stock = { food: 10, wood: 4, ore: 0 };
      this.treasury = 40;
      this.houses = [];
      this.temple = false;
      this.founded = Math.floor(sim.year);
      this.alive = true;
      this.wars = new Set();
      this.warStart = {};
      this.chronicle = [];
      this.births = 0; this.deaths = 0;
      this.peak = 0;
    }

    log(sim, text, global = true) {
      this.chronicle.push({ y: Math.floor(sim.year), t: text });
      if (this.chronicle.length > 40) this.chronicle.shift();
      if (global) sim.event(text, this.color, this.cx, this.cy);
    }

    add(sim, h) {
      if (h.tribe === this) return;
      if (h.tribe) h.tribe.remove(sim, h);
      h.tribe = this;
      this.members.push(h);
      this.peak = Math.max(this.peak, this.members.length);
      this.assignJob(sim, h);
    }

    remove(sim, h) {
      const i = this.members.indexOf(h);
      if (i >= 0) this.members.splice(i, 1);
      if (h.tribe === this) h.tribe = null;
      if (this.chief === h) this.chief = null;
    }

    adults() { return this.members.filter((m) => m.adult); }
    get title() { return this.bandit ? '두목' : '족장'; }
    toolBonus() { return Math.min(this.has('청동') ? 0.45 : 0.3, this.tools / Math.max(1, this.members.length) * 0.25); }
    has(d) { return !!(this.found && this.found.includes(d)); }
    // 가축 우리
    ensurePen(sim) {
      if (this.pen) return this.pen;
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(5, 7.5);
        const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
        if (sim.world.typeAt(x, y) !== G.T.GRASS) continue;
        if (this.houses.some((hs) => Math.hypot(hs.x - x, hs.y - y) < 2.5)) continue;
        this.pen = { x, y };
        this.log(sim, `${josa(this.name, '이/가')} 가축 우리를 지었습니다`, false);
        return this.pen;
      }
      this.pen = { x: this.cx + 4, y: this.cy };
      return this.pen;
    }
    prisoners(sim) { return sim.humans.filter((h) => h.alive && h.jail && h.jail.tid === this.id); }

    // 수요(인구)와 공급(창고)으로 가격이 정해진다
    price(r) {
      const n = Math.max(1, this.members.length);
      const target = r === 'food' ? n * 3 : r === 'wood' ? n * 1.5 + 6 : n * 0.8 + 3;
      return clamp(BASE_PRICE[r] * (target + 5) / (this.stock[r] + 5), BASE_PRICE[r] * 0.3, BASE_PRICE[r] * 4);
    }
    reserve(r) { return r === 'food' ? this.members.length * 1.5 : 2; }

    deposit(sim, h) {
      const r = h.carry, amt = h.carryAmt;
      if (!r || amt <= 0 || !(r in this.stock)) { h.carry = null; h.carryAmt = 0; return; }
      const stigma = h.labor || h.enslaved ? 0 : h.convictions && !h.redeemed ? 0.6 : 1; // 전과자는 품삯이 깎이고, 노역 중이거나 노예면 받지 못한다
      const pay = Math.min(Math.floor(this.price(r) * amt * 0.6 * stigma), Math.floor(this.treasury));
      this.stock[r] += amt; this.treasury -= pay; h.gold += pay;
      h.carry = null; h.carryAmt = 0;
      this.giveRation(h);
    }

    // 일하러 나가는 사람에게 도시락
    giveRation(h) {
      if (h.ration < 1 && this.stock.food > this.members.length * 2) { this.stock.food -= 1; h.ration = 1; }
    }

    // 배고픈 사람에게 식량 팔기 (아이·가난한 사람은 형편이 되면 나눠준다)
    feed(sim, h) {
      if (this.stock.food < 1) return false;
      const p = Math.ceil(this.price('food'));
      const generous = this.chief && this.chief.has('너그러운');
      if (h.job === J.CHILD) {
        // 무료
      } else if (h.gold >= p) {
        h.gold -= p; this.treasury += p;
      } else if (this.stock.food > this.members.length * (generous ? 0.5 : 1.5)) {
        // 공동 배급
      } else {
        return false;
      }
      this.stock.food -= 1;
      h.hunger = Math.max(0, h.hunger - 40);
      this.giveRation(h);
      if (h.hunger > 50 && this.stock.food >= 1 && (h.job === J.CHILD || h.gold >= p)) {
        if (h.job !== J.CHILD) { h.gold -= p; this.treasury += p; }
        this.stock.food -= 1; h.hunger = Math.max(0, h.hunger - 40);
      }
      return true;
    }

    // 부족 사정과 성격에 맞춰 직업 정하기
    assignJob(sim, h) {
      if (h.age < 14) { h.job = J.CHILD; return; }
      if (h === this.chief) { h.job = J.CHIEF; return; }
      const adults = this.members.filter((m) => m.adult && m !== this.chief && m !== h);
      const n = adults.length + 1;
      const cnt = {};
      for (const m of adults) cnt[m.job] = (cnt[m.job] || 0) + 1;
      const otherTribes = sim.tribes.filter((t) => t !== this && t.alive && t.members.length).length;
      const mem = this.members.length;
      const foodLow = this.stock.food < mem * 2;
      const foodHigh = this.stock.food > mem * 8;
      const woodHigh = this.stock.wood > mem * 2 + 30;
      const foodJob = foodLow ? 1.4 : foodHigh ? 0.55 : 1;
      const want = this.bandit ? {
        [J.WARRIOR]: 0.5, [J.HUNTER]: 0.2, [J.GATHER]: 0.2, [J.WOOD]: 0.1,
      } : {
        [J.GATHER]: 0.14 * foodJob,
        [J.FARMER]: (n >= 4 ? 0.18 : 0.05) * foodJob,
        [J.HUNTER]: (this.hasPrey ? 0.09 : 0) * foodJob,
        [J.FISHER]: (this.hasWater ? 0.09 : 0) * foodJob,
        [J.WOOD]: woodHigh ? 0.03 : 0.15,
        [J.MINE]: this.hasOre ? 0.08 : 0,
        [J.SMITH]: this.hasOre && n >= 8 ? 0.05 : 0,
        [J.MERCHANT]: otherTribes && n >= 6 ? 0.08 : 0,
        [J.PRIEST]: n >= 8 ? 0.05 : 0,
        [J.HEALER]: n >= 8 ? 0.05 : 0,
        [J.GUARD]: n >= 10 || (this.crimeHeat || 0) > 2 ? 0.05 + Math.min(0.1, (this.crimeHeat || 0) * 0.015) : 0,
        [J.WARRIOR]: this.wars.size ? 0.3 : n >= 8 ? 0.05 : 0,
        [J.HERDER]: this.hasTameable || this.herd > 0 ? (n >= 5 ? 0.07 : 0.04) : 0,
        [J.WATCH]: this.hasBeasts || this.herd > 3 || (this.beastHeat || 0) > 0.5 ? 0.05 + Math.min(0.1, (this.beastHeat || 0) * 0.03) : 0,
      };
      const prefer = h.has('탐욕스러운') ? J.MERCHANT : h.has('신앙심 깊은') ? J.PRIEST : h.has('다정한') ? (chance(0.5) ? J.HEALER : J.HERDER)
        : (h.has('정직한') && h.has('용감한')) ? J.GUARD : h.has('용감한') || h.teto > 50 ? pick([J.WARRIOR, J.HUNTER, J.WATCH])
        : h.teto < -50 ? pick([J.HEALER, J.HERDER, J.MERCHANT, J.PRIEST])
        : h.has('부지런한') ? J.FARMER : null;
      let job = null;
      if (prefer && want[prefer] * n - (cnt[prefer] || 0) > 0) job = prefer;
      if (!job) {
        let bestGap = -1e9;
        for (const j in want) {
          const gap = want[j] * n - (cnt[j] || 0);
          if (gap > bestGap) { bestGap = gap; job = j; }
        }
      }
      // 전과자는 하찮은 일만 맡는다 (족장이 너그러우면 예외)
      if (h.convictions && !h.redeemed && !(this.chief && this.chief.has('너그러운')) && ![J.GATHER, J.WOOD, J.MINE, J.FARMER].includes(job)) {
        job = pick([J.GATHER, J.WOOD, J.MINE]);
        if (!h.jobDenied) { h.jobDenied = true; h.log(sim, '전과 때문에 원하는 일을 맡지 못했다'); }
      }
      const old = h.job;
      h.job = job || J.GATHER;
      if (old !== h.job) {
        h.log(sim, `${josa(h.job, '이/가')} 되었다`);
        if (h.job === J.MERCHANT && h.gold < 20 && this.treasury > 40) { this.treasury -= 20; h.gold += 20; }
        if (chance(0.5)) G.Mind.findMentor(sim, h);
      }
    }

    electChief(sim) {
      const cands = this.adults().filter((m) => m.age < 70 && !m.jail && !m.wanted && (m.notoriety || 0) < 15);
      if (!cands.length) { this.chief = null; return; }
      const score = (m) => m.age * 0.5 + m.gold / 10 + m.kills * 3 + (m.has('야심찬') ? 10 : 0) + (m.has('용감한') ? 4 : 0)
        + m.teto / 10 + m.p.extra / 15 + m.knowledge / 10 + G.Persona.charm(m) / 10;
      cands.sort((a, b) => score(b) - score(a));
      const c = cands[0];
      this.chief = c;
      c.job = J.CHIEF;
      c.log(sim, `${this.name}의 ${this.title}이 되었다`);
      this.log(sim, `${josa(c.name, '이/가')} ${this.name}의 새 ${this.title}이 되었습니다`);
    }

    buildHouse(sim) {
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.sqrt(this.houses.length) * 1.3 + Math.random() * 1.5;
        const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
        if (!sim.world.walkable(x, y)) continue;
        if (this.houses.some((hs) => Math.hypot(hs.x - x, hs.y - y) < 1.1)) continue;
        if (Math.hypot(x - this.cx, y - this.cy) < 1.3) continue;
        this.houses.push({ x, y });
        this.stock.wood -= 6;
        return true;
      }
      return false;
    }

    // 식량이 풍부하고 다른 부족과 떨어진 터 찾기
    findSite(sim, minR, maxR, minScore = 0) {
      const w = sim.world;
      let best = null, bestScore = minScore;
      for (let k = 0; k < 150; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(minR, maxR);
        const x = Math.floor(this.cx + Math.cos(a) * r) + 0.5, y = Math.floor(this.cy + Math.sin(a) * r) + 0.5;
        if (!w.inb(Math.floor(x), Math.floor(y))) continue;
        const ty = w.typeAt(x, y);
        if (ty !== G.T.GRASS && ty !== G.T.FOREST) continue;
        if (sim.tribes.some((o) => o !== this && o.alive && G.dist(o.cx, o.cy, x, y) < 15)) continue;
        if (!w.findPath(this.cx, this.cy, x, y, w.maxNodes)) continue;
        const score = w.foodAround(x, y, 7) - r * 0.5;
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
      return best;
    }

    // 계절이 바뀔 때: 가을엔 추수 축제, 봄엔 봄맞이
    seasonal(sim, season) {
      if (!this.members.length || this.bandit) return;
      if (season === 2 || season === 0) {
        const avgHappy = this.members.reduce((s, m) => s + m.happy, 0) / this.members.length;
        const p = season === 2 ? 0.55 : 0.25;
        // 흉흉한 일이 이어지면 축제를 열지 않는다
        if (!(this.dread > sim.year) && this.members.length >= 6 && avgHappy > 50 && this.stock.food > this.members.length * 3 && sim.year - (this.lastFestival || -99) >= 2 && chance(p)) {
          G.Social.festival(sim, this, season === 2 ? '추수 축제' : '봄맞이 축제');
        }
      }
    }

    // part: 'econ' = 활동 시간 기준(살림), 'life' = 달력 기준(정치·외교)
    yearly(sim, part = 'all') {
      const econ = part !== 'life', life = part !== 'econ';
      this.members = this.members.filter((m) => m.alive && m.tribe === this);
      if (!this.members.length) { sim.destroyTribe(this, '마지막 한 사람까지 사라졌습니다'); return; }
      if (!this.chief || !this.chief.alive || this.chief.tribe !== this) this.electChief(sim);
      // 식량은 해마다 조금씩 상한다 (달력 기준)
      if (life) this.stock.food = Math.floor(this.stock.food * (this.has('토기') ? 0.92 : 0.85));

      if (econ) {
      // 집 짓기
      let built = 0;
      while (this.houses.length * 4 < this.members.length + 2 && this.stock.wood >= 6 && built < 3) {
        if (!this.buildHouse(sim)) break;
        built++;
        if ([5, 10, 20, 30].includes(this.houses.length)) this.log(sim, `${this.name}의 마을에 집이 ${this.houses.length}채가 되었습니다`);
      }

      // 신전
      const avgFaith = this.members.reduce((s, m) => s + m.faith, 0) / this.members.length;
      if (!this.temple && avgFaith > 50 && this.stock.wood >= 15 && this.members.length >= 8) {
        this.temple = true; this.stock.wood -= 15;
        this.log(sim, `${josa(this.name, '이/가')} 신을 모시는 신전을 세웠습니다`);
      }

      if (this.has('관개')) {
        const w = sim.world;
        for (let y = Math.floor(this.cy - 8); y <= this.cy + 8; y++) for (let x = Math.floor(this.cx - 8); x <= this.cx + 8; x++) {
          if (w.inb(x, y) && w.farm[w.idx(x, y)]) w.fert[w.idx(x, y)] = Math.max(w.fert[w.idx(x, y)], 2.2);
        }
      }

      }
      if (life) {
      // 경비병이 없어도 마을 사람들이 수배자를 붙잡아 재판한다
      if (!this.bandit) {
        for (const m of [...this.members]) {
          if (!m.wanted || m.jail || m.held || m === this.chief || !chance(0.5)) continue;
          m.wanted = false;
          m.log(sim, '마을 사람들에게 붙잡혔다');
          // 성난 사람들이 재판 없이 죽이기도 한다
          if (G.Crime3.lynch(sim, this, m)) continue;
          G.Crime.trial(sim, this, m);
        }
      }

      }
      if (econ) {
      // 도구는 닳는다
      this.tools = Math.floor(this.tools * 0.9);
      }
      if (life) {
      // 감옥: 사람이 많거나 범죄가 잦으면 짓는다
      if (!this.jail && !this.bandit && this.stock.wood >= 20 && (this.members.length >= 16 || (this.members.length >= 8 && (this.crimeHeat || 0) >= 2))) {
        for (let k = 0; k < 20; k++) {
          const a = Math.random() * Math.PI * 2, r = rand(3, 5);
          const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
          if (!sim.world.walkable(x, y) || this.houses.some((hs) => Math.hypot(hs.x - x, hs.y - y) < 1.4)) continue;
          this.jail = { x, y };
          this.stock.wood -= 20;
          this.log(sim, `${josa(this.name, '이/가')} 감옥을 지었습니다`);
          break;
        }
      }
      this.crimeHeat = Math.max(0, (this.crimeHeat || 0) * 0.6);
      }
      if (econ) {
      this.farmCount = sim.world.countFarms(this.cx, this.cy, 8);
      this.hasWater = !!sim.world.findShore(this.cx, this.cy, 18);
      this.hasPrey = sim.animals.some((a) => a.alive && !a.tame && G.dist(a.x, a.y, this.cx, this.cy) < 26);
      this.hasBeasts = !!G.Wild.near(sim, this.cx, this.cy, 32, G.Wild.isBeast);
      this.hasTameable = !!G.Wild.near(sim, this.cx, this.cy, 22, (a) => !a.tame && G.Wild.TAMEABLE.includes(a.kind) && a.kind !== 'wolf');
      this.herd = G.Wild.livestock(sim, this).length;
      }
      if (life) {
      this.beastHeat = (this.beastHeat || 0) * 0.5;
      // 도적단은 가장 가까운 마을을 노린다
      if (this.bandit && !this.wars.size && this.members.length >= 3) {
        const target = sim.tribes.filter((o) => o.alive && !o.bandit && o.members.length).sort((a, b) => G.dist(a.cx, a.cy, this.cx, this.cy) - G.dist(b.cx, b.cy, this.cx, this.cy))[0];
        if (target && G.dist(target.cx, target.cy, this.cx, this.cy) < 60 && chance(0.5)) sim.declareWar(this, target);
      }

      }
      if (econ) {
      // 광석으로 금화 만들기 (대장장이가 있으면 도구용으로 남긴다)
      const hasSmith = this.members.some((m) => m.job === J.SMITH);
      if (this.stock.ore >= (hasSmith ? 12 : 4)) {
        const m = Math.floor(this.stock.ore * 0.5);
        this.stock.ore -= m; this.treasury += m * 4;
      }
      // 장인과 농사에서 나오는 기본 수입
      this.treasury += this.members.length * 2;
      // 상인에게 밑천
      for (const m of this.members) {
        if (m.job === J.MERCHANT && m.gold < 15 && this.treasury > 30) { this.treasury -= 20; m.gold += 20; }
      }
      // 부자에게 세금
      for (const m of this.members) {
        if (m.gold > 60) { const tax = Math.floor(m.gold * 0.1); m.gold -= tax; this.treasury += tax; }
      }

      // 기근
      if (this.stock.food < 1 && this.members.length >= 6 && chance(0.4)) this.log(sim, `${this.name}에 기근이 들었습니다`);


      // 직업 재조정 (일부만)
      for (const m of this.members) {
        if (m.adult && m !== this.chief && chance(0.15)) this.assignJob(sim, m);
      }

      }
      if (life) {
      // 외교
      for (const o of sim.tribes) {
        if (o === this || !o.alive || o.id < this.id) continue;
        const d = G.dist(this.cx, this.cy, o.cx, o.cy);
        let delta = (d < 30 ? -3 : 0) + rand(-3, 3);
        for (const c of [this.chief, o.chief]) {
          if (!c) continue;
          if (c.has('야심찬')) delta -= 3;
          if (c.has('용감한')) delta -= 1;
          if (c.has('너그러운')) delta += 3;
          if (c.has('겁많은')) delta += 2;
        }
        if (this.stock.food < this.members.length) delta -= 2;
        delta += G.Crime3.atrocityPenalty(this, o, sim.year); // 학살의 기억
        sim.changeRel(this, o, delta);
        const rel = sim.getRel(this, o);
        const atWar = this.wars.has(o.id);
        if (!atWar && rel < -60 && this.members.length >= 5 && o.members.length >= 5 && chance(0.4)) {
          sim.declareWar(this, o);
        }
      }
      for (const id of [...this.wars]) {
        const o = sim.tribeById(id);
        if (!o || !o.alive) { this.wars.delete(id); continue; }
        const years = sim.year - this.warStart[id];
        if (years >= 3 || this.members.length < 4 || o.members.length < 4 || (years >= 1 && chance(0.35))) sim.makePeace(this, o);
      }

      this.hasOre = !!sim.world.findResource(this.cx, this.cy, 'ore', 20);

      }
      if (econ) {
      // 기근이 심하면 더 비옥한 땅으로 이주
      const around = sim.world.foodAround(this.cx, this.cy, 7);
      if (this.stock.food < this.members.length && around < this.members.length * 4 && chance(0.6)) {
        const site = this.findSite(sim, 8, 35, around * 1.5);
        if (site) {
          this.cx = site.x; this.cy = site.y;
          this.stock.wood += this.houses.length * 3; this.houses = []; this.temple = false;
          this.log(sim, `${josa(this.name, '이/가')} 굶주림을 피해 새 땅으로 이주했습니다`);
          if (this.jail) { this.stock.wood += 10; G.Crime.jailDestroyed(sim, this); }
          for (const m of this.members) {
            if (m.jail) continue;
            m.goTo(sim, site.x + rand(-2, 2), site.y + rand(-2, 2), { kind: 'wander' });
            if (m.adult) m.log(sim, '부족과 함께 새 땅으로 이주했다');
          }
        }
      }

      }
      // 분열
      if (life && !this.bandit && this.members.length > 32 && chance(0.35)) sim.splitTribe(this);
    }
  }

  G.Tribe = Tribe;
})();
