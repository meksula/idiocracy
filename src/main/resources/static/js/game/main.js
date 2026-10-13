// Klient gry: stan swiata, siec (WebSocket), sterowanie i petla renderowania.
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

class Game {
  constructor() {
    this.session = requireSession();
    this.characterId = new URLSearchParams(location.search).get('character');
    if (!this.characterId) location.href = '/characters.html';
    this.tiles = new Map();
    this.items = new Map();
    this.tileColors = new Map();
    this.contentVersion = 0;
    this.map = null;
    this.npcPos = new Map();
    this.marks = {};
    this.players = new Map();
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
    this.contentVersion++;
    this.tileColors.clear();
    clearSpriteCache('tile:');
    clearSpriteCache('icon:');
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
        : 'Połączenie z serwerem zostało przerwane. Burza magnetyczna?';
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
        this.hud.log('system', `Witaj, ${m.you.name}. WASD/strzałki lub klik — ruch, E — rozmowa, Enter — czat.`);
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
        break;
      case 'self':
        this.applySelf(m.you);
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
        if (!p) break;
        const cur = this.renderPos(p, now);
        Object.assign(p, { fromX: cur.x, fromY: cur.y, x: m.x, y: m.y, dir: m.dir, moveStart: now, moveDur: m.ms, step: p.step + 1 });
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
        if (['tiles', 'items'].includes(m.type)) {
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
    this.me = this.entity(m.you);
    this.marks = m.marks || {};
    this.path = [];
    this.pendingTalk = null;
    this.hud.closeDialog();
    this.setMap(m.map);
    this.applySelf(m.you);
  }

  setMap(map) {
    this.map = map;
    this.npcPos = new Map(map.npcs.map(n => [`${n.x},${n.y}`, n]));
    this.redrawMinimap();
  }

  applySelf(you) {
    this.self = you;
    if (this.me) Object.assign(this.me, { app: you.app, level: you.level, ms: you.ms, name: you.name });
    this.hud.renderSelf();
  }

  entity(p) {
    return { ...p, fromX: p.x, fromY: p.y, moveStart: 0, moveDur: p.ms || 260, step: 0, bubble: null };
  }

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

  walkable(x, y) {
    const m = this.map;
    if (!m || x < 0 || y < 0 || x >= m.width || y >= m.height) return false;
    const i = y * m.width + x;
    const g = this.tiles.get(m.ground[i]);
    if (!g || g.solid) return false;
    const o = m.objects[i] && this.tiles.get(m.objects[i]);
    if (o && o.solid) return false;
    return !this.npcAt(x, y);
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
  tick(now) {
    if (!this.map || !this.me) return;
    if (!this.isMoving(this.me, now)) {
      const dir = this.held.length ? this.held[this.held.length - 1] : this.path.shift();
      if (dir) this.step(dir, now);
      else if (this.pendingTalk && !this.path.length) this.tryTalk(this.pendingTalk);
    }
    this.renderer.draw(now);
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
    const npc = this.npcAt(x, y);
    if (npc) {
      if (this.inRange(npc)) { this.tryTalk(npc); return; }
      this.pendingTalk = npc;
    }
    const target = this.walkable(x, y) ? { x, y, adjacent: false } : { x, y, adjacent: true };
    const p = findPath(this.me.x, this.me.y, target.x, target.y, (a, b) => this.walkable(a, b), { adjacent: target.adjacent });
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
    if (!npcs.length) { this.hud.log('system', 'Nikogo nie ma w pobliżu. Pogadaj ze sobą — to też ćwiczy mózg.'); return; }
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
      if (e.key === 'Enter') { chatInput.focus(); e.preventDefault(); return; }
      if (e.key === 'Escape') { this.hud.closeDialog(); document.getElementById('help').classList.add('hidden'); return; }
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
      this.renderer.hover = this.renderer.screenToTile(e.clientX, e.clientY);
      canvas.style.cursor = this.npcAt(this.renderer.hover.x, this.renderer.hover.y) ? 'pointer' : 'crosshair';
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
