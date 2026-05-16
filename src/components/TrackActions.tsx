import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerApi } from "../state/player";
import type { PlaylistsApi } from "../state/playlists";
import type { Track } from "../types";

interface TrackActionsProps {
  tracks: Track[];
  player: PlayerApi;
  playlists: PlaylistsApi;
  size?: "sm" | "md";
}

export function TrackActions({ tracks, player, playlists, size = "sm" }: TrackActionsProps) {
  const [open, setOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowPlaylists(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onAction = async (fn: () => Promise<void> | void) => {
    setOpen(false);
    setShowPlaylists(false);
    await fn();
  };

  const btnSize = size === "md" ? "h-7 w-7 text-[15px]" : "h-6 w-6 text-[13px]";

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`${btnSize} grid place-items-center rounded-full text-[var(--color-text-dim)] transition-colors hover:bg-white/10 hover:text-white`}
        aria-label="更多操作"
      >
        ⋯
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#1a1a1a]/95 py-1 text-[12.5px] shadow-2xl backdrop-blur-xl"
          >
            <MenuItem
              onClick={() => onAction(() => player.playNext(tracks))}
              label="下一首播放"
            />
            <MenuItem
              onClick={() => onAction(() => player.enqueue(tracks))}
              label="加入队列"
            />
            <div
              className="relative"
              onMouseEnter={() => setShowPlaylists(true)}
              onMouseLeave={() => setShowPlaylists(false)}
            >
              <button
                onClick={() => setShowPlaylists((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-white transition-colors hover:bg-white/10"
              >
                <span>加入歌单</span>
                <span className="text-[var(--color-text-dim)]">›</span>
              </button>
              <AnimatePresence>
                {showPlaylists && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-full top-0 mr-1 min-w-[180px] max-h-[260px] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[#1a1a1a]/95 py-1 shadow-2xl backdrop-blur-xl"
                  >
                    {playlists.playlists.length === 0 && (
                      <div className="px-3 py-2 text-[var(--color-text-muted)]">
                        还没有歌单
                      </div>
                    )}
                    {playlists.playlists.map((p) => (
                      <MenuItem
                        key={p.id}
                        onClick={() =>
                          onAction(() => playlists.addTracks(p.id, tracks))
                        }
                        label={p.name}
                      />
                    ))}
                    <div className="my-1 border-t border-white/10" />
                    <MenuItem
                      onClick={() =>
                        onAction(async () => {
                          const name = window.prompt("新歌单名称", "新建歌单");
                          if (!name) return;
                          const p = await playlists.create(name);
                          await playlists.addTracks(p.id, tracks);
                        })
                      }
                      label="＋ 新建歌单…"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-white transition-colors hover:bg-white/10"
    >
      {label}
    </button>
  );
}
