// Definicje kafelkow startowych. Uruchom: node tools/gen-content.mjs
import { Grid, rng, hash, sprite } from './pixel.mjs';

const T = 16;
const R = (name) => rng(hash(name));

// ---------------------------------------------------------------- GRUNT

function asphalt(name = 'asphalt') {
  const r = R(name);
  const g = new Grid(T, T, '2').noise(r, [['1', 0.12], ['3', 0.08]]);
  return g;
}

function concrete(name = 'concrete') {
  const r = R(name);
  const g = new Grid(T, T, '4').noise(r, [['3', 0.1], ['5', 0.06]]);
  g.hline(0, 15, 16, '3').vline(15, 0, 16, '3');
  return g;
}

const GROUND = [
  {
    code: 'asphalt', name: 'Asfalt', make: () => {
      const g = asphalt();
      g.line(3, 2, 6, 6, '1').line(6, 6, 5, 10, '1');
      return sprite(g);
    },
  },
  {
    code: 'asphalt-line', name: 'Asfalt z pasem', make: () => {
      const g = asphalt('asphalt-line');
      g.hline(1, 7, 6, '5').hline(9, 7, 6, '5').hline(1, 8, 6, '4').hline(9, 8, 6, '4');
      g.set(3, 7, '4').set(12, 8, '3');
      return sprite(g);
    },
  },
  {
    code: 'asphalt-line-v', name: 'Asfalt z pasem (pion)', make: () => {
      const g = asphalt('asphalt-line-v');
      g.vline(7, 1, 6, '5').vline(7, 9, 6, '5').vline(8, 1, 6, '4').vline(8, 9, 6, '4');
      return sprite(g);
    },
  },
  { code: 'concrete', name: 'Beton', make: () => sprite(concrete()) },
  {
    code: 'concrete-cracked', name: 'Beton popękany', make: () => {
      const g = concrete('concrete-cracked');
      g.line(2, 1, 7, 7, '2').line(7, 7, 13, 9, '2').line(7, 7, 6, 14, '2');
      g.set(8, 8, 'G').set(6, 13, 'G').set(12, 9, 'g');
      return sprite(g);
    },
  },
  {
    code: 'dirt', name: 'Ziemia', make: () => sprite(new Grid(T, T, 'B').noise(R('dirt'), [['b', 0.14], ['k', 0.07]])),
  },
  {
    code: 'grass-dead', name: 'Zeschnięta trawa', make: () => {
      const r = R('grass');
      const g = new Grid(T, T, 'g').noise(r, [['G', 0.22], ['b', 0.05], ['k', 0.04]]);
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(r() * 15), y = 1 + Math.floor(r() * 14);
        g.set(x, y, 'G').set(x, y - 1, 'k');
      }
      return sprite(g);
    },
  },
  {
    code: 'sand', name: 'Piach', make: () => sprite(new Grid(T, T, 'k').noise(R('sand'), [['B', 0.08], ['O', 0.04], ['5', 0.02]])),
  },
  {
    code: 'rubble-ground', name: 'Gruz', make: () => {
      const r = R('rubble-ground');
      const g = new Grid(T, T, 'B').noise(r, [['3', 0.15], ['4', 0.1], ['b', 0.1], ['2', 0.05]]);
      return sprite(g);
    },
  },
  {
    code: 'floor-tiles', name: 'Płytki', make: () => {
      const g = new Grid(T, T, '5');
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (((x >> 2) + (y >> 2)) % 2) g.set(x, y, '4');
      g.noise(R('floor'), [['3', 0.04], ['k', 0.02]]);
      return sprite(g);
    },
  },
  {
    code: 'wood-floor', name: 'Deski', make: () => {
      const g = new Grid(T, T, 'B');
      for (let y = 3; y < T; y += 4) g.hline(0, y, 16, 'b');
      for (let y = 0; y < T; y += 4) g.set((y * 5) % 16, y + 1, 'b').set((y * 5 + 8) % 16, y + 2, 'b');
      g.noise(R('wood'), [['k', 0.05]], [0, 0, 16, 16]);
      return sprite(g);
    },
  },
  {
    code: 'metal-floor', name: 'Blacha', make: () => {
      const g = new Grid(T, T, '3');
      g.bevel(0, 0, 16, 16, '4', '2').bevel(0, 0, 8, 8, '4', '2').bevel(8, 8, 8, 8, '4', '2');
      g.bevel(8, 0, 8, 8, '4', '2').bevel(0, 8, 8, 8, '4', '2');
      [[2, 2], [5, 5], [10, 2], [13, 5], [2, 10], [5, 13], [10, 10], [13, 13]].forEach(([x, y]) => g.set(x, y, '1'));
      return sprite(g);
    },
  },
  {
    code: 'toxic-water', name: 'Toksyczna woda', solid: true, make: () => {
      const frames = [0, 1].map(f => {
        const g = new Grid(T, T, 'g').noise(R('toxic' + f), [['G', 0.12]]);
        for (let y = 2 + f; y < T; y += 5) for (let x = (y * 3 + f * 2) % 6; x < T; x += 7) g.hline(x, y, 3, 'l');
        g.set((5 + f * 6) % 16, 9, 'y');
        return g;
      });
      return sprite(...frames);
    },
  },
  {
    code: 'water', name: 'Woda', solid: true, make: () => {
      const frames = [0, 1].map(f => {
        const g = new Grid(T, T, 'u').noise(R('water' + f), [['c', 0.1]]);
        for (let y = 3 + f; y < T; y += 5) for (let x = (y * 2 + f * 3) % 6; x < T; x += 6) g.hline(x, y, 3, 'U');
        return g;
      });
      return sprite(...frames);
    },
  },
];

// --------------------------------------------------------------- OBIEKTY

const OBJECTS = [
  {
    code: 'wall-brick', name: 'Mur ceglany', solid: true, make: () => {
      const g = new Grid(T, T, '3');
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let bx = -off; bx < T; bx += 8) {
          g.rect(bx + 1, row * 4 + 1, 7, 3, 'R');
          g.hline(bx + 1, row * 4 + 1, 7, 'o');
          g.hline(bx + 1, row * 4 + 3, 7, 'r');
        }
      }
      g.noise(R('brick'), [['r', 0.04]]);
      return sprite(g);
    },
  },
  {
    code: 'wall-concrete', name: 'Ściana z wielkiej płyty', solid: true, make: () => {
      const g = new Grid(T, T, '3').noise(R('wallc'), [['4', 0.08], ['2', 0.06]]);
      g.bevel(0, 0, 16, 16, '4', '1').hline(0, 7, 16, '2').hline(0, 8, 16, '4');
      g.line(10, 2, 12, 6, '1');
      return sprite(g);
    },
  },
  {
    code: 'wall-ruin', name: 'Ruina ściany', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(0, 6, 16, 10, '3').rect(0, 3, 7, 3, '3').rect(9, 4, 4, 2, '3');
      g.noise(R('ruin'), [['4', 0.1], ['2', 0.08]]);
      g.hline(0, 6, 16, '4').hline(0, 3, 7, '4');
      g.rect(2, 9, 3, 3, 'R').rect(10, 10, 3, 3, 'R');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'fence', name: 'Siatka', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      for (let i = -16; i < 16; i += 4) { g.line(i, 15, i + 15, 0, '4'); g.line(i, 0, i + 15, 15, '3'); }
      for (let y = 0; y < 3; y++) g.hline(0, y, 16, '.');
      g.hline(0, 3, 16, '5').vline(0, 2, 14, '5').vline(15, 2, 14, '5').vline(1, 2, 14, '3');
      return sprite(g);
    },
  },
  {
    code: 'tree-dead', name: 'Martwe drzewo', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(7, 6, 2, 9, 'B').vline(7, 6, 9, 'k');
      g.line(8, 7, 13, 2, 'B').line(7, 8, 2, 3, 'B').line(10, 5, 10, 1, 'B').line(4, 5, 5, 1, 'b');
      g.line(12, 3, 14, 3, 'b').line(3, 4, 1, 5, 'b');
      g.hline(5, 15, 6, 'b');
      g.outline().shadow(15, 4, 11);
      return sprite(g);
    },
  },
  {
    code: 'bush-mutant', name: 'Zmutowany krzak', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.ellipse(8, 10, 6, 4, 'G').ellipse(6, 9, 3, 2, 'l').ellipse(11, 11, 2, 2, 'g');
      g.set(4, 11, 'm').set(10, 8, 'm').set(12, 12, 'P').set(7, 12, 'm');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'grass-tuft', name: 'Kępka trawy', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      [[4, 9], [6, 7], [8, 8], [10, 6], [12, 9]].forEach(([x, y]) => g.vline(x, y, 15 - y - 2, 'G').set(x, y, 'l'));
      g.hline(3, 13, 11, 'g');
      return sprite(g);
    },
  },
  {
    code: 'crate', name: 'Skrzynia', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(2, 3, 12, 12, 'B').bevel(2, 3, 12, 12, 'k', 'b');
      g.line(3, 4, 12, 13, 'b').line(12, 4, 3, 13, 'b');
      g.hline(2, 8, 12, 'k');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'barrel-toxic', name: 'Beczka z odpadami', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(4, 3, 8, 12, 'R').vline(4, 3, 12, 'o').vline(11, 3, 12, 'r');
      g.hline(4, 6, 8, 'r').hline(4, 11, 8, 'r');
      g.ellipse(8, 3, 4, 1, 'o').set(7, 3, 'l').set(8, 3, 'l');
      g.rect(7, 8, 2, 2, 'l').set(8, 7, 'l');
      g.outline().shadow(15, 3, 12);
      return sprite(g);
    },
  },
  {
    code: 'car-wreck', name: 'Wrak auta', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(1, 4, 14, 9, 'R').bevel(1, 4, 14, 9, 'o', 'r');
      g.rect(4, 5, 8, 3, 'c').hline(4, 5, 8, 'C');
      g.rect(4, 9, 8, 2, 'r');
      g.rect(2, 12, 3, 3, '0').rect(11, 12, 3, 3, '0').set(3, 13, '2').set(12, 13, '2');
      g.set(1, 6, 'y').set(14, 6, 'x');
      g.noise(R('wreck'), [['B', 0.06]], [1, 4, 14, 8]);
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'tires', name: 'Sterta opon', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.ellipse(8, 12, 6, 2, '1').ellipse(8, 12, 3, 1, '0');
      g.ellipse(8, 8, 5, 2, '1').ellipse(8, 8, 2, 1, '0');
      g.ellipse(8, 4, 4, 2, '1').ellipse(8, 4, 2, 1, '0');
      g.set(4, 11, '2').set(5, 7, '2').set(6, 3, '2');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'lamp-post', name: 'Latarnia (bez prądu)', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.vline(7, 3, 12, '3').vline(8, 3, 12, '2');
      g.hline(7, 2, 5, '3').rect(10, 2, 3, 2, '5').set(11, 3, 'y');
      g.hline(5, 15, 6, '2');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'terminal-dead', name: 'Martwy terminal AI', solid: true, make: () => {
      const frames = [0, 1].map(f => {
        const g = new Grid(T, T, '.');
        g.rect(3, 1, 10, 14, '2').bevel(3, 1, 10, 14, '3', '1');
        g.rect(4, 2, 8, 6, '1').rect(5, 3, 6, 4, 'c');
        g.hline(5, 4, 4, f ? 'C' : 'c').set(9, 6, f ? 'x' : 'X');
        g.rect(5, 9, 6, 1, '3').rect(5, 11, 6, 1, '3');
        g.set(6, 13, f ? 'x' : '1');
        g.outline().shadow(15, 2, 13);
        return g;
      });
      return sprite(...frames);
    },
  },
  {
    code: 'server-rack', name: 'Szafa serwerowa', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(3, 0, 10, 15, '2').bevel(3, 0, 10, 15, '3', '1');
      for (let y = 2; y < 14; y += 3) { g.hline(4, y, 8, '1'); g.set(5, y + 1, 'x').set(7, y + 1, '1').set(10, y + 1, 'C'); }
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'bookshelf', name: 'Regał z książkami', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(1, 0, 14, 15, 'b').bevel(1, 0, 14, 15, 'B', 'r');
      const colors = ['x', 'U', 'G', 'O', 'P', '6', 'R'];
      const r = R('books');
      for (const y of [1, 6, 11]) {
        for (let x = 2; x < 14; x++) {
          const c = colors[Math.floor(r() * colors.length)];
          const h = 3 + Math.floor(r() * 2);
          g.vline(x, y + (4 - h), h, c);
        }
        g.hline(2, y + 4, 12, 'B');
      }
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'rubble', name: 'Kupa gruzu', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.ellipse(8, 11, 7, 4, '3').ellipse(6, 9, 4, 3, '4').ellipse(11, 10, 3, 2, '4');
      g.noise(R('rubble'), [['5', 0.1], ['2', 0.15], ['R', 0.05]]);
      g.line(3, 7, 7, 4, 'R');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'campfire', name: 'Ognisko', solid: true, make: () => {
      const frames = [0, 1].map(f => {
        const g = new Grid(T, T, '.');
        g.ellipse(8, 13, 5, 1, '3').line(3, 14, 12, 11, 'B').line(3, 11, 12, 14, 'b');
        g.ellipse(8, 9 - f, 3, 4, 'o').ellipse(8, 10 - f, 2, 2, 'O').set(8, 9 - f, 'y').set(8 - f, 4, 'o').set(9 + f, 3, 'x');
        g.outline();
        return g;
      });
      return sprite(...frames);
    },
  },
  {
    code: 'sign-board', name: 'Tablica', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.vline(4, 9, 6, 'b').vline(11, 9, 6, 'b');
      g.rect(1, 2, 14, 8, 'B').bevel(1, 2, 14, 8, 'k', 'b');
      g.hline(3, 4, 7, '0').hline(3, 6, 9, '0').hline(3, 8, 5, '0');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'neon-sign', name: 'Neon (zgasły)', solid: true, make: () => {
      const frames = [0, 1].map(f => {
        const g = new Grid(T, T, '.');
        g.rect(1, 3, 14, 9, '1').bevel(1, 3, 14, 9, '2', '0');
        const c = f ? 'm' : 'p';
        g.vline(3, 5, 5, c).hline(3, 5, 3, c).hline(3, 7, 3, c).hline(3, 9, 3, c);
        g.vline(8, 5, 5, 'p').vline(10, 5, 5, 'p').hline(8, 5, 3, 'p');
        g.vline(12, 5, 5, c);
        g.outline();
        return g;
      });
      return sprite(...frames);
    },
  },
  {
    code: 'trash-bags', name: 'Worki ze śmieciami', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.ellipse(5, 11, 4, 3, '2').ellipse(11, 12, 4, 3, '3').ellipse(8, 8, 3, 3, '2');
      g.set(3, 9, '4').set(4, 9, '4').set(10, 10, '4').set(11, 10, '5').set(7, 6, '4').set(8, 5, 'G').set(9, 5, 'G');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'bed', name: 'Prycza', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(2, 2, 12, 13, 'b').rect(3, 3, 10, 11, 'U').rect(3, 3, 10, 3, '6').bevel(3, 6, 10, 8, 'U', 'u');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'table', name: 'Stół', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(1, 4, 14, 7, 'B').bevel(1, 4, 14, 7, 'k', 'b').vline(2, 11, 4, 'b').vline(13, 11, 4, 'b');
      g.rect(4, 5, 3, 2, '6').set(10, 6, 'x');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'stairs-down', name: 'Zejście / przejście', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(1, 1, 14, 14, '2');
      for (let i = 0; i < 5; i++) g.rect(2 + i, 2 + i * 2, 12 - i * 2, 2, i % 2 ? '3' : '4');
      g.rect(7, 12, 2, 2, '0');
      g.outline();
      return sprite(g);
    },
  },
  // ---- 2074: martwe roboty serwisowe i zabudowa mieszkalna ----
  {
    code: 'robot-fallen-a', name: 'Martwy robot (leży)', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(10, 8, 5, 2, '5').hline(10, 10, 5, '4').rect(14, 7, 2, 4, '4');
      g.set(10, 8, '3').set(12, 8, '3');
      g.rect(5, 6, 6, 6, '6').bevel(5, 6, 6, 6, '7', '4');
      g.rect(7, 8, 2, 2, '2').set(7, 8, 'c');
      g.ellipse(3, 9, 2, 2, '6').vline(1, 8, 3, '1').set(1, 9, 'c');
      g.line(7, 5, 9, 2, '5').set(9, 1, '4').set(7, 5, '3');
      g.line(8, 12, 9, 13, '5');
      g.outline().shadow(14, 2, 14);
      return sprite(g);
    },
  },
  {
    code: 'robot-fallen-b', name: 'Martwy robot (otwarty)', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(1, 8, 5, 2, '5').hline(1, 10, 5, '4').rect(0, 7, 2, 4, '4');
      g.rect(5, 6, 6, 6, '6').bevel(5, 6, 6, 6, '7', '4');
      g.rect(6, 7, 4, 4, '0').set(7, 8, 'R').set(8, 9, 'o').set(6, 10, 'x').set(9, 7, 'R');
      g.ellipse(12, 9, 2, 2, '6').vline(14, 8, 3, '1').set(14, 9, 'c');
      g.line(8, 12, 6, 14, '5').set(6, 14, '4');
      g.outline().shadow(14, 1, 14);
      return sprite(g);
    },
  },
  {
    code: 'robot-slumped', name: 'Martwy robot (siedzi)', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.ellipse(8, 3, 3, 2, '6').hline(6, 3, 5, '1').set(7, 3, 'c');
      g.rect(5, 6, 7, 5, '6').bevel(5, 6, 7, 5, '7', '4').rect(7, 7, 3, 2, '3');
      g.rect(3, 7, 2, 5, '5').rect(12, 7, 2, 5, '5');
      g.rect(5, 11, 3, 4, '5').rect(9, 11, 3, 4, '5').hline(5, 14, 3, '4').hline(9, 14, 3, '4');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'robot-head', name: 'Głowa robota', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.ellipse(8, 10, 4, 3, '6').hline(5, 9, 7, '1').set(6, 9, 'c').set(10, 9, 'c');
      g.hline(5, 12, 7, '4').set(4, 11, '5');
      g.line(11, 13, 14, 14, 'R').set(14, 14, 'o');
      g.outline().shadow(14, 4, 12);
      return sprite(g);
    },
  },
  {
    code: 'trash-container', name: 'Kontener na śmieci', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(1, 4, 14, 10, 'g').bevel(1, 4, 14, 10, 'G', '1');
      g.rect(0, 3, 16, 2, '1').hline(0, 3, 16, '2');
      for (let x = 3; x < 14; x += 3) g.vline(x, 6, 7, '1');
      g.rect(2, 14, 2, 2, '0').rect(12, 14, 2, 2, '0');
      g.set(5, 2, '2').set(9, 1, 'B').set(10, 2, '2');
      g.outline();
      return sprite(g);
    },
  },
  {
    code: 'doorway', name: 'Drzwi', solid: false, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(2, 0, 12, 16, 'b').rect(4, 2, 8, 14, 'B').bevel(4, 2, 8, 14, 'k', 'b');
      g.set(10, 9, 'y').hline(4, 15, 8, '1');
      return sprite(g);
    },
  },
  {
    code: 'window-wall', name: 'Ściana z oknem', solid: true, make: () => {
      const g = new Grid(T, T, '3');
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let bx = -off; bx < T; bx += 8) {
          g.rect(bx + 1, row * 4 + 1, 7, 3, 'R').hline(bx + 1, row * 4 + 1, 7, 'o').hline(bx + 1, row * 4 + 3, 7, 'r');
        }
      }
      g.rect(3, 3, 10, 9, '5').rect(4, 4, 8, 7, 'c').vline(8, 4, 7, '5').hline(4, 7, 8, '5');
      g.set(5, 5, 'C').set(9, 5, 'C').set(6, 5, 'C');
      g.hline(2, 12, 12, '6');
      return sprite(g);
    },
  },
  {
    code: 'kitchen-counter', name: 'Blat kuchenny', solid: true, make: () => {
      const g = new Grid(T, T, '.');
      g.rect(0, 3, 16, 12, '2').rect(0, 3, 16, 4, '4').hline(0, 3, 16, '5');
      g.rect(5, 4, 6, 2, 'U').set(6, 4, 'n');
      g.vline(8, 8, 6, '1').set(6, 11, '4').set(10, 11, '4');
      g.outline();
      return sprite(g);
    },
  },
];

export const TILES = [
  ...GROUND.map((t, i) => ({ code: t.code, name: t.name, layer: 'GROUND', solid: !!t.solid, sprite: t.make(), sortOrder: i })),
  ...OBJECTS.map((t, i) => ({ code: t.code, name: t.name, layer: 'OBJECT', solid: !!t.solid, sprite: t.make(), sortOrder: 100 + i })),
];
