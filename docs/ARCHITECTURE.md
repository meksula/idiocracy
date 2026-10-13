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
| `world` | WebSocket, `WorldService` (ruch, portale, czat, ekwipunek), `QuestEngine`, `PlayerProgression` |
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

Klient → serwer: `move {dir, seq}`, `face {dir}`, `chat {text}`, `talk {npc}`, `accept {quest, npc}`,
`equip {item}`, `unequip {item}`, `use {item}`, `ping {ts}`.

Serwer → klient: `welcome`, `enter` (zmiana mapy), `mapReload`, `self`, `join`, `leave`, `update`,
`moved`, `face`, `correct`, `chat`, `system`, `error`, `dialog`, `quests`, `npcMarks`, `inventory`,
`content`, `pong`.

## Silnik misji

Misja = lista kroków przechodzonych po kolei:

| Typ | Zaliczenie |
|---|---|
| `TALK` | rozmowa z NPC `target` (jego `dialog` pojawia się w oknie rozmowy) |
| `VISIT` | wejście w promień `radius` wokół `x,y` na mapie `target` |
| `COLLECT` | posiadanie `count` sztuk przedmiotu `target` (`consume` = zabierz) |
| `KILL` | `QuestEngine.onKill(player, monsterCode)` — do podpięcia pod system walki |

Kroki automatyczne (VISIT, COLLECT) są sprawdzane po ruchu, zmianie ekwipunku i przejściu
do kolejnego kroku. Po ostatnim kroku przyznawane są nagrody. Nowy typ kroku = wartość w
`QuestStepType` + gałąź w `QuestEngine.isSatisfied`/zdarzenie + pole w edytorze (`forms.js`).

## Punkty rozszerzeń na kolejne etapy

- **Walka**: potwory jako nowy typ treści (`ContentType`), spawn w `MapInstance`, tick serwera,
  `StatsCalculator.Derived` ma już `attack`/`defense`, przedmioty mają `attack/defense/heal`.
- **Sklepy NPC**: przedmioty mają `price` w c-coinach, `PlayerProgression.addCcoin`.
- **Skalowanie**: `MapInstance` jest naturalną granicą shardowania; mapy można przesyłać
  słownikiem kafelków zamiast pełnych nazw, gdy urosną.
