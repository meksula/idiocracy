package pl.idiocracy.game.world;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Zywa instancja mapy: gracze i potwory. Mapy instancjonowane (np. mieszkanie)
 * maja osobna instancje dla kazdego gracza.
 */
class MapInstance {

    record PendingRespawn(int spawnIndex, long atMs) {
    }

    final String key;
    final String mapCode;
    final Map<Long, OnlinePlayer> players = new ConcurrentHashMap<>();
    final Map<Long, Monster> monsters = new ConcurrentHashMap<>();
    /** Dostep pod synchronized(this). */
    final List<PendingRespawn> respawns = new ArrayList<>();
    boolean spawned;

    MapInstance(String key, String mapCode) {
        this.key = key;
        this.mapCode = mapCode;
    }

    Collection<OnlinePlayer> players() {
        return players.values();
    }

    Monster monsterAt(int x, int y) {
        for (Monster m : monsters.values()) {
            if (m.x == x && m.y == y) {
                return m;
            }
        }
        return null;
    }

    boolean playerAt(int x, int y) {
        for (OnlinePlayer p : players.values()) {
            if (p.x == x && p.y == y) {
                return true;
            }
        }
        return false;
    }

    /** Usuwa potwory i planuje odrodzenie od nowa (np. po edycji spawnow w edytorze). */
    synchronized void resetMonsters() {
        monsters.clear();
        respawns.clear();
        spawned = false;
    }
}
