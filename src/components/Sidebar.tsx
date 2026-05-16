import type { ReactElement } from "react";
import { useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { api } from "../ipc";
import type { ViewName } from "../types";

interface Item {
  id: ViewName;
  label: string;
  icon: ReactElement;
}

const items: Item[] = [
  {
    id: "library",
    label: "资料库",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "搜索",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "now-playing",
    label: "正在播放",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: "host",
    label: "AI 主播",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
    ),
  },
];

export function Sidebar({
  active,
  onSelect,
  onPickFolder,
}: {
  active: ViewName;
  onSelect: (v: ViewName) => void;
  onPickFolder: () => void;
}) {
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginHint, setLoginHint] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoginBusy(true);
      setLoginHint(null);
      await api.openQQLogin();
      setLoginHint("已打开登录窗口，请在窗口内完成登录后点'导入 Cookies'");
    } catch (e) {
      setLoginHint(String(e));
    } finally {
      setLoginBusy(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoginBusy(true);
      const msg = await api.importQQCookies();
      setLoginHint(msg);
    } catch (e) {
      setLoginHint(String(e));
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 px-3 py-5">
      <div className="px-3 pb-6">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-accent)]/90">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Musicmate</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={clsx(
                "relative flex items-center gap-3 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors",
                selected
                  ? "text-white"
                  : "text-[var(--color-text-dim)] hover:text-white",
              )}
            >
              {selected && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-white/10"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative">{item.icon}</span>
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 px-3 pt-4">
        <button
          onClick={onPickFolder}
          className="w-full rounded-md border border-[var(--color-border)] bg-white/5 px-3 py-2 text-[12px] text-[var(--color-text-dim)] transition-colors hover:bg-white/10 hover:text-white"
        >
          打开音乐文件夹
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleLogin}
            disabled={loginBusy}
            className="flex-1 rounded-md border border-[var(--color-border)] bg-white/5 px-2 py-2 text-[11.5px] text-[var(--color-text-dim)] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            登录 QQ 音乐
          </button>
          <button
            onClick={handleImport}
            disabled={loginBusy}
            className="flex-1 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-2 py-2 text-[11.5px] text-white transition-colors hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
          >
            导入 Cookies
          </button>
        </div>
        {loginHint && (
          <div className="rounded-md bg-black/30 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-text-dim)]">
            {loginHint}
          </div>
        )}
      </div>
    </aside>
  );
}
