package pl.idiocracy.game.character;

import java.util.Collection;

import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.Stats;

/** Czysta logika statystyk - latwa do testowania i do podmiany przy balansie. */
public final class StatsCalculator {

    private StatsCalculator() {
    }

    public record Derived(Stats attributes, int maxHp, int attack, int defense, int moveDelayMs, int attackDelayMs) {
    }

    public static Derived derive(Stats race, Stats clazz, int level, Collection<ItemTemplate> equipped,
                                 int baseMoveDelayMs) {
        int lvl = Math.max(1, level) - 1;
        Stats attrs = race.plus(clazz).plus(new Stats(lvl, lvl, lvl, lvl));
        int attack = 0;
        int defense = 0;
        for (ItemTemplate item : equipped) {
            attrs = attrs.plus(item.getStats().attributes());
            attack += item.getStats().attack();
            defense += item.getStats().defense();
        }
        int maxHp = 40 + attrs.vitality() * 6 + level * 4;
        int moveDelay = clamp(baseMoveDelayMs - attrs.agility() * 4, 150, 450);
        int attackDelay = clamp(1300 - attrs.agility() * 15, 600, 1800);
        return new Derived(attrs, maxHp, attack + attrs.strength() / 2, defense, moveDelay, attackDelay);
    }

    /** Ile XP trzeba zebrac na obecnym poziomie, zeby awansowac. */
    public static long xpToNext(int level) {
        return 100L * level * level;
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
