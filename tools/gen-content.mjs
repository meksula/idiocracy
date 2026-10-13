// Generuje startowa tresc graficzna: kafelki, ikony przedmiotow i mapy.
// Uzycie: node tools/gen-content.mjs   (nadpisuje pliki w src/main/resources/content)
// Rasy, klasy, NPC i misje sa pisane recznie w JSON (to tekst/fabula, nie grafika).
import { writeFileSync, mkdirSync } from 'node:fs';
import { TILES } from './tiles.mjs';
import { ITEMS } from './items.mjs';
import { MAPS, ascii } from './maps.mjs';

const out = new URL('../src/main/resources/content/', import.meta.url);
mkdirSync(new URL('maps/', out), { recursive: true });

const json = (v) => JSON.stringify(v, null, 1);
writeFileSync(new URL('tiles.json', out), json(TILES));
writeFileSync(new URL('items.json', out), json(ITEMS));
const solid = new Set(TILES.filter(t => t.solid).map(t => t.code));
for (const map of MAPS) {
  writeFileSync(new URL(`maps/${map.code}.json`, out), JSON.stringify(map));
  if (process.argv.includes('--ascii')) console.log(`\n== ${map.code}\n` + ascii(map, solid));
}
console.log(`tiles: ${TILES.length}, items: ${ITEMS.length}, maps: ${MAPS.length}`);
