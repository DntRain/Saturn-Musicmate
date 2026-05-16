use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";

const KEY_DEEPSEEK_KEY: &str = "deepseek_api_key";
const KEY_DEEPSEEK_MODEL: &str = "deepseek_model";
const KEY_QQ_API_BASE: &str = "qq_api_base";
const KEY_QQ_COOKIES: &str = "qq_cookies";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub deepseek_api_key: String,
    #[serde(default)]
    pub deepseek_model: String,
    #[serde(default)]
    pub qq_api_base: String,
    #[serde(default)]
    pub qq_cookies: String,
}

fn read_string<R: Runtime>(app: &AppHandle<R>, key: &str) -> String {
    let Ok(store) = app.store(STORE_FILE) else {
        return String::new();
    };
    store
        .get(key)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default()
}

fn write_string<R: Runtime>(app: &AppHandle<R>, key: &str, value: &str) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("打开设置存储失败：{e}"))?;
    store.set(key.to_string(), Value::String(value.to_string()));
    store
        .save()
        .map_err(|e| format!("保存设置失败：{e}"))
}

fn load(app: &AppHandle) -> Settings {
    Settings {
        deepseek_api_key: read_string(app, KEY_DEEPSEEK_KEY),
        deepseek_model: read_string(app, KEY_DEEPSEEK_MODEL),
        qq_api_base: read_string(app, KEY_QQ_API_BASE),
        qq_cookies: read_string(app, KEY_QQ_COOKIES),
    }
}

fn apply_env(settings: &Settings) {
    set_or_clear("DEEPSEEK_API_KEY", &settings.deepseek_api_key);
    set_or_clear("DEEPSEEK_MODEL", &settings.deepseek_model);
    set_or_clear("MUSICMATE_QQ_API_BASE", &settings.qq_api_base);
    set_or_clear("QQ_MUSIC_COOKIE", &settings.qq_cookies);
}

fn set_or_clear(key: &str, value: &str) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        std::env::remove_var(key);
    } else {
        std::env::set_var(key, trimmed);
    }
}

pub fn hydrate_env(app: &AppHandle) {
    apply_env(&load(app));
}

pub fn deepseek_api_key(app: Option<&AppHandle>) -> Result<String, String> {
    if let Ok(value) = std::env::var("DEEPSEEK_API_KEY") {
        let value = value.trim().to_string();
        if !value.is_empty() {
            return Ok(value);
        }
    }
    if let Some(app) = app {
        let stored = read_string(app, KEY_DEEPSEEK_KEY);
        let stored = stored.trim();
        if !stored.is_empty() {
            return Ok(stored.to_string());
        }
    }
    for path in ["deepseekapi.txt", "../deepseekapi.txt"] {
        if let Ok(value) = std::fs::read_to_string(path) {
            let value = value.trim().to_string();
            if !value.is_empty() {
                return Ok(value);
            }
        }
    }
    Err("DeepSeek API key 未配置。请在「设置」面板填入，或设置 DEEPSEEK_API_KEY 环境变量。".to_string())
}

pub fn deepseek_model(app: Option<&AppHandle>) -> String {
    if let Ok(value) = std::env::var("DEEPSEEK_MODEL") {
        let value = value.trim().to_string();
        if !value.is_empty() {
            return value;
        }
    }
    if let Some(app) = app {
        let stored = read_string(app, KEY_DEEPSEEK_MODEL);
        let stored = stored.trim();
        if !stored.is_empty() {
            return stored.to_string();
        }
    }
    "deepseek-v4-pro".to_string()
}

pub fn store_qq_cookies(app: &AppHandle, cookies: &str) -> Result<(), String> {
    write_string(app, KEY_QQ_COOKIES, cookies)?;
    std::env::set_var("QQ_MUSIC_COOKIE", cookies);
    Ok(())
}

#[tauri::command]
pub async fn settings_get(app: AppHandle) -> Result<Settings, String> {
    Ok(load(&app))
}

#[tauri::command]
pub async fn settings_save(app: AppHandle, settings: Settings) -> Result<SettingsSaveOutcome, String> {
    let previous = load(&app);

    write_string(&app, KEY_DEEPSEEK_KEY, settings.deepseek_api_key.trim())?;
    write_string(&app, KEY_DEEPSEEK_MODEL, settings.deepseek_model.trim())?;
    write_string(&app, KEY_QQ_API_BASE, settings.qq_api_base.trim())?;
    write_string(&app, KEY_QQ_COOKIES, settings.qq_cookies.trim())?;

    let saved = load(&app);
    apply_env(&saved);

    let sidecar_restarted = previous.qq_cookies.trim() != saved.qq_cookies.trim()
        || previous.qq_api_base.trim() != saved.qq_api_base.trim();
    if sidecar_restarted {
        crate::sidecar::restart(app.clone());
    }

    Ok(SettingsSaveOutcome {
        saved,
        sidecar_restarted,
    })
}

#[tauri::command]
pub async fn settings_test_deepseek(app: AppHandle) -> Result<Value, String> {
    let settings = load(&app);
    let key = settings.deepseek_api_key.trim().to_string();
    if key.is_empty() {
        return Err("尚未填写 DeepSeek API Key".into());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("http client: {e}"))?;
    let response = client
        .get("https://api.deepseek.com/v1/models")
        .bearer_auth(&key)
        .send()
        .map_err(|e| format!("请求失败：{e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().unwrap_or_default();
        return Err(format!("DeepSeek 返回 {status}：{body}"));
    }
    let payload: Value = response
        .json()
        .map_err(|e| format!("解析 DeepSeek 响应失败：{e}"))?;
    let model_count = payload
        .get("data")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    Ok(json!({
        "ok": true,
        "model_count": model_count,
    }))
}

#[derive(Debug, Serialize)]
pub struct SettingsSaveOutcome {
    pub saved: Settings,
    pub sidecar_restarted: bool,
}
