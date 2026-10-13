// Prymitywy do rysowania pixel-artu w palecie RDZA I NEON.
// Uzywane przez generator tresci - te same reguly co w docs/STYLE_GUIDE.md.

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class Grid {
  constructor(w = 16, h = 16, fill = '.') {
    this.w = w; this.h = h;
    this.px = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  clone() { const g = new Grid(this.w, this.h); g.px = this.px.map(r => r.slice()); return g; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y][x] : '.'; }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y][x] = c; return this; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  hline(x, y, len, c) { return this.rect(x, y, len, 1, c); }
  vline(x, y, len, c) { return this.rect(x, y, 1, len, c); }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx + 0.25) + (y * y) / (ry * ry + 0.25) <= 1) this.set(cx + x, cy + y, c);
    return this;
  }
  /** Zachowuje geometrie, cieniuje: gorna/lewa krawedz jasna, dolna/prawa ciemna. */
  bevel(x, y, w, h, light, dark) {
    this.hline(x, y, w, light); this.vline(x, y, h, light);
    this.hline(x, y + h - 1, w, dark); this.vline(x + w - 1, y, h, dark);
    return this;
  }
  noise(r, specks, area = null) {
    const [x0, y0, w, h] = area || [0, 0, this.w, this.h];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (this.get(x, y) === '.') continue;
      const v = r();
      let acc = 0;
      for (const [c, p] of specks) { acc += p; if (v < acc) { this.set(x, y, c); break; } }
    }
    return this;
  }
  /** Zamienia kolor tylko tam, gdzie wystepuje (np. cieniowanie). */
  recolor(from, to) { for (const row of this.px) for (let i = 0; i < row.length; i++) if (row[i] === from) row[i] = to; return this; }
  /** Automatyczny kontur '0' wokol nieprzezroczystych pikseli - zasada nr 1 stylu. */
  outline(c = '0') {
    const src = this.clone();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src.get(x, y) !== '.') continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = src.get(x + dx, y + dy);
        return v !== '.' && v !== c;
      });
      if (n) this.set(x, y, c);
    }
    return this;
  }
  /** Delikatny cien pod obiektem (stoi na ziemi). */
  shadow(y, x0, x1, c = '1') {
    for (let x = x0; x <= x1; x++) if (this.get(x, y) === '.') this.set(x, y, c);
    return this;
  }
  mirrorX() { const g = this.clone(); g.px = g.px.map(r => r.slice().reverse()); return g; }
  rows() { return this.px.map(r => r.join('')); }
}

export function sprite(...grids) {
  return { w: grids[0].w, h: grids[0].h, frames: grids.map(g => g.rows()) };
}
