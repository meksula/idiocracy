package pl.idiocracy.game.character;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@Table(name = "character_quest")
@IdClass(CharacterQuest.Key.class)
public class CharacterQuest {

    public static class Key implements Serializable {
        private long characterId;
        private String questCode;

        public Key() {
        }

        public Key(long characterId, String questCode) {
            this.characterId = characterId;
            this.questCode = questCode;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && k.characterId == characterId && Objects.equals(k.questCode, questCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(characterId, questCode);
        }
    }

    @Id
    @Column(name = "character_id")
    private long characterId;
    @Id
    @Column(name = "quest_code")
    private String questCode;
    @Enumerated(EnumType.STRING)
    private QuestStatus status;
    @Column(name = "step_index")
    private int stepIndex;
    private int progress;
    private int completions;
    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    protected CharacterQuest() {
    }

    public CharacterQuest(long characterId, String questCode) {
        this.characterId = characterId;
        this.questCode = questCode;
        this.status = QuestStatus.ACTIVE;
    }

    public void restart() {
        status = QuestStatus.ACTIVE;
        stepIndex = 0;
        progress = 0;
        touch();
    }

    public void advance() {
        stepIndex++;
        progress = 0;
        touch();
    }

    public void complete() {
        status = QuestStatus.COMPLETED;
        completions++;
        touch();
    }

    public void touch() {
        updatedAt = Instant.now();
    }

    public long getCharacterId() { return characterId; }
    public String getQuestCode() { return questCode; }
    public QuestStatus getStatus() { return status; }
    public int getStepIndex() { return stepIndex; }
    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
    public int getCompletions() { return completions; }
}
