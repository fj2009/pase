import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavLinks, type NavGroup, type NavItem } from "@/components/shell/nav-links";
import { RestaurantSwitcher } from "@/components/shell/restaurant-switcher";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { logoutAction } from "@/features/auth/actions";
import { homeForRole, type Membership, type StaffContext } from "@/features/auth/session";
import { can, canAny, ROLE_LABELS, type Role } from "@/features/permissions/capabilities";
import { formatDate } from "@/lib/datetime";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({
  context,
  children,
}: {
  context: StaffContext & { restaurant: Membership; role: Role };
  children: ReactNode;
}) {
  const { restaurant, role, user } = context;
  const home = homeForRole(role);

  const groups: NavGroup[] = [];

  if (can(role, "takeOrders") || can(role, "manageService")) {
    const items: NavItem[] = [];
    if (can(role, "takeOrders") || can(role, "manageService")) {
      items.push({ href: "/sala", label: "Mesas y servicio", icon: "sala" as const });
    }
    if (can(role, "manageService")) {
      items.push({ href: "/sala/cuentas", label: "Cuentas", icon: "cuentas" as const });
    }
    groups.push({ label: "Sala", items });
  }

  if (can(role, "workKitchen")) {
    groups.push({
      label: "Cocina",
      items: [{ href: "/cocina", label: "Pase de cocina", icon: "cocina" as const }],
    });
  }

  if (
    canAny(role, [
      "manageMenu",
      "manageTables",
      "managePrinters",
      "viewStats",
      "viewAudit",
      "manageStaff",
    ])
  ) {
    const items: NavItem[] = [
      { href: "/admin", label: "Resumen", icon: "dashboard", exact: true },
    ];
    if (can(role, "manageMenu")) {
      items.push({ href: "/admin/carta", label: "Carta", icon: "carta" as const });
    }
    if (can(role, "manageTables")) {
      items.push({ href: "/admin/mesas", label: "Mesas y QR", icon: "mesas" as const });
      items.push({
        href: "/admin/estaciones",
        label: "Estaciones",
        icon: "estaciones" as const,
      });
    }
    if (can(role, "managePrinters")) {
      items.push({
        href: "/admin/impresion",
        label: "Impresión",
        icon: "impresion" as const,
      });
    }
    if (can(role, "viewStats")) {
      items.push({
        href: "/admin/estadisticas",
        label: "Estadísticas",
        icon: "stats" as const,
      });
    }
    if (can(role, "viewAudit")) {
      items.push({
        href: "/admin/auditoria",
        label: "Auditoría",
        icon: "auditoria" as const,
      });
    }
    if (can(role, "manageStaff")) {
      items.push({ href: "/admin/equipo", label: "Equipo", icon: "equipo" as const });
    }
    groups.push({ label: "Gestión", items });
  }

  if (user.isSuperadmin) {
    groups.push({
      label: "Plataforma",
      items: [
        { href: "/plataforma", label: "Restaurantes", icon: "plataforma" as const },
      ],
    });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-paper-raised lg:flex">
        <div className="px-5 pt-6">
          <Logo href={home} />
          <p className="mt-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
            Operación de sala
          </p>
        </div>

        <div className="mt-7 px-5">
          <p className="label mb-2">Espacio activo</p>
          <RestaurantSwitcher
            memberships={context.memberships}
            activeId={restaurant.restaurantId}
          />
          <p className="mt-1.5 text-xs text-ink-faint">{ROLE_LABELS[role]}</p>
        </div>

        <div className="mt-7 flex-1 overflow-y-auto px-2">
          <NavLinks groups={groups} />
        </div>

        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive text-[0.7rem] font-semibold text-paper">
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{user.fullName}</p>
              <p className="truncate text-[0.7rem] text-ink-faint">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="btn-ghost btn-sm w-full justify-start">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-12 lg:px-8">
            <div className="lg:hidden">
              <Logo href={home} />
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-xs text-ink-faint lg:flex">
              <span className="font-medium text-ink">{restaurant.name}</span>
              <span aria-hidden>·</span>
              <span>{ROLE_LABELS[role]}</span>
              <span aria-hidden>·</span>
              <span>{formatDate(new Date(), restaurant.timezone)}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <RealtimeRefresh url="/api/events/staff" showStatus label="En directo" />
              <form action={logoutAction} className="lg:hidden">
                <button
                  type="submit"
                  className="btn-ghost h-8 w-8 px-0"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </form>
            </div>
          </div>
          <div className="lg:hidden">
            <NavLinks groups={groups} variant="mobile" />
          </div>
        </header>

        <main id="contenido" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        <footer className="border-t border-line px-4 py-4 text-[0.68rem] text-ink-faint sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span>
              {restaurant.name} · {restaurant.timezone}
            </span>
            <Link href="/" className="link">
              Ver carta pública y guía de Pase
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
