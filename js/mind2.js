// 마음 2: 목격과 기억, 소문 / 엉뚱한 행동(입실론) / 겹치는 기분 / 더 많은 마음의 병
//  · 목격: 번개처럼, 시야 안에서 일어난 일은 보는 사람의 기억에 남는다. 밤과 숲에서는 시야가 좁다.
//    본 사람은 성격에 따라 소문을 내거나, 당사자에게 알리거나, 협박에 쓰거나, 비밀로 묻어 둔다.
//  · 소문: 수다를 떨 때 기억이 옮겨 가고, 가끔 부풀려진다. 배우자나 경비병의 귀에 들어가면 일이 커진다.
//  · 입실론: 사람마다 정해진 판단 대신 가끔 엉뚱한 행동을 한다. 호기심 많고 충동적일수록 자주.
//  · 겹치는 기분: 같은 일을 여러 번 겪으면 무게가 커진다 (살인 1번 목격과 5번 목격은 다르다).
//  · 마음의 병: 조현병, 양극성 장애, 공황장애, 알코올 의존, PTSD. 원칙은 그대로: 병이 사람을 위험하게 만들지 않는다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const S = G.Social, M = G.Mind, C = G.Crime;
  const X = (G.Mind2 = {});
  const MEM_CAP = 10;

  // ================= 겹치는 기분 =================
  // 같은 일이 되풀이되면 쌓이는 기분 (매 틱 다시 붙는 상태 기분은 쌓이지 않는다)
  const STACK = ['witnessMurder', 'brawl', 'argued', 'robbed', 'betrayed', 'lostChild', 'lostFriend', 'lostParent', 'widowed', 'raped', 'attempted',
    'violated', 'harassed', 'abused', 'childAbused', 'blamed', 'rumor', 'quake', 'terror', 'fear', 'sawBlood', 'mourning', 'missing', 'rejected',
    'peeped', 'shamed', 'coerced', 'gift', 'comforted', 'festival', 'blessed', 'healed', 'justice', 'hero', 'unjust', 'disgusted', 'desecrated', 'gossiped'];
  for (const k of STACK) if (G.MOODS[k]) G.MOODS[k].stack = true;
  // n번 겪으면 무게가 1 + 0.5·log2(n)배 (2번 1.5배, 4번 2배, 8번 2.5배)
  X.weight = (n) => (n > 1 ? 1 + 0.5 * Math.log2(n) : 1);

  Object.assign(G.MOODS, {
    gossiped: { t: '나에 대한 소문이 돌았다', v: -12, d: 0.8 },
    secretKept: { t: '남의 비밀을 안고 있다', v: -3, d: 0.6 },
    whim: { t: '문득 하고 싶은 걸 했다', v: 6, d: 0.2 },
    voices: { t: '남들은 못 듣는 목소리가 들린다', v: -14, d: 0.3 },
    mania: { t: '들떠서 잠이 오지 않는다', v: 14, d: 0.3 },
    panic: { t: '숨이 막히는 공포가 덮쳤다', v: -20, d: 0.2 },
    startle: { t: '그날의 기억에 소스라쳤다', v: -15, d: 0.2 },
    sober: { t: '술을 끊고 버티는 중', v: -5, d: 0.3 },
  });

  // ================= 더 많은 마음의 병 =================
  Object.assign(M.CONDITIONS, {
    조현병: { desc: '남들은 못 듣는 목소리가 들리고 엉뚱한 믿음에 사로잡힌다. 사람을 피하고 혼잣말을 한다. 치료로 나아지지만 다시 도지기도 한다', mood: -10, color: '#b59ad9' },
    '양극성 장애': { desc: '들떠서 잠도 안 자고 돈을 쓰는 시기와 깊이 가라앉는 시기가 번갈아 온다', mood: -4, color: '#d9a35a' },
    공황장애: { desc: '갑자기 숨이 막히는 공포가 덮친다. 사람 많은 곳을 피한다', mood: -10, color: '#d98a8a' },
    '알코올 의존': { desc: '술 없이는 버티기 힘들다. 몸이 상하고 일이 느려진다. 가족과 치료사의 도움으로 끊을 수 있다', mood: -8, color: '#c9a05a' },
    PTSD: { desc: '끔찍한 일을 거듭 겪어 생긴 깊은 상처. 자주 그날로 돌아가고 작은 일에도 소스라친다', mood: -16, color: '#d97a9a' },
  });

  // 병을 앓은 적이 있는지 기록한다 (자식에게 이어지는 위험을 따지기 위해)
  const setCond = M.setCondition;
  M.setCondition = (sim, h, c, sev, why) => {
    if (h.mind) return;
    setCond(sim, h, c, sev, why);
    h.mindHist = h.mindHist || [];
    if (!h.mindHist.includes(c)) h.mindHist.push(c);
    if (c === '양극성 장애' && h.mind) { h.mind.phase = chance(0.5) ? 'mania' : 'down'; h.mind.phaseAt = sim.year; }
  };
  // 부모가 앓았던 병 (살아 있으면 본인, 죽었으면 기록관)
  X.familyHas = (sim, h, c) => h.parents.some((p) => {
    const o = sim.byId.get(p.id);
    if (o) return (o.mindHist || []).includes(c) || (o.mind && o.mind.c === c);
    const r = sim.archiveById.get(p.id);
    return r && r.mind === c;
  });

  // 큰 충격이 거듭되면 트라우마가 PTSD로 깊어진다
  const trauma0 = M.trauma;
  M.trauma = (sim, h, p, why) => {
    if (!h.alive || h.age < 6) return;
    h.traumas = (h.traumas || 0) + 1;
    const more = 1 + 0.3 * Math.min(5, h.traumas - 1);
    if (h.mind && h.mind.c === '트라우마') {
      if (chance(p * more)) { const sev = h.mind.sev; h.mind = null; M.setCondition(sim, h, 'PTSD', Math.min(100, sev + 20), `${why} 트라우마가 깊어져`); }
      else h.mind.sev = Math.min(100, h.mind.sev + 10);
      return;
    }
    if (!h.mind && h.traumas >= 4 && chance(p * more)) return M.setCondition(sim, h, 'PTSD', randi(50, 85), why);
    trauma0(sim, h, p * more, why);
  };

  const onset0 = M.checkOnset;
  M.checkOnset = (sim, h) => {
    onset0(sim, h);
    if (h.mind || !h.adult) return;
    const res = (h.has('침착한') ? 0.5 : 1) * (0.5 + h.p.neuro / 100 * 1.5);
    // 알코올 의존: 술에 깊이 빠졌을 때
    if (h.addiction > 75 && h.likes.includes('술') && chance(0.1)) return M.setCondition(sim, h, '알코올 의존', randi(40, 70), '술을 끊지 못하다가');
    // 공황장애: 스트레스가 오래 쌓인 예민한 사람
    if (h.highStress >= 6 && h.p.neuro > 60 && chance(0.04 * res)) return M.setCondition(sim, h, '공황장애', null, '쌓인 긴장 끝에');
    // 조현병·양극성 장애: 드물고, 부모가 앓았으면 훨씬 잘 생긴다. 주로 젊을 때 시작된다
    const young = h.age < 35 ? 1 : 0.3;
    const stress = (h.stress || 0) > 70 || (h.social || 0) > 80 ? 2 : 1;
    if (chance(0.0004 * young * stress * (X.familyHas(sim, h, '조현병') ? 6 : 1) * (h.relapse === '조현병' ? 8 : 1))) return M.setCondition(sim, h, '조현병', randi(40, 75), h.relapse === '조현병' ? '병이 다시 도져' : '어느 날부터');
    if (chance(0.0003 * young * (X.familyHas(sim, h, '양극성 장애') ? 5 : 1) * (S.hasMood(h, 'lostChild') || S.hasMood(h, 'widowed') ? 2 : 1))) return M.setCondition(sim, h, '양극성 장애', randi(40, 70), '큰일을 겪은 뒤');
  };

  // 병마다 다른 증상 (사람을 해치지는 않는다)
  const cond0 = M.conditionTick;
  M.conditionTick = (sim, h) => {
    const m = h.mind;
    if (m) X.symptoms(sim, h, m);
    const before = h.mind && h.mind.c, sev0 = h.mind && h.mind.sev;
    // 조현병과 양극성 장애는 오래가는 병이라 저절로는 아주 천천히 낫는다 (치료사와 신의 치유는 그대로 듣는다)
    const chronic = before === '조현병' || before === '양극성 장애';
    if (chronic && h.mind.sev <= 2 && sim.year - h.mind.since < 6 && !S.hasMood(h, 'treated') && !S.hasMood(h, 'healed')) h.mind.sev = 3;
    const r = cond0(sim, h);
    if (chronic && h.mind && h.mind.sev < sev0) h.mind.sev += (sev0 - h.mind.sev) * 0.75;
    if (before && !h.mind) {
      if (before === '조현병') { h.relapse = '조현병'; h.log(sim, '병이 잦아들었지만 언제 다시 도질지 모른다'); }
      if (before === '알코올 의존') { h.addiction = Math.min(h.addiction, 20); h.log(sim, '마침내 술을 끊었다'); }
    }
    return r;
  };
  X.symptoms = (sim, h, m) => {
    switch (m.c) {
      case '조현병':
        if (chance(0.12)) { S.addMood(sim, h, 'voices'); h.say('?', 120); }
        if (chance(0.04)) { h.faith = Math.min(100, h.faith + 3); if (sim.year - (h.voiceLog || -99) > 3) { h.voiceLog = sim.year; h.log(sim, pick(['신이 자신에게만 말을 건다고 믿게 되었다', '아무도 없는 곳을 향해 혼잣말을 했다', '사람들이 자기 생각을 엿듣는다고 느꼈다'])); } }
        // 오래 홀로 버려지면 나빠지고, 곁에 사람이 있으면 나아진다
        if ((h.social || 0) > 70) m.sev = Math.min(100, m.sev + 0.6);
        break;
      case '양극성 장애': {
        if (sim.year - (m.phaseAt || 0) > rand(0.4, 1)) { m.phase = m.phase === 'mania' ? 'down' : 'mania'; m.phaseAt = sim.year; h.log(sim, m.phase === 'mania' ? '갑자기 기운이 넘쳐 들뜨기 시작했다' : '들뜬 시기가 지나고 깊이 가라앉았다'); }
        if (m.phase === 'mania') {
          S.addMood(sim, h, 'mania');
          // 들뜬 시기에는 돈을 마구 나눠 주거나 내기를 한다
          if (h.gold > 5 && chance(0.1)) { let o = null; sim.near(h.x, h.y, 4, (x) => { if (!o && x !== h) o = x; }); if (o) { const g = Math.min(Math.floor(h.gold), randi(3, 10)); h.gold -= g; o.gold += g; S.bump(sim, o, h, 4); } }
          h.stress = Math.max(0, (h.stress || 0) - 2);
        } else if (chance(0.06) && h.state !== 'jailed') { h.state = 'rest'; h.timer = 200; h.say('…', 150); }
        break;
      }
      case '공황장애': {
        let crowd = 0; sim.near(h.x, h.y, 4, () => crowd++);
        if ((crowd >= 6 || (h.stress || 0) > 60) && chance(0.08) && h.state !== 'jailed') {
          S.addMood(sim, h, 'panic'); h.say('!', 120);
          h.stress = clamp((h.stress || 0) + 8, 0, 100);
          if (crowd >= 6 && h.tribe) h.goTo(sim, h.x + rand(-6, 6), h.y + rand(-6, 6), { kind: 'wander' });
        }
        break;
      }
      case '알코올 의존':
        h.health -= 0.3;
        if (chance(0.2)) h.drunk = Math.max(h.drunk || 0, 2);
        h.addiction = Math.max(h.addiction, 60);
        if (h.partner && h.partner.alive && chance(0.03)) M.adj(sim, h.partner, h, { trust: -3 });
        break;
      case 'PTSD':
        if (chance(0.15)) { S.addMood(sim, h, 'flashback'); h.say('…', 90); }
        if (G.Blood.near(sim, h.x, h.y, 3) || h.state === 'fight') { S.addMood(sim, h, 'startle'); h.stress = clamp((h.stress || 0) + 6, 0, 100); }
        break;
    }
  };
  const work0 = M.workMult;
  M.workMult = (h) => {
    if (h.mind && h.mind.c === '양극성 장애') return h.mind.phase === 'mania' ? 0.8 : 1.4;
    if (h.mind && h.mind.c === '알코올 의존') return 1.3;
    if (h.mind && h.mind.c === '조현병') return 1.2;
    return work0(h);
  };

  // ================= 목격과 기억 =================
  X.remember = (sim, w, mem) => {
    w.memories = w.memories || [];
    const same = w.memories.find((x) => x.k === mem.k && x.a === mem.a && x.b === mem.b && sim.year - x.y < 1);
    if (same) { same.n = (same.n || 1) + 1; return same; }
    const rec = { n: 1, y: Math.floor(sim.year), at: sim.year, ...mem };
    w.memories.push(rec);
    if (w.memories.length > MEM_CAP) {
      // 덜 무거운 것부터 잊는다
      w.memories.sort((a, b) => (X.weightOf(b) - X.weightOf(a)));
      w.memories.length = MEM_CAP;
    }
    return rec;
  };
  X.weightOf = (m) => (C.SEV[m.k] || (m.k === '바람' ? 2 : 1)) * (m.n || 1) - (G.curSim ? (G.curSim.year - m.at) * 0.15 : 0);
  X.knowsOf = (h, mem) => (h.memories || []).some((x) => x.k === mem.k && x.a === mem.a && x.y === mem.y);

  // 시야: 낮 6칸, 밤 3칸, 숲 안이면 더 좁다
  X.sight = (sim, w) => {
    let r = sim.isNight() && sim.mode.night ? 3 : 6;
    if (sim.world.typeAt(w.x, w.y) === G.T.FOREST) r *= 0.6;
    const t = sim.world.typeAt(w.x, w.y);
    if (t === G.T.HILL || t === G.T.MOUNTAIN) r *= 1.4;
    return r;
  };

  // 어떤 일이 일어났을 때, 본 사람들을 모아 기억시키고 반응하게 한다
  X.witness = (sim, x, y, k, a, b, opts = {}) => {
    const seen = [];
    sim.near(x, y, 9, (w) => {
      if (w === a || w === b || w.age < 8 || w.state === 'sleep' || w.jail) return;
      const d = G.dist(w.x, w.y, x, y), r = X.sight(sim, w);
      if (d > r || !chance(1 - d / (r * 1.3))) return;
      seen.push(w);
    });
    for (const w of seen) X.react(sim, w, { k, a: a.id, an: a.name, b: b ? b.id : null, bn: b ? b.name : (opts.victim || null), how: 'saw' }, a, b, opts);
    return seen;
  };

  // 성격에 따른 반응
  X.react = (sim, w, mem, a, b, opts) => {
    const rec = X.remember(sim, w, mem);
    const close = (S.peek(w, a)?.v || 0) >= 60 || S.isFamily(w, a.id);
    if (mem.k === '바람') {
      const spouse = S.mate(a) && S.mate(a) !== b ? S.mate(a) : (b && S.mate(b) && S.mate(b) !== a ? S.mate(b) : null);
      if (w === spouse) return X.revealAffair(sim, a, b, w, '직접 보고');
      const forSpouse = spouse && ((S.peek(w, spouse)?.v || 0) >= 50 || S.isFamily(w, spouse.id));
      if (close && !w.has('정직한')) { rec.act = 'secret'; S.addMood(sim, w, 'secretKept'); w.log(sim, `${josa(a.name, '이/가')} ${b ? b.name + '과(와) ' : ''}몰래 만나는 것을 보았지만 비밀로 묻어 두었다`); return; }
      if (spouse && (w.has('정직한') || forSpouse)) { rec.act = 'told'; w.log(sim, `${a.name}의 바람을 ${spouse.name}에게 알려 주었다`); return X.revealAffair(sim, a, b, spouse, `${w.name}에게서 듣고`); }
      if ((w.has('교활한') || w.has('탐욕스러운')) && w.gold < 40 && w.adult && !S.rel(w, a).blackmailing) {
        rec.act = 'blackmail';
        S.rel(w, a).blackmailing = true; S.rel(a, w).blackmailer = true;
        w.log(sim, `${a.name}의 바람을 보고 이를 빌미로 돈을 뜯기로 했다`);
        a.log(sim, `${josa(w.name, '이/가')} 바람을 알고 협박해 왔다`);
        C.record(sim, w, '갈취', a.name, false);
        return;
      }
      if (w.p.extra > 55 || w.p.agree < 40) { rec.act = 'gossip'; w.log(sim, `${josa(a.name, '이/가')} 몰래 만나는 것을 보고 여기저기 이야기했다`); return; }
      rec.act = 'quiet';
      return;
    }
    // 범죄를 본 사람: 감싸 주거나, 기억해 두거나, 소문을 낸다
    if (C.SEV[mem.k] !== undefined) {
      if (opts.hidden) { rec.act = 'secret'; return; } // 감싸 주기로 한 사람
      rec.act = w.p.extra > 55 || w.p.agree < 40 ? 'gossip' : 'quiet';
      return;
    }
    // 좋은 일: 불을 끈 사람, 위로해 준 사람
    rec.act = 'gossip';
  };

  // 바람이 드러난다 (social.couples의 들킴과 같은 결과)
  X.revealAffair = (sim, a, b, spouse, how) => {
    if (!spouse || !spouse.alive || !a.affair) return;
    S.addMood(sim, spouse, 'betrayed'); S.addMood(sim, spouse, 'jealous');
    S.bump(sim, spouse, a, -40, -45);
    M.adj(sim, spouse, a, { trust: -60, grudge: 45 });
    if (b) { S.bump(sim, spouse, b, -50); M.adj(sim, spouse, b, { grudge: 65, jealousy: 70 }); S.rel(spouse, b).rival = true; G.Crime2.adultery(sim, a, b); }
    spouse.log(sim, `${how} ${josa(a.name, '이/가')} ${b ? b.name + '과(와) ' : ''}몰래 만난다는 것을 알게 되었다`);
    a.log(sim, `바람이 ${spouse.name}에게 알려졌다`);
    spouse.say('#', 150);
    if (sim.year - (sim.lastAffairEvent || -99) > 2) { sim.lastAffairEvent = sim.year; sim.event(`${josa(spouse.name, '이/가')} ${how} ${a.name}의 바람을 알아챘습니다`, '#ff7a9a', a.x, a.y); }
  };

  // ================= 소문 (수다를 떨 때 Mind.onMeet에서 부른다) =================
  X.gossip = (sim, h, o) => {
    if (!h.memories || !h.memories.length || !chance(0.3 + h.p.extra / 300)) return;
    const pool = h.memories.filter((m) => m.act !== 'secret' && m.a !== o.id && m.b !== o.id && !X.knowsOf(o, m) && (m.act === 'gossip' || chance(0.15)));
    if (!pool.length) return;
    const m = pool.sort((x, y) => X.weightOf(y) - X.weightOf(x))[0];
    const ex = m.ex || chance(0.2); // 소문은 옮겨 가며 부풀려지기도 한다
    const heard = { k: m.k, a: m.a, an: m.an, b: m.b, bn: m.bn, y: m.y, how: 'heard', from: h.name, ex, act: o.p.extra > 60 ? 'gossip' : 'quiet' };
    X.remember(sim, o, heard);
    const a = sim.byId.get(m.a);
    const hurt = (ex ? 2 : 1);
    if (a && a.alive) {
      M.adj(sim, o, a, { trust: -(m.k === '바람' ? 8 : 6 * Math.min(5, C.SEV[m.k] || 1)) * hurt, respect: -4 * hurt });
      // 당사자의 귀에 들어간 소문
      if (o === a) return;
      // 배우자의 귀에 들어가면 바람이 드러난다
      if (m.k === '바람' && S.mate(a) === o) return X.revealAffair(sim, a, m.b ? sim.byId.get(m.b) : null, o, `${h.name}에게서 소문을 듣고`);
      // 경비병이나 족장의 귀에 들어가면 숨긴 죄를 조사한다
      if ((o.job === J.GUARD || o.job === J.CHIEF) && C.SEV[m.k] !== undefined) {
        const hid = a.crimes.find((c) => c.type === m.k && !c.known && !c.fake);
        if (hid && chance(0.25 * hurt)) { o.log(sim, `${a.name}에 대한 소문을 듣고 조사해 죄를 밝혀냈다`); C.report(sim, a, hid.type, hid.victim); }
      }
      // 소문이 당사자에게 닿으면 퍼뜨린 사람을 원망한다
      if (chance(0.1)) { S.addMood(sim, a, 'gossiped'); M.adj(sim, a, h, { grudge: 15 }); a.log(sim, `${josa(h.name, '이/가')} 자기 이야기를 ${ex ? '부풀려 ' : ''}퍼뜨리고 다닌다는 걸 알았다`); }
    }
    if (m.k === 'hero' && a) M.adj(sim, o, a, { respect: 6, trust: 4 });
    if (sim.year - (h.gossipLog || -99) > 3) { h.gossipLog = sim.year; h.log(sim, `${o.name}에게 ${m.an}에 대한 ${ex ? '부풀린 ' : ''}이야기를 했다`); }
    sim.stats.gossip = (sim.stats.gossip || 0) + 1;
  };

  // 오래된 기억은 흐려진다
  X.forget = (sim, h) => {
    if (!h.memories || !h.memories.length) return;
    h.memories = h.memories.filter((m) => sim.year - m.at < 6 + (C.SEV[m.k] || 1) * 2);
  };

  // ================= 입실론: 가끔 엉뚱한 행동 =================
  // 판단 대신 무작위로 고른다. 호기심·개방성·충동성이 높을수록, 성실할수록 낮다. 아이는 더 자주
  X.epsilon = (h) => clamp(0.02 + h.p.open / 100 * 0.04 + h.p.impulse / 100 * 0.03 + (h.has('호기심 많은') ? 0.03 : 0) - h.p.consc / 100 * 0.02 + (h.age < 14 ? 0.05 : 0), 0.01, 0.15);
  X.WHIMS = [
    ['언덕에 올라 먼 곳을 바라보았다', (sim, h) => { const s = G.Persona.spot(sim, h, 'hill'); return s && h.goTo(sim, s.x, s.y, { kind: 'wander' }); }],
    ['괜히 먼 길로 산책을 나섰다', (sim, h) => h.wander(sim, h.x, h.y, 14)],
    ['문득 바닷가에 가 보고 싶어졌다', (sim, h) => { const s = G.Persona.spot(sim, h, 'shore'); return s && h.goTo(sim, s.x, s.y, { kind: 'wander' }); }],
    ['좋아하지도 않는 일을 괜히 해 보았다', (sim, h) => { const all = Object.keys(G.Persona.HOBBIES).filter((x) => !G.Persona.HOBBIES[x].addictive); return G.Persona.goHobby(sim, h, pick(all)); }],
    ['오랜만에 아는 사람을 찾아갔다', (sim, h) => { const ids = [...h.rel.keys()]; const o = ids.length && sim.byId.get(pick(ids)); return o && o.alive && G.dist(o.x, o.y, h.x, h.y) < 25 && h.goTo(sim, o.x, o.y, { kind: 'visit', with: o.id }); }],
    ['혼자 신에게 기도를 올렸다', (sim, h) => { h.startPray(sim, '문득'); return true; }],
    ['일을 미루고 풀밭에 누워 낮잠을 잤다', (sim, h) => { h.state = 'rest'; h.timer = 160; h.say('z', 120); return true; }],
    ['숲에서 이름 모를 열매를 따 먹었다', (sim, h) => { const f = sim.world.findResource(h.x, h.y, 'food', 12); return f && h.goTo(sim, f.x + 0.5, f.y + 0.5, { kind: 'gather', res: 'food', tile: f.i, cap: 1 }); }],
  ];
  X.whim = (sim, h) => {
    if (!h.adult && h.age < 6) return false;
    if (!chance(X.epsilon(h) * 0.25)) return false; // 판단할 때마다 이만큼
    const [text, fn] = pick(X.WHIMS);
    if (!fn(sim, h)) return false;
    S.addMood(sim, h, 'whim');
    if (sim.year - (h.whimLog || -99) > 4) { h.whimLog = sim.year; h.log(sim, text); }
    sim.stats.whims = (sim.stats.whims || 0) + 1;
    return true;
  };

  // 60틱마다
  X.tick = (sim, h) => { if (chance(0.05)) X.forget(sim, h); };
})();
