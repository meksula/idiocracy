package pl.idiocracy.game.world;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import pl.idiocracy.game.character.StatsCalculator;
import pl.idiocracy.game.content.Appearance;
import pl.idiocracy.game.content.CharacterClassRepository;
import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.GameMap;
import pl.idiocracy.game.content.GameMapRepository;
import pl.idiocracy.game.content.ItemTemplateRepository;
import pl.idiocracy.game.content.MapLayers;
import pl.idiocracy.game.content.MonsterSpawn;
import pl.idiocracy.game.content.MonsterTemplate;
import pl.idiocracy.game.content.MonsterTemplateRepository;
import pl.idiocracy.game.content.NpcRepository;
import pl.idiocracy.game.content.QuestRepository;
import pl.idiocracy.game.content.RaceRepository;
import pl.idiocracy.game.content.Sprite;
import pl.idiocracy.game.content.Stats;
import pl.idiocracy.game.content.TileDef;
import pl.idiocracy.game.content.TileDefRepository;

class MonsterEngineTest {

    private MonsterEngine engine;
    private GameMap map;
    private MonsterTemplate rat;

    @BeforeEach
    void setUp() {
        TileDef floor = new TileDef();
        floor.setCode("floor");
        floor.setLayer(TileDef.Layer.GROUND);
        rat = new MonsterTemplate();
        rat.setCode("rat");
        rat.setName("Szczur");
        rat.setMaxHp(10);
        rat.setAttack(2);
        rat.setAggressive(true);
        rat.setAggroRange(4);
        rat.setMoveDelayMs(100);
        rat.setAttackDelayMs(500);
        rat.setRespawnSec(5);
        rat.setSprite(new Sprite(1, 1, List.of(List.of("0"))));
        map = new GameMap();
        map.setCode("arena");
        map.setWidth(5);
        map.setHeight(1);
        map.setLayers(new MapLayers(Collections.nCopies(5, "floor"), Collections.nCopies(5, null)));
        map.setSpawns(List.of(new MonsterSpawn("rat", 4, 0, 1, 1, 1)));

        ContentCache cache = new ContentCache(repo(TileDefRepository.class, List.of(floor)),
                repo(RaceRepository.class, List.of()), repo(CharacterClassRepository.class, List.of()),
                repo(ItemTemplateRepository.class, List.of()), repo(GameMapRepository.class, List.of(map)),
                repo(NpcRepository.class, List.of()), repo(QuestRepository.class, List.of()),
                repo(MonsterTemplateRepository.class, List.of(rat)));
        cache.reload();
        engine = new MonsterEngine(cache, mock(GameNotifier.class));
    }

    @Test
    void aggressiveMonsterApproachesAndPlayerKillsIt() {
        MapInstance inst = new MapInstance("arena", "arena");
        OnlinePlayer p = player(0);
        inst.players.put(p.characterId, p);

        long now = 1_000_000;
        engine.tick(inst, map, now);
        assertThat(inst.monsters).hasSize(1);
        Monster m = inst.monsters.values().iterator().next();
        assertThat(m.x).isEqualTo(4);

        // potwor podchodzi do gracza (odleglosc 4 -> 1) i zaczyna gryzc
        for (int i = 1; i <= 10; i++) {
            engine.tick(inst, map, now + i * 150L);
        }
        assertThat(m.x).isEqualTo(1);
        assertThat(p.hp).isLessThan(p.derived.maxHp());

        p.targetMonsterId = m.id;
        MonsterEngine.Outcome kill = null;
        for (int i = 0; i < 20 && inst.monsters.containsKey(m.id); i++) {
            kill = engine.tick(inst, map, now + 2_000 + i * 1_000L);
        }
        assertThat(inst.monsters).isEmpty();
        assertThat(kill.kills()).extracting(MonsterEngine.Kill::monster).containsExactly(rat);
        assertThat(p.targetMonsterId).isNull();
        assertThat(inst.respawns).hasSize(1);
    }

    @Test
    void damageIsAtLeastOne() {
        assertThat(MonsterEngine.damage(0, 100)).isEqualTo(1);
        assertThat(MonsterEngine.damage(10, 0)).isBetween(10, 15);
    }

    private OnlinePlayer player(int x) {
        OnlinePlayer p = new OnlinePlayer(7L, 1L, "Test", "r", "c", Appearance.EMPTY, mock(WebSocketSession.class));
        p.level = 1;
        p.derived = StatsCalculator.derive(new Stats(10, 5, 5, 5), Stats.ZERO, 1, List.of(), 260);
        p.hp = p.derived.maxHp();
        p.mapCode = "arena";
        p.instanceKey = "arena";
        p.x = x;
        p.y = 0;
        p.dir = Direction.E;
        return p;
    }

    private static <T extends org.springframework.data.jpa.repository.JpaRepository<E, String>, E> T repo(Class<T> type, List<E> rows) {
        T r = mock(type);
        when(r.findAll()).thenReturn(rows);
        return r;
    }
}
