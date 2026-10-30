import type { NextRequest } from "next/server";
import { subscribe, type LiveEvent } from "@/lib/realtime/bus";
import { getStaffContext } from "@/features/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getStaffContext();
  if (!context?.restaurant) {
    return new Response("No autorizado", { status: 401 });
  }

  const restaurantId = context.restaurant.restaurantId;

  return stream(request, (event) => event.restaurant_id === restaurantId);
}

function stream(request: NextRequest, filter: (event: LiveEvent) => boolean) {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: LiveEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      controller.enqueue(encoder.encode("retry: 4000\n\n"));
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));

      const unsubscribe = subscribe(filter, send);
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("data: ping\n\n"));
        } catch {
          closed = true;
        }
      }, 20_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      };

      request.signal.addEventListener("abort", cleanup);
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
