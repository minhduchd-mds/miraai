use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};
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

#[tauri::command]
pub(crate) fn desktop_memory_save_episode(app: AppHandle, text: String) -> Result<(), String> {
    let text = clip(&text, 9000);
    if text.is_empty() { return Ok(()); }
    open(&app)?.execute("INSERT INTO episodes(text,ts) VALUES (?1,?2)", params![text,now_ms()])
      .map_err(|e| format!("save episode: {e}"))?;
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

    let mut parts = Vec::new();
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
pub(crate) fn desktop_memory_clear(app: AppHandle) -> Result<(), String> {
    open(&app)?.execute_batch("DELETE FROM turns; DELETE FROM episodes; DELETE FROM affect;")
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
    let affects = {
      let mut s = connection.prepare("SELECT mood,confidence,valence,arousal,engagement,fatigue,tension,ts FROM affect ORDER BY ts ASC,id ASC")
        .map_err(|e| format!("export affect: {e}"))?;
      let rows = s.query_map([],|row| Ok(MemoryAffect{
        mood:row.get(0)?,confidence:row.get(1)?,valence:row.get(2)?,arousal:row.get(3)?,
        engagement:row.get(4)?,fatigue:row.get(5)?,tension:row.get(6)?,ts:row.get(7)?
      })).map_err(|e| format!("affect rows: {e}"))?;
      rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect affect: {e}"))?
    };
    Ok(MemorySnapshot{exported_at:now_ms().to_string(),turns,episodes,affects})
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
