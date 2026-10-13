package pl.idiocracy.game.content;

import java.util.List;

public record QuestRewards(long ccoin, long xp, List<ItemStack> items) {

    public List<ItemStack> itemsOrEmpty() {
        return items == null ? List.of() : items;
    }
}
