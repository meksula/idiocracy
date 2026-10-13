package pl.idiocracy.game.auth;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import pl.idiocracy.game.config.GameProperties;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;
    private final GameProperties props;

    public AuthController(AuthService authService, GameProperties props) {
        this.authService = authService;
        this.props = props;
    }

    public record Credentials(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 100, message = "hasło musi mieć 6-100 znaków") String password) {
    }

    @PostMapping("/auth/register")
    public AuthService.Session register(@Valid @RequestBody Credentials body) {
        return authService.register(body.email(), body.password());
    }

    @PostMapping("/auth/login")
    public AuthService.Session login(@Valid @RequestBody Credentials body) {
        return authService.login(body.email(), body.password());
    }

    @GetMapping("/me")
    public AuthPrincipal me(@AuthenticationPrincipal AuthPrincipal principal) {
        return principal;
    }

    @GetMapping("/info")
    public Map<String, Object> info() {
        return Map.of("title", props.title());
    }
}
