use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopInfo {
    platform: &'static str,
    local_frontend: bool,
    data_dir: String,
    memory_db: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct MemoryTurn { role: String, text: String, ts: i64 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct MemoryEpisode { text: String, ts: i64 }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructuredMemory {
    id: i64,
    kind: String,
    text: String,
    importance: f64,
    status: String,
    first_seen_ts: i64,
    last_seen_ts: i64,
    hit_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructuredMemoryNode {
    id: i64,
    kind: String,
    text: String,
    importance: f64,
    status: String,
    first_seen_ts: i64,
    last_seen_ts: i64,
    hit_count: i64,
    link_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructuredMemoryLink {
    source_id: i64,
    target_id: i64,
    relation: String,
    weight: f64,
    created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructuredMemoryGraph {
    nodes: Vec<StructuredMemoryNode>,
    links: Vec<StructuredMemoryLink>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructuredMemoryPatch {
    id: i64,
    text: Option<String>,
    importance: Option<f64>,
    status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportStructuredMemory {
    id: Option<i64>,
    kind: String,
    text: String,
    importance: f64,
    status: String,
    first_seen_ts: i64,
    last_seen_ts: i64,
    hit_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportStructuredMemoryLink {
    source_id: i64,
    target_id: i64,
    relation: String,
    weight: f64,
    created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct MemoryAffect {
    mood: String,
    confidence: f64,
    valence: Option<f64>,
    arousal: Option<f64>,
    engagement: Option<f64>,
    fatigue: Option<f64>,
    tension: Option<f64>,
    ts: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportTurn {
    role: Option<String>,
    text: Option<String>,
    ts: Option<i64>,
    created_at: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct MemorySnapshot {
    #[serde(rename = "exportedAt")]
    exported_at: String,
    turns: Vec<MemoryTurn>,
    episodes: Vec<MemoryEpisode>,
    #[serde(rename = "structuredMemories")]
    structured_memories: Vec<StructuredMemory>,
    #[serde(rename = "memoryLinks")]
    memory_links: Vec<StructuredMemoryLink>,
    affects: Vec<MemoryAffect>,
}

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|v| v.as_millis() as i64).unwrap_or(0)
}

fn clip(input: &str, max_chars: usize) -> String {
    input.trim().chars().take(max_chars).collect()
}

fn memory_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| format!("app_local_data_dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create app data dir: {e}"))?;
    Ok(dir.join("mira.db"))
}

fn open(app: &AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(memory_path(app)?).map_err(|e| format!("open mira.db: {e}"))?;
    connection.execute_batch(r#"
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS turns (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_turns_ts ON turns(ts);
      CREATE TABLE IF NOT EXISTS episodes (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, ts INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_episodes_ts ON episodes(ts);
      CREATE TABLE IF NOT EXISTS structured_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        normalized_text TEXT NOT NULL,
        importance REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'stored',
        first_seen_ts INTEGER NOT NULL,
        last_seen_ts INTEGER NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(kind, normalized_text)
      );
      CREATE INDEX IF NOT EXISTS idx_structured_memory_kind ON structured_memories(kind,status);
      CREATE INDEX IF NOT EXISTS idx_structured_memory_recent ON structured_memories(last_seen_ts DESC);
      CREATE TABLE IF NOT EXISTS memory_links (
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(source_id,target_id,relation),
        FOREIGN KEY(source_id) REFERENCES structured_memories(id) ON DELETE CASCADE,
        FOREIGN KEY(target_id) REFERENCES structured_memories(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_memory_links_source ON memory_links(source_id,relation);
      CREATE INDEX IF NOT EXISTS idx_memory_links_target ON memory_links(target_id,relation);
      CREATE TABLE IF NOT EXISTS affect (
        id INTEGER PRIMARY KEY AUTOINCREMENT, mood TEXT NOT NULL, confidence REAL NOT NULL,
        valence REAL, arousal REAL, engagement REAL, fatigue REAL, tension REAL, ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_affect_ts ON affect(ts);
      CREATE TABLE IF NOT EXISTS permissions (key TEXT PRIMARY KEY, value INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS music_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        root TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        search_text TEXT NOT NULL,
        ext TEXT NOT NULL,
        indexed_at INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        last_played_at INTEGER NOT NULL DEFAULT 0,
        play_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_music_tracks_root ON music_tracks(root);
      CREATE INDEX IF NOT EXISTS idx_music_tracks_recent ON music_tracks(last_played_at DESC);
      CREATE TABLE IF NOT EXISTS music_context_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL,
        memory_id INTEGER,
        context_kind TEXT NOT NULL,
        context_text TEXT NOT NULL,
        played_at INTEGER NOT NULL,
        FOREIGN KEY(track_id) REFERENCES music_tracks(id) ON DELETE CASCADE,
        FOREIGN KEY(memory_id) REFERENCES structured_memories(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_music_context_track ON music_context_history(track_id,played_at DESC);
      CREATE INDEX IF NOT EXISTS idx_music_context_memory ON music_context_history(memory_id,played_at DESC);
      CREATE TABLE IF NOT EXISTS action_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, outcome TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '', ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_action_history_ts ON action_history(ts);
    "#).map_err(|e| format!("initialize mira.db: {e}"))?;
    Ok(connection)
}

pub(crate) fn initialize(app: &AppHandle) -> Result<(), String> {
    let connection = open(app)?;
    for (key, value) in [("media.control", 1_i64), ("media.library", 0_i64), ("memory.affect", 1_i64)] {
      connection.execute(
        "INSERT OR IGNORE INTO permissions(key,value,updated_at) VALUES (?1,?2,?3)",
        params![key,value,now_ms()]
      ).map_err(|e| format!("initialize permission {key}: {e}"))?;
    }
    Ok(())
}

pub(crate) fn permission_enabled(app: &AppHandle, key: &str, default_value: bool) -> bool {
    open(app).ok().and_then(|connection| {
      connection.query_row(
        "SELECT value FROM permissions WHERE key=?1",
        [clip(key,120)],
        |row| row.get::<_,i64>(0)
      ).optional().ok().flatten()
    }).map(|value| value != 0).unwrap_or(default_value)
}

pub(crate) fn database(app: &AppHandle) -> Result<Connection, String> { open(app) }

pub(crate) fn timestamp_ms() -> i64 { now_ms() }

pub(crate) fn setting_get(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
    open(app)?.query_row(
      "SELECT value FROM settings WHERE key=?1",
      [clip(key,120)],
      |row| row.get::<_,String>(0)
    ).optional().map_err(|e| format!("read setting: {e}"))
}

pub(crate) fn setting_set(app: &AppHandle, key: &str, value: &str) -> Result<(), String> {
    let key = clip(key,120);
    if key.is_empty() { return Err("setting key is empty".into()); }
    open(app)?.execute(
      "INSERT INTO settings(key,value,updated_at) VALUES (?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
      params![key,clip(value,4096),now_ms()]
    ).map_err(|e| format!("write setting: {e}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn desktop_info(app: AppHandle) -> Result<DesktopInfo, String> {
    let db = memory_path(&app)?;
    let dir = db.parent().unwrap_or(db.as_path());
    Ok(DesktopInfo {
        platform: std::env::consts::OS,
        local_frontend: true,
        data_dir: dir.to_string_lossy().to_string(),
        memory_db: db.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub(crate) fn desktop_memory_count(app: AppHandle) -> Result<i64, String> {
    open(&app)?.query_row("SELECT COUNT(*) FROM turns", [], |row| row.get(0)).map_err(|e| format!("count turns: {e}"))
}

#[tauri::command]
pub(crate) fn desktop_memory_save_turn(app: AppHandle, role: String, text: String) -> Result<(), String> {
    let role = if role == "mira" { "mira" } else { "user" };
    let text = clip(&text, 6000);
    if text.is_empty() { return Ok(()); }
    open(&app)?.execute("INSERT INTO turns(role,text,ts) VALUES (?1,?2,?3)", params![role,text,now_ms()])
      .map_err(|e| format!("save turn: {e}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn desktop_memory_recent(app: AppHandle, limit: Option<u32>) -> Result<Vec<MemoryTurn>, String> {
    let connection = open(&app)?;
    let mut statement = connection.prepare("SELECT role,text,ts FROM turns ORDER BY ts DESC,id DESC LIMIT ?1")
      .map_err(|e| format!("prepare recent turns: {e}"))?;
    let rows = statement.query_map([limit.unwrap_or(40).clamp(1,200) as i64], |row| Ok(MemoryTurn {
      role: row.get(0)?, text: row.get(1)?, ts: row.get(2)?
    })).map_err(|e| format!("recent turns: {e}"))?;
    let mut result = rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect recent turns: {e}"))?;
    result.reverse();
    Ok(result)
}

fn contains_any(normalized: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| normalized.contains(needle))
}

fn user_statement(conversation: &str) -> String {
    let before_mira = conversation.split_once("\nMira:").map(|(user,_)| user).unwrap_or(conversation);
    clip(before_mira.trim().strip_prefix("Người dùng:").unwrap_or(before_mira.trim()), 1200)
}

fn structured_kind_label(kind: &str) -> &'static str {
    match kind {
      "preference" => "Sở thích/ưu tiên",
      "life_event" => "Sự kiện cuộc sống",
      "relationship_context" => "Bối cảnh mối quan hệ",
      "emotional_episode" => "Điều người dùng từng chia sẻ về cảm xúc",
      "active_thread" => "Việc đang theo dõi",
      _ => "Thông tin người dùng đã tự nói",
    }
}

fn upsert_structured_memory(
    connection: &Connection,
    kind: &str,
    text: &str,
    importance: f64,
    status: &str,
    ts: i64,
) -> Result<Option<i64>, String> {
    let normalized = normalize_search(text);
    if normalized.chars().count() < 4 { return Ok(None); }
    connection.execute(
      "INSERT INTO structured_memories(kind,text,normalized_text,importance,status,first_seen_ts,last_seen_ts,hit_count)
       VALUES (?1,?2,?3,?4,?5,?6,?6,1)
       ON CONFLICT(kind,normalized_text) DO UPDATE SET
         text=excluded.text,
         importance=MIN(1.0,MAX(structured_memories.importance,excluded.importance)+0.02),
         status=excluded.status,
         last_seen_ts=excluded.last_seen_ts,
         hit_count=structured_memories.hit_count+1",
      params![kind,clip(text,1200),&normalized,importance.clamp(0.0,1.0),status,ts]
    ).map_err(|e| format!("upsert structured memory: {e}"))?;
    connection.query_row(
      "SELECT id FROM structured_memories WHERE kind=?1 AND normalized_text=?2",
      params![kind,normalized],
      |row| row.get::<_,i64>(0)
    ).optional().map_err(|e| format!("resolve structured memory id: {e}"))
}

fn link_structured_memories(connection: &Connection, ids: &[i64], ts: i64) -> Result<(), String> {
    for (index, source) in ids.iter().enumerate() {
      for target in ids.iter().skip(index + 1) {
        let (left,right) = if source < target { (*source,*target) } else { (*target,*source) };
        connection.execute(
          "INSERT INTO memory_links(source_id,target_id,relation,weight,created_at)
           VALUES (?1,?2,'co_occurs',1.0,?3)
           ON CONFLICT(source_id,target_id,relation) DO UPDATE SET
             weight=MIN(3.0,memory_links.weight+0.08),created_at=excluded.created_at",
          params![left,right,ts]
        ).map_err(|e| format!("link structured memories: {e}"))?;
      }
    }
    Ok(())
}

fn semantic_tokens(input: &str) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
      "anh","em","la","co","mot","cai","nay","do","roi","thi","ma","voi","cua",
      "cho","de","se","dang","can","phai","hom","ngay","luc","khi","ve","vao","ra",
      "minh","chuyen","viec","nhe","nha","di"
    ];
    tokens(input).into_iter().filter(|token| !STOPWORDS.contains(&token.as_str())).collect()
}

fn semantic_similarity(query: &[String], text: &str) -> f64 {
    if query.is_empty() { return 0.0; }
    let hay = semantic_tokens(text);
    if hay.is_empty() { return 0.0; }
    let hits = query.iter().filter(|token| hay.iter().any(|candidate| candidate == *token)).count();
    hits as f64 / query.len() as f64
}

fn link_recent_related_memories(
    connection: &Connection,
    ids: &[i64],
    statement: &str,
    ts: i64,
) -> Result<(), String> {
    if ids.is_empty() { return Ok(()); }
    let query = semantic_tokens(statement);
    if query.is_empty() { return Ok(()); }
    let cutoff = ts - 7 * 24 * 60 * 60_000;
    let mut prepared = connection.prepare(
      "SELECT id,text,last_seen_ts FROM structured_memories
       WHERE last_seen_ts>=?1 ORDER BY last_seen_ts DESC LIMIT 120"
    ).map_err(|e| format!("prepare semantic memory links: {e}"))?;
    let rows = prepared.query_map([cutoff],|row| Ok((
      row.get::<_,i64>(0)?,row.get::<_,String>(1)?,row.get::<_,i64>(2)?
    ))).map_err(|e| format!("semantic memory links: {e}"))?;
    for row in rows {
      let (candidate_id,candidate_text,candidate_ts) = row.map_err(|e| format!("semantic memory link row: {e}"))?;
      if ids.contains(&candidate_id) { continue; }
      let score = semantic_similarity(&query,&candidate_text);
      if score < 0.25 { continue; }
      let age_hours = ((ts - candidate_ts).max(0) as f64) / 3_600_000.0;
      let temporal = (0.18 - age_hours / 1_000.0).max(0.0);
      let weight = (score + temporal).min(1.0);
      for source in ids {
        let (left,right) = if *source < candidate_id { (*source,candidate_id) } else { (candidate_id,*source) };
        connection.execute(
          "INSERT INTO memory_links(source_id,target_id,relation,weight,created_at)
           VALUES (?1,?2,'semantic_temporal',?3,?4)
           ON CONFLICT(source_id,target_id,relation) DO UPDATE SET
             weight=MAX(memory_links.weight,excluded.weight),created_at=excluded.created_at",
          params![left,right,weight,ts]
        ).map_err(|e| format!("save semantic memory link: {e}"))?;
      }
    }
    Ok(())
}

fn resolve_recent_thread(connection: &Connection, statement: &str, ts: i64) -> Result<(), String> {
    let query_tokens = tokens(statement);
    let mut prepared = connection.prepare(
      "SELECT id,text,last_seen_ts FROM structured_memories WHERE kind='active_thread' AND status='active' ORDER BY last_seen_ts DESC LIMIT 6"
    ).map_err(|e| format!("prepare active thread resolution: {e}"))?;
    let rows = prepared.query_map([],|row| Ok((row.get::<_,i64>(0)?,row.get::<_,String>(1)?,row.get::<_,i64>(2)?)))
      .map_err(|e| format!("active thread resolution: {e}"))?;
    let mut candidates = rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect active thread resolution: {e}"))?;
    if candidates.is_empty() { return Ok(()); }
    candidates.sort_by(|a,b| {
      let sb = similarity(&query_tokens,&b.1);
      let sa = similarity(&query_tokens,&a.1);
      sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal).then_with(|| b.2.cmp(&a.2))
    });
    let best = &candidates[0];
    let score = similarity(&query_tokens,&best.1);
    let recent_active_count = candidates.iter().filter(|(_,_,seen)| ts - *seen < 72 * 60 * 60_000).count();
    if score >= 0.18 || recent_active_count == 1 {
      connection.execute(
        "UPDATE structured_memories SET status='resolved',last_seen_ts=?1 WHERE id=?2",
        params![ts,best.0]
      ).map_err(|e| format!("resolve active thread: {e}"))?;
    }
    Ok(())
}

fn distill_structured_memories(connection: &Connection, conversation: &str, ts: i64) -> Result<(), String> {
    let statement = user_statement(conversation);
    if statement.chars().count() < 5 { return Ok(()); }
    let normalized = normalize_search(&statement);

    if contains_any(&normalized,&["dung nho","dung luu","khong can nho","khong luu","quen chuyen nay"]) {
      return Ok(());
    }

    let resolved = contains_any(&normalized,&["xong roi","on roi","giai quyet xong","da xong","khong con van de"]);
    if resolved {
      resolve_recent_thread(connection,&statement,ts)?;
    }

    let preference = contains_any(&normalized,&[
      "anh thich","anh khong thich","anh muon","anh uu tien","anh thuong","thich nghe","hay nghe","anh can em"
    ]);
    let relationship = contains_any(&normalized,&[
      "vo","chong","gia dinh","tinh cam","moi quan he","dong doi","team","sep","ban be","nguoi yeu"
    ]);
    let emotional = contains_any(&normalized,&[
      "buon","met","cang thang","ap luc","buc","vui","co don","that vong","lo lang","kho chiu","chan","khuc mac"
    ]);
    let life_event = contains_any(&normalized,&[
      "hom nay","hom qua","ngay mai","tuan nay","vua ","sap ","da ","dang ","se ","moi "
    ]);
    let explicit_fact = contains_any(&normalized,&[
      "anh la","anh co","anh lam","anh dung","anh dang lam","cong viec cua anh","du an cua anh"
    ]);
    let active_thread = !resolved && contains_any(&normalized,&[
      "chua ","dang ","can ","phai ","van de","khuc mac","dang doi","cho ","mai ","sap ","do dang"
    ]);

    let mut linked_ids = Vec::new();
    if preference { if let Some(id) = upsert_structured_memory(connection,"preference",&statement,0.84,"stored",ts)? { linked_ids.push(id); } }
    if relationship { if let Some(id) = upsert_structured_memory(connection,"relationship_context",&statement,0.82,"stored",ts)? { linked_ids.push(id); } }
    if emotional { if let Some(id) = upsert_structured_memory(connection,"emotional_episode",&statement,0.76,"stored",ts)? { linked_ids.push(id); } }
    if life_event { if let Some(id) = upsert_structured_memory(connection,"life_event",&statement,0.72,"stored",ts)? { linked_ids.push(id); } }
    if explicit_fact { if let Some(id) = upsert_structured_memory(connection,"fact",&statement,0.78,"stored",ts)? { linked_ids.push(id); } }
    if active_thread { if let Some(id) = upsert_structured_memory(connection,"active_thread",&statement,0.88,"active",ts)? { linked_ids.push(id); } }
    link_structured_memories(connection,&linked_ids,ts)?;
    link_recent_related_memories(connection,&linked_ids,&statement,ts)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn desktop_memory_save_episode(app: AppHandle, text: String) -> Result<(), String> {
    let text = clip(&text, 9000);
    if text.is_empty() { return Ok(()); }
    let ts = now_ms();
    let connection = open(&app)?;
    connection.execute("INSERT INTO episodes(text,ts) VALUES (?1,?2)", params![text,ts])
      .map_err(|e| format!("save episode: {e}"))?;
    distill_structured_memories(&connection,&text,ts)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn desktop_memory_save_affect(app: AppHandle, row: MemoryAffect) -> Result<(), String> {
    if !permission_enabled(&app, "memory.affect", true) { return Ok(()); }
    open(&app)?.execute(
      "INSERT INTO affect(mood,confidence,valence,arousal,engagement,fatigue,tension,ts) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
      params![clip(&row.mood,40),row.confidence.clamp(0.0,1.0),row.valence,row.arousal,row.engagement,row.fatigue,row.tension,if row.ts > 0 { row.ts } else { now_ms() }]
    ).map_err(|e| format!("save affect: {e}"))?;
    Ok(())
}

fn normalize_search(input: &str) -> String {
    let folded: String = input
      .to_lowercase()
      .replace('đ',"d")
      .nfd()
      .filter(|c| !is_combining_mark(*c))
      .collect();
    folded
      .chars()
      .map(|c| if c.is_alphanumeric() { c } else { ' ' })
      .collect::<String>()
      .split_whitespace()
      .collect::<Vec<_>>()
      .join(" ")
}

fn tokens(input: &str) -> Vec<String> {
    normalize_search(input)
      .split_whitespace()
      .filter(|t| t.chars().count() > 1)
      .map(ToOwned::to_owned)
      .collect()
}

fn similarity(query: &[String], text: &str) -> f64 {
    if query.is_empty() { return 0.0; }
    let hay_tokens = tokens(text);
    let hits = query.iter().filter(|token| hay_tokens.iter().any(|candidate| candidate == *token)).count();
    let overlap = hits as f64 / query.len() as f64;
    let phrase = query.join(" ");
    let normalized_text = normalize_search(text);
    (overlap + if phrase.chars().count() >= 4 && normalized_text.contains(&phrase) { 0.18 } else { 0.0 }).min(1.0)
}

#[tauri::command]
pub(crate) fn desktop_memory_recall(app: AppHandle, query: String) -> Result<String, String> {
    let connection = open(&app)?;
    let query_tokens = tokens(&query);
    if query_tokens.is_empty() { return Ok(String::new()); }
    let mut candidates: Vec<(String,f64,i64)> = Vec::new();

    {
      let mut statement = connection.prepare("SELECT role,text,ts FROM turns ORDER BY ts DESC,id DESC LIMIT 260")
        .map_err(|e| format!("prepare recall turns: {e}"))?;
      let rows = statement.query_map([], |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,i64>(2)?)))
        .map_err(|e| format!("recall turns: {e}"))?;
      for row in rows {
        let (role,text,ts) = row.map_err(|e| format!("recall row: {e}"))?;
        let score = similarity(&query_tokens,&text);
        if score > 0.08 {
          let prefix = if role == "mira" { "Mira: " } else { "Người dùng: " };
          candidates.push((format!("{prefix}{text}"),score,ts));
        }
      }
    }
    {
      let mut statement = connection.prepare("SELECT text,ts FROM episodes ORDER BY ts DESC,id DESC LIMIT 120")
        .map_err(|e| format!("prepare recall episodes: {e}"))?;
      let rows = statement.query_map([], |row| Ok((row.get::<_,String>(0)?,row.get::<_,i64>(1)?)))
        .map_err(|e| format!("recall episodes: {e}"))?;
      for row in rows {
        let (text,ts) = row.map_err(|e| format!("episode row: {e}"))?;
        let score = similarity(&query_tokens,&text);
        if score > 0.08 { candidates.push((text,score + 0.03,ts)); }
      }
    }
    candidates.sort_by(|a,b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal).then_with(|| b.2.cmp(&a.2)));
    candidates.truncate(6);

    let mut structured_candidates: Vec<(i64,String,String,f64,String,i64,i64,f64)> = Vec::new();
    {
      let mut statement = connection.prepare(
        "SELECT id,kind,text,importance,status,last_seen_ts,hit_count FROM structured_memories ORDER BY last_seen_ts DESC LIMIT 240"
      ).map_err(|e| format!("prepare structured recall: {e}"))?;
      let rows = statement.query_map([],|row| Ok((
        row.get::<_,i64>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?,
        row.get::<_,f64>(3)?,row.get::<_,String>(4)?,row.get::<_,i64>(5)?,row.get::<_,i64>(6)?
      ))).map_err(|e| format!("structured recall: {e}"))?;
      for row in rows {
        let (id,kind,text,importance,status,last_seen_ts,hit_count) = row.map_err(|e| format!("structured recall row: {e}"))?;
        let lexical = similarity(&query_tokens,&text);
        let age_days = ((now_ms() - last_seen_ts).max(0) as f64) / 86_400_000.0;
        let recency = (0.14 - age_days / 180.0).max(0.0);
        let reinforcement = ((hit_count.min(8) as f64) * 0.008).min(0.064);
        let kind_bonus = match kind.as_str() {
          "preference" => 0.08,
          "relationship_context" => 0.07,
          "active_thread" if status == "active" => 0.12,
          _ => 0.03,
        };
        let score = lexical + importance * 0.18 + recency + reinforcement + kind_bonus;
        if lexical > 0.08 {
          structured_candidates.push((id,kind,text,importance,status,last_seen_ts,hit_count,score));
        }
      }
    }
    structured_candidates.sort_by(|a,b| b.7.partial_cmp(&a.7).unwrap_or(std::cmp::Ordering::Equal).then_with(|| b.5.cmp(&a.5)));
    structured_candidates.truncate(5);

    let selected_ids = structured_candidates.iter().map(|item| item.0).collect::<Vec<_>>();
    let mut linked_context: Vec<(String,String,String,f64,i64)> = Vec::new();
    for selected_id in selected_ids {
      let mut statement = connection.prepare(
        "SELECT sm.kind,sm.text,sm.status,ml.weight,sm.last_seen_ts
         FROM memory_links ml
         JOIN structured_memories sm
           ON sm.id=CASE WHEN ml.source_id=?1 THEN ml.target_id ELSE ml.source_id END
         WHERE (ml.source_id=?1 OR ml.target_id=?1)
         ORDER BY ml.weight DESC,sm.last_seen_ts DESC LIMIT 4"
      ).map_err(|e| format!("prepare linked memory recall: {e}"))?;
      let rows = statement.query_map([selected_id],|row| Ok((
        row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?,
        row.get::<_,f64>(3)?,row.get::<_,i64>(4)?
      ))).map_err(|e| format!("linked memory recall: {e}"))?;
      for row in rows {
        let candidate = row.map_err(|e| format!("linked memory row: {e}"))?;
        let already_selected = structured_candidates.iter().any(|selected| selected.2 == candidate.1);
        if !already_selected && !linked_context.iter().any(|existing| existing.1 == candidate.1) {
          linked_context.push(candidate);
        }
      }
    }
    linked_context.sort_by(|a,b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal).then_with(|| b.4.cmp(&a.4)));
    linked_context.truncate(4);

    let mut active_threads = Vec::new();
    {
      let cutoff = now_ms() - 7 * 24 * 60 * 60_000;
      let mut statement = connection.prepare(
        "SELECT text,last_seen_ts FROM structured_memories WHERE kind='active_thread' AND status='active' AND last_seen_ts>=?1 ORDER BY last_seen_ts DESC LIMIT 3"
      ).map_err(|e| format!("prepare active thread recall: {e}"))?;
      let rows = statement.query_map([cutoff],|row| Ok((row.get::<_,String>(0)?,row.get::<_,i64>(1)?)))
        .map_err(|e| format!("active thread recall: {e}"))?;
      active_threads = rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect active threads: {e}"))?;
    }

    let mut parts = Vec::new();
    if !structured_candidates.is_empty() {
      let lines = structured_candidates.iter()
        .map(|(_,kind,text,_,status,_,_,_)| format!("- [{}{}] {}",structured_kind_label(kind),if status == "resolved" {" · đã giải quyết"} else {""},text))
        .collect::<Vec<_>>().join("\n");
      parts.push(format!(
        "Ký ức có cấu trúc — chỉ là những điều người dùng từng tự nói, không phải suy luận của Mira:\n{lines}"
      ));
    }
    if !linked_context.is_empty() {
      let lines = linked_context.iter()
        .map(|(kind,text,status,_,_)| format!("- [{}{}] {}",structured_kind_label(kind),if status == "resolved" {" · đã giải quyết"} else {""},text))
        .collect::<Vec<_>>().join("\n");
      parts.push(format!(
        "Ký ức liên kết từ cùng bối cảnh trước đây (dùng để nối mạch, không tự suy diễn thêm):\n{lines}"
      ));
    }
    if !active_threads.is_empty() {
      let lines = active_threads.iter().map(|(text,_)| format!("- {text}")).collect::<Vec<_>>().join("\n");
      parts.push(format!(
        "Mạch đang theo dõi gần đây (chỉ nhắc lại khi phù hợp với câu chuyện hiện tại):\n{lines}"
      ));
    }
    if !candidates.is_empty() {
      let lines = candidates.iter().map(|(text,_,_)| format!("- {text}")).collect::<Vec<_>>().join("\n");
      parts.push(format!("Ký ức cục bộ liên quan:\n{lines}"));
    }

    let recent = connection.query_row(
      "SELECT mood,confidence,valence,arousal,engagement,fatigue,tension,ts FROM affect ORDER BY ts DESC,id DESC LIMIT 1",
      [], |row| Ok(MemoryAffect {
        mood: row.get(0)?, confidence: row.get(1)?, valence: row.get(2)?, arousal: row.get(3)?,
        engagement: row.get(4)?, fatigue: row.get(5)?, tension: row.get(6)?, ts: row.get(7)?
      })
    ).optional().map_err(|e| format!("recent affect: {e}"))?;
    if let Some(a) = recent {
      if now_ms() - a.ts < 45 * 60_000 && a.confidence >= 0.55 {
        parts.push(format!(
          "Tín hiệu biểu cảm gần đây: {} (độ tin cậy khoảng {}%; valence {:.2}; arousal {}%; engagement {}%). Đây chỉ là tín hiệu hành vi quan sát được, không phải kết luận về cảm xúc hay sức khỏe.",
          a.mood,(a.confidence*100.0).round() as i64,a.valence.unwrap_or(0.0),
          (a.arousal.unwrap_or(0.0)*100.0).round() as i64,(a.engagement.unwrap_or(0.0)*100.0).round() as i64
        ));
      }
    }
    Ok(parts.join("\n\n"))
}

#[tauri::command]
pub(crate) fn desktop_memory_graph(app: AppHandle) -> Result<StructuredMemoryGraph, String> {
    let connection = open(&app)?;
    let nodes = {
      let mut statement = connection.prepare(
        "SELECT sm.id,sm.kind,sm.text,sm.importance,sm.status,sm.first_seen_ts,sm.last_seen_ts,sm.hit_count,
                (SELECT COUNT(*) FROM memory_links ml WHERE ml.source_id=sm.id OR ml.target_id=sm.id) AS link_count
         FROM structured_memories sm
         ORDER BY CASE WHEN sm.kind='active_thread' AND sm.status='active' THEN 0 ELSE 1 END,
                  sm.last_seen_ts DESC,sm.id DESC
         LIMIT 240"
      ).map_err(|e| format!("prepare memory graph nodes: {e}"))?;
      let rows = statement.query_map([],|row| Ok(StructuredMemoryNode {
        id: row.get(0)?,
        kind: row.get(1)?,
        text: row.get(2)?,
        importance: row.get(3)?,
        status: row.get(4)?,
        first_seen_ts: row.get(5)?,
        last_seen_ts: row.get(6)?,
        hit_count: row.get(7)?,
        link_count: row.get(8)?,
      })).map_err(|e| format!("memory graph nodes: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect memory graph nodes: {e}"))?
    };

    let node_ids = nodes.iter().map(|node| node.id).collect::<HashSet<_>>();
    let links = if node_ids.is_empty() {
      Vec::new()
    } else {
      let mut statement = connection.prepare(
        "SELECT source_id,target_id,relation,weight,created_at
         FROM memory_links
         ORDER BY weight DESC,created_at DESC
         LIMIT 600"
      ).map_err(|e| format!("prepare memory graph links: {e}"))?;
      let rows = statement.query_map([],|row| Ok(StructuredMemoryLink {
        source_id: row.get(0)?,
        target_id: row.get(1)?,
        relation: row.get(2)?,
        weight: row.get(3)?,
        created_at: row.get(4)?,
      })).map_err(|e| format!("memory graph links: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>()
        .map_err(|e| format!("collect memory graph links: {e}"))?
        .into_iter()
        .filter(|link| node_ids.contains(&link.source_id) && node_ids.contains(&link.target_id))
        .collect()
    };

    Ok(StructuredMemoryGraph { nodes, links })
}

#[tauri::command]
pub(crate) fn desktop_memory_structured_update(app: AppHandle, patch: StructuredMemoryPatch) -> Result<(), String> {
    if patch.id <= 0 { return Err("memory id is invalid".into()); }
    let mut connection = open(&app)?;
    let current = connection.query_row(
      "SELECT kind,text,importance,status FROM structured_memories WHERE id=?1",
      [patch.id],
      |row| Ok((
        row.get::<_,String>(0)?,
        row.get::<_,String>(1)?,
        row.get::<_,f64>(2)?,
        row.get::<_,String>(3)?,
      ))
    ).optional().map_err(|e| format!("read structured memory: {e}"))?
      .ok_or_else(|| "structured memory not found".to_string())?;

    let next_text = patch.text.as_deref().map(|value| clip(value,1200)).unwrap_or_else(|| current.1.clone());
    if next_text.chars().count() < 4 { return Err("memory text is too short".into()); }
    let next_importance = patch.importance.unwrap_or(current.2).clamp(0.0,1.0);
    let requested_status = patch.status.as_deref().unwrap_or(&current.3).trim().to_lowercase();
    let next_status = match requested_status.as_str() {
      "stored" | "resolved" => requested_status,
      "active" if current.0 == "active_thread" => requested_status,
      _ => return Err("memory status is invalid for this kind".into()),
    };
    let normalized = normalize_search(&next_text);

    let duplicate = connection.query_row(
      "SELECT id FROM structured_memories WHERE kind=?1 AND normalized_text=?2 AND id<>?3 LIMIT 1",
      params![&current.0,&normalized,patch.id],
      |row| row.get::<_,i64>(0)
    ).optional().map_err(|e| format!("check structured memory duplicate: {e}"))?;
    if duplicate.is_some() { return Err("another memory with the same normalized text already exists".into()); }

    let text_changed = next_text != current.1;
    let tx = connection.transaction().map_err(|e| format!("structured memory update transaction: {e}"))?;
    tx.execute(
      "UPDATE structured_memories
       SET text=?1,normalized_text=?2,importance=?3,status=?4,last_seen_ts=?5
       WHERE id=?6",
      params![next_text,normalized,next_importance,next_status,now_ms(),patch.id]
    ).map_err(|e| format!("update structured memory: {e}"))?;

    if text_changed {
      tx.execute(
        "DELETE FROM memory_links
         WHERE relation='semantic_temporal' AND (source_id=?1 OR target_id=?1)",
        [patch.id]
      ).map_err(|e| format!("invalidate semantic memory links: {e}"))?;
    }

    tx.commit().map_err(|e| format!("commit structured memory update: {e}"))
}

#[tauri::command]
pub(crate) fn desktop_memory_structured_delete(app: AppHandle, id: i64) -> Result<(), String> {
    if id <= 0 { return Err("memory id is invalid".into()); }
    let changed = open(&app)?.execute("DELETE FROM structured_memories WHERE id=?1",[id])
      .map_err(|e| format!("delete structured memory: {e}"))?;
    if changed == 0 { return Err("structured memory not found".into()); }
    Ok(())
}

#[tauri::command]
pub(crate) fn desktop_memory_import_structured(
    app: AppHandle,
    nodes: Vec<ImportStructuredMemory>,
    links: Vec<ImportStructuredMemoryLink>,
) -> Result<(), String> {
    let now = now_ms();
    let mut connection = open(&app)?;
    let tx = connection.transaction().map_err(|e| format!("structured memory import transaction: {e}"))?;
    let mut id_map = HashMap::<i64,i64>::new();

    for node in nodes.into_iter().take(240) {
      let old_id = node.id.unwrap_or(0);
      if old_id <= 0 { continue; }

      let kind = clip(&node.kind,40);
      if !matches!(kind.as_str(),"fact"|"preference"|"life_event"|"relationship_context"|"emotional_episode"|"active_thread") {
        continue;
      }

      let text = clip(&node.text,1200);
      if text.chars().count() < 4 { continue; }
      let normalized = normalize_search(&text);
      let status = match node.status.as_str() {
        "resolved" => "resolved",
        "active" if kind == "active_thread" => "active",
        _ => "stored",
      };
      let first_seen = if node.first_seen_ts > 0 { node.first_seen_ts.min(now) } else { now };
      let last_seen = if node.last_seen_ts > 0 { node.last_seen_ts.min(now).max(first_seen) } else { now.max(first_seen) };
      let hit_count = node.hit_count.clamp(1,10_000);

      tx.execute(
        "INSERT INTO structured_memories(kind,text,normalized_text,importance,status,first_seen_ts,last_seen_ts,hit_count)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(kind,normalized_text) DO UPDATE SET
           importance=MAX(structured_memories.importance,excluded.importance),
           status=CASE WHEN structured_memories.status='resolved' THEN 'resolved' ELSE excluded.status END,
           first_seen_ts=MIN(structured_memories.first_seen_ts,excluded.first_seen_ts),
           last_seen_ts=MAX(structured_memories.last_seen_ts,excluded.last_seen_ts),
           hit_count=MAX(structured_memories.hit_count,excluded.hit_count)",
        params![kind,text,normalized,node.importance.clamp(0.0,1.0),status,first_seen,last_seen,hit_count]
      ).map_err(|e| format!("import structured memory: {e}"))?;

      let current_id = tx.query_row(
        "SELECT id FROM structured_memories WHERE kind=?1 AND normalized_text=?2",
        params![kind,normalized],
        |row| row.get::<_,i64>(0)
      ).map_err(|e| format!("resolve imported structured memory: {e}"))?;
      id_map.insert(old_id,current_id);
    }

    for link in links.into_iter().take(600) {
      let Some(source_id) = id_map.get(&link.source_id).copied() else { continue; };
      let Some(target_id) = id_map.get(&link.target_id).copied() else { continue; };
      if source_id == target_id { continue; }
      let relation = match link.relation.as_str() {
        "co_occurs" => "co_occurs",
        "semantic_temporal" => "semantic_temporal",
        _ => continue,
      };
      let (source_id,target_id) = if source_id < target_id { (source_id,target_id) } else { (target_id,source_id) };
      let created_at = if link.created_at > 0 { link.created_at.min(now) } else { now };
      tx.execute(
        "INSERT INTO memory_links(source_id,target_id,relation,weight,created_at)
         VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(source_id,target_id,relation) DO UPDATE SET
           weight=MAX(memory_links.weight,excluded.weight),
           created_at=MAX(memory_links.created_at,excluded.created_at)",
        params![source_id,target_id,relation,link.weight.clamp(0.0,3.0),created_at]
      ).map_err(|e| format!("import structured memory link: {e}"))?;
    }

    tx.commit().map_err(|e| format!("commit structured memory import: {e}"))
}

#[tauri::command]
pub(crate) fn desktop_memory_clear(app: AppHandle) -> Result<(), String> {
    open(&app)?.execute_batch("DELETE FROM turns; DELETE FROM episodes; DELETE FROM structured_memories; DELETE FROM affect;")
      .map_err(|e| format!("clear memory: {e}"))
}

#[tauri::command]
pub(crate) fn desktop_memory_import_turns(app: AppHandle, items: Vec<ImportTurn>) -> Result<(), String> {
    let mut connection = open(&app)?;
    let tx = connection.transaction().map_err(|e| format!("import transaction: {e}"))?;
    for item in items.into_iter().take(500) {
      let role = if item.role.as_deref() == Some("mira") { "mira" } else { "user" };
      let text = clip(item.text.as_deref().unwrap_or_default(),6000);
      if text.is_empty() { continue; }
      let _created_at = item.created_at;
      let ts = item.ts.filter(|v| *v > 0).unwrap_or_else(now_ms);
      tx.execute("INSERT INTO turns(role,text,ts) VALUES (?1,?2,?3)",params![role,text,ts])
        .map_err(|e| format!("import turn: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit import: {e}"))
}

#[tauri::command]
pub(crate) fn desktop_memory_export(app: AppHandle) -> Result<MemorySnapshot, String> {
    let connection = open(&app)?;
    let turns = {
      let mut s = connection.prepare("SELECT role,text,ts FROM turns ORDER BY ts ASC,id ASC").map_err(|e| format!("export turns: {e}"))?;
      let rows = s.query_map([],|row| Ok(MemoryTurn{role:row.get(0)?,text:row.get(1)?,ts:row.get(2)?})).map_err(|e| format!("turn rows: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect turns: {e}"))?
    };
    let episodes = {
      let mut s = connection.prepare("SELECT text,ts FROM episodes ORDER BY ts ASC,id ASC").map_err(|e| format!("export episodes: {e}"))?;
      let rows = s.query_map([],|row| Ok(MemoryEpisode{text:row.get(0)?,ts:row.get(1)?})).map_err(|e| format!("episode rows: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect episodes: {e}"))?
    };
    let structured_memories = {
      let mut s = connection.prepare(
        "SELECT id,kind,text,importance,status,first_seen_ts,last_seen_ts,hit_count FROM structured_memories ORDER BY last_seen_ts ASC,id ASC"
      ).map_err(|e| format!("export structured memories: {e}"))?;
      let rows = s.query_map([],|row| Ok(StructuredMemory{
        id:row.get(0)?,kind:row.get(1)?,text:row.get(2)?,importance:row.get(3)?,status:row.get(4)?,
        first_seen_ts:row.get(5)?,last_seen_ts:row.get(6)?,hit_count:row.get(7)?
      })).map_err(|e| format!("structured memory rows: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect structured memories: {e}"))?
    };
    let memory_links = {
      let mut s = connection.prepare(
        "SELECT source_id,target_id,relation,weight,created_at FROM memory_links ORDER BY created_at ASC,source_id ASC,target_id ASC"
      ).map_err(|e| format!("export memory links: {e}"))?;
      let rows = s.query_map([],|row| Ok(StructuredMemoryLink{
        source_id:row.get(0)?,target_id:row.get(1)?,relation:row.get(2)?,weight:row.get(3)?,created_at:row.get(4)?
      })).map_err(|e| format!("memory link rows: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect memory links: {e}"))?
    };
    let affects = {
      let mut s = connection.prepare("SELECT mood,confidence,valence,arousal,engagement,fatigue,tension,ts FROM affect ORDER BY ts ASC,id ASC")
        .map_err(|e| format!("export affect: {e}"))?;
      let rows = s.query_map([],|row| Ok(MemoryAffect{
        mood:row.get(0)?,confidence:row.get(1)?,valence:row.get(2)?,arousal:row.get(3)?,
        engagement:row.get(4)?,fatigue:row.get(5)?,tension:row.get(6)?,ts:row.get(7)?
      })).map_err(|e| format!("affect rows: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect affect: {e}"))?
    };
    Ok(MemorySnapshot{exported_at:now_ms().to_string(),turns,episodes,structured_memories,memory_links,affects})
}

#[tauri::command]
pub(crate) fn desktop_permission_get(app: AppHandle, key: String) -> Result<bool, String> {
    open(&app)?.query_row("SELECT value FROM permissions WHERE key=?1",[clip(&key,120)],|row| row.get::<_,i64>(0))
      .optional().map(|v| v.unwrap_or(0) != 0).map_err(|e| format!("read permission: {e}"))
}

#[tauri::command]
pub(crate) fn desktop_permission_set(app: AppHandle, key: String, value: bool) -> Result<(), String> {
    let key = clip(&key,120);
    if key.is_empty() { return Err("permission key is empty".into()); }
    open(&app)?.execute(
      "INSERT INTO permissions(key,value,updated_at) VALUES (?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
      params![key,if value {1} else {0},now_ms()]
    ).map_err(|e| format!("write permission: {e}"))?;
    Ok(())
}

pub(crate) fn log_action(app: &AppHandle, action: &str, outcome: &str, detail: &str) {
    if let Ok(connection) = open(app) {
      let _ = connection.execute(
        "INSERT INTO action_history(action,outcome,detail,ts) VALUES (?1,?2,?3,?4)",
        params![clip(action,80),clip(outcome,40),clip(detail,800),now_ms()]
      );
    }
}
