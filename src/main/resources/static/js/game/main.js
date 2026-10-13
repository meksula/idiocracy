// Klient gry: stan swiata, siec (WebSocket), sterowanie, walka i petla renderowania.
// Ruch jest przewidywany lokalnie (plynnosc), ale serwer ma ostatnie slowo ("correct").
import { api, requireSession } from '../api.js';
import { clearSpriteCache, spriteCanvas } from '../palette.js';
import { Renderer, drawMinimap } from './renderer.js';
import { Hud } from './hud.js';
import { findPath, DELTA } from './path.js';

const KEYMAP = {
  ArrowUp: 'N', KeyW: 'N', ArrowDown: 'S', KeyS: 'S', ArrowLeft: 'W', KeyA: 'W', ArrowRight: 'E', KeyD: 'E',
};
const TALK_RANGE = 2;
const BUBBLE_MS = 5000;
const FLOAT_MS = 1200;
const FLEE_TILES = 7;
const FLEE_STEP_MS = 115;

class Game {
  constructor() {
    this.session = requireSession();
    this.characterId = new URLSearchParams(location.search).get('character');
    if (!this.characterId) location.href = '/characters.html';
    this.tiles = new Map();
    this.items = new Map();
    this.monsterTpl = new Map();
    this.tileColors = new Map();
    this.contentVersion = 0;
    this.map = null;
    this.npcPos = new Map();
    this.marks = {};
    this.players = new Map();
    this.monsters = new Map();
    this.ghosts = [];
    this.pendingFlee = [];
    this.pendingRuns = [];
    this.floats = [];
    this.target = null;
    this.me = null;
    this.self = null;
    this.inventory = [];
    this.quests = [];
    this.held = [];
    this.path = [];
    this.pendingTalk = null;
    this.seq = 0;
    this.showNames = false;
    this.ws = null;
    this.hud = new Hud(this);
    this.hud.onDialogClosed = () => this.releaseFlee();
    this.renderer = new Renderer(document.getElementById('world'), this);
  }

  async start() {
    await this.loadContent();
    this.bindInput();
    this.bindResize();
    this.connect();
    const loop = (now) => { this.tick(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => this.ping(), 5000);
  }

  async loadContent() {
    const c = await api('/api/content/bootstrap');
    this.tiles = new Map(c.tiles.map(t => [t.code, t]));
    this.items = new Map(c.items.map(i => [i.code, i]));
    this.monsterTpl = new Map((c.monsters || []).map(m => [m.code, m]));
    this.contentVersion++;
    this.tileColors.clear();
    clearSpriteCache('tile:');
    clearSpriteCache('icon:');
    clearSpriteCache('mon:');
  }

  // ================================================================ siec
  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/game?token=${encodeURIComponent(this.session.token)}&character=${this.characterId}`);
    this.ws = ws;
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      const dup = e.reason === 'duplicate';
      document.getElementById('disconnected').classList.remove('hidden');
      document.getElementById('disc-reason').textContent = dup
        ? 'Ta postać weszła do gry z innego okna.'
        : 'Połączenie z serwerem zostało przerwane.';
    };
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  ping() {
    this.send({ t: 'ping', ts: Date.now() });
  }

  onMessage(m) {
    const now = performance.now();
    switch (m.t) {
      case 'welcome':
        document.title = `${m.you.name} — ${m.title}`;
        this.hud.log('system', `Witaj, ${m.you.name}. WASD lub klik — ruch, E — rozmowa, klik na wroga lub Spacja — atak, H — pomoc.`);
        this.inventory = m.inventory;
        this.quests = m.quests;
        this.enterMap(m);
        this.hud.renderInventory();
        this.hud.renderQuests();
        break;
      case 'enter':
        this.enterMap(m);
        this.hud.log('system', `Wchodzisz: ${m.map.name}`);
        break;
      case 'mapReload':
        this.setMap(m.map);
        this.marks = m.marks;
        if (m.monsters) this.setMonsters(m.monsters);
        break;
      case 'npcs':
        this.updateNpcs(m.npcs);
        this.marks = m.marks;
        break;
      case 'self':
        this.applySelf(m.you);
        break;
      case 'hp':
        if (this.self) { this.self.hp = m.hp; this.self.maxHp = m.maxHp; this.hud.renderSelf(); }
        if (this.me) { this.me.hp = m.hp; this.me.maxHp = m.maxHp; }
        break;
      case 'join':
        this.players.set(m.player.id, this.entity(m.player));
        break;
      case 'leave':
        this.players.delete(m.id);
        break;
      case 'update': {
        const p = this.players.get(m.player.id);
        if (p) Object.assign(p, { app: m.player.app, level: m.player.level, name: m.player.name });
        break;
      }
      case 'moved': {
        const p = this.players.get(m.id);
        if (p) this.slide(p, m, now);
        break;
      }
      case 'face': {
        const p = this.players.get(m.id);
        if (p) p.dir = m.dir;
        break;
      }
      case 'correct':
        Object.assign(this.me, { x: m.x, y: m.y, fromX: m.x, fromY: m.y, moveStart: 0, dir: m.dir });
        this.path = [];
        break;
      // ---------------------------------------------------------- walka
      case 'mspawn':
        this.monsters.set(m.monster.id, this.entity(m.monster));
        break;
      case 'mmove': {
        const mo = this.monsters.get(m.id);
        if (mo) this.slide(mo, m, now);
        break;
      }
      case 'mdie': {
        const mo = this.monsters.get(m.id);
        if (mo) this.ghosts.push({ kind: 'corpse', e: mo, start: now, until: now + 700 });
        this.monsters.delete(m.id);
        if (this.target === m.id) this.setTarget(null, false);
        break;
      }
      case 'hit':
        this.onHit(m, now);
        break;
      case 'target':
        this.target = m.id;
        this.hud.renderTarget();
        break;
      // ----------------------------------------------------------- reszta
      case 'chat': {
        const who = m.id === this.me?.id ? this.me : this.players.get(m.id);
        if (who) who.bubble = { text: m.text, until: now + BUBBLE_MS };
        this.hud.log('chat', m.text, m.from);
        break;
      }
      case 'system':
        this.hud.log('system', m.text);
        break;
      case 'error':
        this.hud.log('error', m.text);
        break;
      case 'dialog':
        this.hud.openDialog(m);
        break;
      case 'quests':
        this.quests = m.quests;
        this.hud.renderQuests();
        break;
      case 'npcMarks':
        this.marks = m.marks;
        break;
      case 'inventory':
        this.inventory = m.items;
        this.hud.renderInventory();
        break;
      case 'content':
        if (['tiles', 'items', 'monsters'].includes(m.type)) {
          this.loadContent().then(() => { this.hud.renderInventory(); this.redrawMinimap(); });
        }
        this.hud.log('system', `[edytor] zaktualizowano: ${m.type}/${m.code}`);
        break;
      case 'pong':
        document.getElementById('ping').textContent = `${Date.now() - m.ts} ms`;
        break;
      default:
        break;
    }
  }

  enterMap(m) {
    this.players.clear();
    for (const p of m.players) this.players.set(p.id, this.entity(p));
    this.setMonsters(m.monsters || []);
    this.ghosts = [];
    this.pendingFlee = [];
    this.pendingRuns = [];
    this.floats = [];
    this.me = this.entity(m.you);
    this.marks = m.marks || {};
    this.path = [];
    this.pendingTalk = null;
    this.setTarget(null, false);
    this.hud.closeDialog();
    this.setMap(m.map);
    this.applySelf(m.you);
  }

  setMap(map) {
    this.map = map;
    this.npcPos = new Map(map.npcs.map(n => [`${n.x},${n.y}`, n]));
    this.redrawMinimap();
  }

  setMonsters(list) {
    this.monsters = new Map(list.map(mo => [mo.id, this.entity(mo)]));
    if (this.target && !this.monsters.has(this.target)) this.setTarget(null, false);
  }

  /**
   * Zmiany NPC w ramach misji: kto zniknal - odbiega, kto sie pojawil z "arrive" - przybiega
   * (i moze sam zagadac), kto zmienil miejsce - przechodzi. Animacje ruszaja po zamknieciu dialogu.
   */
  updateNpcs(npcs) {
    const before = new Map(this.map.npcs.map(n => [n.code, n]));
    const after = new Set(npcs.map(n => n.code));
    for (const n of this.map.npcs) if (!after.has(n.code)) this.pendingFlee.push(n);
    for (const n of npcs) {
      const old = before.get(n.code);
      const from = n.arrive && !old ? n.arrive : old && (old.x !== n.x || old.y !== n.y) ? { x: old.x, y: old.y } : n.arrive;
      if (!from || (from.x === n.x && from.y === n.y)) continue;
      n.hidden = true;
      this.pendingRuns.push({ npc: n, from, autoTalk: !!n.autoTalk, standIn: old });
    }
    this.map.npcs = npcs;
    this.npcPos = new Map(npcs.map(n => [`${n.x},${n.y}`, n]));
    if (!this.hud.dialogOpen) this.releaseFlee();
  }

  /** Uciekajacy NPC biegnie do swojego punktu ucieczki (A*), a bez niego - prosto od gracza. */
  releaseFlee() {
    const t = performance.now();
    for (const n of this.pendingFlee) {
      let dirs = null;
      if (n.flee) dirs = findPath(n.x, n.y, n.flee.x, n.flee.y, (a, b) => this.tileFree(a, b), { maxNodes: 3000 });
      if (!dirs || !dirs.length) {
        const dx = n.x - this.me.x, dy = n.y - this.me.y;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
        dirs = Array(FLEE_TILES).fill(dir);
      }
      const points = [{ x: n.x, y: n.y, dir: dirs[0] }];
      for (const d of dirs) {
        const last = points[points.length - 1];
        points.push({ x: last.x + DELTA[d][0], y: last.y + DELTA[d][1], dir: d });
      }
      this.ghosts.push({ kind: 'flee', e: n, points, start: t, until: t + dirs.length * FLEE_STEP_MS });
    }
    const delay = this.pendingFlee.length ? 600 : 0;
    this.pendingFlee = [];
    for (const r of this.pendingRuns) this.startRun(r, t + delay);
    this.pendingRuns = [];
  }

  /** NPC przebiega (A*) z punktu from na swoje nowe miejsce; po dobiegnieciu moze zaczac rozmowe. */
  startRun(run, start) {
    const n = run.npc;
    const dirs = findPath(run.from.x, run.from.y, n.x, n.y, (a, b) => this.tileFree(a, b), { maxNodes: 3000 }) || [];
    const points = [{ x: run.from.x, y: run.from.y, dir: dirs[0] || n.dir }];
    for (const d of dirs) {
      const last = points[points.length - 1];
      points.push({ x: last.x + DELTA[d][0], y: last.y + DELTA[d][1], dir: d });
    }
    if (points.length < 2) points.push({ x: n.x, y: n.y, dir: n.dir });
    const until = start + (points.length - 1) * FLEE_STEP_MS;
    this.ghosts.push({
      kind: 'run', e: n, points, start, until, wait: run.standIn,
      onDone: () => {
        n.hidden = false;
        const last = points[points.length - 1];
        n.dir = last.dir;
        if (run.autoTalk && this.map.npcs.includes(n)) {
          const dx = this.me.x - n.x, dy = this.me.y - n.y;
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
          this.tryTalk(n);
        }
      },
    });
  }

  applySelf(you) {
    this.self = you;
    if (this.me) Object.assign(this.me, { app: you.app, level: you.level, ms: you.ms, name: you.name, hp: you.hp, maxHp: you.maxHp });
    this.hud.renderSelf();
  }

  entity(p) {
    return { ...p, fromX: p.x, fromY: p.y, moveStart: 0, moveDur: p.ms || 260, step: 0, bubble: null };
  }

  slide(e, m, now) {
    const cur = this.renderPos(e, now);
    Object.assign(e, { fromX: cur.x, fromY: cur.y, x: m.x, y: m.y, dir: m.dir, moveStart: now, moveDur: m.ms, step: e.step + 1 });
  }

  // ============================================================== walka
  onHit(m, now) {
    let e;
    if (m.kind === 'm') e = this.monsters.get(m.id);
    else e = m.id === this.me?.id ? this.me : this.players.get(m.id);
    if (!e) return;
    e.hp = m.hp;
    e.maxHp = m.maxHp;
    e.hitAt = now;
    const hurtMe = m.kind === 'p' && m.id === this.me.id;
    const byMe = m.kind === 'm' && m.from === this.me.id;
    const pos = this.renderPos(e, now);
    this.floats.push({
      x: pos.x, y: pos.y, text: `${m.dmg}`, start: now, dx: (Math.random() - 0.5) * 0.5,
      color: hurtMe ? 'X' : byMe ? 'y' : '5', big: byMe || hurtMe,
    });
    if (hurtMe && this.self) { this.self.hp = m.hp; this.self.maxHp = m.maxHp; this.hud.renderSelf(); }
    if (m.kind === 'm' && m.id === this.target) this.hud.renderTarget();
  }

  setTarget(id, notify = true) {
    this.target = id;
    if (notify) this.send({ t: 'attack', id });
    if (!id) this.path = this.pendingTalk ? this.path : [];
    this.hud.renderTarget();
  }

  attackNearest() {
    let best = null, bestD = Infinity;
    for (const mo of this.monsters.values()) {
      const d = Math.max(Math.abs(mo.x - this.me.x), Math.abs(mo.y - this.me.y));
      if (d < bestD && mo.id !== this.target) { best = mo; bestD = d; }
    }
    if (!best && this.target) return;
    if (!best || bestD > 9) { this.hud.log('system', 'Nie widzisz w pobliżu nikogo, kogo można zaatakować.'); return; }
    this.pendingTalk = null;
    this.setTarget(best.id);
  }

  adjacent(e) { return Math.max(Math.abs(e.x - this.me.x), Math.abs(e.y - this.me.y)) <= 1; }

  // ============================================================== swiat
  renderPos(e, now) {
    if (!e.moveStart) return { x: e.x, y: e.y };
    const t = (now - e.moveStart) / e.moveDur;
    if (t >= 1) return { x: e.x, y: e.y };
    return { x: e.fromX + (e.x - e.fromX) * t, y: e.fromY + (e.y - e.fromY) * t };
  }

  isMoving(e, now) { return e.moveStart && now - e.moveStart < e.moveDur; }

  walkFrame(e, now) {
    if (!this.isMoving(e, now)) return 0;
    const t = (now - e.moveStart) / e.moveDur;
    return t < 0.5 ? (e.step % 2 ? 1 : 2) : 0;
  }

  npcAt(x, y) { return this.npcPos.get(`${x},${y}`); }

  monsterAt(x, y) {
    for (const mo of this.monsters.values()) if (mo.x === x && mo.y === y) return mo;
    return null;
  }

  /** Czy kafelki (grunt + obiekt) pozwalaja wejsc na pole. */
  tileFree(x, y) {
    const m = this.map;
    if (!m || x < 0 || y < 0 || x >= m.width || y >= m.height) return false;
    const i = y * m.width + x;
    const g = this.tiles.get(m.ground[i]);
    if (!g || g.solid) return false;
    const o = m.objects[i] && this.tiles.get(m.objects[i]);
    return !(o && o.solid);
  }

  walkable(x, y) {
    return this.tileFree(x, y) && !this.npcAt(x, y) && !this.monsterAt(x, y);
  }

  isPortal(x, y) { return this.map.portals.some(p => p.x === x && p.y === y); }

  tileColor(code) {
    if (!code) return null;
    if (this.tileColors.has(code)) return this.tileColors.get(code);
    const t = this.tiles.get(code);
    let color = null;
    if (t) {
      const c = spriteCanvas(t.sprite, 0, 1);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (n > (t.layer === 'OBJECT' ? 60 : 0)) color = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`;
    }
    this.tileColors.set(code, color);
    return color;
  }

  redrawMinimap() { if (this.me) drawMinimap(document.getElementById('minimap'), this); }

  // ============================================================== ruch
  tick(rafNow) {
    if (!this.map || !this.me) return;
    const now = Math.max(rafNow, performance.now());
    if (!this.isMoving(this.me, now)) {
      let dir = this.held.length ? this.held[this.held.length - 1] : null;
      if (!dir) {
        const tgt = this.target && this.monsters.get(this.target);
        if (tgt && !this.adjacent(tgt) && !this.path.length) {
          this.path = findPath(this.me.x, this.me.y, tgt.x, tgt.y, (a, b) => this.walkable(a, b), { adjacent: true, maxNodes: 1500 }) || [];
        }
        if (tgt && this.adjacent(tgt)) this.path = [];
        dir = this.path.shift();
      }
      if (dir) this.step(dir, now);
      else if (this.pendingTalk && !this.path.length) this.tryTalk(this.pendingTalk);
    }
    this.ghosts = this.ghosts.filter(g => {
      if (g.until > now) return true;
      g.onDone?.();
      return false;
    });
    this.floats = this.floats.filter(f => now - f.start < FLOAT_MS);
    try {
      this.renderer.draw(now);
    } catch (e) {
      if (!this.drawErrorLogged) { console.error('Błąd renderowania', e); this.drawErrorLogged = true; }
    }
    if (now - (this.lastHud || 0) > 120) {
      this.lastHud = now;
      this.hud.setLocation(this.map.name, this.me.x, this.me.y);
      this.redrawMinimap();
    }
  }

  step(dir, now) {
    const me = this.me;
    const [dx, dy] = DELTA[dir];
    const nx = me.x + dx, ny = me.y + dy;
    if (!this.walkable(nx, ny)) {
      if (me.dir !== dir) { me.dir = dir; this.send({ t: 'face', dir }); }
      this.path = [];
      return;
    }
    if (this.hud.dialogOpen) this.hud.closeDialog();
    Object.assign(me, { fromX: me.x, fromY: me.y, x: nx, y: ny, dir, moveStart: now, moveDur: me.ms, step: me.step + 1 });
    this.send({ t: 'move', dir, seq: ++this.seq });
    if (this.isPortal(nx, ny)) { this.path = []; this.held = []; }
  }

  walkTo(x, y) {
    this.pendingTalk = null;
    const mo = this.monsterAt(x, y);
    if (mo) { this.setTarget(mo.id); return; }
    if (this.target) this.setTarget(null);
    const npc = this.npcAt(x, y);
    if (npc) {
      if (this.inRange(npc)) { this.tryTalk(npc); return; }
      this.pendingTalk = npc;
    }
    const adjacent = !this.walkable(x, y);
    const p = findPath(this.me.x, this.me.y, x, y, (a, b) => this.walkable(a, b), { adjacent });
    if (p) this.path = p;
    else this.pendingTalk = null;
  }

  inRange(npc) { return Math.max(Math.abs(npc.x - this.me.x), Math.abs(npc.y - this.me.y)) <= TALK_RANGE; }

  tryTalk(npc) {
    this.pendingTalk = null;
    if (!this.inRange(npc)) return;
    const dx = npc.x - this.me.x, dy = npc.y - this.me.y;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    if (this.me.dir !== dir) { this.me.dir = dir; this.send({ t: 'face', dir }); }
    this.send({ t: 'talk', npc: npc.code });
  }

  talkNearest() {
    const npcs = this.map.npcs.filter(n => this.inRange(n));
    if (!npcs.length) { this.hud.log('system', 'Nikogo nie ma w pobliżu.'); return; }
    const [dx, dy] = DELTA[this.me.dir];
    npcs.sort((a, b) => {
      const da = Math.abs(a.x - this.me.x - dx) + Math.abs(a.y - this.me.y - dy);
      const db = Math.abs(b.x - this.me.x - dx) + Math.abs(b.y - this.me.y - dy);
      return da - db;
    });
    this.tryTalk(npcs[0]);
  }

  bindResize() {
    const vp = document.getElementById('viewport');
    const canvas = document.getElementById('world');
    const fit = () => {
      this.renderer.resize(vp.clientWidth - 4, vp.clientHeight - 4);
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
    };
    new ResizeObserver(fit).observe(vp);
    fit();
  }

  // ============================================================ wejscie
  bindInput() {
    const chatInput = document.getElementById('chat-input');
    const canvas = document.getElementById('world');

    addEventListener('keydown', (e) => {
      if (document.activeElement === chatInput) {
        if (e.key === 'Enter') {
          const text = chatInput.value.trim();
          if (text) this.send({ t: 'chat', text });
          chatInput.value = '';
          chatInput.blur();
        } else if (e.key === 'Escape') chatInput.blur();
        return;
      }
      if (e.key === 'Enter') {
        if (this.hud.dialogOpen) { this.hud.advanceDialog(); e.preventDefault(); return; }
        chatInput.focus(); e.preventDefault(); return;
      }
      if (e.key === 'Escape') {
        if (this.hud.dialogOpen) this.hud.closeDialog();
        else if (this.target) this.setTarget(null);
        document.getElementById('help').classList.add('hidden');
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.hud.dialogOpen) this.hud.advanceDialog();
        else this.attackNearest();
        return;
      }
      if (e.code === 'KeyE') { this.talkNearest(); return; }
      if (e.code === 'KeyH' || e.key === '?') { document.getElementById('help').classList.toggle('hidden'); return; }
      if (e.code === 'AltLeft' || e.code === 'AltRight') { this.showNames = true; e.preventDefault(); return; }
      const dir = KEYMAP[e.code];
      if (dir) {
        e.preventDefault();
        this.path = [];
        this.pendingTalk = null;
        if (!this.held.includes(dir)) this.held.push(dir);
      }
    });
    addEventListener('keyup', (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') this.showNames = false;
      const dir = KEYMAP[e.code];
      if (dir) this.held = this.held.filter(d => d !== dir);
    });
    addEventListener('blur', () => { this.held = []; this.showNames = false; });

    canvas.addEventListener('mousemove', (e) => {
      const t = this.renderer.screenToTile(e.clientX, e.clientY);
      this.renderer.hover = t;
      canvas.style.cursor = this.monsterAt(t.x, t.y) ? 'crosshair' : this.npcAt(t.x, t.y) ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', () => { this.renderer.hover = null; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.me) return;
      const t = this.renderer.screenToTile(e.clientX, e.clientY);
      this.walkTo(t.x, t.y);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.getElementById('reconnect').onclick = () => location.reload();
    document.getElementById('help-btn').onclick = () => document.getElementById('help').classList.toggle('hidden');
    document.getElementById('help').onclick = () => document.getElementById('help').classList.add('hidden');
  }
}

const game = new Game();
window.game = game; // wygodne do debugowania z konsoli przegladarki
game.start().catch((e) => {
  console.error(e);
  document.getElementById('disconnected').classList.remove('hidden');
  document.getElementById('disc-reason').textContent = e.message;
});
