# Przewodnik stylu graficznego — „Rdza i Neon”

Cel: każdy nowy kafelek, przedmiot czy postać ma wyglądać, jakby narysowała go ta sama osoba.
Osiągamy to ograniczeniami, nie talentem: jedna paleta, jeden rozmiar, kilka twardych zasad.

## Format sprite'a

```json
{ "w": 16, "h": 16, "frames": [[ "................", "....0000........", "... 16 wierszy" ]] }
```

- 1 znak = 1 piksel = 1 klucz palety, `.` = przezroczystość.
- `frames` to klatki animacji (gra przełącza je co ~0,6 s; np. woda, ognisko, migająca dioda).
- Rozmiar zawsze 16×16. Gra skaluje ×2–×4 bez wygładzania.

## Paleta (źródło: `src/main/resources/static/js/palette.js`)

| Grupa | Klucze | Do czego |
|---|---|---|
| Neutralne | `0 1 2 3 4 5 6 7` | beton, metal, asfalt, kontur (`0`), światła (`7`) |
| Rdza | `r R o O y` | rdza, cegła, ogień, żółte oznaczenia |
| Ziemia i toksyny | `b B k g G l` | ziemia, drewno, zeschnięta trawa, toksyczna zieleń (`l`) |
| Neon | `c C n` | **tylko** technologia, AI, prąd, ekrany |
| Anomalie | `p P m` | niebezpieczeństwo, mutacje, luksus, neony barów |
| Skóra | `s S d e` | jasna, średnia, ciemna, zmutowana |
| Czerwień / błękit | `x X u U` | krew, diody, alarmy, woda, ubrania |

Każdy kolor ma przypisany ciemniejszy odpowiednik (`SHADE`), używany do automatycznego cieniowania postaci.

## Zasady

1. **Kontur `0`** wokół obiektów i ikon (w edytorze: przycisk „Auto-kontur”). Grunt bez konturu — musi się kafelkować (podgląd 3×3 w edytorze).
2. **Światło z lewej-góry**: jaśniejszy odcień na górnej/lewej krawędzi, ciemniejszy na dolnej/prawej.
3. **Maks. 3–4 odcienie** na jeden obiekt.
4. **Świat jest zmęczony**: szarości, rdza, zgniła zieleń. Nasycone kolory to akcent, nie tło.
5. **Neon = technologia**. Jeśli coś świeci na turkusowo, to znaczy, że kiedyś myślało za ludzi.
6. Obiekty stojące na ziemi mogą mieć cień `1` w ostatnim wierszu.
7. Humor w nazwach i opisach — ludzkość zapomniała, jak działają proste rzeczy.

## Postacie

Postacie nie są rysowane ręcznie. `static/js/charsprite.js` ma szablony (4 kierunki × 3 klatki chodu)
ze znakami-zastępnikami: `H` włosy, `S` skóra, `E` oczy, `P` strój górny, `Q` strój dolny, `F` buty
(małe litery = cień). Kolory pochodzą z warstw:

```
postać (fryzura) → rasa (skóra, oczy) → klasa (strój) → założone przedmioty (wearColor wg slotu)
```

Przedmiot z `wearColor` w slocie HEAD barwi włosy/nakrycie głowy, BODY — górę stroju, LEGS — dół, FEET — buty.
Dzięki temu nowa rasa, klasa czy kurtka „po prostu pasuje”.

## Projektowanie z Claude

Wklej do rozmowy i uzupełnij opis:

```
Zaprojektuj ikonę przedmiotu do gry OFFLINE 2074 (pixel-art 16x16).
Używaj WYŁĄCZNIE znaków palety: 0 1 2 3 4 5 6 7 r R o O y b B k g G l c C n p P m s S d e x X u U
oraz "." (przezroczystość).
Zasady: czarny kontur "0" wokół kształtu, światło z lewej-góry, maks. 3-4 odcienie na obiekt,
świat stonowany (szarości, rdza, zgniła zieleń), neon (c C n) tylko dla technologii,
róż/fiolet (p P m) dla anomalii.
Przedmiot: <NAZWA I KRÓTKI OPIS>
Zwróć JSON: {"w":16,"h":16,"frames":[[16 wierszy po 16 znaków]]}
```

Odpowiedź wklejasz w edytorze przedmiotu: „Import / eksport tekstowy” → „Importuj”. Edytor
odrzuci znaki spoza palety i zły rozmiar. Ten sam prompt (z „kafelek gruntu, ma się kafelkować”)
działa dla kafelków.

Alternatywnie: dopisz przedmiot w `tools/items.mjs` używając prymitywów z `tools/pixel.mjs`
(`rect`, `line`, `ellipse`, `bevel`, `noise`, `outline`) i uruchom `node tools/gen-content.mjs`.
