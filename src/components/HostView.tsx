import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../ipc";
import type { PlayerApi } from "../state/player";
import type { PlaylistsApi } from "../state/playlists";
import type { HostContext, OnlineTrackContext, Track } from "../types";

export type ToolKey =
  | "search"
  | "play"
  | "queue_append"
  | "queue_next"
  | "playlist_create"
  | "playlist_add"
  | "chart";

export type ChatLine =
  | { id: string; kind: "user"; text: string; ts: number }
  | { id: string; kind: "thinking"; ts: number; done?: boolean }
  | {
      id: string;
      kind: "tool";
      ts: number;
      tool: ToolKey;
      status: "running" | "ok" | "error";
      input?: string;
      summary?: string;
      tracks?: Track[];
      playlistName?: string;
      errorText?: string;
    }
  | { id: string; kind: "reply"; text: string; pending?: boolean; ts: number };

interface HostViewProps {
  player: PlayerApi;
  playlists: PlaylistsApi;
  onLoadOnline: (track: Track, playUrl: string) => Promise<void> | void;
  lines: ChatLine[];
  setLines: Dispatch<SetStateAction<ChatLine[]>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
}

const TOOL_LABEL: Record<ToolKey, string> = {
  search: "search_online",
  play: "play_track",
  queue_append: "queue.append",
  queue_next: "queue.play_next",
  playlist_create: "playlist.create",
  playlist_add: "playlist.add",
  chart: "fetch_hot_chart",
};

let lineCounter = 0;
function makeId(prefix: string): string {
  lineCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${lineCounter}`;
}

export function makeReplyLine(text: string): ChatLine {
  return { id: makeId("auto"), kind: "reply", text, ts: Date.now() };
}

function trackFromOnline(c: OnlineTrackContext): Track | null {
  if (!c.play_url) return null;
  return {
    path: c.play_url,
    title: c.title,
    artist: c.artist,
    album: c.album,
    duration_secs: c.duration_secs ?? null,
    provider: c.provider,
    provider_id: c.provider_id ?? null,
    comment_id: c.comment_id ?? null,
    cover_url: c.cover_url ?? null,
    comments: c.comments,
  };
}

function sameTrack(a: Track | null | undefined, b: Track | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.provider_id && b.provider_id && a.provider_id === b.provider_id) return true;
  if (a.path && b.path && a.path === b.path) return true;
  return (
    a.title.trim().toLowerCase() === b.title.trim().toLowerCase() &&
    a.artist.trim().toLowerCase() === b.artist.trim().toLowerCase()
  );
}

function asksForDifferentTrack(message: string): boolean {
  return /换|另一|别的|不要这首|下一首|不同/.test(message);
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const track of tracks) {
    const key = track.provider_id
      ? `${track.provider}:${track.provider_id}`
      : `${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
  }
  return out;
}

function matchPlaylistName(input: string, names: string[]): string | null {
  if (!input) return null;
  const exact = names.find((n) => n === input);
  if (exact) return exact;
  const ci = names.find((n) => n.toLowerCase() === input.toLowerCase());
  if (ci) return ci;
  const sub = names.find((n) => n.includes(input) || input.includes(n));
  return sub ?? null;
}

export function HostView({
  player,
  playlists,
  onLoadOnline,
  lines,
  setLines,
  input,
  setInput,
}: HostViewProps) {
  const { state } = player;
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const [coverPalette, setCoverPalette] = useState<{
    r: number;
    g: number;
    b: number;
  } | null>(null);

  useEffect(() => {
    if (!state.cover) {
      setCoverPalette(null);
      return;
    }
    let cancelled = false;
    api
      .getCoverPalette(state.cover)
      .then((p) => {
        if (!cancelled) setCoverPalette({ r: p.r, g: p.g, b: p.b });
      })
      .catch(() => {
        if (!cancelled) setCoverPalette(null);
      });
    return () => {
      cancelled = true;
    };
  }, [state.cover]);

  const currentTrack = useMemo(
    () => (state.currentIndex != null ? state.tracks[state.currentIndex] ?? null : null),
    [state.currentIndex, state.tracks],
  );

  const lastPlayedKeyRef = useRef<string | null>(null);
  const playInitRef = useRef(false);

  useEffect(() => {
    const key = currentTrack
      ? currentTrack.provider_id
        ? `${currentTrack.provider}:${currentTrack.provider_id}`
        : currentTrack.path
      : null;
    if (!playInitRef.current) {
      playInitRef.current = true;
      lastPlayedKeyRef.current = key;
      return;
    }
    if (key === lastPlayedKeyRef.current) return;
    lastPlayedKeyRef.current = key;
    if (!currentTrack) return;
    const track = currentTrack;
    setLines((ls) => [
      ...ls,
      {
        id: makeId("tool"),
        kind: "tool",
        tool: "play",
        status: "ok",
        summary: "开始播放",
        tracks: [track],
        ts: Date.now(),
      },
    ]);
  }, [currentTrack, setLines]);

  const buildContext = useCallback(
    (trigger: HostContext["trigger"]): HostContext => {
      const now = new Date();
      return {
        persona: { name: "Silen", style: "松弛、克制、不过度热情" },
        current_title: currentTrack?.title ?? null,
        current_artist: currentTrack?.artist ?? null,
        current_album: currentTrack?.album ?? null,
        previous_title: null,
        previous_artist: null,
        hour: now.getHours(),
        minute: now.getMinutes(),
        spoken_lines: lines
          .filter((l): l is Extract<ChatLine, { kind: "reply" }> => l.kind === "reply" && !l.pending)
          .map((l) => l.text)
          .slice(-5),
        recent_tracks: state.tracks
          .slice(0, 5)
          .map((t) => ({ title: t.title, artist: t.artist })),
        session_gap_hours: null,
        total_sessions: 1,
        trigger,
        available_playlists: playlists.playlists.map((p) => p.name),
      };
    },
    [currentTrack, lines, playlists.playlists, state.tracks],
  );

  const pushLine = useCallback(
    (line: ChatLine) => setLines((ls) => [...ls, line]),
    [setLines],
  );

  const patchLine = useCallback(
    (id: string, patch: Record<string, unknown>) =>
      setLines((ls) =>
        ls.map((l) => (l.id === id ? ({ ...l, ...patch } as ChatLine) : l)),
      ),
    [setLines],
  );

  const startTool = useCallback(
    (tool: ToolKey, input?: string): string => {
      const id = makeId("tool");
      pushLine({ id, kind: "tool", tool, status: "running", input, ts: Date.now() });
      return id;
    },
    [pushLine],
  );

  const onGenerate = async () => {
    setBusy(true);
    try {
      const ctx = buildContext(currentTrack ? "transition" : "welcome");
      const text = await api.generateHostLine(ctx);
      pushLine(makeReplyLine(text));
      api.speak(text).catch(() => {});
    } catch (e) {
      pushLine(makeReplyLine(`（出错：${e}）`));
    } finally {
      setBusy(false);
    }
  };

  const searchOne = async (query: string, avoidCurrent = false): Promise<Track | null> => {
    const results = await api.searchOnline(query, 20);
    for (const r of results) {
      const t = trackFromOnline(r);
      if (!t) continue;
      if (avoidCurrent && sameTrack(t, currentTrack)) continue;
      return t;
    }
    return null;
  };

  const playFirstPlayable = async (
    candidates: OnlineTrackContext[],
    avoidCurrent = false,
  ): Promise<Track | null> => {
    for (const c of candidates) {
      const t = trackFromOnline(c);
      if (!t) continue;
      if (avoidCurrent && sameTrack(t, currentTrack)) continue;
      await onLoadOnline(t, t.path);
      return t;
    }
    return null;
  };

  const searchManyPlayable = async (
    queries: string[],
    avoidCurrent = false,
    perQueryLimit = 5,
  ): Promise<Track[]> => {
    const tracks: Track[] = [];
    for (const q of queries.map((v) => v.trim()).filter(Boolean).slice(0, 8)) {
      const results = await api.searchOnline(q, perQueryLimit);
      for (const r of results) {
        const t = trackFromOnline(r);
        if (!t) continue;
        if (avoidCurrent && sameTrack(t, currentTrack)) continue;
        tracks.push(t);
        break;
      }
    }
    return dedupeTracks(tracks);
  };

  const playRecommendedList = async (tracks: Track[]): Promise<Track | null> => {
    const playable = dedupeTracks(tracks).slice(0, 12);
    if (playable.length === 0) return null;
    await player.loadTracks(playable);
    await player.playIndex(0);
    return playable[0];
  };

  const onSend = async (override?: string) => {
    const msg = (override ?? input).trim();
    if (!msg) return;
    if (!override) setInput("");
    pushLine({ id: makeId("user"), kind: "user", text: msg, ts: Date.now() });
    const thinkingId = makeId("think");
    pushLine({ id: thinkingId, kind: "thinking", ts: Date.now() });
    setBusy(true);
    try {
      const ctx = buildContext("transition");
      const planningMessage = currentTrack
        ? `${msg}\n\n当前正在播放：《${currentTrack.title}》-${currentTrack.artist}。如果用户要求换一首、另一首、别的歌或下一首，不要继续推荐或搜索当前这首歌，query 必须避开《${currentTrack.title}》。`
        : msg;
      const shouldAvoidCurrent = asksForDifferentTrack(msg);
      const plan = await api.planHostAction(planningMessage, ctx);
      patchLine(thinkingId, { done: true });

      let errorNote: string | null = null;
      try {
        if (plan.action === "search_song" && (plan.query || (plan.queries?.length ?? 0) > 0)) {
          const multiQueries = plan.queries?.filter((q) => q.trim()) ?? [];
          const queriesShown = multiQueries.length > 0 ? multiQueries : [plan.query!];
          const searchToolId = startTool("search", queriesShown.join(" / "));

          let recommended: Track[] = [];
          if (multiQueries.length > 0) {
            recommended = await searchManyPlayable(multiQueries, shouldAvoidCurrent);
          }
          let played: Track | null = null;

          if (recommended.length > 0) {
            patchLine(searchToolId, {
              status: "ok",
              summary: `找到 ${recommended.length} 首推荐`,
              tracks: recommended.slice(0, 5),
            });
            played = await playRecommendedList(recommended);
          } else {
            const direct = await api.searchOnline(plan.query ?? "", 20);
            played = await playFirstPlayable(direct, shouldAvoidCurrent);
            patchLine(searchToolId, {
              status: played ? "ok" : "error",
              summary: played ? "命中 1 首" : "没找到可播放结果",
              tracks: played ? [played] : undefined,
              errorText: played ? undefined : "查无结果",
            });
          }

          if (!played) {
            errorNote = `没找到可播放的「${plan.query ?? queriesShown.join("、")}」`;
          }
        } else if (plan.action === "play_chart") {
          const chartToolId = startTool("chart", "QQ 热歌榜 Top 6");
          let queries: string[] = [];
          try {
            queries = await api.fetchHotChart(6);
            patchLine(chartToolId, {
              status: "ok",
              summary: `取得 ${queries.length} 条热门关键词`,
            });
          } catch (e) {
            patchLine(chartToolId, { status: "error", errorText: String(e) });
          }

          let played: Track | null = null;
          if (queries.length > 0) {
            const searchToolId = startTool("search", queries.join(" / "));
            for (const q of queries) {
              const results = await api.searchOnline(q, 10);
              played = await playFirstPlayable(results, shouldAvoidCurrent);
              if (played) break;
            }
            patchLine(searchToolId, {
              status: played ? "ok" : "error",
              summary: played ? `命中《${played.title}》` : "热榜里没拿到可播放歌曲",
              tracks: played ? [played] : undefined,
            });
          }
          if (!played) errorNote = "热榜里暂时没拿到可播放的歌";
        } else if (plan.action === "add_to_queue" && plan.query) {
          const searchToolId = startTool("search", plan.query);
          const track = await searchOne(plan.query, shouldAvoidCurrent);
          patchLine(searchToolId, {
            status: track ? "ok" : "error",
            summary: track ? `命中《${track.title}》` : "查无结果",
            tracks: track ? [track] : undefined,
          });
          if (track) {
            const queueToolId = startTool("queue_append", `${track.title} — ${track.artist}`);
            try {
              await player.enqueue([track]);
              patchLine(queueToolId, {
                status: "ok",
                summary: "已追加到队列末尾",
                tracks: [track],
              });
            } catch (e) {
              patchLine(queueToolId, { status: "error", errorText: String(e) });
              errorNote = "加入队列失败";
            }
          } else {
            errorNote = `没找到「${plan.query}」`;
          }
        } else if (plan.action === "play_next" && plan.query) {
          const searchToolId = startTool("search", plan.query);
          const track = await searchOne(plan.query, shouldAvoidCurrent);
          patchLine(searchToolId, {
            status: track ? "ok" : "error",
            summary: track ? `命中《${track.title}》` : "查无结果",
            tracks: track ? [track] : undefined,
          });
          if (track) {
            const nextToolId = startTool("queue_next", `${track.title} — ${track.artist}`);
            try {
              await player.playNext([track]);
              patchLine(nextToolId, {
                status: "ok",
                summary: "插到下一首位",
                tracks: [track],
              });
            } catch (e) {
              patchLine(nextToolId, { status: "error", errorText: String(e) });
              errorNote = "插入失败";
            }
          } else {
            errorNote = `没找到「${plan.query}」`;
          }
        } else if (plan.action === "create_playlist" && plan.playlist_name) {
          const createToolId = startTool("playlist_create", plan.playlist_name);
          let createdName: string | null = null;
          try {
            const created = await playlists.create(plan.playlist_name);
            createdName = created.name;
            patchLine(createToolId, {
              status: "ok",
              summary: "已创建空歌单",
              playlistName: created.name,
            });

            if (plan.query) {
              const searchToolId = startTool("search", plan.query);
              const results = await api.searchOnline(plan.query, 30);
              const tracks = results
                .map(trackFromOnline)
                .filter((track): track is Track => !!track)
                .filter((track) => !(shouldAvoidCurrent && sameTrack(track, currentTrack)))
                .slice(0, 8);
              patchLine(searchToolId, {
                status: tracks.length > 0 ? "ok" : "error",
                summary:
                  tracks.length > 0 ? `命中 ${tracks.length} 首` : "查无结果",
                tracks: tracks.slice(0, 5),
              });

              if (tracks.length > 0) {
                const addToolId = startTool(
                  "playlist_add",
                  `→ ${createdName} · ${tracks.length} 首`,
                );
                try {
                  await playlists.addTracks(created.id, tracks);
                  patchLine(addToolId, {
                    status: "ok",
                    summary: "写入歌单",
                    tracks: tracks.slice(0, 5),
                    playlistName: createdName,
                  });
                } catch (e) {
                  patchLine(addToolId, { status: "error", errorText: String(e) });
                  errorNote = "写入歌单失败";
                }
              }
            }
          } catch (e) {
            patchLine(createToolId, { status: "error", errorText: String(e) });
            errorNote = "创建歌单失败";
          }
        } else if (plan.action === "add_to_playlist") {
          const names = playlists.playlists.map((p) => p.name);
          const matched = matchPlaylistName(plan.playlist_name ?? "", names);
          if (!matched) {
            errorNote = `没找到歌单「${plan.playlist_name ?? ""}」`;
          } else {
            const target = playlists.playlists.find((p) => p.name === matched)!;
            let trackToAdd: Track | null = null;
            if (plan.query) {
              const searchToolId = startTool("search", plan.query);
              trackToAdd = await searchOne(plan.query, shouldAvoidCurrent);
              patchLine(searchToolId, {
                status: trackToAdd ? "ok" : "error",
                summary: trackToAdd ? `命中《${trackToAdd.title}》` : "查无结果",
                tracks: trackToAdd ? [trackToAdd] : undefined,
              });
            } else if (currentTrack) {
              trackToAdd = currentTrack;
            }

            if (trackToAdd) {
              const addToolId = startTool(
                "playlist_add",
                `${trackToAdd.title} → ${matched}`,
              );
              try {
                await playlists.addTracks(target.id, [trackToAdd]);
                patchLine(addToolId, {
                  status: "ok",
                  summary: "已加入歌单",
                  tracks: [trackToAdd],
                  playlistName: matched,
                });
              } catch (e) {
                patchLine(addToolId, { status: "error", errorText: String(e) });
                errorNote = "加入歌单失败";
              }
            } else {
              errorNote = "没找到要加入的歌曲";
            }
          }
        }
      } catch (e) {
        errorNote = `执行动作出错：${e}`;
      }

      const text = errorNote ? `${plan.reply}\n（${errorNote}）` : plan.reply;
      pushLine({ id: makeId("reply"), kind: "reply", text, ts: Date.now() });
      api.speak(plan.reply).catch(() => {});
    } catch (e) {
      patchLine(thinkingId, { done: true });
      pushLine({ id: makeId("reply"), kind: "reply", text: `（出错：${e}）`, ts: Date.now() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      <CoverTint palette={coverPalette} />
      <div className="relative z-10 flex h-full flex-col">
      <HostHeader
        currentTrack={currentTrack}
        playing={state.playing}
        cover={state.cover}
        onGenerate={onGenerate}
        busy={busy}
      />

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className={
            lines.length === 0
              ? "h-full overflow-y-auto px-6"
              : "h-full overflow-y-auto px-6 pb-32"
          }
        >
          {lines.length === 0 ? (
            <EmptyState
              input={input}
              setInput={setInput}
              onSend={onSend}
              busy={busy}
            />
          ) : (
            <Transcript
              lines={lines}
              onPlayTrack={async (t) => {
                await onLoadOnline(t, t.path);
              }}
            />
          )}
        </div>

        {lines.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/85 to-transparent px-6 pb-6 pt-10">
            <div className="pointer-events-auto mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-2.5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.6)] transition-colors focus-within:border-white/20">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder="Reply to Silen…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent py-1 text-[15px] leading-relaxed text-[var(--color-text)] outline-none placeholder:text-white/35"
                />
                <button
                  onClick={() => onSend()}
                  disabled={busy || !input.trim()}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-20"
                  aria-label="发送"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function CoverTint({
  palette,
}: {
  palette: { r: number; g: number; b: number } | null;
}) {
  const key = palette ? `${palette.r}-${palette.g}-${palette.b}` : "none";
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="pointer-events-none absolute inset-0"
        style={
          palette
            ? {
                backgroundImage: `radial-gradient(circle at 18% 12%, rgba(${palette.r},${palette.g},${palette.b},0.22), transparent 45%), radial-gradient(circle at 82% 92%, rgba(${palette.r},${palette.g},${palette.b},0.16), transparent 42%), linear-gradient(180deg, rgba(${palette.r},${palette.g},${palette.b},0.05), transparent 60%)`,
              }
            : undefined
        }
      />
    </AnimatePresence>
  );
}

function HostHeader({
  currentTrack,
  playing,
  cover,
  onGenerate,
  busy,
}: {
  currentTrack: Track | null;
  playing: boolean;
  cover: string | null;
  onGenerate: () => void;
  busy: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-7 w-7 place-items-center">
          <img
            src="/musicmate-saturn-white.svg"
            alt=""
            className="h-7 w-7"
            draggable={false}
          />
          {playing && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--color-bg)] bg-emerald-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-[var(--color-text)]">Silen</span>
          {currentTrack && (
            <span className="text-[12px] text-white/40">
              · 正在听 {currentTrack.title}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {cover && (
          <img
            src={cover}
            alt=""
            className="h-7 w-7 rounded-md object-cover"
          />
        )}
        <button
          onClick={onGenerate}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-[12.5px] text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          开场白
        </button>
      </div>
    </header>
  );
}

function EmptyState({
  input,
  setInput,
  onSend,
  busy,
}: {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onSend: (override?: string) => void | Promise<void>;
  busy: boolean;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Still up?"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : hour < 22
            ? "Good evening"
            : "Still up?";

  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const categories: {
    label: string;
    icon: ReactNode;
    prompt: string;
  }[] = [
    {
      label: "推荐",
      prompt: "推荐一首适合此刻的歌",
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      ),
    },
    {
      label: "歌单",
      prompt: "帮我建一个新歌单",
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </svg>
      ),
    },
    {
      label: "心情",
      prompt: "放点能让我放松的歌",
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      label: "解读",
      prompt: "讲讲正在播的这首",
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      label: "Silen 来挑",
      prompt: "随便挑一首你觉得现在合适的",
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5l1.8 4 4.4.4-3.3 3 1 4.3L12 12l-3.9 2.2 1-4.3-3.3-3 4.4-.4z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-[680px] flex-col items-center justify-start gap-7 px-4 pt-[22vh]">
      <div className="flex items-center justify-center gap-4">
        <img
          src="/musicmate-saturn-white.svg"
          alt=""
          className="h-14 w-14"
          draggable={false}
        />
        <div className="font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.005em] text-[var(--color-text)]">
          {greeting}
        </div>
      </div>

      <div className="w-full">
        <div className="flex flex-col gap-2 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 pb-2 pt-3 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] transition-colors focus-within:border-white/20">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="How can I help you today?"
            rows={2}
            autoFocus
            className="min-h-[52px] w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed text-[var(--color-text)] outline-none placeholder:text-white/35"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled
              aria-label="附件"
              className="grid h-8 w-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              disabled
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-70"
            >
              Silen · Opus 4.7
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                disabled
                aria-label="语音"
                className="grid h-8 w-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              </button>
              <button
                onClick={() => onSend()}
                disabled={busy || !input.trim()}
                className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-text)] text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-20"
                aria-label="发送"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c.label}
              onClick={() => onSend(c.prompt)}
              disabled={busy}
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              <span className="text-white/45">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Transcript({
  lines,
  onPlayTrack,
}: {
  lines: ChatLine[];
  onPlayTrack: (t: Track) => void | Promise<void>;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 py-8">
      <AnimatePresence initial={false}>
        {lines.map((l) => {
          if (l.kind === "user") return <UserLine key={l.id} line={l} />;
          if (l.kind === "thinking") return <ThinkingLine key={l.id} line={l} />;
          if (l.kind === "tool")
            return <ToolLine key={l.id} line={l} onPlayTrack={onPlayTrack} />;
          return <ReplyLine key={l.id} line={l} />;
        })}
      </AnimatePresence>
    </div>
  );
}

function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function UserLine({ line }: { line: Extract<ChatLine, { kind: "user" }> }) {
  return (
    <FadeIn>
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-tr-md bg-[var(--color-bg-elev)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--color-text)]">
          {line.text}
        </div>
      </div>
    </FadeIn>
  );
}

function ThinkingLine({ line }: { line: Extract<ChatLine, { kind: "thinking" }> }) {
  if (line.done) return null;
  return (
    <FadeIn>
      <div className="flex items-center gap-2.5 text-[13px] text-white/55">
        <img
          src="/musicmate-loader-beat-white.svg"
          alt=""
          className="h-5 w-5"
          draggable={false}
        />
        <span>正在思考…</span>
      </div>
    </FadeIn>
  );
}

function ReplyLine({ line }: { line: Extract<ChatLine, { kind: "reply" }> }) {
  return (
    <FadeIn>
      <div className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-[var(--color-text)]">
        {line.text}
      </div>
    </FadeIn>
  );
}

function ToolLine({
  line,
  onPlayTrack,
}: {
  line: Extract<ChatLine, { kind: "tool" }>;
  onPlayTrack: (t: Track) => void | Promise<void>;
}) {
  const label = TOOL_LABEL[line.tool];
  return (
    <FadeIn>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-[13px] leading-relaxed">
        <div className="flex items-center gap-2">
          <StatusBadge status={line.status} />
          <span className="font-mono text-[12.5px] text-white/85">{label}</span>
          {line.input && (
            <span className="font-mono text-[12px] text-white/40">
              ({truncate(line.input, 60)})
            </span>
          )}
        </div>
        {(line.summary || line.errorText) && (
          <div className="ml-[20px] mt-1 text-[12.5px]">
            <span className={line.status === "error" ? "text-rose-300/85" : "text-white/55"}>
              {line.errorText ?? line.summary}
            </span>
          </div>
        )}
        {line.tracks && line.tracks.length > 0 && (
          <div className="ml-[20px] mt-2 flex flex-col gap-1">
            {line.tracks.slice(0, 5).map((t) => (
              <TrackChip key={`${line.id}:${t.path}`} track={t} onPlay={onPlayTrack} />
            ))}
            {line.tracks.length > 5 && (
              <div className="pl-2 text-[11.5px] text-white/35">
                … 另有 {line.tracks.length - 5} 首
              </div>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function TrackChip({
  track,
  onPlay,
}: {
  track: Track;
  onPlay: (t: Track) => void | Promise<void>;
}) {
  return (
    <button
      onClick={() => onPlay(track)}
      className="group flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05]"
    >
      {track.cover_url ? (
        <img src={track.cover_url} alt="" className="h-7 w-7 rounded object-cover" />
      ) : (
        <div className="grid h-7 w-7 place-items-center rounded bg-white/5 text-white/30">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[12px] text-white/90">{track.title}</div>
        <div className="truncate font-sans text-[10.5px] text-white/50">{track.artist}</div>
      </div>
      <span className="select-none font-mono text-[10.5px] text-white/30 opacity-0 transition-opacity group-hover:opacity-100">
        play
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: "running" | "ok" | "error" }) {
  if (status === "running") return <Spinner />;
  if (status === "ok") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-rose-400"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Spinner() {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-[var(--color-accent)]"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </motion.svg>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
