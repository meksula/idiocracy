package pl.idiocracy.game.character;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pl.idiocracy.game.config.GameException;
import pl.idiocracy.game.config.GameProperties;
import pl.idiocracy.game.content.Appearance;
import pl.idiocracy.game.content.CharacterClass;
import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.EquipSlot;
import pl.idiocracy.game.content.GameMap;
import pl.idiocracy.game.content.ItemStack;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.Race;

@Service
public class CharacterService {

    private static final String NAME_PATTERN = "[\\p{L}0-9][\\p{L}0-9 _-]{1,14}[\\p{L}0-9]";
    private static final String COLOR_PATTERN = "[0-9A-Za-z]";

    private final PlayerCharacterRepository characters;
    private final CharacterItemRepository items;
    private final CharacterQuestRepository quests;
    private final ContentCache content;
    private final GameProperties props;

    public CharacterService(PlayerCharacterRepository characters, CharacterItemRepository items,
                            CharacterQuestRepository quests, ContentCache content, GameProperties props) {
        this.characters = characters;
        this.items = items;
        this.quests = quests;
        this.content = content;
        this.props = props;
    }

    public record CharacterView(long id, String name, String race, String raceName, String clazz, String className,
                                int level, long ccoin, String mapName, Appearance appearance) {
    }

    public record CreateRequest(String name, String race, String clazz, String hair) {
    }

    @Transactional(readOnly = true)
    public List<CharacterView> list(long accountId) {
        return characters.findByAccountIdOrderById(accountId).stream().map(this::view).toList();
    }

    @Transactional
    public CharacterView create(long accountId, CreateRequest req) {
        String name = req.name() == null ? "" : req.name().trim().replaceAll("\\s+", " ");
        if (!name.matches(NAME_PATTERN)) {
            throw GameException.badRequest("Imię: 3-16 znaków, litery, cyfry, spacja, _ lub -");
        }
        if (characters.countByAccountId(accountId) >= props.maxCharactersPerAccount()) {
            throw GameException.badRequest("Limit postaci na konto: " + props.maxCharactersPerAccount());
        }
        if (characters.nameTaken(name)) {
            throw GameException.conflict("To imię jest już zajęte");
        }
        var snap = content.get();
        Race race = snap.races().get(req.race());
        CharacterClass clazz = snap.classes().get(req.clazz());
        if (race == null || !race.isPlayable() || clazz == null || !clazz.isPlayable()) {
            throw GameException.badRequest("Wybierz rasę i klasę");
        }
        String hair = req.hair() != null && req.hair().matches(COLOR_PATTERN) ? req.hair() : null;
        GameMap start = content.map(props.startMap())
                .orElseGet(() -> snap.maps().values().stream().findFirst()
                        .orElseThrow(() -> new GameException(HttpStatus.SERVICE_UNAVAILABLE, "Brak map w świecie")));

        PlayerCharacter pc = new PlayerCharacter(accountId, name, race.getCode(), clazz.getCode(),
                new Appearance(null, hair, null, null, null, null));
        pc.placeAt(start.getCode(), start.getSpawnX(), start.getSpawnY(), "S");
        pc.setCcoin(props.startingCcoin());
        pc = characters.save(pc);
        java.util.Set<EquipSlot> used = java.util.EnumSet.noneOf(EquipSlot.class);
        for (ItemStack stack : clazz.getStartingItems()) {
            ItemTemplate tpl = snap.items().get(stack.code());
            if (tpl == null) {
                continue;
            }
            CharacterItem ci = new CharacterItem(pc.getId(), stack.code(), Math.max(1, stack.quantity()));
            if (tpl.isEquippable() && tpl.getMinLevel() <= 1 && used.add(tpl.getSlot())) {
                ci.setEquippedSlot(tpl.getSlot());
            }
            items.save(ci);
        }
        List<ItemTemplate> equipped = equippedTemplates(items.findByCharacterIdOrderById(pc.getId()));
        pc.setHp(StatsCalculator.derive(race.getStats(), clazz.getStats(), 1, equipped, props.baseMoveDelayMs()).maxHp());
        return view(pc);
    }

    @Transactional
    public void delete(long accountId, long characterId) {
        PlayerCharacter pc = owned(accountId, characterId);
        characters.delete(pc);
    }

    @Transactional(readOnly = true)
    public PlayerCharacter owned(long accountId, long characterId) {
        return characters.findByIdAndAccountId(characterId, accountId)
                .orElseThrow(() -> GameException.notFound("Nie znaleziono postaci"));
    }

    // ---------- operacje uzywane przez swiat gry ----------

    @Transactional(readOnly = true)
    public List<CharacterItem> inventory(long characterId) {
        return items.findByCharacterIdOrderById(characterId);
    }

    @Transactional(readOnly = true)
    public List<CharacterQuest> questLog(long characterId) {
        return quests.findByCharacterId(characterId);
    }

    @Transactional
    public void saveState(long characterId, String mapCode, int x, int y, String dir, int hp) {
        characters.findById(characterId).ifPresent(pc -> {
            pc.placeAt(mapCode, x, y, dir);
            pc.setHp(hp);
        });
    }

    @Transactional
    public void saveProgression(long characterId, int level, long xp, long ccoin, int hp) {
        characters.findById(characterId).ifPresent(pc -> {
            pc.setLevel(level);
            pc.setXp(xp);
            pc.setCcoin(ccoin);
            pc.setHp(hp);
        });
    }

    @Transactional
    public void grantItem(long characterId, String itemCode, int quantity) {
        ItemTemplate tpl = content.item(itemCode).orElseThrow(() -> GameException.badRequest("Brak przedmiotu " + itemCode));
        if (tpl.isStackable()) {
            for (CharacterItem ci : items.findByCharacterIdOrderById(characterId)) {
                if (ci.getItemCode().equals(itemCode)) {
                    ci.setQuantity(ci.getQuantity() + quantity);
                    return;
                }
            }
            items.save(new CharacterItem(characterId, itemCode, quantity));
        } else {
            for (int i = 0; i < quantity; i++) {
                items.save(new CharacterItem(characterId, itemCode, 1));
            }
        }
    }

    @Transactional(readOnly = true)
    public int countItem(long characterId, String itemCode) {
        return items.findByCharacterIdOrderById(characterId).stream()
                .filter(ci -> ci.getItemCode().equals(itemCode)).mapToInt(CharacterItem::getQuantity).sum();
    }

    /** Zabiera przedmioty (najpierw niezalozone). Zwraca false gdy brakuje. */
    @Transactional
    public boolean takeItems(long characterId, String itemCode, int quantity) {
        List<CharacterItem> owned = new ArrayList<>(items.findByCharacterIdOrderById(characterId).stream()
                .filter(ci -> ci.getItemCode().equals(itemCode)).toList());
        if (owned.stream().mapToInt(CharacterItem::getQuantity).sum() < quantity) {
            return false;
        }
        owned.sort((a, b) -> Boolean.compare(a.getEquippedSlot() != null, b.getEquippedSlot() != null));
        int left = quantity;
        for (CharacterItem ci : owned) {
            if (left == 0) {
                break;
            }
            int take = Math.min(left, ci.getQuantity());
            left -= take;
            if (take == ci.getQuantity()) {
                items.delete(ci);
            } else {
                ci.setQuantity(ci.getQuantity() - take);
            }
        }
        return true;
    }

    /** Zaklada przedmiot - zdejmuje to, co bylo w tym samym slocie. */
    @Transactional
    public void equip(long characterId, long itemId, int level) {
        List<CharacterItem> inv = items.findByCharacterIdOrderById(characterId);
        CharacterItem ci = inv.stream().filter(i -> Objects.equals(i.getId(), itemId)).findFirst()
                .orElseThrow(() -> GameException.badRequest("Nie masz tego przedmiotu"));
        ItemTemplate tpl = content.item(ci.getItemCode()).orElseThrow(() -> GameException.badRequest("Nieznany przedmiot"));
        if (!tpl.isEquippable()) {
            throw GameException.badRequest("Tego nie da się założyć");
        }
        if (level < tpl.getMinLevel()) {
            throw GameException.badRequest("Wymagany poziom " + tpl.getMinLevel());
        }
        for (CharacterItem other : inv) {
            if (other.getEquippedSlot() == tpl.getSlot()) {
                other.setEquippedSlot(null);
            }
        }
        ci.setEquippedSlot(tpl.getSlot());
    }

    @Transactional
    public void unequip(long characterId, long itemId) {
        items.findByCharacterIdOrderById(characterId).stream()
                .filter(i -> Objects.equals(i.getId(), itemId)).findFirst()
                .ifPresent(ci -> ci.setEquippedSlot(null));
    }

    /** Zuzywa jedna sztuke przedmiotu. Zwraca szablon zuzytego przedmiotu. */
    @Transactional
    public ItemTemplate consumeOne(long characterId, long itemId) {
        CharacterItem ci = items.findById(itemId).filter(i -> i.getCharacterId() == characterId)
                .orElseThrow(() -> GameException.badRequest("Nie masz tego przedmiotu"));
        ItemTemplate tpl = content.item(ci.getItemCode()).orElseThrow(() -> GameException.badRequest("Nieznany przedmiot"));
        if (tpl.getType() != pl.idiocracy.game.content.ItemType.CONSUMABLE) {
            throw GameException.badRequest("Tego nie da się użyć");
        }
        if (ci.getQuantity() > 1) {
            ci.setQuantity(ci.getQuantity() - 1);
        } else {
            items.delete(ci);
        }
        return tpl;
    }

    @Transactional
    public CharacterQuest saveQuest(CharacterQuest cq) {
        return quests.save(cq);
    }

    public List<ItemTemplate> equippedTemplates(List<CharacterItem> inv) {
        Map<String, ItemTemplate> all = content.get().items();
        return inv.stream().filter(ci -> ci.getEquippedSlot() != null)
                .map(ci -> all.get(ci.getItemCode())).filter(Objects::nonNull).toList();
    }

    public EquipSlot[] slots() {
        return EquipSlot.values();
    }

    private CharacterView view(PlayerCharacter pc) {
        var snap = content.get();
        Race race = snap.races().get(pc.getRaceCode());
        CharacterClass clazz = snap.classes().get(pc.getClassCode());
        GameMap map = snap.maps().get(pc.getMapCode());
        List<ItemTemplate> equipped = pc.getId() == null ? List.of() : equippedTemplates(items.findByCharacterIdOrderById(pc.getId()));
        return new CharacterView(pc.getId(), pc.getName(), pc.getRaceCode(), race == null ? "?" : race.getName(),
                pc.getClassCode(), clazz == null ? "?" : clazz.getName(), pc.getLevel(), pc.getCcoin(),
                map == null ? "?" : map.getName(),
                AppearanceResolver.resolve(pc.getAppearance(), race, clazz, equipped));
    }
}
