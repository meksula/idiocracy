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
        assertThat(welcome.at("/map/code").asText()).isEqualTo("dom");
        assertThat(welcome.at("/you/name").asText()).isEqualTo(name);
        assertThat(welcome.get("inventory").toString()).contains("rura-stalowa");
        assertThat(welcome.get("quests").toString()).contains("cisza-po-burzy");
        JsonNode intro = await(inbox, "dialog");
        assertThat(intro.get("lines").toString()).contains("Od burzy");

        // mieszkanie: (2,3) -> drzwi (6,8) -> podworze
        walk(ws, "E", 4);
        walk(ws, "S", 5);
        JsonNode enter = await(inbox, "enter");
        assertThat(enter.at("/map/code").asText()).isEqualTo("podworze");
        assertThat(enter.at("/map/npcs").toString()).contains("nieznajomy");
        assertThat(enter.at("/you/x").asInt()).isEqualTo(8);
        assertThat(await(inbox, "inventory").toString()).contains("noz-kuchenny");

        // podejdz do nieznajomego (13,10) na (11,9)
        walk(ws, "E", 3);
        walk(ws, "S", 4);
        assertThat(inbox.stream().noneMatch(m -> m.path("t").asText().equals("correct"))).isTrue();
        inbox.removeIf(m -> m.path("t").asText().equals("npcs") || m.path("t").asText().equals("quests"));
        send(ws, Map.of("t", "talk", "npc", "nieznajomy"));
        JsonNode dialog = await(inbox, "dialog");
        assertThat(dialog.get("lines").toString()).contains("Nie podchodź");
        JsonNode npcs = await(inbox, "npcs");
        assertThat(npcs.get("npcs").toString()).doesNotContain("nieznajomy").contains("foxy").contains("arrive");
        JsonNode foxy = null;
        for (JsonNode n : npcs.get("npcs")) {
            if (n.path("code").asText().equals("foxy")) {
                foxy = n;
            }
        }
        // Foxy podbiega do gracza (11,9) i sama zagaduje
        assertThat(Math.max(Math.abs(foxy.get("x").asInt() - 11), Math.abs(foxy.get("y").asInt() - 9))).isEqualTo(1);
        assertThat(foxy.get("autoTalk").asBoolean()).isTrue();
        inbox.removeIf(m -> m.path("t").asText().equals("inventory") || m.path("t").asText().equals("quests"));
        send(ws, Map.of("t", "talk", "npc", "foxy"));
        assertThat(await(inbox, "dialog").get("lines").toString()).contains("histerię");
        assertThat(await(inbox, "inventory").toString()).contains("maczeta");
        assertThat(await(inbox, "quests").toString()).contains("KILL");

        // dwa kroki naraz: drugi za szybko -> korekta serwera
        send(ws, Map.of("t", "move", "dir", "N", "seq", 99));
        send(ws, Map.of("t", "move", "dir", "N", "seq", 100));
        assertThat(await(inbox, "correct").get("seq").asInt()).isEqualTo(100);
        ws.close();
    }

    private void walk(WebSocketSession ws, String dir, int steps) throws Exception {
        for (int i = 0; i < steps; i++) {
            send(ws, Map.of("t", "move", "dir", dir, "seq", i));
            Thread.sleep(300);
        }
    }

    private void send(WebSocketSession ws, Object msg) throws Exception {
        ws.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
    }

    /** Czeka na najblizsza wiadomosc danego typu; pozostale zostaja w kolejce. */
    private static JsonNode await(BlockingQueue<JsonNode> inbox, String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            for (JsonNode m : inbox) {
                if (type.equals(m.path("t").asText())) {
                    inbox.remove(m);
                    return m;
                }
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Nie doczekano sie wiadomosci " + type);
    }
}
