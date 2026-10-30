import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { archiveMenuItemAction, saveMenuItemAction } from "@/features/menu/actions";
import { getAdminMenuItem, getMenuAdmin } from "@/features/menu/admin";
import { demoImagePaths } from "@/lib/demo-images";

export const metadata = { title: "Editar plato · Pase" };

export default async function EditMenuItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireCapability("manageMenu");
  const [item, menu] = await Promise.all([
    getAdminMenuItem(context.user.id, context.restaurant.restaurantId, id),
    getMenuAdmin(context.user.id, context.restaurant.restaurantId),
  ]);
  if (!item) notFound();

  return (
    <div className="space-y-8">
      <MessageFromQuery value={query.ok ?? query.error} />
      <PageHeader
        kicker="Carta"
        title={item.name}
        description={`${item.categoryName} · ${item.stationName} · ${item.prepMinutes} min de preparación`}
        actions={
          <Link href="/admin/carta" className="btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver a la carta
          </Link>
        }
      />

      <div className="panel max-w-3xl p-5 sm:p-6">
        <MenuItemForm
          action={saveMenuItemAction}
          categories={menu.categories}
          stations={menu.stations}
          item={item}
          returnTo={`/admin/carta/plato/${item.id}`}
          images={demoImagePaths()}
        />
      </div>

      <section className="max-w-3xl border border-danger/25 bg-danger-soft/40 p-5">
        <p className="label text-danger">Zona delicada</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Archivar retira el plato de la carta pública y de la comanda, pero conserva
          su histórico y las comandas ya registradas.
        </p>
        <ConfirmForm
          action={archiveMenuItemAction}
          message={`¿Archivar «${item.name}»? Dejará de estar disponible para nuevos pedidos.`}
          confirmLabel="Archivar plato"
          className="mt-4"
          trigger={
            <>
              <Archive className="h-3.5 w-3.5" aria-hidden />
              Archivar plato
            </>
          }
        >
          <input type="hidden" name="id" value={item.id} />
        </ConfirmForm>
      </section>
    </div>
  );
}
