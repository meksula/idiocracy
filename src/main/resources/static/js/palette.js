// ============================================================
// Paleta "RDZA I NEON" - jedyne zrodlo kolorow dla calej grafiki.
// Kazdy sprite (kafelki, przedmioty, postacie) zapisujemy jako
// siatke znakow: 1 znak = 1 piksel = 1 klucz z tej palety.
// '.' oznacza przezroczystosc. Zasady stylu: docs/STYLE_GUIDE.md
// ============================================================

export const PALETTE = {
  // neutralne (beton, metal, cien)
  '0': '#0d0e12', '1': '#1f2129', '2': '#353845', '3': '#4f5363',
  '4': '#737889', '5': '#a2a6b3', '6': '#d3d5db', '7': '#f4f4f0',
  // rdza / ogien
  'r': '#5a2a1c', 'R': '#8f4426', 'o': '#c46a2b', 'O': '#e8a04a', 'y': '#f2d16b',
  // ziemia / zgnila zielen / toksyny
  'b': '#3b2f25', 'B': '#6b5340', 'k': '#9c7f5f', 'g': '#2f4a2b', 'G': '#4f7a3a', 'l': '#8fbf3f',
  // neon - technologia, AI, "zywy" prad
  'c': '#0f3d4a', 'C': '#1b7a8c', 'n': '#3fe0d0',
  // fiolet / roz - niebezpieczenstwo, anomalie, luksus
  'p': '#4b1e5e', 'P': '#a03ec8', 'm': '#ff4fa3',
  // skora
  's': '#f0c8a0', 'S': '#c98e63', 'd': '#8a5a3c', 'e': '#9fb8a4',
  // czerwien / niebieski
  'x': '#b8323a', 'X': '#ff5a4a', 'u': '#23305e', 'U': '#3b5bab',
};

export const PALETTE_GROUPS = [
  { name: 'Neutralne', keys: '01234567' },
  { name: 'Rdza', keys: 'rRoOy' },
  { name: 'Ziemia i toksyny', keys: 'bBkgGl' },
  { name: 'Neon', keys: 'cCn' },
  { name: 'Anomalie', keys: 'pPm' },
  { name: 'Skora', keys: 'sSde' },
  { name: 'Czerwien / blekit', keys: 'xXuU' },
];

export const TRANSPARENT = '.';

/** Ciemniejszy odpowiednik koloru - do automatycznego cieniowania (np. postaci). */
export const SHADE = {
  '0': '0', '1': '0', '2': '1', '3': '2', '4': '3', '5': '4', '6': '5', '7': '6',
  'r': '0', 'R': 'r', 'o': 'R', 'O': 'o', 'y': 'O',
  'b': '0', 'B': 'b', 'k': 'B', 'g': '1', 'G': 'g', 'l': 'G',
  'c': '0', 'C': 'c', 'n': 'C',
  'p': '1', 'P': 'p', 'm': 'P',
  's': 'S', 'S': 'd', 'd': 'b', 'e': 'G',
  'x': 'r', 'X': 'x', 'u': '1', 'U': 'u',
};

const cache = new Map();

/**
 * Renderuje klatke sprite'a do offscreen canvas (cache). scale = wielkosc piksela.
 * sprite: { w, h, frames: [[ "row", ... ], ...] }
 */
export function spriteCanvas(sprite, frame = 0, scale = 1, cacheKey = null) {
  const key = cacheKey ? `${cacheKey}|${frame}|${scale}` : null;
  if (key && cache.has(key)) return cache.get(key);
  const rows = sprite.frames[frame % sprite.frames.length];
  const cv = makeCanvas(sprite.w * scale, sprite.h * scale);
  const ctx = cv.getContext('2d');
  for (let y = 0; y < sprite.h; y++) {
    const row = rows[y] || '';
    for (let x = 0; x < sprite.w; x++) {
      const c = PALETTE[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  if (key) cache.set(key, cv);
  return cv;
}

export function clearSpriteCache(prefix) {
  for (const k of cache.keys()) if (!prefix || k.startsWith(prefix)) cache.delete(k);
}

export function spriteDataUrl(sprite, scale = 2) {
  return spriteCanvas(sprite, 0, scale).toDataURL();
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}
