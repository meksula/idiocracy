package pl.idiocracy.game.world;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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
import pl.idiocracy.game.content.GameMap;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.Npc;
import pl.idiocracy.game.content.Portal;

/**
 * Autorytatywny swiat gry. Klient tylko prosi o ruch ("move N"), serwer sprawdza
 * kolizje, tempo i portale, po czym rozsyla wynik graczom z tej samej mapy.
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
    private final GameNotifier notifier;
    private final GameProperties props;

    private final Map<String, MapInstance> instances = new ConcurrentHashMap<>();
    private final Map<Long, OnlinePlayer> online = new ConcurrentHashMap<>();
    private final Map<String, OnlinePlayer> bySession = new ConcurrentHashMap<>();

    public WorldService(ContentCache content, CharacterService characters, PlayerProgression progression,
                        QuestEngine quests, GameNotifier notifier, GameProperties props) {
        this.content = content;
        this.characters = characters;
        this.progression = progression;
        this.quests = quests;
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

        GameMap map = content.map(pc.getMapCode()).orElse(null);
        if (map == null || !map.inBounds(pc.getX(), pc.getY())) {
            map = startMap();
            place(p, map.getCode(), map.getSpawnX(), map.getSpawnY());
        } else {
            place(p, map.getCode(), pc.getX(), pc.getY());
        }
        online.put(p.characterId, p);
        bySession.put(session.getId(), p);
        MapInstance inst = instance(p.mapCode);
        inst.players.put(p.characterId, p);

        notifier.send(p, Msg.of("welcome",
                "title", props.title(),
                "you", progression.selfPayload(p),
                "map", mapPayload(map),
                "players", others(inst, p),
                "marks", quests.markers(p),
                "inventory", progression.inventoryPayload(p),
                "quests", quests.questLog(p)));
        notifier.broadcast(inst, Msg.of("join", "player", p.publicView()), p);
        notifier.system(p, "Połączono z " + props.title() + ". Graczy online: " + online.size() + ".");
        log.info("{} wchodzi do gry ({})", p.name, p.mapCode);
    }

    public void leave(WebSocketSession session) {
        OnlinePlayer p = bySession.remove(session.getId());
        if (p == null) {
            return;
        }
        online.remove(p.characterId, p);
        MapInstance inst = instances.get(p.mapCode);
        if (inst != null && inst.players.remove(p.characterId, p)) {
            notifier.broadcast(inst, Msg.of("leave", "id", p.characterId), p);
        }
        persistPosition(p);
        progression.persist(p);
        log.info("{} opuszcza gre", p.name);
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
            if (map == null || tooFast || !isWalkable(map, nx, ny)) {
                notifier.send(p, Msg.of("correct", "x", p.x, "y", p.y, "dir", dir.name(), "seq", seq));
                notifier.broadcast(instances.get(p.mapCode), Msg.of("face", "id", p.characterId, "dir", dir.name()), p);
                return;
            }
            p.x = nx;
            p.y = ny;
            p.lastMoveAtMs = now;
            p.positionDirty = true;
            portal = map.getPortals().stream().filter(pt -> pt.x() == nx && pt.y() == ny).findFirst().orElse(null);
        }
        notifier.broadcast(instances.get(p.mapCode), Msg.of("moved", "id", p.characterId, "x", p.x, "y", p.y,
                "dir", dir.name(), "ms", p.derived.moveDelayMs()), p);
        quests.onMoved(p);
        if (portal != null) {
            usePortal(p, portal);
        }
    }

    /** Czy na pole mozna wejsc - kafelki i NPC blokuja, gracze nie (jak w Margonem). */
    boolean isWalkable(GameMap map, int x, int y) {
        if (!map.inBounds(x, y) || content.isSolidTile(map, x, y)) {
            return false;
        }
        for (Npc npc : content.npcsOn(map.getCode())) {
            if (npc.getX() == x && npc.getY() == y) {
                return false;
            }
        }
        return true;
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
        MapInstance from = instances.get(p.mapCode);
        if (from != null && from.players.remove(p.characterId, p)) {
            notifier.broadcast(from, Msg.of("leave", "id", p.characterId), p);
        }
        synchronized (p) {
            place(p, target.getCode(), x, y);
            p.positionDirty = true;
        }
        MapInstance to = instance(target.getCode());
        to.players.put(p.characterId, p);
        notifier.send(p, Msg.of("enter",
                "you", progression.selfPayload(p),
                "map", mapPayload(target),
                "players", others(to, p),
                "marks", quests.markers(p)));
        notifier.broadcast(to, Msg.of("join", "player", p.publicView()), p);
        quests.onMoved(p);
    }

    private void face(OnlinePlayer p, Direction dir) {
        if (dir == null) {
            return;
        }
        p.dir = dir;
        notifier.broadcast(instances.get(p.mapCode), Msg.of("face", "id", p.characterId, "dir", dir.name()), p);
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
        notifier.broadcast(instances.get(p.mapCode),
                Msg.of("chat", "id", p.characterId, "from", p.name, "text", text), null);
    }

    private void command(OnlinePlayer p, String text) {
        String cmd = text.split("\\s+")[0].toLowerCase();
        switch (cmd) {
            case "/who" -> notifier.system(p, "Online (" + online.size() + "): "
                    + String.join(", ", online.values().stream().map(o -> o.name).sorted().toList()));
            case "/pos" -> notifier.system(p, p.mapCode + " [" + p.x + ", " + p.y + "]");
            case "/help" -> notifier.system(p, "Komendy: /who, /pos, /help. Rozmowa z NPC: podejdź i kliknij go lub wciśnij E.");
            default -> notifier.system(p, "Nieznana komenda. Spróbuj /help");
        }
    }

    private void talk(OnlinePlayer p, String npcCode) {
        Npc npc = nearbyNpc(p, npcCode);
        notifier.send(p, quests.talk(p, npc));
    }

    private void accept(OnlinePlayer p, String questCode, String npcCode) {
        quests.accept(p, questCode, nearbyNpc(p, npcCode));
    }

    private Npc nearbyNpc(OnlinePlayer p, String npcCode) {
        Npc npc = content.npc(npcCode).orElseThrow(() -> GameException.badRequest("Nie ma takiej osoby"));
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
        }
        notifier.system(p, "Użyto: " + used.getName() + (heal > 0 ? " (+" + heal + " HP)" : ""));
        refreshAfterInventory(p);
    }

    private void refreshAfterInventory(OnlinePlayer p) {
        boolean looksChanged = progression.recompute(p);
        progression.sendInventory(p);
        progression.sendSelf(p);
        if (looksChanged) {
            notifier.broadcast(instances.get(p.mapCode), Msg.of("update", "player", p.publicView()), p);
        }
        quests.onInventoryChanged(p);
    }

    // ------------------------------------------------------ edycja na zywo

    @EventListener
    public void onContentChanged(ContentChangedEvent event) {
        for (OnlinePlayer p : List.copyOf(online.values())) {
            notifier.send(p, Msg.of("content", "type", event.type().path(), "code", event.code()));
            GameMap map = content.map(p.mapCode).orElse(null);
            if (map == null || !map.inBounds(p.x, p.y)) {
                GameMap start = startMap();
                transfer(p, start, start.getSpawnX(), start.getSpawnY());
                continue;
            }
            switch (event.type()) {
                case MAPS, NPCS, QUESTS, TILES -> {
                    notifier.send(p, Msg.of("mapReload", "map", mapPayload(map), "marks", quests.markers(p)));
                    if (event.type() == pl.idiocracy.game.content.ContentType.QUESTS) {
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

    private void place(OnlinePlayer p, String mapCode, int x, int y) {
        p.mapCode = mapCode;
        p.x = x;
        p.y = y;
    }

    private MapInstance instance(String code) {
        return instances.computeIfAbsent(code, MapInstance::new);
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

    private Map<String, Object> mapPayload(GameMap map) {
        List<Map<String, Object>> npcs = content.npcsOn(map.getCode()).stream()
                .map(n -> Msg.of("npc", "code", n.getCode(), "name", n.getName(), "x", n.getX(), "y", n.getY(),
                        "app", n.getAppearance()))
                .toList();
        return Msg.of("map", "code", map.getCode(), "name", map.getName(), "width", map.getWidth(),
                "height", map.getHeight(), "ground", map.getLayers().ground(), "objects", map.getLayers().objects(),
                "portals", map.getPortals(), "spawn", Map.of("x", map.getSpawnX(), "y", map.getSpawnY()),
                "npcs", npcs);
    }
}
