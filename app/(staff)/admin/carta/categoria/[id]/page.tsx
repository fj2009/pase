import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { CategoryForm } from "@/components/admin/category-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { deleteCategoryAction, saveCategoryAction } from "@/features/menu/actions";
import { getAdminCategory } from "@/features/menu/admin";

export const metadata = { title: "Editar categoría · Pase" };

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireCapability("manageMenu");
  const category = await getAdminCategory(
    context.user.id,
    context.restaurant.restaurantId,
    id,
  );
  if (!category) notFound();

  return (
    <div className="space-y-8">
      <MessageFromQuery value={query.ok ?? query.error} />
      <PageHeader
        kicker="Carta"
        title={category.name}
        description="Cambia el nombre, el orden o la visibilidad. Los platos se gestionan desde la vista general de la carta."
        actions={
          <Link href="/admin/carta" className="btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver a la carta
          </Link>
        }
      />

      <div className="panel max-w-2xl p-5 sm:p-6">
        <CategoryForm
          action={saveCategoryAction}
          category={category}
          returnTo={`/admin/carta/categoria/${category.id}`}
        />
      </div>

      <section className="max-w-2xl border border-danger/25 bg-danger-soft/40 p-5">
        <p className="label text-danger">Zona delicada</p>
        {category.itemCount > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Esta categoría tiene {category.itemCount}{" "}
            {category.itemCount === 1 ? "plato" : "platos"}. Muévelos a otra categoría
            antes de eliminarla.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Eliminar la categoría es definitivo. No afecta a platos de otras
              categorías.
            </p>
            <ConfirmForm
              action={deleteCategoryAction}
              message={`¿Eliminar la categoría «${category.name}»? Esta acción no se puede deshacer.`}
              confirmLabel="Eliminar categoría"
              className="mt-4"
              trigger={
                <>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Eliminar categoría
                </>
              }
            >
              <input type="hidden" name="id" value={category.id} />
            </ConfirmForm>
          </>
        )}
      </section>
    </div>
  );
}
