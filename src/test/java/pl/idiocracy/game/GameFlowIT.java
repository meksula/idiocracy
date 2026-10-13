package pl.idiocracy.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Pelny przeplyw: rejestracja -> postac -> WebSocket -> ruch -> rozmowa -> misja.
 * Baza: TEST_DB_URL/TEST_DB_USER/TEST_DB_PASSWORD (np. lokalny Postgres) albo Testcontainers.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GameFlowIT {

    static PostgreSQLContainer<?> postgres;

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry) {
        String url = System.getenv("TEST_DB_URL");
        if (url != null) {
            registry.add("spring.datasource.url", () -> url);
            registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USER", "game"));
            registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", "game"));
            return;
        }
        org.junit.jupiter.api.Assumptions.assumeTrue(DockerClientFactory.instance().isDockerAvailable(),
                "Brak Dockera i TEST_DB_URL - pomijam test integracyjny");
        postgres = new PostgreSQLContainer<>("postgres:16");
        postgres.start();
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @LocalServerPort
    int port;
    @Autowired
    TestRestTemplate rest;
    @Autowired
    ObjectMapper mapper;

    @Test
    void playerCanJoinMoveAndTakeQuest() throws Exception {
        String email = "it-" + System.nanoTime() + "@test.pl";
        JsonNode session = rest.postForObject("/api/auth/register", Map.of("email", email, "password", "haslo123"), JsonNode.class);
        String token = session.get("token").asText();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        String name = "It" + (System.nanoTime() % 100000);
        JsonNode created = rest.exchange("/api/characters", HttpMethod.POST,
                new HttpEntity<>(Map.of("name", name, "race", "analogowiec", "clazz", "zlomiarz", "hair", "y"), h),
                JsonNode.class).getBody();
        long characterId = created.get("id").asLong();

        BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
        var container = jakarta.websocket.ContainerProvider.getWebSocketContainer();
        container.setDefaultMaxTextMessageBufferSize(1024 * 1024);
        WebSocketSession ws = new StandardWebSocketClient(container).execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession s, TextMessage message) throws Exception {
                inbox.add(mapper.readTree(message.getPayload()));
            }
        }, null, URI.create("ws://localhost:" + port + "/ws/game?token=" + token + "&character=" + characterId)).get(5, TimeUnit.SECONDS);

        JsonNode welcome = await(inbox, "welcome");
        assertThat(welcome.at("/map/code").asText()).isEqualTo("osada");
        assertThat(welcome.at("/you/name").asText()).isEqualTo(name);
        assertThat(welcome.get("inventory").toString()).contains("rura-stalowa");
        int x = welcome.at("/you/x").asInt();
        int y = welcome.at("/you/y").asInt();

        // spawn (20,17) -> soltys stoi na (18,13): idziemy 3 pola na polnoc
        for (int i = 0; i < 3; i++) {
            send(ws, Map.of("t", "move", "dir", "N", "seq", i));
            Thread.sleep(300);
        }
        assertThat(inbox.stream().noneMatch(m -> m.path("t").asText().equals("correct"))).isTrue();

        send(ws, Map.of("t", "talk", "npc", "soltys-zenon"));
        JsonNode dialog = await(inbox, "dialog");
        assertThat(dialog.get("offers").toString()).contains("pierwsze-mysli");

        send(ws, Map.of("t", "accept", "quest", "pierwsze-mysli", "npc", "soltys-zenon"));
        JsonNode quests = await(inbox, "quests");
        assertThat(quests.get("quests").toString()).contains("ACTIVE");

        // dwa kroki naraz: drugi za szybko i w terminal AI na (20,12) -> korekta serwera
        send(ws, Map.of("t", "move", "dir", "N", "seq", 99));
        send(ws, Map.of("t", "move", "dir", "N", "seq", 100));
        assertThat(await(inbox, "correct").get("y").asInt()).isEqualTo(y - 4);
        assertThat(x).isEqualTo(20);
        ws.close();
    }

    private void send(WebSocketSession ws, Object msg) throws Exception {
        ws.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
    }

    private static JsonNode await(BlockingQueue<JsonNode> inbox, String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode m = inbox.poll(200, TimeUnit.MILLISECONDS);
            if (m != null && type.equals(m.path("t").asText())) {
                return m;
            }
        }
        throw new AssertionError("Nie doczekano sie wiadomosci " + type);
    }
}
