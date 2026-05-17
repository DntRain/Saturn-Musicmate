export interface Track {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_secs?: number | null;
  provider?: string | null;
  provider_id?: string | null;
  comment_id?: string | null;
  cover_url?: string | null;
  comments?: string[];
}

export interface LyricLine {
  time_ms: number;
  text: string;
}

export interface Lyrics {
  source: string;
  raw: string;
  synced: LyricLine[];
}

export interface OnlineTrackContext {
  provider: string;
  provider_id?: string | null;
  comment_id?: string | null;
  title: string;
  artist: string;
  album: string;
  cover_url?: string | null;
  play_url?: string | null;
  duration_secs?: number | null;
  comments: string[];
}

export interface TrackChangedEvent {
  index: number;
  path: string;
}

export interface PlaybackStateEvent {
  playing: boolean;
}

export interface PositionEvent {
  position_ms: number;
}

export interface SubtitleEvent {
  text: string;
  active: boolean;
}

export interface ErrorEvent {
  message: string;
}

export interface SpectrumEvent {
  bands: number[];
}

export type ViewName = "library" | "playlists" | "search" | "now-playing" | "host" | "settings";

export type ThemePreference = "" | "dark" | "light" | "system";

export interface AppSettings {
  deepseek_api_key: string;
  deepseek_model: string;
  qq_api_base: string;
  qq_cookies: string;
  theme: ThemePreference;
}

export interface SettingsSaveOutcome {
  saved: AppSettings;
  sidecar_restarted: boolean;
}

export interface HostContext {
  persona: { name: string; style: string };
  current_title?: string | null;
  current_artist?: string | null;
  current_album?: string | null;
  previous_title?: string | null;
  previous_artist?: string | null;
  hour: number;
  minute: number;
  spoken_lines: string[];
  recent_tracks: { title: string; artist: string }[];
  session_gap_hours?: number | null;
  total_sessions: number;
  trigger: "welcome" | "transition" | "hourly";
  available_playlists: string[];
}

export type HostActionKind =
  | "chat"
  | "search_song"
  | "play_chart"
  | "explain_current"
  | "add_to_queue"
  | "play_next"
  | "create_playlist"
  | "add_to_playlist";

export interface HostActionResponse {
  action: HostActionKind;
  query?: string | null;
  queries?: string[];
  chart?: string | null;
  reply: string;
  playlist_name?: string | null;
}
