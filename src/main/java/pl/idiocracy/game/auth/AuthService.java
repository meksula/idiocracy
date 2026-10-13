package pl.idiocracy.game.auth;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pl.idiocracy.game.config.GameException;
import pl.idiocracy.game.config.GameProperties;

@Service
public class AuthService {

    private final AccountRepository accounts;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final GameProperties props;

    public AuthService(AccountRepository accounts, PasswordEncoder encoder, JwtService jwt, GameProperties props) {
        this.accounts = accounts;
        this.encoder = encoder;
        this.jwt = jwt;
        this.props = props;
    }

    public record Session(String token, long accountId, String email, AccountRole role) {
    }

    /** POC: bez maila aktywacyjnego - konto jest aktywne od razu. */
    @Transactional
    public Session register(String rawEmail, String password) {
        String email = normalize(rawEmail);
        if (accounts.existsByEmailIgnoreCase(email)) {
            throw GameException.conflict("Konto z tym adresem już istnieje");
        }
        boolean admin = props.adminEmails().contains(email)
                || (props.firstAccountAdmin() && accounts.count() == 0);
        Account account = accounts.save(new Account(email, encoder.encode(password),
                admin ? AccountRole.ADMIN : AccountRole.PLAYER));
        return toSession(account);
    }

    @Transactional
    public Session login(String rawEmail, String password) {
        Account account = accounts.findByEmailIgnoreCase(normalize(rawEmail))
                .filter(a -> encoder.matches(password, a.getPasswordHash()))
                .orElseThrow(() -> new GameException(HttpStatus.UNAUTHORIZED, "Nieprawidłowy e-mail lub hasło"));
        if (account.getRole() != AccountRole.ADMIN && props.adminEmails().contains(account.getEmail())) {
            account.setRole(AccountRole.ADMIN);
        }
        return toSession(account);
    }

    private Session toSession(Account a) {
        return new Session(jwt.issue(a), a.getId(), a.getEmail(), a.getRole());
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
