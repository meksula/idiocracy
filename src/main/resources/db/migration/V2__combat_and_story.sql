-- Walka: szablony potworow + spawny na mapach.
-- Fabula: instancjonowane mapy (np. wlasne mieszkanie), warunkowa widocznosc NPC,
-- misje startujace automatycznie.

create table monster (
    code            varchar(64) primary key,
    name            varchar(100) not null,
    level           int          not null default 1,
    max_hp          int          not null,
    attack          int          not null,
    defense         int          not null default 0,
    xp              int          not null default 0,
    ccoin_min       int          not null default 0,
    ccoin_max       int          not null default 0,
    aggressive      boolean      not null default false,
    aggro_range     int          not null default 3,
    move_delay_ms   int          not null default 500,
    attack_delay_ms int          not null default 1500,
    respawn_sec     int          not null default 30,
    loot            jsonb        not null default '[]',
    sprite          jsonb        not null
);

alter table game_map add column instanced boolean not null default false;
alter table game_map add column spawns jsonb not null default '[]';

alter table npc add column dir varchar(1) not null default 'S';
alter table npc add column visibility jsonb;

alter table quest add column auto_start boolean not null default false;
