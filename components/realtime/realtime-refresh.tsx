"use client";

import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { useLive } from "@/components/realtime/use-live";
import { formatTime } from "@/lib/datetime";

export function RealtimeRefresh({
  url,
  showStatus = false,
  label = "Actualizaciones en directo",
}: {
  url: string;
  showStatus?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const { status, lastEventAt } = useLive(url, () => router.refresh());

  return (
    <div className="flex flex-col gap-2">
      {showStatus ? (
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <span
            className={
              status === "online"
                ? "h-1.5 w-1.5 rounded-full bg-ok"
                : status === "offline"
                  ? "h-1.5 w-1.5 rounded-full bg-danger"
                  : "h-1.5 w-1.5 animate-pulse-soft rounded-full bg-amber"
            }
          />
          <span>
            {status === "online"
              ? label
              : status === "connecting"
                ? "Conectando…"
                : "Sin conexión"}
          </span>
          {lastEventAt ? (
            <span className="meta-mono">
              · última actualización {formatTime(lastEventAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      {status === "offline" ? (
        <div
          role="alert"
          className="flex items-start gap-2 border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Se ha perdido la conexión en directo. Los datos de esta pantalla
            pueden estar desactualizados; recarga cuando vuelva la red.
          </span>
        </div>
      ) : null}
    </div>
  );
}
