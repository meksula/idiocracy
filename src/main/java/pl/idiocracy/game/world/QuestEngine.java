package pl.idiocracy.game.world;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import pl.idiocracy.game.character.CharacterQuest;
import pl.idiocracy.game.character.CharacterService;
import pl.idiocracy.game.character.QuestStatus;
import pl.idiocracy.game.config.GameException;
import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.ItemStack;
import pl.idiocracy.game.content.Npc;
import pl.idiocracy.game.content.Quest;
import pl.idiocracy.game.content.QuestRewards;
import pl.idiocracy.game.content.QuestStep;
import pl.idiocracy.game.content.QuestStepType;

/**
 * Silnik misji: misja to lista krokow (TALK/VISIT/COLLECT/KILL) przechodzonych po kolei.
 * Kroki "automatyczne" (VISIT, COLLECT) sa sprawdzane po kazdym istotnym zdarzeniu.
 */
@Component
public class QuestEngine {

    public static final int TALK_DISTANCE = 2;

    private final ContentCache content;
    private final CharacterService characters;
    private final PlayerProgression progression;
    private final GameNotifier notifier;

    public QuestEngine(ContentCache content, CharacterService characters, PlayerProgression progression,
                       GameNotifier notifier) {
        this.content = content;
        this.characters = characters;
        this.progression = progression;
        this.notifier = notifier;
    }

    // ------------------------------------------------------------------ dialog

    Map<String, Object> talk(OnlinePlayer p, Npc npc) {
        List<String> lines = new ArrayList<>();
        boolean progressed = false;
        for (CharacterQuest cq : p.activeQuests()) {
            Quest q = content.quest(cq.getQuestCode()).orElse(null);
            QuestStep step = current(q, cq);
            if (step != null && step.type() == QuestStepType.TALK && npc.getCode().equals(step.target())) {
                lines.add(orDefault(step.dialog(), "Aha. No dobra."));
                cq.advance();
                lines.addAll(settle(p, q, cq));
                characters.saveQuest(cq);
                progressed = true;
            }
        }
        if (!progressed) {
            lines.add(orDefault(npc.getGreeting(), "..."));
            for (CharacterQuest cq : p.activeQuests()) {
                Quest q = content.quest(cq.getQuestCode()).orElse(null);
                if (q != null && npc.getCode().equals(q.getGiverNpc())) {
                    QuestStep step = current(q, cq);
                    lines.add(orDefault(q.getDialog().progress(), "No i jak idzie?")
                            + (step != null && step.text() != null ? " (" + step.text() + ")" : ""));
                }
            }
        } else {
            afterQuestChange(p);
        }
        List<Map<String, Object>> offers = new ArrayList<>();
        for (Quest q : content.questsFrom(npc.getCode())) {
            if (isAvailable(p, q)) {
                Map<String, Object> o = new LinkedHashMap<>();
                o.put("quest", q.getCode());
                o.put("title", q.getTitle());
                o.put("offer", orDefault(q.getDialog().offer(), q.getDescription()));
                offers.add(o);
            }
        }
        return Msg.of("dialog", "npc", npc.getCode(), "name", npc.getName(), "lines", lines, "offers", offers);
    }

    void accept(OnlinePlayer p, String questCode, Npc giver) {
        Quest q = content.quest(questCode).orElseThrow(() -> GameException.badRequest("Nie ma takiej misji"));
        if (giver == null || !giver.getCode().equals(q.getGiverNpc())) {
            throw GameException.badRequest("Ta osoba nie zleca tej misji");
        }
        if (!isAvailable(p, q)) {
            throw GameException.badRequest("Misja niedostępna");
        }
        CharacterQuest cq = p.quests.get(questCode);
        if (cq == null) {
            cq = new CharacterQuest(p.characterId, questCode);
            p.quests.put(questCode, cq);
        } else {
            cq.restart();
        }
        notifier.system(p, "Nowa misja: " + q.getTitle());
        List<String> lines = settle(p, q, cq);
        lines.forEach(l -> notifier.system(p, l));
        characters.saveQuest(cq);
        afterQuestChange(p);
    }

    // --------------------------------------------------------------- zdarzenia

    void onMoved(OnlinePlayer p) {
        checkAuto(p, QuestStepType.VISIT);
    }

    void onInventoryChanged(OnlinePlayer p) {
        checkAuto(p, QuestStepType.COLLECT);
    }

    /** Hook pod przyszly system walki. */
    public void onKill(OnlinePlayer p, String monsterCode) {
        boolean changed = false;
        for (CharacterQuest cq : p.activeQuests()) {
            Quest q = content.quest(cq.getQuestCode()).orElse(null);
            QuestStep step = current(q, cq);
            if (step != null && step.type() == QuestStepType.KILL && monsterCode.equals(step.target())) {
                cq.setProgress(cq.getProgress() + 1);
                if (cq.getProgress() >= step.countOrOne()) {
                    cq.advance();
                    settle(p, q, cq).forEach(l -> notifier.system(p, l));
                }
                characters.saveQuest(cq);
                changed = true;
            }
        }
        if (changed) {
            afterQuestChange(p);
        }
    }

    private void checkAuto(OnlinePlayer p, QuestStepType type) {
        boolean changed = false;
        for (CharacterQuest cq : p.activeQuests()) {
            Quest q = content.quest(cq.getQuestCode()).orElse(null);
            QuestStep step = current(q, cq);
            if (step != null && step.type() == type && isSatisfied(p, step)) {
                List<String> lines = settle(p, q, cq);
                lines.forEach(l -> notifier.system(p, l));
                characters.saveQuest(cq);
                changed = true;
            }
        }
        if (changed) {
            afterQuestChange(p);
        }
    }

    // ------------------------------------------------------------------ logika

    /** Przechodzi przez spelnione kroki automatyczne i ewentualnie konczy misje. */
    private List<String> settle(OnlinePlayer p, Quest q, CharacterQuest cq) {
        List<String> lines = new ArrayList<>();
        if (q == null) {
            return lines;
        }
        while (cq.getStatus() == QuestStatus.ACTIVE) {
            QuestStep step = current(q, cq);
            if (step == null) {
                cq.complete();
                lines.add(orDefault(q.getDialog().complete(), "Misja ukończona."));
                lines.add("Ukończono misję: " + q.getTitle());
                grantRewards(p, q.getRewards());
                break;
            }
            boolean auto = step.type() == QuestStepType.VISIT || step.type() == QuestStepType.COLLECT;
            if (!auto || !isSatisfied(p, step)) {
                break;
            }
            if (step.type() == QuestStepType.COLLECT && Boolean.TRUE.equals(step.consume())) {
                characters.takeItems(p.characterId, step.target(), step.countOrOne());
                progression.sendInventory(p);
            }
            if (step.text() != null && !step.text().isBlank()) {
                lines.add("Zaliczono: " + step.text());
            }
            cq.advance();
        }
        return lines;
    }

    private boolean isSatisfied(OnlinePlayer p, QuestStep step) {
        return switch (step.type()) {
            case VISIT -> step.target().equals(p.mapCode)
                    && Math.abs(p.x - step.x()) <= step.radiusOrZero()
                    && Math.abs(p.y - step.y()) <= step.radiusOrZero();
            case COLLECT -> characters.countItem(p.characterId, step.target()) >= step.countOrOne();
            default -> false;
        };
    }

    private void grantRewards(OnlinePlayer p, QuestRewards r) {
        progression.addCcoin(p, r.ccoin());
        progression.addXp(p, r.xp());
        boolean gotItems = false;
        for (ItemStack s : r.itemsOrEmpty()) {
            if (content.item(s.code()).isPresent()) {
                characters.grantItem(p.characterId, s.code(), Math.max(1, s.quantity()));
                notifier.system(p, "Otrzymano: " + content.item(s.code()).get().getName()
                        + (s.quantity() > 1 ? " x" + s.quantity() : ""));
                gotItems = true;
            }
        }
        progression.persist(p);
        progression.sendSelf(p);
        if (gotItems) {
            progression.sendInventory(p);
        }
    }

    boolean isAvailable(OnlinePlayer p, Quest q) {
        if (p.level < q.getMinLevel()) {
            return false;
        }
        CharacterQuest cq = p.quests.get(q.getCode());
        return cq == null || (cq.getStatus() == QuestStatus.COMPLETED && q.isRepeatable());
    }

    private static QuestStep current(Quest q, CharacterQuest cq) {
        if (q == null || cq.getStatus() != QuestStatus.ACTIVE) {
            return null;
        }
        return cq.getStepIndex() < q.getSteps().size() ? q.getSteps().get(cq.getStepIndex()) : null;
    }

    // ---------------------------------------------------------------- payloady

    void afterQuestChange(OnlinePlayer p) {
        notifier.send(p, Msg.of("quests", "quests", questLog(p)));
        notifier.send(p, Msg.of("npcMarks", "marks", markers(p)));
    }

    List<Map<String, Object>> questLog(OnlinePlayer p) {
        return p.quests.values().stream()
                .sorted(Comparator.comparing((CharacterQuest c) -> c.getStatus() != QuestStatus.ACTIVE)
                        .thenComparing(CharacterQuest::getQuestCode))
                .map(cq -> {
                    Quest q = content.quest(cq.getQuestCode()).orElse(null);
                    if (q == null) {
                        return null;
                    }
                    QuestStep step = current(q, cq);
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("code", q.getCode());
                    m.put("title", q.getTitle());
                    m.put("description", q.getDescription());
                    m.put("status", cq.getStatus());
                    m.put("step", cq.getStepIndex());
                    m.put("steps", q.getSteps().size());
                    if (step != null) {
                        m.put("objective", step.text());
                        m.put("type", step.type());
                        m.put("progress", cq.getProgress());
                        m.put("count", step.countOrOne());
                        if (step.type() == QuestStepType.VISIT) {
                            m.put("target", Map.of("map", step.target(), "x", step.x(), "y", step.y()));
                        }
                    }
                    return m;
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /** '!' - NPC ma misje dla gracza, '?' - NPC jest celem aktualnego kroku. */
    Map<String, String> markers(OnlinePlayer p) {
        Map<String, String> marks = new LinkedHashMap<>();
        for (Npc npc : content.npcsOn(p.mapCode)) {
            boolean talkTarget = p.activeQuests().stream().anyMatch(cq -> {
                QuestStep s = current(content.quest(cq.getQuestCode()).orElse(null), cq);
                return s != null && s.type() == QuestStepType.TALK && npc.getCode().equals(s.target());
            });
            if (talkTarget) {
                marks.put(npc.getCode(), "?");
            } else if (content.questsFrom(npc.getCode()).stream().anyMatch(q -> isAvailable(p, q))) {
                marks.put(npc.getCode(), "!");
            }
        }
        return marks;
    }

    private static String orDefault(String s, String def) {
        return s == null || s.isBlank() ? def : s;
    }
}
