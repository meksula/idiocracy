package pl.idiocracy.game.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import pl.idiocracy.game.world.GameHandshakeInterceptor;
import pl.idiocracy.game.world.GameSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameSocketHandler handler;
    private final GameHandshakeInterceptor interceptor;

    public WebSocketConfig(GameSocketHandler handler, GameHandshakeInterceptor interceptor) {
        this.handler = handler;
        this.interceptor = interceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/game")
                .addInterceptors(interceptor)
                .setAllowedOriginPatterns("*");
    }
}
