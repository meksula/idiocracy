# Idiocracy

> Rok 2074. Burza magnetyczna wyłączyła wszystkie AI — jedyne źródło wiedzy ludzkości.
> Okazało się, że od dawna nikt nie myślał samodzielnie. Działa tylko **c-coin**, waluta w chmurze,
> której nikt już nie rozumie. Zbierz resztki rozumu i odbuduj cywilizację.

Przeglądarkowy MMORPG 2D w duchu Tibii / Margonem. Ten etap to **silnik i szablon pod rozbudowę**,
nie gotowa treść: logowanie, kreator postaci, świat ze sterowaniem autorytatywnym po stronie serwera,
multiplayer, NPC, silnik misji, **system walki**, ekwipunek i **edytor świata w przeglądarce**
(mapy, misje, NPC, potwory, przedmioty, kafelki, rasy, klasy).

## Szybki start

Wymagania: Java 21, Maven 3.9+, PostgreSQL 16 (albo Docker).

```bash
docker compose up -d          # PostgreSQL: baza idiocracy, user/hasło game/game
mvn spring-boot:run           # serwer na http://localhost:8080
```

1. Wejdź na `http://localhost:8080`, załóż konto (bez maila aktywacyjnego — to POC).
2. **Pierwsze konto dostaje rolę ADMIN** i widzi przycisk „Edytor świata”.
   Dodatkowych adminów ustawisz zmienną `ADMIN_EMAILS=a@b.pl,c@d.pl`.
3. Stwórz postać i graj. Druga karta/przeglądarka = drugi gracz.

Nowe postacie zaczynają na mapie `game.start-map` (domyślnie `dom` — mieszkanie gracza).

Konfiguracja przez zmienne środowiskowe: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`
(min. 32 znaki — **zmień na produkcji**), `ADMIN_EMAILS`, `PORT`. Reszta w `application.yml` (`game.*`).

Tryb pracy nad frontendem (pliki statyczne bez przebudowy):

```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--spring.web.resources.static-locations=file:src/main/resources/static/ --spring.web.resources.cache.period=0"
```

## Sterowanie

| Klawisz | Akcja |
|---|---|
| WASD / strzałki | ruch |
| klik na mapie | idź tam (A\*) |
| klik na NPC / `E` | rozmowa (`Spacja` — dalej) |
| klik na wroga / `Spacja` | atak — postać sama podchodzi i walczy; `Esc` przerywa |
| `Enter` | czat lokalny (`/who`, `/pos`, `/help`) |
| `Alt` | pokaż imiona NPC |
| klik w przedmiot | załóż / użyj / zdejmij |
| `H` | pomoc |

„!” nad NPC — ma dla ciebie misję, „?” — czeka na ciebie w ramach misji. Turkusowe pola to przejścia między mapami.

## Co jest w środku

- **Konta**: e-mail + hasło (BCrypt), JWT, role PLAYER/ADMIN.
- **Postacie**: 4 rasy × 4 klasy (data-driven), atrybuty Siła/Zręczność/Wytrzymałość/Intelekt,
  wybór fryzury, do 5 postaci na konto, przedmioty startowe klasy zakładane automatycznie.
- **Świat**: mapy kafelkowe (grunt + obiekty), kolizje, portale między mapami, kamera, minimapa.
- **Ruch**: serwer autorytatywny (kolizje, tempo kroku z Zręczności, portale), klient przewiduje
  ruch lokalnie i płynnie interpoluje innych graczy; serwer koryguje oszustwa i desynchronizację.
- **Multiplayer**: WebSocket, gracze widzą się na mapie, czat lokalny z dymkami.
- **Misje**: kroki `TALK` / `VISIT` / `COLLECT` / `KILL`, przedmioty wręczane po kroku, nagrody
  c-coin/XP/przedmioty, misje powtarzalne i startujące automatycznie, wymagany poziom, dziennik
  i markery nad NPC. Rozmowy wieloetapowe z narracją (`* …`), kwestiami gracza (`> …`) i postaci (`Imię: …`).
- **Walka**: potwory jako treść z edytora (HP, atak, obrona, tempo, agresja, zasięg wykrycia,
  łup, c-coin, XP, czas odrodzenia), obszary występowania na mapach, AI (wędrówka, pościg, smycz),
  automatyczny atak w zwarciu na wybrany cel, liczby obrażeń, paski HP, ramka celu, regeneracja
  poza walką, utrata przytomności i pobudka w punkcie startowym mapy.
- **Fabuła**: mapy instancjonowane (każdy gracz ma własne mieszkanie), NPC widoczni tylko na danym
  etapie misji, którzy po rozmowie uciekają (animacja biegu do wskazanego punktu).
- **Ekwipunek**: 7 slotów, plecak, przedmioty do użycia (leczenie), stosy, wymagany poziom,
  zakładane ubrania **zmieniają wygląd postaci** (pole „kolor na postaci”).
- **Waluta**: tylko **c-coin**.
- **Edytor świata** (`/editor.html`, ADMIN): mapy (pędzel, prostokąt, wiadro, gumka, spawn,
  portale, rozstawianie NPC), misje z podglądem przebiegu, NPC z podglądem wyglądu, przedmioty
  i kafelki z edytorem pikseli ograniczonym do palety, rasy, klasy, przewodnik stylu.
  **Zmiany trafiają do graczy online na żywo** — bez restartu serwera.

## Spójna grafika

Cała grafika to pixel-art 16×16 w jednej palecie „Rdza i Neon” (36 kolorów), zapisany jako tekst
(1 znak = 1 piksel). Postacie i NPC są składane proceduralnie z szablonu + kolorów rasy, klasy i
ubrań, więc każdy nowy element automatycznie pasuje do całości. Zasady i gotowy prompt do
projektowania przedmiotów razem z Claude: [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) oraz zakładka
„Styl graficzny” w edytorze.

## Treść startowa

`src/main/resources/content/*.json` jest ładowane do bazy przy pierwszym starcie (gdy tabela jest
pusta). Potem źródłem prawdy jest baza i edytor.

- `races.json`, `classes.json`, `npcs.json`, `quests.json` — pisane ręcznie (fabuła).
- `tiles.json`, `items.json`, `maps/*.json` — generowane skryptem z prymitywów rysunkowych:
  `node tools/gen-content.mjs --ascii` (`--ascii` drukuje podgląd przechodności map).

Startowo: mieszkanie gracza, Podwórze kamienicy, Osada Reboot i Ruiny Galerii Handlowej, 5 NPC,
1 potwór, 4 misje, 20 przedmiotów, 45 kafelków.

**Początek gry — „Cisza po burzy”**: postać budzi się we własnym mieszkaniu dziewięć dni po burzy.
Na podwórzu leżą martwe roboty serwisowe, a między nimi zakapturzony mężczyzna wykręca z nich płytki.
Po krótkiej rozmowie ucieka między śmietniki. Zanim ruszysz za nim, dopada cię Foxy — dwudziestoletnia
sąsiadka z dwóch klatek dalej — wali w łeb, każe skończyć histerię, tłumaczy, że państwa upadły,
a resztki rządów próbują zbierać ludzi sygnałem radiowym, wciska maczetę i razem czyścicie śmietnik
z zmutowanych szczurów (poziom 1). Trop prowadzi do Osady Reboot i starego odbiornika radiowego.

Seeder dodaje elementy, których kodu nie ma w bazie, i niczego nie nadpisuje — nowa treść z kolejnych
wersji trafia do istniejących baz, a zmiany z edytora są bezpieczne.

## Testy

```bash
mvn test                                    # testy jednostkowe
mvn verify                                  # + test integracyjny (Testcontainers, wymaga Dockera)
TEST_DB_URL=jdbc:postgresql://localhost:5432/idiocracy_test mvn verify   # albo na własnej bazie
```

Test integracyjny przechodzi pełną ścieżkę: rejestracja → postać → WebSocket → intro → wyjście z mieszkania → rozmowa z nieznajomym (znika) → korekta serwera.

## Dalej

Architektura i protokół: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Dokument projektowy gry (do uzupełniania): [docs/GDD.md](docs/GDD.md). Naturalne kolejne kroki:
umiejętności klas (np. Intelekt dla Bibliotekarza), walka dystansowa (Kurier), sklepy NPC za c-coiny,
przedmioty leżące na mapie, handel między graczami, drużyny, kanały czatu, lore.
