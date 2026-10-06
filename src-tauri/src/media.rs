use serde::Serialize;
use tauri::AppHandle;
use crate::memory;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaActionResult { action: String, handled: bool, detail: String }

#[cfg(target_os = "macos")]
fn platform_media(action: &str) -> Result<String,String> {
    use std::process::Command;
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
fn platform_media(action: &str) -> Result<String,String> {
    use std::{thread,time::Duration};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
      keybd_event,KEYEVENTF_KEYUP,VK_MEDIA_NEXT_TRACK,VK_MEDIA_PLAY_PAUSE,VK_MEDIA_PREV_TRACK
    };
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
fn platform_media(_action: &str) -> Result<String,String> {
    Err("Mira Desktop media control hiện hỗ trợ macOS và Windows.".into())
}

#[tauri::command]
pub(crate) fn desktop_media_action(app: AppHandle, action: String) -> Result<MediaActionResult,String> {
    let action = action.trim().to_lowercase();
    if !matches!(action.as_str(),"open"|"play"|"pause"|"next"|"previous") {
      return Err("unsupported media action".into());
    }
    match platform_media(&action) {
      Ok(detail) => {
        memory::log_action(&app,&format!("media.{action}"),"executed",&detail);
        Ok(MediaActionResult{action,handled:true,detail})
      }
      Err(error) => {
        memory::log_action(&app,&format!("media.{action}"),"failed",&error);
        Ok(MediaActionResult{action,handled:false,detail:error})
      }
    }
}
