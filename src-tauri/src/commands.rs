use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::sync::Mutex;
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::ai::{self, HostContext};
use crate::library::{self, Track};
use crate::media::{self, Lyrics};
use crate::online::{self, OnlineTrackContext};
use crate::player::{self, Command, Event};
use crate::tts;

pub struct AppState {
    pub player_tx: Mutex<Sender<Command>>,
}

async fn blocking_task<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|err| format!("background task failed: {err}"))?
}

#[derive(Debug, Clone, Serialize)]
struct TrackChangedPayload {
    index: usize,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
struct PlaybackStatePayload {
    playing: bool,
}

#[derive(Debug, Clone, Serialize)]
struct PositionPayload {
    position_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
struct SubtitlePayload {
    text: String,
    active: bool,
}

#[derive(Debug, Clone, Serialize)]
struct ErrorPayload {
    message: String,
}

#[derive(Debug, Clone, Serialize)]
struct SpectrumPayload {
    bands: Vec<f32>,
}

pub fn init_player(app: &AppHandle) -> Sender<Command> {
    let (tx, rx) = player::spawn();
    let handle = app.clone();
    thread::spawn(move || {
        for event in rx.iter() {
            match event {
                Event::TrackChanged(t) => {
                    let _ = handle.emit(
                        "playback:track-changed",
                        TrackChangedPayload {
                            index: t.index,
                            path: t.path,
                        },
                    );
                }
                Event::PlaybackState(s) => {
                    let _ = handle.emit(
                        "playback:state",
                        PlaybackStatePayload { playing: s.playing },
                    );
                }
                Event::PlaybackPosition(p) => {
                    let _ = handle.emit(
                        "playback:position",
                        PositionPayload {
                            position_ms: p.position_ms,
                        },
                    );
                }
                Event::Subtitle(s) => {
                    let _ = handle.emit(
                        "playback:subtitle",
                        SubtitlePayload {
                            text: s.text,
                            active: s.active,
                        },
                    );
                }
                Event::Spectrum(s) => {
                    let _ = handle.emit("playback:spectrum", SpectrumPayload { bands: s.bands });
                }
                Event::Error(message) => {
                    let _ = handle.emit("playback:error", ErrorPayload { message });
                }
            }
        }
    });
    tx
}

fn send_command(state: &tauri::State<'_, AppState>, cmd: Command) -> Result<(), String> {
    let tx = state.player_tx.lock().map_err(|e| format!("lock: {e}"))?;
    tx.send(cmd).map_err(|e| format!("send: {e}"))
}

#[tauri::command]
pub async fn scan_library(folder: String) -> Result<Vec<Track>, String> {
    blocking_task(move || library::scan(std::path::Path::new(&folder))).await
}

#[tauri::command]
pub fn set_playlist(
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    send_command(&state, Command::SetPlaylist(paths))
}

#[tauri::command]
pub fn play_index(state: tauri::State<'_, AppState>, index: usize) -> Result<(), String> {
    send_command(&state, Command::PlayIndex(index))
}

#[tauri::command]
pub fn toggle_playback(state: tauri::State<'_, AppState>) -> Result<(), String> {
    send_command(&state, Command::Toggle)
}

#[tauri::command]
pub fn next_track(state: tauri::State<'_, AppState>) -> Result<(), String> {
    send_command(&state, Command::Next)
}

#[tauri::command]
pub fn prev_track(state: tauri::State<'_, AppState>) -> Result<(), String> {
    send_command(&state, Command::Prev)
}

#[tauri::command]
pub fn set_volume(state: tauri::State<'_, AppState>, volume: f32) -> Result<(), String> {
    send_command(&state, Command::SetVolume(volume))
}

#[tauri::command]
pub fn seek(state: tauri::State<'_, AppState>, position_ms: u64) -> Result<(), String> {
    send_command(
        &state,
        Command::Seek(std::time::Duration::from_millis(position_ms)),
    )
}

#[tauri::command]
pub fn queue_append(
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    send_command(&state, Command::QueueAppend(paths))
}

#[tauri::command]
pub fn queue_insert_next(
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    send_command(&state, Command::QueueInsertNext(paths))
}

#[tauri::command]
pub fn queue_remove_at(
    state: tauri::State<'_, AppState>,
    index: usize,
) -> Result<(), String> {
    send_command(&state, Command::QueueRemoveAt(index))
}

#[tauri::command]
pub async fn get_cover(path: String) -> Result<Option<String>, String> {
    blocking_task(move || media::get_cover(std::path::Path::new(&path))).await
}

#[tauri::command]
pub async fn get_cover_palette(source: String) -> Result<media::Palette, String> {
    blocking_task(move || media::cover_palette(&source)).await
}

#[tauri::command]
pub async fn get_lyrics(path: String) -> Result<Lyrics, String> {
    blocking_task(move || media::get_lyrics(std::path::Path::new(&path))).await
}

#[tauri::command]
pub async fn search_online(
    query: String,
    limit: usize,
) -> Result<Vec<OnlineTrackContext>, String> {
    blocking_task(move || online::search_contexts(&query, limit.max(1))).await
}

#[tauri::command]
pub async fn fetch_online_lyrics(provider: String, provider_id: String) -> Result<Lyrics, String> {
    blocking_task(move || online::fetch_lyrics(&provider, &provider_id)).await
}

#[tauri::command]
pub async fn fetch_track_comments(
    provider: String,
    comment_id: String,
    limit: usize,
) -> Result<Vec<String>, String> {
    blocking_task(move || online::fetch_comments(&provider, &comment_id, limit.max(1))).await
}

#[tauri::command]
pub async fn fetch_hot_chart(limit: usize) -> Result<Vec<String>, String> {
    blocking_task(move || online::qq_hot_queries(limit.max(1))).await
}

#[derive(Debug, Deserialize)]
pub struct OnlineTrackRequest {
    pub play_url: String,
}

#[tauri::command]
pub fn play_online(
    state: tauri::State<'_, AppState>,
    track: OnlineTrackRequest,
) -> Result<(), String> {
    let path = PathBuf::from(track.play_url);
    send_command(&state, Command::SetPlaylist(vec![path]))?;
    send_command(&state, Command::PlayIndex(0))
}

#[tauri::command]
pub async fn generate_host_line(
    app: AppHandle,
    context: HostContext,
) -> Result<String, String> {
    blocking_task(move || ai::generate_line(Some(&app), &context)).await
}

#[tauri::command]
pub async fn chat_with_host(
    app: AppHandle,
    message: String,
    context: HostContext,
) -> Result<String, String> {
    blocking_task(move || ai::chat_reply(Some(&app), &message, &context)).await
}

#[derive(Debug, Clone, Serialize)]
pub struct HostActionResponse {
    pub action: String,
    pub query: Option<String>,
    pub queries: Vec<String>,
    pub chart: Option<String>,
    pub reply: String,
    pub playlist_name: Option<String>,
}

#[tauri::command]
pub async fn plan_host_action(
    app: AppHandle,
    message: String,
    context: HostContext,
) -> Result<HostActionResponse, String> {
    blocking_task(move || {
        let action = ai::plan_action(Some(&app), &message, &context)?;
        let kind = match action.action {
            ai::HostActionKind::Chat => "chat",
            ai::HostActionKind::SearchSong => "search_song",
            ai::HostActionKind::PlayChart => "play_chart",
            ai::HostActionKind::ExplainCurrent => "explain_current",
            ai::HostActionKind::AddToQueue => "add_to_queue",
            ai::HostActionKind::PlayNext => "play_next",
            ai::HostActionKind::CreatePlaylist => "create_playlist",
            ai::HostActionKind::AddToPlaylist => "add_to_playlist",
        };
        Ok(HostActionResponse {
            action: kind.to_string(),
            query: action.query,
            queries: action.queries,
            chart: action.chart,
            reply: action.reply,
            playlist_name: action.playlist_name,
        })
    })
    .await
}

#[tauri::command]
pub async fn speak_line(
    state: tauri::State<'_, AppState>,
    text: String,
    voice: Option<String>,
) -> Result<(), String> {
    let player_tx = state
        .player_tx
        .lock()
        .map_err(|e| format!("lock: {e}"))?
        .clone();
    let voice = voice.unwrap_or_else(|| tts::DEFAULT_VOICE.to_string());
    blocking_task(move || {
        let bytes = tts::synthesize(&text, &voice)?;
        player_tx
            .send(Command::PlayAnnouncement { bytes, text })
            .map_err(|e| format!("send: {e}"))
    })
    .await
}

pub fn handle(_app: &AppHandle) {}

pub fn register(app: &AppHandle) {
    let tx = init_player(app);
    app.manage(AppState {
        player_tx: Mutex::new(tx),
    });
}
