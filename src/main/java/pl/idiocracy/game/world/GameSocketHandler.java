package pl.idiocracy.game.world;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class GameSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameSocketHandler.class);
    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int BUFFER_LIMIT = 1024 * 1024;

    private final WorldService world;
    private final ObjectMapper mapper;
    /** Oryginalna sesja -> bezpieczna watkowo dekoracja (wysylanie z wielu watkow). */
    private final Map<String, WebSocketSession> decorated = new ConcurrentHashMap<>();

    public GameSocketHandler(WorldService world, ObjectMapper mapper) {
        this.world = world;
        this.mapper = mapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_LIMIT);
        decorated.put(session.getId(), safe);
        long accountId = (Long) session.getAttributes().get(GameHandshakeInterceptor.ACCOUNT);
        long characterId = (Long) session.getAttributes().get(GameHandshakeInterceptor.CHARACTER);
        try {
            world.join(safe, accountId, characterId);
        } catch (RuntimeException e) {
            log.warn("Nie udalo sie wejsc do gry: {}", e.getMessage());
            closeQuietly(safe);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        WebSocketSession safe = decorated.get(session.getId());
        if (safe == null || message.getPayloadLength() > 4096) {
            return;
        }
        try {
            JsonNode node = mapper.readTree(message.getPayload());
            world.handle(safe, node);
        } catch (Exception e) {
            log.debug("Bledna wiadomosc od {}: {}", session.getId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        WebSocketSession safe = decorated.remove(session.getId());
        if (safe != null) {
            world.leave(safe);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("Blad transportu {}: {}", session.getId(), exception.getMessage());
    }

    private static void closeQuietly(WebSocketSession s) {
        try {
            s.close(CloseStatus.SERVER_ERROR);
        } catch (Exception ignored) {
            // nic
        }
    }
}
