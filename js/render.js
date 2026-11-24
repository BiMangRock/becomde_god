// 캔버스 그리기. 확대할수록 더 자세히 그린다.
(function () {
  const G = globalThis.G;
  const T = G.T;
  const J = G.JOB;

  const EMOTE_COLORS = { '♥': '#ff6b9a', '!': '#ff5050', '#': '#ff7b3d', '♪': '#ffe27a', '…': '#9fc3ff', '✦': '#ffe27a', '✚': '#7fe0a8', '➶': '#e0b070', '?': '#c9a0ff', '⚒': '#c8c8c8', '~': '#8fd0ff' };

  class Renderer {
    constructor(canvas, sim) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.setSim(sim);
      this.cam = { x: sim.start.x, y: sim.start.y, s: 14 };
      this.selected = null; // {type:'human'|'tribe'|'tile', ...}
      this.hover = null;
      this.frame = 0;
    }

    setSim(sim) {
      this.sim = sim;
      const w = sim.world;
      this.terrain = document.createElement('canvas');
      this.terrain.width = w.w; this.terrain.height = w.h;
      this.tctx = this.terrain.getContext('2d');
      this.img = this.tctx.createImageData(w.w, w.h);
      w.dirty = true;
      this.lastPaint = -999;
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.dpr = dpr;
      this.cv.width = Math.floor(this.cv.clientWidth * dpr);
      this.cv.height = Math.floor(this.cv.clientHeight * dpr);
    }

    get vw() { return this.cv.width / this.dpr; }
    get vh() { return this.cv.height / this.dpr; }
    toScreen(x, y) { const c = this.cam; return [(x - c.x) * c.s + this.vw / 2, (y - c.y) * c.s + this.vh / 2]; }
    toWorld(sx, sy) { const c = this.cam; return [(sx - this.vw / 2) / c.s + c.x, (sy - this.vh / 2) / c.s + c.y]; }

    zoomAt(sx, sy, factor) {
      const [wx, wy] = this.toWorld(sx, sy);
      this.cam.s = G.clamp(this.cam.s * factor, 3, 90);
      const [nx, ny] = this.toWorld(sx, sy);
      this.cam.x += wx - nx; this.cam.y += wy - ny;
      this.clampCam();
    }
    clampCam() {
      const w = this.sim.world;
      this.cam.x = G.clamp(this.cam.x, 0, w.w); this.cam.y = G.clamp(this.cam.y, 0, w.h);
    }

    draw() {
      const ctx = this.ctx, sim = this.sim, w = sim.world, s = this.cam.s;
      this.frame++;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#10243f';
      ctx.fillRect(0, 0, this.vw, this.vh);

      // 지형 (1초마다 다시 칠하기)
      if (w.dirty || sim.tick - this.lastPaint > 60) {
        w.paint(this.img.data);
        this.tctx.putImageData(this.img, 0, 0);
        w.dirty = false; this.lastPaint = sim.tick;
      }
      ctx.imageSmoothingEnabled = false;
      const [ox, oy] = this.toScreen(0, 0);
      ctx.drawImage(this.terrain, ox, oy, w.w * s, w.h * s);

      // 보이는 칸 범위
      const [wx0, wy0] = this.toWorld(0, 0), [wx1, wy1] = this.toWorld(this.vw, this.vh);
      const x0 = Math.max(0, Math.floor(wx0) - 1), y0 = Math.max(0, Math.floor(wy0) - 1);
      const x1 = Math.min(w.w - 1, Math.ceil(wx1) + 1), y1 = Math.min(w.h - 1, Math.ceil(wy1) + 1);
      this.view = { x0, y0, x1, y1 };

      if (s >= 12) this.drawDetails(x0, y0, x1, y1);
      if (sim.drought) { ctx.fillStyle = 'rgba(220,150,60,0.10)'; ctx.fillRect(0, 0, this.vw, this.vh); }

      this.drawTribes();
      this.drawAnimals();
      this.drawHumans();
      this.drawEffects();
      this.drawTribeLabels();
      this.drawBrush();
    }

    // 나무, 바위, 열매
    drawDetails(x0, y0, x1, y1) {
      const ctx = this.ctx, w = this.sim.world, s = this.cam.s;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * w.w + x, t = w.type[i];
          const [sx, sy] = this.toScreen(x, y);
          const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          if (t === T.FOREST && w.wood[i] >= 1) {
            const n = w.wood[i] > 6 ? 2 : 1;
            for (let k = 0; k < n; k++) {
              const ox = ((hsh >> (k * 4)) & 15) / 15 * 0.5 + 0.25, oy = ((hsh >> (k * 4 + 8)) & 15) / 15 * 0.4 + 0.45;
              const tx = sx + ox * s, ty = sy + oy * s, th = s * (0.45 + Math.min(w.wood[i], 12) / 40);
              ctx.fillStyle = '#5a3a1e';
              ctx.fillRect(tx - s * 0.04, ty - th * 0.15, s * 0.08, th * 0.3);
              ctx.fillStyle = k ? '#2f6b2a' : '#26592a';
              ctx.beginPath();
              ctx.moveTo(tx, ty - th); ctx.lineTo(tx + th * 0.38, ty - th * 0.1); ctx.lineTo(tx - th * 0.38, ty - th * 0.1);
              ctx.fill();
            }
          } else if ((t === T.MOUNTAIN || t === T.HILL) && (hsh & 3) === 0) {
            const tx = sx + s * 0.5, ty = sy + s * 0.8, hh = s * (t === T.MOUNTAIN ? 0.7 : 0.4);
            ctx.fillStyle = t === T.MOUNTAIN ? '#8d8880' : '#9d9a72';
            ctx.beginPath(); ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + hh * 0.7, ty); ctx.lineTo(tx - hh * 0.7, ty); ctx.fill();
            if (t === T.MOUNTAIN) { ctx.fillStyle = '#eef'; ctx.beginPath(); ctx.moveTo(tx, ty - hh); ctx.lineTo(tx + hh * 0.2, ty - hh * 0.7); ctx.lineTo(tx - hh * 0.2, ty - hh * 0.7); ctx.fill(); }
          }
          if (w.ore[i] >= 6 && s >= 20 && (hsh & 1)) {
            ctx.fillStyle = '#ffd86b';
            ctx.fillRect(sx + s * 0.3, sy + s * 0.55, s * 0.08, s * 0.08);
            ctx.fillRect(sx + s * 0.6, sy + s * 0.35, s * 0.06, s * 0.06);
          }
          if (t === T.GRASS && w.farm[i]) {
            ctx.strokeStyle = 'rgba(80,55,30,0.55)'; ctx.lineWidth = Math.max(1, s * 0.05);
            ctx.beginPath();
            for (let k = 1; k <= 3; k++) { ctx.moveTo(sx + s * 0.1, sy + s * k / 4); ctx.lineTo(sx + s * 0.9, sy + s * k / 4); }
            ctx.stroke();
            if (s >= 16 && w.food[i] >= 2) {
              ctx.fillStyle = w.food[i] > 6 ? '#d9c34a' : '#5aa83a';
              for (let k = 1; k <= 3; k++) for (let m = 0; m < 4; m++) ctx.fillRect(sx + s * (0.15 + m * 0.22), sy + s * k / 4 - s * 0.1, s * 0.05, s * 0.1);
            }
            continue;
          }
          if (t === T.GRASS && w.food[i] >= 4.5 && s >= 22 && (hsh & 7) === 1) {
            ctx.fillStyle = '#3d7a2c';
            ctx.beginPath(); ctx.arc(sx + s * 0.5, sy + s * 0.6, s * 0.14, 0, 7); ctx.fill();
            ctx.fillStyle = '#d33';
            ctx.fillRect(sx + s * 0.45, sy + s * 0.55, s * 0.05, s * 0.05);
            ctx.fillRect(sx + s * 0.55, sy + s * 0.62, s * 0.05, s * 0.05);
          }
        }
      }
    }

    drawTribes() {
      const ctx = this.ctx, s = this.cam.s, sim = this.sim;
      for (const t of sim.tribes) {
        if (!t.alive) continue;
        const [cx, cy] = this.toScreen(t.cx, t.cy);
        const R = (5 + Math.sqrt(t.members.length) * 1.4) * s;
        if (cx + R < 0 || cy + R < 0 || cx - R > this.vw || cy - R > this.vh) continue;
        // 영역
        ctx.strokeStyle = t.color; ctx.globalAlpha = t.wars.size ? 0.8 : 0.45;
        ctx.lineWidth = t.wars.size ? 2 : 1.2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.07; ctx.fillStyle = t.color; ctx.fill();
        ctx.globalAlpha = 1;
        // 집
        for (const h of t.houses) {
          const [hx, hy] = this.toScreen(h.x, h.y);
          this.drawHouse(hx, hy, s, t.color);
        }
        // 감옥
        if (t.jail) {
          const [jx, jy] = this.toScreen(t.jail.x, t.jail.y);
          this.drawJail(jx, jy, s);
        }
        // 신전 / 모닥불
        if (t.temple) this.drawTemple(cx, cy - s * 0.2, s, t.color);
        else this.drawFire(cx, cy, s);
        if (this.selected && this.selected.type === 'tribe' && this.selected.t === t) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    drawHouse(x, y, s, color) {
      const ctx = this.ctx;
      if (s < 5) { ctx.fillStyle = color; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); return; }
      const w = s * 0.7, h = s * 0.45;
      ctx.fillStyle = '#c9a77a';
      ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x - w * 0.62, y - h); ctx.lineTo(x, y - h - s * 0.4); ctx.lineTo(x + w * 0.62, y - h); ctx.fill();
      if (s >= 14) {
        ctx.fillStyle = '#5b3b22';
        ctx.fillRect(x - w * 0.12, y - h * 0.6, w * 0.24, h * 0.6);
      }
    }

    drawTemple(x, y, s, color) {
      const ctx = this.ctx;
      const u = Math.max(s, 5);
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(x - u * 0.9, y - u * 0.2, u * 1.8, u * 0.3);
      ctx.fillRect(x - u * 0.65, y - u * 0.5, u * 1.3, u * 0.3);
      ctx.fillRect(x - u * 0.4, y - u * 0.8, u * 0.8, u * 0.3);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x - u * 0.45, y - u * 0.8); ctx.lineTo(x, y - u * 1.2); ctx.lineTo(x + u * 0.45, y - u * 0.8); ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(x, y - u * 1.3, u * 0.1, 0, 7); ctx.fill();
    }

    drawFire(x, y, s) {
      const ctx = this.ctx;
      if (s < 6) { ctx.fillStyle = '#ff9a3c'; ctx.fillRect(x - 2, y - 2, 4, 4); return; }
      const f = Math.sin(this.frame * 0.3) * 0.08;
      ctx.strokeStyle = '#5b3b22'; ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.beginPath(); ctx.moveTo(x - s * 0.25, y + s * 0.1); ctx.lineTo(x + s * 0.25, y - s * 0.05);
      ctx.moveTo(x + s * 0.25, y + s * 0.1); ctx.lineTo(x - s * 0.25, y - s * 0.05); ctx.stroke();
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath(); ctx.moveTo(x - s * 0.18, y); ctx.quadraticCurveTo(x, y - s * (0.6 + f), x + s * 0.18, y); ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.moveTo(x - s * 0.09, y); ctx.quadraticCurveTo(x, y - s * (0.35 - f), x + s * 0.09, y); ctx.fill();
    }

    drawHumans() {
      const ctx = this.ctx, s = this.cam.s, sim = this.sim;
      const v = this.view;
      const list = [];
      for (const h of sim.humans) {
        if (!h.alive) continue;
        if (h.x < v.x0 - 1 || h.x > v.x1 + 1 || h.y < v.y0 - 1 || h.y > v.y1 + 1) continue;
        list.push(h);
      }
      if (s >= 10) list.sort((a, b) => a.y - b.y);
      const sel = this.selected && this.selected.type === 'human' ? this.selected.h : null;
      for (const h of list) {
        const [x, y] = this.toScreen(h.x, h.y);
        const color = h.tribe ? h.tribe.color : '#f4f4f4';
        if (s < 10) {
          const r = Math.max(1.2, s * 0.18) * (h.adult ? 1 : 0.7);
          ctx.fillStyle = color;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          if (h.state === 'fight') { ctx.fillStyle = '#f33'; ctx.fillRect(x - r, y - r - 2, r * 2, 1.5); }
        } else {
          this.drawPerson(h, x, y, s, color);
        }
        if (h === this.cupidFirst) {
          ctx.strokeStyle = '#ff6fae'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(x, y - (s >= 10 ? s * 0.35 : 0), Math.max(8, s * 0.6), 0, Math.PI * 2); ctx.stroke();
          this.drawHeart(x, y - Math.max(14, s * 1.1), 7, '#ff6fae');
        }
        if (h === sel) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, y, Math.max(5, s * 0.4), Math.max(2.5, s * 0.15), 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // 확대했을 때 보이는 사람의 모습
    drawPerson(h, x, y, s, color) {
      const ctx = this.ctx;
      const scale = h.age < 14 ? 0.45 + h.age / 14 * 0.4 : 1;
      const u = s * 0.05 * scale;
      const swing = h.moving ? Math.sin(h.walk * 3) * 2.2 * u : 0;
      const old = h.age >= 55;
      const d = h.dir;
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y, 4 * u, 1.5 * u, 0, 0, Math.PI * 2); ctx.fill();
      const dancing = h.state === 'party';
      if (dancing) y -= Math.abs(Math.sin(this.frame * 0.22 + h.id)) * 3 * u; // 축제 춤
      // 다리
      ctx.strokeStyle = '#4a3526'; ctx.lineWidth = Math.max(1, 1.4 * u); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 1 * u, y - 6 * u); ctx.lineTo(x - 1 * u + swing, y);
      ctx.moveTo(x + 1 * u, y - 6 * u); ctx.lineTo(x + 1 * u - swing, y);
      ctx.stroke();
      // 몸통 (옷 색 = 직업/부족)
      let body = color;
      if (h.job === J.PRIEST) body = '#f2f0e6';
      if (h.job === J.WARRIOR) body = '#7a2b25';
      if (h.job === J.MERCHANT) body = '#8a5a2b';
      if (h.job === J.HEALER) body = '#e8f3ec';
      if (h.job === J.GUARD) body = '#4b5d73';
      if (h.job === J.SMITH) body = '#5a4636';
      if (h.outlaw) body = '#3a3530';
      if (h.jail) body = '#d8d2c0';
      ctx.fillStyle = body;
      const bodyTop = y - 13 * u, bodyH = h.job === J.PRIEST ? 10 * u : 7.5 * u;
      ctx.beginPath();
      ctx.moveTo(x - 2.6 * u, bodyTop + 1 * u); ctx.lineTo(x + 2.6 * u, bodyTop + 1 * u);
      ctx.lineTo(x + (h.gender === 'F' ? 3.4 : 2.8) * u, bodyTop + bodyH); ctx.lineTo(x - (h.gender === 'F' ? 3.4 : 2.8) * u, bodyTop + bodyH);
      ctx.closePath(); ctx.fill();
      if (h.job === J.WARRIOR || h.job === J.PRIEST || h.job === J.MERCHANT) {
        ctx.fillStyle = color; ctx.fillRect(x - 2.6 * u, bodyTop + 4 * u, 5.2 * u, 1.2 * u); // 부족 띠
      }
      if (h.jail) {
        ctx.fillStyle = '#555';
        for (let k = 0; k < 3; k++) ctx.fillRect(x - 2.8 * u, bodyTop + (2 + k * 2) * u, 5.6 * u, 0.7 * u);
      }
      if (h.job === J.HEALER) { ctx.fillStyle = '#2fae5f'; ctx.fillRect(x - 0.4 * u, bodyTop + 2.2 * u, 0.8 * u, 2.6 * u); ctx.fillRect(x - 1.3 * u, bodyTop + 3.1 * u, 2.6 * u, 0.8 * u); }
      // 임신한 배
      if (h.pregnant) {
        const prog = 1 - h.pregnant / (G.CFG.TPY * 0.75);
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(x + d * 1.6 * u, bodyTop + 5 * u, (1.6 + prog * 1.6) * u, (1.8 + prog * 1.2) * u, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 팔
      ctx.strokeStyle = h.skin; ctx.lineWidth = Math.max(1, 1.2 * u);
      const praying = h.state === 'pray' || dancing;
      ctx.beginPath();
      if (praying) {
        ctx.moveTo(x - 2.4 * u, bodyTop + 2 * u); ctx.lineTo(x - 1 * u, bodyTop - 2 * u);
        ctx.moveTo(x + 2.4 * u, bodyTop + 2 * u); ctx.lineTo(x + 1 * u, bodyTop - 2 * u);
      } else {
        ctx.moveTo(x - 2.6 * u, bodyTop + 2 * u); ctx.lineTo(x - 3.2 * u - swing * 0.5, bodyTop + 6.5 * u);
        ctx.moveTo(x + 2.6 * u, bodyTop + 2 * u); ctx.lineTo(x + 3.2 * u + swing * 0.5, bodyTop + 6.5 * u);
      }
      ctx.stroke();
      // 머리
      const hx = x, hy = bodyTop - 2.2 * u;
      const hairCol = old ? '#cfcfcf' : h.hair;
      if (h.gender === 'F') { ctx.fillStyle = hairCol; ctx.fillRect(hx - 3 * u, hy - 1 * u, 6 * u, 5 * u); }
      ctx.fillStyle = h.skin;
      ctx.beginPath(); ctx.arc(hx, hy, 2.7 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hairCol;
      ctx.beginPath(); ctx.arc(hx, hy - 0.4 * u, 2.8 * u, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      if (s >= 26) {
        ctx.fillStyle = '#222';
        ctx.fillRect(hx + d * 0.6 * u, hy - 0.2 * u, 0.7 * u, 0.7 * u);
        ctx.fillRect(hx + d * 1.9 * u, hy - 0.2 * u, 0.7 * u, 0.7 * u);
      }
      // 족장 관
      if (h.job === J.CHIEF) {
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        ctx.moveTo(hx - 2.4 * u, hy - 2.4 * u); ctx.lineTo(hx - 2.4 * u, hy - 4.6 * u); ctx.lineTo(hx - 1.2 * u, hy - 3.4 * u);
        ctx.lineTo(hx, hy - 5 * u); ctx.lineTo(hx + 1.2 * u, hy - 3.4 * u); ctx.lineTo(hx + 2.4 * u, hy - 4.6 * u); ctx.lineTo(hx + 2.4 * u, hy - 2.4 * u);
        ctx.fill();
      }
      if (h.job === J.GUARD) {
        ctx.fillStyle = '#9aa3ad';
        ctx.beginPath(); ctx.arc(hx, hy - 0.6 * u, 3 * u, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(hx - 3.2 * u, hy - 0.8 * u, 6.4 * u, 0.7 * u);
      }
      if (h.outlaw && s >= 14) { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(hx - 2.8 * u, hy - 0.9 * u, 5.6 * u, 1.3 * u); }
      // 도구
      this.drawTool(h, x, y, bodyTop, u, d);
      // 무기와 짐
      if (h.job === J.WARRIOR) {
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = Math.max(1, 0.8 * u);
        ctx.beginPath(); ctx.moveTo(x + d * 3.6 * u, y - 2 * u); ctx.lineTo(x + d * 3.6 * u, y - 18 * u); ctx.stroke();
        ctx.fillStyle = '#ddd';
        ctx.beginPath(); ctx.moveTo(x + d * 3.6 * u, y - 20 * u); ctx.lineTo(x + d * 4.6 * u, y - 17.5 * u); ctx.lineTo(x + d * 2.6 * u, y - 17.5 * u); ctx.fill();
      }
      if (h.carry && h.carryAmt > 0) {
        const cx = x - d * 3.8 * u, cy = bodyTop + 4 * u;
        if (h.carry === 'food') { ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(cx, cy, 1.6 * u, 0, 7); ctx.fill(); ctx.fillStyle = '#4a4'; ctx.fillRect(cx - 0.3 * u, cy - 2.4 * u, 0.6 * u, 1 * u); }
        else if (h.carry === 'wood') { ctx.fillStyle = '#7a4f28'; ctx.fillRect(cx - 1 * u, cy - 4 * u, 2 * u, 7 * u); }
        else if (h.carry === 'ore') { ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.moveTo(cx, cy - 2 * u); ctx.lineTo(cx + 1.8 * u, cy); ctx.lineTo(cx, cy + 1.8 * u); ctx.lineTo(cx - 1.8 * u, cy); ctx.fill(); ctx.fillStyle = '#ffd34d'; ctx.fillRect(cx - 0.4 * u, cy - 0.4 * u, 0.8 * u, 0.8 * u); }
      }
      if (h.job === J.MERCHANT) { ctx.fillStyle = '#d9b26a'; ctx.beginPath(); ctx.arc(x - d * 3.3 * u, y - 5 * u, 1.6 * u, 0, 7); ctx.fill(); }
      // 이름과 감정 표시
      const top = hy - 6 * u;
      if (s >= 30) {
        ctx.font = `${Math.min(13, 9 + s / 12)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const label = h.name;
        const tw = ctx.measureText(label).width;
        ctx.fillRect(x - tw / 2 - 3, top - 13, tw + 6, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, top - 2);
      }
      if (h.wanted && s >= 12) {
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4d4d'; ctx.fillText('수배', x, top - (s >= 30 ? 30 : 14));
      }
      if (h.emoteT > 0 && s >= 14) {
        const ey = top - (s >= 30 ? 18 : 4);
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = EMOTE_COLORS[h.emote] || '#ffe27a';
        if (h.emote === '♥' || h.emote === '♪' || h.emote === '#' || h.emote === '…') ctx.font = 'bold 15px sans-serif';
        ctx.fillText(h.emote, x, ey);
      } else if (h.hunger > 85 && s >= 14) {
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffae42';
        ctx.fillText('배고픔', x, top - (s >= 30 ? 18 : 4));
      }
      // 체력 바 (다쳤을 때만)
      if (h.health < 99 && s >= 14) {
        ctx.fillStyle = '#300'; ctx.fillRect(x - 4 * u, y + 1.5 * u, 8 * u, 1.2 * u);
        ctx.fillStyle = h.health > 50 ? '#5c5' : '#e44'; ctx.fillRect(x - 4 * u, y + 1.5 * u, 8 * u * h.health / 100, 1.2 * u);
      }
    }

    drawTribeLabels() {
      const ctx = this.ctx, s = this.cam.s;
      ctx.textAlign = 'center';
      for (const t of this.sim.tribes) {
        if (!t.alive) continue;
        const [cx, cy] = this.toScreen(t.cx, t.cy);
        if (cx < -100 || cy < -50 || cx > this.vw + 100 || cy > this.vh + 50) continue;
        const R = (5 + Math.sqrt(t.members.length) * 1.4) * s;
        const ly = cy - R - 6;
        ctx.font = 'bold 13px sans-serif';
        const label = `${t.name} · ${t.members.length}명${t.wars.size ? ' · 전쟁 중' : ''}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(10,15,25,0.7)';
        ctx.fillRect(cx - tw / 2 - 6, ly - 14, tw + 12, 19);
        ctx.fillStyle = t.color;
        ctx.fillRect(cx - tw / 2 - 6, ly - 14, 3, 19);
        ctx.fillStyle = t.wars.size ? '#ff8a80' : '#fff';
        ctx.fillText(label, cx, ly);
      }
    }

    drawEffects() {
      const ctx = this.ctx, s = this.cam.s;
      for (const e of this.sim.effects) {
        const [x, y] = this.toScreen(e.x, e.y);
        const p = e.age / e.ttl;
        switch (e.kind) {
          case 'rain': {
            const R = e.r * s;
            ctx.fillStyle = `rgba(90,140,200,${0.18 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(180,210,255,${0.8 * (1 - p)})`; ctx.lineWidth = 1;
            ctx.beginPath();
            for (let k = 0; k < 70; k++) {
              const a = (k * 2.399) % (Math.PI * 2), rr = R * Math.sqrt((k * 0.618) % 1);
              const fy = ((e.age * 6 + k * 37) % 40) - 20;
              const dx = x + Math.cos(a) * rr, dy = y + Math.sin(a) * rr + fy;
              ctx.moveTo(dx, dy); ctx.lineTo(dx - 2, dy + 7);
            }
            ctx.stroke();
            break;
          }
          case 'bless': {
            const col = e.color || '255,220,100';
            ctx.strokeStyle = `rgba(${col},${1 - p})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, e.r * s * (0.3 + p), 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = `rgba(${col},${0.22 * (1 - p)})`; ctx.fill();
            break;
          }
          case 'hearts': {
            for (let k = 0; k < 7; k++) {
              const hx = x + Math.sin(k * 2.1 + e.age * 0.05) * (8 + k * 3);
              const hy = y - 10 - ((e.age * 0.9 + k * 13) % 60);
              ctx.globalAlpha = Math.max(0, 1 - p) * (1 - ((e.age * 0.9 + k * 13) % 60) / 70);
              this.drawHeart(hx, hy, 5 + (k % 3) * 2, '#ff6fae');
            }
            ctx.globalAlpha = 1;
            break;
          }
          case 'arrow': {
            const [x2, y2] = this.toScreen(e.x2, e.y2);
            const t = Math.min(1, p * 2);
            const ax = x + (x2 - x) * t, ay = y + (y2 - y) * t;
            ctx.strokeStyle = `rgba(255,120,180,${1 - p})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(ax, ay - 10); ctx.stroke(); ctx.setLineDash([]);
            this.drawHeart(ax, ay - 10, 8, '#ff3d8b');
            break;
          }
          case 'discord': {
            ctx.fillStyle = `rgba(110,60,150,${0.3 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(x, y, 5 * s * (0.5 + p * 0.5), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(190,130,255,${0.9 * (1 - p)})`; ctx.lineWidth = 2;
            for (let k = 0; k < 6; k++) {
              const a = k + e.age * 0.08, r = 5 * s * 0.5;
              ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 6, a, a + 4); ctx.stroke();
            }
            break;
          }
          case 'bolt': {
            if (e.age < 4) { ctx.fillStyle = 'rgba(255,255,230,0.35)'; ctx.fillRect(0, 0, this.vw, this.vh); }
            ctx.strokeStyle = `rgba(255,255,200,${1 - p})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(x, y);
            let bx = x, by = y, k = 0;
            while (by > -10 && k++ < 40) { by -= 25; bx += Math.sin(e.seed * 99 + k * 7.3) * 18; ctx.lineTo(bx, by); }
            ctx.stroke();
            ctx.fillStyle = `rgba(255,240,150,${0.6 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(x, y, s * 1.2, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'meteor': {
            const fx = x + (1 - p) * 500, fy = y - (1 - p) * 700;
            ctx.strokeStyle = 'rgba(255,160,60,0.6)'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 60, fy - 85); ctx.stroke();
            ctx.fillStyle = '#ffcf6b';
            ctx.beginPath(); ctx.arc(fx, fy, Math.max(6, s * 0.8), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,80,40,0.7)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, Math.PI * 2); ctx.stroke();
            break;
          }
          case 'boom': {
            if (e.age < 6) { ctx.fillStyle = 'rgba(255,200,120,0.4)'; ctx.fillRect(0, 0, this.vw, this.vh); }
            ctx.fillStyle = `rgba(255,${120 + 100 * (1 - p)},40,${0.8 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(x, y, s * (2 + p * 6), 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'escape': {
            ctx.strokeStyle = `rgba(255,160,60,${1 - p})`; ctx.lineWidth = 2;
            for (let k = 0; k < 10; k++) {
              const a = k * 0.628, r0 = s * 0.5, r1 = s * (0.8 + p * 2);
              ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
            }
            break;
          }
          case 'soul': {
            if (s < 8) break;
            ctx.fillStyle = `rgba(230,240,255,${0.7 * (1 - p)})`;
            ctx.beginPath(); ctx.arc(x, y - s * 0.6 - p * s * 1.5, s * 0.12, 0, Math.PI * 2); ctx.fill();
            break;
          }
        }
      }
    }

    drawJail(x, y, s) {
      const ctx = this.ctx;
      const u = Math.max(s, 6);
      ctx.fillStyle = '#6f6a62';
      ctx.fillRect(x - u * 0.6, y - u * 0.75, u * 1.2, u * 0.9);
      ctx.fillStyle = '#4c4842';
      ctx.fillRect(x - u * 0.7, y - u * 0.85, u * 1.4, u * 0.14);
      if (s >= 10) {
        ctx.strokeStyle = '#2a2724'; ctx.lineWidth = Math.max(1, u * 0.05);
        ctx.beginPath();
        for (let k = -2; k <= 2; k++) { ctx.moveTo(x + k * u * 0.2, y - u * 0.6); ctx.lineTo(x + k * u * 0.2, y + u * 0.1); }
        ctx.stroke();
      }
    }

    drawTool(h, x, y, bodyTop, u, d) {
      const ctx = this.ctx;
      ctx.lineCap = 'round';
      const hand = { x: x + d * 3.4 * u, y: bodyTop + 6.5 * u };
      switch (h.job) {
        case J.HUNTER:
          ctx.strokeStyle = '#7a4f28'; ctx.lineWidth = Math.max(1, 0.8 * u);
          ctx.beginPath(); ctx.arc(x - d * 2.6 * u, bodyTop + 4 * u, 4 * u, -1.2, 1.2); ctx.stroke();
          break;
        case J.FISHER:
          if (h.state === 'gather') {
            ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = Math.max(1, 0.6 * u);
            ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hand.x + d * 9 * u, hand.y - 9 * u); ctx.stroke();
            ctx.strokeStyle = 'rgba(230,230,230,0.7)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(hand.x + d * 9 * u, hand.y - 9 * u); ctx.lineTo(hand.x + d * 10 * u, hand.y + 6 * u); ctx.stroke();
          }
          break;
        case J.FARMER:
          ctx.strokeStyle = '#7a4f28'; ctx.lineWidth = Math.max(1, 0.7 * u);
          ctx.beginPath(); ctx.moveTo(hand.x, hand.y - 7 * u); ctx.lineTo(hand.x, hand.y + 2 * u); ctx.stroke();
          ctx.fillStyle = '#aaa'; ctx.fillRect(hand.x - (d > 0 ? 0 : 2.2 * u), hand.y + 1.5 * u, 2.2 * u, 0.9 * u);
          break;
        case J.SMITH: {
          const up = h.state === 'busy' && Math.sin(this.frame * 0.4) > 0;
          ctx.strokeStyle = '#7a4f28'; ctx.lineWidth = Math.max(1, 0.7 * u);
          ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hand.x + d * 2 * u, hand.y - (up ? 5 : 2) * u); ctx.stroke();
          ctx.fillStyle = '#888'; ctx.fillRect(hand.x + d * 2 * u - 1.2 * u, hand.y - (up ? 6 : 3) * u, 2.4 * u, 1.4 * u);
          break;
        }
        case J.GUARD:
          ctx.strokeStyle = '#999'; ctx.lineWidth = Math.max(1, 0.7 * u);
          ctx.beginPath(); ctx.moveTo(x + d * 3.6 * u, y - 1 * u); ctx.lineTo(x + d * 3.6 * u, y - 16 * u); ctx.stroke();
          break;
      }
    }

    drawAnimals() {
      const ctx = this.ctx, s = this.cam.s, v = this.view;
      for (const a of this.sim.animals) {
        if (!a.alive || a.x < v.x0 - 1 || a.x > v.x1 + 1 || a.y < v.y0 - 1 || a.y > v.y1 + 1) continue;
        const [x, y] = this.toScreen(a.x, a.y);
        const K = G.Wild.KINDS[a.kind];
        if (s < 8) { ctx.fillStyle = K.color; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); continue; }
        const u = s * 0.05 * (a.kind === 'deer' ? 1.1 : 1), d = a.dir;
        const sw = a.moving ? Math.sin(a.walk * 3) * 1.6 * u : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(x, y, 5 * u, 1.4 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = K.color; ctx.lineWidth = Math.max(1, 1.1 * u);
        const legH = a.kind === 'deer' ? 5 : 3.2;
        ctx.beginPath();
        ctx.moveTo(x - 3 * u, y - legH * u); ctx.lineTo(x - 3 * u + sw, y);
        ctx.moveTo(x + 3 * u, y - legH * u); ctx.lineTo(x + 3 * u - sw, y);
        ctx.stroke();
        ctx.fillStyle = K.color;
        ctx.beginPath(); ctx.ellipse(x, y - (legH + 1.8) * u, 4.6 * u, 2.4 * u, 0, 0, Math.PI * 2); ctx.fill();
        const hx = x + d * 4.8 * u, hy = y - (legH + (a.kind === 'boar' ? 1.5 : 3.6)) * u;
        ctx.beginPath(); ctx.ellipse(hx, hy, 2 * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();
        if (a.kind === 'deer') {
          ctx.strokeStyle = '#d9c29a'; ctx.lineWidth = Math.max(1, 0.5 * u);
          ctx.beginPath(); ctx.moveTo(hx, hy - 1 * u); ctx.lineTo(hx - d * 1 * u, hy - 4 * u); ctx.moveTo(hx - d * 0.6 * u, hy - 2.6 * u); ctx.lineTo(hx + d * 1 * u, hy - 3.8 * u); ctx.stroke();
          ctx.fillStyle = '#f3e6cf'; ctx.fillRect(x - d * 4.6 * u, y - (legH + 2.6) * u, 1 * u, 1 * u);
        } else if (a.kind === 'boar') {
          ctx.fillStyle = '#eee'; ctx.fillRect(hx + d * 1.4 * u, hy + 0.2 * u, 0.6 * u, 1.2 * u);
        } else {
          ctx.beginPath(); ctx.moveTo(hx - 1 * u, hy - 1 * u); ctx.lineTo(hx - 0.4 * u, hy - 3 * u); ctx.lineTo(hx + 0.4 * u, hy - 1 * u); ctx.fill();
          ctx.strokeStyle = K.color; ctx.lineWidth = Math.max(1, 1 * u);
          ctx.beginPath(); ctx.moveTo(x - d * 4.4 * u, y - (legH + 2) * u); ctx.lineTo(x - d * 7 * u, y - (legH + 3.5) * u); ctx.stroke();
          if (a.target) { ctx.fillStyle = '#ff5050'; ctx.fillRect(hx + d * 0.6 * u, hy - 0.5 * u, 0.7 * u, 0.7 * u); }
        }
        if (a.hp < K.hp && s >= 14) {
          ctx.fillStyle = '#300'; ctx.fillRect(x - 3 * u, y + 1.2 * u, 6 * u, 1 * u);
          ctx.fillStyle = '#e44'; ctx.fillRect(x - 3 * u, y + 1.2 * u, 6 * u * Math.max(0, a.hp) / K.hp, 1 * u);
        }
      }
    }

    drawHeart(x, y, r, color) {
      const ctx = this.ctx;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.9);
      ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
      ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
      ctx.fill();
    }

    drawBrush() {
      const b = this.brush;
      if (!b || !b.r) return;
      const ctx = this.ctx;
      const [x, y] = this.toScreen(b.x, b.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(x, y, b.r * this.cam.s, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  G.Renderer = Renderer;
})();
