// Drobne helpery DOM: el(), toast(), tooltip przedmiotu.
import { spriteCanvas } from './palette.js';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function toast(text, kind = '') {
  let box = document.getElementById('toasts');
  if (!box) { box = el('div', { id: 'toasts' }); document.body.append(box); }
  const t = el('div', { class: `toast ${kind}`, text });
  box.append(t);
  setTimeout(() => t.remove(), 3500);
}

/** Canvas z ikoną sprite'a (np. przedmiotu) w danej skali. */
export function spriteImg(sprite, scale = 2, cacheKey = null) {
  const src = spriteCanvas(sprite, 0, scale, cacheKey);
  const c = el('canvas', { class: 'pixel', width: src.width, height: src.height });
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

export const SLOT_NAMES = {
  HEAD: 'Głowa', BODY: 'Tułów', LEGS: 'Nogi', FEET: 'Stopy', WEAPON: 'Broń', OFFHAND: 'Druga ręka', ACCESSORY: 'Dodatek',
};
export const TYPE_NAMES = { WEAPON: 'Broń', ARMOR: 'Ubranie / pancerz', CONSUMABLE: 'Do użycia', QUEST: 'Przedmiot fabularny', JUNK: 'Złom / surowiec' };
export const RARITY_NAMES = { COMMON: 'zwykły', UNCOMMON: 'niezwykły', RARE: 'rzadki', EPIC: 'epicki', LEGENDARY: 'legendarny' };
export const STAT_NAMES = {
  strength: 'Siła', agility: 'Zręczność', vitality: 'Wytrzymałość', intellect: 'Intelekt',
  attack: 'Atak', defense: 'Obrona', heal: 'Leczenie',
};

let tipEl = null;
export function showItemTip(item, evt, extra = '') {
  hideTip();
  if (!item) return;
  const stats = Object.entries(item.stats || {}).filter(([, v]) => v);
  tipEl = el('div', { class: 'tooltip' },
    el('div', { class: `t-name r-${item.rarity}`, text: item.name }),
    el('div', { class: 'muted', text: `${TYPE_NAMES[item.type] || item.type}${item.slot ? ' · ' + SLOT_NAMES[item.slot] : ''} · ${RARITY_NAMES[item.rarity] || ''}` }),
    stats.map(([k, v]) => el('div', { class: `t-stat ${v < 0 ? 'neg' : ''}`, text: `${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k] || k}` })),
    item.minLevel > 1 ? el('div', { class: 'amber', text: `Wymagany poziom: ${item.minLevel}` }) : null,
    el('div', { class: 't-desc', text: item.description || '' }),
    item.price ? el('div', { class: 'ccoin', text: `${item.price} c-coin` }) : null,
    extra ? el('div', { class: 'neon-text', text: extra }) : null,
  );
  document.body.append(tipEl);
  moveTip(evt);
}

export function moveTip(evt) {
  if (!tipEl) return;
  const pad = 16;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  const r = tipEl.getBoundingClientRect();
  if (x + r.width > innerWidth) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight) y = evt.clientY - r.height - pad;
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${y}px`;
}

export function hideTip() { tipEl?.remove(); tipEl = null; }
