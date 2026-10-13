package pl.idiocracy.game.content;

import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "character_class")
public class CharacterClass implements ContentEntity {

    @Id
    private String code;
    private String name;
    private String description = "";
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Stats stats = Stats.ZERO;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Appearance appearance = Appearance.EMPTY;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "starting_items", columnDefinition = "jsonb")
    private List<ItemStack> startingItems = List.of();
    private boolean playable = true;
    @Column(name = "sort_order")
    private int sortOrder;

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description == null ? "" : description; }
    public Stats getStats() { return stats; }
    public void setStats(Stats stats) { this.stats = stats == null ? Stats.ZERO : stats; }
    public Appearance getAppearance() { return appearance; }
    public void setAppearance(Appearance appearance) { this.appearance = appearance == null ? Appearance.EMPTY : appearance; }
    public List<ItemStack> getStartingItems() { return startingItems; }
    public void setStartingItems(List<ItemStack> startingItems) { this.startingItems = startingItems == null ? List.of() : startingItems; }
    public boolean isPlayable() { return playable; }
    public void setPlayable(boolean playable) { this.playable = playable; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
