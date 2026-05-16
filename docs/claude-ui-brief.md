# Musicmate UI Redesign Brief for Claude

You are helping redesign Musicmate into a real desktop-style music app UI.

Work only on the user interface and interaction design unless explicitly asked
to implement. Do not read or print secret files such as `deepseekapi.txt`,
`qqcookies.txt`, `.env.local`, or service cookie config. Do not change playback,
cookie, or API authentication logic.

## Product Context

Musicmate is a music player with an AI radio host. It can:

- Play local and online QQ Music tracks.
- Search online songs and show multiple candidate results.
- Load lyrics and album art.
- Fetch online metadata and comments.
- Use an LLM host for commentary, chat, and music recommendations.
- Play hot chart recommendations and let the host explain what is playing.

The current TUI is no longer the target. The desired result is a proper
desktop/web software interface built from the existing React/Vite frontend in
`src/App.tsx` and `src/App.css`.

## Target Layout

Design the first screen as the actual app, not a landing page.

Use a four-zone application layout:

- Left column, top: current song player with large album art, title, artist,
  album, provider badge, progress, volume, and playback controls.
- Left column, bottom: lyrics panel with synced lyric highlighting.
- Center or lower middle: online search and queue/results list. Search must be
  separate from host chat.
- Right column, top: current song commentary/subtitle from the host.
- Right column, bottom: realtime host chat with message history and a dedicated
  message input.

The user should immediately understand:

- What is playing.
- What the host is saying.
- Where to search music.
- Where to chat with the host.
- What queue/results can be played next.

## Required Interactions

- Search box: query QQ Music/online source, return multiple candidates, select
  one to play, add result list to queue.
- Host chat: send natural language requests such as "推荐今日最热门的歌"; the
  host can respond, load a hot chart, play a track, and explain it.
- Player controls: play/pause, next, previous, progress display, volume.
- Metadata area: show album art, comments, provider, album, and context for the
  current track.
- Lyrics: keep the active lyric centered when possible.

## Visual Direction

Build a practical desktop app, not a marketing page.

- Dense but calm layout suitable for repeated daily use.
- Avoid oversized hero sections.
- Avoid cards inside cards.
- Avoid decorative gradient blobs or one-note color palettes.
- Use real album art as the main visual signal.
- Use restrained surfaces, clear dividers, and strong typography hierarchy.
- Keep border radius at 8px or less unless already established.
- Prefer icon buttons for playback and utility actions.
- Make text fit cleanly in all panels.

## Deliverable

Produce one of these:

1. A concise implementation plan with component structure and CSS strategy.
2. Or, if asked to edit files, implement the redesign in `src/App.tsx` and
   `src/App.css`, keeping existing backend calls intact.

When implementing, preserve current working playback/search/host logic and only
reshape the frontend UI around it.

