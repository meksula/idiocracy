package pl.idiocracy.game.content;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
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
 * Laduje startowa tresc z classpath:content/*.json. Dodaje tylko elementy, ktorych kodu
 * jeszcze nie ma w bazie - niczego nie nadpisuje, wiec edycje z edytora sa bezpieczne,
 * a nowa tresc z kolejnych wersji gry trafia do istniejacych baz.
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
    private final MonsterTemplateRepository monsters;
    private final GameMapRepository maps;
    private final NpcRepository npcs;
    private final QuestRepository quests;

    public ContentSeeder(ObjectMapper mapper, ContentCache cache, TileDefRepository tiles, RaceRepository races,
                         CharacterClassRepository classes, ItemTemplateRepository items,
                         MonsterTemplateRepository monsters, GameMapRepository maps, NpcRepository npcs,
                         QuestRepository quests) {
        this.mapper = mapper;
        this.cache = cache;
        this.tiles = tiles;
        this.races = races;
        this.classes = classes;
        this.items = items;
        this.monsters = monsters;
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
        seed("monsters.json", MonsterTemplate.class, monsters);
        Resource[] files = new PathMatchingResourcePatternResolver().getResources("classpath:content/maps/*.json");
        Arrays.sort(files, Comparator.comparing(Resource::getFilename));
        List<GameMap> mapList = new ArrayList<>();
        for (Resource file : files) {
            try (InputStream in = file.getInputStream()) {
                mapList.add(mapper.readValue(in, GameMap.class));
            }
        }
        insertMissing(mapList, maps, "GameMap");
        seed("npcs.json", Npc.class, npcs);
        seed("quests.json", Quest.class, quests);
        cache.reload();
    }

    private <T extends ContentEntity> void seed(String file, Class<T> type, JpaRepository<T, String> repo)
            throws IOException {
        Resource res = new PathMatchingResourcePatternResolver().getResource("classpath:content/" + file);
        if (!res.exists()) {
            return;
        }
        CollectionType listType = mapper.getTypeFactory().constructCollectionType(List.class, type);
        try (InputStream in = res.getInputStream()) {
            List<T> list = mapper.readValue(in, listType);
            insertMissing(list, repo, type.getSimpleName());
        }
    }

    private <T extends ContentEntity> void insertMissing(List<T> list, JpaRepository<T, String> repo, String label) {
        List<T> missing = list.stream().filter(e -> !repo.existsById(e.getCode())).toList();
        if (missing.isEmpty()) {
            return;
        }
        missing.forEach(ContentEntity::validate);
        repo.saveAllAndFlush(missing);
        log.info("Dodano {} x {}: {}", missing.size(), label, missing.stream().map(ContentEntity::getCode).toList());
    }
}
