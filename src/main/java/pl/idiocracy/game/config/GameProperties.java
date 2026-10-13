package pl.idiocracy.game.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "game")
public record GameProperties(
        String title,
        String jwtSecret,
        int jwtTtlHours,
        List<String> adminEmails,
        boolean firstAccountAdmin,
        int maxCharactersPerAccount,
        long startingCcoin,
        String startMap,
        int baseMoveDelayMs,
        long saveIntervalMs) {

    public GameProperties {
        adminEmails = adminEmails == null ? List.of() : adminEmails.stream()
                .map(String::trim).filter(s -> !s.isEmpty()).map(String::toLowerCase).toList();
    }
}
