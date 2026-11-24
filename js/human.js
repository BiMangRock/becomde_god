// 인간 한 명의 몸, 마음, 이야기
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;

  const J = (G.JOB = {
    CHILD: '아이', NONE: '떠돌이', GATHER: '채집꾼', WOOD: '나무꾼', MINE: '광부',
    MERCHANT: '상인', WARRIOR: '전사', PRIEST: '사제', CHIEF: '족장',
    HUNTER: '사냥꾼', FISHER: '어부', FARMER: '농부', SMITH: '대장장이', HEALER: '치료사', GUARD: '경비병',
  });
  G.JOB_DESC = {
    채집꾼: '열매와 풀을 모은다', 나무꾼: '숲에서 나무를 벤다', 광부: '산에서 광석을 캔다', 상인: '다른 부족과 장사한다',
    전사: '전쟁에서 싸우고 마을을 지킨다', 사제: '의식을 올려 신앙을 모은다', 족장: '부족을 이끌고 재판한다', 사냥꾼: '사슴과 멧돼지를 잡고 늑대를 쫓는다',
    어부: '물가에서 물고기를 잡는다', 농부: '밭을 일구고 곡식을 거둔다', 대장장이: '광석으로 도구를 만들어 일을 빠르게 한다',
    치료사: '다친 사람과 마음이 아픈 사람을 돌본다', 경비병: '범죄자를 쫓고 감옥을 지킨다', 아이: '놀면서 자란다', 떠돌이: '부족 없이 떠돈다',
  };
  const JOB_RES = { [J.GATHER]: 'food', [J.WOOD]: 'wood', [J.MINE]: 'ore' };
  G.RES_NAME = { food: '식량', wood: '나무', ore: '광석' };
  const SKINS = ['#f1c9a5', '#e0ac83', '#c68863', '#a0694a', '#7a4c32'];
  const HAIRS = ['#2b1d14', '#4a2f1d', '#7a4a24', '#b07a3a', '#d9b26a', '#1c1c1c'];

  let NEXT_ID = 1;

  class Human {
    constructor(sim, x, y, o = {}) {
      this.id = NEXT_ID++;
      this.gender = o.gender || (chance(0.5) ? 'M' : 'F');
      this.name = o.name || G.makeName();
      this.age = o.age ?? rand(16, 30);
      this.born = sim.year - this.age;
      this.x = x; this.y = y; this.tx = x; this.ty = y;
      this.hunger = rand(0, 30);
      this.health = 100;
      this.gold = o.gold || 0;
      this.carry = null; this.carryAmt = 0; this.tradeCost = 0;
      this.ration = 0; // 도시락 (부족이 나눠주는 식량)
      this.tribe = null;
      this.job = this.age < 14 ? J.CHILD : J.NONE;
      this.partner = null;   // 배우자
      this.lover = null;     // 결혼 전 연인
      this.affair = null;    // 몰래 만나는 사람 id
      this.rel = new Map();  // id -> {v: 호감 -100~100, love: 사랑 0~100, name}
      this.moodlets = [];    // 기분 요인
      this.pregnant = 0;     // 남은 임신 기간(틱)
      this.babyFather = null;
      this.stress = 0;       // 스트레스 0~100
      this.social = 0;       // 외로움 0~100
      this.mind = null;      // 정신 건강 {c: 병 이름, sev: 심한 정도}
      G.Crime.init(this);
      // 부모·자녀는 객체 대신 {id, name}만 저장 -> 죽은 사람 객체가 메모리에 남지 않음
      this.parents = o.parents || [];
      this.children = [];
      this.traits = o.traits || G.makeTraits();
      this.faith = o.faith ?? rand(25, 55);
      if (this.has('신앙심 깊은')) this.faith = Math.max(this.faith, 60);
      this.happy = 55;
      this.story = [];
      this.alive = true;
      this.state = 'idle'; this.task = null; this.timer = 0; this.stuck = 0;
      this.target = null;
      this.kills = 0;
      this.lastBirth = -99; this.lastPray = -99; this.lastTradeLog = -99;
      this.together = 0;
      this.skin = pick(SKINS); this.hair = pick(HAIRS);
      this.walk = Math.random() * 10; this.dir = 1; this.moving = false;
      this.emote = null; this.emoteT = 0;
      this.miracles = 0;
    }

    has(t) { return this.traits.includes(t); }
    get adult() { return this.age >= 16; }

    log(sim, text) {
      this.story.push({ y: Math.floor(sim.year), t: text });
      // 태어남 기록(0번)은 남기고 오래된 것부터 지운다
      if (this.story.length > G.CFG.STORY_CAP) this.story.splice(1, 1);
    }

    say(e, t = 90) { this.emote = e; this.emoteT = t; }

    // ---------------- 매 틱 ----------------
    update(sim) {
      const TPY = G.CFG.TPY;
      this.age += 1 / TPY;
      if (this.emoteT > 0) this.emoteT--;
      if (this.job === J.CHILD && this.age >= 14) this.growUp(sim);

      if (this.pregnant > 0 && --this.pregnant === 0) {
        G.Social.deliver(sim, this);
        if (!this.alive) return;
      }
      this.hunger += (this.age < 14 ? 0.07 : 0.12) * (sim.drought ? 1.15 : 1) * (this.pregnant ? 1.2 : 1);
      if (this.hunger >= 100) {
        this.hunger = 100;
        this.health -= 0.25;
        this.faith = Math.max(0, this.faith - 0.01);
      } else if (this.hunger < 60) {
        this.health = Math.min(100, this.health + 0.05);
      }
      if (this.health <= 0) return sim.kill(this, this.hunger >= 100 ? '굶주림' : '상처');
      if (this.age > 55 && chance(Math.pow((this.age - 55) / 28, 2) / TPY)) return sim.kill(this, '노환');

      const base = this.has('신앙심 깊은') ? 55 : this.has('의심 많은') ? 15 : 30;
      this.faith += (base - this.faith) * 0.0003;

      // 들고 있는 식량 먹기
      if (this.hunger > 55) {
        if (this.ration > 0) { this.ration--; this.hunger = Math.max(0, this.hunger - 40); }
        else if (this.carry === 'food' && this.carryAmt > 0) {
          this.carryAmt--; this.hunger = Math.max(0, this.hunger - 40);
          if (!this.carryAmt) this.carry = null;
        }
      }

      this.think(sim);
      this.move(sim);
    }

    growUp(sim) {
      this.job = J.NONE;
      this.log(sim, '어른이 되었다');
      if (this.tribe) this.tribe.assignJob(sim, this);
    }

    think(sim) {
      if (this.timer > 0) this.timer--;
      switch (this.state) {
        case 'idle': this.decide(sim); break;
        case 'goto':
          if (this.arrived()) this.onArrive(sim);
          else if (this.hunger > 75 && !this.ration && this.task && this.task.kind !== 'eat' && !(this.task.kind === 'gather' && this.task.res === 'food')) {
            // 가는 길에 너무 배고프면 계획을 바꾼다
            this.state = 'idle'; this.task = null;
          }
          else if (this.stuck > 150) { this.stuck = 0; this.state = 'idle'; this.task = null; }
          break;
        case 'gather': this.doGather(sim); break;
        case 'pray':
          if (this.timer <= 0) this.state = 'idle';
          else if (this.timer % 30 === 0) this.doPray(sim);
          break;
        case 'rest': case 'party': if (this.timer <= 0) this.state = 'idle'; break;
        case 'fight': this.doFight(sim); break;
        case 'busy': if (this.timer <= 0) this.finishBusy(sim); break;
        case 'jailed':
          if (!this.jail) { this.state = 'idle'; break; }
          if (chance(0.01)) { const t = sim.tribeById(this.jail.tid); if (t && t.jail) { const p = G.Crime.jailSpot(t); this.x = p.x; this.y = p.y; } }
          break;
        default: this.state = 'idle';
      }
    }

    // ---------------- 판단 ----------------
    decide(sim) {
      const t = this.tribe;
      const w = sim.world;

      // 1) 배고픔 (마을에서 멀수록 일찍 돌아간다)
      const far = t ? Math.min(30, G.dist(this.x, this.y, t.cx, t.cy) * 1.2) : 0;
      if (this.hunger > 55 - far && !this.ration && !(this.carry === 'food' && this.carryAmt > 0)) {
        // 마을이 멀면 근처에서 먼저 먹을 것을 찾는다
        if (far > 12 || this.hunger > 80) {
          const near = w.findResource(this.x, this.y, 'food', 6);
          if (near) return this.goTo(sim, near.x + 0.5, near.y + 0.5, { kind: 'gather', res: 'food', tile: near.i, cap: 2 });
        }
        if (t && t.stock.food >= 1 && !this.refused) {
          return this.goTo(sim, t.cx + rand(-1, 1), t.cy + rand(-1, 1), { kind: 'eat' });
        }
        const ft = w.findResource(this.x, this.y, 'food', 18);
        if (ft) return this.goTo(sim, ft.x + 0.5, ft.y + 0.5, { kind: 'gather', res: 'food', tile: ft.i, cap: 2 });
        if (this.hunger > 85 && sim.year - this.lastPray > 1) return this.startPray(sim, '굶주림');
        return this.wander(sim, this.x, this.y, 12);
      }
      this.refused = false;

      // 2) 들고 있는 자원 맡기기
      if (t && this.carry && this.carryAmt > 0 && this.carry !== 'food-own') {
        return this.goTo(sim, t.cx + rand(-0.8, 0.8), t.cy + rand(-0.8, 0.8), { kind: 'deposit' });
      }

      // 3) 아이
      if (this.job === J.CHILD) {
        const mom = this.parents.length ? sim.byId.get(this.parents[0].id) : null;
        if (mom && mom.alive && this.age < 8 && (!t || G.dist(mom.x, mom.y, t.cx, t.cy) < 8)) return this.wander(sim, mom.x, mom.y, 2);
        if (t) return this.wander(sim, t.cx, t.cy, 4);
        return this.wander(sim, this.x, this.y, 3);
      }

      // 4) 부족 없는 떠돌이 (무법자는 마을을 피한다)
      if (!t && this.outlaw) {
        const v = sim.tribes.find((o) => o.alive && !o.bandit && G.dist(o.cx, o.cy, this.x, this.y) < 12);
        if (v && !(this.gold < 8 && chance(0.3))) {
          const a = Math.atan2(this.y - v.cy, this.x - v.cx);
          return this.goTo(sim, this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10, { kind: 'wander' });
        }
      }
      if (!t) {
        if (this.hunger > 25 || chance(0.3)) {
          const ft = w.findResource(this.x, this.y, 'food', 8);
          if (ft) return this.goTo(sim, ft.x + 0.5, ft.y + 0.5, { kind: 'gather', res: 'food', tile: ft.i, cap: 3 });
        }
        return this.wander(sim, this.x, this.y, 6);
      }

      // 5) 여가: 데이트, 친구 찾아가기
      if (this.adult && this.hunger < 40) {
        if ((this.partner || this.lover || this.affair) && chance(this.affair ? 0.05 : 0.03) && G.Social.startDate(sim, this)) return;
        if (chance(0.02) && G.Social.visitFriend(sim, this)) return;
      }

      // 6) 직업별 행동
      switch (this.job) {
        case J.GATHER: case J.WOOD: case J.MINE: return this.work(sim, JOB_RES[this.job]);
        case J.HUNTER:
          if (G.Wild.startHunt(sim, this)) return;
          return this.work(sim, 'food');
        case J.FISHER: {
          const sh = w.findShore(t.cx, t.cy, 18);
          if (sh) return this.goTo(sim, sh.x + 0.5, sh.y + 0.5, { kind: 'gather', res: 'fish', tile: sh.i, cap: 6 });
          return this.work(sim, 'food');
        }
        case J.FARMER: {
          const f = w.findFarm(t.cx, t.cy, 8);
          if (f && chance(0.75)) return this.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 6 });
          if (t.farmCount < t.members.length * 0.7) {
            const sp = w.findTillSpot(t.cx, t.cy, 7, t.houses);
            if (sp) return this.goTo(sim, sp.x + 0.5, sp.y + 0.5, { kind: 'till', tile: sp.i });
          }
          if (f) return this.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 6 });
          return this.work(sim, 'food');
        }
        case J.SMITH:
          if (t.stock.ore >= 1 && t.tools < t.members.length * 1.2) return this.goTo(sim, t.cx + rand(-1.2, 1.2), t.cy + rand(-1.2, 1.2), { kind: 'forge' });
          return this.work(sim, 'ore');
        case J.HEALER: {
          const p = G.Mind.findPatient(sim, this);
          if (p) return this.goTo(sim, p.x + 0.4, p.y, { kind: 'treat', pid: p.id });
          if (chance(0.5)) return this.work(sim, 'food');
          return this.wander(sim, t.cx, t.cy, 5);
        }
        case J.GUARD:
          if (G.Crime.guardDecide(sim, this)) return;
          if (t.jail && chance(0.5)) return this.wander(sim, t.jail.x, t.jail.y, 2.5);
          return this.wander(sim, t.cx, t.cy, 9);
        case J.MERCHANT:
          if (this.planTrade(sim)) return;
          return this.wander(sim, t.cx, t.cy, 4);
        case J.WARRIOR:
          if (t.wars.size && this.hunger < 70) return this.goToWar(sim);
          if (!t.members.some((m) => m.job === J.GUARD) && G.Crime.guardDecide(sim, this)) return;
          if (chance(0.5)) return this.work(sim, 'food');
          return this.wander(sim, t.cx, t.cy, 9);
        case J.PRIEST:
          if (G.dist(this.x, this.y, t.cx, t.cy) > 2) return this.goTo(sim, t.cx + rand(-1, 1), t.cy + rand(-1, 1), { kind: 'pray', why: '의식' });
          return this.startPray(sim, '의식');
        case J.CHIEF:
          if (!t.members.some((m) => m.job === J.GUARD || m.job === J.WARRIOR) && chance(0.3) && G.Crime.guardDecide(sim, this)) return;
          return this.wander(sim, t.cx, t.cy, 3);
        default:
          return this.work(sim, 'food');
      }
    }

    work(sim, res) {
      const t = this.tribe;
      const r = res === 'ore' ? 20 : 16;
      let ft = sim.world.findResource(this.x, this.y, res, 8);
      if (ft && G.dist(ft.x, ft.y, t.cx, t.cy) > r) ft = null;
      if (!ft) ft = sim.world.findResource(t.cx, t.cy, res, r);
      if (ft) return this.goTo(sim, ft.x + 0.5, ft.y + 0.5, { kind: 'gather', res, tile: ft.i, cap: 6 });
      return this.wander(sim, t.cx, t.cy, 6);
    }

    goTo(sim, x, y, task) {
      const w = sim.world;
      x = clamp(x, 0.5, w.w - 0.5); y = clamp(y, 0.5, w.h - 0.5);
      if (!w.walkable(x, y)) {
        const p = w.nearestWalkable(x, y, 4);
        if (!p) { this.state = 'rest'; this.timer = 20; return false; }
        x = p.x; y = p.y;
      }
      const path = w.findPath(this.x, this.y, x, y);
      if (!path) { this.state = 'rest'; this.timer = 20; return false; }
      this.path = path; this.pathI = 0;
      this.tx = x; this.ty = y; this.task = task; this.state = 'goto'; this.stuck = 0;
      return true;
    }

    wander(sim, cx, cy, r) {
      const w = sim.world;
      for (let k = 0; k < 8; k++) {
        const x = cx + rand(-r, r), y = cy + rand(-r, r);
        if (w.walkable(x, y)) return this.goTo(sim, x, y, { kind: 'wander' });
      }
      this.state = 'rest'; this.timer = 30;
    }

    arrived() { return Math.hypot(this.tx - this.x, this.ty - this.y) < 0.3; }

    onArrive(sim) {
      const k = this.task;
      this.state = 'idle';
      if (!k) return;
      switch (k.kind) {
        case 'gather': this.state = 'gather'; this.timer = this.gatherTime(); return;
        case 'deposit': if (this.tribe) this.tribe.deposit(sim, this); break;
        case 'eat':
          if (this.tribe && !this.tribe.feed(sim, this)) this.refused = true;
          break;
        case 'wander': this.state = 'rest'; this.timer = randi(20, 90); break;
        case 'trade-sell': this.sellGoods(sim, k.to); break;
        case 'pray': this.startPray(sim, k.why); return;
        case 'raid': this.raid(sim, k.to); break;
        case 'date': this.task = null; G.Social.onDateArrive(sim, this, k); return;
        case 'party': this.state = 'party'; this.timer = randi(180, 300); this.say('♪', 200); break;
        case 'hunt': this.task = null; G.Wild.onArriveHunt(sim, this, k); return;
        case 'arrest': this.task = null; G.Crime.onArriveArrest(sim, this, k); return;
        case 'treat': G.Mind.treat(sim, this, sim.byId.get(k.pid)); this.state = 'rest'; this.timer = 40; break;
        case 'till': this.state = 'busy'; this.busy = k; this.timer = 70; this.say('⚒', 70); return;
        case 'forge': this.state = 'busy'; this.busy = k; this.timer = 110; this.say('⚒', 110); return;
        case 'visit': {
          const o = sim.byId.get(k.with);
          if (o && o.alive && G.dist(o.x, o.y, this.x, this.y) < 3) { G.Social.interact(sim, this, o); this.state = 'rest'; this.timer = 60; }
          break;
        }
      }
      this.task = null;
    }

    finishBusy(sim) {
      const k = this.busy; this.busy = null; this.state = 'idle';
      const t = this.tribe;
      if (!k) return;
      if (k.kind === 'till') {
        const w = sim.world;
        if (w.type[k.tile] === G.T.GRASS && !w.farm[k.tile]) {
          w.farm[k.tile] = 1; w.fert[k.tile] = Math.max(w.fert[k.tile], 1.6); w.food[k.tile] = Math.max(w.food[k.tile], 2); w.dirty = true;
          if (t) t.farmCount++;
          if (!this.tilled) { this.tilled = true; this.log(sim, '처음으로 밭을 일구었다'); }
        }
      } else if (k.kind === 'forge' && t && t.stock.ore >= 1) {
        t.stock.ore -= 1; t.tools += 1;
        this.forged = (this.forged || 0) + 1;
        if (this.forged === 1 || this.forged % 15 === 0) this.log(sim, `도구를 ${this.forged}개째 만들었다`);
      }
    }

    gatherTime() {
      let t = 24;
      if (this.has('부지런한')) t *= 0.7;
      if (this.has('게으른')) t *= 1.4;
      if (this.age > 60) t *= 1.3;
      if (this.happy < 30) t *= 1.25; else if (this.happy > 70) t *= 0.85; // 기분이 일에 영향
      if (this.pregnant) t *= 1.2;
      t *= G.Mind.workMult(this);
      if (this.tribe) t *= 1 - this.tribe.toolBonus();
      return Math.floor(t);
    }

    doGather(sim) {
      if (this.timer > 0) return;
      const w = sim.world, k = this.task;
      if (!k) { this.state = 'idle'; return; }
      // 너무 배고프면 일을 멈추고 돌아간다
      if (this.hunger > 70 && !this.ration && k.res !== 'food' && k.res !== 'fish') { this.state = 'idle'; this.task = null; return; }
      const arr = w[k.res];
      const cr = k.res === 'fish' ? 'food' : k.res;
      if (arr[k.tile] >= 1) {
        w.harvest(k.tile, k.res);
        if (this.carry !== cr) { this.carry = cr; this.carryAmt = 0; }
        this.carryAmt++;
        if (k.res === 'fish') this.say('~', 30);
      }
      if (this.carryAmt >= k.cap || arr[k.tile] < 1) {
        this.state = 'idle'; this.task = null;
        return;
      }
      this.timer = this.gatherTime();
    }

    // ---------------- 기도 ----------------
    startPray(sim, why) {
      this.state = 'pray'; this.timer = 150; this.lastPray = sim.year;
      this.say('기도', 150);
      if (why === '굶주림') {
        this.log(sim, '굶주림 속에 신에게 음식을 달라고 기도했다');
        if (sim.tick - sim.lastPrayEvent > G.CFG.TPY / 2) {
          sim.lastPrayEvent = sim.tick;
          sim.event(`${josa(this.name, '이/가')} 굶주림 속에 신에게 기도합니다`, '#f5d76e', this.x, this.y);
        }
      } else if (why === '의식' && sim.year - (this.lastRitualLog || -99) > 12) {
        this.lastRitualLog = sim.year;
        this.log(sim, '부족을 위해 신께 의식을 올렸다');
      }
    }

    doPray(sim) {
      const priest = this.job === J.PRIEST;
      this.faith = Math.min(100, this.faith + 0.5);
      if (priest) {
        sim.near(this.x, this.y, 5, (o) => {
          if (o !== this && o.tribe === this.tribe) o.faith = Math.min(100, o.faith + 0.4);
        });
      }
    }

    // ---------------- 상인 ----------------
    planTrade(sim) {
      const home = this.tribe;
      let best = null;
      for (const o of sim.tribes) {
        if (o === home || !o.alive || home.wars.has(o.id) || !o.members.length) continue;
        const d = G.dist(home.cx, home.cy, o.cx, o.cy);
        if (d > 90) continue;
        for (const r of ['food', 'wood', 'ore']) {
          const buy = home.price(r), sell = o.price(r) * 0.95;
          const avail = Math.floor(home.stock[r] - home.reserve(r));
          const qty = Math.min(6, Math.floor(this.gold / buy), avail);
          if (qty < 1) continue;
          const profit = (sell - buy) * qty - d * 0.02;
          if (profit > 0.5 && (!best || profit > best.profit)) best = { o, r, qty, profit };
        }
      }
      if (!best) return false;
      const cost = Math.ceil(home.price(best.r) * best.qty);
      this.gold -= cost; home.treasury += cost; home.stock[best.r] -= best.qty;
      this.carry = best.r; this.carryAmt = best.qty; this.tradeCost = cost;
      this.say('거래', 60);
      this.goTo(sim, best.o.cx + rand(-1, 1), best.o.cy + rand(-1, 1), { kind: 'trade-sell', to: best.o.id });
      return true;
    }

    sellGoods(sim, toId) {
      const o = sim.tribeById(toId);
      if (!o || !o.alive || !this.carry) return;
      const r = this.carry, qty = this.carryAmt;
      const pay = Math.min(Math.floor(o.price(r) * 0.95 * qty), Math.floor(o.treasury));
      o.treasury -= pay; o.stock[r] += qty; this.gold += pay;
      this.carry = null; this.carryAmt = 0;
      const profit = pay - this.tradeCost;
      sim.stats.trades++;
      if (this.tribe) sim.changeRel(this.tribe, o, 3);
      if (profit >= 15 || sim.year - this.lastTradeLog > 5) {
        this.lastTradeLog = sim.year;
        this.log(sim, `${o.name}에 ${G.RES_NAME[r]} ${qty}개를 팔아 금화 ${profit >= 0 ? profit + '개를 벌었다' : -profit + '개를 잃었다'}`);
      }
      if (this.tribe) this.goTo(sim, this.tribe.cx, this.tribe.cy, { kind: 'wander' });
    }

    // ---------------- 전쟁 ----------------
    goToWar(sim) {
      const t = this.tribe;
      const enemy = sim.nearestEnemy(this, 10);
      if (enemy) { this.target = enemy; this.state = 'fight'; this.say('공격', 60); return; }
      const foeId = [...t.wars][Math.floor(Math.random() * t.wars.size)];
      const foe = sim.tribeById(foeId);
      if (!foe) return this.wander(sim, t.cx, t.cy, 6);
      this.goTo(sim, foe.cx + rand(-1.5, 1.5), foe.cy + rand(-1.5, 1.5), { kind: 'raid', to: foe.id });
    }

    raid(sim, foeId) {
      const foe = sim.tribeById(foeId);
      if (!foe || !this.tribe || !this.tribe.wars.has(foeId)) return;
      const enemy = sim.nearestEnemy(this, 6);
      if (enemy) { this.target = enemy; this.state = 'fight'; return; }
      const food = Math.min(5, Math.floor(foe.stock.food));
      const gold = Math.min(15, Math.floor(foe.treasury));
      foe.stock.food -= food; foe.treasury -= gold;
      this.gold += gold;
      if (food > 0) { this.carry = 'food'; this.carryAmt = food; }
      if (food + gold > 0) {
        this.log(sim, `${foe.name}의 마을을 약탈했다 (식량 ${food}, 금화 ${gold})`);
        this.say('약탈', 80);
      }
    }

    doFight(sim) {
      const e = this.target;
      if (!e || !e.alive || !this.tribe || !e.tribe || (!this.tribe.wars.has(e.tribe.id) && e.target !== this)) {
        this.target = null; this.state = 'idle'; return;
      }
      const d = G.dist(this.x, this.y, e.x, e.y);
      if (d > 14 || this.health < 25) {
        this.target = null; this.state = 'idle';
        if (this.health < 25 && this.tribe) this.goTo(sim, this.tribe.cx, this.tribe.cy, { kind: 'wander' });
        return;
      }
      if (d > 0.7) { this.tx = e.x; this.ty = e.y; return; }
      this.tx = this.x; this.ty = this.y;
      if (this.timer > 0) return;
      this.timer = 20;
      let dmg = rand(5, 11);
      if (this.has('용감한')) dmg *= 1.3;
      if (this.job === J.WARRIOR) dmg *= 1.3;
      if (this.tribe) dmg *= 1 + this.tribe.toolBonus();
      if (this.age < 16 || this.age > 60) dmg *= 0.6;
      e.health -= dmg;
      e.say('!', 30);
      // 맞은 쪽 반응
      if (e.alive && e.state !== 'fight') {
        if (e.has('겁많은') || e.job === J.CHILD) {
          if (e.tribe) e.goTo(sim, e.tribe.cx, e.tribe.cy, { kind: 'wander' });
        } else { e.target = this; e.state = 'fight'; }
      }
      if (e.health <= 0) {
        this.kills++;
        this.log(sim, `${e.tribe ? e.tribe.name + '의 ' : ''}${josa(e.name, '을/를')} 쓰러뜨렸다`);
        sim.kill(e, '전투', this);
        this.target = null; this.state = 'idle';
      }
    }

    // ---------------- 이동 ----------------
    move(sim) {
      this.moving = false;
      if (this.state !== 'goto' && this.state !== 'fight') return;
      let gx = this.tx, gy = this.ty;
      if (this.state === 'goto' && this.path && this.pathI < this.path.length) {
        let wp = this.path[this.pathI];
        if (Math.hypot(wp.x - this.x, wp.y - this.y) < 0.25 && this.pathI < this.path.length - 1) wp = this.path[++this.pathI];
        gx = wp.x; gy = wp.y;
      }
      const dx = gx - this.x, dy = gy - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) return;
      const w = sim.world;
      let sp = 0.05 * (G.TILE_SPEED[w.typeAt(this.x, this.y)] || 0.5);
      if (this.age < 10) sp *= 0.7;
      if (this.age > 60) sp *= 0.75;
      if (this.hunger >= 100) sp *= 0.8;
      if (this.job === J.MERCHANT) sp *= 1.15;
      if (this.pregnant) sp *= 0.85;
      sp = Math.min(sp, d);
      const ang = Math.atan2(dy, dx);
      const offs = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4];
      for (const off of offs) {
        const a = ang + off;
        const nx = this.x + Math.cos(a) * sp, ny = this.y + Math.sin(a) * sp;
        if (w.walkable(nx, ny)) {
          this.x = nx; this.y = ny;
          this.walk += sp * 4;
          this.moving = true;
          if (Math.abs(Math.cos(a)) > 0.2) this.dir = Math.cos(a) >= 0 ? 1 : -1;
          if (off !== 0) this.stuck++; else if (this.stuck > 0) this.stuck--;
          return;
        }
      }
      this.stuck += 5;
      // 물에 갇혔다면 가까운 땅으로
      if (!w.walkable(this.x, this.y)) {
        const p = w.nearestWalkable(this.x, this.y, 4);
        if (p) { this.x = p.x; this.y = p.y; }
      }
    }
  }

  G.Human = Human;
})();
