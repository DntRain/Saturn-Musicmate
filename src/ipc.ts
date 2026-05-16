import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  HostActionResponse,
  HostContext,
  Lyrics,
  OnlineTrackContext,
  PlaybackStateEvent,
  PositionEvent,
  SpectrumEvent,
  SubtitleEvent,
  Track,
  TrackChangedEvent,
} from "./types";

export const api = {
  scanLibrary: (folder: string) => invoke<Track[]>("scan_library", { folder }),
  setPlaylist: (paths: string[]) => invoke<void>("set_playlist", { paths }),
  playIndex: (index: number) => invoke<void>("play_index", { index }),
  toggle: () => invoke<void>("toggle_playback"),
  next: () => invoke<void>("next_track"),
  prev: () => invoke<void>("prev_track"),
  setVolume: (volume: number) => invoke<void>("set_volume", { volume }),
  seek: (positionMs: number) =>
    invoke<void>("seek", { positionMs: Math.max(0, Math.floor(positionMs)) }),
  queueAppend: (paths: string[]) => invoke<void>("queue_append", { paths }),
  queueInsertNext: (paths: string[]) =>
    invoke<void>("queue_insert_next", { paths }),
  queueRemoveAt: (index: number) =>
    invoke<void>("queue_remove_at", { index }),
  getCover: (path: string) => invoke<string | null>("get_cover", { path }),
  getCoverPalette: (source: string) =>
    invoke<{ r: number; g: number; b: number }>("get_cover_palette", { source }),
  getLyrics: (path: string) => invoke<Lyrics>("get_lyrics", { path }),
  searchOnline: (query: string, limit = 50) =>
    invoke<OnlineTrackContext[]>("search_online", { query, limit }),
  fetchOnlineLyrics: (provider: string, providerId: string) =>
    invoke<Lyrics>("fetch_online_lyrics", { provider, providerId }),
  fetchTrackComments: (provider: string, commentId: string, limit = 8) =>
    invoke<string[]>("fetch_track_comments", { provider, commentId, limit }),
  fetchHotChart: (limit = 20) =>
    invoke<string[]>("fetch_hot_chart", { limit }),
  playOnline: (playUrl: string) =>
    invoke<void>("play_online", { track: { play_url: playUrl } }),
  generateHostLine: (context: HostContext) =>
    invoke<string>("generate_host_line", { context }),
  chatWithHost: (message: string, context: HostContext) =>
    invoke<string>("chat_with_host", { message, context }),
  planHostAction: (message: string, context: HostContext) =>
    invoke<HostActionResponse>("plan_host_action", { message, context }),
  speak: (text: string, voice?: string) =>
    invoke<void>("speak_line", { text, voice }),
  openQQLogin: () => invoke<void>("open_qq_login"),
  importQQCookies: () => invoke<string>("import_qq_cookies"),
  closeQQLogin: () => invoke<void>("close_qq_login"),
};

export const events = {
  onTrackChanged: (cb: (e: TrackChangedEvent) => void): Promise<UnlistenFn> =>
    listen<TrackChangedEvent>("playback:track-changed", (e) => cb(e.payload)),
  onPlaybackState: (cb: (e: PlaybackStateEvent) => void): Promise<UnlistenFn> =>
    listen<PlaybackStateEvent>("playback:state", (e) => cb(e.payload)),
  onPosition: (cb: (e: PositionEvent) => void): Promise<UnlistenFn> =>
    listen<PositionEvent>("playback:position", (e) => cb(e.payload)),
  onSubtitle: (cb: (e: SubtitleEvent) => void): Promise<UnlistenFn> =>
    listen<SubtitleEvent>("playback:subtitle", (e) => cb(e.payload)),
  onSpectrum: (cb: (e: SpectrumEvent) => void): Promise<UnlistenFn> =>
    listen<SpectrumEvent>("playback:spectrum", (e) => cb(e.payload)),
  onError: (cb: (msg: string) => void): Promise<UnlistenFn> =>
    listen<{ message: string }>("playback:error", (e) => cb(e.payload.message)),
  onSidecarStatus: (
    cb: (e: { state: string; message: string }) => void,
  ): Promise<UnlistenFn> =>
    listen<{ state: string; message: string }>("sidecar:status", (e) => cb(e.payload)),
};
