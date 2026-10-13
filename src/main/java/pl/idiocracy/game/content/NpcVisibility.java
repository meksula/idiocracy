package pl.idiocracy.game.content;

/**
 * NPC widoczny tylko dla graczy, ktorzy maja aktywna misje quest
 * i sa na kroku od fromStep do toStep (wlacznie, liczone od 0).
 * fleeX/fleeY (opcjonalnie) - dokad NPC odbiega, gdy przestaje byc widoczny.
 */
public record NpcVisibility(String quest, Integer fromStep, Integer toStep, Integer fleeX, Integer fleeY) {

    public boolean matches(int stepIndex) {
        return (fromStep == null || stepIndex >= fromStep) && (toStep == null || stepIndex <= toStep);
    }
}
