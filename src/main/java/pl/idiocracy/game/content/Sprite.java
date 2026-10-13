package pl.idiocracy.game.content;

import java.util.List;

/**
 * Pixel-art w formacie tekstowym. Kazdy znak to klucz z palety (static/js/palette.js),
 * '.' = przezroczystosc. frames pozwala na proste animacje.
 */
public record Sprite(int w, int h, List<List<String>> frames) {

    public void validate() {
        if (w <= 0 || h <= 0 || w > 64 || h > 64) {
            throw new IllegalArgumentException("Nieprawidłowy rozmiar sprite'a");
        }
        if (frames == null || frames.isEmpty()) {
            throw new IllegalArgumentException("Sprite musi mieć co najmniej jedną klatkę");
        }
        for (List<String> rows : frames) {
            if (rows.size() != h || rows.stream().anyMatch(r -> r.length() != w)) {
                throw new IllegalArgumentException("Klatka sprite'a ma zły rozmiar (oczekiwano " + w + "x" + h + ")");
            }
        }
    }
}
