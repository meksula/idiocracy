package pl.idiocracy.game.content;

/** Publikowany po kazdym zapisie/usunieciu w edytorze - swiat gry przeladowuje sie na zywo. */
public record ContentChangedEvent(ContentType type, String code) {
}
