package pl.idiocracy.game.content;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "game_map")
public class GameMap implements ContentEntity {

    @Id
    private String code;
    private String name;
    private int width;
    private int height;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MapLayers layers;
    @Column(name = "spawn_x")
    private int spawnX;
    @Column(name = "spawn_y")
    private int spawnY;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Portal> portals = new ArrayList<>();
    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    @Override
    public void validate() {
        ContentEntity.super.validate();
        if (width < 5 || height < 5 || width > 256 || height > 256) {
            throw new IllegalArgumentException("Mapa musi mieć wymiary 5..256");
        }
        int size = width * height;
        if (layers == null || layers.ground() == null || layers.ground().size() != size
                || layers.objects() == null || layers.objects().size() != size) {
            throw new IllegalArgumentException("Warstwy mapy mają zły rozmiar (oczekiwano " + size + ")");
        }
        if (!inBounds(spawnX, spawnY)) {
            throw new IllegalArgumentException("Punkt startowy poza mapą");
        }
        for (Portal p : portals) {
            if (!inBounds(p.x(), p.y())) {
                throw new IllegalArgumentException("Portal poza mapą: " + p.x() + "," + p.y());
            }
        }
        updatedAt = Instant.now();
    }

    public boolean inBounds(int x, int y) {
        return x >= 0 && y >= 0 && x < width && y < height;
    }

    public String groundAt(int x, int y) {
        return layers.ground().get(y * width + x);
    }

    public String objectAt(int x, int y) {
        return layers.objects().get(y * width + x);
    }

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }
    public MapLayers getLayers() { return layers; }
    public void setLayers(MapLayers layers) { this.layers = layers; }
    public int getSpawnX() { return spawnX; }
    public void setSpawnX(int spawnX) { this.spawnX = spawnX; }
    public int getSpawnY() { return spawnY; }
    public void setSpawnY(int spawnY) { this.spawnY = spawnY; }
    public List<Portal> getPortals() { return portals; }
    public void setPortals(List<Portal> portals) { this.portals = portals == null ? new ArrayList<>() : portals; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
