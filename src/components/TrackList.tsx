import clsx from "clsx";
import { formatTime } from "../utils/format";
import { TrackActions } from "./TrackActions";
import type { PlayerApi } from "../state/player";
import type { PlaylistsApi } from "../state/playlists";
import type { Track } from "../types";

export function TrackList({
  tracks,
  currentIndex,
  playing,
  onPlay,
  player,
  playlists,
}: {
  tracks: Track[];
  currentIndex: number | null;
  playing: boolean;
  onPlay: (index: number) => void;
  player: PlayerApi;
  playlists: PlaylistsApi;
}) {
  if (tracks.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
        <span className="text-sm">还没有歌曲</span>
        <span className="text-xs">在「设置」里点「打开音乐文件夹」开始</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[40px_1fr_1fr_60px_32px] items-center gap-3 border-b border-[var(--color-border)] px-4 py-2 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        <span className="text-center">#</span>
        <span>标题</span>
        <span>专辑</span>
        <span className="text-right">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span />
      </div>
      <ul className="flex flex-col">
        {tracks.map((t, i) => {
          const isCurrent = i === currentIndex;
          return (
            <li
              key={t.path + i}
              onDoubleClick={() => onPlay(i)}
              className={clsx(
                "group grid cursor-pointer grid-cols-[40px_1fr_1fr_60px_32px] items-center gap-3 rounded-md px-4 py-1.5 transition-colors",
                isCurrent ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-1)]",
              )}
            >
              <span className="text-center text-[12px] text-[var(--color-text-muted)]">
                {isCurrent ? (
                  playing ? (
                    <span className="inline-flex items-end gap-[2px] text-[var(--color-accent)]">
                      <span className="h-2 w-[2px] animate-pulse bg-current" />
                      <span className="h-3 w-[2px] animate-pulse bg-current [animation-delay:.15s]" />
                      <span className="h-1.5 w-[2px] animate-pulse bg-current [animation-delay:.3s]" />
                    </span>
                  ) : (
                    <span className="text-[var(--color-accent)]">▶</span>
                  )
                ) : (
                  <button
                    onClick={() => onPlay(i)}
                    className="opacity-0 group-hover:opacity-100"
                    aria-label="播放"
                  >
                    ▶
                  </button>
                )}
                {!isCurrent && (
                  <span className="group-hover:hidden">{i + 1}</span>
                )}
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span
                  className={clsx(
                    "truncate text-[13px]",
                    isCurrent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]",
                  )}
                >
                  {t.title}
                </span>
                <span className="truncate text-[12px] text-[var(--color-text-dim)]">
                  {t.artist}
                </span>
              </div>
              <span className="truncate text-[12px] text-[var(--color-text-dim)]">
                {t.album}
              </span>
              <span className="text-right text-[12px] text-[var(--color-text-dim)] tabular-nums">
                {t.duration_secs ? formatTime(t.duration_secs) : "--:--"}
              </span>
              <div className="flex justify-end opacity-0 group-hover:opacity-100">
                <TrackActions tracks={[t]} player={player} playlists={playlists} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
