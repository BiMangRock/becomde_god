// 범죄와 사법: 절도, 폭행, 살인, 목격과 수사, 체포, 재판, 감옥, 탈옥, 무법자, 도적단
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const C = (G.Crime = {});
  const SEV = (C.SEV = { 절도: 1, 폭행: 2, 살인: 5, 탈옥: 2, 탈옥방조: 2 });
  // 사람의 목숨을 앗은 범죄 (crime2·crime3에서 더한다)
  C.LETHAL = new Set(['살인', '독살']);

  C.init = (h) => {
    h.crimes = [];       // {y, type, victim, known, punished}
    h.notoriety = 0;     // 악명 0~100
    h.wanted = false;    // 수배 중
    h.jail = null;       // {tid, until, total}
    h.outlaw = false;    // 무법자 (추방자, 탈옥수)
    h.banned = [];       // 들어갈 수 없는 부족 id
    h.convictions = 0;
    h.murders = 0;
  };

  // 범죄 성향
  C.urge = (h) => {
    let u = 1;
    if (h.has('정직한')) u *= 0.08;
    if (h.has('교활한')) u *= 2;
    if (h.has('탐욕스러운')) u *= 1.6;
    if (h.has('충동적인')) u *= 1.3;
    if (h.has('냉정한')) u *= 1.3;
    if (h.has('너그러운')) u *= 0.5;
    if (h.has('신앙심 깊은')) u *= 0.6;
    if ((h.stress || 0) > 60) u *= 1.5;
    if (h.outlaw) u *= 2.5;
    if (h.faith > 70) u *= 0.7;
    // 전과가 많을수록 다시 죄를 짓기 쉽고, 갱생할수록 줄어든다
    u *= Math.pow(1.4, Math.min(4, h.convictions || 0)) * (1 - (h.rehab || 0) / 150) * (h.redeemed ? 0.5 : 1);
    u *= (0.6 + h.p.impulse / 125) * (1.4 - h.p.agree / 125);
    if (h.addiction > 50 && h.gold < 5) u *= 1.6;
    if (h.drunk > 0) u *= 1.5;
    if (G.curSim && G.curSim.isNight()) u *= 1.4; // 밤에는 보는 눈이 적다
    if (G.Crime3) u *= G.Crime3.urgeMult(h);
    if (G.Faith) u *= G.Faith.urgeMult(h); // 심판·두려움의 신을 섬기면 죄를 덜 짓는다
    return u;
  };

  C.record = (sim, h, type, victim, known) => {
    const c = { y: Math.floor(sim.year), type, victim, known, punished: false };
    h.crimes.push(c);
    if (h.crimes.length > 12) h.crimes.shift();
    if (known) h.notoriety = clamp(h.notoriety + SEV[type] * 8, 0, 100);
    sim.stats.crimes = (sim.stats.crimes || 0) + 1;
    sim.stats.byType = sim.stats.byType || {};
    sim.stats.byType[type] = (sim.stats.byType[type] || 0) + 1;
    return c;
  };

  // 범행을 본 사람들
  C.witnesses = (sim, x, y, exclude) => {
    const out = [];
    sim.near(x, y, 6, (w) => { if (!exclude.includes(w) && w.age >= 6 && !w.jail && w.state !== 'sleep') out.push(w); });
    return out;
  };

  C.detect = (sim, crim, type, victim, ws) => {
    let seen = false;
    for (const w of ws) {
      // 가까운 사람은 감싸 주기도 한다
      const r = G.Social.peek(w, crim);
      if (r && (r.v >= 70 || w.partner === crim || w.lover === crim) && !w.has('정직한') && chance(0.7)) {
        G.Mind2.react(sim, w, { k: type, a: crim.id, an: crim.name, b: null, bn: victim, how: 'saw' }, crim, null, { hidden: true }); // 보았지만 감싸 준다
        w.log(sim, `${josa(crim.name, '이/가')} ${josa(type, '을/를')} 저지르는 것을 보았지만 모른 척했다`);
        continue;
      }
      let p = w.job === J.GUARD ? 0.9 : 0.45;
      if (crim.has('교활한')) p *= 0.6;
      if (crim.crimeSkill) p *= 1 - crim.crimeSkill / 120;
      if (!chance(p)) continue;
      seen = true;
      const lethal = C.LETHAL.has(type);
      G.Mind.adj(sim, w, crim, { trust: lethal ? -70 : -30, fear: lethal ? 35 : 5 });
      G.Social.bump(sim, w, crim, lethal ? -50 : -15);
      if (lethal) { G.Social.addMood(sim, w, 'witnessMurder'); G.Mind.trauma(sim, w, 0.3, '살인을 목격하고'); }
      w.log(sim, `${josa(crim.name, '이/가')} ${victim ? victim + '에게 ' : ''}${josa(type, '을/를')} 저지르는 것을 보았다`);
      G.Mind2.react(sim, w, { k: type, a: crim.id, an: crim.name, b: null, bn: victim, how: 'saw' }, crim, null, {});
      w.say('!', 90);
    }
    return seen;
  };

  // 수배: 부족 경비병이 잡으러 온다
  C.report = (sim, crim, type, victimName) => {
    crim.wanted = true;
    if (crim.tribe) crim.tribe.crimeHeat = (crim.tribe.crimeHeat || 0) + 1;
    for (const c of crim.crimes) if (c.type === type && !c.known) { c.known = true; crim.notoriety = clamp(crim.notoriety + SEV[type] * 8, 0, 100); }
    const t = crim.tribe;
    const lethal = C.LETHAL.has(type);
    const text = type === '살인'
      ? `${josa(crim.name, '이/가')} ${josa(victimName, '을/를')} 살해했습니다. 수배가 내려졌습니다`
      : lethal && victimName ? `${josa(crim.name, '이/가')} ${victimName} ${type} 사건의 범인으로 수배되었습니다`
      : `${josa(crim.name, '이/가')} ${josa(type, '을/를')} 저질러 수배되었습니다`;
    if (t) t.log(sim, text, lethal || sim.humans.length < 80);
    else sim.event(text, '#d06060', crim.x, crim.y);
  };

  // ---------------- 60틱마다 ----------------
  C.tick = (sim, h) => {
    if (!h.alive) return;
    if (h.jail) return C.prisonTick(sim, h);
    if (!h.adult) return G.Crime3.youthTick(sim, h);
    if (h.state === 'sleep') return G.Crime3.tick(sim, h);
    if (h.age < 18) G.Crime3.youthTick(sim, h);
    G.Crime2.tick(sim, h);
    if (!h.alive || h.held || h.jail) return;
    G.Crime3.tick(sim, h);
    if (!h.alive || h.held || h.jail) return;
    // 수배자는 달아나기도 한다
    if (h.wanted && h.tribe && !h.tribe.bandit && chance((h.has('교활한') || h.has('겁많은') ? 0.08 : 0.03))) return C.flee(sim, h, '수배를 피해');
    const u = C.urge(h);
    // 절도
    if (h.gold < 8 && (h.hunger > 50 || h.has('탐욕스러운') || h.outlaw) && chance(0.012 * u)) { C.theft(sim, h); return; }
    // 폭행과 살인 (깊은 원한)
    for (const [id, r] of h.rel) {
      const motive = (r.grudge || 0) + ((r.jealousy || 0) >= 70 ? 15 : 0);
      if (motive < 55) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive || o.jail) continue;
      const d = G.dist(o.x, o.y, h.x, h.y);
      // 깊은 원한을 품으면 몰래 뒤를 밟는다
      if (d > 4) {
        if (motive >= 75 && d < 25 && h.state !== 'jailed' && chance(0.12 * u)) {
          h.goTo(sim, o.x + rand(-1, 1), o.y + rand(-1, 1), { kind: 'wander' });
          if (!r.stalkLogged) { r.stalkLogged = true; h.log(sim, `${josa(o.name, '을/를')} 몰래 따라다니기 시작했다`); }
        }
        continue;
      }
      const ws = C.witnesses(sim, o.x, o.y, [h, o]);
      // 작은 공동체에서는 폭력이 드물다
      const stressMul = ((h.stress || 0) > 50 ? 1.5 : 1) * Math.min(1, sim.humans.length / 45);
      // 살인은 충동적이거나 냉정하거나 몹시 지친 사람만 저지른다
      const capable = h.p.impulse > 60 || h.has('냉정한') || (h.stress || 0) > 60 || h.drunk > 0 ? 1 : 0.25;
      if (motive >= 75 && ws.length <= 2 && chance(0.06 * u * stressMul * capable)) return C.murder(sim, h, o, ws);
      if (d < 2.5 && chance(0.03 * u * stressMul)) return C.assault(sim, h, o, ws);
    }
  };

  C.theft = (sim, h) => {
    // 대상: 가까운 부자, 아니면 마을 창고
    let victim = null;
    sim.near(h.x, h.y, 3, (o) => {
      if (victim || o === h || o.gold < 15 || G.Social.isFamily(h, o.id) || o.jail) return;
      victim = o;
    });
    let what, vname;
    if (victim) {
      const g = randi(5, Math.min(20, Math.floor(victim.gold)));
      victim.gold -= g; h.gold += g;
      what = `${victim.name}의 금화 ${g}개`; vname = victim.name;
    } else {
      const t = sim.tribes.find((t) => t.alive && G.dist(t.cx, t.cy, h.x, h.y) < 4);
      if (!t || (t === h.tribe && h.has('신앙심 깊은'))) return;
      if (t.treasury >= 10 && chance(0.5)) { t.treasury -= 10; h.gold += 10; what = `${t.name} 금고의 금화 10개`; }
      else if (t.stock.food >= 3) { t.stock.food -= 3; h.hunger = Math.max(0, h.hunger - 40); what = `${t.name} 창고의 식량`; }
      else return;
      vname = t.name;
    }
    sim.stats.thefts = (sim.stats.thefts || 0) + 1;
    const ws = C.witnesses(sim, h.x, h.y, [h]);
    const seen = C.detect(sim, h, '절도', vname, ws) || (victim && chance(0.35));
    C.record(sim, h, '절도', vname, false);
    h.log(sim, `${josa(what, '을/를')} 훔쳤다`);
    if (!h.has('냉정한') && !h.outlaw) G.Social.addMood(sim, h, 'guilty');
    if (victim) {
      G.Social.addMood(sim, victim, 'robbed');
      if (seen) { G.Mind.adj(sim, victim, h, { trust: -60, grudge: 35 }); victim.log(sim, `${josa(h.name, '이/가')} 금화를 훔쳐 갔다`); }
      else victim.log(sim, '누군가에게 금화를 도둑맞았다');
    }
    if (seen) C.report(sim, h, '절도', vname);
  };

  C.assault = (sim, h, o, ws) => {
    const dmg = rand(20, 35) * (h.has('용감한') ? 1.2 : 1);
    o.health -= dmg;
    G.Blood.splash(sim, o.x, o.y, 2, 0.6, 'drops');
    h.say('#', 90); o.say('!', 90);
    G.Social.addMood(sim, h, 'brawl'); G.Social.addMood(sim, o, 'brawl');
    G.Mind.adj(sim, o, h, { grudge: 30, fear: 25, trust: -40 });
    sim.stats.assaults = (sim.stats.assaults || 0) + 1;
    // 맞은 사람이 맞서 싸우다 상대를 쓰러뜨리면 정당방위
    if (o.health > 0 && G.Crime3.fightBack(sim, o, h)) return;
    if (o.health <= 0) {
      // 폭행치사
      return C.murder(sim, h, o, ws, true);
    }
    C.record(sim, h, '폭행', o.name, false);
    h.log(sim, `분을 참지 못하고 ${josa(o.name, '을/를')} 때렸다`);
    o.log(sim, `${h.name}에게 맞아 다쳤다`);
    if (C.detect(sim, h, '폭행', o.name, ws) || chance(0.6)) C.report(sim, h, '폭행', o.name);
  };

  C.murder = (sim, h, o, ws, accidental) => {
    h.murders++;
    sim.stats.murders = (sim.stats.murders || 0) + 1;
    const vname = o.name, vx = o.x, vy = o.y, vtribe = o.tribe;
    // 피의 복수였는지, 피해자의 가족은 누구인지 (죽기 전에 알아 둔다)
    const gen = G.Crime3.feudGen(h, o);
    const fam = [...o.parents.map((p) => p.id), ...o.children, ...(o.partner ? [o.partner.id] : []), ...sim.humans.filter((s) => s.alive && s !== o && G.Mind.siblings(s, o)).map((s) => s.id)];
    h.log(sim, accidental ? `${josa(o.name, '을/를')} 때리다 그만 목숨을 빼앗고 말았다` : gen >= 2 ? `대를 이은 원한 끝에 ${josa(o.name, '을/를')} 살해했다` : `오랜 원한 끝에 ${josa(o.name, '을/를')} 살해했다`);
    const key = `${vname}:${Math.floor(sim.year * 1000)}`;
    sim.kill(o, '살인', h);
    G.Blood.splash(sim, vx, vy, 4, 0.9, 'pool', key);
    G.Blood.add(sim, vx, vy, 1.4, 'pool', key);
    // 교활한 범인은 흔적을 지우려 한다
    if (h.has('교활한') && chance(0.6)) {
      G.Blood.wash(sim, vx, vy, 1.6);
      h.log(sim, '핏자국을 몰래 닦아 흔적을 지웠다');
      C.record(sim, h, '증거 인멸', vname, false);
      if (ws.length && chance(0.5)) ws[0].log(sim, `${josa(h.name, '이/가')} 무언가를 닦아 내는 수상한 모습을 보았다`);
    }
    const r = G.Social.rel(h, o);
    r.grudge = 0;
    h.stress = clamp((h.stress || 0) + 30, 0, 100);
    if (!h.has('냉정한')) G.Social.addMood(sim, h, 'murderGuilt');
    C.record(sim, h, '살인', vname, false);
    const seen = C.detect(sim, h, '살인', vname, ws);
    // 가족과 친구의 충격
    for (const p of sim.humans) {
      if (!p.alive || p === h) continue;
      const pr = p.rel.get(o.id);
      if (pr && (pr.v >= 50 || G.Social.isFamily(p, o.id))) G.Mind.trauma(sim, p, 0.25, `${vname}의 죽음에 충격을 받아`);
    }
    if (seen) {
      // 목격되었으면 피해자 가족은 범인을 원망한다
      for (const p of sim.humans) {
        const pr = p.alive && p.rel.get(o.id);
        if (pr && pr.v >= 40 && p !== h) G.Mind.adj(sim, p, h, { grudge: 50, trust: -80 });
      }
      G.Crime3.onKilled(sim, fam, h, vname, gen);
      C.report(sim, h, '살인', vname);
    } else {
      sim.unsolved.push({ victim: vname, killer: h.id, tid: vtribe ? vtribe.id : null, y: sim.year, x: vx, yy: vy, key, fam, gen });
      sim.event(`${josa(vname, '이/가')} 숨진 채 발견되었습니다. 범인은 알 수 없습니다`, '#a05050', vx, vy);
    }
  };

  // 미제 사건 수사: 경비병이 많을수록 빨리 풀린다
  C.investigate = (sim) => {
    for (let i = sim.unsolved.length - 1; i >= 0; i--) {
      const cs = sim.unsolved[i];
      if (!cs) continue; // 연쇄살인 사건이 풀리면 같은 범인의 사건이 한꺼번에 지워진다
      const k = sim.byId.get(cs.killer);
      // 공소시효: 8년이 지나면 사건은 묻힌다 (일가족 살인과 연쇄살인은 더 오래 쫓는다)
      const limit = cs.type === '일가족 살인' || cs.serial ? 15 : 8;
      if (!k || !k.alive || sim.year - cs.y > limit) { if (k && k.alive) G.Crime3.expire(sim, cs); sim.unsolved.splice(i, 1); continue; }
      const t = cs.tid ? sim.tribeById(cs.tid) : null;
      const guards = t ? t.members.filter((m) => m.job === J.GUARD).length : 0;
      let p = 0.01 + guards * 0.025;
      // 현장에 피가 남아 있으면 증거가 된다 (비가 오면 씻겨 사라진다)
      if (cs.key && G.Blood.near(sim, cs.x, cs.yy, 2.5, (b) => b.case === cs.key)) p *= 2.5;
      if (k.has('교활한')) p *= 0.5;
      // 같은 수법의 사건이 쌓이면 범인의 윤곽이 드러난다
      if (cs.serial) p *= 1 + 0.5 * sim.unsolved.filter((o) => o.serial && o.killer === cs.killer).length;
      if (cs.type === '일가족 살인') p *= 1.5;
      if (chance(p)) {
        sim.unsolved.splice(i, 1);
        const kind = cs.type === '독살' ? '독살' : cs.type === '일가족 살인' ? '일가족 살해' : '살해';
        if (t) t.log(sim, `수사 끝에 ${cs.victim} ${kind} 사건의 범인이 ${josa(k.name, '으로/로')} 밝혀졌습니다`);
        else sim.event(`${cs.victim} ${kind} 사건의 범인이 ${josa(k.name, '으로/로')} 밝혀졌습니다`, '#d06060', k.x, k.y);
        for (const p2 of sim.humans) {
          const pr = p2.alive && p2.rel.get(k.id);
          if (pr) G.Mind.adj(sim, p2, k, { trust: -50, fear: 20 });
        }
        G.Crime3.onSolved(sim, cs, k);
        C.report(sim, k, cs.type || '살인', cs.victim);
      }
    }
  };

  // ---------------- 경비병 ----------------
  C.nearestWanted = (sim, g) => {
    const t = g.tribe;
    if (!t) return null;
    let best = null, bd = 30;
    for (const h of sim.humans) {
      if (!h.alive || !h.wanted || h.jail || h === g) continue;
      const mine = h.tribe === t;
      const nearVillage = G.dist(h.x, h.y, t.cx, t.cy) < 22;
      if (!mine && !nearVillage) continue;
      if (h.tribe && h.tribe !== t && !h.tribe.bandit) continue; // 다른 부족 사람은 그 부족이 처리
      const d = G.dist(h.x, h.y, g.x, g.y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };

  C.guardDecide = (sim, g) => {
    const c = C.nearestWanted(sim, g);
    if (!c) return false;
    g.say('!', 60);
    return g.goTo(sim, c.x, c.y, { kind: 'arrest', id: c.id });
  };

  C.onArriveArrest = (sim, g, task) => {
    const c = sim.byId.get(task.id);
    if (!c || !c.alive || !c.wanted || c.jail) return;
    if (G.dist(c.x, c.y, g.x, g.y) > 1.6) {
      // 아직 멀면 다시 쫓는다 (몇 번까지만)
      task.tries = (task.tries || 0) + 1;
      if (task.tries < 6) g.goTo(sim, c.x, c.y, task);
      return;
    }
    let helpers = 0;
    sim.near(c.x, c.y, 4, (o) => { if (o.job === J.GUARD && o.tribe === g.tribe) helpers++; });
    let pEscape = 0.25 * (c.has('교활한') ? 1.6 : 1) * (c.has('용감한') ? 1.3 : 1) - helpers * 0.08;
    if (chance(clamp(pEscape, 0.03, 0.6))) {
      g.log(sim, `${josa(c.name, '을/를')} 붙잡으려다 놓쳤다`);
      g.health -= rand(5, 15);
      if (!c.outlaw) C.flee(sim, c, '경비병을 뿌리치고');
      else c.goTo(sim, c.x + rand(-20, 20), c.y + rand(-20, 20), { kind: 'wander' });
      return;
    }
    // 뇌물을 받고 놓아주는 경비병도 있다
    if (G.Crime3.corruptGuard(sim, g, c)) return;
    c.wanted = false;
    g.log(sim, `수배자 ${josa(c.name, '을/를')} 붙잡았다`);
    c.log(sim, `경비병 ${g.name}에게 붙잡혔다`);
    G.Mind.adj(sim, c, g, { grudge: 25, fear: 15 });
    sim.stats.arrests = (sim.stats.arrests || 0) + 1;
    C.trial(sim, g.tribe, c);
  };

  // ---------------- 재판 ----------------
  // 형벌: 감옥, 사형(사형이 있는 부족), 추방(무거운 죄는 얼굴에 낙인), 강제노역, 벌금(일부는 피해자에게 배상)
  // 소년범은 가볍게, 과실은 절반으로, 정당방위는 무죄. 성범죄는 증거가 없으면 '말 대 말'이 된다.
  C.trial = (sim, t, c) => {
    const X3 = G.Crime3;
    const open = c.crimes.filter((x) => x.known && !x.punished && !x.sanctioned);
    c.stalking = null;
    for (const x of open) x.punished = true;
    const judge = t.chief && t.chief !== c ? `${t.title} ${t.chief.name}` : '부족 회의';
    const real = X3.screen(sim, t, c, open, judge);
    if (!real.length) { if (open.length) c.log(sim, `${judge}의 재판에서 벌을 받지 않았다`); return; }
    let sev = real.reduce((s, x) => s + (SEV[x.type] || 1) * (x.negligent ? 0.5 : 1) * (x.heavy ? 2 : 1), 0) || 1;
    sev *= 1 + c.convictions * 0.5;
    c.convictions++;
    X3.revealClients(sim, c);
    // 족장이 죄를 지었으면 먼저 자리에서 물러난다
    if (t.chief === c) {
      t.chief = null;
      t.log(sim, `족장 ${josa(c.name, '이/가')} 죄를 지어 자리에서 쫓겨났습니다`);
      c.log(sim, '죄가 드러나 족장 자리에서 쫓겨났다');
      t.electChief(sim);
      if (t.chief === c) t.chief = null;
    }
    if (c.job === J.CHIEF) c.job = J.GATHER;
    const chief = t.chief;
    let mult = G.Crime2.bribe(sim, t, c, chief, sev);
    mult *= X3.perjury(sim, t, c);
    const habitual = c.convictions >= 3;
    if (habitual) { mult *= 2; c.log(sim, '상습범으로 무거운 벌을 받게 되었다'); }
    if (chief && chief.has('냉정한')) mult *= 1.5;
    if (chief && chief.has('너그러운')) mult *= 0.6;
    const youth = c.age < 18;
    if (youth) { mult *= 0.5; c.log(sim, '어린 나이를 참작받아 가벼운 벌을 받게 되었다'); }
    const lethal = real.some((x) => C.LETHAL.has(x.type) && !x.negligent);
    const sexual = real.some((x) => X3.SEXUAL.has(x.type));
    const negligentOnly = real.every((x) => x.negligent);
    if (sexual) c.sexOffender = true;
    const murder = lethal;
    let verdict, executed = false;
    const jailFull = t.jail && sim.humans.filter((h) => h.jail && h.jail.tid === t.id).length >= 6;
    const law = t.law || {};
    if (!youth && lethal && law.death && (c.murders >= 2 || sev >= 10 || chance(chief && chief.has('냉정한') ? 0.5 : 0.25))) {
      verdict = '사형';
      executed = true;
    } else if (t.jail && !jailFull && (!youth || lethal) && !(lethal && !youth && chance(chief && chief.has('냉정한') ? 0.5 : 0.25))) {
      let years = Math.min(habitual || c.murders >= 3 ? 20 : 15, Math.max(1, Math.round(sev * 1.5 * mult)));
      if (youth) years = Math.min(years, 3);
      C.imprison(sim, t, c, years);
      verdict = `감옥 ${years}년`;
    } else if (!youth && !negligentOnly && (sev >= 6 || lethal || (sexual && sev >= 4) || (habitual && chance(0.5)))) {
      const brand = lethal || sexual;
      C.exile(sim, t, c);
      if (brand) X3.brand(sim, c);
      verdict = brand ? '추방과 낙인' : '추방';
    } else if (sev >= 3 || youth) {
      const years = clamp(Math.round(sev * mult), 1, youth ? 2 : 5);
      X3.sentenceLabor(sim, t, c, years);
      verdict = `강제노역 ${years}년`;
    } else {
      const fine = Math.min(Math.floor(c.gold), 15 * Math.ceil(sev));
      c.gold -= fine;
      const comp = X3.compensate(sim, real, Math.floor(fine / 2));
      t.treasury += fine - comp;
      verdict = `벌금 금화 ${fine}개${comp ? ` (피해자에게 ${comp}개 배상)` : ''}`;
      if (c.tribe !== t) C.exile(sim, t, c);
    }
    c.log(sim, `${judge}에게 ${verdict} 판결을 받았다`);
    t.log(sim, `${josa(judge, '이/가')} ${c.name}에게 ${josa(verdict, '을/를')} 선고했습니다 (${real.map((x) => x.type + (x.negligent ? '(과실)' : '')).join(', ') || '여러 죄'})`, murder || executed || sim.humans.length < 80);
    // 피해자 쪽 사람들은 정의가 섰다고 느낀다
    for (const p of sim.humans) {
      if (!p.alive || p === c) continue;
      const pr = p.rel.get(c.id);
      if (pr && (pr.grudge || 0) >= 30) { G.Social.addMood(sim, p, 'justice'); pr.grudge = Math.max(0, pr.grudge - (executed ? 60 : 30)); if (executed) pr.feud = 0; }
    }
    if (executed) X3.execute(sim, t, c);
  };

  C.jailSpot = (t) => ({ x: t.jail.x + rand(-0.35, 0.35), y: t.jail.y + rand(-0.25, 0.3) });

  C.imprison = (sim, t, c, years) => {
    c.jail = { tid: t.id, until: sim.year + years, total: years };
    const p = C.jailSpot(t);
    c.x = p.x; c.y = p.y; c.tx = p.x; c.ty = p.y;
    c.state = 'jailed'; c.task = null; c.path = null;
    c.carry = null; c.carryAmt = 0;
    G.Social.addMood(sim, c, 'imprisoned');
    sim.stats.prisoners = (sim.stats.prisoners || 0) + 1;
  };

  C.prisonTick = (sim, c) => {
    const t = sim.tribeById(c.jail.tid);
    if (!t || !t.jail) { C.release(sim, c, '감옥이 사라져'); return; }
    // 밥은 부족이 준다 (빠른 시간 흐름에서도 굶지 않도록 배가 찰 때까지)
    while (c.hunger > 40 && t.stock.food >= 1) { t.stock.food -= 1; c.hunger = Math.max(0, c.hunger - 40); }
    G.Social.addMood(sim, c, 'imprisoned');
    G.Crime2.prisonTick(sim, c, t);
    if (sim.year >= c.jail.until) { C.release(sim, c); return; }
    // 탈옥
    let guards = 0;
    sim.near(t.jail.x, t.jail.y, 6, (o) => { if (o.job === J.GUARD && o.tribe === t) guards++; });
    let p = 0.0018 * (c.has('교활한') ? 2.5 : 1) * (c.has('용감한') ? 1.4 : 1) * ((c.stress || 0) > 70 ? 1.5 : 1) * (guards ? 0.3 : 1.4);
    if (c.jail.until - sim.year > 5) p *= 1.5;
    // 바깥의 연인이나 친구가 도와주기도 한다
    let helper = null;
    for (const [id, r] of c.rel) {
      if (r.v < 70 && !r.love) continue;
      const o = sim.byId.get(id);
      if (o && o.alive && !o.jail && !o.has('정직한') && G.dist(o.x, o.y, c.x, c.y) < 15 && (r.v >= 70 || r.love >= 60)) { helper = o; break; }
    }
    if (helper) p += 0.004;
    if (chance(p)) C.breakout(sim, c, t, helper && chance(0.6) ? helper : null);
  };

  C.release = (sim, c, why) => {
    const t = sim.tribeById(c.jail.tid);
    c.jail = null; c.state = 'idle';
    c.notoriety = Math.floor(c.notoriety * 0.6);
    G.Crime2.onRelease(sim, c);
    G.Social.addMood(sim, c, 'freed');
    c.log(sim, why ? `${why} 풀려났다` : '형기를 마치고 풀려났다');
    if (t) t.log(sim, `${josa(c.name, '이/가')} 형기를 마치고 풀려났습니다`, false);
    if (c.tribe && c.tribe !== t) {/* 다른 부족 사람 */}
    if (!c.tribe && t && !c.banned.includes(t.id) && !c.outlaw) t.add(sim, c);
  };

  C.breakout = (sim, c, t, helper) => {
    c.jail = null; c.state = 'idle';
    C.record(sim, c, '탈옥', null, true);
    sim.stats.escapes = (sim.stats.escapes || 0) + 1;
    c.log(sim, helper ? `${helper.name}의 도움으로 감옥을 빠져나왔다` : '감옥을 부수고 탈옥했다');
    G.Social.addMood(sim, c, 'freed');
    sim.event(`${t.name}의 감옥에서 ${josa(c.name, '이/가')} 탈옥했습니다!${helper ? ` (${G.josa(helper.name, "이/가")} 도움)` : ''}`, '#ff9a50', t.jail.x, t.jail.y);
    sim.effects.push({ kind: 'escape', x: t.jail.x, y: t.jail.y, age: 0, ttl: 60 });
    if (helper) {
      C.record(sim, helper, '탈옥방조', c.name, true);
      helper.log(sim, `${josa(c.name, '이/가')} 감옥에서 빠져나오도록 도왔다`);
      helper.wanted = true;
      G.Social.bump(sim, c, helper, 20); G.Mind.adj(sim, c, helper, { trust: 30 });
    }
    C.flee(sim, c, null);
    c.wanted = true;
  };

  // 마을을 버리고 멀리 달아나 무법자가 된다
  C.flee = (sim, c, why) => {
    const t = c.tribe;
    if (t) { t.remove(sim, c); if (!c.banned.includes(t.id)) c.banned.push(t.id); }
    if (!c.outlaw) { c.outlaw = true; c.outlawSince = sim.year; }
    if (why) c.log(sim, `${why} 마을에서 달아났다`);
    if (c.partner && c.partner.alive) G.Mind.adj(sim, c.partner, c, { trust: -20 });
    const w = sim.world;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, r = rand(22, 45);
      const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (!w.walkable(x, y)) continue;
      if (sim.tribes.some((o) => o.alive && !o.bandit && G.dist(o.cx, o.cy, x, y) < 12)) continue;
      if (c.goTo(sim, x, y, { kind: 'wander' })) return;
    }
  };

  C.exile = (sim, t, c) => {
    c.wanted = false;
    if (!c.banned.includes(t.id)) c.banned.push(t.id);
    sim.stats.exiles = (sim.stats.exiles || 0) + 1;
    G.Social.addMood(sim, c, 'exiled');
    C.flee(sim, c, null);
    c.log(sim, `${t.name}에서 추방당했다`);
  };

  // 무법자가 새 삶을 찾거나, 도적단을 만든다 (sim.tribelessGathering에서 사용)
  C.canJoin = (sim, h, t) => {
    if (h.banned.includes(t.id)) return false;
    // 낙인이 찍힌 사람은 다른 부족도 알아보고 받아 주지 않는다
    if (h.branded && !t.bandit && sim.year - (h.brandedAt || 0) < 25) return false;
    if (t.bandit) return h.outlaw;
    if (!h.outlaw) return true;
    return h.notoriety < 25 && sim.year - (h.outlawSince || 0) >= 8 && !h.wanted;
  };

  C.redeem = (sim, h, t) => {
    if (!h.outlaw || t.bandit) return;
    h.outlaw = false; h.wanted = false;
    h.log(sim, `과거를 뒤로하고 ${t.name}에서 새 삶을 시작했다`);
  };

  C.foundBandits = (sim, founder, group) => {
    const p = sim.world.nearestWalkable(founder.x, founder.y, 3);
    if (!p) return;
    const t = new G.Tribe(sim, p.x, p.y, { bandit: true });
    sim.tribes.push(t);
    t.chief = founder;
    t.add(sim, founder);
    founder.job = J.CHIEF;
    for (const o of group.slice(0, 8)) if (o !== founder && o.outlaw && !o.tribe) t.add(sim, o);
    for (const m of t.members) m.wanted = true;
    founder.log(sim, `무법자들을 모아 ${josa(t.name, '을/를')} 만들고 두목이 되었다`);
    t.log(sim, `무법자 ${josa(founder.name, '이/가')} ${josa(t.name, '을/를')} 만들었습니다`);
  };

  // 감옥이 부서지면 모두 달아난다
  C.jailDestroyed = (sim, t) => {
    const ps = sim.humans.filter((h) => h.alive && h.jail && h.jail.tid === t.id);
    for (const c of ps) C.breakout(sim, c, t, null);
    t.jail = null;
  };
})();
