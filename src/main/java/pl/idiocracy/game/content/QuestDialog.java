package pl.idiocracy.game.content;

/** offer - propozycja misji, progress - gdy gracz wraca w trakcie, complete - po odebraniu nagrody. */
public record QuestDialog(String offer, String progress, String complete) {
}
