// Mapy startowe budowane z prostych operacji (jak pedzel w edytorze).
import { rng, hash } from './pixel.mjs';

class MapBuilder {
  constructor(code, name, w, h, ground) {
    Object.assign(this, { code, name, w, h });
    this.ground = Array(w * h).fill(ground);
    this.objects = Array(w * h).fill(null);
    this.portals = [];
    this.spawns = [];
    this.instanced = false;
    this.r = rng(hash(code));
  }
  i(x, y) { return y * this.w + x; }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  g(x, y, t) { if (this.in(x, y)) this.ground[this.i(x, y)] = t; return this; }
  o(x, y, t) { if (this.in(x, y)) this.objects[this.i(x, y)] = t; return this; }
  obj(x, y) { return this.in(x, y) ? this.objects[this.i(x, y)] : 'x'; }
  fillG(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.g(i, j, t); return this; }
  fillO(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.o(i, j, t); return this; }
  scatterG(t, p, area = [0, 0, this.w, this.h], only = null) {
    const [x0, y0, w, h] = area;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
      if (this.r() < p && (!only || only.includes(this.ground[this.i(x, y)]))) this.g(x, y, t);
    return this;
  }
  scatterO(t, n, area, onGround = null) {
    const [x0, y0, w, h] = area;
    for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
      const x = x0 + Math.floor(this.r() * w), y = y0 + Math.floor(this.r() * h);
      if (this.obj(x, y) !== null) continue;
      if (onGround && !onGround.includes(this.ground[this.i(x, y)])) continue;
      this.o(x, y, t); k++;
    }
    return this;
  }
  blob(cx, cy, rx, ry, t) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1 + (this.r() - 0.5) * 0.3) this.g(cx + x, cy + y, t);
    return this;
  }
  /** Budynek: obrys scian, podloga w srodku, drzwi (lista [x,y]). */
  building(x, y, w, h, wall, floor, doors) {
    this.fillG(x, y, w, h, floor);
    for (let i = x; i < x + w; i++) { this.o(i, y, wall); this.o(i, y + h - 1, wall); }
    for (let j = y; j < y + h; j++) { this.o(x, j, wall); this.o(x + w - 1, j, wall); }
    for (const [dx, dy] of doors) { this.o(dx, dy, null); this.g(dx, dy, floor); }
    return this;
  }
  border(t, gaps = []) {
    for (let x = 0; x < this.w; x++) { this.o(x, 0, t); this.o(x, this.h - 1, t); }
    for (let y = 0; y < this.h; y++) { this.o(0, y, t); this.o(this.w - 1, y, t); }
    for (const [x, y] of gaps) this.o(x, y, null);
    return this;
  }
  clear(x, y, w = 1, h = 1) { return this.fillO(x, y, w, h, null); }
  portal(x, y, targetMap, targetX, targetY, label) { this.portals.push({ x, y, targetMap, targetX, targetY, label }); return this; }
  spawn(monster, x, y, w, h, count) { this.spawns.push({ monster, x, y, w, h, count }); return this; }
  build(spawnX, spawnY) {
    return {
      code: this.code, name: this.name, width: this.w, height: this.h,
      layers: { ground: this.ground, objects: this.objects },
      spawnX, spawnY, portals: this.portals, spawns: this.spawns, instanced: this.instanced,
    };
  }
}

// ======================================================= OSADA REBOOT
function osada() {
  const m = new MapBuilder('osada', 'Osada Reboot', 40, 30, 'grass-dead');
  m.scatterG('dirt', 0.12).scatterG('sand', 0.03);
  // drogi
  m.fillG(0, 14, 40, 3, 'asphalt').fillG(0, 15, 40, 1, 'asphalt-line');
  m.fillG(19, 0, 3, 30, 'asphalt').fillG(20, 0, 1, 30, 'asphalt-line-v');
  // plac centralny
  m.fillG(14, 10, 13, 11, 'concrete').scatterG('concrete-cracked', 0.18, [14, 10, 13, 11], ['concrete']);
  m.o(20, 12, 'terminal-dead').o(17, 18, 'campfire').o(23, 18, 'sign-board');
  m.o(14, 10, 'lamp-post').o(26, 10, 'lamp-post').o(14, 20, 'lamp-post').o(26, 20, 'lamp-post');
  // ratusz soltysa (lewa gora)
  m.building(3, 2, 10, 7, 'wall-brick', 'wood-floor', [[7, 8]]);
  m.o(4, 3, 'bed').o(11, 3, 'table').o(11, 7, 'crate').o(4, 7, 'crate');
  m.fillG(7, 9, 1, 5, 'dirt');
  // biblioteka (prawa gora)
  m.building(27, 2, 11, 7, 'wall-concrete', 'floor-tiles', [[32, 8]]);
  m.fillO(28, 3, 9, 1, 'bookshelf').clear(32, 3).o(29, 6, 'table').o(35, 6, 'table');
  m.fillG(32, 9, 1, 5, 'dirt');
  // warsztat (lewy dol)
  m.building(3, 20, 11, 8, 'wall-brick', 'metal-floor', [[8, 20]]);
  m.o(4, 21, 'tires').o(5, 21, 'tires').o(12, 21, 'crate').o(12, 22, 'crate').o(4, 26, 'barrel-toxic').o(12, 26, 'table');
  m.o(10, 26, 'server-rack');
  m.fillG(8, 17, 1, 3, 'dirt');
  // toksyczny staw (prawy dol)
  m.blob(32, 24, 5, 3, 'toxic-water');
  m.o(26, 22, 'tree-dead').o(37, 21, 'tree-dead').o(27, 27, 'tree-dead').o(36, 27, 'barrel-toxic').o(29, 21, 'bush-mutant');
  // dekoracje
  m.o(3, 15, 'car-wreck').o(30, 14, 'car-wreck').o(19, 4, 'car-wreck').o(21, 26, 'car-wreck');
  m.scatterO('tree-dead', 6, [1, 10, 12, 3], ['grass-dead', 'dirt', 'sand']);
  m.scatterO('grass-tuft', 18, [1, 1, 38, 28], ['grass-dead']);
  m.scatterO('trash-bags', 5, [1, 1, 38, 28], ['grass-dead', 'dirt']);
  m.scatterO('bush-mutant', 5, [1, 1, 38, 28], ['grass-dead']);
  m.o(16, 12, 'grass-tuft').o(24, 12, 'trash-bags');
  // ogrodzenie z wyjsciami na drogach
  m.border('fence', [[0, 14], [0, 15], [0, 16], [39, 14], [39, 15], [39, 16], [19, 0], [20, 0], [21, 0], [19, 29], [20, 29], [21, 29]]);
  // zamkniete zachod/polnoc/poludnie - "jeszcze nie odbudowane"
  // zachod: przejscie na podworze kamienicy
  for (const y of [14, 15, 16]) { m.clear(0, y).clear(1, y); m.portal(0, y, 'podworze', 30, y + 6, 'Podwórze kamienicy'); }
  m.o(19, 0, 'rubble').o(20, 0, 'rubble').o(21, 0, 'rubble');
  m.o(19, 29, 'rubble').o(20, 29, 'rubble').o(21, 29, 'rubble');
  // przejscie na wschod -> ruiny
  for (const y of [14, 15, 16]) { m.clear(38, y); m.portal(39, y, 'ruiny', 1, y, 'Ruiny Galerii'); }
  // wolne miejsca dla NPC i spawnu
  m.clear(18, 13).clear(32, 5).clear(8, 24).clear(20, 17);
  return m.build(20, 17);
}

// ======================================================= RUINY GALERII
function ruiny() {
  const m = new MapBuilder('ruiny', 'Ruiny Galerii Handlowej', 40, 30, 'rubble-ground');
  m.scatterG('dirt', 0.25).scatterG('concrete-cracked', 0.15);
  // droga od zachodu
  m.fillG(0, 14, 24, 3, 'asphalt').fillG(0, 15, 24, 1, 'asphalt-line');
  m.fillG(22, 4, 3, 13, 'asphalt');
  // parking z wrakiem autobusu
  m.fillG(25, 4, 12, 9, 'asphalt');
  for (let x = 27; x <= 33; x++) m.o(x, 9, 'car-wreck');
  m.o(26, 5, 'car-wreck').o(35, 6, 'car-wreck').o(30, 5, 'tires').o(36, 11, 'lamp-post');
  // zawalona galeria
  m.building(3, 2, 14, 9, 'wall-ruin', 'floor-tiles', [[9, 10], [10, 10]]);
  m.clear(3, 5).clear(3, 6).clear(16, 4).clear(12, 2);
  m.o(6, 4, 'neon-sign').o(13, 4, 'neon-sign').o(5, 8, 'rubble').o(14, 7, 'rubble').o(9, 5, 'trash-bags');
  // stara serwerownia (prawy dol)
  m.building(25, 19, 13, 9, 'wall-concrete', 'metal-floor', [[31, 19]]);
  for (let x = 27; x <= 35; x += 2) { m.o(x, 21, 'server-rack'); m.o(x, 24, 'server-rack'); }
  m.o(26, 26, 'terminal-dead').o(36, 26, 'barrel-toxic');
  // pustkowie
  m.blob(10, 23, 4, 3, 'toxic-water');
  m.scatterO('rubble', 14, [1, 12, 22, 16], ['rubble-ground', 'dirt', 'concrete-cracked']);
  m.scatterO('tree-dead', 6, [1, 17, 22, 11], ['rubble-ground', 'dirt']);
  m.scatterO('trash-bags', 6, [1, 1, 38, 28], ['rubble-ground', 'dirt']);
  m.scatterO('barrel-toxic', 4, [14, 17, 9, 11], ['rubble-ground', 'dirt']);
  m.border('fence', [[0, 14], [0, 15], [0, 16]]);
  for (const y of [14, 15, 16]) { m.clear(1, y, 3); m.portal(0, y, 'osada', 38, y, 'Osada Reboot'); }
  // wolne miejsca dla NPC i celow misji
  m.clear(6, 12).clear(29, 10, 3, 1).clear(30, 22, 3, 1);
  for (let x = 22; x <= 25; x++) for (let y = 4; y <= 16; y++) if (m.obj(x, y) === 'rubble') m.o(x, y, null);
  return m.build(2, 15);
}

// ======================================================= MIESZKANIE (instancja)
function dom() {
  const m = new MapBuilder('dom', 'Twoje mieszkanie', 12, 9, 'wood-floor');
  m.instanced = true;
  m.building(0, 0, 12, 9, 'wall-brick', 'wood-floor', [[6, 8]]);
  m.o(3, 0, 'window-wall').o(8, 0, 'window-wall');
  m.o(1, 1, 'bed').o(4, 1, 'table').o(9, 1, 'kitchen-counter').o(10, 1, 'kitchen-counter');
  m.o(10, 4, 'bookshelf').o(1, 7, 'crate').o(10, 7, 'trash-bags').o(4, 5, 'table');
  m.o(6, 8, 'doorway');
  m.portal(6, 8, 'podworze', 8, 5, 'Podwórze');
  return m.build(2, 3);
}

// ======================================================= PODWORZE KAMIENICY
function podworze() {
  const m = new MapBuilder('podworze', 'Podwórze kamienicy', 32, 24, 'concrete');
  m.scatterG('concrete-cracked', 0.22).scatterG('dirt', 0.05);
  m.fillG(0, 18, 20, 5, 'asphalt').scatterG('concrete-cracked', 0.1, [0, 18, 20, 5], ['asphalt']);
  // kamienica (polnoc)
  m.fillO(0, 0, 32, 4, 'wall-brick');
  for (const x of [3, 6, 12, 16, 20, 24, 28]) m.o(x, 2, 'window-wall');
  m.o(8, 3, 'doorway').portal(8, 3, 'dom', 6, 7, 'Mieszkanie');
  m.o(4, 4, 'robot-slumped').o(15, 4, 'robot-slumped').o(23, 4, 'robot-slumped');
  // martwe roboty serwisowe porozrzucane po podworzu
  const robots = [
    [4, 7, 'a'], [6, 9, 'b'], [9, 7, 'a'], [10, 12, 'a'], [12, 10, 'b'], [14, 7, 'a'], [16, 11, 'b'],
    [5, 13, 'a'], [8, 15, 'b'], [13, 14, 'a'], [17, 8, 'a'], [19, 13, 'b'], [3, 10, 'b'], [11, 5, 'a'],
  ];
  for (const [x, y, v] of robots) m.o(x, y, `robot-fallen-${v}`);
  for (const [x, y] of [[7, 11], [15, 13], [18, 6], [2, 15]]) m.o(x, y, 'robot-head');
  m.o(2, 5, 'lamp-post').o(20, 9, 'lamp-post').o(6, 20, 'car-wreck').o(14, 21, 'tires');
  // smietnik (poludniowy wschod) - tu zalegly sie szczury
  m.fillG(21, 11, 10, 12, 'dirt').scatterG('rubble-ground', 0.25, [21, 11, 10, 12]);
  for (const x of [22, 23, 28, 29]) m.o(x, 11, 'trash-container');
  for (const x of [21, 22, 26, 27]) m.o(x, 17, 'trash-container');
  m.scatterO('trash-bags', 9, [21, 12, 10, 10], ['dirt', 'rubble-ground']);
  m.scatterO('barrel-toxic', 2, [24, 18, 6, 4], ['dirt', 'rubble-ground']);
  m.spawn('szczur-zmutowany', 21, 12, 10, 5, 6);
  m.spawn('szczur-zmutowany', 17, 18, 11, 5, 6);
  // ogrodzenie i wyjscie na wschod (zaulek do Osady)
  m.border('fence', [[31, 20], [31, 21], [31, 22]]);
  m.fillO(0, 0, 32, 4, 'wall-brick');
  for (const x of [3, 6, 12, 16, 20, 24, 28]) m.o(x, 2, 'window-wall');
  m.o(8, 3, 'doorway');
  for (const y of [20, 21, 22]) { m.clear(29, y, 2); m.portal(31, y, 'osada', 1, y - 6, 'Osada Reboot'); }
  m.clear(8, 4, 1, 2).clear(13, 10);
  return m.build(8, 5);
}

export const MAPS = [dom(), podworze(), osada(), ruiny()];

/** Podglad ASCII do szybkiej kontroli przechodnosci. */
export function ascii(map, solid) {
  const lines = [];
  for (let y = 0; y < map.height; y++) {
    let s = '';
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const o = map.layers.objects[i];
      const gr = map.layers.ground[i];
      if (map.portals.some(p => p.x === x && p.y === y)) s += '>';
      else if (x === map.spawnX && y === map.spawnY) s += '@';
      else if ((map.spawns || []).some(sp => x >= sp.x && y >= sp.y && x < sp.x + sp.w && y < sp.y + sp.h) && !(o && solid.has(o))) s += 'r';
      else if (o && solid.has(o)) s += '#';
      else if (solid.has(gr)) s += '~';
      else s += o ? ',' : '.';
    }
    lines.push(s);
  }
  return lines.join('\n');
}
