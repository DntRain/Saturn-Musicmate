import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { CommandOverlay } from "./components/CommandOverlay";
import { LibraryView } from "./components/LibraryView";
import { NowPlayingView } from "./components/NowPlayingView";
import { PlaylistsView } from "./components/PlaylistsView";
import { SearchView } from "./components/SearchView";
import { HostView, makeReplyLine, type ChatLine } from "./components/HostView";
import { PlayerBar } from "./components/PlayerBar";
import { Waveform } from "./components/Waveform";
import { usePlayer } from "./state/player";
import { usePlaylists } from "./state/playlists";
import { useSidecar } from "./state/sidecar";
import { api } from "./ipc";
import type { HostContext, OnlineTrackContext, Track, ViewName } from "./types";

const AUTO_INTRO_DELAY_MS = 12_000;
const LONG_PAUSE_DELAY_MS = 90_000;

function trackKey(track: Track | null | undefined): string {
  if (!track) return "";
  return track.provider_id
    ? `${track.provider}:${track.provider_id}`
    : `${track.path}:${track.title}:${track.artist}`;
}

export default function App() {
  const player = usePlayer();
  const playlists = usePlaylists();
  const sidecar = useSidecar();
  const [view, setView] = useState<ViewName>("host");
  const [toast, setToast] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OnlineTrackContext[]>([]);
  const [hotChart, setHotChart] = useState<string[]>([]);
  const previousTrackRef = useRef<Track | null>(null);
  const lastPositionRef = useRef(0);
  const trackStartedAtRef = useRef<number | null>(null);
  const autoTokenRef = useRef(0);
  const autoBusyRef = useRef(false);
  const longPauseSpokenRef = useRef(false);
  const playingRef = useRef(false);

  const currentTrack = useMemo(
    () =>
      player.state.currentIndex != null
        ? player.state.tracks[player.state.currentIndex] ?? null
        : null,
    [player.state.currentIndex, player.state.tracks],
  );
  const currentTrackKey = useMemo(() => trackKey(currentTrack), [currentTrack]);

  useEffect(() => {
    if (player.state.error) {
      setToast(player.state.error);
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [player.state.error]);

  useEffect(() => {
    lastPositionRef.current = player.state.positionMs;
  }, [player.state.positionMs]);

  useEffect(() => {
    playingRef.current = player.state.playing;
  }, [player.state.playing]);

  const buildAutoHostContext = useCallback(
    (trigger: HostContext["trigger"], previous?: Track | null): HostContext => {
      const now = new Date();
      return {
        persona: { name: "Silen", style: "松弛、克制、不过度热情" },
        current_title: currentTrack?.title ?? null,
        current_artist: currentTrack?.artist ?? null,
        current_album: currentTrack?.album ?? null,
        previous_title: previous?.title ?? null,
        previous_artist: previous?.artist ?? null,
        hour: now.getHours(),
        minute: now.getMinutes(),
        spoken_lines: chatLines
          .filter(
            (line): line is Extract<ChatLine, { kind: "reply" }> =>
              line.kind === "reply" && !line.pending,
          )
          .map((line) => line.text)
          .slice(-5),
        recent_tracks: player.state.tracks
          .slice(0, 5)
          .map((track) => ({ title: track.title, artist: track.artist })),
        session_gap_hours: null,
        total_sessions: 1,
        trigger,
        available_playlists: playlists.playlists.map((playlist) => playlist.name),
      };
    },
    [chatLines, currentTrack, player.state.tracks, playlists.playlists],
  );

  const speakAutoLine = useCallback(
    async (lineFactory: () => Promise<string>) => {
      if (autoBusyRef.current) return;
      autoBusyRef.current = true;
      try {
        const text = (await lineFactory()).trim();
        if (!text) return;
        setChatLines((lines) => [...lines, makeReplyLine(text)]);
        await api.speak(text).catch(() => {});
      } catch {
        // Automatic commentary should never interrupt playback with an error toast.
      } finally {
        autoBusyRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    const key = currentTrackKey;
    const track = currentTrack;
    const previous = previousTrackRef.current;
    const previousKey = trackKey(previous);
    const token = ++autoTokenRef.current;

    if (!key || !track) {
      previousTrackRef.current = null;
      trackStartedAtRef.current = null;
      return;
    }

    if (key === previousKey) return;

    const previousDurationMs = (previous?.duration_secs ?? 0) * 1000;
    const wasNearEnd =
      previousDurationMs > 0
        ? lastPositionRef.current >= previousDurationMs * 0.82
        : trackStartedAtRef.current != null &&
          Date.now() - trackStartedAtRef.current > 30_000;

    previousTrackRef.current = track;
    trackStartedAtRef.current = Date.now();
    longPauseSpokenRef.current = false;

    if (previous && wasNearEnd) {
      window.setTimeout(() => {
        if (autoTokenRef.current !== token) return;
        speakAutoLine(() =>
          api.chatWithHost(
            `上一首《${previous.title}》-${previous.artist} 刚结束。请用一句很短的电台串场解说连接到现在这首《${track.title}》-${track.artist}，不要推荐新歌，不要超过 45 字。`,
            buildAutoHostContext("transition", previous),
          ),
        );
      }, 800);
    }

    window.setTimeout(() => {
      if (autoTokenRef.current !== token || !playingRef.current) return;
      speakAutoLine(() =>
        api.chatWithHost(
          `这首《${track.title}》-${track.artist} 已经播放了一小段。请做一句简短开场解说，可以提到歌曲气质、歌手或适合的聆听场景，不要超过 50 字。`,
          buildAutoHostContext("transition", previous),
        ),
      );
    }, AUTO_INTRO_DELAY_MS);
  }, [currentTrackKey, speakAutoLine]);

  useEffect(() => {
    if (player.state.playing || !currentTrack) {
      longPauseSpokenRef.current = false;
      return;
    }
    const token = autoTokenRef.current;
    const timer = window.setTimeout(() => {
      if (autoTokenRef.current !== token || player.state.playing || longPauseSpokenRef.current) {
        return;
      }
      longPauseSpokenRef.current = true;
      speakAutoLine(() =>
        api.chatWithHost(
          `音乐停顿有点久。请普及一个和《${currentTrack.title}》-${currentTrack.artist}、歌手背景、音乐风格或民谣/流行音乐有关的短知识，不要换歌，不要超过 70 字。`,
          buildAutoHostContext("hourly", previousTrackRef.current),
        ),
      );
    }, LONG_PAUSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [buildAutoHostContext, currentTrack, player.state.playing, speakAutoLine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOverlayOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pickFolder = useCallback(async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (typeof dir === "string") {
        const tracks = await api.scanLibrary(dir);
        await player.loadTracks(tracks);
        setView("library");
        setOverlayOpen(false);
      }
    } catch (e) {
      setToast(String(e));
    }
  }, [player]);

  const playOnlineTrack = useCallback(
    async (track: Track, _playUrl: string) => {
      await player.loadTracks([track]);
      await player.playIndex(0);
    },
    [player],
  );

  const onLoadOnline = useCallback(
    async (track: Track, playUrl: string) => {
      setView("now-playing");
      await playOnlineTrack(track, playUrl);
    },
    [playOnlineTrack],
  );

  return (
    <div className="relative flex h-screen w-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <main className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col"
          >
            {view === "library" && (
              <LibraryView
                tracks={player.state.tracks}
                currentIndex={player.state.currentIndex}
                playing={player.state.playing}
                onPlay={player.playIndex}
                player={player}
                playlists={playlists}
              />
            )}
            {view === "playlists" && (
              <PlaylistsView player={player} playlists={playlists} />
            )}
            {view === "now-playing" && <NowPlayingView player={player} />}
            {view === "search" && (
              <SearchView
                onLoadOnlineAsTrack={onLoadOnline}
                query={searchQuery}
                setQuery={setSearchQuery}
                results={searchResults}
                setResults={setSearchResults}
                hot={hotChart}
                setHot={setHotChart}
                player={player}
                playlists={playlists}
              />
            )}
            {view === "host" && (
              <HostView
                player={player}
                playlists={playlists}
                onLoadOnline={playOnlineTrack}
                lines={chatLines}
                setLines={setChatLines}
                input={chatInput}
                setInput={setChatInput}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Waveform playing={player.state.playing} cover={player.state.cover} />
      <PlayerBar player={player} onOpenNowPlaying={() => setView("now-playing")} />
      <AnimatePresence>
        {overlayOpen && (
          <CommandOverlay
            active={view}
            onSelect={setView}
            onClose={() => setOverlayOpen(false)}
            onPickFolder={pickFolder}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md bg-black/80 px-4 py-2 text-[12.5px] text-white shadow-lg backdrop-blur"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sidecar.state !== "idle" && sidecar.state !== "ready" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-[12px] text-white shadow-lg backdrop-blur"
          >
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
            {sidecar.message || "在线服务启动中…"}
          </motion.div>
        )}
      </AnimatePresence>
      {player.state.subtitle.active && player.state.subtitle.text && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 max-w-2xl -translate-x-1/2 rounded-full bg-black/70 px-5 py-2 text-center text-[13px] text-white backdrop-blur">
          {player.state.subtitle.text}
        </div>
      )}
    </div>
  );
}
