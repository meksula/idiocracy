// Potwory startowe. Sprite zwrocony w prawo (E), 2 klatki chodu.
import { Grid, sprite } from './pixel.mjs';

function rat(frame) {
  const g = new Grid();
  g.line(3, 10, 1, 8, 'S').line(1, 8, 0, 5, 'S').set(2, 10, 'S');
  g.ellipse(7, 10, 5, 3, 'B').hline(4, 12, 7, 'k').hline(5, 13, 5, 'k');
  g.set(5, 8, 'G').set(6, 8, 'G').set(6, 7, 'l').set(9, 9, 'G').set(4, 10, 'G');
  g.ellipse(12, 9, 2, 2, 'B').set(14, 10, 'S').set(15, 10, 'x').set(14, 11, '7');
  g.set(11, 6, 'S').set(11, 7, 'S').set(12, 7, 'S');
  g.set(12, 8, 'l').set(13, 8, 'y');
  if (frame === 0) { g.set(5, 13, 'b').set(5, 14, 'b').set(10, 13, 'b').set(10, 14, 'b'); }
  else { g.set(3, 13, 'b').set(4, 14, 'b').set(8, 13, 'b').set(9, 14, 'b').set(11, 14, 'b'); }
  g.outline();
  return g;
}

export const MONSTERS = [
  {
    code: 'szczur-zmutowany', name: 'Zmutowany szczur', level: 1,
    maxHp: 14, attack: 2, defense: 0, xp: 10, ccoinMin: 0, ccoinMax: 1,
    aggressive: true, aggroRange: 2, moveDelayMs: 420, attackDelayMs: 1500, respawnSec: 20,
    loot: [{ code: 'ogon-szczura', chance: 45, min: 1, max: 1 }, { code: 'konserwa', chance: 4, min: 1, max: 1 }],
    sprite: sprite(rat(0), rat(1)),
  },
];
