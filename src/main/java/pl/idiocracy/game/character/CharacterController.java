package pl.idiocracy.game.character;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import pl.idiocracy.game.auth.AuthPrincipal;

@RestController
@RequestMapping("/api/characters")
public class CharacterController {

    private final CharacterService service;

    public CharacterController(CharacterService service) {
        this.service = service;
    }

    @GetMapping
    public List<CharacterService.CharacterView> list(@AuthenticationPrincipal AuthPrincipal me) {
        return service.list(me.accountId());
    }

    @PostMapping
    public CharacterService.CharacterView create(@AuthenticationPrincipal AuthPrincipal me,
                                                 @RequestBody CharacterService.CreateRequest req) {
        return service.create(me.accountId(), req);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal AuthPrincipal me, @PathVariable long id) {
        service.delete(me.accountId(), id);
    }
}
