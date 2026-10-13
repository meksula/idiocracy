package pl.idiocracy.game.world;

public enum Direction {
    N(0, -1),
    S(0, 1),
    E(1, 0),
    W(-1, 0);

    public final int dx;
    public final int dy;

    Direction(int dx, int dy) {
        this.dx = dx;
        this.dy = dy;
    }

    public static Direction parse(String s) {
        if (s == null) {
            return null;
        }
        try {
            return valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
