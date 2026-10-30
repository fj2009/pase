import clsx from "clsx";
import type { ReactNode } from "react";

const LABELS: Record<string, string> = {
  queued: "En cola",
  preparing: "En preparación",
  incident: "Incidencia",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
  open: "Abierto",
  closed: "Cerrado",
  requested: "Solicitada",
  attending: "En curso",
  completed: "Atendida",
  pending: "Pendiente",
  processing: "Imprimiendo",
  printed: "Impreso",
  failed: "Fallido",
  active: "Activa",
  trialing: "Prueba",
};

const TONES: Record<string, string> = {
  queued: "border-line-strong bg-paper-deep text-ink-soft",
  preparing: "border-amber/30 bg-amber-soft text-amber",
  incident: "border-danger/30 bg-danger-soft text-danger",
  ready: "border-ok/30 bg-ok-soft text-ok",
  delivered: "border-line bg-transparent text-ink-faint",
  cancelled: "border-line bg-transparent text-ink-faint line-through",
  open: "border-ok/30 bg-ok-soft text-ok",
  closed: "border-line bg-paper-deep text-ink-faint",
  requested: "border-terracotta/30 bg-terracotta-soft text-terracotta",
  attending: "border-amber/30 bg-amber-soft text-amber",
  completed: "border-ok/30 bg-ok-soft text-ok",
  pending: "border-line-strong bg-paper-deep text-ink-soft",
  processing: "border-olive/30 bg-olive-soft text-olive",
  printed: "border-ok/30 bg-ok-soft text-ok",
  failed: "border-danger/30 bg-danger-soft text-danger",
  active: "border-ok/30 bg-ok-soft text-ok",
  trialing: "border-amber/30 bg-amber-soft text-amber",
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em]",
        TONES[status] ?? "border-line bg-paper-deep text-ink-soft",
        className,
      )}
    >
      {label ?? LABELS[status] ?? status}
    </span>
  );
}

export function Dot({ status }: { status: "ok" | "warn" | "bad" | "idle" }) {
  const color =
    status === "ok"
      ? "bg-ok"
      : status === "warn"
        ? "bg-amber"
        : status === "bad"
          ? "bg-danger"
          : "bg-ink-faint";
  return <span className={clsx("inline-block h-1.5 w-1.5 rounded-full", color)} />;
}

export function LabeledValue({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
