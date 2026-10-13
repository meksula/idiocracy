// Edytor lokacji: malowanie gruntu i obiektow, portale, spawn i rozstawianie NPC.
import { api } from '../api.js';
import { el, toast, spriteImg } from '../ui.js';
import { spriteCanvas, PALETTE } from '../palette.js';
import { characterCanvas } from '../charsprite.js';
import { Editor, field, text, num, select } from './common.js';

const TOOLS = [
  ['brush', 'Pędzel', 'Maluje wybranym kafelkiem (grunt lub obiekt).'],
  ['rect', 'Prostokąt', 'Przeciągnij, aby wypełnić prostokąt.'],
  ['fill', 'Wiadro', 'Wypełnia obszar tego samego gruntu.'],
  ['erase', 'Gumka', 'Usuwa obiekty (grunt zostaje).'],
  ['spawn', 'Spawn', 'Punkt, w którym pojawiają się nowe postacie.'],
  ['portal', 'Portal', 'Klik: dodaj/edytuj przejście do innej mapy.'],
  ['npc', 'NPC', 'Wybierz NPC z listy, potem kliknij na mapie.'],
];

export class MapEditor {
  constructor() {
    this.root = el('div', { class: 'mapeditor' });
    this.zoom = 2;
    this.tool = 'brush';
    this.grid = true;
    this.showObjects = true;
    this.brush = null;
    this.hover = null;
    this.dirty = false;
    this.dirtyNpcs = new Set();
  }

  async show() {
    [this.tiles, this.maps, this.allNpcs] = await Promise.all([Editor.list('tiles', true), Editor.list('maps', true), Editor.list('npcs', true)]);
    this.tileMap = new Map(this.tiles.map(t => [t.code, t]));
    this.brush = this.brush || this.tiles.find(t => t.layer === 'GROUND')?.code;
    const code = this.map?.code && this.maps.some(m => m.code === this.map.code) ? this.map.code : this.maps[0]?.code;
    if (code) this.open(code); else this.render();
  }

  open(code) {
    if (this.dirty && !confirm('Masz niezapisane zmiany. Porzucić je?')) return;
    const m = this.maps.find(x => x.code === code);
    this.map = structuredClone(m);
    this.npcs = structuredClone(this.allNpcs.filter(n => n.mapCode === code));
    this.dirty = false;
    this.dirtyNpcs.clear();
    this.selectedPortal = null;
    this.selectedNpc = null;
    this.render();
  }

  // ------------------------------------------------------------------ UI
  render() {
    this.root.innerHTML = '';
    const mapSel = el('select', { onchange: (e) => this.open(e.target.value) });
    for (const m of this.maps) mapSel.append(el('option', { value: m.code, text: `${m.name} (${m.code})`, selected: this.map?.code === m.code }));
    this.status = el('span', { class: this.dirty ? 'amber' : 'muted', text: this.dirty ? '● niezapisane zmiany' : '' });
    const top = el('div', { class: 'row wrap map-top panel' },
      el('b', { text: 'Mapa:' }), mapSel,
      el('button', { class: 'neon small', onclick: () => this.newMapForm() }, '+ Nowa mapa'),
      this.map ? el('button', { class: 'secondary small', onclick: () => this.resizeForm() }, 'Rozmiar') : null,
      el('span', { class: 'spacer' }), this.status,
      this.map ? el('button', { onclick: () => this.save() }, 'Zapisz mapę') : null);
    this.side = el('div', { class: 'map-side panel' });
    this.canvasWrap = el('div', { class: 'map-canvas-wrap' });
    this.info = el('div', { class: 'map-info muted' }, 'Najedź na mapę…');
    this.root.append(top, el('div', { class: 'map-body' }, this.side, el('div', { class: 'map-center' }, this.canvasWrap, this.info), this.renderRight()));
    this.formSlot = el('div');
    this.root.prepend(this.formSlot);
    if (!this.map) return;
    this.renderSide();
    this.buildCanvas();
    this.draw();
  }

  renderSide() {
    const s = this.side;
    s.innerHTML = '';
    const tools = el('div', { class: 'tool-grid' });
    for (const [id, name, hint] of TOOLS) {
      tools.append(el('button', { class: `secondary small ${this.tool === id ? 'active' : ''}`, title: hint, onclick: () => { this.tool = id; this.renderSide(); this.renderRightContent(); } }, name));
    }
    s.append(el('h3', { text: 'Narzędzia' }), tools,
      el('div', { class: 'row wrap', style: { marginTop: '8px' } },
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: this.grid, onchange: (e) => { this.grid = e.target.checked; this.draw(); } }), ' siatka'),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: this.showObjects, onchange: (e) => { this.showObjects = e.target.checked; this.draw(); } }), ' obiekty'),
        el('button', { class: 'secondary small', onclick: () => { this.zoom = this.zoom === 2 ? 3 : this.zoom === 3 ? 1 : 2; this.buildCanvas(); this.draw(); } }, `zoom ${this.zoom}×`)));
    for (const [layer, title] of [['GROUND', 'Grunt'], ['OBJECT', 'Obiekty']]) {
      const grid = el('div', { class: 'tile-pick' });
      for (const t of this.tiles.filter(x => x.layer === layer)) {
        const b = el('div', { class: `tile-opt ${this.brush === t.code ? 'sel' : ''}`, title: `${t.name}${t.solid ? ' (blokuje)' : ''}`, onclick: () => { this.brush = t.code; if (!['brush', 'rect', 'fill'].includes(this.tool)) this.tool = 'brush'; this.renderSide(); } },
          spriteImg(t.sprite, 2, `ed:${t.code}`), t.solid ? el('span', { class: 'solid-dot' }) : null);
        grid.append(b);
      }
      s.append(el('h3', { text: title }), grid);
    }
    s.append(el('div', { class: 'hint', text: 'PPM na mapie = pobierz kafelek. Czerwona kropka = kafelek blokuje ruch.' }));
  }

  renderRight() {
    this.right = el('div', { class: 'map-right panel' });
    this.renderRightContent();
    return this.right;
  }

  renderRightContent() {
    const r = this.right;
    if (!r || !this.map) return;
    r.innerHTML = '';
    const m = this.map;
    r.append(el('h3', { text: 'Właściwości' }),
      field('Nazwa lokacji', text(m, 'name', { onInput: () => this.setDirty() })),
      el('div', { class: 'muted', text: `${m.width}×${m.height} · spawn [${m.spawnX}, ${m.spawnY}]` }));

    r.append(el('h3', { text: `NPC na mapie (${this.npcs.length})` }));
    for (const n of this.npcs) {
      const c = el('canvas', { class: 'pixel', width: 32, height: 32 });
      c.getContext('2d').drawImage(characterCanvas(n.appearance, 'S', 0, 2), 0, 0);
      r.append(el('div', { class: `crud-item ${this.selectedNpc === n.code ? 'sel' : ''}`, onclick: () => { this.selectedNpc = n.code; this.tool = 'npc'; this.renderSide(); this.renderRightContent(); } },
        c, el('div', {}, el('div', { class: 'hi', text: n.name }), el('div', { class: 'muted code', text: `[${n.x}, ${n.y}]${this.dirtyNpcs.has(n.code) ? ' ●' : ''}` }))));
    }
    const others = this.allNpcs.filter(n => n.mapCode !== m.code);
    if (others.length) {
      const holder = { code: null };
      r.append(el('div', { class: 'row' },
        select(holder, 'code', others.map(n => [n.code, `${n.name} (${n.mapCode})`]), { empty: '— przenieś NPC z innej mapy —' }),
        el('button', { class: 'secondary small', onclick: () => {
          const n = others.find(x => x.code === holder.code);
          if (!n) return;
          const copy = structuredClone(n);
          copy.mapCode = m.code; copy.x = m.spawnX; copy.y = m.spawnY;
          this.allNpcs = this.allNpcs.filter(x => x.code !== n.code).concat(copy);
          this.npcs.push(copy);
          this.dirtyNpcs.add(copy.code);
          this.selectedNpc = copy.code;
          this.tool = 'npc';
          this.setDirty();
          this.renderSide();
          this.renderRightContent();
        } }, 'Przenieś')));
    }
    r.append(el('div', { class: 'hint', text: 'Nowych NPC tworzysz w zakładce „NPC”.' }));

    r.append(el('h3', { text: `Portale (${m.portals.length})` }));
    m.portals.forEach((p, i) => {
      const sel = this.selectedPortal === i;
      const row = el('div', { class: `portal-row ${sel ? 'sel' : ''}` },
        el('div', { class: 'row', onclick: () => { this.selectedPortal = sel ? null : i; this.renderRightContent(); this.draw(); } },
          el('span', { class: 'neon-text', text: `[${p.x}, ${p.y}]` }), el('span', { text: `→ ${p.targetMap} [${p.targetX}, ${p.targetY}]` })));
      if (sel) {
        const ch = () => { this.setDirty(); this.draw(); };
        row.append(el('div', { class: 'form-grid' },
          field('Mapa docelowa', select(p, 'targetMap', this.maps.map(x => [x.code, x.name]), { onInput: ch })),
          field('Cel X', num(p, 'targetX', { onInput: ch })), field('Cel Y', num(p, 'targetY', { onInput: ch })),
          field('Etykieta', text(p, 'label', { onInput: ch }))),
          el('button', { class: 'danger small', onclick: () => { m.portals.splice(i, 1); this.selectedPortal = null; this.setDirty(); this.renderRightContent(); this.draw(); } }, 'Usuń portal'));
      }
      r.append(row);
    });
  }

  newMapForm() {
    const ground = this.tiles.filter(t => t.layer === 'GROUND');
    const d = { code: '', name: '', width: 30, height: 20, fill: ground[0]?.code };
    this.formSlot.innerHTML = '';
    this.formSlot.append(el('div', { class: 'panel rust map-form' },
      el('h3', { text: 'Nowa mapa' }),
      el('div', { class: 'form-grid' },
        field('Kod', text(d, 'code', { placeholder: 'np. kanaly' })), field('Nazwa', text(d, 'name', { placeholder: 'np. Kanały Pod Miastem' })),
        field('Szerokość', num(d, 'width', { min: 5, max: 256 })), field('Wysokość', num(d, 'height', { min: 5, max: 256 })),
        field('Wypełnij gruntem', select(d, 'fill', ground.map(t => [t.code, t.name])))),
      el('div', { class: 'row' },
        el('button', { onclick: async () => {
          const size = d.width * d.height;
          const map = { code: d.code, name: d.name || d.code, width: d.width, height: d.height, layers: { ground: Array(size).fill(d.fill), objects: Array(size).fill(null) }, spawnX: Math.floor(d.width / 2), spawnY: Math.floor(d.height / 2), portals: [] };
          try {
            await api(`/api/editor/maps/${encodeURIComponent(d.code)}`, { method: 'PUT', body: map });
            toast(`Utworzono mapę ${d.code}`);
            this.dirty = false;
            this.map = map;
            await this.show();
          } catch (e) { toast(e.message, 'error'); }
        } }, 'Utwórz'),
        el('button', { class: 'secondary', onclick: () => { this.formSlot.innerHTML = ''; } }, 'Anuluj'))));
  }

  resizeForm() {
    const m = this.map;
    const d = { width: m.width, height: m.height };
    this.formSlot.innerHTML = '';
    this.formSlot.append(el('div', { class: 'panel rust map-form' },
      el('h3', { text: 'Zmiana rozmiaru (od lewego górnego rogu)' }),
      el('div', { class: 'form-grid' }, field('Szerokość', num(d, 'width', { min: 5, max: 256 })), field('Wysokość', num(d, 'height', { min: 5, max: 256 }))),
      el('div', { class: 'row' },
        el('button', { onclick: () => {
          const fill = this.tileMap.get(this.brush)?.layer === 'GROUND' ? this.brush : m.layers.ground[0];
          const g = [], o = [];
          for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
            const inside = x < m.width && y < m.height;
            g.push(inside ? m.layers.ground[y * m.width + x] : fill);
            o.push(inside ? m.layers.objects[y * m.width + x] : null);
          }
          Object.assign(m, { width: d.width, height: d.height, layers: { ground: g, objects: o } });
          m.spawnX = Math.min(m.spawnX, d.width - 1); m.spawnY = Math.min(m.spawnY, d.height - 1);
          m.portals = m.portals.filter(p => p.x < d.width && p.y < d.height);
          this.formSlot.innerHTML = '';
          this.setDirty();
          this.buildCanvas(); this.draw(); this.renderRightContent();
        } }, 'Zastosuj'),
        el('button', { class: 'secondary', onclick: () => { this.formSlot.innerHTML = ''; } }, 'Anuluj'))));
  }

  // --------------------------------------------------------------- canvas
  get ts() { return 16 * this.zoom; }

  buildCanvas() {
    const m = this.map;
    this.canvas = el('canvas', { class: 'pixel', width: m.width * this.ts, height: m.height * this.ts });
    this.canvasWrap.innerHTML = '';
    this.canvasWrap.append(this.canvas);
    const at = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left) / this.ts), y: Math.floor((e.clientY - r.top) / this.ts) };
    };
    let down = false;
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      const p = at(e);
      if (e.button === 2) { this.pick(p.x, p.y); return; }
      down = true;
      this.rectStart = p;
      this.useTool(p.x, p.y, true);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const p = at(e);
      this.hover = p;
      this.updateInfo();
      if (down && ['brush', 'erase'].includes(this.tool)) this.useTool(p.x, p.y, false);
      this.draw();
    });
    this.canvas.addEventListener('mouseleave', () => { this.hover = null; this.draw(); });
    if (this.onUp) removeEventListener('mouseup', this.onUp);
    this.onUp = () => {
      if (!down) return;
      down = false;
      if (this.tool === 'rect' && this.rectStart && this.hover) this.fillRect(this.rectStart, this.hover);
      this.rectStart = null;
      this.draw();
    };
    addEventListener('mouseup', this.onUp);
  }

  idx(x, y) { return y * this.map.width + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height; }

  paint(x, y) {
    const t = this.tileMap.get(this.brush);
    if (!t || !this.inb(x, y)) return;
    const layer = t.layer === 'GROUND' ? this.map.layers.ground : this.map.layers.objects;
    if (layer[this.idx(x, y)] !== t.code) { layer[this.idx(x, y)] = t.code; this.setDirty(); }
  }

  useTool(x, y, first) {
    if (!this.inb(x, y)) return;
    const m = this.map;
    switch (this.tool) {
      case 'brush': this.paint(x, y); break;
      case 'erase': if (m.layers.objects[this.idx(x, y)]) { m.layers.objects[this.idx(x, y)] = null; this.setDirty(); } break;
      case 'fill': if (first) this.flood(x, y); break;
      case 'spawn': m.spawnX = x; m.spawnY = y; this.setDirty(); this.renderRightContent(); break;
      case 'portal': if (first) {
        let i = m.portals.findIndex(p => p.x === x && p.y === y);
        if (i < 0) {
          const target = this.maps.find(mm => mm.code !== m.code) || m;
          m.portals.push({ x, y, targetMap: target.code, targetX: target.spawnX, targetY: target.spawnY, label: target.name });
          i = m.portals.length - 1;
          this.setDirty();
        }
        this.selectedPortal = i;
        this.renderRightContent();
      } break;
      case 'npc': if (first) {
        const n = this.npcs.find(nn => nn.code === this.selectedNpc);
        if (!n) { toast('Najpierw wybierz NPC z listy po prawej.', 'error'); return; }
        n.x = x; n.y = y;
        this.dirtyNpcs.add(n.code);
        this.setDirty();
        this.renderRightContent();
      } break;
      default: break;
    }
  }

  fillRect(a, b) {
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) this.paint(x, y);
  }

  flood(x, y) {
    const t = this.tileMap.get(this.brush);
    if (!t) return;
    const layer = t.layer === 'GROUND' ? this.map.layers.ground : this.map.layers.objects;
    const from = layer[this.idx(x, y)];
    if (from === t.code) return;
    const st = [[x, y]];
    while (st.length) {
      const [a, b] = st.pop();
      if (!this.inb(a, b) || layer[this.idx(a, b)] !== from) continue;
      layer[this.idx(a, b)] = t.code;
      st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
    this.setDirty();
  }

  pick(x, y) {
    if (!this.inb(x, y)) return;
    this.brush = this.map.layers.objects[this.idx(x, y)] || this.map.layers.ground[this.idx(x, y)];
    this.tool = 'brush';
    this.renderSide();
  }

  setDirty() {
    this.dirty = true;
    if (this.status) { this.status.textContent = '● niezapisane zmiany'; this.status.className = 'amber'; }
  }

  updateInfo() {
    if (!this.hover || !this.inb(this.hover.x, this.hover.y)) { this.info.textContent = ''; return; }
    const { x, y } = this.hover;
    const g = this.tileMap.get(this.map.layers.ground[this.idx(x, y)]);
    const o = this.tileMap.get(this.map.layers.objects[this.idx(x, y)]);
    const npc = this.npcs.find(n => n.x === x && n.y === y);
    const portal = this.map.portals.find(p => p.x === x && p.y === y);
    this.info.textContent = `[${x}, ${y}]  grunt: ${g?.name || '?'}${o ? '  ·  obiekt: ' + o.name : ''}${npc ? '  ·  NPC: ' + npc.name : ''}${portal ? '  ·  portal → ' + portal.targetMap : ''}`;
  }

  draw() {
    if (!this.canvas) return;
    const m = this.map, ts = this.ts, ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tc = (code) => { const t = this.tileMap.get(code); return t && spriteCanvas(t.sprite, 0, this.zoom, `ed:${code}`); };
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const g = tc(m.layers.ground[this.idx(x, y)]);
      if (g) ctx.drawImage(g, x * ts, y * ts); else { ctx.fillStyle = '#f0f'; ctx.fillRect(x * ts, y * ts, ts, ts); }
      if (this.showObjects) { const o = tc(m.layers.objects[this.idx(x, y)]); if (o) ctx.drawImage(o, x * ts, y * ts); }
    }
    for (const n of this.npcs) ctx.drawImage(characterCanvas(n.appearance, 'S', 0, this.zoom), n.x * ts, n.y * ts);
    m.portals.forEach((p, i) => {
      ctx.fillStyle = 'rgba(63,224,208,0.35)';
      ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
      ctx.strokeStyle = i === this.selectedPortal ? PALETTE.y : PALETTE.n;
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x * ts + 1, p.y * ts + 1, ts - 2, ts - 2);
    });
    ctx.strokeStyle = PALETTE.m;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.spawnX * ts + ts / 2, m.spawnY * ts + ts / 2, ts / 3, 0, Math.PI * 2); ctx.stroke();
    if (this.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= m.width; x++) { ctx.beginPath(); ctx.moveTo(x * ts + 0.5, 0); ctx.lineTo(x * ts + 0.5, m.height * ts); ctx.stroke(); }
      for (let y = 0; y <= m.height; y++) { ctx.beginPath(); ctx.moveTo(0, y * ts + 0.5); ctx.lineTo(m.width * ts, y * ts + 0.5); ctx.stroke(); }
    }
    if (this.hover && this.inb(this.hover.x, this.hover.y)) {
      ctx.strokeStyle = PALETTE['7'];
      ctx.lineWidth = 2;
      if (this.tool === 'rect' && this.rectStart) {
        const a = this.rectStart, b = this.hover;
        ctx.strokeRect(Math.min(a.x, b.x) * ts, Math.min(a.y, b.y) * ts, (Math.abs(a.x - b.x) + 1) * ts, (Math.abs(a.y - b.y) + 1) * ts);
      } else ctx.strokeRect(this.hover.x * ts + 1, this.hover.y * ts + 1, ts - 2, ts - 2);
    }
  }

  async save() {
    try {
      await api(`/api/editor/maps/${encodeURIComponent(this.map.code)}`, { method: 'PUT', body: this.map });
      for (const code of this.dirtyNpcs) {
        const n = this.npcs.find(x => x.code === code);
        if (n) await api(`/api/editor/npcs/${encodeURIComponent(code)}`, { method: 'PUT', body: n });
      }
      toast(`Zapisano mapę ${this.map.code} — gracze online widzą zmiany od razu.`);
      this.dirty = false;
      this.dirtyNpcs.clear();
      Editor.invalidate('maps');
      Editor.invalidate('npcs');
      await this.show();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}
