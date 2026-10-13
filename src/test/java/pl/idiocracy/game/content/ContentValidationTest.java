package pl.idiocracy.game.content;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;

class ContentValidationTest {

    @Test
    void spriteRowsMustMatchSize() {
        Sprite ok = new Sprite(2, 2, List.of(List.of("0.", ".0")));
        Sprite bad = new Sprite(2, 2, List.of(List.of("0..", ".0")));
        assertThatCode(ok::validate).doesNotThrowAnyException();
        assertThatThrownBy(bad::validate).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void mapLayersMustCoverWholeMap() {
        GameMap map = new GameMap();
        map.setCode("test");
        map.setWidth(5);
        map.setHeight(5);
        map.setLayers(new MapLayers(Collections.nCopies(25, "dirt"), Collections.nCopies(24, null)));
        assertThatThrownBy(map::validate).hasMessageContaining("zły rozmiar");

        map.setLayers(new MapLayers(Collections.nCopies(25, "dirt"), Collections.nCopies(25, null)));
        map.setSpawnX(2);
        map.setSpawnY(2);
        assertThatCode(map::validate).doesNotThrowAnyException();
    }

    @Test
    void codesAreSlugs() {
        Race r = new Race();
        r.setCode("Zła Rasa!");
        assertThatThrownBy(r::validate).isInstanceOf(IllegalArgumentException.class);
    }
}
