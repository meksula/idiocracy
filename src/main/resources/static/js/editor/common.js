// Wspolne klocki edytora: pola formularzy wiazane z obiektem i generyczna zakladka CRUD.
import { api } from '../api.js';
import { el, toast } from '../ui.js';
import { PALETTE, PALETTE_GROUPS } from '../palette.js';

export const Editor = {
  cache: {},
  async list(type, force = false) {
    if (force || !this.cache[type]) this.cache[type] = await api(`/api/editor/${type}`);
    return this.cache[type];
  },
  invalidate(type) { delete this.cache[type]; },
};

export function field(label, input, hint = null) {
  return el('div', { class: 'field' }, el('label', { text: label }), input, hint ? el('div', { class: 'hint', text: hint }) : null);
}

export function text(obj, key, { placeholder = '', onInput = null, readonly = false } = {}) {
  return el('input', {
    value: obj[key] ?? '', placeholder, readonly,
    oninput: (e) => { obj[key] = e.target.value; onInput?.(); },
  });
}

export function area(obj, key, rows = 3, onInput = null) {
  const t = el('textarea', { rows, oninput: (e) => { obj[key] = e.target.value; onInput?.(); } });
  t.value = obj[key] ?? '';
  return t;
}

export function num(obj, key, { min = null, max = null, onInput = null, nullable = false } = {}) {
  return el('input', {
    type: 'number', value: obj[key] ?? '', min, max,
    oninput: (e) => {
      const v = e.target.value;
      obj[key] = v === '' ? (nullable ? null : 0) : Number(v);
      onInput?.();
    },
  });
}

export function check(obj, key, label, onInput = null) {
  const c = el('input', { type: 'checkbox', onchange: (e) => { obj[key] = e.target.checked; onInput?.(); } });
  c.checked = !!obj[key];
  return el('label', { class: 'check' }, c, ` ${label}`);
}

/** options: [[value, label], ...] */
export function select(obj, key, options, { empty = null, onInput = null } = {}) {
  const s = el('select', { onchange: (e) => { obj[key] = e.target.value === '' ? null : e.target.value; onInput?.(); } });
  if (empty !== null) s.append(el('option', { value: '', text: empty }));
  for (const [v, l] of options) {
    const o = el('option', { value: v, text: l });
    if (String(obj[key] ?? '') === String(v)) o.selected = true;
    s.append(o);
  }
  if (empty === null && (obj[key] === undefined || obj[key] === null) && options.length) obj[key] = options[0][0];
  return s;
}

/** Wybor koloru z palety (klucz znaku). */
export function paletteSelect(obj, key, { empty = '— brak —', onInput = null } = {}) {
  const swatch = el('span', { class: 'swatch inline' });
  const paint = () => { swatch.style.background = PALETTE[obj[key]] || 'transparent'; };
  const opts = [];
  for (const g of PALETTE_GROUPS) for (const k of g.keys) opts.push([k, `${k} · ${g.name}`]);
  const s = select(obj, key, opts, { empty, onInput: () => { paint(); onInput?.(); } });
  paint();
  return el('div', { class: 'row palette-select' }, swatch, s);
}

export function statsEditor(obj, key, keys, labels, onInput = null) {
  obj[key] = obj[key] || {};
  const box = el('div', { class: 'stats-grid' });
  for (const k of keys) box.append(field(labels[k] || k, num(obj[key], k, { onInput })));
  return box;
}

/** Lista {code, quantity} z wyborem przedmiotu. */
export function itemStackList(arr, items, onInput = null) {
  const box = el('div', { class: 'stack-list' });
  const render = () => {
    box.innerHTML = '';
    arr.forEach((s, i) => {
      box.append(el('div', { class: 'row' },
        select(s, 'code', items.map(it => [it.code, `${it.name} (${it.code})`]), { onInput }),
        el('input', { type: 'number', min: 1, value: s.quantity ?? 1, style: { width: '80px' }, oninput: (e) => { s.quantity = Number(e.target.value) || 1; onInput?.(); } }),
        el('button', { class: 'danger small', onclick: () => { arr.splice(i, 1); render(); onInput?.(); } }, '✕'),
      ));
    });
    box.append(el('button', { class: 'secondary small', onclick: () => { arr.push({ code: items[0]?.code, quantity: 1 }); render(); onInput?.(); } }, '+ przedmiot'));
  };
  render();
  return box;
}

/**
 * Zakladka listy + formularza dla jednego typu tresci.
 * cfg: { type, title, newEntity(), label(e), icon(e)?, form(entity, ctx) -> Element }
 */
export class CrudTab {
  constructor(cfg) {
    this.cfg = cfg;
    this.root = el('div', { class: 'crud' });
    this.listBox = el('div', { class: 'crud-list' });
    this.formBox = el('div', { class: 'crud-form' });
    this.filter = el('input', { placeholder: 'Szukaj…', oninput: () => this.renderList() });
    this.root.append(
      el('div', { class: 'crud-left panel' },
        el('div', { class: 'row' }, this.filter, el('button', { class: 'neon small', onclick: () => this.edit(cfg.newEntity(), true) }, '+ Nowy')),
        this.listBox),
      this.formBox);
    this.current = null;
  }

  async show() {
    this.items = await Editor.list(this.cfg.type, true);
    this.renderList();
    if (!this.current && this.items[0]) this.edit(structuredClone(this.items[0]), false);
  }

  renderList() {
    const q = this.filter.value.toLowerCase();
    this.listBox.innerHTML = '';
    for (const it of this.items) {
      const label = this.cfg.label(it);
      if (q && !`${it.code} ${label}`.toLowerCase().includes(q)) continue;
      const row = el('div', { class: `crud-item ${this.current?.code === it.code ? 'sel' : ''}`, onclick: () => this.edit(structuredClone(it), false) },
        this.cfg.icon ? this.cfg.icon(it) : null,
        el('div', {}, el('div', { class: 'hi', text: label }), el('div', { class: 'muted code', text: it.code })));
      this.listBox.append(row);
    }
  }

  async edit(entity, isNew) {
    this.current = entity;
    this.isNew = isNew;
    this.renderList();
    this.formBox.innerHTML = '';
    const status = el('span', { class: 'muted' });
    const markDirty = () => { status.textContent = '● niezapisane zmiany'; status.className = 'amber'; };
    const ctx = { markDirty, isNew, refresh: () => this.edit(this.current, this.isNew) };
    const form = await this.cfg.form(entity, ctx);
    const codeInput = text(entity, 'code', { placeholder: 'kod-ascii', readonly: !isNew, onInput: markDirty });
    this.formBox.append(
      el('div', { class: 'panel crud-panel' },
        el('div', { class: 'row form-head' },
          el('h2', { text: isNew ? `Nowy: ${this.cfg.title}` : this.cfg.label(entity) }),
          el('span', { class: 'spacer' }), status,
          el('button', { onclick: () => this.save(status) }, 'Zapisz'),
          !isNew ? el('button', { class: 'secondary', onclick: () => this.edit(Object.assign(structuredClone(entity), { code: `${entity.code}-kopia` }), true) }, 'Duplikuj') : null,
          !isNew ? el('button', { class: 'danger', onclick: () => this.remove() }, 'Usuń') : null),
        field('Kod (unikalny identyfikator, a-z 0-9 - _)', codeInput, isNew ? 'Kodu nie da się później zmienić — inne elementy się do niego odwołują.' : null),
        form));
  }

  async save(status) {
    const e = this.current;
    try {
      this.cfg.beforeSave?.(e);
      const saved = await api(`/api/editor/${this.cfg.type}/${encodeURIComponent(e.code || '')}`, { method: 'PUT', body: e });
      toast(`Zapisano: ${e.code}`);
      Editor.invalidate(this.cfg.type);
      this.items = await Editor.list(this.cfg.type, true);
      status.textContent = '✓ zapisane';
      status.className = 'neon-text';
      this.current = saved;
      if (this.isNew) this.edit(structuredClone(saved), false);
      else this.renderList();
      this.cfg.afterSave?.(saved);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async remove() {
    const e = this.current;
    if (!confirm(`Usunąć ${e.code}?`)) return;
    try {
      await api(`/api/editor/${this.cfg.type}/${encodeURIComponent(e.code)}`, { method: 'DELETE' });
      toast(`Usunięto: ${e.code}`);
      Editor.invalidate(this.cfg.type);
      this.current = null;
      this.formBox.innerHTML = '';
      await this.show();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
}
