"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Armchair,
  BarChart3,
  BookOpen,
  Building2,
  ChefHat,
  Flame,
  LayoutDashboard,
  LayoutGrid,
  Printer,
  ReceiptText,
  ScrollText,
  Users,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  sala: Armchair,
  cuentas: ReceiptText,
  cocina: ChefHat,
  carta: BookOpen,
  mesas: LayoutGrid,
  estaciones: Flame,
  impresion: Printer,
  stats: BarChart3,
  auditoria: ScrollText,
  equipo: Users,
  plataforma: Building2,
} as const;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/sala") {
    return pathname === "/sala" || pathname.startsWith("/sala/mesa");
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({
  groups,
  variant = "sidebar",
}: {
  groups: NavGroup[];
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.flatMap((group) => group.items).map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-olive/30 bg-olive-soft text-olive-deep"
                  : "border-transparent text-ink-soft hover:bg-paper-deep",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Secciones" className="space-y-6">
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? groupIndex}>
          {group.label ? (
            <p className="label mb-2 px-3">{group.label}</p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group flex items-center gap-2.5 border-l-2 px-3 py-[7px] text-[0.82rem] transition-colors",
                      active
                        ? "border-olive bg-olive-soft/70 font-medium text-olive-deep"
                        : "border-transparent text-ink-soft hover:border-line-strong hover:bg-paper-deep hover:text-ink",
                    )}
                  >
                    <Icon
                      className={clsx(
                        "h-4 w-4 shrink-0",
                        active ? "text-olive" : "text-ink-faint group-hover:text-ink-soft",
                      )}
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
