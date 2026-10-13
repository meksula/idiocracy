// HUD w DOM: karta postaci, ekwipunek, plecak, dziennik misji, czat, okno dialogu.
import { el, spriteImg, showItemTip, moveTip, hideTip, SLOT_NAMES, STAT_NAMES } from '../ui.js';
import { characterCanvas } from '../charsprite.js';

const SLOT_ORDER = ['HEAD', 'ACCESSORY', 'BODY', 'WEAPON', 'LEGS', 'OFFHAND', 'FEET'];
const BAG_SIZE = 24;

export class Hud {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);
    this.chatLog = this.$('chat-log');
    this.dialogBox = this.$('dialog');
  }

  // ------------------------------------------------------------ postac
  renderSelf() {
    const y = this.game.self;
    if (!y) return;
    this.$('char-name').textContent = y.name;
    this.$('char-sub').textContent = `Poziom ${y.level} · ${y.raceName} · ${y.className}`;
    this.$('ccoin').textContent = y.ccoin;
    this.bar('hp', y.hp, y.maxHp, `${y.hp} / ${y.maxHp} HP`);
    this.bar('xp', y.xp, y.xpNext, `${y.xp} / ${y.xpNext} XP`);
    const st = this.$('char-stats');
    st.innerHTML = '';
    const rows = [
      ['strength', y.stats.strength], ['agility', y.stats.agility], ['vitality', y.stats.vitality],
      ['intellect', y.stats.intellect], ['attack', y.attack], ['defense', y.defense],
    ];
    for (const [k, v] of rows) st.append(el('div', { class: 'stat' }, el('span', { text: STAT_NAMES[k] }), el('b', { text: v })));
    this.renderPortrait();
  }

  renderPortrait() {
    const c = this.$('portrait');
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(characterCanvas(this.game.me.app, 'S', 0, 4), 0, 0);
  }

  bar(id, v, max, label) {
    this.$(`${id}-fill`).style.width = `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;
    this.$(`${id}-label`).textContent = label;
  }

  setLocation(mapName, x, y) {
    this.$('loc').textContent = `${mapName} [${x}, ${y}]`;
  }

  // -------------------------------------------------------- ekwipunek
  renderInventory() {
    const { inventory, items } = this.game;
    const eq = this.$('equipment');
    eq.innerHTML = '';
    for (const slot of SLOT_ORDER) {
      const inv = inventory.find(i => i.slot === slot);
      const tpl = inv && items.get(inv.code);
      const cell = el('div', { class: `slot eq ${tpl ? 'r-' + tpl.rarity : ''}`, title: tpl ? '' : SLOT_NAMES[slot] },
        tpl ? spriteImg(tpl.icon, 2, `icon:${tpl.code}:${this.game.contentVersion}`) : el('span', { class: 'slot-label', text: SLOT_NAMES[slot] }));
      if (tpl) this.itemEvents(cell, tpl, 'Kliknij, aby zdjąć', () => this.game.send({ t: 'unequip', item: inv.id }));
      eq.append(cell);
    }
    const bag = this.$('bag');
    bag.innerHTML = '';
    const loose = inventory.filter(i => !i.slot);
    for (let i = 0; i < Math.max(BAG_SIZE, loose.length); i++) {
      const inv = loose[i];
      const tpl = inv && items.get(inv.code);
      const cell = el('div', { class: `slot ${tpl ? 'r-' + tpl.rarity : ''}` });
      if (tpl) {
        cell.append(spriteImg(tpl.icon, 2, `icon:${tpl.code}:${this.game.contentVersion}`));
        if (inv.qty > 1) cell.append(el('span', { class: 'qty', text: inv.qty }));
        const equippable = tpl.slot && (tpl.type === 'WEAPON' || tpl.type === 'ARMOR');
        const usable = tpl.type === 'CONSUMABLE';
        const hint = equippable ? 'Kliknij, aby założyć' : usable ? 'Kliknij, aby użyć' : '';
        this.itemEvents(cell, tpl, hint, () => {
          if (equippable) this.game.send({ t: 'equip', item: inv.id });
          else if (usable) this.game.send({ t: 'use', item: inv.id });
        });
      }
      bag.append(cell);
    }
  }

  itemEvents(cell, tpl, hint, onClick) {
    cell.addEventListener('mouseenter', (e) => showItemTip(tpl, e, hint));
    cell.addEventListener('mousemove', moveTip);
    cell.addEventListener('mouseleave', hideTip);
    cell.addEventListener('click', () => { hideTip(); onClick(); });
  }

  // ------------------------------------------------------------ misje
  renderQuests() {
    const box = this.$('quests');
    box.innerHTML = '';
    const active = this.game.quests.filter(q => q.status === 'ACTIVE');
    const done = this.game.quests.filter(q => q.status === 'COMPLETED');
    if (!active.length) box.append(el('div', { class: 'muted', text: 'Brak aktywnych misji. Szukaj postaci z „!” nad głową.' }));
    for (const q of active) {
      const progress = (q.type === 'KILL') ? ` (${q.progress}/${q.count})` : '';
      box.append(el('div', { class: 'quest' },
        el('div', { class: 'q-title', text: q.title }),
        el('div', { class: 'q-obj', text: `▸ ${q.objective || '...'}${progress}` }),
        el('div', { class: 'q-step muted', text: `Krok ${q.step + 1} z ${q.steps}` })));
    }
    if (done.length) box.append(el('div', { class: 'muted q-done', text: `Ukończone: ${done.map(q => q.title).join(', ')}` }));
  }

  // ------------------------------------------------------------- czat
  log(kind, text, from = null) {
    const line = el('div', { class: `line ${kind}` });
    const ts = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    line.append(el('span', { class: 'ts', text: ts + ' ' }));
    if (from) line.append(el('span', { class: 'from', text: `${from}: ` }));
    line.append(document.createTextNode(text));
    const stick = this.chatLog.scrollTop + this.chatLog.clientHeight >= this.chatLog.scrollHeight - 8;
    this.chatLog.append(line);
    while (this.chatLog.children.length > 200) this.chatLog.firstChild.remove();
    if (stick) this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  // ----------------------------------------------------------- dialog
  openDialog(msg) {
    const npc = this.game.map.npcs.find(n => n.code === msg.npc);
    const box = this.dialogBox;
    box.innerHTML = '';
    const portrait = el('canvas', { class: 'pixel', width: 64, height: 64 });
    if (npc) portrait.getContext('2d').drawImage(characterCanvas(npc.app, 'S', 0, 4), 0, 0);
    const body = el('div', { class: 'd-body' });
    const showMain = () => {
      body.innerHTML = '';
      for (const l of msg.lines) body.append(el('p', { text: l }));
      const opts = el('div', { class: 'd-opts' });
      for (const o of msg.offers) {
        opts.append(el('button', { class: 'neon', onclick: () => showOffer(o) }, `▶ Misja: ${o.title}`));
      }
      opts.append(el('button', { class: 'secondary', onclick: () => this.closeDialog() }, 'Do widzenia [Esc]'));
      body.append(opts);
    };
    const showOffer = (o) => {
      body.innerHTML = '';
      body.append(el('p', { class: 'amber', text: o.title }), el('p', { text: o.offer }));
      body.append(el('div', { class: 'd-opts' },
        el('button', { onclick: () => { this.game.send({ t: 'accept', quest: o.quest, npc: msg.npc }); this.closeDialog(); } }, 'Przyjmuję'),
        el('button', { class: 'secondary', onclick: showMain }, 'Nie teraz')));
    };
    box.append(el('div', { class: 'd-head' }, portrait, el('div', { class: 'd-name', text: msg.name })), body);
    showMain();
    box.classList.remove('hidden');
    this.dialogNpc = msg.npc;
  }

  closeDialog() {
    this.dialogBox.classList.add('hidden');
    this.dialogNpc = null;
  }

  get dialogOpen() { return !this.dialogBox.classList.contains('hidden'); }
}
