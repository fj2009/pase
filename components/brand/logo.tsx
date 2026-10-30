import Link from "next/link";
import clsx from "clsx";

export function Logo({
  href = "/",
  className,
  subdued = false,
}: {
  href?: string;
  className?: string;
  subdued?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "group inline-flex items-baseline gap-1.5 leading-none",
        subdued ? "text-paper" : "text-ink",
        className,
      )}
      aria-label="Pase, inicio"
    >
      <span className="text-[1.45rem] font-semibold tracking-[-0.055em]">pase</span>
      <span className="h-1.5 w-1.5 rounded-full bg-terracotta transition-transform duration-200 group-hover:translate-y-0.5" />
    </Link>
  );
}
