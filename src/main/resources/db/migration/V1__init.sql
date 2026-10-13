-- ============================================================
-- OFFLINE 2074 - schemat bazowy
-- Tresc gry (kafelki, rasy, klasy, przedmioty, mapy, NPC, misje)
-- jest data-driven: kluczem jest czytelny "code", elastyczne
-- czesci trzymamy w JSONB, zeby edytor mogl je swobodnie rozwijac.
-- ============================================================

create table account (
    id            bigserial primary key,
    email         varchar(255) not null unique,
    password_hash varchar(100) not null,
    role          varchar(20)  not null default 'PLAYER',
    created_at    timestamptz  not null default now()
);

create table tile_def (
    code       varchar(64) primary key,
    name       varchar(100) not null,
    layer      varchar(16)  not null,
    solid      boolean      not null default false,
    sprite     jsonb        not null,
    sort_order int          not null default 0
);

create table race (
    code        varchar(64) primary key,
    name        varchar(100) not null,
    description text         not null default '',
    stats       jsonb        not null,
    appearance  jsonb        not null,
    playable    boolean      not null default true,
    sort_order  int          not null default 0
);

create table character_class (
    code           varchar(64) primary key,
    name           varchar(100) not null,
    description    text         not null default '',
    stats          jsonb        not null,
    appearance     jsonb        not null,
    starting_items jsonb        not null default '[]',
    playable       boolean      not null default true,
    sort_order     int          not null default 0
);

create table item_template (
    code        varchar(64) primary key,
    name        varchar(100) not null,
    description text         not null default '',
    type        varchar(32)  not null,
    slot        varchar(32),
    rarity      varchar(16)  not null default 'COMMON',
    stats       jsonb        not null default '{}',
    min_level   int          not null default 1,
    price       bigint       not null default 0,
    stackable   boolean      not null default false,
    wear_color  varchar(8),
    icon        jsonb        not null
);

create table game_map (
    code       varchar(64) primary key,
    name       varchar(100) not null,
    width      int          not null,
    height     int          not null,
    layers     jsonb        not null,
    spawn_x    int          not null,
    spawn_y    int          not null,
    portals    jsonb        not null default '[]',
    updated_at timestamptz  not null default now()
);

create table npc (
    code       varchar(64) primary key,
    name       varchar(100) not null,
    map_code   varchar(64)  not null references game_map (code) on delete cascade,
    x          int          not null,
    y          int          not null,
    appearance jsonb        not null,
    greeting   text         not null default ''
);

create table quest (
    code        varchar(64) primary key,
    title       varchar(150) not null,
    description text         not null default '',
    giver_npc   varchar(64) references npc (code) on delete set null,
    min_level   int          not null default 1,
    repeatable  boolean      not null default false,
    steps       jsonb        not null default '[]',
    rewards     jsonb        not null default '{}',
    dialog      jsonb        not null default '{}',
    sort_order  int          not null default 0
);

create table player_character (
    id         bigserial primary key,
    account_id bigint       not null references account (id) on delete cascade,
    name       varchar(24)  not null,
    race_code  varchar(64)  not null references race (code),
    class_code varchar(64)  not null references character_class (code),
    appearance jsonb        not null default '{}',
    level      int          not null default 1,
    xp         bigint       not null default 0,
    ccoin      bigint       not null default 0,
    hp         int          not null default 1,
    map_code   varchar(64)  not null,
    x          int          not null,
    y          int          not null,
    dir        varchar(1)   not null default 'S',
    created_at timestamptz  not null default now()
);
create unique index ux_player_character_name on player_character (lower(name));
create index ix_player_character_account on player_character (account_id);

create table character_item (
    id            bigserial primary key,
    character_id  bigint      not null references player_character (id) on delete cascade,
    item_code     varchar(64) not null references item_template (code) on delete cascade,
    quantity      int         not null default 1,
    equipped_slot varchar(32)
);
create index ix_character_item_character on character_item (character_id);

create table character_quest (
    character_id bigint      not null references player_character (id) on delete cascade,
    quest_code   varchar(64) not null references quest (code) on delete cascade,
    status       varchar(16) not null,
    step_index   int         not null default 0,
    progress     int         not null default 0,
    completions  int         not null default 0,
    updated_at   timestamptz not null default now(),
    primary key (character_id, quest_code)
);
