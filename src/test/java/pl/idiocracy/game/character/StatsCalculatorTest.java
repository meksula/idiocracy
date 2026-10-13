package pl.idiocracy.game.character;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import pl.idiocracy.game.content.EquipSlot;
import pl.idiocracy.game.content.ItemStats;
import pl.idiocracy.game.content.ItemTemplate;
import pl.idiocracy.game.content.ItemType;
import pl.idiocracy.game.content.Stats;

class StatsCalculatorTest {

    @Test
    void sumsRaceClassLevelAndEquipment() {
        ItemTemplate pipe = new ItemTemplate();
        pipe.setType(ItemType.WEAPON);
        pipe.setSlot(EquipSlot.WEAPON);
        pipe.setStats(new ItemStats(1, 0, 0, 0, 4, 0, 0));

        var d = StatsCalculator.derive(new Stats(4, 5, 5, 8), new Stats(3, 0, 2, 0), 3, List.of(pipe), 260);

        assertThat(d.attributes()).isEqualTo(new Stats(10, 7, 9, 10));
        assertThat(d.maxHp()).isEqualTo(40 + 9 * 6 + 3 * 4);
        assertThat(d.attack()).isEqualTo(4 + 10 / 2);
        assertThat(d.moveDelayMs()).isEqualTo(260 - 7 * 4);
    }

    @Test
    void moveDelayIsClamped() {
        var fast = StatsCalculator.derive(new Stats(0, 500, 0, 0), Stats.ZERO, 1, List.of(), 260);
        var slow = StatsCalculator.derive(new Stats(0, -500, 0, 0), Stats.ZERO, 1, List.of(), 260);
        assertThat(fast.moveDelayMs()).isEqualTo(150);
        assertThat(slow.moveDelayMs()).isEqualTo(450);
    }

    @Test
    void xpCurveGrowsQuadratically() {
        assertThat(StatsCalculator.xpToNext(1)).isEqualTo(100);
        assertThat(StatsCalculator.xpToNext(2)).isEqualTo(400);
    }
}
