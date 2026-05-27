import { getCurrentUser } from "@/lib/get-current-user";
import {
  subscribeUserMessageEvents,
  type MessageRealtimeEvent,
} from "@/lib/messages-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const closeStream = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        cleanup?.();
        cleanup = null;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const send = (event: MessageRealtimeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closeStream();
        }
      };

      void subscribeUserMessageEvents(user.id, send)
        .then((unsubscribe) => {
          if (closed) {
            unsubscribe();
            return;
          }
          cleanup = unsubscribe;
          heartbeat = setInterval(() => send({ type: "ping" }), 25000);
        })
        .catch((err) => {
          console.error("[messages/events] subscribe:", err);
          send({ type: "error", error: "realtime_unavailable" });
          closeStream();
        });

      return closeStream;
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      cleanup?.();
      cleanup = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
