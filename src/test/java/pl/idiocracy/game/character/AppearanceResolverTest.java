package pl.idiocracy.game.character;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import pl.idiocracy.game.content.Appearance;
import pl.idiocracy.game.content.CharacterClass;
import pl.idiocracy.game.content.EquipSlot;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.ItemType;
import pl.idiocracy.game.content.Race;

class AppearanceResolverTest {

    @Test
    void layersCharacterRaceClassAndWornItems() {
        Race race = new Race();
        race.setAppearance(new Appearance("e", "G", "l", null, null, null));
        CharacterClass clazz = new CharacterClass();
        clazz.setAppearance(new Appearance(null, null, null, "B", "2", "b"));
        ItemTemplate vest = new ItemTemplate();
        vest.setType(ItemType.ARMOR);
        vest.setSlot(EquipSlot.BODY);
        vest.setWearColor("O");

        Appearance a = AppearanceResolver.resolve(new Appearance(null, "y", null, null, null, null), race, clazz, List.of(vest));

        assertThat(a).isEqualTo(new Appearance("e", "y", "l", "O", "2", "b"));
    }
}
