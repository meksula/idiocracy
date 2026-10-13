package pl.idiocracy.game.character;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import pl.idiocracy.game.content.EquipSlot;

@Entity
@Table(name = "character_item")
public class CharacterItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "character_id")
    private long characterId;
    @Column(name = "item_code")
    private String itemCode;
    private int quantity;
    @Enumerated(EnumType.STRING)
    @Column(name = "equipped_slot")
    private EquipSlot equippedSlot;

    protected CharacterItem() {
    }

    public CharacterItem(long characterId, String itemCode, int quantity) {
        this.characterId = characterId;
        this.itemCode = itemCode;
        this.quantity = quantity;
    }

    public Long getId() { return id; }
    public long getCharacterId() { return characterId; }
    public String getItemCode() { return itemCode; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public EquipSlot getEquippedSlot() { return equippedSlot; }
    public void setEquippedSlot(EquipSlot equippedSlot) { this.equippedSlot = equippedSlot; }
}
