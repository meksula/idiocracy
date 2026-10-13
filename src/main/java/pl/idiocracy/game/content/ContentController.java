package pl.idiocracy.game.content;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

@RestController
public class ContentController {

    private final ContentService content;

    public ContentController(ContentService content) {
        this.content = content;
    }

    @GetMapping("/api/content/bootstrap")
    public ContentService.Bootstrap bootstrap() {
        return content.bootstrap();
    }

    // ---- edytor (tylko ADMIN, patrz SecurityConfig) ----

    @GetMapping("/api/editor/{type}")
    public List<? extends ContentEntity> list(@PathVariable String type) {
        return content.list(ContentType.fromPath(type));
    }

    @GetMapping("/api/editor/{type}/{code}")
    public ContentEntity get(@PathVariable String type, @PathVariable String code) {
        return content.get(ContentType.fromPath(type), code);
    }

    @PutMapping("/api/editor/{type}/{code}")
    public ContentEntity save(@PathVariable String type, @PathVariable String code, @RequestBody JsonNode body) {
        return content.save(ContentType.fromPath(type), code, body);
    }

    @DeleteMapping("/api/editor/{type}/{code}")
    public void delete(@PathVariable String type, @PathVariable String code) {
        content.delete(ContentType.fromPath(type), code);
    }
}
