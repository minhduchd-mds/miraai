use crate::memory;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::{collections::HashMap, fs, path::{Path, PathBuf}, process::Command};
use tauri::AppHandle;
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

const MAX_LIBRARY_TRACKS: usize = 20_000;
const MAX_SCAN_DEPTH: usize = 12;
const AUDIO_EXTENSIONS: &[&str] = &["mp3","m4a","aac","flac","wav","ogg","opus"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaActionResult {
    action: String,
    handled: bool,
    detail: String,
    query: Option<String>,
    source: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MusicLibraryStatus {
    enabled: bool,
    root: Option<String>,
    track_count: i64,
    last_scan_at: Option<i64>,
}

#[derive(Clone)]
struct IndexedTrack {
    id: i64,
    path: String,
    title: String,
    artist: String,
    album: String,
    search_text: String,
    last_played_at: i64,
    play_count: i64,
}

fn clip(input: &str, max_chars: usize) -> String {
    input.trim().chars().take(max_chars).collect()
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

fn audio_extension(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    AUDIO_EXTENSIONS.contains(&ext.as_str()).then_some(ext)
}

fn collect_audio_files(root: &Path, current: &Path, depth: usize, out: &mut Vec<PathBuf>) -> Result<(), String> {
    if depth > MAX_SCAN_DEPTH || out.len() >= MAX_LIBRARY_TRACKS { return Ok(()); }
    let entries = fs::read_dir(current).map_err(|e| format!("scan {}: {e}", current.display()))?;
    for entry in entries {
      if out.len() >= MAX_LIBRARY_TRACKS { break; }
      let entry = match entry { Ok(value) => value, Err(_) => continue };
      let file_type = match entry.file_type() { Ok(value) => value, Err(_) => continue };
      if file_type.is_symlink() { continue; }
      let path = entry.path();
      if file_type.is_dir() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        collect_audio_files(root,&path,depth + 1,out)?;
      } else if file_type.is_file() && audio_extension(&path).is_some() {
        if path.starts_with(root) { out.push(path); }
      }
    }
    Ok(())
}

fn track_fields(path: &Path, root: &Path) -> (String,String,String,String,String) {
    let stem = path.file_stem().map(|value| value.to_string_lossy().trim().to_string()).unwrap_or_else(|| "Unknown".into());
    let (artist,title) = match stem.split_once(" - ") {
      Some((left,right)) if !left.trim().is_empty() && !right.trim().is_empty() => (left.trim().to_string(),right.trim().to_string()),
      _ => (String::new(),stem.clone()),
    };
    let album = path.parent()
      .filter(|parent| *parent != root)
      .and_then(|parent| parent.file_name())
      .map(|value| value.to_string_lossy().to_string())
      .unwrap_or_default();
    let ext = audio_extension(path).unwrap_or_default();
    let file_name = path.file_name().map(|value| value.to_string_lossy().to_string()).unwrap_or_default();
    let search_text = normalize_search(&format!("{title} {artist} {album} {file_name}"));
    (title,artist,album,search_text,ext)
}

fn scan_music_library(app: &AppHandle, root: &Path) -> Result<MusicLibraryStatus,String> {
    let root = root.canonicalize().map_err(|e| format!("music root: {e}"))?;
    if !root.is_dir() { return Err("Thư mục nhạc không hợp lệ.".into()); }
    let mut files = Vec::new();
    collect_audio_files(&root,&root,0,&mut files)?;
    let root_text = root.to_string_lossy().to_string();
    let indexed_at = memory::timestamp_ms();
    let mut connection = memory::database(app)?;
    let tx = connection.transaction().map_err(|e| format!("music scan transaction: {e}"))?;

    for path in files {
      let path_text = path.to_string_lossy().to_string();
      let (title,artist,album,search_text,ext) = track_fields(&path,&root);
      tx.execute(
        "INSERT INTO music_tracks(path,root,title,artist,album,search_text,ext,indexed_at,added_at,last_played_at,play_count) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,0,0) ON CONFLICT(path) DO UPDATE SET root=excluded.root,title=excluded.title,artist=excluded.artist,album=excluded.album,search_text=excluded.search_text,ext=excluded.ext,indexed_at=excluded.indexed_at",
        params![path_text,root_text,title,artist,album,search_text,ext,indexed_at]
      ).map_err(|e| format!("index music track: {e}"))?;
    }

    tx.execute("DELETE FROM music_tracks WHERE root=?1 AND indexed_at<>?2",params![root_text,indexed_at]).map_err(|e| format!("prune music index: {e}"))?;
    tx.execute("DELETE FROM music_tracks WHERE root<>?1",params![root_text]).map_err(|e| format!("remove previous music root: {e}"))?;
    tx.commit().map_err(|e| format!("commit music scan: {e}"))?;

    memory::setting_set(app,"music.library.root",&root_text)?;
    memory::setting_set(app,"music.library.last_scan_at",&indexed_at.to_string())?;
    memory::desktop_permission_set(app.clone(),"media.library".into(),true)?;
    music_library_status(app)
}

fn music_library_status(app: &AppHandle) -> Result<MusicLibraryStatus,String> {
    let enabled = memory::permission_enabled(app,"media.library",false);
    let root = memory::setting_get(app,"music.library.root")?.filter(|value| !value.is_empty());
    let last_scan_at = memory::setting_get(app,"music.library.last_scan_at")?.and_then(|value| value.parse::<i64>().ok());
    let track_count = if let Some(root_value) = root.as_deref() {
      memory::database(app)?.query_row("SELECT COUNT(*) FROM music_tracks WHERE root=?1",[root_value],|row| row.get::<_,i64>(0)).unwrap_or(0)
    } else { 0 };
    Ok(MusicLibraryStatus{enabled,root,track_count,last_scan_at})
}

#[cfg(target_os = "macos")]
fn choose_music_folder() -> Result<PathBuf,String> {
    let script = "POSIX path of (choose folder with prompt \"Chọn thư mục nhạc cho Mira\")";
    let out = Command::new("osascript").args(["-e",script]).output().map_err(|e| format!("folder picker: {e}"))?;
    if !out.status.success() { return Err("Anh chưa chọn thư mục nhạc.".into()); }
    let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if value.is_empty() { return Err("Anh chưa chọn thư mục nhạc.".into()); }
    Ok(PathBuf::from(value))
}

#[cfg(target_os = "windows")]
fn choose_music_folder() -> Result<PathBuf,String> {
    let script = "Add-Type -AssemblyName System.Windows.Forms; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Chọn thư mục nhạc cho Mira'; $d.ShowNewFolderButton=$false; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[Console]::Write($d.SelectedPath)}";
    let out = Command::new("powershell.exe").args(["-NoProfile","-STA","-Command",script]).output().map_err(|e| format!("folder picker: {e}"))?;
    if !out.status.success() { return Err("Không mở được hộp chọn thư mục nhạc.".into()); }
    let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if value.is_empty() { return Err("Anh chưa chọn thư mục nhạc.".into()); }
    Ok(PathBuf::from(value))
}

#[cfg(not(any(target_os = "macos",target_os = "windows")))]
fn choose_music_folder() -> Result<PathBuf,String> {
    Err("Mira Desktop music library hiện hỗ trợ macOS và Windows.".into())
}

#[cfg(target_os = "macos")]
fn open_local_track(path: &str) -> Result<(),String> {
    Command::new("open").arg(path).spawn().map(|_| ()).map_err(|e| format!("open local track: {e}"))
}

#[cfg(target_os = "windows")]
fn open_local_track(path: &str) -> Result<(),String> {
    Command::new("rundll32.exe").arg("url.dll,FileProtocolHandler").arg(path).spawn().map(|_| ()).map_err(|e| format!("open local track: {e}"))
}

#[cfg(not(any(target_os = "macos",target_os = "windows")))]
fn open_local_track(_path: &str) -> Result<(),String> {
    Err("Local playback hiện hỗ trợ macOS và Windows.".into())
}

fn load_library_tracks(app: &AppHandle) -> Result<Vec<IndexedTrack>,String> {
    let root = match memory::setting_get(app,"music.library.root")? {
      Some(value) if !value.is_empty() => value,
      _ => return Ok(Vec::new()),
    };
    let connection = memory::database(app)?;
    let mut statement = connection.prepare("SELECT id,path,title,artist,album,search_text,last_played_at,play_count FROM music_tracks WHERE root=?1 LIMIT 20000").map_err(|e| format!("prepare music library: {e}"))?;
    let rows = statement.query_map([root],|row| Ok(IndexedTrack{
      id:row.get(0)?,path:row.get(1)?,title:row.get(2)?,artist:row.get(3)?,album:row.get(4)?,search_text:row.get(5)?,last_played_at:row.get(6)?,play_count:row.get(7)?
    })).map_err(|e| format!("query music library: {e}"))?;
    rows.collect::<Result<Vec<_>,_>>().map_err(|e| format!("collect music library: {e}"))
}

fn track_score(query: &str, track: &IndexedTrack) -> f64 {
    let q = normalize_search(query);
    if q.is_empty() { return 0.0; }
    let title = normalize_search(&track.title);
    let artist_title = normalize_search(&format!("{} {}",track.artist,track.title));
    if title == q { return 1.0; }
    if !track.artist.is_empty() && artist_title == q { return 0.99; }
    if title.contains(&q) { return 0.92; }
    if track.search_text.contains(&q) { return 0.82; }
    let q_tokens = q.split_whitespace().collect::<Vec<_>>();
    if q_tokens.is_empty() { return 0.0; }
    let hits = q_tokens.iter().filter(|token| track.search_text.split_whitespace().any(|candidate| candidate == **token)).count();
    let mut score = hits as f64 / q_tokens.len() as f64 * 0.72;
    if track.last_played_at > 0 { score += 0.04; }
    if track.play_count > 2 { score += 0.02; }
    score.min(0.9)
}

fn find_local_track(app: &AppHandle, query: &str) -> Result<Option<IndexedTrack>,String> {
    if !memory::permission_enabled(app,"media.library",false) { return Ok(None); }
    let mut tracks = load_library_tracks(app)?;
    tracks.sort_by(|a,b| {
      let sb = track_score(query,b);
      let sa = track_score(query,a);
      sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal).then_with(|| b.last_played_at.cmp(&a.last_played_at))
    });
    Ok(tracks.into_iter().find(|track| track_score(query,track) >= 0.34))
}

fn recent_local_track(app: &AppHandle) -> Result<Option<IndexedTrack>,String> {
    if !memory::permission_enabled(app,"media.library",false) { return Ok(None); }
    let root = match memory::setting_get(app,"music.library.root")? { Some(value) if !value.is_empty() => value, _ => return Ok(None) };
    memory::database(app)?.query_row(
      "SELECT id,path,title,artist,album,search_text,last_played_at,play_count FROM music_tracks WHERE root=?1 AND last_played_at>0 ORDER BY last_played_at DESC,id DESC LIMIT 1",
      [root],
      |row| Ok(IndexedTrack{id:row.get(0)?,path:row.get(1)?,title:row.get(2)?,artist:row.get(3)?,album:row.get(4)?,search_text:row.get(5)?,last_played_at:row.get(6)?,play_count:row.get(7)?})
    ).optional().map_err(|e| format!("recent local track: {e}"))
}

fn context_tokens(input: &str) -> Vec<String> {
    normalize_search(input)
      .split_whitespace()
      .filter(|token| token.chars().count() > 1)
      .map(ToOwned::to_owned)
      .collect()
}

fn context_similarity(query: &str, text: &str) -> f64 {
    let query_tokens = context_tokens(query);
    if query_tokens.is_empty() { return 0.0; }
    let hay = context_tokens(text);
    let hits = query_tokens.iter().filter(|token| hay.iter().any(|candidate| candidate == *token)).count();
    hits as f64 / query_tokens.len() as f64
}

fn contextual_local_track(app: &AppHandle, query: &str) -> Result<Option<IndexedTrack>,String> {
    if !memory::permission_enabled(app,"media.library",false) { return Ok(None); }
    let root = match memory::setting_get(app,"music.library.root")? { Some(value) if !value.is_empty() => value, _ => return Ok(None) };
    let connection = memory::database(app)?;
    let mut statement = connection.prepare(
      "SELECT mt.id,mt.path,mt.title,mt.artist,mt.album,mt.search_text,mt.last_played_at,mt.play_count,mch.context_text,mch.played_at
       FROM music_context_history mch
       JOIN music_tracks mt ON mt.id=mch.track_id
       WHERE mt.root=?1
       ORDER BY mch.played_at DESC LIMIT 1500"
    ).map_err(|e| format!("prepare contextual music: {e}"))?;
    let rows = statement.query_map([root],|row| Ok((
      IndexedTrack{
        id:row.get(0)?,path:row.get(1)?,title:row.get(2)?,artist:row.get(3)?,
        album:row.get(4)?,search_text:row.get(5)?,last_played_at:row.get(6)?,play_count:row.get(7)?
      },
      row.get::<_,String>(8)?,
      row.get::<_,i64>(9)?
    ))).map_err(|e| format!("contextual music rows: {e}"))?;

    let now = memory::timestamp_ms();
    let mut best_by_track: HashMap<i64,(IndexedTrack,f64,u32)> = HashMap::new();
    for row in rows {
      let (track,context_text,played_at) = row.map_err(|e| format!("contextual music row: {e}"))?;
      let lexical = context_similarity(query,&context_text);
      if lexical <= 0.0 { continue; }
      let age_days = ((now - played_at).max(0) as f64) / 86_400_000.0;
      let recency = (0.16 - age_days / 240.0).max(0.0);
      let entry = best_by_track.entry(track.id).or_insert((track.clone(),0.0,0));
      entry.1 = entry.1.max(lexical + recency);
      entry.2 = entry.2.saturating_add(1);
    }
    let mut ranked = best_by_track.into_values().map(|(track,base,count)| {
      let repeat = ((count.min(8) as f64) * 0.025).min(0.2);
      let score = base + repeat + if track.play_count > 2 { 0.03 } else { 0.0 };
      (track,score)
    }).collect::<Vec<_>>();
    ranked.sort_by(|a,b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal).then_with(|| b.0.last_played_at.cmp(&a.0.last_played_at)));
    Ok(ranked.into_iter().find(|(_,score)| *score >= 0.42).map(|(track,_)| track))
}

fn explicit_context_hint(input: &str) -> Option<(String,String)> {
    let normalized = normalize_search(input);
    if normalized.is_empty() { return None; }
    if ["dung nho","dung luu","khong can nho","khong luu"].iter().any(|needle| normalized.contains(needle)) { return None; }
    if normalized.contains("hay nghe") || normalized.contains("thuong nghe") { return None; }
    let cues = [
      "met","buon","cang thang","ap luc","lo lang","chan","co don","vui",
      "thu gian","lam viec","tap trung","hoc","lai xe"
    ];
    if cues.iter().any(|cue| normalized.contains(cue)) {
      return Some(("user_statement".into(),clip(input,600)));
    }
    None
}

fn record_music_context(app: &AppHandle, track_id: i64, explicit_context: Option<&str>, now: i64) -> Result<(),String> {
    let connection = memory::database(app)?;
    let explicit = explicit_context.and_then(explicit_context_hint);
    let linked = if explicit.is_none() {
      connection.query_row(
        "SELECT id,kind,text FROM structured_memories
         WHERE kind IN ('emotional_episode','active_thread','relationship_context','life_event','preference')
           AND last_seen_ts>=?1
         ORDER BY CASE kind WHEN 'emotional_episode' THEN 0 WHEN 'active_thread' THEN 1 ELSE 2 END,last_seen_ts DESC
         LIMIT 1",
        [now - 45 * 60_000],
        |row| Ok((row.get::<_,i64>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?))
      ).optional().map_err(|e| format!("recent music context: {e}"))?
    } else { None };

    let (memory_id,kind,text) = if let Some((kind,text)) = explicit {
      (None,kind,text)
    } else if let Some((id,kind,text)) = linked {
      (Some(id),kind,text)
    } else {
      return Ok(());
    };

    connection.execute(
      "INSERT INTO music_context_history(track_id,memory_id,context_kind,context_text,played_at) VALUES (?1,?2,?3,?4,?5)",
      params![track_id,memory_id,clip(&kind,60),clip(&text,800),now]
    ).map_err(|e| format!("save music context: {e}"))?;
    connection.execute(
      "DELETE FROM music_context_history WHERE id NOT IN (SELECT id FROM music_context_history ORDER BY played_at DESC,id DESC LIMIT 5000)",
      []
    ).map_err(|e| format!("prune music context: {e}"))?;
    Ok(())
}

fn play_indexed_track(app: &AppHandle, track: &IndexedTrack, explicit_context: Option<&str>) -> Result<String,String> {
    if !Path::new(&track.path).is_file() { return Err(format!("File “{}” không còn tồn tại. Anh có thể quét lại thư viện nhạc.",track.title)); }
    open_local_track(&track.path)?;
    let now = memory::timestamp_ms();
    memory::database(app)?.execute("UPDATE music_tracks SET last_played_at=?1,play_count=play_count+1 WHERE id=?2",params![now,track.id]).map_err(|e| format!("update play history: {e}"))?;
    record_music_context(app,track.id,explicit_context,now)?;
    let label = if track.artist.trim().is_empty() { track.title.clone() } else { format!("{} — {}",track.title,track.artist) };
    let album = if track.album.trim().is_empty() { String::new() } else { format!(" · {}",track.album) };
    Ok(format!("Đang mở {label}{album} từ thư viện nhạc local."))
}

#[cfg(target_os = "macos")]
fn platform_media(action: &str, query: Option<&str>) -> Result<String,String> {
    if action == "search" {
      let term = query.map(|value| clip(value,180)).unwrap_or_default();
      if term.is_empty() { return Err("missing track query".into()); }
      let script = "on run argv\nset term to item 1 of argv\ntell application \"Music\"\nactivate\nset matches to search playlist \"Library\" for term only songs\nif (count of matches) is 0 then return \"not_found\"\nplay item 1 of matches\nset picked to item 1 of matches\nreturn (name of picked) & \" — \" & (artist of picked)\nend tell\nend run";
      let out = Command::new("osascript").args(["-e",script,&term]).output().map_err(|e| format!("osascript search: {e}"))?;
      if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()); }
      let picked = String::from_utf8_lossy(&out.stdout).trim().to_string();
      if picked == "not_found" || picked.is_empty() { return Err(format!("Không tìm thấy “{term}” trong Music.")); }
      return Ok(format!("Đang phát {picked} từ ứng dụng Music trên macOS."));
    }
    let script = match action {
      "open" | "play" => "tell application \"Music\" to play",
      "pause" => "tell application \"Music\" to pause",
      "next" => "tell application \"Music\" to next track",
      "previous" => "tell application \"Music\" to previous track",
      _ => return Err("unsupported media action".into()),
    };
    let out = Command::new("osascript").args(["-e",script]).output().map_err(|e| format!("osascript: {e}"))?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()); }
    Ok("Đã gửi lệnh tới ứng dụng Music trên macOS.".into())
}

#[cfg(target_os = "windows")]
fn percent_encode(input: &str) -> String {
    let mut out = String::new();
    for byte in input.as_bytes() {
      match *byte {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(*byte as char),
        b' ' => out.push_str("%20"),
        value => out.push_str(&format!("%{value:02X}")),
      }
    }
    out
}

#[cfg(target_os = "windows")]
fn platform_media(action: &str, query: Option<&str>) -> Result<String,String> {
    use std::{thread,time::Duration};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{keybd_event,KEYEVENTF_KEYUP,VK_MEDIA_NEXT_TRACK,VK_MEDIA_PLAY_PAUSE,VK_MEDIA_PREV_TRACK};
    if action == "search" {
      let term = query.map(|value| clip(value,180)).unwrap_or_default();
      if term.is_empty() { return Err("missing track query".into()); }
      let uri = format!("spotify:search:{}",percent_encode(&term));
      Command::new("cmd").args(["/C","start","",&uri]).spawn().map_err(|e| format!("open Spotify search: {e}"))?;
      return Ok(format!("Đã mở tìm kiếm “{term}” trong Spotify. Windows media session không bảo đảm tự phát bài khi chỉ có tên bài."));
    }
    if action == "open" {
      let _ = Command::new("cmd").args(["/C","start","","mswindowsmusic:"]).spawn();
      thread::sleep(Duration::from_millis(750));
    }
    let key = match action {
      "open" | "play" | "pause" => VK_MEDIA_PLAY_PAUSE as u8,
      "next" => VK_MEDIA_NEXT_TRACK as u8,
      "previous" => VK_MEDIA_PREV_TRACK as u8,
      _ => return Err("unsupported media action".into()),
    };
    unsafe { keybd_event(key,0,0,0); keybd_event(key,0,KEYEVENTF_KEYUP,0); }
    Ok(if action == "play" || action == "pause" { "Đã gửi phím media play/pause tới phiên media hiện tại trên Windows.".into() } else { "Đã gửi media key tới phiên phát nhạc hiện tại trên Windows.".into() })
}

#[cfg(not(any(target_os = "macos",target_os = "windows")))]
fn platform_media(_action: &str, _query: Option<&str>) -> Result<String,String> {
    Err("Mira Desktop media control hiện hỗ trợ macOS và Windows.".into())
}

#[tauri::command]
pub(crate) fn desktop_music_library_status(app: AppHandle) -> Result<MusicLibraryStatus,String> { music_library_status(&app) }

#[tauri::command]
pub(crate) fn desktop_music_choose_folder(app: AppHandle) -> Result<MusicLibraryStatus,String> {
    let root = choose_music_folder()?;
    scan_music_library(&app,&root)
}

#[tauri::command]
pub(crate) fn desktop_music_rescan(app: AppHandle) -> Result<MusicLibraryStatus,String> {
    if !memory::permission_enabled(&app,"media.library",false) { return Err("Quyền đọc thư viện nhạc local đang tắt.".into()); }
    let root = memory::setting_get(&app,"music.library.root")?.ok_or_else(|| "Chưa chọn thư mục nhạc.".to_string())?;
    scan_music_library(&app,Path::new(&root))
}

#[tauri::command]
pub(crate) fn desktop_media_action(app: AppHandle, action: String, query: Option<String>, context: Option<String>) -> Result<MediaActionResult,String> {
    let action = action.trim().to_lowercase();
    if !matches!(action.as_str(),"open"|"play"|"pause"|"next"|"previous"|"search"|"recent"|"contextual") { return Err("unsupported media action".into()); }
    if !memory::permission_enabled(&app,"media.control",true) {
      let detail = "Quyền điều khiển nhạc đang tắt trong Ký ức & riêng tư.".to_string();
      memory::log_action(&app,&format!("media.{action}"),"blocked",&detail);
      return Ok(MediaActionResult{action,handled:false,detail,query,source:None});
    }
    let normalized_query = query.as_deref().map(|value| clip(value,180)).filter(|value| !value.is_empty());

    if action == "recent" {
      let result = recent_local_track(&app)?.ok_or_else(|| "Mira chưa có bài local nào trong lịch sử nghe.".to_string());
      return match result.and_then(|track| play_indexed_track(&app,&track,None)) {
        Ok(detail) => { memory::log_action(&app,"media.recent","executed",&detail); Ok(MediaActionResult{action,handled:true,detail,query:None,source:Some("local-library".into())}) }
        Err(error) => { memory::log_action(&app,"media.recent","failed",&error); Ok(MediaActionResult{action,handled:false,detail:error,query:None,source:Some("local-library".into())}) }
      };
    }

    if action == "contextual" {
      let term = normalized_query.as_deref().unwrap_or_default();
      let result = contextual_local_track(&app,term)?.ok_or_else(|| format!("Mira chưa có đủ lịch sử nhạc local gắn với bối cảnh “{term}”."));
      return match result.and_then(|track| play_indexed_track(&app,&track,None)) {
        Ok(detail) => {
          let detail = format!("{detail} Em chọn bài này từ lịch sử nghe có bối cảnh tương tự.");
          memory::log_action(&app,"media.contextual","executed",&detail);
          Ok(MediaActionResult{action,handled:true,detail,query:normalized_query,source:Some("local-context-memory".into())})
        }
        Err(error) => {
          memory::log_action(&app,"media.contextual","failed",&error);
          Ok(MediaActionResult{action,handled:false,detail:error,query:normalized_query,source:Some("local-context-memory".into())})
        }
      };
    }

    if action == "search" {
      if let Some(term) = normalized_query.as_deref() {
        if let Some(track) = find_local_track(&app,term)? {
          match play_indexed_track(&app,&track,context.as_deref()) {
            Ok(detail) => {
              memory::log_action(&app,"media.search.local","executed",&detail);
              return Ok(MediaActionResult{action,handled:true,detail,query:normalized_query,source:Some("local-library".into())});
            }
            Err(error) => memory::log_action(&app,"media.search.local","failed",&error),
          }
        }
      }
    }

    match platform_media(&action,normalized_query.as_deref()) {
      Ok(detail) => {
        memory::log_action(&app,&format!("media.{action}"),"executed",&detail);
        Ok(MediaActionResult{action,handled:true,detail,query:normalized_query,source:Some("system-player".into())})
      }
      Err(error) => {
        memory::log_action(&app,&format!("media.{action}"),"failed",&error);
        Ok(MediaActionResult{action,handled:false,detail:error,query:normalized_query,source:Some("system-player".into())})
      }
    }
}
