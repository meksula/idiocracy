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
@Table(name = "quest")
public class Quest implements ContentEntity {

    @Id
    private String code;
    private String title;
    private String description = "";
    @Column(name = "giver_npc")
    private String giverNpc;
    @Column(name = "min_level")
    private int minLevel = 1;
    private boolean repeatable;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<QuestStep> steps = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private QuestRewards rewards = new QuestRewards(0, 0, List.of());
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private QuestDialog dialog = new QuestDialog("", "", "");
    @Column(name = "sort_order")
    private int sortOrder;

    @Override
    public void validate() {
        ContentEntity.super.validate();
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Misja musi mieć tytuł");
        }
        if (steps.isEmpty()) {
            throw new IllegalArgumentException("Misja musi mieć co najmniej jeden krok");
        }
        for (int i = 0; i < steps.size(); i++) {
            QuestStep s = steps.get(i);
            if (s.type() == null || s.target() == null || s.target().isBlank()) {
                throw new IllegalArgumentException("Krok " + (i + 1) + ": wybierz typ i cel");
            }
            if (s.type() == QuestStepType.VISIT && (s.x() == null || s.y() == null)) {
                throw new IllegalArgumentException("Krok " + (i + 1) + ": VISIT wymaga współrzędnych x/y");
            }
        }
    }

    @Override
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description == null ? "" : description; }
    public String getGiverNpc() { return giverNpc; }
    public void setGiverNpc(String giverNpc) { this.giverNpc = giverNpc == null || giverNpc.isBlank() ? null : giverNpc; }
    public int getMinLevel() { return minLevel; }
    public void setMinLevel(int minLevel) { this.minLevel = Math.max(1, minLevel); }
    public boolean isRepeatable() { return repeatable; }
    public void setRepeatable(boolean repeatable) { this.repeatable = repeatable; }
    public List<QuestStep> getSteps() { return steps; }
    public void setSteps(List<QuestStep> steps) { this.steps = steps == null ? new ArrayList<>() : steps; }
    public QuestRewards getRewards() { return rewards; }
    public void setRewards(QuestRewards rewards) { this.rewards = rewards == null ? new QuestRewards(0, 0, List.of()) : rewards; }
    public QuestDialog getDialog() { return dialog; }
    public void setDialog(QuestDialog dialog) { this.dialog = dialog == null ? new QuestDialog("", "", "") : dialog; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
