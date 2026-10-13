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
    this.flipped = new Map();
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
    for (const mo of game.monsters.values()) { const r = game.renderPos(mo, now); ents.push({ kind: 'monster', e: mo, ...r }); }
    for (const n of game.pendingFlee) ents.push({ kind: 'ghost', e: n, x: n.x, y: n.y, alpha: 1, frame: 0 });
    for (const gh of game.ghosts) {
      if (gh.kind === 'flee') {
        const t = Math.max(0, Math.min(1, (now - gh.start) / (gh.until - gh.start)));
        const f = t * (gh.points.length - 1);
        const i = Math.min(gh.points.length - 2, Math.floor(f));
        const a = gh.points[i], b = gh.points[i + 1], k = f - i;
        const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ents.push({ kind: 'ghost', e: { ...gh.e, dir: b.dir }, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, alpha, frame: Math.floor(now / 90) % 2 ? 1 : 2 });
      } else {
        ents.push({ kind: 'corpse', e: gh.e, x: gh.e.x, y: gh.e.y, alpha: Math.min(1, 1 - (now - gh.start) / (gh.until - gh.start)) });
      }
    }
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
    // 5. nazwy, markery, paski HP, dymki - zawsze na wierzchu
    for (const en of ents) if (en.kind !== 'ghost' && en.kind !== 'corpse') this.drawOverlay(en, now, sx, sy);
    this.drawFloats(now);
    // 6. winieta
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  monsterCanvas(e, frame) {
    const tpl = this.game.monsterTpl.get(e.code);
    if (!tpl) return null;
    const c = spriteCanvas(tpl.sprite, frame, this.scale, `mon:${e.code}:${this.game.contentVersion}`);
    if (e.dir !== 'W') return c;
    const key = `mon:${e.code}:${this.game.contentVersion}:${frame}:${this.scale}:W`;
    let f = this.flipped.get(key);
    if (!f) {
      f = document.createElement('canvas');
      f.width = c.width; f.height = c.height;
      const fx = f.getContext('2d');
      fx.translate(c.width, 0); fx.scale(-1, 1); fx.drawImage(c, 0, 0);
      this.flipped.set(key, f);
    }
    return f;
  }

  drawEntity(en, now, sx, sy) {
    const { e } = en;
    const ctx = this.ctx;
    const px = Math.round(en.x * this.ts - this.cam.x), py = Math.round(en.y * this.ts - this.cam.y);
    if (en.kind === 'monster' || en.kind === 'corpse') {
      if (en.kind === 'monster' && this.game.target === e.id) {
        ctx.strokeStyle = PALETTE.X;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, this.ts - 2, this.ts - 2);
      }
      const moving = en.kind === 'monster' && this.game.isMoving(e, now);
      const c = this.monsterCanvas(e, moving ? (Math.floor(now / 120) % 2) : 0);
      if (!c) return;
      ctx.save();
      if (en.kind === 'corpse') { ctx.globalAlpha = Math.max(0, en.alpha); ctx.filter = 'grayscale(1) brightness(0.6)'; }
      const flash = en.kind === 'monster' && e.hitAt && now - e.hitAt < 120;
      if (flash) ctx.filter = 'brightness(2.2)';
      ctx.drawImage(c, px, py);
      ctx.restore();
      return;
    }
    if (en.kind === 'ghost') {
      ctx.save();
      ctx.globalAlpha = Math.max(0, en.alpha);
      ctx.drawImage(characterCanvas(e.app, e.dir, en.frame, this.scale), px, py - this.scale * 2);
      ctx.restore();
      return;
    }
    const frame = en.kind === 'npc' ? 0 : this.game.walkFrame(e, now);
    const dir = en.kind === 'npc' ? (e.dir || 'S') : e.dir;
    const c = characterCanvas(e.app, dir, frame, this.scale);
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
    ctx.fillStyle = en.kind === 'npc' ? PALETTE.O : en.kind === 'monster' ? PALETTE.X : en.kind === 'me' ? PALETTE.n : PALETTE['6'];
    const hovered = this.hover && (en.kind === 'npc' || en.kind === 'monster') && this.hover.x === e.x && this.hover.y === e.y;
    const targeted = en.kind === 'monster' && this.game.target === e.id;
    const hurt = e.maxHp && e.hp < e.maxHp;
    if (en.kind === 'monster' && (hurt || targeted || hovered)) this.drawHpBar(px, py + 2, e.hp, e.maxHp);
    else if ((en.kind === 'me' || en.kind === 'player') && hurt) this.drawHpBar(px, py + 2, e.hp, e.maxHp);
    const quiet = en.kind === 'npc' || en.kind === 'monster';
    if (!quiet || hovered || targeted || this.game.showNames) {
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

  drawHpBar(cx, y, hp, max) {
    const { ctx } = this;
    const w = Math.round(this.ts * 0.7), h = 5;
    const x = Math.round(cx - w / 2);
    const f = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = f > 0.5 ? PALETTE.l : f > 0.25 ? PALETTE.O : PALETTE.X;
    ctx.fillRect(x, y, Math.round(w * f), h);
  }

  drawFloats(now) {
    const { ctx } = this;
    ctx.font = '22px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    for (const f of this.game.floats) {
      const t = (now - f.start) / 1000;
      const x = f.x * this.ts - this.cam.x + this.ts / 2;
      const y = f.y * this.ts - this.cam.y + this.ts / 3 - t * this.ts * 0.8;
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.fillStyle = PALETTE[f.color] || PALETTE.y;
      ctx.strokeText(f.text, x, y);
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
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
  ctx.fillStyle = PALETTE.x;
  for (const mo of game.monsters.values()) ctx.fillRect(ox + mo.x * s, oy + mo.y * s, s, s);
  ctx.fillStyle = PALETTE['6'];
  for (const p of game.players.values()) ctx.fillRect(ox + p.x * s, oy + p.y * s, s, s);
  ctx.fillStyle = PALETTE.n;
  for (const p of map.portals) ctx.fillRect(ox + p.x * s, oy + p.y * s, s, s);
  ctx.fillStyle = PALETTE.X;
  ctx.fillRect(ox + game.me.x * s - 1, oy + game.me.y * s - 1, s + 2, s + 2);
}
