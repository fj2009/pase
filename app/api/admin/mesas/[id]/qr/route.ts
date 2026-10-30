import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { can } from "@/features/permissions/capabilities";
import { getStaffContext } from "@/features/auth/session";
import { userQuery } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getStaffContext();
  if (!context?.restaurant || !context.role || !can(context.role, "manageTables")) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { id } = await params;
  const rows = await userQuery<{ qr_token: string }>(
    context.user.id,
    `SELECT qr_token FROM dining_tables WHERE id = $1 AND restaurant_id = $2`,
    [id, context.restaurant.restaurantId],
  );
  const table = rows[0];
  if (!table) return new NextResponse("Mesa no encontrada", { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const download = url.searchParams.get("download") === "1";
  const target = `${env.SITE_URL}/carta/${context.restaurant.slug}?mesa=${table.qr_token}`;
  const options = {
    margin: 1,
    width: 1024,
    errorCorrectionLevel: "M" as const,
    color: { dark: "#1F241D", light: "#FFFFFF" },
  };

  const png = format === "png" ? await QRCode.toBuffer(target, { ...options, type: "png" }) : null;
  const body = png ? new Uint8Array(png) : await QRCode.toString(target, { ...options, type: "svg" });

  return new NextResponse(body, {
    headers: {
      "Content-Type": format === "png" ? "image/png" : "image/svg+xml",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="pase-qr-${id}.${format}"`,
    },
  });
}
