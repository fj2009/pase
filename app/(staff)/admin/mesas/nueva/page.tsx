import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TableForm } from "@/components/admin/table-form";
import { MessageFromQuery } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/features/auth/session";
import { saveTableAction } from "@/features/tables/actions";
import { getTablesAdmin } from "@/features/tables/admin";

export const metadata = { title: "Nueva mesa · Pase" };

export default async function NewTablePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireCapability("manageTables");
  const tables = await getTablesAdmin(
    context.user.id,
    context.restaurant.restaurantId,
  );
  const zones = [
    ...new Set(tables.map((table) => table.zone).filter((zone): zone is string => Boolean(zone))),
  ].sort();

  return (
    <div className="space-y-8">
      <MessageFromQuery value={params.error} />
      <PageHeader
        kicker="Sala"
        title="Nueva mesa"
        description="Al crearla se genera un QR único. Podrás descargarlo en PNG y colocarlo en la mesa."
        actions={
          <Link href="/admin/mesas" className="btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver a mesas
          </Link>
        }
      />
      <div className="panel max-w-2xl p-5 sm:p-6">
        <TableForm
          action={saveTableAction}
          returnTo="/admin/mesas/nueva"
          zones={zones}
        />
      </div>
    </div>
  );
}
