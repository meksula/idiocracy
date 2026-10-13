package pl.idiocracy.game.world;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import pl.idiocracy.game.character.AppearanceResolver;
import pl.idiocracy.game.character.CharacterItem;
import pl.idiocracy.game.character.CharacterService;
import pl.idiocracy.game.character.StatsCalculator;
import pl.idiocracy.game.config.GameProperties;
import pl.idiocracy.game.content.CharacterClass;
import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.Race;
import pl.idiocracy.game.content.Stats;

/** Statystyki, doswiadczenie, c-coiny i ekwipunek gracza online. */
@Component
public class PlayerProgression {

    private final CharacterService characters;
    private final ContentCache content;
    private final GameNotifier notifier;
    private final GameProperties props;

    public PlayerProgression(CharacterService characters, ContentCache content, GameNotifier notifier,
                             GameProperties props) {
        this.characters = characters;
        this.content = content;
        this.notifier = notifier;
        this.props = props;
    }

    /** Przelicza statystyki i wyglad. Zwraca true, gdy zmienil sie wyglad widoczny dla innych. */
    boolean recompute(OnlinePlayer p) {
        List<CharacterItem> inv = characters.inventory(p.characterId);
        List<ItemTemplate> equipped = characters.equippedTemplates(inv);
        Race race = content.get().races().get(p.raceCode);
        CharacterClass clazz = content.get().classes().get(p.classCode);
        Stats rs = race == null ? Stats.ZERO : race.getStats();
        Stats cs = clazz == null ? Stats.ZERO : clazz.getStats();
        synchronized (p) {
            var oldApp = p.appearance;
            p.derived = StatsCalculator.derive(rs, cs, p.level, equipped, props.baseMoveDelayMs());
            p.appearance = AppearanceResolver.resolve(p.ownAppearance, race, clazz, equipped);
            p.hp = Math.min(Math.max(p.hp, 1), p.derived.maxHp());
            return oldApp != null && !oldApp.equals(p.appearance);
        }
    }

    void addCcoin(OnlinePlayer p, long amount) {
        if (amount == 0) {
            return;
        }
        synchronized (p) {
            p.ccoin = Math.max(0, p.ccoin + amount);
        }
        notifier.system(p, (amount > 0 ? "+" : "") + amount + " c-coin");
    }

    /** Zwraca liczbe zdobytych poziomow. */
    int addXp(OnlinePlayer p, long amount) {
        if (amount <= 0) {
            return 0;
        }
        int gained = 0;
        synchronized (p) {
            p.xp += amount;
            while (p.xp >= StatsCalculator.xpToNext(p.level)) {
                p.xp -= StatsCalculator.xpToNext(p.level);
                p.level++;
                gained++;
            }
        }
        notifier.system(p, "+" + amount + " XP");
        if (gained > 0) {
            recompute(p);
            synchronized (p) {
                p.hp = p.derived.maxHp();
            }
            notifier.system(p, "AWANS! Poziom " + p.level + ". Myślenie boli trochę mniej.");
        }
        return gained;
    }

    void persist(OnlinePlayer p) {
        characters.saveProgression(p.characterId, p.level, p.xp, p.ccoin, p.hp);
    }

    void sendSelf(OnlinePlayer p) {
        Race race = content.get().races().get(p.raceCode);
        CharacterClass clazz = content.get().classes().get(p.classCode);
        notifier.send(p, Msg.of("self", "you", p.selfView(
                race == null ? p.raceCode : race.getName(), clazz == null ? p.classCode : clazz.getName())));
    }

    Map<String, Object> selfPayload(OnlinePlayer p) {
        Race race = content.get().races().get(p.raceCode);
        CharacterClass clazz = content.get().classes().get(p.classCode);
        return p.selfView(race == null ? p.raceCode : race.getName(), clazz == null ? p.classCode : clazz.getName());
    }

    void sendInventory(OnlinePlayer p) {
        notifier.send(p, Msg.of("inventory", "items", inventoryPayload(p)));
    }

    List<Map<String, Object>> inventoryPayload(OnlinePlayer p) {
        return characters.inventory(p.characterId).stream().map(ci -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", ci.getId());
            m.put("code", ci.getItemCode());
            m.put("qty", ci.getQuantity());
            m.put("slot", ci.getEquippedSlot());
            return m;
        }).toList();
    }
}
