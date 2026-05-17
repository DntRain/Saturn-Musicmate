import { useState } from "react";
import clsx from "clsx";
import { TrackList } from "./TrackList";
import type { PlayerApi } from "../state/player";
import type { Playlist, PlaylistsApi } from "../state/playlists";

interface PlaylistsViewProps {
  player: PlayerApi;
  playlists: PlaylistsApi;
}

export function PlaylistsView({ player, playlists }: PlaylistsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    playlists.playlists.find((p) => p.id === selectedId) ?? playlists.playlists[0] ?? null;

  const onCreate = async () => {
    const name = window.prompt("新歌单名称", "新建歌单");
    if (!name) return;
    const p = await playlists.create(name);
    setSelectedId(p.id);
  };

  const onPlayAll = async (p: Playlist) => {
    if (p.tracks.length === 0) return;
    await player.loadTracks(p.tracks);
    await player.playIndex(0);
  };

  return (
    <div className="grid h-full grid-cols-[260px_1fr] overflow-hidden">
      <aside className="flex h-full flex-col border-r border-[var(--color-border)]">
        <div className="flex items-center justify-between px-5 pb-3 pt-7">
          <h1 className="text-xl font-bold tracking-tight">歌单</h1>
          <button
            onClick={onCreate}
            className="rounded-md bg-[var(--color-surface-2)] px-2.5 py-1 text-[12px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-3)]"
          >
            ＋ 新建
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {playlists.playlists.length === 0 && (
            <div className="grid h-32 place-items-center px-3 text-center text-[12px] text-[var(--color-text-muted)]">
              还没有歌单，点击「＋ 新建」开始
            </div>
          )}
          <ul className="flex flex-col">
            {playlists.playlists.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors",
                    selected?.id === p.id
                      ? "bg-[var(--color-surface-2)]"
                      : "hover:bg-[var(--color-surface-1)]",
                  )}
                >
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[13px] text-[var(--color-text)]">{p.name}</span>
                    <span className="text-[11.5px] text-[var(--color-text-dim)]">
                      {p.tracks.length} 首
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="flex h-full flex-col overflow-hidden">
        {selected ? (
          <>
            <header className="flex items-end justify-between gap-4 px-8 pb-4 pt-7">
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-bold tracking-tight">
                  {selected.name}
                </h2>
                <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)]">
                  {selected.tracks.length} 首歌
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => onPlayAll(selected)}
                  disabled={selected.tracks.length === 0}
                  className="rounded-md bg-[var(--color-accent)]/90 px-4 py-1.5 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-50"
                >
                  ▶ 播放全部
                </button>
                <button
                  onClick={async () => {
                    const name = window.prompt("重命名歌单", selected.name);
                    if (name) await playlists.rename(selected.id, name);
                  }}
                  className="rounded-md bg-[var(--color-surface-2)] px-3 py-1.5 text-[12.5px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-3)]"
                >
                  重命名
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm(`删除歌单「${selected.name}」？`)) {
                      await playlists.remove(selected.id);
                      setSelectedId(null);
                    }
                  }}
                  className="rounded-md bg-[var(--color-surface-2)] px-3 py-1.5 text-[12.5px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-3)]"
                >
                  删除
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {selected.tracks.length === 0 ? (
                <div className="grid h-64 place-items-center text-[var(--color-text-muted)]">
                  这个歌单还是空的——在资料库或搜索里用「⋯」加入歌曲
                </div>
              ) : (
                <TrackList
                  tracks={selected.tracks}
                  currentIndex={null}
                  playing={false}
                  onPlay={async (i) => {
                    await player.loadTracks(selected.tracks);
                    await player.playIndex(i);
                  }}
                  player={player}
                  playlists={playlists}
                />
              )}
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center text-[var(--color-text-muted)]">
            从左侧选一个歌单
          </div>
        )}
      </section>
    </div>
  );
}
