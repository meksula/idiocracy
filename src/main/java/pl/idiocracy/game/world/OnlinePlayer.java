package pl.idiocracy.game.world;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.web.socket.WebSocketSession;

import pl.idiocracy.game.character.CharacterQuest;
import pl.idiocracy.game.character.StatsCalculator;
import pl.idiocracy.game.content.Appearance;

/**
 * Stan postaci bedacej w grze. Mutacje wykonujemy pod synchronized(player),
 * do bazy zapisujemy okresowo (pozycja) lub od razu (progres, ekwipunek, misje).
 */
public class OnlinePlayer {

    final long characterId;
    final long accountId;
    final String name;
    final String raceCode;
    final String classCode;
    final Appearance ownAppearance;
    final WebSocketSession session;

    volatile String mapCode;
    volatile int x;
    volatile int y;
    volatile Direction dir;
    int level;
    long xp;
    long ccoin;
    int hp;
    long lastMoveAtMs;
    volatile boolean positionDirty;

    StatsCalculator.Derived derived;
    Appearance appearance;
    final Map<String, CharacterQuest> quests = new ConcurrentHashMap<>();

    OnlinePlayer(long characterId, long accountId, String name, String raceCode, String classCode,
                 Appearance ownAppearance, WebSocketSession session) {
        this.characterId = characterId;
        this.accountId = accountId;
        this.name = name;
        this.raceCode = raceCode;
        this.classCode = classCode;
        this.ownAppearance = ownAppearance;
        this.session = session;
    }

    public long characterId() {
        return characterId;
    }

    public String name() {
        return name;
    }

    public String mapCode() {
        return mapCode;
    }

    public int x() {
        return x;
    }

    public int y() {
        return y;
    }

    public int level() {
        return level;
    }

    /** To, co widza inni gracze. */
    Map<String, Object> publicView() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", characterId);
        m.put("name", name);
        m.put("x", x);
        m.put("y", y);
        m.put("dir", dir.name());
        m.put("level", level);
        m.put("race", raceCode);
        m.put("cls", classCode);
        m.put("app", appearance);
        m.put("ms", derived.moveDelayMs());
        return m;
    }

    /** Pelny widok wlasnej postaci (HUD). */
    Map<String, Object> selfView(String raceName, String className) {
        Map<String, Object> m = publicView();
        m.put("raceName", raceName);
        m.put("className", className);
        m.put("xp", xp);
        m.put("xpNext", StatsCalculator.xpToNext(level));
        m.put("ccoin", ccoin);
        m.put("hp", hp);
        m.put("maxHp", derived.maxHp());
        m.put("stats", derived.attributes());
        m.put("attack", derived.attack());
        m.put("defense", derived.defense());
        m.put("map", mapCode);
        return m;
    }

    List<CharacterQuest> activeQuests() {
        return quests.values().stream()
                .filter(q -> q.getStatus() == pl.idiocracy.game.character.QuestStatus.ACTIVE).toList();
    }
}
