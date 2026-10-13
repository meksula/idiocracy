package pl.idiocracy.game.content;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Niemutowalny snapshot calej tresci gry w pamieci. Swiat czyta tylko z cache,
 * edytor po zapisie wywoluje reload(). Przy skali POC przeladowanie calosci jest tanie.
 */
@Component
public class ContentCache {

    public record Snapshot(
            Map<String, TileDef> tiles,
            Map<String, Race> races,
            Map<String, CharacterClass> classes,
            Map<String, ItemTemplate> items,
            Map<String, GameMap> maps,
            Map<String, Npc> npcs,
            Map<String, List<Npc>> npcsByMap,
            Map<String, Quest> quests,
            Map<String, List<Quest>> questsByGiver) {
    }

    private final TileDefRepository tiles;
    private final RaceRepository races;
    private final CharacterClassRepository classes;
    private final ItemTemplateRepository items;
    private final GameMapRepository maps;
    private final NpcRepository npcs;
    private final QuestRepository quests;

    private volatile Snapshot snapshot;

    public ContentCache(TileDefRepository tiles, RaceRepository races, CharacterClassRepository classes,
                        ItemTemplateRepository items, GameMapRepository maps, NpcRepository npcs,
                        QuestRepository quests) {
        this.tiles = tiles;
        this.races = races;
        this.classes = classes;
        this.items = items;
        this.maps = maps;
        this.npcs = npcs;
        this.quests = quests;
    }

    @Transactional(readOnly = true)
    public synchronized void reload() {
        List<Npc> allNpcs = npcs.findAll();
        List<Quest> allQuests = quests.findAll().stream()
                .sorted(Comparator.comparingInt(Quest::getSortOrder).thenComparing(Quest::getCode)).toList();
        snapshot = new Snapshot(
                index(tiles.findAll(), TileDef::getCode),
                index(races.findAll(), Race::getCode),
                index(classes.findAll(), CharacterClass::getCode),
                index(items.findAll(), ItemTemplate::getCode),
                index(maps.findAll(), GameMap::getCode),
                index(allNpcs, Npc::getCode),
                allNpcs.stream().collect(Collectors.groupingBy(Npc::getMapCode)),
                index(allQuests, Quest::getCode),
                allQuests.stream().filter(q -> q.getGiverNpc() != null)
                        .collect(Collectors.groupingBy(Quest::getGiverNpc)));
    }

    public Snapshot get() {
        Snapshot s = snapshot;
        if (s == null) {
            reload();
            s = snapshot;
        }
        return s;
    }

    public Optional<GameMap> map(String code) {
        return Optional.ofNullable(get().maps().get(code));
    }

    public Optional<ItemTemplate> item(String code) {
        return Optional.ofNullable(get().items().get(code));
    }

    public Optional<Quest> quest(String code) {
        return Optional.ofNullable(get().quests().get(code));
    }

    public Optional<Npc> npc(String code) {
        return Optional.ofNullable(get().npcs().get(code));
    }

    public List<Npc> npcsOn(String mapCode) {
        return get().npcsByMap().getOrDefault(mapCode, List.of());
    }

    public List<Quest> questsFrom(String npcCode) {
        return get().questsByGiver().getOrDefault(npcCode, List.of());
    }

    /** Czy pole jest blokowane przez kafelek (grunt lub obiekt). */
    public boolean isSolidTile(GameMap map, int x, int y) {
        Map<String, TileDef> t = get().tiles();
        TileDef ground = t.get(map.groundAt(x, y));
        if (ground == null || ground.isSolid()) {
            return true;
        }
        String obj = map.objectAt(x, y);
        if (obj == null) {
            return false;
        }
        TileDef object = t.get(obj);
        return object != null && object.isSolid();
    }

    private static <T> Map<String, T> index(List<T> list, Function<T, String> key) {
        return list.stream().collect(Collectors.toUnmodifiableMap(key, Function.identity()));
    }
}
