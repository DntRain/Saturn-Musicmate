import { useEffect, useRef, useState } from "react";
import { api, events } from "../ipc";

const BARS = 48;

type RGB = { r: number; g: number; b: number };

const DEFAULT_COLOR: RGB = { r: 250, g: 45, b: 72 };

interface WaveformProps {
  playing: boolean;
  cover: string | null;
}

export function Waveform({ playing, cover }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  const bandsRef = useRef<Float32Array>(new Float32Array(BARS));
  const valuesRef = useRef<Float32Array>(new Float32Array(BARS));
  const [color, setColor] = useState<RGB>(DEFAULT_COLOR);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    let cancelled = false;
    const unlistenP = events.onSpectrum(({ bands }) => {
      if (cancelled) return;
      const target = bandsRef.current;
      const n = Math.min(target.length, bands.length);
      for (let i = 0; i < n; i++) target[i] = bands[i];
    });
    return () => {
      cancelled = true;
      unlistenP.then((fn) => fn()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!cover) {
      setColor(DEFAULT_COLOR);
      return;
    }
    let cancelled = false;
    api
      .getCoverPalette(cover)
      .then((p) => {
        if (cancelled) return;
        setColor({ r: p.r, g: p.g, b: p.b });
      })
      .catch(() => {
        if (!cancelled) setColor(DEFAULT_COLOR);
      });
    return () => {
      cancelled = true;
    };
  }, [cover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const isPlaying = playingRef.current;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const totalBars = BARS * 2;
      const gap = 2;
      const barW = Math.max(2, (w - gap * (totalBars - 1)) / totalBars);

      const bands = bandsRef.current;
      const values = valuesRef.current;
      const { r, g, b } = color;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.90)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.35)`);
      ctx.fillStyle = grad;

      for (let bi = 0; bi < BARS; bi++) {
        const raw = isPlaying ? Math.min(1, bands[bi] * 1.15) : 0;
        const decay = raw > values[bi] ? 22 : 8;
        values[bi] += (raw - values[bi]) * Math.min(1, dt * decay);
      }

      const r2 = Math.min(barW / 2, 2);
      for (let i = 0; i < totalBars; i++) {
        const bi = i < BARS ? BARS - 1 - i : i - BARS;
        const v = values[bi];
        if (v < 0.01) continue;
        const barH = v * h;
        const x = i * (barW + gap);
        const y = h - barH;
        ctx.beginPath();
        ctx.moveTo(x + r2, y);
        ctx.lineTo(x + barW - r2, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r2);
        ctx.lineTo(x + barW, h);
        ctx.lineTo(x, h);
        ctx.lineTo(x, y + r2);
        ctx.quadraticCurveTo(x, y, x + r2, y);
        ctx.closePath();
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute bottom-20 left-0 right-0 z-10 block h-10 w-full"
      aria-hidden
    />
  );
}

