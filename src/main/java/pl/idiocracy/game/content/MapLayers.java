package pl.idiocracy.game.content;

import java.util.List;

/** Warstwy mapy zapisane wierszami (index = y * width + x). Kody kafelkow, objects moze miec null. */
public record MapLayers(List<String> ground, List<String> objects) {
}
