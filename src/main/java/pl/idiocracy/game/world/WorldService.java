package pl.idiocracy.game.world;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;

import pl.idiocracy.game.character.CharacterQuest;
import pl.idiocracy.game.character.CharacterService;
import pl.idiocracy.game.character.PlayerCharacter;
import pl.idiocracy.game.config.GameException;
import pl.idiocracy.game.config.GameProperties;
import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.ContentChangedEvent;
import pl.idiocracy.game.content.ContentType;
import pl.idiocracy.game.content.GameMap;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.LootEntry;
import pl.idiocracy.game.content.MonsterTemplate;
import pl.idiocracy.game.content.Npc;
import pl.idiocracy.game.content.Portal;

/**
 * Autorytatywny swiat gry. Klient tylko prosi o ruch ("move N") i wskazuje cel ataku,
 * serwer sprawdza kolizje, tempo i portale, symuluje potwory i rozsyla wynik graczom
 * z tej samej instancji mapy.
 */
@Service
public class WorldService {

    private static final Logger log = LoggerFactory.getLogger(WorldService.class);
    /** Tolerancja na jitter sieci - akceptujemy ruch po 75% czasu kroku. */
    private static final double MOVE_TOLERANCE = 0.75;
    private static final int CHAT_MAX = 200;

    private final ContentCache content;
    private final CharacterService characters;
    private final PlayerProgression progression;
    private final QuestEngine quests;
    private final MonsterEngine monsters;
    private final GameNotifier notifier;
    private final GameProperties props;

    private final Map<String, MapInstance> instances = new ConcurrentHashMap<>();
    private final Map<Long, OnlinePlayer> online = new ConcurrentHashMap<>();
    private final Map<String, OnlinePlayer> bySession = new ConcurrentHashMap<>();

    public WorldService(ContentCache content, CharacterService characters, PlayerProgression progression,
                        QuestEngine quests, MonsterEngine monsters, GameNotifier notifier, GameProperties props) {
        this.content = content;
        this.characters = characters;
        this.progression = progression;
        this.quests = quests;
        this.monsters = monsters;
        this.notifier = notifier;
        this.props = props;
    }

    // ------------------------------------------------------------ polaczenie

    public void join(WebSocketSession session, long accountId, long characterId) {
        PlayerCharacter pc = characters.owned(accountId, characterId);
        OnlinePlayer previous = online.get(characterId);
        if (previous != null) {
            notifier.system(previous, "Zalogowano tą postacią z innego miejsca.");
            leave(previous.session);
            try {
                previous.session.close(CloseStatus.POLICY_VIOLATION.withReason("duplicate"));
            } catch (Exception ignored) {
                // sesja i tak jest juz porzucona
            }
        }
        OnlinePlayer p = new OnlinePlayer(pc.getId(), accountId, pc.getName(), pc.getRaceCode(), pc.getClassCode(),
                pc.getAppearance(), session);
        p.level = pc.getLevel();
        p.xp = pc.getXp();
        p.ccoin = pc.getCcoin();
        p.hp = pc.getHp();
        p.dir = Direction.parse(pc.getDir()) == null ? Direction.S : Direction.parse(pc.getDir());
        for (CharacterQuest cq : characters.questLog(pc.getId())) {
            p.quests.put(cq.getQuestCode(), cq);
        }
        progression.recompute(p);
        if (p.hp <= 0) {
            p.hp = p.derived.maxHp();
        }

        GameMap map = content.map(pc.getMapCode()).orElse(null);
        if (map == null || !map.inBounds(pc.getX(), pc.getY())) {
            map = startMap();
            place(p, map, map.getSpawnX(), map.getSpawnY());
        } else {
            place(p, map, pc.getX(), pc.getY());
        }
        List<Map<String, Object>> intros = quests.autoStart(p);
        online.put(p.characterId, p);
        bySession.put(session.getId(), p);
        MapInstance inst = instance(p);
        inst.players.put(p.characterId, p);

        notifier.send(p, Msg.of("welcome",
                "title", props.title(),
                "you", progression.selfPayload(p),
                "map", mapPayload(map, p),
                "players", others(inst, p),
                "monsters", MonsterEngine.views(inst),
                "marks", quests.markers(p),
                "inventory", progression.inventoryPayload(p),
                "quests", quests.questLog(p)));
        notifier.broadcast(inst, Msg.of("join", "player", p.publicView()), p);
        notifier.system(p, "Połączono z " + props.title() + ". Graczy online: " + online.size() + ".");
        intros.forEach(d -> notifier.send(p, d));
        log.info("{} wchodzi do gry ({})", p.name, p.instanceKey);
    }

    public void leave(WebSocketSession session) {
        OnlinePlayer p = bySession.remove(session.getId());
        if (p == null) {
            return;
        }
        online.remove(p.characterId, p);
        removeFromInstance(p);
        persistPosition(p);
        progression.persist(p);
        log.info("{} opuszcza grę", p.name);
    }

    // ------------------------------------------------------------- komendy

    public void handle(WebSocketSession session, JsonNode msg) {
        OnlinePlayer p = bySession.get(session.getId());
        if (p == null) {
            return;
        }
        String type = msg.path("t").asText("");
        try {
            switch (type) {
                case "move" -> move(p, Direction.parse(msg.path("dir").asText()), msg.path("seq").asLong());
                case "face" -> face(p, Direction.parse(msg.path("dir").asText()));
                case "attack" -> attack(p, msg.path("id").isNumber() ? msg.path("id").asLong() : null);
                case "chat" -> chat(p, msg.path("text").asText(""));
                case "talk" -> talk(p, msg.path("npc").asText());
                case "accept" -> accept(p, msg.path("quest").asText(), msg.path("npc").asText());
                case "equip" -> equip(p, msg.path("item").asLong(), true);
                case "unequip" -> equip(p, msg.path("item").asLong(), false);
                case "use" -> use(p, msg.path("item").asLong());
                case "ping" -> notifier.send(p, Msg.of("pong", "ts", msg.path("ts").asLong()));
                default -> notifier.send(p, Msg.of("error", "text", "Nieznana komenda: " + type));
            }
        } catch (GameException e) {
            notifier.send(p, Msg.of("error", "text", e.getMessage()));
        }
    }

    void move(OnlinePlayer p, Direction dir, long seq) {
        if (dir == null) {
            return;
        }
        Portal portal;
        synchronized (p) {
            long now = System.currentTimeMillis();
            GameMap map = content.map(p.mapCode).orElse(null);
            int nx = p.x + dir.dx;
            int ny = p.y + dir.dy;
            p.dir = dir;
            boolean tooFast = now - p.lastMoveAtMs < p.derived.moveDelayMs() * MOVE_TOLERANCE;
            if (map == null || tooFast || p.hp <= 0 || !isWalkable(map, p, nx, ny)) {
                notifier.send(p, Msg.of("correct", "x", p.x, "y", p.y, "dir", dir.name(), "seq", seq));
                notifier.broadcast(instance(p), Msg.of("face", "id", p.characterId, "dir", dir.name()), p);
                return;
            }
            p.x = nx;
            p.y = ny;
            p.lastMoveAtMs = now;
            p.positionDirty = true;
            portal = map.getPortals().stream().filter(pt -> pt.x() == nx && pt.y() == ny).findFirst().orElse(null);
        }
        notifier.broadcast(instance(p), Msg.of("moved", "id", p.characterId, "x", p.x, "y", p.y,
                "dir", dir.name(), "ms", p.derived.moveDelayMs()), p);
        quests.onMoved(p);
        if (portal != null) {
            usePortal(p, portal);
        }
    }

    /** Pole jest wolne: kafelki, widoczni NPC i potwory blokuja, gracze nie (jak w Margonem). */
    boolean isWalkable(GameMap map, OnlinePlayer p, int x, int y) {
        if (!map.inBounds(x, y) || content.isSolidTile(map, x, y)) {
            return false;
        }
        for (Npc npc : quests.visibleNpcs(p, map.getCode())) {
            if (npc.getX() == x && npc.getY() == y) {
                return false;
            }
        }
        MapInstance inst = instances.get(p.instanceKey);
        return inst == null || inst.monsterAt(x, y) == null;
    }

    private void usePortal(OnlinePlayer p, Portal portal) {
        GameMap target = content.map(portal.targetMap()).orElse(null);
        if (target == null) {
            notifier.system(p, "To przejście prowadzi donikąd (brak mapy " + portal.targetMap() + ").");
            return;
        }
        int tx = target.inBounds(portal.targetX(), portal.targetY()) ? portal.targetX() : target.getSpawnX();
        int ty = target.inBounds(portal.targetX(), portal.targetY()) ? portal.targetY() : target.getSpawnY();
        transfer(p, target, tx, ty);
    }

    void transfer(OnlinePlayer p, GameMap target, int x, int y) {
        removeFromInstance(p);
        synchronized (p) {
            if (!target.getCode().equals(p.mapCode)) {
                p.npcOverrides.clear();
            }
            place(p, target, x, y);
            p.positionDirty = true;
            p.targetMonsterId = null;
        }
        MapInstance to = instance(p);
        to.players.put(p.characterId, p);
        notifier.send(p, Msg.of("enter",
                "you", progression.selfPayload(p),
                "map", mapPayload(target, p),
                "players", others(to, p),
                "monsters", MonsterEngine.views(to),
                "marks", quests.markers(p)));
        notifier.broadcast(to, Msg.of("join", "player", p.publicView()), p);
        quests.onMoved(p);
    }

    private void removeFromInstance(OnlinePlayer p) {
        MapInstance from = instances.get(p.instanceKey);
        if (from != null && from.players.remove(p.characterId, p)) {
            notifier.broadcast(from, Msg.of("leave", "id", p.characterId), p);
            for (Monster m : from.monsters.values()) {
                if (m.targetId != null && m.targetId == p.characterId) {
                    m.targetId = null;
                }
            }
            if (from.players.isEmpty() && !from.key.equals(from.mapCode)) {
                instances.remove(from.key, from);
            }
        }
    }

    private void face(OnlinePlayer p, Direction dir) {
        if (dir == null) {
            return;
        }
        p.dir = dir;
        notifier.broadcast(instance(p), Msg.of("face", "id", p.characterId, "dir", dir.name()), p);
    }

    private void attack(OnlinePlayer p, Long monsterId) {
        MapInstance inst = instance(p);
        if (monsterId == null || !inst.monsters.containsKey(monsterId)) {
            p.targetMonsterId = null;
            notifier.send(p, Msg.of("target", "id", null));
            return;
        }
        p.targetMonsterId = monsterId;
        notifier.send(p, Msg.of("target", "id", monsterId));
    }

    private void chat(OnlinePlayer p, String raw) {
        String text = raw.strip();
        if (text.isEmpty()) {
            return;
        }
        if (text.length() > CHAT_MAX) {
            text = text.substring(0, CHAT_MAX);
        }
        if (text.startsWith("/")) {
            command(p, text);
            return;
        }
        notifier.broadcast(instance(p), Msg.of("chat", "id", p.characterId, "from", p.name, "text", text), null);
    }

    private void command(OnlinePlayer p, String text) {
        String cmd = text.split("\\s+")[0].toLowerCase();
        switch (cmd) {
            case "/who" -> notifier.system(p, "Online (" + online.size() + "): "
                    + String.join(", ", online.values().stream().map(o -> o.name).sorted().toList()));
            case "/pos" -> notifier.system(p, p.mapCode + " [" + p.x + ", " + p.y + "]");
            case "/help" -> notifier.system(p, "Komendy: /who, /pos, /help. Rozmowa: klik na NPC lub E. "
                    + "Walka: klik na potwora lub Spacja (najbliższy cel), Esc — przerwij.");
            default -> notifier.system(p, "Nieznana komenda. Spróbuj /help");
        }
    }

    private void talk(OnlinePlayer p, String npcCode) {
        Npc npc = nearbyNpc(p, npcCode);
        notifier.send(p, quests.talk(p, npc));
        quests.afterQuestChange(p);
    }

    private void accept(OnlinePlayer p, String questCode, String npcCode) {
        quests.accept(p, questCode, nearbyNpc(p, npcCode));
    }

    private Npc nearbyNpc(OnlinePlayer p, String npcCode) {
        Npc npc = content.npc(npcCode).filter(n -> quests.isVisible(p, n)).map(n -> quests.locate(p, n))
                .orElseThrow(() -> GameException.badRequest("Nie ma takiej osoby"));
        if (!npc.getMapCode().equals(p.mapCode)
                || Math.max(Math.abs(npc.getX() - p.x), Math.abs(npc.getY() - p.y)) > QuestEngine.TALK_DISTANCE) {
            throw GameException.badRequest("Podejdź bliżej, żeby porozmawiać.");
        }
        return npc;
    }

    private void equip(OnlinePlayer p, long itemId, boolean on) {
        if (on) {
            characters.equip(p.characterId, itemId, p.level);
        } else {
            characters.unequip(p.characterId, itemId);
        }
        refreshAfterInventory(p);
    }

    private void use(OnlinePlayer p, long itemId) {
        ItemTemplate used = characters.consumeOne(p.characterId, itemId);
        int heal = used.getStats().heal();
        synchronized (p) {
            p.hp = Math.min(p.derived.maxHp(), p.hp + heal);
            p.positionDirty = true;
        }
        notifier.system(p, "Użyto: " + used.getName() + (heal > 0 ? " (+" + heal + " HP)" : ""));
        refreshAfterInventory(p);
    }

    private void refreshAfterInventory(OnlinePlayer p) {
        boolean looksChanged = progression.recompute(p);
        progression.sendInventory(p);
        progression.sendSelf(p);
        if (looksChanged) {
            notifier.broadcast(instance(p), Msg.of("update", "player", p.publicView()), p);
        }
        quests.onInventoryChanged(p);
    }

    // ------------------------------------------------------------- walka

    @Scheduled(fixedRate = 100)
    public void tick() {
        long now = System.currentTimeMillis();
        for (MapInstance inst : instances.values()) {
            if (inst.players.isEmpty()) {
                continue;
            }
            GameMap map = content.map(inst.mapCode).orElse(null);
            if (map == null) {
                continue;
            }
            try {
                MonsterEngine.Outcome out = monsters.tick(inst, map, now);
                out.kills().forEach(k -> reward(k.killer(), k.monster()));
                out.deaths().forEach(p -> knockOut(p, map));
            } catch (RuntimeException e) {
                log.error("Błąd symulacji instancji {}", inst.key, e);
            }
        }
    }

    private void reward(OnlinePlayer p, MonsterTemplate m) {
        progression.addXp(p, m.getXp());
        var rnd = ThreadLocalRandom.current();
        long coins = m.getCcoinMax() > 0 ? rnd.nextInt(m.getCcoinMin(), m.getCcoinMax() + 1) : 0;
        progression.addCcoin(p, coins);
        boolean loot = false;
        for (LootEntry e : m.getLoot()) {
            if (content.item(e.code()).isEmpty() || rnd.nextDouble() * 100 >= e.chance()) {
                continue;
            }
            int qty = Math.max(1, e.max() > e.min() ? rnd.nextInt(e.min(), e.max() + 1) : e.min());
            characters.grantItem(p.characterId, e.code(), qty);
            notifier.system(p, "Łup: " + content.item(e.code()).get().getName() + (qty > 1 ? " x" + qty : ""));
            loot = true;
        }
        progression.persist(p);
        progression.sendSelf(p);
        if (loot) {
            progression.sendInventory(p);
        }
        quests.onKill(p, m.getCode());
        if (loot) {
            quests.onInventoryChanged(p);
        }
    }

    /** Postac traci przytomnosc i budzi sie w punkcie startowym mapy. */
    private void knockOut(OnlinePlayer p, GameMap map) {
        synchronized (p) {
            p.hp = Math.max(1, p.derived.maxHp() / 2);
            p.targetMonsterId = null;
        }
        notifier.system(p, "Tracisz przytomność. Budzisz się obolały w bezpieczniejszym miejscu.");
        transfer(p, map, map.getSpawnX(), map.getSpawnY());
        progression.sendSelf(p);
    }

    // ------------------------------------------------------ edycja na zywo

    @EventListener
    public void onContentChanged(ContentChangedEvent event) {
        if (event.type() == ContentType.MAPS || event.type() == ContentType.MONSTERS) {
            for (MapInstance inst : instances.values()) {
                if (event.type() == ContentType.MONSTERS || inst.mapCode.equals(event.code())) {
                    inst.resetMonsters();
                }
            }
        }
        for (OnlinePlayer p : List.copyOf(online.values())) {
            notifier.send(p, Msg.of("content", "type", event.type().path(), "code", event.code()));
            GameMap map = content.map(p.mapCode).orElse(null);
            if (map == null || !map.inBounds(p.x, p.y)) {
                GameMap start = startMap();
                transfer(p, start, start.getSpawnX(), start.getSpawnY());
                continue;
            }
            switch (event.type()) {
                case MAPS, NPCS, QUESTS, TILES, MONSTERS -> {
                    notifier.send(p, Msg.of("mapReload", "map", mapPayload(map, p), "marks", quests.markers(p),
                            "monsters", MonsterEngine.views(instance(p))));
                    if (event.type() == ContentType.QUESTS) {
                        notifier.send(p, Msg.of("quests", "quests", quests.questLog(p)));
                    }
                }
                case RACES, CLASSES, ITEMS -> refreshAfterInventory(p);
            }
        }
    }

    // ------------------------------------------------------------ zapis

    @Scheduled(fixedDelayString = "${game.save-interval-ms:15000}")
    public void autosave() {
        for (OnlinePlayer p : online.values()) {
            if (p.positionDirty) {
                persistPosition(p);
            }
        }
    }

    private void persistPosition(OnlinePlayer p) {
        p.positionDirty = false;
        characters.saveState(p.characterId, p.mapCode, p.x, p.y, p.dir.name(), p.hp);
    }

    // ------------------------------------------------------------ pomocnicze

    public int onlineCount() {
        return online.size();
    }

    private GameMap startMap() {
        return content.map(props.startMap()).orElseGet(() -> content.get().maps().values().iterator().next());
    }

    private void place(OnlinePlayer p, GameMap map, int x, int y) {
        p.mapCode = map.getCode();
        p.instanceKey = map.isInstanced() ? map.getCode() + "#" + p.characterId : map.getCode();
        p.x = x;
        p.y = y;
    }

    private MapInstance instance(OnlinePlayer p) {
        String mapCode = p.mapCode;
        return instances.computeIfAbsent(p.instanceKey, k -> new MapInstance(k, mapCode));
    }

    private List<Map<String, Object>> others(MapInstance inst, OnlinePlayer self) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (OnlinePlayer o : inst.players()) {
            if (o != self) {
                list.add(o.publicView());
            }
        }
        return list;
    }

    private Map<String, Object> mapPayload(GameMap map, OnlinePlayer p) {
        List<Map<String, Object>> npcs = quests.npcViews(p, map.getCode());
        return Msg.of("map", "code", map.getCode(), "name", map.getName(), "width", map.getWidth(),
                "height", map.getHeight(), "ground", map.getLayers().ground(), "objects", map.getLayers().objects(),
                "portals", map.getPortals(), "spawn", Map.of("x", map.getSpawnX(), "y", map.getSpawnY()),
                "npcs", npcs);
    }
}
