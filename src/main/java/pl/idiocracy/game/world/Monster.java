package pl.idiocracy.game.world;

import java.util.LinkedHashMap;
import java.util.Map;

import pl.idiocracy.game.content.MonsterTemplate;

/** Zywy potwor w instancji mapy. Mutowany wylacznie pod blokada MapInstance. */
class Monster {

    final long id;
    final MonsterTemplate tpl;
    final int spawnIndex;
    int x;
    int y;
    Direction dir = Direction.E;
    int hp;
    Long targetId;
    long lastMoveAtMs;
    long lastAttackAtMs;

    Monster(long id, MonsterTemplate tpl, int spawnIndex, int x, int y) {
        this.id = id;
        this.tpl = tpl;
        this.spawnIndex = spawnIndex;
        this.x = x;
        this.y = y;
        this.hp = tpl.getMaxHp();
    }

    Map<String, Object> view() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("code", tpl.getCode());
        m.put("name", tpl.getName());
        m.put("level", tpl.getLevel());
        m.put("x", x);
        m.put("y", y);
        m.put("dir", dir.name());
        m.put("hp", hp);
        m.put("maxHp", tpl.getMaxHp());
        m.put("ms", tpl.getMoveDelayMs());
        return m;
    }
}
