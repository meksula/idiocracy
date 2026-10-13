// Renderer swiata na canvasie: kafelki, obiekty, postacie, nazwy, dymki, markery misji.
import { spriteCanvas, clearSpriteCache, PALETTE } from '../palette.js';
import { characterCanvas } from '../charsprite.js';

export const TILE = 16;
/** Minimalna liczba kafelkow widocznych w poziomie - od niej zalezy skala pikseli. */
const MIN_VIEW_TILES = 15;

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.cam = { x: 0, y: 0 };
    this.hover = null;
    this.resize(720, 528);
  }

  /** Dopasowuje rozdzielczosc canvasa do kontenera; skala pikseli zawsze calkowita. */
  resize(w, h) {
    const scale = Math.max(2, Math.min(4, Math.floor(w / (MIN_VIEW_TILES * TILE))));
    if (scale !== this.scale) clearSpriteCache();
    this.scale = scale;
    this.ts = TILE * scale;
    this.canvas.width = Math.max(this.ts * 9, Math.floor(w / scale) * scale);
    this.canvas.height = Math.max(this.ts * 7, Math.floor(h / scale) * scale);
    this.ctx.imageSmoothingEnabled = false;
  }

  tileCanvas(code, now) {
    const t = this.game.tiles.get(code);
    if (!t) return null;
    const frame = t.sprite.frames.length > 1 ? Math.floor(now / 600) % t.sprite.frames.length : 0;
    return spriteCanvas(t.sprite, frame, this.scale, `tile:${code}:${this.game.contentVersion}`);
  }

  updateCamera(now) {
    const { map, me } = this.game;
    const p = this.game.renderPos(me, now);
    const W = this.canvas.width, H = this.canvas.height;
    const mw = map.width * this.ts, mh = map.height * this.ts;
    let cx = p.x * this.ts + this.ts / 2 - W / 2;
    let cy = p.y * this.ts + this.ts / 2 - H / 2;
    cx = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, cx));
    cy = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, cy));
    this.cam.x = Math.round(cx / this.scale) * this.scale;
    this.cam.y = Math.round(cy / this.scale) * this.scale;
  }

  screenToTile(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * (this.canvas.width / r.width);
    const py = (clientY - r.top) * (this.canvas.height / r.height);
    return { x: Math.floor((px + this.cam.x) / this.ts), y: Math.floor((py + this.cam.y) / this.ts) };
  }

  draw(now) {
    const { ctx, game } = this;
    const { map } = game;
    if (!map) return;
    this.updateCamera(now);
    const W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = PALETTE['0'];
    ctx.fillRect(0, 0, W, H);

    const x0 = Math.max(0, Math.floor(this.cam.x / this.ts)), y0 = Math.max(0, Math.floor(this.cam.y / this.ts));
    const x1 = Math.min(map.width - 1, Math.floor((this.cam.x + W) / this.ts)), y1 = Math.min(map.height - 1, Math.floor((this.cam.y + H) / this.ts));
    const sx = (x) => x * this.ts - this.cam.x, sy = (y) => y * this.ts - this.cam.y;

    // 1. grunt
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = this.tileCanvas(map.ground[y * map.width + x], now);
      if (c) ctx.drawImage(c, sx(x), sy(y));
    }
    // 2. portale (podswietlenie na ziemi)
    const pulse = 0.35 + 0.25 * Math.sin(now / 250);
    for (const p of map.portals) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      ctx.fillStyle = `rgba(63, 224, 208, ${pulse})`;
      ctx.fillRect(sx(p.x) + 6, sy(p.y) + 6, this.ts - 12, this.ts - 12);
      ctx.strokeStyle = PALETTE.n;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx(p.x) + 4.5, sy(p.y) + 4.5, this.ts - 9, this.ts - 9);
    }
    // 3. hover
    if (this.hover && this.hover.x >= 0 && this.hover.y >= 0 && this.hover.x < map.width && this.hover.y < map.height) {
      ctx.strokeStyle = game.walkable(this.hover.x, this.hover.y) || game.npcAt(this.hover.x, this.hover.y) ? 'rgba(244,244,240,0.55)' : 'rgba(255,90,74,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx(this.hover.x) + 1.5, sy(this.hover.y) + 1.5, this.ts - 3, this.ts - 3);
    }
    // 4. obiekty + postacie, rzad po rzedzie (prosty y-sort)
    const ents = [];
    for (const n of map.npcs) ents.push({ kind: 'npc', e: n, x: n.x, y: n.y });
    for (const p of game.players.values()) { const r = game.renderPos(p, now); ents.push({ kind: 'player', e: p, ...r }); }
    const mp = game.renderPos(game.me, now);
    ents.push({ kind: 'me', e: game.me, ...mp });
    ents.sort((a, b) => a.y - b.y);
    let ei = 0;
    for (let y = y0; y <= y1 + 1; y++) {
      if (y <= y1) for (let x = x0; x <= x1; x++) {
        const code = map.objects[y * map.width + x];
        if (!code) continue;
        const c = this.tileCanvas(code, now);
        if (c) ctx.drawImage(c, sx(x), sy(y));
      }
      while (ei < ents.length && Math.ceil(ents[ei].y - 0.001) <= y) this.drawEntity(ents[ei++], now, sx, sy);
    }
    while (ei < ents.length) this.drawEntity(ents[ei++], now, sx, sy);
    // 5. nazwy, markery, dymki - zawsze na wierzchu
    for (const en of ents) this.drawOverlay(en, now, sx, sy);
    // 6. winieta
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawEntity(en, now, sx, sy) {
    const { e } = en;
    const frame = en.kind === 'npc' ? 0 : this.game.walkFrame(e, now);
    const dir = en.kind === 'npc' ? (e.dir || 'S') : e.dir;
    const c = characterCanvas(e.app, dir, frame, this.scale);
    const px = Math.round(en.x * this.ts - this.cam.x), py = Math.round(en.y * this.ts - this.cam.y);
    this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.ctx.fillRect(px + 12, py + this.ts - 6, this.ts - 24, 4);
    this.ctx.drawImage(c, px, py - this.scale * 2);
  }

  drawOverlay(en, now, sx, sy) {
    const { ctx } = this;
    const { e } = en;
    const px = en.x * this.ts - this.cam.x + this.ts / 2, py = en.y * this.ts - this.cam.y - 8;
    ctx.font = '18px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const label = en.kind === 'npc' ? e.name : `${e.name} [${e.level}]`;
    ctx.fillStyle = en.kind === 'npc' ? PALETTE.O : en.kind === 'me' ? PALETTE.n : PALETTE['6'];
    const hovered = this.hover && en.kind === 'npc' && this.hover.x === e.x && this.hover.y === e.y;
    if (en.kind !== 'npc' || hovered || this.game.showNames) {
      ctx.strokeText(label, px, py);
      ctx.fillText(label, px, py);
    }
    if (en.kind === 'npc') {
      const mark = this.game.marks[e.code];
      if (mark) {
        const bob = Math.sin(now / 200) * 3;
        ctx.font = '32px Silkscreen, VT323, monospace';
        ctx.fillStyle = mark === '!' ? PALETTE.y : PALETTE.n;
        ctx.lineWidth = 4;
        const my = py - (hovered || this.game.showNames ? 18 : 0) + bob;
        ctx.strokeText(mark, px, my);
        ctx.fillText(mark, px, my);
      }
    }
    if (e.bubble && e.bubble.until > now) this.drawBubble(e.bubble.text, px, py - 22);
  }

  drawBubble(text, cx, bottom) {
    const { ctx } = this;
    ctx.font = '18px VT323, monospace';
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > 200 && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 4);
    const w = Math.min(220, Math.max(...shown.map(l => ctx.measureText(l).width)) + 14);
    const h = shown.length * 17 + 8;
    const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
    ctx.fillStyle = 'rgba(244,244,240,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(cx - 4, y + h, 8, 4);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = PALETTE['1'];
    ctx.textAlign = 'center';
    shown.forEach((l, i) => ctx.fillText(l, cx, y + 17 + i * 17));
  }
}

/** Minimapa: kazdy kafelek jako 1 piksel w sredniej barwie sprite'a. */
export function drawMinimap(canvas, game) {
  const { map } = game;
  if (!map) return;
  const s = Math.max(1, Math.floor(Math.min(canvas.width / map.width, canvas.height / map.height)));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ox = Math.floor((canvas.width - map.width * s) / 2), oy = Math.floor((canvas.height - map.height * s) / 2);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    ctx.fillStyle = game.tileColor(map.objects[i]) || game.tileColor(map.ground[i]) || '#000';
    ctx.fillRect(ox + x * s, oy + y * s, s, s);
  }
  ctx.fillStyle = PALETTE.O;
  for (const n of map.npcs) ctx.fillRect(ox + n.x * s, oy + n.y * s, s, s);
  ctx.fillStyle = PALETTE['6'];
  for (const p of game.players.values()) ctx.fillRect(ox + p.x * s, oy + p.y * s, s, s);
  ctx.fillStyle = PALETTE.n;
  for (const p of map.portals) ctx.fillRect(ox + p.x * s, oy + p.y * s, s, s);
  ctx.fillStyle = PALETTE.X;
  ctx.fillRect(ox + game.me.x * s - 1, oy + game.me.y * s - 1, s + 2, s + 2);
}
