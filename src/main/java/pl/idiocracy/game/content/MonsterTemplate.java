package pl.idiocracy.game.content;

import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "monster")
public class MonsterTemplate implements ContentEntity {

    @Id
    private String code;
    private String name;
    private int level = 1;
    @Column(name = "max_hp")
    private int maxHp = 10;
    private int attack = 1;
    private int defense;
    private int xp;
    @Column(name = "ccoin_min")
    private int ccoinMin;
    @Column(name = "ccoin_max")
    private int ccoinMax;
    private boolean aggressive;
    @Column(name = "aggro_range")
    private int aggroRange = 3;
    @Column(name = "move_delay_ms")
    private int moveDelayMs = 500;
    @Column(name = "attack_delay_ms")
    private int attackDelayMs = 1500;
    @Column(name = "respawn_sec")
    private int respawnSec = 30;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<LootEntry> loot = new ArrayList<>();
    /** Sprite zwrocony w prawo (E); klient odbija go przy ruchu w lewo. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Sprite sprite;

    @Override
    public void validate() {
        ContentEntity.super.validate();
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Potwór musi mieć nazwę");
        }
        if (maxHp < 1 || attack < 0 || defense < 0 || level < 1) {
            throw new IllegalArgumentException("HP i poziom muszą być dodatnie, atak/obrona nieujemne");
        }
        if (moveDelayMs < 100 || attackDelayMs < 200 || respawnSec < 1) {
            throw new IllegalArgumentException("Za krótkie czasy ruchu/ataku/odrodzenia");
        }
        if (ccoinMax < ccoinMin) {
            throw new IllegalArgumentException("c-coin max musi być >= min");
        }
        if (sprite == null) {
            throw new IllegalArgumentException("Potwór musi mieć grafikę");
        }
        sprite.validate();
    }

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getLevel() { return level; }
    public void setLevel(int level) { this.level = level; }
    public int getMaxHp() { return maxHp; }
    public void setMaxHp(int maxHp) { this.maxHp = maxHp; }
    public int getAttack() { return attack; }
    public void setAttack(int attack) { this.attack = attack; }
    public int getDefense() { return defense; }
    public void setDefense(int defense) { this.defense = defense; }
    public int getXp() { return xp; }
    public void setXp(int xp) { this.xp = xp; }
    public int getCcoinMin() { return ccoinMin; }
    public void setCcoinMin(int ccoinMin) { this.ccoinMin = ccoinMin; }
    public int getCcoinMax() { return ccoinMax; }
    public void setCcoinMax(int ccoinMax) { this.ccoinMax = ccoinMax; }
    public boolean isAggressive() { return aggressive; }
    public void setAggressive(boolean aggressive) { this.aggressive = aggressive; }
    public int getAggroRange() { return aggroRange; }
    public void setAggroRange(int aggroRange) { this.aggroRange = aggroRange; }
    public int getMoveDelayMs() { return moveDelayMs; }
    public void setMoveDelayMs(int moveDelayMs) { this.moveDelayMs = moveDelayMs; }
    public int getAttackDelayMs() { return attackDelayMs; }
    public void setAttackDelayMs(int attackDelayMs) { this.attackDelayMs = attackDelayMs; }
    public int getRespawnSec() { return respawnSec; }
    public void setRespawnSec(int respawnSec) { this.respawnSec = respawnSec; }
    public List<LootEntry> getLoot() { return loot; }
    public void setLoot(List<LootEntry> loot) { this.loot = loot == null ? new ArrayList<>() : loot; }
    public Sprite getSprite() { return sprite; }
    public void setSprite(Sprite sprite) { this.sprite = sprite; }
}
