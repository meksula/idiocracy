package pl.idiocracy.game.content;

/** Obszar mapy (x, y, w, h), w ktorym zyje count potworow danego typu. */
public record MonsterSpawn(String monster, int x, int y, int w, int h, int count) {

    public boolean contains(int px, int py) {
        return px >= x && py >= y && px < x + w && py < y + h;
    }
}
