package pl.idiocracy.game.character;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import pl.idiocracy.game.content.Appearance;

@Entity
@Table(name = "player_character")
public class PlayerCharacter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "account_id")
    private long accountId;
    private String name;
    @Column(name = "race_code")
    private String raceCode;
    @Column(name = "class_code")
    private String classCode;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Appearance appearance = Appearance.EMPTY;
    private int level = 1;
    private long xp;
    private long ccoin;
    private int hp;
    @Column(name = "map_code")
    private String mapCode;
    private int x;
    private int y;
    private String dir = "S";
    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    protected PlayerCharacter() {
    }

    public PlayerCharacter(long accountId, String name, String raceCode, String classCode, Appearance appearance) {
        this.accountId = accountId;
        this.name = name;
        this.raceCode = raceCode;
        this.classCode = classCode;
        this.appearance = appearance;
    }

    public void placeAt(String mapCode, int x, int y, String dir) {
        this.mapCode = mapCode;
        this.x = x;
        this.y = y;
        this.dir = dir;
    }

    public Long getId() { return id; }
    public long getAccountId() { return accountId; }
    public String getName() { return name; }
    public String getRaceCode() { return raceCode; }
    public String getClassCode() { return classCode; }
    public Appearance getAppearance() { return appearance; }
    public int getLevel() { return level; }
    public void setLevel(int level) { this.level = level; }
    public long getXp() { return xp; }
    public void setXp(long xp) { this.xp = xp; }
    public long getCcoin() { return ccoin; }
    public void setCcoin(long ccoin) { this.ccoin = ccoin; }
    public int getHp() { return hp; }
    public void setHp(int hp) { this.hp = hp; }
    public String getMapCode() { return mapCode; }
    public int getX() { return x; }
    public int getY() { return y; }
    public String getDir() { return dir; }
    public Instant getCreatedAt() { return createdAt; }
}
