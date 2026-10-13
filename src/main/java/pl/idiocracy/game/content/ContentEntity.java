package pl.idiocracy.game.content;

public interface ContentEntity {

    String getCode();

    /** Walidacja wywolywana przed zapisem z edytora. */
    default void validate() {
        String code = getCode();
        if (code == null || !code.matches("[a-z0-9][a-z0-9_-]{0,63}")) {
            throw new IllegalArgumentException("Kod musi składać się z [a-z0-9_-], max 64 znaki");
        }
    }
}
