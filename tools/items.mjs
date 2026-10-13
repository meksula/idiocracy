// Przedmioty startowe. Ikony 16x16 w palecie RDZA I NEON, zawsze z konturem '0'.
import { Grid, sprite } from './pixel.mjs';

const S = (fn) => { const g = new Grid(); fn(g); g.outline(); return sprite(g); };
const st = (o = {}) => ({ strength: 0, agility: 0, vitality: 0, intellect: 0, attack: 0, defense: 0, heal: 0, ...o });

export const ITEMS = [
  {
    code: 'rura-stalowa', name: 'Rura stalowa', type: 'WEAPON', slot: 'WEAPON', rarity: 'COMMON',
    description: 'Kiedyś woda, dziś argument. Najpopularniejsza broń 2074 roku.',
    stats: st({ attack: 4, strength: 1 }), price: 12,
    icon: S(g => { g.line(3, 13, 12, 4, '4').line(4, 13, 13, 4, '3').line(3, 12, 12, 3, '5'); g.rect(11, 2, 3, 3, '3').set(12, 3, '5'); g.set(6, 10, 'R').set(9, 7, 'R'); }),
  },
  {
    code: 'klucz-francuski', name: 'Klucz francuski', type: 'WEAPON', slot: 'WEAPON', rarity: 'COMMON',
    description: 'Odkręca śruby i problemy. Technicy nie rozstają się z nim nawet przez sen.',
    stats: st({ attack: 3, intellect: 1 }), price: 15,
    icon: S(g => { g.line(4, 12, 10, 6, '4').line(5, 12, 11, 6, '3'); g.rect(9, 2, 5, 5, '4').rect(11, 3, 2, 2, '.').set(13, 4, '.').set(9, 2, '5').set(10, 2, '5'); g.rect(2, 11, 3, 3, '3'); }),
  },
  {
    code: 'klawiatura-bojowa', name: 'Klawiatura bojowa', type: 'WEAPON', slot: 'WEAPON', rarity: 'UNCOMMON',
    description: 'Mechaniczna, podświetlana. Nikt już nie pamięta, jak się na niej pisze, ale bije się nią świetnie.',
    stats: st({ attack: 6, agility: 1, intellect: -1 }), price: 40, minLevel: 2,
    icon: S(g => { g.rect(1, 5, 14, 7, '2').bevel(1, 5, 14, 7, '3', '1'); for (let y = 6; y < 11; y += 2) for (let x = 2; x < 14; x += 2) g.set(x, y, '5'); g.hline(4, 10, 8, '6'); g.set(13, 6, 'n'); }),
  },
  {
    code: 'kurtka-skorzana', name: 'Kurtka skórzana', type: 'ARMOR', slot: 'BODY', rarity: 'COMMON',
    description: 'Prawdziwa skóra z prawdziwego lumpeksu.', wearColor: 'b',
    stats: st({ defense: 3, vitality: 1 }), price: 20,
    icon: S(g => { g.rect(4, 3, 8, 11, 'b').rect(2, 4, 2, 8, 'b').rect(12, 4, 2, 8, 'b'); g.vline(7, 3, 11, 'B').vline(8, 3, 11, '1'); g.set(5, 3, 'B').set(10, 3, 'B'); g.hline(4, 13, 8, 'B'); }),
  },
  {
    code: 'kamizelka-odblaskowa', name: 'Kamizelka odblaskowa', type: 'ARMOR', slot: 'BODY', rarity: 'COMMON',
    description: 'Widać cię z daleka. W świecie bez GPS to zaleta — i wada.', wearColor: 'O',
    stats: st({ defense: 2, agility: 1 }), price: 18,
    icon: S(g => { g.rect(4, 3, 8, 11, 'O').rect(6, 2, 4, 3, '.').vline(7, 5, 9, '.').vline(8, 5, 9, '.'); g.hline(4, 8, 3, '6').hline(9, 8, 3, '6').hline(4, 11, 3, '6').hline(9, 11, 3, '6'); g.vline(4, 3, 11, 'o'); }),
  },
  {
    code: 'kask-budowlany', name: 'Kask budowlany', type: 'ARMOR', slot: 'HEAD', rarity: 'COMMON',
    description: 'Chroni przed spadającymi tynkami i pomysłami.', wearColor: 'y',
    stats: st({ defense: 2 }), price: 10,
    icon: S(g => { g.ellipse(8, 9, 5, 4, 'y').rect(3, 9, 11, 5, '.').hline(2, 9, 12, 'O').hline(2, 10, 12, 'O'); g.vline(8, 5, 4, 'O'); g.set(5, 7, '7'); }),
  },
  {
    code: 'czapka-z-folii', name: 'Czapka z folii', type: 'ARMOR', slot: 'HEAD', rarity: 'UNCOMMON',
    description: 'Chroni przed falami 9G, których nikt już nie nadaje. Pewność siebie +100%.', wearColor: '5',
    stats: st({ vitality: 2, intellect: -1, defense: 1 }), price: 8,
    icon: S(g => { g.line(3, 12, 8, 2, '5').line(13, 12, 8, 2, '4'); for (let y = 3; y < 13; y++) { const w = Math.floor((y - 2) / 2); g.hline(8 - w, y, w * 2 + 1, y % 2 ? '6' : '5'); } g.hline(3, 12, 11, '4'); g.set(7, 6, '7'); }),
  },
  {
    code: 'spodnie-bojowki', name: 'Bojówki', type: 'ARMOR', slot: 'LEGS', rarity: 'COMMON',
    description: 'Dwanaście kieszeni. W każdej coś, czego nie pamiętasz.', wearColor: 'g',
    stats: st({ defense: 2, agility: 1 }), price: 14,
    icon: S(g => { g.rect(4, 2, 8, 3, 'g').rect(4, 5, 3, 9, 'g').rect(9, 5, 3, 9, 'g'); g.hline(4, 2, 8, 'G'); g.rect(4, 8, 2, 2, 'G').rect(10, 8, 2, 2, 'G'); }),
  },
  {
    code: 'buty-robocze', name: 'Buty robocze', type: 'ARMOR', slot: 'FEET', rarity: 'COMMON',
    description: 'Stalowe noski. Przetrwały upadek internetu, przetrwają i ciebie.', wearColor: 'b',
    stats: st({ defense: 1, vitality: 1 }), price: 12,
    icon: S(g => { g.rect(2, 5, 4, 6, 'b').rect(2, 10, 6, 3, 'b'); g.rect(9, 5, 4, 6, 'b').rect(9, 10, 6, 3, 'b'); g.hline(2, 12, 6, '1').hline(9, 12, 6, '1'); g.vline(2, 5, 6, 'B').vline(9, 5, 6, 'B'); }),
  },
  {
    code: 'okulary-zerowki', name: 'Okulary zerówki', type: 'ARMOR', slot: 'ACCESSORY', rarity: 'UNCOMMON',
    description: 'Nie poprawiają wzroku, ale wyglądasz w nich, jakbyś przeczytał książkę.',
    stats: st({ intellect: 2 }), price: 30,
    icon: S(g => { g.ellipse(4, 8, 3, 2, 'c').ellipse(11, 8, 3, 2, 'c').hline(7, 7, 2, '2'); g.set(3, 7, 'n').set(10, 7, 'n'); g.hline(0, 7, 1, '2').hline(15, 7, 1, '2'); }),
  },
  {
    code: 'latarka-dynamo', name: 'Latarka na dynamo', type: 'ARMOR', slot: 'OFFHAND', rarity: 'UNCOMMON',
    description: 'Kręcisz — świeci. Najbardziej zrozumiała technologia, jaka została.',
    stats: st({ intellect: 1, agility: 1, defense: 1 }), price: 35,
    icon: S(g => { g.rect(3, 6, 8, 5, '3').bevel(3, 6, 8, 5, '4', '2').rect(11, 5, 3, 7, '4').vline(13, 6, 5, 'y'); g.rect(5, 7, 3, 3, 'R').set(6, 8, 'o'); }),
  },
  {
    code: 'konserwa', name: 'Konserwa turystyczna', type: 'CONSUMABLE', rarity: 'COMMON', stackable: true,
    description: 'Data ważności: 2049. Smakuje dokładnie tak, jak brzmi.',
    stats: st({ heal: 15 }), price: 3,
    icon: S(g => { g.rect(3, 5, 10, 8, '4').bevel(3, 5, 10, 8, '5', '3').ellipse(8, 5, 5, 1, '5'); g.rect(4, 8, 8, 3, 'x').hline(5, 9, 6, '7'); }),
  },
  {
    code: 'woda-filtrowana', name: 'Woda filtrowana', type: 'CONSUMABLE', rarity: 'COMMON', stackable: true,
    description: 'Przefiltrowana przez trzy koszulki i jedną skarpetę. Prawie czysta.',
    stats: st({ heal: 10 }), price: 2,
    icon: S(g => { g.rect(5, 4, 6, 10, 'U').rect(6, 2, 4, 2, '5').rect(6, 1, 4, 1, 'x'); g.vline(6, 5, 8, 'n').rect(5, 8, 6, 3, '6').hline(6, 9, 4, 'U'); }),
  },
  {
    code: 'bateria', name: 'Bateria R20', type: 'JUNK', rarity: 'COMMON', stackable: true,
    description: 'Ciężka, stara, pełna prądu. W 2074 warta więcej niż złoto.',
    stats: st(), price: 6,
    icon: S(g => { g.rect(5, 3, 6, 11, 'u').rect(7, 2, 2, 1, '5'); g.rect(5, 3, 6, 3, 'y').vline(5, 3, 11, 'U'); g.set(8, 9, '7').hline(7, 10, 3, '7'); }),
  },
  {
    code: 'kabel-miedziany', name: 'Kabel miedziany', type: 'JUNK', rarity: 'COMMON', stackable: true,
    description: 'Zwój miedzi. Ktoś kiedyś przesyłał tym memy.',
    stats: st(), price: 4,
    icon: S(g => { g.ellipse(8, 8, 5, 5, 'o').ellipse(8, 8, 3, 3, '.').ellipse(8, 8, 4, 4, 'o'); g.ellipse(8, 8, 2, 2, '.'); g.set(4, 6, 'O').set(10, 4, 'O').line(13, 9, 15, 14, 'o'); }),
  },
  {
    code: 'chip-ai-martwy', name: 'Martwy chip AI', type: 'JUNK', rarity: 'RARE', stackable: true,
    description: 'Kiedyś wiedział wszystko. Dziś jest ładnym przyciskiem do papieru.',
    stats: st(), price: 50,
    icon: S(g => { g.rect(4, 4, 8, 8, '2').bevel(4, 4, 8, 8, '3', '1'); for (let i = 5; i < 12; i += 2) { g.set(i, 2, '5').set(i, 3, '4').set(i, 12, '4').set(i, 13, '5').set(2, i, '5').set(3, i, '4').set(12, i, '4').set(13, i, '5'); } g.rect(6, 6, 4, 4, 'c').set(7, 7, 'C'); }),
  },
  {
    code: 'encyklopedia-tom-3', name: 'Encyklopedia, tom 3', type: 'QUEST', rarity: 'RARE',
    description: 'Hasła od „Gab” do „Kaz”. Papierowa wiedza — najrzadszy surowiec 2074.',
    stats: st(), price: 0,
    icon: S(g => { g.rect(3, 2, 10, 12, 'x').vline(3, 2, 12, 'r').rect(5, 2, 8, 12, 'x'); g.rect(12, 3, 1, 10, '6'); g.rect(6, 4, 5, 2, 'O').hline(6, 8, 5, 'R'); g.hline(4, 13, 9, '6'); }),
  },
].map(i => ({ stackable: false, minLevel: 1, wearColor: null, slot: null, ...i }));
