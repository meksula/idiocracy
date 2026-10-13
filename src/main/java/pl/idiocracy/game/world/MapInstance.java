package pl.idiocracy.game.world;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Zywa instancja mapy - kto na niej teraz jest. */
class MapInstance {

    final String code;
    final Map<Long, OnlinePlayer> players = new ConcurrentHashMap<>();

    MapInstance(String code) {
        this.code = code;
    }

    Collection<OnlinePlayer> players() {
        return players.values();
    }
}
