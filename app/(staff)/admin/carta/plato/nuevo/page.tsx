import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { saveMenuItemAction } from "@/features/menu/actions";
import { getMenuAdmin } from "@/features/menu/admin";
import { demoImagePaths } from "@/lib/demo-images";

export const metadata = { title: "Nuevo plato · Pase" };

export default async function NewMenuItemPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageMenu");
  const { categories, stations } = await getMenuAdmin(
    context.user.id,
    context.restaurant.restaurantId,
  );
  const defaultCategory = categories.some((category) => category.id === params.categoria)
    ? params.categoria
    : categories[0]?.id;

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.error} />
      <PageHeader
        kicker="Carta"
        title="Nuevo plato"
        description="El precio se guarda en céntimos. La estación decide en qué pantalla de cocina aparece la comanda."
        actions={
          <Link href="/admin/carta" className="btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver a la carta
          </Link>
        }
      />

      {categories.length === 0 || stations.length === 0 ? (
        <EmptyState
          title={
            categories.length === 0
              ? "Primero necesitas una categoría"
              : "Primero necesitas una estación de cocina"
          }
          description={
            categories.length === 0
              ? "Crea una categoría para poder añadir platos y precios."
              : "Configura al menos una estación activa para asignar el plato."
          }
          icon={<FolderOpen className="h-5 w-5" strokeWidth={1.5} />}
          action={
            <Link href="/admin/carta/categoria/nueva" className="btn-primary btn-sm">
              Crear categoría
            </Link>
          }
        />
      ) : (
        <div className="panel max-w-3xl p-5 sm:p-6">
          <MenuItemForm
            action={saveMenuItemAction}
            categories={categories}
            stations={stations}
            defaultCategoryId={defaultCategory}
            returnTo={`/admin/carta/plato/nuevo${params.categoria ? `?categoria=${params.categoria}` : ""}`}
            images={demoImagePaths()}
          />
        </div>
      )}
    </div>
  );
}
