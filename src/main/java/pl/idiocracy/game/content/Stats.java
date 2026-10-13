package pl.idiocracy.game.content;

/**
 * Cztery atrybuty postaci. Intelekt jest w 2074 towarem deficytowym -
 * dlatego to on bedzie napedzal "magie" (wiedze) i dialogi.
 */
public record Stats(int strength, int agility, int vitality, int intellect) {

    public static final Stats ZERO = new Stats(0, 0, 0, 0);

    public Stats plus(Stats o) {
        if (o == null) {
            return this;
        }
        return new Stats(strength + o.strength, agility + o.agility, vitality + o.vitality, intellect + o.intellect);
    }
}
