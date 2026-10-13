package pl.idiocracy.game.content;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GameMapRepository extends JpaRepository<GameMap, String> {
}
