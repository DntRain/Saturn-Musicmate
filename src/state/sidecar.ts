import { useEffect, useState } from "react";
import { events } from "../ipc";

export type SidecarState = "idle" | "installing" | "starting" | "ready" | "error";

export interface SidecarStatus {
  state: SidecarState;
  message: string;
}

export function useSidecar() {
  const [status, setStatus] = useState<SidecarStatus>({
    state: "idle",
    message: "",
  });

  useEffect(() => {
    const p = events.onSidecarStatus((e) => {
      setStatus({ state: e.state as SidecarState, message: e.message });
    });
    return () => {
      p.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return status;
}
