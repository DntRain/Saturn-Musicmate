# Musicmate

Musicmate is now a terminal music companion. It scans a local music folder, plays audio, shows playlist and lyrics in a TUI, and can generate short AI host lines with TTS announcements.

## Current Shape

- UI: terminal TUI built with `ratatui` and `crossterm`
- Core: Rust
- Audio playback: `rodio`
- Tags / duration / lyrics: `lofty`
- TTS: `msedge-tts`
- AI host line: Anthropic-compatible HTTP endpoint through the Rust `ai` module

## Requirements

- Rust stable
- A working system audio output device
- Optional: `deepseekapi.txt` or `DEEPSEEK_API_KEY` for AI-generated host lines
- Optional: `MUSICMATE_QQ_API_BASE` for a Rain120/qq-music-api compatible service
- Optional: `MUSICMATE_NETEASE_API_BASE` for online NetEase-compatible song info and comments

Without a DeepSeek API key, Musicmate still plays music and falls back to local host lines.

## Run

From the project root:

```bash
cargo run -p musicmate -- /path/to/your/music
```

For AI host lines, put your DeepSeek API key in:

```text
deepseekapi.txt
```

The default model is `deepseek-v4-pro`. Override it with:

```bash
export DEEPSEEK_MODEL=deepseek-v4-pro
```

You can also start without a music folder and search online inside the TUI:

```bash
cargo run -p musicmate
```

Press `/`, type a song keyword, then press `Enter`.

To start the QQ Music API service and Musicmate together:

```bash
./scripts/start-all.sh /path/to/your/music
```

Then press `/` in the TUI to search online.

If you do not have local music yet:

```bash
./scripts/start-all.sh
```

That uses `/tmp/musicmate-empty` as an empty music folder.

To start with an online QQ Music search result:

```bash
./scripts/start-all.sh /tmp/musicmate-empty "周杰伦 晴天"
```

Or from the Rust crate directory:

```bash
cargo run --manifest-path src-tauri/Cargo.toml -- /path/to/your/music
```

## TUI Controls

```text
Enter        play selected track
Space        play / pause
/            search online
:            chat with the host
j / Down     select next track
k / Up       select previous track
n / Right    next track
p / Left     previous track
+ / -        volume up / down
a            generate and speak a host line
c            fetch online song info and comments
q / Esc      quit
```

## Online Music Info

Musicmate does not hard-code private platform endpoints. To fetch online song info and comments, point it at a compatible API service you are allowed to use.

For QQ Music, start Rain120/qq-music-api separately. That project listens on port `3200` by default:

```bash
git clone https://github.com/Rain120/qq-music-api.git
cd qq-music-api
npm install
npm start
```

Then run Musicmate with:

```bash
export MUSICMATE_QQ_API_BASE=http://127.0.0.1:3200
cargo run -p musicmate -- /path/to/your/music
```

Some QQ Music endpoints may return empty results or upstream errors without a browser cookie. If needed, export a cookie copied from a logged-in QQ Music web session before starting:

```bash
export QQ_MUSIC_COOKIE='uin=...; qm_keyst=...; ...'
./scripts/start-all.sh /tmp/musicmate-empty "周杰伦 晴天"
```

Or save it locally for this project:

```bash
./scripts/set-qq-cookie.sh
./scripts/start-all.sh /tmp/musicmate-empty "周杰伦 晴天"
```

The cookie is written to `.env.local` with `0600` permissions. Do not commit or share it.

## Kitty Album Art

When running inside Kitty, Musicmate downloads QQ album covers and sends them through the Kitty graphics protocol. Detection uses `TERM`, `KITTY_WINDOW_ID`, or this override:

```bash
export MUSICMATE_KITTY_GRAPHICS=1
./scripts/start-all.sh
```

If your terminal is not Kitty-compatible, Musicmate still works and shows text metadata.

Select or play a track and press `c`. Musicmate calls:

- `GET /getSearchByKey?key=...&limit=1&page=1`
- `GET /getComments?id=...&pagesize=8&pagenum=0`

For NetEase-compatible services:

```bash
export MUSICMATE_NETEASE_API_BASE=http://127.0.0.1:3000
cargo run -p musicmate -- /path/to/your/music
```

Musicmate calls:

- `GET /search?keywords=...&type=1&limit=1`
- `GET /comment/music?id=...&limit=8`

If both QQ and NetEase base URLs are set, QQ Music is used first.

For online playback without local music, set a query before launching:

```bash
export MUSICMATE_QQ_API_BASE=http://127.0.0.1:3200
export MUSICMATE_ONLINE_QUERY="周杰伦 晴天"
cargo run -p musicmate -- /tmp/musicmate-empty
```

Musicmate searches QQ Music, loads the first result with a playable URL, and the normal `Enter` / `Space` controls can play it.

## Host Chat

Press `:` in the TUI to chat with the AI host. For example:

```text
推荐今日最热门的歌
```

Musicmate asks DeepSeek to return a structured action, then executes it. Supported actions:

- `chat`: normal host conversation
- `search_song`: search and load online songs
- `play_chart`: load QQ Music hot chart and introduce it
- `explain_current`: explain the selected/current track

Host chat runs in a background worker, so the TUI keeps rendering while the model responds. The planner receives the selected/current track, nearby synced lyrics, recent spoken lines, and recent chat history.

## Development

```bash
cargo check -p musicmate
cargo test -p musicmate
```

The old Tauri frontend is no longer part of the Rust runtime. The reusable music, media, AI, TTS, and player logic lives under `src-tauri/src` for now, but the crate builds as a normal CLI/TUI binary.
