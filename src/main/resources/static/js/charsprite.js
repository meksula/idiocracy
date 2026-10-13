// Proceduralne sprite'y postaci (gracze i NPC) skladane z szablonu + kolorow wygladu.
// Dzieki temu kazda rasa/klasa/przedmiot automatycznie pasuje do stylu gry.
//
// Znaki szablonu: '#' kontur, H/h wlosy (+cien), S/s skora, E oczy,
// P/p stroj glowny, Q/q stroj dolny, F buty. Cien liczony z palety (SHADE).
import { SHADE, spriteCanvas } from './palette.js';

const HEAD_DOWN = [
  '................',
  '.....######.....',
  '....#HHHHHH#....',
  '...#HHHHHHHh#...',
  '...#HSSSSSSh#...',
  '...#SSESSESs#...',
  '...#SSSSSSSs#...',
  '....#sSSSSs#....',
];
const HEAD_UP = [
  '................',
  '.....######.....',
  '....#HHHHHH#....',
  '...#HHHHHHHh#...',
  '...#HHHHHHHh#...',
  '...#HHHHHHHh#...',
  '...#hHHHHHHh#...',
  '....#sSSSSs#....',
];
const BODY_FRONT = [
  '...##PPPPPp##...',
  '..#SPPPPPPPpS#..',
  '..#SPPPPPPPpS#..',
  '..#s#QQQQQq#s#..',
];
const LEGS_FRONT = [
  [
    '....#QQ##Qq#....',
    '....#QQ##Qq#....',
    '....#FF##FF#....',
    '....###..###....',
  ],
  [
    '....#QQ##Qq#....',
    '....#FF##Qq#....',
    '....###.#FF#....',
    '.........###....',
  ],
  [
    '....#QQ##Qq#....',
    '....#QQ##FF#....',
    '....#FF#.###....',
    '....###.........',
  ],
];
const SIDE = [
  '................',
  '.....#####......',
  '....#HHHHH#.....',
  '...#HHHHHHH#....',
  '...#HHHHSSS#....',
  '...#HHHSSES#....',
  '...#hHSSSSS#....',
  '....#hsSSs#.....',
  '....#PPPPp#.....',
  '....#PPPPp#.....',
  '....#PPSPp#.....',
  '....#QQQQq#.....',
];
const LEGS_SIDE = [
  [
    '.....#QQq#......',
    '.....#QQq#......',
    '.....#FFFF#.....',
    '.....######.....',
  ],
  [
    '....#QQ#Qq#.....',
    '...#QQ#..#Qq#...',
    '...#FF#..#FFF#..',
    '...####..#####..',
  ],
  [
    '....#QQ#Qq#.....',
    '...#Qq#..#QQ#...',
    '...#FF#..#FFF#..',
    '...####..#####..',
  ],
];

function frames(head, body, legs) { return legs.map(l => [...head, ...body, ...l]); }

const TEMPLATES = {
  S: frames(HEAD_DOWN, BODY_FRONT, LEGS_FRONT),
  N: frames(HEAD_UP, BODY_FRONT, LEGS_FRONT),
  E: LEGS_SIDE.map(l => [...SIDE, ...l]),
};
TEMPLATES.W = TEMPLATES.E.map(f => f.map(r => [...r].reverse().join('')));

for (const [dir, fs] of Object.entries(TEMPLATES)) {
  fs.forEach((f, i) => {
    if (f.length !== 16 || f.some(r => r.length !== 16)) throw new Error(`Zly szablon postaci ${dir}/${i}`);
  });
}

const DEFAULT_APP = { skin: 's', hair: 'B', eyes: '0', primary: '4', secondary: '2', feet: '1' };

function colorize(rows, app) {
  const a = { ...DEFAULT_APP, ...Object.fromEntries(Object.entries(app || {}).filter(([, v]) => v)) };
  const map = {
    '#': '0', H: a.hair, h: SHADE[a.hair] || a.hair, S: a.skin, s: SHADE[a.skin] || a.skin, E: a.eyes,
    P: a.primary, p: SHADE[a.primary] || a.primary, Q: a.secondary, q: SHADE[a.secondary] || a.secondary, F: a.feet,
  };
  return rows.map(r => [...r].map(ch => map[ch] ?? ch).join(''));
}

/** Sprite postaci w formacie {w,h,frames} - frames: 0 stoi, 1 i 2 krok. */
export function characterSprite(app, dir = 'S') {
  const t = TEMPLATES[dir] || TEMPLATES.S;
  return { w: 16, h: 16, frames: t.map(f => colorize(f, app)) };
}

function appKey(app) {
  const a = app || {};
  return ['skin', 'hair', 'eyes', 'primary', 'secondary', 'feet'].map(k => a[k] || '-').join('');
}

/** Gotowy (zcache'owany) canvas postaci. */
export function characterCanvas(app, dir, frame, scale) {
  const key = `char:${appKey(app)}:${dir}`;
  return spriteCanvas(characterSprite(app, dir), frame, scale, key);
}
