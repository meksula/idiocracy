// Edytor pixel-artu ograniczony do palety gry - gwarancja spojnosci grafiki.
// Obsluguje klatki animacji, wypelnianie, pipete, auto-kontur, cofanie oraz
// import/eksport tekstowy (do wymiany z Claude lub innym grafikiem).
import { PALETTE, PALETTE_GROUPS, spriteCanvas } from '../palette.js';
import { el } from '../ui.js';

const TOOLS = [
  ['pencil', 'Ołówek', 'B'],
  ['eraser', 'Gumka', 'E'],
  ['fill', 'Wiadro', 'G'],
  ['picker', 'Pipeta', 'I'],
];

export function emptySprite(w = 16, h = 16, fill = '.') {
  return { w, h, frames: [Array.from({ length: h }, () => fill.repeat(w))] };
}

export class PixelEditor {
  /** opts: { tiledPreview: bool, onChange(sprite) } */
  constructor(sprite, opts = {}) {
    this.opts = opts;
    this.zoom = 22;
    this.tool = 'pencil';
    this.color = '0';
    this.frame = 0;
    this.grid = true;
    this.undo = [];
    this.animFrame = 0;
    this.root = el('div', { class: 'pixed' });
    this.load(sprite);
    this.build();
  }

  load(sprite) {
    const s = sprite || emptySprite();
    this.w = s.w; this.h = s.h;
    this.frames = s.frames.map(f => f.map(r => [...r]));
    this.frame = Math.min(this.frame, this.frames.length - 1);
    if (this.canvas) this.redraw();
  }

  sprite() {
    return { w: this.w, h: this.h, frames: this.frames.map(f => f.map(r => r.join(''))) };
  }

  build() {
    this.canvas = el('canvas', { class: 'pixel pixed-canvas', width: this.w * this.zoom, height: this.h * this.zoom });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    let painting = false;
    const at = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / (r.width / this.w)), Math.floor((e.clientY - r.top) / (r.height / this.h))];
    };
    this.canvas.addEventListener('mousedown', (e) => {
      const [x, y] = at(e);
      this.pushUndo();
      if (e.button === 2) { this.pick(x, y); return; }
      painting = true;
      this.apply(x, y);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const [x, y] = at(e);
      this.coords.textContent = `${x}, ${y}`;
      if (painting && (this.tool === 'pencil' || this.tool === 'eraser')) this.apply(x, y);
    });
    addEventListener('mouseup', () => { if (painting) { painting = false; this.changed(); } });

    this.swatches = el('div', { class: 'pixed-palette' });
    const transparent = el('div', { class: 'swatch transparent', title: '. (przezroczysty)', onclick: () => this.setColor('.') });
    transparent.dataset.key = '.';
    this.swatches.append(el('div', { class: 'pal-group' }, el('span', { text: 'Brak' }), transparent));
    for (const g of PALETTE_GROUPS) {
      const row = el('div', { class: 'pal-group' }, el('span', { text: g.name }));
      for (const k of g.keys) {
        const sw = el('div', { class: 'swatch', title: `${k}  ${PALETTE[k]}`, style: { background: PALETTE[k] }, onclick: () => this.setColor(k) });
        sw.dataset.key = k;
        row.append(sw);
      }
      this.swatches.append(row);
    }

    this.toolBtns = TOOLS.map(([id, name, key]) => {
      const b = el('button', { class: 'secondary small', title: `${name} [${key}]`, onclick: () => this.setTool(id) }, name);
      b.dataset.tool = id;
      return b;
    });

    this.frameLabel = el('span', { class: 'muted' });
    this.coords = el('span', { class: 'muted' }, '–');
    this.preview = el('canvas', { class: 'pixel pixed-preview', width: this.w * 3 * 3, height: this.h * 3 * 3 });
    this.io = el('textarea', { class: 'pixed-io', rows: 6, spellcheck: 'false', placeholder: 'Wklej tu sprite: JSON {w,h,frames} albo same wiersze znaków (16 linii po 16 znaków).' });

    const b = (label, fn, cls = 'secondary small', title = '') => el('button', { class: cls, onclick: fn, title }, label);
    this.root.append(
      el('div', { class: 'pixed-main' },
        el('div', {},
          this.canvas,
          el('div', { class: 'row wrap pixed-tools' }, ...this.toolBtns, el('span', { class: 'spacer' }), this.coords),
          el('div', { class: 'row wrap pixed-tools' },
            b('Cofnij', () => this.doUndo(), 'secondary small', 'Ctrl+Z'),
            b('Auto-kontur', () => { this.pushUndo(); this.outline(); this.changed(); }, 'neon small', 'Dodaje czarny kontur (0) wokół kształtu — zasada nr 1 stylu'),
            b('Odbij ↔', () => { this.pushUndo(); this.cur = this.cur.map(r => r.reverse()); this.changed(); }),
            b('←', () => this.shift(-1, 0)), b('→', () => this.shift(1, 0)), b('↑', () => this.shift(0, -1)), b('↓', () => this.shift(0, 1)),
            b('Wyczyść', () => { this.pushUndo(); this.cur = this.cur.map(r => r.map(() => '.')); this.changed(); }),
            b('Siatka', () => { this.grid = !this.grid; this.redraw(); }),
          ),
          el('div', { class: 'row wrap pixed-tools' },
            el('span', { text: 'Klatki:' }), this.frameLabel,
            b('◀', () => this.setFrame(this.frame - 1)), b('▶', () => this.setFrame(this.frame + 1)),
            b('+ kopia', () => { this.pushUndo(); this.frames.splice(this.frame + 1, 0, this.cur.map(r => r.slice())); this.setFrame(this.frame + 1); this.changed(); }),
            b('Usuń klatkę', () => { if (this.frames.length < 2) return; this.pushUndo(); this.frames.splice(this.frame, 1); this.setFrame(this.frame - 1); this.changed(); }),
          ),
        ),
        el('div', { class: 'pixed-side' },
          this.swatches,
          el('div', { class: 'muted', style: { marginTop: '8px' } }, 'Podgląd (3×, animacja):'),
          this.preview,
          el('div', { class: 'muted small-text' }, 'PPM na płótnie = pipeta.'),
        ),
      ),
      el('details', { class: 'pixed-details' },
        el('summary', {}, 'Import / eksport tekstowy (format do wymiany z Claude)'),
        this.io,
        el('div', { class: 'row' },
          b('Eksportuj ↓', () => { this.io.value = JSON.stringify(this.sprite()); this.io.select(); }),
          b('Importuj ↑', () => this.importText(), 'neon small'),
        ),
      ),
    );

    this.root.tabIndex = 0;
    this.root.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.doUndo(); return; }
      const t = TOOLS.find(([, , k]) => k.toLowerCase() === e.key.toLowerCase());
      if (t) this.setTool(t[0]);
    });

    this.setTool('pencil');
    this.setColor('0');
    this.redraw();
    clearInterval(this.anim);
    this.animFrame = 0;
    this.anim = setInterval(() => { this.animFrame++; this.drawPreview(); }, 500);
  }

  get cur() { return this.frames[this.frame]; }
  set cur(v) { this.frames[this.frame] = v; }

  setTool(t) { this.tool = t; this.toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === t)); }
  setColor(k) { this.color = k; this.swatches.querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', s.dataset.key === k)); }
  setFrame(i) { this.frame = (i + this.frames.length) % this.frames.length; this.redraw(); }

  pushUndo() {
    this.undo.push(JSON.stringify({ frames: this.frames, frame: this.frame }));
    if (this.undo.length > 60) this.undo.shift();
  }
  doUndo() {
    const s = this.undo.pop();
    if (!s) return;
    const st = JSON.parse(s);
    this.frames = st.frames; this.frame = st.frame;
    this.changed();
  }

  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  apply(x, y) {
    if (!this.inb(x, y)) return;
    if (this.tool === 'pencil') this.cur[y][x] = this.color;
    else if (this.tool === 'eraser') this.cur[y][x] = '.';
    else if (this.tool === 'picker') { this.pick(x, y); return; }
    else if (this.tool === 'fill') { this.flood(x, y, this.color); this.changed(); return; }
    this.redraw();
  }

  pick(x, y) { if (this.inb(x, y)) { this.setColor(this.cur[y][x]); this.setTool('pencil'); } }

  flood(x, y, c) {
    const from = this.cur[y][x];
    if (from === c) return;
    const st = [[x, y]];
    while (st.length) {
      const [a, b] = st.pop();
      if (!this.inb(a, b) || this.cur[b][a] !== from) continue;
      this.cur[b][a] = c;
      st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  }

  outline() {
    const src = this.cur.map(r => r.slice());
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src[y][x] !== '.') continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = this.inb(x + dx, y + dy) ? src[y + dy][x + dx] : '.';
        return v !== '.' && v !== '0';
      });
      if (n) this.cur[y][x] = '0';
    }
  }

  shift(dx, dy) {
    this.pushUndo();
    const src = this.cur.map(r => r.slice());
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const sx = (x - dx + this.w) % this.w, sy = (y - dy + this.h) % this.h;
      this.cur[y][x] = src[sy][sx];
    }
    this.changed();
  }

  importText() {
    const raw = this.io.value.trim();
    try {
      let s;
      if (raw.startsWith('{')) s = JSON.parse(raw);
      else if (raw.startsWith('[')) s = { frames: [JSON.parse(raw)] };
      else s = { frames: [raw.split(/\r?\n/).map(r => r.trim()).filter(Boolean)] };
      if (Array.isArray(s.frames) && typeof s.frames[0] === 'string') s.frames = [s.frames];
      const rows = s.frames[0];
      s.h = s.h || rows.length;
      s.w = s.w || rows[0].length;
      const bad = new Set();
      for (const f of s.frames) {
        if (f.length !== s.h || f.some(r => r.length !== s.w)) throw new Error(`Każda klatka musi mieć ${s.w}×${s.h}`);
        for (const r of f) for (const ch of r) if (ch !== '.' && !PALETTE[ch]) bad.add(ch);
      }
      if (bad.size) throw new Error(`Znaki spoza palety: ${[...bad].join(' ')}`);
      if (s.w !== this.w || s.h !== this.h) throw new Error(`Ten edytor oczekuje ${this.w}×${this.h}`);
      this.pushUndo();
      this.load(s);
      this.changed();
    } catch (e) {
      alert(`Nie udało się zaimportować: ${e.message}`);
    }
  }

  changed() { this.redraw(); this.opts.onChange?.(this.sprite()); }

  redraw() {
    const ctx = this.canvas.getContext('2d');
    const z = this.zoom;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#1a1c22' : '#121318';
      ctx.fillRect(x * z, y * z, z, z);
      const c = PALETTE[this.cur[y][x]];
      if (c) { ctx.fillStyle = c; ctx.fillRect(x * z, y * z, z, z); }
    }
    if (this.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= this.w; i++) { ctx.beginPath(); ctx.moveTo(i * z + 0.5, 0); ctx.lineTo(i * z + 0.5, this.h * z); ctx.stroke(); }
      for (let i = 0; i <= this.h; i++) { ctx.beginPath(); ctx.moveTo(0, i * z + 0.5); ctx.lineTo(this.w * z, i * z + 0.5); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(232,160,74,0.25)';
      ctx.beginPath(); ctx.moveTo(this.w / 2 * z + 0.5, 0); ctx.lineTo(this.w / 2 * z + 0.5, this.h * z); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, this.h / 2 * z + 0.5); ctx.lineTo(this.w * z, this.h / 2 * z + 0.5); ctx.stroke();
    }
    this.frameLabel.textContent = `${this.frame + 1}/${this.frames.length}`;
    this.drawPreview();
  }

  drawPreview() {
    const ctx = this.preview.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, this.preview.width, this.preview.height);
    const s = this.sprite();
    const img = spriteCanvas(s, this.animFrame % s.frames.length, 3);
    if (this.opts.tiledPreview) {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(img, x * img.width, y * img.height);
    } else {
      if (this.opts.backdrop) {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(this.opts.backdrop(), x * img.width, y * img.height);
      }
      ctx.drawImage(img, img.width, img.height);
    }
  }

  destroy() { clearInterval(this.anim); }
}
