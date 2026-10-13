package pl.idiocracy.game.content;

import java.util.Arrays;

import pl.idiocracy.game.config.GameException;

/** Rodzaje tresci edytowalnej w edytorze (sciezka REST -> klasa encji). */
public enum ContentType {
    TILES("tiles", TileDef.class),
    RACES("races", Race.class),
    CLASSES("classes", CharacterClass.class),
    ITEMS("items", ItemTemplate.class),
    MAPS("maps", GameMap.class),
    NPCS("npcs", Npc.class),
    QUESTS("quests", Quest.class),
    MONSTERS("monsters", MonsterTemplate.class);

    private final String path;
    private final Class<? extends ContentEntity> entityClass;

    ContentType(String path, Class<? extends ContentEntity> entityClass) {
        this.path = path;
        this.entityClass = entityClass;
    }

    public String path() {
        return path;
    }

    public Class<? extends ContentEntity> entityClass() {
        return entityClass;
    }

    public static ContentType fromPath(String path) {
        return Arrays.stream(values()).filter(t -> t.path.equals(path)).findFirst()
                .orElseThrow(() -> GameException.notFound("Nieznany typ treści: " + path));
    }
}
