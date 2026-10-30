import { z } from "zod";
import { publicQuery } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().min(1).max(80),
  tableToken: z.string().min(16).max(120),
  idempotencyKey: z.string().min(10).max(120),
  note: z.string().trim().max(200).optional(),
});

interface BillResult {
  ok: boolean;
  reason?: string;
  duplicate?: boolean;
  status?: string;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Solicitud no válida." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";

  const allowed = await publicQuery<{ allowed: boolean }>(
    "SELECT api.hit_rate_limit($1, $2, $3) AS allowed",
    [`bill-ip:${ip}`, 12, 60],
  );
  if (!allowed[0]?.allowed) {
    return Response.json(
      { ok: false, message: "Demasiadas solicitudes. Espera un momento." },
      { status: 429 },
    );
  }

  const rows = await publicQuery<{ result: BillResult }>(
    "SELECT api.request_bill($1, $2, $3, $4) AS result",
    [
      parsed.data.slug,
      parsed.data.tableToken,
      parsed.data.idempotencyKey,
      parsed.data.note ?? null,
    ],
  );
  const result = rows[0]?.result;

  if (!result?.ok) {
    const reason = result?.reason;
    const message =
      reason === "service_closed"
        ? "La mesa todavía no tiene el servicio abierto. Avisa al personal."
        : reason === "rate_limited"
          ? "Has solicitado la cuenta varias veces. Espera un minuto."
          : "El enlace de la mesa no es válido.";
    const status = reason === "rate_limited" ? 429 : reason === "service_closed" ? 409 : 404;
    return Response.json({ ok: false, message }, { status });
  }

  return Response.json(
    { ok: true, status: result.status, duplicate: result.duplicate ?? false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
