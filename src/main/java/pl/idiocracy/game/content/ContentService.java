package pl.idiocracy.game.content;

import java.util.Comparator;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import pl.idiocracy.game.config.GameException;

@Service
public class ContentService {

    private final ContentCache cache;
    private final ObjectMapper mapper;
    private final ApplicationEventPublisher events;
    private final java.util.Map<ContentType, JpaRepository<? extends ContentEntity, String>> repos;

    public ContentService(ContentCache cache, ObjectMapper mapper, ApplicationEventPublisher events,
                          TileDefRepository tiles, RaceRepository races, CharacterClassRepository classes,
                          ItemTemplateRepository items, GameMapRepository maps, NpcRepository npcs,
                          QuestRepository quests) {
        this.cache = cache;
        this.mapper = mapper;
        this.events = events;
        this.repos = java.util.Map.of(
                ContentType.TILES, tiles,
                ContentType.RACES, races,
                ContentType.CLASSES, classes,
                ContentType.ITEMS, items,
                ContentType.MAPS, maps,
                ContentType.NPCS, npcs,
                ContentType.QUESTS, quests);
    }

    public record Bootstrap(List<TileDef> tiles, List<ItemTemplate> items, List<Race> races,
                            List<CharacterClass> classes) {
    }

    /** Wszystko, czego klient potrzebuje do renderowania i kreatora postaci. */
    public Bootstrap bootstrap() {
        var s = cache.get();
        return new Bootstrap(
                s.tiles().values().stream()
                        .sorted(Comparator.comparingInt(TileDef::getSortOrder).thenComparing(TileDef::getCode)).toList(),
                s.items().values().stream().sorted(Comparator.comparing(ItemTemplate::getCode)).toList(),
                s.races().values().stream().filter(Race::isPlayable)
                        .sorted(Comparator.comparingInt(Race::getSortOrder)).toList(),
                s.classes().values().stream().filter(CharacterClass::isPlayable)
                        .sorted(Comparator.comparingInt(CharacterClass::getSortOrder)).toList());
    }

    @Transactional(readOnly = true)
    public List<? extends ContentEntity> list(ContentType type) {
        return repo(type).findAll().stream()
                .sorted(Comparator.comparing(ContentEntity::getCode)).toList();
    }

    @Transactional(readOnly = true)
    public ContentEntity get(ContentType type, String code) {
        return repo(type).findById(code).orElseThrow(() -> GameException.notFound("Nie ma: " + code));
    }

    @Transactional
    public ContentEntity save(ContentType type, String code, JsonNode body) {
        ContentEntity entity;
        try {
            entity = mapper.treeToValue(body, type.entityClass());
        } catch (Exception e) {
            throw GameException.badRequest("Nieprawidłowe dane: " + e.getMessage());
        }
        if (!code.equals(entity.getCode())) {
            throw GameException.badRequest("Kod w ścieżce i w treści musi być taki sam");
        }
        entity.validate();
        ContentEntity saved;
        try {
            saved = saveRaw(type, entity);
        } catch (DataIntegrityViolationException e) {
            throw GameException.badRequest("Naruszenie spójności danych (sprawdź odwołania do innych kodów)");
        }
        afterChange(type, code);
        return saved;
    }

    @Transactional
    public void delete(ContentType type, String code) {
        var repo = repo(type);
        if (!repo.existsById(code)) {
            throw GameException.notFound("Nie ma: " + code);
        }
        try {
            repo.deleteById(code);
            repo.flush();
        } catch (DataIntegrityViolationException e) {
            throw GameException.conflict("Nie można usunąć — inne elementy (np. postacie) się do tego odwołują");
        }
        afterChange(type, code);
    }

    private void afterChange(ContentType type, String code) {
        // przeladowanie po commicie, zeby cache widzial nowe dane
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        cache.reload();
                        events.publishEvent(new ContentChangedEvent(type, code));
                    }
                });
    }

    @SuppressWarnings("unchecked")
    private <T extends ContentEntity> T saveRaw(ContentType type, ContentEntity entity) {
        JpaRepository<T, String> repo = (JpaRepository<T, String>) repos.get(type);
        return repo.saveAndFlush((T) entity);
    }

    @SuppressWarnings("unchecked")
    private JpaRepository<ContentEntity, String> repo(ContentType type) {
        return (JpaRepository<ContentEntity, String>) repos.get(type);
    }
}
