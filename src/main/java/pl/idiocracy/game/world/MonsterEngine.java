package pl.idiocracy.game.world;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

import pl.idiocracy.game.content.ContentCache;
import pl.idiocracy.game.content.GameMap;
import pl.idiocracy.game.content.MonsterSpawn;
import pl.idiocracy.game.content.MonsterTemplate;
import pl.idiocracy.game.content.Npc;

/**
 * Jeden krok symulacji instancji mapy: odradzanie potworow, ich AI (wedrowka, agresja,
 * poscig, atak), automatyczne ataki graczy na wybrany cel i regeneracja HP.
 * Wszystko pod blokada instancji; operacje bazodanowe (nagrody) wykonuje wolajacy
 * na podstawie zwroconego wyniku, juz poza blokada.
 */
@Component
public class MonsterEngine {

    /** Jak daleko od swojego obszaru potwor da sie odciagnac, zanim zrezygnuje z poscigu. */
    private static final int LEASH = 8;
    private static final long REGEN_EVERY_MS = 3_000;
    private static final long REGEN_AFTER_HIT_MS = 6_000;
    private static final AtomicLong IDS = new AtomicLong();

    record Kill(OnlinePlayer killer, MonsterTemplate monster) {
    }

    record Outcome(List<Kill> kills, List<OnlinePlayer> deaths) {
    }

    private final ContentCache content;
    private final GameNotifier notifier;

    public MonsterEngine(ContentCache content, GameNotifier notifier) {
        this.content = content;
        this.notifier = notifier;
    }

    Outcome tick(MapInstance inst, GameMap map, long now) {
        List<Kill> kills = new ArrayList<>();
        List<OnlinePlayer> deaths = new ArrayList<>();
        synchronized (inst) {
            spawn(inst, map, now);
            for (Monster m : List.copyOf(inst.monsters.values())) {
                think(inst, map, m, now, deaths);
            }
            for (OnlinePlayer p : inst.players()) {
                if (!deaths.contains(p)) {
                    playerAttack(inst, map, p, now, kills);
                    regen(p, now);
                }
            }
        }
        return new Outcome(kills, deaths);
    }

    // ------------------------------------------------------------- odradzanie

    private void spawn(MapInstance inst, GameMap map, long now) {
        List<MonsterSpawn> spawns = map.getSpawns();
        if (!inst.spawned) {
            inst.spawned = true;
            for (int i = 0; i < spawns.size(); i++) {
                for (int k = 0; k < spawns.get(i).count(); k++) {
                    inst.respawns.add(new MapInstance.PendingRespawn(i, now));
                }
            }
        }
        var it = inst.respawns.iterator();
        while (it.hasNext()) {
            var pending = it.next();
            if (pending.atMs() > now) {
                continue;
            }
            if (pending.spawnIndex() >= spawns.size()) {
                it.remove();
                continue;
            }
            MonsterSpawn sp = spawns.get(pending.spawnIndex());
            MonsterTemplate tpl = content.monster(sp.monster()).orElse(null);
            if (tpl == null) {
                it.remove();
                continue;
            }
            int[] pos = freeTileIn(inst, map, sp);
            if (pos == null) {
                continue; // sprobujemy w nastepnym ticku
            }
            it.remove();
            Monster m = new Monster(IDS.incrementAndGet(), tpl, pending.spawnIndex(), pos[0], pos[1]);
            m.dir = ThreadLocalRandom.current().nextBoolean() ? Direction.E : Direction.W;
            m.lastMoveAtMs = now;
            inst.monsters.put(m.id, m);
            notifier.broadcast(inst, Msg.of("mspawn", "monster", m.view()), null);
        }
    }

    private int[] freeTileIn(MapInstance inst, GameMap map, MonsterSpawn sp) {
        var rnd = ThreadLocalRandom.current();
        for (int i = 0; i < 30; i++) {
            int x = sp.x() + rnd.nextInt(sp.w());
            int y = sp.y() + rnd.nextInt(sp.h());
            if (canEnter(inst, map, x, y)) {
                return new int[] {x, y};
            }
        }
        return null;
    }

    // --------------------------------------------------------------------- AI

    private void think(MapInstance inst, GameMap map, Monster m, long now, List<OnlinePlayer> deaths) {
        MonsterTemplate tpl = m.tpl;
        MonsterSpawn home = m.spawnIndex < map.getSpawns().size() ? map.getSpawns().get(m.spawnIndex) : null;
        OnlinePlayer target = m.targetId == null ? null : inst.players.get(m.targetId);
        if (target != null && (target.hp <= 0 || deaths.contains(target)
                || dist(m.x, m.y, target.x, target.y) > tpl.getAggroRange() + LEASH
                || (home != null && distToArea(m.x, m.y, home) > LEASH))) {
            target = null;
            m.targetId = null;
        }
        if (target == null && tpl.isAggressive()) {
            target = nearestPlayer(inst, m, tpl.getAggroRange());
            if (target != null) {
                m.targetId = target.characterId;
                m.lastAttackAtMs = Math.max(m.lastAttackAtMs, now - tpl.getAttackDelayMs() / 2);
            }
        }
        if (target != null) {
            if (dist(m.x, m.y, target.x, target.y) <= 1) {
                faceTowards(m, target.x);
                if (now - m.lastAttackAtMs >= tpl.getAttackDelayMs()) {
                    m.lastAttackAtMs = now;
                    hitPlayer(inst, m, target, now, deaths);
                }
            } else if (now - m.lastMoveAtMs >= tpl.getMoveDelayMs()) {
                stepTowards(inst, map, m, target.x, target.y, now);
            }
        } else if (now - m.lastMoveAtMs >= tpl.getMoveDelayMs() * 2L
                && ThreadLocalRandom.current().nextDouble() < 0.25) {
            wander(inst, map, m, home, now);
        }
    }

    private void hitPlayer(MapInstance inst, Monster m, OnlinePlayer p, long now, List<OnlinePlayer> deaths) {
        int dmg = damage(m.tpl.getAttack(), p.derived.defense());
        int hp;
        synchronized (p) {
            p.hp = Math.max(0, p.hp - dmg);
            p.lastHitAtMs = now;
            p.positionDirty = true;
            hp = p.hp;
        }
        notifier.broadcast(inst, Msg.of("hit", "kind", "p", "id", p.characterId, "dmg", dmg, "hp", hp,
                "maxHp", p.derived.maxHp(), "from", m.id), null);
        if (hp <= 0) {
            deaths.add(p);
            for (Monster other : inst.monsters.values()) {
                if (p.characterId == (other.targetId == null ? -1 : other.targetId)) {
                    other.targetId = null;
                }
            }
        }
    }

    private void stepTowards(MapInstance inst, GameMap map, Monster m, int tx, int ty, long now) {
        int dx = Integer.signum(tx - m.x);
        int dy = Integer.signum(ty - m.y);
        List<Direction> options = new ArrayList<>(4);
        Direction horizontal = dx > 0 ? Direction.E : dx < 0 ? Direction.W : null;
        Direction vertical = dy > 0 ? Direction.S : dy < 0 ? Direction.N : null;
        if (Math.abs(tx - m.x) >= Math.abs(ty - m.y)) {
            addIf(options, horizontal);
            addIf(options, vertical);
        } else {
            addIf(options, vertical);
            addIf(options, horizontal);
        }
        if (vertical == null) {
            options.add(Direction.N);
            options.add(Direction.S);
        }
        if (horizontal == null) {
            options.add(Direction.E);
            options.add(Direction.W);
        }
        for (Direction d : options) {
            if (canEnter(inst, map, m.x + d.dx, m.y + d.dy)) {
                move(inst, m, d, now);
                return;
            }
        }
    }

    private void wander(MapInstance inst, GameMap map, Monster m, MonsterSpawn home, long now) {
        Direction d = Direction.values()[ThreadLocalRandom.current().nextInt(4)];
        int nx = m.x + d.dx;
        int ny = m.y + d.dy;
        boolean insideHome = home == null || distToArea(nx, ny, home) <= 1;
        if (insideHome && canEnter(inst, map, nx, ny)) {
            move(inst, m, d, now);
        } else {
            m.lastMoveAtMs = now;
        }
    }

    private void move(MapInstance inst, Monster m, Direction d, long now) {
        m.x += d.dx;
        m.y += d.dy;
        if (d == Direction.E || d == Direction.W) {
            m.dir = d;
        }
        m.lastMoveAtMs = now;
        notifier.broadcast(inst, Msg.of("mmove", "id", m.id, "x", m.x, "y", m.y, "dir", m.dir.name(),
                "ms", m.tpl.getMoveDelayMs()), null);
    }

    // -------------------------------------------------------------- gracze

    private void playerAttack(MapInstance inst, GameMap map, OnlinePlayer p, long now, List<Kill> kills) {
        Long targetId = p.targetMonsterId;
        if (targetId == null) {
            return;
        }
        Monster m = inst.monsters.get(targetId);
        if (m == null) {
            p.targetMonsterId = null;
            notifier.send(p, Msg.of("target", "id", null));
            return;
        }
        if (dist(p.x, p.y, m.x, m.y) > 1 || now - p.lastAttackAtMs < p.derived.attackDelayMs() || p.hp <= 0) {
            return;
        }
        p.lastAttackAtMs = now;
        p.lastHitAtMs = Math.max(p.lastHitAtMs, now - REGEN_AFTER_HIT_MS / 2);
        int dmg = damage(p.derived.attack(), m.tpl.getDefense());
        m.hp = Math.max(0, m.hp - dmg);
        m.targetId = p.characterId;
        notifier.broadcast(inst, Msg.of("hit", "kind", "m", "id", m.id, "dmg", dmg, "hp", m.hp,
                "maxHp", m.tpl.getMaxHp(), "from", p.characterId), null);
        if (m.hp > 0) {
            return;
        }
        inst.monsters.remove(m.id);
        inst.respawns.add(new MapInstance.PendingRespawn(m.spawnIndex, now + m.tpl.getRespawnSec() * 1000L));
        notifier.broadcast(inst, Msg.of("mdie", "id", m.id, "by", p.characterId), null);
        for (OnlinePlayer other : inst.players()) {
            if (m.id == (other.targetMonsterId == null ? -1 : other.targetMonsterId)) {
                other.targetMonsterId = null;
            }
        }
        kills.add(new Kill(p, m.tpl));
    }

    private void regen(OnlinePlayer p, long now) {
        if (p.hp <= 0 || p.hp >= p.derived.maxHp() || now - p.lastHitAtMs < REGEN_AFTER_HIT_MS
                || now - p.lastRegenAtMs < REGEN_EVERY_MS) {
            return;
        }
        int hp;
        synchronized (p) {
            p.lastRegenAtMs = now;
            p.hp = Math.min(p.derived.maxHp(), p.hp + Math.max(1, p.derived.maxHp() / 20));
            p.positionDirty = true;
            hp = p.hp;
        }
        notifier.send(p, Msg.of("hp", "hp", hp, "maxHp", p.derived.maxHp()));
    }

    // --------------------------------------------------------------- pomocnicze

    /** Atak + losowe do 50% - polowa obrony przeciwnika, zawsze co najmniej 1. */
    static int damage(int attack, int defense) {
        int roll = attack + ThreadLocalRandom.current().nextInt(Math.max(1, attack / 2 + 1));
        return Math.max(1, roll - defense / 2);
    }

    boolean canEnter(MapInstance inst, GameMap map, int x, int y) {
        if (!map.inBounds(x, y) || content.isSolidTile(map, x, y)) {
            return false;
        }
        for (Npc n : content.npcsOn(map.getCode())) {
            if (n.getX() == x && n.getY() == y) {
                return false;
            }
        }
        return inst.monsterAt(x, y) == null && !inst.playerAt(x, y);
    }

    private OnlinePlayer nearestPlayer(MapInstance inst, Monster m, int range) {
        OnlinePlayer best = null;
        int bestDist = Integer.MAX_VALUE;
        for (OnlinePlayer p : inst.players()) {
            int d = dist(m.x, m.y, p.x, p.y);
            if (p.hp > 0 && d <= range && d < bestDist) {
                best = p;
                bestDist = d;
            }
        }
        return best;
    }

    private static void faceTowards(Monster m, int tx) {
        if (tx > m.x) {
            m.dir = Direction.E;
        } else if (tx < m.x) {
            m.dir = Direction.W;
        }
    }

    private static void addIf(List<Direction> list, Direction d) {
        if (d != null) {
            list.add(d);
        }
    }

    /** Odleglosc Czebyszewa - sasiedztwo po skosie tez liczy sie jako 1. */
    static int dist(int x1, int y1, int x2, int y2) {
        return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
    }

    private static int distToArea(int x, int y, MonsterSpawn a) {
        int dx = x < a.x() ? a.x() - x : x >= a.x() + a.w() ? x - (a.x() + a.w() - 1) : 0;
        int dy = y < a.y() ? a.y() - y : y >= a.y() + a.h() ? y - (a.y() + a.h() - 1) : 0;
        return Math.max(dx, dy);
    }

    static List<Map<String, Object>> views(MapInstance inst) {
        return inst.monsters.values().stream().map(Monster::view).toList();
    }
}
