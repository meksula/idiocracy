package pl.idiocracy.game.content;

/** Bonusy przedmiotu. attack/defense/heal przydadza sie przy systemie walki. */
public record ItemStats(int strength, int agility, int vitality, int intellect, int attack, int defense, int heal) {

    public static final ItemStats NONE = new ItemStats(0, 0, 0, 0, 0, 0, 0);

    public Stats attributes() {
        return new Stats(strength, agility, vitality, intellect);
    }
}
