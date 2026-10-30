import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryForm } from "@/components/admin/category-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { saveCategoryAction } from "@/features/menu/actions";

export const metadata = { title: "Nueva categoría · Pase" };

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireCapability("manageMenu");

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.error} />
      <PageHeader
        kicker="Carta"
        title="Nueva categoría"
        description="Las categorías ordenan la carta pública y el buscador de sala. Puedes ocultarlas sin borrarlas."
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
          returnTo="/admin/carta/categoria/nueva"
        />
      </div>
    </div>
  );
}
