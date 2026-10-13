// A* po siatce 4-kierunkowej (klik-i-idz jak w Tibii/Margonem).
const DIRS = [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]];

/**
 * Zwraca liste kierunkow od (sx,sy) do (tx,ty) albo null.
 * walkable(x,y) -> bool. Gdy cel jest nieprzechodni, mozna podac adjacent=true,
 * wtedy szukamy drogi do najblizszego sasiada celu.
 */
export function findPath(sx, sy, tx, ty, walkable, { adjacent = false, maxNodes = 4000 } = {}) {
  const goal = (x, y) => adjacent
    ? Math.abs(x - tx) + Math.abs(y - ty) === 1 || (x === tx && y === ty)
    : x === tx && y === ty;
  if (goal(sx, sy)) return [];
  const key = (x, y) => (y << 16) | x;
  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  const open = [{ x: sx, y: sy, g: 0, f: h(sx, sy) }];
  const came = new Map();
  const gScore = new Map([[key(sx, sy), 0]]);
  let visited = 0;
  while (open.length && visited++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (goal(cur.x, cur.y)) {
      const path = [];
      let k = key(cur.x, cur.y);
      while (came.has(k)) { const [prev, dir] = came.get(k); path.push(dir); k = prev; }
      return path.reverse();
    }
    for (const [dir, dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!walkable(nx, ny)) continue;
      const nk = key(nx, ny), g = cur.g + 1;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, [key(cur.x, cur.y), dir]);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}

export const DELTA = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
