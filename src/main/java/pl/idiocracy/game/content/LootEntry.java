package pl.idiocracy.game.content;

/** Szansa (0-100%) na wypadniecie od min do max sztuk przedmiotu. */
public record LootEntry(String code, double chance, int min, int max) {
}
