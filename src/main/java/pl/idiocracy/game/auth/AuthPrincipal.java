package pl.idiocracy.game.auth;

/** Zalogowany uzytkownik wyciagniety z tokenu JWT. */
public record AuthPrincipal(long accountId, String email, AccountRole role) {

    public boolean isAdmin() {
        return role == AccountRole.ADMIN;
    }
}
