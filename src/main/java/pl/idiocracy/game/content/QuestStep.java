package pl.idiocracy.game.content;

/**
 * Krok misji.
 * TALK    - porozmawiaj z NPC (target = kod NPC), dialog = co NPC powie
 * VISIT   - dotrzyj w miejsce (target = kod mapy, x/y/radius)
 * COLLECT - posiadaj count sztuk przedmiotu (target = kod przedmiotu), consume = zabierz przy zaliczeniu
 * KILL    - pokonaj count przeciwnikow (target = kod potwora)
 * give    - przedmioty wreczane graczowi po zaliczeniu kroku (opcjonalne)
 */
public record QuestStep(
        QuestStepType type,
        String target,
        Integer x,
        Integer y,
        Integer radius,
        Integer count,
        Boolean consume,
        String text,
        String dialog,
        java.util.List<ItemStack> give) {

    public java.util.List<ItemStack> giveOrEmpty() {
        return give == null ? java.util.List.of() : give;
    }

    public int countOrOne() {
        return count == null || count < 1 ? 1 : count;
    }

    public int radiusOrZero() {
        return radius == null || radius < 0 ? 0 : radius;
    }
}
