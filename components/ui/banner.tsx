import type { ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, Info } from "lucide-react";
import { MESSAGES } from "@/lib/messages";

const TONES = {
  info: {
    className: "border-line-strong bg-paper-raised text-ink",
    icon: Info,
  },
  success: {
    className: "border-ok/25 bg-ok-soft text-ok",
    icon: Check,
  },
  error: {
    className: "border-danger/25 bg-danger-soft text-danger",
    icon: AlertTriangle,
  },
  warning: {
    className: "border-amber/30 bg-amber-soft text-amber",
    icon: AlertTriangle,
  },
} as const;

export type BannerTone = keyof typeof TONES;

export function Banner({
  tone = "info",
  children,
  className,
  role,
}: {
  tone?: BannerTone;
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const config = TONES[tone];
  const Icon = config.icon;
  return (
    <div
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={clsx(
        "flex items-start gap-3 border px-4 py-3 text-sm",
        config.className,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

const ERROR_CODES = new Set([
  "permiso",
  "transicion",
  "datos",
  "sesion",
  "cuenta_error",
  "sin_impresora",
  "precio",
  "imagen",
  "categoria_con_platos",
  "mesa_duplicada",
  "mesa_en_servicio",
  "estacion_duplicada",
  "estacion_con_platos",
  "impresora_duplicada",
  "impresora_ocupada",
  "ultimo_propietario",
  "no_autoeliminar",
  "restaurante_slug",
]);

export function messageFor(code?: string): { tone: BannerTone; text: string } | null {
  if (!code) return null;
  const text = MESSAGES[code];
  if (!text) return null;
  return { tone: ERROR_CODES.has(code) ? "error" : "success", text };
}

export function MessageFromQuery({ value }: { value?: string }) {
  const message = messageFor(value);
  if (!message) return null;
  return (
    <Banner tone={message.tone} className="mb-5">
      {message.text}
    </Banner>
  );
}
