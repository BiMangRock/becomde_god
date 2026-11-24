// 더 깊은 범죄와 사법
//  신앙(인신공양·마녀사냥·사이비 교주·신성모독·제물 도둑), 무거운 폭력(연쇄살인·피의 복수·청부살인·존속살해·일가족 살인·묻지마 범죄),
//  전쟁과 약탈(노예사냥·인신매매·학살·포로 처형), 공동체(사적 제재·기근 폭동·식인·영아 유기·아동 학대),
//  과실(과실치사·실화·돌팔이 치료·음주 사고), 경제(화폐 위조·매점매석·장물·보호비·위증·증거 인멸·경비병 부패·간첩·결혼 사기·중혼),
//  청소년 비행, 성범죄(강간·준강간·교제 성폭력·부부 강간·전시 성폭력·미수·성 착취 인신매매·혼인 빙자·성병 전파·명예훼손·명예살인),
//  그리고 형벌(사형·강제노역·낙인·배상금), 정당방위, 증거 부족, 공소시효, 신의 재판.
// 원칙: 성범죄는 가해자와 피해자 모두 18세 이상일 때만 일어나고, 화면에 그리지 않고 기록 문장으로만 남는다.
//       폭력 범죄의 희생자에는 아이도 있을 수 있지만, 아이의 시신 자리에는 피를 그리지 않는다.
//       마음의 병은 범죄의 원인이 되지 않는다.
(function () {
  const G = globalThis.G;
  const { rand, randi, pick, chance, clamp, josa } = G;
  const J = G.JOB;
  const C = G.Crime, S = G.Social, M = G.Mind, X2 = G.Crime2;
  const X = (G.Crime3 = {});
  const TPY = G.CFG.TPY;

  Object.assign(C.SEV, {
    // 신앙
    인신공양: 5, 마녀사냥: 4, '사이비 교주': 3, 신성모독: 2, '제물 도둑': 1,
    // 무거운 폭력
    청부살인: 6, '살인 교사': 5, 존속살해: 6, '피의 복수': 5, '일가족 살인': 7, '묻지마 폭행': 3, '묻지마 살인': 6, '묻지마 방화': 4,
    인신매매: 4, '노예 매수': 2, 학살: 6, '포로 처형': 5, '사적 제재': 4, 폭동: 2, 식인: 4, '영아 유기': 4, '아동 학대': 3, '아동 방임': 2,
    // 과실
    과실치사: 2, 실화: 1, '음주 폭행': 2, '음주 사고': 1, 정당방위: 0,
    // 경제와 공동체
    '화폐 위조': 2, 매점매석: 1, '장물 취득': 1, '보호비 갈취': 3, 위증: 2, '증거 인멸': 1, '경비병 부패': 3, 간첩: 4,
    '결혼 사기': 2, 중혼: 2, '청소년 비행': 1, 패싸움: 1, '특수 절도': 2,
    // 성범죄
    강간: 6, 준강간: 6, '교제 성폭력': 5, '부부 강간': 4, '전시 성폭력': 6, '강간 미수': 3, '성 착취 인신매매': 5,
    '혼인 빙자': 1, '성병 전파': 2, 명예훼손: 1, 명예살인: 6,
  });
  for (const k of ['청부살인', '살인 교사', '존속살해', '피의 복수', '일가족 살인', '묻지마 살인', '학살', '포로 처형', '사적 제재', '명예살인', '인신공양']) C.LETHAL.add(k);
  // 증거가 없으면 '말 대 말'이 되는 범죄
  X.SEXUAL = new Set(['강간', '준강간', '교제 성폭력', '부부 강간', '전시 성폭력', '강간 미수', '성추행', '권력형 성범죄', '약탈혼', '성 착취 인신매매', '성적 협박']);
  const WORD_CASE = new Set(['강간', '준강간', '교제 성폭력', '부부 강간', '강간 미수', '성추행', '권력형 성범죄']);

  Object.assign(G.MOODS, {
    raped: { t: '성폭행을 당했다', v: -35, d: 3 },
    attempted: { t: '성폭행을 당할 뻔했다', v: -20, d: 1.2 },
    unwanted: { t: '원치 않는 임신', v: -20, d: 0.75 },
    blamed: { t: '오히려 수군거림을 들었다', v: -15, d: 1 },
    believed: { t: '곁에서 믿어 주었다', v: 12, d: 1 },
    unjust: { t: '억울한 판결', v: -25, d: 1.5 },
    hushed: { t: '입막음을 당했다', v: -15, d: 1 },
    rumor: { t: '나쁜 소문이 돌았다', v: -15, d: 1 },
    deceived: { t: '결혼 약속에 속았다', v: -20, d: 1 },
    conned: { t: '결혼 사기를 당했다', v: -25, d: 1.5 },
    dread: { t: '마을에 흉흉한 일이 이어진다', v: -12, d: 0.4 },
    mourning: { t: '합동 장례를 치렀다', v: -18, d: 1 },
    survivor: { t: '홀로 살아남았다', v: -35, d: 4 },
    sacrificed: { t: '가족이 제물로 바쳐졌다', v: -40, d: 4 },
    spared: { t: '신이 제물을 거두었다', v: 20, d: 1 },
    accused: { t: '마녀로 몰렸다', v: -30, d: 1.5 },
    enslaved: { t: '노예로 부려지고 있다', v: -25, d: 0.3 },
    labor: { t: '강제노역 중이다', v: -12, d: 0.3 },
    branded: { t: '얼굴에 낙인이 찍혔다', v: -10, d: 0.6 },
    childAbused: { t: '부모에게 맞았다', v: -20, d: 1 },
    neglected: { t: '돌봐 주는 사람이 없다', v: -15, d: 0.5 },
    adopted: { t: '새 가족이 생겼다', v: 15, d: 1.5 },
    cultFleeced: { t: '교주에게 바친 재물', v: -5, d: 0.3 },
    cultExposed: { t: '믿었던 교주에게 속았다', v: -25, d: 1.2 },
    desecrated: { t: '신전이 더럽혀졌다', v: -12, d: 0.6 },
    famine: { t: '굶주림과 폭동', v: -15, d: 0.5 },
    taboo: { t: '금기를 어긴 일을 알았다', v: -20, d: 1 },
    sick2: { t: '숨기고 싶은 병', v: -10, d: 0.5 },
    racket: { t: '도적단에 상납하고 있다', v: -8, d: 0.6 },
  });

  const grown = (h) => h && h.alive && h.age >= 18 && !h.jail && !h.held;
  const able = (h) => h && h.alive && h.adult && !h.jail && !h.held;
  const friendsOf = (sim, h) => { let n = 0; for (const [id, r] of h.rel) if (r.v >= 60 && sim.byId.get(id)) n++; return n; };
  const guardsNear = (sim, x, y, r = 8) => { let n = 0; sim.near(x, y, r, (o) => { if (o.job === J.GUARD) n++; }); return n; };
  const others = (sim, x, y, r, ex) => { let n = 0; sim.near(x, y, r, (o) => { if (!ex.includes(o) && o.state !== 'sleep') n++; }); return n; };
  const cold = (h) => h.has('냉정한') || h.p.impulse > 65 || (h.stress || 0) > 70;
  const mark = (h, type) => { for (const c of h.crimes) if (c.type === type && !c.known) c.known = true; };
  const kinIds = (sim, h) => {
    const ids = new Set([...h.parents.map((p) => p.id), ...h.children]);
    if (h.partner) ids.add(h.partner.id);
    for (const o of sim.humans) if (o.alive && o !== h && M.siblings(o, h)) ids.add(o.id);
    ids.delete(h.id);
    return [...ids];
  };
  const byName = (sim, name) => sim.humans.find((o) => o.alive && o.name === name) || null;
  const tlog = (sim, t, text, global = true, x, y) => { if (t) t.log(sim, text, global); else sim.event(text, '#d06060', x, y); };

  // 부족의 법 (tribe.js에서 부른다)
  X.makeLaw = (bandit) => ({
    adultery: !bandit && chance(0.4),       // 간통을 죄로 본다
    maritalRape: !bandit && chance(0.5),    // 부부 사이의 강요도 죄로 본다
    death: !bandit && chance(0.35),         // 사형이 있다
    honor: !bandit && chance(0.12),         // 가문의 명예를 지나치게 따진다
    zealot: !bandit && chance(0.15),        // 광신: 가뭄에 제물을 바치려 한다
  });
  X.lawText = (law) => {
    if (!law) return '';
    const a = [law.adultery ? '간통은 죄' : '간통은 개인 문제', law.maritalRape ? '부부 사이 강요도 죄' : '부부 사이 강요는 죄로 보지 않음'];
    if (law.death) a.push('사형 있음');
    if (law.honor) a.push('명예를 중시함');
    if (law.zealot) a.push('광신 (가뭄에 제물을 바침)');
    return a.join(' · ');
  };

  // 범죄 성향에 곱한다 (C.urge에서 부른다): 학대의 대물림
  X.urgeMult = (h) => (h.cycle ? 1.35 : 1) * (h.branded ? 1.2 : 1);

  // ================= 공용: 사람을 해친다 =================
  // 살인 계열을 한 곳에서 처리한다. opts: { ws, log, cause, noBlood, seen, negligent, serial, gen, noFound }
  X.slay = (sim, h, o, type, opts = {}) => {
    const ws = opts.ws || C.witnesses(sim, o.x, o.y, [h, o]);
    const fam = kinIds(sim, o);
    const vname = o.name, vx = o.x, vy = o.y, vtribe = o.tribe, child = o.age < 14;
    const key = `${vname}:${o.id}:${Math.floor(sim.year * 1000)}`;
    if (!opts.negligent) { h.murders++; sim.stats.murders = (sim.stats.murders || 0) + 1; }
    if (opts.log) h.log(sim, opts.log);
    sim.kill(o, opts.cause || '살인', h);
    if (!child && !opts.noBlood) { G.Blood.splash(sim, vx, vy, 3, 0.8, 'pool', key); G.Blood.add(sim, vx, vy, 1.2, 'pool', key); }
    const rec = C.record(sim, h, type, vname, false);
    if (opts.negligent) rec.negligent = true;
    if (!opts.negligent) { h.stress = clamp((h.stress || 0) + 25, 0, 100); if (!h.has('냉정한')) S.addMood(sim, h, 'murderGuilt'); }
    // 흔적을 지우면 증거 인멸
    if (!opts.noBlood && !opts.negligent && (h.has('교활한') || opts.serial) && chance(opts.serial ? 0.9 : 0.6)) {
      G.Blood.wash(sim, vx, vy, 1.6);
      C.record(sim, h, '증거 인멸', vname, false);
      if (ws.length && chance(0.4)) ws[0].log(sim, `${josa(h.name, '이/가')} 무언가를 닦아 내는 수상한 모습을 보았다`);
    }
    for (const id of fam) { const p = sim.byId.get(id); if (p && p !== h) M.trauma(sim, p, child ? 0.4 : 0.25, `${vname}의 죽음에 충격을 받아`); }
    const seen = opts.seen ?? C.detect(sim, h, type, vname, ws);
    if (seen) {
      for (const p of sim.humans) { const pr = p.alive && p.rel.get(o.id); if (pr && pr.v >= 40 && p !== h) M.adj(sim, p, h, { grudge: 50, trust: -80 }); }
      if (!opts.negligent) X.onKilled(sim, fam, h, vname, opts.gen || 1);
      C.report(sim, h, type, vname);
    } else if (!opts.negligent) {
      sim.unsolved.push({ victim: vname, killer: h.id, tid: vtribe ? vtribe.id : null, y: sim.year, x: vx, yy: vy, key, type, fam, serial: !!opts.serial, gen: opts.gen || 1 });
      if (!opts.noFound) sim.event(`${josa(vname, '이/가')} 숨진 채 발견되었습니다. 범인은 알 수 없습니다`, '#a05050', vx, vy);
    }
    return seen;
  };

  // ================= 피의 복수: 가문 간 원한이 대를 이어 내려간다 =================
  X.onKilled = (sim, fam, killer, vname, gen) => {
    if (!killer) return;
    const kfam = kinIds(sim, killer);
    for (const id of fam) {
      const p = sim.byId.get(id);
      if (!p || !p.alive || p === killer || p.age < 12) continue;
      const r = S.rel(p, killer);
      r.grudge = Math.max(r.grudge || 0, 80); r.feud = Math.max(r.feud || 0, gen); r.feudFor = vname;
      for (const kid of kfam) {
        const k = sim.byId.get(kid);
        if (!k || k === p || k.age < 12) continue;
        const rk = S.rel(p, k);
        rk.grudge = Math.max(rk.grudge || 0, 55); rk.feud = Math.max(rk.feud || 0, gen); rk.feudFor = vname;
      }
    }
  };
  // 수사로 범인이 밝혀졌을 때 (C.investigate에서 부른다)
  X.onSolved = (sim, cs, k) => {
    if (cs.fam) X.onKilled(sim, cs.fam, k, cs.victim, cs.gen || 1);
    if (cs.serial) {
      const n = sim.unsolved.filter((o) => o.serial && o.killer === k.id).length;
      for (let i = sim.unsolved.length - 1; i >= 0; i--) if (sim.unsolved[i].serial && sim.unsolved[i].killer === k.id) sim.unsolved.splice(i, 1);
      sim.event(`연쇄살인범 ${josa(k.name, '이/가')} 정체를 드러냈습니다 (희생자 ${k.murders}명${n ? `, 함께 풀린 사건 ${n}건` : ''})`, '#ff5050', k.x, k.y);
      sim.stats.serialCaught = (sim.stats.serialCaught || 0) + 1;
    }
  };
  // C.murder에서 부른다: 피의 복수였는지
  X.feudGen = (h, o) => { const r = S.peek(h, o); return r && r.feud ? r.feud + 1 : 1; };

  X.feudTick = (sim, h, u) => {
    for (const [id, r] of h.rel) {
      if (!r.feud || (r.grudge || 0) < 70) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive || o.jail || o.held || o.age < 12) { if (!o || !o.alive) r.feud = 0; continue; }
      const d = G.dist(o.x, o.y, h.x, h.y);
      if (d > 4) {
        if (d < 25 && chance(0.06 * u)) h.goTo(sim, o.x + rand(-1, 1), o.y + rand(-1, 1), { kind: 'wander' });
        continue;
      }
      const ws = C.witnesses(sim, o.x, o.y, [h, o]);
      if (ws.length > 2 || !(cold(h) || h.has('용감한')) || !chance(0.05 * u)) continue;
      const gen = r.feud + 1;
      // 원한이 극에 달하면 상대 한 사람이 아니라 그 집안 전체를 노린다
      if (r.grudge >= 95 && r.feud >= 2 && h.has('냉정한') && chance(0.3) && X.household(sim, o).length >= 3) return X.massacre(sim, h, o, '피의 복수', gen);
      h.log(sim, `${r.feudFor || '가족'}의 원수를 갚겠다며 ${josa(o.name, '을/를')} 죽였다`);
      X.slay(sim, h, o, '피의 복수', { ws, gen });
      if (gen >= 2) tlog(sim, h.tribe, `${gen}대째 이어진 피의 복수로 ${josa(o.name, '이/가')} 목숨을 잃었습니다`, true, h.x, h.y);
      sim.stats.feuds = Math.max(sim.stats.feuds || 0, gen);
      return;
    }
  };

  // ================= 일가족 살인 =================
  // 그 집에 있는 가족: 본인, 배우자, 아직 어린 자식 (가까이 있을 때만. 밖에 나가 있던 아이는 살아남는다)
  X.household = (sim, head) => {
    const out = [head];
    if (head.partner && head.partner.alive && G.dist(head.partner.x, head.partner.y, head.x, head.y) < 8) out.push(head.partner);
    for (const cid of head.children) {
      const c = sim.byId.get(cid);
      if (c && c.alive && c.age < 20 && !c.jail && G.dist(c.x, c.y, head.x, head.y) < 8) out.push(c);
    }
    return out;
  };
  X.massacre = (sim, h, head, why, gen = 1, opts = {}) => {
    const victims = opts.victims || X.household(sim, head).filter((v) => v !== h);
    if (!victims.length) return;
    const t = head.tribe, hx = head.x, hy = head.y;
    const kids = new Set([...head.children, ...(head.partner ? head.partner.children : [])]);
    const survivors = [...kids].map((id) => sim.byId.get(id)).filter((c) => c && c.alive && !victims.includes(c) && c !== h);
    const fam = new Set(); for (const v of victims) for (const id of kinIds(sim, v)) fam.add(id);
    const ws = C.witnesses(sim, hx, hy, [h, ...victims]);
    const names = victims.map((v) => v.name);
    const key = `${head.name}:fam:${Math.floor(sim.year * 1000)}`;
    h.log(sim, why === '자결' ? '모든 것을 끝내려 했다' : `${why} 끝에 ${head.name}의 집안 사람 ${victims.length}명을 죽였다`);
    for (const v of victims) {
      const vx = v.x, vy = v.y, adult = v.age >= 14;
      sim.kill(v, '살인', h);
      if (adult) G.Blood.splash(sim, vx, vy, 2, 0.8, 'pool', key);
    }
    if (why === '자결') {
      // 가장이 가족을 해치고 스스로 목숨을 끊는다. 아주 드물고, 기록 문장으로만 남는다
      sim.kill(h, '자결');
      tlog(sim, t, `${head.name}의 집에서 일가족 ${victims.length}명이 숨진 채 발견되었습니다. ${josa(h.name, '이/가')} 가족을 해친 뒤 스스로 목숨을 끊었습니다`, true, hx, hy);
    } else {
      h.murders += victims.length;
      sim.stats.murders = (sim.stats.murders || 0) + victims.length;
      C.record(sim, h, '일가족 살인', head.name, false);
      h.stress = clamp((h.stress || 0) + 40, 0, 100);
      const seen = C.detect(sim, h, '일가족 살인', head.name, ws) || chance(0.15);
      if (seen) { X.onKilled(sim, [...fam], h, head.name, gen); C.report(sim, h, '일가족 살인', head.name); }
      else {
        sim.unsolved.push({ victim: head.name, killer: h.id, tid: t ? t.id : null, y: sim.year, x: hx, yy: hy, key, type: '일가족 살인', fam: [...fam], gen });
        tlog(sim, t, `${head.name}의 일가족 ${victims.length}명(${names.join(', ')})이 숨진 채 발견되었습니다. 범인은 알 수 없습니다`, true, hx, hy);
      }
    }
    sim.stats.massacres = (sim.stats.massacres || 0) + 1;
    // 공동체: 합동 장례, 그 집은 비워 둔다
    if (t && t.alive) {
      for (const m of t.members) { if (m.alive && !m.jail) { S.addMood(sim, m, 'mourning'); if (m.p.neuro > 70) M.trauma(sim, m, 0.05, '이웃 일가족의 죽음에'); } }
      t.log(sim, `${josa(t.name, '이/가')} ${head.name}의 가족을 위해 합동 장례를 치렀습니다`, false);
      t.dread = sim.year + 2;
      if (t.houses.length > 1) {
        const i = t.houses.reduce((b, q, k) => (G.dist(q.x, q.y, hx, hy) < G.dist(t.houses[b].x, t.houses[b].y, hx, hy) ? k : b), 0);
        if (G.dist(t.houses[i].x, t.houses[i].y, hx, hy) < 10) { t.houses.splice(i, 1); t.log(sim, `아무도 ${head.name}의 집에 들어가려 하지 않아 그 집은 비워졌습니다`, false); }
      }
    }
    // 살아남은 아이
    for (const c of survivors) {
      S.addMood(sim, c, 'survivor');
      M.trauma(sim, c, 0.6, '가족을 모두 잃고');
      c.log(sim, '집 밖에 나가 있던 덕분에 홀로 살아남았다');
      if (why !== '자결') { const r = S.rel(c, h); r.grudge = 100; r.feud = Math.max(r.feud || 0, gen); r.feudFor = head.name; }
      X.adopt(sim, c, head);
    }
  };

  // 부모를 잃은 아이를 친척이나 이웃이 거둔다
  X.adopt = (sim, c, head) => {
    if (c.adult) return;
    let g = null;
    for (const p of (head ? head.parents : [])) { const o = sim.byId.get(p.id); if (o && o.alive && o.age < 75 && !o.jail) { g = o; break; } }
    if (!g && head) for (const [id, r] of head.rel) { const o = sim.byId.get(id); if (o && o.alive && o.adult && r.v >= 50 && !o.jail && !o.outlaw) { g = o; break; } }
    if (!g && c.tribe) g = c.tribe.members.find((o) => o.adult && o.has('다정한') && !o.jail && o !== c);
    if (!g) return;
    c.bioParents = c.bioParents || c.parents.slice();
    c.parents = [{ id: g.id, name: g.name }, ...c.parents.filter((p) => p.id !== g.id)];
    if (!g.children.includes(c.id)) g.children.push(c.id);
    if (g.tribe && c.tribe !== g.tribe) g.tribe.add(sim, c);
    S.bump(sim, c, g, 40); S.bump(sim, g, c, 40);
    S.addMood(sim, c, 'adopted');
    c.log(sim, `${josa(g.name, '이/가')} 거두어 키워 주었다`);
    g.log(sim, `갈 곳 없는 ${josa(c.name, '을/를')} 거두었다`);
  };

  // ================= 연쇄살인범 =================
  // 아주 드문 기질. 밤에 혼자 있는 사람을 노리고, 흔적을 지운다.
  X.serialTick = (sim, h, u) => {
    if (!h.dark || !chance(0.03 * (sim.isNight() ? 2 : 0.6))) return;
    let v = null;
    sim.near(h.x, h.y, 10, (o) => {
      if (v || o === h || !o.alive || o.age < 14 || o.jail || o.held || S.isFamily(h, o.id)) return;
      if (others(sim, o.x, o.y, 6, [h, o]) === 0) v = o;
    });
    if (!v) return;
    const ws = C.witnesses(sim, v.x, v.y, [h, v]);
    if (ws.length) return;
    X.slay(sim, h, v, '살인', { ws, serial: true, log: `아무 원한도 없는 ${josa(v.name, '을/를')} 어둠 속에서 해쳤다` });
    // 같은 범인의 미제 사건이 쌓이면 마을이 공포에 빠진다
    const n = sim.unsolved.filter((cs) => cs.serial && cs.killer === h.id).length;
    const t = v.tribe || h.tribe;
    if (n >= 2 && t) {
      t.dread = sim.year + 2;
      t.crimeHeat = (t.crimeHeat || 0) + 2;
      if (!t.serialWarned || sim.year - t.serialWarned > 4) { t.serialWarned = sim.year; t.log(sim, `${t.name} 일대에서 같은 수법의 살인이 이어지고 있습니다. 사람들이 밤길을 두려워합니다`); }
    }
  };

  // ================= 청부살인 =================
  X.hireTick = (sim, h, u) => {
    if (h.gold < 30 || h.outlaw || h.has('정직한') || !chance(0.02 * u)) return;
    for (const [id, r] of h.rel) {
      if ((r.grudge || 0) < 75) continue;
      const o = sim.byId.get(id);
      if (!o || !o.alive || o.jail || o.held || o.hitBy) continue;
      // 직접 손을 쓰지 못하는 사람이 맡긴다
      if (cold(h) && !h.has('겁많은')) continue;
      const killer = sim.humans.find((k) => k.alive && k.outlaw && k.adult && !k.jail && !k.contract && k !== o && (k.murders || k.has('냉정한')) && G.dist(k.x, k.y, h.x, h.y) < 45);
      if (!killer) return;
      const pay = Math.min(Math.floor(h.gold), randi(25, 50));
      h.gold -= pay; killer.gold += pay;
      killer.contract = { target: o.id, client: h.id, until: sim.year + 3 };
      o.hitBy = killer.id;
      h.log(sim, `무법자 ${killer.name}에게 금화 ${pay}개를 주고 ${josa(o.name, '을/를')} 없애 달라고 했다`);
      killer.log(sim, `금화 ${pay}개를 받고 ${josa(o.name, '을/를')} 죽이기로 했다`);
      C.record(sim, h, '살인 교사', o.name, false);
      return;
    }
  };
  X.contractTick = (sim, h) => {
    const k = h.contract;
    if (!k) return;
    const o = sim.byId.get(k.target);
    if (!o || !o.alive || sim.year > k.until) { h.contract = null; if (o) o.hitBy = null; return; }
    if (G.dist(o.x, o.y, h.x, h.y) > 3) { if (chance(0.4)) h.goTo(sim, o.x + rand(-1, 1), o.y + rand(-1, 1), { kind: 'wander' }); return; }
    const ws = C.witnesses(sim, o.x, o.y, [h, o]);
    if (ws.length > 1 && !chance(0.1)) return;
    h.contract = null; o.hitBy = null;
    h.hitClients = (h.hitClients || []).concat(k.client);
    X.slay(sim, h, o, '청부살인', { ws, log: `돈을 받고 ${josa(o.name, '을/를')} 죽였다` });
  };
  // 붙잡힌 청부업자가 의뢰인을 불기도 한다 (재판에서 부른다)
  X.revealClients = (sim, c) => {
    if (!c.hitClients || !c.hitClients.length || !chance(0.6)) return;
    for (const id of c.hitClients) {
      const cl = sim.byId.get(id);
      if (!cl || !cl.alive) continue;
      mark(cl, '살인 교사');
      cl.log(sim, `${josa(c.name, '이/가')} 의뢰인이 누구인지 털어놓았다`);
      C.report(sim, cl, '살인 교사', c.name);
    }
    c.hitClients = [];
  };

  // ================= 존속살해와 유산을 노린 살인 =================
  X.inheritTick = (sim, h, u) => {
    if (!(h.has('탐욕스러운') && cold(h)) || h.age < 20 || h.gold > 25 || !chance(0.012 * u)) return;
    // 부모
    for (const p of h.parents) {
      const o = sim.byId.get(p.id);
      if (!o || !o.alive || o.gold < 60 || o.jail || G.dist(o.x, o.y, h.x, h.y) > 6) continue;
      const g = Math.floor(o.gold * 0.8);
      const knowsHerbs = h.knowledge >= 8 || h.job === J.HEALER || (h.tribe && h.tribe.has('약초학'));
      if (knowsHerbs) {
        // 독초: 병으로 죽은 것처럼 보인다
        h.log(sim, `재산을 노리고 ${p.name}의 음식에 독초를 넣었다`);
        X2.poison(sim, h, o);
        sim.scheduled.push({ t: Math.max(40, Math.round(randi(4, 11) / sim.dt)), fn: () => { if (!o.alive && h.alive) { h.gold += g; h.log(sim, `부모의 재산 금화 ${g}개를 물려받았다`); } } });
      } else {
        X.slay(sim, h, o, '존속살해', { log: `재산을 노리고 ${o.gender === 'M' ? '아버지' : '어머니'} ${josa(o.name, '을/를')} 죽였다` });
        h.gold += g;
      }
      return;
    }
    // 형제자매의 집안 전체
    for (const o of sim.humans) {
      if (!o.alive || o === h || o.gold < 90 || !M.siblings(o, h) || G.dist(o.x, o.y, h.x, h.y) > 6 || !h.has('냉정한') || !chance(0.2)) continue;
      const g = Math.floor(o.gold * 0.7);
      X.massacre(sim, h, o, '재산을 노린');
      h.gold += g;
      return;
    }
  };

  // ================= 묻지마 범죄 =================
  // 특정 사람이 아니라 세상 전체에 원한을 품는다. 고립·거절·낙인·가난·스트레스가 쌓이면 커지고,
  // 친구·짝·신앙·위로가 있으면 가라앉는다. (마음의 병은 원인이 아니다)
  X.worldTick = (sim, h, u) => {
    const f = friendsOf(sim, h);
    let d = -0.6;
    if (f === 0) d += 1.2;
    if ((h.social || 0) > 70) d += 0.8;
    if (S.hasMood(h, 'rejected')) d += 0.6;
    if (h.convictions && !h.redeemed) d += 0.5;
    if (h.gold < 3) d += 0.4;
    if ((h.stress || 0) > 70) d += 0.8;
    if (h.cycle) d += 0.3;
    d -= f * 0.8 + (S.mate(h) ? 1 : 0) + (h.faith > 60 ? 0.5 : 0) + (h.happy > 55 ? 0.6 : 0);
    if (h.has('너그러운') || h.has('다정한')) d *= d > 0 ? 0.4 : 1;
    h.wg = clamp((h.wg || 0) + d, 0, 100);
    if (h.wg < 50) { h.wgSign = false; return; }
    // 조짐
    if (!h.wgSign && h.wg >= 60) { h.wgSign = true; h.log(sim, '세상이 자신을 버렸다며 혼자 중얼거리는 일이 잦아졌다'); h.say('…', 200); }
    // 사제나 친구가 먼저 다가가면 가라앉는다
    let helper = null;
    sim.near(h.x, h.y, 4, (o) => { if (!helper && o !== h && o.adult && (o.job === J.PRIEST || o.has('다정한') || (S.peek(o, h)?.v || 0) >= 40) && o.happy > 45) helper = o; });
    if (helper && chance(0.15)) {
      h.wg = Math.max(0, h.wg - 25);
      S.bump(sim, h, helper, 12); S.bump(sim, helper, h, 8);
      h.log(sim, `${josa(helper.name, '이/가')} 먼저 말을 걸어 주어 마음이 조금 풀렸다`);
      return;
    }
    if (h.wg < 85 || !able(h) || !chance(0.04 * u)) return;
    X.randomAttack(sim, h);
  };
  X.randomAttack = (sim, h) => {
    const t = sim.tribes.find((o) => o.alive && !o.bandit && G.dist(o.cx, o.cy, h.x, h.y) < 14);
    // 사람이 모인 곳에 불을 지르기도 한다
    if (t && t.houses.length && chance(0.25)) {
      const house = pick(t.houses);
      if (G.Fire.ignite(sim, house.x, house.y, '누군가의 방화로')) {
        h.log(sim, `세상에 대한 분노로 ${t.name}의 집에 불을 질렀다`);
        const { seen } = X2.commit(sim, h, '묻지마 방화', t.name, C.witnesses(sim, house.x, house.y, [h]), 0.2);
        X.afterRandom(sim, h, t, seen);
        return;
      }
    }
    // 가까이 있는 사람 아무나 (혼자이거나 약한 사람을 고르기 쉽다)
    const pool = [];
    sim.near(h.x, h.y, 5, (o) => { if (o !== h && o.alive && !o.jail && !o.held && !S.isFamily(h, o.id)) pool.push(o); });
    if (!pool.length) return;
    pool.sort((a, b) => (a.health + a.body + (a.age < 14 || a.age > 65 ? -40 : 0)) - (b.health + b.body + (b.age < 14 || b.age > 65 ? -40 : 0)));
    const v = chance(0.6) ? pool[0] : pick(pool);
    const ws = C.witnesses(sim, v.x, v.y, [h, v]);
    h.wg = 40;
    if (chance(0.35)) {
      X.slay(sim, h, v, '묻지마 살인', { ws, log: `아무 이유 없이 처음 보다시피 한 ${josa(v.name, '을/를')} 해쳤다` });
      sim.event(`${josa(v.name, '이/가')} 이유 없는 공격에 목숨을 잃었습니다`, '#ff6060', v.x, v.y);
    } else {
      v.health -= rand(25, 45);
      G.Blood.splash(sim, v.x, v.y, 2, 0.6, 'drops');
      v.log(sim, `모르는 사람 ${h.name}에게 이유 없이 공격당했다`);
      M.adj(sim, v, h, { fear: 50, grudge: 40 });
      M.trauma(sim, v, 0.3, '이유 없는 공격을 당하고');
      h.log(sim, `세상에 대한 분노로 ${josa(v.name, '을/를')} 마구 때렸다`);
      if (v.health <= 0) { sim.kill(v, '상처'); }
      X2.commit(sim, h, '묻지마 폭행', v.name, ws, 0.4);
    }
    X.afterRandom(sim, h, v.tribe || t, true);
  };
  // 마을의 반응: 불안, 축제 취소, 경비 강화, 그리고 애꿎은 사람에 대한 편견
  X.afterRandom = (sim, h, t, loud) => {
    sim.stats.randomCrimes = (sim.stats.randomCrimes || 0) + 1;
    if (!t || !t.alive) return;
    t.dread = sim.year + 1.5;
    t.crimeHeat = (t.crimeHeat || 0) + 3;
    for (const m of t.members) if (m.alive && !m.jail) S.addMood(sim, m, 'dread');
    // 외지인과 전과자를 괜히 의심한다
    for (const m of t.members) {
      if (!m.adult || m.has('너그러운')) continue;
      for (const o of t.members) if (o !== m && o.convictions && !S.isFamily(m, o.id) && chance(0.3)) M.adj(sim, m, o, { trust: -8 });
    }
    if (loud) t.log(sim, `이유 없는 공격에 ${t.name} 사람들이 불안에 떱니다. 밤길을 피하고 경비를 늘립니다`, false);
  };

  // ================= 아동 학대·방임과 대물림 =================
  X.parentTick = (sim, h, u) => {
    if (!h.children.length || h.has('다정한')) return;
    const bad = h.addiction > 50 || (h.stress || 0) > 70 || h.drunk > 0;
    if (!bad || h.p.agree >= 40) return;
    for (const cid of h.children) {
      const c = sim.byId.get(cid);
      if (!c || !c.alive || c.age >= 14 || G.dist(c.x, c.y, h.x, h.y) > 5) continue;
      // 방임: 중독된 부모가 굶는 아이를 돌보지 않는다
      if (h.addiction > 70 && c.hunger > 70 && chance(0.15)) {
        S.addMood(sim, c, 'neglected');
        c.neglect = (c.neglect || 0) + 1;
        if (c.neglect === 1) { C.record(sim, h, '아동 방임', c.name, false); c.log(sim, `${h.gender === 'M' ? '아버지' : '어머니'}가 돌봐 주지 않아 굶주렸다`); }
        if (c.neglect >= 3 && chance(0.3)) X.childReport(sim, h, c, '아동 방임');
        continue;
      }
      if (!chance(0.02 * u)) continue;
      c.health -= rand(4, 10);
      c.say('!', 80); h.say('#', 80);
      S.addMood(sim, c, 'childAbused');
      M.adj(sim, c, h, { fear: 25, trust: -25 });
      M.trauma(sim, c, 0.08, '거듭 맞으며');
      c.abused = (c.abused || 0) + 1;
      c.cycle = true;
      if (c.abused === 1) { C.record(sim, h, '아동 학대', c.name, false); h.log(sim, `화를 참지 못하고 아이 ${josa(c.name, '을/를')} 때렸다`); c.log(sim, `${h.gender === 'M' ? '아버지' : '어머니'}에게 맞았다`); }
      const ws = C.witnesses(sim, c.x, c.y, [h, c]).filter((w) => w.adult && !S.isFamily(w, h.id));
      if (ws.length && chance(0.25 + c.abused * 0.05)) X.childReport(sim, h, c, '아동 학대', ws[0]);
      return;
    }
  };
  X.childReport = (sim, h, c, type, who) => {
    mark(h, type);
    if (who) who.log(sim, `${josa(h.name, '이/가')} 아이 ${josa(c.name, '을/를')} ${type === '아동 방임' ? '돌보지 않는' : '때리는'} 것을 알렸다`);
    C.report(sim, h, type, c.name);
    // 아이는 조부모나 친척이 데려간다
    X.adopt(sim, c, h);
  };
  // 상처를 딛고 일어서기: 스승이나 친구가 대물림을 끊는다
  X.cycleTick = (sim, h) => {
    if (!h.cycle || !h.adult) return;
    let mentor = false; for (const r of h.rel.values()) if (r.mentor) { mentor = true; break; }
    if ((mentor || friendsOf(sim, h) >= 3 || (h.partner && h.partner.alive && S.partnerLove(h) >= 60)) && chance(0.03)) {
      h.cycle = false;
      h.log(sim, '곁의 따뜻한 사람들 덕분에 어린 시절의 상처를 딛고 일어섰다');
    }
  };

  // ================= 영아 유기 (S.deliver에서 부른다) =================
  X.onBirth = (sim, mom, c) => {
    const t = mom.tribe;
    const famine = t && t.stock.food < t.members.length * 0.5;
    const alone = !S.mate(mom);
    const unwanted = mom.unwantedPreg;
    mom.unwantedPreg = false;
    if (unwanted && chance(0.7)) { mom.log(sim, '모든 일을 딛고 아이를 사랑으로 키우기로 했다'); return; }
    if (!(unwanted || (mom.gold < 3 && (famine || alone))) || mom.p.agree >= 50 || mom.has('다정한')) return;
    if (!chance(unwanted ? 0.3 : 0.08)) return;
    C.record(sim, mom, '영아 유기', c.name, false);
    mom.log(sim, famine ? '굶주림 속에 갓난아이를 키울 수 없어 버렸다' : '갓난아이를 감당하지 못해 몰래 버렸다');
    mom.stress = clamp((mom.stress || 0) + 30, 0, 100);
    S.addMood(sim, mom, 'guilty');
    let finder = null;
    if (t) finder = t.members.find((o) => o !== mom && o.adult && !o.jail && (o.has('다정한') || o.job === J.PRIEST || o.job === J.HEALER));
    if (finder && chance(0.75)) {
      c.log(sim, '버려졌다가 발견되었다');
      c.parents = [{ id: finder.id, name: finder.name }];
      finder.children.push(c.id);
      S.bump(sim, finder, c, 50); S.bump(sim, c, finder, 50);
      S.addMood(sim, finder, 'newborn');
      finder.log(sim, `버려진 갓난아이 ${josa(c.name, '을/를')} 발견해 거두었다`);
      if (t) t.log(sim, `${josa(finder.name, '이/가')} 버려진 갓난아이를 발견해 거두었습니다`, false);
    } else {
      sim.kill(c, '버려짐');
      if (t) t.log(sim, '마을 밖에서 버려진 갓난아이가 숨진 채 발견되었습니다', false);
    }
    if (chance(0.3)) { mark(mom, '영아 유기'); C.report(sim, mom, '영아 유기', c.name); }
  };

  // ================= 과실: 사냥 사고, 실화, 돌팔이 치료, 음주 =================
  // 사냥 중 오인 사격 (wildlife.onArriveHunt에서 부른다)
  X.huntAccident = (sim, h) => {
    if (!chance(0.006 * (h.drunk > 0 ? 4 : 1) * (h.has('충동적인') ? 1.5 : 1))) return;
    let v = null;
    sim.near(h.x, h.y, 3, (o) => { if (!v && o !== h && !o.jail) v = o; });
    if (!v) return;
    v.health -= rand(20, 50);
    h.log(sim, `사냥감을 노리다 그만 ${josa(v.name, '을/를')} 맞혔다`);
    v.log(sim, `${h.name}의 사냥 화살에 잘못 맞았다`);
    if (v.health <= 0) {
      X.slay(sim, h, v, '과실치사', { negligent: true, cause: '사냥 사고', seen: true });
      h.log(sim, '사람을 죽게 한 죄책감에 시달렸다');
      S.addMood(sim, h, 'guilty', 3);
    } else M.adj(sim, v, h, { grudge: 15 });
  };
  // 불을 제대로 끄지 않아 불이 난다 (Crime3.tick)
  X.carelessTick = (sim, h) => {
    if (!(h.drunk > 0 || h.has('게으른')) || !h.tribe || !chance(0.0015) || G.dist(h.x, h.y, h.tribe.cx, h.tribe.cy) > 8) return;
    if (!G.Fire.ignite(sim, h.x + rand(-1, 1), h.y + rand(-1, 1), h.drunk > 0 ? '취한 사람이 모닥불을 엎질러' : '누군가 모닥불을 제대로 끄지 않아')) return;
    h.log(sim, '모닥불을 제대로 끄지 않아 불을 냈다');
    sim.careless = { id: h.id, x: h.x, y: h.y, until: sim.year + 0.3 };
    X2.commit(sim, h, '실화', h.tribe.name, C.witnesses(sim, h.x, h.y, [h]), 0.3);
  };
  // 불에 사람이 죽으면 불을 낸 사람에게 과실치사를 묻는다 (fire.js에서 부른다)
  X.fireDeath = (sim, v) => {
    const k = sim.careless;
    if (!k || sim.year > k.until || G.dist(k.x, k.y, v.x, v.y) > 18) return;
    const h = sim.byId.get(k.id);
    if (!h || !h.alive || h === v) return;
    const rec = C.record(sim, h, '과실치사', v.name, false);
    rec.negligent = true;
    h.log(sim, `자신이 낸 불로 ${josa(v.name, '이/가')} 목숨을 잃었다`);
    S.addMood(sim, h, 'guilty', 3);
    if (h.crimes.some((c) => c.type === '실화' && c.known)) { rec.known = true; C.report(sim, h, '과실치사', v.name); }
  };
  // 돌팔이 치료: 약초를 잘 모르는 치료사가 병을 고치려다 사람을 죽게 한다 (Mind.treat에서 부른다)
  X.quack = (sim, healer, p) => {
    if (!p.sick || (healer.tribe && healer.tribe.has('약초학')) || healer.knowledge >= 6 || !chance(0.025)) return false;
    healer.log(sim, `${p.name}에게 잘못된 약초를 먹였다`);
    p.log(sim, `치료사 ${healer.name}에게 받은 약초가 오히려 몸을 해쳤다`);
    if (chance(0.5)) {
      const fam = kinIds(sim, p);
      X.slay(sim, healer, p, '과실치사', { negligent: true, cause: '잘못된 약초', seen: chance(0.6), noBlood: true });
      for (const id of fam) { const o = sim.byId.get(id); if (o) { M.adj(sim, o, healer, { grudge: 45, trust: -50 }); o.log(sim, `치료사 ${healer.name}의 잘못으로 ${p.name}을(를) 잃었다며 원망했다`); } }
    } else p.health -= 20;
    return true;
  };
  // 음주 폭행과 음주 사고
  X.drunkTick = (sim, h, u) => {
    if (!(h.drunk > 0) || !chance(0.05 * u)) return;
    let v = null;
    sim.near(h.x, h.y, 2.5, (o) => { if (!v && o !== h && o.adult && !o.jail) v = o; });
    if (!v) return;
    const ws = C.witnesses(sim, v.x, v.y, [h, v]);
    if (h.p.impulse > 55 || h.has('충동적인')) {
      v.health -= rand(10, 25);
      G.Blood.add(sim, v.x, v.y, 0.5, 'drops');
      h.log(sim, `술에 취해 ${josa(v.name, '을/를')} 때렸다`);
      v.log(sim, `술 취한 ${h.name}에게 맞았다`);
      M.adj(sim, v, h, { grudge: 20, trust: -20 });
      S.addMood(sim, v, 'brawl');
      if (v.health <= 0) X.slay(sim, h, v, '살인', { ws, seen: true, log: `술김에 ${josa(v.name, '을/를')} 때리다 죽게 했다` });
      else X2.commit(sim, h, '음주 폭행', v.name, ws, 0.5);
    } else {
      v.health -= rand(5, 12);
      h.log(sim, `술에 취해 비틀거리다 ${josa(v.name, '을/를')} 다치게 했다`);
      X2.commit(sim, h, '음주 사고', v.name, ws, 0.3);
    }
  };
  // 정당방위: 맞은 사람이 맞서 싸우다 상대를 쓰러뜨린다 (C.assault에서 부른다)
  X.fightBack = (sim, v, h) => {
    if (!v.alive || !v.adult || !(v.has('용감한') || v.body > 70) || !chance(0.35)) return false;
    h.health -= rand(15, 35) * (0.6 + v.body / 100);
    v.say('!', 80);
    if (h.health > 0) { v.log(sim, `덤벼든 ${josa(h.name, '을/를')} 맞서 물리쳤다`); return false; }
    v.log(sim, `덤벼든 ${josa(h.name, '을/를')} 막아 내다 그만 목숨을 빼앗았다`);
    const rec = C.record(sim, v, '정당방위', h.name, true);
    rec.punished = true; rec.selfDefense = true;
    h.log(sim, `${josa(v.name, '을/를')} 공격하다 오히려 쓰러졌다`);
    sim.kill(h, '상처', v);
    const t = v.tribe;
    if (t) t.log(sim, `${josa(v.name, '이/가')} 자신을 공격한 ${josa(h.name, '을/를')} 막아 내다 죽게 했습니다. ${t.chief && t.chief !== v ? `${t.title} ${t.chief.name}` : '부족 회의'}는 정당방위로 보고 죄를 묻지 않았습니다`);
    return true;
  };

  // ================= 경제와 공동체 =================
  // 화폐 위조 (청동을 알아야 한다)
  X.counterfeitTick = (sim, h, u) => {
    const t = h.tribe;
    if (!t || !t.has('청동') || !(h.job === J.SMITH || h.job === J.MERCHANT) || !h.has('교활한') || !chance(0.01 * u)) return;
    const g = randi(10, 25);
    h.gold += g; t.treasury = Math.max(0, t.treasury - Math.floor(g / 3)); // 가짜 금화가 돌면 금고의 값어치가 떨어진다
    h.log(sim, `청동으로 가짜 금화 ${g}개를 만들어 썼다`);
    X2.commit(sim, h, '화폐 위조', t.name, [], 0.08 + guardsNear(sim, h.x, h.y) * 0.05);
  };
  // 결혼 사기: 부자와 결혼한 뒤 재물을 들고 사라진다
  X.marriageFraudTick = (sim, h, u) => {
    const p = h.partner;
    if (!p || !p.alive || !(h.has('교활한') && h.has('탐욕스러운')) || p.gold < 50 || sim.year - (h.wedAt || 0) > 4 || !chance(0.03 * u)) return;
    const g = Math.floor(p.gold * 0.7);
    p.gold -= g; h.gold += g;
    h.log(sim, `배우자 ${p.name}의 재물 금화 ${g}개를 챙겨 달아났다`);
    p.log(sim, `배우자 ${josa(h.name, '이/가')} 재물을 들고 사라졌다. 처음부터 재물을 노린 결혼이었다`);
    S.addMood(sim, p, 'conned');
    M.adj(sim, p, h, { grudge: 70, trust: -100 });
    S.breakUp(sim, h, p, true);
    C.record(sim, h, '결혼 사기', p.name, false);
    mark(h, '결혼 사기');
    C.report(sim, h, '결혼 사기', p.name);
    C.flee(sim, h, '사기가 들통날까 봐');
  };
  // 중혼: 배우자 몰래 다른 사람과 또 혼인한다
  X.bigamyTick = (sim, h) => {
    if (!h.partner || !h.partner.alive || !h.affair || h.bigamy || !h.has('교활한') || !chance(0.02)) return;
    const o = sim.byId.get(h.affair);
    if (!grown(o) || S.mate(o) || o.partner) return;
    h.bigamy = o.id;
    S.rel(o, h).secretSpouse = true;
    h.log(sim, `배우자 ${h.partner.name} 몰래 ${josa(o.name, '과/와')} 또 혼인했다`);
    o.log(sim, `${josa(h.name, '과/와')} 몰래 혼인했다 (이미 배우자가 있는 줄은 몰랐다)`);
    C.record(sim, h, '중혼', o.name, false);
  };
  X.bigamyExpose = (sim, h) => {
    if (!h.bigamy || !chance(0.01 + guardsNear(sim, h.x, h.y) * 0.01)) return;
    const o = sim.byId.get(h.bigamy);
    h.bigamy = null;
    if (!o || !o.alive) return;
    const sp = h.partner && h.partner.alive ? h.partner : null;
    o.log(sim, `${josa(h.name, '이/가')} 이미 결혼한 사람이었다는 것을 알았다`);
    S.addMood(sim, o, 'deceived'); M.adj(sim, o, h, { grudge: 50, trust: -80 });
    if (sp) { S.addMood(sim, sp, 'betrayed'); M.adj(sim, sp, h, { grudge: 45, trust: -70 }); sp.log(sim, `${josa(h.name, '이/가')} 몰래 또 혼인한 사실을 알게 되었다`); }
    mark(h, '중혼'); C.report(sim, h, '중혼', o.name);
  };
  // 혼인 빙자: 결혼을 약속하고 관계를 맺은 뒤 버린다
  X.jiltTick = (sim, h) => {
    const o = h.lover;
    if (!o || !o.alive || h.partner || h.age < 18 || o.age < 18 || !h.has('교활한') || h.p.agree >= 35 || sim.year - (h.loverSince || 0) < 1 || !chance(0.02)) return;
    if ((S.peek(o, h)?.love || 0) < 50) return;
    h.log(sim, `결혼하자던 약속을 저버리고 ${josa(o.name, '을/를')} 떠났다`);
    o.log(sim, `결혼을 약속했던 ${josa(h.name, '이/가')} 떠나 버렸다`);
    S.breakUp(sim, h, o, false);
    S.addMood(sim, o, 'deceived');
    M.adj(sim, o, h, { grudge: 35, trust: -60 });
    C.record(sim, h, '혼인 빙자', o.name, false);
    if (chance(0.2)) { mark(h, '혼인 빙자'); C.report(sim, h, '혼인 빙자', o.name); }
  };
  // 공범: 감방 동료끼리 함께 금고를 턴다
  X.accompliceTick = (sim, h, u) => {
    if (!h.convictions || h.redeemed || !h.tribe || !chance(0.01 * u)) return;
    let mate = null;
    for (const [id, r] of h.rel) { if (!r.cellmate) continue; const o = sim.byId.get(id); if (able(o) && !o.redeemed && G.dist(o.x, o.y, h.x, h.y) < 5) { mate = o; break; } }
    if (!mate) return;
    const t = sim.tribes.find((o) => o.alive && !o.bandit && G.dist(o.cx, o.cy, h.x, h.y) < 10 && o.treasury >= 30);
    if (!t) return;
    const g = Math.floor(t.treasury * rand(0.15, 0.3));
    t.treasury -= g; h.gold += Math.ceil(g / 2); mate.gold += Math.floor(g / 2);
    h.log(sim, `감방 동료 ${josa(mate.name, '과/와')} 짜고 ${t.name}의 금고에서 금화 ${g}개를 털었다`);
    mate.log(sim, `감방 동료 ${josa(h.name, '과/와')} 함께 ${t.name}의 금고를 털었다`);
    const ws = C.witnesses(sim, t.cx, t.cy, [h, mate]);
    const a = X2.commit(sim, h, '특수 절도', t.name, ws, 0.25);
    C.record(sim, mate, '특수 절도', t.name, false);
    if (a.seen) { mark(mate, '특수 절도'); C.report(sim, mate, '특수 절도', t.name); }
  };
  // 간첩: 전쟁 중 적에게 마을 사정을 넘긴다
  X.spyTick = (sim, h, u) => {
    const t = h.tribe;
    if (!t || t.bandit || !t.wars.size || h === t.chief || !(h.has('탐욕스러운') || (t.chief && (S.peek(h, t.chief)?.grudge || 0) >= 50)) || !chance(0.008 * u)) return;
    const foe = sim.tribeById(pick([...t.wars]));
    if (!foe) return;
    const g = randi(10, 30);
    h.gold += g; foe.treasury = Math.max(0, foe.treasury - g);
    foe.spyIn = { tid: t.id, until: sim.year + 1 };
    h.log(sim, `${foe.name}에게 마을의 사정을 몰래 알려 주고 금화 ${g}개를 받았다`);
    X2.commit(sim, h, '간첩', foe.name, [], 0.12 + guardsNear(sim, h.x, h.y) * 0.05);
  };
  // 경비병 부패: 뇌물을 받고 수배자를 놓아준다 (C.onArriveArrest에서 부른다)
  X.corruptGuard = (sim, g, c) => {
    if (g.has('정직한') || !(g.has('탐욕스러운') || g.has('교활한')) || c.gold < 20 || !chance(0.3)) return false;
    const amt = Math.min(Math.floor(c.gold), randi(15, 35));
    c.gold -= amt; g.gold += amt;
    g.log(sim, `수배자 ${c.name}에게서 금화 ${amt}개를 받고 못 본 척 놓아주었다`);
    c.log(sim, `경비병 ${g.name}에게 금화 ${amt}개를 건네고 풀려났다`);
    C.record(sim, g, '경비병 부패', c.name, false);
    g.bribedBy = (g.bribedBy || 0) + 1;
    if (chance(0.1 * g.bribedBy)) { mark(g, '경비병 부패'); C.report(sim, g, '경비병 부패', c.name); }
    c.goTo(sim, c.x + rand(-10, 10), c.y + rand(-10, 10), { kind: 'wander' });
    return true;
  };

  // ================= 청소년 비행 (14~17세, C.tick에서 부른다) =================
  X.youthTick = (sim, h) => {
    if (!h.alive || h.age < 14 || h.age >= 18 || h.jail || h.held || h.state === 'sleep') return;
    const u = C.urge(h) * (h.cycle ? 1.3 : 1) * (h.parents.some((p) => { const o = sim.byId.get(p.id); return o && o.alive; }) ? 1 : 1.5);
    if (chance(0.004 * u)) {
      let v = null;
      sim.near(h.x, h.y, 3, (o) => { if (!v && o !== h && o.gold >= 5 && !S.isFamily(h, o.id) && !o.jail) v = o; });
      if (!v) return;
      const g = randi(2, Math.min(8, Math.floor(v.gold)));
      v.gold -= g; h.gold += g;
      h.log(sim, `또래와 어울려 다니다 ${v.name}의 금화 ${g}개를 슬쩍했다`);
      X2.commit(sim, h, '청소년 비행', v.name, C.witnesses(sim, h.x, h.y, [h]), 0.2);
      return;
    }
    // 패싸움
    if (chance(0.003 * u)) {
      const mine = [], theirs = [];
      sim.near(h.x, h.y, 4, (o) => { if (o === h || o.age < 13 || o.age >= 19 || o.jail) return; ((S.peek(h, o)?.v || 0) >= 20 ? mine : (S.peek(h, o)?.v || 0) < 0 ? theirs : []).push(o); });
      if (!theirs.length) return;
      for (const o of [h, ...mine, ...theirs]) { o.health -= rand(3, 10); S.addMood(sim, o, 'brawl'); }
      for (const o of theirs) M.adj(sim, o, h, { grudge: 15 });
      h.log(sim, `또래들과 패싸움을 벌였다 (${mine.length + 1} 대 ${theirs.length})`);
      X2.commit(sim, h, '패싸움', theirs[0].name, C.witnesses(sim, h.x, h.y, [h, ...mine, ...theirs]).filter((w) => w.adult), 0.2);
    }
  };

  // ================= 신앙 =================
  // 사이비 교주: 신 행세를 하며 신자에게서 재물을 뜯는다. 진짜 신이 기적을 보이면 정체가 드러난다
  X.cultTick = (sim, h, u) => {
    if (!h.cult) {
      if (!h.tribe || h.job === J.PRIEST || !h.has('교활한') || G.Persona.charm(h) < 60 || h.faith > 50 || !chance(0.004 * u)) return;
      h.cult = { since: sim.year, followers: [] };
      h.log(sim, '자신이 신의 뜻을 전하는 자라고 떠벌리기 시작했다');
      C.record(sim, h, '사이비 교주', h.tribe.name, false);
      return;
    }
    // 신자를 모으고 재물을 뜯는다
    sim.near(h.x, h.y, 5, (o) => {
      if (o === h || !o.adult || o.has('의심 많은') || o.faith < 55 || h.cult.followers.includes(o.id) || h.cult.followers.length >= 12 || !chance(0.2)) return;
      h.cult.followers.push(o.id);
      o.log(sim, `${josa(h.name, '을/를')} 신의 사자로 믿고 따르게 되었다`);
    });
    for (const id of h.cult.followers) {
      const o = sim.byId.get(id);
      if (!o || !o.alive || o.gold < 3 || !chance(0.15)) continue;
      const g = Math.min(Math.floor(o.gold), randi(2, 6));
      o.gold -= g; h.gold += g;
      S.addMood(sim, o, 'cultFleeced');
    }
    if (h.cult.followers.length >= 5 && !h.cult.announced && h.tribe) { h.cult.announced = true; h.tribe.log(sim, `${josa(h.name, '이/가')} 신의 사자를 자처하며 신자 ${h.cult.followers.length}명을 모았습니다`); }
    if (chance(0.004)) X.exposeCult(sim, h, '사람들의 의심 끝에');
  };
  X.exposeCult = (sim, h, why) => {
    if (!h.cult) return;
    const n = h.cult.followers.length;
    for (const id of h.cult.followers) {
      const o = sim.byId.get(id);
      if (!o || !o.alive) continue;
      S.addMood(sim, o, 'cultExposed');
      M.adj(sim, o, h, { trust: -80, grudge: 40 });
      o.faith = Math.min(100, o.faith + 10);
    }
    h.cult = null;
    h.log(sim, `${why} 거짓 예언자라는 정체가 드러났다`);
    tlog(sim, h.tribe, `${why} ${josa(h.name, '이/가')} 거짓 예언자였음이 드러났습니다 (속은 신자 ${n}명)`, true, h.x, h.y);
    mark(h, '사이비 교주');
    C.report(sim, h, '사이비 교주', h.tribe ? h.tribe.name : null);
  };
  // 신성모독과 제물 도둑
  X.blasphemyTick = (sim, h, u) => {
    const t = sim.tribes.find((o) => o.alive && o.temple && G.dist(o.cx, o.cy, h.x, h.y) < 4);
    if (!t) return;
    if (h.gold < 5 && h.faith < 30 && t.treasury >= 10 && chance(0.02 * u)) {
      const g = Math.min(10, Math.floor(t.treasury * 0.1));
      t.treasury -= g; h.gold += g;
      h.log(sim, `${t.name} 신전에 바친 제물을 훔쳤다`);
      X2.commit(sim, h, '제물 도둑', t.name, C.witnesses(sim, t.cx, t.cy, [h]), 0.2);
      return;
    }
    if (h.faith < 12 && h.has('의심 많은') && (h.drunk > 0 || (h.stress || 0) > 60) && chance(0.01 * u)) {
      h.log(sim, `${t.name}의 신전을 더럽히고 신을 조롱했다`);
      const devout = t.members.filter((m) => m.faith > 60).length / Math.max(1, t.members.length);
      for (const m of t.members) if (m.faith > 50) { S.addMood(sim, m, 'desecrated'); M.adj(sim, m, h, { grudge: 25 }); }
      const { rec } = X2.commit(sim, h, '신성모독', t.name, C.witnesses(sim, t.cx, t.cy, [h]), 0.5);
      // 신앙이 깊은 부족일수록 무겁게 다룬다
      if (devout > 0.5) rec.heavy = true;
    }
  };

  // 인신공양: 광신 부족이 가뭄에 제물을 바치려 한다. 신(플레이어)이 비·축복·치유를 내리면 막을 수 있다
  X.sacrificeCheck = (sim, t) => {
    if (!t.law || !t.law.zealot || !sim.drought || t.sacrifice || sim.year - (t.lastSacrifice || -99) < 3) return;
    const priest = t.members.find((m) => m.job === J.PRIEST && !m.jail) || (t.temple && t.chief);
    if (!priest || !chance(0.5)) return;
    // 제물은 친구가 적은 사람, 전과자, 외톨이가 고르기 쉽다
    const cands = t.members.filter((m) => m.adult && m !== priest && m !== t.chief && !m.jail && !m.held);
    if (!cands.length) return;
    cands.sort((a, b) => (friendsOf(sim, a) * 10 - (a.convictions || 0) * 15 - (a.wg || 0) * 0.2) - (friendsOf(sim, b) * 10 - (b.convictions || 0) * 15 - (b.wg || 0) * 0.2));
    const v = cands[0];
    t.sacrifice = { victim: v.id, priest: priest.id, at: sim.year + 0.25 };
    v.log(sim, '가뭄을 끝내기 위한 제물로 정해졌다');
    S.addMood(sim, v, 'captive');
    sim.event(`${josa(t.name, '이/가')} 가뭄을 끝내려고 ${josa(v.name, '을/를')} 신에게 제물로 바치려 합니다! (마을에 비나 축복을 내리면 막을 수 있습니다)`, '#ff7050', t.cx, t.cy);
    sim.stats.sacrificePlanned = (sim.stats.sacrificePlanned || 0) + 1;
  };
  X.sacrificeTick = (sim, t) => {
    const s = t.sacrifice;
    if (!s || sim.year < s.at) return;
    t.sacrifice = null; t.lastSacrifice = sim.year;
    const v = sim.byId.get(s.victim), priest = sim.byId.get(s.priest);
    if (!v || !v.alive) return;
    const fam = kinIds(sim, v);
    v.log(sim, '제단 위에서 신에게 바쳐졌다');
    sim.kill(v, '인신공양');
    if (priest && priest.alive) {
      const rec = C.record(sim, priest, '인신공양', v.name, true);
      rec.punished = true; rec.sanctioned = true; // 이 부족의 법은 이를 죄로 보지 않는다
      priest.log(sim, `가뭄을 끝내려 ${josa(v.name, '을/를')} 신에게 바쳤다`);
    }
    for (const id of fam) {
      const o = sim.byId.get(id);
      if (!o) continue;
      S.addMood(sim, o, 'sacrificed');
      o.faith = Math.max(0, o.faith - 40);
      if (priest) M.adj(sim, o, priest, { grudge: 70, trust: -90 });
      o.log(sim, `${josa(v.name, '이/가')} 제물로 바쳐진 뒤 신을 믿지 않게 되었다`);
    }
    t.log(sim, `${josa(t.name, '이/가')} 가뭄을 끝내려고 ${josa(v.name, '을/를')} 신에게 바쳤습니다`);
    sim.stats.sacrifices = (sim.stats.sacrifices || 0) + 1;
  };

  // 마녀사냥: 재앙이 닥치면 희생양을 찾는다 (번개·운석·역병 뒤에 부른다)
  X.disaster = (sim, x, y, what) => {
    const t = sim.tribes.find((o) => o.alive && !o.bandit && G.dist(o.cx, o.cy, x, y) < 18);
    if (!t || t.members.length < 6 || sim.year - (t.lastWitch || -99) < 3) return;
    const avg = t.members.reduce((s, m) => s + m.happy, 0) / t.members.length;
    const zeal = (t.chief && t.chief.has('의심 많은') ? 0.15 : 0) + (avg < 40 ? 0.15 : 0) + (t.law && t.law.zealot ? 0.15 : 0);
    if (!chance(0.1 + zeal)) return;
    // 예민한 사람, 외톨이, 치료사가 표적이 되기 쉽다
    const cands = t.members.filter((m) => m.adult && m !== t.chief && !m.jail && !m.held);
    if (!cands.length) return;
    const score = (m) => (m.p.neuro > 65 ? 20 : 0) + (friendsOf(sim, m) === 0 ? 25 : 0) + (m.job === J.HEALER ? 20 : 0) + (m.age > 55 ? 10 : 0) + (m.mind ? 10 : 0) + rand(0, 15);
    cands.sort((a, b) => score(b) - score(a));
    const v = cands[0];
    let accuser = null;
    for (const m of t.members) if (m !== v && m.adult && !m.has('너그러운') && ((S.peek(m, v)?.grudge || 0) >= 20 || m.has('의심 많은'))) { accuser = m; break; }
    accuser = accuser || t.chief;
    if (!accuser || accuser === v) return;
    t.lastWitch = sim.year;
    S.addMood(sim, v, 'accused');
    v.log(sim, `${what} 뒤 ${josa(accuser.name, '이/가')} 앞장서 재앙을 부른 자로 몰았다`);
    accuser.log(sim, `${what}의 탓을 ${v.name}에게 돌리며 앞장서 몰아세웠다`);
    C.record(sim, accuser, '마녀사냥', v.name, false);
    let defenders = 0;
    for (const m of t.members) if (m !== v && (S.peek(m, v)?.v || 0) >= 50) defenders++;
    if (defenders >= 3 && chance(0.6)) {
      v.log(sim, '친구들이 감싸 준 덕분에 화를 면했다');
      t.log(sim, `${what} 뒤 ${josa(v.name, '이/가')} 재앙을 부른 자로 몰렸으나 이웃들이 감싸 주었습니다`, false);
      return;
    }
    const fam = kinIds(sim, v);
    for (const id of fam) { const o = sim.byId.get(id); if (o) M.adj(sim, o, accuser, { grudge: 60 }); }
    if (chance(t.law && t.law.death ? 0.5 : 0.2)) {
      v.log(sim, '재앙을 부른 자라는 누명을 쓰고 죽임을 당했다');
      sim.kill(v, '마녀사냥');
      t.log(sim, `${what} 뒤 ${josa(t.name, '이/가')} 재앙을 부른 자라며 ${josa(v.name, '을/를')} 죽였습니다`);
    } else {
      t.log(sim, `${what} 뒤 ${josa(t.name, '이/가')} 재앙을 부른 자라며 ${josa(v.name, '을/를')} 내쫓았습니다`);
      C.exile(sim, t, v);
      v.outlaw = false; // 죄를 지은 것은 아니다
    }
    sim.stats.witchHunts = (sim.stats.witchHunts || 0) + 1;
  };

  // ================= 전쟁과 약탈 (human.raid에서 부른다) =================
  X.raid = (sim, h, foe) => {
    const mine = h.tribe;
    if (!mine) return false;
    const ruthless = h.has('냉정한') || h.p.agree < 25;
    // 도적단이 밤에 외딴 집을 습격한다: 강도 일가족 살인
    if (mine.bandit && ruthless && sim.isNight() && foe.houses.length && chance(0.04)) {
      const i = foe.houses.reduce((b, q, k) => (G.dist(q.x, q.y, foe.cx, foe.cy) > G.dist(foe.houses[b].x, foe.houses[b].y, foe.cx, foe.cy) ? k : b), 0);
      const hs = foe.houses[i];
      const inside = foe.members.filter((m) => m.alive && !m.jail && m.id % foe.houses.length === i && G.dist(m.x, m.y, hs.x, hs.y) < 6);
      if (inside.length >= 2) {
        const head = inside.find((m) => m.adult) || inside[0];
        const g = Math.min(30, Math.floor(foe.treasury * 0.2)); foe.treasury -= g; h.gold += g;
        X.massacre(sim, h, head, '강도질', 1, { victims: inside });
        return true;
      }
    }
    // 학살: 싸우지 않는 사람들을 죽인다
    if (ruthless && chance(0.05)) {
      const vs = [];
      sim.near(h.x, h.y, 5, (o) => { if (vs.length < 3 && o.tribe === foe && o.job !== J.WARRIOR && o.job !== J.GUARD && o.job !== J.CHIEF && !o.jail) vs.push(o); });
      if (vs.length >= 2) {
        for (const v of vs) { v.log(sim, `${mine.name}의 습격에 무고하게 목숨을 잃었다`); sim.kill(v, '학살', h); }
        h.murders += vs.length; h.kills += vs.length;
        C.record(sim, h, '학살', foe.name, true);
        h.notoriety = clamp(h.notoriety + 30, 0, 100);
        foe.atrocity = foe.atrocity || {}; foe.atrocity[mine.id] = sim.year;
        sim.changeRel(foe, mine, -40);
        for (const m of foe.members) if (m.adult) M.adj(sim, m, h, { grudge: 40 });
        sim.event(`${mine.name}의 ${josa(h.name, '이/가')} ${foe.name}의 싸우지 않는 사람 ${vs.length}명(${vs.map((v) => v.name).join(', ')})을 학살했습니다`, '#ff5050', h.x, h.y);
        sim.stats.atrocities = (sim.stats.atrocities || 0) + 1;
        return true;
      }
    }
    // 전시 성폭력
    if (h.age >= 18 && h.p.agree < 25 && chance(0.03)) {
      let v = null;
      sim.near(h.x, h.y, 4, (o) => { if (!v && o.tribe === foe && grown(o) && o.job !== J.WARRIOR && o.job !== J.GUARD) v = o; });
      if (v) { X.sexAssault(sim, h, v, '전시 성폭력'); return false; }
    }
    return false;
  };
  // 학살의 기억은 수십 년 동안 두 부족 사이를 갈라놓는다 (tribe 외교에서 쓴다)
  X.atrocityPenalty = (a, b, year) => {
    const ya = a.atrocity && a.atrocity[b.id], yb = b.atrocity && b.atrocity[a.id];
    return (ya && year - ya < 30) || (yb && year - yb < 30) ? -4 : 0;
  };

  // 인질의 운명: 몸값이 오지 않으면 팔려 가거나 처형된다 (Crime2.heldTick에서 부른다)
  X.heldTick = (sim, v, H, bandits, home) => {
    if (!bandits || H.forced || sim.year - H.since < 1.5) return false;
    const boss = bandits.chief;
    // 포로 처형
    if (boss && boss.has('냉정한') && sim.year - H.since > 2.5 && chance(0.02)) {
      v.held = null; v.state = 'idle';
      v.log(sim, '몸값이 오지 않아 처형당했다');
      sim.kill(v, '처형', boss);
      C.record(sim, boss, '포로 처형', v.name, true);
      boss.notoriety = clamp(boss.notoriety + 25, 0, 100);
      if (home) { home.atrocity = home.atrocity || {}; home.atrocity[bandits.id] = sim.year; for (const m of home.members) if (m.adult) M.adj(sim, m, boss, { grudge: 35 }); }
      sim.event(`${josa(bandits.name, '이/가')} 몸값을 받지 못하자 인질 ${josa(v.name, '을/를')} 처형했습니다`, '#ff5050', v.x, v.y);
      return true;
    }
    // 노예로 팔아넘긴다
    if (!chance(0.03)) return false;
    const buyers = sim.tribes.filter((t) => t.alive && !t.bandit && t !== home && t.treasury >= 30 && t.chief && !t.chief.has('정직한') && !t.chief.has('너그러운'));
    if (!buyers.length) return false;
    const buyer = pick(buyers);
    const price = Math.min(Math.floor(buyer.treasury * 0.4), randi(25, 50));
    buyer.treasury -= price; bandits.treasury += price;
    v.held = null; v.state = 'idle';
    const exploit = buyer.chief.p.agree < 30 && chance(0.4);
    v.enslaved = { tid: buyer.id, from: home ? home.id : null, since: sim.year, exploit };
    buyer.add(sim, v);
    v.x = buyer.cx + rand(-1, 1); v.y = buyer.cy + rand(-1, 1);
    v.log(sim, exploit ? `${buyer.name}에 팔려 가 몸까지 착취당하게 되었다` : `${buyer.name}에 노예로 팔려 갔다`);
    if (boss) C.record(sim, boss, exploit ? '성 착취 인신매매' : '인신매매', v.name, true);
    C.record(sim, buyer.chief, '노예 매수', v.name, false);
    sim.event(`${josa(bandits.name, '이/가')} 인질 ${josa(v.name, '을/를')} ${buyer.name}에 노예로 팔아넘겼습니다`, '#ff8a50', v.x, v.y);
    sim.stats.trafficked = (sim.stats.trafficked || 0) + 1;
    return true;
  };
  X.slaveTick = (sim, v) => {
    const E = v.enslaved;
    if (!E) return;
    const t = sim.tribeById(E.tid);
    if (!t || v.tribe !== t) { v.enslaved = null; return; }
    S.addMood(sim, v, E.exploit ? 'exploited' : 'enslaved');
    v.stress = clamp((v.stress || 0) + 2, 0, 100);
    if (v.job !== J.GATHER && v.job !== J.WOOD && v.job !== J.MINE) v.job = pick([J.GATHER, J.WOOD, J.MINE]);
    let how = null;
    if (t.chief && t.chief.has('너그러운') && chance(0.05)) how = `${t.title} ${josa(t.chief.name, '이/가')} 풀어 주어`;
    else if (sim.year - E.since > 10 && chance(0.1)) how = '오랜 세월 끝에 자유를 얻어';
    else if (chance(v.has('용감한') || v.has('교활한') ? 0.02 : 0.008)) how = '감시를 피해 달아나';
    else if (guardsNear(sim, v.x, v.y) && E.exploit && chance(0.02)) {
      how = '경비병의 눈에 띄어 구출되어';
      if (t.chief) { mark(t.chief, '노예 매수'); C.report(sim, t.chief, '노예 매수', v.name); }
    }
    if (!how) return;
    v.enslaved = null;
    t.remove(sim, v);
    S.addMood(sim, v, E.exploit ? 'rescued' : 'freed');
    M.trauma(sim, v, 0.3, '노예로 지낸 기억에');
    v.log(sim, `${how} 노예 신세에서 벗어났다`);
    const home = E.from && sim.tribeById(E.from);
    if (home) v.goTo(sim, home.cx, home.cy, { kind: 'wander' });
    sim.event(`노예로 팔려 갔던 ${josa(v.name, '이/가')} ${how} 자유를 되찾았습니다`, '#7fc8f8', v.x, v.y);
  };

  // ================= 사적 제재 (tribe.js에서 경비병 없이 수배자를 붙잡을 때 부른다) =================
  X.lynch = (sim, t, m) => {
    const lethal = m.crimes.some((c) => c.known && !c.punished && (C.LETHAL.has(c.type) || X.SEXUAL.has(c.type)));
    const angry = t.members.filter((o) => o.adult && (S.peek(o, m)?.grudge || 0) >= 50).length;
    if (!lethal || angry < 3 || (t.chief && t.chief.has('정직한')) || !chance(0.2 + angry * 0.04)) return false;
    const fake = m.crimes.some((c) => c.fake && !c.revealed);
    const leader = t.members.find((o) => o.adult && o !== m && (S.peek(o, m)?.grudge || 0) >= 50) || null;
    m.log(sim, '재판도 받지 못한 채 성난 마을 사람들에게 죽임을 당했다');
    sim.kill(m, '사적 제재');
    if (leader) {
      C.record(sim, leader, '사적 제재', m.name, !!fake);
      leader.log(sim, `앞장서 ${josa(m.name, '을/를')} 재판 없이 죽였다`);
    }
    t.log(sim, fake ? `마을 사람들이 누명을 쓴 ${josa(m.name, '을/를')} 재판 없이 죽였습니다. 억울한 죽음이었습니다` : `성난 마을 사람들이 ${josa(m.name, '을/를')} 재판 없이 죽였습니다`);
    if (fake && leader) C.report(sim, leader, '사적 제재', m.name);
    sim.stats.lynchings = (sim.stats.lynchings || 0) + 1;
    return true;
  };

  // ================= 기근 범죄: 폭동과 식인 =================
  X.famineCheck = (sim, t) => {
    if (t.bandit || t.stock.food >= 1 || t.members.length < 6) return;
    const hungry = t.members.filter((m) => m.adult && m.hunger > 75 && !m.jail);
    if (hungry.length < t.members.length * 0.4) return;
    // 폭동
    if (chance(0.35)) {
      const leader = hungry.sort((a, b) => b.p.impulse - a.p.impulse)[0];
      const loot = Math.min(Math.floor(t.treasury * 0.3), 40);
      t.treasury -= loot;
      for (const m of hungry) { m.gold += Math.floor(loot / hungry.length); S.addMood(sim, m, 'famine'); }
      for (const m of hungry.slice(0, 4)) m.health -= rand(3, 10);
      if (t.chief) for (const m of hungry) M.adj(sim, m, t.chief, { grudge: 10, respect: -10 });
      leader.log(sim, '굶주린 사람들을 이끌고 부족 창고와 금고를 털었다');
      t.log(sim, `굶주린 ${hungry.length}명이 ${josa(leader.name, '을/를')} 앞세워 폭동을 일으켰습니다`);
      X2.commit(sim, leader, '폭동', t.name, [], 0.6);
      sim.stats.riots = (sim.stats.riots || 0) + 1;
    }
    // 식인: 극한의 굶주림 속에서 금기를 어긴다. 기록 문장으로만, 아주 드물게
    const recent = sim.archive.slice(-10).some((r) => r.cause === '굶주림' && r.tribe === t.name && sim.year - r.died < 0.5);
    if (recent && chance(0.08)) {
      const h = hungry.find((m) => m.has('냉정한') || m.p.agree < 25);
      if (!h) return;
      h.hunger = Math.max(0, h.hunger - 50);
      h.log(sim, '극한의 굶주림 끝에 부족의 가장 큰 금기를 어겼다');
      h.stress = clamp((h.stress || 0) + 40, 0, 100);
      const { seen } = X2.commit(sim, h, '식인', t.name, [], 0.4);
      if (seen) { for (const m of t.members) if (m.adult && m !== h) { S.addMood(sim, m, 'taboo'); M.adj(sim, m, h, { trust: -70, fear: 30 }); } t.log(sim, `굶주림 속에 ${josa(h.name, '이/가')} 금기를 어긴 일이 드러나 마을이 충격에 빠졌습니다`); }
    }
  };

  // ================= 해마다: 매점매석, 장물, 보호비 =================
  X.yearly = (sim) => {
    for (const t of sim.tribes) {
      if (!t.alive) continue;
      // 매점매석: 흉년에 상인이 식량을 쌓아 두고 비싸게 판다
      if (!t.bandit && (sim.drought || t.stock.food < t.members.length * 2)) {
        const m = t.members.find((o) => o.job === J.MERCHANT && o.has('탐욕스러운') && !o.has('정직한') && !o.jail);
        if (m && t.stock.food >= 4 && chance(0.4)) {
          const q = Math.floor(t.stock.food * 0.3);
          t.stock.food -= q; m.gold += q * 4;
          for (const o of t.members) if (o.adult && o !== m) M.adj(sim, o, m, { grudge: 8 });
          m.log(sim, `흉년에 식량 ${q}개를 사들여 쌓아 두고 비싸게 팔았다`);
          X2.commit(sim, m, '매점매석', t.name, [], 0.3);
        }
      }
      // 장물아비: 도적단의 약탈품을 사 준다
      if (t.bandit && t.members.length >= 3) {
        const fence = sim.humans.find((o) => o.alive && o.job === J.MERCHANT && o.tribe && !o.tribe.bandit && (o.has('탐욕스러운') || o.has('교활한')) && !o.has('정직한') && G.dist(o.x, o.y, t.cx, t.cy) < 50);
        if (fence && chance(0.3)) {
          const g = randi(10, 30);
          fence.gold += g; t.stock.food += 6; t.treasury += Math.floor(g / 2);
          fence.log(sim, `${t.name}의 약탈품을 몰래 사들여 되팔았다`);
          X2.commit(sim, fence, '장물 취득', t.name, [], 0.15);
        }
      }
      // 보호비 갈취: 도적단이 마을에 상납을 요구한다. 거절하면 습격한다
      if (t.bandit && t.members.length >= 3 && !t.wars.size) {
        const v = sim.tribes.filter((o) => o.alive && !o.bandit && o.members.length && G.dist(o.cx, o.cy, t.cx, t.cy) < 55).sort((a, b) => G.dist(a.cx, a.cy, t.cx, t.cy) - G.dist(b.cx, b.cy, t.cx, t.cy))[0];
        if (v && chance(0.5)) {
          const fighters = v.members.filter((m) => m.job === J.WARRIOR || m.job === J.GUARD).length;
          const amt = Math.min(Math.floor(v.treasury * 0.25), 15 + t.members.length * 5);
          if (fighters < t.members.length && amt > 0 && chance(0.6)) {
            v.treasury -= amt; t.treasury += amt;
            for (const m of v.members) if (m.adult) S.addMood(sim, m, 'racket');
            v.log(sim, `${josa(v.name, '이/가')} ${t.name}의 위협에 금화 ${amt}개를 상납했습니다`);
            if (t.chief) { C.record(sim, t.chief, '보호비 갈취', v.name, true); }
          } else {
            v.log(sim, `${josa(v.name, '이/가')} ${t.name}의 상납 요구를 거절했습니다`);
            sim.declareWar(t, v);
          }
        }
      }
      X.famineCheck(sim, t);
      X.sacrificeCheck(sim, t);
      // 역병이 돌면 희생양을 찾는다
      const sick = t.members.filter((m) => m.sick).length;
      if (sick >= Math.max(4, t.members.length * 0.3)) X.disaster(sim, t.cx, t.cy, '역병');
    }
  };
  // 사회 틱마다 (달력 기준): 인신공양 날짜
  X.social = (sim) => { for (const t of sim.tribes) if (t.alive && t.sacrifice) X.sacrificeTick(sim, t); };

  // ================= 성범죄 (어른끼리만, 기록 문장으로만) =================
  // kind: 강간 · 준강간 · 교제 성폭력 · 부부 강간 · 전시 성폭력
  X.sexAssault = (sim, h, v, kind) => {
    if (!grown(h) || !grown(v) || h === v) return;
    const t = v.tribe;
    const marital = kind === '부부 강간';
    const ws = C.witnesses(sim, v.x, v.y, [h, v]).filter((w) => w.age >= 18);
    // 저항하거나 누가 끼어들어 미수에 그치기도 한다 (잠든 사람은 저항하지 못한다)
    const helpless = kind === '준강간';
    const resist = helpless ? 0 : 0.15 + (v.has('용감한') ? 0.2 : 0) + (v.body - h.body) / 250 + (ws.length ? 0.3 : 0);
    if (chance(clamp(resist, 0, 0.8))) {
      h.log(sim, `${josa(v.name, '을/를')} 성폭행하려다 ${ws.length ? '사람들이 끼어들어' : '거센 저항에'} 실패했다`);
      v.log(sim, `${h.name}에게 성폭행을 당할 뻔했지만 ${ws.length ? '사람들이 도와주어' : '힘껏 저항해'} 벗어났다`);
      S.addMood(sim, v, 'attempted');
      M.adj(sim, v, h, { fear: 40, grudge: 50, trust: -90 });
      S.bump(sim, v, h, -60, -50);
      M.trauma(sim, v, 0.15, '성폭행을 당할 뻔한 뒤');
      h.health -= rand(3, 12);
      const rec = C.record(sim, h, '강간 미수', v.name, false);
      rec.evidence = true;
      X.reportSexual(sim, h, v, '강간 미수', rec, ws, 0.35);
      return;
    }
    const lines = {
      강간: [`${josa(v.name, '을/를')} 성폭행했다`, `${h.name}에게 성폭행을 당했다`],
      준강간: [`${v.state === 'sleep' ? '잠든' : '술에 취한'} ${josa(v.name, '을/를')} 성폭행했다`, `${v.state === 'sleep' ? '잠든 사이' : '술에 취한 사이'} ${h.name}에게 성폭행을 당했다`],
      '교제 성폭력': [`연인 ${josa(v.name, '을/를')} 억지로 강요했다`, `연인 ${h.name}에게 원치 않는 관계를 강요당했다`],
      '부부 강간': [`배우자 ${josa(v.name, '을/를')} 억지로 강요했다`, `배우자 ${h.name}에게 원치 않는 관계를 강요당했다`],
      '전시 성폭력': [`${t ? t.name + '의 ' : ''}${josa(v.name, '을/를')} 습격 중에 성폭행했다`, `${h.tribe ? h.tribe.name + '의 ' : ''}${h.name}에게 습격 중 성폭행을 당했다`],
    }[kind];
    h.log(sim, lines[0]);
    v.log(sim, lines[1]);
    S.addMood(sim, v, 'raped');
    M.adj(sim, v, h, { fear: 60, grudge: 70, trust: -100 });
    S.bump(sim, v, h, -80, -70);
    v.stress = clamp((v.stress || 0) + 35, 0, 100);
    M.trauma(sim, v, 0.55, '성폭행을 당한 뒤');
    if (!v.mind && chance(0.2)) M.setCondition(sim, v, '불안증', null, '그날 이후');
    v.say('…', 200);
    sim.stats.sexCrimes = (sim.stats.sexCrimes || 0) + 1;
    // 연애를 피하게 된다
    if (marital || kind === '교제 성폭력') { S.rel(v, h).love = Math.max(0, (S.rel(v, h).love || 0) - 50); }
    // 원치 않는 임신
    const mom = v.gender === 'F' && h.gender === 'M' ? v : null;
    if (mom && !mom.pregnant && mom.age < 45 && chance(0.08)) {
      mom.pregnant = Math.floor(TPY * 0.75);
      mom.babyFather = { id: h.id, name: h.name, traits: h.traits.slice(), faith: h.faith };
      mom.unwantedPreg = true;
      S.addMood(sim, mom, 'unwanted');
      mom.log(sim, '그 일로 원치 않는 임신을 하게 되었다');
    }
    // 성병이 옮기도 한다
    if (h.std && !v.std && chance(0.4)) v.std = { since: sim.year, from: h.id, known: false };
    // 부부 사이의 강요를 죄로 보지 않는 부족
    if (marital && !(t && t.law && t.law.maritalRape)) {
      v.log(sim, '부족의 법은 부부 사이의 일을 죄로 보지 않았다');
      if (chance(0.35)) { v.log(sim, '더는 견디지 못하고 떠나기로 했다'); S.breakUp(sim, v, h, true); }
      return;
    }
    const rec = C.record(sim, h, kind, v.name, false);
    rec.evidence = ws.length > 0 || chance(0.25) || kind === '전시 성폭력';
    const base = { 강간: 0.22, 준강간: 0.12, '교제 성폭력': 0.1, '부부 강간': 0.08, '전시 성폭력': 0.4 }[kind];
    X.reportSexual(sim, h, v, kind, rec, ws, base);
    X.honorCheck(sim, v, h);
  };

  // 신고: 아는 사람일수록, 가해자의 지위가 높을수록, 피해자가 고립될수록 신고하기 어렵다
  X.reportSexual = (sim, h, v, kind, rec, ws, base) => {
    const known = (S.peek(v, h)?.v || 0) > -60 && !!S.peek(v, h);
    let p = base + friendsOf(sim, v) * 0.04 + (v.has('용감한') ? 0.12 : 0) + (rec.evidence ? 0.1 : 0)
      - (h.job === J.CHIEF || h.job === J.GUARD ? 0.12 : 0) - (S.isFamily(v, h.id) ? 0.08 : 0);
    // 가해자 쪽 가족이나 친구가 입막음을 한다
    let silencer = null;
    sim.near(v.x, v.y, 8, (o) => { if (!silencer && o !== h && o !== v && o.adult && ((S.peek(o, h)?.v || 0) >= 70 || S.isFamily(o, h.id)) && !o.has('정직한')) silencer = o; });
    if (silencer && chance(0.35)) {
      p *= 0.3;
      S.addMood(sim, v, 'hushed');
      v.log(sim, `${h.name} 쪽의 ${josa(silencer.name, '이/가')} 일을 키우지 말라며 입을 막았다`);
      silencer.log(sim, `${josa(v.name, '을/를')} 찾아가 ${h.name}의 일을 덮으라고 다그쳤다`);
    }
    if (ws.length && C.detect(sim, h, kind, v.name, ws)) p += 0.4;
    if (!chance(clamp(p, 0.03, 0.95))) {
      v.log(sim, known ? '아는 사람이라 더 말하기 어려워 아무에게도 털어놓지 못했다' : '두려워서 아무에게도 털어놓지 못했다');
      v.unreported = (v.unreported || 0) + 1;
      return;
    }
    v.log(sim, '용기를 내어 피해를 알렸다');
    rec.known = true;
    C.report(sim, h, kind, v.name);
    X.secondary(sim, v, h);
  };
  // 2차 피해와 지지
  X.secondary = (sim, v, h) => {
    let blame = 0, support = 0;
    sim.near(v.x, v.y, 12, (o) => {
      if (o === v || o === h || !o.adult) return;
      const ov = S.peek(o, v)?.v || 0, oh = S.peek(o, h)?.v || 0;
      if (ov >= 40 || o.has('다정한')) { support++; S.bump(sim, o, v, 6); M.adj(sim, o, h, { trust: -40, grudge: 20 }); }
      else if ((oh >= 40 || o.p.agree < 30) && chance(0.4)) { blame++; S.bump(sim, o, v, -8); }
    });
    if (blame) { S.addMood(sim, v, 'blamed'); v.log(sim, `피해를 알린 뒤 오히려 수군거리는 사람이 ${blame}명 있었다`); }
    if (support) { S.addMood(sim, v, 'believed'); M.support(sim, v, 10 + support * 4); if (support >= 2) v.log(sim, `곁에서 믿어 주는 사람들 덕분에 버틸 수 있었다`); }
  };
  // 명예살인: 명예를 지나치게 따지는 부족에서 가족이 오히려 피해자를 해친다. 아주 드물고, 처벌 대상이다
  X.honorCheck = (sim, v, h) => {
    const t = v.tribe;
    if (!t || !t.law || !t.law.honor || !chance(0.04)) return;
    let k = null;
    for (const id of kinIds(sim, v)) { const o = sim.byId.get(id); if (able(o) && o !== h && o.has('냉정한') && o.p.agree < 25 && o !== v.partner) { k = o; break; } }
    if (!k) return;
    X.slay(sim, k, v, '명예살인', { log: `'가문의 수치'라며 피해자인 ${josa(v.name, '을/를')} 해쳤다` });
    t.log(sim, `${josa(v.name, '이/가')} 가족의 손에 목숨을 잃었습니다. 피해자를 탓한 비극이었습니다`);
  };

  // 성범죄의 기회 (Crime3.tick)
  X.sexTick = (sim, h, u) => {
    if (h.age < 18 || h.p.agree >= 30 || h.has('다정한') || !chance(0.01 * u * (h.drunk > 0 ? 2 : 1) * (h.p.impulse > 60 ? 1.4 : 1))) return;
    const mate = S.mate(h);
    // 부부·연인 사이
    if (mate && grown(mate) && G.dist(mate.x, mate.y, h.x, h.y) < 3 && ((h.stress || 0) > 60 || h.drunk > 0 || (h.dv || 0) >= 2) && chance(0.4)) {
      return X.sexAssault(sim, h, mate, mate === h.partner ? '부부 강간' : '교제 성폭력');
    }
    // 잠들었거나 취한 사람
    let v = null;
    sim.near(h.x, h.y, 3, (o) => { if (!v && o !== h && o !== mate && grown(o) && (o.drunk > 0 || o.state === 'sleep') && !S.isFamily(h, o.id) && others(sim, o.x, o.y, 4, [h, o]) === 0) v = o; });
    if (v) return X.sexAssault(sim, h, v, '준강간');
    // 아는 사람 (대부분) 또는 밤에 혼자 있는 낯선 사람 (드물게)
    sim.near(h.x, h.y, 3, (o) => {
      if (v || o === h || o === mate || !grown(o) || S.isFamily(h, o.id) || sim.isRelative(h, o)) return;
      if (others(sim, o.x, o.y, 3, [h, o]) > 1) return;
      const knows = !!S.peek(h, o);
      if (knows || (sim.isNight() && chance(0.2))) v = o;
    });
    if (v) X.sexAssault(sim, h, v, '강간');
  };

  // 성병: 몰래 만나거나 착취당하는 사람 사이에서 퍼지고, 알면서 숨기면 죄가 된다
  X.stdTick = (sim, h) => {
    if (!h.std) {
      if ((h.affair || (h.enslaved && h.enslaved.exploit) || h.exploiting) && h.age >= 18 && chance(0.002)) h.std = { since: sim.year, known: false };
      return;
    }
    h.health -= 0.3;
    if (!h.std.known && chance(0.05)) {
      let healer = null;
      sim.near(h.x, h.y, 6, (o) => { if (!healer && o.job === J.HEALER) healer = o; });
      if (healer || chance(0.2)) {
        h.std.known = true;
        S.addMood(sim, h, 'sick2');
        h.log(sim, healer ? `치료사 ${healer.name}에게서 몸의 이상이 옮는 병이라는 말을 들었다` : '몸의 이상이 옮는 병이라는 것을 알게 되었다');
        const src = h.std.from && sim.byId.get(h.std.from);
        if (src && src.alive && src.std && src.std.known && src.std.hid) {
          M.adj(sim, h, src, { grudge: 40, trust: -60 });
          h.log(sim, `${josa(src.name, '이/가')} 병을 알면서도 숨겼다는 것을 알았다`);
          if (chance(0.3)) { mark(src, '성병 전파'); C.report(sim, src, '성병 전파', h.name); }
        }
      }
    }
    // 짝이나 몰래 만나는 사람에게 옮긴다
    const partners = [S.mate(h), h.affair && sim.byId.get(h.affair)].filter((o) => o && o.alive && o.age >= 18 && !o.std);
    for (const o of partners) {
      if (!chance(0.04)) continue;
      o.std = { since: sim.year, from: h.id, known: false };
      if (h.std.known && !h.has('정직한')) { h.std.hid = true; C.record(sim, h, '성병 전파', o.name, false); }
    }
    // 약초학을 아는 치료사나 신의 치유로 낫는다
    if (h.std.known && chance(0.03)) {
      let cure = false;
      sim.near(h.x, h.y, 6, (o) => { if (o.job === J.HEALER && o.tribe && o.tribe.has('약초학')) cure = true; });
      if (cure) { h.std = null; h.log(sim, '옮는 병에서 나았다'); }
    }
  };

  // 명예훼손: 거절당한 사람이 거짓 소문을 퍼뜨린다 (S.confess에서 거절당하면 표시)
  X.onRejected = (sim, h, o) => { if (h.age >= 18 && o.age >= 18) S.rel(h, o).rejectedAt = sim.year; };
  X.rumorTick = (sim, h, u) => {
    if (h.p.agree >= 35 || !chance(0.03 * u)) return;
    for (const [id, r] of h.rel) {
      if (!r.rejectedAt || sim.year - r.rejectedAt > 2 || r.rumored) continue;
      const o = sim.byId.get(id);
      if (!grown(o)) continue;
      r.rumored = true;
      h.log(sim, `거절한 ${o.name}에 대해 낯 뜨거운 거짓 소문을 퍼뜨렸다`);
      let n = 0;
      sim.near(o.x, o.y, 15, (w) => { if (w !== o && w !== h && w.adult && !w.has('의심 많은') && (S.peek(w, o)?.v || 0) < 50) { M.adj(sim, w, o, { trust: -10, respect: -10 }); n++; } });
      S.addMood(sim, o, 'rumor');
      o.log(sim, '자신에 대한 낯 뜨거운 거짓 소문이 돌았다');
      C.record(sim, h, '명예훼손', o.name, false);
      if (chance(0.3)) { o.log(sim, `소문을 퍼뜨린 사람이 ${josa(h.name, '이/가')}라는 것을 알아냈다`); M.adj(sim, o, h, { grudge: 40 }); mark(h, '명예훼손'); C.report(sim, h, '명예훼손', o.name); }
      X.honorCheck(sim, o, h);
      return;
    }
  };

  // ================= 재판을 돕는 것들 (C.trial에서 부른다) =================
  // 정당방위와 증거 부족으로 죄를 묻지 못하는 경우를 거른다
  X.screen = (sim, t, c, open, judge) => {
    const stand = [];
    for (const x of open) {
      if (x.selfDefense) continue;
      if (WORD_CASE.has(x.type) && !x.evidence) {
        // 증거가 없으면 '말 대 말': 판결은 족장의 성품과 두 사람의 평판에 달렸다
        const chief = t.chief;
        let pAcquit = 0.35;
        if (chief && chief !== c) {
          if (chief.has('정직한')) pAcquit -= 0.15;
          if ((S.peek(chief, c)?.v || 0) >= 40) pAcquit += 0.25;
          if (chief.gender === c.gender && chief.p.agree < 35) pAcquit += 0.1;
        }
        pAcquit += ((c.notoriety || 0) < 15 ? 0.1 : -0.1) + (c.job === J.CHIEF || c.job === J.GUARD ? 0.15 : 0);
        if (chance(clamp(pAcquit, 0.05, 0.85))) {
          x.acquitted = true;
          c.log(sim, `${x.type} 혐의를 받았지만 증거가 없어 벌을 받지 않았다`);
          const v = byName(sim, x.victim);
          if (v) { S.addMood(sim, v, 'unjust'); M.adj(sim, v, c, { grudge: 20 }); v.log(sim, `증거가 없다며 ${josa(c.name, '이/가')} 풀려나 억울했다`); if (chief && chief !== c) M.adj(sim, v, chief, { trust: -30 }); }
          t.log(sim, `${josa(judge, '이/가')} 증거가 없다며 ${c.name}의 ${x.type} 혐의를 묻지 않았습니다`, false);
          continue;
        }
      }
      stand.push(x);
    }
    return stand;
  };
  // 위증: 친구가 거짓 증언으로 감싸 준다
  X.perjury = (sim, t, c) => {
    let f = null;
    for (const [id, r] of c.rel) { if (r.v < 70) continue; const o = sim.byId.get(id); if (o && o.alive && o.adult && !o.has('정직한') && !o.jail && o.tribe === t) { f = o; break; } }
    if (!f || !chance(0.08)) return 1;
    f.log(sim, `재판에서 ${josa(c.name, '을/를')} 감싸려고 거짓 증언을 했다`);
    const rec = C.record(sim, f, '위증', c.name, false);
    if (chance(0.3)) { rec.known = true; C.report(sim, f, '위증', c.name); t.log(sim, `${josa(f.name, '이/가')} 재판에서 거짓 증언을 한 것이 드러났습니다`, false); return 1; }
    return 0.6;
  };
  // 배상금: 벌금의 일부를 피해자나 그 가족에게 준다
  X.compensate = (sim, crimes, amt) => {
    if (amt <= 0) return 0;
    for (const x of crimes) {
      let v = byName(sim, x.victim);
      if (!v) {
        const rec = sim.archive.slice().reverse().find((r) => r.name === x.victim);
        if (rec) for (const id of [...(rec.children || []), ...(rec.parents || []).map((p) => p.id)]) { const o = sim.byId.get(id); if (o && o.alive) { v = o; break; } }
      }
      if (v) { v.gold += amt; v.log(sim, `배상금 금화 ${amt}개를 받았다`); return amt; }
    }
    return 0;
  };
  X.execute = (sim, t, c) => {
    c.log(sim, '사형을 선고받았다');
    sim.stats.executions = (sim.stats.executions || 0) + 1;
    sim.kill(c, '사형');
  };
  X.sentenceLabor = (sim, t, c, years) => {
    c.labor = { tid: t.id, until: sim.year + years };
    if (c.tribe !== t) t.add(sim, c); // 다른 부족 사람은 이 마을에서 노역한다
    S.addMood(sim, c, 'labor');
  };
  X.brand = (sim, c) => {
    c.branded = true; c.brandedAt = sim.year;
    S.addMood(sim, c, 'branded');
    c.log(sim, '얼굴에 죄인의 낙인이 찍혔다');
  };
  X.laborTick = (sim, h) => {
    if (!h.labor) return;
    if (sim.year >= h.labor.until || !h.tribe || h.tribe.id !== h.labor.tid) { h.labor = null; h.log(sim, '강제노역을 마쳤다'); return; }
    S.addMood(sim, h, 'labor');
    if (![J.GATHER, J.WOOD, J.MINE].includes(h.job)) h.job = pick([J.GATHER, J.WOOD, J.MINE]);
  };

  // 미제 사건의 공소시효 (C.investigate에서 부른다)
  X.expire = (sim, cs) => {
    const t = cs.tid ? sim.tribeById(cs.tid) : null;
    const k = sim.byId.get(cs.killer);
    if (k && k.alive) {
      for (const c of k.crimes) if (c.victim === cs.victim && !c.known) c.expired = true;
      if (t) t.log(sim, `${cs.victim} 사건이 끝내 풀리지 않은 채 잊혔습니다`, false);
    }
  };

  // ================= 신의 재판 권능 =================
  X.judgment = (sim, h) => {
    const cost = G.POWERS.judgment.cost;
    if (sim.faith < cost) return { ok: false, msg: `신앙이 부족합니다 (필요 ${cost})` };
    sim.faith -= cost;
    sim.effects.push({ kind: 'beam', x: h.x, y: h.y, age: 0, ttl: 70 });
    const see = (fn) => sim.near(h.x, h.y, 10, (o) => { if (o !== h) { o.faith = Math.min(100, o.faith + 10); o.miracles++; fn && fn(o); } });
    // 누명을 쓴 사람: 신탁으로 누명을 벗긴다
    const fake = h.crimes.find((c) => c.fake && !c.revealed);
    if (fake) {
      fake.revealed = true; fake.known = false; h.wanted = false;
      if (h.jail) C.release(sim, h, '신탁으로 누명이 벗겨져');
      S.addMood(sim, h, 'cleared');
      h.log(sim, '신의 신탁이 내려 누명이 벗겨졌다');
      const acc = sim.byId.get(fake.accuser);
      if (acc && acc.alive) { mark(acc, '무고'); C.report(sim, acc, '무고', h.name); }
      see();
      sim.event(`신의 신탁이 내려 ${h.name}의 누명이 벗겨졌습니다`, '#f5d76e', h.x, h.y);
      return { ok: true, msg: `${h.name}의 누명을 벗겼습니다` };
    }
    // 숨긴 죄가 있는 사람: 하늘의 번개가 내리친다
    const hidden = h.crimes.filter((c) => !c.known && !c.fake && !c.expired && C.SEV[c.type] > 0);
    if (hidden.length || h.cult) {
      const worst = hidden.reduce((m, c) => Math.max(m, C.SEV[c.type] || 1), h.cult ? 3 : 0);
      for (const c of hidden) c.known = true;
      sim.effects.push({ kind: 'bolt', x: h.x, y: h.y, age: 0, ttl: 22, seed: Math.random() });
      see((o) => { S.addMood(sim, o, 'fear'); M.adj(sim, o, h, { trust: -50, fear: 20 }); });
      h.log(sim, '하늘에서 내리친 번개가 숨겨 온 죄를 드러냈다');
      if (h.cult) X.exposeCult(sim, h, '신의 번개에');
      for (let i = sim.unsolved.length - 1; i >= 0; i--) {
        const cs = sim.unsolved[i];
        if (cs.killer === h.id) { sim.unsolved.splice(i, 1); X.onSolved(sim, cs, h); }
      }
      sim.event(`신의 번개가 ${h.name}의 숨은 죄(${[...new Set(hidden.map((c) => c.type))].join(', ') || '거짓 예언'})를 드러냈습니다`, '#fff3a0', h.x, h.y);
      if (worst >= 5) { h.health -= 70; if (h.health <= 0) { sim.kill(h, '신벌'); return { ok: true, msg: `${h.name}에게 신벌을 내렸습니다` }; } }
      else h.health -= 25;
      if (hidden.length) C.report(sim, h, hidden[hidden.length - 1].type, hidden[hidden.length - 1].victim);
      return { ok: true, msg: `${h.name}의 숨은 죄를 드러냈습니다` };
    }
    // 죄 없는 사람
    h.faith = Math.min(100, h.faith + 15); S.addMood(sim, h, 'blessed');
    see();
    h.log(sim, '신이 내려다보시고 죄가 없음을 밝혀 주었다');
    return { ok: true, msg: `${josa(h.name, '은/는')} 숨긴 죄가 없습니다` };
  };

  // 신의 권능이 내려졌을 때 (sim.power 뒤에 부른다): 제물을 막고, 거짓 예언자를 드러낸다
  X.onPower = (sim, kind, x, y) => {
    if (kind === 'rain' || kind === 'bless' || kind === 'heal') {
      for (const t of sim.tribes) {
        if (!t.alive || !t.sacrifice || G.dist(t.cx, t.cy, x, y) > 12) continue;
        const v = sim.byId.get(t.sacrifice.victim), pr = sim.byId.get(t.sacrifice.priest);
        t.sacrifice = null; t.lastSacrifice = sim.year;
        if (kind === 'rain') sim.drought = 0;
        if (v && v.alive) { S.addMood(sim, v, 'spared'); v.log(sim, '신이 비를 내려 제물이 되지 않고 살아남았다'); v.faith = 100; }
        if (pr && pr.alive) pr.log(sim, '신이 제물을 원치 않는다는 뜻을 깨달았다');
        if (chance(0.5)) { t.law.zealot = false; t.log(sim, `${josa(t.name, '이/가')} 제물을 바치는 풍습을 버렸습니다`); }
        sim.event(`신의 기적에 ${josa(t.name, '이/가')} 제물을 바치려던 손을 멈췄습니다`, '#f5d76e', t.cx, t.cy);
      }
    }
    if (kind === 'heal') sim.near(x, y, 5, (h) => { if (h.wg) h.wg = Math.max(0, h.wg - 50); if (h.std) h.std = null; });
    if (kind === 'lightning' || kind === 'meteor') X.disaster(sim, x, y, kind === 'meteor' ? '운석' : '번개');
    // 진짜 기적을 본 거짓 예언자는 정체가 드러난다
    sim.near(x, y, 10, (h) => { if (h.cult && chance(0.7)) X.exposeCult(sim, h, '진짜 신의 기적 앞에'); });
  };

  // ================= 60틱마다 (C.tick에서 어른에게 부른다) =================
  X.tick = (sim, h) => {
    X.laborTick(sim, h);
    X.slaveTick(sim, h);
    X.cycleTick(sim, h);
    X.stdTick(sim, h);
    if (!h.alive || h.jail || h.held || h.state === 'sleep') return;
    if (h.darkChecked === undefined) { h.darkChecked = true; h.dark = h.has('냉정한') && h.p.agree < 20 && chance(0.05); }
    const u = C.urge(h) * X2.urgeMult(sim, h);
    X.worldTick(sim, h, u);
    if (!h.alive) return;
    X.contractTick(sim, h);
    X.serialTick(sim, h, u);
    X.feudTick(sim, h, u);
    X.bigamyExpose(sim, h);
    X.drunkTick(sim, h, u);
    X.carelessTick(sim, h);
    X.parentTick(sim, h, u);
    if (!h.alive || h.jail || h.held) return;
    if (h.has('정직한') && chance(0.9)) return;
    const f = pick([X.hireTick, X.inheritTick, X.counterfeitTick, X.marriageFraudTick, X.bigamyTick, X.jiltTick, X.accompliceTick,
      X.spyTick, X.cultTick, X.blasphemyTick, X.sexTick, X.sexTick, X.rumorTick]);
    f(sim, h, u);
    if (h.cult && f !== X.cultTick) X.cultTick(sim, h, u);
  };
})();
