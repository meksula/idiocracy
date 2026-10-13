package pl.idiocracy.game.world;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import pl.idiocracy.game.character.CharacterQuest;
import pl.idiocracy.game.character.CharacterService;
import pl.idiocracy.game.character.QuestStatus;
import pl.idiocracy.game.content.Appearance;
import pl.idiocracy.game.content.CharacterClassRepository;
import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.GameMapRepository;
import pl.idiocracy.game.content.ItemTemplateRepository;
import pl.idiocracy.game.content.Npc;
import pl.idiocracy.game.content.NpcRepository;
import pl.idiocracy.game.content.Quest;
import pl.idiocracy.game.content.QuestRepository;
import pl.idiocracy.game.content.QuestRewards;
import pl.idiocracy.game.content.QuestStep;
import pl.idiocracy.game.content.QuestStepType;
import pl.idiocracy.game.content.RaceRepository;
import pl.idiocracy.game.content.TileDefRepository;

class QuestEngineTest {

    private final CharacterService characters = mock(CharacterService.class);
    private final PlayerProgression progression = mock(PlayerProgression.class);
    private final GameNotifier notifier = mock(GameNotifier.class);
    private final QuestRepository questRepo = mock(QuestRepository.class);
    private QuestEngine engine;
    private OnlinePlayer player;
    private Npc soltys;
    private Npc halina;

    @BeforeEach
    void setUp() {
        soltys = npc("soltys", 5, 5);
        halina = npc("halina", 20, 5);
        NpcRepository npcRepo = mock(NpcRepository.class);
        when(npcRepo.findAll()).thenReturn(List.of(soltys, halina));

        Quest first = quest("pierwsza", "soltys",
                step(QuestStepType.TALK, "halina", null, null, null),
                step(QuestStepType.VISIT, "osada", 10, 10, null),
                step(QuestStepType.TALK, "soltys", null, null, null));
        Quest batteries = quest("baterie", "halina",
                step(QuestStepType.COLLECT, "bateria", null, null, 3));
        when(questRepo.findAll()).thenReturn(List.of(first, batteries));

        ContentCache cache = new ContentCache(emptyRepo(TileDefRepository.class), emptyRepo(RaceRepository.class),
                emptyRepo(CharacterClassRepository.class), emptyRepo(ItemTemplateRepository.class),
                emptyRepo(GameMapRepository.class), npcRepo, questRepo, emptyRepo(pl.idiocracy.game.content.MonsterTemplateRepository.class));
        cache.reload();
        when(characters.saveQuest(any())).thenAnswer(inv -> inv.getArgument(0));

        engine = new QuestEngine(cache, characters, progression, notifier);
        player = new OnlinePlayer(1L, 1L, "Zbyszek", "analogowiec", "technik", Appearance.EMPTY, mock(WebSocketSession.class));
        player.level = 1;
        player.mapCode = "osada";
        player.x = 5;
        player.y = 6;
    }

    @Test
    void fullTalkVisitTalkFlowGrantsRewards() {
        assertThat(engine.markers(player)).containsEntry("soltys", "!");

        engine.accept(player, "pierwsza", soltys);
        assertThat(engine.markers(player)).containsEntry("halina", "?");

        engine.talk(player, halina);
        assertThat(player.quests.get("pierwsza").getStepIndex()).isEqualTo(1);

        player.x = 10;
        player.y = 10;
        engine.onMoved(player);
        assertThat(player.quests.get("pierwsza").getStepIndex()).isEqualTo(2);

        engine.talk(player, soltys);
        CharacterQuest cq = player.quests.get("pierwsza");
        assertThat(cq.getStatus()).isEqualTo(QuestStatus.COMPLETED);
        verify(progression).addCcoin(player, 30);
        verify(progression).addXp(player, 120);
        assertThat(engine.isAvailable(player, questRepo.findAll().get(0))).isFalse();
    }

    @Test
    void collectStepWithConsumeCompletesImmediatelyWhenItemsOwned() {
        when(characters.countItem(1L, "bateria")).thenReturn(3);

        engine.accept(player, "baterie", halina);

        assertThat(player.quests.get("baterie").getStatus()).isEqualTo(QuestStatus.COMPLETED);
        verify(characters).takeItems(1L, "bateria", 3);
    }

    // ------------------------------------------------------------------ helpers

    private static <T extends org.springframework.data.jpa.repository.JpaRepository<?, String>> T emptyRepo(Class<T> type) {
        T repo = mock(type);
        when(repo.findAll()).thenReturn(List.of());
        return repo;
    }

    private static Npc npc(String code, int x, int y) {
        Npc n = new Npc();
        n.setCode(code);
        n.setName(code);
        n.setMapCode("osada");
        n.setX(x);
        n.setY(y);
        return n;
    }

    private static QuestStep step(QuestStepType type, String target, Integer x, Integer y, Integer count) {
        return new QuestStep(type, target, x, y, 0, count, true, "cel", "dialog", null);
    }

    private static Quest quest(String code, String giver, QuestStep... steps) {
        Quest q = new Quest();
        q.setCode(code);
        q.setTitle(code);
        q.setGiverNpc(giver);
        q.setSteps(List.of(steps));
        q.setRewards(new QuestRewards(30, 120, List.of()));
        return q;
    }
}
