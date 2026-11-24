// 지형과 자원
(function () {
  const G = globalThis.G;
  const { clamp, lerp } = G;

  const T = (G.T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, HILL: 5, MOUNTAIN: 6, SNOW: 7 });
  G.TILE_NAMES = ['깊은 바다', '얕은 바다', '모래사장', '초원', '숲', '언덕', '산', '설산'];
  const COL = [[24, 62, 112], [46, 104, 170], [222, 204, 140], [112, 172, 70], [50, 112, 46], [150, 152, 96], [124, 118, 110], [232, 236, 240]];
  G.TILE_SPEED = [0, 0, 0.9, 1, 0.75, 0.7, 0.5, 0.4];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class World {
    constructor(w, h, seed) {
      this.w = w; this.h = h;
      const n = w * h;
      this.height = new Float32Array(n);
      this.moist = new Float32Array(n);
      this.type = new Uint8Array(n);
      this.food = new Float32Array(n);
      this.wood = new Float32Array(n);
      this.ore = new Float32Array(n);
      this.fert = new Float32Array(n);
      this.dirty = true;
      this.generate(seed);
    }

    generate(seed) {
      const rng = mulberry32(seed);
      const N = 256;
      const grid = new Float32Array(N * N);
      for (let i = 0; i < grid.length; i++) grid[i] = rng();
      const sm = (t) => t * t * (3 - 2 * t);
      const g = (a, b) => grid[(b & 255) * N + (a & 255)];
      const noise = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const u = sm(x - xi), v = sm(y - yi);
        const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
      };
      const fbm = (x, y, oct) => {
        let s = 0, amp = 0.5, f = 1, norm = 0;
        for (let k = 0; k < oct; k++) {
          s += noise(x * f + k * 37.1, y * f + k * 11.7) * amp;
          norm += amp; amp *= 0.5; f *= 2;
        }
        return s / norm;
      };
      const ox = rng() * 100, oy = rng() * 100;
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const i = y * this.w + x;
          const nx = (x / this.w - 0.5) * 2, ny = (y / this.h - 0.5) * 2;
          const d = Math.sqrt(nx * nx + ny * ny);
          this.height[i] = fbm(x / 22 + ox, y / 22 + oy, 5) + 0.3 - 0.9 * d * d;
          this.moist[i] = fbm(x / 14 + ox + 50, y / 14 + oy + 50, 3);
          this.classify(i);
          this.initRes(i);
        }
      }
    }

    classify(i) {
      const h = this.height[i];
      let t;
      if (h < 0.25) t = T.DEEP;
      else if (h < 0.36) t = T.WATER;
      else if (h < 0.39) t = T.SAND;
      else if (h < 0.64) t = this.moist[i] > 0.53 ? T.FOREST : T.GRASS;
      else if (h < 0.73) t = T.HILL;
      else if (h < 0.84) t = T.MOUNTAIN;
      else t = T.SNOW;
      this.type[i] = t;
    }

    initRes(i) {
      const t = this.type[i];
      this.food[i] = t === T.GRASS ? 4 : t === T.FOREST ? 1.5 : t === T.SAND ? 0.3 : 0;
      this.wood[i] = t === T.FOREST ? 10 : 0;
      this.ore[i] = t === T.HILL ? 3 : t === T.MOUNTAIN ? 8 : 0;
      this.fert[i] = t === T.GRASS || t === T.FOREST ? 1 : 0;
    }

    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    walkableTile(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
      return this.type[ty * this.w + tx] >= T.SAND;
    }
    walkable(x, y) { return this.walkableTile(Math.floor(x), Math.floor(y)); }
    typeAt(x, y) {
      const tx = Math.floor(x), ty = Math.floor(y);
      if (!this.inb(tx, ty)) return T.DEEP;
      return this.type[ty * this.w + tx];
    }

    // 자원 재생 (10틱마다 호출)
    regrow(mult) {
      const n = this.w * this.h;
      for (let i = 0; i < n; i++) {
        const t = this.type[i];
        if (t === T.GRASS) {
          const cap = 4 + 2 * this.fert[i];
          if (this.food[i] < cap) this.food[i] = Math.min(cap, this.food[i] + 0.02 * this.fert[i] * mult);
          this.fert[i] += (1 - this.fert[i]) * 0.002;
          // 습한 초원은 아주 천천히 숲이 된다
          if (this.moist[i] > 0.55 && this.food[i] > 5 && Math.random() < 0.00003) {
            this.type[i] = T.FOREST; this.wood[i] = 2; this.dirty = true;
          }
        } else if (t === T.FOREST) {
          if (this.wood[i] < 12) this.wood[i] = Math.min(12, this.wood[i] + 0.012 * mult);
          if (this.food[i] < 2) this.food[i] = Math.min(2, this.food[i] + 0.006 * mult);
        } else if (t === T.HILL) {
          if (this.ore[i] < 4) this.ore[i] += 0.0005;
        } else if (t === T.MOUNTAIN) {
          if (this.ore[i] < 10) this.ore[i] += 0.001;
        }
      }
    }

    harvest(i, res) {
      this[res][i] -= 1;
      if (res === 'wood' && this.type[i] === T.FOREST && this.wood[i] < 1) {
        this.type[i] = T.GRASS; this.food[i] = 1; this.fert[i] = 0.8; this.wood[i] = 0;
        this.dirty = true;
      }
    }

    // 무작위 표본으로 가까운 자원 칸 찾기
    findResource(x, y, res, r) {
      const arr = this[res];
      let best = null, bestScore = 1e9;
      const cx = Math.floor(x), cy = Math.floor(y);
      if (this.inb(cx, cy) && arr[this.idx(cx, cy)] >= 1 && this.walkableTile(cx, cy)) {
        return { x: cx, y: cy, i: this.idx(cx, cy) };
      }
      for (let k = 0; k < 50; k++) {
        const rr = r * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        const tx = Math.floor(x + Math.cos(a) * rr), ty = Math.floor(y + Math.sin(a) * rr);
        if (!this.walkableTile(tx, ty)) continue;
        const i = this.idx(tx, ty);
        if (arr[i] < 1) continue;
        const score = Math.hypot(tx - x, ty - y) - arr[i] * 0.4;
        if (score < bestScore) { bestScore = score; best = { x: tx, y: ty, i }; }
      }
      return best;
    }

    // 직선으로 갈 수 있는지
    lineClear(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.ceil(d / 0.3);
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        if (!this.walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
      }
      return true;
    }

    // A* 길찾기. 경유점 배열을 돌려주고, 길이 없으면 null
    findPath(sx, sy, tx, ty, maxNodes = 6000) {
      if (this.lineClear(sx, sy, tx, ty)) return [{ x: tx, y: ty }];
      const W = this.w, H = this.h, n = W * H;
      if (!this._g) {
        this._g = new Float32Array(n); this._stamp = new Uint32Array(n); this._came = new Int32Array(n);
        this._closed = new Uint32Array(n); this._gen = 0;
      }
      const gS = this._g, stamp = this._stamp, came = this._came, closed = this._closed;
      const gen = ++this._gen;
      const s = Math.floor(sy) * W + Math.floor(sx), goal = Math.floor(ty) * W + Math.floor(tx);
      const gx = goal % W, gy = (goal / W) | 0;
      const heapI = [], heapF = [];
      const push = (i, f) => {
        heapI.push(i); heapF.push(f);
        let c = heapI.length - 1;
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (heapF[p] <= heapF[c]) break;
          [heapI[p], heapI[c]] = [heapI[c], heapI[p]]; [heapF[p], heapF[c]] = [heapF[c], heapF[p]];
          c = p;
        }
      };
      const pop = () => {
        const top = heapI[0];
        const li = heapI.pop(), lf = heapF.pop();
        if (heapI.length) {
          heapI[0] = li; heapF[0] = lf;
          let c = 0;
          for (;;) {
            const l = c * 2 + 1, r = l + 1;
            let m = c;
            if (l < heapI.length && heapF[l] < heapF[m]) m = l;
            if (r < heapI.length && heapF[r] < heapF[m]) m = r;
            if (m === c) break;
            [heapI[m], heapI[c]] = [heapI[c], heapI[m]]; [heapF[m], heapF[c]] = [heapF[c], heapF[m]];
            c = m;
          }
        }
        return top;
      };
      const h = (i) => {
        const dx = Math.abs((i % W) - gx), dy = Math.abs(((i / W) | 0) - gy);
        return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
      };
      gS[s] = 0; stamp[s] = gen; came[s] = -1;
      push(s, h(s));
      let found = false, expanded = 0;
      const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
      while (heapI.length) {
        const cur = pop();
        if (closed[cur] === gen) continue;
        closed[cur] = gen;
        if (cur === goal) { found = true; break; }
        if (++expanded > maxNodes) break;
        const cx = cur % W, cy = (cur / W) | 0;
        for (let k = 0; k < 8; k++) {
          const nx = cx + DX[k], ny = cy + DY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          const t = this.type[ni];
          if (t < 2 || closed[ni] === gen) continue;
          if (k >= 4 && (this.type[cy * W + nx] < 2 || this.type[ny * W + cx] < 2)) continue;
          const step = (k >= 4 ? 1.414 : 1) / G.TILE_SPEED[t];
          const ng = gS[cur] + step;
          if (stamp[ni] !== gen || ng < gS[ni]) {
            stamp[ni] = gen; gS[ni] = ng; came[ni] = cur;
            push(ni, ng + h(ni));
          }
        }
      }
      if (!found) return null;
      const tiles = [];
      for (let c = goal; c !== -1 && c !== s; c = came[c]) tiles.push(c);
      tiles.reverse();
      const pts = tiles.map((i) => ({ x: (i % W) + 0.5, y: ((i / W) | 0) + 0.5 }));
      pts[pts.length - 1] = { x: tx, y: ty };
      // 직선으로 이어지는 경유점은 건너뛴다
      const out = [];
      let ax = sx, ay = sy, i = 0;
      while (i < pts.length) {
        let j = Math.min(pts.length - 1, i + 12);
        while (j > i && !this.lineClear(ax, ay, pts[j].x, pts[j].y)) j--;
        out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
      }
      return out;
    }

    foodAround(cx, cy, r) {
      let s = 0;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (!this.inb(x, y) || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
        s += this.food[y * this.w + x];
      }
      return s;
    }

    nearestWalkable(x, y, maxR) {
      const cx = Math.floor(x), cy = Math.floor(y);
      if (this.walkableTile(cx, cy)) return { x: cx + 0.5, y: cy + 0.5 };
      for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (this.walkableTile(cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
          }
        }
      }
      return null;
    }

    // 땅 올리기/내리기, 운석 구덩이
    modifyHeight(cx, cy, r, delta) {
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d > r) continue;
          const i = this.idx(x, y);
          this.height[i] = clamp(this.height[i] + delta * (1 - d / r), 0, 1.2);
          const old = this.type[i];
          this.classify(i);
          if (this.type[i] !== old) this.initRes(i);
        }
      }
      this.dirty = true;
    }

    // 지형 그림 (1칸 = 1픽셀)
    paint(data) {
      const n = this.w * this.h;
      for (let i = 0; i < n; i++) {
        const t = this.type[i];
        let r, g, b;
        if (t === T.GRASS) {
          const k = clamp(this.food[i] / 5, 0, 1);
          r = lerp(184, 108, k); g = lerp(176, 174, k); b = lerp(96, 66, k);
        } else if (t === T.FOREST) {
          const k = clamp(this.wood[i] / 10, 0, 1);
          r = lerp(92, 46, k); g = lerp(142, 108, k); b = lerp(60, 44, k);
        } else {
          [r, g, b] = COL[t];
        }
        let sh;
        if (t <= T.WATER) sh = clamp(0.7 + this.height[i] * 0.9, 0.6, 1.1);
        else sh = clamp(0.92 + (this.height[i] - 0.5) * 0.45, 0.78, 1.12);
        const o = i * 4;
        data[o] = r * sh; data[o + 1] = g * sh; data[o + 2] = b * sh; data[o + 3] = 255;
      }
    }
  }

  G.World = World;
})();
