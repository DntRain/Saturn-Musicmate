import type { ReactElement } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { api } from "../ipc";
import type { ViewName } from "../types";

interface NavItem {
  id: ViewName;
  label: string;
  icon: ReactElement;
}

const items: NavItem[] = [
  {
    id: "library",
    label: "资料库",
    icon: (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: "playlists",
    label: "歌单",
    icon: (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="14" y2="12" />
        <line x1="4" y1="18" x2="14" y2="18" />
        <polygon points="17,15 22,18 17,21" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "搜索",
    icon: (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "now-playing",
    label: "正在播放",
    icon: (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: "host",
    label: "Musicmate",
    icon: (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
    ),
  },
];

export function CommandOverlay({
  active,
  onSelect,
  onClose,
  onPickFolder,
}: {
  active: ViewName;
  onSelect: (v: ViewName) => void;
  onClose: () => void;
  onPickFolder: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setBusy(true);
      setHint(null);
      await api.openQQLogin();
      setHint("已打开登录窗口，请在窗口内完成登录后点「导入 Cookies」");
    } catch (e) {
      setHint(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    try {
      setBusy(true);
      const msg = await api.importQQCookies();
      setHint(msg);
    } catch (e) {
      setHint(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      key="cmd-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-2xl"
    >
      <WindowControls />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col items-center gap-10 px-8"
      >
        <div className="grid grid-cols-5 gap-4">
          {items.map((item) => {
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                className={clsx(
                  "flex h-32 w-36 flex-col items-center justify-center gap-3 rounded-2xl border transition-all",
                  selected
                    ? "border-white/30 bg-white/12 text-white shadow-xl shadow-black/40"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25 hover:bg-white/10 hover:text-white",
                )}
              >
                <span>{item.icon}</span>
                <span className="text-[13.5px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <OverlayBtn onClick={onPickFolder} disabled={busy}>
              打开音乐文件夹
            </OverlayBtn>
            <OverlayBtn onClick={handleLogin} disabled={busy}>
              登录 QQ 音乐
            </OverlayBtn>
            <OverlayBtn onClick={handleImport} disabled={busy} accent>
              导入 Cookies
            </OverlayBtn>
          </div>
          {hint && (
            <div className="max-w-md rounded-md bg-black/40 px-3 py-1.5 text-center text-[11.5px] leading-snug text-white/70">
              {hint}
            </div>
          )}
        </div>

        <div className="text-[11.5px] tracking-[0.18em] text-white/30">
          按 ESC 关闭
        </div>
      </motion.div>
    </motion.div>
  );
}

function WindowControls() {
  const win = getCurrentWindow();
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-5 top-5 flex items-center gap-2"
    >
      <WinBtn label="最小化" onClick={() => win.minimize().catch(() => {})}>
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <line x1="2.5" y1="6" x2="9.5" y2="6" />
        </svg>
      </WinBtn>
      <WinBtn label="最大化" onClick={() => win.toggleMaximize().catch(() => {})}>
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
        </svg>
      </WinBtn>
      <WinBtn
        label="关闭"
        accent="close"
        onClick={() => win.close().catch(() => {})}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      </WinBtn>
    </div>
  );
}

function WinBtn({
  children,
  onClick,
  label,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  accent?: "close";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 transition-colors hover:text-white",
        accent === "close"
          ? "hover:border-red-500/60 hover:bg-red-500/30"
          : "hover:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

function OverlayBtn({
  children,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-md border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40",
        accent
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 text-white hover:bg-[var(--color-accent)]/25"
          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
