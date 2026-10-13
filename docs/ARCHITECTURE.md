# Architektura

```
Przeglądarka (vanilla JS, ES modules, Canvas 2D)          Spring Boot 3 / Java 21
┌───────────────────────────────┐   REST /api/*   ┌──────────────────────────────────┐
│ index / characters / editor   │ ──────────────▶ │ auth · character · content       │
│ game.html                     │                 │                                  │
│  main.js  (stan, predykcja)   │   WS /ws/game   │ world: WorldService (autorytet)  │
│  renderer.js · hud.js · path  │ ◀─────────────▶ │        QuestEngine · Progression │
└───────────────────────────────┘                 └───────────────┬──────────────────┘
                                                                  │ JPA + Flyway
                                                           PostgreSQL (JSONB)
```

Bez etapu budowania frontendu — pliki w `src/main/resources/static` serwuje Spring.

## Pakiety backendu (`pl.idiocracy.game`)

| Pakiet | Odpowiedzialność |
|---|---|
| `auth` | rejestracja/logowanie, JWT (`JwtService`, `JwtAuthFilter`), role |
| `content` | encje treści (kafelki, rasy, klasy, przedmioty, mapy, NPC, misje), `ContentCache` (snapshot w pamięci), `ContentService` + generyczne REST edytora, seeder JSON |
| `character` | postacie, ekwipunek, stan misji, `StatsCalculator`, `AppearanceResolver` |
| `world` | WebSocket, `WorldService` (ruch, portale, czat, ekwipunek, tick walki), `MonsterEngine` (AI i walka), `QuestEngine`, `PlayerProgression` |
| `config` | security, WebSocket, właściwości `game.*`, obsługa błędów |

## Model danych

Treść ma czytelne klucze tekstowe (`code`, np. `rura-stalowa`), elastyczne części są w JSONB
(statystyki, sprite'y, warstwy map, kroki misji) — edytor może je rozwijać bez migracji.
Gracze: `account` → `player_character` → `character_item`, `character_quest`.

## Edycja na żywo

`PUT /api/editor/{type}/{code}` → walidacja encji → zapis → po commicie `ContentCache.reload()`
i `ContentChangedEvent` → `WorldService` rozsyła graczom online nową mapę / przelicza statystyki
/ każe klientom dociągnąć kafelki i przedmioty.

## Ruch (autorytatywny serwer + predykcja klienta)

1. Klient sprawdza kolizję lokalnie, od razu animuje krok i wysyła `{t:"move", dir, seq}`.
2. Serwer sprawdza: granice mapy, kafelki `solid`, NPC, tempo (≥ 75% `moveDelayMs`, które zależy od Zręczności).
3. OK → `moved` do pozostałych graczy na mapie (z czasem kroku do interpolacji), sprawdzenie portali i kroków `VISIT`.
4. Odrzucenie → `correct {x, y}` tylko do gracza; klient przyciąga postać do pozycji serwera.

Pozycja zapisuje się do bazy co `game.save-interval-ms` i przy wyjściu; progres, ekwipunek i misje — od razu.

## Protokół WebSocket

`ws://host/ws/game?token=<JWT>&character=<id>` — JSON, pole `t` to typ.

Klient → serwer: `move {dir, seq}`, `face {dir}`, `attack {id|null}`, `chat {text}`, `talk {npc}`,
`accept {quest, npc}`, `equip {item}`, `unequip {item}`, `use {item}`, `ping {ts}`.

Serwer → klient: `welcome`, `enter` (zmiana mapy), `mapReload`, `self`, `hp`, `join`, `leave`, `update`,
`moved`, `face`, `correct`, `mspawn`, `mmove`, `mdie`, `hit`, `target`, `chat`, `system`, `error`,
`dialog`, `quests`, `npcs`, `npcMarks`, `inventory`, `content`, `pong`.

## Instancje map

`MapInstance` to żywa kopia mapy: gracze i potwory. Mapa z flagą `instanced` (np. `dom`) ma osobną
instancję dla każdego gracza (klucz `kod#idPostaci`), usuwaną, gdy gracz wyjdzie. Wiadomości
o ruchu, walce i czacie trafiają tylko do graczy z tej samej instancji.

## Walka

`WorldService.tick()` co 100 ms wywołuje `MonsterEngine.tick()` dla każdej instancji z graczami
(pod blokadą instancji):

1. **Odradzanie** — każdy obszar `spawns` mapy utrzymuje `count` potworów; martwe wracają po `respawnSec`.
2. **AI** — agresywny potwór wybiera najbliższego gracza w `aggroRange`, goni go (zachłanny krok
   z obejściem przeszkód), atakuje w zwarciu co `attackDelayMs`, a odciągnięty dalej niż 8 pól od
   swojego obszaru odpuszcza. Nieagresywny oddaje dopiero po pierwszym ciosie.
3. **Ataki graczy** — gracz z wybranym celem (`attack {id}`) bije go, gdy stoi obok (także po skosie),
   co `attackDelayMs` z Zręczności.
4. **Regeneracja** — 5% HP co 3 s, gdy postać nie była atakowana przez 6 s.

Obrażenia: `atak + losowo 0..atak/2 − obrona/2`, min. 1. Nagrody (XP, c-coin, łup, krok misji KILL)
i utrata przytomności (pobudka w punkcie startowym mapy z połową HP) są obsługiwane poza blokadą,
bo zapisują do bazy.

## Widoczność NPC

`npc.visibility = {quest, fromStep, toStep, fleeX, fleeY, approach}` — NPC istnieje dla gracza tylko na danym
etapie misji (kolizje, rozmowa, markery). Gdy przestaje być widoczny, klient dostaje `npcs` bez niego
i odgrywa ucieczkę do `fleeX/fleeY` (A*) po zamknięciu okna rozmowy.

`approach: true` — gdy NPC jest celem bieżącego kroku TALK, serwer stawia go na wolnym polu obok
gracza (pozycja tylko dla tego gracza, w pamięci), a klient pokazuje, jak przybiega ze swojego
miejsca i sam zaczyna rozmowę (`autoTalk`). Po rozmowie NPC wraca na swoje miejsce.

## Silnik misji

Misja = lista kroków przechodzonych po kolei:

| Typ | Zaliczenie |
|---|---|
| `TALK` | rozmowa z NPC `target` (jego `dialog` pojawia się w oknie rozmowy) |
| `VISIT` | wejście w promień `radius` wokół `x,y` na mapie `target` |
| `COLLECT` | posiadanie `count` sztuk przedmiotu `target` (`consume` = zabierz) |
| `KILL` | pokonanie `count` potworów `target` |

Kroki automatyczne (VISIT, COLLECT) są sprawdzane po ruchu, zmianie ekwipunku i przejściu
do kolejnego kroku. Krok może wręczyć przedmioty (`give`). Po ostatnim kroku przyznawane są nagrody. Misja z `autoStart` przydziela się sama przy wejściu do gry, a jej `dialog.offer` pokazuje się jako narracja. Nowy typ kroku = wartość w
`QuestStepType` + gałąź w `QuestEngine.isSatisfied`/zdarzenie + pole w edytorze (`forms.js`).

## Punkty rozszerzeń na kolejne etapy

- **Umiejętności / walka dystansowa**: nowy typ akcji gracza w `MonsterEngine.playerAttack`
  (zasięg i koszt), statystyka Intelekt jako siła umiejętności.
- **Sklepy NPC**: przedmioty mają `price` w c-coinach, `PlayerProgression.addCcoin`.
- **Skalowanie**: `MapInstance` jest naturalną granicą shardowania; mapy można przesyłać
  słownikiem kafelków zamiast pełnych nazw, gdy urosną.
