package pl.idiocracy.game.content;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "item_template")
public class ItemTemplate implements ContentEntity {

    @Id
    private String code;
    private String name;
    private String description = "";
    @Enumerated(EnumType.STRING)
    private ItemType type;
    @Enumerated(EnumType.STRING)
    private EquipSlot slot;
    @Enumerated(EnumType.STRING)
    private Rarity rarity = Rarity.COMMON;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private ItemStats stats = ItemStats.NONE;
    @Column(name = "min_level")
    private int minLevel = 1;
    /** Cena w c-coinach - jedynej walucie gry. */
    private long price;
    private boolean stackable;
    /** Klucz palety - jesli ustawiony, zalozony przedmiot barwi sprite postaci. */
    @Column(name = "wear_color")
    private String wearColor;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Sprite icon;

    @Override
    public void validate() {
        ContentEntity.super.validate();
        if (type == null) {
            throw new IllegalArgumentException("Wybierz typ przedmiotu");
        }
        if ((type == ItemType.WEAPON || type == ItemType.ARMOR) && slot == null) {
            throw new IllegalArgumentException("Broń i pancerz muszą mieć slot");
        }
        if (icon == null) {
            throw new IllegalArgumentException("Przedmiot musi mieć ikonę");
        }
        icon.validate();
    }

    public boolean isEquippable() {
        return slot != null && (type == ItemType.WEAPON || type == ItemType.ARMOR);
    }

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description == null ? "" : description; }
    public ItemType getType() { return type; }
    public void setType(ItemType type) { this.type = type; }
    public EquipSlot getSlot() { return slot; }
    public void setSlot(EquipSlot slot) { this.slot = slot; }
    public Rarity getRarity() { return rarity; }
    public void setRarity(Rarity rarity) { this.rarity = rarity == null ? Rarity.COMMON : rarity; }
    public ItemStats getStats() { return stats; }
    public void setStats(ItemStats stats) { this.stats = stats == null ? ItemStats.NONE : stats; }
    public int getMinLevel() { return minLevel; }
    public void setMinLevel(int minLevel) { this.minLevel = Math.max(1, minLevel); }
    public long getPrice() { return price; }
    public void setPrice(long price) { this.price = Math.max(0, price); }
    public boolean isStackable() { return stackable; }
    public void setStackable(boolean stackable) { this.stackable = stackable; }
    public String getWearColor() { return wearColor; }
    public void setWearColor(String wearColor) { this.wearColor = wearColor == null || wearColor.isBlank() ? null : wearColor; }
    public Sprite getIcon() { return icon; }
    public void setIcon(Sprite icon) { this.icon = icon; }
}
