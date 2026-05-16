import { useEffect, useState } from "react";
import { CoverArt } from "./CoverArt";
import { formatMs, formatTime } from "../utils/format";
import type { PlayerApi } from "../state/player";

export function PlayerBar({ player, onOpenNowPlaying }: { player: PlayerApi; onOpenNowPlaying: () => void }) {
  const { state, toggle, next, prev, setVolume } = player;
  const track = state.currentIndex != null ? state.tracks[state.currentIndex] : null;
  const durationMs = (track?.duration_secs ?? 0) * 1000;
  const progress = durationMs > 0 ? state.positionMs / durationMs : 0;

  const [localVol, setLocalVol] = useState(state.volume);
  useEffect(() => setLocalVol(state.volume), [state.volume]);

  return (
    <footer className="glass flex h-20 shrink-0 items-center gap-4 border-t border-[var(--color-border)] px-4">
      <button
        onClick={onOpenNowPlaying}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-white/5"
      >
        <CoverArt src={state.cover} size="md" rounded="md" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] text-white">
            {track?.title ?? "未选择曲目"}
          </span>
          <span className="truncate text-[11.5px] text-[var(--color-text-dim)]">
            {track ? `${track.artist}${track.album ? " — " + track.album : ""}` : "把音乐放进来"}
          </span>
        </div>
      </button>

      <div className="flex flex-[2] flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <IconButton onClick={() => prev()} title="上一首">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </IconButton>
          <button
            onClick={() => toggle()}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
            title={state.playing ? "暂停" : "播放"}
          >
            {state.playing ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <IconButton onClick={() => next()} title="下一首">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>
          </IconButton>
        </div>
        <div className="flex w-full items-center gap-2">
          <span className="w-10 text-right text-[10.5px] tabular-nums text-[var(--color-text-muted)]">
            {formatMs(state.positionMs)}
          </span>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-white/80 transition-[width] duration-300"
              style={{ width: `${clampPct(progress)}%` }}
            />
          </div>
          <span className="w-10 text-[10.5px] tabular-nums text-[var(--color-text-muted)]">
            {track?.duration_secs ? formatTime(track.duration_secs) : "--:--"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-dim)]">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={localVol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLocalVol(v);
            setVolume(v);
          }}
          style={{ ["--progress" as string]: `${localVol * 100}%` }}
          className="w-28"
        />
      </div>
    </footer>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-dim)] transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </button>
  );
}

function clampPct(p: number) {
  return Math.min(100, Math.max(0, p * 100));
}
