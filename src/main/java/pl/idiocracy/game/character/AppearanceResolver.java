package pl.idiocracy.game.character;

import java.util.Collection;

import pl.idiocracy.game.content.Appearance;
import pl.idiocracy.game.content.CharacterClass;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.Race;

/** Sklada wyglad: postac (fryzura) -> rasa (skora, oczy) -> klasa (stroj) -> zalozone przedmioty. */
public final class AppearanceResolver {

    private static final Appearance DEFAULT = new Appearance("s", "B", "0", "4", "2", "1");

    private AppearanceResolver() {
    }

    public static Appearance resolve(Appearance own, Race race, CharacterClass clazz,
                                     Collection<ItemTemplate> equipped) {
        Appearance a = (own == null ? Appearance.EMPTY : own)
                .orElse(race == null ? null : race.getAppearance())
                .orElse(clazz == null ? null : clazz.getAppearance())
                .orElse(DEFAULT);
        for (ItemTemplate item : equipped) {
            if (item.getWearColor() == null || item.getSlot() == null) {
                continue;
            }
            String c = item.getWearColor();
            a = switch (item.getSlot()) {
                case HEAD -> new Appearance(a.skin(), c, a.eyes(), a.primary(), a.secondary(), a.feet());
                case BODY -> new Appearance(a.skin(), a.hair(), a.eyes(), c, a.secondary(), a.feet());
                case LEGS -> new Appearance(a.skin(), a.hair(), a.eyes(), a.primary(), c, a.feet());
                case FEET -> new Appearance(a.skin(), a.hair(), a.eyes(), a.primary(), a.secondary(), c);
                default -> a;
            };
        }
        return a;
    }
}
