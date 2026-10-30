import clsx from "clsx";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-start gap-3 border border-dashed border-line-strong bg-paper/40 px-6 py-10",
        className,
      )}
    >
      <div className="text-ink-faint" aria-hidden>
        {icon ?? <Inbox className="h-5 w-5" strokeWidth={1.5} />}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-faint">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
