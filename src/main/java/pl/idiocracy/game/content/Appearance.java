package pl.idiocracy.game.content;

/**
 * Kolory (klucze palety) skladane w proceduralny sprite postaci.
 * Pola null sa uzupelniane z kolejnej warstwy: postac -> klasa -> rasa.
 */
public record Appearance(String skin, String hair, String eyes, String primary, String secondary, String feet) {

    public static final Appearance EMPTY = new Appearance(null, null, null, null, null, null);

    /** Wartosci z this maja pierwszenstwo, brakujace bierzemy z fallback. */
    public Appearance orElse(Appearance fb) {
        if (fb == null) {
            return this;
        }
        return new Appearance(
                pick(skin, fb.skin), pick(hair, fb.hair), pick(eyes, fb.eyes),
                pick(primary, fb.primary), pick(secondary, fb.secondary), pick(feet, fb.feet));
    }

    private static String pick(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }
}
