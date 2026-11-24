// 세계 전체 시뮬레이션: 시간, 사회, 신의 권능
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa, shuffle } = G;
  const J = G.JOB;
  const T = G.T;
  const CELL = 4;

  G.POWERS = {
    inspect: { name: '살펴보기', cost: 0, icon: '◎', desc: '인간, 마을, 땅을 눌러 자세히 보기' },
    create: { name: '인간 창조', cost: 20, icon: '☺', desc: '남녀 한 쌍을 만든다' },
    rain: { name: '비', cost: 15, icon: '☂', desc: '땅이 비옥해지고 식량이 자란다' },
    bless: { name: '축복', cost: 25, icon: '✦', desc: '건강과 배부름, 신앙이 오른다' },
    lightning: { name: '번개', cost: 10, icon: 'ϟ', desc: '한 점을 내려친다. 보는 이는 두려워한다' },
    meteor: { name: '운석', cost: 80, icon: '☄', desc: '큰 재앙. 구덩이에 광석이 남는다' },
    cupid: { name: '사랑의 화살', cost: 15, icon: '♥', desc: '두 사람을 차례로 누르면 사랑에 빠진다. 짝이 있는 사람이면 금지된 사랑이 된다' },
    heal: { name: '치유', cost: 20, icon: '✚', desc: '주변 사람의 상처와 마음의 병, 스트레스, 원한을 씻어 준다' },
    fertility: { name: '다산', cost: 20, icon: '✿', desc: '주변 부부에게 아이가 생기기 쉬워지고 출산이 안전해진다' },
    discord: { name: '불화', cost: 15, icon: '☁', desc: '주변 사람들이 서로 미워하고 다툰다' },
    carry: { name: '사람 옮기기', cost: 10, icon: '✋', desc: '사람을 집어 다른 곳에 내려놓는다. 낯선 곳이면 길을 잃고 헤매다 집을 찾거나 그곳에 적응한다' },
    revelation: { name: '계시', cost: 25, icon: '☼', desc: '한 사람에게 꿈으로 깨달음을 준다. 지식이 크게 늘고 부족의 발견이 빨라진다' },
    quake: { name: '지진', cost: 40, icon: '≋', desc: '땅이 흔들려 집·신전·감옥이 무너지고 사람이 다친다' },
    plague: { name: '역병', cost: 30, icon: '☣', desc: '옮는 병을 퍼뜨린다. 가까이 있는 사람에게 번진다' },
    beasts: { name: '짐승 무리', cost: 15, icon: '♞', desc: '사슴·멧돼지·산양 같은 짐승 무리를 불러온다' },
    judgment: { name: '신의 재판', cost: 30, icon: '⚖', desc: '한 사람을 누른다. 숨긴 죄가 있으면 번개로 드러내고, 누명을 썼으면 신탁으로 벗겨 준다' },
    raise: { name: '땅 올리기', cost: 1, icon: '▲', desc: '누르고 있으면 땅이 솟는다' },
    lower: { name: '땅 내리기', cost: 1, icon: '▼', desc: '누르고 있으면 땅이 꺼진다' },
  };

  class Sim {
    constructor(seed, opts = {}) {
      const W = opts.W || G.CFG.W, H = opts.H || G.CFG.H;
      this.opts = { pop: 8, animals: 1, ...opts };
      this.world = new G.World(W, H, seed ?? Math.floor(Math.random() * 1e9));
      G.Fire.init(this);
      this.humans = [];
      this.byId = new Map();     // 살아있는 사람만
      this.tribes = [];
      this.usedTribeNames = new Set();
      this.archive = [];         // 죽은 사람의 요약 기록
      this.archiveById = new Map();
      this.events = [];
      this.effects = [];
      this.scheduled = [];
      this.relations = new Map();
      this.tick = 0; this.year = 0;
      this.bt = 0;   // 달력 시간 (기본 시간 단위, 1년 = 600)
      this.at = 0;   // 활동 시간 (배고픔·일·휴식)
      this.setTimeMode(opts.time || 'normal');
      this.lastSeason = 0;
      this.lastPrayEvent = -99;
      this.faith = 120; this.faithRate = 0;
      this.drought = 0;
      this.lastPrayEvent = -9999;
      this.stats = { births: 0, deaths: 0, trades: 0, wars: 0, maxPop: 0 };
      this.cols = Math.ceil(W / CELL); this.rows = Math.ceil(H / CELL);
      this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
      this.popMilestone = 0;
      this.animals = [];
      this.unsolved = [];        // 범인을 모르는 살인 사건
      this.spawnInitial();
      G.Wild.init(this, this.opts.animals);
    }

    // ---------------- 시작 ----------------
    spawnInitial() {
      const w = this.world;
      let spot = null;
      for (let k = 0; k < 400 && !spot; k++) {
        const x = randi(w.w * 0.3, w.w * 0.7), y = randi(w.h * 0.3, w.h * 0.7);
        if (w.type[w.idx(x, y)] === T.GRASS) spot = { x: x + 0.5, y: y + 0.5 };
      }
      if (!spot) spot = w.nearestWalkable(w.w / 2, w.h / 2, 60) || { x: w.w / 2, y: w.h / 2 };
      this.start = spot;
      const n0 = this.opts.pop;
      for (let i = 0; i < n0; i++) {
        const p = w.nearestWalkable(spot.x + rand(-3, 3), spot.y + rand(-3, 3), 5) || spot;
        const h = this.spawnHuman(p.x, p.y, { gender: i % 2 ? 'F' : 'M' });
        h.camp = { x: spot.x, y: spot.y };
        h.log(this, '이 섬에서 눈을 떴다');
      }
      this.event(`신이 깨어났습니다. 섬에 ${n0}명의 인간이 살고 있습니다`, '#f5d76e', spot.x, spot.y);
    }

    spawnHuman(x, y, o) {
      const h = new G.Human(this, x, y, o);
      this.humans.push(h);
      this.byId.set(h.id, h);
      return h;
    }

    // ---------------- 한 틱 ----------------
    // ---------------- 시간 ----------------
    setTimeMode(k) {
      const M = G.TIME_MODES[k] || G.TIME_MODES.normal;
      this.timeMode = G.TIME_MODES[k] ? k : 'normal';
      this.mode = M;
      this.pace = M.pace;
      this.dt = G.CFG.BPD / M.tpd;
    }
    get day() { return Math.floor(this.bt / G.CFG.BPD); }
    get dayOfYear() { return this.day % G.CFG.DAYS; }
    get season() { return Math.floor(this.dayOfYear / 10); }
    get hour() { return (this.bt / G.CFG.BPD % 1) * 24; }
    isNight() { const h = this.hour; return h >= 21 || h < 5; }
    sleepTime() { return this.mode.sleep && this.isNight(); }
    // 밤의 어둡기 0~1 (해질녘·새벽은 중간)
    darkness() {
      if (!this.mode.night) return 0;
      const h = this.hour;
      if (h >= 21 || h < 4) return 1;
      if (h >= 18) return (h - 18) / 3;
      if (h < 6) return 1 - (h - 4) / 2;
      return 0;
    }
    regrowMult() { return (this.drought ? 0.3 : 1) * [1.25, 1.05, 0.9, 0.35][this.season]; }

    step() {
      this.tick++;
      G.curSim = this;
      const pBt = this.bt, pAt = this.at;
      this.bt += this.dt; this.at += this.pace;
      this.year = this.bt / G.CFG.TPY;
      const cross = (a, b, n) => Math.floor(b / n) !== Math.floor(a / n);
      this.rebuildBuckets();
      const hs = this.humans;
      for (let i = 0; i < hs.length; i++) if (hs[i].alive) hs[i].update(this);
      G.Wild.tick(this);
      G.Weather.tick(this);
      if (cross(pAt, this.at, 10)) this.world.regrow(this.regrowMult());
      if (cross(pBt, this.bt, 10)) G.Fire.tick(this);
      if (cross(pBt + 30, this.bt + 30, 60)) { G.Fire.regrow(this); G.Blood.expire(this); G.Weather.lifeTick(this); }
      if (cross(pAt, this.at, 60)) { G.Social.activityTick(this); this.computeFaith(); }
      if (cross(pBt, this.bt, 60)) this.social();
      if (cross(pBt, this.bt, G.CFG.TPY)) this.yearly();
      // 살림(세금·수입·식량 상함·집 짓기·동물 번식)은 활동 시간 기준으로 한 해가 지날 때
      if (cross(pAt, this.at, G.CFG.TPY)) { for (const t of this.tribes) if (t.alive) t.yearly(this, 'econ'); G.Wild.yearly(this); }
      if (this.season !== this.lastSeason) this.seasonChange();
      if (this.tick % 30 === 0) this.humans = this.humans.filter((h) => h.alive);
      this.faith += this.faithRate;
      // 예약된 일 (운석 낙하 등)
      for (let i = this.scheduled.length - 1; i >= 0; i--) {
        const s = this.scheduled[i];
        if (--s.t <= 0) { this.scheduled.splice(i, 1); s.fn(); }
      }
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.age++;
        if (e.age >= e.ttl) this.effects.splice(i, 1);
      }
    }

    rebuildBuckets() {
      for (const b of this.buckets) b.length = 0;
      for (const h of this.humans) {
        if (!h.alive) continue;
        const cx = clamp(Math.floor(h.x / CELL), 0, this.cols - 1), cy = clamp(Math.floor(h.y / CELL), 0, this.rows - 1);
        this.buckets[cy * this.cols + cx].push(h);
      }
    }

    near(x, y, r, fn) {
      const x0 = clamp(Math.floor((x - r) / CELL), 0, this.cols - 1), x1 = clamp(Math.floor((x + r) / CELL), 0, this.cols - 1);
      const y0 = clamp(Math.floor((y - r) / CELL), 0, this.rows - 1), y1 = clamp(Math.floor((y + r) / CELL), 0, this.rows - 1);
      const r2 = r * r;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          for (const h of this.buckets[cy * this.cols + cx]) {
            if (!h.alive) continue;
            const dx = h.x - x, dy = h.y - y;
            if (dx * dx + dy * dy <= r2) fn(h);
          }
        }
      }
    }

    nearestEnemy(h, r) {
      let best = null, bd = 1e9;
      if (!h.tribe) return null;
      this.near(h.x, h.y, r, (o) => {
        if (!o.tribe || !h.tribe.wars.has(o.tribe.id)) return;
        const d = G.dist(h.x, h.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      });
      return best;
    }

    computeFaith() {
      let s = 0;
      for (const h of this.humans) if (h.alive) s += h.faith * (h.job === J.PRIEST ? 2 : 1);
      for (const t of this.tribes) if (t.alive && t.temple) s += t.members.length * 15;
      for (const t of this.tribes) if (t.alive && t.has('천문학')) s += t.members.length * 8;
      this.faithRate = s * 0.00008;
    }

    // ---------------- 사회 (60틱마다) ----------------
    social() {
      // 마음·범죄·질병·결혼·임신 (달력 기준). 수다와 연애 감정은 activityTick (활동 기준)
      G.Social.lifeTick(this);
      G.Crime.investigate(this);
      G.Crime3.social(this);
      G.Migrate.social(this);
      this.tribelessGathering();
      if (this.humans.length > this.stats.maxPop) this.stats.maxPop = this.humans.length;
      const ms = [20, 50, 100, 200, 400, 800];
      for (const m of ms) {
        if (this.humans.length >= m && this.popMilestone < m) {
          this.popMilestone = m;
          this.event(`세상의 인구가 ${m}명을 넘었습니다`, '#f5d76e');
        }
      }
    }

    isRelative(a, b) {
      const pa = a.parents.map((p) => p.id), pb = b.parents.map((p) => p.id);
      if (pa.includes(b.id) || pb.includes(a.id)) return true;
      return pa.some((id) => pb.includes(id));
    }

    birth(mom, dad) {
      const x = mom.x + rand(-0.3, 0.3), y = mom.y + rand(-0.3, 0.3);
      const c = this.spawnHuman(x, y, {
        age: 0,
        parents: [{ id: mom.id, name: mom.name }, { id: dad.id, name: dad.name }],
        traits: G.makeTraits([...mom.traits, ...dad.traits]),
        faith: (mom.faith + dad.faith) / 2,
      });
      c.log(this, `${josa(mom.name, '과/와')} ${dad.name} 사이에서 태어났다`);
      const kind = c.gender === 'M' ? '아들' : '딸';
      mom.log(this, `${kind} ${josa(c.name, '을/를')} 낳았다`);
      mom.children.push(c.id);
      if (dad.alive && dad.log) { dad.log(this, `${kind} ${josa(c.name, '이/가')} 태어났다`); dad.children.push(c.id); }
      else c.log(this, `아버지 ${josa(dad.name, '은/는')} 태어나기 전에 세상을 떠났다`);
      mom.lastBirth = this.year;
      mom.say('♥', 60);
      if (mom.tribe) { mom.tribe.add(this, c); mom.tribe.births++; }
      this.stats.births++;
      return c;
    }

    // 부족 없는 사람들이 모이면 부족을 세우고, 마을 근처면 합류한다
    tribelessGathering() {
      const loners = this.humans.filter((h) => h.alive && !h.tribe && h.adult);
      for (const h of shuffle(loners)) {
        if (h.tribe || h.hermit || h.trek || h.lost || h.abducted) continue;
        // 근처 마을에 합류 (무법자는 오랜 세월이 지나야 받아준다)
        let joined = false;
        for (const t of this.tribes) {
          if (!t.alive) continue;
          if (G.dist(h.x, h.y, t.cx, t.cy) < 8 && chance(0.25) && G.Crime.canJoin(this, h, t)) {
            G.Crime.redeem(this, h, t);
            t.add(this, h);
            h.log(this, `${t.name}에 합류했다`);
            this.bringChildren(h, t);
            joined = true; break;
          }
        }
        if (joined) continue;
        const group = [];
        this.near(h.x, h.y, 5, (o) => { if (!o.tribe && o.adult && !o.hermit && !o.trek && !o.lost && !!o.outlaw === !!h.outlaw) group.push(o); });
        if (group.length >= 3) h.together++;
        else h.together = Math.max(0, h.together - 1);
        if (h.together >= 8 && chance(0.3)) {
          if (h.outlaw) G.Crime.foundBandits(this, h, group);
          else this.foundTribe(h, group);
        }
      }
    }

    bringChildren(h, t) {
      for (const cid of h.children) {
        const c = this.byId.get(cid);
        if (c && c.alive && !c.tribe && !c.adult) t.add(this, c);
      }
    }

    foundTribe(founder, group) {
      const w = this.world;
      for (const t of this.tribes) {
        if (t.alive && !t.bandit && G.dist(founder.x, founder.y, t.cx, t.cy) < 12) { t.add(this, founder); return; }
      }
      const p = w.nearestWalkable(founder.x, founder.y, 3);
      if (!p) return;
      const t = new G.Tribe(this, p.x, p.y);
      this.tribes.push(t);
      t.chief = founder;
      t.add(this, founder);
      founder.job = J.CHIEF;
      founder.log(this, `${josa(t.name, '을/를')} 세우고 족장이 되었다`);
      for (const o of group.slice(0, 10)) {
        if (o === founder || o.tribe) continue;
        t.add(this, o);
        o.log(this, `${josa(founder.name, '과/와')} 함께 ${josa(t.name, '을/를')} 세웠다`);
      }
      for (const m of [...t.members]) this.bringChildren(m, t);
      t.log(this, `${josa(founder.name, '이/가')} ${josa(t.name, '을/를')} 세웠습니다`);
    }

    splitTribe(t) {
      const w = this.world;
      const cands = t.adults().filter((m) => m !== t.chief && !m.jail);
      if (cands.length < 6) return;
      const leader = cands.find((m) => m.has('야심찬')) || pick(cands);
      const site = t.findSite(this, 18, 45, 40);
      if (!site) return;
      const nt = new G.Tribe(this, site.x, site.y);
      this.tribes.push(nt);
      const movers = new Set([leader]);
      for (const m of shuffle(cands)) if (movers.size < t.members.length / 5 && m !== t.chief) movers.add(m);
      for (const m of [...movers]) {
        if (m.partner && m.partner.alive && m.partner.tribe === t && m.partner !== t.chief) movers.add(m.partner);
        if (m.lover && m.lover.alive && m.lover.tribe === t && m.lover !== t.chief) movers.add(m.lover);
      }
      for (const m of [...movers]) {
        for (const cid of m.children) {
          const c = this.byId.get(cid);
          if (c && c.alive && !c.adult && c.tribe === t) movers.add(c);
        }
      }
      nt.chief = leader;
      for (const m of movers) {
        nt.add(this, m);
        m.goTo(this, site.x + rand(-2, 2), site.y + rand(-2, 2), { kind: 'wander' });
        if (m !== leader) m.log(this, `${josa(leader.name, '을/를')} 따라 ${josa(t.name, '을/를')} 떠났다`);
      }
      leader.job = J.CHIEF;
      leader.log(this, `${josa(t.name, '을/를')} 떠나 ${josa(nt.name, '을/를')} 세웠다`);
      for (const r of ['food', 'wood']) { const m = Math.floor(t.stock[r] * 0.3); t.stock[r] -= m; nt.stock[r] += m; }
      const g = Math.floor(t.treasury * 0.3); t.treasury -= g; nt.treasury += g;
      this.setRel(t, nt, -15);
      t.log(this, `${josa(leader.name, '이/가')} ${movers.size}명을 이끌고 ${josa(t.name, '을/를')} 떠나 ${josa(nt.name, '을/를')} 세웠습니다`);
    }

    destroyTribe(t, why) {
      if (!t.alive) return;
      t.alive = false;
      for (const o of this.tribes) o.wars.delete(t.id);
      for (const m of [...t.members]) t.remove(this, m);
      t.log(this, `${josa(t.name, '이/가')} 사라졌습니다. ${why}`);
    }

    tribeById(id) { return this.tribes.find((t) => t.id === id && t.alive) || null; }

    // ---------------- 외교 ----------------
    relKey(a, b) { return a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id; }
    getRel(a, b) { return this.relations.get(this.relKey(a, b)) || 0; }
    setRel(a, b, v) { this.relations.set(this.relKey(a, b), clamp(v, -100, 100)); }
    changeRel(a, b, d) { this.setRel(a, b, this.getRel(a, b) + d); }

    declareWar(a, b) {
      a.wars.add(b.id); b.wars.add(a.id);
      a.warStart[b.id] = this.year; b.warStart[a.id] = this.year;
      this.stats.wars++;
      a.log(this, `${josa(a.name, '이/가')} ${b.name}에 전쟁을 선포했습니다`);
      b.log(this, `${a.name}의 공격이 시작되었습니다`, false);
      for (const t of [a, b]) for (const m of t.members) if (m.adult && m !== t.chief && chance(0.3)) t.assignJob(this, m);
    }

    makePeace(a, b) {
      a.wars.delete(b.id); b.wars.delete(a.id);
      this.setRel(a, b, 0);
      const [win, lose] = a.members.length >= b.members.length ? [a, b] : [b, a];
      const tribute = Math.floor(lose.treasury * 0.3);
      lose.treasury -= tribute; win.treasury += tribute;
      a.log(this, `${josa(a.name, '과/와')} ${b.name}의 전쟁이 끝났습니다. ${josa(lose.name, '이/가')} 금화 ${tribute}개를 바쳤습니다`);
      b.log(this, `${a.name}과(와) 평화를 맺었다`, false);
      for (const t of [a, b]) for (const m of t.members) if (m.job === J.WARRIOR && chance(0.6)) t.assignJob(this, m);
    }

    // ---------------- 계절 ----------------
    seasonChange() {
      this.lastSeason = this.season;
      this.world.dirty = true;
      const s = G.SEASONS[this.season];
      if (this.timeMode !== 'vfast') this.event(`${Math.floor(this.year)}년 ${josa(s, '이/가')} 왔습니다${this.season === 3 ? '. 곡식이 자라지 않습니다' : this.season === 2 ? '. 추수의 계절입니다' : ''}`, ['#9be36b', '#f5d76e', '#f0a050', '#cfe6ff'][this.season]);
      for (const t of this.tribes) if (t.alive) t.seasonal(this, this.season);
    }

    // ---------------- 해마다 ----------------
    yearly() {
      for (const t of this.tribes) if (t.alive) t.yearly(this, 'life');
      G.Crime3.yearly(this);
      G.Migrate.yearly(this);
      if (!this.drought && this.year > 3 && chance(0.06)) {
        this.drought = randi(1, 2);
        this.event('가뭄이 시작되었습니다. 땅이 메마릅니다', '#e0a040');
      } else if (this.drought) {
        this.drought--;
        if (!this.drought) this.event('가뭄이 끝났습니다', '#7fc8f8');
      }
    }

    // ---------------- 죽음과 기록 ----------------
    kill(h, cause, killer) {
      if (!h.alive) return;
      h.alive = false;
      h.deathCause = cause;
      h.died = this.year;
      const age = Math.floor(h.age);
      h.log(this, cause === '살인' ? `${killer.name}에게 목숨을 잃었다 (${age}세)`
        : killer ? `${killer.tribe ? killer.tribe.name + '의 ' : ''}${killer.name}에게 쓰러졌다 (${age}세)` : `${josa(cause, '으로/로')} 세상을 떠났다 (${age}세)`);
      if (cause === '전투') {
        for (const cid of h.children) { const c = this.byId.get(cid); if (c && c.alive) G.Mind.trauma(this, c, 0.15, '전쟁에서 부모를 잃고'); }
        if (h.partner && h.partner.alive) G.Mind.trauma(this, h.partner, 0.15, '전쟁에서 배우자를 잃고');
      }
      const S = G.Social;
      if (h.partner && h.partner.alive) {
        h.partner.log(this, `배우자 ${josa(h.name, '을/를')} 잃었다`);
        S.addMood(this, h.partner, 'widowed'); h.partner.say('…', 200);
        h.partner.partner = null;
      }
      if (h.lover && h.lover.alive) {
        h.lover.log(this, `연인 ${josa(h.name, '을/를')} 잃었다`);
        S.addMood(this, h.lover, 'widowed', 0.6); h.lover.lover = null;
      }
      for (const p of h.parents) {
        const pp = this.byId.get(p.id);
        if (pp && pp.alive) { S.addMood(this, pp, 'lostChild'); pp.log(this, `${h.gender === 'M' ? '아들' : '딸'} ${josa(h.name, '을/를')} 잃었다`); }
      }
      // 친구들의 슬픔
      for (const o of this.humans) {
        if (!o.alive || o === h) continue;
        const r = o.rel.get(h.id);
        if (r && r.v >= 50 && !S.isFamily(o, h.id)) {
          S.addMood(this, o, 'lostFriend');
          if (r.v >= 75) o.log(this, `절친 ${josa(h.name, '이/가')} 세상을 떠나 슬퍼했다`);
        }
      }
      let n = 0;
      for (const cid of h.children) {
        const c = this.byId.get(cid);
        if (c && c.alive && n++ < 6) { c.log(this, `${h.gender === 'M' ? '아버지' : '어머니'} ${josa(h.name, '이/가')} 세상을 떠났다`); S.addMood(this, c, 'lostParent'); }
      }
      const t = h.tribe;
      const wasChief = t && t.chief === h;
      if (t) { t.remove(this, h); t.deaths++; }
      this.stats.deaths++;
      this.byId.delete(h.id);
      // 기록관에 요약만 남긴다 (큰 객체는 버려서 메모리를 아낀다)
      const rec = {
        id: h.id, name: h.name, gender: h.gender, born: Math.floor(h.born), died: Math.floor(this.year), age,
        cause: cause === '살인' ? '살인' : killer ? '전투' : cause, tribe: t ? t.name : null, color: t ? t.color : '#aaa', job: h.job,
        kills: h.kills, gold: h.gold, traits: h.traits, parents: h.parents, children: h.children.slice(),
        murders: h.murders, crimes: h.crimes.filter((c) => c.known).map((c) => c.type), mind: h.mind ? h.mind.c : null, outlaw: h.outlaw,
        story: h.story.slice(-15), notable: wasChief || h.kills >= 3 || age >= 75 || h.miracles >= 3 || h.murders > 0 || cause === '살인',
      };
      this.archive.push(rec);
      this.archiveById.set(rec.id, rec);
      if (this.archive.length > G.CFG.ARCHIVE_CAP) {
        let i = this.archive.findIndex((r) => !r.notable);
        if (i < 0) i = 0;
        const [gone] = this.archive.splice(i, 1);
        this.archiveById.delete(gone.id);
      }
      if (wasChief) t.log(this, `${t.name}의 ${t.title} ${josa(h.name, '이/가')} ${josa(killer ? '전투' : cause, '으로/로')} 세상을 떠났습니다`);
      else if (age >= 80) this.event(`${josa(h.name, '이/가')} ${age}세로 긴 삶을 마쳤습니다`, '#aaa', h.x, h.y);
      if (this.stats.deaths === 1) this.event(`세상에 첫 죽음이 찾아왔습니다. ${josa(h.name, '이/가')} 숨졌습니다`, '#aaa', h.x, h.y);
      this.effects.push({ kind: 'soul', x: h.x, y: h.y, age: 0, ttl: 90 });
      // 싸우다 죽거나 맹수에게 당하면 피가 고인다 (살인은 crime.js에서)
      if (cause !== '살인' && (killer || ['전투', '반역', '늑대', '호랑이', '곰', '상처'].includes(cause) || /사냥 중 사고/.test(cause))) G.Blood.splash(this, h.x, h.y, 3, 0.8, 'pool');
    }

    event(text, color = '#ddd', x, y) {
      this.events.unshift({ y: Math.floor(this.year), t: text, c: color, x, yy: y });
      if (this.events.length > G.CFG.EVENT_CAP) this.events.pop();
    }

    // ---------------- 신의 권능 ----------------
    power(kind, x, y) {
      const P = G.POWERS[kind];
      if (!P || kind === 'inspect') return { ok: false };
      if (this.faith < P.cost) return { ok: false, msg: `신앙이 부족합니다 (필요 ${P.cost})` };
      const w = this.world;
      const witness = (r, fn) => this.near(x, y, r, fn);
      switch (kind) {
        case 'create': {
          const p = w.nearestWalkable(x, y, 3);
          if (!p) return { ok: false, msg: '물 위에는 만들 수 없습니다' };
          const a = this.spawnHuman(p.x - 0.2, p.y, { gender: 'M', faith: 80, age: rand(17, 22) });
          const b = this.spawnHuman(p.x + 0.2, p.y, { gender: 'F', faith: 80, age: rand(17, 22) });
          for (const h of [a, b]) { h.log(this, '신의 손에서 빚어져 태어났다'); h.miracles++; h.camp = { x: p.x, y: p.y }; }
          this.effects.push({ kind: 'bless', x: p.x, y: p.y, r: 2, age: 0, ttl: 60 });
          this.effects.push({ kind: 'beam', x: p.x, y: p.y, age: 0, ttl: 70 });
          this.event(`신이 ${josa(a.name, '과/와')} ${josa(b.name, '을/를')} 빚어냈습니다`, '#f5d76e', p.x, p.y);
          break;
        }
        case 'rain': {
          const r = 7;
          for (let ty = Math.floor(y - r); ty <= y + r; ty++) for (let tx = Math.floor(x - r); tx <= x + r; tx++) {
            if (!w.inb(tx, ty) || Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r) continue;
            const i = w.idx(tx, ty);
            if (w.type[i] === T.GRASS || w.type[i] === T.FOREST) { w.fert[i] = Math.min(2.5, w.fert[i] + 0.7); w.food[i] += 1.5; }
          }
          w.dirty = true;
          witness(r + 2, (h) => {
            h.faith = Math.min(100, h.faith + (h.has('의심 많은') ? 2 : 5)); G.Social.addMood(this, h, 'rain');
            if (this.year - (h.lastRainLog || -99) > 2) { h.lastRainLog = this.year; h.log(this, '신이 내린 비를 맞았다'); }
            h.miracles++;
          });
          this.effects.push({ kind: 'rain', x, y, r, age: 0, ttl: 150 });
          G.Fire.rain(this, x, y, r);
          if (G.Blood.wash(this, x, y, r)) this.event('신이 내린 비가 땅의 핏자국을 씻어 냈습니다', '#7fc8f8', x, y);
          break;
        }
        case 'bless': {
          let n = 0;
          witness(5, (h) => {
            h.health = 100; h.hunger = Math.max(0, h.hunger - 40);
            h.faith = Math.min(100, h.faith + (h.has('의심 많은') ? 7 : 15)); G.Social.addMood(this, h, 'blessed');
            h.log(this, '신의 축복을 받았다'); h.miracles++; h.say('✦', 90); n++;
          });
          this.effects.push({ kind: 'bless', x, y, r: 5, age: 0, ttl: 70 });
          if (n) this.event(`${n}명이 신의 축복을 받았습니다`, '#f5d76e', x, y);
          break;
        }
        case 'lightning': {
          const dead = [];
          witness(1.2, (h) => dead.push(h));
          for (const h of dead) this.kill(h, '번개');
          const tx = Math.floor(x), ty = Math.floor(y);
          // 번개는 불을 일으킨다
          if (chance(0.75)) G.Fire.ignite(this, x, y, '번개로');
          if (w.inb(tx, ty)) { w.burnt[w.idx(tx, ty)] = 255; w.dirty = true; }
          this.destroyHouses(x, y, 1.2);
          witness(10, (h) => {
            h.faith = Math.min(100, h.faith + (h.has('의심 많은') ? 4 : 8)); G.Social.addMood(this, h, 'fear');
            if (this.year - (h.lastBoltLog || -99) > 1) { h.lastBoltLog = this.year; h.log(this, '하늘에서 내리친 번개를 보고 두려움에 떨었다'); }
            h.miracles++; h.say('!', 60);
          });
          this.effects.push({ kind: 'bolt', x, y, age: 0, ttl: 22, seed: Math.random() });
          if (dead.length) this.event(`번개가 ${dead.map((d) => d.name).join(', ')}의 목숨을 앗아갔습니다`, '#fff3a0', x, y);
          break;
        }
        case 'cupid': case 'judgment': case 'carry': case 'revelation': return { ok: false, msg: '사람을 눌러 고르세요' };
        case 'quake': G.Migrate.quake(this, x, y); break;
        case 'plague': G.Migrate.plague(this, x, y); break;
        case 'beasts': G.Migrate.beasts(this, x, y); break;
        case 'fertility': G.Social.fertility(this, x, y); break;
        case 'heal': G.Mind.heal(this, x, y); break;
        case 'discord': G.Social.discord(this, x, y); break;
        case 'meteor': {
          this.effects.push({ kind: 'meteor', x, y, age: 0, ttl: 45 });
          this.scheduled.push({ t: 45, fn: () => this.meteorImpact(x, y) });
          break;
        }
        case 'raise':
        case 'lower': {
          w.modifyHeight(x, y, 2.6, kind === 'raise' ? 0.03 : -0.03);
          this.near(x, y, 4, (h) => {
            if (!w.walkable(h.x, h.y)) {
              const p = w.nearestWalkable(h.x, h.y, 3);
              if (p) { h.x = p.x; h.y = p.y; } else this.kill(h, '익사');
            }
          });
          break;
        }
      }
      this.faith -= P.cost;
      G.Crime3.onPower(this, kind, x, y);
      return { ok: true };
    }

    meteorImpact(x, y) {
      const w = this.world;
      w.modifyHeight(x, y, 4, -0.22);
      for (let ty = Math.floor(y - 2); ty <= y + 2; ty++) for (let tx = Math.floor(x - 2); tx <= x + 2; tx++) {
        if (!w.inb(tx, ty)) continue;
        const i = w.idx(tx, ty);
        if (w.type[i] >= T.SAND) { w.ore[i] += 12; w.wood[i] = 0; if (w.type[i] === T.FOREST) w.type[i] = T.GRASS; w.food[i] = 0; }
      }
      w.dirty = true;
      const dead = [];
      this.near(x, y, 3.5, (h) => dead.push(h));
      for (const h of dead) this.kill(h, '운석');
      this.destroyHouses(x, y, 4);
      this.near(x, y, 18, (h) => {
        if (!w.walkable(h.x, h.y)) { const p = w.nearestWalkable(h.x, h.y, 5); if (p) { h.x = p.x; h.y = p.y; } }
        h.faith = Math.min(100, h.faith + (h.has('의심 많은') ? 8 : 15)); G.Social.addMood(this, h, 'terror');
        h.log(this, '하늘에서 불덩이가 떨어지는 것을 보았다'); h.miracles++; h.say('!', 90);
      });
      this.effects.push({ kind: 'boom', x, y, age: 0, ttl: 50 });
      this.effects.push({ kind: 'crater', x, y, age: 0, ttl: 900 });
      // 운석 주위로 불이 붙는다
      let lit = 0;
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(3.5, 6.5);
        if (G.Fire.ignite(this, x + Math.cos(a) * r, y + Math.sin(a) * r, lit ? null : '운석으로')) lit++;
      }
      this.event(dead.length ? `운석이 떨어져 ${dead.length}명이 목숨을 잃었습니다` : '운석이 떨어져 땅에 깊은 구덩이가 생겼습니다', '#ff8a50', x, y);
    }

    destroyHouses(x, y, r) {
      for (const t of this.tribes) {
        if (!t.alive) continue;
        const before = t.houses.length;
        t.houses = t.houses.filter((h) => Math.hypot(h.x - x, h.y - y) > r);
        const lost = before - t.houses.length;
        if (lost) t.log(this, `${t.name}의 집 ${lost}채가 무너졌습니다`, false);
        if (t.temple && Math.hypot(t.cx - x, t.cy - y) < r) { t.temple = false; t.log(this, `${t.name}의 신전이 무너졌습니다`); }
        if (t.jail && Math.hypot(t.jail.x - x, t.jail.y - y) < r + 0.5) { t.log(this, `${t.name}의 감옥이 무너졌습니다`); G.Crime.jailDestroyed(this, t); }
      }
    }

    // 클릭한 곳 근처 찾기
    humanAt(x, y, r) {
      let best = null, bd = r;
      this.near(x, y, r, (h) => { const d = G.dist(h.x, h.y - 0.3, x, y); if (d < bd) { bd = d; best = h; } });
      return best;
    }
    tribeAt(x, y, r) {
      let best = null, bd = r;
      for (const t of this.tribes) { if (!t.alive) continue; const d = G.dist(t.cx, t.cy, x, y); if (d < bd) { bd = d; best = t; } }
      return best;
    }
  }

  G.Sim = Sim;
})();
