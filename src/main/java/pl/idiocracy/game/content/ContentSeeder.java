package pl.idiocracy.game.content;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;

/**
 * Laduje startowa tresc z classpath:content/*.json gdy dana tabela jest pusta.
 * Po pierwszym starcie zrodlem prawdy jest baza + edytor.
 */
@Component
@Order(1)
public class ContentSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ContentSeeder.class);

    private final ObjectMapper mapper;
    private final ContentCache cache;
    private final TileDefRepository tiles;
    private final RaceRepository races;
    private final CharacterClassRepository classes;
    private final ItemTemplateRepository items;
    private final GameMapRepository maps;
    private final NpcRepository npcs;
    private final QuestRepository quests;

    public ContentSeeder(ObjectMapper mapper, ContentCache cache, TileDefRepository tiles, RaceRepository races,
                         CharacterClassRepository classes, ItemTemplateRepository items, GameMapRepository maps,
                         NpcRepository npcs, QuestRepository quests) {
        this.mapper = mapper;
        this.cache = cache;
        this.tiles = tiles;
        this.races = races;
        this.classes = classes;
        this.items = items;
        this.maps = maps;
        this.npcs = npcs;
        this.quests = quests;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        seed("tiles.json", TileDef.class, tiles);
        seed("races.json", Race.class, races);
        seed("classes.json", CharacterClass.class, classes);
        seed("items.json", ItemTemplate.class, items);
        if (maps.count() == 0) {
            Resource[] files = new PathMatchingResourcePatternResolver().getResources("classpath:content/maps/*.json");
            Arrays.sort(files, Comparator.comparing(Resource::getFilename));
            for (Resource file : files) {
                try (InputStream in = file.getInputStream()) {
                    GameMap map = mapper.readValue(in, GameMap.class);
                    map.validate();
                    maps.save(map);
                }
            }
            log.info("Zaladowano {} map startowych", files.length);
        }
        seed("npcs.json", Npc.class, npcs);
        seed("quests.json", Quest.class, quests);
        maps.flush();
        cache.reload();
    }

    private <T extends ContentEntity> void seed(String file, Class<T> type, JpaRepository<T, String> repo)
            throws IOException {
        if (repo.count() > 0) {
            return;
        }
        Resource res = new PathMatchingResourcePatternResolver().getResource("classpath:content/" + file);
        if (!res.exists()) {
            return;
        }
        CollectionType listType = mapper.getTypeFactory().constructCollectionType(List.class, type);
        try (InputStream in = res.getInputStream()) {
            List<T> list = mapper.readValue(in, listType);
            list.forEach(ContentEntity::validate);
            repo.saveAllAndFlush(list);
            log.info("Zaladowano {} x {}", list.size(), type.getSimpleName());
        }
    }
}
