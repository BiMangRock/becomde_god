// 유전: 성격 수치·체력·외모·마음의 병에 걸리기 쉬운 기질·드문 형질이 부모에게서 자식으로 이어진다.
// 유전자는 태어날 때 한 번 정해져 몸에 남으므로, 부모가 죽은 뒤에도 손자·증손자에게 이어진다.
//  - 여러 유전자가 겹치는 성질(다인자): 부모 평균 쪽으로 가되 무작위로 흔들리고 평균으로 조금 돌아간다
//  - 드문 형질(멘델 유전): 열성은 두 벌이 모두 있어야, 우성은 한 벌만 있어도 드러난다. 색맹은 X 염색체를 따라 아들에게 잘 나타난다
// 유전은 '위험'을 바꿀 뿐 운명을 정하지 않는다. 같은 기질이라도 겪은 일과 곁의 사람에 따라 병이 생기기도, 안 생기기도 한다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const Gn = (G.Genes = {});

  // 정규분포 (표준편차를 그대로 따른다)
  const nrand = (m, sd) => m + sd * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

  // 마음의 병에 걸리기 쉬운 기질 (0~1, 평균 m)
  Gn.LIAB = {
    dep: { name: '우울', m: 0.3, sd: 0.13, cond: '우울증' },
    anx: { name: '불안', m: 0.3, sd: 0.13, cond: '불안증' },
    pan: { name: '공황', m: 0.22, sd: 0.11, cond: '공황장애' },
    scz: { name: '조현', m: 0.15, sd: 0.1, cond: '조현병' },
    bip: { name: '양극성', m: 0.15, sd: 0.1, cond: '양극성 장애' },
    add: { name: '중독', m: 0.3, sd: 0.13, cond: '알코올 의존' },
  };
  // 그 밖의 다인자 형질
  Gn.POLY = {
    body: { m: 55, sd: 13, lo: 3, hi: 100 },
    looks: { m: 50, sd: 11, lo: 0, hi: 100 },
    iq: { m: 1, sd: 0.18, lo: 0.5, hi: 1.7 }, // 배우는 빠르기
  };
  // 드문 형질: dom 우성 / rec 열성 / x X 염색체 열성
  Gn.RARE = {
    red: { name: '붉은 머리', mode: 'rec', f: 0.25, desc: '열성 유전. 부모 모두에게서 받아야 드러난다' },
    left: { name: '왼손잡이', mode: 'rec', f: 0.3, desc: '열성 유전. 싸움에서 상대가 익숙지 않아 조금 유리하다' },
    cb: { name: '색맹', mode: 'x', f: 0.12, desc: 'X 염색체 열성 유전. 아들에게 훨씬 흔하다. 열매를 고르는 데 조금 서툴다' },
    long: { name: '장수 집안', mode: 'dom', f: 0.04, desc: '우성 유전. 한 벌만 받아도 늙음이 12년쯤 늦게 온다' },
    twin: { name: '쌍둥이 내림', mode: 'dom', f: 0.06, desc: '우성 유전. 어머니에게 있으면 쌍둥이를 낳기 쉽다' },
    frail: { name: '약한 심장', mode: 'rec', f: 0.15, desc: '열성 유전. 최대 체력이 낮고 험한 일에 쉽게 지친다' },
  };

  const DIMS = () => Object.keys(G.Persona.DIMS);
  const DIM_H2 = 0.45;

  // ---------------- 부모의 유전자 찾기 ----------------
  // 살아 있으면 본인, 죽었으면 기록관에 남긴 유전자. 낳는 순간에는 sim.birth가 넘겨준 부모를 쓴다
  let pending = null;
  const genesOf = (sim, ref) => {
    if (!ref) return null;
    if (pending) for (const o of pending) if (o && o.id === ref.id && o.genes) return o.genes;
    const o = sim.byId.get(ref.id);
    if (o && o.genes) return o.genes;
    const r = sim.archiveById.get(ref.id);
    return r && r.genes ? r.genes : null;
  };

  // 다인자 유전: 자식의 타고난 값 = 부모 평균 + 어느 쪽 유전자를 받느냐에 따른 흔들림 (분리 분산은 집단 분산의 절반)
  // 이렇게 하면 세대가 지나도 사람들 사이의 차이가 사라지지 않는다. 모르는 부모는 처음 사람처럼 무작위로 둔다
  const fromParents = (mv, dv, D) => {
    const lo = D.lo ?? 0, hi = D.hi ?? 1;
    const founder = () => clamp(nrand(D.m, D.sd), lo, hi);
    const has = (v) => v !== undefined && v !== null;
    if (!has(mv) && !has(dv)) return founder();
    const a = has(mv) ? mv : founder(), b = has(dv) ? dv : founder();
    return clamp((a + b) / 2 + nrand(0, D.sd * 0.71), lo, hi);
  };

  Gn.make = (sim, h, parents) => {
    const mg = genesOf(sim, parents && parents[0]), dg = genesOf(sim, parents && parents[1]);
    const g = { liab: {}, dim: {}, poly: {}, al: {} };
    for (const k in Gn.LIAB) g.liab[k] = fromParents(mg && mg.liab[k], dg && dg.liab[k], Gn.LIAB[k]);
    for (const k of DIMS()) g.dim[k] = fromParents(mg && mg.dim[k], dg && dg.dim[k], { m: 50, sd: 12, lo: 0, hi: 100 });
    for (const k in Gn.POLY) g.poly[k] = fromParents(mg && mg.poly[k], dg && dg.poly[k], Gn.POLY[k]);
    g.teto = fromParents(mg && mg.teto, dg && dg.teto, { m: 0, sd: 22, lo: -100, hi: 100 });
    // 드문 형질 (대립유전자 두 벌, 아들의 X는 한 벌)
    for (const k in Gn.RARE) {
      const R = Gn.RARE[k];
      const founder = () => (chance(R.f) ? 1 : 0);
      const fromAuto = (pg) => (pg && pg.al[k] ? pick(pg.al[k]) : founder());
      if (R.mode === 'x') {
        const fromMom = mg && mg.al[k] ? pick(mg.al[k]) : founder();
        if (h.gender === 'M') g.al[k] = [fromMom];
        else g.al[k] = [fromMom, dg && dg.al[k] ? dg.al[k][0] : founder()];
      } else g.al[k] = [fromAuto(mg), fromAuto(dg)];
    }
    // 겉모습: 부모 중 한쪽을 닮는다
    g.skin = mg && dg ? pick([mg.skin, dg.skin]) : (mg || dg) ? (mg || dg).skin : null;
    g.hair = mg && dg ? pick([mg.hair, dg.hair]) : (mg || dg) ? (mg || dg).hair : null;
    g.known = !!(mg || dg);
    return g;
  };

  Gn.has = (h, k) => {
    const g = h.genes; if (!g || !g.al[k]) return false;
    const a = g.al[k], R = Gn.RARE[k];
    if (R.mode === 'dom') return a.some((x) => x);
    if (R.mode === 'x') return a.length === 1 ? !!a[0] : a.every((x) => x);
    return a.every((x) => x);
  };
  Gn.carrier = (h, k) => { const g = h.genes; return !!(g && g.al[k] && g.al[k].some((x) => x) && !Gn.has(h, k)); };
  Gn.liab = (h, k) => (h.genes ? h.genes.liab[k] : Gn.LIAB[k].m);
  // 평균일 때 1, 기질이 높을수록 가파르게 커진다
  Gn.risk = (h, k) => { const L = Gn.LIAB[k]; return Math.pow(Math.max(0.05, Gn.liab(h, k)) / L.m, 2); };
  Gn.addMult = (h) => clamp(0.5 + Gn.liab(h, 'add') * 1.7, 0.5, 2.2);
  Gn.iq = (h) => (h.genes ? h.genes.poly.iq : 1);

  // ---------------- 성격·체력에 반영 ----------------
  const init0 = G.Persona.init;
  G.Persona.init = (sim, h, parents) => {
    init0(sim, h, parents);
    const g = (h.genes = Gn.make(sim, h, parents));
    // 타고난 값 + 자라면서 겪는 일(무작위)로 성격이 정해진다
    const p = h.p;
    for (const k of DIMS()) p[k] = clamp(Math.round(g.dim[k] + nrand(0, 6)), 0, 100);
    const t = (name, k, d) => { if (h.traits.includes(name)) p[k] = clamp(p[k] + d, 0, 100); };
    t('충동적인', 'impulse', 30); t('침착한', 'impulse', -30); t('침착한', 'neuro', -20);
    t('부지런한', 'consc', 30); t('게으른', 'consc', -30);
    t('다정한', 'agree', 25); t('냉정한', 'agree', -25); t('너그러운', 'agree', 15);
    t('호기심 많은', 'open', 30); t('의심 많은', 'open', -10); t('겁많은', 'neuro', 15);
    // 우울·불안 기질은 예민함에, 중독 기질은 중독성에 스며든다
    p.neuro = clamp(Math.round(p.neuro + (g.liab.dep + g.liab.anx - 0.6) * 40), 0, 100);
    p.addict = clamp(Math.round(p.addict + (g.liab.add - 0.3) * 60), 0, 100);
    h.body = clamp(Math.round(g.poly.body + nrand(0, 5)), 3, 100);
    if (Gn.has(h, 'frail')) h.body = Math.max(3, Math.round(h.body * 0.7));
    h.looks = clamp(Math.round(g.poly.looks + nrand(0, 4)), 0, 100);
    h.teto = clamp(Math.round(g.teto + (h.gender === 'M' ? 25 : -25) + nrand(0, 8)), -100, 100);
    h.maxHp = Math.round(60 + h.body * 0.5);
    h.health = Math.min(h.health, h.maxHp);
  };

  // 기록관에 유전자를 남긴다 (자손이 이어받을 수 있게)
  const kill0 = G.Sim.prototype.kill;
  G.Sim.prototype.kill = function (h, cause, killer) {
    const was = h.alive;
    kill0.call(this, h, cause, killer);
    if (was && !h.alive) { const r = this.archiveById.get(h.id); if (r) { r.genes = h.genes; r.mindHist = h.mindHist; } }
  };

  // 태어날 때: 부모를 넘겨주고, 쌍둥이 내림이 있으면 쌍둥이를 낳기도 한다
  const birth0 = G.Sim.prototype.birth;
  G.Sim.prototype.birth = function (mom, dad) {
    pending = [mom, dad];
    let c;
    try { c = birth0.call(this, mom, dad); } finally { pending = null; }
    if (c && chance(Gn.has(mom, 'twin') ? 0.12 : 0.008) && !this._twin) {
      this._twin = true;
      pending = [mom, dad];
      let c2;
      try { c2 = birth0.call(this, mom, dad); } finally { pending = null; this._twin = false; }
      if (c2) {
        c.twin = c2.id; c2.twin = c.id;
        c.log(this, `쌍둥이 ${josa(c2.name, '과/와')} 함께 태어났다`); c2.log(this, `쌍둥이 ${josa(c.name, '과/와')} 함께 태어났다`);
        mom.log(this, '쌍둥이를 낳았다');
        if (mom.tribe) mom.tribe.log(this, `${josa(mom.name, '이/가')} 쌍둥이 ${c.name}·${josa(c2.name, '을/를')} 낳았습니다`, false);
        this.stats.twins = (this.stats.twins || 0) + 1;
      }
    }
    return c;
  };

  // 겉모습 (머리색·피부색)은 사람이 만들어진 뒤에 정한다
  const spawn0 = G.Sim.prototype.spawnHuman;
  G.Sim.prototype.spawnHuman = function (x, y, o) {
    const h = spawn0.call(this, x, y, o);
    const g = h.genes;
    if (g) {
      if (g.skin) h.skin = g.skin; else g.skin = h.skin;
      if (g.hair) h.hair = g.hair; else g.hair = h.hair;
      if (Gn.has(h, 'red')) h.hair = '#b4471f';
    }
    return h;
  };

  // ---------------- 마음의 병 ----------------
  // 부모가 앓았는지 대신 '타고난 기질'로 조현병·양극성 장애의 위험을 정한다 (가족력은 기질에 이미 담겨 있다)
  const fam0 = G.Mind2.familyHas;
  G.Mind2.familyHas = (sim, h, c) => {
    if (h.genes) {
      const k = c === '조현병' ? 'scz' : c === '양극성 장애' ? 'bip' : null;
      if (k) return h.genes.liab[k] > 0.33;
    }
    return fam0(sim, h, c);
  };
  // 기질이 높으면 작은 일에도 병이 시작되기 쉽고, 낮으면 큰일을 겪어도 잘 버틴다
  const onset0 = G.Mind.checkOnset;
  G.Mind.checkOnset = (sim, h) => {
    const before = h.mind;
    onset0(sim, h);
    if (h.mind || before || !h.adult || !h.genes) return;
    const M = G.Mind, calm = h.has('침착한') ? 0.6 : 1;
    if ((h.lowTime || 0) >= 3 && chance(0.012 * Gn.risk(h, 'dep') * calm)) return M.setCondition(sim, h, '우울증', null, '타고난 우울한 기질에 슬픔이 겹쳐');
    if ((h.highStress || 0) >= 3 && chance(0.01 * Gn.risk(h, 'anx') * calm)) return M.setCondition(sim, h, '불안증', null, '타고난 예민함에 긴장이 쌓여');
    if ((h.highStress || 0) >= 2 && chance(0.004 * Gn.risk(h, 'pan') * calm)) return M.setCondition(sim, h, '공황장애', null, '타고난 기질에 긴장이 겹쳐');
    if (h.addiction > 60 && h.likes.includes('술') && chance(0.02 * Gn.risk(h, 'add'))) return M.setCondition(sim, h, '알코올 의존', randi(40, 70), '술에 약한 집안 내림으로');
  };
  // 기질이 아주 낮으면 큰 충격에도 덜 무너진다
  const trauma0 = G.Mind.trauma;
  G.Mind.trauma = (sim, h, p, why) => trauma0(sim, h, p * (h.genes ? clamp(0.6 + (h.genes.liab.anx + h.genes.liab.dep) * 0.7, 0.6, 1.5) : 1), why);

  // ---------------- 보여 주기 ----------------
  Gn.level = (h, k) => {
    const L = Gn.LIAB[k], v = Gn.liab(h, k);
    return v >= L.m + L.sd * 1.5 ? 2 : v >= L.m + L.sd * 0.7 ? 1 : v <= L.m - L.sd ? -1 : 0;
  };
  Gn.summary = (h) => {
    const out = [];
    for (const k in Gn.LIAB) {
      const lv = Gn.level(h, k);
      if (lv > 0) out.push({ k, text: `${Gn.LIAB[k].name} 기질 ${lv === 2 ? '아주 높음' : '높음'}`, col: lv === 2 ? '#ff8a80' : '#ffb070' });
      else if (lv < 0 && (k === 'dep' || k === 'anx' || k === 'add')) out.push({ k, text: `${Gn.LIAB[k].name}에 강함`, col: '#7fe0a8' });
    }
    return out;
  };
  Gn.traits = (h) => Object.keys(Gn.RARE).filter((k) => Gn.has(h, k)).map((k) => Gn.RARE[k]);
  Gn.carried = (h) => Object.keys(Gn.RARE).filter((k) => Gn.carrier(h, k) && Gn.RARE[k].mode !== 'dom').map((k) => Gn.RARE[k].name);
  // 집안 내력: 부모·조부모가 앓았던 병
  Gn.family = (sim, h) => {
    const seen = new Set(), out = [];
    const look = (ref, depth) => {
      if (!ref || depth > 2) return;
      const o = sim.byId.get(ref.id) || sim.archiveById.get(ref.id);
      if (!o) return;
      const hist = new Set([...(o.mindHist || []), ...(o.mind ? [typeof o.mind === 'string' ? o.mind : o.mind.c] : [])]);
      for (const c of hist) if (!seen.has(c)) { seen.add(c); out.push(`${c}(${depth === 1 ? '부모' : '조부모'})`); }
      for (const p of (o.parents || [])) look(p, depth + 1);
    };
    for (const p of h.parents) look(p, 1);
    return out;
  };
})();
