use serde::Serialize;
use tauri::AppHandle;
use crate::memory;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaActionResult {
    action: String,
    handled: bool,
    detail: String,
    query: Option<String>,
}

fn clip(input: &str, max_chars: usize) -> String {
    input.trim().chars().take(max_chars).collect()
}

#[cfg(target_os = "macos")]
fn platform_media(action: &str, query: Option<&str>) -> Result<String,String> {
    use std::process::Command;

    if action == "search" {
      let term = query.map(|value| clip(value,180)).unwrap_or_default();
      if term.is_empty() { return Err("missing track query".into()); }
      let script = r#"
on run argv
  set term to item 1 of argv
  tell application "Music"
    activate
    set matches to search playlist "Library" for term only songs
    if (count of matches) is 0 then return "not_found"
    play item 1 of matches
    set picked to item 1 of matches
    return (name of picked) & " — " & (artist of picked)
  end tell
end run
"#;
      let out = Command::new("osascript")
        .args(["-e", script, &term])
        .output()
        .map_err(|e| format!("osascript search: {e}"))?;
      if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
      }
      let picked = String::from_utf8_lossy(&out.stdout).trim().to_string();
      if picked == "not_found" || picked.is_empty() {
        return Err(format!("Không tìm thấy “{term}” trong thư viện Music cục bộ."));
      }
      return Ok(format!("Đang phát {picked} từ thư viện Music trên macOS."));
    }

    let script = match action {
      "open" | "play" => r#"tell application "Music" to play"#,
      "pause" => r#"tell application "Music" to pause"#,
      "next" => r#"tell application "Music" to next track"#,
      "previous" => r#"tell application "Music" to previous track"#,
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
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
      keybd_event,KEYEVENTF_KEYUP,VK_MEDIA_NEXT_TRACK,VK_MEDIA_PLAY_PAUSE,VK_MEDIA_PREV_TRACK
    };

    if action == "search" {
      let term = query.map(|value| clip(value,180)).unwrap_or_default();
      if term.is_empty() { return Err("missing track query".into()); }
      let uri = format!("spotify:search:{}", percent_encode(&term));
      std::process::Command::new("cmd")
        .args(["/C","start","",&uri])
        .spawn()
        .map_err(|e| format!("open Spotify search: {e}"))?;
      return Ok(format!("Đã mở tìm kiếm “{term}” trong Spotify. Windows media session không bảo đảm tự phát bài khi chỉ có tên bài."));
    }

    if action == "open" {
      let _ = std::process::Command::new("cmd").args(["/C","start","","mswindowsmusic:"]).spawn();
      thread::sleep(Duration::from_millis(750));
    }
    let key = match action {
      "open" | "play" | "pause" => VK_MEDIA_PLAY_PAUSE as u8,
      "next" => VK_MEDIA_NEXT_TRACK as u8,
      "previous" => VK_MEDIA_PREV_TRACK as u8,
      _ => return Err("unsupported media action".into()),
    };
    unsafe {
      keybd_event(key,0,0,0);
      keybd_event(key,0,KEYEVENTF_KEYUP,0);
    }
    Ok(if action == "play" || action == "pause" {
      "Đã gửi phím media play/pause tới phiên media hiện tại trên Windows.".into()
    } else {
      "Đã gửi media key tới phiên phát nhạc hiện tại trên Windows.".into()
    })
}

#[cfg(not(any(target_os = "macos",target_os = "windows")))]
fn platform_media(_action: &str, _query: Option<&str>) -> Result<String,String> {
    Err("Mira Desktop media control hiện hỗ trợ macOS và Windows.".into())
}

#[tauri::command]
pub(crate) fn desktop_media_action(
    app: AppHandle,
    action: String,
    query: Option<String>,
) -> Result<MediaActionResult,String> {
    let action = action.trim().to_lowercase();
    if !matches!(action.as_str(),"open"|"play"|"pause"|"next"|"previous"|"search") {
      return Err("unsupported media action".into());
    }

    if !memory::permission_enabled(&app, "media.control", true) {
      let detail = "Quyền điều khiển nhạc đang tắt trong Ký ức & riêng tư.".to_string();
      memory::log_action(&app,&format!("media.{action}"),"blocked",&detail);
      return Ok(MediaActionResult{action,handled:false,detail,query});
    }

    let normalized_query = query.as_deref().map(|value| clip(value,180)).filter(|value| !value.is_empty());
    match platform_media(&action, normalized_query.as_deref()) {
      Ok(detail) => {
        memory::log_action(&app,&format!("media.{action}"),"executed",&detail);
        Ok(MediaActionResult{action,handled:true,detail,query:normalized_query})
      }
      Err(error) => {
        memory::log_action(&app,&format!("media.{action}"),"failed",&error);
        Ok(MediaActionResult{action,handled:false,detail:error,query:normalized_query})
      }
    }
}
