package pl.idiocracy.game.world;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class GameNotifier {

    private static final Logger log = LoggerFactory.getLogger(GameNotifier.class);

    private final ObjectMapper mapper;

    public GameNotifier(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public void send(OnlinePlayer p, Object payload) {
        send(p, serialize(payload));
    }

    void broadcast(MapInstance instance, Object payload, OnlinePlayer except) {
        if (instance == null) {
            return;
        }
        TextMessage msg = serialize(payload);
        for (OnlinePlayer p : instance.players()) {
            if (p != except) {
                send(p, msg);
            }
        }
    }

    public void system(OnlinePlayer p, String text) {
        send(p, Msg.of("system", "text", text));
    }

    private void send(OnlinePlayer p, TextMessage msg) {
        if (!p.session.isOpen()) {
            return;
        }
        try {
            p.session.sendMessage(msg);
        } catch (IOException | IllegalStateException e) {
            log.debug("Nie udalo sie wyslac do {}: {}", p.name, e.getMessage());
        }
    }

    private TextMessage serialize(Object payload) {
        try {
            return new TextMessage(mapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
