import { useCallback, useEffect, useRef, useState } from "react";
import { load, Store } from "@tauri-apps/plugin-store";
import type { Track } from "../types";

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

const STORE_PATH = "playlists.json";
const KEY = "playlists";

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ready, setReady] = useState(false);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    let mounted = true;
    load(STORE_PATH, { autoSave: true, defaults: { [KEY]: [] } })
      .then(async (store) => {
        if (!mounted) return;
        storeRef.current = store;
        const data = (await store.get<Playlist[]>(KEY)) ?? [];
        setPlaylists(Array.isArray(data) ? data : []);
        setReady(true);
      })
      .catch(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: Playlist[]) => {
    setPlaylists(next);
    const s = storeRef.current;
    if (s) {
      await s.set(KEY, next);
    }
  }, []);

  const create = useCallback(
    async (name: string): Promise<Playlist> => {
      const p: Playlist = {
        id: randomId(),
        name: name.trim() || "新建歌单",
        tracks: [],
        createdAt: Date.now(),
      };
      await persist([...playlists, p]);
      return p;
    },
    [persist, playlists],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await persist(
        playlists.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
      );
    },
    [persist, playlists],
  );

  const remove = useCallback(
    async (id: string) => {
      await persist(playlists.filter((p) => p.id !== id));
    },
    [persist, playlists],
  );

  const addTracks = useCallback(
    async (id: string, tracks: Track[]) => {
      if (tracks.length === 0) return;
      await persist(
        playlists.map((p) => {
          if (p.id !== id) return p;
          const existing = new Set(p.tracks.map((t) => t.path));
          const merged = [...p.tracks];
          for (const t of tracks) {
            if (!existing.has(t.path)) {
              merged.push(t);
              existing.add(t.path);
            }
          }
          return { ...p, tracks: merged };
        }),
      );
    },
    [persist, playlists],
  );

  const removeTrack = useCallback(
    async (id: string, path: string) => {
      await persist(
        playlists.map((p) =>
          p.id === id
            ? { ...p, tracks: p.tracks.filter((t) => t.path !== path) }
            : p,
        ),
      );
    },
    [persist, playlists],
  );

  return { playlists, ready, create, rename, remove, addTracks, removeTrack };
}

export type PlaylistsApi = ReturnType<typeof usePlaylists>;
