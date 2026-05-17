import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../ipc";
import { CoverArt } from "./CoverArt";
import { TrackActions } from "./TrackActions";
import type { PlayerApi } from "../state/player";
import type { PlaylistsApi } from "../state/playlists";
import type { OnlineTrackContext, Track } from "../types";

interface SearchViewProps {
  onLoadOnlineAsTrack: (track: Track, playUrl: string) => void;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  results: OnlineTrackContext[];
  setResults: Dispatch<SetStateAction<OnlineTrackContext[]>>;
  hot: string[];
  setHot: Dispatch<SetStateAction<string[]>>;
  player: PlayerApi;
  playlists: PlaylistsApi;
}

export function SearchView({
  onLoadOnlineAsTrack,
  query,
  setQuery,
  results,
  setResults,
  hot,
  setHot,
  player,
  playlists,
}: SearchViewProps) {
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hot.length > 0) return;
    api.fetchHotChart(12).then(setHot).catch(() => setHot([]));
  }, [hot.length, setHot]);

  const doSearch = useCallback(async (q: string) => {
    setError(null);
    setLoading(true);
    try {
      const list = await api.searchOnline(q, 30, false);
      setResults(list);
    } catch (e) {
      setError(String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-8 pb-4 pt-7">
        <h1 className="text-3xl font-bold tracking-tight">搜索</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)]">
          QQ 音乐 / 网易云在线搜索（需要本地 API 服务）
          {results.length > 0 && (
            <span className="ml-2 text-[var(--color-text-muted)]">
              共 {results.length} 首
            </span>
          )}
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-2.5">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--color-text-muted)]">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) doSearch(query.trim());
            }}
            placeholder="搜索歌曲、歌手..."
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          {loading && <span className="text-[11.5px] text-[var(--color-text-dim)]">搜索中…</span>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {error && (
          <div className="mb-4 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-3 py-2 text-[12.5px] text-[var(--color-accent)]">
            {error}
          </div>
        )}

        {results.length === 0 && !loading && (
          <div>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">
              热门搜索
            </h2>
            <div className="flex flex-wrap gap-2">
              {hot.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuery(q);
                    doSearch(q);
                  }}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-1.5 text-[12.5px] text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  {q}
                </button>
              ))}
              {hot.length === 0 && (
                <span className="text-[12.5px] text-[var(--color-text-muted)]">
                  暂无（启动 qq-music-api 服务并设置 MUSICMATE_QQ_API_BASE）
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col">
          {results.map((r, i) => {
            const resultId = r.provider_id ?? `${r.provider}:${r.title}:${i}`;
            const canResolve = !!r.provider_id;
            const busyResolving = resolvingId === resultId;
            const track: Track | null = r.play_url
              ? {
                  path: r.play_url,
                  title: r.title,
                  artist: r.artist,
                  album: r.album,
                  duration_secs: r.duration_secs ?? null,
                  provider: r.provider,
                  provider_id: r.provider_id ?? null,
                  comment_id: r.comment_id ?? null,
                  cover_url: r.cover_url ?? null,
                  comments: r.comments,
                }
              : null;
            const playResult = async () => {
              if (!canResolve) return;
              setError(null);
              setResolvingId(resultId);
              try {
                const playUrl =
                  r.play_url ??
                  (await api.resolveOnlinePlayUrl(r.provider, r.provider_id!));
                const nextTrack: Track = {
                  path: playUrl,
                  title: r.title,
                  artist: r.artist,
                  album: r.album,
                  duration_secs: r.duration_secs ?? null,
                  provider: r.provider,
                  provider_id: r.provider_id ?? null,
                  comment_id: r.comment_id ?? null,
                  cover_url: r.cover_url ?? null,
                  comments: r.comments,
                };
                setResults((items) =>
                  items.map((item, idx) =>
                    idx === i ? { ...item, play_url: playUrl } : item,
                  ),
                );
                onLoadOnlineAsTrack(nextTrack, playUrl);
              } catch (e) {
                setError(String(e));
              } finally {
                setResolvingId(null);
              }
            };
            return (
              <motion.div
                key={(r.provider_id ?? r.title) + i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-surface-1)] ${!canResolve ? "opacity-40" : ""}`}
              >
                <button
                  disabled={!canResolve || busyResolving}
                  onClick={playResult}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                >
                  <CoverArt src={r.cover_url} size="md" rounded="md" />
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13.5px] text-[var(--color-text)]">{r.title}</span>
                    <span className="truncate text-[12px] text-[var(--color-text-dim)]">
                      {r.artist}
                      {r.album && (
                        <span className="text-[var(--color-text-muted)]"> · {r.album}</span>
                      )}
                    </span>
                  </div>
                </button>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {r.provider}
                </span>
                {busyResolving && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    获取播放链接…
                  </span>
                )}
                {!canResolve && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    无歌曲 ID
                  </span>
                )}
                {track && (
                  <div className="opacity-0 group-hover:opacity-100">
                    <TrackActions tracks={[track]} player={player} playlists={playlists} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
