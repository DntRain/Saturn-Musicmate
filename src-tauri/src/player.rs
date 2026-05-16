use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use rodio::Source;

use crate::spectrum::{spawn_fft_thread, SampleTap, TapBuffer};

const DUCK_FACTOR: f32 = 0.2;

pub enum Command {
    SetPlaylist(Vec<PathBuf>),
    PlayIndex(usize),
    Toggle,
    Next,
    Prev,
    SetVolume(f32),
    Seek(Duration),
    QueueAppend(Vec<PathBuf>),
    QueueInsertNext(Vec<PathBuf>),
    QueueRemoveAt(usize),
    PlayAnnouncement { bytes: Vec<u8>, text: String },
}

#[derive(Debug, Clone)]
pub struct TrackChanged {
    pub index: usize,
    pub path: String,
}

#[derive(Debug, Clone)]
pub struct PlaybackState {
    pub playing: bool,
}

#[derive(Debug, Clone)]
pub struct SubtitleEvent {
    pub text: String,
    pub active: bool,
}

#[derive(Debug, Clone)]
pub struct PlaybackPosition {
    pub position_ms: u64,
}

#[derive(Debug, Clone)]
pub struct SpectrumEvent {
    pub bands: Vec<f32>,
}

#[derive(Debug, Clone)]
pub enum Event {
    TrackChanged(TrackChanged),
    PlaybackState(PlaybackState),
    Subtitle(SubtitleEvent),
    PlaybackPosition(PlaybackPosition),
    Spectrum(SpectrumEvent),
    Error(String),
}

pub fn spawn() -> (mpsc::Sender<Command>, mpsc::Receiver<Event>) {
    let (tx, rx) = mpsc::channel::<Command>();
    let (event_tx, event_rx) = mpsc::channel::<Event>();
    thread::spawn(move || run_loop(rx, event_tx));
    (tx, event_rx)
}

fn run_loop(rx: mpsc::Receiver<Command>, event_tx: Sender<Event>) {
    let (_stream, handle) = match rodio::OutputStream::try_default() {
        Ok(x) => x,
        Err(e) => {
            emit_error(&event_tx, format!("no output device: {e}"));
            return;
        }
    };

    let tap = Arc::new(Mutex::new(TapBuffer::new()));
    spawn_fft_thread(tap.clone(), event_tx.clone());

    let mut music_sink: Option<rodio::Sink> = None;
    let mut announcement_sink: Option<rodio::Sink> = None;
    let mut playlist: Vec<PathBuf> = Vec::new();
    let mut index: usize = 0;
    let mut volume: f32 = 0.8;
    let mut user_paused = false;

    loop {
        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(cmd) => match cmd {
                Command::SetPlaylist(p) => {
                    playlist = p;
                    index = 0;
                    if let Some(s) = music_sink.take() {
                        s.stop();
                    }
                    user_paused = false;
                    emit_playback(&event_tx, false);
                    emit_position(&event_tx, 0);
                }
                Command::PlayIndex(i) => {
                    if i < playlist.len() {
                        index = i;
                        tap.lock().reset();
                        music_sink = play_path(&handle, &playlist[index], current_music_volume(volume, &announcement_sink), &tap);
                        user_paused = false;
                        emit_track_changed(&event_tx, index, &playlist[index]);
                        emit_playback(&event_tx, music_sink.is_some());
                        emit_position(&event_tx, 0);
                    }
                }
                Command::Toggle => {
                    if let Some(s) = &music_sink {
                        if s.is_paused() {
                            s.play();
                            user_paused = false;
                            emit_playback(&event_tx, true);
                        } else {
                            s.pause();
                            user_paused = true;
                            emit_playback(&event_tx, false);
                        }
                    } else if !playlist.is_empty() {
                        tap.lock().reset();
                        music_sink = play_path(&handle, &playlist[index], current_music_volume(volume, &announcement_sink), &tap);
                        user_paused = false;
                        emit_track_changed(&event_tx, index, &playlist[index]);
                        emit_playback(&event_tx, music_sink.is_some());
                        emit_position(&event_tx, 0);
                    }
                }
                Command::Next => advance(&event_tx, &handle, &mut music_sink, &mut index, &playlist, volume, &announcement_sink, &mut user_paused, 1, &tap),
                Command::Prev => advance(&event_tx, &handle, &mut music_sink, &mut index, &playlist, volume, &announcement_sink, &mut user_paused, -1, &tap),
                Command::SetVolume(v) => {
                    volume = v.clamp(0.0, 1.0);
                    if let Some(s) = &music_sink {
                        s.set_volume(current_music_volume(volume, &announcement_sink));
                    }
                }
                Command::QueueAppend(paths) => {
                    playlist.extend(paths);
                }
                Command::QueueInsertNext(paths) => {
                    let insert_at = if playlist.is_empty() {
                        0
                    } else {
                        (index + 1).min(playlist.len())
                    };
                    for (i, p) in paths.into_iter().enumerate() {
                        playlist.insert(insert_at + i, p);
                    }
                }
                Command::QueueRemoveAt(i) => {
                    if i >= playlist.len() {
                        // nothing to do
                    } else if i == index {
                        playlist.remove(i);
                        if let Some(s) = music_sink.take() {
                            s.stop();
                        }
                        tap.lock().reset();
                        if playlist.is_empty() {
                            index = 0;
                            user_paused = false;
                            emit_playback(&event_tx, false);
                            emit_position(&event_tx, 0);
                        } else {
                            if index >= playlist.len() {
                                index = 0;
                            }
                            music_sink = play_path(&handle, &playlist[index], current_music_volume(volume, &announcement_sink), &tap);
                            user_paused = false;
                            emit_track_changed(&event_tx, index, &playlist[index]);
                            emit_playback(&event_tx, music_sink.is_some());
                            emit_position(&event_tx, 0);
                        }
                    } else {
                        playlist.remove(i);
                        if i < index {
                            index -= 1;
                            emit_track_changed(&event_tx, index, &playlist[index]);
                        }
                    }
                }
                Command::Seek(pos) => {
                    if let Some(s) = &music_sink {
                        if let Err(e) = s.try_seek(pos) {
                            emit_error(&event_tx, format!("seek: {e}"));
                        } else {
                            emit_position(&event_tx, pos.as_millis() as u64);
                        }
                    }
                }
                Command::PlayAnnouncement { bytes, text } => {
                    match build_announcement_sink(&handle, bytes, volume.max(0.5), &tap) {
                        Ok(s) => {
                            announcement_sink = Some(s);
                            if let Some(m) = &music_sink {
                                m.set_volume(volume * DUCK_FACTOR);
                            }
                            emit_subtitle(&event_tx, &text, true);
                        }
                        Err(e) => emit_error(&event_tx, format!("announcement: {e}")),
                    }
                }
            },
            Err(RecvTimeoutError::Timeout) => {
                if let Some(a) = &announcement_sink {
                    if a.empty() {
                        announcement_sink = None;
                        if let Some(m) = &music_sink {
                            m.set_volume(volume);
                        }
                        emit_subtitle(&event_tx, "", false);
                    }
                }
                if !user_paused {
                    if let Some(s) = &music_sink {
                        if s.empty() && !playlist.is_empty() {
                            index = (index + 1) % playlist.len();
                            tap.lock().reset();
                            music_sink = play_path(&handle, &playlist[index], current_music_volume(volume, &announcement_sink), &tap);
                            emit_track_changed(&event_tx, index, &playlist[index]);
                            emit_playback(&event_tx, music_sink.is_some());
                            emit_position(&event_tx, 0);
                        } else {
                            emit_position(&event_tx, s.get_pos().as_millis() as u64);
                        }
                    }
                }
            }
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn current_music_volume(base: f32, announcement_sink: &Option<rodio::Sink>) -> f32 {
    if announcement_sink.is_some() {
        base * DUCK_FACTOR
    } else {
        base
    }
}

#[allow(clippy::too_many_arguments)]
fn advance(
    event_tx: &Sender<Event>,
    handle: &rodio::OutputStreamHandle,
    music_sink: &mut Option<rodio::Sink>,
    index: &mut usize,
    playlist: &[PathBuf],
    volume: f32,
    announcement_sink: &Option<rodio::Sink>,
    user_paused: &mut bool,
    direction: i32,
    tap: &Arc<Mutex<TapBuffer>>,
) {
    if playlist.is_empty() {
        return;
    }
    let len = playlist.len();
    *index = if direction >= 0 {
        (*index + 1) % len
    } else if *index == 0 {
        len - 1
    } else {
        *index - 1
    };
    tap.lock().reset();
    *music_sink = play_path(handle, &playlist[*index], current_music_volume(volume, announcement_sink), tap);
    *user_paused = false;
    emit_track_changed(event_tx, *index, &playlist[*index]);
    emit_playback(event_tx, music_sink.is_some());
    emit_position(event_tx, 0);
}

fn build_announcement_sink(
    handle: &rodio::OutputStreamHandle,
    bytes: Vec<u8>,
    volume: f32,
    tap: &Arc<Mutex<TapBuffer>>,
) -> Result<rodio::Sink, String> {
    let cursor = std::io::Cursor::new(bytes);
    let source = rodio::Decoder::new(cursor).map_err(|e| format!("decode: {e}"))?;
    let sink = rodio::Sink::try_new(handle).map_err(|e| format!("sink: {e}"))?;
    sink.set_volume(volume);
    let tapped = SampleTap::new(source.convert_samples::<f32>(), tap.clone());
    sink.append(tapped);
    Ok(sink)
}

fn play_path(
    handle: &rodio::OutputStreamHandle,
    path: &PathBuf,
    volume: f32,
    tap: &Arc<Mutex<TapBuffer>>,
) -> Option<rodio::Sink> {
    let sink = match rodio::Sink::try_new(handle) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[audio] sink: {e}");
            return None;
        }
    };
    sink.set_volume(volume);

    if is_http_url(path) {
        let url = path.to_string_lossy();
        let client = match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent("Mozilla/5.0 Musicmate/0.1")
            .build()
        {
            Ok(client) => client,
            Err(e) => {
                eprintln!("[audio] http client: {e}");
                return None;
            }
        };
        let bytes = match client.get(url.as_ref()).send().and_then(|response| response.error_for_status()) {
            Ok(response) => match response.bytes() {
                Ok(bytes) => bytes,
                Err(e) => {
                    eprintln!("[audio] read url {url}: {e}");
                    return None;
                }
            },
            Err(e) => {
                eprintln!("[audio] get url {url}: {e}");
                return None;
            }
        };
        if bytes.len() < 4096 {
            eprintln!(
                "[audio] url {url} returned only {} bytes; not enough audio data to play",
                bytes.len()
            );
            return None;
        }
        match safe_decode(std::io::Cursor::new(bytes)) {
            Ok(source) => {
                let tapped = SampleTap::new(source.convert_samples::<f32>(), tap.clone());
                sink.append(tapped);
            }
            Err(e) => {
                eprintln!("[audio] decode url {url}: {e}");
                return None;
            }
        }
    } else {
        let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[audio] open {path:?}: {e}");
            return None;
        }
        };
        match safe_decode(std::io::BufReader::new(file)) {
            Ok(source) => {
                let tapped = SampleTap::new(source.convert_samples::<f32>(), tap.clone());
                sink.append(tapped);
            }
            Err(e) => {
                eprintln!("[audio] decode {path:?}: {e}");
                return None;
            }
        }
    };
    Some(sink)
}

fn safe_decode<R>(reader: R) -> Result<rodio::Decoder<R>, String>
where
    R: std::io::Read + std::io::Seek + Send + Sync + 'static,
{
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| rodio::Decoder::new(reader)))
        .map_err(|_| "decoder panicked while probing audio format".to_string())?
        .map_err(|e| e.to_string())
}

fn is_http_url(path: &PathBuf) -> bool {
    let value = path.to_string_lossy();
    value.starts_with("http://") || value.starts_with("https://")
}

fn emit_track_changed(event_tx: &Sender<Event>, index: usize, path: &PathBuf) {
    let _ = event_tx.send(Event::TrackChanged(TrackChanged {
            index,
            path: path.to_string_lossy().to_string(),
    }));
}

fn emit_playback(event_tx: &Sender<Event>, playing: bool) {
    let _ = event_tx.send(Event::PlaybackState(PlaybackState { playing }));
}

fn emit_subtitle(event_tx: &Sender<Event>, text: &str, active: bool) {
    let _ = event_tx.send(Event::Subtitle(SubtitleEvent {
            text: text.to_string(),
            active,
    }));
}

fn emit_position(event_tx: &Sender<Event>, position_ms: u64) {
    let _ = event_tx.send(Event::PlaybackPosition(PlaybackPosition { position_ms }));
}

fn emit_error(event_tx: &Sender<Event>, message: String) {
    let _ = event_tx.send(Event::Error(message));
}
