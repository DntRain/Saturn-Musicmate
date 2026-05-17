import { useMemo, useState } from "react";
import clsx from "clsx";
import { CoverArt } from "./CoverArt";
import { TrackList } from "./TrackList";
import type { PlayerApi } from "../state/player";
import type { PlaylistsApi } from "../state/playlists";
import type { Track } from "../types";

type Mode = "songs" | "albums";

export function LibraryView({
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
  const [mode, setMode] = useState<Mode>("songs");

  const albums = useMemo(() => groupByAlbum(tracks), [tracks]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-end justify-between px-8 pb-4 pt-7">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">资料库</h1>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)]">
            共 {tracks.length} 首歌 · {albums.length} 张专辑
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-[var(--color-surface-1)] p-1">
          {(["songs", "albums"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                "rounded-md px-3 py-1 text-[12.5px] transition-colors",
                mode === m
                  ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
              )}
            >
              {m === "songs" ? "歌曲" : "专辑"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {mode === "songs" ? (
          <TrackList
            tracks={tracks}
            currentIndex={currentIndex}
            playing={playing}
            onPlay={onPlay}
            player={player}
            playlists={playlists}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-6 gap-y-8 px-4 pt-2">
            {albums.map((a) => (
              <button
                key={a.album + a.artist}
                onClick={() => {
                  const idx = tracks.findIndex((t) => t.path === a.firstTrack.path);
                  if (idx >= 0) onPlay(idx);
                }}
                className="group flex flex-col gap-2 text-left"
              >
                <CoverArt
                  src={a.cover}
                  size="full"
                  rounded="lg"
                  className="aspect-square w-full transition-transform group-hover:scale-[1.02]"
                />
                <div className="flex flex-col leading-tight">
                  <span className="truncate text-[13px] text-[var(--color-text)]">{a.album || "未命名专辑"}</span>
                  <span className="truncate text-[12px] text-[var(--color-text-dim)]">{a.artist}</span>
                </div>
              </button>
            ))}
            {albums.length === 0 && (
              <div className="col-span-full grid h-64 place-items-center text-[var(--color-text-muted)]">
                还没有专辑
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AlbumGroup {
  album: string;
  artist: string;
  cover: string | null;
  firstTrack: Track;
}

function groupByAlbum(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const t of tracks) {
    const key = `${t.album}::${t.artist}`;
    if (!map.has(key)) {
      map.set(key, {
        album: t.album,
        artist: t.artist,
        cover: t.cover_url ?? null,
        firstTrack: t,
      });
    }
  }
  return [...map.values()];
}
