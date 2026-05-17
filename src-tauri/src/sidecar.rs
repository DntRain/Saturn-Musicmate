use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const QQ_API_PORT: u16 = 3200;
const VENDOR_DIR: &str = "vendor/qq-music-api";
const SERVICES_DIR: &str = ".services/qq-music-api";
const RESOURCE_SERVICE_DIR: &str = "qq-music-api";
const BUNDLED_RESOURCES_SERVICE_DIR: &str = "resources/qq-music-api";
const STARTUP_TIMEOUT_SECS: u64 = 90;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
pub struct SidecarState {
    pub child: Mutex<Option<Child>>,
}

#[derive(Serialize, Clone)]
struct StatusEvent {
    state: &'static str,
    message: String,
}

pub fn spawn_async(app: AppHandle) {
    thread::spawn(move || {
        if let Err(e) = run(&app) {
            emit(&app, "error", &e);
            eprintln!("[sidecar] {e}");
        }
    });
}

pub fn restart(app: AppHandle) {
    thread::spawn(move || {
        shutdown(&app);
        if port_in_use(QQ_API_PORT) {
            force_free_port(QQ_API_PORT);
        }
        let start = Instant::now();
        while port_in_use(QQ_API_PORT) && start.elapsed() < Duration::from_secs(8) {
            thread::sleep(Duration::from_millis(200));
        }
        emit(&app, "starting", "正在重启在线音乐服务…");
        if let Err(e) = run(&app) {
            emit(&app, "error", &e);
            eprintln!("[sidecar] restart failed: {e}");
        }
    });
}

#[cfg(unix)]
fn force_free_port(port: u16) {
    let pids = pids_on_port(port);
    for pid in &pids {
        unsafe { libc::kill(*pid, libc::SIGTERM) };
    }
    thread::sleep(Duration::from_millis(200));
    for pid in &pids {
        unsafe { libc::kill(*pid, libc::SIGKILL) };
    }
}

#[cfg(not(unix))]
fn force_free_port(port: u16) {
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-Command",
        &format!(
            "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | \
                 ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force }}"
        ),
    ])
    .creation_flags(CREATE_NO_WINDOW);
    if let Ok(out) = cmd.output() {
        let _ = out;
    }
}

#[cfg(unix)]
fn pids_on_port(port: u16) -> Vec<i32> {
    if let Ok(out) = Command::new("lsof")
        .args(["-tiTCP", &format!(":{port}"), "-sTCP:LISTEN"])
        .output()
    {
        let parsed: Vec<i32> = String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(|l| l.trim().parse().ok())
            .collect();
        if !parsed.is_empty() {
            return parsed;
        }
    }
    if let Ok(out) = Command::new("fuser").arg(format!("{port}/tcp")).output() {
        return String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .filter_map(|l| l.trim().parse().ok())
            .collect();
    }
    Vec::new()
}

fn run(app: &AppHandle) -> Result<(), String> {
    if has_remote_override() {
        emit(app, "ready", "使用自定义在线服务地址");
        return Ok(());
    }

    if port_in_use(QQ_API_PORT) {
        emit(app, "ready", "已检测到 QQ 音乐服务在 3200 端口运行");
        return Ok(());
    }

    let Some(vendor) = locate_vendor(Some(app)) else {
        emit(app, "idle", "");
        return Ok(());
    };

    if !vendor.join("node_modules").is_dir() {
        emit(app, "installing", "首次启动：正在安装在线服务依赖…");
        run_npm_install(&vendor)?;
    }

    emit(app, "starting", "正在启动在线音乐服务…");
    let child = start_node(&vendor)?;

    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut slot) = state.child.lock() {
            *slot = Some(child);
        }
    }

    wait_for_port(QQ_API_PORT, STARTUP_TIMEOUT_SECS).map_err(|e| format!("服务启动超时：{e}"))?;

    if std::env::var("MUSICMATE_QQ_API_BASE").is_err() {
        std::env::set_var(
            "MUSICMATE_QQ_API_BASE",
            format!("http://127.0.0.1:{QQ_API_PORT}"),
        );
    }
    emit(app, "ready", "在线音乐服务已就绪");
    Ok(())
}

fn emit(app: &AppHandle, state: &'static str, message: impl Into<String>) {
    let _ = app.emit(
        "sidecar:status",
        StatusEvent {
            state,
            message: message.into(),
        },
    );
}

fn has_remote_override() -> bool {
    let Ok(raw) = std::env::var("MUSICMATE_QQ_API_BASE") else {
        return false;
    };
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return false;
    }
    let default_url = format!("http://127.0.0.1:{QQ_API_PORT}");
    trimmed != default_url && trimmed != default_url.trim_end_matches('/')
}

fn locate_vendor(app: Option<&AppHandle>) -> Option<PathBuf> {
    let mut bases = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        bases.push(cwd.clone());
        if let Some(parent) = cwd.parent() {
            bases.push(parent.to_path_buf());
        }
        if let Some(parent) = cwd.parent().and_then(|p| p.parent()) {
            bases.push(parent.to_path_buf());
        }
    }
    if let Some(app) = app {
        if let Ok(resource_dir) = app.path().resource_dir() {
            bases.push(resource_dir);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            bases.push(parent.to_path_buf());
        }
    }

    for base in bases {
        for rel in [
            RESOURCE_SERVICE_DIR,
            BUNDLED_RESOURCES_SERVICE_DIR,
            VENDOR_DIR,
            SERVICES_DIR,
        ] {
            let candidate = base.join(rel);
            if candidate.join("package.json").is_file() {
                return Some(candidate.canonicalize().unwrap_or(candidate));
            }
        }
    }
    None
}

fn port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_millis(200)).is_ok()
}

fn wait_for_port(port: u16, timeout_secs: u64) -> Result<(), String> {
    let start = Instant::now();
    loop {
        if port_in_use(port) {
            return Ok(());
        }
        if start.elapsed() > Duration::from_secs(timeout_secs) {
            return Err(format!("{timeout_secs}s 内未监听 {port} 端口"));
        }
        thread::sleep(Duration::from_millis(400));
    }
}

fn run_npm_install(vendor: &PathBuf) -> Result<(), String> {
    let mut cmd = npm_command();
    cmd.args(["install", "--no-audit", "--no-fund", "--loglevel=error"])
        .current_dir(vendor)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    let status = cmd
        .status()
        .map_err(|e| format!("无法执行 npm install: {e}"))?;
    if !status.success() {
        return Err(format!("npm install 失败 (exit {status})"));
    }
    Ok(())
}

fn start_node(vendor: &PathBuf) -> Result<Child, String> {
    let bundled_node = find_bundled_node(vendor);
    let mut cmd = if let Some(node) = bundled_node {
        let mut cmd = Command::new(node);
        if vendor.join("src/app.js").is_file() {
            cmd.arg("src/app.js");
        } else {
            cmd.args(["-r", "ts-node/register/transpile-only", "src/app.ts"]);
        }
        cmd
    } else {
        let mut cmd = npm_command();
        cmd.args(["run", "start", "--silent"]);
        cmd
    };
    cmd.current_dir(vendor)
        .env("PORT", QQ_API_PORT.to_string())
        .env("AUTO_OPEN_EXPLORER", "false")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(cookie) = load_qq_cookie() {
        cmd.env("QQ_MUSIC_COOKIE", cookie);
    }
    #[cfg(unix)]
    cmd.process_group(0);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.spawn().map_err(|e| {
        format!("无法启动 QQ 音乐服务：{e}（安装包可能缺少内置服务，或本机未安装 Node.js）")
    })
}

fn find_bundled_node(vendor: &PathBuf) -> Option<PathBuf> {
    let mut bases = Vec::new();
    bases.push(vendor.clone());
    if let Some(parent) = vendor.parent() {
        bases.push(parent.to_path_buf());
    }
    if let Some(parent) = vendor.parent().and_then(|p| p.parent()) {
        bases.push(parent.to_path_buf());
    }
    for base in bases {
        for rel in ["node/node.exe", "node.exe", "node/bin/node", "node"] {
            let candidate = base.join(rel);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn load_qq_cookie() -> Option<String> {
    if let Ok(v) = std::env::var("QQ_MUSIC_COOKIE") {
        let v = v.trim().to_string();
        if !v.is_empty() {
            return Some(v);
        }
    }
    let project_root = locate_project_root()?;
    if let Some(cookie) = read_cookie_file(&project_root.join("qqcookies.txt")) {
        return Some(cookie);
    }
    if let Some(cookie) = read_env_local_cookie(&project_root.join(".env.local")) {
        return Some(cookie);
    }
    None
}

fn locate_project_root() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    for base in [cwd.clone(), cwd.parent()?.to_path_buf()] {
        if base.join("qqcookies.txt").is_file()
            || base.join(".env.local").is_file()
            || base.join("vendor/qq-music-api").is_dir()
            || base.join(".services/qq-music-api").is_dir()
        {
            return Some(base);
        }
    }
    Some(cwd)
}

fn read_cookie_file(path: &PathBuf) -> Option<String> {
    let raw = std::fs::read_to_string(path).ok()?;
    let text = raw.trim();
    let text = text
        .strip_prefix("Cookie:")
        .or_else(|| text.strip_prefix("cookie:"))
        .unwrap_or(text)
        .trim();
    let parts: Vec<String> = text
        .split(|c: char| c == ';' || c == '\n' || c == '\r')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && s.contains('='))
        .map(|s| s.to_string())
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("; "))
    }
}

fn read_env_local_cookie(path: &PathBuf) -> Option<String> {
    let raw = std::fs::read_to_string(path).ok()?;
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some(rest) = line.strip_prefix("QQ_MUSIC_COOKIE=") else {
            continue;
        };
        return Some(unescape_bash(rest));
    }
    None
}

fn unescape_bash(value: &str) -> String {
    // bash `printf %q` may wrap in single quotes or backslash-escape spaces / semicolons.
    let trimmed = value.trim();
    let trimmed = trimmed
        .strip_prefix('\'')
        .and_then(|s| s.strip_suffix('\''))
        .unwrap_or(trimmed);
    let trimmed = trimmed
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .unwrap_or(trimmed);
    let mut out = String::with_capacity(trimmed.len());
    let mut chars = trimmed.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next) = chars.peek() {
                out.push(next);
                chars.next();
                continue;
            }
        }
        out.push(c);
    }
    out
}

// On Windows, npm is a .cmd batch script and cannot be invoked directly via
// CreateProcess — cmd.exe must handle the .cmd extension lookup.
#[cfg(windows)]
fn npm_command() -> Command {
    let mut cmd = Command::new("cmd");
    cmd.args(["/c", "npm"]);
    cmd
}

#[cfg(not(windows))]
fn npm_command() -> Command {
    Command::new("npm")
}

pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut slot) = state.child.lock() {
            if let Some(mut child) = slot.take() {
                kill_tree(&child);
                let _ = child.wait();
            }
        }
    }
}

#[cfg(unix)]
fn kill_tree(child: &Child) {
    // child 自己即是新进程组的组长，pgid == pid
    let pid = child.id() as i32;
    unsafe {
        libc::kill(-pid, libc::SIGTERM);
    }
    thread::sleep(Duration::from_millis(150));
    unsafe {
        libc::kill(-pid, libc::SIGKILL);
    }
}

#[cfg(not(unix))]
fn kill_tree(child: &Child) {
    // Windows / 其他平台退而求其次
    let pid = child.id();
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
}
