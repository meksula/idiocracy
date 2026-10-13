package pl.idiocracy.game.content;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "npc")
public class Npc implements ContentEntity {

    @Id
    private String code;
    private String name;
    @Column(name = "map_code")
    private String mapCode;
    private int x;
    private int y;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Appearance appearance = Appearance.EMPTY;
    private String greeting = "";
    private String dir = "S";
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private NpcVisibility visibility;

    /** Kopia NPC w innym miejscu (np. gdy podbiegl do konkretnego gracza). */
    public Npc at(int nx, int ny) {
        Npc n = new Npc();
        n.code = code;
        n.name = name;
        n.mapCode = mapCode;
        n.x = nx;
        n.y = ny;
        n.appearance = appearance;
        n.greeting = greeting;
        n.dir = dir;
        n.visibility = visibility;
        return n;
    }

    @Override
    public void validate() {
        ContentEntity.super.validate();
        if (mapCode == null || mapCode.isBlank()) {
            throw new IllegalArgumentException("NPC musi stać na jakiejś mapie");
        }
    }

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getMapCode() { return mapCode; }
    public void setMapCode(String mapCode) { this.mapCode = mapCode; }
    public int getX() { return x; }
    public void setX(int x) { this.x = x; }
    public int getY() { return y; }
    public void setY(int y) { this.y = y; }
    public Appearance getAppearance() { return appearance; }
    public void setAppearance(Appearance appearance) { this.appearance = appearance == null ? Appearance.EMPTY : appearance; }
    public String getGreeting() { return greeting; }
    public void setGreeting(String greeting) { this.greeting = greeting == null ? "" : greeting; }
    public String getDir() { return dir; }
    public void setDir(String dir) { this.dir = dir == null || !dir.matches("[NSEW]") ? "S" : dir; }
    public NpcVisibility getVisibility() { return visibility; }
    public void setVisibility(NpcVisibility visibility) {
        this.visibility = visibility == null || visibility.quest() == null || visibility.quest().isBlank() ? null : visibility;
    }
}
