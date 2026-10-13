// Formularze edytora dla poszczegolnych typow tresci.
import { el, spriteImg, showItemTip, hideTip, SLOT_NAMES, TYPE_NAMES, RARITY_NAMES, STAT_NAMES } from '../ui.js';
import { spriteCanvas } from '../palette.js';
import { characterCanvas } from '../charsprite.js';
import { PixelEditor, emptySprite } from './pixel-editor.js';
import { CrudTab, Editor, field, text, area, num, check, select, paletteSelect, statsEditor, itemStackList } from './common.js';

const ATTRS = ['strength', 'agility', 'vitality', 'intellect'];
const ITEM_STATS = [...ATTRS, 'attack', 'defense', 'heal'];
const APP_KEYS = ['skin', 'hair', 'eyes', 'primary', 'secondary', 'feet'];
const APP_NAMES = { skin: 'Skóra', hair: 'Włosy', eyes: 'Oczy', primary: 'Strój (góra)', secondary: 'Strój (dół)', feet: 'Buty' };
const icon = (sprite) => sprite ? spriteImg(sprite, 2) : el('span');
let pixelEditors = [];
const resetEditors = () => { pixelEditors.forEach(p => p.destroy()); pixelEditors = []; };

function pixelEditor(entity, key, markDirty, opts = {}) {
  resetEditors();
  entity[key] = entity[key] || emptySprite();
  const pe = new PixelEditor(entity[key], { ...opts, onChange: (s) => { entity[key] = s; markDirty(); opts.onChange?.(s); } });
  pixelEditors.push(pe);
  return pe.root;
}

/** Podglad postaci we wszystkich kierunkach. */
function charPreview(appFn) {
  const c = el('canvas', { class: 'pixel char-preview', width: 4 * 64 + 30, height: 64 });
  const draw = () => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ['S', 'E', 'N', 'W'].forEach((d, i) => ctx.drawImage(characterCanvas(appFn(), d, 0, 4), i * 74, 0));
  };
  draw();
  return { canvas: c, draw };
}

function appearanceEditor(entity, markDirty, keys = APP_KEYS, baseFn = () => ({})) {
  entity.appearance = entity.appearance || {};
  const prev = charPreview(() => ({ ...baseFn(), ...Object.fromEntries(Object.entries(entity.appearance).filter(([, v]) => v)) }));
  const box = el('div', { class: 'app-grid' });
  for (const k of keys) box.append(field(APP_NAMES[k], paletteSelect(entity.appearance, k, { onInput: () => { prev.draw(); markDirty(); } })));
  return el('div', {}, box, prev.canvas);
}

// ===================================================================== KAFELKI
export const tilesTab = () => new CrudTab({
  type: 'tiles', title: 'kafelek',
  label: (t) => t.name, icon: (t) => icon(t.sprite),
  newEntity: () => ({ code: '', name: '', layer: 'GROUND', solid: false, sortOrder: 0, sprite: emptySprite(16, 16, '3') }),
  form: (t, { markDirty }) => el('div', {},
    el('div', { class: 'form-grid' },
      field('Nazwa', text(t, 'name', { onInput: markDirty })),
      field('Warstwa', select(t, 'layer', [['GROUND', 'Grunt (pełny kafelek)'], ['OBJECT', 'Obiekt (z przezroczystością)']], { onInput: markDirty })),
      field('Kolejność na liście', num(t, 'sortOrder', { onInput: markDirty })),
      field('Kolizja', check(t, 'solid', 'blokuje ruch', markDirty))),
    el('h3', { text: 'Grafika 16×16' }),
    pixelEditor(t, 'sprite', markDirty, { tiledPreview: t.layer === 'GROUND' })),
});

// ================================================================== PRZEDMIOTY
export const itemsTab = () => new CrudTab({
  type: 'items', title: 'przedmiot',
  label: (i) => i.name, icon: (i) => icon(i.icon),
  newEntity: () => ({ code: '', name: '', description: '', type: 'JUNK', slot: null, rarity: 'COMMON', minLevel: 1, price: 0, stackable: false, wearColor: null, stats: {}, icon: emptySprite() }),
  beforeSave: (i) => { if (i.type !== 'WEAPON' && i.type !== 'ARMOR') i.slot = null; },
  form: (i, { markDirty }) => {
    const tip = el('div', { class: 'item-tip-preview' });
    const renderTip = () => {
      tip.innerHTML = '';
      const host = el('div', { class: 'row' }, icon(i.icon), el('span', { class: `r-${i.rarity}`, text: i.name || '(bez nazwy)' }));
      host.addEventListener('mouseenter', (e) => showItemTip(i, e));
      host.addEventListener('mouseleave', hideTip);
      tip.append(host, el('div', { class: 'hint', text: 'Najedź, aby zobaczyć tooltip jak w grze.' }));
    };
    const dirty = () => { markDirty(); renderTip(); };
    renderTip();
    return el('div', {},
      el('div', { class: 'form-grid' },
        field('Nazwa', text(i, 'name', { onInput: dirty })),
        field('Typ', select(i, 'type', Object.entries(TYPE_NAMES), { onInput: dirty })),
        field('Slot (dla broni/ubrań)', select(i, 'slot', Object.entries(SLOT_NAMES), { empty: '— nie zakłada się —', onInput: dirty })),
        field('Rzadkość', select(i, 'rarity', Object.entries(RARITY_NAMES), { onInput: dirty })),
        field('Wymagany poziom', num(i, 'minLevel', { min: 1, onInput: dirty })),
        field('Cena (c-coin)', num(i, 'price', { min: 0, onInput: dirty })),
        field('Kolor na postaci', paletteSelect(i, 'wearColor', { empty: '— nie zmienia wyglądu —', onInput: dirty }), 'Założony przedmiot przemaluje odpowiednią część postaci.'),
        field('Stos', check(i, 'stackable', 'można trzymać wiele w jednym slocie', dirty))),
      field('Opis (najlepiej z przymrużeniem oka)', area(i, 'description', 2, dirty)),
      el('h3', { text: 'Statystyki' }),
      statsEditor(i, 'stats', ITEM_STATS, STAT_NAMES, dirty),
      tip,
      el('h3', { text: 'Ikona 16×16' }),
      pixelEditor(i, 'icon', markDirty, { onChange: renderTip }));
  },
});

// ========================================================================= NPC
export const npcsTab = () => new CrudTab({
  type: 'npcs', title: 'NPC',
  label: (n) => n.name,
  icon: (n) => { const c = el('canvas', { class: 'pixel', width: 32, height: 32 }); c.getContext('2d').drawImage(characterCanvas(n.appearance, 'S', 0, 2), 0, 0); return c; },
  newEntity: () => ({ code: '', name: '', mapCode: null, x: 1, y: 1, greeting: '', appearance: { skin: 's', hair: 'B', eyes: '0', primary: '4', secondary: '2', feet: '1' } }),
  form: async (n, { markDirty }) => {
    const maps = await Editor.list('maps');
    const quests = (await Editor.list('quests')).filter(q => q.giverNpc === n.code);
    return el('div', {},
      el('div', { class: 'form-grid' },
        field('Imię / nazwa', text(n, 'name', { onInput: markDirty })),
        field('Mapa', select(n, 'mapCode', maps.map(m => [m.code, m.name]), { onInput: markDirty })),
        field('X', num(n, 'x', { min: 0, onInput: markDirty })),
        field('Y', num(n, 'y', { min: 0, onInput: markDirty }))),
      el('div', { class: 'hint', text: 'Pozycję wygodniej ustawić w edytorze map (narzędzie „NPC”).' }),
      field('Powitanie (pierwsza kwestia w dialogu)', area(n, 'greeting', 3, markDirty)),
      el('h3', { text: 'Wygląd' }),
      appearanceEditor(n, markDirty),
      el('h3', { text: 'Zleca misje' }),
      quests.length ? el('ul', {}, quests.map(q => el('li', { text: `${q.title} (${q.code})` }))) : el('div', { class: 'muted', text: 'Brak — przypisz NPC jako zleceniodawcę w zakładce Misje.' }));
  },
});

// ================================================================ RASY / KLASY
function raceClassForm(entity, markDirty, appKeys, extra = null) {
  return el('div', {},
    el('div', { class: 'form-grid' },
      field('Nazwa', text(entity, 'name', { onInput: markDirty })),
      field('Kolejność', num(entity, 'sortOrder', { onInput: markDirty })),
      field('Dostępność', check(entity, 'playable', 'do wyboru przy tworzeniu postaci', markDirty))),
    field('Opis', area(entity, 'description', 3, markDirty)),
    el('h3', { text: 'Atrybuty (sumują się: rasa + klasa + poziom)' }),
    statsEditor(entity, 'stats', ATTRS, STAT_NAMES, markDirty),
    el('h3', { text: 'Wygląd' }),
    appearanceEditor(entity, markDirty, appKeys),
    extra);
}

export const racesTab = () => new CrudTab({
  type: 'races', title: 'rasa', label: (r) => r.name,
  newEntity: () => ({ code: '', name: '', description: '', stats: { strength: 5, agility: 5, vitality: 5, intellect: 5 }, appearance: { skin: 's', eyes: '0', hair: 'B' }, playable: true, sortOrder: 9 }),
  form: (r, { markDirty }) => raceClassForm(r, markDirty, ['skin', 'eyes', 'hair']),
});

export const classesTab = () => new CrudTab({
  type: 'classes', title: 'klasa', label: (c) => c.name,
  newEntity: () => ({ code: '', name: '', description: '', stats: { strength: 0, agility: 0, vitality: 0, intellect: 0 }, appearance: { primary: '4', secondary: '2', feet: '1' }, startingItems: [], playable: true, sortOrder: 9 }),
  form: async (c, { markDirty }) => {
    const items = await Editor.list('items');
    c.startingItems = c.startingItems || [];
    return raceClassForm(c, markDirty, ['primary', 'secondary', 'feet'],
      el('div', {}, el('h3', { text: 'Przedmioty startowe (broń/ubrania zakładają się same)' }), itemStackList(c.startingItems, items, markDirty)));
  },
});

// ====================================================================== MISJE
const STEP_TYPES = [['TALK', 'Rozmowa z NPC'], ['VISIT', 'Dotrzyj w miejsce'], ['COLLECT', 'Zdobądź przedmioty'], ['KILL', 'Pokonaj wrogów (wymaga systemu walki)']];

export const questsTab = () => new CrudTab({
  type: 'quests', title: 'misja', label: (q) => q.title,
  newEntity: () => ({
    code: '', title: '', description: '', giverNpc: null, minLevel: 1, repeatable: false, sortOrder: 0,
    steps: [{ type: 'TALK', target: null, text: '', dialog: '' }],
    rewards: { ccoin: 10, xp: 50, items: [] }, dialog: { offer: '', progress: '', complete: '' },
  }),
  form: async (q, { markDirty }) => {
    const [npcs, maps, items] = await Promise.all([Editor.list('npcs'), Editor.list('maps'), Editor.list('items')]);
    q.rewards = q.rewards || { ccoin: 0, xp: 0, items: [] };
    q.rewards.items = q.rewards.items || [];
    q.dialog = q.dialog || {};
    const stepsBox = el('div', { class: 'steps' });
    const flow = el('div', { class: 'flow' });

    const renderFlow = () => {
      flow.innerHTML = '';
      const giver = npcs.find(n => n.code === q.giverNpc);
      const nodes = [`🗨 ${giver ? giver.name : '???'} zleca misję`];
      for (const s of q.steps) {
        if (s.type === 'TALK') nodes.push(`🗨 ${npcs.find(n => n.code === s.target)?.name || '?'}`);
        else if (s.type === 'VISIT') nodes.push(`⌖ ${maps.find(m => m.code === s.target)?.name || '?'} [${s.x ?? '?'}, ${s.y ?? '?'}]`);
        else if (s.type === 'COLLECT') nodes.push(`▣ ${s.count || 1}× ${items.find(i => i.code === s.target)?.name || '?'}${s.consume ? ' (oddaj)' : ''}`);
        else nodes.push(`⚔ ${s.count || 1}× ${s.target || '?'}`);
      }
      nodes.push(`◈ ${q.rewards.ccoin} c-coin · ${q.rewards.xp} XP${q.rewards.items.length ? ' · ' + q.rewards.items.length + ' przedm.' : ''}`);
      nodes.forEach((n, i) => { if (i) flow.append(el('span', { class: 'arrow', text: '→' })); flow.append(el('span', { class: 'node', text: n })); });
    };
    const dirty = () => { markDirty(); renderFlow(); };

    const renderSteps = () => {
      stepsBox.innerHTML = '';
      q.steps.forEach((s, i) => {
        const targetField = () => {
          if (s.type === 'TALK') return field('Z kim', select(s, 'target', npcs.map(n => [n.code, n.name]), { onInput: dirty }));
          if (s.type === 'VISIT') return el('div', { class: 'form-grid' },
            field('Mapa', select(s, 'target', maps.map(m => [m.code, m.name]), { onInput: dirty })),
            field('X', num(s, 'x', { onInput: dirty, nullable: true })), field('Y', num(s, 'y', { onInput: dirty, nullable: true })),
            field('Promień', num(s, 'radius', { min: 0, onInput: dirty, nullable: true })));
          if (s.type === 'COLLECT') return el('div', { class: 'form-grid' },
            field('Przedmiot', select(s, 'target', items.map(it => [it.code, it.name]), { onInput: dirty })),
            field('Ilość', num(s, 'count', { min: 1, onInput: dirty, nullable: true })),
            field('Oddanie', check(s, 'consume', 'zabierz przedmioty po zaliczeniu', dirty)));
          return el('div', { class: 'form-grid' },
            field('Kod przeciwnika', text(s, 'target', { onInput: dirty })),
            field('Ilość', num(s, 'count', { min: 1, onInput: dirty, nullable: true })));
        };
        const card = el('div', { class: 'step panel' },
          el('div', { class: 'row' },
            el('b', { class: 'amber', text: `Krok ${i + 1}` }),
            select(s, 'type', STEP_TYPES, { onInput: () => { s.target = null; dirty(); renderSteps(); } }),
            el('span', { class: 'spacer' }),
            el('button', { class: 'secondary small', disabled: i === 0, onclick: () => { [q.steps[i - 1], q.steps[i]] = [q.steps[i], q.steps[i - 1]]; dirty(); renderSteps(); } }, '↑'),
            el('button', { class: 'secondary small', disabled: i === q.steps.length - 1, onclick: () => { [q.steps[i + 1], q.steps[i]] = [q.steps[i], q.steps[i + 1]]; dirty(); renderSteps(); } }, '↓'),
            el('button', { class: 'danger small', onclick: () => { q.steps.splice(i, 1); dirty(); renderSteps(); } }, '✕')),
          targetField(),
          field('Cel w dzienniku gracza', text(s, 'text', { onInput: dirty, placeholder: 'np. Porozmawiaj z Haliną w bibliotece.' })),
          s.type === 'TALK' ? field('Co powie NPC przy zaliczeniu kroku', area(s, 'dialog', 2, dirty)) : null);
        stepsBox.append(card);
      });
      stepsBox.append(el('button', { class: 'neon small', onclick: () => { q.steps.push({ type: 'TALK', target: null, text: '', dialog: '' }); dirty(); renderSteps(); } }, '+ Dodaj krok'));
    };
    renderSteps();
    renderFlow();

    return el('div', {},
      el('div', { class: 'form-grid' },
        field('Tytuł', text(q, 'title', { onInput: dirty })),
        field('Zleceniodawca', select(q, 'giverNpc', npcs.map(n => [n.code, `${n.name} (${n.mapCode})`]), { empty: '— brak —', onInput: dirty })),
        field('Min. poziom', num(q, 'minLevel', { min: 1, onInput: dirty })),
        field('Kolejność', num(q, 'sortOrder', { onInput: dirty })),
        field('Powtarzalna', check(q, 'repeatable', 'można brać wielokrotnie', dirty))),
      field('Opis (w dzienniku)', area(q, 'description', 2, dirty)),
      el('h3', { text: 'Przebieg' }), flow,
      el('h3', { text: 'Dialogi zleceniodawcy' }),
      field('Propozycja misji', area(q.dialog, 'offer', 3, dirty)),
      field('Gdy gracz wraca w trakcie', area(q.dialog, 'progress', 2, dirty)),
      field('Po ukończeniu (przy nagrodzie)', area(q.dialog, 'complete', 2, dirty)),
      el('h3', { text: 'Kroki' }), stepsBox,
      el('h3', { text: 'Nagroda' }),
      el('div', { class: 'form-grid' }, field('c-coin', num(q.rewards, 'ccoin', { min: 0, onInput: dirty })), field('XP', num(q.rewards, 'xp', { min: 0, onInput: dirty }))),
      itemStackList(q.rewards.items, items, dirty));
  },
});

export { resetEditors, spriteCanvas };
