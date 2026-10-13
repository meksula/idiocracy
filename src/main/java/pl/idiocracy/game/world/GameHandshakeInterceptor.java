package pl.idiocracy.game.world;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import pl.idiocracy.game.auth.AuthPrincipal;
import pl.idiocracy.game.auth.JwtService;
import pl.idiocracy.game.character.PlayerCharacterRepository;

/** ws://host/ws/game?token=JWT&character=ID - weryfikacja przed otwarciem gniazda. */
@Component
public class GameHandshakeInterceptor implements HandshakeInterceptor {

    static final String ACCOUNT = "accountId";
    static final String CHARACTER = "characterId";

    private final JwtService jwt;
    private final PlayerCharacterRepository characters;

    public GameHandshakeInterceptor(JwtService jwt, PlayerCharacterRepository characters) {
        this.jwt = jwt;
        this.characters = characters;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
                                   Map<String, Object> attributes) {
        var params = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        AuthPrincipal principal = jwt.parse(params.getFirst("token")).orElse(null);
        long characterId;
        try {
            characterId = Long.parseLong(params.getFirst("character"));
        } catch (NumberFormatException e) {
            characterId = -1;
        }
        if (principal == null || characters.findByIdAndAccountId(characterId, principal.accountId()).isEmpty()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        attributes.put(ACCOUNT, principal.accountId());
        attributes.put(CHARACTER, characterId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
                               Exception exception) {
        // nic
    }
}
