package pl.idiocracy.game.character;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterQuestRepository extends JpaRepository<CharacterQuest, CharacterQuest.Key> {

    List<CharacterQuest> findByCharacterId(long characterId);
}
