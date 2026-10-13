package pl.idiocracy.game.character;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterItemRepository extends JpaRepository<CharacterItem, Long> {

    List<CharacterItem> findByCharacterIdOrderById(long characterId);
}
