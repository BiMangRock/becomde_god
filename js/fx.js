// 화면 효과: 파티클(불꽃, 연기, 파편, 물보라, 반짝임), 충격파, 화면 흔들림. 시뮬레이션과 상관없이 보이기만 한다.
(function () {
  const G = globalThis.G;
  const R = (a, b) => a + Math.random() * (b - a);

  class FX {
    constructor(renderer) {
      this.r = renderer;
      this.ps = [];
      this.shake = 0;
      this.seen = new WeakSet();
      this.flash = 0; this.flashColor = '255,255,240';
    }

    add(p) { if (this.ps.length < 2500) this.ps.push(p); }

    // 새로 생긴 시뮬레이션 효과를 보고 파티클을 뿌린다
    process(sim) {
      for (const e of sim.effects) {
        if (this.seen.has(e)) continue;
        this.seen.add(e);
        this.spawn(e);
      }
    }

    spawn(e) {
      const { x, y } = e;
      switch (e.kind) {
        case 'bolt':
          this.shake = Math.max(this.shake, 7); this.flash = 0.55; this.flashColor = '235,240,255';
          for (let i = 0; i < 45; i++) { const a = R(0, 6.28), s = R(0.03, 0.18); this.add({ t: 'spark', x, y, z: R(0, 0.3), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: R(0.05, 0.2), g: 0.012, life: R(20, 45), c: Math.random() < 0.5 ? '255,250,200' : '170,200,255', size: R(1.5, 3) }); }
          for (let i = 0; i < 10; i++) this.add({ t: 'smoke', x: x + R(-0.4, 0.4), y: y + R(-0.4, 0.4), z: 0, vx: R(-0.005, 0.005), vy: R(-0.005, 0.005), vz: R(0.01, 0.025), life: R(60, 110), c: '70,70,75', size: R(4, 8), grow: 0.12 });
          this.add({ t: 'ring', x, y, life: 30, max: 30, r0: 0.2, r1: 3, c: '200,220,255', w: 3 });
          break;
        case 'boom':
          this.shake = Math.max(this.shake, 22); this.flash = 0.8; this.flashColor = '255,220,160';
          for (let k = 0; k < 3; k++) this.add({ t: 'ring', x, y, life: 40 + k * 15, max: 40 + k * 15, r0: 0.5, r1: 9 + k * 4, c: k ? '255,190,120' : '255,255,220', w: 5 - k, delay: k * 6 });
          for (let i = 0; i < 90; i++) { const a = R(0, 6.28), s = R(0.05, 0.35); this.add({ t: 'debris', x, y, z: R(0, 0.5), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: R(0.15, 0.5), g: 0.02, life: R(50, 110), c: Math.random() < 0.5 ? '110,90,70' : '80,75,70', size: R(2, 4.5), rot: R(0, 6), vr: R(-0.3, 0.3) }); }
          for (let i = 0; i < 70; i++) { const a = R(0, 6.28), s = R(0.03, 0.25); this.add({ t: 'ember', x, y, z: R(0, 1), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: R(0.05, 0.35), g: 0.01, life: R(40, 100), c: Math.random() < 0.5 ? '255,170,60' : '255,230,120', size: R(1.5, 3.2) }); }
          for (let i = 0; i < 40; i++) { const a = R(0, 6.28), d = R(0, 3); this.add({ t: 'smoke', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, z: R(0, 0.5), vx: Math.cos(a) * 0.01, vy: Math.sin(a) * 0.01, vz: R(0.01, 0.04), life: R(120, 240), c: Math.random() < 0.5 ? '90,80,70' : '60,55,50', size: R(8, 18), grow: 0.15 }); }
          break;
        case 'bless': {
          const col = e.color || '255,225,120';
          for (let i = 0; i < 40; i++) { const a = R(0, 6.28), d = R(0, e.r || 3); this.add({ t: 'sparkle', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, z: R(0, 0.3), vx: 0, vy: 0, vz: R(0.01, 0.035), life: R(40, 90), c: col, size: R(2, 4) }); }
          break;
        }
        case 'beam':
          this.flash = 0.25; this.flashColor = '255,250,220';
          this.add({ t: 'beam', x, y, life: 70, max: 70 });
          break;
        case 'steam':
          for (let i = 0; i < 12; i++) this.add({ t: 'smoke', x: x + R(-0.4, 0.4), y: y + R(-0.4, 0.4), z: R(0, 0.3), vx: R(-0.006, 0.006), vy: R(-0.006, 0.006), vz: R(0.02, 0.04), life: R(30, 60), c: '235,240,245', size: R(3, 6), grow: 0.1 });
          for (let i = 0; i < 10; i++) { const a = R(0, 6.28); this.add({ t: 'drop', x, y, z: 0.6, vx: Math.cos(a) * R(0.02, 0.06), vy: Math.sin(a) * R(0.02, 0.06), vz: R(0.05, 0.12), g: 0.015, life: R(20, 35), c: '150,200,255', size: 2 }); }
          break;
        case 'claw':
          this.add({ t: 'slash', x, y, life: 18, max: 18, a: R(-0.6, 0.6) });
          for (let i = 0; i < 6; i++) this.add({ t: 'spark', x, y, z: 0.5, vx: R(-0.04, 0.04), vy: R(-0.03, 0.03), vz: R(0.02, 0.08), g: 0.01, life: R(10, 20), c: '230,60,60', size: 2 });
          break;
        case 'escape':
          this.shake = Math.max(this.shake, 4);
          for (let i = 0; i < 30; i++) { const a = R(0, 6.28), s = R(0.05, 0.2); this.add({ t: 'debris', x, y, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: R(0.1, 0.3), g: 0.02, life: R(30, 60), c: '110,105,98', size: R(2, 3.5), rot: 0, vr: R(-0.3, 0.3) }); }
          break;
        case 'hearts':
          for (let i = 0; i < 12; i++) this.add({ t: 'heart', x: x + R(-1, 1), y: y + R(-0.5, 0.5), z: R(0.5, 1), vx: R(-0.01, 0.01), vy: 0, vz: R(0.015, 0.03), life: R(60, 110), c: '255,110,170', size: R(4, 7) });
          break;
        case 'discord':
          for (let i = 0; i < 25; i++) { const a = R(0, 6.28), d = R(0, 5); this.add({ t: 'smoke', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, z: R(0, 0.5), vx: 0, vy: 0, vz: R(0.005, 0.02), life: R(60, 120), c: '120,70,160', size: R(5, 10), grow: 0.08 }); }
          break;
      }
    }

    // 계속 내뿜는 것: 불, 운석 꼬리, 빗방울, 운석 구덩이
    emit(sim) {
      const r = this.r, v = r.view;
      const w = sim.world;
      if (sim.fires && sim.fires.size) {
        let n = 0;
        for (const i of sim.fires) {
          const fx = (i % w.w) + 0.5, fy = ((i / w.w) | 0) + 0.5;
          if (fx < v.x0 || fx > v.x1 + 1 || fy < v.y0 || fy > v.y1 + 1) continue;
          const k = w.fire[i];
          if (Math.random() < 0.12 * k) this.add({ t: 'smoke', x: fx + R(-0.3, 0.3), y: fy + R(-0.3, 0.3), z: 0.6, vx: R(0.002, 0.01), vy: R(-0.004, 0.004), vz: R(0.02, 0.04), life: R(70, 140), c: '60,58,56', size: R(4, 8), grow: 0.1 });
          if (Math.random() < 0.15 * k) this.add({ t: 'ember', x: fx + R(-0.4, 0.4), y: fy + R(-0.4, 0.4), z: R(0.2, 0.8), vx: R(-0.01, 0.015), vy: R(-0.01, 0.01), vz: R(0.02, 0.05), g: -0.0005, life: R(30, 70), c: Math.random() < 0.5 ? '255,160,50' : '255,220,110', size: R(1.2, 2.4) });
          if (++n > 200) break;
        }
      }
      for (const e of sim.effects) {
        if (e.kind === 'meteor') {
          const p = e.age / e.ttl;
          const mx = e.x + (1 - p) * 30, my = e.y - (1 - p) * 40;
          for (let i = 0; i < 4; i++) this.add({ t: 'ember', x: mx + R(-0.3, 0.3), y: my + R(-0.3, 0.3), z: 0, vx: R(0.02, 0.06), vy: R(-0.08, -0.03), vz: 0, life: R(15, 35), c: Math.random() < 0.5 ? '255,140,50' : '255,230,140', size: R(2, 4) });
          if (Math.random() < 0.6) this.add({ t: 'smoke', x: mx, y: my, z: 0, vx: R(0.01, 0.03), vy: R(-0.04, -0.01), vz: 0, life: R(40, 70), c: '90,80,75', size: R(5, 9), grow: 0.15 });
          this.shake = Math.max(this.shake, p * 3);
        } else if (e.kind === 'rain') {
          for (let i = 0; i < 3; i++) {
            const a = R(0, 6.28), d = Math.sqrt(Math.random()) * e.r;
            this.add({ t: 'ring', x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, life: 18, max: 18, r0: 0.02, r1: 0.25, c: '190,215,255', w: 1 });
          }
        } else if (e.kind === 'crater' && Math.random() < 0.25 * (1 - e.age / e.ttl)) {
          const a = R(0, 6.28), d = R(0, 2.5);
          this.add({ t: 'smoke', x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, z: 0, vx: 0.004, vy: 0, vz: R(0.01, 0.025), life: R(80, 140), c: '80,75,70', size: R(4, 8), grow: 0.08 });
          if (Math.random() < 0.5) this.add({ t: 'ember', x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, z: 0, vx: 0, vy: 0, vz: R(0.01, 0.03), life: R(20, 50), c: '255,140,60', size: R(1.2, 2.2) });
        }
      }
    }

    update() {
      const ps = this.ps;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        if (p.delay > 0) { p.delay--; continue; }
        p.life--;
        if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; }
        if (p.vz !== undefined) {
          p.z += p.vz;
          if (p.g) p.vz -= p.g;
          if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
        }
        if (p.vr) p.rot += p.vr;
        if (p.grow) p.size += p.grow;
        if (p.t === 'smoke') { p.vx *= 0.99; p.vy *= 0.99; }
      }
      this.shake *= 0.88;
      if (this.shake < 0.1) this.shake = 0;
      this.flash *= 0.85;
    }

    draw(ctx) {
      const r = this.r, s = r.cam.s;
      const zs = Math.max(1, s / 14);
      for (const p of this.ps) {
        if (p.delay > 0) continue;
        const [sx, sy0] = r.toScreen(p.x, p.y);
        const sy = sy0 - (p.z || 0) * s;
        if (sx < -50 || sy < -50 || sx > r.vw + 50 || sy > r.vh + 50) continue;
        const fade = p.max ? p.life / p.max : Math.min(1, p.life / 30);
        switch (p.t) {
          case 'spark': case 'ember': case 'drop':
            ctx.fillStyle = `rgba(${p.c},${fade})`;
            ctx.fillRect(sx - p.size * zs / 2, sy - p.size * zs / 2, p.size * zs, p.size * zs);
            break;
          case 'smoke':
            ctx.fillStyle = `rgba(${p.c},${0.35 * fade})`;
            ctx.beginPath(); ctx.arc(sx, sy, p.size * zs, 0, 6.29); ctx.fill();
            break;
          case 'sparkle': {
            const k = p.size * zs * (0.6 + 0.4 * Math.sin(p.life * 0.4));
            ctx.fillStyle = `rgba(${p.c},${fade})`;
            ctx.beginPath(); ctx.moveTo(sx, sy - k); ctx.lineTo(sx + k * 0.3, sy); ctx.lineTo(sx, sy + k); ctx.lineTo(sx - k * 0.3, sy); ctx.fill();
            ctx.beginPath(); ctx.moveTo(sx - k, sy); ctx.lineTo(sx, sy + k * 0.3); ctx.lineTo(sx + k, sy); ctx.lineTo(sx, sy - k * 0.3); ctx.fill();
            break;
          }
          case 'debris':
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
            ctx.fillStyle = `rgba(${p.c},${fade})`;
            ctx.fillRect(-p.size * zs / 2, -p.size * zs / 3, p.size * zs, p.size * zs * 0.66);
            ctx.restore();
            break;
          case 'ring': {
            const t = 1 - p.life / p.max;
            const rr = (p.r0 + (p.r1 - p.r0) * t) * s;
            ctx.strokeStyle = `rgba(${p.c},${1 - t})`; ctx.lineWidth = p.w * (1 - t) + 0.5;
            ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * 0.7, 0, 0, 6.29); ctx.stroke();
            break;
          }
          case 'beam': {
            const t = p.life / p.max;
            const bw = s * 1.2 * t + 4;
            const grd = ctx.createLinearGradient(sx, 0, sx, sy);
            grd.addColorStop(0, 'rgba(255,250,220,0)'); grd.addColorStop(1, `rgba(255,250,220,${0.7 * t})`);
            ctx.fillStyle = grd; ctx.fillRect(sx - bw / 2, 0, bw, sy);
            break;
          }
          case 'slash': {
            ctx.strokeStyle = `rgba(255,80,80,${fade})`; ctx.lineWidth = 2;
            const L = Math.max(8, s * 0.5);
            for (let k = -1; k <= 1; k++) {
              ctx.beginPath();
              ctx.moveTo(sx - L / 2 + k * 4, sy - L / 2 - s * 0.4); ctx.lineTo(sx + L / 2 + k * 4, sy + L / 2 - s * 0.4);
              ctx.stroke();
            }
            break;
          }
          case 'heart':
            ctx.globalAlpha = fade;
            r.drawHeart(sx, sy, p.size * zs * 0.8, `rgb(${p.c})`);
            ctx.globalAlpha = 1;
            break;
        }
      }
    }

    drawFlash(ctx) {
      if (this.flash > 0.02) { ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`; ctx.fillRect(0, 0, this.r.vw, this.r.vh); }
    }

    offset() {
      if (!this.shake) return [0, 0];
      return [R(-1, 1) * this.shake, R(-1, 1) * this.shake];
    }
  }

  G.FX = FX;
})();
