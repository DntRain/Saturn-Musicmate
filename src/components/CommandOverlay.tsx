import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
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
  {
    id: "settings",
    label: "设置",
    icon: (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
      </svg>
    ),
  },
];

export function CommandOverlay({
  active,
  onSelect,
  onClose,
}: {
  active: ViewName;
  onSelect: (v: ViewName) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="cmd-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] grid place-items-center bg-[var(--color-overlay)] backdrop-blur-2xl"
    >
      <div
        data-tauri-drag-region
        className="absolute left-0 right-32 top-0 h-10"
      />
      <WindowControls />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col items-center gap-10 px-8"
      >
        <div className="grid grid-cols-3 gap-4">
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
                    ? "border-[var(--color-border-strong)] bg-[var(--color-surface-3)] text-[var(--color-text)] shadow-xl shadow-[var(--color-shadow)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-text-strong)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
                )}
              >
                <span>{item.icon}</span>
                <span className="text-[13.5px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11.5px] tracking-[0.18em] text-[var(--color-text-faint)]">
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
        "grid h-7 w-7 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-strong)] transition-colors hover:text-[var(--color-text)]",
        accent === "close"
          ? "hover:border-red-500/60 hover:bg-red-500/30"
          : "hover:bg-[var(--color-surface-3)]",
      )}
    >
      {children}
    </button>
  );
}
