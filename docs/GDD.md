# Idiocracy — dokument projektowy gry (GDD)

> Żywy dokument: tu opisujemy **co** gra ma robić i **dlaczego**. Kod i edytor realizują to,
> co tu jest. Sekcje oznaczone ❓ czekają na decyzję autora. ✅ = już działa w grze.

## 1. Wizja w trzech zdaniach

Rok 2074. Burza magnetyczna wyłączyła AI, na której opierało się całe życie — sieć, państwa,
gospodarka. Gracz zaczyna jako zwykły człowiek, który od tygodnia nie wyszedł z domu, i krok po kroku
odbudowuje swoje otoczenie, ludzi i wiedzę, odkrywając, kto i dlaczego wykręca coś z martwych maszyn.

❓ Jaki jest główny cel długoterminowy gracza? (odbudowa osady, odkrycie prawdy o burzy, frakcje…)

## 2. Ton i styl

- ✅ Ton poważny, z niepokojem w tle; jasne, żywe postacie (Foxy) jako kontrapunkt.
- ✅ Grafika: pixel-art 16×16, paleta „Rdza i Neon” ([STYLE_GUIDE.md](STYLE_GUIDE.md)).
- ❓ Czy zostawiamy satyryczne akcenty w Osadzie Reboot (Zenon, Halina, Rysiek), czy je stonować?

## 3. Świat i lore

### Oś czasu
| Kiedy | Co |
|---|---|
| ❓ | Era AI — jak wyglądało życie, co robiły roboty serwisowe |
| Dzień 0 | Burza magnetyczna. AI, sieć i roboty przestają działać ✅ |
| Dzień 9 | Start gry ✅ |
| ❓ | … |

### Fakty kanoniczne (✅ już w grze)
- Państwa upadły; resztki rządów próbują nadawać sygnał radiowy i gromadzić ludzi.
- W Osadzie Reboot ludzie zbierają się przy starym odbiorniku; ktoś nadaje godzinę i miejsce zbiórki.
- Ktoś od dnia burzy otwiera maszyny i wykręca z nich **płytki neuronowe** (ciepłe, mruga zielony punkt).
- Zwierzęta mutują (szczury przy śmietnikach).
- Jedyna waluta: **c-coin** w chmurze, która jakimś cudem nadal działa. ❓ Dlaczego działa?

### Do ustalenia ❓
- Czym są płytki neuronowe i kto je zbiera? Kim jest zakapturzony mężczyzna?
- Frakcje (np. ludzie od sygnału radiowego, zbieracze płytek, ci, którzy chcą przywrócić AI…)?
- Geografia: miasto, okolice, kolejne lokacje i ich kolejność.

## 4. Postacie

| Postać | Gdzie | Rola | Stan |
|---|---|---|---|
| Foxy | Podwórze | ~20 lat, bardzo bystra, konkretna; wyciąga gracza z marazmu | ✅ |
| Zakapturzony mężczyzna | Podwórze | zbiera płytki z robotów, ucieka | ✅ |
| Sołtys Zenon | Osada | lider osady, wie o sygnale | ✅ |
| ❓ | | | |

Dla każdej ważnej postaci warto opisać: wiek, wygląd (kolory z palety), sposób mówienia, czego chce, czego się boi.

## 5. Mechaniki

### 5.1 Postać ✅
- Rasy (4) i klasy (4), atrybuty: Siła, Zręczność, Wytrzymałość, Intelekt.
- HP = 40 + 6·Wyt + 4·poziom. Tempo kroku i ataku z Zręczności. Atak = broń + Siła/2.
- XP do następnego poziomu = 100·poziom²; każdy poziom +1 do wszystkich atrybutów.
- ❓ Czy klasy mają się różnić umiejętnościami? Jakimi? Rola Intelektu poza dialogami?

### 5.2 Walka ✅ (wersja 1)
- W zwarciu, automatyczny atak na wybrany cel; obrażenia = atak + losowo do 50% − obrona/2.
- Potwory: agresywne/pasywne, zasięg wykrycia, pościg ze smyczą, łup, odrodzenie.
- Śmierć: pobudka w punkcie startowym mapy z połową HP, bez kary.
- ❓ Walka dystansowa? Umiejętności z czasem odnowienia? Kara za śmierć?

### 5.3 Ekonomia ❓
- c-coin: skąd się bierze (potwory, misje ✅), na co się wydaje (sklepy NPC? naprawy? handel?).
- Przedmioty: rzadkość, poziomy, czy da się je ulepszać/craftować?

### 5.4 Misje ✅
- Kroki: rozmowa, dotarcie w miejsce, zdobycie przedmiotów, pokonanie wrogów.
- Rozmowy z narracją, NPC pojawiający się / uciekający / podbiegający w trakcie misji.
- ❓ Wybory w dialogach z konsekwencjami? Misje grupowe?

### 5.5 Społeczne ❓
Czat lokalny ✅. Drużyny? Handel? Gildie/frakcje? PvP?

## 6. Fabuła — łańcuch misji

### Akt 1: Cisza po burzy ✅
1. Mieszkanie → wyjście na podwórze (nóż kuchenny).
2. Zakapturzony mężczyzna przy robotach → rozmowa → ucieka (płytka neuronowa).
3. Foxy podbiega, „skończ histerię”, maczeta, pytanie o konserwy.
4. Wybicie 6 zmutowanych szczurów.
5. Foxy: kim jest, kierunek → Osada Reboot.
6. Zaułek → Osada → Zenon: sygnał radiowy, płytka.

### Akt 1, ciąg dalszy ❓
Szablon na każdą misję:

```
Tytuł:
Zleceniodawca / start:
Cel fabularny (po co ta misja w historii):
Kroki: 1) … 2) … 3) …
Kluczowe kwestie dialogowe (ton!):
Nagroda:
Co się zmienia w świecie po misji:
```

## 7. Lokacje

| Mapa | Stan | Opis |
|---|---|---|
| Twoje mieszkanie (instancja) | ✅ | punkt startowy |
| Podwórze kamienicy | ✅ | martwe roboty, śmietnik ze szczurami, zaułek do Osady |
| Osada Reboot | ✅ | plac z martwym terminalem, biblioteka, warsztat |
| Ruiny Galerii Handlowej | ✅ | zbieraczka Ola, wrak autobusu, stara serwerownia |
| ❓ | | |

Dla nowej lokacji: nastrój, kto tam jest, jakie potwory i na jakim poziomie, skąd i dokąd prowadzi.
