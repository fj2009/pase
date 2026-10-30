import type { NextRequest } from "next/server";
import { subscribe, type LiveEvent } from "@/lib/realtime/bus";
import { publicQuery } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) {
    return new Response("No encontrado", { status: 404 });
  }

  const rows = await publicQuery<{ tracking: unknown }>(
    "SELECT api.tracking($1) AS tracking",
    [token],
  );
  if (!rows[0]?.tracking) {
    return new Response("No encontrado", { status: 404 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: LiveEvent) => {
        if (closed) return;
        if (event.tracking_token !== token) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      controller.enqueue(encoder.encode("retry: 4000\n\n"));
      const unsubscribe = subscribe(
        (event) => event.tracking_token === token,
        send,
      );
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("data: ping\n\n"));
        } catch {
          closed = true;
        }
      }, 20_000);

      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
