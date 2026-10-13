package pl.idiocracy.game.character;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlayerCharacterRepository extends JpaRepository<PlayerCharacter, Long> {

    List<PlayerCharacter> findByAccountIdOrderById(long accountId);

    Optional<PlayerCharacter> findByIdAndAccountId(long id, long accountId);

    long countByAccountId(long accountId);

    @Query("select count(c) > 0 from PlayerCharacter c where lower(c.name) = lower(?1)")
    boolean nameTaken(String name);
}
