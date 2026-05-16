use std::env;
use std::io::{self, Stdout, Write};
use std::path::Path;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};

use chrono::{Local, Timelike};
use crossterm::event::{self, Event as KeyEvent, KeyCode};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use musicmate_lib::ai::{self, HostContext, Persona, PlayedTrack, Trigger};
use musicmate_lib::library::Track;
use musicmate_lib::media::{self, Lyrics};
use musicmate_lib::online;
use musicmate_lib::player::{self, Command};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{
    Block, Borders, Gauge, List, ListItem, ListState, Paragraph, Wrap,
};
use ratatui::{Frame, Terminal};
use sha1::{Digest, Sha1};

const TRANSITION_EVERY: usize = 3;
const FALLBACK_LINES: &[&str] = &[
    "先放点音乐，专注力交给我。",
    "刚才那首挺好听，下一首继续。",
    "工作累了记得喝口水。",
];

type Term = Terminal<CrosstermBackend<Stdout>>;

struct App {
    tracks: Vec<Track>,
    selected: usize,
    current: Option<usize>,
    previous: Option<usize>,
    playing: bool,
    volume: f32,
    position_ms: u64,
    lyrics: Lyrics,
    host_text: String,
    host_active: bool,
    status: String,
    track_changes: usize,
    spoken_lines: Vec<String>,
    recent_tracks: Vec<PlayedTrack>,
    chat_lines: Vec<String>,
    list_state: ListState,
    search_mode: bool,
    search_input: String,
    chat_mode: bool,
    chat_input: String,
    last_cover_rendered: Option<String>,
    chat_busy: bool,
}

impl App {
    fn new(tracks: Vec<Track>, status: String) -> Self {
        let mut list_state = ListState::default();
        if !tracks.is_empty() {
            list_state.select(Some(0));
        }
        Self {
            tracks,
            selected: 0,
            current: None,
            previous: None,
            playing: false,
            volume: 0.8,
            position_ms: 0,
            lyrics: Lyrics::default(),
            host_text: "选择一首歌，按 Enter 或空格开始。".to_string(),
            host_active: false,
            status,
            track_changes: 0,
            spoken_lines: Vec::new(),
            recent_tracks: Vec::new(),
            chat_lines: Vec::new(),
            list_state,
            search_mode: false,
            search_input: String::new(),
            chat_mode: false,
            chat_input: String::new(),
            last_cover_rendered: None,
            chat_busy: false,
        }
    }

    fn selected_track(&self) -> Option<&Track> {
        self.tracks.get(self.selected)
    }

    fn current_track(&self) -> Option<&Track> {
        self.current.and_then(|i| self.tracks.get(i))
    }

    fn previous_track(&self) -> Option<&Track> {
        self.previous.and_then(|i| self.tracks.get(i))
    }

    fn select_next(&mut self) {
        if self.tracks.is_empty() {
            return;
        }
        self.selected = (self.selected + 1) % self.tracks.len();
        self.list_state.select(Some(self.selected));
    }

    fn select_prev(&mut self) {
        if self.tracks.is_empty() {
            return;
        }
        self.selected = if self.selected == 0 {
            self.tracks.len() - 1
        } else {
            self.selected - 1
        };
        self.list_state.select(Some(self.selected));
    }

    fn active_lyric_index(&self) -> Option<usize> {
        self.lyrics
            .synced
            .iter()
            .enumerate()
            .take_while(|(_, line)| line.time_ms <= self.position_ms)
            .map(|(i, _)| i)
            .last()
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let folder = env::args()
        .nth(1)
        .unwrap_or_else(|| "/tmp/musicmate-empty".to_string());
    std::fs::create_dir_all(&folder)?;

    let mut tracks = musicmate_lib::library::scan(Path::new(&folder)).map_err(io::Error::other)?;
    let mut status = if tracks.is_empty() {
        format!("No supported audio files found in {folder}")
    } else {
        format!("Loaded {} tracks from {folder}", tracks.len())
    };
    if tracks.is_empty() {
        if let Ok(query) = env::var("MUSICMATE_ONLINE_QUERY") {
            match online::fetch_context(&query) {
                Ok(context) => {
                    if let Some(play_url) = context.play_url {
                        status = format!("Loaded online track from {}: {}", context.provider, context.title);
                        tracks.push(Track {
                            path: play_url,
                            title: context.title,
                            artist: context.artist,
                            album: context.album,
                            duration_secs: None,
                            provider: Some(context.provider),
                            provider_id: context.provider_id,
                            cover_url: context.cover_url,
                        });
                    } else {
                        status = format!("Online match found, but no playable URL: {}", context.title);
                    }
                }
                Err(err) => {
                    status = format!("Online lookup failed: {err}");
                }
            }
        }
    }

    let (player_tx, player_rx) = player::spawn();
    player_tx.send(Command::SetPlaylist(
        tracks.iter().map(|track| track.path.clone().into()).collect(),
    ))?;

    let mut app = App::new(tracks, status);
    let mut terminal = setup_terminal()?;
    let result = run_app(&mut terminal, &mut app, player_tx, player_rx);
    restore_terminal(&mut terminal)?;
    result
}

fn run_app(
    terminal: &mut Term,
    app: &mut App,
    player_tx: Sender<Command>,
    player_rx: Receiver<player::Event>,
) -> Result<(), Box<dyn std::error::Error>> {
    let tick_rate = Duration::from_millis(120);
    let mut last_tick = Instant::now();
    let (host_tx, host_rx) = mpsc::channel::<HostTaskResult>();

    loop {
        drain_player_events(app, &player_tx, &player_rx);
        drain_host_events(app, &player_tx, &host_rx);
        terminal.draw(|frame| render(frame, app))?;
        render_kitty_cover(app);

        let timeout = tick_rate.saturating_sub(last_tick.elapsed());
        if event::poll(timeout)? {
            if let KeyEvent::Key(key) = event::read()? {
                match key.code {
                    _ if app.chat_mode => handle_chat_key(app, &player_tx, &host_tx, key.code),
                    _ if app.search_mode => handle_search_key(app, &player_tx, key.code),
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Char(':') => {
                        app.chat_mode = true;
                        app.chat_input.clear();
                        app.status = "Chat with host: type message and press Enter".to_string();
                    }
                    KeyCode::Char('/') => {
                        app.search_mode = true;
                        app.search_input.clear();
                        app.status = "Search online: type keywords and press Enter".to_string();
                    }
                    KeyCode::Char(' ') => {
                        let _ = player_tx.send(Command::Toggle);
                    }
                    KeyCode::Enter => {
                        if !app.tracks.is_empty() {
                            let _ = player_tx.send(Command::PlayIndex(app.selected));
                        }
                    }
                    KeyCode::Down | KeyCode::Char('j') => app.select_next(),
                    KeyCode::Up | KeyCode::Char('k') => app.select_prev(),
                    KeyCode::Char('n') | KeyCode::Right => {
                        let _ = player_tx.send(Command::Next);
                    }
                    KeyCode::Char('p') | KeyCode::Left => {
                        let _ = player_tx.send(Command::Prev);
                    }
                    KeyCode::Char('+') | KeyCode::Char('=') => {
                        app.volume = (app.volume + 0.05).min(1.0);
                        let _ = player_tx.send(Command::SetVolume(app.volume));
                    }
                    KeyCode::Char('-') => {
                        app.volume = (app.volume - 0.05).max(0.0);
                        let _ = player_tx.send(Command::SetVolume(app.volume));
                    }
                    KeyCode::Char('a') => {
                        app.status = "Generating host line...".to_string();
                        speak_for_current(app, &player_tx, Trigger::Transition);
                    }
                    KeyCode::Char('c') => {
                        fetch_online_context(app);
                    }
                    _ => {}
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            last_tick = Instant::now();
        }
    }

    Ok(())
}

#[derive(Debug)]
struct HostTaskResult {
    original_message: String,
    result: Result<ai::HostAction, String>,
}

fn handle_chat_key(
    app: &mut App,
    player_tx: &Sender<Command>,
    host_tx: &Sender<HostTaskResult>,
    code: KeyCode,
) {
    match code {
        KeyCode::Esc => {
            app.chat_mode = false;
            app.status = "Chat cancelled".to_string();
        }
        KeyCode::Enter => {
            let message = app.chat_input.trim().to_string();
            app.chat_mode = false;
            if message.is_empty() {
                app.status = "Chat message is empty".to_string();
            } else {
                handle_host_chat(app, player_tx, host_tx, &message);
            }
        }
        KeyCode::Backspace => {
            app.chat_input.pop();
        }
        KeyCode::Char(ch) => {
            app.chat_input.push(ch);
        }
        _ => {}
    }
}

fn handle_host_chat(
    app: &mut App,
    _player_tx: &Sender<Command>,
    host_tx: &Sender<HostTaskResult>,
    message: &str,
) {
    if app.chat_busy {
        app.status = "Host is still thinking".to_string();
        return;
    }
    app.status = "Host is thinking...".to_string();
    push_chat_line(app, format!("You: {message}"));
    app.host_text = "我在想。".to_string();
    app.chat_busy = true;
    let ctx = build_host_context(app, Trigger::Transition);
    let prompt = enrich_chat_prompt(app, message);
    let tx = host_tx.clone();
    let original_message = message.to_string();
    thread::spawn(move || {
        let result = ai::plan_action(&prompt, &ctx);
        let _ = tx.send(HostTaskResult {
            original_message,
            result,
        });
    });
}

fn drain_host_events(
    app: &mut App,
    player_tx: &Sender<Command>,
    host_rx: &Receiver<HostTaskResult>,
) {
    while let Ok(event) = host_rx.try_recv() {
        app.chat_busy = false;
        match event.result {
            Ok(action) => execute_host_action(app, player_tx, &event.original_message, action),
            Err(err) => {
                app.status = format!("Action planning failed: {err}");
                app.host_text = format!("模型暂时没接上：{err}");
                push_chat_line(app, format!("Host: 模型暂时没接上：{err}"));
                if wants_hot_recommendation(&event.original_message) {
                    load_hot_recommendations(app, player_tx);
                }
            }
        }
    }
}

fn enrich_chat_prompt(app: &App, message: &str) -> String {
    let track = app.current_track().or_else(|| app.selected_track());
    let track_context = track
        .map(|track| {
            format!(
                "当前选中/播放：{} - {}{}",
                track.title,
                track.artist,
                if track.album.is_empty() {
                    String::new()
                } else {
                    format!(" / 专辑 {}", track.album)
                }
            )
        })
        .unwrap_or_else(|| "当前没有歌曲。".to_string());
    let lyric_context = current_lyric_context(app);
    let recent_chat = app
        .chat_lines
        .iter()
        .rev()
        .take(8)
        .cloned()
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "用户原话：{message}\n\n{track_context}\n\n当前歌词附近：{lyric_context}\n\n最近对话：\n{recent_chat}"
    )
}

fn current_lyric_context(app: &App) -> String {
    let Some(active) = app.active_lyric_index() else {
        return "无同步歌词。".to_string();
    };
    let start = active.saturating_sub(2);
    app.lyrics
        .synced
        .iter()
        .skip(start)
        .take(5)
        .map(|line| line.text.clone())
        .collect::<Vec<_>>()
        .join(" / ")
}

fn execute_host_action(
    app: &mut App,
    player_tx: &Sender<Command>,
    original_message: &str,
    action: ai::HostAction,
) {
    app.host_text = action.reply.clone();
    push_chat_line(app, format!("Host: {}", action.reply));
    match action.action {
        ai::HostActionKind::PlayChart => {
            load_hot_recommendations(app, player_tx);
        }
        ai::HostActionKind::SearchSong => {
            let query = action
                .query
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(original_message);
            search_online_track(app, player_tx, query);
        }
        ai::HostActionKind::ExplainCurrent => {
            let current = app.current_track().or_else(|| app.selected_track());
            if let Some(track) = current {
                app.host_text = format!(
                    "{}\n\n当前是《{}》- {}{}。",
                    action.reply,
                    track.title,
                    track.artist,
                    if track.album.is_empty() {
                        String::new()
                    } else {
                        format!("，收录在《{}》", track.album)
                    }
                );
                app.status = "Host explained current track".to_string();
            } else {
                app.status = "No current track to explain".to_string();
            }
        }
        ai::HostActionKind::Chat => {
            app.status = "Host replied".to_string();
        }
        ai::HostActionKind::AddToQueue
        | ai::HostActionKind::PlayNext
        | ai::HostActionKind::CreatePlaylist
        | ai::HostActionKind::AddToPlaylist => {
            app.status = "Host action only available in the desktop app".to_string();
        }
    }
}

fn push_chat_line(app: &mut App, line: String) {
    app.chat_lines.push(line);
    if app.chat_lines.len() > 80 {
        let remove = app.chat_lines.len() - 80;
        app.chat_lines.drain(0..remove);
    }
}

fn wants_hot_recommendation(message: &str) -> bool {
    let lower = message.to_lowercase();
    (message.contains("热门") || message.contains("热歌") || message.contains("榜"))
        && (message.contains("推荐") || message.contains("播放") || lower.contains("recommend"))
}

fn load_hot_recommendations(app: &mut App, player_tx: &Sender<Command>) {
    app.status = "Loading QQ Music hot chart...".to_string();
    let queries = match online::qq_hot_queries(8) {
        Ok(queries) => queries,
        Err(err) => {
            app.status = format!("Hot chart failed: {err}");
            return;
        }
    };
    let mut contexts = Vec::new();
    for query in queries {
        if let Ok(mut found) = online::search_contexts(&query, 1) {
            contexts.append(&mut found);
        }
    }
    load_contexts_as_playlist(app, player_tx, contexts, "热门推荐");
}

fn load_contexts_as_playlist(
    app: &mut App,
    player_tx: &Sender<Command>,
    contexts: Vec<online::OnlineTrackContext>,
    label: &str,
) {
    let tracks = contexts
        .iter()
        .filter_map(|context| {
            context.play_url.as_ref().map(|play_url| Track {
                path: play_url.clone(),
                title: context.title.clone(),
                artist: context.artist.clone(),
                album: context.album.clone(),
                duration_secs: None,
                provider: Some(context.provider.clone()),
                provider_id: context.provider_id.clone(),
                cover_url: context.cover_url.clone(),
            })
        })
        .collect::<Vec<_>>();
    if tracks.is_empty() {
        app.status = format!("{label}: no playable tracks");
        return;
    }
    app.tracks = tracks;
    app.selected = 0;
    app.current = None;
    app.previous = None;
    app.position_ms = 0;
    app.lyrics = Lyrics::default();
    app.list_state.select(Some(0));
    let _ = player_tx.send(Command::SetPlaylist(
        app.tracks
            .iter()
            .map(|track| track.path.clone().into())
            .collect(),
    ));
    let list = app
        .tracks
        .iter()
        .take(8)
        .enumerate()
        .map(|(idx, track)| format!("{}. {} - {}", idx + 1, track.title, track.artist))
        .collect::<Vec<_>>()
        .join("\n");
    app.host_text = format!("我给你排了一组{label}：\n{list}");
    push_chat_line(app, format!("Host: 我给你排了一组{label}：\n{list}"));
    app.status = format!("Loaded {} tracks for {label}. Press Enter to play.", app.tracks.len());
}

fn handle_search_key(app: &mut App, player_tx: &Sender<Command>, code: KeyCode) {
    match code {
        KeyCode::Esc => {
            app.search_mode = false;
            app.status = "Search cancelled".to_string();
        }
        KeyCode::Enter => {
            let query = app.search_input.trim().to_string();
            app.search_mode = false;
            if query.is_empty() {
                app.status = "Search query is empty".to_string();
            } else {
                search_online_track(app, player_tx, &query);
            }
        }
        KeyCode::Backspace => {
            app.search_input.pop();
        }
        KeyCode::Char(ch) => {
            app.search_input.push(ch);
        }
        _ => {}
    }
}

fn search_online_track(app: &mut App, player_tx: &Sender<Command>, query: &str) {
    app.status = format!("Searching online: {query}");
    match online::search_contexts(query, 10) {
        Ok(contexts) => {
            let provider = contexts
                .first()
                .map(|context| context.provider.clone())
                .unwrap_or_else(|| "Online".to_string());
            if contexts.iter().all(|context| context.play_url.is_none()) {
                app.status = format!("Online matches found, but none had playable URLs for {query}");
                app.host_text = contexts
                    .iter()
                    .take(10)
                    .enumerate()
                    .map(|(idx, context)| {
                        format!(
                            "{}. {} - {} (no playable URL)",
                            idx + 1,
                            context.title,
                            context.artist
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                push_chat_line(app, format!("Host: {}", app.host_text));
                return;
            }
            load_contexts_as_playlist(app, player_tx, contexts, &provider);
        }
        Err(err) => {
            app.status = format!("Online search failed: {err}");
            app.host_text =
                "Set MUSICMATE_QQ_API_BASE or MUSICMATE_NETEASE_API_BASE, then press / to search."
                    .to_string();
        }
    }
}

fn drain_player_events(
    app: &mut App,
    player_tx: &Sender<Command>,
    player_rx: &Receiver<player::Event>,
) {
    while let Ok(event) = player_rx.try_recv() {
        match event {
            player::Event::TrackChanged(event) => {
                app.previous = app.current;
                app.current = Some(event.index);
                app.selected = event.index;
                app.list_state.select(Some(event.index));
                app.position_ms = 0;
                app.lyrics = app
                    .current_track()
                    .and_then(|track| {
                        let provider = track.provider.as_deref()?;
                        let provider_id = track.provider_id.as_deref()?;
                        online::fetch_lyrics(provider, provider_id).ok()
                    })
                    .unwrap_or_else(|| {
                        if is_http_url(&event.path) {
                            Lyrics::default()
                        } else {
                            media::get_lyrics(Path::new(&event.path)).unwrap_or_default()
                        }
                    });
                app.track_changes += 1;

                if let Some(track) = app.current_track() {
                    app.recent_tracks.push(PlayedTrack {
                        title: track.title.clone(),
                        artist: track.artist.clone(),
                    });
                    if app.recent_tracks.len() > 12 {
                        app.recent_tracks.remove(0);
                    }
                }

                if app.track_changes == 1 {
                    speak_for_current(app, player_tx, Trigger::Welcome);
                } else if (app.track_changes - 1) % TRANSITION_EVERY == 0 {
                    speak_for_current(app, player_tx, Trigger::Transition);
                }
            }
            player::Event::PlaybackState(event) => {
                app.playing = event.playing;
            }
            player::Event::Subtitle(event) => {
                app.host_active = event.active;
                if event.active && !event.text.trim().is_empty() {
                    app.host_text = event.text.clone();
                    app.spoken_lines.push(event.text);
                    if app.spoken_lines.len() > 20 {
                        app.spoken_lines.remove(0);
                    }
                }
            }
            player::Event::PlaybackPosition(event) => {
                app.position_ms = event.position_ms;
            }
            player::Event::Spectrum(_) => {}
            player::Event::Error(message) => {
                app.status = format!("Audio: {message}");
            }
        }
    }
}

fn speak_for_current(app: &mut App, player_tx: &Sender<Command>, trigger: Trigger) {
    let ctx = build_host_context(app, trigger);
    let tx = player_tx.clone();
    thread::spawn(move || {
        let text = ai::generate_line(&ctx).unwrap_or_else(|_| fallback_line());
        if let Ok(bytes) = musicmate_lib::tts::synthesize(&text, musicmate_lib::tts::DEFAULT_VOICE) {
            let _ = tx.send(Command::PlayAnnouncement { bytes, text });
        }
    });
}

fn build_host_context(app: &App, trigger: Trigger) -> HostContext {
    let now = Local::now();
    let current = app.current_track();
    let previous = app.previous_track();
    HostContext {
        persona: Persona {
            name: "Silen".to_string(),
            style: "松弛、克制，像深夜电台主播，但不要表演感太重。".to_string(),
        },
        current_title: current.map(|track| track.title.clone()),
        current_artist: current.map(|track| track.artist.clone()),
        current_album: current.and_then(|track| {
            if track.album.trim().is_empty() {
                None
            } else {
                Some(track.album.clone())
            }
        }),
        previous_title: previous.map(|track| track.title.clone()),
        previous_artist: previous.map(|track| track.artist.clone()),
        hour: now.hour() as u8,
        minute: now.minute() as u8,
        spoken_lines: app.spoken_lines.clone(),
        recent_tracks: app.recent_tracks.clone(),
        session_gap_hours: None,
        total_sessions: 1,
        trigger,
        available_playlists: Vec::new(),
    }
}

fn fallback_line() -> String {
    let idx = Local::now().timestamp() as usize % FALLBACK_LINES.len();
    FALLBACK_LINES[idx].to_string()
}

fn fetch_online_context(app: &mut App) {
    let Some(track) = app.current_track().or_else(|| app.selected_track()) else {
        app.status = "No track selected for online lookup".to_string();
        return;
    };
    let query = format!("{} {}", track.title, track.artist);
    match online::fetch_context(&query) {
        Ok(context) => {
            let mut lines = vec![format!(
                "[{}] {} - {}{}",
                context.provider,
                context.title,
                context.artist,
                if context.album.is_empty() {
                    String::new()
                } else {
                    format!(" / {}", context.album)
                }
            )];
            if context.comments.is_empty() {
                lines.push("No comments returned.".to_string());
            } else {
                lines.push("Hot comments:".to_string());
                lines.extend(
                    context
                        .comments
                        .iter()
                        .enumerate()
                        .map(|(idx, comment)| format!("{}. {}", idx + 1, compact_text(comment, 88))),
                );
            }
            if context.play_url.is_some() {
                lines.push("Playable URL available from provider.".to_string());
            }
            app.host_active = false;
            app.host_text = lines.join("\n");
            app.status = "Fetched online track info and comments".to_string();
        }
        Err(err) => {
            app.status = format!("Online lookup failed: {err}");
            app.host_text =
                "Set MUSICMATE_QQ_API_BASE or MUSICMATE_NETEASE_API_BASE, then press c."
                    .to_string();
        }
    }
}

fn compact_text(value: &str, max_chars: usize) -> String {
    let mut out = value.replace(['\r', '\n', '\t'], " ");
    while out.contains("  ") {
        out = out.replace("  ", " ");
    }
    let count = out.chars().count();
    if count <= max_chars {
        return out;
    }
    let mut truncated = out.chars().take(max_chars.saturating_sub(1)).collect::<String>();
    truncated.push('…');
    truncated
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

fn render(frame: &mut Frame<'_>, app: &mut App) {
    let area = frame.area();
    if area.width < 92 {
        render_compact(frame, app, area);
        return;
    }

    let main = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(0), Constraint::Length(3)])
        .split(area);
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(45), Constraint::Percentage(55)])
        .split(main[0]);
    let left = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(58), Constraint::Percentage(42)])
        .split(columns[0]);
    let right = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(9), Constraint::Min(0)])
        .split(columns[1]);

    render_now_playing(frame, app, left[0]);
    render_lyrics(frame, app, left[1]);
    render_host(frame, app, right[0]);
    render_chat(frame, app, right[1]);
    render_footer(frame, app, main[1]);
}

fn render_compact(frame: &mut Frame<'_>, app: &mut App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(9),
            Constraint::Length(7),
            Constraint::Min(8),
            Constraint::Length(10),
            Constraint::Length(3),
        ])
        .split(area);
    render_now_playing(frame, app, chunks[0]);
    render_host(frame, app, chunks[1]);
    render_lyrics(frame, app, chunks[2]);
    render_chat(frame, app, chunks[3]);
    render_footer(frame, app, chunks[4]);
}

fn render_now_playing(frame: &mut Frame<'_>, app: &mut App, area: Rect) {
    let track = app.current_track().or_else(|| app.selected_track());
    let title = track
        .map(|track| track.title.as_str())
        .unwrap_or("No track selected");
    let artist = track
        .map(|track| track.artist.as_str())
        .unwrap_or("Musicmate TUI");
    let album = track
        .and_then(|track| (!track.album.is_empty()).then_some(track.album.as_str()))
        .unwrap_or("");
    let duration = track.and_then(|track| track.duration_secs).unwrap_or(0);
    let elapsed = app.position_ms / 1000;
    let ratio = if duration == 0 {
        0.0
    } else {
        (elapsed as f64 / duration as f64).clamp(0.0, 1.0)
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(13),
            Constraint::Length(5),
            Constraint::Length(3),
            Constraint::Length(6),
            Constraint::Min(5),
        ])
        .margin(1)
        .split(area);

    let state = if app.playing { "ON AIR" } else { "STANDBY" };
    let header = Paragraph::new(vec![
        Line::from(Span::styled(
            "MUSICMATE",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(state, Style::default().fg(Color::Gray))),
    ])
    .block(Block::default().borders(Borders::ALL).title(" Player "));
    frame.render_widget(header, area);

    let cover_hint = if track.and_then(|track| track.cover_url.as_ref()).is_some() {
        "Album art"
    } else {
        "No album art"
    };
    let cover_box = Paragraph::new(cover_hint)
        .block(Block::default().borders(Borders::ALL).title(" Cover "))
        .style(Style::default().fg(Color::DarkGray))
        .alignment(Alignment::Center);
    frame.render_widget(cover_box, chunks[0]);

    let now = Paragraph::new(vec![
        Line::from(Span::styled(
            title,
            Style::default().fg(Color::White).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(artist, Style::default().fg(Color::Gray))),
        Line::from(Span::styled(album, Style::default().fg(Color::DarkGray))),
    ])
    .wrap(Wrap { trim: true });
    frame.render_widget(now, chunks[1]);

    let gauge = Gauge::default()
        .gauge_style(Style::default().fg(Color::Green))
        .ratio(ratio)
        .label(format!("{} / {}", format_time(elapsed), format_time(duration)));
    frame.render_widget(gauge, chunks[2]);

    let controls = Paragraph::new(vec![
        Line::from("Space play/pause  Enter play"),
        Line::from("n/p next/prev     +/- volume"),
        Line::from("/ search online   : chat host"),
        Line::from("c online info     a host line"),
        Line::from("q quit"),
    ])
    .style(Style::default().fg(Color::Gray));
    frame.render_widget(controls, chunks[3]);

    render_search_and_playlist(frame, app, chunks[4]);
}

fn render_host(frame: &mut Frame<'_>, app: &App, area: Rect) {
    let border = if app.host_active { Color::Green } else { Color::DarkGray };
    let paragraph = Paragraph::new(app.host_text.as_str())
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(border))
                .title(" Subtitle "),
        )
        .style(Style::default().fg(Color::White))
        .wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

fn render_chat(frame: &mut Frame<'_>, app: &App, area: Rect) {
    let (messages_area, input_area) = if app.chat_mode {
        if area.height <= 3 {
            (None, area)
        } else {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Min(0), Constraint::Length(3)])
                .split(area);
            (Some(chunks[0]), chunks[1])
        }
    } else {
        (Some(area), Rect::default())
    };

    if let Some(messages_area) = messages_area {
        render_chat_messages(frame, app, messages_area);
    }

    if app.chat_mode {
        let input = Paragraph::new(format!("{}_", app.chat_input))
            .block(Block::default().borders(Borders::ALL).title(" Message "))
            .style(Style::default().fg(Color::Green));
        frame.render_widget(input, input_area);
    }
}

fn render_chat_messages(frame: &mut Frame<'_>, app: &App, area: Rect) {
    let lines = if app.chat_lines.is_empty() {
        vec![Line::from(Span::styled(
            "Press : to chat with the host.",
            Style::default().fg(Color::DarkGray),
        ))]
    } else {
        app.chat_lines
            .iter()
            .rev()
            .take(area.height.saturating_sub(2) as usize)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .map(|line| {
                let style = if line.starts_with("You:") {
                    Style::default().fg(Color::Cyan)
                } else {
                    Style::default().fg(Color::White)
                };
                Line::from(Span::styled(line.clone(), style))
            })
            .collect::<Vec<_>>()
    };
    let paragraph = Paragraph::new(lines)
        .block(Block::default().borders(Borders::ALL).title(" Host Chat "))
        .wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

fn render_lyrics(frame: &mut Frame<'_>, app: &App, area: Rect) {
    let active = app.active_lyric_index();
    let lines = if !app.lyrics.synced.is_empty() {
        lyric_window(app, active)
    } else if !app.lyrics.raw.trim().is_empty() {
        app.lyrics
            .raw
            .lines()
            .take(area.height.saturating_sub(2) as usize)
            .map(|line| Line::from(line.to_string()))
            .collect()
    } else {
        vec![Line::from(Span::styled(
            "No lyrics",
            Style::default().fg(Color::DarkGray),
        ))]
    };
    let paragraph = Paragraph::new(lines)
        .block(Block::default().borders(Borders::ALL).title(" Lyrics "))
        .alignment(Alignment::Left)
        .wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

fn lyric_window(app: &App, active: Option<usize>) -> Vec<Line<'static>> {
    let height = 14usize;
    let center = active.unwrap_or(0);
    let start = center.saturating_sub(height / 2);
    app.lyrics
        .synced
        .iter()
        .enumerate()
        .skip(start)
        .take(height)
        .map(|(idx, line)| {
            let style = if Some(idx) == active {
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Gray)
            };
            Line::from(Span::styled(line.text.clone(), style))
        })
        .collect()
}

fn render_playlist(frame: &mut Frame<'_>, app: &mut App, area: Rect) {
    let items: Vec<ListItem> = app
        .tracks
        .iter()
        .enumerate()
        .map(|(idx, track)| {
            let marker = if Some(idx) == app.current {
                if app.playing { "▶" } else { "Ⅱ" }
            } else {
                " "
            };
            ListItem::new(vec![
                Line::from(vec![
                    Span::styled(
                        format!("{marker} {:02} ", idx + 1),
                        Style::default().fg(Color::DarkGray),
                    ),
                    Span::styled(track.title.clone(), Style::default().fg(Color::White)),
                ]),
                Line::from(Span::styled(
                    format!("   {}", track.artist),
                    Style::default().fg(Color::Gray),
                )),
            ])
        })
        .collect();
    let list = List::new(items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(format!(" Playlist [{}] ", app.tracks.len())),
        )
        .highlight_style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD));
    frame.render_stateful_widget(list, area, &mut app.list_state);
}

fn render_search_and_playlist(frame: &mut Frame<'_>, app: &mut App, area: Rect) {
    if app.search_mode {
        if area.height <= 3 {
            let input = Paragraph::new(format!("{}_", app.search_input))
                .block(Block::default().borders(Borders::ALL).title(" Search "))
                .style(Style::default().fg(Color::Green));
            frame.render_widget(input, area);
            return;
        }
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(3), Constraint::Min(0)])
            .split(area);
        let input = Paragraph::new(format!("{}_", app.search_input))
            .block(Block::default().borders(Borders::ALL).title(" Search "))
            .style(Style::default().fg(Color::Green));
        frame.render_widget(input, chunks[0]);
        render_playlist(frame, app, chunks[1]);
    } else {
        render_playlist(frame, app, area);
    }
}

fn render_footer(frame: &mut Frame<'_>, app: &App, area: Rect) {
    let mode = if app.chat_busy {
        "host thinking"
    } else if app.chat_mode {
        "chat input"
    } else if app.search_mode {
        "search input"
    } else {
        "ready"
    };
    let text = format!(
        "{}  |  {}  |  volume {:>3}%  |  {}",
        app.status,
        mode,
        (app.volume * 100.0).round() as u8,
        Local::now().format("%H:%M")
    );
    let footer = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL))
        .style(Style::default().fg(Color::Gray));
    frame.render_widget(footer, area);
}

fn render_kitty_cover(app: &mut App) {
    if !kitty_graphics_enabled() {
        return;
    }
    let Some(cover_url) = app
        .current_track()
        .or_else(|| app.selected_track())
        .and_then(|track| track.cover_url.as_deref())
    else {
        return;
    };
    if app.last_cover_rendered.as_deref() == Some(cover_url) {
        return;
    }
    let Ok(path) = cached_cover_path(cover_url) else {
        return;
    };
    app.last_cover_rendered = Some(cover_url.to_string());
    let escaped_path = kitty_escape_path(&path.to_string_lossy());
    let mut stdout = io::stdout();
    let _ = write!(stdout, "\x1b_Ga=d\x1b\\");
    let _ = write!(
        stdout,
        "\x1b[4;4H\x1b_Ga=T,f=100,t=f,c=30,r=9;{}\x1b\\",
        escaped_path
    );
    let _ = stdout.flush();
}

fn kitty_graphics_enabled() -> bool {
    std::env::var("TERM")
        .map(|term| term.contains("kitty"))
        .unwrap_or(false)
        || std::env::var("KITTY_WINDOW_ID").is_ok()
        || std::env::var("MUSICMATE_KITTY_GRAPHICS")
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
}

fn cached_cover_path(url: &str) -> Result<std::path::PathBuf, String> {
    let mut hasher = Sha1::new();
    hasher.update(url.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    let path = std::env::temp_dir().join(format!("musicmate-cover-{hash}.png"));
    if path.exists() {
        return Ok(path);
    }
    let bytes = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Mozilla/5.0 Musicmate/0.1")
        .build()
        .map_err(|e| format!("cover http client: {e}"))?
        .get(url)
        .send()
        .map_err(|e| format!("cover request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("cover status: {e}"))?
        .bytes()
        .map_err(|e| format!("cover bytes: {e}"))?;
    let image = image::load_from_memory(&bytes).map_err(|e| format!("decode cover image: {e}"))?;
    image
        .thumbnail(360, 360)
        .save_with_format(&path, image::ImageFormat::Png)
        .map_err(|e| format!("write cover png: {e}"))?;
    Ok(path)
}

fn kitty_escape_path(path: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(path.as_bytes())
}

fn format_time(seconds: u64) -> String {
    format!("{:02}:{:02}", seconds / 60, seconds % 60)
}

fn setup_terminal() -> Result<Term, Box<dyn std::error::Error>> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    Ok(Terminal::new(backend)?)
}

fn restore_terminal(terminal: &mut Term) -> Result<(), Box<dyn std::error::Error>> {
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}
