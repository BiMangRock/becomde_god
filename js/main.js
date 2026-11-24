// 게임 시작, 입력 처리, 반복 루프
(function () {
  const G = globalThis.G;
  const $ = (id) => document.getElementById(id);
  const BRUSH = { inspect: 0, create: 0.6, rain: 7, bless: 5, lightning: 1.2, meteor: 4, cupid: 0, judgment: 0, carry: 0, revelation: 0, quake: 8, plague: 6, beasts: 2, heal: 5, fertility: 5, discord: 5, raise: 2.6, lower: 2.6 };

  const app = {
    sim: null, renderer: null, ui: null,
    tool: 'inspect', speed: 1, selected: null, follow: false,
    select(sel) {
      this.selected = sel;
      this.renderer.selected = sel;
      if (!sel || sel.type !== 'human') this.follow = false;
      this.ui.render(true);
    },
    focus(x, y) {
      if (x === undefined || isNaN(x)) return;
      this.renderer.cam.x = x; this.renderer.cam.y = y;
      if (this.renderer.cam.s < 14) this.renderer.cam.s = 18;
    },
    toast(msg) {
      const el = $('toast');
      el.textContent = msg; el.classList.add('show');
      clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('show'), 1600);
    },
  };

  function newWorld(opts = {}) {
    const seed = opts.seed ? hashSeed(opts.seed) : undefined;
    app.sim = new G.Sim(seed, opts);
    if (app.renderer) { app.renderer.setSim(app.sim); app.renderer.cam = { x: app.sim.start.x, y: app.sim.start.y, s: 14 }; }
    app.selected = null; app.follow = false;
    if (app.renderer) app.renderer.selected = null;
    if (app.ui) { app.ui.view = 'overview'; app.ui.lastLogKey = ''; app.ui.render(true); }
  }

  function hashSeed(str) {
    if (/^\d+$/.test(str)) return +str;
    let h = 2166136261;
    for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }

  // ---------- 시작 설정 ----------
  const SIZES = { small: [120, 90], normal: [160, 120], large: [240, 180], huge: [320, 240] };
  function openSetup(first) {
    const el = $('setup');
    el.hidden = false;
    $('setup-cancel').hidden = !!first;
    app.paused = true;
  }
  function bindSetup() {
    const el = $('setup');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-opt]');
      if (!b) return;
      for (const x of el.querySelectorAll(`[data-opt="${b.dataset.opt}"]`)) x.classList.toggle('on', x === b);
    });
    const val = (opt) => el.querySelector(`[data-opt="${opt}"].on`).dataset.v;
    $('setup-go').addEventListener('click', () => {
      const [W, H] = SIZES[val('size')];
      newWorld({ W, H, pop: +val('pop'), animals: +val('animals'), time: val('time'), seed: $('setup-seed').value.trim() || undefined });
      syncTimeUI();
      el.hidden = true; app.paused = false;
      app.toast(`${W}×${H} 크기의 새 세상이 열렸습니다`);
    });
    $('setup-cancel').addEventListener('click', () => { el.hidden = true; app.paused = false; });
  }

  // ---------- 시간 흐름 ----------
  function syncTimeUI() {
    const k = app.sim.timeMode;
    $('time-mode').value = k;
    const M = G.TIME_MODES[k];
    const b100 = document.querySelector('#speed [data-speed="100"]');
    b100.hidden = !M.speeds.includes(100);
    if (app.speed === 100 && b100.hidden) setSpeed(30);
  }
  function bindTime() {
    $('time-mode').addEventListener('change', (e) => {
      app.sim.setTimeMode(e.target.value);
      syncTimeUI();
      app.toast(`시간 흐름: ${G.TIME_MODES[e.target.value].name} (${G.TIME_MODES[e.target.value].desc})`);
    });
    // 건너뛰기: 잠시 가장 빠른 흐름으로 돌려 계산만 한다
    const skip = (until, label) => {
      const sim = app.sim, keep = sim.timeMode;
      sim.setTimeMode('vfast');
      let n = 0;
      while (!until(sim) && n++ < 3000) sim.step();
      sim.setTimeMode(keep);
      app.toast(label);
    };
    $('skip-morning').addEventListener('click', () => {
      const d0 = app.sim.day;
      skip((s) => (s.day > d0 || s.hour < 5) && s.hour >= 5 && s.hour < 8, "아침이 밝았습니다");
    });
    $('skip-season').addEventListener('click', () => {
      const s0 = app.sim.season;
      skip((s) => s.season !== s0, `${G.SEASONS[(s0 + 1) % 4]}이 되었습니다`);
    });
  }

  // ---------- 미니맵 ----------
  function drawMinimap() {
    const mm = $('minimap'), sim = app.sim, R = app.renderer;
    const ctx = mm.getContext('2d');
    const W = sim.world.w, H = sim.world.h;
    const mw = mm.width, mh = Math.round(mw * H / W);
    if (mm.height !== mh) mm.height = mh;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(R.terrain, 0, 0, mw, mh);
    const k = mw / W;
    for (const i of sim.fires) { ctx.fillStyle = '#ff6a1a'; ctx.fillRect((i % W) * k, ((i / W) | 0) * k, Math.max(1.5, k), Math.max(1.5, k)); }
    for (const t of sim.tribes) {
      if (!t.alive) continue;
      ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(t.cx * k, t.cy * k, 2.5 + Math.sqrt(t.members.length) * 0.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    for (const a of sim.animals) if (a.alive && G.Wild.isBeast(a)) { ctx.fillStyle = '#ff4040'; ctx.fillRect(a.x * k - 1, a.y * k - 1, 2, 2); }
    const [x0, y0] = R.toWorld(0, 0), [x1, y1] = R.toWorld(R.vw, R.vh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    ctx.strokeRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
  }
  function bindMinimap() {
    const mm = $('minimap');
    let down = false;
    const go = (e) => {
      const r = mm.getBoundingClientRect();
      const W = app.sim.world.w, H = app.sim.world.h;
      app.renderer.cam.x = (e.clientX - r.left) / r.width * W;
      app.renderer.cam.y = (e.clientY - r.top) / r.height * H;
      app.follow = false;
    };
    mm.addEventListener('pointerdown', (e) => { down = true; mm.setPointerCapture(e.pointerId); go(e); });
    mm.addEventListener('pointermove', (e) => { if (down) go(e); });
    mm.addEventListener('pointerup', () => { down = false; });
  }

  // ---------- 도구 ----------
  function buildTools() {
    const nav = $('tools');
    nav.innerHTML = Object.entries(G.POWERS).map(([k, p]) =>
      `<button data-tool="${k}" title="${p.desc}"><span class="ic">${p.icon}</span><span>${p.name}</span><span class="cost">${p.cost || ''}</span></button>`).join('');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool]');
      if (b) setTool(b.dataset.tool);
    });
    setTool('inspect');
  }
  function setTool(t) {
    app.tool = t;
    app.renderer.cupidFirst = null;
    if (t === 'cupid') app.toast('사랑에 빠뜨릴 첫 번째 사람을 누르세요');
    if (t === 'judgment') app.toast('심판할 사람을 누르세요');
    app.renderer.carrying = null;
    if (t === 'carry') app.toast('옮길 사람을 누르세요');
    if (t === 'revelation') app.toast('계시를 내릴 사람을 누르세요');
    for (const b of document.querySelectorAll('#tools button')) b.classList.toggle('on', b.dataset.tool === t);
    app.renderer.brush = { ...(app.renderer.brush || { x: 0, y: 0 }), r: BRUSH[t] };
    $('world').style.cursor = t === 'inspect' ? 'grab' : 'crosshair';
  }
  function refreshTools() {
    for (const b of document.querySelectorAll('#tools button')) {
      const p = G.POWERS[b.dataset.tool];
      b.classList.toggle('poor', p.cost > app.sim.faith);
    }
  }

  // 사랑의 화살: 두 사람을 차례로 고른다
  function cupidClick(wx, wy) {
    const R = app.renderer;
    const h = app.sim.humanAt(wx, wy, Math.max(0.8, 12 / R.cam.s));
    if (!h) return app.toast('사람을 정확히 눌러 주세요 (확대하면 쉬워요)');
    if (!R.cupidFirst || !R.cupidFirst.alive) {
      if (!h.adult) return app.toast('어른만 고를 수 있습니다');
      R.cupidFirst = h;
      const p = (h.partner && h.partner.alive && h.partner) || (h.lover && h.lover.alive && h.lover);
      app.toast(`${h.name} 선택됨${p ? ` (이미 ${G.josa(p.name, "과/와")} 짝이 있어요)` : ''} · 이제 상대를 누르세요`);
      return;
    }
    const a = R.cupidFirst;
    R.cupidFirst = null;
    const r = G.Social.cupid(app.sim, a, h);
    if (!r.ok) app.toast(r.msg);
    else { app.toast(`${a.name} ♥ ${h.name}`); app.select({ type: 'human', h: a }); }
  }

  // 신의 재판: 한 사람을 고른다
  function judgmentClick(wx, wy) {
    const R = app.renderer;
    const h = app.sim.humanAt(wx, wy, Math.max(0.8, 12 / R.cam.s));
    if (!h) return app.toast('사람을 정확히 눌러 주세요 (확대하면 쉬워요)');
    const r = G.Crime3.judgment(app.sim, h);
    if (r.msg) app.toast(r.msg);
    if (r.ok && h.alive) app.select({ type: 'human', h });
  }

  // 사람 옮기기: 한 번 눌러 집고, 다시 눌러 내려놓는다
  function carryClick(wx, wy) {
    const R = app.renderer;
    if (!R.carrying || !R.carrying.alive) {
      const h = app.sim.humanAt(wx, wy, Math.max(0.8, 12 / R.cam.s));
      if (!h) return app.toast('사람을 정확히 눌러 주세요 (확대하면 쉬워요)');
      R.carrying = h;
      return app.toast(`${h.name}을(를) 집었습니다 · 내려놓을 곳을 누르세요`);
    }
    const h = R.carrying;
    R.carrying = null;
    const r = G.Migrate.carry(app.sim, h, wx, wy);
    if (r.msg) app.toast(r.msg);
    if (r.ok) app.select({ type: 'human', h });
  }
  function revelationClick(wx, wy) {
    const R = app.renderer;
    const h = app.sim.humanAt(wx, wy, Math.max(0.8, 12 / R.cam.s));
    if (!h) return app.toast('사람을 정확히 눌러 주세요 (확대하면 쉬워요)');
    const r = G.Migrate.revelation(app.sim, h);
    if (r.msg) app.toast(r.msg);
    if (r.ok) app.select({ type: 'human', h });
  }

  function usePower(wx, wy) {
    const r = app.sim.power(app.tool, wx, wy);
    if (!r.ok && r.msg) app.toast(r.msg);
    return r.ok;
  }

  function inspectAt(wx, wy) {
    const s = app.renderer.cam.s;
    const h = app.sim.humanAt(wx, wy, Math.max(0.7, 10 / s));
    if (h) return app.select({ type: 'human', h });
    const t = app.sim.tribeAt(wx, wy, 2.5);
    if (t) return app.select({ type: 'tribe', t });
    const w = app.sim.world, tx = Math.floor(wx), ty = Math.floor(wy);
    if (w.inb(tx, ty)) app.select({ type: 'tile', x: tx, y: ty });
  }

  // ---------- 입력 ----------
  function bindInput() {
    const cv = $('world'), R = app.renderer;
    const ptrs = new Map();
    let drag = null, pinch = null, holdPower = false;

    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      R.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        drag = null; holdPower = false;
        return;
      }
      const pan = app.tool === 'inspect' || e.button === 1 || e.button === 2;
      drag = { sx: e.offsetX, sy: e.offsetY, cx: R.cam.x, cy: R.cam.y, moved: false, pan };
      if (!pan) {
        const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
        const cont = app.tool === 'raise' || app.tool === 'lower';
        if (cont) holdPower = true;
        else if (app.tool === 'cupid') cupidClick(wx, wy);
        else if (app.tool === 'judgment') judgmentClick(wx, wy);
        else if (app.tool === 'carry') carryClick(wx, wy);
        else if (app.tool === 'revelation') revelationClick(wx, wy);
        else usePower(wx, wy);
      }
      if (pan) cv.style.cursor = 'grabbing';
    });

    cv.addEventListener('pointermove', (e) => {
      const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
      R.brush = { x: wx, y: wy, r: BRUSH[app.tool] };
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        R.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d);
        pinch.d = d;
        return;
      }
      if (!drag) return;
      const dx = e.offsetX - drag.sx, dy = e.offsetY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.pan && drag.moved) {
        R.cam.x = drag.cx - dx / R.cam.s; R.cam.y = drag.cy - dy / R.cam.s;
        R.clampCam();
        app.follow = false;
      }
    });

    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && !drag.moved && app.tool === 'inspect' && e.button === 0) {
        const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
        inspectAt(wx, wy);
      }
      drag = null; holdPower = false;
      cv.style.cursor = app.tool === 'inspect' ? 'grab' : 'crosshair';
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { R.brush = { ...R.brush, r: 0 }; });

    app.isHoldingPower = () => holdPower;

    // 키보드
    const keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      keys.add(e.key.toLowerCase());
      if (e.key === ' ') { e.preventDefault(); setSpeed(app.speed ? 0 : app.lastSpeed || 1); }
      if (e.key === '1') setSpeed(1);
      if (e.key === '2') setSpeed(3);
      if (e.key === '3') setSpeed(10);
      if (e.key === '4') setSpeed(30);
      if (e.key === '+' || e.key === '=') R.zoomAt(R.vw / 2, R.vh / 2, 1.25);
      if (e.key === '-') R.zoomAt(R.vw / 2, R.vh / 2, 0.8);
      if (e.key === 'Escape') { setTool('inspect'); app.select(null); }
    });
    window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    app.keys = keys;

    $('speed').addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]');
      if (b) setSpeed(+b.dataset.speed);
    });
    $('zoom').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]');
      if (b) R.zoomAt(R.vw / 2, R.vh / 2, +b.dataset.z);
    });
    $('btn-new').addEventListener('click', () => openSetup(false));
    $('log-wrap').querySelector('h3').addEventListener('click', () => $('side').classList.toggle('collapsed'));
    window.addEventListener('resize', () => R.resize());
  }

  function setSpeed(s) {
    if (s) app.lastSpeed = s;
    app.speed = s;
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('on', +b.dataset.speed === s);
  }

  // ---------- 반복 ----------
  let last = performance.now(), acc = 0, frame = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const R = app.renderer;
    if (app.speed && !app.paused) {
      acc += dt * 60 * app.speed;
      let n = 0;
      const cap = app.speed >= 30 ? 110 : 40;
      while (acc >= 1 && n < cap) { app.sim.step(); acc -= 1; n++; }
      if (n >= cap) acc = 0;
    }
    // 땅 올리기/내리기는 누르고 있는 동안 계속
    if (app.isHoldingPower() && frame % 3 === 0 && R.brush) usePower(R.brush.x, R.brush.y);
    // 키보드 이동
    const k = app.keys, sp = 12 / R.cam.s;
    if (k.has('w') || k.has('arrowup')) R.cam.y -= sp;
    if (k.has('s') || k.has('arrowdown')) R.cam.y += sp;
    if (k.has('a') || k.has('arrowleft')) R.cam.x -= sp;
    if (k.has('d') || k.has('arrowright')) R.cam.x += sp;
    // 따라가기
    if (app.follow && app.selected && app.selected.type === 'human' && app.selected.h.alive) {
      const h = app.selected.h;
      R.cam.x += (h.x - R.cam.x) * 0.12; R.cam.y += (h.y - R.cam.y) * 0.12;
    }
    R.draw();
    if (frame % 6 === 0) drawMinimap();
    frame++;
    if (frame % 15 === 0) {
      const sim = app.sim;
      $('s-faith').textContent = Math.floor(sim.faith).toLocaleString();
      $('s-rate').textContent = `+${(sim.faithRate * 60).toFixed(1)}/초`;
      $('s-pop').textContent = sim.humans.length;
      $('s-tribes').textContent = sim.tribes.filter((t) => t.alive).length;
      $('s-year').textContent = `${Math.floor(sim.year)}년`;
      const hr = Math.floor(sim.hour);
      const tod = hr < 5 ? '밤' : hr < 9 ? '아침' : hr < 17 ? '낮' : hr < 21 ? '저녁' : '밤';
      $('s-date').textContent = sim.timeMode === 'vfast' ? G.SEASONS[sim.season] : `${G.SEASONS[sim.season]} ${sim.dayOfYear % 10 + 1}일 · ${tod} ${hr}시`;
      $('s-drought').hidden = !sim.drought;
      refreshTools();
      app.ui.render();
      app.ui.renderLog();
    }
    requestAnimationFrame(loop);
  }

  // ---------- 시작 ----------
  newWorld();
  app.renderer = new G.Renderer($('world'), app.sim);
  app.renderer.resize();
  app.ui = new G.UI(app);
  buildTools();
  bindInput();
  app.ui.render(true);
  bindSetup();
  bindMinimap();
  bindTime();
  openSetup(true);
  window.app = app; // 디버깅용
  requestAnimationFrame(loop);
})();
