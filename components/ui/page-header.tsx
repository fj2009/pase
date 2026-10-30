import type { ReactNode } from "react";
import clsx from "clsx";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={clsx(
        "flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {kicker ? <p className="label mb-2">{kicker}</p> : null}
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-[2.1rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({
  index,
  title,
  description,
  actions,
}: {
  index?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex items-baseline gap-3">
        {index ? <span className="meta-mono">{index}</span> : null}
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-ink-faint">{description}</p>
          ) : null}
        </div>
      </div>
      {actions}
    </div>
  );
}
