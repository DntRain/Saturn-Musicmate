use std::path::PathBuf;

use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const LOGIN_WINDOW_LABEL: &str = "qq-login";
const LOGIN_URL: &str = "https://y.qq.com/";

fn login_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法获取应用数据目录：{e}"))?;
    Ok(base.join("qq-login-store"))
}

fn locate_project_root() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let candidates = [cwd.clone(), cwd.parent()?.to_path_buf()];
    for base in candidates {
        if base.join("vendor/qq-music-api").is_dir()
            || base.join("qqcookies.txt").is_file()
            || base.join(".env.local").is_file()
        {
            return Some(base);
        }
    }
    Some(cwd)
}

#[tauri::command]
pub async fn open_qq_login(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        let _ = win.set_focus();
        return Ok(());
    }
    let data_dir = login_data_dir(&app)?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("创建登录数据目录失败：{e}"))?;
    let url = Url::parse(LOGIN_URL).map_err(|e| e.to_string())?;

    WebviewWindowBuilder::new(&app, LOGIN_WINDOW_LABEL, WebviewUrl::External(url))
        .title("登录 QQ 音乐")
        .inner_size(960.0, 720.0)
        .min_inner_size(720.0, 540.0)
        .data_directory(data_dir)
        .focused(true)
        .build()
        .map_err(|e| format!("创建登录窗口失败：{e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn import_qq_cookies(app: AppHandle) -> Result<String, String> {
    let win = app
        .get_webview_window(LOGIN_WINDOW_LABEL)
        .ok_or_else(|| "登录窗口未打开，请先点'登录 QQ 音乐'".to_string())?;
    let cookies = win.cookies().map_err(|e| format!("读取 cookie 失败：{e}"))?;

    let mut kept: Vec<(String, String)> = Vec::new();
    let mut has_keyst = false;
    let mut has_uin = false;
    for c in cookies {
        let domain = c.domain().unwrap_or("");
        if !domain.contains("qq.com") {
            continue;
        }
        let name = c.name().to_string();
        let value = c.value().to_string();
        if name.is_empty() || value.is_empty() {
            continue;
        }
        if name == "qm_keyst" {
            has_keyst = true;
        }
        if name == "uin" {
            has_uin = true;
        }
        if !kept.iter().any(|(k, _)| k == &name) {
            kept.push((name, value));
        }
    }

    if !has_keyst {
        return Err(
            "未抓到 qm_keyst（VIP 关键 cookie）。请在登录窗口完成 QQ 账号登录后再点'导入 Cookies'"
                .into(),
        );
    }
    if !has_uin {
        return Err("未抓到 uin（QQ 号），请确认已登录".into());
    }

    let formatted = kept
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("; ");

    let root = locate_project_root().ok_or_else(|| "找不到项目根目录".to_string())?;
    let path = root.join("qqcookies.txt");
    std::fs::write(&path, &formatted).map_err(|e| format!("写入 qqcookies.txt 失败：{e}"))?;

    let _ = win.close();
    crate::sidecar::restart(app.clone());

    Ok(format!(
        "已导入 {} 条 cookie（含 qm_keyst），正在重启在线服务…",
        kept.len()
    ))
}

#[tauri::command]
pub async fn close_qq_login(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        let _ = win.close();
    }
    Ok(())
}
