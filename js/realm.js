// 영역과 지도자: 부족의 영역이 맞닿으면 족장이 전쟁·평화협정·공존·조공 중 하나를 고른다.
//  - 영역은 인구와 집이 늘수록 넓어진다 (지도의 점선 원)
//  - 족장의 성격(야심찬·용감한·냉정한·탐욕스러운 ↔ 너그러운·다정한·겁많은), 성격 수치(충동성·친화성·테토),
//    능력(지식·나이·체력·매력·전공), 섬기는 신, 두 부족의 힘 차이, 관계, 굶주림이 모두 판단에 들어간다
//  - 평화협정을 맺으면 정해진 해 동안 싸우지 않는다. 다만 교활하고 야심찬 족장은 힘이 크게 앞서면 협정을 깨기도 한다
//  - 공존은 서로의 경계를 인정하는 느슨한 약속이고, 조공은 약한 부족이 해마다 금화를 바쳐 전쟁을 피하는 것이다
//  - 호전적인 족장은 이기고 있는 전쟁을 쉽게 끝내지 않는다. 전쟁이 끝나면 몇 해 동안 휴전한다
(function () {
  const G = globalThis.G;
  const { rand, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const R = (G.Realm = {});

  R.radius = (t) => 6 + Math.sqrt(t.members.length) * 2 + Math.min(4, t.houses.length * 0.25);

  // ---------------- 지도자 ----------------
  const TRAIT_AGGR = { 야심찬: 25, 용감한: 12, 냉정한: 15, 탐욕스러운: 12, 충동적인: 10, '질투심 많은': 6, 너그러운: -20, 다정한: -18, 겁많은: -20, 침착한: -8, '신앙심 깊은': -5, 정직한: -4 };
  R.leader = (sim, t) => {
    const c = t.chief;
    if (!c || !c.alive) return { aggr: t.bandit ? 40 : 0, ability: 30, stance: '지도자 없음', cunning: false, none: true };
    let aggr = 0;
    for (const x of c.traits) aggr += TRAIT_AGGR[x] || 0;
    aggr += (c.p.impulse - 50) * 0.3 + (50 - c.p.agree) * 0.3 + (c.teto || 0) * 0.08;
    const god = t.god;
    if (god === 'wrath') aggr += 6; else if (god === 'mercy' || god === 'love') aggr -= 8;
    if (c.mind && c.mind.c === '편집증') aggr += 10;
    if ((c.herbAddict || 0) > 50) aggr += 5;
    if (t.bandit) aggr += 30;
    // 능력: 지식·경험·체력·매력·전공
    const ability = clamp(Math.min(30, c.knowledge * 0.6) + clamp(c.age - 22, 0, 30) * 0.7 + c.body * 0.2 + G.Persona.charm(c) * 0.2 + Math.min(15, c.kills * 3) + (t.found ? t.found.length * 2 : 0), 0, 100);
    const stance = aggr >= 30 ? '정복자' : aggr >= 10 ? '강경파' : aggr <= -25 ? '평화주의자' : aggr <= -8 ? '온건파' : '실리파';
    return { aggr, ability, stance, cunning: c.has('교활한'), greedy: c.has('탐욕스러운'), c };
  };
  R.STANCE_TEXT = {
    정복자: '영역이 닿으면 먼저 칼을 뽑는다. 이길 것 같으면 협정도 깨기 쉽다',
    강경파: '쉽게 물러서지 않는다. 힘이 앞서면 전쟁을, 밀리면 협정을 고른다',
    실리파: '힘과 이익을 따져 전쟁·협정·조공 중 득이 되는 쪽을 고른다',
    온건파: '웬만하면 협정을 맺거나 공존한다',
    평화주의자: '어떻게든 싸움을 피한다. 약하면 조공을 바쳐서라도',
    '지도자 없음': '족장이 없어 결정을 미룬다',
  };

  // 부족의 힘: 어른, 전사, 도구, 금고
  R.strength = (t) => {
    let s = 0;
    for (const m of t.members) if (m.adult && !m.jail) s += m.job === J.WARRIOR ? 2.2 : m.job === J.GUARD ? 1.6 : m.age > 60 ? 0.5 : 1;
    s *= 1 + t.toolBonus();
    if (t.has && t.has('청동')) s *= 1.15;
    return s + Math.min(10, t.treasury / 40);
  };

  // ---------------- 협정 ----------------
  R.key = (a, b) => (a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id);
  R.pact = (sim, a, b) => {
    const p = sim.pacts && sim.pacts.get(R.key(a, b));
    if (!p) return null;
    if (p.until < sim.year) { sim.pacts.delete(R.key(a, b)); return null; }
    return p;
  };
  R.setPact = (sim, a, b, kind, years, extra = {}) => {
    sim.pacts = sim.pacts || new Map();
    const p = { kind, since: sim.year, until: sim.year + years, ...extra };
    sim.pacts.set(R.key(a, b), p);
    return p;
  };
  R.PACT_NAME = { peace: '평화협정', coexist: '공존', tribute: '조공', truce: '휴전' };

  // A의 족장이 B를 보고 내리는 판단 점수
  const judge = (sim, a, b) => {
    const La = R.leader(sim, a), sa = R.strength(a), sb = R.strength(b);
    const ratio = sa / Math.max(1, sb);
    const rel = sim.getRel(a, b);
    const wise = La.ability / 100;
    // 전쟁: 호전성 + 이길 가능성(능력 있는 지도자일수록 힘의 차이를 정확히 본다) + 나쁜 관계 + 굶주림 + 탐욕
    let war = La.aggr + (ratio - 1) * (20 + 30 * wise) - rel * 0.35;
    if (a.stock.food < a.members.length) war += 12;
    if (La.greedy && b.treasury > a.treasury * 1.5) war += 10;
    if (ratio < 0.7) war -= 25 * (0.5 + wise); // 지혜로운 족장은 질 싸움을 하지 않는다
    if (G.Faith && G.Faith.kinship(a, b) > 0) war -= 10;
    if (a.recentWar && sim.year - a.recentWar < 4) war -= 12; // 전쟁에 지쳤다
    // 평화: 온화함 + 관계 + 능력(협상)
    let peace = -La.aggr + rel * 0.3 + wise * 20 + (ratio < 1 ? (1 - ratio) * 25 : 0);
    return { war, peace, ratio, La, sa, sb };
  };

  R.meet = (sim, a, b, first) => {
    if (a.bandit || b.bandit || a.wars.has(b.id)) return;
    if (R.pact(sim, a, b)) return;
    const ja = judge(sim, a, b), jb = judge(sim, b, a);
    const names = `${josa(a.name, '과/와')} ${b.name}`;
    const namesI = `${josa(a.name, '과/와')} ${josa(b.name, '이/가')}`;
    if (first) {
      sim.event(`${names}의 영역이 맞닿았습니다`, '#f0c070', (a.cx + b.cx) / 2, (a.cy + b.cy) / 2);
      sim.stats.borders = (sim.stats.borders || 0) + 1;
    }
    if (ja.La.none && jb.La.none) return;
    // 누가 먼저 칼을 뽑는가
    const [att, def, jatt] = ja.war >= jb.war ? [a, b, ja] : [b, a, jb];
    const jdef = att === a ? jb : ja;
    let warP = clamp((jatt.war - 18) / 50, 0, 0.7) * (first ? 1 : 0.4);
    // 평화주의자는 먼저 칼을 뽑지 않고, 온건파는 굶주리거나 원한이 깊을 때만 싸운다
    if (jatt.La.stance === '평화주의자' || jatt.La.none) warP = 0;
    else if (jatt.La.stance === '온건파' && !(att.stock.food < att.members.length || sim.getRel(att, def) < -60)) warP *= 0.2;
    if (chance(warP)) {
      const c = jatt.La.c;
      sim.declareWar(att, def, true);
      const why = jatt.ratio > 1.3 ? '힘을 믿고' : att.stock.food < att.members.length ? '굶주림 끝에 땅을 차지하려고' : jatt.La.greedy && def.treasury > att.treasury ? '이웃의 금고를 탐내' : '경계를 두고 다투다';
      att.log(sim, `${c ? `${att.name}의 ${att.title} ${josa(c.name, '이/가')} ` : `${josa(att.name, '이/가')} `}${why} ${def.name}에 쳐들어가기로 했습니다 (${jatt.La.stance})`);
      if (c) c.log(sim, `영역이 맞닿은 ${josa(def.name, '과/와')} 전쟁을 하기로 결심했다`);
      return;
    }
    // 약하고 겁 많은 쪽이 조공을 바쳐 전쟁을 피한다
    if (jatt.war > 15 && jdef.ratio < 0.6 && (jdef.La.stance === '평화주의자' || jdef.La.stance === '온건파' || jdef.La.stance === '실리파') && chance(0.6)) {
      const amt = Math.max(5, Math.floor(def.treasury * 0.15));
      R.setPact(sim, att, def, 'tribute', 6, { from: def.id, to: att.id, amt });
      sim.changeRel(att, def, 10);
      att.log(sim, `${josa(def.name, '이/가')} 전쟁을 피하려 해마다 금화 ${amt}개를 ${att.name}에 바치기로 했습니다 (${jdef.La.stance})`);
      return;
    }
    const peace = (ja.peace + jb.peace) / 2;
    if (peace > 18 && chance(clamp(peace / 50, 0.2, 0.9))) {
      const yrs = Math.round(8 + (ja.La.ability + jb.La.ability) / 15);
      R.setPact(sim, a, b, 'peace', yrs);
      sim.changeRel(a, b, 25);
      a.log(sim, `${namesI} ${yrs}년의 평화협정을 맺었습니다`);
      for (const [t, j] of [[a, ja], [b, jb]]) if (j.La.c) j.La.c.log(sim, `${josa(t === a ? b.name : a.name, '과/와')} 평화협정을 맺었다`);
      return;
    }
    if (peace > -5 || chance(0.5)) {
      R.setPact(sim, a, b, 'coexist', 8);
      sim.changeRel(a, b, 6);
      a.log(sim, `${namesI} 서로의 경계를 인정하고 함께 살아가기로 했습니다`, first);
      return;
    }
    // 아무것도 정하지 못하면 경계에서 긴장이 쌓인다
    sim.changeRel(a, b, -8);
    if (first) a.log(sim, `${names} 사이에 긴장이 감돕니다`, false);
  };

  // 해마다: 영역이 닿은 부족끼리 판단하고, 조공을 걷고, 협정을 지키거나 깬다
  R.yearly = (sim) => {
    sim.borders = sim.borders || new Set();
    const ts = sim.tribes.filter((t) => t.alive && t.members.length);
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const a = ts[i], b = ts[j];
      const key = R.key(a, b);
      const touch = G.dist(a.cx, a.cy, b.cx, b.cy) < R.radius(a) + R.radius(b);
      if (!touch) { sim.borders.delete(key); continue; }
      const first = !sim.borders.has(key);
      sim.borders.add(key);
      const p = R.pact(sim, a, b);
      if (p && p.kind === 'tribute') {
        const from = p.from === a.id ? a : b, to = from === a ? b : a;
        const amt = Math.min(p.amt, Math.floor(from.treasury));
        from.treasury -= amt; to.treasury += amt;
        if (amt < p.amt * 0.5 && chance(0.5)) { sim.pacts.delete(key); from.log(sim, `${josa(from.name, '이/가')} 더는 조공을 바치지 못하게 되었습니다`); }
        continue;
      }
      if (p && p.kind !== 'truce') {
        // 협정 깨기: 교활하고 호전적인 족장이 힘이 크게 앞설 때
        for (const [x, y] of [[a, b], [b, a]]) {
          const jx = judge(sim, x, y);
          if (jx.La.cunning && jx.La.aggr > 15 && jx.ratio > 1.5 && chance(0.25)) {
            sim.pacts.delete(key);
            sim.declareWar(x, y, true);
            x.log(sim, `${x.name}의 ${x.title} ${josa(jx.La.c.name, '이/가')} ${josa(R.PACT_NAME[p.kind], '을/를')} 깨고 ${josa(y.name, '을/를')} 기습했습니다`);
            x.betrayals = (x.betrayals || 0) + 1;
            for (const o of sim.tribes) if (o.alive && o !== x && o !== y) sim.changeRel(x, o, -15); // 배신자는 모두가 꺼린다
            break;
          }
        }
        continue;
      }
      if (p) continue;
      if (first || chance(0.25)) R.meet(sim, a, b, first);
    }
  };

  // ---------------- 전쟁과 평화 ----------------
  // 협정이 있으면 관계가 나빠져도 전쟁을 선포하지 않는다 (force: 지도자가 직접 결정한 경우)
  const declare0 = G.Sim.prototype.declareWar;
  G.Sim.prototype.declareWar = function (a, b, force) {
    if (!force && !a.bandit && !b.bandit) {
      const p = R.pact(this, a, b);
      if (p) return;
      // 평화주의자 족장은 관계가 나빠도 먼저 전쟁을 일으키지 않는다
      const L = R.leader(this, a);
      if (L.aggr < -15 && chance(0.7)) return;
    }
    if (a.wars.has(b.id)) return;
    declare0.call(this, a, b);
    a.recentWar = b.recentWar = this.year;
  };
  const peace0 = G.Sim.prototype.makePeace;
  G.Sim.prototype.makePeace = function (a, b, force) {
    if (!force && a.members.length >= 4 && b.members.length >= 4) {
      const years = this.year - (a.warStart[b.id] ?? this.year);
      // 이기고 있는 호전적인 족장은 전쟁을 쉽게 끝내지 않는다
      for (const [x, y] of [[a, b], [b, a]]) {
        const L = R.leader(this, x);
        if (L.aggr > 25 && R.strength(x) > R.strength(y) * 1.2 && years < 5 && chance(0.4)) return;
      }
    }
    peace0.call(this, a, b);
    a.recentWar = b.recentWar = this.year;
    if (!a.bandit && !b.bandit) R.setPact(this, a, b, 'truce', 6);
  };

  const yearly0 = G.Sim.prototype.yearly;
  G.Sim.prototype.yearly = function () { yearly0.call(this); R.yearly(this); };

  R.relText = (sim, t, o) => {
    const p = R.pact(sim, t, o);
    if (!p) return '';
    const left = Math.max(0, Math.ceil(p.until - sim.year));
    if (p.kind === 'tribute') return p.from === t.id ? `조공을 바침 (해마다 ${p.amt})` : `조공을 받음 (해마다 ${p.amt})`;
    return `${R.PACT_NAME[p.kind]} ${left}년 남음`;
  };
})();
