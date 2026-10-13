package pl.idiocracy.game.content;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "tile_def")
public class TileDef implements ContentEntity {

    public enum Layer { GROUND, OBJECT }

    @Id
    private String code;
    private String name;
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    private Layer layer;
    private boolean solid;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Sprite sprite;
    @Column(name = "sort_order")
    private int sortOrder;

    @Override
    public void validate() {
        ContentEntity.super.validate();
        if (layer == null) {
            throw new IllegalArgumentException("Wybierz warstwę kafelka");
        }
        if (sprite == null) {
            throw new IllegalArgumentException("Kafelek musi mieć grafikę");
        }
        sprite.validate();
    }

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Layer getLayer() { return layer; }
    public void setLayer(Layer layer) { this.layer = layer; }
    public boolean isSolid() { return solid; }
    public void setSolid(boolean solid) { this.solid = solid; }
    public Sprite getSprite() { return sprite; }
    public void setSprite(Sprite sprite) { this.sprite = sprite; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
