package pl.idiocracy.game.world;

import java.util.LinkedHashMap;
import java.util.Map;

/** Male narzedzie do budowania wiadomosci protokolu: Msg.of("move", "x", 1, "y", 2). */
public final class Msg {

    private Msg() {
    }

    public static Map<String, Object> of(String type, Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("t", type);
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }
}
