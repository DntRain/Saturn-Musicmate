import { useCallback, useEffect, useRef, useState } from "react";
import { api, events } from "../ipc";
import type { Lyrics, Track } from "../types";

export interface PlayerState {
  tracks: Track[];
  currentIndex: number | null;
  playing: boolean;
  volume: number;
  positionMs: number;
  cover: string | null;
  lyrics: Lyrics | null;
  subtitle: { text: string; active: boolean };
  error: string | null;
}

const initial: PlayerState = {
  tracks: [],
  currentIndex: null,
  playing: false,
  volume: 0.8,
  positionMs: 0,
  cover: null,
  lyrics: null,
  subtitle: { text: "", active: false },
  error: null,
};

export function usePlayer() {
  const [state, setState] = useState<PlayerState>(initial);
  const tracksRef = useRef<Track[]>([]);
  const mediaRequestRef = useRef(0);

  useEffect(() => {
    tracksRef.current = state.tracks;
  }, [state.tracks]);

  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [];

    unlisteners.push(
      events.onTrackChanged(({ index, path }) => {
        const requestId = ++mediaRequestRef.current;
        const track = tracksRef.current[index];
        const coverPromise = track?.cover_url
          ? Promise.resolve(track.cover_url)
          : api.getCover(path).catch(() => null);
        const lyricsPromise = api.getLyrics(path).catch(() => null);

        setState((s) => ({
          ...s,
          currentIndex: index,
          positionMs: 0,
          cover: track?.cover_url ?? s.cover,
          lyrics: null,
        }));

        Promise.all([coverPromise, lyricsPromise])
          .then(([cover, lyrics]) => {
            if (mediaRequestRef.current !== requestId) return;
            setState((s) => ({ ...s, cover, lyrics }));
            if (track?.provider && track.provider_id && (!lyrics || lyrics.synced.length === 0)) {
              api
                .fetchOnlineLyrics(track.provider, track.provider_id)
                .then((l) => {
                  if (mediaRequestRef.current === requestId) {
                    setState((s) => ({ ...s, lyrics: l }));
                  }
                })
                .catch(() => {});
            }
            if (track?.provider && track.comment_id && !track.comments?.length) {
              api
                .fetchTrackComments(track.provider, track.comment_id, 30)
                .then((comments) => {
                  if (mediaRequestRef.current !== requestId || comments.length === 0) return;
                  setState((s) => {
                    const tracks = s.tracks.slice();
                    const existing = tracks[index];
                    if (!existing) return s;
                    tracks[index] = { ...existing, comments };
                    return { ...s, tracks };
                  });
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }),
    );
    unlisteners.push(
      events.onPlaybackState(({ playing }) =>
        setState((s) => ({ ...s, playing })),
      ),
    );
    unlisteners.push(
      events.onPosition(({ position_ms }) =>
        setState((s) => ({ ...s, positionMs: position_ms })),
      ),
    );
    unlisteners.push(
      events.onSubtitle((sub) => setState((s) => ({ ...s, subtitle: sub }))),
    );
    unlisteners.push(
      events.onError((message) => setState((s) => ({ ...s, error: message }))),
    );

    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, []);

  const loadTracks = useCallback(async (tracks: Track[]) => {
    setState((s) => ({ ...s, tracks, currentIndex: null }));
    await api.setPlaylist(tracks.map((t) => t.path));
  }, []);

  const playIndex = useCallback((index: number) => api.playIndex(index), []);
  const toggle = useCallback(() => api.toggle(), []);
  const next = useCallback(() => api.next(), []);
  const prev = useCallback(() => api.prev(), []);
  const setVolume = useCallback((v: number) => {
    setState((s) => ({ ...s, volume: v }));
    return api.setVolume(v);
  }, []);

  const enqueue = useCallback(async (tracks: Track[]) => {
    if (tracks.length === 0) return;
    setState((s) => ({ ...s, tracks: [...s.tracks, ...tracks] }));
    await api.queueAppend(tracks.map((t) => t.path));
  }, []);

  const playNext = useCallback(async (tracks: Track[]) => {
    if (tracks.length === 0) return;
    setState((s) => {
      const insertAt =
        s.currentIndex == null ? s.tracks.length : s.currentIndex + 1;
      const next = s.tracks.slice();
      next.splice(insertAt, 0, ...tracks);
      return { ...s, tracks: next };
    });
    await api.queueInsertNext(tracks.map((t) => t.path));
  }, []);

  const removeFromQueue = useCallback(async (index: number) => {
    setState((s) => {
      if (index < 0 || index >= s.tracks.length) return s;
      const next = s.tracks.slice();
      next.splice(index, 1);
      let curr = s.currentIndex;
      if (curr != null) {
        if (index === curr) {
          curr = next.length === 0 ? null : Math.min(curr, next.length - 1);
        } else if (index < curr) {
          curr = curr - 1;
        }
      }
      return { ...s, tracks: next, currentIndex: curr };
    });
    await api.queueRemoveAt(index);
  }, []);

  return {
    state,
    loadTracks,
    playIndex,
    toggle,
    next,
    prev,
    setVolume,
    enqueue,
    playNext,
    removeFromQueue,
  };
}

export type PlayerApi = ReturnType<typeof usePlayer>;
