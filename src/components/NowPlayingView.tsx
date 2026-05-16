import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { CoverArt } from "./CoverArt";
import { formatMs, formatTime } from "../utils/format";
import { api } from "../ipc";
import type { PlayerApi } from "../state/player";

type RightPane = "lyrics" | "queue" | "comments";

export function NowPlayingView({
  player,
  onBack,
}: {
  player: PlayerApi;
  onBack?: () => void;
}) {
  const { state, toggle, next, prev } = player;
  const track = state.currentIndex != null ? state.tracks[state.currentIndex] : null;
  const durationMs = (track?.duration_secs ?? 0) * 1000;
  const [pane, setPane] = useState<RightPane>("lyrics");

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(250,45,72,0.18),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(135deg,#141416_0%,#0c0c0e_48%,#181115_100%)]">
      <Backdrop cover={state.cover} />
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="收起"
          title="收起"
          className="absolute left-5 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition-colors hover:bg-white/15 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
      <div className="relative z-10 grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12 px-12 py-10">
        <div className="flex min-h-0 flex-col items-center justify-center gap-6">
          <motion.div
            key={state.cover ?? "no-cover"}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <CoverArt src={state.cover} size="xl" rounded="xl" className="shadow-2xl shadow-black/60" />
          </motion.div>

          <div className="flex w-full max-w-sm flex-col items-center gap-1 text-center">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              正在播放
            </div>
            <h2 className="line-clamp-2 text-2xl font-bold tracking-tight">
              {track?.title ?? "选择一首歌"}
            </h2>
            <div className="line-clamp-1 text-[14px] text-[var(--color-text-dim)]">
              {track?.artist}
              {track?.album && (
                <span className="text-[var(--color-text-muted)]"> · {track.album}</span>
              )}
            </div>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-3">
            <Progress positionMs={state.positionMs} durationMs={durationMs} />
            <div className="flex items-center justify-center gap-8">
              <IconBtn onClick={() => prev()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </IconBtn>
              <button
                onClick={() => toggle()}
                className="grid h-14 w-14 place-items-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
              >
                {state.playing ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <IconBtn onClick={() => next()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>
              </IconBtn>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col items-stretch gap-3">
          <div className="flex shrink-0 gap-1 self-start rounded-lg bg-white/5 p-1">
            {(["lyrics", "queue", "comments"] as RightPane[]).map((k) => (
              <button
                key={k}
                onClick={() => setPane(k)}
                className={clsx(
                  "rounded-md px-3 py-1 text-[12.5px] transition-colors",
                  pane === k
                    ? "bg-white/10 text-white"
                    : "text-[var(--color-text-dim)] hover:text-white",
                )}
              >
                {k === "lyrics"
                  ? "歌词"
                  : k === "queue"
                    ? `队列 · ${state.tracks.length}`
                    : `评论 · ${track?.comments?.length ?? 0}`}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {pane === "lyrics" ? (
              <LyricsPanel
                synced={state.lyrics?.synced ?? []}
                raw={state.lyrics?.raw ?? ""}
                positionMs={state.positionMs}
              />
            ) : pane === "queue" ? (
              <QueuePanel player={player} />
            ) : (
              <CommentsPanel comments={track?.comments ?? []} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Backdrop({ cover }: { cover: string | null }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={cover ?? "none"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,45,72,0.16),transparent_32%),radial-gradient(circle_at_78%_16%,rgba(20,184,166,0.10),transparent_30%)]" />
        {cover && (
          <img
            src={cover}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-60 blur-3xl"
          />
        )}
        <div className="absolute inset-0 bg-[var(--color-bg)]/58" />
      </motion.div>
    </AnimatePresence>
  );
}

function Progress({ positionMs, durationMs }: { positionMs: number; durationMs: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const seekable = durationMs > 0;
  const displayMs = dragMs ?? positionMs;
  const pct = seekable ? Math.min(100, (displayMs / durationMs) * 100) : 0;

  const positionFromEvent = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !seekable) return null;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * durationMs;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    const ms = positionFromEvent(e.clientX);
    if (ms == null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragMs(ms);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragMs == null) return;
    const ms = positionFromEvent(e.clientX);
    if (ms != null) setDragMs(ms);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragMs == null) return;
    const ms = positionFromEvent(e.clientX) ?? dragMs;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragMs(null);
    api.seek(ms).catch(() => {});
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-right text-[11.5px] tabular-nums text-[var(--color-text-muted)]">
        {formatMs(displayMs)}
      </span>
      <div
        ref={barRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={clsx(
          "group relative flex h-4 flex-1 items-center",
          seekable ? "cursor-pointer" : "cursor-default",
        )}
      >
        <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={clsx(
              "absolute inset-y-0 left-0 bg-white/85",
              dragMs == null && "transition-[width] duration-200",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {seekable && (
          <div
            className={clsx(
              "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity",
              dragMs == null ? "opacity-0 group-hover:opacity-100" : "opacity-100",
            )}
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
      <span className="w-12 text-[11.5px] tabular-nums text-[var(--color-text-muted)]">
        {seekable ? formatTime(durationMs / 1000) : "--:--"}
      </span>
    </div>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function QueuePanel({ player }: { player: PlayerApi }) {
  const { state, playIndex, removeFromQueue } = player;
  if (state.tracks.length === 0) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-[var(--color-text-muted)]">
        队列是空的
      </div>
    );
  }
  return (
    <div className="lyrics-scroll h-full overflow-y-auto pr-2">
      <ul className="flex flex-col gap-1 py-6">
        {state.tracks.map((t, i) => {
          const isCurrent = i === state.currentIndex;
          return (
            <li
              key={t.path + i}
              className={clsx(
                "group flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                isCurrent ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
              )}
            >
              <button
                onClick={() => playIndex(i)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  className={clsx(
                    "w-5 shrink-0 text-center text-[11.5px] tabular-nums",
                    isCurrent
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)]",
                  )}
                >
                  {isCurrent ? "▶" : i + 1}
                </span>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span
                    className={clsx(
                      "truncate text-[13.5px]",
                      isCurrent ? "text-[var(--color-accent)]" : "text-white",
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="truncate text-[12px] text-[var(--color-text-dim)]">
                    {t.artist}
                  </span>
                </div>
              </button>
              <button
                onClick={() => removeFromQueue(i)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--color-text-dim)] opacity-0 transition-colors hover:bg-white/10 hover:text-white group-hover:opacity-100"
                aria-label="移除"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CommentsPanel({ comments }: { comments: string[] }) {
  if (comments.length === 0) {
    return (
      <div className="grid h-full place-items-center px-8 text-center text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        当前歌曲还没有评论。通过在线搜索播放的歌曲会在这里显示热门评论。
      </div>
    );
  }
  return (
    <div className="lyrics-scroll h-full overflow-y-auto pr-2">
      <ul className="flex flex-col gap-3 py-6">
        {comments.map((comment, i) => (
          <li
            key={`${comment}-${i}`}
            className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3"
          >
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
              热评 {String(i + 1).padStart(2, "0")}
            </div>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">
              {comment}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LYRICS_MASK =
  "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)";

type LyricLineView = { time_ms: number; text: string };

function lyricActiveIndex(synced: LyricLineView[], positionMs: number) {
  if (!synced.length) return -1;
  let idx = -1;
  for (let i = 0; i < synced.length; i++) {
    if (synced[i].time_ms <= positionMs) idx = i;
    else break;
  }
  return idx;
}

const LyricsPanel = memo(function LyricsPanel({
  synced,
  raw,
  positionMs,
}: {
  synced: LyricLineView[];
  raw: string;
  positionMs: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = useMemo(
    () => lyricActiveIndex(synced, positionMs),
    [synced, positionMs],
  );
  const [browseOffset, setBrowseOffset] = useState(0);
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    setBrowseOffset(0);
  }, [synced]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || synced.length === 0) return;
    let timer: number | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaY > 0 ? 1 : -1;
      setBrowseOffset((cur) => {
        const base = activeIndexRef.current >= 0 ? activeIndexRef.current : 0;
        const nextCenter = Math.max(
          0,
          Math.min(synced.length - 1, base + cur + step),
        );
        return nextCenter - base;
      });
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setBrowseOffset(0), 2500);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [synced]);

  if (synced.length === 0) {
    const lines = raw.split("\n").filter((l) => l.trim());
    if (lines.length === 0) {
      return (
        <div className="grid h-full w-full place-items-center text-[13px] text-[var(--color-text-muted)]">
          没有歌词
        </div>
      );
    }
    return (
      <div
        className="lyrics-scroll h-full w-full overflow-y-auto text-[17px] leading-loose text-[var(--color-text-dim)]"
        style={{ maskImage: LYRICS_MASK, WebkitMaskImage: LYRICS_MASK }}
      >
        <div className="py-[40%]">
          {lines.map((l, i) => (
            <div key={i} className="py-2">
              {l}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const baseCenter = activeIndex >= 0 ? activeIndex : 0;
  const centerIndex = Math.max(
    0,
    Math.min(synced.length - 1, baseCenter + browseOffset),
  );

  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [translateY, setTranslateY] = useState(0);
  const [measureTick, setMeasureTick] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const active = lineRefs.current[centerIndex];
    if (!container || !active) return;
    setTranslateY(container.clientHeight / 2 - (active.offsetTop + active.offsetHeight / 2));
  }, [centerIndex, synced, measureTick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => setMeasureTick((t) => t + 1));
    obs.observe(container);
    lineRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [synced]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ maskImage: LYRICS_MASK, WebkitMaskImage: LYRICS_MASK }}
    >
      <div
        className="absolute inset-x-0 flex flex-col gap-6 px-10 transition-transform duration-500 ease-out"
        style={{ transform: `translateY(${translateY}px)`, willChange: "transform" }}
      >
        {synced.map((l, i) => {
          const isActive = i === centerIndex;
          const distance = activeIndex < 0 ? 99 : Math.abs(i - centerIndex);
          const opacity =
            distance === 0 ? 1 : distance <= 1 ? 0.55 : distance <= 3 ? 0.32 : 0.18;
          return (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              data-line={i}
              onClick={() => {
                if (typeof l.time_ms === "number") {
                  api.seek(l.time_ms).catch(() => {});
                  setBrowseOffset(0);
                }
              }}
              className={clsx(
                "cursor-pointer select-none break-words text-left font-semibold leading-snug tracking-normal text-white transition-[opacity,font-size,margin] duration-500 ease-out",
                isActive ? "my-[8px] text-[22px]" : "text-[18px]",
              )}
              style={{ opacity, willChange: "opacity" }}
            >
              {l.text || "♪"}
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.raw !== next.raw || prev.synced !== next.synced) return false;
  return (
    lyricActiveIndex(prev.synced, prev.positionMs) ===
    lyricActiveIndex(next.synced, next.positionMs)
  );
});
