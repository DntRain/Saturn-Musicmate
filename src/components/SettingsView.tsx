import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "../ipc";
import type { AppSettings } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  deepseek_api_key: "",
  deepseek_model: "",
  qq_api_base: "",
  qq_cookies: "",
};

type Status =
  | { kind: "idle" }
  | { kind: "info"; text: string }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [original, setOriginal] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let alive = true;
    api
      .settingsGet()
      .then((value) => {
        if (!alive) return;
        const merged = { ...DEFAULT_SETTINGS, ...value };
        setSettings(merged);
        setOriginal(merged);
      })
      .catch((e) => setStatus({ kind: "error", text: String(e) }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const dirty =
    settings.deepseek_api_key !== original.deepseek_api_key ||
    settings.deepseek_model !== original.deepseek_model ||
    settings.qq_api_base !== original.qq_api_base ||
    settings.qq_cookies !== original.qq_cookies;

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSave = useCallback(async () => {
    setSaving(true);
    setStatus({ kind: "idle" });
    try {
      const result = await api.settingsSave(settings);
      setSettings(result.saved);
      setOriginal(result.saved);
      setStatus({
        kind: "success",
        text: result.sidecar_restarted
          ? "已保存，QQ 在线服务正在重启…"
          : "已保存",
      });
    } catch (e) {
      setStatus({ kind: "error", text: String(e) });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const onReset = useCallback(() => {
    setSettings(original);
    setStatus({ kind: "idle" });
  }, [original]);

  const onTestDeepseek = useCallback(async () => {
    setTesting(true);
    setStatus({ kind: "info", text: "正在向 DeepSeek 拉取模型列表…" });
    try {
      const result = await api.settingsTestDeepseek();
      setStatus({
        kind: "success",
        text: `连接成功，DeepSeek 返回 ${result.model_count} 个模型`,
      });
    } catch (e) {
      setStatus({ kind: "error", text: String(e) });
    } finally {
      setTesting(false);
    }
  }, []);

  const onOpenLogin = useCallback(async () => {
    setLoginBusy(true);
    setStatus({ kind: "info", text: "已打开 QQ 登录窗口，完成登录后回到这里点「导入 Cookies」" });
    try {
      await api.openQQLogin();
    } catch (e) {
      setStatus({ kind: "error", text: String(e) });
    } finally {
      setLoginBusy(false);
    }
  }, []);

  const onImportCookies = useCallback(async () => {
    setLoginBusy(true);
    try {
      const msg = await api.importQQCookies();
      const fresh = await api.settingsGet();
      const merged = { ...DEFAULT_SETTINGS, ...fresh };
      setSettings(merged);
      setOriginal(merged);
      setStatus({ kind: "success", text: msg });
    } catch (e) {
      setStatus({ kind: "error", text: String(e) });
    } finally {
      setLoginBusy(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-white/40">
        正在加载设置…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-10 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <header>
          <h1 className="font-serif text-[34px] font-normal tracking-[0.005em] text-white">
            设置
          </h1>
          <p className="mt-1 text-[13px] text-white/45">
            令牌和 Cookies 仅保存在本机，不会上传任何远程服务。
          </p>
        </header>

        <Section title="DeepSeek API" hint="为 Silen 的对话与意图规划提供模型支持。">
          <Field label="API Key" hint="从 platform.deepseek.com 「API Keys」页面创建。">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={settings.deepseek_api_key}
                onChange={(e) => update("deepseek_api_key", e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 pr-16 text-[13px] text-white outline-none transition-colors focus:border-white/30"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] text-white/50 hover:text-white"
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>
          </Field>
          <Field label="模型 ID（可选）" hint="留空使用默认值 deepseek-v4-pro。">
            <input
              type="text"
              value={settings.deepseek_model}
              onChange={(e) => update("deepseek_model", e.target.value)}
              placeholder="deepseek-v4-pro"
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-white/30"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <div className="pt-1">
            <button
              type="button"
              onClick={onTestDeepseek}
              disabled={testing || !settings.deepseek_api_key.trim()}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {testing ? "测试中…" : "测试连接"}
            </button>
          </div>
        </Section>

        <Section title="QQ 音乐" hint="本地播放无需 Cookies；在线搜索 / VIP 试听需要登录 QQ 账号。">
          <Field
            label="服务地址（可选）"
            hint="留空使用内置 sidecar (http://127.0.0.1:3200)。"
          >
            <input
              type="text"
              value={settings.qq_api_base}
              onChange={(e) => update("qq_api_base", e.target.value)}
              placeholder="http://127.0.0.1:3200"
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-white/30"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field
            label="Cookies"
            hint="形如 uin=...; qm_keyst=...; pt4_token=... 用「登录 QQ 音乐 → 导入 Cookies」自动填入。"
          >
            <textarea
              value={settings.qq_cookies}
              onChange={(e) => update("qq_cookies", e.target.value)}
              placeholder="uin=...; qm_keyst=..."
              rows={4}
              className={clsx(
                "w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-white outline-none transition-colors focus:border-white/30",
                !showCookie && settings.qq_cookies && "text-transparent [text-shadow:0_0_8px_rgba(255,255,255,0.55)]",
              )}
              spellCheck={false}
            />
            <div className="flex items-center justify-between pt-1.5">
              <button
                type="button"
                onClick={() => setShowCookie((v) => !v)}
                className="text-[11px] text-white/50 hover:text-white"
              >
                {showCookie ? "隐藏内容" : "显示内容"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onOpenLogin}
                  disabled={loginBusy}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  登录 QQ 音乐
                </button>
                <button
                  type="button"
                  onClick={onImportCookies}
                  disabled={loginBusy}
                  className="rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-[var(--color-accent)]/25 disabled:opacity-40"
                >
                  导入 Cookies
                </button>
              </div>
            </div>
          </Field>
        </Section>

        <footer className="sticky bottom-0 -mx-10 mt-4 flex items-center justify-between gap-4 border-t border-white/5 bg-[var(--color-bg)]/95 px-10 py-4 backdrop-blur">
          <StatusBar status={status} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!dirty || saving}
              className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-[12.5px] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              撤销
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[15px] font-medium tracking-tight text-white">{title}</h2>
        {hint && <p className="mt-1 text-[12px] text-white/40">{hint}</p>}
      </div>
      <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[12.5px] font-medium text-white/80">{label}</label>
        {hint && <span className="text-[11px] text-white/35">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StatusBar({ status }: { status: Status }) {
  if (status.kind === "idle") {
    return <span className="text-[11.5px] text-white/35">变更后点保存生效</span>;
  }
  const cls =
    status.kind === "success"
      ? "text-emerald-300/90"
      : status.kind === "error"
        ? "text-red-300/90"
        : "text-white/60";
  return (
    <span className={clsx("max-w-md truncate text-[11.5px]", cls)} title={status.text}>
      {status.text}
    </span>
  );
}
