// Edytor swiata: zakladki dla kazdego typu tresci + przewodnik stylu.
import { requireSession, logout } from '../api.js';
import { el } from '../ui.js';
import { PALETTE, PALETTE_GROUPS, SHADE } from '../palette.js';
import { MapEditor } from './map-editor.js';
import { tilesTab, itemsTab, npcsTab, racesTab, classesTab, questsTab, monstersTab, resetEditors } from './forms.js';

const s = requireSession();
if (s.role !== 'ADMIN') {
  document.body.innerHTML = '<main style="padding:40px"><h2>Brak dostępu</h2><p>Edytor jest dostępny tylko dla administratorów.</p><a href="/characters.html">Wróć</a></main>';
  throw new Error('not admin');
}
document.getElementById('who').textContent = s.email;
document.getElementById('logout').onclick = logout;

const TABS = [
  ['maps', 'Mapy', () => new MapEditor()],
  ['quests', 'Misje', questsTab],
  ['npcs', 'NPC', npcsTab],
  ['monsters', 'Potwory', monstersTab],
  ['items', 'Przedmioty', itemsTab],
  ['tiles', 'Kafelki', tilesTab],
  ['races', 'Rasy', racesTab],
  ['classes', 'Klasy', classesTab],
  ['style', 'Styl graficzny', () => ({ root: styleGuide(), show() {} })],
];

const nav = document.getElementById('tabs');
const content = document.getElementById('content');
const instances = {};

async function open(id) {
  resetEditors();
  location.hash = id;
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  const def = TABS.find(t => t[0] === id) || TABS[0];
  const inst = instances[def[0]] || (instances[def[0]] = def[2]());
  content.innerHTML = '';
  content.append(inst.root);
  await inst.show();
}

for (const [id, label] of TABS) {
  const b = el('button', { class: 'secondary', onclick: () => open(id) }, label);
  b.dataset.id = id;
  nav.append(b);
}
open(location.hash.slice(1) || 'maps');
addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id && !nav.querySelector(`button.active[data-id="${id}"]`)) open(id);
});

function styleGuide() {
  const pal = el('div', { class: 'style-palette' });
  for (const g of PALETTE_GROUPS) {
    pal.append(el('div', { class: 'pal-row' }, el('div', { class: 'muted', text: g.name }),
      ...[...g.keys].map(k => el('div', { class: 'pal-cell' },
        el('div', { class: 'swatch big', style: { background: PALETTE[k] } }),
        el('code', { text: k }), el('span', { class: 'muted', text: `cień: ${SHADE[k]}` })))));
  }
  const prompt = `Zaprojektuj ikonę przedmiotu do gry Idiocracy (pixel-art 16x16).
Używaj WYŁĄCZNIE znaków palety: ${Object.keys(PALETTE).join(' ')} oraz "." (przezroczystość).
Zasady: czarny kontur "0" wokół kształtu, światło z lewej-góry, maks. 3-4 odcienie na obiekt,
świat stonowany (szarości, rdza, zgniła zieleń), neon (c C n) tylko dla technologii, róż/fiolet (p P m) dla anomalii.
Przedmiot: <NAZWA I KRÓTKI OPIS>
Zwróć JSON: {"w":16,"h":16,"frames":[[16 wierszy po 16 znaków]]}`;
  const ta = el('textarea', { rows: 9, readonly: true });
  ta.value = prompt;
  return el('div', { class: 'style-guide' },
    el('div', { class: 'panel' },
      el('h2', { text: 'Paleta „Rdza i Neon”' }),
      el('p', { text: 'Każda grafika w grze — kafelki, ikony, postacie — składa się wyłącznie z tych kolorów. Dzięki temu nowe przedmioty zawsze pasują do świata. Znak w kodzie sprite’a = jeden piksel.' }),
      pal),
    el('div', { class: 'panel' },
      el('h2', { text: 'Zasady stylu' }),
      el('ol', {},
        el('li', { text: 'Rozmiar: 16×16 pikseli (gra skaluje ×2–4, bez wygładzania).' }),
        el('li', { text: 'Obiekty i ikony mają czarny kontur „0” (przycisk „Auto-kontur”). Grunt — bez konturu, musi się kafelkować.' }),
        el('li', { text: 'Światło pada z lewej-góry: jaśniejszy odcień na górze/lewej krawędzi, ciemniejszy (kolumna „cień”) na dole/prawej.' }),
        el('li', { text: 'Maks. 3–4 odcienie na jeden obiekt. Mniej = czytelniej.' }),
        el('li', { text: 'Świat jest zmęczony: szarości, rdza, zgniła zieleń. Neon (c C n) = technologia/AI, róż i fiolet (p P m) = anomalie, luksus, niebezpieczeństwo.' }),
        el('li', { text: 'Postacie są składane automatycznie z szablonu — rasa daje skórę i oczy, klasa strój, a przedmiot z „kolorem na postaci” przemalowuje odpowiednią część.' }),
        el('li', { text: 'Potwory: sprite zwrócony w prawo, 2 klatki chodu; gra sama odbija go przy ruchu w lewo.' }))),
    el('div', { class: 'panel' },
      el('h2', { text: 'Projektowanie z Claude' }),
      el('p', { text: 'Skopiuj ten prompt, uzupełnij opis przedmiotu i wklej odpowiedź w „Import / eksport tekstowy” pod edytorem pikseli.' }),
      ta));
}
